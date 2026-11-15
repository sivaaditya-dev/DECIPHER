'use strict';
/**
 * arena-elo.test.js — Unit Tests for modules/arena/elo.js
 * Decipher Language Learning Platform
 *
 * Pattern: vm.createContext() sandbox with CommonJS wrappers
 * (matches existing arena test pattern — no ESM imports in Jest)
 *
 * Coverage:
 *   - DEFAULT_ELO constant
 *   - getKFactor: boundary conditions and normal cases
 *   - getExpectedScore: logistic curve math
 *   - calculateElo: win/loss/draw outcomes, floor at 0, rounding
 *   - getTier: all six tier boundaries (edge values)
 *   - getTierInfo: metadata including nextTier and pointsToNext
 *   - getTierIcon: all tier icons
 *   - Invalid input handling
 */

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

// ── Load module via vm sandbox ───────────────────────────────────────────────

const rawCode = fs.readFileSync(
  path.resolve(__dirname, '../modules/arena/elo.js'), 'utf8'
).replace(/^export\s+/gm, '');

const wrappedCode = `(function() {
  ${rawCode}
  return { DEFAULT_ELO, TIERS, getKFactor, getExpectedScore, calculateElo, getTier, getTierInfo, getTierIcon };
})()`;

const sandbox = { Math, console, Infinity, NaN, isNaN };
vm.createContext(sandbox);
const {
  DEFAULT_ELO, TIERS, getKFactor, getExpectedScore, calculateElo, getTier, getTierInfo, getTierIcon
} = vm.runInContext(wrappedCode, sandbox);

// ── Tests ────────────────────────────────────────────────────────────────────

describe('elo.js — DEFAULT_ELO', () => {
  test('DEFAULT_ELO is 1200', () => {
    expect(DEFAULT_ELO).toBe(1200);
  });
});

describe('elo.js — TIERS', () => {
  test('has exactly 6 tiers', () => {
    expect(TIERS).toHaveLength(6);
  });

  test('tier names are correct', () => {
    const names = TIERS.map(t => t.name);
    expect(names).toEqual(['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Grandmaster']);
  });

  test('tiers are contiguous (each min = previous max + 1)', () => {
    for (let i = 1; i < TIERS.length; i++) {
      expect(TIERS[i].min).toBe(TIERS[i - 1].max + 1);
    }
  });

  test('first tier starts at 0', () => {
    expect(TIERS[0].min).toBe(0);
  });
});

describe('elo.js — getKFactor', () => {
  test('returns 32 for rating 0', () => {
    expect(getKFactor(0)).toBe(32);
  });

  test('returns 32 for rating 1200', () => {
    expect(getKFactor(1200)).toBe(32);
  });

  test('returns 32 for rating 2099', () => {
    expect(getKFactor(2099)).toBe(32);
  });

  test('returns 16 for rating exactly 2100', () => {
    expect(getKFactor(2100)).toBe(16);
  });

  test('returns 16 for rating 3000', () => {
    expect(getKFactor(3000)).toBe(16);
  });

  test('returns 32 for NaN (graceful fallback)', () => {
    expect(getKFactor(NaN)).toBe(32);
  });

  test('returns 32 for non-number input (graceful fallback)', () => {
    expect(getKFactor('high')).toBe(32);
  });
});

describe('elo.js — getExpectedScore', () => {
  test('equal ratings → expected score is 0.5', () => {
    expect(getExpectedScore(1200, 1200)).toBeCloseTo(0.5, 5);
  });

  test('400-point advantage → expected ≈ 0.909', () => {
    expect(getExpectedScore(1600, 1200)).toBeCloseTo(1 / (1 + Math.pow(10, -400 / 400)), 5);
  });

  test('400-point deficit → expected ≈ 0.0909', () => {
    expect(getExpectedScore(1200, 1600)).toBeCloseTo(1 / (1 + Math.pow(10, 400 / 400)), 5);
  });

  test('expected scores for A and B always sum to 1.0', () => {
    const eA = getExpectedScore(1800, 1400);
    const eB = getExpectedScore(1400, 1800);
    expect(eA + eB).toBeCloseTo(1.0, 10);
  });

  test('throws TypeError for non-number ratingA', () => {
    expect(() => getExpectedScore('x', 1200)).toThrow(/Ratings must be numbers/);
  });

  test('throws TypeError for non-number ratingB', () => {
    expect(() => getExpectedScore(1200, null)).toThrow(/Ratings must be numbers/);
  });});

