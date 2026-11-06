/**
 * tests/offline-sync.test.js
 * End-to-end integration tests covering offline-to-online sync flow:
 * - Offline study review session enqueuing in local storage (MemoryStorageAdapter)
 * - Batch serialization and flushSyncQueue execution
 * - Server /api/sync/batch processing, validation, and SM-2 progress acknowledgement
 * - Client sync queue reconciliation and completed item cleanup
 * - Idempotency deduplication on repeated batch submissions
 * - Network outage error handling, retry backoff, and partial failure handling
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { processBatchSync, validateRequestBody, SCHEMAS } = require('../server.js');

// Dynamically load ES modules storage-idb.js
function loadESModule(filePath, exportNames) {
  const code = fs.readFileSync(path.resolve(__dirname, filePath), 'utf8');
  const clean = code.replace(/^export\s+/gm, '').replace(/export\s*\{[^}]*\};?/g, '');
  const wrapped = `(function() {\n${clean}\nreturn { ${exportNames.join(', ')} };\n})()`;
  const sandbox = {
    console, Date, Math, Array, Object, Number, RangeError, TypeError, Error, JSON, Map, Set, String,
    parseInt, parseFloat, isNaN, setTimeout, clearTimeout
  };
  vm.createContext(sandbox);
  return vm.runInContext(wrapped, sandbox);
}

const storageMod = loadESModule('../modules/storage-idb.js', [
  'MemoryStorageAdapter',
  'SYNC_STATUS',
  'SYNC_ACTIONS'
]);
const { MemoryStorageAdapter, SYNC_STATUS, SYNC_ACTIONS } = storageMod;

describe('Offline-to-Online Sync Flow Integration Suite', () => {
  let storage;

  beforeEach(async () => {
    storage = new MemoryStorageAdapter();
    await storage.init();
  });

  afterEach(async () => {
    await storage.close();
  });

  test('Full E2E Cycle: study offline, queue reviews, sync to server, and clear queue', async () => {
    // 1. User creates deck and cards offline
    const deck = await storage.saveDeck({ id: 'deck-sync-1', title: 'GRE Vocab' });
    const card1 = await storage.saveCard({ id: 'card-1', deckId: deck.id, term: 'ephemeral', repetitions: 0, interval: 0 });
    const card2 = await storage.saveCard({ id: 'card-2', deckId: deck.id, term: 'ubiquitous', repetitions: 1, interval: 1 });

    // 2. User completes review sessions while disconnected
    const q1 = await storage.queueSyncAction(SYNC_ACTIONS.RECORD_REVIEW, {
      cardId: card1.id,
      grade: 4,
      repetitions: 1,
      interval: 1,
      easeFactor: 2.5,
      reviewTimestamp: Date.now() - 5000
    });
    const q2 = await storage.queueSyncAction(SYNC_ACTIONS.RECORD_REVIEW, {
      cardId: card2.id,
      grade: 5,
      repetitions: 2,
      interval: 6,
      easeFactor: 2.6,
      reviewTimestamp: Date.now() - 2000
    });

    const pending = await storage.getSyncQueue(SYNC_STATUS.PENDING);
    expect(pending).toHaveLength(2);
    expect(pending[0].id).toBe(q1.id);
    expect(pending[1].id).toBe(q2.id);

    // 3. Client comes online and creates batch payload
    const batchPayload = {
      batchId: 'batch_test_' + Date.now(),
      clientTimestamp: Date.now(),
      items: pending
    };

    // 4. Validate schema
    const valReq = { body: batchPayload };
    let validated = false;
    validateRequestBody(SCHEMAS.batchSync)(valReq, { status: () => ({ json: () => {} }) }, () => {
      validated = true;
    });
    expect(validated).toBe(true);

    // 5. Server processes batch payload
    const serverResult = processBatchSync(batchPayload);
    expect(serverResult.success).toBe(true);
    expect(serverResult.syncedIds).toEqual([q1.id, q2.id]);
    expect(serverResult.failedIds).toHaveLength(0);
    expect(serverResult.processed).toBe(2);

    // 6. Client acknowledges synced IDs and drains queue
    for (const syncedId of serverResult.syncedIds) {
      await storage.removeSyncItem(syncedId);
    }

    const remainingQueue = await storage.getSyncQueue();
    expect(remainingQueue).toHaveLength(0);
  });

  test('Idempotency: duplicate batch submission returns cached results without duplicate processing', () => {
    const batchPayload = {
      batchId: 'batch_idempotent_123',
      clientTimestamp: Date.now(),
      items: [
        { id: 101, actionType: 'RECORD_REVIEW', payload: { cardId: 'c101', grade: 4 } }
      ]
    };

    const firstRun = processBatchSync(batchPayload);
    expect(firstRun.success).toBe(true);
    expect(firstRun.syncedIds).toContain(101);

    const secondRun = processBatchSync(batchPayload);
    expect(secondRun.success).toBe(true);
    expect(secondRun.cached).toBe(true);
    expect(secondRun.syncedIds).toEqual(firstRun.syncedIds);
  });

  test('Partial failure: handles unsupported action types gracefully without dropping valid items', () => {
    const batchPayload = {
      batchId: 'batch_mixed_' + Date.now(),
      clientTimestamp: Date.now(),
      items: [
        { id: 201, actionType: 'RECORD_REVIEW', payload: { cardId: 'c201', grade: 5 } },
        { id: 202, actionType: 'INVALID_UNKNOWN_ACTION', payload: {} },
        { id: 203, actionType: 'UPDATE_CARD', payload: { cardId: 'c203' } }
      ]
    };

    const result = processBatchSync(batchPayload);
    expect(result.success).toBe(true);
    expect(result.syncedIds).toEqual([201, 203]);
    expect(result.failedIds).toEqual([202]);
    expect(result.results.find(r => r.id === 202).status).toBe('rejected');
  });

  test('Error resilience: transient server failure marks items as failed and increments retryCount', async () => {
    const item = await storage.queueSyncAction(SYNC_ACTIONS.RECORD_REVIEW, { cardId: 'c1' });

    // Simulate transient server error
    const mockSyncHandler = jest.fn().mockRejectedValue(new Error('503 Service Unavailable'));

    const summary = await storage.flushSyncQueue(mockSyncHandler);
    expect(summary.total).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.succeeded).toBe(0);

    const queue = await storage.getSyncQueue();
    expect(queue[0].status).toBe(SYNC_STATUS.FAILED);
    expect(queue[0].retryCount).toBe(1);
    expect(queue[0].lastError).toContain('503 Service Unavailable');
  });
});
