/**
 * iron-chain.js — The Iron Chain 1v1 Tug-of-War Game Loop
 * Decipher Language Learning Platform
 *
 * Implements the core game state machine and 60fps requestAnimationFrame physics loop
 * for the Iron Chain battle mode:
 *
 *   States: IDLE → COUNTDOWN → BATTLE → RESULT
 *
 * Physics:
 *   - chainTension: float [0.0, 1.0]
 *     0.0 = player has pulled the chain fully to their side (player wins)
 *     1.0 = bot has pulled the chain fully to its side (bot wins)
 *     Start: 0.5 (perfectly centred)
 *   - On valid player word: tension -= tensionDelta (chain moves toward bot)
 *   - On bot word:          tension += tensionDelta (chain moves toward player)
 *   - Momentum decay: tension drifts toward 0.5 by DECAY_RATE per frame (slight centering force)
 *   - Combo: 3+ valid player words in COMBO_WINDOW_MS → bonus jerk COMBO_BONUS_MULTIPLIER
 *   - Screen shake: triggered on combo or critical hit (C2 word)
 */

/** Game states */
export const GAME_STATE = {
  IDLE:      'IDLE',
  COUNTDOWN: 'COUNTDOWN',
  BATTLE:    'BATTLE',
  RESULT:    'RESULT',
};

/** Physics constants */
export const PHYSICS = {
  INITIAL_TENSION:       0.5,
  DECAY_RATE:            0.0004,   // per frame at 60fps — gentle drift back to centre
  WIN_THRESHOLD_PLAYER:  0.05,    // player wins if tension drops below this
  WIN_THRESHOLD_BOT:     0.95,    // bot wins if tension rises above this
  COMBO_WINDOW_MS:       8000,    // 8 seconds for combo detection
  COMBO_COUNT_REQUIRED:  3,       // consecutive valid words to trigger combo
  COMBO_BONUS_MULTIPLIER:1.4,     // tension jerk amplifier during combo
  SHAKE_DURATION_MS:     250,     // screen shake duration
  SHAKE_AMPLITUDE_PX:    4,       // max horizontal shake offset
  MATCH_DURATION_MS:     45000,   // 45 second matches
  COUNTDOWN_DURATION_MS: 3000,    // 3-second countdown before battle
};

/**
 * IronChainEngine — the stateful game logic engine.
 * UI rendering and canvas drawing are delegated to coliseum-ui.js and iron-chain-canvas.js.
 */
export class IronChainEngine {
  /**
   * @param {Object} callbacks
   * @param {function(number, string): void} callbacks.onTensionChange - (tension, source)
   * @param {function(WeightResult): void}   callbacks.onPlayerWord    - player word evaluated
   * @param {function(WeightResult): void}   callbacks.onBotWord       - bot word evaluated
   * @param {function(number): void}          callbacks.onCombo         - combo multiplier count
   * @param {function(number): void}          callbacks.onCountdown     - countdown tick (3,2,1)
   * @param {function(number): void}          callbacks.onTick          - remaining ms in battle
   * @param {function('player'|'bot'|'timeout', Object): void} callbacks.onMatchEnd
   * @param {function(): void}                callbacks.onShake         - screen shake trigger
   */
  constructor(callbacks = {}) {
    this._cb = {
      onTensionChange: callbacks.onTensionChange || (() => {}),
      onPlayerWord:    callbacks.onPlayerWord    || (() => {}),
      onBotWord:       callbacks.onBotWord       || (() => {}),
      onCombo:         callbacks.onCombo         || (() => {}),
      onCountdown:     callbacks.onCountdown     || (() => {}),
      onTick:          callbacks.onTick          || (() => {}),
      onMatchEnd:      callbacks.onMatchEnd      || (() => {}),
      onShake:         callbacks.onShake         || (() => {}),
    };

    this._state        = GAME_STATE.IDLE;
    this._tension      = PHYSICS.INITIAL_TENSION;
    this._rafId        = null;
    this._matchStartTs = null;
    this._countdownTs  = null;

    // Combo tracking
    this._recentPlayerWords = []; // timestamps of recent valid player words
    this._currentCombo      = 0;
    this._inCombo           = false;

    // Match statistics
    this._stats = this._freshStats();
  }

  _freshStats() {
    return {
      playerWords:    [],  // WeightResult[]
      botWords:       [],  // WeightResult[]
      playerTotalKg:  0,
      botTotalKg:     0,
      maxCombo:       0,
      finalTension:   PHYSICS.INITIAL_TENSION,
      durationMs:     0,
      result:         null, // 'player' | 'bot' | 'timeout'
    };
  }

  get state()   { return this._state; }
  get tension() { return this._tension; }
  get stats()   { return { ...this._stats }; }

  /**
   * Starts a new match — runs the 3-second countdown, then launches the battle loop.
   */
  startMatch() {
    if (this._state !== GAME_STATE.IDLE && this._state !== GAME_STATE.RESULT) return;
    this._reset();
    this._state = GAME_STATE.COUNTDOWN;
    this._runCountdown();
  }

