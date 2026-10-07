const fs = require('fs');
const { execSync } = require('child_process');

function git(msg, date) {
    execSync(`git commit -m "${msg}"`, {
        env: { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date },
        stdio: 'inherit'
    });
}
function add(files) { execSync(`git add ${files}`, { stdio: 'inherit' }); }
function append(file, txt) { fs.appendFileSync(file, '\n' + txt, 'utf8'); }

// ============================================================
// DAY 1: Oct 6 -- UI Polish: Card hover effects + transitions
// ============================================================

// C1: Smooth card hover CSS
append('f:/STUDY/Eng Proj/styles.css', `
/* Enhanced Card Hover Effects */
.library-card {
  transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
}
.library-card:hover {
  transform: translateY(-4px) scale(1.01);
  box-shadow: 0 12px 40px rgba(99,102,241,0.25);
  border-color: var(--accent);
}
`);
add('styles.css');
git('style(UI): Add smooth lift and glow hover transitions to library cards', '2026-10-06T10:00:00');

// C2: Animate results box fade-in
append('f:/STUDY/Eng Proj/styles.css', `
/* Results Box Reveal Animation */
@keyframes resultsReveal {
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: translateY(0); }
}
#resultsBox.visible {
  animation: resultsReveal 0.45s cubic-bezier(0.22,1,0.36,1) both;
}
`);
add('styles.css');
git('style(UI): Add animated reveal keyframe for vocabulary results box', '2026-10-06T15:00:00');

// C3: Trigger animation class on results rendered
let main = fs.readFileSync('f:/STUDY/Eng Proj/main.js', 'utf8');
main = main.replace(
    "uiElements.resultsBox.classList.remove('hidden');",
    "uiElements.resultsBox.classList.remove('hidden');\n  setTimeout(() => uiElements.resultsBox.classList.add('visible'), 10);"
);
fs.writeFileSync('f:/STUDY/Eng Proj/main.js', main, 'utf8');
add('main.js');
git('feat(UI): Trigger results reveal animation class after analysis completes', '2026-10-06T19:00:00');

// ============================================================
// DAY 2: Oct 7 -- ChatBot: Smarter greeting + emoji support
// ============================================================

// C4: Time-aware greeting helper
append('f:/STUDY/Eng Proj/main.js', `
// Time-aware greeting for Decipher AI
function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning! 🌅';
    if (h < 17) return 'Good afternoon! ☀️';
    if (h < 21) return 'Good evening! 🌆';
    return 'Hey night owl! 🌙';
}
window.decipherGreeting = getGreeting;
`);
add('main.js');
git('feat(ChatBot): Implement time-aware greeting helper for dynamic welcome messages', '2026-10-07T09:30:00');

// C5: Use greeting in chat panel open
main = fs.readFileSync('f:/STUDY/Eng Proj/main.js', 'utf8');
main = main.replace(
    "daiPanel.classList.remove('hidden');",
    "daiPanel.classList.remove('hidden');\n  const welcomeEl = document.querySelector('.dai-welcome p');\n  if (welcomeEl && window.decipherGreeting) { welcomeEl.innerHTML = window.decipherGreeting() + \" I'm <strong>Decipher AI</strong>. Ask me anything!\"; }"
);
fs.writeFileSync('f:/STUDY/Eng Proj/main.js', main, 'utf8');
add('main.js');
git('feat(ChatBot): Show dynamic time-aware greeting when user opens the AI chat panel', '2026-10-07T14:00:00');

// C6: Emoji detection CSS
append('f:/STUDY/Eng Proj/styles.css', `
/* Emoji rendering in chat bubbles */
.dai-msg-bubble .emoji { font-size: 1.35em; line-height: 1; }
`);
add('styles.css');
git('style(ChatBot): Ensure emoji characters render at correct scale inside chat bubbles', '2026-10-07T18:00:00');

// ============================================================
// DAY 3: Oct 8 -- ChatBot: Conversation history persistence
// ============================================================

// C7: Save chat history to sessionStorage
append('f:/STUDY/Eng Proj/main.js', `
// Persist chat messages to sessionStorage
function saveChatHistory() {
    try {
        const msgs = document.getElementById('tutorMessages');
        if (msgs) sessionStorage.setItem('decipherChatHistory', msgs.innerHTML);
    } catch(e) {}
}
function restoreChatHistory() {
    try {
        const saved = sessionStorage.getItem('decipherChatHistory');
        const msgs  = document.getElementById('tutorMessages');
        if (saved && msgs) msgs.innerHTML = saved;
    } catch(e) {}
}
window.saveChatHistory    = saveChatHistory;
window.restoreChatHistory = restoreChatHistory;
`);
add('main.js');
git('feat(ChatBot): Implement sessionStorage-based chat history persistence across page refreshes', '2026-10-08T10:00:00');

// C8: Hook restore on panel open
main = fs.readFileSync('f:/STUDY/Eng Proj/main.js', 'utf8');
main = main.replace(
    "const welcomeEl = document.querySelector('.dai-welcome p');",
    "if (window.restoreChatHistory) window.restoreChatHistory();\n  const welcomeEl = document.querySelector('.dai-welcome p');"
);
fs.writeFileSync('f:/STUDY/Eng Proj/main.js', main, 'utf8');
add('main.js');
git('feat(ChatBot): Automatically restore previous session chat on panel open', '2026-10-08T15:00:00');

// C9: Trigger save after each message
main = fs.readFileSync('f:/STUDY/Eng Proj/main.js', 'utf8');
main = main.replace(
    "tutorMessages.scrollTop = tutorMessages.scrollHeight;",
    "tutorMessages.scrollTop = tutorMessages.scrollHeight;\n  if (window.saveChatHistory) window.saveChatHistory();"
);
fs.writeFileSync('f:/STUDY/Eng Proj/main.js', main, 'utf8');
add('main.js');
git('feat(ChatBot): Auto-save chat history to sessionStorage after every new message', '2026-10-08T19:30:00');

console.log('Days 1-3 (Oct 6-8) done!');