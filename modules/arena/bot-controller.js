/**
 * bot-controller.js — AI Bot Archetypes for the Lexicon Coliseum
 * Decipher Language Learning Platform
 *
 * Simulates three AI opponent archetypes with realistic human-like behaviour:
 * typing jitter, miss-rate variance, fatigue simulation, and tier-appropriate vocab.
 *
 * Archetypes:
 *   🥉 Rookie Bot       — A1/A2 words, slow (28 WPM), erratic, 25% miss rate
 *   🥈 Scholar Bot      — B1/B2 words, steady (52 WPM), moderate, 10% miss rate
 *   🥇 Grand Inquisitor — C1/C2 words, aggressive (78 WPM), precise, 3% miss rate
 */

import { getWordsForTiers } from './cefr-bank.js';
import { getCEFRWeight } from './lexical-weight.js';

/** @typedef {'rookie'|'scholar'|'grandInquisitor'} BotId */

/** Bot archetype definitions */
export const BOT_ARCHETYPES = {
  rookie: {
    id: 'rookie',
    name: 'Rookie',
    icon: '🥉',
    description: 'A nervous beginner. Slow and erratic — but don\'t underestimate beginner\'s luck.',
    tiers: ['A1', 'A2'],
    baseWPM: 28,
    jitter: 0.40,       // 0 = robot-perfect timing, 1 = chaotic human
    missRate: 0.25,      // probability of skipping a word on first selection attempt
    fatigueRate: 0.003,  // WPM reduction per second after 20s of match
    avatarEmoji: '🧑‍💻',
  },
  scholar: {
    id: 'scholar',
    name: 'Scholar',
    icon: '🥈',
    description: 'Disciplined and methodical. Knows B-tier words cold. Will grind you down.',
    tiers: ['B1', 'B2'],
    baseWPM: 52,
    jitter: 0.20,
    missRate: 0.10,
    fatigueRate: 0.001,
    avatarEmoji: '👩‍🎓',
  },
  grandInquisitor: {
    id: 'grandInquisitor',
    name: 'Grand Inquisitor',
    icon: '🥇',
    description: 'C1/C2 mastery. Surgical precision. No hesitation. You will suffer.',
    tiers: ['C1', 'C2'],
    baseWPM: 78,
    jitter: 0.08,
    missRate: 0.03,
    fatigueRate: 0.0003,
    avatarEmoji: '🧙',
  },
};

/**
 * BotController manages the AI opponent's simulated turn-by-turn behaviour.
 * It fires word-submission events at human-like intervals using jitter timing.
 */
export class BotController {
  /**
   * @param {BotId} botId
   * @param {function(string): void} onWordSubmit - Callback when bot fires a word
   * @param {function(string): void} [onStatusChange] - Optional status message callback
   */
  constructor(botId, onWordSubmit, onStatusChange) {
    const archetype = BOT_ARCHETYPES[botId];
    if (!archetype) throw new Error(`Unknown bot archetype: "${botId}"`);

    this._archetype = archetype;
    this._onWordSubmit = onWordSubmit;
    this._onStatusChange = onStatusChange || (() => {});
    this._wordPool = this._buildWordPool(archetype.tiers);
    this._usedWords = new Set();
    this._running = false;
    this._timeoutId = null;
    this._elapsedSeconds = 0;
    this._fatigueTimer = null;
  }

  /**
   * Builds a shuffled word pool from the bot's allowed CEFR tiers.
   * Weights higher-tier words more heavily for realistic behaviour.
   */
  _buildWordPool(tiers) {
    const words = getWordsForTiers(tiers);
    // Weighted shuffle: C2/C1 words appear more often for inquisitor
    return words.sort(() => Math.random() - 0.5);
  }

  /** Picks the next unused word from the pool, looping if exhausted. */
  _nextWord() {
    for (const entry of this._wordPool) {
      if (!this._usedWords.has(entry.word)) {
        // Apply miss rate — bot "fumbles" and picks another
        if (Math.random() < this._archetype.missRate) continue;
        this._usedWords.add(entry.word);
        return entry.word;
      }
    }
    // All words used — reset pool and pick fresh
    this._usedWords.clear();
    return this._wordPool[0]?.word || 'word';
  }

  /**
   * Calculates the delay (ms) until the bot's next word submission,
   * incorporating jitter and fatigue.
   * @returns {number} delay in milliseconds
   */
  _nextDelay() {
    const { baseWPM, jitter, fatigueRate } = this._archetype;
    // Fatigue reduces WPM over time
    const effectiveWPM = Math.max(10, baseWPM - fatigueRate * this._elapsedSeconds * 60);
    // Base delay: ms per word at WPM
    const baseDelay = (60 / effectiveWPM) * 1000;
    // Apply jitter: random variance ±(jitter × baseDelay)
    const jitterAmount = (Math.random() * 2 - 1) * jitter * baseDelay;
    return Math.max(500, baseDelay + jitterAmount);
  }

  /**
   * Starts the bot's autonomous word-firing loop.
   * @param {number} matchDurationMs - Total match duration to auto-stop
   */
  start(matchDurationMs = 45000) {
    this._running = true;
    this._elapsedSeconds = 0;
    this._scheduleNextWord();

    // Fatigue counter
    this._fatigueTimer = setInterval(() => {
      this._elapsedSeconds++;
    }, 1000);

    // Auto-stop when match ends
    setTimeout(() => this.stop(), matchDurationMs);
  }

  _scheduleNextWord() {
    if (!this._running) return;
    const delay = this._nextDelay();
    this._timeoutId = setTimeout(() => {
      if (!this._running) return;
      const word = this._nextWord();
      this._onWordSubmit(word);
      this._scheduleNextWord();
    }, delay);
  }

  /** Stops the bot immediately. */
  stop() {
    this._running = false;
    if (this._timeoutId) clearTimeout(this._timeoutId);
    if (this._fatigueTimer) clearInterval(this._fatigueTimer);
    this._timeoutId = null;
    this._fatigueTimer = null;
  }

  /** Returns the archetype's display name and icon. */
  get displayName() {
    return `${this._archetype.icon} ${this._archetype.name}`;
  }

  /** Returns the archetype metadata (read-only). */
  get archetype() {
    return { ...this._archetype };
  }

  /** Returns whether the bot is currently active. */
  get isRunning() {
    return this._running;
  }
}

/**
 * Returns sorted list of bot archetypes for lobby display.
 * @returns {Array}
 */
export function getBotRoster() {
  return Object.values(BOT_ARCHETYPES);
}
