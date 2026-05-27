/**
 * spidey.js — Cinematic Spider-Man Quiz Animation System
 *
 * Architecture:
 *  - A fixed <div> stage covers the full viewport (pointer-events:none)
 *  - A <canvas> inside draws the live web line from hand to anchor via rAF
 *  - Spider-Man is a premium detailed SVG element positioned absolutely
 *  - Direction state machine: tracks swing direction (L→R or R→L)
 *  - Correct: pendulum swing continues in current direction, then reverses
 *  - Wrong: web snaps mid-swing, Spidey falls + tumbles off screen
 */

// ─── Premium Spider-Man SVG ──────────────────────────────────────────────────
// Highly detailed: web hexagon suit pattern, realistic white eye lenses,
// proper proportions in mid-swing action pose.
const SPIDERMAN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300" width="130" height="195">
  <defs>
    <!-- Suit red gradient for depth -->
    <radialGradient id="bodyGrad" cx="40%" cy="30%" r="65%">
      <stop offset="0%" stop-color="#FF3030"/>
      <stop offset="60%" stop-color="#CC0000"/>
      <stop offset="100%" stop-color="#880000"/>
    </radialGradient>
    <radialGradient id="blueGrad" cx="40%" cy="30%" r="65%">
      <stop offset="0%" stop-color="#1A3A8F"/>
      <stop offset="60%" stop-color="#0D2266"/>
      <stop offset="100%" stop-color="#060F33"/>
    </radialGradient>
    <radialGradient id="headGrad" cx="35%" cy="25%" r="70%">
      <stop offset="0%" stop-color="#FF2828"/>
      <stop offset="55%" stop-color="#CC0000"/>
      <stop offset="100%" stop-color="#800000"/>
    </radialGradient>
    <!-- Web pattern filter -->
    <filter id="glow">
      <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
      <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <!-- ── LEGS (blue, bent in mid-swing pose) ─────────── -->
  <!-- Left leg bent back -->
  <path d="M82 190 Q55 220 45 250 Q40 262 50 268" 
        stroke="url(#blueGrad)" stroke-width="14" stroke-linecap="round" fill="none"/>
  <!-- Right leg extended forward -->
  <path d="M110 190 Q130 215 145 230 Q155 240 152 252" 
        stroke="url(#blueGrad)" stroke-width="14" stroke-linecap="round" fill="none"/>
  <!-- Boot tips -->
  <ellipse cx="51" cy="270" rx="9" ry="5" fill="#0D2266" transform="rotate(-20 51 270)"/>
  <ellipse cx="151" cy="254" rx="9" ry="5" fill="#0D2266" transform="rotate(25 151 254)"/>

  <!-- ── TORSO (red with web pattern) ──────────────────── -->
  <ellipse cx="96" cy="165" rx="36" ry="50" fill="url(#bodyGrad)"/>
  
  <!-- Blue chest sides -->
  <path d="M60 155 Q65 140 80 130 L80 200 Q65 195 60 180 Z" fill="url(#blueGrad)" opacity="0.9"/>
  <path d="M132 155 Q127 140 112 130 L112 200 Q127 195 132 180 Z" fill="url(#blueGrad)" opacity="0.9"/>

  <!-- Web pattern on torso - centered spider web lines -->
  <g stroke="#6B0000" stroke-width="0.8" fill="none" opacity="0.7">
    <!-- Radial lines from chest center -->
    <line x1="96" y1="148" x2="96" y2="115"/>
    <line x1="96" y1="148" x2="120" y2="125"/>
    <line x1="96" y1="148" x2="130" y2="155"/>
    <line x1="96" y1="148" x2="120" y2="175"/>
    <line x1="96" y1="148" x2="96" y2="185"/>
    <line x1="96" y1="148" x2="72" y2="175"/>
    <line x1="96" y1="148" x2="62" y2="155"/>
    <line x1="96" y1="148" x2="72" y2="125"/>
    <!-- Concentric web arcs -->
    <ellipse cx="96" cy="148" rx="12" ry="8"/>
    <ellipse cx="96" cy="148" rx="22" ry="16"/>
    <ellipse cx="96" cy="148" rx="33" ry="24"/>
  </g>

  <!-- Spider emblem on chest -->
  <g fill="#0D0D0D" opacity="0.85">
    <ellipse cx="96" cy="148" rx="5" ry="3"/>
    <path d="M91 148 L82 142 M91 148 L80 152 M91 148 L85 158"/>
    <path d="M101 148 L110 142 M101 148 L112 152 M101 148 L107 158"/>
    <path d="M91 148 L84 137 M101 148 L108 137"/>
  </g>

  <!-- ── ARMS (dramatic mid-swing pose) ────────────────── -->
  <!-- Right arm: raised UP shooting web (this is the arm with the web) -->
  <path d="M112 130 Q145 90 168 52" 
        stroke="url(#blueGrad)" stroke-width="13" stroke-linecap="round" fill="none"/>
  <!-- Right forearm detail / glove -->
  <path d="M150 75 Q162 60 168 52" 
        stroke="#0A1A66" stroke-width="13" stroke-linecap="round" fill="none"/>
  
  <!-- Left arm: swept back for aerodynamics -->
  <path d="M80 130 Q50 155 30 175"
        stroke="url(#blueGrad)" stroke-width="13" stroke-linecap="round" fill="none"/>
  <path d="M45 163 Q36 170 30 175"
        stroke="#0A1A66" stroke-width="13" stroke-linecap="round" fill="none"/>

  <!-- Web shooter hand (right) -->
  <ellipse cx="168" cy="51" rx="7" ry="5" fill="#1A3A8F" transform="rotate(-30 168 51)"/>
  <!-- Web shot burst -->
  <g stroke="#E8D5A0" stroke-width="1.2" opacity="0.9" fill="none">
    <line x1="168" y1="47" x2="170" y2="20"/>
    <line x1="165" y1="46" x2="160" y2="18"/>
    <line x1="171" y1="47" x2="178" y2="20"/>
    <line x1="163" y1="48" x2="155" y2="25"/>
  </g>

  <!-- Left glove -->
  <ellipse cx="30" cy="175" rx="7" ry="5" fill="#1A3A8F" transform="rotate(25 30 175)"/>

  <!-- ── HEAD ───────────────────────────────────────────── -->
  <ellipse cx="96" cy="92" rx="28" ry="32" fill="url(#headGrad)"/>
  
  <!-- Blue back-of-head panel -->
  <path d="M96 62 Q122 65 124 92 Q122 118 96 122 L96 62" fill="url(#blueGrad)" opacity="0.4"/>

  <!-- Web pattern on head -->
  <g stroke="#880000" stroke-width="0.7" fill="none" opacity="0.6">
    <!-- Horizontal lines -->
    <path d="M70 78 Q96 72 122 78"/>
    <path d="M68 90 Q96 84 124 90"/>
    <path d="M69 103 Q96 97 123 103"/>
    <path d="M72 114 Q96 108 120 114"/>
    <!-- Vertical center line -->
    <line x1="96" y1="62" x2="96" y2="122"/>
    <!-- Diagonal web lines -->
    <line x1="96" y1="62" x2="124" y2="85"/>
    <line x1="96" y1="62" x2="68" y2="85"/>
    <line x1="96" y1="122" x2="124" y2="99"/>
    <line x1="96" y1="122" x2="68" y2="99"/>
  </g>

  <!-- ── EYES (the most iconic part — large, white, expressive) ── -->
  <!-- Eye whites with sharp comic-accurate shape -->
  <!-- Left eye (our left = character's right) -->
  <path d="M70 86 Q78 74 88 80 Q82 92 70 90 Z" fill="white" filter="url(#glow)"/>
  <!-- Right eye -->
  <path d="M104 80 Q114 74 122 86 Q122 90 110 92 Z" fill="white" filter="url(#glow)"/>
  
  <!-- Eye inner highlight (gives the lens 3D depth) -->
  <path d="M73 86 Q79 78 86 81 Q82 88 73 88 Z" fill="rgba(200,230,255,0.5)"/>
  <path d="M106 81 Q112 76 119 85 Q119 88 110 88 Z" fill="rgba(200,230,255,0.5)"/>

  <!-- ── NECK ────────────────────────────────────────────── -->
  <rect x="86" y="120" width="20" height="12" rx="4" fill="url(#bodyGrad)"/>
</svg>`;

// ─── State ────────────────────────────────────────────────────────────────────
let stage = null;
let canvas = null;
let ctx = null;
let spideyEl = null;
let streakBadge = null;
let masteredWallEl = null;

let correctStreak = 0;
let masteredWords = [];

// Direction: 0 = not swinging, 1 = left→right, -1 = right→left
let swingDirection = 1;
// Is currently mid-animation?
let isAnimating = false;
// rAF for web line drawing
let webRaf = null;
// Current swing phase (for continuous web line)
let swingPhase = 0; // 0..1
let swingAnimStart = null;
let swingDuration = 900; // ms per half-swing

// Anchor point: top-left corner of viewport
const ANCHOR = { x: 0, y: 0 };

// ─── Init ──────────────────────────────────────────────────────────────────────
export function initSpidey() {
  if (document.getElementById('spideyStage')) return; // guard double-init

  stage = document.createElement('div');
  stage.id = 'spideyStage';
  stage.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
    pointer-events: none; z-index: 9998; overflow: hidden;
  `;

  // Canvas for web line
  canvas = document.createElement('canvas');
  canvas.id = 'spideyWebCanvas';
  canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;';
  stage.appendChild(canvas);

  // Spidey character element
  spideyEl = document.createElement('div');
  spideyEl.id = 'spideyChar';
  spideyEl.innerHTML = SPIDERMAN_SVG;
  spideyEl.style.cssText = `
    position: absolute;
    display: none;
    transform-origin: top center;
    will-change: transform, opacity;
    filter: drop-shadow(0 8px 24px rgba(220,0,0,0.5));
  `;
  stage.appendChild(spideyEl);

  // Streak badge
  streakBadge = document.createElement('div');
  streakBadge.id = 'spideyStreak';
  streakBadge.style.cssText = `
    position: absolute; top: 12px; right: 16px;
    display: none; align-items: center; gap: 6px;
    background: linear-gradient(135deg, rgba(20,20,40,0.92), rgba(10,10,25,0.95));
    border: 1px solid rgba(255,60,60,0.5);
    backdrop-filter: blur(12px);
    border-radius: 40px; padding: 8px 16px;
    font-family: 'Outfit', sans-serif; font-weight: 700;
    font-size: 1rem; color: #fff;
    box-shadow: 0 0 20px rgba(220,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1);
  `;
  streakBadge.innerHTML = `<span style="font-size:1.3rem">🔥</span><span id="spideyStreakNum">0</span><span style="opacity:0.85"> streak!</span>`;
  stage.appendChild(streakBadge);

  document.body.appendChild(stage);

  // Resize canvas to match viewport
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas, { passive: true });

  // Build mastered wall
  buildMasteredWall();
}

