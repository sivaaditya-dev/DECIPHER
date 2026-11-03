/**
 * analytics.js — Vocabulary Retention Curve & Learning Velocity Engine
 * Decipher Language Learning Platform
 *
 * Implements:
 * - Ebbinghaus forgetting curve: R(t) = exp(-t / S)
 * - Memory stability modeling based on SM-2 interval & ease factor
 * - Rolling 7-day learning velocity calculations and activity trend detection
 * - Vocabulary mastery categorization across 4 progressive tiers
 * - Aggregate deck retention health scoring
 */

export const DEFAULT_STABILITY = 5.0; // Baseline memory stability in days
export const MIN_STABILITY = 0.1;     // Lower bound to prevent division by zero
export const RETENTION_HORIZONS = [1, 3, 7, 14, 30]; // Time horizons in days

/**
 * Calculates retention probability at time elapsed t given memory stability S.
 * Formula: R(t) = exp(-t / S)
 *
 * @param {number} stability - Memory stability S in days (> 0)
 * @param {number} timeElapsedDays - Time elapsed t in days (>= 0)
 * @returns {number} Retention probability in range [0.0, 1.0] (rounded to 4 decimals)
 */
export function calculateRetention(stability, timeElapsedDays) {
  const t = Math.max(0, typeof timeElapsedDays === 'number' && !isNaN(timeElapsedDays) ? timeElapsedDays : 0);
  const s = Math.max(MIN_STABILITY, typeof stability === 'number' && !isNaN(stability) ? stability : DEFAULT_STABILITY);
  const r = Math.exp(-t / s);
  return parseFloat(Math.min(1.0, Math.max(0.0, r)).toFixed(4));
}

/**
 * Derives memory stability S (in days) from card SM-2 properties.
 *
 * @param {Object} card - Card object with interval, ef, repetitions
 * @returns {number} Stability in days
 */
export function calculateCardStability(card) {
  if (!card) return DEFAULT_STABILITY;
  const interval = typeof card.interval === 'number' && !isNaN(card.interval) ? Math.max(0, card.interval) : 0;
  const ef = typeof card.ef === 'number' && !isNaN(card.ef) ? Math.max(1.3, card.ef) : 2.5;
  const reps = typeof card.repetitions === 'number' && !isNaN(card.repetitions) ? card.repetitions : 0;

  if (reps === 0 || interval === 0) return 0.5; // Short-term acquisition phase
  return parseFloat(Math.max(1.0, interval * (ef / 2.5)).toFixed(2));
}

/**
 * Computes average predicted retention curve for a deck of cards across specified horizons.
 *
 * @param {Array<Object>} cards - Array of card objects
 * @param {Array<number>} [days=RETENTION_HORIZONS] - Days to evaluate
 * @returns {Array<{ day: number, retention: number, percentage: number }>}
 */
export function calculateRetentionCurve(cards = [], days = RETENTION_HORIZONS) {
  const cardList = Array.isArray(cards) ? cards : [];
  return days.map(d => {
    let avgR = 0;
    if (cardList.length === 0) {
      avgR = calculateRetention(DEFAULT_STABILITY, d);
    } else {
      const sum = cardList.reduce((acc, c) => acc + calculateRetention(calculateCardStability(c), d), 0);
      avgR = sum / cardList.length;
    }
    return {
      day: d,
      retention: parseFloat(avgR.toFixed(4)),
      percentage: Math.round(avgR * 100)
    };
  });
}

/**
 * Calculates rolling daily learning velocity across a designated time window.
 *
 * @param {Object|Array} reviewHistory - Date-to-count map or array of review records
 * @param {number} [windowDays=7] - Window length in days
 * @param {Date|string} [asOfDate=new Date()] - Reference date
 * @returns {Object} { velocity, totalReviews, windowDays, trend, dailyData }
 */
export function calculateLearningVelocity(reviewHistory, windowDays = 7, asOfDate = new Date()) {
  const win = Math.max(1, typeof windowDays === 'number' && !isNaN(windowDays) ? windowDays : 7);
  const refDate = asOfDate instanceof Date ? asOfDate : new Date(asOfDate);
  const dailyData = [];

  const historyMap = new Map();
  if (Array.isArray(reviewHistory)) {
    reviewHistory.forEach(item => {
      if (item && item.date) {
        const key = item.date.slice(0, 10);
        const count = typeof item.count === 'number' ? item.count : 1;
        historyMap.set(key, (historyMap.get(key) || 0) + count);
      }
    });
  } else if (reviewHistory && typeof reviewHistory === 'object') {
    Object.entries(reviewHistory).forEach(([dateStr, val]) => {
      const key = dateStr.slice(0, 10);
      const count = typeof val === 'number' ? val : (Array.isArray(val) ? val.length : 1);
      historyMap.set(key, (historyMap.get(key) || 0) + count);
    });
  }

  let totalReviews = 0;
  const half = Math.floor(win / 2);
  let firstHalfSum = 0;
  let secondHalfSum = 0;

  for (let i = win - 1; i >= 0; i--) {
    const d = new Date(refDate.getTime() - i * 86400000);
    const dateStr = d.toISOString().slice(0, 10);
    const count = historyMap.get(dateStr) || 0;
    dailyData.push({ date: dateStr, count });
    totalReviews += count;

    if (i >= half) firstHalfSum += count;
    else secondHalfSum += count;
  }

  const velocity = parseFloat((totalReviews / win).toFixed(2));
  let trend = 'steady';
  if (secondHalfSum > firstHalfSum * 1.2 && secondHalfSum >= 3) trend = 'accelerating';
  else if (firstHalfSum > secondHalfSum * 1.2 && firstHalfSum >= 3) trend = 'declining';

  return { velocity, totalReviews, windowDays: win, trend, dailyData };
}

