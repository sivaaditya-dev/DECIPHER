/**
 * leaderboard-ui.js — Dual Leaderboard Panel for Lexicon Coliseum
 * Decipher Language Learning Platform
 *
 * Renders a tabbed leaderboard panel showing two competitive views:
 *   Tab 1 — vs AI:     High scores from single-player vs-bot matches (existing)
 *   Tab 2 — vs Player: PvP Elo rankings fetched from /api/arena/leaderboard/pvp
 *
 * Also renders the current user's rank, Elo, and tier badge inline.
 *
 * Exports:
 *   renderLeaderboard(containerEl, user)
 *   refreshPvPLeaderboard(containerEl)
 */

import { getTierInfo, getTierIcon } from './elo.js';

const API_PVP_LEADERBOARD = '/api/arena/leaderboard/pvp';
const API_AI_LEADERBOARD  = '/api/challenge/leaderboard';

/**
 * Renders the full dual leaderboard panel into containerEl.
 *
 * @param {HTMLElement}  containerEl - Target DOM node
 * @param {Object|null}  user        - Firebase auth user (or null for guest)
 */
export async function renderLeaderboard(containerEl, user) {
  if (!containerEl) return;

  containerEl.innerHTML = `
<div class="lb-panel" id="lbPanel">
  <div class="lb-tabs" role="tablist">
    <button class="lb-tab lb-tab-active" id="tabAI"
            role="tab" aria-selected="true"  aria-controls="paneAI">🤖 vs AI</button>
    <button class="lb-tab"                  id="tabPvP"
            role="tab" aria-selected="false" aria-controls="panePvP">🌐 vs Player</button>
  </div>

  <div id="paneAI"  class="lb-pane lb-pane-active"  role="tabpanel" aria-labelledby="tabAI">
    <div class="lb-loading" id="aiLbLoading">Loading vs-AI scores…</div>
    <ol class="lb-list hidden" id="aiLbList"></ol>
    <div class="lb-empty hidden" id="aiLbEmpty">No scores yet — challenge a bot to get on the board!</div>
  </div>

  <div id="panePvP" class="lb-pane" role="tabpanel" aria-labelledby="tabPvP" hidden>
    <div class="lb-loading" id="pvpLbLoading">Loading PvP rankings…</div>
    <ol class="lb-list hidden" id="pvpLbList"></ol>
    <div class="lb-empty hidden" id="pvpLbEmpty">No PvP matches played yet — be the first!</div>
    <div class="lb-my-rank hidden" id="myRankRow"></div>
  </div>
</div>`;

  // Tab switching
  const tabAI  = containerEl.querySelector('#tabAI');
  const tabPvP = containerEl.querySelector('#tabPvP');
  const paneAI  = containerEl.querySelector('#paneAI');
  const panePvP = containerEl.querySelector('#panePvP');

  tabAI.addEventListener('click', () => {
    tabAI.classList.add('lb-tab-active');  tabAI.setAttribute('aria-selected', 'true');
    tabPvP.classList.remove('lb-tab-active'); tabPvP.setAttribute('aria-selected', 'false');
    paneAI.classList.add('lb-pane-active');  paneAI.hidden = false;
    panePvP.classList.remove('lb-pane-active'); panePvP.hidden = true;
  });

  tabPvP.addEventListener('click', () => {
    tabPvP.classList.add('lb-tab-active');  tabPvP.setAttribute('aria-selected', 'true');
    tabAI.classList.remove('lb-tab-active');  tabAI.setAttribute('aria-selected', 'false');
    panePvP.classList.add('lb-pane-active'); panePvP.hidden = false;
    paneAI.classList.remove('lb-pane-active'); paneAI.hidden = true;
  });

  // Load both boards in parallel
  await Promise.all([
    _loadAILeaderboard(containerEl),
    _loadPvPLeaderboard(containerEl, user),
  ]);
}

/**
 * Fetches and re-renders only the PvP leaderboard pane (call after a match ends).
 *
 * @param {HTMLElement}  containerEl
 * @param {Object|null}  user
 */