function resizeCanvas() {
  if (!canvas) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  ctx = canvas.getContext('2d');
}

// ─── Play Correct ──────────────────────────────────────────────────────────────
export function playCorrect(word = '') {
  correctStreak++;
  if (word) masteredWords.push(word);

  // Update streak badge
  const numEl = document.getElementById('spideyStreakNum');
  if (numEl) numEl.textContent = correctStreak;
  if (streakBadge && correctStreak >= 3) {
    streakBadge.style.display = 'flex';
    streakBadge.style.animation = 'none';
    void streakBadge.offsetWidth;
    streakBadge.style.animation = 'spideyStreakPop 0.4s cubic-bezier(0.34,1.56,0.64,1)';
  }

  // 5-streak → mastered wall
  if (correctStreak >= 5 && correctStreak % 5 === 0) {
    setTimeout(() => showMasteredWall(), swingDuration + 200);
  }

  doSwing('correct');
}

// ─── Play Wrong ────────────────────────────────────────────────────────────────
export function playWrong() {
  correctStreak = 0;
  if (streakBadge) streakBadge.style.display = 'none';
  doSwing('wrong');
}

// ─── Core Swing Engine ─────────────────────────────────────────────────────────
function doSwing(type) {
  if (isAnimating) return; // don't stack animations
  isAnimating = true;

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Compute swing arc positions
  // We swing Spidey across the lower portion of the viewport
  // The web anchor is at top-left (0,0)
  // Web length ≈ 55% of viewport height
  const webLen = vh * 0.55;

  // Start/end X positions based on direction
  const leftX  = vw * 0.05;   // left side
  const rightX = vw * 0.88;   // right side
  const midX   = vw * 0.46;   // middle of arc

  const startX = swingDirection === 1 ? leftX : rightX;
  const endX   = swingDirection === 1 ? rightX : leftX;

  // Y position at the end of the web (computed via pendulum geometry from anchor)
  const getY = (x) => {
    const dx = x - ANCHOR.x;
    return Math.sqrt(Math.max(0, webLen * webLen - dx * dx));
  };

  const startY = getY(startX);
  const endY   = getY(endX);
  const peakY  = getY(midX); // lowest point of the arc (highest on screen = smallest Y value from top)

  // Position Spidey at start
  spideyEl.style.display = 'block';
  spideyEl.style.opacity = '1';
  spideyEl.style.left = (startX - 65) + 'px'; // center the 130px wide SVG
  spideyEl.style.top  = (startY - 20) + 'px';
  spideyEl.style.transition = 'none';
  spideyEl.style.transform = swingDirection === 1 ? 'rotate(-35deg)' : 'rotate(35deg) scaleX(-1)';

  // For wrong answer: snap web at midpoint
  let webSnapped = false;
  let snapTime = type === 'wrong' ? swingDuration * 0.5 : Infinity;

  // Animate
  swingAnimStart = null;
  const startTime_ref = { t: null };

  function animate(ts) {
    if (!startTime_ref.t) startTime_ref.t = ts;
    const elapsed = ts - startTime_ref.t;
    const progress = Math.min(elapsed / swingDuration, 1);

    // Ease: pendulum uses sine curve (slow at ends, fast in middle)
    const eased = Math.sin(progress * Math.PI);
    const x = startX + (endX - startX) * progress;
    // Y follows the circular arc
    const y = getY(x);

    // Rotation: tilts in direction of travel, max tilt at extremes
    const rotDeg = swingDirection === 1
      ? -35 + 70 * progress   // -35° at left, +35° at right
      : 35 - 70 * progress;   // 35° at right, -35° at left
    const flipX = swingDirection === -1 ? 'scaleX(-1)' : '';
    spideyEl.style.transform = `rotate(${rotDeg}deg) ${flipX}`;

    // Web snap for wrong answer
    if (type === 'wrong' && elapsed >= snapTime && !webSnapped) {
      webSnapped = true;
      // Snap canvas web - draw broken effect briefly
      drawWebSnap(x, y);
      // Spidey falls
      setTimeout(() => fallDown(x, y), 80);
      cancelAnimationFrame(webRaf);
      clearCanvas();
      isAnimating = false;
      return;
    }

    // Move Spidey
    spideyEl.style.left = (x - 65) + 'px';
    spideyEl.style.top  = (y - 20) + 'px';

    // Draw web line
    if (!webSnapped) drawWebLine(x, y);

    if (progress < 1) {
      webRaf = requestAnimationFrame(animate);
    } else {
      // Swing complete (correct)
      setTimeout(() => {
        spideyEl.style.display = 'none';
        clearCanvas();
        isAnimating = false;
      }, 150);
      // Reverse direction for next answer
      swingDirection *= -1;
    }
  }

  webRaf = requestAnimationFrame(animate);
}

