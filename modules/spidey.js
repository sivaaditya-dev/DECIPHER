/**
 * spidey.js — Spider-Man Quiz Animation System
 * Handles correct answer swing, wrong answer Venom crawl,
 * and 5-streak mastered wall overlay.
 */

// ─── SVG Sprites (inline, no file needed) ──────────────────────────────────

const SPIDEY_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 180" width="90" height="135">
  <!-- Web line from hand -->
  <line x1="108" y1="18" x2="10" y2="2" stroke="#ccc" stroke-width="1.5" stroke-dasharray="4 2" opacity="0.7"/>
  <!-- Body -->
  <ellipse cx="60" cy="100" rx="22" ry="30" fill="#e53935"/>
  <!-- Web pattern on body -->
  <path d="M40 85 Q60 80 80 85 M38 95 Q60 90 82 95 M40 105 Q60 100 80 105 M42 115 Q60 110 78 115" stroke="#8B0000" stroke-width="1" fill="none" opacity="0.6"/>
  <line x1="60" y1="72" x2="60" y2="128" stroke="#8B0000" stroke-width="1" opacity="0.6"/>
  <line x1="38" y1="90" x2="82" y2="90" stroke="#8B0000" stroke-width="1" opacity="0.6"/>
  <!-- Head -->
  <ellipse cx="60" cy="62" rx="18" ry="20" fill="#e53935"/>
  <!-- Eyes (white lenses) -->
  <ellipse cx="52" cy="59" rx="8" ry="6" fill="white" transform="rotate(-15 52 59)"/>
  <ellipse cx="68" cy="59" rx="8" ry="6" fill="white" transform="rotate(15 68 59)"/>
  <ellipse cx="52" cy="59" rx="5" ry="4" fill="#1565C0" transform="rotate(-15 52 59)"/>
  <ellipse cx="68" cy="59" rx="5" ry="4" fill="#1565C0" transform="rotate(15 68 59)"/>
  <!-- Web lines on head -->
  <path d="M42 55 Q60 48 78 55 M43 63 Q60 56 77 63" stroke="#8B0000" stroke-width="0.8" fill="none" opacity="0.5"/>
  <line x1="60" y1="43" x2="60" y2="80" stroke="#8B0000" stroke-width="0.8" opacity="0.5"/>
  <!-- Left arm (shooting web forward) -->
  <path d="M38 88 Q10 55 4 20" stroke="#1565C0" stroke-width="8" stroke-linecap="round" fill="none"/>
  <!-- Right arm (holding web behind) -->
  <path d="M82 88 Q108 78 115 72" stroke="#1565C0" stroke-width="8" stroke-linecap="round" fill="none"/>
  <!-- Left leg -->
  <path d="M50 128 Q40 158 35 170" stroke="#1565C0" stroke-width="9" stroke-linecap="round" fill="none"/>
  <!-- Right leg -->
  <path d="M70 128 Q82 158 88 168" stroke="#1565C0" stroke-width="9" stroke-linecap="round" fill="none"/>
  <!-- Web blast from left hand -->
  <path d="M4 20 Q0 14 6 10 Q2 6 8 8 Q6 2 12 6" stroke="#E8D5B7" stroke-width="1.5" fill="none" opacity="0.9"/>
  <!-- Blue gloves/boots accent -->
  <circle cx="4" cy="20" r="5" fill="#1565C0"/>
  <circle cx="115" cy="72" r="5" fill="#1565C0"/>
</svg>`;

const VENOM_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 140" width="70" height="98">
  <!-- Body blob -->
  <ellipse cx="50" cy="90" rx="28" ry="35" fill="#1a1a1a"/>
  <!-- Dripping tendrils -->
  <path d="M28 100 Q20 120 22 135 Q18 125 15 140" stroke="#111" stroke-width="6" fill="none" stroke-linecap="round"/>
  <path d="M72 100 Q80 120 78 135 Q82 125 85 140" stroke="#111" stroke-width="6" fill="none" stroke-linecap="round"/>
  <path d="M50 120 Q45 132 48 140" stroke="#111" stroke-width="5" fill="none" stroke-linecap="round"/>
  <!-- Head -->
  <ellipse cx="50" cy="52" rx="26" ry="28" fill="#1a1a1a"/>
  <!-- Eyes (white alien) -->
  <path d="M24 48 Q36 38 48 46" stroke="white" stroke-width="2" fill="white"/>
  <path d="M52 46 Q64 38 76 48" stroke="white" stroke-width="2" fill="white"/>
  <!-- Mouth / teeth -->
  <path d="M28 65 Q50 80 72 65" fill="#1a1a1a" stroke="#1a1a1a" stroke-width="1"/>
  <path d="M30 66 Q50 82 70 66" fill="white"/>
  <!-- Jagged teeth -->
  <path d="M33 70 L37 66 L41 72 L45 66 L49 72 L53 66 L57 72 L61 66 L65 70" fill="#1a1a1a" stroke="none"/>
  <!-- Tongue -->
  <path d="M42 75 Q50 88 58 75" fill="#cc0000"/>
  <!-- Arms -->
  <path d="M22 78 Q5 88 2 105" stroke="#1a1a1a" stroke-width="10" stroke-linecap="round" fill="none"/>
  <path d="M78 78 Q95 88 98 105" stroke="#1a1a1a" stroke-width="10" stroke-linecap="round" fill="none"/>
  <!-- Symbiote highlights -->
  <ellipse cx="50" cy="52" rx="12" ry="8" fill="none" stroke="#333" stroke-width="2" opacity="0.4"/>
</svg>`;

