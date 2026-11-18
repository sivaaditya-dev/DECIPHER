/**
 * pvp-ui.js — PvP Lobby UI for Lexicon Coliseum
 * Decipher Language Learning Platform
 *
 * Renders the PvP lobby screen with two entry points:
 *   1. Quick Match — auto-pairs with a random opponent within ±200 Elo
 *   2. Private Duel — generates a 4-char room code to share with a friend
 *
 * Also handles the mid-match PvP HUD overlay (opponent HP bar, latency badge,
 * connection status pill) layered on top of the existing IronChain HUD.
 *
 * Exports:
 *   renderPvPLobby(rootEl, user, elo, callbacks)
 *   renderPvPHUD(rootEl, state)
 *   teardownPvPHUD()
 *   disconnectActivePvP()
 */

import { PvPClient } from './pvp-client.js';
import { getTierInfo } from './elo.js';

/** Active PvP client instance (singleton per session) */
let _pvpClient = null;
let _matchHandedOff = false;

/**
 * Renders the PvP lobby into the given root element.
 *
 * @param {HTMLElement} rootEl   - Container element (replaces coliseum lobby)
 * @param {Object|null} user     - Firebase auth user object (or null for guest)
 * @param {number}      elo      - Current player's Elo rating
 * @param {Object}      callbacks
 * @param {Function}    callbacks.onMatchStart  - Called with match session payload when match begins
 * @param {Function}    callbacks.onBackToLobby - Called when user clicks ← Back
 */
