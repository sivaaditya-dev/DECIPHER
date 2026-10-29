/**
 * export-suite.js - Multi-Format Vocabulary Export Suite
 * Supports Anki TSV (Standard & Cloze), CSV, Notion Markdown tables, Quizlet TSV, and Printable Flashcards.
 * Decipher Language Learning Platform
 */

/**
 * Sanitizes input vocabulary list by filtering out null, undefined, or non-object items.
 * @param {Array} vocabList
 * @returns {Array<Object>}
 */
function sanitizeVocabList(vocabList) {
  if (!Array.isArray(vocabList)) return [];
  return vocabList.filter(item => item !== null && typeof item === 'object');
}

export function exportToAnkiTSV(vocabList, deckName = 'Decipher Vocabulary') {
  const validList = sanitizeVocabList(vocabList);
  if (validList.length === 0) {
    if (typeof window !== 'undefined' && window.showToast) {
      window.showToast('No vocabulary items to export.', 'warning');
    }
    return null;
  }

  // Anki TSV format: Front<TAB>Back<TAB>Tags
  const rows = validList.map(item => {
    const word = escapeTSV(item.word || item.term || '');
    const phonetic = item.phonetic ? ` [${escapeTSV(item.phonetic)}]` : '';
    const meaning = escapeTSV(item.definition || item.meaning || '');
    const example = item.example ? `<br><i>"${escapeTSV(item.example)}"</i>` : '';
    const trans = item.translation ? `<br><small style="color:#10b981;">Translation: ${escapeTSV(item.translation)}</small>` : '';

    const front = `<b>${word}</b>${phonetic}`;
    const back = `${meaning}${example}${trans}`;
    const tags = 'decipher_app english_vocab';
    return `${front}\t${back}\t${tags}`;
  });

  const header = '#separator:tab\n#html:true\n#tags column:3\n';
  const tsvContent = header + rows.join('\n');
  if (typeof document !== 'undefined') {
    downloadFile(tsvContent, `decipher_anki_${sanitizeFilename(deckName)}.txt`, 'text/tab-separated-values;charset=utf-8');
    if (typeof window !== 'undefined' && window.showToast) {
      window.showToast(`Exported ${validList.length} cards for Anki!`, 'success');
    }
  }
  return tsvContent;
}

/**
 * Formats a sentence into Anki cloze deletion format: {{c1::term::hint}}
 * @param {string} sentence - Context sentence containing the target word
 * @param {string} targetWord - The target vocabulary word to cloze
 * @param {string} [hint=''] - Optional hint displayed in the cloze
 * @param {number} [clozeIndex=1] - Cloze deletion index (c1, c2, etc.)
 * @returns {string} Cloze-formatted sentence
 */
export function formatClozeDeletion(sentence, targetWord, hint = '', clozeIndex = 1) {
  const cleanWord = typeof targetWord === 'string' ? targetWord.trim() : (targetWord ? String(targetWord).trim() : '');
  const cleanSentence = typeof sentence === 'string' ? sentence : (sentence ? String(sentence) : '');
  const rawHint = typeof hint === 'string' ? hint.trim() : (hint ? String(hint).trim() : '');
  const cleanHint = rawHint.length > 0 ? `::${rawHint}` : '';
  const idx = (Number.isInteger(clozeIndex) && clozeIndex > 0) ? clozeIndex : 1;

  if (!cleanSentence && !cleanWord) return '';
  if (!cleanSentence) return `{{c${idx}::${cleanWord}${cleanHint}}}`;
  if (!cleanWord) return cleanSentence;

  const escapeRegex = (s) => s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const boundaryRegex = new RegExp(`\\b(${escapeRegex(cleanWord)})\\b`, 'i');

  if (boundaryRegex.test(cleanSentence)) {
    return cleanSentence.replace(boundaryRegex, (m) => `{{c${idx}::${m}${cleanHint}}}`);
  }

  // Fallback to substring matching if word boundaries differ (inflections, hyphens)
  const subRegex = new RegExp(`(${escapeRegex(cleanWord)})`, 'i');
  if (subRegex.test(cleanSentence)) {
    return cleanSentence.replace(subRegex, (m) => `{{c${idx}::${m}${cleanHint}}}`);
  }

  // If word does not appear in sentence, prepend cloze term
  return `{{c${idx}::${cleanWord}${cleanHint}}} — ${cleanSentence}`;
}

