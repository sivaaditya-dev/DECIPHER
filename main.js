/**
 * main.js — Entry Point Orchestrator
 * Imports all modules and wires DOM events.
 */

import { showToast } from './modules/toast.js';
import {
  analyzeText, extractPdfText, generateStory,
  saveSession, fetchLibrary, fetchSession, clearLibrary,
  translateVocabList, generateMnemonics, simplifyPassage,
  generateSRSQuestions, SPINNER_SVG,
  extractImageText, fetchYouTubeTranscript, sendChatMessage, generateOppositeDay
} from './modules/api.js';
import { initAuth, handleAuthButtonClick, getCurrentUser } from './modules/auth.js';
import {
  renderResults, renderLibraryLoading, renderLibraryGrid,
  renderLibraryError, renderLibraryLoggedOut, renderStory
} from './modules/ui.js';
import {
  setVocabList, setTranslatedVocabList, setSRSQuestions,
  startQuiz, closeQuiz, initQuiz, nextQuestion,
  initQuizModeTabs, getMode
} from './modules/quiz.js';
import { LANGUAGES } from './modules/languages.js';

// ======================
// Populate Language Select
// ======================
const langSelect = document.getElementById('langSelect');
LANGUAGES.forEach(lang => {
  const opt = document.createElement('option');
  opt.value = lang.code;
  opt.textContent = `${lang.name} — ${lang.native}`;
  langSelect.appendChild(opt);
});

// ======================
// DOM References
// ======================
const authBtn          = document.getElementById('authBtn');
const userNameDisplay  = document.getElementById('userNameDisplay');
const libraryGrid      = document.getElementById('libraryGrid');
const clearLibBtn      = document.getElementById('clearLibBtn');
const saveBtn          = document.getElementById('saveBtn');
const themeSelect      = document.getElementById('themeSelect');
const inputText        = document.getElementById('inputText');
const analyzeBtn       = document.getElementById('analyzeBtn');
const sampleBtn        = document.getElementById('sampleBtn');
const generateStoryBtn = document.getElementById('generateStoryBtn');
const storyContainer   = document.getElementById('storyContainer');
const startQuizBtn     = document.getElementById('startQuizBtn');
const resultsBox       = document.getElementById('resultsBox');
const wordCountBadge   = document.getElementById('wordCountBadge');
const pdfUploadInput   = document.getElementById('pdfUploadInput');
const pdfUploadBtn     = document.getElementById('pdfUploadBtn');
const pdfFileName      = document.getElementById('pdfFileName');
const pdfDropZone      = document.getElementById('pdfDropZone');
const translateBtn     = document.getElementById('translateBtn');
const translationBar   = document.getElementById('translationBar');
const reverseQuizBtn   = document.getElementById('reverseQuizBtn');
const mnemonicBtn      = document.getElementById('mnemonicBtn');
const simplifyBtn      = document.getElementById('simplifyBtn');
const simplifyResult   = document.getElementById('simplifyResult');
const simplifyText     = document.getElementById('simplifyText');
const simplifyLevelLabel = document.getElementById('simplifyLevelLabel');
const simplifyLevel    = document.getElementById('simplifyLevel');
const useSimplifiedBtn = document.getElementById('useSimplifiedBtn');

const uiElements = { resultsBox, wordCountBadge, startQuizBtn, generateStoryBtn, storyContainer, saveBtn };

// New feature DOM refs
const oppositeDayBtn   = document.getElementById('oppositeDayBtn');
const imageUploadBtn   = document.getElementById('imageUploadBtn');
const imageUploadInput = document.getElementById('imageUploadInput');
const imageFileName    = document.getElementById('imageFileName');
const youtubeLoadBtn   = document.getElementById('youtubeLoadBtn');
const youtubeUrl       = document.getElementById('youtubeUrl');
const ytStatus         = document.getElementById('ytStatus');
const tutorFab         = document.getElementById('tutorFab');
const tutorPanel       = document.getElementById('tutorPanel');
const tutorClose       = document.getElementById('tutorClose');
const tutorMessages    = document.getElementById('tutorMessages');
const tutorInput       = document.getElementById('tutorInput');
const tutorSend        = document.getElementById('tutorSend');

// ======================
// State
// ======================
let currentVocabList  = [];
let currentTranslated = [];
let currentMnemonics  = [];
let currentLangName   = '';

// ======================
// 1. AUTH
// ======================
firebase.initializeApp(firebaseConfig);
const heroLoginBtn = document.getElementById('heroLoginBtn');
initAuth(firebase, (user) => {
  if (user) {
    authBtn.textContent = 'Log Out';
    userNameDisplay.textContent = `Hi, ${user.displayName.split(' ')[0]}`;
    userNameDisplay.style.display = 'inline';
    saveBtn.disabled = false;
    clearLibBtn.style.display = 'inline';
    loadLibrary();
    // Hero button becomes "Open Studio" once logged in
    if (heroLoginBtn) {
      heroLoginBtn.textContent = 'Open Studio →';
      heroLoginBtn.classList.add('logged-in');
    }
  } else {
    authBtn.textContent = 'Log In with Google';
    userNameDisplay.style.display = 'none';
    saveBtn.disabled = true;
    clearLibBtn.style.display = 'none';
    renderLibraryLoggedOut(libraryGrid);
    if (heroLoginBtn) {
      heroLoginBtn.textContent = 'Login with Google';
      heroLoginBtn.classList.remove('logged-in');
    }
  }
});
authBtn.addEventListener('click', handleAuthButtonClick);
if (heroLoginBtn) {
  heroLoginBtn.addEventListener('click', () => {
    if (getCurrentUser()) {
      // Already logged in — go to Studio
      if (window.decipherNav) window.decipherNav('studioView');
    } else {
      handleAuthButtonClick();
    }
  });
}

// ======================
// 2. PDF UPLOAD
// ======================
pdfUploadBtn.addEventListener('click', () => pdfUploadInput.click());
pdfUploadInput.addEventListener('change', e => { if (e.target.files[0]) handleFileUpload(e.target.files[0]); });

