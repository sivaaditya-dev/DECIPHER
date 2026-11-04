/**
 * api/gemini-resilience.js
 * Production Resilience and Schema Fallback Layer for Google Gemini 2.5 Flash API.
 * 
 * Capabilities:
 * 1. Exponential backoff with full jitter for transient API errors (HTTP 429, 500, 502, 503, 504;
 *    gRPC RESOURCE_EXHAUSTED, UNAVAILABLE; network ECONNRESET, ETIMEDOUT).
 * 2. Immediate pass-through failure for non-retryable client errors (400, 401, 403, 404, INVALID_ARGUMENT).
 * 3. Structured schema fallback parser that strips markdown code fences, extracts JSON substrings,
 *    repairs trailing commas and unescaped newlines, repairs truncated responses, and validates against
 *    domain schemas (story, mnemonic, opposite, chat, analyze, srs-questions, daily-word).
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
    // If it clearly does not include transient keywords, reject immediately
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

      // Fail immediately if out of retries or error is non-retryable
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

// ============================================================
// 2. MARKDOWN CLEANING & JSON REPAIR UTILITIES
// ============================================================

/**
 * Strips markdown code fences (```json ... ``` or ``` ... ```) from model output.
 * @param {string} rawText - Raw string from model
 * @returns {string} Text without surrounding code fences
 */
function stripMarkdownFences(rawText) {
  if (typeof rawText !== 'string') return '';
  let text = rawText.trim();

  const fenceRegex = /```(?:json|JSON|javascript|js)?\s*([\s\S]*?)\s*```/;
  const match = text.match(fenceRegex);
  if (match && match[1]) {
    return match[1].trim();
  }

  // Handle leading ```json or trailing ``` without full pair
  text = text.replace(/^```(?:json|JSON|javascript|js)?\s*/i, '');
  text = text.replace(/\s*```$/, '');
  return text.trim();
}

/**
 * Locates and extracts the outer JSON substring (enclosed by { ... } or [ ... ]).
 * @param {string} text - Cleaned string
 * @returns {string} Substring containing only the JSON structure
 */
function extractJsonSubstring(text) {
  if (typeof text !== 'string') return '';
  const trimmed = text.trim();

  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    return trimmed;
  }

  const firstBrace = trimmed.indexOf('{');
  const firstBracket = trimmed.indexOf('[');

  let start = -1;
  let isArray = false;

  if (firstBrace !== -1 && firstBracket !== -1) {
    if (firstBrace < firstBracket) {
      start = firstBrace;
      isArray = false;
    } else {
      start = firstBracket;
      isArray = true;
    }
  } else if (firstBrace !== -1) {
    start = firstBrace;
    isArray = false;
  } else if (firstBracket !== -1) {
    start = firstBracket;
    isArray = true;
  }

  if (start === -1) {
    return trimmed;
  }

  const endChar = isArray ? ']' : '}';
  const lastEnd = trimmed.lastIndexOf(endChar);

  if (lastEnd !== -1 && lastEnd > start) {
    return trimmed.slice(start, lastEnd + 1).trim();
  }

  return trimmed.slice(start).trim();
}

/**
 * Repairs common JSON malformations produced by LLMs:
 * - Trailing commas before closing braces/brackets
 * - Literal unescaped newlines/tabs inside string literals
 * @param {string} rawJson - JSON string to repair
 * @returns {string} Repaired JSON string
 */
function repairJsonString(rawJson) {
  if (typeof rawJson !== 'string') return '';
  let s = rawJson.trim();

  // 1. Fast remove trailing commas before } or ]
  s = s.replace(/,\s*([}\]])/g, '$1');

  // 2. Normalize unescaped newlines and tabs inside strings
  let inString = false;
  let escaped = false;
  let result = '';

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '\\' && inString) {
      escaped = !escaped;
      result += c;
      continue;
    }
    if (c === '"' && !escaped) {
      inString = !inString;
      result += c;
      continue;
    }
    if (inString) {
      if (c === '\n') {
        result += '\\n';
      } else if (c === '\r') {
        result += '\\r';
      } else if (c === '\t') {
        result += '\\t';
      } else {
        result += c;
      }
    } else {
      result += c;
    }
    escaped = false;
  }
  s = result;

  // 3. Re-run trailing comma removal in case newline escape exposed new ones
  s = s.replace(/,\s*([}\]])/g, '$1');

  return s;
}