// ─── Draw Web Line ─────────────────────────────────────────────────────────────
function drawWebLine(spideyX, spideyY) {
  if (!ctx) return;
  clearCanvas();

  // Hand position (right hand tip of Spidey SVG, scaled to actual render size)
  // Spidey SVG viewBox: 200x300, rendered 130x195
  // Right hand (web shooter) is at approx (168, 51) in SVG coords
  const handX = spideyX - 65 + (168 / 200) * 130;
  const handY = spideyY - 20 + (51  / 300) * 195;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(ANCHOR.x + 2, ANCHOR.y + 2);

  // Bezier to give web a realistic slight sag
  const cpX = (ANCHOR.x + handX) * 0.5 + (swingDirection === 1 ? -30 : 30);
  const cpY = (ANCHOR.y + handY) * 0.5 - 20;
  ctx.quadraticCurveTo(cpX, cpY, handX, handY);

  // Web strand style
  const grad = ctx.createLinearGradient(ANCHOR.x, ANCHOR.y, handX, handY);
  grad.addColorStop(0, 'rgba(230, 215, 160, 0.95)');
  grad.addColorStop(0.4, 'rgba(245, 235, 185, 1)');
  grad.addColorStop(1, 'rgba(215, 200, 140, 0.9)');
  ctx.strokeStyle = grad;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.shadowColor = 'rgba(220, 200, 100, 0.6)';
  ctx.shadowBlur = 4;
  ctx.stroke();

  // Second strand (slight offset for thickness)
  ctx.beginPath();
  ctx.moveTo(ANCHOR.x + 4, ANCHOR.y);
  ctx.quadraticCurveTo(cpX + 3, cpY - 3, handX + 2, handY - 2);
  ctx.strokeStyle = 'rgba(245, 235, 185, 0.4)';
  ctx.lineWidth = 1;
  ctx.shadowBlur = 0;
  ctx.stroke();

  ctx.restore();
}