// ─── State ──────────────────────────────────────────────────────────────────
let correctStreak = 0;
let masteredWords = [];
let spideyStage = null;
let masteredWallEl = null;

// ─── Init ───────────────────────────────────────────────────────────────────
export function initSpidey() {
  // Create fixed stage overlay
  spideyStage = document.createElement('div');
  spideyStage.id = 'spideyStage';
  spideyStage.innerHTML = `
    <div id="spideyChar" class="spidey-char">${SPIDEY_SVG}</div>
    <div id="venomChar" class="venom-char">${VENOM_SVG}</div>
    <div id="webStreak" class="web-streak-badge" style="display:none;">
      <span class="web-streak-flame">🔥</span>
      <span id="webStreakCount">0</span>
      <span class="web-streak-text">Streak!</span>
    </div>
  `;
  document.body.appendChild(spideyStage);

  // Create mastered wall overlay
  masteredWallEl = document.createElement('div');
  masteredWallEl.id = 'masteredWallOverlay';
  masteredWallEl.innerHTML = `
    <div class="mw-web-bg"></div>
    <div class="mw-content">
      <div class="mw-header">
        <div class="mw-spidey-icon">${SPIDEY_SVG}</div>
        <div class="mw-title-block">
          <h2 class="mw-title">🕷️ Mastered Wall</h2>
          <p class="mw-subtitle">Words caught in Spidey's web!</p>
        </div>
      </div>
      <div id="mwWordGrid" class="mw-word-grid"></div>
      <button id="mwCloseBtn" class="mw-close-btn">Close Wall ✕</button>
    </div>
  `;
  document.body.appendChild(masteredWallEl);

  // Close mastered wall on button click
  masteredWallEl.querySelector('#mwCloseBtn').addEventListener('click', () => {
    masteredWallEl.classList.remove('open');
  });
  // Also close on backdrop click
  masteredWallEl.addEventListener('click', (e) => {
    if (e.target === masteredWallEl) masteredWallEl.classList.remove('open');
  });
}

// ─── Play correct animation ─────────────────────────────────────────────────
export function playCorrect(word = '') {
  correctStreak++;
  if (word) masteredWords.push(word);

  // Update streak badge
  const badge = document.getElementById('webStreakCount');
  const badgeEl = document.getElementById('webStreak');
  if (badge) badge.textContent = correctStreak;

  // Swing animation
  const char = document.getElementById('spideyChar');
  if (!char) return;
  char.style.display = 'block';
  char.classList.remove('spidey-swing'); // reset
  void char.offsetWidth; // reflow
  char.classList.add('spidey-swing');

  // Show streak badge if ≥ 3
  if (correctStreak >= 3 && badgeEl) {
    badgeEl.style.display = 'flex';
    badgeEl.classList.remove('streak-pop');
    void badgeEl.offsetWidth;
    badgeEl.classList.add('streak-pop');
  }

  // 5-streak = show mastered wall + web shot
  if (correctStreak >= 5 && correctStreak % 5 === 0) {
    setTimeout(() => showMasteredWall(), 900);
  }

  // Hide Spidey after animation
  setTimeout(() => {
    char.style.display = 'none';
    char.classList.remove('spidey-swing');
  }, 1400);
}

// ─── Play wrong animation ───────────────────────────────────────────────────
export function playWrong() {
  correctStreak = 0;
  const badgeEl = document.getElementById('webStreak');
  if (badgeEl) badgeEl.style.display = 'none';

  const char = document.getElementById('venomChar');
  if (!char) return;
  char.style.display = 'block';
  char.classList.remove('venom-crawl');
  void char.offsetWidth;
  char.classList.add('venom-crawl');

  setTimeout(() => {
    char.style.display = 'none';
    char.classList.remove('venom-crawl');
  }, 1800);
}

// ─── Show mastered wall overlay ─────────────────────────────────────────────
export function showMasteredWall() {
  if (!masteredWallEl) return;
  const grid = masteredWallEl.querySelector('#mwWordGrid');
  if (!grid) return;

  // Render all mastered words as web-pinned cards
  grid.innerHTML = masteredWords.map((w, i) => `
    <div class="mw-word-card" style="animation-delay: ${i * 0.06}s">
      <div class="mw-web-pin">🕸️</div>
      <span class="mw-word">${w}</span>
    </div>
  `).join('');

  masteredWallEl.classList.add('open');
}

// ─── Reset streak (call on new quiz session) ─────────────────────────────────
export function resetSpidey() {
  correctStreak = 0;
  masteredWords = [];
  const badgeEl = document.getElementById('webStreak');
  if (badgeEl) badgeEl.style.display = 'none';
}
