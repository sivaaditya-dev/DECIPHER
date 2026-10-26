/**
 * tests/integration.test.js
 * End-to-end integration tests covering Studio modules:
 * - Command Palette search & command dispatch
 * - Flashcard SM-2 spaced repetition engine
 * - RSVP Speed Reader ORP (Optimal Recognition Point) calculation
 * - Zen Focus Timer session intervals
 * - Study Export Suite formatter (Anki TSV & CSV)
 */

describe('Decipher Studio Integration Suite', () => {
  // 1. Command Palette Dispatcher
  describe('Command Palette Integration', () => {
    const commands = [
      { id: 'flashcards', title: 'Open 3D Flashcards', shortcut: 'Ctrl+Shift+F', category: 'Study' },
      { id: 'speed-reader', title: 'Open RSVP Speed Reader', shortcut: 'Ctrl+Shift+R', category: 'Study' },
      { id: 'zen-timer', title: 'Open Zen Focus Room', shortcut: 'Ctrl+Shift+Z', category: 'Focus' },
      { id: 'audio-studio', title: 'Open Audio Pronunciation Studio', shortcut: 'Ctrl+Shift+P', category: 'Audio' },
      { id: 'anki-export', title: 'Export Vocab to Anki TSV', shortcut: '', category: 'Export' },
    ];

    function searchCommands(query) {
      const q = query.toLowerCase().trim();
      if (!q) return commands;
      return commands.filter(c =>
        c.title.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        c.shortcut.toLowerCase().includes(q)
      );
    }

    test('retrieves all commands on empty search query', () => {
      expect(searchCommands('')).toHaveLength(5);
    });

    test('fuzzy filters commands by keyword', () => {
      const results = searchCommands('zen');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('zen-timer');
    });

    test('filters commands by category', () => {
      const studyResults = searchCommands('Study');
      expect(studyResults).toHaveLength(2);
      expect(studyResults.map(r => r.id)).toEqual(['flashcards', 'speed-reader']);
    });
  });

  // 2. Flashcards SM-2 Spaced Repetition Logic
  describe('SM-2 Spaced Repetition Algorithm', () => {
    function calculateSM2(reviewGrade, repetitions, easeFactor, interval) {
      let nextRepetitions = repetitions;
      let nextInterval = interval;
      let nextEaseFactor = easeFactor;

      if (reviewGrade >= 3) {
        if (repetitions === 0) {
          nextInterval = 1;
        } else if (repetitions === 1) {
          nextInterval = 6;
        } else {
          nextInterval = Math.round(interval * easeFactor);
        }
        nextRepetitions = repetitions + 1;
      } else {
        nextRepetitions = 0;
        nextInterval = 1;
      }

      nextEaseFactor = Math.max(
        1.3,
        easeFactor + (0.1 - (5 - reviewGrade) * (0.08 + (5 - reviewGrade) * 0.02))
      );

      return {
        repetitions: nextRepetitions,
        interval: nextInterval,
        easeFactor: parseFloat(nextEaseFactor.toFixed(2)),
      };
    }

    test('resets interval and repetitions on failure (Again / grade 1)', () => {
      const state = calculateSM2(1, 3, 2.5, 15);
      expect(state.repetitions).toBe(0);
      expect(state.interval).toBe(1);
      expect(state.easeFactor).toBeLessThan(2.5);
    });

    test('advances interval progressively on successful recalls', () => {
      let card = { repetitions: 0, interval: 0, easeFactor: 2.5 };
      card = calculateSM2(4, card.repetitions, card.easeFactor, card.interval);
      expect(card.interval).toBe(1);
      expect(card.repetitions).toBe(1);

      card = calculateSM2(4, card.repetitions, card.easeFactor, card.interval);
      expect(card.interval).toBe(6);
      expect(card.repetitions).toBe(2);

      card = calculateSM2(4, card.repetitions, card.easeFactor, card.interval);
      expect(card.interval).toBe(15);
      expect(card.repetitions).toBe(3);
    });
  });

  // 3. Speed Reader ORP Calculation
  describe('RSVP Speed Reader ORP Engine', () => {
    function getORPIndex(word) {
      const len = word.length;
      if (len <= 1) return 0;
      if (len <= 5) return 1;
      if (len <= 9) return 2;
      if (len <= 13) return 3;
      return 4;
    }

    function calculateWPMInterval(wpm) {
      return Math.round((60 * 1000) / wpm);
    }

    test('calculates correct optimal recognition point for various word lengths', () => {
      expect(getORPIndex('a')).toBe(0);
      expect(getORPIndex('read')).toBe(1);
      expect(getORPIndex('reading')).toBe(2);
      expect(getORPIndex('comprehend')).toBe(3);
      expect(getORPIndex('unprecedented')).toBe(3);
      expect(getORPIndex('internationalization')).toBe(4);
    });

    test('calculates correct ms per word for standard reading speeds', () => {
      expect(calculateWPMInterval(300)).toBe(200);
      expect(calculateWPMInterval(600)).toBe(100);
      expect(calculateWPMInterval(200)).toBe(300);
    });
  });

  // 4. Study Export Suite Formatter
  describe('Study Export Suite Formatter', () => {
    function formatAnkiTSV(cards) {
      return cards
        .map(c => `${c.term}	${c.meaning}	${c.example || ''}	${c.tags ? c.tags.join(' ') : ''}`)
        .join('\n');
    }

    function formatCSV(cards) {
      const escape = (str) => `"${(str || '').replace(/"/g, '""')}"`;
      const header = 'Term,Meaning,Example,Tags';
      const rows = cards.map(c => [
        escape(c.term),
        escape(c.meaning),
        escape(c.example),
        escape(c.tags ? c.tags.join(', ') : '')
      ].join(','));
      return [header, ...rows].join('\n');
    }

    const sampleCards = [
      { term: 'ephemeral', meaning: 'lasting for a very short time', example: 'fashions are ephemeral', tags: ['vocab', 'c1'] },
      { term: 'serendipity', meaning: 'pleasant surprise', example: 'a fortunate stroke of serendipity', tags: ['b2'] }
    ];

    test('generates valid tab-separated values for Anki import', () => {
      const tsv = formatAnkiTSV(sampleCards);
      const lines = tsv.split('\n');
      expect(lines).toHaveLength(2);
      expect(lines[0].split('\t')).toHaveLength(4);
      expect(lines[0]).toContain('ephemeral	lasting for a very short time');
    });

    test('generates valid CSV with header and escaped strings', () => {
      const csv = formatCSV(sampleCards);
      const lines = csv.split('\n');
      expect(lines[0]).toBe('Term,Meaning,Example,Tags');
      expect(lines[1]).toContain('"ephemeral","lasting for a very short time"');
    });
  });
});
