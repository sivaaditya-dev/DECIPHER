/**
 * sw.js - Service Worker for Decipher Offline PWA
 * Caches core shells and vocabulary libraries for offline study.
 * Implements Background Sync queue listener for offline study progress.
 */

const CACHE_NAME = 'decipher-cache-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/main.js',
  '/modules/api.js',
  '/modules/ui.js',
  '/modules/toast.js',
  '/modules/auth.js',
  '/modules/quiz.js',
  '/modules/voice.js',
  '/modules/profile.js',
  '/modules/challenge.js',
  '/modules/palette.js',
  '/modules/shortcuts.js',
  '/modules/audio-studio.js',
  '/modules/flashcards.js',
  '/modules/grammar-explainer.js',
  '/modules/speed-reader.js',
  '/modules/export-suite.js',
  '/modules/zen-focus.js',
  '/modules/trophies.js',
  '/modules/vocab-indexer.js',
  '/modules/storage-idb.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('[SW] Non-critical cache error:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Bypass cache for POST requests or Firebase Auth endpoints
  if (event.request.method !== 'GET' || url.pathname.includes('/identitytoolkit') || url.pathname.includes('/securetoken')) {
    return;
  }

  // Network-first for dynamic API routes, cache-first for static assets
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
  } else {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return cached || fetch(event.request).then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          }
          return networkRes;
        });
      })
    );
  }
});

// --- Background Sync Queue Listener ---
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-study-progress') {
    event.waitUntil(
      (async () => {
        console.log('[SW] Background sync triggered for study progress');
        const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
        for (const client of clients) {
          client.postMessage({
            type: 'BACKGROUND_SYNC_TRIGGERED',
            tag: event.tag,
            timestamp: Date.now()
          });
        }
      })()
    );
  }
});

// --- Client Message Interceptor for Manual Sync Trigger ---
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SYNC_NOW') {
    if (self.registration && self.registration.sync) {
      self.registration.sync.register('sync-study-progress').catch((err) => {
        console.warn('[SW] Manual sync registration failed:', err);
      });
    }
  }
});
