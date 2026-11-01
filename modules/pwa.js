/**
 * pwa.js - Progressive Web App Registration & Offline Controller
 * Decipher Language Learning Platform
 */

import {
  openStorage,
  getStorageAdapter,
  MemoryStorageAdapter,
  IndexedDBStorageAdapter,
  DB_NAME,
  STORES,
  SYNC_STATUS,
  SYNC_ACTIONS
} from './storage-idb.js';

export {
  openStorage,
  getStorageAdapter,
  MemoryStorageAdapter,
  IndexedDBStorageAdapter,
  DB_NAME,
  STORES,
  SYNC_STATUS,
  SYNC_ACTIONS
};

let offlineStoragePromise = null;

export function getOfflineStorage() {
  if (!offlineStoragePromise) {
    offlineStoragePromise = openStorage();
  }
  return offlineStoragePromise;
}

/**
 * Request background sync via Service Worker SyncManager
 */
export async function requestBackgroundSync(tag = 'sync-study-progress') {
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator && typeof window !== 'undefined' && 'SyncManager' in window) {
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.sync.register(tag);
      console.log(`[PWA] Background sync registered for tag: ${tag}`);
      return true;
    } catch (err) {
      console.warn('[PWA] Background sync registration failed:', err);
    }
  }

  // Fallback for browsers without SyncManager (e.g. Safari, Firefox)
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    return flushSyncQueue();
  }
  return false;
}

/**
 * Enqueue an offline study progress action and trigger sync
 */
export async function queueOfflineAction(actionType, payload = {}) {
  const adapter = await getOfflineStorage();
  const queuedItem = await adapter.queueSyncAction(actionType, payload);

  // If online, immediately attempt background sync or flush
  if (typeof navigator === 'undefined' || navigator.onLine) {
    requestBackgroundSync('sync-study-progress').catch(() => {});
  }

  return queuedItem;
}

/**
 * Flush pending sync items to server batch endpoint
 */
export async function flushSyncQueue(apiEndpoint = '/api/sync/batch', customFetch = null) {
  const adapter = await getOfflineStorage();
  const pendingItems = await adapter.getSyncQueue(SYNC_STATUS.PENDING);
  const failedItems = await adapter.getSyncQueue(SYNC_STATUS.FAILED);
  const allToSync = [...pendingItems, ...failedItems];

  if (allToSync.length === 0) {
    return { total: 0, processed: 0, succeeded: 0, failed: 0 };
  }

  const batchPayload = {
    batchId: `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    clientTimestamp: Date.now(),
    items: allToSync
  };

  const fetcher = customFetch || (typeof fetch !== 'undefined' ? fetch : null);
  if (!fetcher) {
    console.warn('[PWA] No fetch implementation available for flushSyncQueue');
    return { total: allToSync.length, processed: 0, succeeded: 0, failed: allToSync.length };
  }

  // Mark all syncing
  for (const item of allToSync) {
    await adapter.updateSyncItem(item.id, { status: SYNC_STATUS.SYNCING });
  }

  try {
    const res = await fetcher(apiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batchPayload)
    });

    if (!res.ok) {
      throw new Error(`Server returned HTTP ${res.status}`);
    }

    const data = await res.json();
    const syncedIds = new Set(data.syncedIds || allToSync.map(i => i.id));

    let succeeded = 0;
    for (const item of allToSync) {
      if (syncedIds.has(item.id)) {
        await adapter.removeSyncItem(item.id);
        succeeded++;
      } else {
        await adapter.updateSyncItem(item.id, {
          status: SYNC_STATUS.FAILED,
          retryCount: (item.retryCount || 0) + 1,
          lastError: 'Item not acknowledged by server'
        });
      }
    }

    const summary = {
      total: allToSync.length,
      processed: allToSync.length,
      succeeded,
      failed: allToSync.length - succeeded
    };

    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('pwa-sync-completed', { detail: summary }));
    }

    return summary;
  } catch (err) {
    console.warn('[PWA] Batch sync flush failed:', err.message);
    for (const item of allToSync) {
      await adapter.updateSyncItem(item.id, {
        status: SYNC_STATUS.FAILED,
        retryCount: (item.retryCount || 0) + 1,
        lastError: err.message || String(err)
      });
    }

    const failureSummary = {
      total: allToSync.length,
      processed: allToSync.length,
      succeeded: 0,
      failed: allToSync.length,
      error: err.message
    };

    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('pwa-sync-failed', { detail: failureSummary }));
    }

    return failureSummary;
  }
}

/**
 * Setup listeners for offline/online transitions and service worker messages
 */
export function initBackgroundSync(options = {}) {
  const endpoint = options.apiEndpoint || '/api/sync/batch';

  if (typeof window !== 'undefined') {
    // 1. Drain queue when internet connection is restored
    window.addEventListener('online', () => {
      console.log('[PWA] Connection restored. Flushing sync queue...');
      flushSyncQueue(endpoint);
    });

    // 2. Also attempt drain when app becomes visible again
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && (typeof navigator === 'undefined' || navigator.onLine)) {
          flushSyncQueue(endpoint);
        }
      });
    }

    // 3. Listen for Service Worker background sync triggers
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'BACKGROUND_SYNC_TRIGGERED') {
          console.log('[PWA] SW sync notification received. Flushing sync queue...');
          flushSyncQueue(endpoint);
        }
      });
    }
  }
}

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

  // Pre-initialize offline storage adapter & background sync listeners
  getOfflineStorage().then(adapter => {
    console.log(`[PWA] Offline storage adapter initialized (${adapter.type})`);
    initBackgroundSync();
  }).catch(err => {
    console.warn('[PWA] Storage adapter initialization failed:', err);
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initPWA,
    initBackgroundSync,
    getOfflineStorage,
    requestBackgroundSync,
    queueOfflineAction,
    flushSyncQueue,
    openStorage,
    getStorageAdapter,
    MemoryStorageAdapter,
    IndexedDBStorageAdapter,
    DB_NAME,
    STORES,
    SYNC_STATUS,
    SYNC_ACTIONS
  };
}