/**
 * Attempts to repair truncated JSON arrays or objects by closing open brackets/braces.
 * @param {string} str - Truncated JSON string
 * @returns {any} Parsed JavaScript value
 */
function tryRepairTruncatedJson(str) {
  if (typeof str !== 'string') throw new Error('Input must be a string');
  let s = str.trim();

  s = s.replace(/,\s*$/, '');

  const stack = [];
  let inString = false;
  let escaped = false;

  for (let i = 0; i < s.length; i++) {
    const char = s[i];
    if (char === '\\' && inString) {
      escaped = !escaped;
      continue;
    }
    if (char === '"' && !escaped) {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (char === '{' || char === '[') {
        stack.push(char);
      } else if (char === '}') {
        if (stack.length && stack[stack.length - 1] === '{') stack.pop();
      } else if (char === ']') {
        if (stack.length && stack[stack.length - 1] === '[') stack.pop();
      }
    }
    escaped = false;
  }

  // If ended inside an open string, close it
  if (inString) {
    s += '"';
  }

  // Strip trailing commas before closing
  s = s.replace(/,\s*$/, '');

  // Close remaining open brackets in reverse order
  while (stack.length > 0) {
    const open = stack.pop();
    s += open === '{' ? '}' : ']';
  }

  return JSON.parse(s);
}

// ============================================================
// 3. SCHEMA DEFINITIONS & SENSIBLE FALLBACK GENERATOR
// ============================================================

