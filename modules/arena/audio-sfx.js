/**
 * audio-sfx.js — Procedural Web Audio SFX Engine for the Lexicon Coliseum
 * Decipher Language Learning Platform
 *
 * Synthesizes all arena sound effects using only the Web Audio API.
 * Zero external audio files or HTTP requests required.
 *
 * Effects:
 *   chainClank()    — Short metallic burst on valid word submission
 *   comboChime()    — Ascending 3-note arp on combo activation
 *   fillerFreeze()  — Harsh buzzer on filler word penalty
 *   heartbeat()     — Low thud when <15s remaining (call repeatedly)
 *   victoryFanfare()— 5-note ascending chord on match win
 *   defeatThud()    — Descending minor 3-tone on match loss
 *   criticalHit()   — Sharp high-pitched ping on C2 word (elite hit)
 */

export class ArenaAudioEngine {
  constructor() {
    this._ctx = null;
    this._masterGain = null;
    this._heartbeatInterval = null;
    this._initialized = false;
  }

  /**
   * Initialises the AudioContext. Must be called after a user gesture
   * (click, keypress) to satisfy browser autoplay policies.
   */
  init() {
    if (this._initialized) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return; // Browser does not support Web Audio
      this._ctx = new AudioCtx();
      this._masterGain = this._ctx.createGain();
      this._masterGain.gain.setValueAtTime(0.6, this._ctx.currentTime);
      this._masterGain.connect(this._ctx.destination);
      this._initialized = true;
    } catch (_) { /* Silent fail in non-browser environments */ }
  }

  /** Resumes AudioContext if suspended (required after page visibility changes). */
  resume() {
    if (this._ctx && this._ctx.state === 'suspended') {
      this._ctx.resume();
    }
  }

  /**
   * Creates a gain node connected to the master output.
   * @param {number} [volume=1.0]
   * @returns {GainNode}
   */
  _gain(volume = 1.0) {
    const g = this._ctx.createGain();
    g.gain.setValueAtTime(volume, this._ctx.currentTime);
    g.connect(this._masterGain);
    return g;
  }

  /**
   * Plays a synthesized tone using an OscillatorNode.
   * @param {number} freq - Frequency in Hz
   * @param {'sine'|'square'|'sawtooth'|'triangle'} type
   * @param {number} startTime - AudioContext time offset
   * @param {number} duration - Duration in seconds
   * @param {number} [volume=0.5]
   * @param {number} [fadeOut=0.05] - Fade-out duration in seconds
   */
  _tone(freq, type, startTime, duration, volume = 0.5, fadeOut = 0.05) {
    if (!this._initialized) return;
    const g = this._gain(0);
    const osc = this._ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);
    osc.connect(g);

    g.gain.setValueAtTime(0, startTime);
    g.gain.linearRampToValueAtTime(volume, startTime + 0.005);
    g.gain.setValueAtTime(volume, startTime + duration - fadeOut);
    g.gain.linearRampToValueAtTime(0, startTime + duration);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.01);
  }

  /**
   * ⛓️ Chain Clank — metallic burst on valid word submission.
   * Short square wave at 220Hz with rapid gain decay.
   */
  playChainClank() {
    if (!this._initialized) return;
    const t = this._ctx.currentTime;
    this._tone(220, 'square', t,       0.04, 0.4, 0.03);
    this._tone(185, 'square', t + 0.02, 0.03, 0.2, 0.02);
  }

  /**
   * ⚡ Combo Chime — ascending 3-note arpeggio on combo activation.
   * Sine wave: 440→554→659 Hz, 80ms each.
   */
  playComboChime() {
    if (!this._initialized) return;
    const t = this._ctx.currentTime;
    this._tone(440, 'sine', t,        0.1, 0.5, 0.04);
    this._tone(554, 'sine', t + 0.1,  0.1, 0.5, 0.04);
    this._tone(659, 'sine', t + 0.2,  0.15, 0.6, 0.06);
  }

  /**
   * 🎯 Critical Hit — sharp high-pitched ping on C2 or elite word.
   * Triangle wave: 1047Hz (C6), 60ms.
   */
  playCriticalHit() {
    if (!this._initialized) return;
    const t = this._ctx.currentTime;
    this._tone(1047, 'triangle', t, 0.06, 0.55, 0.04);
    this._tone(880,  'triangle', t + 0.07, 0.08, 0.3, 0.05);
  }

  /**
   * ❄️ Filler Freeze — harsh dissonant buzzer on filler word penalty.
   * Square wave: 110Hz + 117Hz (slight beating dissonance), 200ms.
   */
  playFillerFreeze() {
    if (!this._initialized) return;
    const t = this._ctx.currentTime;
    this._tone(110, 'square', t, 0.2, 0.4, 0.05);
    this._tone(117, 'square', t, 0.2, 0.3, 0.05);
  }

  /**
   * 💓 Heartbeat — low tension thud for clock pressure under 15 seconds.
   * Call once; use startHeartbeat/stopHeartbeat for recurring effect.
   */
  playHeartbeat() {
    if (!this._initialized) return;
    const t = this._ctx.currentTime;
    this._tone(60, 'sine', t,       0.08, 0.5, 0.04);
    this._tone(55, 'sine', t + 0.1, 0.06, 0.3, 0.03);
  }

  /**
   * Starts recurring heartbeat effect. Call when <15s remaining.
   * @param {number} intervalMs - Interval between beats (default: 1200ms)
   */
  startHeartbeat(intervalMs = 1200) {
    this.stopHeartbeat();
    this.playHeartbeat();
    this._heartbeatInterval = setInterval(() => this.playHeartbeat(), intervalMs);
  }

  /** Stops the recurring heartbeat. */
  stopHeartbeat() {
    if (this._heartbeatInterval) {
      clearInterval(this._heartbeatInterval);
      this._heartbeatInterval = null;
    }
  }

  /**
   * 🏆 Victory Fanfare — 5-note ascending chord on match win.
   * C5→D5→E5→G5→A5 (pentatonic feel), sine wave.
   */
  playVictoryFanfare() {
    if (!this._initialized) return;
    const t = this._ctx.currentTime;
    const notes = [523, 587, 659, 784, 880];
    notes.forEach((freq, i) => {
      this._tone(freq, 'sine', t + i * 0.12, 0.3, 0.55, 0.1);
    });
    // Sustain chord at the end
    [523, 659, 784].forEach(freq => {
      this._tone(freq, 'sine', t + notes.length * 0.12, 0.6, 0.3, 0.3);
    });
  }

  /**
   * 💀 Defeat Thud — descending minor 3-tone on match loss.
   * E4→C#4→A3, sawtooth wave, minor despondent feel.
   */
  playDefeatThud() {
    if (!this._initialized) return;
    const t = this._ctx.currentTime;
    this._tone(329, 'sawtooth', t,        0.3, 0.5, 0.15);
    this._tone(277, 'sawtooth', t + 0.25, 0.3, 0.4, 0.15);
    this._tone(220, 'sawtooth', t + 0.5,  0.5, 0.35, 0.3);
  }

  /**
   * Closes the AudioContext and cleans up all resources.
   */
  dispose() {
    this.stopHeartbeat();
    if (this._ctx) {
      this._ctx.close();
      this._ctx = null;
      this._masterGain = null;
      this._initialized = false;
    }
  }
}
