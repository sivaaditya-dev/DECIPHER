/**
 * coliseum-ui.js — Lexicon Coliseum Arena HUD & Main Controller
 * Decipher Language Learning Platform
 *
 * Orchestrates the full Coliseum experience:
 *   1. Lobby screen (bot selection)
 *   2. Arena HUD (tug-of-war, word input, arsenal panel, timer, combo display)
 *   3. Canvas chain visualizer (SVG/Canvas tension rope with spark particles)
 *   4. Integration with IronChainEngine, BotController, ArenaAudioEngine,
 *      LexicalWeight engine, and SRS deck injection
 *
 * Entry point: initColiseum(user)
 */

import { IronChainEngine, GAME_STATE, PHYSICS } from './iron-chain.js';
import { BotController, getBotRoster, BOT_ARCHETYPES } from './bot-controller.js';
import { evaluateWord } from './lexical-weight.js';
import { ArenaAudioEngine } from './audio-sfx.js';
import { showVictoryModal, showDefeatModal } from './trophy-modal.js';
import { renderPvPLobby, renderPvPHUD, teardownPvPHUD, disconnectActivePvP } from './pvp-ui.js';
import { renderLeaderboard } from './leaderboard-ui.js';
import { calculateElo, getTier, DEFAULT_ELO } from './elo.js';

// ── State ──────────────────────────────────────────────────────────────────
let engine        = null;
let botController = null;
let audioEngine   = new ArenaAudioEngine();
let selectedBotId = null;
let currentUser   = null;
let dueCards      = [];
let arsenalWords  = [];
let shakeActive   = false;
let pvpTension    = 0.5;
let playerElo     = DEFAULT_ELO;

// Canvas state
let canvasEl      = null;
let canvasCtx     = null;
let sparks        = [];
let rafCanvasId   = null;

// ── Entry Point ────────────────────────────────────────────────────────────

/**
 * Main entry point. Called by main.js when user navigates to coliseumView.
 * @param {Object|null} user - Firebase auth user or null for guest
 */
export function initColiseum(user) {
  currentUser = user;
  loadDueCards();
  renderLobby();
}

// ── SRS Due Card Injection ─────────────────────────────────────────────────

/**
 * Loads the user's due SRS cards from IndexedDB (or localStorage fallback).
 * Injects them as bonus high-weight Arsenal targets.
 */
async function loadDueCards() {
  try {
    // Dynamically import storage adapter to avoid circular deps
    const { getDB, STORES } = await import('../storage-idb.js');
    const db = await getDB();
    const tx = db.transaction(STORES.CARDS, 'readonly');
    const store = tx.objectStore(STORES.CARDS);
    const now = Date.now();
    const req = store.getAll();
    req.onsuccess = () => {
      dueCards = (req.result || []).filter(c => !c.dueDate || new Date(c.dueDate) <= new Date(now));
    };
  } catch (_) {
    dueCards = []; // Graceful fallback: no SRS bonus in guest mode
  }
}

// ── Lobby Rendering ────────────────────────────────────────────────────────

