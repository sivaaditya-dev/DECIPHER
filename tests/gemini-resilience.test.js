/**
 * tests/gemini-resilience.test.js
 * Comprehensive Unit Test Suite for Gemini API Resilience:
 * 1. Exponential backoff delay calculation with full jitter and caps
 * 2. Transient vs non-retryable error filtering (HTTP 429/500 vs 400/401/403)
 * 3. Asynchronous retry loop execution, recovery after failures, retry exhaustion
 * 4. Markdown code fence stripping and outer JSON extraction
 * 5. LLM JSON malformation repair (trailing commas, unescaped newlines, truncated syntax)
 * 6. Structured schema fallback validation for story, mnemonic, opposite, chat, analyze, daily-word
 */

const {
  DEFAULT_RETRY_OPTIONS,
  isRetryableError,
  calculateJitterDelay,
  withRetry,
  callWithRetry,
  stripMarkdownFences,
  extractJsonSubstring,
  repairJsonString,
  tryRepairTruncatedJson,
  FALLBACK_SCHEMAS,
  validateAndApplyDefaults,
  parseStructuredFallback,
  parseStructuredResponse
} = require('../api/gemini-resilience');

describe('Gemini API Resilience & Fallback Suite', () => {

  // ============================================================
  // 1. ERROR FILTERING (isRetryableError)
  // ============================================================
  describe('1. Error Retryability Classification (isRetryableError)', () => {
    test('identifies HTTP 429 Too Many Requests as retryable', () => {
      expect(isRetryableError({ status: 429 })).toBe(true);
      expect(isRetryableError({ statusCode: 429 })).toBe(true);
      expect(isRetryableError({ response: { status: 429 } })).toBe(true);
    });

    test('identifies HTTP 500, 502, 503, 504 server errors as retryable', () => {
      expect(isRetryableError({ status: 500 })).toBe(true);
      expect(isRetryableError({ status: 502 })).toBe(true);
      expect(isRetryableError({ status: 503 })).toBe(true);
      expect(isRetryableError({ status: 504 })).toBe(true);
    });

    test('identifies gRPC RESOURCE_EXHAUSTED and UNAVAILABLE as retryable', () => {
      expect(isRetryableError(new Error('RESOURCE_EXHAUSTED: quota exceeded for model'))).toBe(true);
      expect(isRetryableError(new Error('The service is UNAVAILABLE. Please try again.'))).toBe(true);
      expect(isRetryableError({ details: 'DEADLINE_EXCEEDED during call' })).toBe(true);
    });

    test('identifies network socket drop errors as retryable', () => {
      expect(isRetryableError({ code: 'ECONNRESET' })).toBe(true);
      expect(isRetryableError({ code: 'ETIMEDOUT' })).toBe(true);
      expect(isRetryableError({ code: 'ENOTFOUND' })).toBe(true);
      expect(isRetryableError(new Error('fetch failed with FETCH_ERROR'))).toBe(true);
    });

    test('rejects HTTP 400 Bad Request immediately without retrying', () => {
      expect(isRetryableError({ status: 400, message: 'Bad Request' })).toBe(false);
      expect(isRetryableError({ statusCode: 400 })).toBe(false);
    });

    test('rejects HTTP 401 Unauthorized and 403 Forbidden without retrying', () => {
      expect(isRetryableError({ status: 401 })).toBe(false);
      expect(isRetryableError({ status: 403 })).toBe(false);
      expect(isRetryableError(new Error('PERMISSION_DENIED: invalid auth token'))).toBe(false);
      expect(isRetryableError(new Error('UNAUTHENTICATED request'))).toBe(false);
    });

    test('rejects HTTP 404 Not Found and 422 Unprocessable Entity', () => {
      expect(isRetryableError({ status: 404 })).toBe(false);
      expect(isRetryableError({ status: 422 })).toBe(false);
      expect(isRetryableError(new Error('INVALID_ARGUMENT: prompt parameter is required'))).toBe(false);
    });

    test('returns false for null, undefined, or empty error values', () => {
      expect(isRetryableError(null)).toBe(false);
      expect(isRetryableError(undefined)).toBe(false);
      expect(isRetryableError('')).toBe(false);
    });
  });

  // ============================================================
  // 2. EXPONENTIAL BACKOFF & JITTER (calculateJitterDelay)
  // ============================================================
  describe('2. Exponential Backoff & Jitter Delay Calculation (calculateJitterDelay)', () => {
    test('calculates exact delay when random factor is 1.0 (ceiling)', () => {
      const options = { initialDelayMs: 500, factor: 2, maxDelayMs: 8000, randomFn: () => 1.0 };
      expect(calculateJitterDelay(0, options)).toBe(500);  // 500 * 2^0
      expect(calculateJitterDelay(1, options)).toBe(1000); // 500 * 2^1
      expect(calculateJitterDelay(2, options)).toBe(2000); // 500 * 2^2
      expect(calculateJitterDelay(3, options)).toBe(4000); // 500 * 2^3
    });

    test('calculates exact delay when random factor is 0.5 (midpoint)', () => {
      const options = { initialDelayMs: 600, factor: 2, maxDelayMs: 8000, randomFn: () => 0.5 };
      expect(calculateJitterDelay(0, options)).toBe(300);
      expect(calculateJitterDelay(1, options)).toBe(600);
      expect(calculateJitterDelay(2, options)).toBe(1200);
    });

    test('returns 0 delay when random factor is 0.0', () => {
      const options = { initialDelayMs: 500, factor: 2, maxDelayMs: 8000, randomFn: () => 0.0 };
      expect(calculateJitterDelay(0, options)).toBe(0);
      expect(calculateJitterDelay(2, options)).toBe(0);
    });

    test('clamps delay at maxDelayMs cap regardless of high attempt count', () => {
      const options = { initialDelayMs: 500, factor: 2, maxDelayMs: 8000, randomFn: () => 1.0 };
      // 500 * 2^10 = 512,000 > 8000
      expect(calculateJitterDelay(10, options)).toBe(8000);
    });

    test('supports baseDelayMs option alias', () => {
      const options = { baseDelayMs: 800, factor: 2, maxDelayMs: 8000, randomFn: () => 1.0 };
      expect(calculateJitterDelay(0, options)).toBe(800);
    });

    test('clamps negative attempt numbers to 0', () => {
      const options = { initialDelayMs: 500, factor: 2, maxDelayMs: 8000, randomFn: () => 1.0 };
      expect(calculateJitterDelay(-2, options)).toBe(500);
    });
  });

  // ============================================================
  // 3. ASYNC RETRY LOOP (withRetry)
  // ============================================================
  describe('3. Asynchronous Retry Loop Execution (withRetry)', () => {
    test('returns result immediately on first attempt without delay', async () => {
      const sleepFn = jest.fn().mockResolvedValue(undefined);
      const asyncFn = jest.fn().mockResolvedValue({ text: 'Hello, World!' });

      const result = await withRetry(asyncFn, { sleepFn });

      expect(result).toEqual({ text: 'Hello, World!' });
      expect(asyncFn).toHaveBeenCalledTimes(1);
      expect(asyncFn).toHaveBeenCalledWith(0);
      expect(sleepFn).not.toHaveBeenCalled();
    });

    test('recovers after 1 transient error (HTTP 429) and succeeds on attempt 1', async () => {
      const sleepFn = jest.fn().mockResolvedValue(undefined);
      const onRetry = jest.fn();
      const asyncFn = jest.fn()
        .mockRejectedValueOnce({ status: 429, message: 'Too Many Requests' })
        .mockResolvedValueOnce({ text: 'Recovered payload' });

      const result = await withRetry(asyncFn, {
        sleepFn,
        onRetry,
        initialDelayMs: 500,
        randomFn: () => 1.0
      });

      expect(result).toEqual({ text: 'Recovered payload' });
      expect(asyncFn).toHaveBeenCalledTimes(2);
      expect(sleepFn).toHaveBeenCalledTimes(1);
      expect(sleepFn).toHaveBeenCalledWith(500);
      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(expect.objectContaining({ status: 429 }), 1, 500);
    });

    test('recovers after 2 consecutive failures (503 UNAVAILABLE -> ECONNRESET)', async () => {
      const sleepFn = jest.fn().mockResolvedValue(undefined);
      const onRetry = jest.fn();
      const asyncFn = jest.fn()
        .mockRejectedValueOnce(new Error('UNAVAILABLE: backend overloaded'))
        .mockRejectedValueOnce({ code: 'ECONNRESET' })
        .mockResolvedValueOnce({ success: true });

      const result = await withRetry(asyncFn, {
        sleepFn,
        onRetry,
        initialDelayMs: 400,
        factor: 2,
        randomFn: () => 1.0
      });

      expect(result).toEqual({ success: true });
      expect(asyncFn).toHaveBeenCalledTimes(3);
      expect(sleepFn).toHaveBeenCalledTimes(2);
      expect(sleepFn).toHaveBeenNthCalledWith(1, 400);  // 400 * 2^0
      expect(sleepFn).toHaveBeenNthCalledWith(2, 800);  // 400 * 2^1
      expect(onRetry).toHaveBeenCalledTimes(2);
    });

    test('exhausts all retries and rethrows final error after maxRetries exceeded', async () => {
      const sleepFn = jest.fn().mockResolvedValue(undefined);
      const persistentError = { status: 503, message: 'Service Permanently Down' };
      const asyncFn = jest.fn().mockRejectedValue(persistentError);

      await expect(withRetry(asyncFn, {
        maxRetries: 3,
        sleepFn
      })).rejects.toMatchObject({ status: 503 });

      // Initial attempt (0) + 3 retries (1, 2, 3) = 4 total attempts
      expect(asyncFn).toHaveBeenCalledTimes(4);
      // Slept between attempts: (0->1, 1->2, 2->3) = 3 sleeps
      expect(sleepFn).toHaveBeenCalledTimes(3);
    });

    test('immediately throws non-retryable 400 Bad Request error without sleeping', async () => {
      const sleepFn = jest.fn().mockResolvedValue(undefined);
      const badRequest = { status: 400, message: 'Invalid prompt format' };
      const asyncFn = jest.fn().mockRejectedValue(badRequest);

      await expect(withRetry(asyncFn, { sleepFn })).rejects.toMatchObject({ status: 400 });

      expect(asyncFn).toHaveBeenCalledTimes(1);
      expect(sleepFn).not.toHaveBeenCalled();
    });

    test('immediately throws non-retryable 401 Unauthorized without sleeping', async () => {
      const sleepFn = jest.fn().mockResolvedValue(undefined);
      const unauthError = { status: 401, message: 'API key expired' };
      const asyncFn = jest.fn().mockRejectedValue(unauthError);

      await expect(withRetry(asyncFn, { sleepFn })).rejects.toMatchObject({ status: 401 });

      expect(asyncFn).toHaveBeenCalledTimes(1);
      expect(sleepFn).not.toHaveBeenCalled();
    });

    test('validates that first argument is an executable function', async () => {
      await expect(withRetry(null)).rejects.toThrow(TypeError);
      await expect(withRetry('not a function')).rejects.toThrow(TypeError);
    });

    test('callWithRetry alias behaves identically to withRetry', async () => {
      const asyncFn = jest.fn().mockResolvedValue('alias-result');
      const result = await callWithRetry(asyncFn);
      expect(result).toBe('alias-result');
    });
  });

  // ============================================================
  // 4. MARKDOWN STRIPPING & SUBSTRING EXTRACTION
  // ============================================================
  describe('4. Markdown Fence Stripping & Substring Extraction', () => {
    test('strips ```json code fences and preserves inner JSON', () => {
      const raw = '```json\n{"term": "lucid", "def": "clear"}\n```';
      expect(stripMarkdownFences(raw)).toBe('{"term": "lucid", "def": "clear"}');
    });

    test('strips uppercase ```JSON and ```javascript fences', () => {
      const rawUpper = '```JSON\n[{"term": "test"}]\n```';
      expect(stripMarkdownFences(rawUpper)).toBe('[{"term": "test"}]');

      const rawJs = '```javascript\n{"hello": "world"}\n```';
      expect(stripMarkdownFences(rawJs)).toBe('{"hello": "world"}');
    });

    test('strips generic ``` fences without language specifier', () => {
      const raw = '```\n{"story": "Once upon a time"}\n```';
      expect(stripMarkdownFences(raw)).toBe('{"story": "Once upon a time"}');
    });

    test('handles raw text without fences unchanged', () => {
      const raw = '{"term": "ephemeral"}';
      expect(stripMarkdownFences(raw)).toBe('{"term": "ephemeral"}');
    });

    test('extracts JSON object from surrounding conversational prose', () => {
      const text = 'Here is the vocabulary analysis you requested:\n{"term": "sonorous", "def": "deep sound"}\nHope this helps your studies!';
      expect(extractJsonSubstring(text)).toBe('{"term": "sonorous", "def": "deep sound"}');
    });

    test('extracts JSON array from surrounding conversational prose', () => {
      const text = 'Sure, here are the words:\n[{"term": "a"}, {"term": "b"}]\nLet me know if you need anything else.';
      expect(extractJsonSubstring(text)).toBe('[{"term": "a"}, {"term": "b"}]');
    });
  });

  // ============================================================
  // 5. JSON MALFORMATION REPAIR (repairJsonString & Truncation)
  // ============================================================
  describe('5. JSON Malformation Repair (repairJsonString & Truncation)', () => {
    test('removes trailing commas in JSON objects', () => {
      const malformed = '{"term": "pragmatic", "def": "practical",}';
      const repaired = repairJsonString(malformed);
      expect(JSON.parse(repaired)).toEqual({ term: 'pragmatic', def: 'practical' });
    });

    test('removes trailing commas in JSON arrays', () => {
      const malformed = '["apple", "banana", "cherry",]';
      const repaired = repairJsonString(malformed);
      expect(JSON.parse(repaired)).toEqual(['apple', 'banana', 'cherry']);
    });

    test('removes nested trailing commas in complex payloads', () => {
      const malformed = '[{"term": "ubiquitous", "syn": "omnipresent",}, {"term": "ephemeral", "syn": "fleeting",},]';
      const repaired = repairJsonString(malformed);
      expect(JSON.parse(repaired)).toEqual([
        { term: 'ubiquitous', syn: 'omnipresent' },
        { term: 'ephemeral', syn: 'fleeting' }
      ]);
    });

    test('escapes unescaped literal newlines inside JSON string values', () => {
      const malformed = '{"story": "First line of story.\nSecond line of story."}';
      const repaired = repairJsonString(malformed);
      expect(JSON.parse(repaired)).toEqual({
        story: 'First line of story.\nSecond line of story.'
      });
    });

    test('repairs truncated JSON arrays by closing unclosed brackets', () => {
      const truncated = '[{"term": "word1", "def": "def1"}, {"term": "word2", "def": "def2"';
      const repaired = tryRepairTruncatedJson(truncated);
      expect(repaired).toHaveLength(2);
      expect(repaired[1].term).toBe('word2');
    });

    test('repairs truncated JSON objects with open string literal', () => {
      const truncated = '{"term": "resilient", "def": "able to recover quickly';
      const repaired = tryRepairTruncatedJson(truncated);
      expect(repaired.term).toBe('resilient');
      expect(repaired.def).toBe('able to recover quickly');
    });
  });

  // ============================================================
  // 6. STRUCTURED SCHEMA FALLBACK PARSER (parseStructuredFallback)
  // ============================================================
  describe('6. Structured Schema Fallback Parser (parseStructuredFallback)', () => {
    test('parses clean valid JSON according to schema', () => {
      const raw = JSON.stringify({ story: 'A captivating journey of words.' });
      const parsed = parseStructuredFallback(raw, 'story');
      expect(parsed).toEqual({ story: 'A captivating journey of words.' });
    });

    test('parses markdown-fenced response with trailing comma for story schema', () => {
      const raw = '```json\n{"story": "An engaging tale of resilience and triumph.",}\n```';
      const parsed = parseStructuredFallback(raw, 'story');
      expect(parsed.story).toBe('An engaging tale of resilience and triumph.');
    });

    test('generates fallback story using context words when story field is missing', () => {
      const raw = '{"irrelevantField": 123}';
      const parsed = parseStructuredFallback(raw, 'story', { words: ['ephemeral', 'lucid'] });
      expect(parsed.story).toContain('ephemeral, lucid');
    });

    test('handles raw plain text string for story without JSON wrapping', () => {
      const raw = 'Once upon a time, two travelers discovered a hidden library in the mountains.';
      const parsed = parseStructuredFallback(raw, 'story');
      expect(parsed).toEqual({ story: raw });
    });

    test('parses mnemonic array and fills default mnemonic for items missing it', () => {
      const raw = JSON.stringify([
        { term: 'gregarious', mnemonic: 'Greg is hilarious at parties.' },
        { term: 'tenacious' } // missing mnemonic
      ]);
      const parsed = parseStructuredFallback(raw, 'mnemonic');
      expect(parsed).toHaveLength(2);
      expect(parsed[0].mnemonic).toBe('Greg is hilarious at parties.');
      expect(parsed[1].mnemonic).toContain('tenacious');
    });

    test('generates fallback mnemonics from context vocabList on complete parse failure', () => {
      const raw = 'This is non-JSON garbage text from an erroneous AI generation.';
      const vocabList = [
        { term: 'lucid', def: 'clear' },
        { term: 'ambiguous', def: 'unclear' }
      ];
      const parsed = parseStructuredFallback(raw, 'mnemonic', { vocabList });
      expect(parsed).toHaveLength(2);
      expect(parsed[0].term).toBe('lucid');
      expect(parsed[1].term).toBe('ambiguous');
    });

    test('parses opposite day schema and falls back to original text when empty', () => {
      const valid = '```json\n{"opposite": "The small mouse stood silently."}\n```';
      expect(parseStructuredFallback(valid, 'opposite')).toEqual({
        opposite: 'The small mouse stood silently.'
      });

      const rawString = 'The gigantic mouse roared loudly.';
      expect(parseStructuredFallback(rawString, 'opposite')).toEqual({
        opposite: 'The gigantic mouse roared loudly.'
      });

      const empty = '';
      expect(parseStructuredFallback(empty, 'opposite', { text: 'Original text' })).toEqual({
        opposite: '[Opposite Day]: Original text'
      });
    });

    test('parses chat schema and provides resilient fallback on failure', () => {
      const valid = JSON.stringify({ reply: 'Hello! Ready to practice?' });
      expect(parseStructuredFallback(valid, 'chat')).toEqual({ reply: 'Hello! Ready to practice?' });

      const raw = 'I can help you review your flashcards right now!';
      expect(parseStructuredFallback(raw, 'chat')).toEqual({ reply: raw });

      const broken = null;
      const fallback = parseStructuredFallback(broken, 'chat');
      expect(fallback.reply).toContain('Decipher AI');
    });

    test('parses analyze schema and ensures def, syn, context fields exist', () => {
      const raw = JSON.stringify([
        { term: 'eloquent' } // missing def, syn, context
      ]);
      const parsed = parseStructuredFallback(raw, 'analyze');
      expect(parsed).toHaveLength(1);
      expect(parsed[0].term).toBe('eloquent');
      expect(parsed[0].def).toBeDefined();
      expect(parsed[0].syn).toBeDefined();
      expect(parsed[0].context).toBeDefined();
    });

    test('parses srs-questions schema ensuring sentence contains blank marker ___', () => {
      const raw = JSON.stringify([
        { term: 'resilient', sentence: 'The organism proved to be adaptable.' } // missing ___
      ]);
      const parsed = parseStructuredFallback(raw, 'srs-questions');
      expect(parsed[0].sentence).toContain('___');
    });

    test('parses daily-word schema and fills missing wrongChoices and sentence', () => {
      const raw = JSON.stringify({
        word: 'quintessential',
        definition: 'Representing the most perfect or typical example.'
        // missing wrongChoices and sentence
      });
      const parsed = parseStructuredFallback(raw, 'daily-word');
      expect(parsed.word).toBe('quintessential');
      expect(parsed.wrongChoices).toHaveLength(3);
      expect(parsed.sentence).toContain('___');
    });

    test('supports custom validator functions', () => {
      const customValidator = (data) => data && data.score >= 50;
      const valid = JSON.stringify({ score: 85 });
      const invalid = JSON.stringify({ score: 20 });

      expect(parseStructuredFallback(valid, customValidator)).toEqual({ score: 85 });
      expect(parseStructuredFallback(invalid, customValidator)).toEqual({ score: 20 });
    });

    test('parseStructuredResponse alias functions identically', () => {
      const raw = '```json\n{"story": "An alias test story."}\n```';
      expect(parseStructuredResponse(raw, 'story')).toEqual({ story: 'An alias test story.' });
    });
  });
});