  _reset() {
    this._stopLoop();
    this._tension             = PHYSICS.INITIAL_TENSION;
    this._recentPlayerWords   = [];
    this._currentCombo        = 0;
    this._inCombo             = false;
    this._stats               = this._freshStats();
  }

  _runCountdown() {
    let count = 3;
    this._cb.onCountdown(count);
    const tick = setInterval(() => {
      count--;
      if (count > 0) {
        this._cb.onCountdown(count);
      } else {
        clearInterval(tick);
        this._cb.onCountdown(0); // "GO!"
        this._launchBattle();
      }
    }, 1000);
  }

  _launchBattle() {
    this._state        = GAME_STATE.BATTLE;
    this._matchStartTs = performance.now();
    this._loop();
  }

  _loop() {
    this._rafId = requestAnimationFrame((ts) => {
      if (this._state !== GAME_STATE.BATTLE) return;

      const elapsed = ts - this._matchStartTs;
      const remaining = Math.max(0, PHYSICS.MATCH_DURATION_MS - elapsed);

      // Apply momentum decay — gentle drift toward centre
      this._applyDecay();

      // Check win conditions
      if (this._tension <= PHYSICS.WIN_THRESHOLD_PLAYER) {
        return this._endMatch('player', elapsed);
      }
      if (this._tension >= PHYSICS.WIN_THRESHOLD_BOT) {
        return this._endMatch('bot', elapsed);
      }
      if (remaining <= 0) {
        return this._endMatch('timeout', elapsed);
      }

      this._cb.onTick(remaining);
      this._cb.onTensionChange(this._tension, 'decay');
      this._loop();
    });
  }

  _applyDecay() {
    // Slight pull toward centre (0.5) each frame
    if (this._tension > PHYSICS.INITIAL_TENSION) {
      this._tension = Math.max(PHYSICS.INITIAL_TENSION, this._tension - PHYSICS.DECAY_RATE);
    } else if (this._tension < PHYSICS.INITIAL_TENSION) {
      this._tension = Math.min(PHYSICS.INITIAL_TENSION, this._tension + PHYSICS.DECAY_RATE);
    }
    this._tension = Math.max(0, Math.min(1, this._tension));
  }

  /**
   * Submit a player word to the engine.
   * Call this from the UI when the player presses Enter in the input field.
   * @param {WeightResult} weightResult - From lexical-weight.js evaluateWord()
   */
  submitPlayerWord(weightResult) {
    if (this._state !== GAME_STATE.BATTLE) return;

    this._stats.playerWords.push(weightResult);
    this._stats.playerTotalKg += weightResult.weight;
    this._cb.onPlayerWord(weightResult);

    if (weightResult.isFiller) {
      // Filler word — penalise player (chain moves toward bot)
      this._tension = Math.min(1, this._tension + Math.abs(weightResult.tensionDelta));
      this._breakCombo();
    } else {
      // Valid word — pull chain toward bot
      let delta = weightResult.tensionDelta;

      // Check combo
      const now = Date.now();
      this._recentPlayerWords = this._recentPlayerWords.filter(
        t => now - t < PHYSICS.COMBO_WINDOW_MS
      );
      this._recentPlayerWords.push(now);

      if (this._recentPlayerWords.length >= PHYSICS.COMBO_COUNT_REQUIRED) {
        delta *= PHYSICS.COMBO_BONUS_MULTIPLIER;
        this._currentCombo = this._recentPlayerWords.length;
        if (!this._inCombo) this._inCombo = true;
        this._stats.maxCombo = Math.max(this._stats.maxCombo, this._currentCombo);
        this._cb.onCombo(this._currentCombo);
      }

      this._tension = Math.max(0, this._tension - delta);

      // Screen shake on C2 word (Critical Hit) or active combo
      if (weightResult.tier === 'C2' || this._currentCombo >= 3) {
        this._cb.onShake();
      }
    }

    this._cb.onTensionChange(this._tension, 'player');
  }

  /**
   * Submit a bot word to the engine.
   * Called by BotController's onWordSubmit callback.
   * @param {WeightResult} weightResult
   */
  submitBotWord(weightResult) {
    if (this._state !== GAME_STATE.BATTLE) return;

    this._stats.botWords.push(weightResult);
    this._stats.botTotalKg += weightResult.weight;
    this._cb.onBotWord(weightResult);

    // Bot words push tension toward the bot's side (increase tension)
    this._tension = Math.min(1, this._tension + weightResult.tensionDelta);
    this._cb.onTensionChange(this._tension, 'bot');

    // Break player combo if bot pushes hard
    if (weightResult.tier === 'C2') this._breakCombo();
  }

  _breakCombo() {
    if (this._inCombo) {
      this._inCombo = false;
      this._currentCombo = 0;
      this._recentPlayerWords = [];
    }
  }

  _endMatch(result, durationMs) {
    this._stopLoop();
    this._state = GAME_STATE.RESULT;

    this._stats.finalTension = this._tension;
    this._stats.durationMs   = durationMs;
    this._stats.result       = result;

    this._cb.onMatchEnd(result, this._stats);
  }

  _stopLoop() {
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  /** Resets engine back to IDLE state. */
  reset() {
    this._stopLoop();
    this._state = GAME_STATE.IDLE;
    this._reset();
  }
}