pdfDropZone.addEventListener('dragover', e => { e.preventDefault(); pdfDropZone.classList.add('drag-over'); });
pdfDropZone.addEventListener('dragleave', () => pdfDropZone.classList.remove('drag-over'));
pdfDropZone.addEventListener('drop', e => {
  e.preventDefault(); pdfDropZone.classList.remove('drag-over');
  if (e.dataTransfer.files[0]) handleFileUpload(e.dataTransfer.files[0]);
});

async function handleFileUpload(file) {
  const ext = file.name.toLowerCase();
  if (!ext.endsWith('.pdf') && !ext.endsWith('.epub')) {
    showToast('Only PDF and EPUB files are supported.', 'error'); return;
  }
  if (file.size > 20 * 1024 * 1024) {
    showToast('File is too large. Please upload a file under 20MB.', 'error'); return;
  }
  pdfFileName.textContent = `📎 ${file.name}`;
  pdfFileName.style.display = 'inline';
  const orig = pdfUploadBtn.innerHTML;
  pdfUploadBtn.innerHTML = `${SPINNER_SVG} Extracting...`;
  pdfUploadBtn.disabled = true;
  try {
    const result = await extractPdfText(file);
    inputText.value = result.text;
    showToast(`Extracted ${result.pageCount} page(s) from "${result.fileName}". Ready to analyze!`, 'success', 5000);
    document.getElementById('analyzer').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    showToast(`PDF extraction failed: ${err.message}`, 'error');
    pdfFileName.style.display = 'none';
  } finally {
    pdfUploadBtn.innerHTML = orig;
    pdfUploadBtn.disabled = false;
    pdfUploadInput.value = '';
  }
}

// ======================
// 3. LOAD SAMPLE (11 diverse texts, random each click)
// ======================
const SAMPLE_TEXTS = [
  // 1. Science & Space
  `The James Webb Space Telescope has fundamentally transformed our understanding of the cosmos. By capturing infrared light invisible to the human eye, Webb can peer through dense clouds of gas and dust that once obfuscated stellar nurseries. Astronomers have been astounded by its unprecedented resolution, which has enabled the observation of galaxies formed merely 300 million years after the Big Bang — a period cosmologists call cosmic dawn. The telescope's segmented beryllium mirrors, coated in gold to maximize infrared reflectivity, represent a pinnacle of human ingenuity and precision engineering.`,
  // 2. Philosophy & Ethics
  `The paradox of moral relativism has long vexed philosophers. If ethical standards are merely cultural constructs, then no society can be condemned for its transgressions — an implication that strikes many as deeply pernicious. Proponents of moral realism contend that objective ethical truths exist independently of human sentiment, while pragmatists argue that moral frameworks should be evaluated by their consequences rather than their metaphysical foundations. This epistemological tension between absolutism and relativism remains unresolved, permeating contemporary debates on human rights, justice, and the legitimacy of cultural critique.`,
  // 3. Economics
  `Quantitative easing, a heterodox monetary policy tool, was deployed by central banks during the 2008 financial crisis to combat deflationary spirals. By purchasing government securities and mortgage-backed assets, the Federal Reserve injected liquidity into a moribund credit market, ostensibly forestalling a catastrophic economic contraction. Critics, however, contend that such unconventional interventions exacerbate wealth inequality and create perverse incentives by artificially suppressing interest rates. The long-term ramifications of sustained asset purchases on inflation expectations and fiscal sustainability remain contentious among economists.`,
  // 4. Literature & Language
  `Postcolonial literature grapples with the enduring psychological and cultural ramifications of colonial subjugation. Authors such as Chinua Achebe and Frantz Fanon elucidated how colonialism engendered a profound sense of alienation among subjugated peoples — a rupture between indigenous identity and the hegemonic norms imposed by colonial powers. The concept of hybridity, theorized by Homi Bhabha, suggests that colonial encounters produce ambivalent cultural identities that neither fully assimilate into the colonizer's paradigm nor revert to precolonial traditions, resulting in a liminal space of perpetual negotiation.`,
  // 5. Biology & Medicine
  `The phenomenon of neuroplasticity challenges the long-held dogma that the adult brain is immutable. Contrary to earlier assumptions, the cerebral cortex retains a remarkable capacity for structural reorganization in response to experience, injury, or therapeutic interventions. Synaptic pruning during adolescence refines neural pathways, while long-term potentiation — the persistent strengthening of synaptic connections — underpins the consolidation of memories. These discoveries have profound implications for treating neurodegenerative disorders and rehabilitating patients with traumatic brain injuries, offering hope for recovery previously deemed inconceivable.`,
  // 6. Technology & AI
  `Large language models represent a paradigm shift in artificial intelligence, leveraging transformer architectures to process and generate human-like text with remarkable coherence. Trained on vast corpora through self-supervised learning, these models demonstrate emergent capabilities — reasoning, analogy, and even rudimentary commonsense inference — that were not explicitly programmed. Yet critics argue that such systems are fundamentally stochastic parrots, adept at pattern interpolation but devoid of genuine comprehension or intentionality. The debate over sentience, consciousness, and the ethical deployment of autonomous AI systems grows increasingly consequential as these technologies permeate critical infrastructure.`,
  // 7. History & Civilization
  `The Silk Road was not merely a conduit for mercantile exchange but a vector for the propagation of ideas, religions, and pathogens across Eurasia. Buddhist iconography traveled westward from the Indian subcontinent; papermaking techniques diffused from Tang dynasty China to the Islamic caliphates; and the devastating Black Death traversed the same routes that had carried silk and spices. This intricate web of interdependence illustrates that globalization is not a modern phenomenon but an ancient, inexorable process that has perpetually reshaped civilizations through contact, commerce, and contagion.`,
  // 8. Psychology
  `Cognitive dissonance, Leon Festinger's seminal contribution to social psychology, describes the psychological discomfort experienced when an individual holds contradictory beliefs or when actions conflict with deeply held values. To alleviate this dissonance, individuals engage in a repertoire of rationalization strategies — minimizing the importance of the conflicting belief, acquiring consonant information, or modifying their behavior. This mechanism underlies a vast spectrum of human conduct, from the smoker who dismisses carcinogenic evidence to the investor who remains steadfastly committed to a failing position, exemplifying the profound irrationality embedded in ostensibly rational agents.`,
  // 9. Environmental Science
  `The cryosphere — encompassing Earth's frozen water in glaciers, ice sheets, and permafrost — is undergoing unprecedented destabilization. The ablation of the Greenland and Antarctic ice sheets has accelerated alarmingly, contributing to sea level rise that threatens coastal megacities with inundation within decades. Concurrently, the thawing of Arctic permafrost releases sequestered methane, a potent greenhouse gas that amplifies warming in a pernicious feedback loop. Glaciologists warn that crossing critical tipping points may render these changes irreversible on human timescales, fundamentally altering precipitation patterns and freshwater availability for billions of people.`,
  // 10. Art & Culture
  `The Baroque period epitomized artistic grandeur and emotional exuberance, emerging as an aesthetic response to the Protestant Reformation's austerity. Painters such as Caravaggio revolutionized chiaroscuro — the dramatic interplay of luminosity and shadow — to imbue sacred narratives with visceral, earthly immediacy. Meanwhile, architects like Bernini conceived ecclesiastical spaces as immersive theatrical experiences, deploying colonnades, gilded stucco, and trompe-l'oeil ceilings to overwhelm the senses and engender devotional fervor. The Baroque's exuberant ornamentation was simultaneously a demonstration of ecclesiastical magnificence and a sophisticated instrument of Counter-Reformation propaganda.`,
  // 11. Law & Politics
  `Judicial review — the power of courts to invalidate legislation that contravenes a constitution — stands as one of the most consequential innovations in democratic governance. First asserted by Chief Justice John Marshall in Marbury v. Madison, this doctrine transformed the judiciary from a relatively inconsequential branch into a formidable arbiter of constitutional legitimacy. Critics contend that unelected judges wielding such authority constitutes a countermajoritarian paradox incompatible with democratic self-governance. Proponents counter that constitutional entrenchment of fundamental rights serves as an indispensable bulwark against majoritarian tyranny and the ephemeral passions of electoral politics.`,
];

