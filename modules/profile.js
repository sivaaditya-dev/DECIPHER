/**
 * profile.js — User Profile Module
 *
 * Features:
 *  - Avatar picker (8 SVG avatars, rank-gated unlocks)
 *  - Rank display with progress bar
 *  - GitHub-style activity heatmap (6 months)
 *  - Trophy Room stats (words mastered, streaks, win rate)
 *  - Display name editor
 *  - TTS voice preference selector
 *  - Galaxy Word Map embed (Three.js via galaxy.js)
 * 
 * All data stored in Firestore via /api/profile endpoint.
 */

import { initGalaxy, destroyGalaxy } from './galaxy.js';

let currentUser = null;
let profileData  = {};
let isRendered   = false;

// ─── Rank System (mirrors challenge.js) ────────────────────────────────────────
const RANKS = [
  { id: 'iron',        label: 'Iron',        icon: '⚙️',  color: '#9e9e9e', glow: 'rgba(158,158,158,0.5)' },
  { id: 'bronze1',     label: 'Bronze I',    icon: '🥉',  color: '#cd853f', glow: 'rgba(205,133,63,0.5)' },
  { id: 'bronze2',     label: 'Bronze II',   icon: '🥉',  color: '#cd853f', glow: 'rgba(205,133,63,0.5)' },
  { id: 'bronze3',     label: 'Bronze III',  icon: '🥉',  color: '#cd853f', glow: 'rgba(205,133,63,0.5)' },
  { id: 'silver1',     label: 'Silver I',    icon: '🥈',  color: '#C0C0C0', glow: 'rgba(192,192,192,0.5)' },
  { id: 'silver2',     label: 'Silver II',   icon: '🥈',  color: '#C0C0C0', glow: 'rgba(192,192,192,0.5)' },
  { id: 'silver3',     label: 'Silver III',  icon: '🥈',  color: '#C0C0C0', glow: 'rgba(192,192,192,0.5)' },
  { id: 'gold1',       label: 'Gold I',      icon: '🥇',  color: '#FFD700', glow: 'rgba(255,215,0,0.5)' },
  { id: 'gold2',       label: 'Gold II',     icon: '🥇',  color: '#FFD700', glow: 'rgba(255,215,0,0.5)' },
  { id: 'gold3',       label: 'Gold III',    icon: '🥇',  color: '#FFD700', glow: 'rgba(255,215,0,0.5)' },
  { id: 'platinum1',   label: 'Platinum I',  icon: '💎',  color: '#B39DDB', glow: 'rgba(179,157,219,0.6)' },
  { id: 'platinum2',   label: 'Platinum II', icon: '💎',  color: '#B39DDB', glow: 'rgba(179,157,219,0.6)' },
  { id: 'platinum3',   label: 'Platinum III',icon: '💎',  color: '#B39DDB', glow: 'rgba(179,157,219,0.6)' },
  { id: 'diamond1',    label: 'Diamond I',   icon: '🌟',  color: '#00E5FF', glow: 'rgba(0,229,255,0.6)' },
  { id: 'diamond2',    label: 'Diamond II',  icon: '🌟',  color: '#00E5FF', glow: 'rgba(0,229,255,0.6)' },
  { id: 'diamond3',    label: 'Diamond III', icon: '🌟',  color: '#00E5FF', glow: 'rgba(0,229,255,0.6)' },
  { id: 'wm1',         label: 'Word Master I',    icon: '👑', color: '#FF6B35', glow: 'rgba(255,107,53,0.7)' },
  { id: 'wm2',         label: 'Word Master II',   icon: '👑', color: '#FF6B35', glow: 'rgba(255,107,53,0.7)' },
  { id: 'wm3',         label: 'Word Master III',  icon: '👑', color: '#FF6B35', glow: 'rgba(255,107,53,0.7)' },
];

