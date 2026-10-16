/**
 * shortcuts.js - Global Keyboard Power Shortcuts
 * Decipher Language Learning Platform
 */

const registry = new Map();
let navCallback = null;
let pendingChord = null;
let chordTimeout = null;

export function initGlobalShortcuts(switchView) {
  navCallback = switchView;

  // Default power shortcuts
  registerShortcut('?', () => {
    if (window.openCommandPalette) window.openCommandPalette();
  }, 'Open Command Palette & Shortcuts Help');

  registerShortcut('g+h', () => navCallback?.('landing'), 'Go to Home / Landing');
  registerShortcut('g+s', () => navCallback?.('studioView'), 'Go to Learning Studio');
  registerShortcut('g+l', () => navCallback?.('libraryView'), 'Go to Library');
  registerShortcut('g+p', () => navCallback?.('profileView'), 'Go to Profile & Stats');
  registerShortcut('g+c', () => navCallback?.('challengeView'), 'Go to Daily Challenge');

  window.addEventListener('keydown', handleKeyDown);
}

export function registerShortcut(combo, action, description = '') {
  registry.set(combo.toLowerCase(), { action, description });
}

export function getShortcuts() {
  const result = [];
  registry.forEach((val, key) => {
    result.push({ combo: key, description: val.description });
  });
  return result;
}

export function triggerShortcut(combo) {
  const entry = registry.get(combo.toLowerCase());
  if (entry && typeof entry.action === 'function') {
    entry.action();
    return true;
  }
  return false;
}

function handleKeyDown(e) {
  // Ignore inside inputs, textareas, contenteditable
  const tag = e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) {
    return;
  }

  const key = e.key.toLowerCase();

  // Single key matching (like '?')
  if (key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault();
    triggerShortcut('?');
    return;
  }

  // Chord sequence (e.g. 'g' followed by 'h')
  if (pendingChord) {
    clearTimeout(chordTimeout);
    const fullChord = `${pendingChord}+${key}`;
    pendingChord = null;
    if (triggerShortcut(fullChord)) {
      e.preventDefault();
    }
    return;
  }

  if (key === 'g' && !e.ctrlKey && !e.metaKey && !e.altKey) {
    pendingChord = 'g';
    chordTimeout = setTimeout(() => {
      pendingChord = null;
    }, 1200);
  }
}