if (sampleBtn) {
  sampleBtn.addEventListener('click', () => {
    // Pick a random sample — never repeat twice in a row
    const prev = sampleBtn._lastIdx ?? -1;
    let idx;
    do { idx = Math.floor(Math.random() * SAMPLE_TEXTS.length); } while (idx === prev && SAMPLE_TEXTS.length > 1);
    sampleBtn._lastIdx = idx;

    inputText.value = SAMPLE_TEXTS[idx];
    // Switch to text tab if not already there
    const textTab = document.getElementById('srcTabText');
    if (textTab && !textTab.classList.contains('active')) textTab.click();

    showToast(`Sample ${idx + 1} of ${SAMPLE_TEXTS.length} loaded! Click "Decipher Text" to analyze.`, 'info', 3500);
    inputText.focus();
  });
}

// ======================
// 3b. PASSAGE SIMPLIFIER
// ======================
simplifyBtn.addEventListener('click', async () => {
  const text = inputText.value.trim();
  if (text.length < 20) { showToast('Please paste some text to simplify.', 'warning'); return; }
  const level = simplifyLevel.value;
  const orig = simplifyBtn.innerHTML;
  simplifyBtn.innerHTML = `${SPINNER_SVG} Simplifying...`;
  simplifyBtn.disabled = true;
  try {
    const result = await simplifyPassage(text, level);
    simplifyText.textContent = result.simplified;
    simplifyLevelLabel.textContent = level === 'eli5' ? '🧒 EXPLAINED SIMPLY' : '✨ PLAIN ENGLISH';
    simplifyResult.style.display = 'block';
    showToast('Passage simplified! Check the result below the textarea.', 'success', 4000);
  } catch (err) {
    showToast(`Simplification failed: ${err.message}`, 'error');
  } finally {
    simplifyBtn.innerHTML = orig;
    simplifyBtn.disabled = false;
  }
});

// "Use as Input" — copy simplified text into the textarea
useSimplifiedBtn.addEventListener('click', () => {
  if (simplifyText.textContent) {
    inputText.value = simplifyText.textContent;
    simplifyResult.style.display = 'none';
    showToast('Simplified text loaded into the analyzer. Click "Decipher Text"!', 'info', 4000);
  }
});

// ======================
// 4. TEXT ANALYSIS
// ======================
analyzeBtn.addEventListener('click', async () => {
  const text = inputText.value.trim();
  const theme = themeSelect.value;
  if (text.length < 20) { showToast('Please enter a longer passage (at least 20 characters).', 'warning'); return; }

  const orig = analyzeBtn.innerHTML;
  analyzeBtn.innerHTML = `${SPINNER_SVG} Analyzing...`;
  analyzeBtn.disabled = true;
  // Build data dots for scan animation
  const dots = Array.from({length:24},(_,i)=>`<div class="scan-dot" style="animation-delay:${(i*0.08).toFixed(2)}s"></div>`).join('');
  resultsBox.innerHTML = `
    <div class="scan-state">
      <div class="scan-frame">
        <div class="scan-data-dots">${dots}</div>
        <div class="scan-line-anim"></div>
        <div class="scan-corner tl"></div>
        <div class="scan-corner tr"></div>
        <div class="scan-corner bl"></div>
        <div class="scan-corner br"></div>
      </div>
      <p class="scan-text">DECIPHERING...</p>
      <p class="scan-sub">EXTRACTING VOCABULARY</p>
    </div>`;

  // Reset all derived state
  currentTranslated = []; currentMnemonics = []; currentLangName = '';
  translationBar.style.display = 'none';
  mnemonicBtn.style.display = 'none';
  if (oppositeDayBtn) { oppositeDayBtn.style.display = 'none'; }
  setTranslatedVocabList([]);
  setSRSQuestions([]);

  try {
    currentVocabList = await analyzeText(text, theme);
    setVocabList(currentVocabList);
    renderResults(currentVocabList, uiElements, null, '', null);
    translationBar.style.display = 'block';
    mnemonicBtn.style.display = 'inline';
    mnemonicBtn.disabled = false;
    mnemonicBtn.style.opacity = '1';
    if (oppositeDayBtn) { oppositeDayBtn.style.display = 'inline'; oppositeDayBtn.disabled = false; oppositeDayBtn.style.opacity = '1'; }
  } catch (err) {
    showToast(`Analysis failed: ${err.message}`, 'error');
    resultsBox.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;min-height:200px;color:#f87171;">Analysis failed. Please try again.</div>`;
  } finally {
    analyzeBtn.innerHTML = orig;
    analyzeBtn.disabled = false;
  }
});