// ─── Avatar Definitions ────────────────────────────────────────────────────────
// 8 avatars. Unlock thresholds = rank index (0=Iron, 3=Bronze3, 6=Silver3, etc.)
const AVATARS = [
  {
    id: 'cosmic',  unlockRank: 0, label: 'Cosmic',
    svg: `<svg viewBox="0 0 80 80" width="56" height="56">
      <defs><radialGradient id="cg1" cx="40%" cy="30%"><stop offset="0%" stop-color="#9C27B0"/><stop offset="100%" stop-color="#1A0033"/></radialGradient></defs>
      <circle cx="40" cy="40" r="38" fill="url(#cg1)"/>
      <circle cx="40" cy="32" r="16" fill="#CE93D8" opacity="0.9"/>
      <path d="M24 56 Q40 44 56 56 Q50 70 40 72 Q30 70 24 56Z" fill="#CE93D8" opacity="0.9"/>
      <circle cx="33" cy="30" r="3" fill="#1A0033"/><circle cx="47" cy="30" r="3" fill="#1A0033"/>
      <path d="M34 37 Q40 42 46 37" stroke="#9C27B0" stroke-width="1.5" fill="none"/>
      <circle cx="20" cy="15" r="2" fill="#E040FB"/><circle cx="60" cy="12" r="1.5" fill="#E040FB"/>
      <circle cx="65" cy="50" r="1" fill="#E040FB"/>
    </svg>`
  },
  {
    id: 'spiderverse',  unlockRank: 1, label: 'Spider-Verse',
    svg: `<svg viewBox="0 0 80 80" width="56" height="56">
      <defs><radialGradient id="sg1" cx="40%" cy="30%"><stop offset="0%" stop-color="#CC0000"/><stop offset="100%" stop-color="#330000"/></radialGradient></defs>
      <circle cx="40" cy="40" r="38" fill="url(#sg1)"/>
      <circle cx="40" cy="32" r="16" fill="#FF3333" opacity="0.95"/>
      <path d="M24 56 Q40 44 56 56 Q50 70 40 72 Q30 70 24 56Z" fill="#1565C0" opacity="0.95"/>
      <path d="M26 28 Q34 18 42 26 Q34 32 26 28Z" fill="white" opacity="0.9"/>
      <path d="M54 28 Q46 18 38 26 Q46 32 54 28Z" fill="white" opacity="0.9"/>
      <line x1="40" y1="6" x2="38" y2="1" stroke="#DDD" stroke-width="1"/>
      <line x1="40" y1="6" x2="44" y2="2" stroke="#DDD" stroke-width="1"/>
    </svg>`
  },
  {
    id: 'neon',  unlockRank: 3, label: 'Neon',
    svg: `<svg viewBox="0 0 80 80" width="56" height="56">
      <defs><radialGradient id="ng1" cx="40%" cy="30%"><stop offset="0%" stop-color="#00BCD4"/><stop offset="100%" stop-color="#002233"/></radialGradient></defs>
      <circle cx="40" cy="40" r="38" fill="url(#ng1)" stroke="#00E5FF" stroke-width="1.5"/>
      <circle cx="40" cy="32" r="16" fill="#00ACC1" opacity="0.9"/>
      <path d="M24 56 Q40 44 56 56 Q50 70 40 72 Q30 70 24 56Z" fill="#00ACC1" opacity="0.9"/>
      <circle cx="33" cy="30" r="3.5" fill="#002233"/><circle cx="33" cy="30" r="1.5" fill="#00E5FF" opacity="0.8"/>
      <circle cx="47" cy="30" r="3.5" fill="#002233"/><circle cx="47" cy="30" r="1.5" fill="#00E5FF" opacity="0.8"/>
      <path d="M34 38 Q40 43 46 38" stroke="#00E5FF" stroke-width="1.5" fill="none"/>
    </svg>`
  },
  {
    id: 'galaxy',  unlockRank: 4, label: 'Galaxy',
    svg: `<svg viewBox="0 0 80 80" width="56" height="56">
      <defs><radialGradient id="gg1" cx="40%" cy="30%"><stop offset="0%" stop-color="#3949AB"/><stop offset="100%" stop-color="#050520"/></radialGradient></defs>
      <circle cx="40" cy="40" r="38" fill="url(#gg1)"/>
      <circle cx="40" cy="32" r="16" fill="#5C6BC0" opacity="0.9"/>
      <path d="M24 56 Q40 44 56 56 Q50 70 40 72 Q30 70 24 56Z" fill="#5C6BC0" opacity="0.9"/>
      <circle cx="33" cy="30" r="3" fill="#050520"/><circle cx="47" cy="30" r="3" fill="#050520"/>
      <circle cx="15" cy="20" r="1" fill="#FFF" opacity="0.8"/>
      <circle cx="62" cy="15" r="1.5" fill="#FFF" opacity="0.6"/>
      <circle cx="68" cy="45" r="1" fill="#FFF" opacity="0.7"/>
      <circle cx="10" cy="55" r="0.8" fill="#FFF" opacity="0.5"/>
    </svg>`
  },
  {
    id: 'anime',  unlockRank: 7, label: 'Anime',
    svg: `<svg viewBox="0 0 80 80" width="56" height="56">
      <defs><radialGradient id="an1" cx="40%" cy="30%"><stop offset="0%" stop-color="#F48FB1"/><stop offset="100%" stop-color="#880E4F"/></radialGradient></defs>
      <circle cx="40" cy="40" r="38" fill="url(#an1)"/>
      <circle cx="40" cy="31" r="17" fill="#FFCDD2" opacity="0.95"/>
      <path d="M23 55 Q40 43 57 55 Q51 71 40 73 Q29 71 23 55Z" fill="#FFCDD2" opacity="0.95"/>
      <ellipse cx="32" cy="28" rx="5" ry="6" fill="#880E4F" opacity="0.9"/>
      <ellipse cx="32" cy="27" rx="2" ry="2.5" fill="white" opacity="0.5"/>
      <ellipse cx="48" cy="28" rx="5" ry="6" fill="#880E4F" opacity="0.9"/>
      <ellipse cx="48" cy="27" rx="2" ry="2.5" fill="white" opacity="0.5"/>
      <path d="M35 39 Q40 43 45 39" stroke="#C2185B" stroke-width="1.5" fill="none"/>
      <path d="M24 20 Q31 14 38 18" stroke="#C2185B" stroke-width="2" fill="none"/>
      <path d="M56 20 Q49 14 42 18" stroke="#C2185B" stroke-width="2" fill="none"/>
    </svg>`
  },
  {
    id: 'glassy', unlockRank: 10, label: 'Glassy',
    svg: `<svg viewBox="0 0 80 80" width="56" height="56">
      <defs>
        <radialGradient id="gl1" cx="35%" cy="25%"><stop offset="0%" stop-color="rgba(255,255,255,0.3)"/><stop offset="100%" stop-color="rgba(100,180,255,0.1)"/></radialGradient>
      </defs>
      <circle cx="40" cy="40" r="38" fill="rgba(10,20,40,0.9)" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"/>
      <circle cx="40" cy="40" r="35" fill="url(#gl1)"/>
      <circle cx="40" cy="32" r="16" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.3)" stroke-width="1"/>
      <path d="M24 56 Q40 44 56 56 Q50 70 40 72 Q30 70 24 56Z" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
      <ellipse cx="33" cy="30" rx="4" ry="5" fill="rgba(255,255,255,0.6)"/>
      <ellipse cx="47" cy="30" rx="4" ry="5" fill="rgba(255,255,255,0.6)"/>
    </svg>`
  },
  {
    id: 'platinum_avatar', unlockRank: 13, label: 'Platinum',
    svg: `<svg viewBox="0 0 80 80" width="56" height="56">
      <defs><radialGradient id="pl1" cx="40%" cy="30%"><stop offset="0%" stop-color="#E0D7FF"/><stop offset="100%" stop-color="#4527A0"/></radialGradient></defs>
      <circle cx="40" cy="40" r="38" fill="url(#pl1)" stroke="#B39DDB" stroke-width="1.5"/>
      <circle cx="40" cy="32" r="16" fill="#EDE7F6" opacity="0.95"/>
      <path d="M24 56 Q40 44 56 56 Q50 70 40 72 Q30 70 24 56Z" fill="#D1C4E9" opacity="0.95"/>
      <ellipse cx="33" cy="30" rx="4.5" ry="5.5" fill="#4527A0"/><ellipse cx="33" cy="28.5" rx="2" ry="2" fill="#CE93D8" opacity="0.7"/>
      <ellipse cx="47" cy="30" rx="4.5" ry="5.5" fill="#4527A0"/><ellipse cx="47" cy="28.5" rx="2" ry="2" fill="#CE93D8" opacity="0.7"/>
      <path d="M34 39 Q40 44 46 39" stroke="#7E57C2" stroke-width="1.5" fill="none"/>
      <path d="M28 8 L31 14 L37 15 L32 20 L33 26 L28 23 L23 26 L24 20 L19 15 L25 14 Z" fill="#FFD700" opacity="0.8" stroke="#FFA000" stroke-width="0.5"/>
    </svg>`
  },
  {
    id: 'wordmaster', unlockRank: 16, label: 'Word Master',
    svg: `<svg viewBox="0 0 80 80" width="56" height="56">
      <defs><radialGradient id="wm1" cx="40%" cy="30%"><stop offset="0%" stop-color="#FF6B35"/><stop offset="100%" stop-color="#1A0500"/></radialGradient></defs>
      <circle cx="40" cy="40" r="38" fill="url(#wm1)" stroke="#FF6B35" stroke-width="2"/>
      <circle cx="40" cy="32" r="16" fill="#FF8A65" opacity="0.95"/>
      <path d="M24 56 Q40 44 56 56 Q50 70 40 72 Q30 70 24 56Z" fill="#FF7043" opacity="0.95"/>
      <ellipse cx="33" cy="30" rx="4.5" ry="5.5" fill="#1A0500"/><ellipse cx="33" cy="28" rx="2" ry="2.5" fill="#FF6B35" opacity="0.7"/>
      <ellipse cx="47" cy="30" rx="4.5" ry="5.5" fill="#1A0500"/><ellipse cx="47" cy="28" rx="2" ry="2.5" fill="#FF6B35" opacity="0.7"/>
      <path d="M34 39 Q40 44 46 39" stroke="#FF6B35" stroke-width="2" fill="none"/>
      <path d="M30 4 L33 10 L40 11 L35 16 L36 23 L30 20 L24 23 L25 16 L20 11 L27 10 Z" fill="#FFD700" stroke="#FFA000" stroke-width="0.5"/>
      <circle cx="40" cy="4" r="2" fill="#FFD700"/><circle cx="52" cy="8" r="1.5" fill="#FFD700"/><circle cx="28" cy="8" r="1.5" fill="#FFD700"/>
    </svg>`
  },
];

