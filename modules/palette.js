/**
 * palette.js - Spotlight-style Command Palette (Ctrl+K / Cmd+K)
 * Decipher Language Learning Platform
 */

const COMMANDS = [
  { id: 'nav-landing', title: 'Go to Home / Landing', category: 'Navigation', icon: '🏠', action: () => window.decipherNav?.('landing') },
  { id: 'nav-studio', title: 'Open Learning Studio', category: 'Navigation', icon: '✨', action: () => window.decipherNav?.('main') },
  { id: 'nav-library', title: 'Open Vocabulary Library', category: 'Navigation', icon: '📚', action: () => window.decipherNav?.('library') },
  { id: 'nav-profile', title: 'View Profile & Stats', category: 'Navigation', icon: '👤', action: () => window.decipherNav?.('profile') },
  { id: 'nav-challenge', title: 'Daily Streak Challenge', category: 'Navigation', icon: '🔥', action: () => window.decipherNav?.('challenge') },
  { id: 'voice-toggle', title: 'Activate Voice Assistant', category: 'Audio', icon: '🎙️', action: () => document.getElementById('voiceMicBtn')?.click() },
  { id: 'theme-toggle', title: 'Toggle Light / Dark Mode', category: 'Appearance', icon: '🌓', action: () => document.getElementById('themeToggleBtn')?.click() },
  { id: 'quiz-start', title: 'Start SRS Practice Quiz', category: 'Study', icon: '🎯', action: () => document.getElementById('startQuizBtn')?.click() }
];

let paletteEl = null;
let inputEl = null;
let resultsEl = null;
let selectedIndex = 0;
let filteredCommands = [...COMMANDS];

export function initCommandPalette() {
  if (document.getElementById('decipherCommandPalette')) return;

  const markup = `
    <div id="decipherCommandPalette" class="palette-backdrop" style="display:none;" role="dialog" aria-modal="true" aria-label="Command Palette">
      <div class="palette-container">
        <div class="palette-header">
          <span class="palette-search-icon">🔍</span>
          <input type="text" id="paletteInput" class="palette-input" placeholder="Type a command or jump to view... (Esc to exit)" autocomplete="off" spellcheck="false" />
          <span class="palette-kbd">ESC</span>
        </div>
        <div id="paletteResults" class="palette-results" role="listbox"></div>
        <div class="palette-footer">
          <span>Use <kbd>↑</kbd> <kbd>↓</kbd> to navigate</span>
          <span><kbd>↵</kbd> to select</span>
          <span><kbd>Ctrl</kbd> + <kbd>K</kbd> to toggle</span>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', markup);

  paletteEl = document.getElementById('decipherCommandPalette');
  inputEl = document.getElementById('paletteInput');
  resultsEl = document.getElementById('paletteResults');

  // Backdrop click to close
  paletteEl.addEventListener('click', (e) => {
    if (e.target === paletteEl) closeCommandPalette();
  });

  // Search input listener
  inputEl.addEventListener('input', (e) => {
    renderPaletteResults(e.target.value);
  });

  // Keyboard navigation within palette
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = (selectedIndex + 1) % (filteredCommands.length || 1);
      highlightSelection();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = (selectedIndex - 1 + filteredCommands.length) % (filteredCommands.length || 1);
      highlightSelection();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      executeCommand(selectedIndex);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeCommandPalette();
    }
  });

  // Global hotkey Ctrl+K / Cmd+K
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      toggleCommandPalette();
    }
  });

  renderPaletteResults();
}

export function openCommandPalette() {
  if (!paletteEl) initCommandPalette();
  paletteEl.style.display = 'flex';
  selectedIndex = 0;
  if (inputEl) {
    inputEl.value = '';
    renderPaletteResults();
    setTimeout(() => inputEl.focus(), 50);
  }
}

export function closeCommandPalette() {
  if (paletteEl) paletteEl.style.display = 'none';
}

export function toggleCommandPalette() {
  if (paletteEl && paletteEl.style.display === 'flex') {
    closeCommandPalette();
  } else {
    openCommandPalette();
  }
}

export function registerPaletteCommand(cmd) {
  COMMANDS.push(cmd);
}

function renderPaletteResults(query = '') {
  const q = query.trim().toLowerCase();
  filteredCommands = COMMANDS.filter(c => 
    !q || c.title.toLowerCase().includes(q) || c.category.toLowerCase().includes(q)
  );

  if (!resultsEl) return;
  if (filteredCommands.length === 0) {
    resultsEl.innerHTML = `<div class="palette-empty">No matching actions found</div>`;
    return;
  }

  selectedIndex = Math.min(selectedIndex, filteredCommands.length - 1);
  resultsEl.innerHTML = filteredCommands.map((c, i) => `
    <div class="palette-item ${i === selectedIndex ? 'palette-item-selected' : ''}" data-index="${i}" role="option">
      <span class="palette-item-icon">${c.icon}</span>
      <div class="palette-item-info">
        <div class="palette-item-title">${escapeHTML(c.title)}</div>
        <div class="palette-item-category">${escapeHTML(c.category)}</div>
      </div>
    </div>
  `).join('');

  resultsEl.querySelectorAll('.palette-item').forEach(item => {
    item.addEventListener('click', () => {
      const idx = parseInt(item.dataset.index, 10);
      executeCommand(idx);
    });
  });
}

function highlightSelection() {
  if (!resultsEl) return;
  const items = resultsEl.querySelectorAll('.palette-item');
  items.forEach((item, i) => {
    item.classList.toggle('palette-item-selected', i === selectedIndex);
    if (i === selectedIndex) {
      item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  });
}

function executeCommand(index) {
  const cmd = filteredCommands[index];
  if (cmd && typeof cmd.action === 'function') {
    closeCommandPalette();
    try {
      cmd.action();
    } catch (err) {
      console.error('[CommandPalette] Execution failed:', err);
    }
  }
}

function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, tag => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[tag] || tag));
}
