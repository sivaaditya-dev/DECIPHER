/**
 * tests/analytics.test.js
 * Unit test suite for Vocabulary Retention Analytics:
 * - Ebbinghaus retention curve decay formula: R(t) = exp(-t / S)
 * - Memory stability calibration based on SM-2 interval & ease factor
 * - Rolling daily learning velocity calculations and activity trend detection
 * - Vocabulary mastery tier categorization (Mastered, Reviewing, Learning, Weak)
 * - Deck aggregate retention health scoring
 * - Inline SVG chart and tier breakdown HTML generation
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

let analytics;

try {
  analytics = require('../modules/analytics.js');
} catch {
  const code = fs.readFileSync(path.resolve(__dirname, '../modules/analytics.js'), 'utf8');
  const clean = code.replace(/^export\s+/gm, '').replace(/export\s*\{[^}]*\};?/g, '');
  const wrapped = `(function() {\n${clean}\nreturn {
    DEFAULT_STABILITY,
    MIN_STABILITY,
    RETENTION_HORIZONS,
    calculateRetention,
    calculateCardStability,
    calculateRetentionCurve,
    calculateLearningVelocity,
    categorizeMastery,
    calculateDeckRetentionScore,
    formatRetentionRate,
    renderRetentionChart,
    renderRetentionBreakdown
  };\n})()`;
  const sandbox = {
    console, Date, Math, Array, Object, Number, RangeError, TypeError, Error, JSON, Map, String,
    parseInt, parseFloat, isNaN
  };
  vm.createContext(sandbox);
  analytics = vm.runInContext(wrapped, sandbox);
}

const {
  calculateRetention,
  calculateCardStability,
  calculateRetentionCurve,
  calculateLearningVelocity,
  categorizeMastery,
  calculateDeckRetentionScore,
  formatRetentionRate,
  renderRetentionChart,
  renderRetentionBreakdown
} = analytics;

describe('Retention Analytics Suite', () => {

  describe('1. Ebbinghaus Retention Curve Decay: R(t) = exp(-t / S)', () => {
    test('returns 1.0 (100% retention) at time t = 0', () => {
      expect(calculateRetention(10, 0)).toBe(1.0);
      expect(calculateRetention(5, 0)).toBe(1.0);
    });

    test('returns exp(-1) ≈ 0.3679 when elapsed time equals stability (t = S)', () => {
      const r = calculateRetention(7, 7);
      expect(r).toBeCloseTo(Math.exp(-1), 3);
    });

    test('demonstrates strict monotonic decay over increasing time horizons', () => {
      const stability = 10;
      const r1 = calculateRetention(stability, 1);
      const r3 = calculateRetention(stability, 3);
      const r7 = calculateRetention(stability, 7);
      const r14 = calculateRetention(stability, 14);
      const r30 = calculateRetention(stability, 30);

      expect(r1).toBeGreaterThan(r3);
      expect(r3).toBeGreaterThan(r7);
      expect(r7).toBeGreaterThan(r14);
      expect(r14).toBeGreaterThan(r30);
    });

    test('higher stability yields higher retention for a fixed time elapsed', () => {
      const t = 7;
      const rLow = calculateRetention(3, t);
      const rHigh = calculateRetention(14, t);
      expect(rHigh).toBeGreaterThan(rLow);
    });

    test('clamps negative elapsed time to 0 (yielding 1.0)', () => {
      expect(calculateRetention(10, -5)).toBe(1.0);
    });

    test('protects against division by zero with non-positive stability', () => {
      const rZero = calculateRetention(0, 5);
      const rNeg = calculateRetention(-10, 5);
      expect(rZero).toBeGreaterThanOrEqual(0.0);
      expect(rZero).toBeLessThanOrEqual(1.0);
      expect(rNeg).toBeGreaterThanOrEqual(0.0);
      expect(rNeg).toBeLessThanOrEqual(1.0);
    });
  });

  describe('2. Memory Stability Calibration (calculateCardStability)', () => {
    test('calculates stability proportional to interval and ease factor', () => {
      const card = { interval: 10, ef: 2.5, repetitions: 2 };
      const s = calculateCardStability(card);
      expect(s).toBe(10.0);
    });

    test('scales stability upward when ease factor exceeds default 2.5', () => {
      const card = { interval: 10, ef: 3.0, repetitions: 2 };
      const s = calculateCardStability(card);
      expect(s).toBe(12.0);
    });

    test('assigns short-term acquisition floor (0.5d) for unlearned cards (rep = 0)', () => {
      const card = { interval: 0, ef: 2.5, repetitions: 0 };
      expect(calculateCardStability(card)).toBe(0.5);
    });

    test('handles null and undefined card safely with default baseline', () => {
      expect(calculateCardStability(null)).toBe(5.0);
      expect(calculateCardStability({})).toBe(0.5);
    });
  });

  describe('3. Predicted Deck Retention Curve (calculateRetentionCurve)', () => {
    test('computes average predicted retention across default horizons [1, 3, 7, 14, 30]', () => {
      const deck = [
        { interval: 1, ef: 2.5, repetitions: 1 },
        { interval: 6, ef: 2.5, repetitions: 2 },
        { interval: 21, ef: 2.6, repetitions: 4 }
      ];
      const curve = calculateRetentionCurve(deck);
      expect(curve).toHaveLength(5);
      expect(curve[0].day).toBe(1);
      expect(curve[4].day).toBe(30);

      expect(curve[0].retention).toBeGreaterThan(curve[4].retention);
      curve.forEach(pt => {
        expect(pt.percentage).toBe(Math.round(pt.retention * 100));
      });
    });

    test('returns baseline curve on empty deck without error', () => {
      const curve = calculateRetentionCurve([]);
      expect(curve).toHaveLength(5);
      expect(curve[0].retention).toBeGreaterThan(0);
    });
  });

  describe('4. Rolling Daily Learning Velocity (calculateLearningVelocity)', () => {
    test('computes accurate velocity for steady daily study habits', () => {
      const ref = new Date('2026-11-03T12:00:00Z');
      const history = {
        '2026-11-03': 10,
        '2026-11-02': 10,
        '2026-11-01': 10,
        '2026-10-31': 10,
        '2026-10-30': 10,
        '2026-10-29': 10,
        '2026-10-28': 10
      };
      const result = calculateLearningVelocity(history, 7, ref);
      expect(result.velocity).toBe(10.0);
      expect(result.totalReviews).toBe(70);
      expect(result.windowDays).toBe(7);
      expect(result.dailyData).toHaveLength(7);
    });

    test('computes accurate velocity for burst study patterns', () => {
      const ref = new Date('2026-11-03T12:00:00Z');
      const history = {
        '2026-11-03': 70
      };
      const result = calculateLearningVelocity(history, 7, ref);
      expect(result.velocity).toBe(10.0);
      expect(result.totalReviews).toBe(70);
    });

    test('returns 0 velocity on empty review history', () => {
      const result = calculateLearningVelocity({}, 7);
      expect(result.velocity).toBe(0.0);
      expect(result.totalReviews).toBe(0);
    });

    test('identifies accelerating learning velocity trend', () => {
      const ref = new Date('2026-11-03T12:00:00Z');
      const history = {
        '2026-10-28': 1,
        '2026-10-29': 1,
        '2026-10-30': 1,
        '2026-10-31': 5,
        '2026-11-01': 10,
        '2026-11-02': 15,
        '2026-11-03': 20
      };
      const result = calculateLearningVelocity(history, 7, ref);
      expect(result.trend).toBe('accelerating');
    });

    test('supports array format review records', () => {
      const ref = new Date('2026-11-03T12:00:00Z');
      const history = [
        { date: '2026-11-03', count: 5 },
        { date: '2026-11-02', count: 5 }
      ];
      const result = calculateLearningVelocity(history, 7, ref);
      expect(result.totalReviews).toBe(10);
      expect(result.velocity).toBeCloseTo(1.43, 2);
    });
  });

  describe('5. Mastery Categorization (categorizeMastery)', () => {
    test('correctly partitions cards into Mastered, Reviewing, Learning, Weak', () => {
      const cards = [
        { id: 1, interval: 25, repetitions: 5 },
        { id: 2, interval: 21, repetitions: 4 },
        { id: 3, interval: 10, repetitions: 3 },
        { id: 4, interval: 6, repetitions: 2 },
        { id: 5, interval: 3, repetitions: 1 },
        { id: 6, interval: 0, repetitions: 0 }
      ];
      const { counts, percentages, tiers } = categorizeMastery(cards);

      expect(counts.mastered).toBe(2);
      expect(counts.reviewing).toBe(2);
      expect(counts.learning).toBe(1);
      expect(counts.weak).toBe(1);
      expect(counts.total).toBe(6);

      expect(percentages.mastered).toBe(33);
      expect(percentages.reviewing).toBe(33);
      expect(percentages.learning).toBe(17);
      expect(percentages.weak).toBe(17);

      expect(tiers.mastered.map(c => c.id)).toEqual([1, 2]);
      expect(tiers.weak.map(c => c.id)).toEqual([6]);
    });

    test('safely handles empty card deck', () => {
      const { counts, percentages } = categorizeMastery([]);
      expect(counts.total).toBe(0);
      expect(percentages.mastered).toBe(0);
    });
  });

  describe('6. Deck Retention Health Score (calculateDeckRetentionScore)', () => {
    test('returns 100 for empty deck', () => {
      expect(calculateDeckRetentionScore([])).toBe(100);
    });

    test('returns near 100% when all cards were reviewed today', () => {
      const now = new Date('2026-11-03T12:00:00Z');
      const deck = [
        { interval: 10, ef: 2.5, repetitions: 2, lastReviewed: now.toISOString() },
        { interval: 30, ef: 2.6, repetitions: 4, lastReviewed: now.toISOString() }
      ];
      const score = calculateDeckRetentionScore(deck, now);
      expect(score).toBe(100);
    });

    test('reflects decay when reviews are overdue', () => {
      const now = new Date('2026-11-03T12:00:00Z');
      const past = new Date('2026-10-01T12:00:00Z');
      const deck = [
        { interval: 1, ef: 2.5, repetitions: 1, lastReviewed: past.toISOString() }
      ];
      const score = calculateDeckRetentionScore(deck, now);
      expect(score).toBeLessThan(10);
    });
  });

  describe('7. SVG Chart & Breakdown UI Generation', () => {
    test('renderRetentionChart outputs valid SVG markup with path, circles, and labels', () => {
      const container = { innerHTML: '' };
      const svg = renderRetentionChart(container, calculateRetentionCurve([]));

      expect(svg).toContain('<svg class="retention-svg"');
      expect(svg).toContain('<path class="chart-curve-path"');
      expect(svg).toContain('Optimal Review');
      expect(container.innerHTML).toBe(svg);
    });

    test('renderRetentionBreakdown outputs tier cards and progress bars', () => {
      const container = { innerHTML: '' };
      const cards = [{ interval: 25, repetitions: 4 }];
      const html = renderRetentionBreakdown(container, cards);

      expect(html).toContain('Memory Retention Breakdown');
      expect(html).toContain('🏆 Mastered');
      expect(container.innerHTML).toBe(html);
    });

    test('formatRetentionRate formats decimal to rounded percentage', () => {
      expect(formatRetentionRate(0.854)).toBe('85%');
      expect(formatRetentionRate(1.0)).toBe('100%');
    });
  });
});
