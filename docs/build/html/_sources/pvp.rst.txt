.. _pvp:

⚔️ Lexicon Coliseum — Real-Time PvP System
==========================================

This chapter documents the **Week 2 PvP networking layer** added to Lexicon Coliseum:
real-time player-vs-player duels using Server-Sent Events, Chess-style Elo ratings,
and Firebase Firestore persistence.

.. contents:: Contents
   :depth: 3
   :local:

---

Architecture Overview
---------------------

The PvP system uses **Server-Sent Events (SSE)** for server→client push and
standard ``fetch`` POST calls for client→server actions.
No external WebSocket package is required — the system runs on the existing Express server.

.. code-block:: text

   Browser Tab A                 Express Server               Browser Tab B
   ─────────────                 ──────────────               ─────────────
   pvp-ui.js                     server.js                    pvp-ui.js
     │  Quick Match click         /api/arena/queue               │
     ├──POST /api/arena/queue ──► match pool                      │
     │                            pair when 2 players             │
     ◄── { roomCode: "APEX" } ──                                  │
     │                            SSE channels open:              │
     ├──GET /api/arena/room/APEX/stream ──────────────────────────┤
     │  word submitted             validate (anti-cheat)          │
     │                            broadcast game_state to both   │
     ◄── game_state event ───────                 ───────────────►┤
     │                            match_end → Elo update          │
     ◄── elo_update event ───────  Firestore.set(pvp_ratings)     │

SSE Event Protocol
~~~~~~~~~~~~~~~~~~

The server broadcasts the following **named SSE events** to all players in a room:

.. list-table::
   :header-rows: 1
   :widths: 20 40 40

   * - Event
     - Payload (JSON)
     - Description
   * - ``room_joined``
     - ``{ roomId, role }``
     - Sent on SSE connect. ``role`` is ``"host"`` or ``"guest"``.
   * - ``opponent_joined``
     - ``{ opponentName, roomId }``
     - Sent to the host when the second player connects.
   * - ``game_state``
     - ``{ lastWord, hostHp, guestHp, chain, turnCount }``
     - Broadcast after every valid word action.
   * - ``match_end``
     - ``{ winner, hostHp, guestHp }``
     - Broadcast when a player reaches 0 HP.
   * - ``heartbeat``
     - ``{ ts }``
     - Sent every 25 s to keep the SSE connection alive.
   * - ``error``
     - ``{ reason }``
     - Sent on room expiry or server-side error.

---

REST Endpoints
--------------

.. list-table::
   :header-rows: 1
   :widths: 10 35 55

   * - Method
     - Path
     - Description
   * - POST
     - ``/api/arena/room``
     - Create a Private Duel room. Returns ``{ roomCode }`` (4-char code).
   * - POST
     - ``/api/arena/room/:code/join``
     - Join a room by code. Returns ``{ success, roomCode }``.
   * - GET
     - ``/api/arena/room/:code/stream``
     - Open SSE stream. Query param: ``?uid=<Firebase UID>``.
   * - POST
     - ``/api/arena/room/:code/action``
     - Submit a word. Body: ``{ word, uid }``. Returns ``{ success, word }``.
   * - POST
     - ``/api/arena/queue``
     - Join Quick Match queue. Returns ``{ roomCode, role, opponentName, opponentElo }``
       if immediately paired, or ``{ queued: true, position }`` if waiting.
   * - GET
     - ``/api/arena/queue/stream``
     - Open SSE waiting stream while queued (``?uid=<Firebase UID>``); emits
       ``match_found`` as soon as a compatible opponent joins.
   * - POST
     - ``/api/arena/queue/leave``
     - Leave the Quick Match queue. Body: ``{ uid }``.
   * - GET
     - ``/api/arena/leaderboard/pvp``
     - Fetch top 50 PvP Elo rankings from Firestore.
   * - POST
     - ``/api/arena/match/end``
     - Persist final Elo ratings after a match. Body includes winner/loser UIDs
       and new Elo values computed on the client.

---

Elo Rating Engine (``modules/arena/elo.js``)
--------------------------------------------

The PvP ranking system uses a standard **FIDE Elo** formula adapted for vocabulary duels.

Formula
~~~~~~~

.. math::

   E_A = \frac{1}{1 + 10^{(R_B - R_A) / 400}}

   R'_A = R_A + K \times (S_A - E_A)

Where:

* :math:`E_A` — expected score for player A (probability of winning)
* :math:`R_A, R_B` — current Elo ratings
* :math:`K` — K-factor: ``32`` for ratings below 2100, ``16`` for ≥ 2100
* :math:`S_A` — actual score: ``1`` (win), ``0`` (loss), ``0.5`` (draw)

