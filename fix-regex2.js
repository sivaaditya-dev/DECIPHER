const fs = require('fs');
let server = fs.readFileSync('f:/STUDY/Eng Proj/server.js', 'utf8');

const oldRegex = 'const match = raw.match(/[ACTION:([a-zA-Z]+)]/);';
const newRegex = 'const match = raw.match(/\\[ACTION:([a-zA-Z]+)\\]/);';

if (server.includes(oldRegex)) {
  server = server.replace(oldRegex, newRegex);
  fs.writeFileSync('f:/STUDY/Eng Proj/server.js', server, 'utf8');
  console.log('Fixed regex syntax error!');
} else {
  console.log('Could not find exact match, doing line-by-line fix...');
  const lines = server.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] && lines[i].includes('const match = raw.match(')) {
      lines[i] = lines[i].replace('const match = raw.match(/[ACTION:([a-zA-Z]+)]/);', 'const match = raw.match(/\\[ACTION:([a-zA-Z]+)\\]/);');
      console.log('Replaced on line', i + 1);
    }
  }
  fs.writeFileSync('f:/STUDY/Eng Proj/server.js', lines.join('\n'), 'utf8');
}