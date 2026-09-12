/**
* challenge.js — Daily Word Challenge Module
* 
* Features:
*   - Daily word fetched/cached from server
*   - 3-step quiz: MCQ definition → fill-in-blank sentence → TTS pronunciation
*   - Rank system: Iron → Bronze 1-3 → Silver 1-3 → Gold 1-3 → Platinum 1-3 → Diamond 1-3 → Word Master 1-3
*   - Streak tracking (wrong answers cancel streak, not rank)
*   - Leaderboard: global + weekly, side-by-side tabs
*   - 6-month rank drop: drops 6 tiers
*/

import { showToast } from './toast.js';

// ─── Rank System ──────────────────────────────────────────────────────────────

const RANK_TIERS = [
  { id: 'iron', label: 'Iron', icon: '🪨', cls: 'rank-iron', maxSub: 1, pointsPer: 5 },
  { id: 'bronze', label: 'Bronze', icon: '🥉', cls: 'rank-bronze', maxSub: 3, pointsPer: 5 },
  { id: 'silver', label: 'Silver', icon: '🥈', cls: 'rank-silver', maxSub: 3, pointsPer: 5 },
  { id: 'gold', label: 'Gold', icon: '🥇', cls: 'rank-gold', maxSub: 3, pointsPer: 5 },
  { id: 'platinum', label: 'Platinum', icon: '💜', cls: 'rank-platinum', maxSub: 3, pointsPer: 10 },
  { id: 'diamond', label: 'Diamond', icon: '💎', cls: 'rank-diamond', maxSub: 3, pointsPer: 10 },
  { id: 'wordmaster', label: 'Word Master', icon: '👑', cls: 'rank-wordmaster', maxSub: 3, pointsPer: 10 },
];

// Build a flat list of all tier/sub combinations for easier indexing
function buildTierList() {
  const list = [];
  for (const tier of RANK_TIERS) {
    for (let sub = 1; sub <= tier.maxSub; sub++) {
      list.push({ ...tier, sub });
    }
  }
  return list;
}
const ALL_TIERS = buildTierList(); // 1 + 3 + 3 + 3 + 3 + 3 + 3 = 19 tiers

export function calculateRank(rankPoints) {
  let remaining = Math.max(0, rankPoints);
  for (let i = 0; i < ALL_TIERS.length; i++) {
    const t = ALL_TIERS[i];
    if (remaining < t.pointsPer || i === ALL_TIERS.length - 1) {
      const progress = remaining;
      return {
        tierIndex: i,
        tier: t,
        progress,
        pointsToNext: t.pointsPer - progress,
        isMax: i === ALL_TIERS.length - 1
      };
    }
    remaining -= t.pointsPer;
  }
  return { tierIndex: 0, tier: ALL_TIERS[0], progress: 0, pointsToNext: ALL_TIERS[0].pointsPer, isMax: false };
}

// ─── Auth Token Helper ────────────────────────────────────────────────────────
let _getToken = null;
export function setTokenProvider(fn) { _getToken = fn; }

