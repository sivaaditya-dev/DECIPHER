/**
 * Quiz Module — Standard + Reverse + SRS (Spaced Repetition) Modes
 *
 * Standard Mode:  Show English term → select correct definition.
 * Reverse Mode:   Show translated definition → select correct English term.
 * SRS Mode:       Show AI-generated fill-in-the-blank sentence → select correct English term.
 */

import { showToast } from './toast.js';

// DOM references
const quizModal       = document.getElementById('quizModal');
const quizContent     = document.getElementById('quizContent');
const quizStartScreen = document.getElementById('quizStartScreen');
const quizPlayScreen  = document.getElementById('quizPlayScreen');
const quizEndScreen   = document.getElementById('quizEndScreen');
const optionsContainer  = document.getElementById('optionsContainer');
const nextQBtn          = document.getElementById('nextQBtn');
const modeStandard      = document.getElementById('modeStandard');
const modeReverse       = document.getElementById('modeReverse');
const modeSRS           = document.getElementById('modeSRS');
const reverseUnavail    = document.getElementById('reverseUnavailNote');
const srsUnavail        = document.getElementById('srsUnavailNote');

let fullVocabList       = [];
let translatedVocabList = [];
let srsQuestions        = [];   // [{term, sentence}] pre-generated
let currentMode         = 'standard';
let quizState = { active: false, questions: [], currentIndex: 0, score: 0 };

// ----------------------
// Public API
// ----------------------

export function setVocabList(list) { fullVocabList = list; }

export function setTranslatedVocabList(list) {
  translatedVocabList = list;
  if (modeReverse) {
    modeReverse.disabled = list.length === 0;
    if (reverseUnavail) reverseUnavail.classList.toggle('hidden', list.length > 0);
  }
}

export function setSRSQuestions(questions) {
  srsQuestions = questions;
  if (modeSRS) {
    modeSRS.disabled = false;
    if (srsUnavail) srsUnavail.classList.add('hidden');
  }
}

export function getMode() { return currentMode; }

export function startQuiz(srsSentences = null) {
  if (fullVocabList.length < 4) {
    showToast('You need at least 4 words to start a quiz.', 'warning'); return;
  }
  if (currentMode === 'reverse' && translatedVocabList.length === 0) {
    showToast('Translate the words first to use Reverse Mode.', 'warning'); return;
  }
  if (currentMode === 'srs') {
    if (srsSentences) srsQuestions = srsSentences;
    if (srsQuestions.length === 0) {
      showToast('Click "⚡ Start Quiz" on the Quiz page to auto-generate Smart Quiz questions.', 'warning'); return;
    }
  }
  _buildAndOpen();
}

export function closeQuiz() {
  quizModal.classList.remove('active');
  quizContent.style.transform = 'scale(0.95)';
  quizContent.style.opacity = '0';
}

export function initQuiz() {
  quizStartScreen.style.display = 'none';
  quizPlayScreen.style.display  = 'block';
  loadQuestion();
}

export function nextQuestion() {
  quizState.currentIndex++;
  if (quizState.currentIndex < quizState.questions.length) {
    loadQuestion();
  } else {
    endQuiz();
  }
}

// ----------------------
// Mode Tab Wiring
// ----------------------
export function initQuizModeTabs() {
  if (modeStandard) modeStandard.addEventListener('click', () => setMode('standard'));
  if (modeReverse)  modeReverse.addEventListener('click',  () => setMode('reverse'));
  if (modeSRS)      modeSRS.addEventListener('click',      () => setMode('srs'));
}

function setMode(mode) {
  currentMode = mode;
  [modeStandard, modeReverse, modeSRS].forEach(btn => btn && btn.classList.remove('mode-active'));
  const map = { standard: modeStandard, reverse: modeReverse, srs: modeSRS };
  if (map[mode]) map[mode].classList.add('mode-active');
}

// ----------------------
// Private Helpers
// ----------------------

function _buildAndOpen() {
  const shuffled  = [...fullVocabList].sort(() => Math.random() - 0.5);
  const questions = shuffled.slice(0, 10);
  quizState = { active: true, questions, currentIndex: 0, score: 0 };

  document.getElementById('quizWordCount').textContent = questions.length;
  document.getElementById('totalQ').textContent = questions.length;
  const modeLabels = { standard: '📘 Standard Mode', reverse: '🔄 Reverse Mode', srs: '📝 Smart Quiz Mode' };
  document.getElementById('quizModeLabel').textContent = modeLabels[currentMode] || '📘 Standard Mode';

  quizStartScreen.style.display = 'block';
  quizPlayScreen.style.display  = 'none';
  quizEndScreen.style.display   = 'none';

  quizModal.classList.add('active');
  requestAnimationFrame(() => {
    quizContent.style.transform = 'scale(1)';
    quizContent.style.opacity   = '1';
  });
}