// ======================
// 5. MEMORY HOOKS (MNEMONICS)
// ======================
mnemonicBtn.addEventListener('click', async () => {
  if (currentVocabList.length === 0) return;
  const orig = mnemonicBtn.innerHTML;
  mnemonicBtn.innerHTML = `${SPINNER_SVG} Generating...`;
  mnemonicBtn.disabled = true;
  try {
    currentMnemonics = await generateMnemonics(currentVocabList);
    // Enable SRS quiz after mnemonics are ready
    setSRSQuestions([]); // clear old; SRS will be generated when quiz starts

    // Re-render cards with mnemonics shown
    renderResults(currentVocabList, uiElements, currentTranslated.length ? currentTranslated : null, currentLangName, currentMnemonics);
    showToast('💡 Memory Hooks generated! Expand them on each card.', 'success', 4000);
  } catch (err) {
    showToast(`Memory Hook generation failed: ${err.message}`, 'error');
  } finally {
    mnemonicBtn.innerHTML = orig;
    mnemonicBtn.disabled = false;
  }
});

// ======================
// 6. TRANSLATION
// ======================
translateBtn.addEventListener('click', async () => {
  if (currentVocabList.length === 0) { showToast('Analyze some text first.', 'warning'); return; }
  const lang = langSelect.value;
  if (!lang) { showToast('Please select a target language.', 'warning'); return; }
  currentLangName = LANGUAGES.find(l => l.code === lang)?.name || lang;
  const orig = translateBtn.innerHTML;
  translateBtn.innerHTML = `${SPINNER_SVG} Translating...`;
  translateBtn.disabled = true;
  langSelect.disabled = true;
  try {
    currentTranslated = await translateVocabList(currentVocabList, lang);
    setTranslatedVocabList(currentTranslated);
    renderResults(currentVocabList, uiElements, currentTranslated, currentLangName, currentMnemonics.length ? currentMnemonics : null);
    reverseQuizBtn.style.display = 'inline-flex';
    showToast(`Translated to ${currentLangName}! Toggle EN / TR on each card.`, 'success', 4000);
  } catch (err) {
    showToast(`Translation failed: ${err.message}`, 'error');
  } finally {
    translateBtn.innerHTML = orig;
    translateBtn.disabled = false;
    langSelect.disabled = false;
  }
});

reverseQuizBtn.addEventListener('click', () => {
  document.getElementById('modeReverse').click();
  startQuiz();
});

// ======================
// 7. STORY GENERATION
// ======================
generateStoryBtn.addEventListener('click', async () => {
  if (currentVocabList.length === 0) return;
  const orig = generateStoryBtn.innerHTML;
  generateStoryBtn.innerHTML = `${SPINNER_SVG} Generating...`;
  generateStoryBtn.disabled = true;
  try {
    const data = await generateStory(currentVocabList.map(i => i.term));
    renderStory(storyContainer, data.story);
    showToast('Story generated!', 'success', 2000);
  } catch (err) {
    showToast('Failed to generate story. Please try again.', 'error');
  } finally {
    generateStoryBtn.innerHTML = orig;
    generateStoryBtn.disabled = false;
  }
});

// ======================
// 8. SAVE SESSION
// ======================
saveBtn.addEventListener('click', async () => {
  if (!getCurrentUser()) { showToast('You must be logged in to save.', 'warning'); return; }
  if (currentVocabList.length === 0) return;
  const snippet = inputText.value.substring(0, 40) + '...';
  const orig = saveBtn.innerHTML;
  saveBtn.innerHTML = `${SPINNER_SVG} Saving...`;
  saveBtn.disabled = true;
  try {
    await saveSession(snippet, currentVocabList);
    showToast('Session saved to your library! 📚', 'success');
    await loadLibrary();
  } catch (err) {
    showToast(`Save failed: ${err.message}`, 'error');
  } finally {
    saveBtn.innerHTML = orig;
    saveBtn.disabled = false;
  }
});

// ======================
// 9. LIBRARY
// ======================
async function loadLibrary() {
  if (!getCurrentUser()) return;
  renderLibraryLoading(libraryGrid);
  try {
    const history = await fetchLibrary();
    renderLibraryGrid(libraryGrid, history, loadSession);
  } catch (err) {
    renderLibraryError(libraryGrid, 'Failed to load library. Please try again later.');
  }
}

async function loadSession(id) {
  try {
    const session = await fetchSession(id);
    if (session && session.words) {
      currentVocabList = session.words;
      currentTranslated = []; currentMnemonics = []; currentLangName = '';
      setVocabList(currentVocabList);
      setTranslatedVocabList([]);
      setSRSQuestions([]);
      renderResults(currentVocabList, uiElements, null, '', null);
      translationBar.style.display = 'block';
      mnemonicBtn.style.display = 'inline';
      mnemonicBtn.style.opacity = '1';
      mnemonicBtn.disabled = false;
      reverseQuizBtn.style.display = 'none';
      window.scrollTo({ top: 0, behavior: 'smooth' });
      showToast('Session loaded!', 'success', 2000);
    }
  } catch (err) {
    showToast('Could not load session. It may have been deleted.', 'error');
  }
}

clearLibBtn.addEventListener('click', async () => {
  if (!confirm('Delete your entire personal library? This cannot be undone.')) return;
  try {
    await clearLibrary();
    showToast('Library cleared.', 'info');
    await loadLibrary();
  } catch (err) {
    showToast('Failed to clear library. Please try again.', 'error');
  }
});

