/**
 * drill.js — Vocabulary Drill Room & Weak Words Queue
 * Decipher Language Learning Platform
 *
 * Implements:
 * - Dedicated WeakWordsQueue for tracking vocabulary recall struggles
 * - Adaptive failure rate and mastery score calculation
 * - Historical failure analytics and error pattern classification (spelling vs confusion)
 * - Browser localStorage persistence with MemoryStorage fallback
 */

export class MemoryStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

/**
 * Calculates Levenshtein edit distance between two strings (bounded to max 50 chars).
 */
export function levenshteinDistance(a, b) {
  const s1 = String(a || '').slice(0, 50).toLowerCase();
  const s2 = String(b || '').slice(0, 50).toLowerCase();
  const m = s1.length;
  const n = s2.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // deletion
        dp[i][j - 1] + 1,      // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }
  return dp[m][n];
}

export class WeakWordsQueue {
  constructor(options = {}) {
    this.storageKey = options.storageKey || 'decipher_weak_words';
    const hasLocalStorage = typeof localStorage !== 'undefined' &&
                            localStorage !== null &&
                            typeof localStorage.getItem === 'function' &&
                            typeof localStorage.setItem === 'function';
    this.storage = options.storage || (hasLocalStorage ? localStorage : new MemoryStorage());
    this.failureThreshold = typeof options.failureThreshold === 'number' ? options.failureThreshold : 0.4;
    this.masteryThreshold = typeof options.masteryThreshold === 'number' ? options.masteryThreshold : 80;
    this.requiredConsecutive = typeof options.requiredConsecutive === 'number' ? options.requiredConsecutive : 3;
    this.maxHistory = typeof options.maxHistory === 'number' ? options.maxHistory : 20;
    this.words = new Map();
    this.load();
  }