describe('elo.js — calculateElo', () => {
  test('winner gains Elo, loser loses Elo (outcome = 1)', () => {
    const { deltaA, deltaB } = calculateElo(1200, 1200, 1);
    expect(deltaA).toBeGreaterThan(0);
    expect(deltaB).toBeLessThan(0);
  });

  test('loser gains negative Elo (outcome = 0)', () => {
    const { deltaA, deltaB } = calculateElo(1200, 1200, 0);
    expect(deltaA).toBeLessThan(0);
    expect(deltaB).toBeGreaterThan(0);
  });

  test('draw against equal: both deltas are ~0', () => {
    const { deltaA, deltaB } = calculateElo(1200, 1200, 0.5);
    expect(Math.abs(deltaA)).toBeLessThanOrEqual(1);
    expect(Math.abs(deltaB)).toBeLessThanOrEqual(1);
  });

  test('equal ratings K=32: winner gains 16, loser loses 16', () => {
    const { deltaA, deltaB } = calculateElo(1200, 1200, 1);
    expect(deltaA).toBe(16);
    expect(deltaB).toBe(-16);
  });

  test('newA + newB = ratingA + ratingB (zero-sum within rounding)', () => {
    const { newA, newB } = calculateElo(1500, 1300, 1);
    expect(Math.abs((newA + newB) - (1500 + 1300))).toBeLessThanOrEqual(2);
  });

  test('rating cannot drop below 0 (floor protection)', () => {
    const { newB } = calculateElo(3000, 0, 1);
    expect(newB).toBeGreaterThanOrEqual(0);
  });

  test('high-rated player (≥2100) uses K=16', () => {
    const { deltaA } = calculateElo(2200, 1200, 1);
    expect(Math.abs(deltaA)).toBeLessThanOrEqual(16);
  });

  test('throws TypeError for non-number ratingA', () => {
    expect(() => calculateElo('x', 1200, 1)).toThrow(/Ratings must be numbers/);
  });

  test('throws RangeError for invalid outcome', () => {
    expect(() => calculateElo(1200, 1200, 2)).toThrow(/Outcome must be/);
  });

  test('throws RangeError for negative outcome', () => {
    expect(() => calculateElo(1200, 1200, -1)).toThrow(/Outcome must be/);
  });});

describe('elo.js — getTier', () => {
  const cases = [
    [0,    'Bronze'],
    [999,  'Bronze'],
    [1199, 'Bronze'],
    [1200, 'Silver'],
    [1399, 'Silver'],
    [1400, 'Gold'],
    [1599, 'Gold'],
    [1600, 'Platinum'],
    [1799, 'Platinum'],
    [1800, 'Diamond'],
    [1999, 'Diamond'],
    [2000, 'Grandmaster'],
    [9999, 'Grandmaster'],
  ];

  test.each(cases)('rating %i → %s', (rating, expected) => {
    expect(getTier(rating)).toBe(expected);
  });

  test('NaN → Bronze (graceful fallback)', () => {
    expect(getTier(NaN)).toBe('Bronze');
  });

  test('negative rating → Bronze (clamped)', () => {
    expect(getTier(-100)).toBe('Bronze');
  });
});

describe('elo.js — getTierInfo', () => {
  test('1200 → Silver with correct nextTier', () => {
    const info = getTierInfo(1200);
    expect(info.name).toBe('Silver');
    expect(info.nextTier).toBe('Gold');
  });

  test('2000 → Grandmaster has null nextTier', () => {
    const info = getTierInfo(2000);
    expect(info.name).toBe('Grandmaster');
    expect(info.nextTier).toBeNull();
    expect(info.pointsToNext).toBeNull();
  });

  test('1400 → Gold pointsToNext = 200', () => {
    const info = getTierInfo(1400);
    expect(info.pointsToNext).toBe(200);
  });

  test('1500 → Gold pointsToNext = 100', () => {
    const info = getTierInfo(1500);
    expect(info.pointsToNext).toBe(100);
  });

  test('returns icon string for every tier', () => {
    [0, 1200, 1400, 1600, 1800, 2000].forEach(r => {
      const info = getTierInfo(r);
      expect(typeof info.icon).toBe('string');
      expect(info.icon.length).toBeGreaterThan(0);
    });
  });
});

describe('elo.js — getTierIcon', () => {
  test('Bronze → 🥉', () => { expect(getTierIcon('Bronze')).toBe('🥉'); });
  test('Silver → 🥈', () => { expect(getTierIcon('Silver')).toBe('🥈'); });
  test('Gold → 🥇', () => { expect(getTierIcon('Gold')).toBe('🥇'); });
  test('Platinum → 💎', () => { expect(getTierIcon('Platinum')).toBe('💎'); });
  test('Diamond → 💠', () => { expect(getTierIcon('Diamond')).toBe('💠'); });
  test('Grandmaster → 👑', () => { expect(getTierIcon('Grandmaster')).toBe('👑'); });
  test('unknown tier → 🥉 (fallback)', () => { expect(getTierIcon('Mythic')).toBe('🥉'); });
});