async function authHeader() {
  if (!_getToken) return {};
  const token = await _getToken();
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

// ─── State ────────────────────────────────────────────────────────────────────
let dailyWord = null;
let userData = null;
let quizState = { step: 0, mcqCorrect: false, sentenceCorrect: false };
let lbTab = 'global';
let _currentUser = null;

// ─── Main Init ────────────────────────────────────────────────────────────────
export async function initChallenge(user) {
  _currentUser = user;
  const container = document.getElementById('challengeView');
  if (!container) return;

  if (!user) {
    renderLocked(container);
    return;
  }

  container.innerHTML = `<div class="challenge-layout">
    <div id="ch-main"></div>
    <div id="ch-sidebar" class="challenge-sidebar"></div>
  </div>`;

  // Load everything in parallel
  const [word, uData, globalLb, weeklyLb] = await Promise.all([
    fetchDailyWord(),
    fetchUserData(),
    fetchLeaderboard('global'),
    fetchLeaderboard('weekly'),
  ]);
  dailyWord = word;
  userData = uData;

  renderMain(user, word, uData);
  renderSidebar(uData, globalLb, weeklyLb, user);
}

// ─── Fetch helpers ────────────────────────────────────────────────────────────
async function fetchDailyWord() {
  try {
    const res = await fetch('/api/daily-word');
    return await res.json();
  } catch { return null; }
}

async function fetchUserData() {
  try {
    const headers = await authHeader();
    const res = await fetch('/api/challenge/me', { headers });
    return await res.json();
  } catch { return { newUser: true }; }
}

async function fetchLeaderboard(type) {
  try {
    const res = await fetch(`/api/challenge/leaderboard?type=${type}`);
    const j = await res.json();
    return j.entries || [];
  } catch { return []; }
}

// ─── Render Locked (guest) ────────────────────────────────────────────────────
function renderLocked(container) {
  container.innerHTML = `
    <div class="challenge-locked">
      <div class="challenge-locked-icon">🔐</div>
      <h2 class="challenge-locked-title">Sign in to Challenge</h2>
      <p class="challenge-locked-sub">The Daily Word Challenge tracks your streak, rank, and puts you on the leaderboard — all saved to your account.</p>
      <button class="challenge-locked-btn" id="chLockLogin">Login with Google</button>
    </div>`;
  document.getElementById('chLockLogin')?.addEventListener('click', () => {
    document.getElementById('authBtn')?.click();
  });
}

// ─── Render Main Column ───────────────────────────────────────────────────────
function renderMain(user, word, uData) {
  const main = document.getElementById('ch-main');
  if (!main) return;

  const rank = calculateRank(uData?.rankPoints || 0);
  const streak = uData?.currentStreak || 0;
  const alreadyPlayed = uData?.lastPlayedDate === new Date().toISOString().slice(0, 10);

  main.innerHTML = `
    <!-- Rank + streak hero row -->
    <div class="challenge-hero-row">
      <div class="rank-badge-large">
        <div class="rank-badge-icon ${rank.tier.cls}" id="rankBadgeIcon">${rank.tier.icon}</div>
        <div class="rank-badge-label">${rank.tier.label}</div>
        <div class="rank-badge-tier">${rank.tier.maxSub > 1 ? rank.tier.label + ' ' + rank.tier.sub : rank.tier.label}</div>
      </div>
      <div class="rank-info">
        <div class="rank-info-name">${user.displayName || 'Challenger'}</div>
        <div class="rank-info-sub">${rank.isMax ? '👑 MAX RANK — Word Master 3' : `${rank.progress}/${rank.tier.pointsPer} pts to next tier`}</div>
        <div class="tier-progress-wrap">
          <div class="tier-progress-label">
            <span>${rank.tier.label}${rank.tier.maxSub > 1 ? ' ' + rank.tier.sub : ''}</span>
            <span>${rank.isMax ? 'MAX' : `→ ${ALL_TIERS[Math.min(rank.tierIndex + 1, ALL_TIERS.length - 1)].label} ${ALL_TIERS[Math.min(rank.tierIndex + 1, ALL_TIERS.length - 1)].sub}`}</span>
          </div>
          <div class="tier-progress-bar">
            <div class="tier-progress-fill" style="width:${rank.isMax ? 100 : Math.round((rank.progress / rank.tier.pointsPer) * 100)}%"></div>
          </div>
        </div>
      </div>
      <div class="streak-hero-block">
        <div class="streak-hero-flame">${streak >= 7 ? '🔥' : streak >= 3 ? '⚡' : '📅'}</div>
        <div class="streak-hero-num">${streak}</div>
        <div class="streak-hero-label">Day Streak</div>
      </div>
    </div>

    <!-- Daily word card -->
    ${word ? renderDailyWordCard(word, alreadyPlayed) : '<div class="daily-word-card"><p style="color:var(--text-muted);text-align:center;padding:20px;">Failed to load today\'s word. Please try refreshing.</p></div>'}
  `;

  // Attach TTS button
  document.getElementById('chTtsBtn')?.addEventListener('click', speakWord);

  // Show quiz or already-played banner
  if (alreadyPlayed) {
    const quizArea = document.getElementById('chQuizArea');
    if (quizArea) quizArea.innerHTML = `
      <div class="challenge-done-banner">
        <div class="challenge-done-icon">✅</div>
        <span>You've completed today's challenge! Come back tomorrow for a new word.</span>
      </div>`;
  } else if (word) {
    renderQuizStep(0, word);
  }
}

function renderDailyWordCard(word, alreadyPlayed) {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const msLeft = tomorrow - now;
  const h = Math.floor(msLeft / 3600000);
  const m = Math.floor((msLeft % 3600000) / 60000);

  return `
    <div class="daily-word-card">
      <div class="dwc-header">
        <div class="dwc-label">🗓️ Today's Word</div>
        <div class="dwc-countdown">Resets in ${h}h ${m}m</div>
      </div>
      <div class="dwc-word">${word.word || 'Loading...'}</div>
      <div class="dwc-phonetic">${word.phonetic || ''} · <em>${word.partOfSpeech || ''}</em></div>
      <div class="dwc-def">${word.definition || ''}</div>
      <button class="dwc-tts-btn" id="chTtsBtn">🔊 Hear it pronounced</button>
      
      <!-- Quiz steps indicator -->
      <div class="challenge-steps">
        <div class="ch-step active" id="chStep1">1</div>
        <div class="ch-step-line"></div>
        <div class="ch-step" id="chStep2">2</div>
        <div class="ch-step-line"></div>
        <div class="ch-step" id="chStep3">🔊</div>
      </div>

      <!-- Quiz area -->
      <div id="chQuizArea"></div>
    </div>`;
}

// ─── Quiz Steps ───────────────────────────────────────────────────────────────
function renderQuizStep(step, word) {
  word = word || dailyWord;
  const area = document.getElementById('chQuizArea');
  if (!area || !word) return;

  // Update step indicators
  for (let i = 1; i <= 3; i++) {
    const el = document.getElementById('chStep' + i);
    if (!el) continue;
    el.classList.remove('active', 'done');
    if (i - 1 < step) el.classList.add('done');
    else if (i - 1 === step) el.classList.add('active');
  }

  if (step === 0) renderMCQStep(area, word);
  else if (step === 1) renderSentenceStep(area, word);
  else if (step === 2) renderTTSStep(area, word);
}

function renderMCQStep(area, word) {
  const choices = shuffle([word.definition, ...(word.wrongChoices || []).slice(0, 3)]);
  area.innerHTML = `
    <div class="challenge-quiz-section">
      <div class="cq-question">What is the definition of <strong>${word.word}</strong>?</div>
      <div class="cq-options" id="chMcqOptions">
        ${choices.map((c, i) => `<button class="cq-option" data-correct="${c === word.definition}">${c}</button>`).join('')}
      </div>
    </div>`;

  area.querySelectorAll('.cq-option').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const isCorrect = e.currentTarget.dataset.correct === 'true';
      quizState.mcqCorrect = isCorrect;
      area.querySelectorAll('.cq-option').forEach(b => {
        b.disabled = true;
        if (b.dataset.correct === 'true') b.classList.add('correct');
        else if (b === e.currentTarget && !isCorrect) b.classList.add('wrong');
      });

      const result = document.createElement('div');
      result.className = 'cq-result-msg ' + (isCorrect ? 'ok' : 'bad');
      result.textContent = isCorrect ? '✅ Correct! Moving to sentence challenge...' : `❌ The answer was: "${word.definition}"`;
      area.querySelector('.challenge-quiz-section').appendChild(result);

      setTimeout(() => renderQuizStep(1, word), 1600);
    });
  });
}

