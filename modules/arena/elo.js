/**
 * elo.js — Chess-Style Elo Rating Engine for Lexicon Coliseum PvP
 * Decipher Language Learning Platform
 *
 * Implements the FIDE Elo rating system adapted for vocabulary duels:
 *   - Variable K-factor based on rating bracket
 *   - Expected score calculation via logistic curve
 *   - Six-tier division system: Bronze → Grandmaster
 *   - Win/Loss/Draw outcome support
 *
 * Exports:
 *   calculateElo(ratingA, ratingB, outcome)  → {newA, newB, deltaA, deltaB}
 *   getKFactor(rating)                        → 32 | 16
 *   getTier(rating)                           → tier string
 *   getTierInfo(rating)                       → {name, icon, min, max, next}
 *   getExpectedScore(ratingA, ratingB)        → number 0.0–1.0
 *   DEFAULT_ELO                               → 1200 (starting rating)
 */

export const DEFAULT_ELO = 1200;

// ── Tier Definitions ─────────────────────────────────────────────────────────

/**
 * Ordered tier definitions from lowest to highest.
 * Each tier spans a rating range and carries a display icon.
 */
export const TIERS = [
  { name: 'Bronze',       icon: '🥉', min: 0,    max: 1199 },
  { name: 'Silver',       icon: '🥈', min: 1200, max: 1399 },
  { name: 'Gold',         icon: '🥇', min: 1400, max: 1599 },
  { name: 'Platinum',     icon: '💎', min: 1600, max: 1799 },
  { name: 'Diamond',      icon: '💠', min: 1800, max: 1999 },
  { name: 'Grandmaster',  icon: '👑', min: 2000, max: Infinity },
];

// ── K-Factor ─────────────────────────────────────────────────────────────────

/**
 * Returns the K-factor (maximum rating change per game) for a given rating.
 * Higher-rated players converge more slowly for stability.
 *
 * @param {number} rating - Current Elo rating
 * @returns {number} 32 for ratings below 2100, 16 for ≥ 2100
 */
export function getKFactor(rating) {
  if (typeof rating !== 'number' || isNaN(rating)) return 32;
  return rating >= 2100 ? 16 : 32;
}

// ── Expected Score ────────────────────────────────────────────────────────────

/**
 * Calculates the expected score for player A against player B
 * using the standard Elo logistic function.
 *
 * E_A = 1 / (1 + 10^((R_B - R_A) / 400))
 *
 * @param {number} ratingA - Player A's current Elo
 * @param {number} ratingB - Player B's current Elo
 * @returns {number} Expected score for A, in range [0.0, 1.0]
 */
export function getExpectedScore(ratingA, ratingB) {
  if (typeof ratingA !== 'number' || typeof ratingB !== 'number') {
    throw new TypeError('Ratings must be numbers');
  }
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

// ── Elo Calculation ───────────────────────────────────────────────────────────

/**
 * Calculates new Elo ratings for both players after a match.
 *
 * Uses the formula:  R' = R + K × (S - E)
 *   where S is the actual score (1 = win, 0 = loss, 0.5 = draw)
 *   and   E is the expected score from getExpectedScore().
 *
 * @param {number} ratingA  - Player A's current Elo rating
 * @param {number} ratingB  - Player B's current Elo rating
 * @param {number} outcome  - 1 = A wins, 0 = B wins, 0.5 = draw
 * @returns {{ newA: number, newB: number, deltaA: number, deltaB: number }}
 */
export function calculateElo(ratingA, ratingB, outcome) {
  if (typeof ratingA !== 'number' || typeof ratingB !== 'number') {
    throw new TypeError('Ratings must be numbers');
  }
  if (![0, 0.5, 1].includes(outcome)) {
    throw new RangeError('Outcome must be 0 (B wins), 0.5 (draw), or 1 (A wins)');
  }

  const kA = getKFactor(ratingA);
  const kB = getKFactor(ratingB);

  const expectedA = getExpectedScore(ratingA, ratingB);
  const expectedB = 1 - expectedA;

  const scoreA = outcome;
  const scoreB = 1 - outcome;

  const deltaA = Math.round(kA * (scoreA - expectedA));
  const deltaB = Math.round(kB * (scoreB - expectedB));

  const newA = Math.max(0, ratingA + deltaA);
  const newB = Math.max(0, ratingB + deltaB);

  return { newA, newB, deltaA, deltaB };
}

// ── Tier Lookup ───────────────────────────────────────────────────────────────

/**
 * Returns the tier name string for a given rating.
 *
 * @param {number} rating - Elo rating
 * @returns {string} Tier name, e.g. 'Gold'
 */
export function getTier(rating) {
  if (typeof rating !== 'number' || isNaN(rating)) return 'Bronze';
  const clampedRating = Math.max(0, rating);
  const tier = TIERS.find(t => clampedRating >= t.min && clampedRating <= t.max);
  return tier ? tier.name : 'Bronze';
}

/**
 * Returns full tier metadata for a given rating.
 *
 * @param {number} rating - Elo rating
 * @returns {{ name: string, icon: string, min: number, max: number, nextTier: string|null, pointsToNext: number|null }}
 */
export function getTierInfo(rating) {
  const clampedRating = Math.max(0, typeof rating === 'number' ? rating : 0);
  const idx = TIERS.findIndex(t => clampedRating >= t.min && clampedRating <= t.max);
  const tier = TIERS[idx] || TIERS[0];
  const nextTier = idx < TIERS.length - 1 ? TIERS[idx + 1] : null;

  return {
    name: tier.name,
    icon: tier.icon,
    min: tier.min,
    max: tier.max,
    nextTier: nextTier ? nextTier.name : null,
    pointsToNext: nextTier ? Math.max(0, nextTier.min - clampedRating) : null,
  };
}

/**
 * Returns the icon emoji for a given tier name.
 *
 * @param {string} tierName
 * @returns {string}
 */
export function getTierIcon(tierName) {
  const tier = TIERS.find(t => t.name === tierName);
  return tier ? tier.icon : '🥉';
}