  load() {
    try {
      const raw = this.storage.getItem(this.storageKey);
      if (!raw) {
        this.words.clear();
        return [];
      }
      const parsed = JSON.parse(raw);
      this.words.clear();
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && (item.id || item.term || item.word)) {
            const id = String(item.id || item.term || item.word).trim().toLowerCase();
            this.words.set(id, item);
          }
        }
      }
      return Array.from(this.words.values());
    } catch {
      this.words.clear();
      return [];
    }
  }

  save() {
    try {
      const list = Array.from(this.words.values());
      this.storage.setItem(this.storageKey, JSON.stringify(list));
      return list;
    } catch (e) {
      console.warn('[WeakWordsQueue] Save failed:', e);
      return Array.from(this.words.values());
    }
  }

  addWord(wordInput) {
    if (!wordInput) return null;
    const term = typeof wordInput === 'string' ? wordInput.trim() : String(wordInput.term || wordInput.word || wordInput.id || '').trim();
    if (!term) return null;

    const id = term.toLowerCase();
    const existing = this.words.get(id);
    const nowIso = new Date().toISOString();

    if (existing) {
      const updated = {
        ...existing,
        term: existing.term || term,
        definition: (typeof wordInput === 'object' && wordInput.definition) || (typeof wordInput === 'object' && wordInput.def) || existing.definition || '',
        phonetic: (typeof wordInput === 'object' && wordInput.phonetic) || existing.phonetic || '',
        example: (typeof wordInput === 'object' && wordInput.example) || (typeof wordInput === 'object' && wordInput.context) || existing.example || '',
        translation: (typeof wordInput === 'object' && wordInput.translation) || existing.translation || ''
      };
      this.words.set(id, updated);
      this.save();
      return updated;
    }

    const newRecord = {
      id: id,
      term: term,
      word: term,
      definition: (typeof wordInput === 'object' && (wordInput.definition || wordInput.def)) || '',
      phonetic: (typeof wordInput === 'object' && wordInput.phonetic) || '',
      example: (typeof wordInput === 'object' && (wordInput.example || wordInput.context)) || '',
      translation: (typeof wordInput === 'object' && wordInput.translation) || '',
      addedAt: nowIso,
      lastAttempt: null,
      lastFailed: null,
      attempts: 0,
      successes: 0,
      failures: 0,
      failureRate: 0,
      consecutiveSuccesses: 0,
      masteryScore: 0,
      isMastered: false,
      history: []
    };

    this.words.set(id, newRecord);
    this.save();
    return newRecord;
  }

  classifyError(targetTerm, response) {
    const rawResp = String(response || '').trim();
    if (!rawResp) return 'empty';
    const target = String(targetTerm || '').trim().toLowerCase();
    const resp = rawResp.toLowerCase();

    if (target === resp) return 'none';
    const dist = levenshteinDistance(target, resp);
    if (dist <= 2 || (target.length > 3 && (resp.startsWith(target.slice(0, 3)) || resp.endsWith(target.slice(-3))))) {
      return 'spelling';
    }
    if (Math.abs(target.length - resp.length) > 3 || !/^[a-zA-Z\s-]+$/.test(resp)) {
      return 'confusion';
    }
    return 'other';
  }

  recordAttempt(wordIdOrData, success, userResponse = '', metadata = {}) {
    if (!wordIdOrData) return null;
    const term = typeof wordIdOrData === 'string' ? wordIdOrData.trim() : String(wordIdOrData.term || wordIdOrData.word || wordIdOrData.id || '').trim();
    if (!term) return null;

    const id = term.toLowerCase();
    let word = this.words.get(id);
    if (!word) {
      word = this.addWord(wordIdOrData);
    }

    const isSuccess = Boolean(success);
    const nowIso = new Date().toISOString();
    word.attempts = (word.attempts || 0) + 1;

    if (isSuccess) {
      word.successes = (word.successes || 0) + 1;
      word.consecutiveSuccesses = (word.consecutiveSuccesses || 0) + 1;
    } else {
      word.failures = (word.failures || 0) + 1;
      word.consecutiveSuccesses = 0;
      word.lastFailed = nowIso;
    }

    word.failureRate = word.attempts > 0 ? parseFloat((word.failures / word.attempts).toFixed(2)) : 0;

    // Adaptive Mastery Score calculation: 70% accuracy weight + 30% consecutive streak bonus
    const accuracy = Math.round((word.successes / word.attempts) * 70);
    const streakBonus = Math.min(30, word.consecutiveSuccesses * 10);
    word.masteryScore = Math.min(100, Math.max(0, accuracy + streakBonus));

    // Graduation threshold
    if (word.consecutiveSuccesses >= this.requiredConsecutive && word.masteryScore >= this.masteryThreshold) {
      word.isMastered = true;
    } else if (!isSuccess) {
      word.isMastered = false;
    }

    const errorType = isSuccess ? 'none' : this.classifyError(word.term, userResponse);
    const historyEntry = {
      timestamp: nowIso,
      success: isSuccess,
      userResponse: String(userResponse || ''),
      errorType: errorType,
      latencyMs: typeof metadata.latencyMs === 'number' ? metadata.latencyMs : null
    };

    if (!Array.isArray(word.history)) word.history = [];
    word.history.push(historyEntry);
    if (word.history.length > this.maxHistory) {
      word.history.shift();
    }

    word.lastAttempt = nowIso;
    this.words.set(id, word);
    this.save();
    return word;
  }

  getWeakWords(threshold = this.failureThreshold) {
    const list = Array.from(this.words.values());
    return list
      .filter(w => !w.isMastered && (w.failureRate >= threshold || (w.attempts >= 1 && w.failures > 0)))
      .sort((a, b) => {
        // Priority: higher failure rate first, then lower mastery, then most recent failure
        if (b.failureRate !== a.failureRate) return b.failureRate - a.failureRate;
        if (a.masteryScore !== b.masteryScore) return a.masteryScore - b.masteryScore;
        const bFail = b.lastFailed ? new Date(b.lastFailed).getTime() : 0;
        const aFail = a.lastFailed ? new Date(a.lastFailed).getTime() : 0;
        return bFail - aFail;
      });
  }

  getMasteredWords() {
    return Array.from(this.words.values()).filter(w => w.isMastered === true);
  }

  getWord(wordId) {
    if (!wordId) return null;
    return this.words.get(String(wordId).trim().toLowerCase()) || null;
  }

  removeWord(wordId) {
    if (!wordId) return false;
    const deleted = this.words.delete(String(wordId).trim().toLowerCase());
    if (deleted) this.save();
    return deleted;
  }

  getQueue(options = {}) {
    const limit = typeof options.limit === 'number' ? options.limit : 10;
    const includeMastered = Boolean(options.includeMastered);
    const threshold = typeof options.threshold === 'number' ? options.threshold : this.failureThreshold;

    let pool = includeMastered ? Array.from(this.words.values()) : this.getWeakWords(threshold);
    return pool.slice(0, limit);
  }

  getFailureAnalytics() {
    const list = Array.from(this.words.values());
    let totalAttempts = 0;
    let totalSuccesses = 0;
    let totalFailures = 0;
    let masteredCount = 0;
    let totalMastery = 0;

    const errorCounts = { spelling: 0, empty: 0, confusion: 0, other: 0 };
    let totalLoggedErrors = 0;

    for (const w of list) {
      totalAttempts += (w.attempts || 0);
      totalSuccesses += (w.successes || 0);
      totalFailures += (w.failures || 0);
      totalMastery += (w.masteryScore || 0);
      if (w.isMastered) masteredCount++;

      if (Array.isArray(w.history)) {
        for (const h of w.history) {
          if (!h.success && h.errorType && h.errorType !== 'none') {
            totalLoggedErrors++;
            if (errorCounts[h.errorType] !== undefined) {
              errorCounts[h.errorType]++;
            } else {
              errorCounts.other++;
            }
          }
        }
      }
    }

    const overallFailureRate = totalAttempts > 0 ? parseFloat((totalFailures / totalAttempts).toFixed(2)) : 0;
    const averageMastery = list.length > 0 ? Math.round(totalMastery / list.length) : 0;
    const activeWeakWords = this.getWeakWords();

    const mostFailedWords = [...list]
      .filter(w => (w.failures || 0) > 0)
      .sort((a, b) => (b.failures || 0) - (a.failures || 0))
      .slice(0, 5)
      .map(w => ({
        term: w.term,
        failures: w.failures,
        attempts: w.attempts,
        failureRate: w.failureRate,
        masteryScore: w.masteryScore
      }));

    return {
      totalTracked: list.length,
      totalAttempts,
      totalSuccesses,
      totalFailures,
      overallFailureRate,
      activeWeakCount: activeWeakWords.length,
      masteredCount,
      averageMastery,
      mostFailedWords,
      commonErrorPatterns: {
        counts: errorCounts,
        percentages: {
          spelling: totalLoggedErrors > 0 ? Math.round((errorCounts.spelling / totalLoggedErrors) * 100) : 0,
          empty: totalLoggedErrors > 0 ? Math.round((errorCounts.empty / totalLoggedErrors) * 100) : 0,
          confusion: totalLoggedErrors > 0 ? Math.round((errorCounts.confusion / totalLoggedErrors) * 100) : 0,
          other: totalLoggedErrors > 0 ? Math.round((errorCounts.other / totalLoggedErrors) * 100) : 0
        },
        totalLoggedErrors
      }
    };
  }

  clear() {
    this.words.clear();
    try {
      this.storage.removeItem(this.storageKey);
    } catch {}
  }
}

