/**
 * tests/srs.test.js
 * Comprehensive unit test suite for SuperMemo SM-2 spaced repetition engine & review queue
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

let calculateSM2, SRSQueueManager, MemoryStorage, DEFAULT_EF, MIN_EF, MAX_INTERVAL, MS_PER_DAY, calculateDueDate;

try {
  const mod = require('../modules/srs.js');
  calculateSM2 = mod.calculateSM2;
  SRSQueueManager = mod.SRSQueueManager;
  MemoryStorage = mod.MemoryStorage;
  DEFAULT_EF = mod.DEFAULT_EF;
  MIN_EF = mod.MIN_EF;
  MAX_INTERVAL = mod.MAX_INTERVAL;
  MS_PER_DAY = mod.MS_PER_DAY;
  calculateDueDate = mod.calculateDueDate;
} catch {
  const code = fs.readFileSync(path.resolve(__dirname, '../modules/srs.js'), 'utf8');
  const clean = code.replace(/^export\s+/gm, '').replace(/export\s*\{[^}]*\};?/g, '');
  const wrapped = `(function() {\n${clean}\nreturn { calculateSM2, SRSQueueManager, MemoryStorage, DEFAULT_EF, MIN_EF, MAX_INTERVAL, MS_PER_DAY, calculateDueDate };\n})()`;
  const sandbox = { console, Date, Math, Array, Object, Number, RangeError, TypeError, Error, JSON, Map, String, parseInt, parseFloat, isNaN, setTimeout, clearTimeout };
  vm.createContext(sandbox);
  const mod = vm.runInContext(wrapped, sandbox);
  calculateSM2 = mod.calculateSM2;
  SRSQueueManager = mod.SRSQueueManager;
  MemoryStorage = mod.MemoryStorage;
  DEFAULT_EF = mod.DEFAULT_EF;
  MIN_EF = mod.MIN_EF;
  MAX_INTERVAL = mod.MAX_INTERVAL;
  MS_PER_DAY = mod.MS_PER_DAY;
  calculateDueDate = mod.calculateDueDate;
}

describe('SuperMemo SM-2 Interval Calculation Engine (calculateSM2)', () => {
  const fixedDate = new Date('2026-10-28T10:00:00.000Z');

  describe('Success Transitions (Grades 3, 4, 5)', () => {
    test('Repetition 0 -> 1: sets interval to 1 day on first successful recall', () => {
      const card = { repetitions: 0, interval: 0, ef: 2.5 };
      const next = calculateSM2(card, 4, fixedDate);

      expect(next.repetitions).toBe(1);
      expect(next.interval).toBe(1);
      expect(next.ef).toBe(2.5);
      expect(next.lastReviewed).toBe('2026-10-28T10:00:00.000Z');
      expect(next.dueDate).toBe('2026-10-29T10:00:00.000Z');
    });

    test('Repetition 1 -> 2: sets interval to 6 days on second successful recall', () => {
      const card = { repetitions: 1, interval: 1, ef: 2.5 };
      const next = calculateSM2(card, 4, fixedDate);

      expect(next.repetitions).toBe(2);
      expect(next.interval).toBe(6);
      expect(next.ef).toBe(2.5);
      expect(next.dueDate).toBe('2026-11-03T10:00:00.000Z');
    });

    test('Repetition 2 -> 3: sets interval to round(6 * EF) = 15 days on third recall with EF 2.5', () => {
      const card = { repetitions: 2, interval: 6, ef: 2.5 };
      const next = calculateSM2(card, 4, fixedDate);

      expect(next.repetitions).toBe(3);
      expect(next.interval).toBe(15);
      expect(next.dueDate).toBe('2026-11-12T10:00:00.000Z');
    });

    test('Repetition 3 -> 4: sets interval to round(15 * 2.5) = 38 days on fourth recall', () => {
      const card = { repetitions: 3, interval: 15, ef: 2.5 };
      const next = calculateSM2(card, 4, fixedDate);

      expect(next.repetitions).toBe(4);
      expect(next.interval).toBe(38);
    });

    test('Repetition 4 -> 5: sets interval to round(38 * 2.5) = 95 days on fifth recall', () => {
      const card = { repetitions: 4, interval: 38, ef: 2.5 };
      const next = calculateSM2(card, 4, fixedDate);

      expect(next.repetitions).toBe(5);
      expect(next.interval).toBe(95);
    });
  });

  describe('Ease Factor Adjustments by Grade', () => {
    test('Grade 5 (Perfect): increases EF by +0.10 (2.50 -> 2.60)', () => {
      const card = { repetitions: 0, interval: 0, ef: 2.5 };
      const next = calculateSM2(card, 5, fixedDate);
      expect(next.ef).toBe(2.6);
    });

    test('Grade 4 (Good): maintains EF unchanged (2.50 -> 2.50)', () => {
      const card = { repetitions: 0, interval: 0, ef: 2.5 };
      const next = calculateSM2(card, 4, fixedDate);
      expect(next.ef).toBe(2.5);
    });

    test('Grade 3 (Hard): decreases EF by -0.14 (2.50 -> 2.36)', () => {
      const card = { repetitions: 0, interval: 0, ef: 2.5 };
      const next = calculateSM2(card, 3, fixedDate);
      expect(next.ef).toBe(2.36);
    });

    test('Grade 2 (Incorrect Easy): decreases EF by -0.32 (2.50 -> 2.18)', () => {
      const card = { repetitions: 2, interval: 6, ef: 2.5 };
      const next = calculateSM2(card, 2, fixedDate);
      expect(next.ef).toBe(2.18);
    });

    test('Grade 1 (Incorrect / Again): decreases EF by -0.54 (2.50 -> 1.96)', () => {
      const card = { repetitions: 3, interval: 15, ef: 2.5 };
      const next = calculateSM2(card, 1, fixedDate);
      expect(next.ef).toBe(1.96);
    });

    test('Grade 0 (Complete Blackout): decreases EF by -0.80 (2.50 -> 1.70)', () => {
      const card = { repetitions: 3, interval: 15, ef: 2.5 };
      const next = calculateSM2(card, 0, fixedDate);
      expect(next.ef).toBe(1.7);
    });
  });

  describe('Failure Resets and Floor Clamping', () => {
    test('resets repetitions to 0 and interval to 1 on failure (Grade < 3)', () => {
      const matureCard = { repetitions: 7, interval: 180, ef: 2.6 };
      const next = calculateSM2(matureCard, 1, fixedDate);

      expect(next.repetitions).toBe(0);
      expect(next.interval).toBe(1);
      expect(next.dueDate).toBe('2026-10-29T10:00:00.000Z');
      expect(next.ef).toBe(2.06);
    });

    test('clamps Ease Factor to minimum 1.30 on repeated failures', () => {
      let card = { repetitions: 2, interval: 6, ef: 1.5 };
      card = calculateSM2(card, 0, fixedDate);

      expect(card.ef).toBe(1.3);
      expect(card.repetitions).toBe(0);
      expect(card.interval).toBe(1);

      card = calculateSM2(card, 0, fixedDate);
      expect(card.ef).toBe(1.3);
    });
  });

  describe('Edge Cases & Immutability', () => {
    test('handles default initial card state when properties are omitted', () => {
      const card = { id: 'term-1', word: 'ephemeral' };
      const next = calculateSM2(card, 4, fixedDate);

      expect(next.repetitions).toBe(1);
      expect(next.interval).toBe(1);
      expect(next.ef).toBe(2.5);
      expect(next.id).toBe('term-1');
      expect(next.word).toBe('ephemeral');
    });

    test('does not mutate input card object (pure function)', () => {
      const original = { repetitions: 0, interval: 0, ef: 2.5 };
      const frozen = Object.freeze({ ...original });
      const next = calculateSM2(frozen, 5, fixedDate);

      expect(frozen.repetitions).toBe(0);
      expect(next.repetitions).toBe(1);
    });

    test('throws RangeError for invalid grade values (< 0, > 5, non-integer)', () => {
      const card = { repetitions: 0, interval: 0, ef: 2.5 };
      expect(() => calculateSM2(card, -1)).toThrow(RangeError);
      expect(() => calculateSM2(card, 6)).toThrow(RangeError);
      expect(() => calculateSM2(card, 3.5)).toThrow(RangeError);
      expect(() => calculateSM2(card, 'invalid')).toThrow(RangeError);
    });

    test('calculateDueDate correctly projects ISO date for intervals', () => {
      const due = calculateDueDate(5, fixedDate);
      expect(due).toBe('2026-11-02T10:00:00.000Z');
    });
  });

  describe('MAX_INTERVAL Clamping & Long-Term Stability', () => {
    test('exports MAX_INTERVAL equal to 36500 (100 years)', () => {
      expect(MAX_INTERVAL).toBe(36500);
    });

    test('caps interval at MAX_INTERVAL (36500 days) during progression', () => {
      const card = { repetitions: 10, interval: 30000, ef: 2.5 };
      const next = calculateSM2(card, 5, fixedDate);

      expect(next.interval).toBe(36500);
      expect(next.repetitions).toBe(11);
    });

    test('completes 100 consecutive Grade 5 reviews without throwing RangeError or date overflow', () => {
      let card = { repetitions: 0, interval: 0, ef: 2.5 };
      for (let i = 0; i < 100; i++) {
        card = calculateSM2(card, 5, fixedDate);
      }

      expect(card.repetitions).toBe(100);
      expect(card.interval).toBe(36500);
      expect(typeof card.dueDate).toBe('string');
      expect(new Date(card.dueDate).getTime()).not.toBeNaN();
    });

    test('calculateDueDate clamps excessive intervals to MAX_INTERVAL', () => {
      const due = calculateDueDate(100000, fixedDate);
      const expected = new Date(fixedDate.getTime() + 36500 * MS_PER_DAY).toISOString();
      expect(due).toBe(expected);
    });
  });

  describe('Strict Type Safety and Non-Numeric Rejection', () => {
    test.each([
      [null, 'null'],
      [false, 'false'],
      [true, 'true'],
      ['', 'empty string'],
      ['   ', 'whitespace string'],
      ['5', 'numeric string "5"'],
      [[], 'empty array'],
      [[3], 'array with number [3]'],
      [{}, 'plain object'],
      [undefined, 'undefined'],
      [NaN, 'NaN'],
      [Infinity, 'Infinity'],
      [-Infinity, '-Infinity']
    ])('rejects non-numeric primitive or non-finite type: %s (%s) with RangeError', (val) => {
      const card = { repetitions: 0, interval: 0, ef: 2.5 };
      expect(() => calculateSM2(card, val)).toThrow(RangeError);
    });

    test.each([-1, -100, 2.5, 3.14, 4.99, 5.001, 6, 10])(
      'rejects non-integer and out-of-range grade: %p with RangeError',
      (invalidGrade) => {
        const card = { repetitions: 0, interval: 0, ef: 2.5 };
        expect(() => calculateSM2(card, invalidGrade)).toThrow(RangeError);
      }
    );

    test('accepts all valid integer grades from 0 to 5 without throwing', () => {
      const card = { repetitions: 0, interval: 0, ef: 2.5 };
      for (let g = 0; g <= 5; g++) {
        expect(() => calculateSM2(card, g, fixedDate)).not.toThrow();
      }
    });
  });
});

describe('SRSQueueManager Local Review Queue', () => {
  let storage;
  let queue;
  const t0 = new Date('2026-10-28T10:00:00.000Z');

  beforeEach(() => {
    storage = new MemoryStorage();
    queue = new SRSQueueManager({ storage });
  });

  test('initializes with empty deck in clean storage', () => {
    expect(queue.deck).toEqual([]);
    expect(queue.loadDeck()).toEqual([]);
  });

  test('addCards enqueues vocabulary cards and initializes default SRS attributes', () => {
    queue.addCards([
      { id: 'w1', word: 'catalyst', definition: 'accelerator' },
      { id: 'w2', word: 'resilient', definition: 'tough' }
    ]);

    expect(queue.deck).toHaveLength(2);
    const card = queue.getCard('w1');
    expect(card.word).toBe('catalyst');
    expect(card.repetitions).toBe(0);
    expect(card.interval).toBe(0);
    expect(card.ef).toBe(2.5);
    expect(card.dueDate).toBeDefined();
  });

  test('addCards does not duplicate cards with same ID and preserves existing progress', () => {
    queue.addCards({ id: 'w1', word: 'catalyst', repetitions: 3, interval: 15 });
    queue.addCards({ id: 'w1', word: 'catalyst', definition: 'new definition' });

    expect(queue.deck).toHaveLength(1);
    const card = queue.getCard('w1');
    expect(card.repetitions).toBe(3);
    expect(card.interval).toBe(15);
    expect(card.definition).toBe('new definition');
  });

  test('getDueCards returns cards whose dueDate is on or before asOfDate', () => {
    queue.addCards([
      { id: 'c1', dueDate: '2026-10-28T08:00:00.000Z' },
      { id: 'c2', dueDate: '2026-10-28T10:00:00.000Z' },
      { id: 'c3', dueDate: '2026-10-28T12:00:00.000Z' }
    ]);

    const due = queue.getDueCards(t0);
    expect(due.map(c => c.id)).toEqual(['c1', 'c2']);
  });

  test('getOverdueCards filters strictly overdue cards and sorts ascending by dueDate', () => {
    queue.addCards([
      { id: 'c3', dueDate: '2026-10-27T12:00:00.000Z' },
      { id: 'c1', dueDate: '2026-10-26T10:00:00.000Z' },
      { id: 'c2', dueDate: '2026-10-29T10:00:00.000Z' }
    ]);

    const overdue = queue.getOverdueCards(t0);
    expect(overdue).toHaveLength(2);
    expect(overdue[0].id).toBe('c1');
    expect(overdue[1].id).toBe('c3');
  });

  test('getReviewStats accurately summarizes total, due, learning, and mature counts', () => {
    queue.addCards([
      { id: 'c1', dueDate: '2026-10-28T09:00:00.000Z', interval: 1 },
      { id: 'c2', dueDate: '2026-10-28T08:00:00.000Z', interval: 6 },
      { id: 'c3', dueDate: '2026-10-27T08:00:00.000Z', interval: 30 },
      { id: 'c4', dueDate: '2026-11-15T08:00:00.000Z', interval: 45 }
    ]);

    const stats = queue.getReviewStats(t0);
    expect(stats.total).toBe(4);
    expect(stats.due).toBe(3);
    expect(stats.learning).toBe(2);
    expect(stats.mature).toBe(2);
  });

  test('recordReview updates card state via SM-2 and persists to storage', () => {
    queue.addCards({ id: 'c1', word: 'ephemeral', repetitions: 0, interval: 0, ef: 2.5 });

    const updated = queue.recordReview('c1', 4, t0);
    expect(updated.repetitions).toBe(1);
    expect(updated.interval).toBe(1);
    expect(updated.dueDate).toBe('2026-10-29T10:00:00.000Z');

    const reloadedQueue = new SRSQueueManager({ storage });
    const persistedCard = reloadedQueue.getCard('c1');
    expect(persistedCard.repetitions).toBe(1);
    expect(persistedCard.dueDate).toBe('2026-10-29T10:00:00.000Z');
  });

  test('clearDeck wipes all cards from memory and storage', () => {
    queue.addCards({ id: 'c1', word: 'ephemeral' });
    expect(queue.deck).toHaveLength(1);

    queue.clearDeck();
    expect(queue.deck).toHaveLength(0);

    const fresh = new SRSQueueManager({ storage });
    expect(fresh.deck).toHaveLength(0);
  });
});
