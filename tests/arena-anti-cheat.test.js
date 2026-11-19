'use strict';
/**
 * arena-anti-cheat.test.js — Unit Tests for modules/arena/anti-cheat.js
 * Decipher Language Learning Platform
 *
 * Pattern: vm.createContext() sandbox with CommonJS wrappers
 */

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const rawCode = fs.readFileSync(
  path.resolve(__dirname, '../modules/arena/anti-cheat.js'), 'utf8'
).replace(/^export\s+/gm, '');

const wrappedCode = `(function() {
  ${rawCode}
  return { VALIDATION_RULES, createRateMap, validateWord };
})()`;

let mockNow = 10000;
const MockDate = { now: () => mockNow };

const sandbox = { Math, console, Map, RegExp, Date: MockDate };
vm.createContext(sandbox);
const { VALIDATION_RULES, createRateMap, validateWord } = vm.runInContext(wrappedCode, sandbox);

describe('anti-cheat.js — constants & createRateMap', () => {
  test('VALIDATION_RULES has expected bounds', () => {
    expect(VALIDATION_RULES.MIN_WORD_LENGTH).toBe(3);
    expect(VALIDATION_RULES.MAX_WORD_LENGTH).toBe(45);
    expect(VALIDATION_RULES.MIN_SUBMISSION_INTERVAL_MS).toBe(500);
  });

  test('createRateMap returns a Map instance', () => {
    const map = createRateMap();
    expect(typeof map.get).toBe('function');
    expect(typeof map.set).toBe('function');
  });
});

describe('anti-cheat.js — validateWord', () => {
  beforeEach(() => {
    mockNow = 10000;
  });

  test('rejects non-string word with TYPE rule', () => {
    const res = validateWord(null, [], 'u1', createRateMap());
    expect(res.valid).toBe(false);
    expect(res.rule).toBe('TYPE');
  });

  test('normalizes whitespace and case on valid word', () => {
    const res = validateWord('  Ephemeral  ', [], 'u1', createRateMap());
    expect(res.valid).toBe(true);
    expect(res.word).toBe('ephemeral');
  });

  test('rejects words shorter than 3 characters', () => {
    const res = validateWord('go', [], 'u1', createRateMap());
    expect(res.valid).toBe(false);
    expect(res.rule).toBe('TOO_SHORT');
  });

  test('rejects words exceeding 45 characters', () => {
    const res = validateWord('a'.repeat(46), [], 'u1', createRateMap());
    expect(res.valid).toBe(false);
    expect(res.rule).toBe('TOO_LONG');
  });

  test('rejects non-alphabetic characters (numbers, punctuation, HTML)', () => {
    expect(validateWord('word123', [], 'u1', createRateMap()).rule).toBe('INVALID_CHARS');
    expect(validateWord('<script>', [], 'u1', createRateMap()).rule).toBe('INVALID_CHARS');
    expect(validateWord('two words', [], 'u1', createRateMap()).rule).toBe('INVALID_CHARS');
  });

  test('rejects duplicate word within session case-insensitively', () => {
    const res = validateWord('Alpha', ['alpha'], 'u1', createRateMap());
    expect(res.valid).toBe(false);
    expect(res.rule).toBe('DUPLICATE');
  });

  test('enforces letter-chain rule by default', () => {
    const bad = validateWord('zebra', ['ephemeral'], 'u1', createRateMap());
    expect(bad.valid).toBe(false);
    expect(bad.rule).toBe('CHAIN_BREAK');

    const good = validateWord('lucid', ['ephemeral'], 'u1', createRateMap());
    expect(good.valid).toBe(true);
  });

  test('allows non-chained word when enforceChain option is false', () => {
    const res = validateWord('zebra', ['ephemeral'], 'u1', createRateMap(), { enforceChain: false });
    expect(res.valid).toBe(true);
  });

  test('enforces 500ms rate limit per uid', () => {
    const rateMap = createRateMap();
    const first = validateWord('alpha', [], 'u1', rateMap);
    expect(first.valid).toBe(true);

    mockNow += 200; // < 500ms
    const rapid = validateWord('amber', ['alpha'], 'u1', rateMap);
    expect(rapid.valid).toBe(false);
    expect(rapid.rule).toBe('RATE_LIMIT');

    // Different uid is unaffected
    const otherUser = validateWord('amber', ['alpha'], 'u2', rateMap);
    expect(otherUser.valid).toBe(true);

    // Same uid succeeds after >= 500ms
    mockNow += 500;
    const afterCooldown = validateWord('rabbit', ['alpha', 'amber'], 'u1', rateMap);
    expect(afterCooldown.valid).toBe(true);
  });
});