// ─── Init Profile ──────────────────────────────────────────────────────────────
export async function initProfile(user) {
  currentUser = user;
  const container = document.getElementById('profileContent');
  if (!container) return;

  if (!user) {
    container.innerHTML = `
      <div class="profile-locked">
        <div class="profile-locked-icon">🔒</div>
        <h2 class="profile-locked-title">Sign in to view your Profile</h2>
        <p class="profile-locked-sub">Track your rank, stats, and word universe</p>
        <button class="profile-locked-btn" id="profileSignInBtn">Sign In / Sign Up</button>
      </div>`;
    document.getElementById('profileSignInBtn')?.addEventListener('click', () => {
      import('./auth.js').then(m => m.showAuthModal('signin'));
    });
    return;
  }

  // Show loading skeleton
  container.innerHTML = `<div class="profile-loading">
    <div class="profile-skeleton" style="width:80px;height:80px;border-radius:50%"></div>
    <div class="profile-skeleton" style="width:180px;height:24px;border-radius:8px;margin-top:16px"></div>
    <div class="profile-skeleton" style="width:120px;height:16px;border-radius:6px;margin-top:8px"></div>
  </div>`;

  // Fetch profile data + challenge stats from server
  try {
    const [profileRes, challengeRes] = await Promise.allSettled([
      _fetchProfile(user),
      _fetchChallengeStats(user),
    ]);
    profileData = profileRes.status === 'fulfilled' ? profileRes.value : {};
    const challengeStats = challengeRes.status === 'fulfilled' ? challengeRes.value : {};
    _renderProfile(container, user, profileData, challengeStats);
  } catch (e) {
    console.error('Profile load error:', e);
    _renderProfile(container, user, {}, {});
  }
}