function renderLobby() {
  teardownPvPHUD();
  disconnectActivePvP();
  const root = document.getElementById('coliseumRoot');
  if (!root) return;

  const bots = getBotRoster();
  root.innerHTML = `
    <div class="coliseum-lobby">
      <div class="coliseum-lobby-header">
        <div class="coliseum-logo">⚔️</div>
        <h1 class="coliseum-title">LEXICON COLISEUM</h1>
        <p class="coliseum-subtitle">45 seconds. One chain. No mercy.</p>
      </div>

      <div class="coliseum-mode-tabs" role="tablist">
        <button class="coliseum-mode-tab coliseum-tab-active" id="tabVsAI"
                role="tab" aria-selected="true">🤖 vs AI</button>
        <button class="coliseum-mode-tab" id="tabVsPlayer"
                role="tab" aria-selected="false">🌐 vs Player</button>
        <button class="coliseum-mode-tab" id="tabLeaderboard"
                role="tab" aria-selected="false">🏆 Leaderboard</button>
      </div>

      <div id="coliseumAiSection">
        <div class="coliseum-mode-label" id="vsAILabel">⛓️ IRON CHAIN — Choose Your Opponent</div>

        <div class="bot-roster">
          ${bots.map(bot => `
            <button class="bot-card" data-bot="${bot.id}" aria-label="Challenge ${bot.name}">
              <div class="bot-avatar">${bot.avatarEmoji}</div>
              <div class="bot-tier-badge">${bot.icon}</div>
              <div class="bot-name">${bot.name}</div>
              <div class="bot-tiers">${bot.tiers.join(' · ')}</div>
              <div class="bot-desc">${bot.description}</div>
              <div class="bot-cta">Challenge →</div>
            </button>
          `).join('')}
        </div>

        ${dueCards.length > 0 ? `
          <div class="srs-injection-notice">
            ⭐ ${dueCards.length} SRS due card${dueCards.length !== 1 ? 's' : ''} injected as bonus Arsenal targets
          </div>` : ''}
      </div>

      <div id="coliseumSubView" class="hidden"></div>
    </div>`;

  // Bind bot card clicks
  root.querySelectorAll('.bot-card').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedBotId = btn.dataset.bot;
      startMatch(selectedBotId);
    });
  });

  // ── Mode tab switching ────────────────────────────────────────────────────
  const tabVsAI     = root.querySelector('#tabVsAI');
  const tabVsPlayer = root.querySelector('#tabVsPlayer');
  const tabLB       = root.querySelector('#tabLeaderboard');
  const aiSection   = root.querySelector('#coliseumAiSection');
  const subView     = root.querySelector('#coliseumSubView');

  function _activateTab(activeTab) {
    [tabVsAI, tabVsPlayer, tabLB].forEach(t => {
      if (t) { t.classList.remove('coliseum-tab-active'); t.setAttribute('aria-selected', 'false'); }
    });
    activeTab.classList.add('coliseum-tab-active');
    activeTab.setAttribute('aria-selected', 'true');
  }

  tabVsAI?.addEventListener('click', () => {
    _activateTab(tabVsAI);
    disconnectActivePvP();
    if (aiSection) aiSection.style.display = '';
    if (subView) { subView.innerHTML = ''; subView.classList.add('hidden'); }
  });

  tabVsPlayer?.addEventListener('click', () => {
    _activateTab(tabVsPlayer);
    if (aiSection) aiSection.style.display = 'none';
    if (subView) {
      subView.classList.remove('hidden');
      renderPvPLobby(subView, currentUser, playerElo, {
        onBackToLobby: () => { tabVsAI?.click(); },
        onMatchStart: (session) => { startPvPMatch(session); },
      });
    }
  });

  tabLB?.addEventListener('click', () => {
    _activateTab(tabLB);
    disconnectActivePvP();
    if (aiSection) aiSection.style.display = 'none';
    if (subView) {
      subView.classList.remove('hidden');
      renderLeaderboard(subView, currentUser);
    }
  });
}

/**
 * Starts a live PvP Iron Chain match over SSE using the matched PvPClient.
 * @param {Object} session - { roomCode, role, opponentName, opponentElo, hostUid, guestUid, pvpClient }
 */