// ======================
// 10. SAMPLE TEXT
// ======================
sampleBtn.addEventListener('click', () => {
  inputText.value = 'The proliferation of digital technology has precipitated a paradigm shift in pedagogical methodologies. While traditional education relied on a teacher-centric model, modern approaches necessitate a more interactive and student-focused framework. This unprecedented integration of sophisticated algorithms into learning platforms has created both opportunities and challenges.';
  simplifyResult.style.display = 'none';
  showToast('Sample text loaded!', 'info', 2000);
});

// ======================
// THEME TOGGLE
// ======================
(function initTheme() {
  const saved = localStorage.getItem('decipher-theme') || 'dark';
  // Use data-theme attribute so we never wipe other html classes
  document.documentElement.setAttribute('data-theme', saved);
  // Mark active button — covers both .theme-btn and .theme-btn-sm
  document.querySelectorAll('.theme-btn, .theme-btn-sm').forEach(b => {
    if (b.dataset.theme === saved) b.classList.add('active');
  });
  document.querySelectorAll('.theme-btn, .theme-btn-sm').forEach(b => {
    b.addEventListener('click', () => {
      const t = b.dataset.theme;
      document.documentElement.setAttribute('data-theme', t);
      document.querySelectorAll('.theme-btn, .theme-btn-sm').forEach(x => x.classList.remove('active'));
      // Activate all buttons sharing this theme (desktop + mobile copies)
      document.querySelectorAll(`.theme-btn[data-theme="${t}"], .theme-btn-sm[data-theme="${t}"]`)
        .forEach(x => x.classList.add('active'));
      localStorage.setItem('decipher-theme', t);
    });
  });
})();


// ======================
// SOURCE TABS
// ======================
document.querySelectorAll('.source-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.source-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.source-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    const panel = document.getElementById('panel-' + tab.dataset.src);
    if (panel) panel.classList.add('active');
  });
});

// ======================
// IMAGE OCR
// ======================
if (imageUploadBtn) imageUploadBtn.addEventListener('click', () => imageUploadInput && imageUploadInput.click());
if (imageUploadInput) {
  imageUploadInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (imageFileName) { imageFileName.textContent = '📎 ' + file.name; imageFileName.style.display = 'inline'; }
    const orig = imageUploadBtn.innerHTML;
    imageUploadBtn.innerHTML = SPINNER_SVG + ' Extracting text...';
    imageUploadBtn.disabled = true;
    try {
      const result = await extractImageText(file);
      inputText.value = result.text;
      // Switch to text tab to show the extracted text
      document.getElementById('srcTabText').click();
      showToast('Text extracted from image! Review it and click Decipher Text.', 'success', 5000);
    } catch (err) {
      showToast('OCR failed: ' + err.message, 'error');
    } finally {
      imageUploadBtn.innerHTML = orig;
      imageUploadBtn.disabled = false;
      imageUploadInput.value = '';
    }
  });
}

// ======================
// YOUTUBE TRANSCRIPT
// ======================
if (youtubeLoadBtn) {
  youtubeLoadBtn.addEventListener('click', async () => {
    const url = youtubeUrl ? youtubeUrl.value.trim() : '';
    if (!url) { showToast('Please enter a YouTube URL.', 'warning'); return; }
    const orig = youtubeLoadBtn.innerHTML;
    youtubeLoadBtn.innerHTML = SPINNER_SVG + ' Loading...';
    youtubeLoadBtn.disabled = true;
    if (ytStatus) ytStatus.textContent = 'Fetching transcript...';
    try {
      const result = await fetchYouTubeTranscript(url);
      inputText.value = result.text;
      document.getElementById('srcTabText').click();
      if (ytStatus) ytStatus.textContent = '';
      showToast('Transcript loaded (' + result.wordCount + ' words). Click Decipher Text!', 'success', 5000);
    } catch (err) {
      if (ytStatus) ytStatus.textContent = 'Error: ' + err.message;
      showToast('Transcript failed: ' + err.message, 'error');
    } finally {
      youtubeLoadBtn.innerHTML = orig;
      youtubeLoadBtn.disabled = false;
    }
  });
}

// ======================
// OPPOSITE DAY
// ======================
if (oppositeDayBtn) {
  oppositeDayBtn.addEventListener('click', async () => {
    const text = inputText.value.trim();
    if (!text || currentVocabList.length === 0) { showToast('Analyze some text first.', 'warning'); return; }
    const orig = oppositeDayBtn.innerHTML;
    oppositeDayBtn.innerHTML = SPINNER_SVG + ' Flipping...';
    oppositeDayBtn.disabled = true;
    try {
      const result = await generateOppositeDay(text, currentVocabList);
      // Show result in storyContainer (reuse it)
      storyContainer.style.display = 'block';
      storyContainer.innerHTML = '<div class="opposite-label">🔄 Opposite Day — Antonym Rewrite</div><p style="font-size:13px;line-height:1.7;font-style:italic;">' + result.opposite + '</p>';
      showToast('Opposite Day generated! All words flipped to their antonyms.', 'success', 4000);
    } catch (err) {
      showToast('Opposite Day failed: ' + err.message, 'error');
    } finally {
      oppositeDayBtn.innerHTML = orig;
      oppositeDayBtn.disabled = false;
    }
  });
}

// ======================
// SOCRATIC TUTOR CHAT
// ======================
let chatMessages = [];

function appendTutorMsg(role, content) {
  const el = document.createElement('div');
  el.className = 'tutor-msg ' + role;
  el.textContent = content;
  tutorMessages.appendChild(el);
  tutorMessages.scrollTop = tutorMessages.scrollHeight;
}

function showTyping() {
  const el = document.createElement('div');
  el.className = 'tutor-typing'; el.id = 'tutor-typing'; el.textContent = '···';
  tutorMessages.appendChild(el);
  tutorMessages.scrollTop = tutorMessages.scrollHeight;
}
function removeTyping() { const el = document.getElementById('tutor-typing'); if (el) el.remove(); }

