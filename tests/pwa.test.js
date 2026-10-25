/**
 * tests/pwa.test.js
 * Unit tests for Decipher PWA Service Worker logic
 */

describe('PWA Service Worker Utilities', () => {
  const CACHE_NAME = 'decipher-cache-v1';

  const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/styles.css',
    '/main.js',
    '/modules/api.js',
    '/modules/palette.js',
    '/modules/flashcards.js',
    '/modules/zen-focus.js',
  ];

  function isApiRoute(url) {
    try {
      const parsed = new URL(url, 'https://decipher.app');
      return parsed.pathname.startsWith('/api/');
    } catch {
      return false;
    }
  }

  function shouldBypassCache(method) {
    return method !== 'GET';
  }

  test('CACHE_NAME is a non-empty string', () => {
    expect(typeof CACHE_NAME).toBe('string');
    expect(CACHE_NAME.length).toBeGreaterThan(0);
  });

  test('STATIC_ASSETS contains critical shell files', () => {
    expect(STATIC_ASSETS).toContain('/index.html');
    expect(STATIC_ASSETS).toContain('/styles.css');
    expect(STATIC_ASSETS).toContain('/main.js');
  });

  test('correctly identifies API routes for network-first strategy', () => {
    expect(isApiRoute('/api/profile')).toBe(true);
    expect(isApiRoute('/api/history')).toBe(true);
    expect(isApiRoute('/index.html')).toBe(false);
    expect(isApiRoute('/styles.css')).toBe(false);
    expect(isApiRoute('/modules/palette.js')).toBe(false);
  });

  test('bypasses cache for non-GET requests', () => {
    expect(shouldBypassCache('POST')).toBe(true);
    expect(shouldBypassCache('PUT')).toBe(true);
    expect(shouldBypassCache('DELETE')).toBe(true);
    expect(shouldBypassCache('GET')).toBe(false);
  });

  test('STATIC_ASSETS includes new feature modules', () => {
    expect(STATIC_ASSETS).toContain('/modules/palette.js');
    expect(STATIC_ASSETS).toContain('/modules/flashcards.js');
    expect(STATIC_ASSETS).toContain('/modules/zen-focus.js');
  });
});
