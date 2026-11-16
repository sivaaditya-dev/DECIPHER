/**
 * matchmaking.js — PvP Room-Code Generator & Matchmaking Session Manager
 * Decipher Language Learning Platform
 *
 * Manages in-memory matchmaking state for the Lexicon Coliseum PvP system:
 *   - 4-character alphanumeric room code generation
 *   - Private Duel room lifecycle (create → join → start → end)
 *   - Quick Match player queue with Elo proximity pairing (within 200 points)
 *   - Room state machine: 'waiting' → 'ready' → 'active' → 'finished'
 *
 * NOTE: This module is used server-side by server.js SSE routes.
 * All state is in-process memory; no persistence layer here.
 *
 * Exports:
 *   generateRoomCode()           → string (4-char uppercase alphanumeric)
 *   createRoom(uid, elo)         → RoomObject
 *   joinRoom(code, uid, elo)     → {success, room} | {error}
 *   getRoom(code)                → RoomObject | undefined
 *   closeRoom(code)              → boolean
 *   enqueuePlayer(uid, elo)      → void
 *   dequeueMatch()               → {playerA, playerB} | null
 *   removeFromQueue(uid)         → boolean
 *   getQueueLength()             → number
 *   ROOM_EXPIRY_MS               → 300000 (5 minutes)
 *   ELO_MATCH_RANGE              → 200
 */

export const ROOM_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
export const ELO_MATCH_RANGE = 200;
export const ROOM_CODE_LENGTH = 4;

// ── Code Generation ───────────────────────────────────────────────────────────

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, O, 0, 1 to avoid confusion

/**
 * Generates a random 4-character uppercase alphanumeric room code.
 * Excludes ambiguous characters (I, O, 0, 1).
 *
 * @returns {string} e.g. "APEX", "NX7Q"
 */
export function generateRoomCode() {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

// ── Room Store ────────────────────────────────────────────────────────────────

/** @type {Map<string, RoomObject>} */
const rooms = new Map();

/**
 * @typedef {Object} RoomObject
 * @property {string}   code       - 4-char room code
 * @property {string}   hostUid    - Firebase UID of room creator
 * @property {number}   hostElo    - Host's Elo at room creation
 * @property {string|null} guestUid   - Firebase UID of challenger (null until joined)
 * @property {number|null} guestElo   - Guest's Elo (null until joined)
 * @property {'waiting'|'ready'|'active'|'finished'} status
 * @property {number}   createdAt  - Unix ms timestamp
 * @property {Object}   gameState  - Live game state synced to both players
 */

/**
 * Creates a new Private Duel room.
 *
 * @param {string} uid - Firebase UID of room creator
 * @param {number} elo - Host's current Elo rating
 * @returns {RoomObject}
 */
export function createRoom(uid, elo) {
  if (!uid) throw new TypeError('uid is required');

  // Generate a unique code (retry up to 10 times on collision)
  let code;
  let attempts = 0;
  do {
    code = generateRoomCode();
    attempts++;
  } while (rooms.has(code) && attempts < 10);

  /** @type {RoomObject} */
  const room = {
    code,
    hostUid: uid,
    hostElo: typeof elo === 'number' ? elo : 1200,
    guestUid: null,
    guestElo: null,
    status: 'waiting',
    createdAt: Date.now(),
    gameState: {
      hostHp: 100,
      guestHp: 100,
      chain: [],
      lastWord: null,
      turnCount: 0,
    },
  };

  rooms.set(code, room);

  // Auto-expire the room after ROOM_EXPIRY_MS
  setTimeout(() => {
    if (rooms.has(code) && rooms.get(code).status === 'waiting') {
      rooms.delete(code);
    }
  }, ROOM_EXPIRY_MS);

  return room;
}

/**
 * Joins an existing Private Duel room.
 *
 * @param {string} code - Room code (case-insensitive)
 * @param {string} uid  - Firebase UID of joining player
 * @param {number} elo  - Guest's current Elo rating
 * @returns {{ success: true, room: RoomObject } | { success: false, error: string }}
 */
export function joinRoom(code, uid, elo) {
  const normalizedCode = (code || '').toUpperCase().trim();
  const room = rooms.get(normalizedCode);

  if (!room) {
    return { success: false, error: 'Room not found. Check the code and try again.' };
  }
  if (room.status !== 'waiting') {
    return { success: false, error: `Room is ${room.status} — cannot join now.` };
  }
  if (room.hostUid === uid) {
    return { success: false, error: 'You cannot join your own room.' };
  }

  room.guestUid = uid;
  room.guestElo = typeof elo === 'number' ? elo : 1200;
  room.status = 'ready';

  return { success: true, room };
}

/**
 * Retrieves a room by its code.
 *
 * @param {string} code
 * @returns {RoomObject | undefined}
 */
export function getRoom(code) {
  return rooms.get((code || '').toUpperCase().trim());
}

/**
 * Marks a room as finished and removes it from the store after a short delay.
 *
 * @param {string} code
 * @returns {boolean} true if room existed and was closed
 */
export function closeRoom(code) {
  const normalizedCode = (code || '').toUpperCase().trim();
  const room = rooms.get(normalizedCode);
  if (!room) return false;

  room.status = 'finished';
  // Keep for 60s so both players can read final state, then delete
  setTimeout(() => rooms.delete(normalizedCode), 60_000);
  return true;
}

// ── Quick Match Queue ─────────────────────────────────────────────────────────

/**
 * @typedef {Object} QueueEntry
 * @property {string} uid        - Firebase UID
 * @property {number} elo        - Current Elo
 * @property {number} enqueuedAt - Unix ms timestamp
 */

/** @type {Map<string, QueueEntry>} */
const matchQueue = new Map();

/**
 * Adds a player to the Quick Match queue.
 * If the player is already queued, updates their entry.
 *
 * @param {string} uid
 * @param {number} elo
 */
export function enqueuePlayer(uid, elo) {
  if (!uid) throw new TypeError('uid is required');
  matchQueue.set(uid, {
    uid,
    elo: typeof elo === 'number' ? elo : 1200,
    enqueuedAt: Date.now(),
  });
}

/**
 * Attempts to pair two queued players whose Elo difference is within ELO_MATCH_RANGE.
 * Prioritises the longest-waiting player as playerA.
 *
 * @returns {{ playerA: QueueEntry, playerB: QueueEntry } | null}
 */
export function dequeueMatch() {
  if (matchQueue.size < 2) return null;

  // Sort by wait time (oldest first)
  const entries = [...matchQueue.values()].sort((a, b) => a.enqueuedAt - b.enqueuedAt);

  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i];
      const b = entries[j];
      if (Math.abs(a.elo - b.elo) <= ELO_MATCH_RANGE) {
        matchQueue.delete(a.uid);
        matchQueue.delete(b.uid);
        return { playerA: a, playerB: b };
      }
    }
  }

  // No compatible pair found — widen search if oldest player has waited > 30s
  const oldest = entries[0];
  if (Date.now() - oldest.enqueuedAt > 30_000 && entries.length >= 2) {
    const opponent = entries[1];
    matchQueue.delete(oldest.uid);
    matchQueue.delete(opponent.uid);
    return { playerA: oldest, playerB: opponent };
  }

  return null;
}

/**
 * Removes a player from the Quick Match queue.
 *
 * @param {string} uid
 * @returns {boolean} true if the player was in the queue
 */
export function removeFromQueue(uid) {
  return matchQueue.delete(uid);
}

/**
 * Returns the current number of players waiting in the Quick Match queue.
 *
 * @returns {number}
 */
export function getQueueLength() {
  return matchQueue.size;
}