export function renderPvPLobby(rootEl, user, elo = 1200, callbacks = {}) {
  if (!rootEl) return;

  const uid = user?.uid || `guest_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const displayName = user?.displayName || user?.email?.split('@')[0] || 'Guest Duelist';
  const tierInfo = getTierInfo(elo);

  // Teardown any previous un-handed-off PvP client
  disconnectActivePvP();
  _matchHandedOff = false;
  _pvpClient = new PvPClient(uid, elo, displayName);

  rootEl.innerHTML = `
<div class="pvp-lobby" id="pvpLobby">
  <div class="pvp-lobby-header">
    <button class="pvp-back-btn" id="pvpBackBtn" aria-label="Back to lobby">← Back</button>
    <div class="pvp-logo">🌐</div>
    <h2 class="pvp-title">PvP ARENA</h2>
    <p class="pvp-subtitle">Your Elo: <strong>${elo}</strong>
      <span class="pvp-tier-badge">${tierInfo.icon} ${tierInfo.name}</span>
    </p>
  </div>

  <div class="pvp-mode-cards">

    <!-- Quick Match Card -->
    <div class="pvp-mode-card" id="quickMatchCard">
      <div class="pvp-mode-icon">⚡</div>
      <div class="pvp-mode-name">Quick Match</div>
      <div class="pvp-mode-desc">Auto-paired with an opponent within ±200 Elo.<br>Shortest wait time.</div>
      <button class="arena-btn arena-btn-primary pvp-action-btn" id="quickMatchBtn">
        Find Opponent
      </button>
      <div class="pvp-status hidden" id="quickMatchStatus">
        <span class="pvp-spinner">⏳</span>
        <span id="quickMatchStatusText">Searching for opponent...</span>
        <button class="arena-btn arena-btn-ghost pvp-cancel-btn" id="cancelQueueBtn">Cancel</button>
      </div>
    </div>

    <!-- Private Duel Card -->
    <div class="pvp-mode-card" id="privateDuelCard">
      <div class="pvp-mode-icon">🔗</div>
      <div class="pvp-mode-name">Private Duel</div>
      <div class="pvp-mode-desc">Create a room and share the code with a friend.</div>

      <div class="pvp-duel-actions">
        <button class="arena-btn arena-btn-primary pvp-action-btn" id="createRoomBtn">
          Create Room
        </button>
        <div class="pvp-or-divider">— or —</div>
        <div class="pvp-join-row">
          <input
            id="roomCodeInput"
            class="pvp-code-input"
            type="text"
            maxlength="4"
            placeholder="ENTER CODE"
            autocomplete="off"
            autocorrect="off"
            spellcheck="false"
            aria-label="4-character room code"
          />
          <button class="arena-btn arena-btn-ghost pvp-action-btn" id="joinRoomBtn">
            Join
          </button>
        </div>
      </div>

      <div class="pvp-room-code-display hidden" id="roomCodeDisplay">
        <div class="pvp-code-label">Share this code:</div>
        <div class="pvp-code-value" id="roomCodeValue">—</div>
        <div class="pvp-code-hint">Waiting for opponent to join...</div>
        <button class="arena-btn arena-btn-ghost pvp-action-btn" id="copyCodeBtn">📋 Copy</button>
      </div>
    </div>

  </div>

  <div class="pvp-error-banner hidden" id="pvpErrorBanner" role="alert"></div>
</div>`;

  _bindPvPLobbyEvents(rootEl, callbacks);
}

/**
 * Disconnects active PvP client if not handed off to a live match.
 */
export function disconnectActivePvP() {
  if (_pvpClient && !_matchHandedOff) {
    _pvpClient.leaveQueue();
    _pvpClient.disconnect();
    _pvpClient = null;
  }
}

/**
 * Binds all event handlers to the rendered PvP lobby.
 * @private
 */
function _bindPvPLobbyEvents(rootEl, callbacks) {
  const $ = id => rootEl.querySelector(`#${id}`);
  let matchLaunched = false;

  const launchOnce = (payload) => {
    if (matchLaunched || !_pvpClient) return;
    matchLaunched = true;
    _matchHandedOff = true;
    callbacks.onMatchStart?.({
      ...payload,
      pvpClient: _pvpClient,
    });
  };

  // ── Back button ─────────────────────────────────────────────────────────
  $('pvpBackBtn')?.addEventListener('click', () => {
    disconnectActivePvP();
    callbacks.onBackToLobby?.();
  });

  // ── Quick Match ─────────────────────────────────────────────────────────
  $('quickMatchBtn')?.addEventListener('click', async () => {
    $('quickMatchBtn').disabled = true;
    $('quickMatchStatus').classList.remove('hidden');

    const result = await _pvpClient.joinQueue();
    if (!result.ok) {
      _showPvPError(rootEl, result.reason || 'Could not join queue.');
      $('quickMatchBtn').disabled = false;
      $('quickMatchStatus').classList.add('hidden');
      return;
    }

    if (result.roomCode) {
      const statusText = $('quickMatchStatusText');
      if (statusText) statusText.textContent = `Room ${result.roomCode} — connecting to ${result.opponentName}...`;
      _pvpClient.on('opponent_joined', data => {
        launchOnce({
          roomCode: result.roomCode,
          role: data.role || result.role || 'guest',
          opponentName: data.opponentName || result.opponentName || 'Opponent',
          opponentElo: data.opponentElo || result.opponentElo || 1200,
          hostUid: data.hostUid,
          guestUid: data.guestUid,
        });
      });
    } else {
      // Queued — wait for match_found SSE, then opponent_joined
      _pvpClient.on('match_found', found => {
        const statusText = $('quickMatchStatusText');
        if (statusText) statusText.textContent = `Match found (${found.roomCode}) — syncing duel...`;
        _pvpClient.on('opponent_joined', data => {
          launchOnce({
            roomCode: found.roomCode,
            role: data.role || found.role || 'host',
            opponentName: data.opponentName || found.opponentName || 'Opponent',
            opponentElo: data.opponentElo || found.opponentElo || 1200,
            hostUid: data.hostUid,
            guestUid: data.guestUid,
          });
        });
      });
    }
  });

  $('cancelQueueBtn')?.addEventListener('click', async () => {
    await _pvpClient?.leaveQueue();
    $('quickMatchBtn').disabled = false;
    $('quickMatchStatus').classList.add('hidden');
  });

  // ── Private Duel — Create ───────────────────────────────────────────────
  $('createRoomBtn')?.addEventListener('click', async () => {
    $('createRoomBtn').disabled = true;
    const result = await _pvpClient.createPrivateRoom();

    if (!result.ok) {
      _showPvPError(rootEl, result.reason || 'Could not create room.');
      $('createRoomBtn').disabled = false;
      return;
    }

    const displayEl = $('roomCodeDisplay');
    displayEl.classList.remove('hidden');
    $('roomCodeValue').textContent = result.roomCode;

    _pvpClient.on('opponent_joined', data => {
      launchOnce({
        roomCode: result.roomCode,
        role: 'host',
        opponentName: data.opponentName || 'Challenger',
        opponentElo: data.opponentElo || 1200,
        hostUid: data.hostUid,
        guestUid: data.guestUid,
      });
    });
  });

  $('copyCodeBtn')?.addEventListener('click', () => {
    const code = $('roomCodeValue')?.textContent?.trim();
    if (code) navigator.clipboard?.writeText(code).catch(() => {});
  });

  // ── Private Duel — Join ─────────────────────────────────────────────────
  const codeInput = $('roomCodeInput');
  codeInput?.addEventListener('input', () => {
    codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  });

  $('joinRoomBtn')?.addEventListener('click', async () => {
    const code = codeInput?.value?.trim();
    if (!code || code.length !== 4) {
      _showPvPError(rootEl, 'Please enter a valid 4-character room code.');
      return;
    }

    $('joinRoomBtn').disabled = true;
    const result = await _pvpClient.joinPrivateRoom(code);

    if (!result.ok) {
      _showPvPError(rootEl, result.reason || 'Could not join room.');
      $('joinRoomBtn').disabled = false;
      return;
    }

    _pvpClient.on('opponent_joined', data => {
      launchOnce({
        roomCode: code,
        role: 'guest',
        opponentName: data.opponentName || result.opponentName || 'Host',
        opponentElo: data.opponentElo || result.opponentElo || 1200,
        hostUid: data.hostUid,
        guestUid: data.guestUid,
      });
    });
  });

  codeInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter') $('joinRoomBtn')?.click();
  });
}