function startPvPMatch(session) {
  const { roomCode, role, opponentName, opponentElo = DEFAULT_ELO, pvpClient } = session || {};
  if (!pvpClient) return renderLobby();

  const root = document.getElementById('coliseumRoot');
  if (!root) return;

  pvpTension = 0.5;
  const isHost = role === 'host';
  const myWords = [];
  const oppWords = [];
  const matchStartMs = Date.now();
  let connectionStatus = 'connected';
  let myHp = 100;
  let oppHp = 100;

  root.innerHTML = `
    <div class="arena-hud" id="arenaHud">
      <div class="arena-header">
        <div class="arena-player-side">
          <div class="arena-avatar">👤</div>
          <div class="arena-player-label">YOU (${playerElo})</div>
        </div>
        <div class="arena-center-panel">
          <div class="arena-timer" id="arenaTimer">LIVE · ${roomCode}</div>
        </div>
        <div class="arena-bot-side">
          <div class="arena-avatar">🌐</div>
          <div class="arena-bot-label">${opponentName} (${opponentElo})</div>
        </div>
      </div>

      <div class="chain-canvas-wrapper">
        <canvas id="chainCanvas" class="chain-canvas" aria-hidden="true"></canvas>
        <div class="chain-tension-label player-side-label">◄ YOUR PULL</div>
        <div class="chain-tension-label bot-side-label">${opponentName.toUpperCase()} ►</div>
      </div>

      <div class="arena-input-section">
        <div class="arena-feedback" id="arenaFeedback">
          Duel live! Type any English word (3+ letters) to pull the chain...
        </div>
        <div class="arena-input-row">
          <input
            id="arenaInput"
            class="arena-input"
            type="text"
            placeholder="Type a chained word..."
            autocomplete="off"
            autocorrect="off"
            spellcheck="false"
            aria-label="PvP word input field"
            maxlength="45"
          />
          <button id="arenaSubmit" class="arena-btn arena-btn-primary">Pull ⛓️</button>
        </div>
        <div class="arena-score-row">
          <span>Your Pull: <strong id="playerPullKg">0 kg</strong></span>
          <span>Opponent Pull: <strong id="botPullKg">0 kg</strong></span>
        </div>
      </div>
    </div>`;

  const hudEl = document.getElementById('arenaHud');
  renderPvPHUD(hudEl, { opponentName, myHp, oppHp, connectionStatus });

  // Canvas draw loop synced to pvpTension
  canvasEl = document.getElementById('chainCanvas');
  if (canvasEl) {
    canvasCtx = canvasEl.getContext('2d');
    resizeCanvas();
    const pvpLoop = () => {
      if (!document.getElementById('chainCanvas')) return;
      drawChain(pvpTension);
      rafCanvasId = requestAnimationFrame(pvpLoop);
    };
    pvpLoop();
  }

  audioEngine.init();

  const input  = document.getElementById('arenaInput');
  const submit = document.getElementById('arenaSubmit');
  const fb     = document.getElementById('arenaFeedback');

  const submitWord = async () => {
    const word = (input?.value || '').trim();
    if (!word) return;
    audioEngine.resume();
    const evalResult = evaluateWord(word, dueCards);
    submit.disabled = true;
    const res = await pvpClient.sendAction(word, evalResult.weight);
    submit.disabled = false;
    if (!res.ok) {
      if (fb) {
        fb.textContent = `⚠️ ${res.reason || 'Rejected'}`;
        fb.classList.add('feedback-filler');
      }
      audioEngine.playFillerFreeze();
      return;
    }
    if (input) { input.value = ''; input.focus(); }
  };

  submit?.addEventListener('click', submitWord);
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); submitWord(); }
  });

  pvpClient.on('heartbeat', () => {
    connectionStatus = 'connected';
    renderPvPHUD(hudEl, { opponentName, myHp, oppHp, connectionStatus });
  });

  pvpClient.on('reconnecting', () => {
    connectionStatus = 'reconnecting';
    renderPvPHUD(hudEl, { opponentName, myHp, oppHp, connectionStatus });
  });

  pvpClient.on('game_state', (state) => {
    const serverTension = typeof state.tension === 'number' ? state.tension : 0.5;
    // Host pulls toward 0.0, Guest sees mirrored tension (1.0 - tension) so left is always "YOU"
    pvpTension = isHost ? serverTension : (1 - serverTension);
    myHp  = isHost ? state.hostHp  : state.guestHp;
    oppHp = isHost ? state.guestHp : state.hostHp;

    const myKg  = isHost ? (state.hostPullKg || 0)  : (state.guestPullKg || 0);
    const oppKg = isHost ? (state.guestPullKg || 0) : (state.hostPullKg || 0);
    const myEl  = document.getElementById('playerPullKg');
    const oppEl = document.getElementById('botPullKg');
    if (myEl)  myEl.textContent  = `${myKg.toLocaleString()} kg`;
    if (oppEl) oppEl.textContent = `${oppKg.toLocaleString()} kg`;

    if (state.lastWord) {
      const evalWord = evaluateWord(state.lastWord, dueCards);
      if (state.lastUid === pvpClient.uid) {
        myWords.push(evalWord);
        if (evalWord.tier === 'C2') { audioEngine.playCriticalHit(); triggerScreenShake(); }
        else audioEngine.playChainClank();
      } else {
        oppWords.push(evalWord);
        audioEngine.playChainClank();
      }
    }

    if (canvasEl) {
      emitSparks(30 + (canvasEl.width - 60) * pvpTension, canvasEl.height / 2, 7);
    }

    if (fb && state.nextStartLetter) {
      fb.classList.remove('feedback-filler');
      fb.textContent = `Played "${state.lastWord}" — next word must start with "${state.nextStartLetter}"`;
    }

    renderPvPHUD(hudEl, { opponentName, myHp, oppHp, connectionStatus });
  });

  pvpClient.on('match_end', async (endData) => {
    if (rafCanvasId) { cancelAnimationFrame(rafCanvasId); rafCanvasId = null; }
    teardownPvPHUD();

    const didWin = endData.winner === pvpClient.uid;
    const eloOutcome = didWin ? 1 : 0;
    const eloCalc = calculateElo(playerElo, opponentElo, eloOutcome);
    const prevElo = playerElo;
    playerElo = eloCalc.newA;

    const eloResult = {
      deltaA: eloCalc.deltaA,
      newA: eloCalc.newA,
      tier: getTier(eloCalc.newA),
    };

    if (didWin) {
      // Persist Elo once from winner's side
      const oppUid = session.hostUid === pvpClient.uid ? session.guestUid : session.hostUid;
      fetch('/api/arena/match/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          winnerUid: pvpClient.uid,
          loserUid: oppUid || 'opponent',
          winnerEloNew: eloCalc.newA,
          loserEloNew: eloCalc.newB,
          winnerDelta: eloCalc.deltaA,
          loserDelta: eloCalc.deltaB,
          winnerDisplayName: pvpClient.displayName,
          loserDisplayName: opponentName,
        }),
      }).catch(() => {});
    }

    pvpClient.disconnect();

    const stats = {
      playerWords: myWords,
      botWords: oppWords,
      playerTotalKg: isHost ? (endData.hostPullKg || 0) : (endData.guestPullKg || 0),
      botTotalKg: isHost ? (endData.guestPullKg || 0) : (endData.hostPullKg || 0),
      maxCombo: myWords.length,
      durationMs: Date.now() - matchStartMs,
      result: didWin ? 'player' : 'bot',
      prevElo,
    };

    const returnToPvP = () => {
      renderLobby();
      document.getElementById('tabVsPlayer')?.click();
    };

    if (didWin) {
      audioEngine.playVictoryFanfare();
      showVictoryModal(stats, 'scholar', opponentName, returnToPvP, renderLobby, eloResult);
    } else {
      audioEngine.playDefeatThud();
      showDefeatModal(stats, 'scholar', opponentName, returnToPvP, renderLobby, eloResult);
    }
  });
}