function escapeHTML(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Renders the interactive drill practice card into container.
 * @param {HTMLElement|string} container - Parent element or selector
 * @param {Object} word - Weak word record
 * @param {Function} [onAnswer] - Callback invoked on attempt: onAnswer({ success, userResponse, latencyMs })
 * @param {Object} [options={}] - Custom configuration
 */
export function renderDrillCard(container, word, onAnswer, options = {}) {
  const root = typeof container === 'string' ? document.querySelector(container) : container;
  if (!root) return;

  if (!word) {
    root.innerHTML = `
      <div class="drill-empty-state">
        <div class="drill-empty-icon">🎯</div>
        <h4 class="drill-empty-title">Drill Queue Cleared!</h4>
        <p class="drill-empty-desc">You have no active weak words needing practice. Great job maintaining your retention!</p>
        <button class="btn-primary drill-refresh-btn" id="drillCloseEmptyBtn">Done</button>
      </div>
    `;
    root.querySelector('#drillCloseEmptyBtn')?.addEventListener('click', () => {
      root.style.display = 'none';
      if (typeof options.onClose === 'function') options.onClose();
    });
    return;
  }

  const startTime = Date.now();
  const term = word.term || word.word || '';
  const phonetic = word.phonetic ? `/${word.phonetic}/` : '';
  const definition = word.definition || word.def || '';
  const example = word.example || word.context || '';
  const failureRatePct = Math.round((word.failureRate || 0) * 100);
  const masteryScore = typeof word.masteryScore === 'number' ? word.masteryScore : 0;
  const streak = word.consecutiveSuccesses || 0;

  // Mask target word inside example sentence for cloze drill
  let clozeHtml = '';
  if (example) {
    const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\b`, 'gi');
    if (regex.test(example)) {
      clozeHtml = escapeHTML(example).replace(new RegExp(term, 'gi'), '<span class="drill-cloze-blank">______</span>');
    } else {
      clozeHtml = `<span class="drill-cloze-blank">______</span> — ${escapeHTML(definition)}`;
    }
  } else {
    clozeHtml = `<span class="drill-cloze-blank">______</span> — ${escapeHTML(definition)}`;
  }

  root.innerHTML = `
    <div class="drill-card" data-word="${escapeHTML(term)}">
      <div class="drill-card-header">
        <div class="drill-header-left">
          <span class="drill-tag">🎯 DRILL ROOM</span>
          <span class="drill-badge-weak">⚠️ ${failureRatePct}% Fail Rate</span>
          ${streak > 0 ? `<span class="drill-badge-streak">🔥 Streak: ${streak}</span>` : ''}
        </div>
        <div class="drill-header-right">
          <div class="drill-mastery-wrap" title="Mastery Score: ${masteryScore}%">
            <span class="drill-mastery-label">Mastery: ${masteryScore}%</span>
            <div class="drill-progress-track">
              <div class="drill-progress-bar" style="width: ${masteryScore}%;"></div>
            </div>
          </div>
          <button class="drill-close-btn" id="drillCardCloseBtn" title="Close Drill Room">✕</button>
        </div>
      </div>

      <div class="drill-card-body">
        <div class="drill-term-row">
          <h3 class="drill-term">${escapeHTML(term)}</h3>
          ${phonetic ? `<span class="drill-phonetic">${escapeHTML(phonetic)}</span>` : ''}
          <button class="drill-audio-btn" id="drillAudioBtn" title="Listen to pronunciation">🔊</button>
        </div>

        <div class="drill-cloze-box">
          <p class="drill-cloze-sentence">${clozeHtml}</p>
          <p class="drill-hint-text" id="drillHintText" style="display:none;"></p>
        </div>

        <div class="drill-input-row" id="drillInputRow">
          <input type="text" id="drillAnswerInput" class="drill-input" placeholder="Type the word to practice..." autocomplete="off" spellcheck="false" autofocus>
          <button id="drillSubmitBtn" class="btn-primary drill-btn-submit">Check</button>
          <button id="drillHintBtn" class="btn-secondary drill-btn-hint" title="Reveal hint">💡 Hint</button>
          <button id="drillRevealBtn" class="btn-ghost drill-btn-reveal" title="Show answer">Reveal</button>
        </div>

        <div id="drillFeedback" class="drill-feedback" style="display:none;"></div>
      </div>

      <div class="drill-card-footer">
        <div class="drill-shortcuts-hint">
          <kbd>Enter</kbd> Check · <kbd>Esc</kbd> Exit
        </div>
        <div class="drill-footer-actions">
          <button id="drillSkipBtn" class="btn-ghost btn-sm">Skip →</button>
        </div>
      </div>
    </div>
  `;

  const inputEl = root.querySelector('#drillAnswerInput');
  const submitBtn = root.querySelector('#drillSubmitBtn');
  const hintBtn = root.querySelector('#drillHintBtn');
  const revealBtn = root.querySelector('#drillRevealBtn');
  const audioBtn = root.querySelector('#drillAudioBtn');
  const closeBtn = root.querySelector('#drillCardCloseBtn');
  const skipBtn = root.querySelector('#drillSkipBtn');
  const feedbackEl = root.querySelector('#drillFeedback');
  const hintTextEl = root.querySelector('#drillHintText');

  let hintCount = 0;
  let answered = false;

  function handleCheck() {
    if (answered) return;
    const userVal = inputEl.value.trim();
    if (!userVal) return;

    answered = true;
    const latencyMs = Date.now() - startTime;
    const isCorrect = userVal.toLowerCase() === term.toLowerCase();

    inputEl.disabled = true;
    submitBtn.style.display = 'none';
    hintBtn.style.display = 'none';
    revealBtn.style.display = 'none';

    feedbackEl.style.display = 'block';
    if (isCorrect) {
      feedbackEl.className = 'drill-feedback drill-feedback-success';
      const streakAfter = streak + 1;
      const isGraduated = streakAfter >= 3 && (masteryScore + 15 >= 80);
      feedbackEl.innerHTML = `
        <strong>✅ Correct!</strong> Recall validated (+15% Mastery).
        ${isGraduated ? `<div class="drill-mastered-banner">🎉 Word Mastered! Graduated from Weak Words queue!</div>` : ''}
        <button id="drillNextBtn" class="btn-primary" style="margin-top:10px;">Next Word →</button>
      `;
      if (isGraduated && typeof window.triggerCelebrationConfetti === 'function') {
        window.triggerCelebrationConfetti();
      }
    } else {
      feedbackEl.className = 'drill-feedback drill-feedback-error';
      feedbackEl.innerHTML = `
        <strong>❌ Not quite.</strong> The correct word is <strong>${escapeHTML(term)}</strong>.<br>
        <span style="opacity:0.9;">Meaning: ${escapeHTML(definition)}</span>
        <button id="drillNextBtn" class="btn-secondary" style="margin-top:10px;">Next Word →</button>
      `;
    }

    if (typeof onAnswer === 'function') {
      onAnswer({ success: isCorrect, userResponse: userVal, latencyMs });
    }

    root.querySelector('#drillNextBtn')?.addEventListener('click', () => {
      if (typeof options.onNext === 'function') options.onNext();
    });
  }

  submitBtn?.addEventListener('click', handleCheck);
  inputEl?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleCheck();
    if (e.key === 'Escape') closeBtn?.click();
  });

  hintBtn?.addEventListener('click', () => {
    hintCount++;
    hintTextEl.style.display = 'block';
    if (hintCount === 1) {
      hintTextEl.textContent = `💡 Hint: Starts with "${term[0].toUpperCase()}", ${term.length} letters long.`;
    } else {
      hintTextEl.textContent = `💡 Meaning: ${definition}`;
    }
  });

  revealBtn?.addEventListener('click', () => {
    inputEl.value = term;
    handleCheck();
  });

  audioBtn?.addEventListener('click', () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const utter = new SpeechSynthesisUtterance(term);
      utter.lang = 'en-US';
      utter.rate = 0.9;
      window.speechSynthesis.speak(utter);
    }
  });

  closeBtn?.addEventListener('click', () => {
    root.style.display = 'none';
    if (typeof options.onClose === 'function') options.onClose();
  });

  skipBtn?.addEventListener('click', () => {
    if (typeof options.onNext === 'function') options.onNext();
  });
}

/**
 * Initializes Drill Room UI within Studio View.
 */
export function initDrillRoom(options = {}) {
  if (typeof document === 'undefined') return;

  const queue = options.queue || new WeakWordsQueue();
  const drillBtn = document.getElementById('drillRoomBtn');
  const badgeEl = document.getElementById('weakWordsBadge');
  const cardContainer = document.getElementById('drillRoomCard');
  if (!drillBtn || !cardContainer) return;

  let currentIndex = 0;

  function updateBadge() {
    const weakList = queue.getWeakWords();
    const count = weakList.length;
    if (badgeEl) badgeEl.textContent = count;
    drillBtn.style.display = count > 0 ? 'inline-flex' : 'none';
    drillBtn.disabled = count === 0;
  }

  function showCurrentWord() {
    const weakList = queue.getWeakWords();
    if (weakList.length === 0) {
      renderDrillCard(cardContainer, null, null, {
        onClose: () => {
          cardContainer.style.display = 'none';
          updateBadge();
        }
      });
      return;
    }

    if (currentIndex >= weakList.length) currentIndex = 0;
    const currentWord = weakList[currentIndex];

    renderDrillCard(cardContainer, currentWord, (result) => {
      queue.recordAttempt(currentWord, result.success, result.userResponse, { latencyMs: result.latencyMs });
      updateBadge();
    }, {
      onNext: () => {
        currentIndex++;
        showCurrentWord();
      },
      onClose: () => {
        cardContainer.style.display = 'none';
        updateBadge();
      }
    });
  }

  drillBtn.addEventListener('click', () => {
    if (cardContainer.style.display === 'none' || !cardContainer.style.display) {
      cardContainer.style.display = 'block';
      currentIndex = 0;
      showCurrentWord();
      cardContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      cardContainer.style.display = 'none';
    }
  });

  // Global listener: Record word failure from quizzes or flashcards
  window.addEventListener('decipher:word-failed', (e) => {
    if (e.detail) {
      queue.recordAttempt(e.detail.word || e.detail, false, e.detail.userResponse || '');
      updateBadge();
    }
  });

  updateBadge();
  return { queue, updateBadge, showCurrentWord };
}

// Auto-initialize Drill Room when loaded in browser
if (typeof window !== 'undefined') {
  window.WeakWordsQueue = WeakWordsQueue;
  window.renderDrillCard = renderDrillCard;
  window.initDrillRoom = initDrillRoom;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initDrillRoom());
  } else {
    initDrillRoom();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    MemoryStorage,
    levenshteinDistance,
    WeakWordsQueue,
    renderDrillCard,
    initDrillRoom
  };
}
