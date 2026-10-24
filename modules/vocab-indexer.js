/**
 * vocab-indexer.js - CEFR Tagging, Filter Index & Batch Vocabulary Operations
 * Decipher Language Learning Platform
 */

export function estimateCEFRLevel(word) {
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

export function assignSmartTags(item) {
  const word = (item.word || item.term || '').toLowerCase();
  const def = (item.definition || item.meaning || '').toLowerCase();
  const tags = new Set(item.tags || []);

  tags.add(item.cefr || estimateCEFRLevel(word));

  if (def.includes('science') || def.includes('biological') || def.includes('chemical') || def.includes('physics')) {
    tags.add('science');
  }
  if (def.includes('business') || def.includes('economic') || def.includes('market') || def.includes('financial')) {
    tags.add('business');
  }
  if (def.includes('formal') || def.includes('scholarly') || def.includes('literary')) {
    tags.add('academic');
  }

  return {
    ...item,
    cefr: item.cefr || estimateCEFRLevel(word),
    tags: Array.from(tags)
  };
}

export function filterVocabCollection(collection, criteria = {}) {
  if (!Array.isArray(collection)) return [];

  const { query = '', cefr = 'all', tag = 'all' } = criteria;
  const q = query.trim().toLowerCase();

  return collection.filter(item => {
    const word = (item.word || item.term || '').toLowerCase();
    const meaning = (item.definition || item.meaning || '').toLowerCase();

    if (q && !word.includes(q) && !meaning.includes(q)) {
      return false;
    }

    if (cefr !== 'all' && (item.cefr || estimateCEFRLevel(word)) !== cefr) {
      return false;
    }

    if (tag !== 'all') {
      const itemTags = item.tags || [];
      if (!itemTags.includes(tag)) return false;
    }

    return true;
  });
}

export function batchActionExport(selectedItems, format = 'csv') {
  if (!selectedItems || selectedItems.length === 0) return;
  if (format === 'anki' && window.exportToAnki) {
    window.exportToAnki(selectedItems, 'Batch Selection');
  } else if (window.exportToCSV) {
    window.exportToCSV(selectedItems, 'decipher_batch_vocab.csv');
  }
}
