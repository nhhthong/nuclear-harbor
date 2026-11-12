import { shouldRegisterServiceWorker } from './manifest';

/**
 * Register the hand-written service worker (`public/sw.js`) in production builds only (T-17).
 * Failures are logged as warnings and never block the game: online play does not need the worker.
 */
export function registerOffline(): void {
  const supported = typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
  const secure = typeof window !== 'undefined' && window.isSecureContext;
  if (!shouldRegisterServiceWorker({ prod: import.meta.env.PROD, supported, secure })) return;
  const register = (): void => {
    navigator.serviceWorker.register(new URL('sw.js', document.baseURI)).catch((error: unknown) => {
      console.warn('[offline] service worker registration failed', error);
    });
  };
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}
