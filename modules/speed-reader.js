/**
 * speed-reader.js - Rapid Serial Visual Presentation (RSVP) Engine
 * Decipher Language Learning Platform
 */

let modalEl = null;
let wordEl = null;
let words = [];
let currentIndex = 0;
let wpm = 300;
let isPlaying = false;
let timerId = null;

export function initSpeedReader() {
  if (document.getElementById('decipherSpeedReaderModal')) return;

  const markup = `
    <div id="decipherSpeedReaderModal" class="sr-backdrop" style="display:none;" role="dialog" aria-modal="true" aria-label="RSVP Speed Reader">
      <div class="sr-container">
        <div class="sr-header">
          <div class="sr-title-box">
            <span class="sr-icon">⚡</span>
            <div>
              <h3 class="sr-title">Speed Reader (RSVP)</h3>
              <p class="sr-sub">Rapid Serial Visual Presentation with Optimal Recognition Point (ORP)</p>
            </div>
          </div>
          <button id="closeSrBtn" class="sr-close-btn" aria-label="Close">&times;</button>
        </div>

        <!-- RSVP Reticle Box -->
        <div class="sr-reticle-box">
          <div class="sr-guide-line top-guide"></div>
          <div id="srWordDisplay" class="sr-word-display">
            <span class="sr-part-left">Spe</span><span class="sr-orp">e</span><span class="sr-part-right">d</span>
          </div>
          <div class="sr-guide-line bottom-guide"></div>
        </div>

        <!-- Progress Bar -->
        <div class="sr-progress-track">
          <div id="srProgressBar" class="sr-progress-fill" style="width: 0%;"></div>
        </div>

        <!-- Controls -->
        <div class="sr-controls-bar">
          <div class="sr-counter">
            <span id="srWordIndex">0</span> / <span id="srTotalWords">0</span> words
          </div>

          <div class="sr-main-actions">
            <button id="srRewindBtn" class="sr-ctrl-btn" title="Back 10 words">⏪</button>
            <button id="srPlayToggleBtn" class="sr-play-btn">
              <span id="srPlayIcon">▶️</span>
            </button>
            <button id="srForwardBtn" class="sr-ctrl-btn" title="Forward 10 words">⏩</button>
          </div>

          <div class="sr-wpm-box">
            <span id="srWpmDisplay">300 WPM</span>
            <input type="range" id="srWpmSlider" min="150" max="750" step="25" value="300" class="sr-slider" />
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', markup);

  modalEl = document.getElementById('decipherSpeedReaderModal');
  wordEl = document.getElementById('srWordDisplay');

  document.getElementById('closeSrBtn')?.addEventListener('click', closeSpeedReader);
  modalEl?.addEventListener('click', (e) => {
    if (e.target === modalEl) closeSpeedReader();
  });

  document.getElementById('srPlayToggleBtn')?.addEventListener('click', togglePlay);
  document.getElementById('srRewindBtn')?.addEventListener('click', () => jumpWords(-10));
  document.getElementById('srForwardBtn')?.addEventListener('click', () => jumpWords(10));

  const slider = document.getElementById('srWpmSlider');
  const wpmLabel = document.getElementById('srWpmDisplay');
  slider?.addEventListener('input', (e) => {
    wpm = parseInt(e.target.value, 10);
    if (wpmLabel) wpmLabel.textContent = `${wpm} WPM`;
    if (isPlaying) {
      pause();
      play();
    }
  });

  window.addEventListener('keydown', (e) => {
    if (!modalEl || modalEl.style.display !== 'flex') return;
    if (e.code === 'Space') {
      e.preventDefault();
      togglePlay();
    } else if (e.key === 'ArrowLeft') {
      jumpWords(-10);
    } else if (e.key === 'ArrowRight') {
      jumpWords(10);
    } else if (e.key === 'Escape') {
      closeSpeedReader();
    }
  });
}

export function openSpeedReader(text) {
  if (!modalEl) initSpeedReader();
  const rawText = text || 'Decipher accelerates your language acquisition through rapid cognitive parsing and optimal visual fixation.';
  words = rawText.trim().split(/\s+/).filter(w => w.length > 0);
  currentIndex = 0;
  pause();

  const totalEl = document.getElementById('srTotalWords');
  if (totalEl) totalEl.textContent = words.length;

  if (modalEl) modalEl.style.display = 'flex';
  renderCurrentWord();
}

export function closeSpeedReader() {
  pause();
  if (modalEl) modalEl.style.display = 'none';
}

function togglePlay() {
  if (isPlaying) pause();
  else play();
}

function play() {
  if (words.length === 0) return;
  isPlaying = true;
  updatePlayButton(true);
  scheduleNext();
}

function pause() {
  isPlaying = false;
  updatePlayButton(false);
  if (timerId) {
    clearTimeout(timerId);
    timerId = null;
  }
}

function scheduleNext() {
  if (!isPlaying) return;
  if (currentIndex >= words.length) {
    pause();
    return;
  }

  renderCurrentWord();
  currentIndex++;

  // Calculate interval with punctuation delay
  const baseDelay = (60 / wpm) * 1000;
  const currWord = words[currentIndex - 1] || '';
  let extraDelay = 0;
  if (currWord.endsWith('.') || currWord.endsWith('!') || currWord.endsWith('?')) extraDelay = baseDelay * 0.8;
  else if (currWord.endsWith(',') || currWord.endsWith(';') || currWord.endsWith(':')) extraDelay = baseDelay * 0.4;

  timerId = setTimeout(scheduleNext, baseDelay + extraDelay);
}

function jumpWords(offset) {
  currentIndex = Math.max(0, Math.min(words.length - 1, currentIndex + offset));
  renderCurrentWord();
}

function renderCurrentWord() {
  if (!wordEl || words.length === 0) return;
  const w = words[currentIndex] || '';
  
  // Calculate Optimal Recognition Point (ORP)
  let orpIdx = 0;
  const len = w.length;
  if (len <= 1) orpIdx = 0;
  else if (len <= 5) orpIdx = 1;
  else if (len <= 9) orpIdx = 2;
  else orpIdx = 3;

  const left = w.slice(0, orpIdx);
  const orpChar = w[orpIdx] || '';
  const right = w.slice(orpIdx + 1);

  wordEl.innerHTML = `
    <span class="sr-part-left">${escapeHTML(left)}</span><span class="sr-orp">${escapeHTML(orpChar)}</span><span class="sr-part-right">${escapeHTML(right)}</span>
  `;

  const idxEl = document.getElementById('srWordIndex');
  if (idxEl) idxEl.textContent = currentIndex + 1;

  const progressEl = document.getElementById('srProgressBar');
  if (progressEl) {
    const pct = ((currentIndex + 1) / words.length) * 100;
    progressEl.style.width = `${pct}%`;
  }
}

function updatePlayButton(playing) {
  const icon = document.getElementById('srPlayIcon');
  if (icon) icon.textContent = playing ? '⏸️' : '▶️';
}

function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, tag => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[tag] || tag));
}
