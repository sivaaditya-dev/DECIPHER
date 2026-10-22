/**
 * zen-focus.js - Pomodoro Focus Timer & Web Audio Ambient Sound Generator
 * Decipher Language Learning Platform
 */

let modalEl = null;
let timerId = null;
let timeLeft = 25 * 60; // 25 min default
let isRunning = false;
let currentMode = 'focus'; // 'focus' | 'break'

let audioCtx = null;
let noiseNode = null;
let gainNode = null;
let isAudioActive = false;

export function initZenFocus() {
  if (document.getElementById('decipherZenFocusModal')) return;

  const markup = `
    <div id="decipherZenFocusModal" class="zen-backdrop" style="display:none;" role="dialog" aria-modal="true" aria-label="Zen Study Timer">
      <div class="zen-container">
        <div class="zen-header">
          <div class="zen-title-box">
            <span class="zen-icon">🧘</span>
            <div>
              <h3 class="zen-title">Zen Study Room</h3>
              <p class="zen-sub">Distraction-free Pomodoro focus with ambient acoustics</p>
            </div>
          </div>
          <button id="closeZenBtn" class="zen-close-btn" aria-label="Close">&times;</button>
        </div>

        <!-- Circular Timer Ring -->
        <div class="zen-timer-center">
          <svg class="zen-svg" width="220" height="220" viewBox="0 0 220 220">
            <circle class="zen-circle-bg" cx="110" cy="110" r="95"></circle>
            <circle id="zenProgressRing" class="zen-circle-progress" cx="110" cy="110" r="95"></circle>
          </svg>
          <div class="zen-time-display">
            <span id="zenTimeLabel" class="zen-time">25:00</span>
            <span id="zenModeLabel" class="zen-mode-badge">FOCUS SESSION</span>
          </div>
        </div>

        <!-- Timer Controls -->
        <div class="zen-timer-controls">
          <button id="zenToggleBtn" class="zen-btn-primary">Start Focus</button>
          <button id="zenResetBtn" class="zen-btn-secondary">Reset</button>
        </div>

        <!-- Ambient Sound Generator (Web Audio API) -->
        <div class="zen-ambient-box">
          <span class="ambient-title">🎧 Ambient Soundscapes</span>
          <div class="zen-sound-chips">
            <button class="zen-chip" data-sound="rain">🌧️ Rain</button>
            <button class="zen-chip" data-sound="pink">🌊 Ocean Pink Noise</button>
            <button class="zen-chip" data-sound="binaural">✨ Focus Tone</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', markup);

  modalEl = document.getElementById('decipherZenFocusModal');

  document.getElementById('closeZenBtn')?.addEventListener('click', closeZenFocus);
  modalEl?.addEventListener('click', (e) => {
    if (e.target === modalEl) closeZenFocus();
  });

  document.getElementById('zenToggleBtn')?.addEventListener('click', toggleTimer);
  document.getElementById('zenResetBtn')?.addEventListener('click', resetTimer);

  document.querySelectorAll('.zen-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const snd = chip.dataset.sound;
      toggleSound(snd, chip);
    });
  });
}

export function openZenFocus() {
  if (!modalEl) initZenFocus();
  if (modalEl) modalEl.style.display = 'flex';
  updateDisplay();
}

export function closeZenFocus() {
  if (modalEl) modalEl.style.display = 'none';
  stopAmbientSound();
}

function toggleTimer() {
  if (isRunning) {
    pauseTimer();
  } else {
    startTimer();
  }
}

function startTimer() {
  isRunning = true;
  const btn = document.getElementById('zenToggleBtn');
  if (btn) btn.textContent = 'Pause';

  timerId = setInterval(() => {
    if (timeLeft > 0) {
      timeLeft--;
      updateDisplay();
    } else {
      handleTimerComplete();
    }
  }, 1000);
}

function pauseTimer() {
  isRunning = false;
  if (timerId) clearInterval(timerId);
  const btn = document.getElementById('zenToggleBtn');
  if (btn) btn.textContent = 'Resume';
}

function resetTimer() {
  pauseTimer();
  timeLeft = currentMode === 'focus' ? 25 * 60 : 5 * 60;
  const btn = document.getElementById('zenToggleBtn');
  if (btn) btn.textContent = 'Start Focus';
  updateDisplay();
}

function handleTimerComplete() {
  pauseTimer();
  playChime();
  if (currentMode === 'focus') {
    currentMode = 'break';
    timeLeft = 5 * 60;
    if (window.showToast) window.showToast('Great focus session! Take a 5-minute break.', 'success');
  } else {
    currentMode = 'focus';
    timeLeft = 25 * 60;
    if (window.showToast) window.showToast('Break over! Ready for the next focus sprint?', 'info');
  }
  updateDisplay();
}

function updateDisplay() {
  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const label = document.getElementById('zenTimeLabel');
  if (label) label.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  const modeLabel = document.getElementById('zenModeLabel');
  if (modeLabel) modeLabel.textContent = currentMode === 'focus' ? 'FOCUS SESSION' : 'REST INTERVAL';

  const ring = document.getElementById('zenProgressRing');
  if (ring) {
    const total = currentMode === 'focus' ? 25 * 60 : 5 * 60;
    const progress = (total - timeLeft) / total;
    const circumference = 2 * Math.PI * 95;
    ring.style.strokeDasharray = `${circumference}`;
    ring.style.strokeDashoffset = `${circumference * (1 - progress)}`;
  }
}

function playChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.3); // A5
    g.gain.setValueAtTime(0.3, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 1.2);
  } catch(e) {}
}

function toggleSound(type, chip) {
  if (isAudioActive && chip.classList.contains('chip-active')) {
    stopAmbientSound();
    chip.classList.remove('chip-active');
  } else {
    document.querySelectorAll('.zen-chip').forEach(c => c.classList.remove('chip-active'));
    startAmbientSound(type);
    chip.classList.add('chip-active');
  }
}

function startAmbientSound(type) {
  stopAmbientSound();
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);

    if (type === 'binaural') {
      const osc1 = audioCtx.createOscillator();
      const osc2 = audioCtx.createOscillator();
      osc1.frequency.value = 216; // Pure study tone
      osc2.frequency.value = 226; // 10Hz Alpha beat difference
      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      osc1.start();
      osc2.start();
      noiseNode = { stop: () => { osc1.stop(); osc2.stop(); } };
    } else {
      // Pink / White Noise Generator for Rain & Ocean
      const bufferSize = audioCtx.sampleRate * 2;
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        data[i] = (b0 + b1 + b2) * 0.12;
      }
      const noise = audioCtx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;
      noise.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      noise.start();
      noiseNode = noise;
    }
    isAudioActive = true;
  } catch (err) {
    console.warn('[ZenAudio] Web Audio failed:', err);
  }
}

function stopAmbientSound() {
  if (noiseNode && typeof noiseNode.stop === 'function') {
    try { noiseNode.stop(); } catch(e) {}
  }
  if (audioCtx) {
    try { audioCtx.close(); } catch(e) {}
    audioCtx = null;
  }
  isAudioActive = false;
  document.querySelectorAll('.zen-chip').forEach(c => c.classList.remove('chip-active'));
}
