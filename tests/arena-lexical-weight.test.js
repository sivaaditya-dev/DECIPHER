/**
 * arena-lexical-weight.test.js — Unit Tests: LexicalWeight Engine
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

const wrapped = `(function() {
${bankCode}
${weightCode}
return {
  evaluateWord,
  getCEFRWeight,
  isFillerWord,
  rankByWeight,
  totalPullWeight,
  CEFR_WEIGHT_MAP,
  FILLER_PENALTY,
  UNKNOWN_WORD_WEIGHT,
  SRS_BONUS_MULTIPLIER,
  MAX_TENSION_DELTA,
};
})()`;

const sandbox = {
  console, Date, Math, Array, Object, Number, RangeError, TypeError, Error,
  JSON, Map, Set, String, parseInt, parseFloat, isNaN, setTimeout, clearTimeout
};
vm.createContext(sandbox);
const {
  evaluateWord,
  getCEFRWeight,
  isFillerWord,
  rankByWeight,
  totalPullWeight,
  CEFR_WEIGHT_MAP,
  FILLER_PENALTY,
  UNKNOWN_WORD_WEIGHT,
  SRS_BONUS_MULTIPLIER,
  MAX_TENSION_DELTA,
} = vm.runInContext(wrapped, sandbox);

describe('LexicalWeight Engine — CEFR Tier Scoring', () => {
  it('assigns correct base weight for A1 word', () => {
    const result = evaluateWord('begin', []);
    expect(result.weight).toBe(CEFR_WEIGHT_MAP.A1);
    expect(result.tier).toBe('A1');
    expect(result.isFiller).toBe(false);
    expect(result.isSRSBonus).toBe(false);
  });

  it('assigns correct base weight for B1 word', () => {
    const result = evaluateWord('perceive', []);
    expect(result.weight).toBe(CEFR_WEIGHT_MAP.B1);
    expect(result.tier).toBe('B1');
  });

  it('assigns correct base weight for C1 word', () => {
    const result = evaluateWord('ephemeral', []);
    expect(result.weight).toBe(CEFR_WEIGHT_MAP.C1);
    expect(result.tier).toBe('C1');
  });

  it('assigns maximum weight for C2 word', () => {
    const result = evaluateWord('solipsism', []);
    expect(result.weight).toBe(CEFR_WEIGHT_MAP.C2);
    expect(result.tier).toBe('C2');
  });

  it('is case-insensitive for word lookup', () => {
    const lower = evaluateWord('ephemeral', []);
    const upper = evaluateWord('EPHEMERAL', []);
    const mixed = evaluateWord('Ephemeral', []);
    expect(lower.weight).toBe(upper.weight);
    expect(lower.weight).toBe(mixed.weight);
  });

  it('trims surrounding whitespace from word', () => {
    const result = evaluateWord('  ephemeral  ', []);
    expect(result.tier).toBe('C1');
    expect(result.word).toBe('ephemeral');
  });

  it('assigns UNKNOWN_WORD_WEIGHT for unrecognized word', () => {
    const result = evaluateWord('xyzqwerty', []);
    expect(result.weight).toBe(UNKNOWN_WORD_WEIGHT);
    expect(result.tier).toBe('unknown');
    expect(result.isFiller).toBe(false);
  });

  it('provides non-empty definition for bank words', () => {
    const result = evaluateWord('pernicious', []);
    expect(result.def.length).toBeGreaterThan(0);
  });

  it('provides empty definition for unknown words', () => {
    const result = evaluateWord('xyzqwerty', []);
    expect(result.def).toBe('');
  });

  it('tensionDelta is positive for valid words', () => {
    const result = evaluateWord('ephemeral', []);
    expect(result.tensionDelta).toBeGreaterThan(0);
  });

  it('tensionDelta for C2 word is exactly MAX_TENSION_DELTA (without SRS bonus)', () => {
    const result = evaluateWord('solipsism', []);
    expect(result.tensionDelta).toBeCloseTo(MAX_TENSION_DELTA, 5);
  });

  it('tensionDelta scales proportionally with CEFR tier', () => {
    const a1 = evaluateWord('begin', []);
    const c2 = evaluateWord('solipsism', []);
    expect(c2.tensionDelta).toBeGreaterThan(a1.tensionDelta);
  });
});

describe('LexicalWeight Engine — SRS Bonus Injection', () => {
  it('applies 1.5× SRS bonus for a due card', () => {
    const dueCards = [{ word: 'ephemeral' }];
    const withBonus    = evaluateWord('ephemeral', dueCards);
    const withoutBonus = evaluateWord('ephemeral', []);
    expect(withBonus.isSRSBonus).toBe(true);
    expect(withBonus.weight).toBe(Math.round(withoutBonus.weight * SRS_BONUS_MULTIPLIER));
  });

  it('SRS check is case-insensitive', () => {
    const dueCards = [{ word: 'EPHEMERAL' }];
    const result = evaluateWord('ephemeral', dueCards);
    expect(result.isSRSBonus).toBe(true);
  });

  it('no SRS bonus for word not in due cards', () => {
    const dueCards = [{ word: 'pernicious' }];
    const result = evaluateWord('ephemeral', dueCards);
    expect(result.isSRSBonus).toBe(false);
  });

  it('SRS bonus tensionDelta exceeds non-bonus delta for same word', () => {
    const dueCards = [{ word: 'solipsism' }];
    const withBonus    = evaluateWord('solipsism', dueCards);
    const withoutBonus = evaluateWord('solipsism', []);
    expect(withBonus.tensionDelta).toBeGreaterThan(withoutBonus.tensionDelta);
  });

  it('handles empty dueCards array safely', () => {
    expect(() => evaluateWord('ephemeral', [])).not.toThrow();
  });

  it('handles malformed dueCards entries gracefully', () => {
    const dueCards = [null, undefined, {}, { word: null }];
    expect(() => evaluateWord('ephemeral', dueCards)).not.toThrow();
  });
});

describe('LexicalWeight Engine — Filler Word Detection', () => {
  it('detects "like" as a filler word', () => {
    const result = evaluateWord('like', []);
    expect(result.isFiller).toBe(true);
    expect(result.weight).toBe(FILLER_PENALTY);
  });

  it('detects "basically" as a filler word', () => {
    const result = evaluateWord('basically', []);
    expect(result.isFiller).toBe(true);
  });

  it('detects "literally" as a filler word', () => {
    expect(evaluateWord('literally', []).isFiller).toBe(true);
  });

  it('detects "actually" as a filler word', () => {
    expect(evaluateWord('actually', []).isFiller).toBe(true);
  });

  it('detects "um" as a filler word', () => {
    expect(evaluateWord('um', []).isFiller).toBe(true);
  });

  it('filler word tensionDelta is negative (penalises player)', () => {
    const result = evaluateWord('like', []);
    expect(result.tensionDelta).toBeLessThan(0);
  });

  it('filler word feedback contains "Cognitive Freeze"', () => {
    const result = evaluateWord('like', []);
    expect(result.feedback).toContain('Freeze');
  });

  it('isFillerWord() utility returns correct boolean', () => {
    expect(isFillerWord('like')).toBe(true);
    expect(isFillerWord('ephemeral')).toBe(false);
    expect(isFillerWord('')).toBe(false);
  });
});

describe('LexicalWeight Engine — Utility Functions', () => {
  it('getCEFRWeight returns correct weight for each tier', () => {
    expect(getCEFRWeight('A1')).toBe(10);
    expect(getCEFRWeight('A2')).toBe(25);
    expect(getCEFRWeight('B1')).toBe(80);
    expect(getCEFRWeight('B2')).toBe(150);
    expect(getCEFRWeight('C1')).toBe(300);
    expect(getCEFRWeight('C2')).toBe(500);
  });

  it('getCEFRWeight returns UNKNOWN_WORD_WEIGHT for unknown tier', () => {
    expect(getCEFRWeight('Z9')).toBe(UNKNOWN_WORD_WEIGHT);
  });

  it('rankByWeight sorts results by weight descending', () => {
    const results = [
      evaluateWord('begin', []),    // A1 = 10
      evaluateWord('ephemeral', []), // C1 = 300
      evaluateWord('solipsism', []), // C2 = 500
    ];
    const ranked = rankByWeight(results);
    expect(ranked[0].tier).toBe('C2');
    expect(ranked[1].tier).toBe('C1');
    expect(ranked[2].tier).toBe('A1');
  });

  it('totalPullWeight sums all weights including negatives', () => {
    const results = [
      evaluateWord('solipsism', []),  // 500
      evaluateWord('like', []),       // -50 (filler)
      evaluateWord('begin', []),      // 10
    ];
    const total = totalPullWeight(results);
    expect(total).toBe(500 + FILLER_PENALTY + 10);
  });

  it('evaluateWord handles null/undefined input gracefully', () => {
    expect(() => evaluateWord(null, [])).not.toThrow();
    expect(() => evaluateWord(undefined, [])).not.toThrow();
    expect(() => evaluateWord('', [])).not.toThrow();
  });
});
