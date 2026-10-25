/**
 * pwa.js - Progressive Web App Registration & Offline Controller
 * Decipher Language Learning Platform
 */

export function initPWA() {
  if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        console.log('[PWA] Service Worker registered with scope:', reg.scope);
      }).catch((err) => {
        console.warn('[PWA] Service Worker registration skipped:', err.message);
      });
    });
  }
}