function renderSentenceStep(area, word) {
  const sentence = (word.sentence || '').replace('___', `<span style="color:var(--accent);font-weight:700">[${word.word}]</span>`);
  const blankSentence = (word.sentence || '').replace('___', '________');
  area.innerHTML = `
    <div class="challenge-quiz-section">
      <div class="cq-question">Fill in the blank:<br><em>"${blankSentence}"</em></div>
      <input type="text" class="cq-sentence-input" id="chSentenceInput" placeholder="Type the word here..." autocomplete="off" autocorrect="off" spellcheck="false"/>
      <button class="cq-submit-btn" id="chSentenceSubmit">Submit →</button>
    </div>`;

  const input = document.getElementById('chSentenceInput');
  const submitBtn = document.getElementById('chSentenceSubmit');

  function doSubmit() {
    const val = input.value.trim().toLowerCase();
    const isCorrect = val === word.word.toLowerCase();
    quizState.sentenceCorrect = isCorrect;
    input.disabled = true;
    submitBtn.disabled = true;


    const result = document.createElement('div');
    result.className = 'cq-result-msg ' + (isCorrect ? 'ok' : 'bad');
    result.innerHTML = isCorrect
      ? `✅ Correct! Here's the full sentence:<br><em>"${sentence}"</em>`
      : `❌ The word was <strong>${word.word}</strong>.<br><em>"${sentence}"</em>`;
    area.querySelector('.challenge-quiz-section').appendChild(result);
    submitBtn.textContent = 'Next →';
    submitBtn.disabled = false;
    submitBtn.onclick = () => renderQuizStep(2, word);
  }

  submitBtn.addEventListener('click', doSubmit);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSubmit(); });
  input.focus();
}

