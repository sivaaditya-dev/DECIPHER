'use strict';
/**
 * arena-matchmaking.test.js — Unit Tests for modules/arena/matchmaking.js
 * Decipher Language Learning Platform
 *
 * Pattern: vm.createContext() sandbox with CommonJS wrappers
 *
 * Coverage:
 *   - generateRoomCode: format, length, character set
 *   - createRoom: structure, defaults, collision retry
 *   - joinRoom: success, error cases (not found, full, self-join)
 *   - getRoom: returns correct room, normalises code case
 *   - closeRoom: marks status finished, returns bool
 *   - enqueuePlayer: adds to queue, updates existing entry
 *   - dequeueMatch: pairs within ELO_MATCH_RANGE, oldest-first
 *   - removeFromQueue: returns bool, removes entry
 *   - getQueueLength: reflects current queue size
 */

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

// ── Load module via vm sandbox ───────────────────────────────────────────────

const rawCode = fs.readFileSync(
  path.resolve(__dirname, '../modules/arena/matchmaking.js'), 'utf8'
).replace(/^export\s+/gm, '');

const wrappedCode = `(function() {
  ${rawCode}
  return {
    ROOM_EXPIRY_MS, ELO_MATCH_RANGE, ROOM_CODE_LENGTH, CODE_ALPHABET,
    generateRoomCode, createRoom, joinRoom, getRoom, closeRoom,
    enqueuePlayer, dequeueMatch, removeFromQueue, getQueueLength
  };
})()`;

// Provide globals the module uses
const sandbox = {
  Math, console, Date, Map, Set, setTimeout: (fn, ms) => {}, clearTimeout,
  Infinity, NaN, isNaN,
};
vm.createContext(sandbox);

const {
  ROOM_EXPIRY_MS, ELO_MATCH_RANGE, ROOM_CODE_LENGTH,
  generateRoomCode, createRoom, joinRoom, getRoom, closeRoom,
  enqueuePlayer, dequeueMatch, removeFromQueue, getQueueLength,
} = vm.runInContext(wrappedCode, sandbox);

// ── generateRoomCode ─────────────────────────────────────────────────────────

describe('matchmaking.js — generateRoomCode', () => {
  test('returns a string', () => {
    expect(typeof generateRoomCode()).toBe('string');
  });

  test('returns exactly 4 characters', () => {
    for (let i = 0; i < 20; i++) {
      expect(generateRoomCode()).toHaveLength(ROOM_CODE_LENGTH);
    }
  });

  test('code is all uppercase', () => {
    for (let i = 0; i < 20; i++) {
      const code = generateRoomCode();
      expect(code).toBe(code.toUpperCase());
    }
  });

  test('code contains only allowed characters (no I, O, 0, 1)', () => {
    const forbidden = /[IO01]/;
    for (let i = 0; i < 50; i++) {
      expect(generateRoomCode()).not.toMatch(forbidden);
    }
  });

  test('generates different codes on successive calls', () => {
    const codes = new Set();
    for (let i = 0; i < 20; i++) codes.add(generateRoomCode());
    // Not all 20 must be unique (birthday problem), but > 1 unique is expected
    expect(codes.size).toBeGreaterThan(1);
  });
});

// ── ROOM_EXPIRY_MS & ELO_MATCH_RANGE constants ───────────────────────────────

describe('matchmaking.js — constants', () => {
  test('ROOM_EXPIRY_MS is 5 minutes', () => {
    expect(ROOM_EXPIRY_MS).toBe(5 * 60 * 1000);
  });

  test('ELO_MATCH_RANGE is 200', () => {
    expect(ELO_MATCH_RANGE).toBe(200);
  });
});

// ── createRoom ───────────────────────────────────────────────────────────────

describe('matchmaking.js — createRoom', () => {
  test('returns an object with expected shape', () => {
    const room = createRoom('uid-host-1', 1400);
    expect(room).toMatchObject({
      code:     expect.stringMatching(/^[A-Z2-9]{4}$/),
      hostUid:  'uid-host-1',
      hostElo:  1400,
      guestUid: null,
      guestElo: null,
      status:   'waiting',
    });
  });

  test('code is 4 uppercase characters', () => {
    const room = createRoom('uid-host-2', 1200);
    expect(room.code).toHaveLength(4);
  });

  test('gameState has correct defaults', () => {
    const room = createRoom('uid-host-3', 1200);
    expect(room.gameState).toMatchObject({ hostHp: 100, guestHp: 100, turnCount: 0 });
  });

  test('defaults hostElo to 1200 when elo is not a number', () => {
    const room = createRoom('uid-host-4', 'invalid');
    expect(room.hostElo).toBe(1200);
  });

  test('throws TypeError if uid is falsy', () => {
    expect(() => createRoom(null, 1200)).toThrow(/uid is required/);
  });

  test('room is retrievable immediately via getRoom', () => {
    const room = createRoom('uid-host-5', 1200);
    const found = getRoom(room.code);
    expect(found).toBeDefined();
    expect(found.hostUid).toBe('uid-host-5');
  });
});

// ── joinRoom ─────────────────────────────────────────────────────────────────