const FALLBACK_SCHEMAS = {
  story: {
    type: 'object',
    validate: (data) => data && typeof data === 'object' && typeof data.story === 'string' && data.story.trim().length > 0,
    fallback: (data, context) => {
      if (typeof data === 'string' && data.trim().length > 0) {
        return { story: data.trim() };
      }
      if (data && typeof data.story === 'string' && data.story.trim().length > 0) {
        return { story: data.story.trim() };
      }
      const words = context?.words && Array.isArray(context.words) ? context.words.join(', ') : 'vocabulary words';
      return {
        story: `In this short contextual narrative, the key concepts (${words}) illustrate mastery through active learning and spaced repetition.`
      };
    }
  },

  mnemonic: {
    type: 'array',
    validate: (data) => Array.isArray(data) && data.length > 0 && data.every(item => item && typeof item.term === 'string' && typeof item.mnemonic === 'string'),
    fallback: (data, context) => {
      const vocabList = context?.vocabList && Array.isArray(context.vocabList) ? context.vocabList : [];
      if (Array.isArray(data) && data.length > 0) {
        return data.map((item, idx) => {
          const term = item?.term || vocabList[idx]?.term || `Word_${idx + 1}`;
          const mnemonic = item?.mnemonic && String(item.mnemonic).trim().length > 0
            ? String(item.mnemonic).trim()
            : `Picture "${term}" vividly in a fun mental image connecting its sound to its meaning.`;
          return { term, mnemonic };
        });
      }
      if (vocabList.length > 0) {
        return vocabList.map(v => {
          const term = v?.term || String(v);
          const def = v?.def || 'meaning';
          return {
            term,
            mnemonic: `Remember "${term}" (${def}) by linking its sound to an unforgettable personal association!`
          };
        });
      }
      return [
        { term: 'Vocabulary', mnemonic: 'Connect sound with vivid imagery for lasting memory retention.' }
      ];
    }
  },

  opposite: {
    type: 'object',
    validate: (data) => data && typeof data === 'object' && typeof data.opposite === 'string' && data.opposite.trim().length > 0,
    fallback: (data, context) => {
      if (typeof data === 'string' && data.trim().length > 0) {
        return { opposite: data.trim() };
      }
      if (data && typeof data.opposite === 'string' && data.opposite.trim().length > 0) {
        return { opposite: data.opposite.trim() };
      }
      const base = context?.text ? String(context.text).trim() : 'The passage could not be flipped.';
      return { opposite: `[Opposite Day]: ${base}` };
    }
  },

  chat: {
    type: 'object',
    validate: (data) => data && typeof data === 'object' && typeof data.reply === 'string' && data.reply.trim().length > 0,
    fallback: (data, context) => {
      if (typeof data === 'string' && data.trim().length > 0) {
        return { reply: data.trim() };
      }
      if (data && typeof data.reply === 'string' && data.reply.trim().length > 0) {
        return { reply: data.reply.trim() };
      }
      return {
        reply: "I'm having a brief connection moment, but Decipher AI is here! What vocabulary words would you like to explore?"
      };
    }
  },

  analyze: {
    type: 'array',
    validate: (data) => Array.isArray(data) && data.length > 0 && data.every(i => 
      i && typeof i.term === 'string' &&
      typeof i.def === 'string' &&
      typeof i.syn === 'string' &&
      typeof i.context === 'string'
    ),
    fallback: (data, context) => {
      if (Array.isArray(data) && data.length > 0) {
        return data.map((item, idx) => ({
          term: item?.term || `Vocabulary_${idx + 1}`,
          def: item?.def || 'Contextual definition.',
          syn: item?.syn || 'equivalent',
          context: item?.context || 'Found in the source passage.'
        }));
      }
      return [];
    }
  },

  'srs-questions': {
    type: 'array',
    validate: (data) => Array.isArray(data) && data.length > 0 && data.every(i => i && typeof i.term === 'string' && typeof i.sentence === 'string' && i.sentence.includes('___')),
    fallback: (data, context) => {
      const vocabList = context?.vocabList && Array.isArray(context.vocabList) ? context.vocabList : [];
      if (Array.isArray(data) && data.length > 0) {
        return data.map((item, idx) => {
          const term = item?.term || vocabList[idx]?.term || `Word_${idx + 1}`;
          let sentence = item?.sentence || `The meaning of ___ is evident in everyday conversation.`;
          if (!sentence.includes('___')) {
            sentence = `${sentence} (Choose ___).`;
          }
          return { term, sentence };
        });
      }
      if (vocabList.length > 0) {
        return vocabList.map(v => ({
          term: v.term || String(v),
          sentence: `The concept of ___ is essential for comprehensive language mastery.`
        }));
      }
      return [];
    }
  },

  'daily-word': {
    type: 'object',
    validate: (data) => data && typeof data === 'object' && typeof data.word === 'string' && Array.isArray(data.wrongChoices) && typeof data.sentence === 'string',
    fallback: (data, context) => {
      const today = new Date().toISOString().slice(0, 10);
      return {
        word: data?.word || 'perspicacious',
        phonetic: data?.phonetic || '/ˌpɜː.spɪˈkeɪ.ʃəs/',
        definition: data?.definition || 'Having a ready insight into and understanding of things.',
        wrongChoices: Array.isArray(data?.wrongChoices) && data.wrongChoices.length >= 3
          ? data.wrongChoices.slice(0, 3)
          : ['hesitant and doubtful', 'slow to understand', 'overly emotional'],
        sentence: data?.sentence && data.sentence.includes('___')
          ? data.sentence
          : 'Her ___ observations helped the team uncover the root cause quickly.',
        partOfSpeech: data?.partOfSpeech || 'adjective',
        date: today,
        generatedAt: new Date().toISOString()
      };
    }
  }
};

/**
 * Validates parsed data against schema and applies domain defaults.
 * @param {any} data - Parsed data (or null if parsing failed)
 * @param {string|Function|Object} schemaValidator - Schema name or validator
 * @param {Object} [context] - Contextual data (vocabList, words, text)
 * @returns {any} Validated data with defaults applied
 */
