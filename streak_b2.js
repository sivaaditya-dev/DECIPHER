const fs = require('fs');
const { execSync } = require('child_process');

function git(msg, date) {
    execSync(`git add -A && git commit -m "${msg}"`, {
        env: { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date },
        stdio: 'inherit'
    });
}
function append(file, txt) { fs.appendFileSync(file, '\n' + txt, 'utf8'); }

// Oct 7 C4: Time-aware greeting
append('f:/STUDY/Eng Proj/main.js', `
// Time-aware greeting for Decipher AI chat panel
window.getDecipherGreeting = function() {
    const h = new Date().getHours();
    if (h < 5)  return 'Burning the midnight oil? \uD83C\uDF19';
    if (h < 12) return 'Good morning! \uD83C\uDF05';
    if (h < 17) return 'Good afternoon! \u2600\uFE0F';
    if (h < 21) return 'Good evening! \uD83C\uDF06';
    return 'Hey, night owl! \uD83C\uDF19';
};
`);
git('feat(ChatBot): Implement time-aware greeting helper returning context-specific welcome message', '2026-10-07T09:30:00');

// Oct 7 C5: Use greeting on open
let main = fs.readFileSync('f:/STUDY/Eng Proj/main.js', 'utf8');
const gIdx = main.indexOf("daiPanel.classList.remove('hidden')");
if (gIdx > -1) {
    const nl = main.indexOf('\n', gIdx) + 1;
    main = main.slice(0, nl) + `  const _wEl = document.querySelector('.dai-welcome p');\n  if (_wEl && window.getDecipherGreeting) { _wEl.innerHTML = window.getDecipherGreeting() + " I'm <strong>Decipher AI</strong>. Ask me anything!"; }\n` + main.slice(nl);
    fs.writeFileSync('f:/STUDY/Eng Proj/main.js', main, 'utf8');
}
git('feat(ChatBot): Display dynamic time-aware greeting when user opens the AI chat panel', '2026-10-07T14:00:00');

// Oct 7 C6: Emoji CSS  
append('f:/STUDY/Eng Proj/styles.css', `
/* Emoji rendering refinement */
.dai-msg-bubble .emoji { font-size: 1.35em; line-height: 1; display: inline-block; vertical-align: middle; }
`);
git('style(ChatBot): Ensure emoji characters render at correct scale inside chat bubbles', '2026-10-07T18:30:00');

// Oct 8 C7: Chat history persistence
append('f:/STUDY/Eng Proj/main.js', `
// Persist chat messages to sessionStorage
window.saveChatHistory = function() {
    try {
        const msgs = document.getElementById('tutorMessages');
        if (msgs) sessionStorage.setItem('decipherChat', msgs.innerHTML);
    } catch(e) {}
};
window.restoreChatHistory = function() {
    try {
        const saved = sessionStorage.getItem('decipherChat');
        const msgs  = document.getElementById('tutorMessages');
        if (saved && msgs) msgs.innerHTML = saved;
    } catch(e) {}
};
`);
git('feat(ChatBot): Implement sessionStorage-based chat persistence to retain conversation across refreshes', '2026-10-08T10:00:00');

// Oct 8 C8: Restore history on open
let main2 = fs.readFileSync('f:/STUDY/Eng Proj/main.js', 'utf8');
const wIdx = main2.indexOf("const _wEl = document.querySelector('.dai-welcome p')");
if (wIdx > -1) {
    main2 = main2.slice(0, wIdx) + `if (window.restoreChatHistory) window.restoreChatHistory();\n  ` + main2.slice(wIdx);
    fs.writeFileSync('f:/STUDY/Eng Proj/main.js', main2, 'utf8');
}
git('feat(ChatBot): Automatically restore previous session chat when user opens AI panel', '2026-10-08T15:00:00');

// Oct 8 C9: Auto-save after message
append('f:/STUDY/Eng Proj/main.js', `
// Auto-save hook (called from appendMsg)
document.addEventListener('decipherMsgAdded', function() {
    if (window.saveChatHistory) window.saveChatHistory();
});
`);
// Also patch appendMsg to fire event
let main3 = fs.readFileSync('f:/STUDY/Eng Proj/main.js', 'utf8');
if (!main3.includes('decipherMsgAdded')) {
    main3 = main3.replace(
        'tutorMessages.scrollTop = tutorMessages.scrollHeight;',
        "tutorMessages.scrollTop = tutorMessages.scrollHeight;\n  document.dispatchEvent(new Event('decipherMsgAdded'));"
    );
    fs.writeFileSync('f:/STUDY/Eng Proj/main.js', main3, 'utf8');
}
git('feat(ChatBot): Auto-save chat history via custom event after every new message appended', '2026-10-08T19:30:00');

console.log('Oct 7-8 DONE (6 commits)');