// ── Arena HUD ──────────────────────────────────────────────────────────────

/**
 * Renders the full Arena HUD and starts a match.
 * @param {string} botId
 */
function startMatch(botId) {
  const bot = BOT_ARCHETYPES[botId];
  if (!bot) return;

  // Build arsenal: 3 words from SRS due cards + CEFR bank supplement
  arsenalWords = buildArsenal(botId);

  const root = document.getElementById('coliseumRoot');
  root.innerHTML = `
    <div class="arena-hud" id="arenaHud">

      <!-- Header: avatars, timer, tension meter -->
      <div class="arena-header">
        <div class="arena-player-side">
          <div class="arena-avatar">👤</div>
          <div class="arena-player-label">YOU</div>
        </div>
        <div class="arena-center-panel">
          <div class="arena-timer" id="arenaTimer">0:45</div>
          <div class="arena-countdown-overlay hidden" id="arenaCountdown"></div>
        </div>
        <div class="arena-bot-side">
          <div class="arena-avatar">${bot.avatarEmoji}</div>
          <div class="arena-bot-label">${bot.icon} ${bot.name}</div>
        </div>
      </div>

      <!-- Iron Chain Canvas -->
      <div class="chain-canvas-wrapper">
        <canvas id="chainCanvas" class="chain-canvas" aria-hidden="true"></canvas>
        <div class="chain-tension-label player-side-label">◄ YOUR PULL</div>
        <div class="chain-tension-label bot-side-label">BOT PULL ►</div>
      </div>

      <!-- Arsenal Panel -->
      <div class="arsenal-panel" id="arsenalPanel">
        <div class="arsenal-label">🎯 ARSENAL — Deploy these words for bonus weight</div>
        <div class="arsenal-pills" id="arsenalPills">
          ${arsenalWords.map(w => `
            <span class="arsenal-pill" data-word="${w.word}" title="${w.def}">
              <span class="arsenal-tier">${w.tier || ''}</span>
              ${w.word}
            </span>`).join('')}
        </div>
      </div>

      <!-- Input + Feedback -->
      <div class="arena-input-section">
        <div class="combo-display hidden" id="comboDisplay"></div>
        <div class="arena-feedback" id="arenaFeedback">Type a word and press Enter to pull the chain...</div>
        <div class="arena-input-row">
          <input
            id="arenaInput"
            class="arena-input"
            type="text"
            placeholder="Type a word..."
            autocomplete="off"
            autocorrect="off"
            spellcheck="false"
            aria-label="Word input field"
            maxlength="40"
          />
          <button id="arenaSubmit" class="arena-btn arena-btn-primary">Pull ⛓️</button>
        </div>
        <div class="arena-score-row">
          <span>Your Pull: <strong id="playerPullKg">0 kg</strong></span>
          <span>Bot Pull: <strong id="botPullKg">0 kg</strong></span>
        </div>
      </div>

    </div>`;

  // Set up canvas
  setupCanvas();

  // Set up engine
  engine = new IronChainEngine({
    onTensionChange: handleTensionChange,
    onPlayerWord:    handlePlayerWord,
    onBotWord:       handleBotWord,
    onCombo:         handleCombo,
    onCountdown:     handleCountdown,
    onTick:          handleTick,
    onMatchEnd:      handleMatchEnd,
    onShake:         triggerScreenShake,
  });

  // Set up bot
  botController = new BotController(botId, (word) => {
    const result = evaluateWord(word, dueCards);
    engine.submitBotWord(result);
  });

  // Bind input
  const input  = document.getElementById('arenaInput');
  const submit = document.getElementById('arenaSubmit');

  const handleSubmit = () => {
    const word = (input.value || '').trim();
    if (!word) return;
    if (engine.state !== GAME_STATE.BATTLE) return;
    audioEngine.resume();
    const result = evaluateWord(word, dueCards);
    engine.submitPlayerWord(result);
    input.value = '';
    input.focus();
  };

  submit.addEventListener('click', handleSubmit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); }
  });

  // Init audio (requires user gesture — click on bot card counts)
  audioEngine.init();

  // Start match
  engine.startMatch();
  botController.start(PHYSICS.MATCH_DURATION_MS + PHYSICS.COUNTDOWN_DURATION_MS);
}