function validateAndApplyDefaults(data, schemaValidator, context = {}) {
  // Case 1: Custom function validator (data) => boolean
  if (typeof schemaValidator === 'function') {
    if (data && schemaValidator(data)) {
      return data;
    }
    return data ?? null;
  }

  // Case 2: Custom descriptor { validate, fallback }
  if (schemaValidator && typeof schemaValidator === 'object') {
    if (typeof schemaValidator.validate === 'function' && schemaValidator.validate(data)) {
      return data;
    }
    if (typeof schemaValidator.fallback === 'function') {
      return schemaValidator.fallback(data, context);
    }
    return schemaValidator.default ?? data ?? null;
  }

  // Case 3: Built-in schema name string
  if (typeof schemaValidator === 'string') {
    const key = schemaValidator.toLowerCase().trim();
    const schema = FALLBACK_SCHEMAS[key];
    if (schema) {
      if (schema.validate(data)) {
        return data;
      }
      return schema.fallback(data, context);
    }
  }

  // Case 4: No schema validator provided
  return data;
}

/**
 * Structured schema fallback parser for non-standard Gemini API responses.
 * @param {string|Object} rawText - Raw string from model (or object)
 * @param {string|Function|Object} [schemaValidator] - Schema name or validator
 * @param {Object} [context] - Domain context for generating fallbacks
 * @returns {any} Validated payload conforming to expected schema
 */
function parseStructuredFallback(rawText, schemaValidator, context = {}) {
  if (rawText === null || rawText === undefined) {
    return validateAndApplyDefaults(null, schemaValidator, context);
  }

  // Already parsed object
  if (typeof rawText === 'object') {
    return validateAndApplyDefaults(rawText, schemaValidator, context);
  }

  const str = String(rawText).trim();
  if (!str) {
    return validateAndApplyDefaults(null, schemaValidator, context);
  }

  // Step 1: Strip markdown code fences
  const defenced = stripMarkdownFences(str);

  // Step 2: Extract JSON substring between { ... } or [ ... ]
  const jsonSubstring = extractJsonSubstring(defenced);

  // Step 3: Fast path - standard JSON.parse
  try {
    const parsed = JSON.parse(jsonSubstring);
    return validateAndApplyDefaults(parsed, schemaValidator, context);
  } catch (err1) {
    // Step 4: Repair common JSON errors (trailing commas, unescaped newlines)
    try {
      const repaired = repairJsonString(jsonSubstring);
      const parsed = JSON.parse(repaired);
      return validateAndApplyDefaults(parsed, schemaValidator, context);
    } catch (err2) {
      // Step 5: Try truncated JSON repair (unclosed brackets/braces)
      try {
        const truncatedParsed = tryRepairTruncatedJson(jsonSubstring);
        return validateAndApplyDefaults(truncatedParsed, schemaValidator, context);
      } catch (err3) {
        // Step 6: Text pass-through for string-based schemas
        if (typeof schemaValidator === 'string') {
          const lower = schemaValidator.toLowerCase();
          if (lower === 'story' && defenced) return { story: defenced };
          if (lower === 'chat' && defenced) return { reply: defenced };
          if (lower === 'opposite' && defenced) return { opposite: defenced };
        }
        // Step 7: Complete failure -> apply fallback defaults
        return validateAndApplyDefaults(null, schemaValidator, context);
      }
    }
  }
}

const parseStructuredResponse = parseStructuredFallback;

// ============================================================
// MODULE EXPORTS
// ============================================================

module.exports = {
  // Retry & Jitter API
  DEFAULT_RETRY_OPTIONS,
  isRetryableError,
  calculateJitterDelay,
  withRetry,
  callWithRetry,

  // Markdown & JSON Repair Utilities
  stripMarkdownFences,
  extractJsonSubstring,
  repairJsonString,
  tryRepairTruncatedJson,

  // Schema & Fallback API
  FALLBACK_SCHEMAS,
  validateAndApplyDefaults,
  parseStructuredFallback,
  parseStructuredResponse
};
