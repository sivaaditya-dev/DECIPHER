/**
 * trophies.js - Gamification Badges, Trophy Cabinet & Streak Shield
 * Decipher Language Learning Platform
 */

const TROPHIES = [
  { id: 'first_word', title: 'First Decipher', desc: 'Analyzed your first study text', icon: '🌱', tier: 'bronze' },
  { id: 'audio_virtuoso', title: 'Vocal Master', desc: 'Completed a pronunciation studio recording', icon: '🎙️', tier: 'silver' },
  { id: 'speed_reader', title: 'Cognitive Surge', desc: 'Read at 350+ WPM with RSVP reader', icon: '⚡', tier: 'silver' },
  { id: 'zen_monk', title: 'Zen Discipline', desc: 'Completed a 25-minute Pomodoro focus sprint', icon: '🧘', tier: 'gold' },
  { id: 'anki_scholar', title: 'Deck Architect', desc: 'Exported a vocabulary deck to Anki', icon: '🎴', tier: 'bronze' },
  { id: 'streak_shield', title: 'Streak Titan', desc: 'Maintained active daily learning momentum', icon: '🛡️', tier: 'gold' }
];

let unlocked = new Set(['first_word']);
let streakFreezeActive = true;

export function initTrophies() {
  loadSavedTrophies();
}

export function getTrophiesList() {
  return TROPHIES.map(t => ({
    ...t,
    isUnlocked: unlocked.has(t.id)
  }));
}

export function unlockTrophy(trophyId) {
  if (unlocked.has(trophyId)) return false;
  const trophy = TROPHIES.find(t => t.id === trophyId);
  if (!trophy) return false;

  unlocked.add(trophyId);
  saveTrophies();
  triggerCelebrationConfetti();

  if (window.showToast) {
    window.showToast(`🏆 Achievement Unlocked: ${trophy.title}!`, 'success');
  }
  return true;
}

export function triggerCelebrationConfetti() {
  const canvas = document.createElement('canvas');
  canvas.id = 'trophyConfettiCanvas';
  canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:99999;width:100vw;height:100vh;';
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles = [];
  const colors = ['#6366f1', '#a855f7', '#ec4899', '#38bdf8', '#10b981', '#f59e0b'];

  for (let i = 0; i < 90; i++) {
    particles.push({
      x: canvas.width / 2,
      y: canvas.height / 2,
      vx: (Math.random() - 0.5) * 16,
      vy: (Math.random() - 0.5) * 16 - 3,
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: 1,
      rotation: Math.random() * 360
    });
  }

  let frames = 0;
  function anim() {
    frames++;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.35; // gravity
      p.alpha -= 0.015;
      p.rotation += 4;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    });

    if (frames < 75) {
      requestAnimationFrame(anim);
    } else {
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    }
  }

  anim();
}

function loadSavedTrophies() {
  try {
    const raw = localStorage.getItem('decipher_unlocked_trophies');
    if (raw) {
      const arr = JSON.parse(raw);
      unlocked = new Set(arr);
    }
  } catch(e) {}
}

function saveTrophies() {
  try {
    localStorage.setItem('decipher_unlocked_trophies', JSON.stringify([...unlocked]));
  } catch(e) {}
}
