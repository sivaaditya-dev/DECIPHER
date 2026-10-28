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
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DEFAULT_EF,
    MIN_EF,
    MAX_INTERVAL,
    MS_PER_DAY,
    calculateSM2,
    calculateDueDate
  };
}
