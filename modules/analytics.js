/**
 * analytics.js — Vocabulary Retention Curve & Learning Velocity Engine
 * Decipher Language Learning Platform
 *
 * Implements:
 * - Ebbinghaus forgetting curve: R(t) = exp(-t / S)
 * - Memory stability modeling based on SM-2 interval & ease factor
 * - Rolling 7-day learning velocity calculations and activity trend detection
 * - Vocabulary mastery categorization across 4 progressive tiers
 * - Aggregate deck retention health scoring
 */

export const DEFAULT_STABILITY = 5.0; // Baseline memory stability in days
export const MIN_STABILITY = 0.1;     // Lower bound to prevent division by zero
export const RETENTION_HORIZONS = [1, 3, 7, 14, 30]; // Time horizons in days

/**
 * Calculates retention probability at time elapsed t given memory stability S.
 * Formula: R(t) = exp(-t / S)
 *
 * @param {number} stability - Memory stability S in days (> 0)
 * @param {number} timeElapsedDays - Time elapsed t in days (>= 0)
 * @returns {number} Retention probability in range [0.0, 1.0] (rounded to 4 decimals)
 */
export function calculateRetention(stability, timeElapsedDays) {
  const t = Math.max(0, typeof timeElapsedDays === 'number' && !isNaN(timeElapsedDays) ? timeElapsedDays : 0);
  const s = Math.max(MIN_STABILITY, typeof stability === 'number' && !isNaN(stability) ? stability : DEFAULT_STABILITY);
  const r = Math.exp(-t / s);
  return parseFloat(Math.min(1.0, Math.max(0.0, r)).toFixed(4));
}

/**
 * Derives memory stability S (in days) from card SM-2 properties.
 *
 * @param {Object} card - Card object with interval, ef, repetitions
 * @returns {number} Stability in days
 */
export function calculateCardStability(card) {
  if (!card) return DEFAULT_STABILITY;
  const interval = typeof card.interval === 'number' && !isNaN(card.interval) ? Math.max(0, card.interval) : 0;
  const ef = typeof card.ef === 'number' && !isNaN(card.ef) ? Math.max(1.3, card.ef) : 2.5;
  const reps = typeof card.repetitions === 'number' && !isNaN(card.repetitions) ? card.repetitions : 0;

  if (reps === 0 || interval === 0) return 0.5; // Short-term acquisition phase
  return parseFloat(Math.max(1.0, interval * (ef / 2.5)).toFixed(2));
}

/**
 * Computes average predicted retention curve for a deck of cards across specified horizons.
 *
 * @param {Array<Object>} cards - Array of card objects
 * @param {Array<number>} [days=RETENTION_HORIZONS] - Days to evaluate
 * @returns {Array<{ day: number, retention: number, percentage: number }>}
 */
export function calculateRetentionCurve(cards = [], days = RETENTION_HORIZONS) {
  const cardList = Array.isArray(cards) ? cards : [];
  return days.map(d => {
    let avgR = 0;
    if (cardList.length === 0) {
      avgR = calculateRetention(DEFAULT_STABILITY, d);
    } else {
      const sum = cardList.reduce((acc, c) => acc + calculateRetention(calculateCardStability(c), d), 0);
      avgR = sum / cardList.length;
    }
    return {
      day: d,
      retention: parseFloat(avgR.toFixed(4)),
      percentage: Math.round(avgR * 100)
    };
  });
}

/**
 * Calculates rolling daily learning velocity across a designated time window.
 *
 * @param {Object|Array} reviewHistory - Date-to-count map or array of review records
 * @param {number} [windowDays=7] - Window length in days
 * @param {Date|string} [asOfDate=new Date()] - Reference date
 * @returns {Object} { velocity, totalReviews, windowDays, trend, dailyData }
 */
