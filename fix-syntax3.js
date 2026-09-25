const fs = require('fs');
let server = fs.readFileSync('f:/STUDY/Eng Proj/server.js', 'utf8');
const lines = server.split('\n');
let start = -1;
let end = -1;
for(let i = 880; i < 910; i++) {
  if (lines[i] && lines[i].indexOf("const prompt = 'You") !== -1) {
    start = i;
  }
  if (start > -1 && lines[i] && lines[i].indexOf("[ACTION:none]") !== -1) {
    end = i + 3; // Get the next few lines up to the semicolon
    break;
  }
}

if (start > -1 && end > -1) {
  const newBlock = "  const prompt = \\You are the intent engine for \\"Decipher\\", an AI vocabulary app.\\n" +
"The user spoke a voice command. Identify their intended action.\\n" +
"Language (BCP-47): \\\\n" +
"Transcript: \\"\\\\"\\n\\n" +
"Reply with EXACTLY one tag:\\n" +
"[ACTION:navStudio] [ACTION:navQuiz] [ACTION:navLibrary] [ACTION:navHome]\\n" +
"[ACTION:navAbout] [ACTION:analyze] [ACTION:translate] [ACTION:memoryHooks]\\n" +
"[ACTION:story] [ACTION:simplify] [ACTION:oppositeDay] [ACTION:save]\\n" +
"[ACTION:startQuiz] [ACTION:loadSample] [ACTION:none]\\n\\n" +
"Reply with only the tag.\\;";

  const before = lines.slice(0, start);
  const after = lines.slice(end + 1);
  const newLines = [...before, newBlock, ...after];
  fs.writeFileSync('f:/STUDY/Eng Proj/server.js', newLines.join('\n'), 'utf8');
  console.log('Fixed syntax error!');
} else {
  console.log('Could not find start/end lines');
  console.log('start:', start, 'end:', end);
}
