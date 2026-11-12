/**
 * arena-bot-controller.test.js — Unit Tests: AI Bot Controller
 * Decipher Language Learning Platform — Lexicon Coliseum
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const bankCode = fs.readFileSync(path.resolve(__dirname, '../modules/arena/cefr-bank.js'), 'utf8')
  .replace(/^export\s+/gm, '');
const weightCode = fs.readFileSync(path.resolve(__dirname, '../modules/arena/lexical-weight.js'), 'utf8')
  .replace(/^import[^;]+;/gm, '')
  .replace(/^export\s+/gm, '');
const botCode = fs.readFileSync(path.resolve(__dirname, '../modules/arena/bot-controller.js'), 'utf8')
  .replace(/^import[^;]+;/gm, '')
  .replace(/^export\s+/gm, '');

const wrapped = `(function() {
${bankCode}
${weightCode}
${botCode}
return {
  BotController,
  BOT_ARCHETYPES,
  getBotRoster,
  CEFR_BANK,
};
})()`;

const sandbox = {
  console, Date, Math, Array, Object, Number, RangeError, TypeError, Error,
  JSON, Map, Set, String, parseInt, parseFloat, isNaN, setTimeout, clearTimeout, setInterval, clearInterval,
};
vm.createContext(sandbox);
const {
  BotController,
  BOT_ARCHETYPES,
  getBotRoster,
  CEFR_BANK,
} = vm.runInContext(wrapped, sandbox);

describe('BotController — Archetype Configuration', () => {
  it('getBotRoster returns all 3 archetypes', () => {
    const roster = getBotRoster();
    expect(roster).toHaveLength(3);
  });

  it('all archetypes have required fields', () => {
    for (const bot of getBotRoster()) {
      expect(bot).toHaveProperty('id');
      expect(bot).toHaveProperty('name');
      expect(bot).toHaveProperty('icon');
      expect(bot).toHaveProperty('description');
      expect(bot).toHaveProperty('tiers');
      expect(bot).toHaveProperty('baseWPM');
      expect(bot).toHaveProperty('jitter');
      expect(bot).toHaveProperty('missRate');
      expect(bot).toHaveProperty('avatarEmoji');
    }
  });

  it('rookie bot uses only A1/A2 tiers', () => {
    expect(BOT_ARCHETYPES.rookie.tiers).toContain('A1');
    expect(BOT_ARCHETYPES.rookie.tiers).toContain('A2');
    expect(BOT_ARCHETYPES.rookie.tiers).not.toContain('C2');
  });

  it('scholar bot uses B1/B2 tiers', () => {
    expect(BOT_ARCHETYPES.scholar.tiers).toContain('B1');
    expect(BOT_ARCHETYPES.scholar.tiers).toContain('B2');
    expect(BOT_ARCHETYPES.scholar.tiers).not.toContain('A1');
  });

  it('grand inquisitor uses C1/C2 tiers', () => {
    expect(BOT_ARCHETYPES.grandInquisitor.tiers).toContain('C1');
    expect(BOT_ARCHETYPES.grandInquisitor.tiers).toContain('C2');
    expect(BOT_ARCHETYPES.grandInquisitor.tiers).not.toContain('A1');
  });

  it('grand inquisitor WPM is higher than rookie WPM', () => {
    expect(BOT_ARCHETYPES.grandInquisitor.baseWPM)
      .toBeGreaterThan(BOT_ARCHETYPES.rookie.baseWPM);
  });

  it('grand inquisitor jitter is lower than rookie jitter', () => {
    expect(BOT_ARCHETYPES.grandInquisitor.jitter)
      .toBeLessThan(BOT_ARCHETYPES.rookie.jitter);
  });

  it('grand inquisitor missRate is lower than rookie missRate', () => {
    expect(BOT_ARCHETYPES.grandInquisitor.missRate)
      .toBeLessThan(BOT_ARCHETYPES.rookie.missRate);
  });

  it('throws for unknown bot archetype id', () => {
    expect(() => new BotController('unknown_bot', () => {}))
      .toThrow(/Unknown bot archetype/);
  });
});

describe('BotController — Word Pool & Selection', () => {
  it('rookie bot word pool draws only from A1/A2 bank entries', () => {
    const submittedWords = [];
    const bot = new BotController('rookie', (w) => submittedWords.push(w));
    const pool = bot._wordPool;
    const allowedWords = new Set([
      ...CEFR_BANK.A1.map(e => e.word),
      ...CEFR_BANK.A2.map(e => e.word),
    ]);
    for (const entry of pool) {
      expect(allowedWords.has(entry.word)).toBe(true);
    }
  });

  it('grand inquisitor word pool draws only from C1/C2 bank entries', () => {
    const bot = new BotController('grandInquisitor', () => {});
    const pool = bot._wordPool;
    const allowedWords = new Set([
      ...CEFR_BANK.C1.map(e => e.word),
      ...CEFR_BANK.C2.map(e => e.word),
    ]);
    for (const entry of pool) {
      expect(allowedWords.has(entry.word)).toBe(true);
    }
  });

  it('_nextWord() returns a string', () => {
    const bot = new BotController('scholar', () => {});
    const word = bot._nextWord();
    expect(typeof word).toBe('string');
    expect(word.length).toBeGreaterThan(0);
  });

  it('_nextWord() avoids repeating words until pool is exhausted', () => {
    const bot = new BotController('scholar', () => {});
    const seen = new Set();
    const totalPoolSize = bot._wordPool.length;
    for (let i = 0; i < totalPoolSize; i++) {
      const word = bot._nextWord();
      expect(seen.has(word)).toBe(false);
      seen.add(word);
    }
  });

  it('word pool size equals sum of words in assigned tiers', () => {
    const bot = new BotController('rookie', () => {});
    const expected = CEFR_BANK.A1.length + CEFR_BANK.A2.length;
    expect(bot._wordPool.length).toBe(expected);
  });
});

describe('BotController — Timing & Jitter', () => {
  it('_nextDelay() returns a positive number', () => {
    const bot = new BotController('scholar', () => {});
    const delay = bot._nextDelay();
    expect(delay).toBeGreaterThan(0);
  });

  it('_nextDelay() is at minimum 500ms (floor guard)', () => {
    const bot = new BotController('grandInquisitor', () => {});
    for (let i = 0; i < 20; i++) {
      expect(bot._nextDelay()).toBeGreaterThanOrEqual(500);
    }
  });

  it('grand inquisitor average delay is lower than rookie average delay', () => {
    const inquisitor = new BotController('grandInquisitor', () => {});
    const rookie     = new BotController('rookie', () => {});
    const avg = bot => Array.from({ length: 50 }, () => bot._nextDelay())
      .reduce((s, v) => s + v, 0) / 50;
    expect(avg(inquisitor)).toBeLessThan(avg(rookie));
  });

  it('_nextDelay() varies due to jitter (not perfectly constant)', () => {
    const bot = new BotController('scholar', () => {});
    const delays = Array.from({ length: 30 }, () => bot._nextDelay());
    const unique  = new Set(delays.map(d => Math.round(d)));
    expect(unique.size).toBeGreaterThan(1);
  });
});

describe('BotController — Start / Stop Lifecycle', () => {
  it('isRunning is false before start()', () => {
    const bot = new BotController('rookie', () => {});
    expect(bot.isRunning).toBe(false);
  });

  it('isRunning is true after start()', () => {
    const bot = new BotController('rookie', () => {});
    bot.start(60000);
    expect(bot.isRunning).toBe(true);
    bot.stop();
  });

  it('isRunning is false after stop()', () => {
    const bot = new BotController('scholar', () => {});
    bot.start(60000);
    bot.stop();
    expect(bot.isRunning).toBe(false);
  });

  it('stop() does not throw if called before start()', () => {
    const bot = new BotController('rookie', () => {});
    expect(() => bot.stop()).not.toThrow();
  });

  it('displayName returns icon + name string', () => {
    const bot = new BotController('grandInquisitor', () => {});
    expect(bot.displayName).toContain('Grand Inquisitor');
    expect(bot.displayName).toContain('🥇');
  });

  it('archetype getter returns a copy (not live reference)', () => {
    const bot = new BotController('rookie', () => {});
    const a = bot.archetype;
    a.baseWPM = 999;
    expect(bot.archetype.baseWPM).not.toBe(999);
  });

  it('bot fires callback within reasonable time window', (done) => {
    jest.setTimeout(5000);
    const bot = new BotController('grandInquisitor', (word) => {
      expect(typeof word).toBe('string');
      bot.stop();
      done();
    });
    bot.start(60000);
  });
});

describe('CEFR Bank Integrity', () => {
  it('each tier has at least 60 entries', () => {
    for (const tier of ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']) {
      expect(CEFR_BANK[tier].length).toBeGreaterThanOrEqual(60);
    }
  });

  it('total bank has at least 360 words', () => {
    const total = Object.values(CEFR_BANK).reduce((s, arr) => s + arr.length, 0);
    expect(total).toBeGreaterThanOrEqual(360);
  });

  it('every entry has non-empty word, def, and pos', () => {
    for (const [tier, entries] of Object.entries(CEFR_BANK)) {
      for (const e of entries) {
        expect(e.word.length).toBeGreaterThan(0);
        expect(e.def.length).toBeGreaterThan(0);
        expect(e.pos.length).toBeGreaterThan(0);
      }
    }
  });

  it('no duplicate words within the same tier', () => {
    for (const [tier, entries] of Object.entries(CEFR_BANK)) {
      const words = entries.map(e => e.word.toLowerCase());
      const unique = new Set(words);
      expect(unique.size).toBe(words.length);
    }
  });
});
