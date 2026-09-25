const fs = require('fs');
const html = fs.readFileSync('f:/STUDY/Eng Proj/index.html', 'utf8');

// The file has a MIX of:
// 1. Normal ASCII (fine)
// 2. Correctly-encoded Unicode (e.g., Korean chars in meta tags, Decipher logo etc.)
// 3. Double-encoded Windows-1252 mojibake (the garbled sequences like Ã¢Å¡Â¡)

// The problem: we can't just decode the WHOLE file because that would break the 
// correctly-encoded Unicode characters.

// Better approach: Only decode sequences that LOOK like mojibake.
// Mojibake pattern: Any sequence starting with Ã (0xC3) or ð (U+00F0) followed by
// characters in the 0x80-0xFF range.

// The key indicator: 
// - 'Ã' (U+00C3) followed by a character in range [0x80-0xBF] = 2-byte UTF-8 start
// - 'Ã' followed by Å, ¢, £, etc. = signs of double encoding  
// - 'ð' (U+00F0) followed by Ÿ (U+009F) = 4-byte emoji double encoding

// We need to match these specific patterns and decode only those.

const win1252Map = {
  0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84,
  0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88,
  0x2030: 0x89, 0x0160: 0x8A, 0x2039: 0x8B, 0x0152: 0x8C,
  0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93,
  0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B,
  0x0153: 0x9C, 0x017E: 0x9E, 0x0178: 0x9F,
};
const win1252RevMap = {};
for (const [uni, byte] of Object.entries(win1252Map)) {
  win1252RevMap[byte] = parseInt(uni);
}

function charToByte(c) {
  const code = c.charCodeAt(0);
  if (win1252Map[code] !== undefined) return win1252Map[code];
  if (code >= 0 && code <= 255) return code;
  return null;
}

// Regex to find mojibake sequences:
// - Sequences starting with Ã (C3) followed by continuation bytes (represented as characters)
// - Sequences starting with ð (F0) for 4-byte sequences (emojis)
// These chars in double-encoded UTF-8:
//   0xC2-0xDF followed by 0x80-0xBF = 2-byte UTF-8
//   0xE0-0xEF followed by two 0x80-0xBF = 3-byte UTF-8
//   0xF0-0xF7 followed by three 0x80-0xBF = 4-byte UTF-8

// The characters we see:
// 0xC2 = Â, 0xC3 = Ã, 0xC4 = Ä, ..., 0xDF = ß (start of 2-byte or higher)
// 0xE0-0xEF: à á â ã ä å æ ç è é ê ë ì í î ï
// 0xF0 = ð (start of 4-byte)
// Continuation bytes 0x80-0xBF: €‚ƒ„…†‡ˆ‰Š‹ŒŽ''""•–—˜™š›œžŸ ¡¢£¤¥¦§¨©ª«¬­®¯°±²³´µ¶·¸¹º»¼½¾¿

function isMojibakeStart(code) {
  return (code >= 0xC2 && code <= 0xC3) || // 2-byte UTF-8 lead: Â or Ã
         (code >= 0xE2 && code <= 0xE3) || // 3-byte UTF-8 lead: â or ã
         (code === 0xF0);                  // 4-byte UTF-8 lead: ð (emoji)
}

function isContinuationByte(code) {
  // In Windows-1252: bytes 0x80-0xBF, which appear as these characters:
  // Direct Latin-1: 0xA0-0xBF (non-breaking space to ¿)
  // Windows-1252 specials: 0x80-0x9F (various chars)
  const b = charToByte(String.fromCharCode(code));
  return b !== null && b >= 0x80 && b <= 0xBF;
}

let result = '';
let i = 0;

while (i < html.length) {
  const code = html.charCodeAt(i);
  
  // Check if this looks like start of mojibake sequence
  if (isMojibakeStart(code)) {
    // Determine expected sequence length
    let expectedLen;
    if (code >= 0xC2 && code <= 0xC3) expectedLen = 2;
    else if (code >= 0xE2 && code <= 0xE3) expectedLen = 3;
    else if (code === 0xF0) expectedLen = 4;
    
    // Try to read expectedLen chars and decode them
    const segment = html.substring(i, i + expectedLen);
    if (segment.length === expectedLen) {
      const bytes = [];
      let valid = true;
      for (let j = 0; j < segment.length; j++) {
        const b = charToByte(segment[j]);
        if (b === null) { valid = false; break; }
        bytes.push(b);
      }
      
      if (valid) {
        // Verify bytes form a valid UTF-8 sequence
        const buf = Buffer.from(bytes);
        const decoded = buf.toString('utf8');
        if (!decoded.includes('\ufffd') && decoded.length === 1) {
          // Successfully decoded a single character
          result += decoded;
          i += expectedLen;
          continue;
        }
      }
    }
  }
  
  // Not mojibake, keep as-is
  result += html[i];
  i++;
}

// Check results
const remainingGarbled = (result.match(/Ã/g) || []).length;
const replacementChars = (result.match(/\ufffd/g) || []).length;
const originalGarbled = (html.match(/Ã/g) || []).length;
console.log('Original Ã count:', originalGarbled);
console.log('After fix Ã count:', remainingGarbled);
console.log('Replacement chars:', replacementChars);

// Check start quiz button
const sqIdx = result.indexOf('Start Quiz');
if (sqIdx > -1) {
  console.log('Start Quiz button:', JSON.stringify(result.substring(sqIdx - 50, sqIdx + 20)));
}

// Check nav bar emoji  
const voiceIdx = result.indexOf('voice');
if (voiceIdx > -1) {
  console.log('Voice context:', JSON.stringify(result.substring(voiceIdx - 20, voiceIdx + 20)));
}

if (replacementChars === 0 && remainingGarbled < 10) {
  fs.writeFileSync('f:/STUDY/Eng Proj/index.html', result, 'utf8');
  console.log('SUCCESS: Fixed', originalGarbled - remainingGarbled, 'mojibake sequences');
} else {
  console.log('NOT writing yet - need further review');
}