/**
 * Returns custom dark-theme CSS deck template for Anki flashcards
 * @returns {string} CSS styles
 */
export function generateAnkiDeckCSS() {
  return `
.card {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  font-size: 18px;
  text-align: left;
  color: #f8fafc;
  background-color: #0f172a;
  padding: 24px;
  line-height: 1.6;
  border-radius: 12px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
}
.cloze {
  font-weight: 700;
  color: #818cf8;
  background: rgba(99, 102, 241, 0.15);
  padding: 2px 6px;
  border-radius: 4px;
  border-bottom: 2px dashed #6366f1;
}
.card-term {
  font-size: 24px;
  font-weight: 700;
  color: #ffffff;
  margin-bottom: 8px;
}
.card-phonetic {
  font-size: 15px;
  color: #38bdf8;
  font-style: italic;
  margin-bottom: 12px;
}
.card-meaning {
  font-size: 16px;
  color: #cbd5e1;
  margin-bottom: 16px;
  line-height: 1.5;
}
.card-example {
  font-size: 15px;
  color: #94a3b8;
  font-style: italic;
  border-left: 3px solid #6366f1;
  padding-left: 12px;
  margin: 12px 0;
}
.card-translation {
  font-size: 14px;
  color: #10b981;
  margin-top: 8px;
}
.card-tags {
  margin-top: 16px;
  font-size: 12px;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
`.trim();
}

/**
 * Exports vocabulary cards as Anki Cloze-deletion TSV deck with custom CSS styling
 * @param {Array<Object>} vocabList - List of vocabulary objects
 * @param {Object} [options={}] - Export options
 * @returns {string|null} TSV content string
 */
export function exportToAnkiCloze(vocabList, options = {}) {
  const validList = sanitizeVocabList(vocabList);
  if (validList.length === 0) {
    if (typeof window !== 'undefined' && window.showToast) {
      window.showToast('No vocabulary items to export.', 'warning');
    }
    return null;
  }

  const {
    deckName = 'Decipher Cloze Vocabulary',
    includeCSS = true,
    clozeIndex = 1,
    download = true
  } = options;

  const css = generateAnkiDeckCSS();
  const cssHeader = includeCSS ? `<style>${css}</style>` : '';

  const rows = validList.map(item => {
    const word = item.word || item.term || '';
    const def = item.definition || item.meaning || '';
    const rawExample = item.example || item.context || '';
    const phonetic = item.phonetic ? `/${escapeTSV(item.phonetic)}/` : '';
    const translation = item.translation ? escapeTSV(item.translation) : '';
    const syn = item.syn ? escapeTSV(item.syn) : '';
    const cefr = item.cefr ? escapeTSV(item.cefr) : '';

    // Generate cloze hint from short definition (up to 35 chars)
    const hint = def ? def.slice(0, 35) + (def.length > 35 ? '...' : '') : '';
    const clozeSentence = escapeTSV(formatClozeDeletion(rawExample, word, hint, clozeIndex));

    const front = `${cssHeader}<div class="card"><div class="card-cloze">${clozeSentence}</div>${phonetic ? `<div class="card-phonetic">${phonetic}</div>` : ''}</div>`;
    const back = `<div class="card-extra"><div class="card-term"><b>${escapeTSV(word)}</b></div><div class="card-meaning">${escapeTSV(def)}</div>${translation ? `<div class="card-translation">Translation: ${translation}</div>` : ''}${syn ? `<div class="card-tags">Synonyms: ${syn}</div>` : ''}</div>`;
    const tags = `decipher_app cloze english_vocab ${cefr}`.trim();

    return `${front}\t${back}\t${tags}`;
  });

  const header = `#separator:tab\n#html:true\n#tags column:3\n#deck:${deckName}\n`;
  const tsvContent = header + rows.join('\n');

  if (download && typeof document !== 'undefined') {
    downloadFile(tsvContent, `decipher_anki_cloze_${sanitizeFilename(deckName)}.txt`, 'text/tab-separated-values;charset=utf-8');
    if (typeof window !== 'undefined' && window.showToast) {
      window.showToast(`Exported ${validList.length} cloze cards for Anki!`, 'success');
    }
  }

  return tsvContent;
}