// ── TUTOR INTENT DETECTION ───────────────────────────────────────────────────
// Maps keyword patterns to executable actions so the Decipher Tutor
// can navigate and trigger features on the user's behalf.
const TUTOR_INTENTS = [
  { pattern: /memory hook|mnemonic/i,    action: 'memoryHooks',   label: 'Memory Hooks' },
  { pattern: /opposite day|antonym/i,    action: 'oppositeDay',   label: 'Opposite Day' },
  { pattern: /story|generate story/i,    action: 'story',         label: 'Story Generator' },
  { pattern: /quiz|test me|start quiz/i, action: 'quiz',          label: 'Quiz' },
  { pattern: /translate|translation/i,   action: 'translate',     label: 'Translator' },
  { pattern: /simplify|eli5|rewrite/i,   action: 'simplify',      label: 'Simplifier' },
  { pattern: /studio|analyzer|analyse/i, action: 'navStudio',     label: 'Studio' },
  { pattern: /library|saved/i,           action: 'navLibrary',    label: 'Library' },
  { pattern: /quiz view|dojo|quiz page/i,action: 'navQuiz',       label: 'Quiz page' },
];

function executeTutorIntent(action) {
  switch (action) {
    case 'memoryHooks':
      // Navigate to Studio first so the user can see the result
      if (window.decipherNav) window.decipherNav('studioView');
      if (mnemonicBtn && !mnemonicBtn.disabled) {
        setTimeout(() => { mnemonicBtn.click(); }, 300); // wait for view to render
        return '✅ Navigating to Studio and generating Memory Hooks for your words!';
      }
      return '⚠️ Analyze some text in Studio first — then I can generate Memory Hooks for you.';
    case 'oppositeDay':
      if (window.decipherNav) window.decipherNav('studioView');
      if (oppositeDayBtn && !oppositeDayBtn.disabled) {
        setTimeout(() => { oppositeDayBtn.click(); }, 300);
        return '✅ Running Opposite Day — flipping all words to their antonyms!';
      }
      return '⚠️ Analyze some text in Studio first to use Opposite Day.';
    case 'story':
      if (window.decipherNav) window.decipherNav('studioView');
      if (generateStoryBtn && !generateStoryBtn.disabled) {
        setTimeout(() => { generateStoryBtn.click(); }, 300);
        return '✅ Generating your vocabulary story in Studio!';
      }
      return '⚠️ Analyze some text in Studio first to generate a story.';
    case 'quiz':
      // Navigate to Quiz tab — dojoStartQuizBtn is the launcher there
      if (window.decipherNav) window.decipherNav('dojoView');
      return '✅ Navigated to the Quiz tab! Click "Start Quiz" to begin.';
    case 'translate':
      if (window.decipherNav) window.decipherNav('studioView');
      setTimeout(() => {
        const tb = document.getElementById('translationBar');
        if (tb) { tb.style.display = 'flex'; tb.scrollIntoView({ behavior: 'smooth' }); }
      }, 300);
      return '✅ Navigated to Studio — scroll to the Translation bar and pick a language!';
    case 'simplify':
      if (window.decipherNav) window.decipherNav('studioView');
      setTimeout(() => {
        if (simplifyBtn) simplifyBtn.scrollIntoView({ behavior: 'smooth' });
      }, 300);
      return '✅ Navigated to Studio — scroll to the Simplify bar and click Rewrite!';
    case 'navStudio':
      if (window.decipherNav) window.decipherNav('studioView');
      return '✅ Navigated to Studio!';
    case 'navLibrary':
      if (window.decipherNav) window.decipherNav('libraryView');
      return '✅ Navigated to your Library!';
    case 'navQuiz':
      if (window.decipherNav) window.decipherNav('dojoView');
      return '✅ Navigated to the Quiz page!';
    case 'navHome':
      if (window.decipherNav) window.decipherNav('landing');
      return '✅ Back to Home!';
    default:
      return null;
  }
}

async function sendTutorMessage() {
  const text = tutorInput.value.trim();
  if (!text) return;
  if (tutorMessages.querySelector('.tutor-empty')) tutorMessages.innerHTML = '';
  tutorInput.value = '';

  // ── Intent detection: check before calling AI ──
  for (const intent of TUTOR_INTENTS) {
    if (intent.pattern.test(text)) {
      const result = executeTutorIntent(intent.action);
      if (result) {
        chatMessages.push({ role: 'user', content: text });
        appendTutorMsg('user', text);
        appendTutorMsg('ai', result);
        chatMessages.push({ role: 'assistant', content: result });
        return; // Don't call AI — action was handled locally
      }
      break;
    }
  }

  // ── Always call AI — Gemini classifies intent in any language ──
  chatMessages.push({ role: 'user', content: text });
  appendTutorMsg('user', text);
  showTyping();
  tutorSend.disabled = true;
  try {
    const passage = inputText ? inputText.value : '';
    const result = await sendChatMessage(chatMessages, passage, currentVocabList);
    removeTyping();

    let reply = result.reply;

    // Parse [ACTION:xxx] tag from start of AI response
    const actionMatch = reply.match(/^\[ACTION:([a-zA-Z]+)\]\s*/);
    if (actionMatch) {
      const action = actionMatch[1];
      reply = reply.slice(actionMatch[0].length).trim(); // strip tag from display text
      // Execute the action after a brief delay so the message renders first
      setTimeout(() => executeTutorIntent(action), 150);
    }

    chatMessages.push({ role: 'assistant', content: reply });
    appendTutorMsg('ai', reply || '✅ Done!');
  } catch (err) {
    removeTyping();
    appendTutorMsg('ai', 'Sorry, I had trouble responding. Please try again.');
  } finally {
    tutorSend.disabled = false;
  }
}

if (tutorFab)   tutorFab.addEventListener('click', () => tutorPanel.classList.toggle('open'));
if (tutorClose) tutorClose.addEventListener('click', () => tutorPanel.classList.remove('open'));
if (tutorSend)  tutorSend.addEventListener('click', sendTutorMessage);
if (tutorInput) tutorInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendTutorMessage(); } });

