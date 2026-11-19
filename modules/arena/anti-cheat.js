/**
 * anti-cheat.js — Server-Side Input Validator for Lexicon Coliseum PvP
 * Decipher Language Learning Platform
 *
 * Validates every word action submitted during a PvP match before it
 * is processed and broadcast to both players. Prevents:
 *   - Words shorter than 3 characters
 *   - Words that break the letter-chain rule
 *   - Duplicate words within the same session
 *   - Submission rate abuse (1 word per 500ms per player)
 *   - Non-alphabetic input (numbers, symbols, injection attempts)
 *
 * Exports:
 *   validateWord(word, chainHistory, uid, sessionRateMap) → ValidationResult
 *   createRateMap()                                        → Map
 *   VALIDATION_RULES                                       → object
 */

export const VALIDATION_RULES = {
  MIN_WORD_LENGTH: 3,
  MAX_WORD_LENGTH: 45,
  MIN_SUBMISSION_INTERVAL_MS: 500,
  ALLOWED_PATTERN: /^[a-z]+$/,  // Lowercase alpha only after normalization
};

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid   - Whether the word passes all checks
 * @property {string}  word    - Normalized word (lowercase, trimmed)
 * @property {string}  [reason] - Human-readable rejection reason if invalid
 * @property {string}  [rule]   - Machine-readable rule name that failed
 */

/**
 * Creates a fresh per-session rate-limit map.
 * Maps uid → last submission timestamp (ms).
 *
 * @returns {Map<string, number>}
 */
export function createRateMap() {
  return new Map();
}

/**
 * Validates a word submission from a PvP player.
 *
 * @param {string}          word          - Raw word submitted by the player
 * @param {string[]}        chainHistory  - Ordered list of words already played in this match
 * @param {string}          uid           - Submitting player's Firebase UID
 * @param {Map<string,number>} rateMap   - Shared rate-limit map for this match session
 * @param {Object}          [options]     - Optional validation settings
 * @param {boolean}         [options.enforceChain=true] - Enforce last-letter-to-first-letter chaining
 * @returns {ValidationResult}
 */
export function validateWord(word, chainHistory, uid, rateMap, options = {}) {
  const { enforceChain = true } = options;
  // ── 1. Normalize ────────────────────────────────────────────────────────
  if (typeof word !== 'string') {
    return { valid: false, word: '', reason: 'Invalid submission.', rule: 'TYPE' };
  }

  const normalized = word.trim().toLowerCase();

  // ── 2. Rate limit ───────────────────────────────────────────────────────
  if (rateMap instanceof Map) {
    const now = Date.now();
    const lastMs = rateMap.get(uid) || 0;
    if (now - lastMs < VALIDATION_RULES.MIN_SUBMISSION_INTERVAL_MS) {
      return {
        valid: false,
        word: normalized,
        reason: 'Slow down — one word at a time!',
        rule: 'RATE_LIMIT',
      };
    }
    rateMap.set(uid, now);
  }

  // ── 3. Length check ─────────────────────────────────────────────────────
  if (normalized.length < VALIDATION_RULES.MIN_WORD_LENGTH) {
    return {
      valid: false,
      word: normalized,
      reason: `Word must be at least ${VALIDATION_RULES.MIN_WORD_LENGTH} characters.`,
      rule: 'TOO_SHORT',
    };
  }

  if (normalized.length > VALIDATION_RULES.MAX_WORD_LENGTH) {
    return {
      valid: false,
      word: normalized,
      reason: `Word exceeds maximum length of ${VALIDATION_RULES.MAX_WORD_LENGTH} characters.`,
      rule: 'TOO_LONG',
    };
  }

  // ── 4. Character whitelist ──────────────────────────────────────────────
  if (!VALIDATION_RULES.ALLOWED_PATTERN.test(normalized)) {
    return {
      valid: false,
      word: normalized,
      reason: 'Only alphabetic characters are allowed.',
      rule: 'INVALID_CHARS',
    };
  }

  // ── 5. Duplicate check ──────────────────────────────────────────────────
  const historyLower = (chainHistory || []).map(w => w.toLowerCase());
  if (historyLower.includes(normalized)) {
    return {
      valid: false,
      word: normalized,
      reason: `"${normalized}" has already been played in this match.`,
      rule: 'DUPLICATE',
    };
  }

  // ── 6. Letter-chain rule ────────────────────────────────────────────────
  if (enforceChain && historyLower.length > 0) {
    const lastWord = historyLower[historyLower.length - 1];
    const requiredFirstLetter = lastWord[lastWord.length - 1];
    if (normalized[0] !== requiredFirstLetter) {
      return {
        valid: false,
        word: normalized,
        reason: `Word must start with "${requiredFirstLetter.toUpperCase()}" (last letter of "${lastWord}").`,
        rule: 'CHAIN_BREAK',
      };
    }
  }

  // ── All checks passed ───────────────────────────────────────────────────
  return { valid: true, word: normalized };
}
