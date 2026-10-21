/**
 * export-suite.js - Anki TSV, CSV & Printable Flashcard Generator
 * Decipher Language Learning Platform
 */

export function exportToAnkiTSV(vocabList, deckName = 'Decipher Vocabulary') {
  if (!vocabList || vocabList.length === 0) {
    if (window.showToast) window.showToast('No vocabulary items to export.', 'warning');
    return;
  }

  // Anki TSV format: Front<TAB>Back<TAB>Tags
  const rows = vocabList.map(item => {
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
  downloadFile(tsvContent, `decipher_anki_${sanitizeFilename(deckName)}.txt`, 'text/tab-separated-values;charset=utf-8');
  if (window.showToast) window.showToast(`Exported ${vocabList.length} cards for Anki!`, 'success');
}

export function exportToCSV(vocabList, filename = 'decipher_vocab.csv') {
  if (!vocabList || vocabList.length === 0) return;

  const headers = ['Word', 'Phonetic', 'Definition', 'Example', 'Translation'];
  const csvRows = [headers.join(',')];

  vocabList.forEach(item => {
    const row = [
      escapeCSV(item.word || item.term || ''),
      escapeCSV(item.phonetic || ''),
      escapeCSV(item.definition || item.meaning || ''),
      escapeCSV(item.example || ''),
      escapeCSV(item.translation || '')
    ];
    csvRows.push(row.join(','));
  });

  downloadFile(csvRows.join('\r\n'), filename, 'text/csv;charset=utf-8');
  if (window.showToast) window.showToast(`Exported ${vocabList.length} words to CSV!`, 'success');
}

export function generatePrintableFlashcards(vocabList) {
  if (!vocabList || vocabList.length === 0) return;

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    if (window.showToast) window.showToast('Please allow popups to generate printable flashcards.', 'warning');
    return;
  }

  const cardsHtml = vocabList.map(item => `
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

function escapeTSV(str) {
  return String(str).replace(/\t/g, ' ').replace(/\r?\n/g, '<br>');
}

function escapeCSV(str) {
  const s = String(str).replace(/"/g, '""');
  return `"${s}"`;
}

function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, tag => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[tag] || tag));
}

function sanitizeFilename(name) {
  return name.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
}

function downloadFile(content, filename, mimeType) {
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