function renderTTSStep(area, word) {
  area.innerHTML = `
    <div class="challenge-quiz-section">
      <div class="cq-question">🔊 Listen and master the pronunciation of <strong>${word.word}</strong></div>
      <button class="dwc-tts-btn" id="chFinalTts" style="margin-bottom:8px">▶ Hear "${word.word}" aloud</button>
      <button class="cq-submit-btn" id="chFinishBtn">✅ I've got it — Finish!</button>
    </div>`;

  document.getElementById('chFinalTts')?.addEventListener('click', () => {
    const btn = document.getElementById('chFinalTts');
    if (btn) { btn.classList.add('speaking'); btn.textContent = '🔊 Speaking...'; }
    const utt = new SpeechSynthesisUtterance(word.word);
    utt.rate = 0.9;
    utt.onend = () => { if (btn) { btn.classList.remove('speaking'); btn.textContent = `▶ Hear "${word.word}" aloud`; } };
    speechSynthesis.speak(utt);
  });

  document.getElementById('chFinishBtn')?.addEventListener('click', () => submitChallenge(word));
}

// ─── Submit Challenge ─────────────────────────────────────────────────────────
async function submitChallenge(word) {
  const area = document.getElementById('chQuizArea');
  if (area) area.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted)">Saving results... ⏳</div>';

  const today = new Date().toISOString().slice(0, 10);
  try {
    const headers = { ...await authHeader(), 'Content-Type': 'application/json' };
    const res = await fetch('/api/challenge/submit', {
      method: 'POST',
      headers,
      body: JSON.stringify({ mcqCorrect: quizState.mcqCorrect, sentenceCorrect: quizState.sentenceCorrect, date: today })
    });
    const result = await res.json();

    if (!res.ok) throw new Error(result.error || 'Submission failed');

    userData = result.data;
    const rank = calculateRank(userData.rankPoints || 0);
    const pointsEarned = result.pointsEarned || 0;
    const streak = userData.currentStreak || 0;

    // Rank-up flash animation
    const badgeIcon = document.getElementById('rankBadgeIcon');
    if (badgeIcon) {
      badgeIcon.textContent = rank.tier.icon;
      badgeIcon.className = 'rank-badge-icon ' + rank.tier.cls + ' rank-up-flash';
    }

    if (area) area.innerHTML = `
      <div class="challenge-completed">
        <span class="challenge-completed-icon">${pointsEarned === 2 ? '🌟' : pointsEarned === 1 ? '⭐' : '💪'}</span>
        <h3 class="challenge-completed-title">
          ${pointsEarned === 2 ? 'Perfect! +2 Rank Points' : pointsEarned === 1 ? 'Good job! +1 Rank Point' : 'Keep going! Come back tomorrow.'}
        </h3>
        <p class="challenge-completed-sub">
          🔥 Streak: ${streak} day${streak !== 1 ? 's' : ''} · 
          🏅 Rank: ${rank.tier.label}${rank.tier.maxSub > 1 ? ' ' + rank.tier.sub : ''} ·
          📊 Total: ${userData.totalCorrect} correct
        </p>
      </div>`;

    showToast(pointsEarned > 0 ? `+${pointsEarned} rank point${pointsEarned > 1 ? 's' : ''}! Come back tomorrow 🔥` : 'Challenge complete! Come back tomorrow.', 'success', 4000);

    // Refresh leaderboards
    const [gLb, wLb] = await Promise.all([fetchLeaderboard('global'), fetchLeaderboard('weekly')]);
    renderSidebar(userData, gLb, wLb, _currentUser);
  } catch (err) {
    console.error('Submit error:', err);
    showToast('Failed to save results. Please check your connection.', 'error');
    if (area) area.innerHTML = '<div class="cq-result-msg bad">Failed to save. Please try again.</div>';
  }
}

