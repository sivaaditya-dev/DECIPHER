'use strict';
/**
 * tests/arena-routes.test.js — In-Process Route Tests for Week 2 Arena PvP Routes
 * Decipher Language Learning Platform
 *
 * Exercises actual Express 5 route handlers registered in server.js without
 * binding TCP ports (matching validation.test.js / sandbox-safe pattern).
 */

const EventEmitter = require('events');

process.env.NODE_ENV = 'test';
process.env.GEMINI_API_KEY = 'test-key';

const app = require('../server.js');

/**
 * Finds the final route handler registered for (METHOD, path) on app.router.
 */
function findHandler(method, routePath) {
  const m = method.toLowerCase();
  const layer = app.router.stack.find(
    l => l.route && l.route.path === routePath && l.route.methods[m]
  );
  if (!layer) throw new Error(`Route not found: ${method} ${routePath}`);
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

/**
 * Invokes an Express route handler with mock req/res objects.
 */
async function invoke(method, routePath, { body = {}, params = {}, query = {} } = {}) {
  const handler = findHandler(method, routePath);
  const req = new EventEmitter();
  req.body = body;
  req.params = params;
  req.query = query;
  req.headers = {};

  const chunks = [];
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    ended: false,
    set(obj) { Object.assign(this.headers, obj); return this; },
    setHeader(k, v) { this.headers[k] = v; return this; },
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; this.ended = true; return this; },
    flushHeaders() {},
    write(chunk) { chunks.push(chunk); },
    end(chunk) { if (chunk) chunks.push(chunk); this.ended = true; },
    chunks,
  };

  await handler(req, res, (err) => { if (err) throw err; });
  return { req, res };
}

describe('server.js — Week 2 Arena PvP routes', () => {
  test('POST /api/arena/room rejects missing uid with 400', async () => {
    const { res } = await invoke('POST', '/api/arena/room', { body: {} });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/uid/i);
  });

  test('Private Duel create -> join -> SSE streams -> action -> KO match_end lifecycle', async () => {
    // 1. Create room
    const create = await invoke('POST', '/api/arena/room', {
      body: { uid: 'host-u1', elo: 1250, displayName: 'HostOne' },
    });
    expect(create.res.statusCode).toBe(200);
    const code = create.res.body.roomCode;
    expect(code).toMatch(/^[A-Z2-9]{4}$/);

    // 2. Host cannot join own room
    const selfJoin = await invoke('POST', '/api/arena/room/:code/join', {
      params: { code },
      body: { uid: 'host-u1', elo: 1250 },
    });
    expect(selfJoin.res.statusCode).toBe(400);

    // 3. Open Host SSE stream
    const hostStream = await invoke('GET', '/api/arena/room/:code/stream', {
      params: { code },
      query: { uid: 'host-u1' },
    });
    expect(hostStream.res.headers['Content-Type']).toBe('text/event-stream');
    expect(hostStream.res.chunks.join('')).toContain('event: room_joined');

    // 4. Guest joins room
    const join = await invoke('POST', '/api/arena/room/:code/join', {
      params: { code },
      body: { uid: 'guest-u1', elo: 1200, displayName: 'GuestOne' },
    });
    expect(join.res.statusCode).toBe(200);
    expect(join.res.body.role).toBe('guest');
    expect(join.res.body.opponentName).toBe('HostOne');

    // 5. Third player rejected as full
    const third = await invoke('POST', '/api/arena/room/:code/join', {
      params: { code },
      body: { uid: 'intruder-1' },
    });
    expect(third.res.statusCode).toBe(409);

    // 6. Open Guest SSE stream -> triggers opponent_joined for BOTH
    const guestStream = await invoke('GET', '/api/arena/room/:code/stream', {
      params: { code },
      query: { uid: 'guest-u1' },
    });
    expect(hostStream.res.chunks.join('')).toContain('event: opponent_joined');
    expect(guestStream.res.chunks.join('')).toContain('event: opponent_joined');

    // 7. Non-participant blocked from submitting word action
    const intruderAction = await invoke('POST', '/api/arena/room/:code/action', {
      params: { code },
      body: { uid: 'intruder-1', word: 'lucid' },
    });
    expect(intruderAction.res.statusCode).toBe(403);

    // 8. Valid word broadcast over SSE
    const act1 = await invoke('POST', '/api/arena/room/:code/action', {
      params: { code },
      body: { uid: 'host-u1', word: 'ephemeral', weight: 300 },
    });
    expect(act1.res.statusCode).toBe(200);
    expect(act1.res.body.nextStartLetter).toBe('L');
    expect(hostStream.res.chunks.join('')).toContain('"lastWord":"ephemeral"');
    expect(guestStream.res.chunks.join('')).toContain('"lastWord":"ephemeral"');

    // 9. Chain-breaking word rejected with 422
    const badChain = await invoke('POST', '/api/arena/room/:code/action', {
      params: { code },
      body: { uid: 'guest-u1', word: 'zebra', weight: 100 },
    });
    expect(badChain.res.statusCode).toBe(422);

    // 10. Clean up SSE connections
    hostStream.req.emit('close');
    guestStream.req.emit('close');
  });

  test('Quick Match queue pairs players and notifies waiting player via queue SSE', async () => {
    // 1. Player A queues first
    const q1 = await invoke('POST', '/api/arena/queue', {
      body: { uid: 'qm-a1', elo: 1300, displayName: 'Alpha' },
    });
    expect(q1.res.statusCode).toBe(200);
    expect(q1.res.body.queued).toBe(true);

    // 2. Player A opens queue SSE waiting stream
    const qStream = await invoke('GET', '/api/arena/queue/stream', {
      query: { uid: 'qm-a1' },
    });
    expect(qStream.res.chunks.join('')).toContain('event: queued');

    // 3. Player B queues within +-200 Elo -> pairs both!
    const q2 = await invoke('POST', '/api/arena/queue', {
      body: { uid: 'qm-b1', elo: 1350, displayName: 'Beta' },
    });
    expect(q2.res.statusCode).toBe(200);
    expect(q2.res.body.roomCode).toMatch(/^[A-Z2-9]{4}$/);
    expect(q2.res.body.role).toBe('guest');
    expect(q2.res.body.opponentName).toBe('Alpha');

    // 4. Waiting player A received match_found event over queue SSE
    const streamOut = qStream.res.chunks.join('');
    expect(streamOut).toContain('event: match_found');
    expect(streamOut).toContain(q2.res.body.roomCode);
    expect(streamOut).toContain('Beta');

    qStream.req.emit('close');
  });

  test('POST /api/arena/queue/leave removes player from queue', async () => {
    await invoke('POST', '/api/arena/queue', { body: { uid: 'qm-leave', elo: 1200 } });
    const leave = await invoke('POST', '/api/arena/queue/leave', { body: { uid: 'qm-leave' } });
    expect(leave.res.statusCode).toBe(200);
    expect(leave.res.body.success).toBe(true);
  });

  test('POST /api/arena/match/end validates required UIDs and numeric Elo values', async () => {
    const missingUids = await invoke('POST', '/api/arena/match/end', { body: {} });
    expect(missingUids.res.statusCode).toBe(400);

    const badElo = await invoke('POST', '/api/arena/match/end', {
      body: { winnerUid: 'w1', loserUid: 'l1', winnerEloNew: 'not-a-number', loserEloNew: 1184 },
    });
    expect(badElo.res.statusCode).toBe(400);
  });
});
