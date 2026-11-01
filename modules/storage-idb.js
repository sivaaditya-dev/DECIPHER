/**
 * storage-idb.js - IndexedDB & In-Memory Offline Storage Adapter
 * Decipher Language Learning Platform
 *
 * Implements persistent local storage for offline vocabulary decks,
 * review cards with SM-2 spaced repetition schedules, and an offline
 * sync queue for study progress synchronization.
 *
 * Features:
 * - IndexedDB storage adapter for modern browsers
 * - Transparent MemoryStorageAdapter fallback for Node/Jest and unsupported environments
 * - Auto-incrementing FIFO sync queue with status tracking (pending, syncing, completed, failed)
 * - Due-card querying by scheduled SM-2 review timestamp
 * - Cascade deletion of cards on deck removal
 */

export const DB_NAME = 'decipher-offline-db';
export const DB_VERSION = 1;

export const STORES = {
  DECKS: 'vocabulary_decks',
  CARDS: 'review_cards',
  SYNC_QUEUE: 'sync_queue'
};

export const SYNC_STATUS = {
  PENDING: 'pending',
  SYNCING: 'syncing',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

export const SYNC_ACTIONS = {
  RECORD_REVIEW: 'RECORD_REVIEW',
  UPDATE_CARD: 'UPDATE_CARD',
  SAVE_DECK: 'SAVE_DECK',
  DELETE_CARD: 'DELETE_CARD',
  DELETE_DECK: 'DELETE_DECK',
  BATCH_SYNC: 'BATCH_SYNC'
};

function deepClone(obj) {
  if (obj === undefined || obj === null) return obj;
  return JSON.parse(JSON.stringify(obj));
}

/**
 * In-Memory Storage Adapter for Node/Jest testing and environments without IndexedDB
 */
export class MemoryStorageAdapter {
  constructor(options = {}) {
    this.type = 'memory';
    this.options = options;
    this.decks = new Map();
    this.cards = new Map();
    this.syncQueue = [];
    this.nextSyncId = 1;
    this.isOpen = false;
  }

  async init() {
    this.isOpen = true;
    return this;
  }

  async close() {
    this.isOpen = false;
    return true;
  }

  async clearAllData() {
    this.decks.clear();
    this.cards.clear();
    this.syncQueue = [];
    this.nextSyncId = 1;
    return true;
  }

  // --- Decks ---
  async saveDeck(deck) {
    if (!deck || typeof deck !== 'object') {
      throw new TypeError('Deck must be a valid object');
    }
    const id = deck.id || `deck_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = Date.now();
    const stored = {
      ...deepClone(deck),
      id,
      createdAt: deck.createdAt || now,
      updatedAt: deck.updatedAt || now
    };
    this.decks.set(id, stored);
    return deepClone(stored);
  }

  async getDeck(id) {
    if (!id) return null;
    const deck = this.decks.get(id);
    return deck ? deepClone(deck) : null;
  }

  async getDecks() {
    return Array.from(this.decks.values())
      .map(d => deepClone(d))
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  async deleteDeck(id) {
    if (!id) return false;
    const existed = this.decks.delete(id);
    for (const [cardId, card] of this.cards.entries()) {
      if (card.deckId === id) {
        this.cards.delete(cardId);
      }
    }
    return existed;
  }

  // --- Cards ---
  async saveCard(card) {
    if (!card || typeof card !== 'object') {
      throw new TypeError('Card must be a valid object');
    }
    const id = card.id || `card_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = Date.now();
    const stored = {
      ...deepClone(card),
      id,
      createdAt: card.createdAt || now,
      updatedAt: now
    };
    this.cards.set(id, stored);
    return deepClone(stored);
  }

  async saveCards(cards) {
    if (!Array.isArray(cards)) {
      throw new TypeError('Cards must be an array');
    }
    const saved = [];
    for (const card of cards) {
      saved.push(await this.saveCard(card));
    }
    return saved;
  }

  async getCard(id) {
    if (!id) return null;
    const card = this.cards.get(id);
    return card ? deepClone(card) : null;
  }

  async getCards(deckId = null) {
    let list = Array.from(this.cards.values());
    if (deckId !== null && deckId !== undefined) {
      list = list.filter(c => c.deckId === deckId);
    }
    return list.map(c => deepClone(c));
  }

  async deleteCard(id) {
    if (!id) return false;
    return this.cards.delete(id);
  }

  async getDueCards(asOfDate = new Date(), deckId = null) {
    const targetTimestamp = asOfDate instanceof Date ? asOfDate.getTime() : new Date(asOfDate).getTime();
    let list = Array.from(this.cards.values());
    if (deckId !== null && deckId !== undefined) {
      list = list.filter(c => c.deckId === deckId);
    }

    return list
      .filter(card => {
        if (!card.dueDate) return true;
        const cardDue = card.dueDate instanceof Date ? card.dueDate.getTime() : new Date(card.dueDate).getTime();
        return cardDue <= targetTimestamp;
      })
      .sort((a, b) => {
        const dueA = a.dueDate ? new Date(a.dueDate).getTime() : 0;
        const dueB = b.dueDate ? new Date(b.dueDate).getTime() : 0;
        return dueA - dueB;
      })
      .map(c => deepClone(c));
  }

  async updateCardSRS(id, srsData = {}) {
    if (!id) return null;
    const existing = this.cards.get(id);
    if (!existing) return null;

    const updated = {
      ...existing,
      ...deepClone(srsData),
      updatedAt: Date.now()
    };
    this.cards.set(id, updated);
    return deepClone(updated);
  }

  // --- Offline Sync Queue ---
  async queueSyncAction(actionType, payload = {}) {
    const id = this.nextSyncId++;
    const now = Date.now();
    const item = {
      id,
      actionType,
      payload: deepClone(payload),
      status: SYNC_STATUS.PENDING,
      retryCount: 0,
      createdAt: now,
      updatedAt: now,
      lastError: null
    };
    this.syncQueue.push(item);
    return deepClone(item);
  }

  async getSyncQueue(status = null) {
    let list = this.syncQueue;
    if (status !== null && status !== undefined) {
      list = list.filter(item => item.status === status);
    }
    return list.map(item => deepClone(item));
  }

  async updateSyncItem(id, updates = {}) {
    const item = this.syncQueue.find(i => i.id === id);
    if (!item) return null;
    Object.assign(item, deepClone(updates), { updatedAt: Date.now() });
    return deepClone(item);
  }

  async removeSyncItem(id) {
    const idx = this.syncQueue.findIndex(i => i.id === id);
    if (idx === -1) return false;
    this.syncQueue.splice(idx, 1);
    return true;
  }

  async clearSyncQueue() {
    this.syncQueue = [];
    return true;
  }

  async flushSyncQueue(syncHandler) {
    if (typeof syncHandler !== 'function') {
      throw new TypeError('syncHandler must be a function');
    }
    const pending = this.syncQueue.filter(
      i => i.status === SYNC_STATUS.PENDING || i.status === SYNC_STATUS.FAILED
    );
    let succeeded = 0;
    let failed = 0;

    for (const item of pending) {
      item.status = SYNC_STATUS.SYNCING;
      item.updatedAt = Date.now();
      try {
        await syncHandler(deepClone(item));
        item.status = SYNC_STATUS.COMPLETED;
        item.updatedAt = Date.now();
        succeeded++;
      } catch (err) {
        item.status = SYNC_STATUS.FAILED;
        item.retryCount = (item.retryCount || 0) + 1;
        item.lastError = err?.message || String(err);
        item.updatedAt = Date.now();
        failed++;
      }
    }

    return {
      total: pending.length,
      processed: succeeded + failed,
      succeeded,
      failed
    };
  }
}

/**
 * Production IndexedDB Storage Adapter for Browsers
 */
export class IndexedDBStorageAdapter {
  constructor(options = {}) {
    this.type = 'indexeddb';
    this.options = options;
    this.dbName = options.dbName || DB_NAME;
    this.dbVersion = options.dbVersion || DB_VERSION;
    this.db = null;
    this._idbFactory = options.idbFactory || null;
  }

  async init() {
    if (this.db) return this;
    const idb = this._idbFactory || (typeof indexedDB !== 'undefined' ? indexedDB : (typeof window !== 'undefined' ? window.indexedDB : null));
    if (!idb) {
      throw new Error('IndexedDB is not supported in this runtime environment');
    }

    return new Promise((resolve, reject) => {
      const request = idb.open(this.dbName, this.dbVersion);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        // 1. vocabulary_decks
        if (!db.objectStoreNames.contains(STORES.DECKS)) {
          const deckStore = db.createObjectStore(STORES.DECKS, { keyPath: 'id' });
          deckStore.createIndex('updatedAt', 'updatedAt', { unique: false });
          deckStore.createIndex('title', 'title', { unique: false });
          deckStore.createIndex('createdAt', 'createdAt', { unique: false });
        }
        // 2. review_cards
        if (!db.objectStoreNames.contains(STORES.CARDS)) {
          const cardStore = db.createObjectStore(STORES.CARDS, { keyPath: 'id' });
          cardStore.createIndex('deckId', 'deckId', { unique: false });
          cardStore.createIndex('dueDate', 'dueDate', { unique: false });
          cardStore.createIndex('repetitions', 'repetitions', { unique: false });
          cardStore.createIndex('term', 'term', { unique: false });
        }
        // 3. sync_queue
        if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
          const queueStore = db.createObjectStore(STORES.SYNC_QUEUE, { keyPath: 'id', autoIncrement: true });
          queueStore.createIndex('status', 'status', { unique: false });
          queueStore.createIndex('createdAt', 'createdAt', { unique: false });
          queueStore.createIndex('actionType', 'actionType', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this);
      };

      request.onerror = () => {
        reject(request.error || new Error('Failed to open IndexedDB database'));
      };

      request.onblocked = () => {
        console.warn('[IndexedDB] Database open blocked by another tab');
      };
    });
  }

  async close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    return true;
  }

  _tx(storeName, mode, callback) {
    return new Promise(async (resolve, reject) => {
      try {
        if (!this.db) await this.init();
        const tx = this.db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        let result;

        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error || new Error(`IndexedDB transaction error on ${storeName}`));
        tx.onabort = () => reject(tx.error || new Error(`IndexedDB transaction aborted on ${storeName}`));

        result = await callback(store, tx);
      } catch (err) {
        reject(err);
      }
    });
  }

  async clearAllData() {
    await this._tx(STORES.DECKS, 'readwrite', store => store.clear());
    await this._tx(STORES.CARDS, 'readwrite', store => store.clear());
    await this._tx(STORES.SYNC_QUEUE, 'readwrite', store => store.clear());
    return true;
  }

  // --- Decks ---
  async saveDeck(deck) {
    if (!deck || typeof deck !== 'object') {
      throw new TypeError('Deck must be a valid object');
    }
    const id = deck.id || `deck_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = Date.now();
    const stored = {
      ...deepClone(deck),
      id,
      createdAt: deck.createdAt || now,
      updatedAt: deck.updatedAt || now
    };

    await this._tx(STORES.DECKS, 'readwrite', store => store.put(stored));
    return deepClone(stored);
  }

  async getDeck(id) {
    if (!id) return null;
    return new Promise(async (resolve, reject) => {
      try {
        if (!this.db) await this.init();
        const tx = this.db.transaction(STORES.DECKS, 'readonly');
        const store = tx.objectStore(STORES.DECKS);
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result ? deepClone(req.result) : null);
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  async getDecks() {
    return new Promise(async (resolve, reject) => {
      try {
        if (!this.db) await this.init();
        const tx = this.db.transaction(STORES.DECKS, 'readonly');
        const store = tx.objectStore(STORES.DECKS);
        const req = store.getAll();
        req.onsuccess = () => {
          const list = (req.result || [])
            .map(d => deepClone(d))
            .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
          resolve(list);
        };
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  async deleteDeck(id) {
    if (!id) return false;
    const cards = await this.getCards(id);
    await this._tx(STORES.DECKS, 'readwrite', store => store.delete(id));
    for (const card of cards) {
      await this.deleteCard(card.id);
    }
    return true;
  }

  // --- Cards ---
  async saveCard(card) {
    if (!card || typeof card !== 'object') {
      throw new TypeError('Card must be a valid object');
    }
    const id = card.id || `card_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = Date.now();
    const stored = {
      ...deepClone(card),
      id,
      createdAt: card.createdAt || now,
      updatedAt: now
    };
    await this._tx(STORES.CARDS, 'readwrite', store => store.put(stored));
    return deepClone(stored);
  }

  async saveCards(cards) {
    if (!Array.isArray(cards)) {
      throw new TypeError('Cards must be an array');
    }
    const saved = [];
    for (const card of cards) {
      saved.push(await this.saveCard(card));
    }
    return saved;
  }

  async getCard(id) {
    if (!id) return null;
    return new Promise(async (resolve, reject) => {
      try {
        if (!this.db) await this.init();
        const tx = this.db.transaction(STORES.CARDS, 'readonly');
        const store = tx.objectStore(STORES.CARDS);
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result ? deepClone(req.result) : null);
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  async getCards(deckId = null) {
    return new Promise(async (resolve, reject) => {
      try {
        if (!this.db) await this.init();
        const tx = this.db.transaction(STORES.CARDS, 'readonly');
        const store = tx.objectStore(STORES.CARDS);
        const req = store.getAll();
        req.onsuccess = () => {
          let list = req.result || [];
          if (deckId !== null && deckId !== undefined) {
            list = list.filter(c => c.deckId === deckId);
          }
          resolve(list.map(c => deepClone(c)));
        };
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  async deleteCard(id) {
    if (!id) return false;
    await this._tx(STORES.CARDS, 'readwrite', store => store.delete(id));
    return true;
  }

  async getDueCards(asOfDate = new Date(), deckId = null) {
    const targetTimestamp = asOfDate instanceof Date ? asOfDate.getTime() : new Date(asOfDate).getTime();
    const allCards = await this.getCards(deckId);

    return allCards
      .filter(card => {
        if (!card.dueDate) return true;
        const cardDue = card.dueDate instanceof Date ? card.dueDate.getTime() : new Date(card.dueDate).getTime();
        return cardDue <= targetTimestamp;
      })
      .sort((a, b) => {
        const dueA = a.dueDate ? new Date(a.dueDate).getTime() : 0;
        const dueB = b.dueDate ? new Date(b.dueDate).getTime() : 0;
        return dueA - dueB;
      });
  }

  async updateCardSRS(id, srsData = {}) {
    if (!id) return null;
    const existing = await this.getCard(id);
    if (!existing) return null;

    const updated = {
      ...existing,
      ...deepClone(srsData),
      updatedAt: Date.now()
    };
    await this._tx(STORES.CARDS, 'readwrite', store => store.put(updated));
    return deepClone(updated);
  }

  // --- Offline Sync Queue ---
  async queueSyncAction(actionType, payload = {}) {
    const now = Date.now();
    const item = {
      actionType,
      payload: deepClone(payload),
      status: SYNC_STATUS.PENDING,
      retryCount: 0,
      createdAt: now,
      updatedAt: now,
      lastError: null
    };

    return new Promise(async (resolve, reject) => {
      try {
        if (!this.db) await this.init();
        const tx = this.db.transaction(STORES.SYNC_QUEUE, 'readwrite');
        const store = tx.objectStore(STORES.SYNC_QUEUE);
        const req = store.put(item);
        req.onsuccess = () => {
          item.id = req.result;
          resolve(deepClone(item));
        };
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  async getSyncQueue(status = null) {
    return new Promise(async (resolve, reject) => {
      try {
        if (!this.db) await this.init();
        const tx = this.db.transaction(STORES.SYNC_QUEUE, 'readonly');
        const store = tx.objectStore(STORES.SYNC_QUEUE);
        const req = store.getAll();
        req.onsuccess = () => {
          let list = req.result || [];
          if (status !== null && status !== undefined) {
            list = list.filter(item => item.status === status);
          }
          resolve(list.map(i => deepClone(i)));
        };
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  async updateSyncItem(id, updates = {}) {
    return new Promise(async (resolve, reject) => {
      try {
        if (!this.db) await this.init();
        const tx = this.db.transaction(STORES.SYNC_QUEUE, 'readwrite');
        const store = tx.objectStore(STORES.SYNC_QUEUE);
        const getReq = store.get(id);

        getReq.onsuccess = () => {
          const item = getReq.result;
          if (!item) return resolve(null);
          Object.assign(item, deepClone(updates), { updatedAt: Date.now() });
          const putReq = store.put(item);
          putReq.onsuccess = () => resolve(deepClone(item));
          putReq.onerror = () => reject(putReq.error);
        };
        getReq.onerror = () => reject(getReq.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  async removeSyncItem(id) {
    await this._tx(STORES.SYNC_QUEUE, 'readwrite', store => store.delete(id));
    return true;
  }

  async clearSyncQueue() {
    await this._tx(STORES.SYNC_QUEUE, 'readwrite', store => store.clear());
    return true;
  }

  async flushSyncQueue(syncHandler) {
    if (typeof syncHandler !== 'function') {
      throw new TypeError('syncHandler must be a function');
    }
    const queue = await this.getSyncQueue();
    const pending = queue.filter(
      i => i.status === SYNC_STATUS.PENDING || i.status === SYNC_STATUS.FAILED
    );
    let succeeded = 0;
    let failed = 0;

    for (const item of pending) {
      await this.updateSyncItem(item.id, { status: SYNC_STATUS.SYNCING });
      try {
        await syncHandler(deepClone(item));
        await this.updateSyncItem(item.id, { status: SYNC_STATUS.COMPLETED });
        succeeded++;
      } catch (err) {
        await this.updateSyncItem(item.id, {
          status: SYNC_STATUS.FAILED,
          retryCount: (item.retryCount || 0) + 1,
          lastError: err?.message || String(err)
        });
        failed++;
      }
    }

    return {
      total: pending.length,
      processed: succeeded + failed,
      succeeded,
      failed
    };
  }
}

/**
 * Factory to retrieve appropriate storage adapter
 */
export function getStorageAdapter(options = {}) {
  const forceMemory = options.forceMemory === true;
  const hasIDB = !forceMemory && (
    (typeof indexedDB !== 'undefined' && indexedDB !== null) ||
    (typeof window !== 'undefined' && window.indexedDB !== null && window.indexedDB !== undefined)
  );

  if (hasIDB) {
    return new IndexedDBStorageAdapter(options);
  }
  return new MemoryStorageAdapter(options);
}

let defaultAdapterInstance = null;

/**
 * Open default storage singleton
 */
export async function openStorage(options = {}) {
  if (!defaultAdapterInstance || options.fresh) {
    defaultAdapterInstance = getStorageAdapter(options);
    await defaultAdapterInstance.init();
  }
  return defaultAdapterInstance;
}

// Module-level convenience delegates
export async function saveDeck(deck) {
  const adapter = await openStorage();
  return adapter.saveDeck(deck);
}

export async function getDecks() {
  const adapter = await openStorage();
  return adapter.getDecks();
}

export async function getDeck(id) {
  const adapter = await openStorage();
  return adapter.getDeck(id);
}

export async function deleteDeck(id) {
  const adapter = await openStorage();
  return adapter.deleteDeck(id);
}

export async function saveCard(card) {
  const adapter = await openStorage();
  return adapter.saveCard(card);
}

export async function saveCards(cards) {
  const adapter = await openStorage();
  return adapter.saveCards(cards);
}

export async function getCards(deckId) {
  const adapter = await openStorage();
  return adapter.getCards(deckId);
}

export async function getCard(id) {
  const adapter = await openStorage();
  return adapter.getCard(id);
}

export async function deleteCard(id) {
  const adapter = await openStorage();
  return adapter.deleteCard(id);
}

export async function getDueCards(asOfDate, deckId) {
  const adapter = await openStorage();
  return adapter.getDueCards(asOfDate, deckId);
}

export async function updateCardSRS(id, srsData) {
  const adapter = await openStorage();
  return adapter.updateCardSRS(id, srsData);
}

export async function queueSyncAction(actionType, payload) {
  const adapter = await openStorage();
  return adapter.queueSyncAction(actionType, payload);
}

export async function getSyncQueue(status) {
  const adapter = await openStorage();
  return adapter.getSyncQueue(status);
}

export async function updateSyncItem(id, updates) {
  const adapter = await openStorage();
  return adapter.updateSyncItem(id, updates);
}

export async function removeSyncItem(id) {
  const adapter = await openStorage();
  return adapter.removeSyncItem(id);
}

export async function flushSyncQueue(syncHandler) {
  const adapter = await openStorage();
  return adapter.flushSyncQueue(syncHandler);
}

export async function clearAllData() {
  const adapter = await openStorage();
  return adapter.clearAllData();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DB_NAME,
    DB_VERSION,
    STORES,
    SYNC_STATUS,
    SYNC_ACTIONS,
    MemoryStorageAdapter,
    IndexedDBStorageAdapter,
    getStorageAdapter,
    openStorage,
    saveDeck,
    getDecks,
    getDeck,
    deleteDeck,
    saveCard,
    saveCards,
    getCards,
    getCard,
    deleteCard,
    getDueCards,
    updateCardSRS,
    queueSyncAction,
    getSyncQueue,
    updateSyncItem,
    removeSyncItem,
    flushSyncQueue,
    clearAllData
  };
}