Tier Divisions
~~~~~~~~~~~~~~

.. list-table::
   :header-rows: 1
   :widths: 20 15 65

   * - Tier
     - Elo Range
     - Description
   * - 🥉 Bronze
     - 0 – 1199
     - Starting tier for all new players (default Elo: 1200).
   * - 🥈 Silver
     - 1200 – 1399
     - Consistently wins against Rookie-level bots.
   * - 🥇 Gold
     - 1400 – 1599
     - Comfortable with B1/B2 CEFR vocabulary duels.
   * - 💎 Platinum
     - 1600 – 1799
     - Regular C1 usage; defeats Scholar bots consistently.
   * - 💠 Diamond
     - 1800 – 1999
     - Approaches Grand Inquisitor territory.
   * - 👑 Grandmaster
     - 2000+
     - Elite vocabulary combatant. K-factor drops to 16 for rating stability.

---

Matchmaking (``modules/arena/matchmaking.js``)
----------------------------------------------

**Private Duel**

1. Player A calls ``POST /api/arena/room`` → receives a 4-char room code (e.g. ``APEX``).
2. Player A shares the code out-of-band (copy button in the UI).
3. Player B enters the code and calls ``POST /api/arena/room/APEX/join``.
4. Both players open ``GET /api/arena/room/APEX/stream``.

**Quick Match**

1. Player calls ``POST /api/arena/queue`` with their ``uid`` and ``elo``.
2. The server checks the queue for a compatible opponent (Elo within ±200).
3. If found → returns ``{ roomCode }`` immediately and both are connected.
4. If not found → returns ``{ queued: true }`` and the client listens for a
   ``room_joined`` SSE event (server pushes when a match is made).
5. After 30 seconds of waiting, the Elo constraint is relaxed and the
   longest-waiting player is paired with the next available opponent.

Room codes use an unambiguous character set (no ``I``, ``O``, ``0``, ``1``).
Rooms auto-expire after **5 minutes** if the second player never joins.

---

Anti-Cheat Validation (``modules/arena/anti-cheat.js``)
--------------------------------------------------------

Every word submitted via ``POST /api/arena/room/:code/action`` is validated
server-side before being accepted. The following rules are enforced:

.. list-table::
   :header-rows: 1
   :widths: 20 80

   * - Rule
     - Description
   * - ``RATE_LIMIT``
     - Maximum 1 word per 500 ms per player UID.
   * - ``TOO_SHORT``
     - Word must be ≥ 3 characters.
   * - ``TOO_LONG``
     - Word must be ≤ 45 characters.
   * - ``INVALID_CHARS``
     - Only lowercase alphabetic characters (``a–z``) are accepted.
   * - ``DUPLICATE``
     - A word already played in the current match is rejected.
   * - ``CHAIN_BREAK``
     - The word's first letter must match the last letter of the previous word.

---

Leaderboard (``modules/arena/leaderboard-ui.js``)
--------------------------------------------------

The dual-tab leaderboard panel renders two competitive views side by side
in the Coliseum lobby:

**vs AI tab** — Fetched from ``GET /api/challenge/leaderboard``.
Displays the top 10 single-player scores ranked by total iron-chain pull (kg).

**vs Player tab** — Fetched from ``GET /api/arena/leaderboard/pvp``.
Displays the top 10 PvP Elo rankings. Each row shows:

* Tier icon and name
* Player display name
* Current Elo rating
* Win / Loss record

If the authenticated user is ranked outside the top 10, their personal rank
is displayed below the main list.

---

PvP Client (``modules/arena/pvp-client.js``)
--------------------------------------------

``PvPClient`` is the browser-side connection manager for the SSE stream.

.. code-block:: javascript

   const client = new PvPClient(user.uid, currentElo);

   client.on('game_state', state => {
     renderPvPHUD(arenaRoot, { myHp: state.guestHp, oppHp: state.hostHp, ... });
   });

   client.on('match_end', result => {
     // Calculate Elo delta client-side, then POST to /api/arena/match/end
   });

   client.connect(roomCode); // Opens EventSource

**Reconnection**: exponential backoff starting at 1 s, doubling each attempt up to 30 s.
**Heartbeat**: if no ``heartbeat`` event is received within 45 s, the client
triggers a reconnect automatically.

---

Data Model (Firestore)
----------------------

Collection: ``pvp_ratings``

.. code-block:: text

   pvp_ratings/
     {uid}/
       displayName:  string
       elo:          number   (default 1200)
       wins:         number
       losses:       number
       lastMatchAt:  Timestamp

Writes use a **batch commit** (winner + loser in one atomic operation) via
``POST /api/arena/match/end`` to ensure the leaderboard always reflects
consistent paired outcomes.
