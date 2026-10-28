/**
 * srs.js — SuperMemo SM-2 Spaced Repetition Engine
 * Decipher Language Learning Platform
 *
 * Implements the core SuperMemo SM-2 spaced repetition algorithm for vocabulary retention:
 * - Grade 0 to 5 evaluation scale (0-2: failure / repetition reset, 3-5: recall success)
 * - Dynamic Ease Factor (EF) adjustment: EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
 * - Ease Factor floor at 1.30 to prevent scheduling collapse
 * - Interval progression: Rep 0 -> 1 day, Rep 1 -> 6 days, Rep >= 2 -> round(interval * EF)
 * - Due date timestamp calculation based on interval in days
 */

export const DEFAULT_EF = 2.5;
export const MIN_EF = 1.3;
export const MAX_INTERVAL = 36500; // 100 years upper bound cap to prevent JS Date overflow
export const MS_PER_DAY = 86400000; // 24 * 60 * 60 * 1000

/**
 * Calculates the next SM-2 interval, repetitions, ease factor, and due date.
 *
 * @param {Object} card - Vocabulary card object
 * @param {number} [card.repetitions=0] - Number of consecutive successful recall reviews
 * @param {number} [card.interval=0] - Current interval in days
 * @param {number} [card.ef=2.5] - Current ease factor (minimum 1.3)
 * @param {string|Date} [card.lastReviewed] - Timestamp of previous review
 * @param {string|Date} [card.dueDate] - Scheduled due date
 * @param {number} grade - User recall rating (0 to 5)
 * @param {Date|string|number} [now=new Date()] - Reference timestamp for deterministic calculation
 * @returns {Object} Updated card object with new repetitions, interval, ef, lastReviewed, dueDate
 */
export function calculateSM2(card, grade, now = new Date()) {
  if (typeof grade !== 'number' || !Number.isInteger(grade) || grade < 0 || grade > 5) {
    throw new RangeError(`Grade must be an integer between 0 and 5, received: ${grade}`);
  }
  const numGrade = grade;

  const c = card || {};
  let rep = typeof c.repetitions === 'number' && !isNaN(c.repetitions) ? Math.max(0, Math.floor(c.repetitions)) : 0;
  let interval = typeof c.interval === 'number' && !isNaN(c.interval) ? Math.max(0, Math.floor(c.interval)) : 0;
  let ef = typeof c.ef === 'number' && !isNaN(c.ef) ? c.ef : DEFAULT_EF;

  if (numGrade >= 3) {
    if (rep === 0) {
      interval = 1;
    } else if (rep === 1) {
      interval = 6;
    } else {
      interval = Math.min(MAX_INTERVAL, Math.round(interval * ef));
    }
    rep++;
  } else {
    rep = 0;
    interval = 1;
  }
  interval = Math.min(interval, MAX_INTERVAL);

  // Update ease factor: EF' = EF + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02))
  ef = ef + (0.1 - (5 - numGrade) * (0.08 + (5 - numGrade) * 0.02));
  if (ef < MIN_EF) ef = MIN_EF;
  ef = parseFloat(ef.toFixed(2));

  const nowDate = now instanceof Date ? now : new Date(now);
  const lastReviewed = nowDate.toISOString();
  const dueDate = new Date(nowDate.getTime() + (interval * MS_PER_DAY)).toISOString();

  return {
    ...c,
    repetitions: rep,
    interval: interval,
    ef: ef,
    lastReviewed: lastReviewed,
    dueDate: dueDate
  };
}

/**
 * Calculates a future due date string given an interval in days.
 * @param {number} intervalDays - Interval in days
 * @param {Date|string|number} [fromDate=new Date()] - Starting date
 * @returns {string} ISO date string
 */
export function calculateDueDate(intervalDays, fromDate = new Date()) {
  const base = fromDate instanceof Date ? fromDate : new Date(fromDate);
  const safeDays = Math.min(MAX_INTERVAL, Math.max(0, typeof intervalDays === 'number' && !isNaN(intervalDays) ? intervalDays : 0));
  return new Date(base.getTime() + (safeDays * MS_PER_DAY)).toISOString();
}

/**
 * In-memory fallback storage adapter for non-browser environments.
 */
export class MemoryStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

/**
 * Local Review Queue Manager for spaced repetition flashcard decks.
 * Handles localStorage persistence, due date scheduling, overdue sorting, and deck statistics.
 */
export class SRSQueueManager {
  /**
   * @param {Object} [options={}]
   * @param {string} [options.storageKey='decipher_srs_deck'] - Storage key in localStorage
   * @param {Storage|MemoryStorage} [options.storage] - Custom storage provider
   */
  constructor(options = {}) {
    this.storageKey = options.storageKey || 'decipher_srs_deck';
    this.storage = options.storage || (typeof localStorage !== 'undefined' ? localStorage : new MemoryStorage());
    this.deck = this.loadDeck();
  }

  /**
   * Loads the deck from persistence.
   * @returns {Array<Object>}
   */
  loadDeck() {
    try {
      const raw = this.storage.getItem(this.storageKey);
      if (!raw) {
        this.deck = [];
        return [];
      }
      const parsed = JSON.parse(raw);
      this.deck = Array.isArray(parsed) ? parsed : [];
      return this.deck;
    } catch {
      this.deck = [];
      return [];
    }
  }