export function calculateLearningVelocity(reviewHistory, windowDays = 7, asOfDate = new Date()) {
  const win = Math.max(1, typeof windowDays === 'number' && !isNaN(windowDays) ? windowDays : 7);
  const refDate = asOfDate instanceof Date ? asOfDate : new Date(asOfDate);
  const dailyData = [];

  const historyMap = new Map();
  if (Array.isArray(reviewHistory)) {
    reviewHistory.forEach(item => {
      if (item && item.date) {
        const key = item.date.slice(0, 10);
        const count = typeof item.count === 'number' ? item.count : 1;
        historyMap.set(key, (historyMap.get(key) || 0) + count);
      }
    });
  } else if (reviewHistory && typeof reviewHistory === 'object') {
    Object.entries(reviewHistory).forEach(([dateStr, val]) => {
      const key = dateStr.slice(0, 10);
      const count = typeof val === 'number' ? val : (Array.isArray(val) ? val.length : 1);
      historyMap.set(key, (historyMap.get(key) || 0) + count);
    });
  }

  let totalReviews = 0;
  const half = Math.floor(win / 2);
  let firstHalfSum = 0;
  let secondHalfSum = 0;

  for (let i = win - 1; i >= 0; i--) {
    const d = new Date(refDate.getTime() - i * 86400000);
    const dateStr = d.toISOString().slice(0, 10);
    const count = historyMap.get(dateStr) || 0;
    dailyData.push({ date: dateStr, count });
    totalReviews += count;

    if (i >= half) firstHalfSum += count;
    else secondHalfSum += count;
  }

  const velocity = parseFloat((totalReviews / win).toFixed(2));
  let trend = 'steady';
  if (secondHalfSum > firstHalfSum * 1.2 && secondHalfSum >= 3) trend = 'accelerating';
  else if (firstHalfSum > secondHalfSum * 1.2 && firstHalfSum >= 3) trend = 'declining';

  return { velocity, totalReviews, windowDays: win, trend, dailyData };
}

/**
 * Categorizes deck cards into 4 mastery tiers based on scheduled interval.
 *
 * @param {Array<Object>} cards - Deck cards
 * @returns {Object} { tiers, counts, percentages }
 */
export function categorizeMastery(cards = []) {
  const cardList = Array.isArray(cards) ? cards : [];
  const tiers = { mastered: [], reviewing: [], learning: [], weak: [] };

  cardList.forEach(card => {
    if (!card) return;
    const interval = typeof card.interval === 'number' ? card.interval : 0;
    const reps = typeof card.repetitions === 'number' ? card.repetitions : 0;

    if (interval >= 21) tiers.mastered.push(card);
    else if (interval >= 6) tiers.reviewing.push(card);
    else if (interval >= 1 && reps > 0) tiers.learning.push(card);
    else tiers.weak.push(card);
  });

  const total = cardList.length;
  const counts = {
    mastered: tiers.mastered.length,
    reviewing: tiers.reviewing.length,
    learning: tiers.learning.length,
    weak: tiers.weak.length,
    total
  };

  const percentages = {
    mastered: total ? Math.round((counts.mastered / total) * 100) : 0,
    reviewing: total ? Math.round((counts.reviewing / total) * 100) : 0,
    learning: total ? Math.round((counts.learning / total) * 100) : 0,
    weak: total ? Math.round((counts.weak / total) * 100) : 0
  };

  return { tiers, counts, percentages };
}

/**
 * Calculates current aggregate deck retention health score based on elapsed review time.
 *
 * @param {Array<Object>} cards - Deck cards
 * @param {Date|string} [asOfDate=new Date()] - Reference date
 * @returns {number} Score from 0 to 100
 */
export function calculateDeckRetentionScore(cards = [], asOfDate = new Date()) {
  const cardList = Array.isArray(cards) ? cards : [];
  if (cardList.length === 0) return 100;

  const now = asOfDate instanceof Date ? asOfDate : new Date(asOfDate);
  let totalRetention = 0;

  cardList.forEach(card => {
    const stability = calculateCardStability(card);
    const lastRev = card.lastReviewed ? new Date(card.lastReviewed) : now;
    const elapsedDays = Math.max(0, (now.getTime() - lastRev.getTime()) / 86400000);
    totalRetention += calculateRetention(stability, elapsedDays);
  });

  return Math.round((totalRetention / cardList.length) * 100);
}

export function formatRetentionRate(rate) {
  return `${Math.round(rate * 100)}%`;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DEFAULT_STABILITY,
    MIN_STABILITY,
    RETENTION_HORIZONS,
    calculateRetention,
    calculateCardStability,
    calculateRetentionCurve,
    calculateLearningVelocity,
    categorizeMastery,
    calculateDeckRetentionScore,
    formatRetentionRate
  };
}
