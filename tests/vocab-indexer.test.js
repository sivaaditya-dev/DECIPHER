/**
 * tests/vocab-indexer.test.js
 * Unit tests for CEFR Vocabulary Indexer and Filter Logic
 */

describe('CEFR Estimator & Smart Tagging', () => {
  function estimateCEFRLevel(word) {
    if (!word || typeof word !== 'string') return 'B1';
    const clean = word.trim().toLowerCase();
    const len = clean.length;
    if (len <= 4) return 'A1';
    if (len <= 6) return 'A2';
    if (len <= 8) return 'B1';
    if (len <= 10) return 'B2';
    if (len <= 14) return 'C1';
    return 'C2';
  }

  function filterVocabCollection(collection, criteria = {}) {
    if (!Array.isArray(collection)) return [];
    const { query = '', cefr = 'all' } = criteria;
    const q = query.trim().toLowerCase();

    return collection.filter(item => {
      const word = (item.word || '').toLowerCase();
      const meaning = (item.definition || '').toLowerCase();
      if (q && !word.includes(q) && !meaning.includes(q)) return false;
      if (cefr !== 'all' && (item.cefr || estimateCEFRLevel(word)) !== cefr) return false;
      return true;
    });
  }

  test('correctly estimates CEFR level based on word complexity', () => {
    expect(estimateCEFRLevel('book')).toBe('A1');
    expect(estimateCEFRLevel('planet')).toBe('A2');
    expect(estimateCEFRLevel('decision')).toBe('B1');
    expect(estimateCEFRLevel('hypothesis')).toBe('B2');
    expect(estimateCEFRLevel('comprehensive')).toBe('C1');
    expect(estimateCEFRLevel('incomprehensibility')).toBe('C2');
  });

  test('filters collection by search query', () => {
    const list = [
      { word: 'catalyst', definition: 'substance that increases rate of reaction' },
      { word: 'resilient', definition: 'able to withstand or recover quickly' },
      { word: 'ephemeral', definition: 'lasting for a very short time' }
    ];

    const results = filterVocabCollection(list, { query: 'recover' });
    expect(results).toHaveLength(1);
    expect(results[0].word).toBe('resilient');
  });

  test('filters collection by CEFR difficulty level', () => {
    const list = [
      { word: 'cat', cefr: 'A1' },
      { word: 'decision', cefr: 'B1' },
      { word: 'paradigm', cefr: 'B1' },
      { word: 'ubiquitous', cefr: 'C1' }
    ];

    const b1Items = filterVocabCollection(list, { cefr: 'B1' });
    expect(b1Items).toHaveLength(2);
    expect(b1Items.map(i => i.word)).toEqual(['decision', 'paradigm']);
  });
});
