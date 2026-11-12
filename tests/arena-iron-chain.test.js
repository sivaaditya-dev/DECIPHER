/**
 * arena-iron-chain.test.js — Unit Tests: Iron Chain Physics Engine
 * Decipher Language Learning Platform — Lexicon Coliseum
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const bankCode = fs.readFileSync(path.resolve(__dirname, '../modules/arena/cefr-bank.js'), 'utf8')
  .replace(/^export\s+/gm, '');
const weightCode = fs.readFileSync(path.resolve(__dirname, '../modules/arena/lexical-weight.js'), 'utf8')
  .replace(/^import[^;]+;/gm, '')
  .replace(/^export\s+/gm, '');
const chainCode = fs.readFileSync(path.resolve(__dirname, '../modules/arena/iron-chain.js'), 'utf8')
  .replace(/^export\s+/gm, '');

const wrapped = `(function() {
${bankCode}
${weightCode}
${chainCode}
return {
  IronChainEngine,
  GAME_STATE,
  PHYSICS,
  evaluateWord,
};
})()`;

const sandbox = {
  console, Date, Math, Array, Object, Number, RangeError, TypeError, Error,
  JSON, Map, Set, String, parseInt, parseFloat, isNaN, setTimeout, clearTimeout,
  performance: { now: () => Date.now() },
  requestAnimationFrame: (cb) => setTimeout(() => cb(Date.now()), 16),
  cancelAnimationFrame: (id) => clearTimeout(id),
};
vm.createContext(sandbox);
const {
  IronChainEngine,
  GAME_STATE,
  PHYSICS,
  evaluateWord,
} = vm.runInContext(wrapped, sandbox);

function makeEngine(overrides = {}) {
  return new IronChainEngine({
    onTensionChange: () => {},
    onPlayerWord:    () => {},
    onBotWord:       () => {},
    onCombo:         () => {},
    onCountdown:     () => {},
    onTick:          () => {},
    onMatchEnd:      () => {},
    onShake:         () => {},
    ...overrides,
  });
}

function forceBattle(engine) {
  engine._state        = GAME_STATE.BATTLE;
  engine._matchStartTs = Date.now();
}

describe('IronChainEngine — Initial State', () => {
  it('starts in IDLE state', () => {
    const engine = makeEngine();
    expect(engine.state).toBe(GAME_STATE.IDLE);
  });

  it('initialises tension at 0.5 (perfectly centred)', () => {
    const engine = makeEngine();
    expect(engine.tension).toBe(PHYSICS.INITIAL_TENSION);
  });

  it('stats are zeroed on initialisation', () => {
    const engine = makeEngine();
    const stats = engine.stats;
    expect(stats.playerTotalKg).toBe(0);
    expect(stats.botTotalKg).toBe(0);
    expect(stats.maxCombo).toBe(0);
    expect(stats.playerWords).toHaveLength(0);
    expect(stats.botWords).toHaveLength(0);
  });
});

describe('IronChainEngine — Player Word Submission', () => {
  it('decreases tension when player submits a valid word', () => {
    const engine = makeEngine();
    forceBattle(engine);
    const before = engine.tension;
    const result = evaluateWord('ephemeral', []);
    engine.submitPlayerWord(result);
    expect(engine.tension).toBeLessThan(before);
  });

  it('tension decrease is proportional to lexical weight', () => {
    const engineA = makeEngine();
    const engineB = makeEngine();
    forceBattle(engineA);
    forceBattle(engineB);

    engineA.submitPlayerWord(evaluateWord('begin', []));      // A1 = 10 kg
    engineB.submitPlayerWord(evaluateWord('solipsism', [])); // C2 = 500 kg

    expect(engineB.tension).toBeLessThan(engineA.tension);
  });

  it('filler word increases tension (penalises player)', () => {
    const engine = makeEngine();
    forceBattle(engine);
    const before = engine.tension;
    engine.submitPlayerWord(evaluateWord('like', []));
    expect(engine.tension).toBeGreaterThan(before);
  });

  it('tension is clamped to minimum 0.0', () => {
    const engine = makeEngine();
    forceBattle(engine);
    for (let i = 0; i < 100; i++) {
      engine.submitPlayerWord(evaluateWord('solipsism', []));
    }
    expect(engine.tension).toBeGreaterThanOrEqual(0);
  });

  it('tension is clamped to maximum 1.0 on filler spam', () => {
    const engine = makeEngine();
    forceBattle(engine);
    for (let i = 0; i < 100; i++) {
      engine.submitPlayerWord(evaluateWord('like', []));
    }
    expect(engine.tension).toBeLessThanOrEqual(1);
  });

  it('records word in playerWords stats', () => {
    const engine = makeEngine();
    forceBattle(engine);
    engine.submitPlayerWord(evaluateWord('ephemeral', []));
    expect(engine.stats.playerWords).toHaveLength(1);
    expect(engine.stats.playerWords[0].word).toBe('ephemeral');
  });

  it('accumulates playerTotalKg correctly', () => {
    const engine = makeEngine();
    forceBattle(engine);
    const r1 = evaluateWord('begin', []);     // A1 = 10
    const r2 = evaluateWord('ephemeral', []); // C1 = 300
    engine.submitPlayerWord(r1);
    engine.submitPlayerWord(r2);
    expect(engine.stats.playerTotalKg).toBe(r1.weight + r2.weight);
  });

  it('ignores player word submission when not in BATTLE state', () => {
    const engine = makeEngine();
    engine.submitPlayerWord(evaluateWord('ephemeral', []));
    expect(engine.stats.playerWords).toHaveLength(0);
    expect(engine.tension).toBe(PHYSICS.INITIAL_TENSION);
  });
});

describe('IronChainEngine — Bot Word Submission', () => {
  it('increases tension when bot submits a word', () => {
    const engine = makeEngine();
    forceBattle(engine);
    const before = engine.tension;
    engine.submitBotWord(evaluateWord('solipsism', []));
    expect(engine.tension).toBeGreaterThan(before);
  });

  it('records word in botWords stats', () => {
    const engine = makeEngine();
    forceBattle(engine);
    engine.submitBotWord(evaluateWord('pernicious', []));
    expect(engine.stats.botWords).toHaveLength(1);
  });

  it('accumulates botTotalKg correctly', () => {
    const engine = makeEngine();
    forceBattle(engine);
    const r = evaluateWord('solipsism', []);
    engine.submitBotWord(r);
    engine.submitBotWord(r);
    expect(engine.stats.botTotalKg).toBe(r.weight * 2);
  });
});

describe('IronChainEngine — Combo System', () => {
  it('tracks maxCombo in stats when combo fires', () => {
    const comboCounts = [];
    const engine = makeEngine({
      onCombo: (count) => comboCounts.push(count),
    });
    forceBattle(engine);

    engine.submitPlayerWord(evaluateWord('ephemeral', []));
    engine.submitPlayerWord(evaluateWord('pernicious', []));
    engine.submitPlayerWord(evaluateWord('solipsism', []));

    expect(engine.stats.maxCombo).toBeGreaterThanOrEqual(3);
    expect(comboCounts.length).toBeGreaterThan(0);
  });

  it('applies combo bonus multiplier to tension delta', () => {
    const enginePlain = makeEngine();
    forceBattle(enginePlain);
    enginePlain._tension = 0.5;
    const before = enginePlain.tension;
    enginePlain.submitPlayerWord(evaluateWord('ephemeral', []));
    const normalDrop = before - enginePlain.tension;

    const engineCombo = makeEngine();
    forceBattle(engineCombo);
    engineCombo._tension = 0.5;
    const now = Date.now();
    engineCombo._recentPlayerWords = [now - 100, now - 200];
    const beforeCombo = engineCombo.tension;
    engineCombo.submitPlayerWord(evaluateWord('ephemeral', []));
    const comboDrop = beforeCombo - engineCombo.tension;

    expect(comboDrop).toBeGreaterThan(normalDrop * (PHYSICS.COMBO_BONUS_MULTIPLIER - 0.1));
  });
});

describe('IronChainEngine — Momentum Decay', () => {
  it('_applyDecay() moves tension slightly toward 0.5 when above', () => {
    const engine = makeEngine();
    engine._tension = 0.8;
    engine._applyDecay();
    expect(engine.tension).toBeLessThan(0.8);
    expect(engine.tension).toBeGreaterThanOrEqual(PHYSICS.INITIAL_TENSION);
  });

  it('_applyDecay() moves tension slightly toward 0.5 when below', () => {
    const engine = makeEngine();
    engine._tension = 0.2;
    engine._applyDecay();
    expect(engine.tension).toBeGreaterThan(0.2);
    expect(engine.tension).toBeLessThanOrEqual(PHYSICS.INITIAL_TENSION);
  });

  it('_applyDecay() does not move tension when already at 0.5', () => {
    const engine = makeEngine();
    engine._tension = 0.5;
    engine._applyDecay();
    expect(engine.tension).toBeCloseTo(0.5, 5);
  });

  it('DECAY_RATE is small enough that one frame shift is minimal', () => {
    const engine = makeEngine();
    engine._tension = 0.7;
    engine._applyDecay();
    const delta = Math.abs(0.7 - engine.tension);
    expect(delta).toBeLessThan(0.01);
  });
});

describe('IronChainEngine — Reset and State Machine', () => {
  it('reset() returns engine to IDLE with fresh stats', () => {
    const engine = makeEngine();
    forceBattle(engine);
    engine.submitPlayerWord(evaluateWord('ephemeral', []));
    engine.reset();
    expect(engine.state).toBe(GAME_STATE.IDLE);
    expect(engine.tension).toBe(PHYSICS.INITIAL_TENSION);
    expect(engine.stats.playerTotalKg).toBe(0);
    expect(engine.stats.playerWords).toHaveLength(0);
  });

  it('cannot start match from BATTLE state', () => {
    const engine = makeEngine();
    forceBattle(engine);
    const stateBefore = engine.state;
    engine.startMatch();
    expect(engine.state).toBe(stateBefore);
  });
});
