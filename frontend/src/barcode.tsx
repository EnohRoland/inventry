import { useEffect, useRef, useState } from 'react';
import { Camera, ScanLine, X } from 'lucide-react';
import { t } from './i18n';

const cameraSupported = typeof window !== 'undefined' && 'BarcodeDetector' in window;

export function BarcodeScan({ onScan }: { onScan: (code: string) => void }) {
  const [value, setValue] = useState('');
  const [camera, setCamera] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef(0);

  function submit() {
    const code = value.trim();
    if (!code) return;
    onScan(code);
    setValue('');
  }

  useEffect(() => {
    if (!camera || !window.BarcodeDetector) return;
    let cancelled = false;
    const detector = new window.BarcodeDetector();
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        const tick = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const [found] = await detector.detect(videoRef.current);
            if (found?.rawValue) {
              onScan(found.rawValue);
              setCamera(false);
              return;
            }
          } catch {
            /* A single failed frame is not fatal; keep scanning. */
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch {
        if (!cancelled) {
          setCameraError(t('Camera access was denied or is unavailable.'));
          setCamera(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [camera]);

  return (
    <div className="barcode-scan">
      <div className="barcode-row">
        <div className="search barcode-input">
          <ScanLine size={16} />
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={t('Scan or type a barcode/SKU, then press Enter')}
          />
        </div>
        {cameraSupported && (
          <button type="button" className="secondary" onClick={() => setCamera((c) => !c)}>
            {camera ? <X size={16} /> : <Camera size={16} />}
            {camera ? t('Stop camera') : t('Scan with camera')}
          </button>
        )}
      </div>
      {!cameraSupported && (
        <small className="muted">{t('Camera scanning needs Chrome/Edge over HTTPS.')}</small>
      )}
      {cameraError && (
        <p className="error" role="alert">
          {cameraError}
        </p>
      )}
      {camera && (
        <div className="camera-overlay">
          <video ref={videoRef} muted playsInline />
          <p className="muted">{t('Point the camera at a barcode.')}</p>
        </div>
      )}
    </div>
  );
}