// ── Arsenal Builder ────────────────────────────────────────────────────────

/**
 * Builds a 3-word arsenal prioritising SRS due cards, then CEFR bank.
 * @param {string} botId
 * @returns {Array}
 */
function buildArsenal(botId) {
  const bot = BOT_ARCHETYPES[botId];
  const { getWordsForTiers } = require('./cefr-bank.js'); // dynamic require for lazy load
  const pool = getWordsForTiers(['B2', 'C1', 'C2']); // Arsenal always draws from high tiers

  // Inject due SRS cards first (up to 3)
  const srsSlots = dueCards.slice(0, 3).map(c => ({
    word: c.word,
    def:  c.definition || c.def || '',
    tier: 'SRS ⭐',
  }));

  if (srsSlots.length >= 3) return srsSlots;

  // Supplement from CEFR bank
  const shuffled = pool.sort(() => Math.random() - 0.5);
  return [...srsSlots, ...shuffled.slice(0, 3 - srsSlots.length)];
}

// ── Canvas Chain Visualizer ────────────────────────────────────────────────

function setupCanvas() {
  canvasEl = document.getElementById('chainCanvas');
  if (!canvasEl) return;
  canvasCtx = canvasEl.getContext('2d');
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  drawLoop();
}

function resizeCanvas() {
  if (!canvasEl) return;
  const wrapper = canvasEl.parentElement;
  canvasEl.width  = wrapper.clientWidth  || 600;
  canvasEl.height = wrapper.clientHeight || 160;
}