// ======================
// 11. QUIZ EVENTS
// ======================
initQuizModeTabs();

// startQuizBtn in Studio — navigate to Quiz tab (not open modal directly)
// The dojoStartQuizBtn is now the sole modal launcher
startQuizBtn.addEventListener('click', () => {
  if (currentVocabList.length === 0) {
    showToast('Analyze some text first to unlock the quiz!', 'warning');
    return;
  }
  // Navigate to Quiz tab
  if (window.decipherNav) window.decipherNav('dojoView');
});

document.getElementById('closeQuiz').addEventListener('click', closeQuiz);
document.getElementById('initQuizBtn').addEventListener('click', initQuiz);
document.getElementById('nextQBtn').addEventListener('click', nextQuestion);
document.getElementById('restartQuizBtn').addEventListener('click', async () => {
  const btn = document.getElementById('restartQuizBtn');
  if (getMode() === 'srs' && currentVocabList.length >= 4) {
    const orig = btn.innerHTML;
    btn.innerHTML = '⏳ Generating...';
    btn.disabled = true;
    try {
      const sentences = await generateSRSQuestions(currentVocabList);
      setSRSQuestions(sentences);
      startQuiz(sentences);
    } catch (err) {
      showToast('Could not regenerate quiz: ' + err.message, 'error');
    } finally {
      btn.innerHTML = orig;
      btn.disabled = false;
    }
  } else {
    startQuiz();
  }
});
document.getElementById('exitQuizBtn').addEventListener('click', closeQuiz);
document.getElementById('quizModal').addEventListener('click', e => { if (e.target === e.currentTarget) closeQuiz(); });
// ======================
// 12. PARALLAX + REVEAL
// ======================
(function initParallaxAndReveal() {
  const heroBg = document.getElementById('heroBg');
  const heroWords = document.getElementById('heroWords');
  const heroContent = document.getElementById('heroContent');
  const heroReticle = document.getElementById('heroReticle');

  // Parallax on scroll
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    if (heroBg)      heroBg.style.transform      = `translateY(${y * 0.35}px) scale(1.1)`;
    if (heroWords) {
      heroWords.querySelectorAll('.fd1').forEach(el => { el.style.transform = `translateY(${y * -0.18}px)`; });
      heroWords.querySelectorAll('.fd2').forEach(el => { el.style.transform = `translateY(${y * -0.10}px)`; });
      heroWords.querySelectorAll('.fd3').forEach(el => { el.style.transform = `translateY(${y * -0.06}px)`; });
    }
    if (heroContent)  heroContent.style.transform  = `translateY(${y * 0.12}px)`;
    if (heroReticle)  heroReticle.style.transform  = `translate(-50%,-50%) translateY(${y * 0.08}px)`;
  }, { passive: true });

  // Floating word entrance stagger
  if (heroWords) {
    heroWords.querySelectorAll('.float-word').forEach((el, i) => {
      el.style.opacity = '0';
      el.style.transition = `opacity 1s ease ${i * 0.12}s, transform 0.05s linear`;
      setTimeout(() => { el.style.opacity = '1'; }, 300 + i * 120);
    });
  }

  // Scroll reveal for sections
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('revealed'); revealObserver.unobserve(e.target); } });
  }, { threshold: 0.1 });
  document.querySelectorAll('.reveal-section').forEach(el => revealObserver.observe(el));
})();


