/**
 * pvp-client.js — Browser-Side SSE PvP Client for Lexicon Coliseum
 * Decipher Language Learning Platform
 *
 * Manages the real-time connection between a browser player and the
 * Express SSE server routes. Uses EventSource for server→client push
 * and fetch POST for client→server actions.
 *
 * Features:
 *   - Automatic reconnection with exponential backoff (1s → 2s → 4s → 30s max)
 *   - Heartbeat monitoring — detects stale connections within 45 seconds
 *   - Queue SSE waiting stream for Quick Match opponent discovery
 *   - Typed event dispatcher (room_joined, opponent_joined, match_found,
 *     game_state, match_end, heartbeat, error)
 *   - Clean disconnect with no dangling listeners
 *
 * Exports:
 *   PvPClient class
 */

const SSE_BASE   = '/api/arena/room';
const QUEUE_BASE = '/api/arena/queue';
const MAX_BACKOFF_MS = 30_000;
const HEARTBEAT_TIMEOUT_MS = 45_000;

export class PvPClient {
  /**
   * @param {string} uid         - Firebase Auth UID of the local player
   * @param {number} elo         - Local player's current Elo (sent when queuing)
   * @param {string} displayName - Display name shown to opponents
   */
  constructor(uid, elo = 1200, displayName = 'Challenger') {
    this._uid         = uid;
    this._elo         = elo;
    this._displayName = displayName || 'Challenger';
    this._role        = null;      // 'host' | 'guest'
    this._roomCode    = null;
    this._source      = null;      // Room EventSource instance
    this._queueSource = null;      // Queue waiting EventSource instance
    this._listeners   = new Map(); // event → Set<handler>
    this._backoffMs   = 1000;
    this._reconnectTimer = null;
    this._heartbeatTimer = null;
    this._intentionalClose = false;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Opens an SSE connection to the given room.
   * Cleans up any existing connection first.
   *
   * @param {string} roomCode - 4-char room code
   */
  connect(roomCode) {
    this._closeQueueSSE();
    this._roomCode = String(roomCode || '').toUpperCase().trim();
    this._intentionalClose = false;
    this._backoffMs = 1000;
    this._openSSE();
  }

  /**
   * Closes all SSE connections intentionally (no reconnect).
   */
  disconnect() {
    this._intentionalClose = true;
    this._clearTimers();
    this._closeQueueSSE();
    if (this._source) {
      this._source.close();
      this._source = null;
    }
    this._roomCode = null;
    this._role = null;
  }

  /**
   * Submits a word action to the server for the current room.
   *
   * @param {string} word     - The word the player is submitting
   * @param {number} [weight] - Optional lexical pull weight from evaluateWord()
   * @returns {Promise<{ok: boolean, nextStartLetter?: string, reason?: string}>}
   */
  async sendAction(word, weight = 0) {
    if (!this._roomCode) return { ok: false, reason: 'Not in a room' };
    try {
      const res = await fetch(`${SSE_BASE}/${this._roomCode}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word: String(word || '').trim().toLowerCase(),
          uid: this._uid,
          weight: Number(weight) || 0,
        }),
      });
      const data = await res.json();
      return {
        ok: res.ok,
        nextStartLetter: data.nextStartLetter || null,
        reason: data.error || null,
      };
    } catch (err) {
      return { ok: false, reason: err.message };
    }
  }

  /**
   * Joins the Quick Match queue.
   * Opens the queue SSE waiting stream automatically if not immediately paired.
   *
   * @returns {Promise<{ok: boolean, roomCode?: string|null, role?: string, opponentName?: string, opponentElo?: number, reason?: string}>}
   */
  async joinQueue() {
    try {
      const res = await fetch(`${QUEUE_BASE}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: this._uid,
          elo: this._elo,
          displayName: this._displayName,
        }),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, reason: data.error || 'Queue error' };

      if (data.roomCode) {
        this._role = data.role || 'guest';
        this.connect(data.roomCode);
        return {
          ok: true,
          roomCode: data.roomCode,
          role: this._role,
          opponentName: data.opponentName || 'Opponent',
          opponentElo: data.opponentElo || 1200,
        };
      }

      // Not paired immediately — listen over queue SSE for match_found
      this._openQueueSSE();
      return { ok: true, roomCode: null };
    } catch (err) {
      return { ok: false, reason: err.message };
    }
  }

  /**
   * Leaves the Quick Match queue and closes any waiting queue stream.
   */
  async leaveQueue() {
    this._closeQueueSSE();
    try {
      await fetch(`${QUEUE_BASE}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: this._uid }),
      });
    } catch (_) {
      // Ignore network errors when leaving queue
    }
  }

  /**
   * Creates a new Private Duel room and connects to it.
   *
   * @returns {Promise<{ok: boolean, roomCode?: string, role?: string, reason?: string}>}
   */
  async createPrivateRoom() {
    try {
      const res = await fetch(`${SSE_BASE}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: this._uid,
          elo: this._elo,
          displayName: this._displayName,
        }),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, reason: data.error || 'Room creation failed' };
      this._role = 'host';
      this.connect(data.roomCode);
      return { ok: true, roomCode: data.roomCode, role: 'host' };
    } catch (err) {
      return { ok: false, reason: err.message };
    }
  }

  /**
   * Joins an existing Private Duel room by code.
   *
   * @param {string} code - 4-char room code (case-insensitive)
   * @returns {Promise<{ok: boolean, roomCode?: string, role?: string, opponentName?: string, opponentElo?: number, reason?: string}>}
   */
  async joinPrivateRoom(code) {
    try {
      const normalized = String(code || '').toUpperCase().trim();
      const res = await fetch(`${SSE_BASE}/${normalized}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: this._uid,
          elo: this._elo,
          displayName: this._displayName,
        }),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, reason: data.error || 'Join failed' };
      this._role = data.role || 'guest';
      this.connect(normalized);
      return {
        ok: true,
        roomCode: normalized,
        role: this._role,
        opponentName: data.opponentName || 'Host',
        opponentElo: data.opponentElo || 1200,
      };
    } catch (err) {
      return { ok: false, reason: err.message };
    }
  }

  /**
   * Registers an event listener.
   *
   * @param {string}   event   - SSE event name (e.g. 'game_state', 'match_end')
   * @param {Function} handler - Callback receiving the parsed event data
   */
  on(event, handler) {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event).add(handler);
  }

  /**
   * Removes a previously registered event listener.
   *
   * @param {string}   event
   * @param {Function} handler
   */
  off(event, handler) {
    this._listeners.get(event)?.delete(handler);
  }

  /** Returns the current room code, or null if not connected. */
  get roomCode()    { return this._roomCode; }
  get uid()         { return this._uid; }
  get elo()         { return this._elo; }
  get displayName() { return this._displayName; }
  get role()        { return this._role; }

  /** Returns true if the room SSE connection is open. */
  get isConnected() {
    return typeof EventSource !== 'undefined' && this._source?.readyState === EventSource.OPEN;
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  _openQueueSSE() {
    this._closeQueueSSE();
    if (typeof EventSource === 'undefined') return;

    const url = `${QUEUE_BASE}/stream?uid=${encodeURIComponent(this._uid)}`;
    this._queueSource = new EventSource(url);

    this._queueSource.addEventListener('match_found', (e) => {
      try {
        const data = JSON.parse(e.data);
        this._role = data.role || 'host';
        this.connect(data.roomCode);
        this._emit('match_found', data);
      } catch (err) {
        this._emit('error', { reason: err.message });
      }
    });
  }

  _closeQueueSSE() {
    if (this._queueSource) {
      this._queueSource.close();
      this._queueSource = null;
    }
  }

  _openSSE() {
    if (this._source) {
      this._source.close();
      this._source = null;
    }
    if (!this._roomCode || typeof EventSource === 'undefined') return;

    const url = `${SSE_BASE}/${this._roomCode}/stream?uid=${encodeURIComponent(this._uid)}`;
    this._source = new EventSource(url);

    this._source.onopen = () => {
      this._backoffMs = 1000; // Reset backoff on successful connect
      this._resetHeartbeatTimer();
    };

    this._source.onerror = () => {
      if (this._intentionalClose) return;
      this._scheduleReconnect();
    };

    // Bind all named SSE events
    const namedEvents = ['room_joined', 'opponent_joined', 'game_state', 'match_end', 'heartbeat', 'error'];
    namedEvents.forEach(evtName => {
      this._source.addEventListener(evtName, (e) => {
        if (evtName === 'heartbeat') this._resetHeartbeatTimer();
        if (evtName === 'room_joined') {
          try {
            const parsed = JSON.parse(e.data);
            if (parsed.role) this._role = parsed.role;
          } catch {}
        }
        try {
          const data = JSON.parse(e.data);
          this._emit(evtName, data);
        } catch {
          this._emit(evtName, e.data);
        }
      });
    });

    // Fallback: also handle unnamed 'message' events
    this._source.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        this._emit('message', data);
      } catch {
        this._emit('message', e.data);
      }
    };
  }

  _emit(event, data) {
    this._listeners.get(event)?.forEach(h => {
      try { h(data); } catch (err) { console.error(`[PvPClient] handler error (${event}):`, err); }
    });
  }

  _scheduleReconnect() {
    this._clearTimers();
    if (this._intentionalClose) return;
    this._reconnectTimer = setTimeout(() => {
      this._backoffMs = Math.min(this._backoffMs * 2, MAX_BACKOFF_MS);
      this._emit('reconnecting', { backoffMs: this._backoffMs });
      this._openSSE();
    }, this._backoffMs);
  }

  _resetHeartbeatTimer() {
    clearTimeout(this._heartbeatTimer);
    this._heartbeatTimer = setTimeout(() => {
      this._emit('error', { reason: 'Heartbeat timeout — reconnecting...' });
      this._scheduleReconnect();
    }, HEARTBEAT_TIMEOUT_MS);
  }

  _clearTimers() {
    clearTimeout(this._reconnectTimer);
    clearTimeout(this._heartbeatTimer);
    this._reconnectTimer = null;
    this._heartbeatTimer = null;
  }
}