function drawLoop() {
  if (rafCanvasId) cancelAnimationFrame(rafCanvasId);
  rafCanvasId = requestAnimationFrame(() => {
    drawChain(engine ? engine.tension : 0.5);
    drawLoop();
  });
}

/**
 * Draws the tension rope and spark particles on the canvas.
 * @param {number} tension - [0.0, 1.0]
 */
function drawChain(tension) {
  if (!canvasCtx || !canvasEl) return;
  const W = canvasEl.width;
  const H = canvasEl.height;
  canvasCtx.clearRect(0, 0, W, H);

  // Rope endpoints
  const leftX  = 30;
  const rightX = W - 30;
  const midY   = H / 2;

  // Anchor position (moves with tension)
  const anchorX = leftX + (rightX - leftX) * tension;

  // Rope sag — increases when tension is near extremes
  const sagAmount = Math.sin(Math.PI * tension) * (H * 0.25);
  const ctrlY     = midY + sagAmount;

  // Rope colour: green (player winning) → yellow (even) → red (bot winning)
  const r = Math.round(255 * tension);
  const g = Math.round(255 * (1 - Math.abs(tension - 0.5) * 2));
  const b = 60;
  canvasCtx.strokeStyle = `rgb(${r},${g},${b})`;
  canvasCtx.lineWidth   = 4;
  canvasCtx.shadowBlur  = 12;
  canvasCtx.shadowColor = `rgb(${r},${g},${b})`;

  // Draw rope (bezier curve)
  canvasCtx.beginPath();
  canvasCtx.moveTo(leftX, midY);
  canvasCtx.quadraticCurveTo(anchorX, ctrlY, rightX, midY);
  canvasCtx.stroke();

  // Anchor glow node
  canvasCtx.shadowBlur = 20;
  canvasCtx.fillStyle  = '#ffffff';
  canvasCtx.beginPath();
  canvasCtx.arc(anchorX, midY + (sagAmount / 2), 8, 0, Math.PI * 2);
  canvasCtx.fill();

  // Player side anchor
  canvasCtx.fillStyle = '#00ff88';
  canvasCtx.shadowColor = '#00ff88';
  canvasCtx.beginPath();
  canvasCtx.arc(leftX, midY, 10, 0, Math.PI * 2);
  canvasCtx.fill();

  // Bot side anchor
  canvasCtx.fillStyle = '#ff4466';
  canvasCtx.shadowColor = '#ff4466';
  canvasCtx.beginPath();
  canvasCtx.arc(rightX, midY, 10, 0, Math.PI * 2);
  canvasCtx.fill();

  // Spark particles
  drawSparks(anchorX, midY + (sagAmount / 2));
  updateSparks();

  canvasCtx.shadowBlur = 0;
}

function emitSparks(x, y, count = 6) {
  for (let i = 0; i < count; i++) {
    sparks.push({
      x, y,
      vx: (Math.random() - 0.5) * 6,
      vy: (Math.random() - 1.5) * 4,
      life: 1.0,
      decay: 0.04 + Math.random() * 0.06,
      size: 2 + Math.random() * 3,
    });
  }
}

function updateSparks() {
  sparks = sparks.filter(s => s.life > 0).map(s => ({
    ...s,
    x: s.x + s.vx,
    y: s.y + s.vy,
    vy: s.vy + 0.2, // gravity
    life: s.life - s.decay,
  }));
}

function drawSparks(anchorX, anchorY) {
  sparks.forEach(s => {
    canvasCtx.globalAlpha = s.life;
    canvasCtx.fillStyle = `hsl(${40 + s.life * 60}, 100%, 70%)`;
    canvasCtx.beginPath();
    canvasCtx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
    canvasCtx.fill();
  });
  canvasCtx.globalAlpha = 1.0;
}

// ── Engine Callbacks ───────────────────────────────────────────────────────