// ═══════════════════════════════════════════════════════════════
// APP SHELL v2 — Top-nav view router + split-pane resizer
// ═══════════════════════════════════════════════════════════════
(function initAppShell() {

  // ── THEME ────────────────────────────────────────────────────
  // (theme buttons are already handled by initTheme above; this
  //  section just keeps sidebar/mobile copies in sync — no-op
  //  since we unified to a single set of .theme-btn-sm buttons)

  // ── VIEW ROUTER ───────────────────────────────────────────────
  const VIEWS = ['landing', 'aboutView', 'studioView', 'dojoView', 'libraryView'];

  function switchAppView(viewId) {
    // 1. Hide every view
    VIEWS.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.remove('active');
      el.classList.add('hidden');
    });

    // 2. Show the target view
    const target = document.getElementById(viewId);
    if (target) {
      target.classList.remove('hidden');
      target.classList.add('active');
    }

    // 3. Update nav link active states
    document.querySelectorAll('.nav-link[data-view]').forEach(btn => {
      btn.classList.toggle('nav-link-active', btn.dataset.view === viewId);
    });

    // 4. Manage hero landing video
    const vid = document.querySelector('.hero-bg-video');
    if (vid) {
      if (viewId === 'landing') vid.play().catch(() => {});
      else vid.pause();
    }

    // 4b. Manage about background video
    const aboutVid = document.getElementById('aboutBgVideo');
    if (aboutVid) {
      if (viewId === 'aboutView') aboutVid.play().catch(() => {});
      else aboutVid.pause();
    }

    // 5. Nav glass — transparent on landing/about, solid elsewhere
    const nav = document.getElementById('mainNav');
    if (nav) {
      if (viewId === 'landing' || viewId === 'aboutView') {
        nav.classList.add('nav-on-landing');
        nav.classList.remove('nav-solid');
      } else {
        nav.classList.remove('nav-on-landing');
        nav.classList.add('nav-solid');
      }
    }

    // 6. Trigger about page animations when entering About view
    if (viewId === 'aboutView') {
      runAboutAnimations();
    }
  }

  // ── ABOUT HERO CHARACTER ANIMATION ─────────────────────────────
  let aboutAnimated = false;
  function runAboutAnimations() {
    if (aboutAnimated) return;
    aboutAnimated = true;

    const titleEl = document.getElementById('aboutHeroTitle');
    const subEl   = document.getElementById('aboutHeroSub');
    const btnsEl  = document.getElementById('aboutHeroBtns');
    const tagEl   = document.getElementById('aboutTagCard')?.closest('.about-hero-right');
    if (!titleEl) return;

    const lines = ['Where words unlock', 'worlds of meaning.'];
    const charDelay = 28; // ms per character
    const initDelay = 200;
    titleEl.innerHTML = '';

    // Key fix: wrap each WORD in white-space:nowrap so browser never splits mid-word
    lines.forEach((line, lineIdx) => {
      const words = line.split(' ');
      // count chars already placed (for stagger delay across lines)
      const prevLineChars = lines.slice(0, lineIdx).join(' ').length + (lineIdx > 0 ? lineIdx : 0); // +spaces

      words.forEach((word, wordIdx) => {
        // word wrapper — browser will not break inside this
        const wordSpan = document.createElement('span');
        wordSpan.style.cssText = 'display:inline-block; white-space:nowrap;';

        // space before word (except first word per line)
        if (wordIdx > 0) {
          const spaceSpan = document.createElement('span');
          spaceSpan.style.cssText = 'display:inline-block; white-space:nowrap;';
          spaceSpan.textContent = '\u00A0';
          titleEl.appendChild(spaceSpan);
        }

        // character spans inside the word
        [...word].forEach((char, charIdx) => {
          const charsSoFar = prevLineChars +
            words.slice(0, wordIdx).join('').length + wordIdx + charIdx; // offset for spaces
          const delay = initDelay + charsSoFar * charDelay;
          const span = document.createElement('span');
          span.className = 'about-char hidden-char';
          span.textContent = char;
          setTimeout(() => {
            span.classList.remove('hidden-char');
            span.classList.add('visible-char');
          }, delay);
          wordSpan.appendChild(span);
        });

        titleEl.appendChild(wordSpan);
      });

      // line break between lines (not after last)
      if (lineIdx < lines.length - 1) titleEl.appendChild(document.createElement('br'));
    });

    // Stagger sub, buttons, tag
    const totalChars = lines.join(' ').length;
    const subDelay  = initDelay + totalChars * charDelay + 80;
    const btnsDelay = subDelay  + 380;
    const tagDelay  = btnsDelay + 380;

    setTimeout(() => { if (subEl)  subEl.classList.add('visible');  }, subDelay);
    setTimeout(() => { if (btnsEl) btnsEl.classList.add('visible'); }, btnsDelay);
    setTimeout(() => { if (tagEl)  tagEl.classList.add('visible');  }, tagDelay);
  }

  // Expose switchAppView globally for Decipher Tutor navigation
  window.decipherNav = switchAppView;

  // Wire nav pill buttons (data-view attribute)
  document.querySelectorAll('.nav-link[data-view]').forEach(btn => {
    btn.addEventListener('click', () => switchAppView(btn.dataset.view));
  });

  // Wire hero CTA buttons and any other nav-view-btn
  document.querySelectorAll('.nav-view-btn[data-view]').forEach(btn => {
    btn.addEventListener('click', () => switchAppView(btn.dataset.view));
  });

  // Logo click → home
  const navLogoBtn = document.getElementById('navLogoBtn');
  if (navLogoBtn) navLogoBtn.addEventListener('click', (e) => {
    e.preventDefault();
    switchAppView('landing');
  });

  // Quiz view start quiz — guard: must have words extracted
  const dojoStart = document.getElementById('dojoStartQuizBtn');
  const mainStart = document.getElementById('startQuizBtn');
  if (dojoStart && mainStart) {
    const syncQuizBtn = () => {
      dojoStart.disabled = currentVocabList.length === 0;
    };
    // Re-sync whenever the Studio's mainStart disabled attr changes (after analyze)
    new MutationObserver(syncQuizBtn).observe(mainStart, { attributes: true, attributeFilter: ['disabled'] });
    syncQuizBtn();
    dojoStart.addEventListener('click', async () => {
      if (currentVocabList.length === 0) {
        showToast('Analyze a passage in Studio first — then come back to quiz!', 'warning', 4000);
        return;
      }
      const mode = getMode();
      if (mode === 'srs') {
        if (currentVocabList.length < 4) { showToast('You need at least 4 words for Smart Quiz.', 'warning'); return; }
        const origText = dojoStart.textContent;
        dojoStart.textContent = '⏳ Generating...';
        dojoStart.disabled = true;
        try {
          const sentences = await generateSRSQuestions(currentVocabList);
          setSRSQuestions(sentences);
          startQuiz(sentences);
        } catch (err) {
          showToast('Smart Quiz generation failed: ' + err.message, 'error');
        } finally {
          dojoStart.textContent = origText;
          dojoStart.disabled = false;
        }
      } else {
        startQuiz();
      }
    });
  }

  // ── NAV SCROLL (landing only) ─────────────────────────────────
  const nav = document.getElementById('mainNav');
  if (nav) {
    window.addEventListener('scroll', () => {
      const onLanding = document.getElementById('landing')?.classList.contains('active');
      if (onLanding) {
        nav.classList.toggle('scrolled', window.scrollY > 40);
      }
    }, { passive: true });
  }

  // ── PANE RESIZER (mouse + touch) ──────────────────────────────
  const dualPane = document.getElementById('dualPane');
  const resizer  = document.getElementById('paneResizer');

  if (dualPane && resizer) {
    let dragging = false;

    const startDrag = (e) => {
      e.preventDefault();
      dragging = true;
      resizer.classList.add('dragging');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    };

    const doDrag = (clientX) => {
      if (!dragging) return;
      const rect    = dualPane.getBoundingClientRect();
      const ratio   = ((clientX - rect.left) / rect.width) * 100;
      const clamped = Math.min(Math.max(ratio, 15), 85);
      dualPane.style.setProperty('--split-ratio', clamped + '%');
    };

    const endDrag = () => {
      if (!dragging) return;
      dragging = false;
      resizer.classList.remove('dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    resizer.addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', (e) => doDrag(e.clientX));
    document.addEventListener('mouseup', endDrag);
    resizer.addEventListener('touchstart', startDrag, { passive: false });
    document.addEventListener('touchmove', (e) => doDrag(e.touches[0].clientX), { passive: true });
    document.addEventListener('touchend', endDrag);
  }

  // ── INIT ─────────────────────────────────────────────────────
  switchAppView('landing');

})();
