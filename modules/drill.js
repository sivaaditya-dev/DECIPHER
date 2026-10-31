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

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    MemoryStorage,
    levenshteinDistance,
    WeakWordsQueue
  };
}