function loadQuestion() {
  const qData    = quizState.questions[quizState.currentIndex];
  const progress = ((quizState.currentIndex + 1) / quizState.questions.length) * 100;

  document.getElementById('currentQ').textContent     = quizState.currentIndex + 1;
  document.getElementById('currentScore').textContent = quizState.score;
  document.getElementById('progressBar').style.width  = `${progress}%`;
  nextQBtn.style.display = 'none';

  if (currentMode === 'reverse') _loadReverseQuestion(qData);
  else if (currentMode === 'srs') _loadSRSQuestion(qData);
  else _loadStandardQuestion(qData);
}

function _loadStandardQuestion(qData) {
  document.getElementById('questionText').innerHTML =
    `What does <span class="question-term">"${qData.term}"</span> mean?`;
  let options = [qData.def];
  const wrong = fullVocabList.filter(v => v.term !== qData.term).sort(() => Math.random() - 0.5);
  for (let i = 0; i < 3; i++) options.push(wrong[i] ? wrong[i].def : 'A related concept.');
  options.sort(() => Math.random() - 0.5);
  optionsContainer.innerHTML = options.map(opt =>
    `<button class="quiz-option" data-correct="${opt === qData.def}">${opt}</button>`
  ).join('');
  _attachOptionListeners();
}

function _loadReverseQuestion(qData) {
  const tMap = {};
  translatedVocabList.forEach(t => { tMap[t.term.toLowerCase()] = t; });
  const tData = tMap[qData.term.toLowerCase()];
  if (!tData) { _loadStandardQuestion(qData); return; }

  document.getElementById('questionText').innerHTML =
    `<span class="question-hint">Which English word matches this meaning?</span><br>
     <span class="question-translated">${tData.translatedDef}</span>`;

  let options = [qData.term];
  const wrong = fullVocabList.filter(v => v.term !== qData.term).sort(() => Math.random() - 0.5);
  for (let i = 0; i < 3; i++) options.push(wrong[i] ? wrong[i].term : 'unknown');
  options.sort(() => Math.random() - 0.5);
  optionsContainer.innerHTML = options.map(opt =>
    `<button class="quiz-option quiz-option-term" data-correct="${opt === qData.term}">${opt}</button>`
  ).join('');
  _attachOptionListeners();
}

function _loadSRSQuestion(qData) {
  const sMap = {};
  srsQuestions.forEach(s => { sMap[s.term.toLowerCase()] = s; });
  const sData = sMap[qData.term.toLowerCase()];
  if (!sData) { _loadStandardQuestion(qData); return; }

  // Highlight the blank in the sentence
  const displayed = sData.sentence.replace('___',
    '<span style="border-bottom:2px solid var(--accent);padding:0 8px;color:var(--accent);font-weight:700;">___</span>'
  );

  document.getElementById('questionText').innerHTML =
    `<span class="question-hint">Fill in the blank:</span><br>
     <span class="srs-sentence">${displayed}</span>`;

  let options = [qData.term];
  const wrong = fullVocabList.filter(v => v.term !== qData.term).sort(() => Math.random() - 0.5);
  for (let i = 0; i < 3; i++) options.push(wrong[i] ? wrong[i].term : 'unknown');
  options.sort(() => Math.random() - 0.5);
  optionsContainer.innerHTML = options.map(opt =>
    `<button class="quiz-option quiz-option-term" data-correct="${opt === qData.term}">${opt}</button>`
  ).join('');
  _attachOptionListeners();
}

function _attachOptionListeners() {
  optionsContainer.querySelectorAll('.quiz-option').forEach(btn =>
    btn.addEventListener('click', handleOptionClick)
  );
}

function handleOptionClick(event) {
  const clicked   = event.currentTarget;
  const isCorrect = clicked.dataset.correct === 'true';
  if (isCorrect) {
    quizState.score++;
    document.getElementById('currentScore').textContent = quizState.score;
  }
  optionsContainer.querySelectorAll('.quiz-option').forEach(btn => {
    btn.disabled = true;
    if (btn.dataset.correct === 'true') btn.classList.add('correct');
    else if (btn === clicked) btn.classList.add('wrong');
  });
  nextQBtn.style.display = 'inline-flex';
}

function endQuiz() {
  quizPlayScreen.style.display = 'none';
  quizEndScreen.style.display  = 'block';
  const pct      = Math.round((quizState.score / quizState.questions.length) * 100);
  const modeStr  = { standard: 'Standard', reverse: 'Reverse', srs: 'Smart Quiz' }[currentMode] || 'Quiz';
  document.getElementById('finalScore').textContent = `${pct}%`;
  if (pct === 100) showToast(`Perfect! Flawless ${modeStr}! 🏆`, 'success', 6000);
  else if (pct >= 70) showToast(`Great work in ${modeStr}! ${pct}% 🌟`, 'success', 5000);
  else showToast(`${pct}% in ${modeStr}. Keep going — you'll get there!`, 'info', 5000);
}