// ─── Fetch Profile from Server ─────────────────────────────────────────────────
async function _fetchProfile(user) {
  const token = await user.getIdToken();
  const res = await fetch('/api/profile', { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return {};
  return res.json();
}

async function _fetchChallengeStats(user) {
  const token = await user.getIdToken();
  const res = await fetch('/api/challenge/me', { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return {};
  return res.json();
}

// ─── Render Profile ────────────────────────────────────────────────────────────
function _renderProfile(container, user, profile, stats) {
  const displayName  = profile.displayName || user.displayName || 'Vocab Hero';
  const selectedAvatar = profile.avatarId || 'cosmic';
  const rankIndex    = _scoreToRankIndex(stats.score || 0);
  const rank         = RANKS[rankIndex] || RANKS[0];
  const streak       = stats.streak || 0;
  const bestStreak   = stats.bestStreak || 0;
  const totalWords   = stats.totalWords || 0;
  const winRate      = stats.winRate != null ? Math.round(stats.winRate * 100) : 0;
  const masteredWordsList = stats.masteredWords || [];
  const activityLog  = stats.activityLog || {};

  // Next rank
  const nextRankIndex = Math.min(rankIndex + 1, RANKS.length - 1);
  const nextRank = RANKS[nextRankIndex];
  const scoreNeeded = _rankIndexToMinScore(nextRankIndex);
  const scoreNow    = stats.score || 0;
  const scorePrev   = _rankIndexToMinScore(rankIndex);
  const progressPct = nextRankIndex === rankIndex ? 100
    : Math.min(100, Math.round(((scoreNow - scorePrev) / Math.max(1, scoreNeeded - scorePrev)) * 100));

  const avatarSVG = AVATARS.find(a => a.id === selectedAvatar)?.svg || AVATARS[0].svg;

  container.innerHTML = `
    <!-- ── Hero Row ────────────────────────────────────── -->
    <div class="pf-hero">
      <div class="pf-avatar-wrap" id="pfAvatarWrap" style="--rank-glow:${rank.glow}">
        <div class="pf-avatar" id="pfAvatar">${avatarSVG}</div>
        <div class="pf-avatar-ring"></div>
      </div>

      <div class="pf-hero-info">
        <div class="pf-name-row">
          <h1 class="pf-name" id="pfName">${_escHtml(displayName)}</h1>
          <button class="pf-edit-name-btn" id="pfEditNameBtn" title="Edit name">✏️</button>
        </div>
        <div class="pf-rank-row">
          <span class="pf-rank-icon" style="color:${rank.color}">${rank.icon}</span>
          <span class="pf-rank-label" style="color:${rank.color}">${rank.label}</span>
          ${rankIndex < RANKS.length - 1 ? `<span class="pf-rank-next">→ ${nextRank.label}</span>` : '<span class="pf-rank-next">🏆 Max Rank!</span>'}
        </div>
        <div class="pf-progress-wrap">
          <div class="pf-progress-bar">
            <div class="pf-progress-fill" style="width:${progressPct}%;background:${rank.color};box-shadow:0 0 12px ${rank.glow}"></div>
          </div>
          <span class="pf-progress-pct">${progressPct}%</span>
        </div>
        <div class="pf-score-label">${scoreNow} pts · ${scoreNeeded - scoreNow > 0 ? (scoreNeeded - scoreNow) + ' pts to ' + nextRank.label : 'Max Rank Achieved!'}</div>
      </div>
    </div>

    <!-- ── Stats Grid ─────────────────────────────────── -->
    <div class="pf-stats-grid">
      <div class="pf-stat-card pf-stat-fire">
        <div class="pf-stat-icon">🔥</div>
        <div class="pf-stat-val">${streak}</div>
        <div class="pf-stat-label">Current Streak</div>
      </div>
      <div class="pf-stat-card">
        <div class="pf-stat-icon">⚡</div>
        <div class="pf-stat-val">${bestStreak}</div>
        <div class="pf-stat-label">Best Streak</div>
      </div>
      <div class="pf-stat-card">
        <div class="pf-stat-icon">📚</div>
        <div class="pf-stat-val">${totalWords}</div>
        <div class="pf-stat-label">Words Mastered</div>
      </div>
      <div class="pf-stat-card">
        <div class="pf-stat-icon">🎯</div>
        <div class="pf-stat-val">${winRate}%</div>
        <div class="pf-stat-label">Win Rate</div>
      </div>
    </div>

    <!-- ── Activity Heatmap ────────────────────────────── -->
    <div class="pf-section">
      <div class="pf-section-header">
        <h3 class="pf-section-title">Activity Heatmap</h3>
        <span class="pf-section-sub">Last 6 months of Daily Challenges</span>
      </div>
      <div class="pf-heatmap" id="pfHeatmap"></div>
      <div class="pf-heatmap-legend">
        <span>Less</span>
        <div class="pf-heatmap-swatch pf-hw-0"></div>
        <div class="pf-heatmap-swatch pf-hw-1"></div>
        <div class="pf-heatmap-swatch pf-hw-2"></div>
        <div class="pf-heatmap-swatch pf-hw-3"></div>
        <div class="pf-heatmap-swatch pf-hw-4"></div>
        <span>More</span>
      </div>
    </div>

    <!-- ── Avatar Picker ──────────────────────────────── -->
    <div class="pf-section">
      <div class="pf-section-header">
        <h3 class="pf-section-title">Choose Avatar</h3>
        <span class="pf-section-sub">Higher ranks unlock exclusive avatars</span>
      </div>
      <div class="pf-avatar-grid" id="pfAvatarGrid">
        ${AVATARS.map(av => {
          const locked = av.unlockRank > rankIndex;
          return `<div class="pf-av-item ${selectedAvatar === av.id ? 'selected' : ''} ${locked ? 'locked' : ''}"
            data-avid="${av.id}" ${locked ? '' : 'style="cursor:pointer"'}>
            ${av.svg}
            <div class="pf-av-label">${av.label}</div>
            ${locked ? `<div class="pf-av-lock">🔒 ${RANKS[av.unlockRank]?.label}</div>` : ''}
          </div>`;
        }).join('')}
      </div>
    </div>

    <!-- ── Mastered Wall ──────────────────────────────── -->
    <div class="pf-section">
      <div class="pf-section-header">
        <h3 class="pf-section-title">🕸️ Mastered Wall</h3>
        <span class="pf-section-sub">${masteredWordsList.length} words caught in Spidey's web</span>
      </div>
      <div class="pf-mastered-grid">
        ${masteredWordsList.length ? masteredWordsList.map(w => `
          <div class="pf-mastered-chip">
            <span class="pf-mastered-web">🕸️</span>${_escHtml(w?.term || w)}
          </div>`).join('') : `<p class="pf-empty-text">No words mastered yet — complete Daily Challenges and Quiz streaks!</p>`}
      </div>
    </div>

    <!-- ── Voice Preference ───────────────────────────── -->
    <div class="pf-section">
      <div class="pf-section-header">
        <h3 class="pf-section-title">🎙️ Voice Preference</h3>
        <span class="pf-section-sub">Choose pronunciation voice for text-to-speech</span>
      </div>
      <div class="pf-voice-row">
        <select class="pf-select" id="pfVoiceSelect">
          <option value="">Loading voices...</option>
        </select>
        <button class="pf-test-voice-btn" id="pfTestVoiceBtn">▶ Test</button>
      </div>
    </div>

    <!-- ── Galaxy Word Map ────────────────────────────── -->
    <div class="pf-section">
      <div class="pf-section-header">
        <h3 class="pf-section-title">🌌 Galaxy Word Map</h3>
        <span class="pf-section-sub">Your vocabulary universe · <strong id="galaxyStarCount">${masteredWordsList.length}</strong> stars</span>
      </div>
      <div id="pfGalaxyContainer"></div>
    </div>

    <!-- ── Edit Name Modal ────────────────────────────── -->
    <div class="pf-edit-name-modal" id="pfEditNameModal" style="display:none">
      <div class="pf-edit-name-box">
        <h3>Edit Display Name</h3>
        <input class="pf-edit-name-input" type="text" id="pfNewName" value="${_escHtml(displayName)}" maxlength="30" placeholder="Your name"/>
        <div class="pf-edit-name-actions">
          <button class="pf-btn-cancel" id="pfNameCancel">Cancel</button>
          <button class="pf-btn-save" id="pfNameSave">Save</button>
        </div>
      </div>
    </div>
  `;

  // ── Wire events ──────────────────────────────────────────────────────────────

  // Heatmap
  _renderHeatmap(document.getElementById('pfHeatmap'), activityLog);

  // Avatar picker
  document.getElementById('pfAvatarGrid').addEventListener('click', (e) => {
    const item = e.target.closest('.pf-av-item');
    if (!item || item.classList.contains('locked')) return;
    const avId = item.dataset.avid;
    _selectAvatar(avId, rankIndex);
  });

  // Edit name
  document.getElementById('pfEditNameBtn').addEventListener('click', () => {
    document.getElementById('pfEditNameModal').style.display = 'flex';
    document.getElementById('pfNewName').focus();
  });
  document.getElementById('pfNameCancel').addEventListener('click', () => {
    document.getElementById('pfEditNameModal').style.display = 'none';
  });
  document.getElementById('pfNameSave').addEventListener('click', async () => {
    const newName = document.getElementById('pfNewName').value.trim();
    if (!newName) return;
    await _saveProfile({ displayName: newName });
    await user.updateProfile({ displayName: newName });
    document.getElementById('pfName').textContent = newName;
    document.getElementById('pfEditNameModal').style.display = 'none';
    _showProfileToast('Display name updated!');
  });

  // Voice selector
  _initVoiceSelector(profile.voiceId);

  // Galaxy Word Map (delayed to ensure container is in DOM)
  requestAnimationFrame(() => {
    const galaxyCont = document.getElementById('pfGalaxyContainer');
    if (galaxyCont) {
      const words = masteredWordsList.map(w => ({
        term: w?.term || w,
        def: w?.def || '',
        accuracy: Math.random() * 0.5 + 0.5, // TODO: use real accuracy from stats
      }));
      initGalaxy(galaxyCont, words);
    }
  });
}

// ─── Heatmap ───────────────────────────────────────────────────────────────────
function _renderHeatmap(el, activityLog) {
  if (!el) return;
  const today = new Date();
  const days = [];

  // Go back 26 weeks (182 days)
  for (let i = 181; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({ key, score: activityLog[key] || 0 });
  }

  // Group into weeks
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  el.innerHTML = `<div class="pf-hm-grid">
    ${weeks.map(week => `
      <div class="pf-hm-week">
        ${week.map(day => {
          const level = day.score === 0 ? 0
            : day.score < 2 ? 1
            : day.score < 4 ? 2
            : day.score < 6 ? 3 : 4;
          return `<div class="pf-hm-cell pf-hw-${level}" title="${day.key}: ${day.score} pts"></div>`;
        }).join('')}
      </div>`).join('')}
  </div>`;
}

// ─── Avatar Select ─────────────────────────────────────────────────────────────
function _selectAvatar(avId, rankIndex) {
  const av = AVATARS.find(a => a.id === avId);
  if (!av || av.unlockRank > rankIndex) return;

  // Update UI
  document.querySelectorAll('.pf-av-item').forEach(el => el.classList.toggle('selected', el.dataset.avid === avId));
  document.getElementById('pfAvatar').innerHTML = av.svg;

  // Save
  _saveProfile({ avatarId: avId });
  _showProfileToast(`Avatar changed to ${av.label}!`);
}

// ─── Voice Selector ────────────────────────────────────────────────────────────
function _initVoiceSelector(savedVoiceId) {
  const select = document.getElementById('pfVoiceSelect');
  const testBtn = document.getElementById('pfTestVoiceBtn');
  if (!select) return;

  function populateVoices() {
    const voices = speechSynthesis.getVoices();
    if (voices.length === 0) return;
    select.innerHTML = voices.map(v =>
      `<option value="${v.voiceURI}" ${v.voiceURI === savedVoiceId ? 'selected' : ''}>
        ${v.name} (${v.lang})
      </option>`).join('');
  }

  populateVoices();
  speechSynthesis.onvoiceschanged = populateVoices;

  select.addEventListener('change', () => {
    _saveProfile({ voiceId: select.value });
    _showProfileToast('Voice preference saved!');
  });

  if (testBtn) {
    testBtn.addEventListener('click', () => {
      const voices = speechSynthesis.getVoices();
      const voice = voices.find(v => v.voiceURI === select.value);
      const utt = new SpeechSynthesisUtterance('Hello! This is your selected voice for Decipher.');
      if (voice) utt.voice = voice;
      speechSynthesis.cancel();
      speechSynthesis.speak(utt);
    });
  }
}

// ─── Save Profile ──────────────────────────────────────────────────────────────
async function _saveProfile(updates) {
  if (!currentUser) return;
  profileData = { ...profileData, ...updates };
  try {
    const token = await currentUser.getIdToken();
    await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(updates),
    });
  } catch (e) {
    console.error('Profile save error:', e);
  }
}

// ─── Rank Helpers ──────────────────────────────────────────────────────────────
function _scoreToRankIndex(score) {
  // Points per tier (cumulative): Iron=0, Bronze tiers=5ea, Silver=5ea, Gold=5ea, Platinum=10ea, Diamond=10ea, WM=10ea
  const thresholds = [0, 5, 10, 15, 25, 35, 45, 60, 75, 90, 110, 130, 150, 175, 200, 225, 255, 285, 315];
  let idx = 0;
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (score >= thresholds[i]) { idx = i; break; }
  }
  return Math.min(idx, RANKS.length - 1);
}

function _rankIndexToMinScore(idx) {
  const thresholds = [0, 5, 10, 15, 25, 35, 45, 60, 75, 90, 110, 130, 150, 175, 200, 225, 255, 285, 315];
  return thresholds[idx] || 0;
}

// ─── Utils ─────────────────────────────────────────────────────────────────────
function _escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

let pfToastTimer = null;
function _showProfileToast(msg) {
  let t = document.getElementById('pfToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'pfToast';
    t.style.cssText = `
      position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%) translateY(20px);
      background: rgba(30,30,50,0.95); border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px; padding: 10px 20px; color: #fff; font-size: 0.875rem;
      z-index: 99998; opacity: 0; transition: all 0.3s; pointer-events: none;
      backdrop-filter: blur(10px);
    `;
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = '1';
  t.style.transform = 'translateX(-50%) translateY(0)';
  clearTimeout(pfToastTimer);
  pfToastTimer = setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateX(-50%) translateY(20px)';
  }, 2500);
}

