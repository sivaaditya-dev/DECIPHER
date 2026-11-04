/**
 * api/gemini-resilience.js
 * Production Resilience and Exponential Backoff Retry Handler for Google Gemini 2.5 Flash API.
 * 
 * Commit 21: feat(api): add exponential backoff retry handler with jitter for Gemini API calls
 */

// ============================================================
// 1. RETRY CONFIGURATION & ERROR FILTERING
// ============================================================

const DEFAULT_RETRY_OPTIONS = {
  maxRetries: 3,
  initialDelayMs: 500,
  baseDelayMs: 500,
  factor: 2,
  maxDelayMs: 8000,
  randomFn: Math.random,
  sleepFn: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  onRetry: null
};

const NON_RETRYABLE_STATUSES = new Set([400, 401, 403, 404, 405, 422]);
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

/**
 * Determines whether an error encountered during a Gemini API call is retryable.
 * @param {Error|Object} error - Error object or API response error
 * @returns {boolean} True if error is transient and should be retried
 */
function isRetryableError(error) {
  if (!error) return false;

  // 1. Check HTTP status code
  const status = error.status ?? error.statusCode ?? error.response?.status ?? (error.cause && (error.cause.status ?? error.cause.statusCode));
  if (status !== undefined && status !== null) {
    const numStatus = Number(status);
    if (NON_RETRYABLE_STATUSES.has(numStatus)) return false;
    if (RETRYABLE_STATUSES.has(numStatus)) return true;
  }

  // 2. Check error codes and messages
  const code = String(error.code || '').toUpperCase();
  const message = String(error.message || '').toUpperCase();
  const details = String(error.details || '').toUpperCase();
  const combined = `${code} ${message} ${details}`;

  // Explicit non-retryable keywords (client errors, bad inputs)
  if (
    combined.includes('INVALID_ARGUMENT') ||
    combined.includes('PERMISSION_DENIED') ||
    combined.includes('UNAUTHENTICATED') ||
    combined.includes('NOT_FOUND') ||
    combined.includes('BAD REQUEST') ||
    combined.includes('API_KEY_INVALID') ||
    combined.includes('API KEY NOT VALID')
  ) {
    if (!combined.includes('429') && !combined.includes('500') && !combined.includes('503') && !combined.includes('502') && !combined.includes('504')) {
      return false;
    }
  }

  // Explicit retryable patterns (rate limit, server down, network drop)
  const retryablePatterns = [
    'RESOURCE_EXHAUSTED',
    'UNAVAILABLE',
    'DEADLINE_EXCEEDED',
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'ECONNABORTED',
    'EAI_AGAIN',
    'SOCKETTIMEOUT',
    'FETCH_ERROR',
    'RATE_LIMIT',
    'RATELIMIT',
    'RATE LIMIT',
    'QUOTA',
    'OVERLOADED',
    'TOO MANY REQUESTS',
    'SERVICE UNAVAILABLE',
    'GATEWAY TIMEOUT',
    'BAD GATEWAY',
    '429',
    '500',
    '502',
    '503',
    '504'
  ];

  return retryablePatterns.some(pattern => combined.includes(pattern));
}

/**
 * Calculates exponential backoff delay with full jitter.
 * Formula: sleep = Math.random() * min(maxDelayMs, initialDelay * (factor ^ attempt))
 * @param {number} attempt - Current retry attempt index (0-based)
 * @param {Object} [options] - Configuration overrides
 * @returns {number} Backoff delay in milliseconds (integer)
 */
function calculateJitterDelay(attempt, options = {}) {
  const initialDelay = options.initialDelayMs ?? options.baseDelayMs ?? DEFAULT_RETRY_OPTIONS.initialDelayMs;
  const factor = options.factor ?? DEFAULT_RETRY_OPTIONS.factor;
  const maxDelayMs = options.maxDelayMs ?? DEFAULT_RETRY_OPTIONS.maxDelayMs;
  const randomFn = options.randomFn ?? DEFAULT_RETRY_OPTIONS.randomFn;

  const safeAttempt = Math.max(0, Number(attempt) || 0);
  const backoffCeiling = Math.min(maxDelayMs, initialDelay * Math.pow(factor, safeAttempt));
  
  const rand = typeof randomFn === 'function' ? randomFn() : Math.random();
  const clampedRand = Math.max(0, Math.min(1, typeof rand === 'number' && !isNaN(rand) ? rand : Math.random()));
  
  return Math.round(clampedRand * backoffCeiling);
}

/**
 * Executes an asynchronous function with exponential backoff and jitter.
 * @template T
 * @param {() => Promise<T>} asyncFn - Async operation to execute
 * @param {Object} [options] - Retry options
 * @returns {Promise<T>} Result of async operation
 */
async function withRetry(asyncFn, options = {}) {
  if (typeof asyncFn !== 'function') {
    throw new TypeError('withRetry expects an async function as its first argument');
  }

  const maxRetries = options.maxRetries ?? DEFAULT_RETRY_OPTIONS.maxRetries;
  const initialDelayMs = options.initialDelayMs ?? options.baseDelayMs ?? DEFAULT_RETRY_OPTIONS.initialDelayMs;
  const factor = options.factor ?? DEFAULT_RETRY_OPTIONS.factor;
  const maxDelayMs = options.maxDelayMs ?? DEFAULT_RETRY_OPTIONS.maxDelayMs;
  const randomFn = options.randomFn ?? DEFAULT_RETRY_OPTIONS.randomFn;
  const sleepFn = options.sleepFn ?? DEFAULT_RETRY_OPTIONS.sleepFn;
  const isRetryable = options.isRetryable ?? isRetryableError;
  const onRetry = options.onRetry ?? DEFAULT_RETRY_OPTIONS.onRetry;

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await asyncFn(attempt);
    } catch (error) {
      lastError = error;

      if (attempt >= maxRetries || !isRetryable(error)) {
        throw error;
      }

      const delayMs = calculateJitterDelay(attempt, {
        initialDelayMs,
        factor,
        maxDelayMs,
        randomFn
      });

      if (typeof onRetry === 'function') {
        try {
          onRetry(error, attempt + 1, delayMs);
        } catch (cbErr) {
          console.warn('[withRetry onRetry callback error]', cbErr);
        }
      }

      await sleepFn(delayMs);
    }
  }

  throw lastError;
}

const callWithRetry = withRetry;

module.exports = {
  DEFAULT_RETRY_OPTIONS,
  isRetryableError,
  calculateJitterDelay,
  withRetry,
  callWithRetry
};