export function exportToCSV(vocabList, filename = 'decipher_vocab.csv') {
  const validList = sanitizeVocabList(vocabList);
  if (validList.length === 0) return null;

  const headers = ['Word', 'Phonetic', 'Definition', 'Example', 'Translation'];
  const csvRows = [headers.join(',')];

  validList.forEach(item => {
    const row = [
      escapeCSV(item.word || item.term || ''),
      escapeCSV(item.phonetic || ''),
      escapeCSV(item.definition || item.meaning || ''),
      escapeCSV(item.example || ''),
      escapeCSV(item.translation || '')
    ];
    csvRows.push(row.join(','));
  });

  const content = csvRows.join('\r\n');
  if (typeof document !== 'undefined') {
    downloadFile(content, filename, 'text/csv;charset=utf-8');
    if (typeof window !== 'undefined' && window.showToast) {
      window.showToast(`Exported ${validList.length} words to CSV!`, 'success');
    }
  }
  return content;
}

export function generatePrintableFlashcards(vocabList) {
  const validList = sanitizeVocabList(vocabList);
  if (validList.length === 0) return;
  if (typeof window === 'undefined' || !window.open) return;

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    if (window.showToast) window.showToast('Please allow popups to generate printable flashcards.', 'warning');
    return;
  }

  const cardsHtml = validList.map(item => `
    <div class="print-card">
      <div class="card-term">${escapeHTML(item.word || item.term || '')}</div>
      ${item.phonetic ? `<div class="card-phonetic">/${escapeHTML(item.phonetic)}/</div>` : ''}
      <hr class="card-divider" />
      <div class="card-def">${escapeHTML(item.definition || item.meaning || '')}</div>
      ${item.example ? `<div class="card-eg">"${escapeHTML(item.example)}"</div>` : ''}
    </div>
  `).join('');

  const doc = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Decipher Flashcards - Printable Sheet</title>
      <style>
        @page { size: A4; margin: 12mm; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #111; margin: 0; padding: 0; }
        .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8mm; }
        .print-card { border: 1.5px dashed #64748b; border-radius: 6px; padding: 12px; min-height: 52mm; box-sizing: border-box; display: flex; flex-direction: column; justify-content: center; text-align: center; page-break-inside: avoid; }
        .card-term { font-size: 1.25rem; font-weight: bold; margin-bottom: 2px; }
        .card-phonetic { font-size: 0.85rem; color: #475569; font-style: italic; }
        .card-divider { border: 0; border-top: 1px solid #cbd5e1; margin: 6px 0; }
        .card-def { font-size: 0.82rem; line-height: 1.35; color: #1e293b; }
        .card-eg { font-size: 0.75rem; color: #64748b; font-style: italic; margin-top: 4px; }
      </style>
    </head>
    <body>
      <h2 style="text-align:center;margin-bottom:6mm;">Decipher Study Flashcards</h2>
      <div class="grid">${cardsHtml}</div>
      <script>
        window.onload = function() { window.print(); }
      </script>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(doc);
  printWindow.document.close();
}

/**
 * Escapes characters for Markdown table cells
 * @param {string} text - Cell text
 * @returns {string} Escaped markdown text
 */
function escapeMarkdownCell(text) {
  if (text === null || text === undefined) return '—';
  const clean = String(text).replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>').trim();
  return clean || '—';
}

/**
 * Generates Notion-compatible GitHub Flavored Markdown table
 * @param {Array<Object>} vocabList - List of vocabulary items
 * @param {Object} [options={}] - Export options
 * @returns {string|null} Markdown content string
 */
export function exportToNotionMarkdown(vocabList, options = {}) {
  const validList = sanitizeVocabList(vocabList);
  if (validList.length === 0) {
    if (typeof window !== 'undefined' && window.showToast) {
      window.showToast('No vocabulary items to export.', 'warning');
    }
    return null;
  }

  const {
    title = 'Decipher Vocabulary Deck',
    download = true,
    includeHeader = true
  } = options;

  const dateStr = new Date().toISOString().split('T')[0];
  const lines = [];

  if (includeHeader) {
    lines.push(`# ${title}`);
    lines.push(`> Exported from Decipher on ${dateStr} • ${validList.length} cards\n`);
  }

  // Notion Markdown Table Header
  lines.push('| Term | Phonetic | Definition | Synonyms | Example Sentence | Translation | CEFR |');
  lines.push('| :--- | :--- | :--- | :--- | :--- | :--- | :--- |');

  validList.forEach(item => {
    const term = `**${escapeMarkdownCell(item.word || item.term || '')}**`;
    const phonetic = item.phonetic ? `\`/${escapeMarkdownCell(item.phonetic).replace(/`/g, '')}/\`` : '—';
    const def = escapeMarkdownCell(item.definition || item.meaning || '');
    const syn = escapeMarkdownCell(item.syn || '');
    const example = item.example ? `*"${escapeMarkdownCell(item.example)}"*` : '—';
    const trans = escapeMarkdownCell(item.translation || '');
    const cefr = escapeMarkdownCell(item.cefr || '');

    lines.push(`| ${term} | ${phonetic} | ${def} | ${syn} | ${example} | ${trans} | ${cefr} |`);
  });

  const mdContent = lines.join('\n');

  if (download && typeof document !== 'undefined') {
    downloadFile(mdContent, `decipher_notion_${sanitizeFilename(title)}.md`, 'text/markdown;charset=utf-8');
    if (typeof window !== 'undefined' && window.showToast) {
      window.showToast(`Exported ${validList.length} words for Notion!`, 'success');
    }
  }

  return mdContent;
}

/**
 * Generates Quizlet-compatible tab-delimited text format
 * @param {Array<Object>} vocabList - List of vocabulary items
 * @param {Object} [options={}] - Export options
 * @returns {string|null} Quizlet TSV content string
 */
export function exportToQuizletTSV(vocabList, options = {}) {
  const validList = sanitizeVocabList(vocabList);
  if (validList.length === 0) {
    if (typeof window !== 'undefined' && window.showToast) {
      window.showToast('No vocabulary items to export.', 'warning');
    }
    return null;
  }

  const {
    title = 'Decipher Vocabulary',
    download = true,
    delimiter = '\t',
    includeExample = true
  } = options;

  const rows = validList.map(item => {
    const word = (item.word || item.term || '').trim();
    const phonetic = item.phonetic ? ` [${item.phonetic.replace(/[\[\]\/]/g, '').trim()}]` : '';
    const def = (item.definition || item.meaning || '').trim();
    const example = includeExample && item.example ? ` — "${item.example.trim()}"` : '';
    const trans = item.translation ? ` (Translation: ${item.translation.trim()})` : '';

    // Clean delimiters from text
    const cleanTerm = (word + phonetic).replace(/\t/g, ' ').replace(/\r?\n/g, ' ');
    const cleanDef = (def + example + trans).replace(/\t/g, ' ').replace(/\r?\n/g, ' ');

    return `${cleanTerm}${delimiter}${cleanDef}`;
  });

  const content = rows.join('\n');

  if (download && typeof document !== 'undefined') {
    downloadFile(content, `decipher_quizlet_${sanitizeFilename(title)}.txt`, 'text/plain;charset=utf-8');
    if (typeof window !== 'undefined' && window.showToast) {
      window.showToast(`Exported ${validList.length} cards for Quizlet!`, 'success');
    }
  }

  return content;
}

export const exportToQuizletFormat = exportToQuizletTSV;

function escapeTSV(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/\t/g, ' ').replace(/\r?\n/g, '<br>');
}

function escapeCSV(str) {
  if (str === null || str === undefined) return '""';
  const s = String(str).replace(/"/g, '""');
  return `"${s}"`;
}

function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>'"]/g, tag => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[tag] || tag));
}

function sanitizeFilename(name) {
  return name.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
}

function downloadFile(content, filename, mimeType) {
  if (typeof Blob === 'undefined' || typeof document === 'undefined') return;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    exportToAnkiTSV,
    exportToAnkiCloze,
    formatClozeDeletion,
    generateAnkiDeckCSS,
    exportToCSV,
    generatePrintableFlashcards,
    exportToNotionMarkdown,
    exportToQuizletTSV,
    exportToQuizletFormat
  };
}