export async function refreshPvPLeaderboard(containerEl, user) {
  if (!containerEl) return;
  await _loadPvPLeaderboard(containerEl, user);
}

// ── Private Loaders ───────────────────────────────────────────────────────────

async function _loadAILeaderboard(containerEl) {
  const loading = containerEl.querySelector('#aiLbLoading');
  const list    = containerEl.querySelector('#aiLbList');
  const empty   = containerEl.querySelector('#aiLbEmpty');

  try {
    const res  = await fetch(API_AI_LEADERBOARD);
    const data = await res.json();
    const entries = Array.isArray(data) ? data : (data.entries || data.leaderboard || []);

    loading.classList.add('hidden');

    if (!entries.length) {
      empty.classList.remove('hidden');
      return;
    }

    list.innerHTML = entries.slice(0, 10).map((entry, i) => {
      const scoreVal = entry.score ?? entry.totalKg ?? entry.totalCorrect ?? entry.rankPoints ?? 0;
      const unit = (entry.totalKg != null || entry.score != null) ? 'kg' : 'pts';
      return `
      <li class="lb-row ${i < 3 ? 'lb-row-top' : ''}">
        <span class="lb-rank">${_rankMedal(i)}</span>
        <span class="lb-name">${_esc(entry.displayName || entry.uid || 'Anonymous')}</span>
        <span class="lb-score">${Number(scoreVal).toLocaleString()} ${unit}</span>
      </li>`;
    }).join('');
    list.classList.remove('hidden');
  } catch {
    if (loading) loading.textContent = 'Could not load vs-AI scores.';
  }
}

async function _loadPvPLeaderboard(containerEl, user) {
  const loading    = containerEl.querySelector('#pvpLbLoading');
  const list       = containerEl.querySelector('#pvpLbList');
  const empty      = containerEl.querySelector('#pvpLbEmpty');
  const myRankRow  = containerEl.querySelector('#myRankRow');

  try {
    const res  = await fetch(API_PVP_LEADERBOARD);
    const data = await res.json();
    const entries = Array.isArray(data) ? data : (data.rankings || []);

    loading.classList.add('hidden');

    if (!entries.length) {
      empty.classList.remove('hidden');
      return;
    }

    list.innerHTML = entries.slice(0, 10).map((entry, i) => {
      const tierInfo = getTierInfo(entry.elo || 1200);
      const isMe = user && entry.uid === user.uid;
      return `
      <li class="lb-row ${i < 3 ? 'lb-row-top' : ''} ${isMe ? 'lb-row-me' : ''}">
        <span class="lb-rank">${_rankMedal(i)}</span>
        <span class="lb-tier-icon" title="${tierInfo.name}">${tierInfo.icon}</span>
        <span class="lb-name">${_esc(entry.displayName || 'Anonymous')}${isMe ? ' (You)' : ''}</span>
        <span class="lb-elo">${entry.elo || 1200} Elo</span>
        <span class="lb-record">${entry.wins || 0}W / ${entry.losses || 0}L</span>
      </li>`;
    }).join('');
    list.classList.remove('hidden');

    // Show current user's rank if they're not in top 10
    if (user) {
      const myIdx = entries.findIndex(e => e.uid === user.uid);
      if (myIdx >= 10 && myIdx !== -1) {
        const myEntry = entries[myIdx];
        const tierInfo = getTierInfo(myEntry.elo || 1200);
        myRankRow.innerHTML = `
          <div class="lb-my-rank-label">Your rank: #${myIdx + 1}</div>
          <div>${tierInfo.icon} ${tierInfo.name} · ${myEntry.elo || 1200} Elo</div>`;
        myRankRow.classList.remove('hidden');
      }
    }
  } catch {
    if (loading) loading.textContent = 'Could not load PvP rankings.';
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _rankMedal(zeroIndex) {
  return ['🥇', '🥈', '🥉'][zeroIndex] || `#${zeroIndex + 1}`;
}

function _esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
