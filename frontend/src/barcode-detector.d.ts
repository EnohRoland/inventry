export {};

declare global {
  interface DetectedBarcode {
    rawValue: string;
  }
  class BarcodeDetector {
    constructor(options?: { formats?: string[] });
    detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
  }
  interface Window {
    BarcodeDetector?: typeof BarcodeDetector;
  }
}