describe('matchmaking.js — joinRoom', () => {
  test('successfully joins a waiting room', () => {
    const room = createRoom('host-uid-A', 1200);
    const result = joinRoom(room.code, 'guest-uid-A', 1300);
    expect(result.success).toBe(true);
    expect(result.room.guestUid).toBe('guest-uid-A');
    expect(result.room.status).toBe('ready');
  });

  test('returns error for non-existent room code', () => {
    const result = joinRoom('ZZZZ', 'guest-uid-B', 1200);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });

  test('returns error when trying to join own room', () => {
    const room = createRoom('host-uid-B', 1200);
    const result = joinRoom(room.code, 'host-uid-B', 1200);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/own room/i);
  });

  test('returns error when room is already full', () => {
    const room = createRoom('host-uid-C', 1200);
    joinRoom(room.code, 'guest-uid-C1', 1200);
    const result = joinRoom(room.code, 'guest-uid-C2', 1200);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/full|ready|active|waiting/i);
  });

  test('code lookup is case-insensitive', () => {
    const room = createRoom('host-uid-D', 1200);
    const result = joinRoom(room.code.toLowerCase(), 'guest-uid-D', 1200);
    expect(result.success).toBe(true);
  });

  test('guestElo defaults to 1200 for non-number elo', () => {
    const room = createRoom('host-uid-E', 1200);
    joinRoom(room.code, 'guest-uid-E', 'bad');
    expect(room.guestElo).toBe(1200);
  });
});

// ── getRoom ──────────────────────────────────────────────────────────────────

describe('matchmaking.js — getRoom', () => {
  test('returns undefined for unknown code', () => {
    expect(getRoom('XXXX')).toBeUndefined();
  });

  test('normalises lowercase code', () => {
    const room = createRoom('host-uid-F', 1200);
    const found = getRoom(room.code.toLowerCase());
    expect(found).toBeDefined();
  });
});

// ── closeRoom ────────────────────────────────────────────────────────────────

describe('matchmaking.js — closeRoom', () => {
  test('returns true for existing room', () => {
    const room = createRoom('host-uid-G', 1200);
    expect(closeRoom(room.code)).toBe(true);
  });

  test('room status becomes finished', () => {
    const room = createRoom('host-uid-H', 1200);
    closeRoom(room.code);
    expect(room.status).toBe('finished');
  });

  test('returns false for non-existent code', () => {
    expect(closeRoom('FAKE')).toBe(false);
  });
});

// ── Queue operations ─────────────────────────────────────────────────────────

describe('matchmaking.js — enqueuePlayer / getQueueLength', () => {
  test('queue length increases after enqueue', () => {
    const before = getQueueLength();
    enqueuePlayer('q-uid-1', 1200);
    expect(getQueueLength()).toBeGreaterThan(before);
    removeFromQueue('q-uid-1');
  });

  test('enqueue same uid updates entry (no duplicates)', () => {
    enqueuePlayer('q-uid-dup', 1200);
    enqueuePlayer('q-uid-dup', 1400);
    const before = getQueueLength();
    enqueuePlayer('q-uid-dup', 1300);
    expect(getQueueLength()).toBe(before);
    removeFromQueue('q-uid-dup');
  });

  test('throws TypeError for null uid', () => {
    expect(() => enqueuePlayer(null, 1200)).toThrow(/uid is required/);
  });
});

describe('matchmaking.js — dequeueMatch', () => {
  test('returns null when fewer than 2 players', () => {
    // Ensure queue is empty first
    removeFromQueue('no-exist-1');
    removeFromQueue('no-exist-2');
    expect(dequeueMatch()).toBeNull();
  });

  test('pairs two players within ELO_MATCH_RANGE', () => {
    enqueuePlayer('pair-uid-A', 1200);
    enqueuePlayer('pair-uid-B', 1300); // 100 point difference — within 200
    const match = dequeueMatch();
    expect(match).not.toBeNull();
    expect(match.playerA).toBeDefined();
    expect(match.playerB).toBeDefined();
    // Both should be one of our uids
    const uids = [match.playerA.uid, match.playerB.uid].sort();
    expect(uids).toContain('pair-uid-A');
    expect(uids).toContain('pair-uid-B');
  });

  test('removes paired players from queue', () => {
    enqueuePlayer('pair-uid-C', 1400);
    enqueuePlayer('pair-uid-D', 1450);
    const before = getQueueLength();
    dequeueMatch();
    expect(getQueueLength()).toBeLessThanOrEqual(before - 2);
  });
});

describe('matchmaking.js — removeFromQueue', () => {
  test('returns true when player was in queue', () => {
    enqueuePlayer('rm-uid-1', 1200);
    expect(removeFromQueue('rm-uid-1')).toBe(true);
  });

  test('returns false when player was not in queue', () => {
    expect(removeFromQueue('rm-uid-not-exist')).toBe(false);
  });

  test('queue length decreases after removal', () => {
    enqueuePlayer('rm-uid-2', 1200);
    const before = getQueueLength();
    removeFromQueue('rm-uid-2');
    expect(getQueueLength()).toBe(before - 1);
  });
});
