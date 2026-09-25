const fs = require('fs');
const html = fs.readFileSync('f:/STUDY/Eng Proj/index.html', 'utf8');

// Good progress! 1029 Ã sequences fixed but the Start Quiz button still shows 'âÅ¡¡'
// The 'â' (U+00E2) is itself a mojibake start (0xE2 = E2), but I only handle 0xE2-0xE3 range
// Let me check: 'â' = U+00E2 = 0xE2
// As a 3-byte UTF-8 start: E2 XX XX - the continuation bytes need to be â€˜Å¡Â¡' 
// Actually 'âÅ¡¡':
// â = 0xE2
// Å¡ -> Å = 0xC5 which is NOT a continuation byte (0x80-0xBF), so it's not matching

// Actually 'Å¡' itself is mojibake for š (0x9A, a Win-1252 char for U+0161)
// So 'â' + 'Å¡' is â (0xE2) + Å (0xC5)... that's not a valid sequence

// Wait - 'Å¡' in the string represents ANOTHER level of encoding.
// Original: ⚡ (U+26A1) = E2 9A A1 in UTF-8
// W1252 encoding of those bytes: E2->â, 9A->š, A1->¡
// Now š (U+0161) in UTF-8 = C5 A1 = 'Å¡' 
// So ⚡ becomes: â + 'Å¡' + ¡ = 'âÅ¡¡'

// This means: 'â' (0xE2) + 'Å¡' (= 0x9A) + '¡' (0xA1) should be decoded as:
// Step 1: Get bytes: E2 9A A1
// Step 2: Decode as UTF-8: ⚡

// The issue: 'Å¡' is itself a 2-byte UTF-8 sequence (C5 A1 = š) 
// so my decoder consumed it as a 2-byte sequence and left 'â' stranded

// I need to handle this: when seeing 'â' (0xE2), don't just look at the next char,
// but also decode potential multi-byte sequences in the continuation bytes

// Better approach: Convert the WHOLE string to its Latin-1 byte representation,
// then decode the bytes as UTF-8, but only for segments that look like valid UTF-8

function toBytes(str) {
  const win1252Map = {
    0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84,
    0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88,
    0x2030: 0x89, 0x0160: 0x8A, 0x2039: 0x8B, 0x0152: 0x8C,
    0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93,
    0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
    0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B,
    0x0153: 0x9C, 0x017E: 0x9E, 0x0178: 0x9F,
  };
  const bytes = [];
  for (const c of str) {
    const code = c.codePointAt(0);
    if (win1252Map[code] !== undefined) bytes.push(win1252Map[code]);
    else if (code <= 0xFF) bytes.push(code);
    else return null; // Non-Latin-1 char; can't convert
  }
  return Buffer.from(bytes);
}

// New strategy: process file chunk by chunk
// Only convert segments that consist entirely of Latin-1 characters
// AND that form valid UTF-8 when the bytes are re-interpreted

let result = '';
let segment = '';
let changes = 0;

function processSegment(seg) {
  if (seg.length === 0) return '';
  const bytes = toBytes(seg);
  if (bytes === null) {
    // Contains non-Latin-1 chars (already valid Unicode), keep as-is
    return seg;
  }
  const decoded = bytes.toString('utf8');
  if (decoded.includes('\ufffd')) {
    // Invalid UTF-8 sequence in this segment, keep as-is
    return seg;
  }
  if (decoded !== seg) {
    changes++;
  }
  return decoded;
}

// Process: split on HTML tags to preserve structure,
// then process text content only
let i = 0;
while (i < html.length) {
  const code = html.codePointAt(i);
  const charLen = code > 0xFFFF ? 2 : 1;
  const c = html.substring(i, i + charLen);
  
  if (code > 0xFF) {
    // This character is beyond Latin-1, it's already properly encoded Unicode
    // Flush current segment
    result += processSegment(segment);
    segment = '';
    result += c;
    i += charLen;
  } else {
    segment += c;
    i += charLen;
  }
}
result += processSegment(segment);

// Check results
const remainingGarbled = (result.match(/Ã/g) || []).length;
const replacementChars = (result.match(/\ufffd/g) || []).length;
const originalGarbled = (html.match(/Ã/g) || []).length;
console.log('Original Ã count:', originalGarbled);
console.log('After fix Ã count:', remainingGarbled);
console.log('Replacement chars:', replacementChars);
console.log('Segment changes:', changes);

// Check start quiz button
const sqIdx = result.indexOf('Start Quiz');
if (sqIdx > -1) {
  console.log('Start Quiz button:', JSON.stringify(result.substring(sqIdx - 50, sqIdx + 20)));
}

if (replacementChars === 0 && remainingGarbled < 5) {
  fs.writeFileSync('f:/STUDY/Eng Proj/index.html', result, 'utf8');
  console.log('SUCCESS: Fixed all mojibake in index.html');
}