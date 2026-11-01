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

  // Pre-initialize offline storage adapter
  getOfflineStorage().then(adapter => {
    console.log(`[PWA] Offline storage adapter initialized (${adapter.type})`);
  }).catch(err => {
    console.warn('[PWA] Storage adapter initialization failed:', err);
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initPWA,
    getOfflineStorage,
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