/**
 * Shows an error banner in the PvP lobby.
 * @private
 */
function _showPvPError(rootEl, message) {
  const banner = rootEl.querySelector('#pvpErrorBanner');
  if (!banner) return;
  banner.textContent = `⚠️ ${message}`;
  banner.classList.remove('hidden');
  setTimeout(() => banner.classList.add('hidden'), 5000);
}

// ── Mid-Match PvP HUD ─────────────────────────────────────────────────────────

/**
 * @typedef {Object} PvPHUDState
 * @property {string}  opponentName     - Display name of the opponent
 * @property {number}  myHp             - Local player HP (0–100)
 * @property {number}  oppHp            - Opponent HP (0–100)
 * @property {string}  connectionStatus - 'connected' | 'reconnecting' | 'disconnected'
 * @property {number}  [eloChange]      - Provisional Elo delta (shown mid-match)
 */

let _pvpHudEl = null;

/**
 * Renders or updates the PvP HUD overlay over the existing IronChain HUD.
 *
 * @param {HTMLElement}  rootEl - Arena HUD root element
 * @param {PvPHUDState}  state
 */
export function renderPvPHUD(rootEl, state) {
  if (!rootEl) return;

  if (!_pvpHudEl) {
    _pvpHudEl = document.createElement('div');
    _pvpHudEl.id = 'pvpHudOverlay';
    _pvpHudEl.className = 'pvp-hud-overlay';
    rootEl.appendChild(_pvpHudEl);
  }

  const statusClass = {
    connected: 'pvp-status-ok',
    reconnecting: 'pvp-status-warn',
    disconnected: 'pvp-status-err',
  }[state.connectionStatus] || 'pvp-status-ok';

  const statusLabel = {
    connected: '🟢 Live',
    reconnecting: '🟡 Reconnecting...',
    disconnected: '🔴 Disconnected',
  }[state.connectionStatus] || '🟢 Live';

  _pvpHudEl.innerHTML = `
    <div class="pvp-opponent-panel">
      <span class="pvp-opp-name">👤 ${state.opponentName || 'Opponent'}</span>
      <div class="pvp-hp-bar-wrap">
        <div class="pvp-hp-bar" style="width:${Math.max(0, state.oppHp || 0)}%"></div>
      </div>
      <span class="pvp-hp-label">${Math.max(0, state.oppHp || 0)} HP</span>
    </div>
    <div class="pvp-connection-pill ${statusClass}">${statusLabel}</div>
    ${state.eloChange != null
      ? `<div class="pvp-elo-preview">${state.eloChange >= 0 ? '+' : ''}${state.eloChange} Elo</div>`
      : ''}`;
}

/**
 * Removes the PvP HUD overlay from the DOM.
 */
export function teardownPvPHUD() {
  if (_pvpHudEl) {
    _pvpHudEl.remove();
    _pvpHudEl = null;
  }
}