/**
 * Categorizes deck cards into 4 mastery tiers based on scheduled interval.
 *
 * @param {Array<Object>} cards - Deck cards
 * @returns {Object} { tiers, counts, percentages }
 */
export function categorizeMastery(cards = []) {
  const cardList = Array.isArray(cards) ? cards : [];
  const tiers = { mastered: [], reviewing: [], learning: [], weak: [] };

  cardList.forEach(card => {
    if (!card) return;
    const interval = typeof card.interval === 'number' ? card.interval : 0;
    const reps = typeof card.repetitions === 'number' ? card.repetitions : 0;

    if (interval >= 21) tiers.mastered.push(card);
    else if (interval >= 6) tiers.reviewing.push(card);
    else if (interval >= 1 && reps > 0) tiers.learning.push(card);
    else tiers.weak.push(card);
  });

  const total = cardList.length;
  const counts = {
    mastered: tiers.mastered.length,
    reviewing: tiers.reviewing.length,
    learning: tiers.learning.length,
    weak: tiers.weak.length,
    total
  };

  const percentages = {
    mastered: total ? Math.round((counts.mastered / total) * 100) : 0,
    reviewing: total ? Math.round((counts.reviewing / total) * 100) : 0,
    learning: total ? Math.round((counts.learning / total) * 100) : 0,
    weak: total ? Math.round((counts.weak / total) * 100) : 0
  };

  return { tiers, counts, percentages };
}

/**
 * Calculates current aggregate deck retention health score based on elapsed review time.
 *
 * @param {Array<Object>} cards - Deck cards
 * @param {Date|string} [asOfDate=new Date()] - Reference date
 * @returns {number} Score from 0 to 100
 */
export function calculateDeckRetentionScore(cards = [], asOfDate = new Date()) {
  const cardList = Array.isArray(cards) ? cards : [];
  if (cardList.length === 0) return 100;

  const now = asOfDate instanceof Date ? asOfDate : new Date(asOfDate);
  let totalRetention = 0;

  cardList.forEach(card => {
    const stability = calculateCardStability(card);
    const lastRev = card.lastReviewed ? new Date(card.lastReviewed) : now;
    const elapsedDays = Math.max(0, (now.getTime() - lastRev.getTime()) / 86400000);
    totalRetention += calculateRetention(stability, elapsedDays);
  });

  return Math.round((totalRetention / cardList.length) * 100);
}

export function formatRetentionRate(rate) {
  return `${Math.round(rate * 100)}%`;
}

/**
 * Generates and mounts responsive inline SVG retention curve chart.
 *
 * @param {HTMLElement|Object} container - DOM container element
 * @param {Array} curveData - Data points from calculateRetentionCurve
 * @param {Object} [options={}] - Custom dimensions/labels
 * @returns {string} SVG HTML markup
 */
