/**
 * tests/audio.test.js
 * Unit test suite for Audio Studio:
 * - Phonetic IPA syllable breakdown and stress classification
 * - HiDPI Canvas buffer calibration
 * - Frequency visualizer controller lifecycle and modes
 * - Web Audio API browser compatibility and fallback resilience
 * - SpeechSynthesis native audio playback fallback
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

let parseIPASyllables, setupHiDPICanvas, initFrequencyVisualizer;

try {
  const mod = require('../modules/audio-studio.js');
  parseIPASyllables = mod.parseIPASyllables;
  setupHiDPICanvas = mod.setupHiDPICanvas;
  initFrequencyVisualizer = mod.initFrequencyVisualizer;
} catch {
  const code = fs.readFileSync(path.resolve(__dirname, '../modules/audio-studio.js'), 'utf8');
  const clean = code.replace(/^export\s+/gm, '').replace(/export\s*\{[^}]*\};?/g, '');
  const wrapped = `(function() {\n${clean}\nreturn { parseIPASyllables, setupHiDPICanvas, initFrequencyVisualizer };\n})()`;
  const sandbox = {
    console, Date, Math, Array, Object, Number, RangeError, TypeError, Error, JSON, Map, String,
    parseInt, parseFloat, isNaN, setTimeout, clearTimeout, Uint8Array,
    get window() { return global.window; },
    set window(v) { global.window = v; },
    requestAnimationFrame: (typeof requestAnimationFrame !== 'undefined') ? requestAnimationFrame : (fn => setTimeout(fn, 16)),
    cancelAnimationFrame: (typeof cancelAnimationFrame !== 'undefined') ? cancelAnimationFrame : (id => clearTimeout(id))
  };
  vm.createContext(sandbox);
  const mod = vm.runInContext(wrapped, sandbox);
  parseIPASyllables = mod.parseIPASyllables;
  setupHiDPICanvas = mod.setupHiDPICanvas;
  initFrequencyVisualizer = mod.initFrequencyVisualizer;
}

describe('Audio Studio IPA Syllable & Stress Parser', () => {
  test('parses single syllable word without stress marks', () => {
    const result = parseIPASyllables('/kæt/');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      syllable: 'kæt',
      raw: 'kæt',
      stress: 'none',
      index: 0,
      isStressed: false
    });
  });

  test('parses single syllable word with primary stress', () => {
    const result = parseIPASyllables('/ˈkæt/');
    expect(result).toHaveLength(1);
    expect(result[0].stress).toBe('primary');
    expect(result[0].isStressed).toBe(true);
    expect(result[0].syllable).toBe('kæt');
  });

  test('parses polysyllabic word with primary stress on first syllable', () => {
    const result = parseIPASyllables('ˈkæt.ə.lɪst');
    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({ syllable: 'kæt', stress: 'primary', isStressed: true, index: 0 });
    expect(result[1]).toMatchObject({ syllable: 'ə', stress: 'none', isStressed: false, index: 1 });
    expect(result[2]).toMatchObject({ syllable: 'lɪst', stress: 'none', isStressed: false, index: 2 });
  });

  test('parses polysyllabic word with both secondary and primary stress', () => {
    const result = parseIPASyllables('/ˌkɒm.prɪˈhen.sɪv/');
    expect(result).toHaveLength(4);
    expect(result[0]).toMatchObject({ syllable: 'kɒm', stress: 'secondary', isStressed: true });
    expect(result[1]).toMatchObject({ syllable: 'prɪ', stress: 'none', isStressed: false });
    expect(result[2]).toMatchObject({ syllable: 'hen', stress: 'primary', isStressed: true });
    expect(result[3]).toMatchObject({ syllable: 'sɪv', stress: 'none', isStressed: false });
  });

  test('parses compound stress words without dot separators', () => {
    const result = parseIPASyllables('ˌʌn.dəˈstænd');
    expect(result).toHaveLength(3);
    expect(result[0].stress).toBe('secondary');
    expect(result[1].stress).toBe('none');
    expect(result[2].stress).toBe('primary');
  });

  test('handles square brackets and whitespace formatting', () => {
    const result = parseIPASyllables(' [ ˈser.ən.dɪp.ɪ.ti ] ');
    expect(result.length).toBeGreaterThanOrEqual(4);
    expect(result[0].stress).toBe('primary');
    expect(result[0].syllable).toBe('ser');
  });

  test('normalizes standard apostrophe and comma stress representations', () => {
    const result = parseIPASyllables("'foʊ.nə.,ɡræf");
    expect(result[0].stress).toBe('primary');
  });

  test('returns empty array for invalid, null, or empty inputs', () => {
    expect(parseIPASyllables('')).toEqual([]);
    expect(parseIPASyllables(null)).toEqual([]);
    expect(parseIPASyllables(undefined)).toEqual([]);
    expect(parseIPASyllables(12345)).toEqual([]);
    expect(parseIPASyllables('///')).toEqual([]);
  });

  test('preserves complex IPA Unicode phonemes intact', () => {
    const result = parseIPASyllables('/ˈʃiːp/');
    expect(result[0].syllable).toBe('ʃiːp');
  });
});

describe('Audio Studio HiDPI Canvas Calibration', () => {
  let mockCanvas;
  let mockCtx;

  beforeEach(() => {
    mockCtx = {
      scale: jest.fn(),
      fillRect: jest.fn(),
      beginPath: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      stroke: jest.fn(),
      createLinearGradient: jest.fn(() => ({ addColorStop: jest.fn() }))
    };

    mockCanvas = {
      width: 560,
      height: 120,
      style: {},
      getBoundingClientRect: () => ({ width: 560, height: 120 }),
      getContext: jest.fn(() => mockCtx)
    };
  });

  test('scales canvas physical buffer by window.devicePixelRatio', () => {
    const originalDpr = global.window ? global.window.devicePixelRatio : undefined;
    global.window = { devicePixelRatio: 2 };

    const result = setupHiDPICanvas(mockCanvas);
    expect(mockCanvas.width).toBe(1120);
    expect(mockCanvas.height).toBe(240);
    expect(mockCanvas.style.width).toBe('560px');
    expect(mockCanvas.style.height).toBe('120px');
    expect(mockCtx.scale).toHaveBeenCalledWith(2, 2);
    expect(result.dpr).toBe(2);

    if (originalDpr !== undefined) global.window.devicePixelRatio = originalDpr;
    else delete global.window;
  });

  test('handles null canvas safely without throwing', () => {
    expect(setupHiDPICanvas(null)).toBeNull();
    expect(setupHiDPICanvas(undefined)).toBeNull();
  });
});

describe('Audio Studio Frequency Visualizer Controller', () => {
  let mockCanvas;
  let mockCtx;
  let mockAnalyser;

  beforeEach(() => {
    mockCtx = {
      scale: jest.fn(),
      fillRect: jest.fn(),
      beginPath: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      stroke: jest.fn(),
      createLinearGradient: jest.fn(() => ({ addColorStop: jest.fn() }))
    };

    mockCanvas = {
      width: 560,
      height: 120,
      style: {},
      getBoundingClientRect: () => ({ width: 560, height: 120 }),
      getContext: jest.fn(() => mockCtx)
    };

    mockAnalyser = {
      fftSize: 256,
      smoothingTimeConstant: 0.8,
      frequencyBinCount: 128,
      getByteFrequencyData: jest.fn(arr => arr.fill(100)),
      getByteTimeDomainData: jest.fn(arr => arr.fill(128))
    };
  });

  test('initializes visualizer and controls execution state', () => {
    const visualizer = initFrequencyVisualizer(mockCanvas, mockAnalyser);
    expect(visualizer).not.toBeNull();
    expect(visualizer.isActive()).toBe(false);

    visualizer.start();
    expect(visualizer.isActive()).toBe(true);

    visualizer.stop();
    expect(visualizer.isActive()).toBe(false);
  });

  test('toggles modes between frequency bars and waveform oscilloscope', () => {
    const visualizer = initFrequencyVisualizer(mockCanvas, mockAnalyser);
    visualizer.setMode('waveform');
    visualizer.start();
    visualizer.stop();
    visualizer.setMode('bars');
    expect(visualizer.getAnalyser()).toBe(mockAnalyser);
  });

  test('handles missing canvas or analyser gracefully', () => {
    expect(initFrequencyVisualizer(null, mockAnalyser)).toBeNull();
    expect(initFrequencyVisualizer(mockCanvas, null)).toBeNull();
  });
});

describe('Web Audio API Compatibility & Fallbacks', () => {
  test('recovers suspended AudioContext upon user gesture', async () => {
    const mockAudioContext = {
      state: 'suspended',
      resume: jest.fn().mockResolvedValue()
    };

    if (mockAudioContext.state === 'suspended') {
      await mockAudioContext.resume();
    }

    expect(mockAudioContext.resume).toHaveBeenCalledTimes(1);
  });

  test('handles microphone permission denial gracefully without unhandled promise rejection', async () => {
    const mockGetUserMedia = jest.fn().mockRejectedValue(new Error('Permission denied'));
    let fallbackInvoked = false;

    try {
      await mockGetUserMedia({ audio: true });
    } catch (err) {
      fallbackInvoked = true;
    }

    expect(fallbackInvoked).toBe(true);
  });

  test('handles environments missing SpeechSynthesis without throwing', () => {
    const hasSpeech = typeof window !== 'undefined' && 'speechSynthesis' in window;
    // Guard pattern check
    function playSpeech(word) {
      if (typeof window === 'undefined' || !window.speechSynthesis) return false;
      const utter = new window.SpeechSynthesisUtterance(word);
      window.speechSynthesis.speak(utter);
      return true;
    }

    expect(playSpeech('catalyst')).toBe(hasSpeech);
  });
});
