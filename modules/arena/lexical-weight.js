/**
 * lexical-weight.js — Lexical Weight Scoring Engine for the Lexicon Coliseum
 * Decipher Language Learning Platform
 *
 * Calculates the "pull weight" of a word submitted during an Iron Chain battle.
 * Pull weight determines how violently the tug-of-war chain moves toward the opponent.
 *
 * Weight scale (by CEFR tier):
 *   A1  →  10 kg  (common words, minimal pull)
 *   A2  →  25 kg
 *   B1  →  80 kg
 *   B2  → 150 kg
 *   C1  → 300 kg
 *   C2  → 500 kg  (elite GRE-level words, maximum pull)
 *
 * SRS Bonus: Words that are currently "due" in the user's SM-2 deck receive a ×1.5 multiplier
 * because deploying a word you are actively studying is worth extra cognitive reward.
 *
 * Unknown words: weight 5 (penalized but not blocked; prevents pure dictionary fishing)
 * Filler words (like, basically, literally, actually, um, uh): weight -50 (clock freeze penalty)
 */

import { lookupWord } from './cefr-bank.js';

/** CEFR tier → pull weight in kg */
export const CEFR_WEIGHT_MAP = {
  A1:  10,
  A2:  25,
  B1:  80,
  B2:  150,
  C1:  300,
  C2:  500,
};

/** Filler words that trigger a cognitive freeze penalty */
export const FILLER_WORDS = new Set([
  'like', 'basically', 'literally', 'actually', 'um', 'uh', 'you know',
  'sort of', 'kind of', 'i mean', 'you see', 'right', 'okay', 'so yeah',
]);

/** Penalty weight for filler word usage */
export const FILLER_PENALTY = -50;

/** Fallback weight for unrecognized words */
export const UNKNOWN_WORD_WEIGHT = 5;

/** SRS bonus multiplier for due cards */
export const SRS_BONUS_MULTIPLIER = 1.5;

/** Maximum chain tension change per word (normalized, 0.0–1.0) */
export const MAX_TENSION_DELTA = 0.12;

/**
 * Evaluates a submitted word and returns a full WeightResult.
 *
 * @param {string} word - The word submitted by the player
 * @param {Array.<{word: string}>} dueCards - User's currently due SRS cards
 * @returns {WeightResult}
 *
 * @typedef {Object} WeightResult
 * @property {string}  word          - Normalized input word
 * @property {number}  weight        - Raw pull weight in kg
 * @property {number}  tensionDelta  - Normalized tension change [−MAX_TENSION_DELTA, MAX_TENSION_DELTA]
 * @property {string}  tier          - CEFR tier ('A1'…'C2' | 'unknown' | 'filler')
 * @property {boolean} isFiller      - True if word is a cognitive filler
 * @property {boolean} isSRSBonus    - True if word matched a due SRS card
 * @property {string}  def           - Definition (empty string for unknown/filler)
 * @property {string}  pos           - Part of speech (empty string for unknown/filler)
 * @property {string}  feedback      - Human-readable result label for HUD display
 */
export function evaluateWord(word, dueCards = []) {
  const normalized = String(word || '').trim().toLowerCase();

  // 1. Filler word check
  if (FILLER_WORDS.has(normalized)) {
    return {
      word: normalized,
      weight: FILLER_PENALTY,
      tensionDelta: (FILLER_PENALTY / 500) * MAX_TENSION_DELTA * 10, // negative: opponent gains
      tier: 'filler',
      isFiller: true,
      isSRSBonus: false,
      def: '',
      pos: '',
      feedback: `❄️ Filler! "${word}" — Cognitive Freeze!`,
    };
  }

  // 2. CEFR bank lookup
  const entry = lookupWord(normalized);

  if (!entry) {
    return {
      word: normalized,
      weight: UNKNOWN_WORD_WEIGHT,
      tensionDelta: (UNKNOWN_WORD_WEIGHT / 500) * MAX_TENSION_DELTA,
      tier: 'unknown',
      isFiller: false,
      isSRSBonus: false,
      def: '',
      pos: '',
      feedback: `❓ "${word}" — Not in lexicon (+${UNKNOWN_WORD_WEIGHT}kg)`,
    };
  }

  // 3. SRS bonus check
  const isSRSBonus = Array.isArray(dueCards) && dueCards.some(
    c => c && String(c.word || '').trim().toLowerCase() === normalized
  );

  const baseWeight = CEFR_WEIGHT_MAP[entry.tier] || UNKNOWN_WORD_WEIGHT;
  const finalWeight = isSRSBonus
    ? Math.round(baseWeight * SRS_BONUS_MULTIPLIER)
    : baseWeight;

  // Normalize tension delta: C2 (500kg) moves chain by MAX_TENSION_DELTA
  const tensionDelta = (finalWeight / 500) * MAX_TENSION_DELTA;

  const bonusTag = isSRSBonus ? ' ⭐ SRS BONUS!' : '';
  const feedback = `💪 ${entry.tier} · +${finalWeight}kg — "${entry.def}"${bonusTag}`;

  return {
    word: normalized,
    weight: finalWeight,
    tensionDelta,
    tier: entry.tier,
    isFiller: false,
    isSRSBonus,
    def: entry.def,
    pos: entry.pos,
    feedback,
  };
}

/**
 * Returns the base CEFR weight for a tier string.
 * @param {string} tier
 * @returns {number}
 */
export function getCEFRWeight(tier) {
  return CEFR_WEIGHT_MAP[tier] || UNKNOWN_WORD_WEIGHT;
}

/**
 * Checks whether a word is a filler word.
 * @param {string} word
 * @returns {boolean}
 */
export function isFillerWord(word) {
  return FILLER_WORDS.has(String(word || '').trim().toLowerCase());
}

/**
 * Returns sorted ranking of evaluated words by weight (descending).
 * Useful for match summary / post-game stats.
 * @param {WeightResult[]} results
 * @returns {WeightResult[]}
 */
export function rankByWeight(results) {
  return [...results].sort((a, b) => b.weight - a.weight);
}

/**
 * Calculates total pull weight from an array of WeightResults.
 * @param {WeightResult[]} results
 * @returns {number}
 */
export function totalPullWeight(results) {
  return results.reduce((sum, r) => sum + r.weight, 0);
}