export function renderRetentionChart(container, curveData, options = {}) {
  const data = Array.isArray(curveData) && curveData.length > 0 ? curveData : calculateRetentionCurve([]);
  const width = options.width || 480;
  const height = options.height || 200;
  const pad = { top: 20, right: 25, bottom: 35, left: 45 };

  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;

  const maxDay = Math.max(...data.map(d => d.day), 30);
  const getX = day => pad.left + (Math.log(day) / Math.log(maxDay)) * chartW;
  const getY = r => pad.top + chartH * (1 - r);

  const points = data.map(d => ({ x: getX(d.day), y: getY(d.retention), day: d.day, pct: d.percentage }));
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaD = `${pathD} L ${points[points.length - 1].x.toFixed(1)} ${pad.top + chartH} L ${points[0].x.toFixed(1)} ${pad.top + chartH} Z`;

  const thresholdY = getY(0.85).toFixed(1);

  const svg = `
    <svg class="retention-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Ebbinghaus Vocabulary Retention Curve">
      <defs>
        <linearGradient id="retentionGradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#6366f1" stop-opacity="0.45"/>
          <stop offset="100%" stop-color="#6366f1" stop-opacity="0.02"/>
        </linearGradient>
      </defs>
      <!-- Grid Lines -->
      <line class="chart-grid-line" x1="${pad.left}" y1="${getY(1)}" x2="${width - pad.right}" y2="${getY(1)}" />
      <line class="chart-grid-line" x1="${pad.left}" y1="${getY(0.5)}" x2="${width - pad.right}" y2="${getY(0.5)}" />
      <line class="chart-grid-line" x1="${pad.left}" y1="${getY(0)}" x2="${width - pad.right}" y2="${getY(0)}" />

      <!-- Optimal Threshold (85%) -->
      <line class="chart-threshold-line" x1="${pad.left}" y1="${thresholdY}" x2="${width - pad.right}" y2="${thresholdY}" stroke="#f59e0b" stroke-dasharray="4,4" />
      <text class="chart-threshold-text" x="${width - pad.right}" y="${Number(thresholdY) - 5}" text-anchor="end">Optimal Review (85%)</text>

      <!-- Area & Curve -->
      <path class="chart-area-fill" d="${areaD}" fill="url(#retentionGradient)" />
      <path class="chart-curve-path" d="${pathD}" fill="none" stroke="#6366f1" stroke-width="3" stroke-linecap="round" />

      <!-- Data Points -->
      ${points.map(p => `
        <circle class="chart-point" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4.5" tabindex="0" role="button"
          aria-label="Day ${p.day}: ${p.pct}% retention" data-day="${p.day}" data-pct="${p.pct}">
          <title>Day ${p.day}: ${p.pct}% Retention</title>
        </circle>
        <text class="chart-point-label" x="${p.x.toFixed(1)}" y="${Number(pad.top + chartH) + 18}" text-anchor="middle">D${p.day}</text>
      `).join('')}

      <!-- Y Axis Labels -->
      <text class="chart-axis-text" x="${pad.left - 8}" y="${getY(1) + 4}" text-anchor="end">100%</text>
      <text class="chart-axis-text" x="${pad.left - 8}" y="${getY(0.5) + 4}" text-anchor="end">50%</text>
      <text class="chart-axis-text" x="${pad.left - 8}" y="${getY(0) + 4}" text-anchor="end">0%</text>
    </svg>
  `;

  if (container && typeof container.innerHTML !== 'undefined') {
    container.innerHTML = svg;
  }
  return svg;
}

/**
 * Generates and mounts Retention Breakdown tier card with progress bars.
 *
 * @param {HTMLElement|Object} container - DOM container element
 * @param {Array<Object>} cards - Deck cards
 * @returns {string} HTML markup
 */
export function renderRetentionBreakdown(container, cards = []) {
  const { counts, percentages } = categorizeMastery(cards);
  const healthScore = calculateDeckRetentionScore(cards);

  const markup = `
    <div class="retention-breakdown-card">
      <div class="breakdown-header">
        <h4 class="breakdown-title">🧠 Memory Retention Breakdown</h4>
        <span class="breakdown-score-badge">Deck Health: ${healthScore}%</span>
      </div>
      <div class="tier-list">
        <div class="tier-item tier-mastered">
          <div class="tier-info">
            <span class="tier-label">🏆 Mastered (≥21d)</span>
            <span class="tier-stat">${counts.mastered} cards (${percentages.mastered}%)</span>
          </div>
          <div class="tier-track"><div class="tier-fill tier-fill-mastered" style="width:${percentages.mastered}%"></div></div>
        </div>
        <div class="tier-item tier-reviewing">
          <div class="tier-info">
            <span class="tier-label">🔄 Reviewing (6–20d)</span>
            <span class="tier-stat">${counts.reviewing} cards (${percentages.reviewing}%)</span>
          </div>
          <div class="tier-track"><div class="tier-fill tier-fill-reviewing" style="width:${percentages.reviewing}%"></div></div>
        </div>
        <div class="tier-item tier-learning">
          <div class="tier-info">
            <span class="tier-label">📖 Learning (1–5d)</span>
            <span class="tier-stat">${counts.learning} cards (${percentages.learning}%)</span>
          </div>
          <div class="tier-track"><div class="tier-fill tier-fill-learning" style="width:${percentages.learning}%"></div></div>
        </div>
        <div class="tier-item tier-weak">
          <div class="tier-info">
            <span class="tier-label">⚠️ Needs Practice (&lt;1d)</span>
            <span class="tier-stat">${counts.weak} cards (${percentages.weak}%)</span>
          </div>
          <div class="tier-track"><div class="tier-fill tier-fill-weak" style="width:${percentages.weak}%"></div></div>
        </div>
      </div>
    </div>
  `;

  if (container && typeof container.innerHTML !== 'undefined') {
    container.innerHTML = markup;
  }
  return markup;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
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
  };
}
