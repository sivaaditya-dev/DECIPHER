const fs = require('fs');
let server = fs.readFileSync('f:/STUDY/Eng Proj/server.js', 'utf8');
const lines = server.split('\n');
let start = -1;
let end = -1;
for(let i = 880; i < 910; i++) {
  if (lines[i] && lines[i].indexOf('const prompt = \\'You are the intent engine') !== -1) {
    start = i;
  }
  if (start > -1 && lines[i] && lines[i].indexOf('[ACTION:none]') !== -1) {
    end = i + 3; // Get the next few lines up to the semicolon
    break;
  }
}

if (start > -1 && end > -1) {
  const newBlock = \  const prompt = \\\You are the intent engine for "Decipher", an AI vocabulary app.
The user spoke a voice command. Identify their intended action.
Language (BCP-47): \
Transcript: "\"

Reply with EXACTLY one tag:
[ACTION:navStudio] [ACTION:navQuiz] [ACTION:navLibrary] [ACTION:navHome]
[ACTION:navAbout] [ACTION:analyze] [ACTION:translate] [ACTION:memoryHooks]
[ACTION:story] [ACTION:simplify] [ACTION:oppositeDay] [ACTION:save]
[ACTION:startQuiz] [ACTION:loadSample] [ACTION:none]

Reply with only the tag.\\\;\;

  const before = lines.slice(0, start);
  const after = lines.slice(end + 1);
  const newLines = [...before, newBlock, ...after];
  fs.writeFileSync('f:/STUDY/Eng Proj/server.js', newLines.join('\n'), 'utf8');
  console.log('Fixed syntax error!');
} else {
  console.log('Could not find start/end lines');
  console.log('start:', start, 'end:', end);
}
