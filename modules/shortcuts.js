/**
 * shortcuts.js - Global & Contextual Keyboard Power Shortcuts
 * Decipher Language Learning Platform
 *
 * Implements:
 * - Unified shortcut registry with contextual scopes ('global', 'quiz', 'flashcards', 'modal')
 * - Navigation chords ('g+h', 'g+s', 'g+l', 'g+p', 'g+c')
 * - Modal keyboard isolation to prevent shortcut collision during active study sessions
 */

const registry = new Map();
let navCallback = null;
let pendingChord = null;
let chordTimeout = null;
let activeContext = 'global';

export function setShortcutContext(ctx = 'global') {
  activeContext = ctx;
}

export function getShortcutContext() {
  return activeContext;
}

export function initGlobalShortcuts(switchView) {
  navCallback = switchView;

  // Default global power shortcuts
  registerShortcut('?', () => {
    if (typeof window !== 'undefined' && window.openCommandPalette) {
      window.openCommandPalette();
    }
  }, 'Open Command Palette & Shortcuts Help', 'global');

  registerShortcut('g+h', () => navCallback?.('landing'), 'Go to Home / Landing', 'global');
  registerShortcut('g+s', () => navCallback?.('studioView'), 'Go to Learning Studio', 'global');
  registerShortcut('g+l', () => navCallback?.('libraryView'), 'Go to Library', 'global');
  registerShortcut('g+p', () => navCallback?.('profileView'), 'Go to Profile & Stats', 'global');
  registerShortcut('g+c', () => navCallback?.('challengeView'), 'Go to Daily Challenge', 'global');

  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', handleKeyDown);
  }
}

export function registerShortcut(combo, action, description = '', context = 'global') {
  const key = combo.toLowerCase();
  let entries = registry.get(key);
  if (!Array.isArray(entries)) {
    entries = [];
  }
  entries = entries.filter(e => e.context !== context);
  entries.push({ action, description, context });
  // Maintain backward compatibility for direct .action/.description access
  entries.action = entries[0].action;
  entries.description = entries[0].description;
  registry.set(key, entries);
}

export function getShortcuts(context = null) {
  const result = [];
  registry.forEach((val, key) => {
    if (Array.isArray(val)) {
      val.forEach(item => {
        if (!context || item.context === context) {
          result.push({ combo: key, description: item.description, context: item.context });
        }
      });
    } else if (val) {
      result.push({ combo: key, description: val.description, context: 'global' });
    }
  });
  return result;
}

export function triggerShortcut(combo, context = activeContext) {
  const entry = registry.get(combo.toLowerCase());
  if (!entry) return false;

  let targetAction = null;
  if (Array.isArray(entry)) {
    let match = entry.find(e => e.context === context && typeof e.action === 'function');
    if (!match && (context === 'quiz' || context === 'flashcards')) {
      match = entry.find(e => e.context === 'modal' && typeof e.action === 'function');
    }
    if (!match && context === 'global') {
      match = entry.find(e => e.context === 'global' && typeof e.action === 'function');
    }
    if (!match && entry[0] && typeof entry[0].action === 'function') {
      match = entry[0];
    }
    targetAction = match ? match.action : null;
  } else if (typeof entry.action === 'function') {
    targetAction = entry.action;
  }

  if (typeof targetAction === 'function') {
    targetAction();
    return true;
  }
  return false;
}

function handleKeyDown(e) {
  // Ignore inside inputs, textareas, contenteditable
  const target = e.target;
  if (target) {
    const tag = target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) {
      return;
    }
  }

  // Bypass global navigation chords if active context is a modal (quiz / flashcards)
  if (activeContext !== 'global') {
    return;
  }

  const key = e.key ? e.key.toLowerCase() : '';

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

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initGlobalShortcuts,
    setShortcutContext,
    getShortcutContext,
    registerShortcut,
    getShortcuts,
    triggerShortcut
  };
}