function handleTensionChange(tension, source) {
  if (source === 'player' || source === 'bot') {
    // Emit sparks at anchor
    if (canvasEl && engine) {
      const W = canvasEl.width;
      const anchorX = 30 + (W - 60) * tension;
      emitSparks(anchorX, canvasEl.height / 2, source === 'player' ? 8 : 5);
    }
  }
}

function handlePlayerWord(result) {
  const fb = document.getElementById('arenaFeedback');
  if (fb) {
    fb.textContent = result.feedback;
    fb.classList.remove('feedback-filler', 'feedback-elite', 'feedback-normal');
    if (result.isFiller) fb.classList.add('feedback-filler');
    else if (result.tier === 'C2' || result.tier === 'C1') fb.classList.add('feedback-elite');
    else fb.classList.add('feedback-normal');
  }

  // Update score
  const kgEl = document.getElementById('playerPullKg');
  if (kgEl && engine) kgEl.textContent = `${engine.stats.playerTotalKg.toLocaleString()} kg`;

  // SFX
  if (result.isFiller) audioEngine.playFillerFreeze();
  else if (result.tier === 'C2') audioEngine.playCriticalHit();
  else audioEngine.playChainClank();

  // Mark arsenal pill as deployed
  if (!result.isFiller && !result.tier === 'unknown') {
    const pill = document.querySelector(`[data-word="${result.word}"]`);
    if (pill) pill.classList.add('deployed');
  }
}

function handleBotWord(result) {
  const kgEl = document.getElementById('botPullKg');
  if (kgEl && engine) kgEl.textContent = `${engine.stats.botTotalKg.toLocaleString()} kg`;
}

function handleCombo(count) {
  const el = document.getElementById('comboDisplay');
  if (!el) return;
  el.textContent = `⚡ COMBO ×${count}!`;
  el.classList.remove('hidden');
  el.classList.add('combo-flash');
  setTimeout(() => el.classList.remove('combo-flash'), 400);
  if (count >= 3) audioEngine.playComboChime();
}

function handleCountdown(count) {
  const overlay = document.getElementById('arenaCountdown');
  if (!overlay) return;
  overlay.classList.remove('hidden');
  overlay.textContent = count === 0 ? '⚔️ GO!' : count;
  if (count === 0) {
    setTimeout(() => overlay.classList.add('hidden'), 800);
    // Enable input
    const inp = document.getElementById('arenaInput');
    if (inp) inp.disabled = false;
  } else {
    // Disable input during countdown
    const inp = document.getElementById('arenaInput');
    if (inp) inp.disabled = true;
  }
}

function handleTick(remainingMs) {
  const timerEl = document.getElementById('arenaTimer');
  if (!timerEl) return;
  const secs = Math.ceil(remainingMs / 1000);
  const mins = Math.floor(secs / 60);
  const s    = secs % 60;
  timerEl.textContent = `${mins}:${String(s).padStart(2, '0')}`;

  // Heartbeat under 15s
  if (secs === 15) audioEngine.startHeartbeat(900);
  if (secs <= 5) timerEl.classList.add('timer-critical');
}

function handleMatchEnd(result, stats) {
  botController?.stop();
  audioEngine.stopHeartbeat();

  if (rafCanvasId) {
    cancelAnimationFrame(rafCanvasId);
    rafCanvasId = null;
  }

  const bot = BOT_ARCHETYPES[selectedBotId];
  const displayName = `${bot?.icon || ''} ${bot?.name || 'Bot'}`;

  if (result === 'player') {
    audioEngine.playVictoryFanfare();
    showVictoryModal(stats, selectedBotId, displayName, rematch, renderLobby);
  } else {
    audioEngine.playDefeatThud();
    showDefeatModal(stats, selectedBotId, displayName, rematch, renderLobby);
  }
}

function rematch() {
  if (selectedBotId) startMatch(selectedBotId);
}

// ── Screen Shake ───────────────────────────────────────────────────────────

function triggerScreenShake() {
  if (shakeActive) return;
  shakeActive = true;
  const hud = document.getElementById('arenaHud');
  if (!hud) { shakeActive = false; return; }
  hud.classList.add('arena-shake');
  setTimeout(() => {
    hud.classList.remove('arena-shake');
    shakeActive = false;
  }, PHYSICS.SHAKE_DURATION_MS);
}
