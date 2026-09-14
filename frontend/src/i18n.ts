import { useSyncExternalStore } from 'react';
import { translations } from './translations';
export type Language = 'en' | 'fr' | 'es';
const storageKey = 'goshenignite.language';
const isLanguage = (value: unknown): value is Language =>
  value === 'en' || value === 'fr' || value === 'es';
function initialLanguage(): Language {
  try {
    const saved = localStorage.getItem(storageKey);
    if (isLanguage(saved)) return saved;
  } catch {
    /* Storage may be disabled. */
  }
  return 'en';
}
let language = initialLanguage();
const listeners = new Set<() => void>();
export function locale() {
  return { en: 'en-US', fr: 'fr-FR', es: 'es-ES' }[language];
}
export function t(key: string, values: Record<string, string | number> = {}): string {
  const translated =
    language === 'en' ? key : (translations[key]?.[language === 'fr' ? 0 : 1] ?? key);
  return translated.replace(/\{(\w+)\}/g, (match, name: string) => String(values[name] ?? match));
}
function updateDocument() {
  document.documentElement.lang = language;
  document.title = `Goshenignite · ${t('Inventory')}`;
}
export function setLanguage(next: Language) {
  if (!isLanguage(next)) return;
  language = next;
  try {
    localStorage.setItem(storageKey, next);
  } catch {
    /* Switching still works without persistence. */
  }
  updateDocument();
  listeners.forEach((listener) => listener());
}
export function useLanguage() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => language,
  );
}
export function errorText(message: string) {
  if (language === 'en' || translations[message]) return t(message);
  for (const key of [
    'Choose a different destination',
    'Quantity cannot be zero',
    'Quantity must be positive',
    'An item may appear only once',
  ]) {
    if (message.includes(key)) return t(key);
  }
  return t(
    message.includes(': ')
      ? 'Please check the form fields and try again.'
      : 'An unexpected error occurred',
  );
}
updateDocument();
window.addEventListener('storage', (event) => {
  if (event.key === storageKey) {
    language = isLanguage(event.newValue) ? event.newValue : 'en';
    updateDocument();
    listeners.forEach((listener) => listener());
  }
});
