/**
 * tests/shortcuts.test.js
 * Unit test for Decipher Power Shortcuts and Command Registry
 */

describe('Shortcuts Registry & Dispatcher', () => {
  let registry;

  beforeEach(() => {
    registry = new Map();
  });

  function registerShortcut(combo, action, description = '') {
    registry.set(combo.toLowerCase(), { action, description });
  }

  function triggerShortcut(combo) {
    const entry = registry.get(combo.toLowerCase());
    if (entry && typeof entry.action === 'function') {
      entry.action();
      return true;
    }
    return false;
  }

  test('registers and triggers single-key shortcuts', () => {
    const mockAction = jest.fn();
    registerShortcut('?', mockAction, 'Open Command Palette');
    
    expect(registry.has('?')).toBe(true);
    const triggered = triggerShortcut('?');
    expect(triggered).toBe(true);
    expect(mockAction).toHaveBeenCalledTimes(1);
  });

  test('registers and triggers chord navigation shortcuts', () => {
    const mockNav = jest.fn();
    registerShortcut('g+s', () => mockNav('studioView'), 'Go to Learning Studio');
    registerShortcut('g+h', () => mockNav('landing'), 'Go to Home / Landing');

    expect(triggerShortcut('g+s')).toBe(true);
    expect(mockNav).toHaveBeenCalledWith('studioView');

    expect(triggerShortcut('g+h')).toBe(true);
    expect(mockNav).toHaveBeenCalledWith('landing');
  });

  test('returns false for unregistered shortcuts', () => {
    expect(triggerShortcut('ctrl+shift+alt+z')).toBe(false);
  });
});