  /**
   * Persists deck to storage.
   * @param {Array<Object>} [deck=this.deck]
   * @returns {Array<Object>}
   */
  saveDeck(deck = this.deck) {
    if (Array.isArray(deck)) {
      this.deck = deck;
    }
    try {
      this.storage.setItem(this.storageKey, JSON.stringify(this.deck));
    } catch (e) {
      console.warn('[SRSQueueManager] Failed to persist deck:', e);
    }
    return this.deck;
  }

  /**
   * Adds new cards to the queue or updates existing ones without losing SRS progress.
   * @param {Array<Object>|Object} cards
   * @returns {Array<Object>} Updated deck
   */
  addCards(cards) {
    const list = Array.isArray(cards) ? cards : [cards];
    const nowIso = new Date().toISOString();

    for (const card of list) {
      if (!card) continue;
      const id = String(card.id || card.term || card.word || '').trim();
      if (!id) continue;

      const existingIndex = this.deck.findIndex(c => String(c.id || c.term || c.word || '').trim() === id);
      if (existingIndex >= 0) {
        const existing = this.deck[existingIndex];
        this.deck[existingIndex] = {
          ...existing,
          ...card,
          id: id,
          repetitions: typeof card.repetitions === 'number' ? card.repetitions : existing.repetitions,
          interval: typeof card.interval === 'number' ? card.interval : existing.interval,
          ef: typeof card.ef === 'number' ? card.ef : existing.ef,
          lastReviewed: card.lastReviewed !== undefined ? card.lastReviewed : existing.lastReviewed,
          dueDate: card.dueDate !== undefined ? card.dueDate : existing.dueDate
        };
      } else {
        this.deck.push({
          id: id,
          term: card.term || card.word || id,
          word: card.word || card.term || id,
          definition: card.definition || card.meaning || '',
          phonetic: card.phonetic || '',
          example: card.example || '',
          translation: card.translation || '',
          repetitions: typeof card.repetitions === 'number' ? card.repetitions : 0,
          interval: typeof card.interval === 'number' ? card.interval : 0,
          ef: typeof card.ef === 'number' ? card.ef : DEFAULT_EF,
          lastReviewed: card.lastReviewed || null,
          dueDate: card.dueDate || nowIso,
          ...card
        });
      }
    }
    this.saveDeck();
    return this.deck;
  }

  /**
   * Retrieves a single card by its ID, term, or word.
   * @param {string} cardId
   * @returns {Object|null}
   */
  getCard(cardId) {
    const target = String(cardId || '').trim();
    return this.deck.find(c => String(c.id || c.term || c.word || '').trim() === target) || null;
  }

  /**
   * Returns cards due for review on or before the given timestamp.
   * @param {Date|string|number} [asOfDate=new Date()]
   * @returns {Array<Object>}
   */
  getDueCards(asOfDate = new Date()) {
    const targetMs = (asOfDate instanceof Date ? asOfDate : new Date(asOfDate)).getTime();
    return this.deck.filter(card => {
      if (!card.dueDate) return true;
      const dueMs = new Date(card.dueDate).getTime();
      return dueMs <= targetMs;
    });
  }

  /**
   * Returns overdue cards sorted ascending by dueDate (oldest overdue first).
   * @param {Date|string|number} [asOfDate=new Date()]
   * @returns {Array<Object>}
   */
  getOverdueCards(asOfDate = new Date()) {
    const targetMs = (asOfDate instanceof Date ? asOfDate : new Date(asOfDate)).getTime();
    return this.deck
      .filter(card => {
        if (!card.dueDate) return false;
        return new Date(card.dueDate).getTime() < targetMs;
      })
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }

  /**
   * Computes SRS queue summary metrics.
   * @param {Date|string|number} [asOfDate=new Date()]
   * @returns {{ total: number, due: number, learning: number, mature: number }}
   */
  getReviewStats(asOfDate = new Date()) {
    const targetMs = (asOfDate instanceof Date ? asOfDate : new Date(asOfDate)).getTime();
    let dueCount = 0;
    let learningCount = 0;
    let matureCount = 0;

    for (const card of this.deck) {
      const isDue = !card.dueDate || new Date(card.dueDate).getTime() <= targetMs;
      if (isDue) dueCount++;

      const interval = typeof card.interval === 'number' ? card.interval : 0;
      if (interval >= 21) {
        matureCount++;
      } else {
        learningCount++;
      }
    }

    return {
      total: this.deck.length,
      due: dueCount,
      learning: learningCount,
      mature: matureCount
    };
  }

  /**
   * Records a user recall rating, recalculates SM-2, persists, and returns updated card.
   * @param {string} cardId
   * @param {number} grade
   * @param {Date|string|number} [reviewDate=new Date()]
   * @returns {Object}
   */
  recordReview(cardId, grade, reviewDate = new Date()) {
    const target = String(cardId || '').trim();
    const index = this.deck.findIndex(c => String(c.id || c.term || c.word || '').trim() === target);

    let card;
    if (index >= 0) {
      card = this.deck[index];
    } else {
      card = { id: target, term: target, word: target, repetitions: 0, interval: 0, ef: DEFAULT_EF };
      this.deck.push(card);
    }

    const updated = calculateSM2(card, grade, reviewDate);
    const targetIndex = index >= 0 ? index : this.deck.length - 1;
    this.deck[targetIndex] = updated;
    this.saveDeck();
    return updated;
  }

  /**
   * Empties the queue and clears storage.
   */
  clearDeck() {
    this.deck = [];
    this.saveDeck();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DEFAULT_EF,
    MIN_EF,
    MAX_INTERVAL,
    MS_PER_DAY,
    calculateSM2,
    calculateDueDate,
    MemoryStorage,
    SRSQueueManager
  };
}