// ─── Draw Web Snap Effect ──────────────────────────────────────────────────────
function drawWebSnap(spideyX, spideyY) {
  if (!ctx) return;
  clearCanvas();

  const handX = spideyX - 65 + (168 / 200) * 130;
  const handY = spideyY - 20 + (51  / 300) * 195;
  const snapX = (ANCHOR.x + handX) * 0.5;
  const snapY = (ANCHOR.y + handY) * 0.5;

  // Top half of web (still attached to anchor)
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(ANCHOR.x + 2, ANCHOR.y + 2);
  ctx.lineTo(snapX + (Math.random() * 10 - 5), snapY + (Math.random() * 10 - 5));
  ctx.strokeStyle = 'rgba(230, 215, 160, 0.8)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Bottom fragment (still attached to hand, now dangling)
  ctx.beginPath();
  ctx.moveTo(handX, handY);
  ctx.lineTo(snapX + (Math.random() * 10 - 5), snapY + 10 + Math.random() * 15);
  ctx.stroke();

  // Flash particles at snap point
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI * 2 * i) / 6;
    const len = 8 + Math.random() * 12;
    ctx.beginPath();
    ctx.moveTo(snapX, snapY);
    ctx.lineTo(snapX + Math.cos(angle) * len, snapY + Math.sin(angle) * len);
    ctx.strokeStyle = 'rgba(255, 220, 100, 0.9)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.restore();
}

