const fs = require('fs');

// NOW I understand the full picture. The decoder works correctly for 4-byte emoji patterns.
// Let me now apply a comprehensive fix to the current state of index.html.
// 
// Current state: 
// - Ã sequences fixed (1029 fixed)
// - ðŸ (U+00F0 U+0178) sequences still need fixing
// - âÅ¡¡ and similar 3-byte sequences still need fixing
// - â•(U+0090) sequences in HTML comments (invisible) 

const win1252Map = {
  0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84,
  0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88,
  0x2030: 0x89, 0x0160: 0x8A, 0x2039: 0x8B, 0x0152: 0x8C,
  0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93,
  0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B,
  0x0153: 0x9C, 0x017E: 0x9E, 0x0178: 0x9F,
};

function charToByte(c) {
  const code = c.charCodeAt(0);
  if (win1252Map[code] !== undefined) return win1252Map[code];
  if (code >= 0 && code <= 255) return code;
  return null; // Can't represent in Windows-1252
}

let html = fs.readFileSync('f:/STUDY/Eng Proj/index.html', 'utf8');

// Process file: scan for sequences of Latin-1-representable characters 
// that form valid UTF-8 when decoded as bytes
let result = '';
let i = 0;
let fixCount = 0;

while (i < html.length) {
  const code = html.charCodeAt(i);
  const byte = charToByte(html[i]);
  
  // Only try to decode if this char could be a UTF-8 lead byte
  // Lead bytes for multi-byte: 0xC0-0xFF range
  if (byte !== null && byte >= 0xC2 && byte <= 0xF4) {
    // Determine expected sequence length
    let expectedLen;
    if (byte >= 0xC2 && byte <= 0xDF) expectedLen = 2;
    else if (byte >= 0xE0 && byte <= 0xEF) expectedLen = 3;
    else if (byte >= 0xF0 && byte <= 0xF4) expectedLen = 4;
    
    // Try to collect expectedLen bytes
    const segBytes = [byte];
    let valid = true;
    let charsConsumed = 1;
    
    for (let j = 1; j < expectedLen; j++) {
      if (i + j >= html.length) { valid = false; break; }
      
      const nextByte = charToByte(html[i + j]);
      if (nextByte === null) { valid = false; break; }
      
      // Check if the next char itself could be a multi-byte char in Win-1252 encoding
      // (e.g., 'Å¡' = 0x9A as Win-1252 but appears as two chars in JS string)
      const nextCode = html.charCodeAt(i + j);
      
      if (nextByte >= 0x80 && nextByte <= 0xBF) {
        // This char maps to a valid continuation byte
        segBytes.push(nextByte);
        charsConsumed++;
      } else {
        // Not a continuation byte - invalid sequence
        valid = false;
        break;
      }
    }
    
    if (valid && segBytes.length === expectedLen) {
      const buf = Buffer.from(segBytes);
      try {
        const decoded = buf.toString('utf8');
        if (!decoded.includes('\ufffd') && decoded.length >= 1) {
          // Successfully decoded! 
          result += decoded;
          fixCount++;
          i += charsConsumed;
          continue;
        }
      } catch(e) {
        // ignore
      }
    }
  }
  
  // Can't decode, keep as-is
  result += html[i];
  i++;
}

const remainingE2 = (result.match(/\u00e2/g) || []).length;
const remainingF0 = (result.match(/\u00f0/g) || []).length;
const replacementChars = (result.match(/\ufffd/g) || []).length;
console.log('Fixes applied:', fixCount);
console.log('Remaining â (U+00E2) chars:', remainingE2);
console.log('Remaining ð (U+00F0) chars:', remainingF0);
console.log('Replacement chars:', replacementChars);

// Check key areas
const sqIdx = result.indexOf('Start Quiz');
if (sqIdx > -1) {
  console.log('Start Quiz:', JSON.stringify(result.substring(sqIdx - 20, sqIdx + 20)));
}

const goStudioIdx = result.indexOf('Go to Studio');
if (goStudioIdx > -1) {
  console.log('Go to Studio:', JSON.stringify(result.substring(goStudioIdx - 20, goStudioIdx + 20)));
}

if (replacementChars < 5 && fixCount > 0) {
  fs.writeFileSync('f:/STUDY/Eng Proj/index.html', result, 'utf8');
  console.log('SUCCESS: Applied', fixCount, 'fixes to index.html');
}