// ─── Render Sidebar ───────────────────────────────────────────────────────────
function renderSidebar(uData, globalLb, weeklyLb, user) {
  const sidebar = document.getElementById('ch-sidebar');
  if (!sidebar) return;

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());

  sidebar.innerHTML = `
    <!-- Weekly recap card -->
    <div class="weekly-recap-card">
      <div class="wr-title">📊 Your Stats</div>
      <div class="wr-stat"><span>Total words correct</span><span>${uData?.totalCorrect || 0}</span></div>
      <div class="wr-stat"><span>Current streak</span><span>${uData?.currentStreak || 0} 🔥</span></div>
      <div class="wr-stat"><span>Longest streak</span><span>${uData?.longestStreak || 0} 🏆</span></div>
      <div class="wr-stat"><span>This week</span><span>${uData?.weeklyScore || 0} pts</span></div>
    </div>

    <!-- Leaderboard card -->
    <div class="leaderboard-card">
      <div class="lb-tabs">
        <button class="lb-tab ${lbTab === 'global' ? 'active' : ''}" id="lbTabGlobal">🌍 All-Time</button>
        <button class="lb-tab ${lbTab === 'weekly' ? 'active' : ''}" id="lbTabWeekly">📅 This Week</button>
      </div>
      <div id="lbListWrap">
        ${renderLeaderboardList(lbTab === 'global' ? globalLb : weeklyLb, user, lbTab)}
      </div>
    </div>`;

  document.getElementById('lbTabGlobal')?.addEventListener('click', () => {
    lbTab = 'global';
    document.getElementById('lbTabGlobal')?.classList.add('active');
    document.getElementById('lbTabWeekly')?.classList.remove('active');
    document.getElementById('lbListWrap').innerHTML = renderLeaderboardList(globalLb, user, 'global');
  });
  document.getElementById('lbTabWeekly')?.addEventListener('click', () => {
    lbTab = 'weekly';
    document.getElementById('lbTabWeekly')?.classList.add('active');
    document.getElementById('lbTabGlobal')?.classList.remove('active');
    document.getElementById('lbListWrap').innerHTML = renderLeaderboardList(weeklyLb, user, 'weekly');
  });
}

function renderLeaderboardList(entries, user, type) {
  if (!entries || !entries.length) {
    return '<div class="lb-empty">No entries yet. Be the first! 🏆</div>';
  }
  const medals = ['🥇', '🥈', '🥉'];
  const scoreKey = type === 'weekly' ? 'weeklyScore' : 'totalCorrect';
  const myUid = user?.uid;
  let myRank = entries.findIndex(e => e.uid === myUid) + 1;

  const rows = entries.map((e, i) => {
    const isMe = e.uid === myUid;
    const avatar = e.photoURL
      ? `<img src="${e.photoURL}" class="lb-avatar" referrerpolicy="no-referrer" alt="">`
      : `<div class="lb-avatar-ph">${(e.displayName || 'A')[0].toUpperCase()}</div>`;
    const rankLabel = i < 3 ? `<span class="lb-rank-num top${i + 1}">${medals[i]}</span>` : `<span class="lb-rank-num">${i + 1}</span>`;
    return `<li class="lb-entry">
      ${rankLabel}
      ${avatar}
      <span class="lb-name${isMe ? ' is-me' : ''}">${e.displayName || 'Anonymous'}${isMe ? ' (you)' : ''}</span>
      <span class="lb-score">${e[scoreKey] || 0}</span>
    </li>`;
  }).join('');

  const myRankRow = myRank > 0 && myRank > entries.length
    ? `<div class="lb-my-rank-row">Your rank: #${myRank} · ${(user?.totalCorrect || 0)} pts</div>` : '';

  return `<ul class="lb-list">${rows}</ul>${myRankRow}`;
}

// ─── TTS Helper ───────────────────────────────────────────────────────────────
function speakWord() {
  if (!dailyWord?.word) return;
  const btn = document.getElementById('chTtsBtn');
  if (btn) { btn.classList.add('speaking'); btn.textContent = '🔊 Speaking...'; }
  const utt = new SpeechSynthesisUtterance(dailyWord.word);
  utt.rate = 0.85;
  utt.onend = () => { if (btn) { btn.classList.remove('speaking'); btn.textContent = '🔊 Hear it pronounced'; } };
  speechSynthesis.speak(utt);
}

// ─── Utils ────────────────────────────────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