// ─── Fall Animation ────────────────────────────────────────────────────────────
function fallDown(fromX, fromY) {
  spideyEl.style.transition = 'transform 0.9s cubic-bezier(0.55, 0, 1, 0.45), top 0.9s cubic-bezier(0.55, 0, 1, 0.45), opacity 0.7s 0.3s ease-in';
  spideyEl.style.top   = (window.innerHeight + 220) + 'px';
  spideyEl.style.transform = `rotate(${swingDirection === 1 ? 120 : -120}deg)`;
  spideyEl.style.opacity = '0';

  setTimeout(() => {
    spideyEl.style.display = 'none';
    spideyEl.style.transition = '';
    spideyEl.style.opacity = '1';
    clearCanvas();
    // Reverse direction after fall
    swingDirection *= -1;
    isAnimating = false;
  }, 1000);
}

function clearCanvas() {
  if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// ─── Mastered Wall ─────────────────────────────────────────────────────────────
function buildMasteredWall() {
  masteredWallEl = document.createElement('div');
  masteredWallEl.id = 'masteredWallOverlay';
  masteredWallEl.style.cssText = `
    position: fixed; inset: 0; z-index: 10000;
    background: radial-gradient(ellipse at center, rgba(10,0,25,0.97) 0%, rgba(5,0,15,0.99) 100%);
    display: flex; align-items: center; justify-content: center;
    opacity: 0; pointer-events: none;
    transition: opacity 0.4s ease;
    backdrop-filter: blur(4px);
  `;

  masteredWallEl.innerHTML = `
    <div style="
      max-width: 700px; width: 92vw;
      background: linear-gradient(145deg, rgba(20,5,40,0.95), rgba(10,0,20,0.98));
      border: 1px solid rgba(220,30,30,0.4);
      border-radius: 24px; padding: 36px;
      box-shadow: 0 0 60px rgba(200,0,0,0.3), 0 0 120px rgba(200,0,0,0.1);
    ">
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:28px;">
        <div style="font-size:2.5rem;filter:drop-shadow(0 0 12px rgba(220,0,0,0.8))">🕷️</div>
        <div>
          <h2 style="margin:0;font-size:1.6rem;font-weight:800;
            background:linear-gradient(135deg,#FF4444,#FF8888);
            -webkit-background-clip:text;-webkit-text-fill-color:transparent;">
            Mastered Wall
          </h2>
          <p style="margin:4px 0 0;color:rgba(255,255,255,0.5);font-size:0.85rem;">
            Words caught in Spidey's web 🕸️
          </p>
        </div>
        <button id="mwClose" style="
          margin-left:auto; background:rgba(255,255,255,0.08);
          border:1px solid rgba(255,255,255,0.12); color:rgba(255,255,255,0.7);
          border-radius:50%; width:36px; height:36px; cursor:pointer;
          font-size:1.1rem; display:flex;align-items:center;justify-content:center;
          pointer-events:all;
        ">✕</button>
      </div>
      <div id="mwWordGrid" style="
        display:grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
        gap:12px; max-height:360px; overflow-y:auto;
        padding-right:4px;
      "></div>
      <div style="margin-top:20px;text-align:center;color:rgba(255,255,255,0.4);font-size:0.8rem;">
        🏆 <span id="mwCount">0</span> words mastered · Keep going!
      </div>
    </div>`;

  document.body.appendChild(masteredWallEl);

  masteredWallEl.addEventListener('click', (e) => {
    if (e.target === masteredWallEl) closeMasteredWall();
  });
  masteredWallEl.querySelector('#mwClose').addEventListener('click', closeMasteredWall);
}

export function showMasteredWall() {
  if (!masteredWallEl) return;
  const grid = masteredWallEl.querySelector('#mwWordGrid');
  const count = masteredWallEl.querySelector('#mwCount');
  if (!grid) return;

  grid.innerHTML = masteredWords.map((w, i) => `
    <div style="
      background: linear-gradient(135deg, rgba(180,0,0,0.2), rgba(100,0,50,0.15));
      border: 1px solid rgba(220,30,30,0.35);
      border-radius: 12px; padding: 10px 14px;
      text-align: center; font-weight: 600;
      color: rgba(255,255,255,0.9); font-size: 0.9rem;
      animation: mwCardIn 0.4s ${i * 0.05}s both ease-out;
      position: relative; overflow: hidden;
    ">
      <div style="position:absolute;top:4px;right:6px;font-size:0.7rem;opacity:0.5">🕸️</div>
      ${w}
    </div>`).join('');

  if (count) count.textContent = masteredWords.length;

  masteredWallEl.style.pointerEvents = 'all';
  masteredWallEl.style.opacity = '1';
}

function closeMasteredWall() {
  if (!masteredWallEl) return;
  masteredWallEl.style.opacity = '0';
  masteredWallEl.style.pointerEvents = 'none';
}

// ─── Reset (call on new quiz session) ─────────────────────────────────────────
export function resetSpidey() {
  correctStreak = 0;
  masteredWords = [];
  swingDirection = 1;
  isAnimating = false;
  if (streakBadge) streakBadge.style.display = 'none';
  cancelAnimationFrame(webRaf);
  clearCanvas();
  if (spideyEl) spideyEl.style.display = 'none';
}

// Keep backward compat exports
export { showMasteredWall as showMasteredWallExport };
