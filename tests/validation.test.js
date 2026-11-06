/**
 * tests/validation.test.js
 * Comprehensive unit test suite for:
 * - Request body validation middleware engine (strict mode, types, bounds, enums)
 * - Route schemas (/api/analyze, /api/translate, /api/chat, /api/simplify, /api/story, /api/sync/batch, etc.)
 * - Rate-limit telemetry headers and security headers
 */

const {
  validateRequestBody,
  SCHEMAS,
  rateLimiter,
  securityHeadersMiddleware
} = require('../server.js');

function createMockReqRes(body = {}, options = {}) {
  const req = {
    body,
    headers: options.headers || {},
    socket: options.socket || { remoteAddress: '127.0.0.1' },
    ...options
  };

  const res = {
    statusCode: 200,
    headers: {},
    _json: null,
    setHeader(key, val) {
      this.headers[key.toLowerCase()] = val;
      this.headers[key] = val;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this._json = data;
      return this;
    }
  };

  const next = jest.fn();
  return { req, res, next };
}

describe('Request Validation Middleware Engine', () => {
  const testSchema = {
    title: { type: 'string', required: true, minLength: 3, maxLength: 20 },
    count: { type: 'number', required: false, min: 1, max: 100 },
    tags: { type: 'array', required: true, minItems: 1, maxItems: 5 },
    role: { type: 'string', required: false, enum: ['user', 'admin'] }
  };

  test('rejects non-object or missing request body', () => {
    const middleware = validateRequestBody(testSchema);

    const { req: req1, res: res1, next: next1 } = createMockReqRes(null);
    middleware(req1, res1, next1);
    expect(res1.statusCode).toBe(400);
    expect(res1._json.error).toBe('Validation failed');
    expect(next1).not.toHaveBeenCalled();

    const { req: req2, res: res2, next: next2 } = createMockReqRes('plain text');
    middleware(req2, res2, next2);
    expect(res2.statusCode).toBe(400);

    const { req: req3, res: res3, next: next3 } = createMockReqRes([1, 2, 3]);
    middleware(req3, res3, next3);
    expect(res3.statusCode).toBe(400);
  });

  test('rejects unknown fields in strict mode', () => {
    const middleware = validateRequestBody(testSchema, { strict: true });
    const { req, res, next } = createMockReqRes({
      title: 'Valid Title',
      tags: ['alpha'],
      hackerField: 'inject'
    });

    middleware(req, res, next);
    expect(res.statusCode).toBe(400);
    expect(res._json.details.some(d => d.field === 'hackerField')).toBe(true);
    expect(next).not.toHaveBeenCalled();
  });

  test('validates required fields', () => {
    const middleware = validateRequestBody(testSchema);
    const { req, res, next } = createMockReqRes({ count: 10 });

    middleware(req, res, next);
    expect(res.statusCode).toBe(400);
    const fields = res._json.details.map(d => d.field);
    expect(fields).toContain('title');
    expect(fields).toContain('tags');
    expect(next).not.toHaveBeenCalled();
  });

  test('validates field types strictly', () => {
    const middleware = validateRequestBody(testSchema);
    const { req, res, next } = createMockReqRes({
      title: 12345, // should be string
      tags: 'not-an-array' // should be array
    });

    middleware(req, res, next);
    expect(res.statusCode).toBe(400);
    expect(res._json.details.some(d => d.field === 'title' && d.message.includes('type string'))).toBe(true);
    expect(res._json.details.some(d => d.field === 'tags' && d.message.includes('must be an array'))).toBe(true);
  });

  test('validates string length and array item count bounds', () => {
    const middleware = validateRequestBody(testSchema);
    const { req, res, next } = createMockReqRes({
      title: 'ab', // too short (< 3)
      tags: [] // too few (< 1)
    });

    middleware(req, res, next);
    expect(res.statusCode).toBe(400);
    expect(res._json.details.some(d => d.field === 'title' && d.message.includes('at least 3'))).toBe(true);
    expect(res._json.details.some(d => d.field === 'tags' && d.message.includes('at least 1'))).toBe(true);
  });

  test('validates enum values', () => {
    const middleware = validateRequestBody(testSchema);
    const { req, res, next } = createMockReqRes({
      title: 'Valid Title',
      tags: ['test'],
      role: 'superadmin' // not in ['user', 'admin']
    });

    middleware(req, res, next);
    expect(res.statusCode).toBe(400);
    expect(res._json.details.some(d => d.field === 'role' && d.message.includes('must be one of'))).toBe(true);
  });

  test('allows valid payload and calls next()', () => {
    const middleware = validateRequestBody(testSchema);
    const { req, res, next } = createMockReqRes({
      title: 'Valid Title',
      count: 5,
      tags: ['tag1', 'tag2'],
      role: 'admin'
    });

    middleware(req, res, next);
    expect(res.statusCode).toBe(200);
    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe('Route-Specific Schema Validations', () => {
  test('/api/analyze schema enforces minLength: 20', () => {
    const middleware = validateRequestBody(SCHEMAS.analyze);

    const { req: badReq, res: badRes } = createMockReqRes({ text: 'Short' });
    middleware(badReq, badRes, jest.fn());
    expect(badRes.statusCode).toBe(400);
    expect(badRes._json.details[0].field).toBe('text');

    const { req: goodReq, res: goodRes, next: goodNext } = createMockReqRes({
      text: 'This is a sufficiently long text passage for vocabulary extraction analysis.',
      theme: 'Medical'
    });
    middleware(goodReq, goodRes, goodNext);
    expect(goodNext).toHaveBeenCalled();
  });

  test('/api/translate schema enforces non-empty vocabList and targetLang', () => {
    const middleware = validateRequestBody(SCHEMAS.translate);

    const { req: badReq, res: badRes } = createMockReqRes({ vocabList: [] });
    middleware(badReq, badRes, jest.fn());
    expect(badRes.statusCode).toBe(400);

    const { req: goodReq, res: goodRes, next: goodNext } = createMockReqRes({
      vocabList: [{ term: 'ephemeral', def: 'short-lived' }],
      targetLang: 'Spanish'
    });
    middleware(goodReq, goodRes, goodNext);
    expect(goodNext).toHaveBeenCalled();
  });

  test('/api/simplify schema validates level enum', () => {
    const middleware = validateRequestBody(SCHEMAS.simplify);

    const { req: badReq, res: badRes } = createMockReqRes({
      text: 'This is a long passage that needs to be simplified for learners.',
      level: 'invalid-level'
    });
    middleware(badReq, badRes, jest.fn());
    expect(badRes.statusCode).toBe(400);

    const { req: goodReq, res: goodRes, next: goodNext } = createMockReqRes({
      text: 'This is a long passage that needs to be simplified for learners.',
      level: 'eli5'
    });
    middleware(goodReq, goodRes, goodNext);
    expect(goodNext).toHaveBeenCalled();
  });

  test('/api/chat schema validates messages array', () => {
    const middleware = validateRequestBody(SCHEMAS.chat);

    const { req: badReq, res: badRes } = createMockReqRes({ messages: [] });
    middleware(badReq, badRes, jest.fn());
    expect(badRes.statusCode).toBe(400);

    const { req: goodReq, res: goodRes, next: goodNext } = createMockReqRes({
      messages: [{ role: 'user', content: 'Explain ephemeral' }]
    });
    middleware(goodReq, goodRes, goodNext);
    expect(goodNext).toHaveBeenCalled();
  });

  test('/api/story schema validates words array', () => {
    const middleware = validateRequestBody(SCHEMAS.story);

    const { req: badReq, res: badRes } = createMockReqRes({ words: 'not-an-array' });
    middleware(badReq, badRes, jest.fn());
    expect(badRes.statusCode).toBe(400);

    const { req: goodReq, res: goodRes, next: goodNext } = createMockReqRes({
      words: ['serendipity', 'ephemeral', 'ubiquitous']
    });
    middleware(goodReq, goodRes, goodNext);
    expect(goodNext).toHaveBeenCalled();
  });

  test('/api/voice-intent schema validates utterance string', () => {
    const middleware = validateRequestBody(SCHEMAS.voiceIntent);

    const { req: badReq, res: badRes } = createMockReqRes({});
    middleware(badReq, badRes, jest.fn());
    expect(badRes.statusCode).toBe(400);

    const { req: goodReq, res: goodRes, next: goodNext } = createMockReqRes({
      utterance: 'take me to studio',
      lang: 'en-US'
    });
    middleware(goodReq, goodRes, goodNext);
    expect(goodNext).toHaveBeenCalled();
  });

  test('/api/sync/batch schema validates batchId and items array', () => {
    const middleware = validateRequestBody(SCHEMAS.batchSync);

    const { req: badReq, res: badRes } = createMockReqRes({ batchId: 'b1' }); // missing items
    middleware(badReq, badRes, jest.fn());
    expect(badRes.statusCode).toBe(400);

    const { req: goodReq, res: goodRes, next: goodNext } = createMockReqRes({
      batchId: 'batch_12345',
      clientTimestamp: Date.now(),
      items: [{ id: 1, actionType: 'RECORD_REVIEW', payload: { cardId: 'c1', grade: 4 } }]
    });
    middleware(goodReq, goodRes, goodNext);
    expect(goodNext).toHaveBeenCalled();
  });
});

describe('Security & Telemetry Headers Middleware', () => {
  test('securityHeadersMiddleware sets all hardened protection headers', () => {
    const { req, res, next } = createMockReqRes();
    securityHeadersMiddleware(req, res, next);

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['x-xss-protection']).toBe('1; mode=block');
    expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(res.headers['permissions-policy']).toBe('camera=(), microphone=(), geolocation=(), payment=()');
    expect(res.headers['cross-origin-opener-policy']).toBe('same-origin');
    expect(res.headers['cross-origin-resource-policy']).toBe('same-origin');
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('rateLimiter sets telemetry headers on normal requests', () => {
    const uniqueIp = `192.168.1.${Math.floor(Math.random() * 200 + 10)}`;
    const { req, res, next } = createMockReqRes({}, { socket: { remoteAddress: uniqueIp } });

    rateLimiter(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.headers['ratelimit-limit']).toBe(30);
    expect(res.headers['ratelimit-remaining']).toBeLessThanOrEqual(29);
    expect(res.headers['ratelimit-reset']).toBeGreaterThan(0);
    expect(res.headers['x-ratelimit-limit']).toBe(30);
  });
});
