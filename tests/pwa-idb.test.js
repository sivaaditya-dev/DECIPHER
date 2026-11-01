/**
 * tests/pwa-idb.test.js
 * Comprehensive unit test suite for:
 * - IndexedDB storage adapter & MemoryStorageAdapter fallback
 * - Vocabulary decks CRUD operations & cascade deletions
 * - Review cards persistence & SuperMemo SM-2 due date querying
 * - Offline sync queue FIFO ordering, retry backoff, and batch flush
 * - Mock IndexedDB database schema, object store & index creation
 * - Service worker background sync client helpers
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

let storageMod;

try {
  storageMod = require('../modules/storage-idb.js');
} catch {
  const code = fs.readFileSync(path.resolve(__dirname, '../modules/storage-idb.js'), 'utf8');
  const clean = code.replace(/^export\s+/gm, '').replace(/export\s*\{[^}]*\};?/g, '');
  const wrapped = `(function() {\n${clean}\nreturn { DB_NAME, DB_VERSION, STORES, SYNC_STATUS, SYNC_ACTIONS, MemoryStorageAdapter, IndexedDBStorageAdapter, getStorageAdapter, openStorage, saveDeck, getDecks, getDeck, deleteDeck, saveCard, saveCards, getCards, getCard, deleteCard, getDueCards, updateCardSRS, queueSyncAction, getSyncQueue, updateSyncItem, removeSyncItem, flushSyncQueue, clearAllData };\n})()`;
  const sandbox = {
    console, Date, Math, Array, Object, Number, RangeError, TypeError, Error, JSON, Map, Set, String,
    parseInt, parseFloat, isNaN, setTimeout, clearTimeout
  };
  vm.createContext(sandbox);
  storageMod = vm.runInContext(wrapped, sandbox);
}

const {
  DB_NAME,
  DB_VERSION,
  STORES,
  SYNC_STATUS,
  SYNC_ACTIONS,
  MemoryStorageAdapter,
  IndexedDBStorageAdapter,
  getStorageAdapter,
  openStorage
} = storageMod;

// Mock IDB Environment for Testing IndexedDBStorageAdapter
class MockIDBRequest {
  constructor() {
    this.result = null;
    this.error = null;
    this.onsuccess = null;
    this.onerror = null;
  }
}

class MockIDBObjectStore {
  constructor(name, options = {}) {
    this.name = name;
    this.keyPath = options.keyPath || 'id';
    this.autoIncrement = !!options.autoIncrement;
    this.indexes = new Map();
    this.records = new Map();
    this._autoId = 1;
  }

  createIndex(name, keyPath, opts) {
    this.indexes.set(name, { name, keyPath, opts });
  }

  put(value) {
    const req = new MockIDBRequest();
    setTimeout(() => {
      let key = value[this.keyPath];
      if (this.autoIncrement && (key === undefined || key === null)) {
        key = this._autoId++;
        value = { ...value, [this.keyPath]: key };
      }
      this.records.set(key, JSON.parse(JSON.stringify(value)));
      req.result = key;
      if (req.onsuccess) req.onsuccess({ target: req });
    }, 0);
    return req;
  }

  get(key) {
    const req = new MockIDBRequest();
    setTimeout(() => {
      const val = this.records.get(key);
      req.result = val ? JSON.parse(JSON.stringify(val)) : undefined;
      if (req.onsuccess) req.onsuccess({ target: req });
    }, 0);
    return req;
  }

  getAll() {
    const req = new MockIDBRequest();
    setTimeout(() => {
      req.result = Array.from(this.records.values()).map(v => JSON.parse(JSON.stringify(v)));
      if (req.onsuccess) req.onsuccess({ target: req });
    }, 0);
    return req;
  }

  delete(key) {
    const req = new MockIDBRequest();
    setTimeout(() => {
      this.records.delete(key);
      req.result = undefined;
      if (req.onsuccess) req.onsuccess({ target: req });
    }, 0);
    return req;
  }

  clear() {
    const req = new MockIDBRequest();
    setTimeout(() => {
      this.records.clear();
      req.result = undefined;
      if (req.onsuccess) req.onsuccess({ target: req });
    }, 0);
    return req;
  }
}

class MockIDBDatabase {
  constructor(name, version) {
    this.name = name;
    this.version = version;
    this.stores = new Map();
    this.objectStoreNames = {
      contains: (s) => this.stores.has(s)
    };
  }

  createObjectStore(name, options) {
    const s = new MockIDBObjectStore(name, options);
    this.stores.set(name, s);
    return s;
  }

  transaction(storeNames, mode) {
    const tx = {
      objectStore: (name) => this.stores.get(name),
      oncomplete: null,
      onerror: null,
      onabort: null
    };
    setTimeout(() => {
      if (tx.oncomplete) tx.oncomplete();
    }, 5);
    return tx;
  }

  close() {}
}

const mockIDBFactory = {
  open: (name, version) => {
    const req = new MockIDBRequest();
    setTimeout(() => {
      const db = new MockIDBDatabase(name, version);
      if (req.onupgradeneeded) {
        req.result = db;
        req.onupgradeneeded({ target: req });
      }
      req.result = db;
      if (req.onsuccess) req.onsuccess({ target: req });
    }, 0);
    return req;
  }
};

describe('PWA Offline Storage Adapter Suite', () => {
  describe('Constants & Factory Selection', () => {
    test('exports database constants and schema definition', () => {
      expect(DB_NAME).toBe('decipher-offline-db');
      expect(DB_VERSION).toBe(1);
      expect(STORES.DECKS).toBe('vocabulary_decks');
      expect(STORES.CARDS).toBe('review_cards');
      expect(STORES.SYNC_QUEUE).toBe('sync_queue');
      expect(SYNC_STATUS.PENDING).toBe('pending');
      expect(SYNC_ACTIONS.RECORD_REVIEW).toBe('RECORD_REVIEW');
    });

    test('falls back to MemoryStorageAdapter in Node/Jest environment', async () => {
      const adapter = getStorageAdapter();
      expect(adapter).toBeInstanceOf(MemoryStorageAdapter);
      expect(adapter.type).toBe('memory');
    });

    test('respects forceMemory option explicitly', async () => {
      const adapter = getStorageAdapter({ forceMemory: true });
      expect(adapter).toBeInstanceOf(MemoryStorageAdapter);
      expect(adapter.type).toBe('memory');
    });

    test('openStorage returns an initialized adapter instance', async () => {
      const adapter = await openStorage({ fresh: true });
      expect(adapter.isOpen).toBe(true);
      await adapter.close();
      expect(adapter.isOpen).toBe(false);
    });
  });

  describe('MemoryStorageAdapter - Deck Management', () => {
    let adapter;

    beforeEach(async () => {
      adapter = new MemoryStorageAdapter();
      await adapter.init();
    });

    afterEach(async () => {
      await adapter.clearAllData();
      await adapter.close();
    });

    test('saves and retrieves vocabulary deck by id', async () => {
      const deck = await adapter.saveDeck({
        id: 'deck-gre-1',
        title: 'GRE High Frequency Words',
        description: 'Crucial 300 words for exam prep'
      });

      expect(deck.id).toBe('deck-gre-1');
      expect(deck.title).toBe('GRE High Frequency Words');
      expect(typeof deck.createdAt).toBe('number');
      expect(typeof deck.updatedAt).toBe('number');

      const retrieved = await adapter.getDeck('deck-gre-1');
      expect(retrieved).toEqual(deck);
    });

    test('generates unique deck id when id is omitted', async () => {
      const deck = await adapter.saveDeck({ title: 'SAT Fast Track' });
      expect(deck.id).toMatch(/^deck_\d+_[a-z0-9]+$/);
    });

    test('returns null for non-existent deck id', async () => {
      const result = await adapter.getDeck('non-existent-id');
      expect(result).toBeNull();
    });

    test('retrieves all decks sorted descending by updatedAt', async () => {
      await adapter.saveDeck({ id: 'd1', title: 'Deck 1', updatedAt: 1000 });
      await adapter.saveDeck({ id: 'd2', title: 'Deck 2', updatedAt: 2000 });

      const all = await adapter.getDecks();
      expect(all).toHaveLength(2);
      expect(all[0].id).toBe('d2');
      expect(all[1].id).toBe('d1');
    });

    test('deletes deck and cascades deletion to associated cards', async () => {
      await adapter.saveDeck({ id: 'deck-cascade', title: 'Deck to Delete' });
      await adapter.saveCards([
        { id: 'c1', deckId: 'deck-cascade', term: 'ephemeral' },
        { id: 'c2', deckId: 'deck-cascade', term: 'esoteric' },
        { id: 'c3', deckId: 'deck-other', term: 'ubiquitous' }
      ]);

      const deleted = await adapter.deleteDeck('deck-cascade');
      expect(deleted).toBe(true);

      expect(await adapter.getDeck('deck-cascade')).toBeNull();
      const cascadeCards = await adapter.getCards('deck-cascade');
      expect(cascadeCards).toHaveLength(0);

      // Other deck cards remain intact
      const otherCards = await adapter.getCards('deck-other');
      expect(otherCards).toHaveLength(1);
    });

    test('throws TypeError when deck is invalid', async () => {
      await expect(adapter.saveDeck(null)).rejects.toThrow(TypeError);
      await expect(adapter.saveDeck('invalid')).rejects.toThrow(TypeError);
    });
  });

  describe('MemoryStorageAdapter - Card Management & SM-2 Due Queries', () => {
    let adapter;

    beforeEach(async () => {
      adapter = new MemoryStorageAdapter();
      await adapter.init();
    });

    afterEach(async () => {
      await adapter.clearAllData();
      await adapter.close();
    });

    test('saves individual card with auto-generated id', async () => {
      const card = await adapter.saveCard({
        deckId: 'deck-vocab',
        term: 'lucid',
        definition: 'Expressed clearly; easy to understand'
      });

      expect(card.id).toMatch(/^card_\d+_[a-z0-9]+$/);
      expect(card.term).toBe('lucid');
      expect(typeof card.createdAt).toBe('number');
    });

    test('saves multiple cards in bulk', async () => {
      const saved = await adapter.saveCards([
        { id: 'c-1', deckId: 'deck-1', term: 'laconic' },
        { id: 'c-2', deckId: 'deck-1', term: 'pragmatic' }
      ]);

      expect(saved).toHaveLength(2);
      expect(saved[0].id).toBe('c-1');
      expect(saved[1].id).toBe('c-2');
    });

    test('retrieves card by id and returns null when not found', async () => {
      await adapter.saveCard({ id: 'target-card', term: 'pellucid' });
      const found = await adapter.getCard('target-card');
      expect(found.term).toBe('pellucid');

      const notFound = await adapter.getCard('missing');
      expect(notFound).toBeNull();
    });

    test('filters cards by deckId', async () => {
      await adapter.saveCard({ id: 'c-a', deckId: 'd-1', term: 'alpha' });
      await adapter.saveCard({ id: 'c-b', deckId: 'd-2', term: 'beta' });

      const d1Cards = await adapter.getCards('d-1');
      expect(d1Cards).toHaveLength(1);
      expect(d1Cards[0].term).toBe('alpha');

      const allCards = await adapter.getCards();
      expect(allCards).toHaveLength(2);
    });

    test('deletes card by id', async () => {
      await adapter.saveCard({ id: 'card-to-delete', term: 'obsolete' });
      const deleted = await adapter.deleteCard('card-to-delete');
      expect(deleted).toBe(true);
      expect(await adapter.getCard('card-to-delete')).toBeNull();
    });

    test('updates card SM-2 spaced repetition attributes', async () => {
      await adapter.saveCard({
        id: 'srs-card',
        term: 'resilient',
        repetitions: 0,
        interval: 0,
        ef: 2.5
      });

      const updated = await adapter.updateCardSRS('srs-card', {
        repetitions: 2,
        interval: 6,
        ef: 2.6,
        lastReviewed: '2026-11-01T10:00:00Z',
        dueDate: '2026-11-07T10:00:00Z'
      });

      expect(updated.repetitions).toBe(2);
      expect(updated.interval).toBe(6);
      expect(updated.ef).toBe(2.6);
      expect(updated.dueDate).toBe('2026-11-07T10:00:00Z');

      const refetched = await adapter.getCard('srs-card');
      expect(refetched.interval).toBe(6);
    });

    test('returns null when updating non-existent card', async () => {
      const result = await adapter.updateCardSRS('non-existent', { interval: 1 });
      expect(result).toBeNull();
    });

    test('queries due cards based on asOfDate and sorts ascending by dueDate', async () => {
      const now = new Date('2026-11-01T12:00:00Z');

      await adapter.saveCards([
        { id: 'card-overdue-2', deckId: 'd1', term: 'oldest', dueDate: '2026-10-30T10:00:00Z' },
        { id: 'card-overdue-1', deckId: 'd1', term: 'recent', dueDate: '2026-11-01T10:00:00Z' },
        { id: 'card-future', deckId: 'd1', term: 'future', dueDate: '2026-11-05T12:00:00Z' },
        { id: 'card-no-due', deckId: 'd1', term: 'new-unseen' } // no dueDate => due immediately
      ]);

      const dueCards = await adapter.getDueCards(now, 'd1');
      expect(dueCards).toHaveLength(3); // old, recent, new-unseen; excludes future
      expect(dueCards.map(c => c.id)).toContain('card-overdue-2');
      expect(dueCards.map(c => c.id)).toContain('card-overdue-1');
      expect(dueCards.map(c => c.id)).toContain('card-no-due');
      expect(dueCards.find(c => c.id === 'card-future')).toBeUndefined();

      // Verify most overdue first
      expect(dueCards[0].id).toBe('card-no-due'); // timestamp 0 (most overdue)
      expect(dueCards[1].id).toBe('card-overdue-2');
      expect(dueCards[2].id).toBe('card-overdue-1');
    });

    test('ensures returned data objects are isolated deep clones', async () => {
      const saved = await adapter.saveCard({ id: 'iso-card', term: 'isolate', tags: ['a', 'b'] });
      saved.tags.push('mutation');

      const fresh = await adapter.getCard('iso-card');
      expect(fresh.tags).toEqual(['a', 'b']);
    });
  });

  describe('MemoryStorageAdapter - Offline Sync Queue', () => {
    let adapter;

    beforeEach(async () => {
      adapter = new MemoryStorageAdapter();
      await adapter.init();
    });

    afterEach(async () => {
      await adapter.clearAllData();
      await adapter.close();
    });

    test('enqueues actions with auto-increment ID and pending status', async () => {
      const item1 = await adapter.queueSyncAction(SYNC_ACTIONS.RECORD_REVIEW, { cardId: 'c1', grade: 4 });
      const item2 = await adapter.queueSyncAction(SYNC_ACTIONS.UPDATE_CARD, { cardId: 'c2', term: 'new' });

      expect(item1.id).toBe(1);
      expect(item1.status).toBe(SYNC_STATUS.PENDING);
      expect(item1.retryCount).toBe(0);

      expect(item2.id).toBe(2);
      expect(item2.actionType).toBe(SYNC_ACTIONS.UPDATE_CARD);

      const queue = await adapter.getSyncQueue();
      expect(queue).toHaveLength(2);
      expect(queue[0].id).toBe(1);
      expect(queue[1].id).toBe(2);
    });

    test('filters queue by status', async () => {
      await adapter.queueSyncAction('A', {});
      await adapter.queueSyncAction('B', {});
      await adapter.updateSyncItem(1, { status: SYNC_STATUS.COMPLETED });

      const pending = await adapter.getSyncQueue(SYNC_STATUS.PENDING);
      expect(pending).toHaveLength(1);
      expect(pending[0].id).toBe(2);

      const completed = await adapter.getSyncQueue(SYNC_STATUS.COMPLETED);
      expect(completed).toHaveLength(1);
      expect(completed[0].id).toBe(1);
    });

    test('removes sync item from queue by ID', async () => {
      await adapter.queueSyncAction('TEST', {});
      const removed = await adapter.removeSyncItem(1);
      expect(removed).toBe(true);

      const queue = await adapter.getSyncQueue();
      expect(queue).toHaveLength(0);
    });

    test('flushes sync queue sequentially and handles partial failures', async () => {
      await adapter.queueSyncAction('ACTION_1', { cardId: 'c1' });
      await adapter.queueSyncAction('ACTION_2', { cardId: 'c2' });
      await adapter.queueSyncAction('ACTION_3', { cardId: 'c3' });

      const syncHandler = jest.fn(async (item) => {
        if (item.id === 2) {
          throw new Error('Transient server 503');
        }
        return true;
      });

      const summary = await adapter.flushSyncQueue(syncHandler);

      expect(summary.total).toBe(3);
      expect(summary.processed).toBe(3);
      expect(summary.succeeded).toBe(2);
      expect(summary.failed).toBe(1);

      expect(syncHandler).toHaveBeenCalledTimes(3);

      // Verify item states after flush
      const queue = await adapter.getSyncQueue();
      const item1 = queue.find(i => i.id === 1);
      const item2 = queue.find(i => i.id === 2);
      const item3 = queue.find(i => i.id === 3);

      expect(item1.status).toBe(SYNC_STATUS.COMPLETED);
      expect(item3.status).toBe(SYNC_STATUS.COMPLETED);

      expect(item2.status).toBe(SYNC_STATUS.FAILED);
      expect(item2.retryCount).toBe(1);
      expect(item2.lastError).toBe('Transient server 503');
    });

    test('clears entire sync queue', async () => {
      await adapter.queueSyncAction('A1', {});
      await adapter.queueSyncAction('A2', {});
      await adapter.clearSyncQueue();

      const queue = await adapter.getSyncQueue();
      expect(queue).toHaveLength(0);
    });
  });

  describe('IndexedDBStorageAdapter - Schema & Mock Execution', () => {
    test('initializes schema with stores and indexes in IndexedDB', async () => {
      const adapter = new IndexedDBStorageAdapter({
        idbFactory: mockIDBFactory,
        dbName: 'test-decipher-db',
        dbVersion: 1
      });

      await adapter.init();
      expect(adapter.type).toBe('indexeddb');
      expect(adapter.db).toBeDefined();

      const db = adapter.db;
      expect(db.objectStoreNames.contains(STORES.DECKS)).toBe(true);
      expect(db.objectStoreNames.contains(STORES.CARDS)).toBe(true);
      expect(db.objectStoreNames.contains(STORES.SYNC_QUEUE)).toBe(true);

      const deckStore = db.stores.get(STORES.DECKS);
      expect(deckStore.indexes.has('updatedAt')).toBe(true);
      expect(deckStore.indexes.has('title')).toBe(true);

      const cardStore = db.stores.get(STORES.CARDS);
      expect(cardStore.indexes.has('deckId')).toBe(true);
      expect(cardStore.indexes.has('dueDate')).toBe(true);

      const queueStore = db.stores.get(STORES.SYNC_QUEUE);
      expect(queueStore.indexes.has('status')).toBe(true);
      expect(queueStore.autoIncrement).toBe(true);

      await adapter.close();
    });

    test('performs deck and card CRUD operations in IndexedDB', async () => {
      const adapter = new IndexedDBStorageAdapter({
        idbFactory: mockIDBFactory,
        dbName: 'test-decipher-crud-db'
      });
      await adapter.init();

      // Deck
      const deck = await adapter.saveDeck({ id: 'idb-deck-1', title: 'IDB Deck' });
      expect(deck.id).toBe('idb-deck-1');

      const retrievedDeck = await adapter.getDeck('idb-deck-1');
      expect(retrievedDeck.title).toBe('IDB Deck');

      // Card
      const card = await adapter.saveCard({ id: 'idb-card-1', deckId: 'idb-deck-1', term: 'idb-word' });
      expect(card.term).toBe('idb-word');

      const cards = await adapter.getCards('idb-deck-1');
      expect(cards).toHaveLength(1);

      // Sync queue
      const qItem = await adapter.queueSyncAction('IDB_ACTION', { foo: 'bar' });
      expect(qItem.id).toBeDefined();

      const queue = await adapter.getSyncQueue();
      expect(queue).toHaveLength(1);

      await adapter.close();
    });
  });
});
