/**
 * spidey.js — Cinematic Spider-Man Quiz Animation System (Photorealistic Update)
 *
 * Architecture:
 *  - A fixed <div> stage covers the full viewport (pointer-events:none)
 *  - A <canvas> inside draws the live web line from hand to anchor via rAF
 *  - Spider-Man is an <img> using a highly-detailed photorealistic game asset
 *  - Animation uses purely CSS transform (translate & rotate) for buttery smooth 60fps GPU performance
 *  - Direction state machine: alternates L→R and R→L swings for correct answers
 *  - Wrong answer: web snaps mid-swing, Spidey tumbles and falls off screen
 */

// ─── State ────────────────────────────────────────────────────────────────────
let stage = null;
let canvas = null;
let ctx = null;
let spideyEl = null;
let streakBadge = null;
let masteredWallEl = null;

let correctStreak = 0;
let masteredWords = [];

// Direction: 1 = left→right, -1 = right→left
let swingDirection = 1;
// Is currently mid-animation?
let isAnimating = false;
// rAF for web line drawing
let webRaf = null;
let swingDuration = 900; // ms per half-swing

// Anchor point: top-left corner of viewport
const ANCHOR = { x: 0, y: 0 };

// Character center offset for the generated image
const HERO_WIDTH = 150;
const HERO_HEIGHT = 150;

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

  // Spidey character element (Photorealistic image)
  spideyEl = document.createElement('img');
  spideyEl.id = 'spideyChar';
  spideyEl.src = '/assets/spidey-realistic.png';
  spideyEl.style.cssText = `
    position: absolute;
    top: 0; left: 0;
    width: ${HERO_WIDTH}px; height: ${HERO_HEIGHT}px;
    display: none;
    transform-origin: center top;
    will-change: transform, opacity;
    filter: drop-shadow(0 8px 24px rgba(0,0,0,0.6));
    object-fit: contain;
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
  if (isAnimating) return;
  isAnimating = true;

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Web length ≈ 55% of viewport height
  const webLen = vh * 0.55;

  // Start/end X positions based on direction
  const leftX  = vw * 0.05;
  const rightX = vw * 0.88;
  const startX = swingDirection === 1 ? leftX : rightX;
  const endX   = swingDirection === 1 ? rightX : leftX;

  // Y position at the end of the web (pendulum geometry from anchor)
  const getY = (x) => {
    const dx = x - ANCHOR.x;
    return Math.sqrt(Math.max(0, webLen * webLen - dx * dx));
  };

  // For wrong answer: snap web exactly in the middle of the swing arc
  let webSnapped = false;
  let snapTime = type === 'wrong' ? swingDuration * 0.5 : Infinity;

  // Prep Spidey display
  spideyEl.style.display = 'block';
  spideyEl.style.opacity = '1';
  spideyEl.style.transition = 'none';

  const startTime_ref = { t: null };

  function animate(ts) {
    if (!startTime_ref.t) startTime_ref.t = ts;
    const elapsed = ts - startTime_ref.t;
    const progress = Math.min(elapsed / swingDuration, 1);

    // Ease: pendulum uses sine curve (slow at ends, fast in middle)
    const eased = Math.sin(progress * Math.PI);
    const x = startX + (endX - startX) * progress;
    const y = getY(x);

    // Rotation: tilts in direction of travel
    const rotDeg = swingDirection === 1
      ? -35 + 70 * progress   // -35° at left, +35° at right
      : 35 - 70 * progress;   // 35° at right, -35° at left
    
    // Scale X to flip character depending on direction
    const flipX = swingDirection === -1 ? 'scaleX(-1)' : 'scaleX(1)';
    
    // Use pure GPU transform for buttery smooth movement
    spideyEl.style.transform = `translate(${x - HERO_WIDTH/2}px, ${y - 20}px) rotate(${rotDeg}deg) ${flipX}`;

    // Web snap for wrong answer
    if (type === 'wrong' && elapsed >= snapTime && !webSnapped) {
      webSnapped = true;
      drawWebSnap(x, y);
      setTimeout(() => fallDown(x, y), 80);
      cancelAnimationFrame(webRaf);
      clearCanvas();
      isAnimating = false;
      return;
    }

    // Draw web line
    if (!webSnapped) drawWebLine(x, y);

    if (progress < 1) {
      webRaf = requestAnimationFrame(animate);
    } else {
      // Swing complete
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

  // Anchor to roughly Spidey's hand
  const handX = spideyX + (swingDirection === 1 ? 15 : -15);
  const handY = spideyY - 10;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(ANCHOR.x + 2, ANCHOR.y + 2);

  const cpX = (ANCHOR.x + handX) * 0.5 + (swingDirection === 1 ? -30 : 30);
  const cpY = (ANCHOR.y + handY) * 0.5 - 20;
  ctx.quadraticCurveTo(cpX, cpY, handX, handY);

  const grad = ctx.createLinearGradient(ANCHOR.x, ANCHOR.y, handX, handY);
  grad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
  grad.addColorStop(1, 'rgba(230, 230, 250, 0.8)');
  ctx.strokeStyle = grad;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
  ctx.shadowBlur = 6;
  ctx.stroke();
  ctx.restore();
}

// ─── Draw Web Snap Effect ──────────────────────────────────────────────────────
function drawWebSnap(spideyX, spideyY) {
  if (!ctx) return;
  clearCanvas();

  const handX = spideyX;
  const handY = spideyY;
  const snapX = (ANCHOR.x + handX) * 0.5;
  const snapY = (ANCHOR.y + handY) * 0.5;

  ctx.save();
  // Top half
  ctx.beginPath();
  ctx.moveTo(ANCHOR.x + 2, ANCHOR.y + 2);
  ctx.lineTo(snapX + (Math.random() * 10 - 5), snapY + (Math.random() * 10 - 5));
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Bottom fragment
  ctx.beginPath();
  ctx.moveTo(handX, handY);
  ctx.lineTo(snapX + (Math.random() * 10 - 5), snapY + 10 + Math.random() * 15);
  ctx.stroke();

  // Particles
  for (let i = 0; i < 8; i++) {
    const angle = (Math.PI * 2 * i) / 8;
    const len = 8 + Math.random() * 15;
    ctx.beginPath();
    ctx.moveTo(snapX, snapY);
    ctx.lineTo(snapX + Math.cos(angle) * len, snapY + Math.sin(angle) * len);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.restore();
}

// ─── Fall Animation ────────────────────────────────────────────────────────────
function fallDown(x, y) {
  // Use pure transform for smooth hardware-accelerated fall
  const fallY = window.innerHeight + 300;
  spideyEl.style.transition = 'transform 1s cubic-bezier(0.55, 0, 1, 0.45), opacity 0.8s 0.2s ease-in';
  
  const rot = swingDirection === 1 ? 160 : -160;
  const flipX = swingDirection === -1 ? 'scaleX(-1)' : 'scaleX(1)';
  
  spideyEl.style.transform = `translate(${x - HERO_WIDTH/2}px, ${fallY}px) rotate(${rot}deg) ${flipX}`;
  spideyEl.style.opacity = '0';

  setTimeout(() => {
    spideyEl.style.display = 'none';
    spideyEl.style.transition = '';
    spideyEl.style.opacity = '1';
    clearCanvas();
    // Reverse direction after fall so it continues the pattern correctly
    swingDirection *= -1;
    isAnimating = false;
  }, 1050);
}

function clearCanvas() {
  if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// ─── Mastered Wall (Unchanged) ─────────────────────────────────────────────────
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
        <div style="font-size:2.5rem;filter:drop-shadow(0 0 12px rgba(220,0,0,0.8))">🕸️</div>
        <div>
          <h2 style="margin:0;font-size:1.6rem;font-weight:800;
            background:linear-gradient(135deg,#FF4444,#FF8888);
            -webkit-background-clip:text;-webkit-text-fill-color:transparent;">
            Mastered Wall
          </h2>
          <p style="margin:4px 0 0;color:rgba(255,255,255,0.5);font-size:0.85rem;">
            Words caught in Spidey's web
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

// ─── Reset ────────────────────────────────────────────────────────────────────
export function resetSpidey() {
  correctStreak = 0;
  masteredWords = [];
  swingDirection = 1;
  isAnimating = false;
  if (streakBadge) streakBadge.style.display = 'none';
  if (webRaf) cancelAnimationFrame(webRaf);
  clearCanvas();
  if (spideyEl) {
    spideyEl.style.display = 'none';
    spideyEl.style.transition = 'none';
  }
}

export { showMasteredWall as showMasteredWallExport };
