const fs = require('fs');
const html = fs.readFileSync('f:/STUDY/Eng Proj/index.html', 'utf8');

// Get the Latin-1 byte value for a given character
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
  return null;
}

// Convert the whole file from double-encoded UTF-8 back to correct UTF-8
// by treating every char as its Win-1252 byte, then decoding as UTF-8
let chars = [];
for (let i = 0; i < html.length; i++) {
  const b = charToByte(html[i]);
  if (b === null) {
    // Character outside Win-1252 range (already valid Unicode > U+00FF)
    // This shouldn't happen for double-encoded content, but keep it as-is
    chars.push({ type: 'unicode', char: html[i] });
  } else {
    chars.push({ type: 'byte', byte: b });
  }
}

// Now collect consecutive bytes and try to decode them as UTF-8
// When we hit a 'unicode' character, flush the bytes first
let result = '';
let byteBuffer = [];

function flushBytes() {
  if (byteBuffer.length === 0) return;
  const buf = Buffer.from(byteBuffer);
  // Try to decode as UTF-8
  // Check for replacement characters
  const decoded = buf.toString('utf8');
  result += decoded;
  byteBuffer = [];
}

for (const item of chars) {
  if (item.type === 'byte') {
    byteBuffer.push(item.byte);
  } else {
    flushBytes();
    result += item.char;
  }
}
flushBytes();

// Count changes (check for remaining 'Ã' sequences)
const remainingGarbled = (result.match(/Ã/g) || []).length;
const originalGarbled = (html.match(/Ã/g) || []).length;
console.log('Original Ã count:', originalGarbled);
console.log('After fix Ã count:', remainingGarbled);

// Check for replacement chars (indicates invalid UTF-8 sequences)
const replacementChars = (result.match(/\ufffd/g) || []).length;
console.log('Replacement chars (invalid sequences):', replacementChars);

// Write to file if it looks good (few/no replacement chars)
if (replacementChars < 50 && remainingGarbled < originalGarbled) {
  fs.writeFileSync('f:/STUDY/Eng Proj/index.html', result, 'utf8');
  console.log('SUCCESS: Fixed mojibake in index.html');
} else {
  console.log('WARN: Too many replacement chars, not writing. Fix approach needs work.');
  // Show some replacement char contexts
  let pos = result.indexOf('\ufffd');
  if (pos > -1) {
    console.log('Sample replacement char context:', JSON.stringify(result.substring(pos - 20, pos + 20)));
  }
}