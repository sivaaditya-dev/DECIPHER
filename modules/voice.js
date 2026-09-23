/**
 * voice.js â€” Decipher Voice Assistant
 *
 * Uses the Web Speech API (SpeechRecognition + SpeechSynthesis).
 * No API key required. Works in Chrome, Edge, and modern Android browsers.
 *
 * Capabilities:
 *  - Listens in any language / accent (Gemini interprets intent)
 *  - Parses multi-step commands: "load sample, translate to Tamil, go to quiz"
 *  - Speaks confirmation back with Web TTS
 *  - Falls back gracefully if browser doesn't support Speech API
 *
 * Usage:
 *   import { initVoiceAssistant } from './modules/voice.js';
 *   initVoiceAssistant({ handlers, decipherNav, showToast, ... });
 */

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ACTION INTENT MAP
// Natural language â†’ action key.  Each entry has several phrase
// patterns so we match informal, accented, or non-English input.
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
import { showToast } from './toast.js';
import { setAuth } from './api.js';
import { VOICE_LANGUAGES, getStoredVoiceLang, setStoredVoiceLang, getLangByCode } from './voice-languages.js';
import { parseMultilingualCommands } from './voice-intents-multilang.js';

const VOICE_INTENTS = [
  // Navigation
  {
    patterns: [/\b(studio|analyze|analyser|analyzer|decipher text)\b/i],
    action: 'navStudio',
    label: 'Navigating to Studio',
  },
  {
    patterns: [/\b(quiz|test|dojo|practice)\b/i],
    action: 'navQuiz',
    label: 'Navigating to Quiz',
  },
  {
    patterns: [/\b(library|saved|history|sessions)\b/i],
    action: 'navLibrary',
    label: 'Navigating to Library',
  },
  {
    patterns: [/\b(home|landing|start|main page)\b/i],
    action: 'navHome',
    label: 'Going Home',
  },
  {
    patterns: [/\b(about)\b/i],
    action: 'navAbout',
    label: 'Opening About page',
  },

  // Studio actions â€” order matters: run before generic nav
  {
    patterns: [/\b(load|use|insert|get|open|fetch)\b.{0,20}\b(sample|example|demo|text)\b/i,
               /\b(sample|example|demo)\b/i],
    action: 'loadSample',
    label: 'Loading a sample text',
  },
  {
    patterns: [/\b(analyze|analyse|decipher|extract|process|scan)\b/i],
    action: 'analyze',
    label: 'Analyzing the text',
  },
  {
    patterns: [/\b(memory hook|mnemonic|hook|remember|memorize)\b/i],
    action: 'memoryHooks',
    label: 'Generating Memory Hooks',
  },
  {
    patterns: [/\b(story|generate story|create story|write story)\b/i],
    action: 'story',
    label: 'Generating a Story',
  },
  {
    patterns: [/\b(opposite day|antonym|opposite|flip|reverse meaning)\b/i],
    action: 'oppositeDay',
    label: 'Running Opposite Day',
  },
  {
    patterns: [/\b(simplify|eli5|simple|plain english|rewrite|easy)\b/i],
    action: 'simplify',
    label: 'Simplifying the passage',
  },
  {
    patterns: [/\b(save|bookmark|store|keep)\b/i],
    action: 'save',
    label: 'Saving the session',
  },

  // Translation â€” capture language name
  {
    patterns: [/\b(translate|translation)\b/i],
    action: 'translate',
    label: 'Translating vocabulary',
  },

  // Quiz modes
  {
    patterns: [/\b(smart quiz|srs|fill.in.the.blank|sentence quiz)\b/i],
    action: 'startSmartQuiz',
    label: 'Starting Smart Quiz',
  },
  {
    patterns: [/\b(start quiz|begin quiz|start test|play quiz|launch quiz)\b/i],
    action: 'startQuiz',
    label: 'Starting Quiz',
  },
];

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// LANGUAGE EXTRACTION
// Detect a target language in the utterance for translate action.
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const KNOWN_LANGS = [
  'tamil','hindi','telugu','kannada','malayalam','marathi','bengali','gujarati',
  'punjabi','urdu','spanish','french','german','italian','portuguese','japanese',
  'korean','chinese','arabic','russian','dutch','swedish','turkish','polish',
  'vietnamese','thai','indonesian','malay','swahili','greek','hebrew',
];

function extractLanguage(text) {
  const lower = text.toLowerCase();
  for (const lang of KNOWN_LANGS) {
    if (lower.includes(lang)) {
      return lang.charAt(0).toUpperCase() + lang.slice(1);
    }
  }
  // Fallback: look for "translate to X" or "in X" pattern
  const match = lower.match(/\b(?:translate|into|to|in)\s+([a-z]+)/i);
  if (match && match[1] && match[1].length > 2 && !['the','a','an','my','your'].includes(match[1])) {
    return match[1].charAt(0).toUpperCase() + match[1].slice(1);
  }
  return null;
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// PARSE COMMANDS â€” split utterance into ordered action queue
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function parseCommands(utterance) {
  // Split on common conjunctions / punctuation used in chained commands
  const chunks = utterance
    .split(/\s*(?:,\s*(?:and\s*)?|(?:\s+and\s+)|(?:\s+then\s+)|(?:\s*;\s*)|\s+also\s+|\s+after\s+that\s+)\s*/i)
    .map(s => s.trim())
    .filter(Boolean);

  const queue = [];

  for (const chunk of chunks) {
    for (const intent of VOICE_INTENTS) {
      if (intent.patterns.some(p => p.test(chunk))) {
        // Avoid duplicate consecutive actions
        if (queue.length === 0 || queue[queue.length - 1].action !== intent.action) {
          const entry = { action: intent.action, label: intent.label, raw: chunk };
          if (intent.action === 'translate') {
            entry.lang = extractLanguage(chunk) || extractLanguage(utterance);
          }
          queue.push(entry);
        }
        break; // only first matching intent per chunk
      }
    }
  }
  return queue;
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// SPEECH SYNTHESIS (TTS)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function speak(text, langCode) {
  if (!text || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  // Use the provided language or fall back to the stored preference
  const lang = langCode || getStoredVoiceLang() || 'en-US';
  utt.lang = lang;
  // Try to find a voice matching the target language
  const voices = window.speechSynthesis.getVoices();
  const matchedVoice = voices.find(v => v.lang.startsWith(lang.split('-')[0]));
  if (matchedVoice) utt.voice = matchedVoice;
  window.speechSynthesis.speak(utt);
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// EXECUTE ACTION QUEUE (sequential with delays)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function executeQueue(queue, handlers) {
  for (let i = 0; i < queue.length; i++) {
    const cmd = queue[i];
    const delay = i * 600; // stagger each action
    await new Promise(resolve => setTimeout(resolve, delay));
    await runAction(cmd, handlers);
  }
}

async function runAction(cmd, handlers) {
  const { action, lang } = cmd;
  const {
    loadSample, clickAnalyze, clickMemoryHooks,
    clickStory, clickOppositeDay, clickSimplify, clickSave,
    clickTranslate, setLangSelect, clickStartQuiz, clickStartSmartQuiz,
    currentVocabList,
  } = handlers;

  // decipherNav is a getter function â€” resolve it at call-time
  const decipherNav = typeof handlers.decipherNav === 'function'
    ? handlers.decipherNav()
    : handlers.decipherNav;

  switch (action) {
    case 'navStudio':  if (decipherNav) decipherNav('studioView');  break;
    case 'navQuiz':    if (decipherNav) decipherNav('dojoView');    break;
    case 'navLibrary': if (decipherNav) decipherNav('libraryView'); break;
    case 'navHome':    if (decipherNav) decipherNav('landing');     break;
    case 'navAbout':   if (decipherNav) decipherNav('aboutView');   break;

    case 'loadSample':
      if (loadSample) {
        if (decipherNav) decipherNav('studioView');
        await new Promise(r => setTimeout(r, 300));
        loadSample();
      }
      break;

    case 'analyze':
      if (decipherNav) decipherNav('studioView');
      await new Promise(r => setTimeout(r, 300));
      if (clickAnalyze) clickAnalyze();
      break;

    case 'memoryHooks':
      if (decipherNav) decipherNav('studioView');
      await new Promise(r => setTimeout(r, 400));
      if (clickMemoryHooks) clickMemoryHooks();
      break;

    case 'story':
      if (decipherNav) decipherNav('studioView');
      await new Promise(r => setTimeout(r, 400));
      if (clickStory) clickStory();
      break;

    case 'oppositeDay':
      if (decipherNav) decipherNav('studioView');
      await new Promise(r => setTimeout(r, 400));
      if (clickOppositeDay) clickOppositeDay();
      break;

    case 'simplify':
      if (decipherNav) decipherNav('studioView');
      await new Promise(r => setTimeout(r, 400));
      if (clickSimplify) clickSimplify();
      break;

    case 'save':
      if (clickSave) clickSave();
      break;

    case 'translate':
      if (decipherNav) decipherNav('studioView');
      await new Promise(r => setTimeout(r, 400));
      if (lang && setLangSelect) {
        setLangSelect(lang);
        await new Promise(r => setTimeout(r, 200));
      }
      if (clickTranslate) clickTranslate();
      break;

    case 'startQuiz':
      if (decipherNav) decipherNav('dojoView');
      await new Promise(r => setTimeout(r, 500));
      if (clickStartQuiz) clickStartQuiz();
      break;

    case 'startSmartQuiz':
      if (decipherNav) decipherNav('dojoView');
      await new Promise(r => setTimeout(r, 500));
      if (clickStartSmartQuiz) clickStartSmartQuiz();
      break;

    default:
      console.warn('[Voice] Unknown action:', action);
  }
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// MAIN INIT
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// =====================================================================
// VOICE LANGUAGE PICKER — build and wire the language selector UI
// =====================================================================
function buildLangPicker(recognition, onLangChange) {
  const btn      = document.getElementById('voiceLangBtn');
  const dropdown = document.getElementById('voiceLangDropdown');
  const listEl   = document.getElementById('voiceLangList');
  const search   = document.getElementById('voiceLangSearch');
  const labelEl  = document.getElementById('voiceLangLabel');

  if (!btn || !dropdown || !listEl) return; // overlay not in DOM

  let currentCode = getStoredVoiceLang();

  function updateBtnLabel(code) {
    const lang = getLangByCode(code);
    if (labelEl) labelEl.textContent = lang ? lang.name : code;
  }
  updateBtnLabel(currentCode);

  function renderList(filter = '') {
    listEl.innerHTML = '';
    const lower = filter.toLowerCase();
    let lastRegion = null;

    const filtered = filter
      ? VOICE_LANGUAGES.filter(l =>
          l.name.toLowerCase().includes(lower) ||
          (l.native && l.native.toLowerCase().includes(lower))
        )
      : VOICE_LANGUAGES;

    filtered.forEach(lang => {
      if (lang.region !== lastRegion && !filter) {
        const hdr = document.createElement('div');
        hdr.className = 'voice-lang-region';
        hdr.textContent = lang.region;
        listEl.appendChild(hdr);
        lastRegion = lang.region;
      }
      const opt = document.createElement('div');
      opt.className = 'voice-lang-option' + (lang.code === currentCode ? ' active' : '');
      opt.setAttribute('role', 'option');
      opt.dataset.code = lang.code;
      opt.innerHTML = `<span>${lang.name}</span><span class="lang-native">${lang.native || ''}</span>`;
      opt.addEventListener('click', () => {
        currentCode = lang.code;
        recognition.lang = currentCode;
        setStoredVoiceLang(currentCode);
        updateBtnLabel(currentCode);
        dropdown.classList.add('hidden');
        btn.classList.remove('open');
        if (onLangChange) onLangChange(currentCode);
        renderList(); // refresh active state
      });
      listEl.appendChild(opt);
    });
  }

  renderList();

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = !dropdown.classList.contains('hidden');
    dropdown.classList.toggle('hidden', isOpen);
    btn.classList.toggle('open', !isOpen);
    if (!isOpen && search) { search.value = ''; renderList(); search.focus(); }
  });

  if (search) {
    search.addEventListener('input', () => renderList(search.value));
  }

  document.addEventListener('click', () => {
    dropdown.classList.add('hidden');
    btn.classList.remove('open');
  });

  // Apply stored language immediately
  recognition.lang = currentCode;
  return () => currentCode; // expose getter
}

export function initVoiceAssistant(handlers) {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  const voiceFab     = document.getElementById('voiceFab');
  const voiceOverlay = document.getElementById('voiceOverlay');
  const voiceStatus  = document.getElementById('voiceStatus');

  // Hide mic FAB if browser doesn't support Web Speech API
  if (!SpeechRecognition) {
    if (voiceFab) voiceFab.style.display = 'none';
    console.warn('[Voice] SpeechRecognition not supported in this browser.');
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.continuous     = false;  // single utterance
  recognition.interimResults = true;   // fire as user speaks for live transcript
  recognition.maxAlternatives = 1;
  // Accept any language â€” intent parser handles multi-lingual
  recognition.lang = getStoredVoiceLang() || navigator.language || 'en-US';

  // Wire the language picker UI (renders dropdown, persists choice)
  buildLangPicker(recognition, (code) => { recognition.lang = code; });

  let isListening = false;

  // showOverlay: statusText = prefix shown before the transcript
  //               transcriptFinal / transcriptInterim = live speech text
  function showOverlay(statusText, transcriptFinal = '', transcriptInterim = '') {
    if (voiceOverlay) voiceOverlay.classList.remove('hidden');
    if (voiceFab)     voiceFab.classList.add('voice-active');
    if (voiceStatus) {
      // Build the inner HTML:
      //   <span class="voice-status-prefix">ðŸŽ¤ Listeningâ€¦</span>
      //   <span class="voice-final">confirmed words</span>
      //   <span class="voice-interim">still speakingâ€¦</span>
      let html = '';
      if (statusText)        html += `<span class="voice-status-prefix">${statusText}</span>`;
      if (transcriptFinal)   html += `<span class="voice-final">${transcriptFinal}</span>`;
      if (transcriptInterim) html += `<span class="voice-interim">${transcriptInterim}</span>`;
      voiceStatus.innerHTML = html || statusText;
    }
  }

  function hideOverlay() {
    if (voiceOverlay) voiceOverlay.classList.add('hidden');
    if (voiceFab)     voiceFab.classList.remove('voice-active');
  }

  function startListening() {
    if (isListening) {
      recognition.stop();
      return;
    }
    try {
      recognition.start();
    } catch (e) {
      // recognition already started (race condition) â€” ignore
    }
  }

  recognition.onstart = () => {
    isListening = true;
    showOverlay('ðŸŽ¤', '', 'Listeningâ€¦ speak now');
  };

  recognition.onspeechstart = () => {
    showOverlay('ðŸŽ¤', '', 'Hearing youâ€¦');
  };

  recognition.onspeechend = () => {
    showOverlay('â³', '', 'Processingâ€¦');
  };

  recognition.onresult = async (event) => {
    // Collect all results â€” some final, some interim
    let finalTranscript   = '';
    let interimTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const text = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += text;
      } else {
        interimTranscript += text;
      }
    }

    // Update live overlay with styled final + interim text
    if (finalTranscript || interimTranscript) {
      showOverlay('ðŸŽ¤', finalTranscript, interimTranscript);
    }

    // Only process commands once we have a final result
    if (!finalTranscript) return;

    const utterance = finalTranscript.trim();
    const confidence = event.results[event.results.length - 1][0].confidence;
    
    // First try English regex patterns
    let queue = parseCommands(utterance);

    // If English patterns match nothing, try multilingual keyword patterns
    if (queue.length === 0) {
      queue = parseMultilingualCommands(utterance);
    }

    // Final fallback: if both English and multilingual regex fail, ask Gemini
    if (queue.length === 0) {
      try {
        const langCode = (typeof recognition !== 'undefined' && recognition) ? recognition.lang : 'en-US';
        showOverlay('🔍', utterance, 'Detecting intent…');
        const resp = await fetch('/api/voice-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ utterance, lang: langCode })
        });
        if (resp.ok) {
          const data = await resp.json();
          if (data.action && data.action !== 'none') {
            const intentLabels = {
              navStudio: 'Navigating to Studio', navQuiz: 'Navigating to Quiz',
              navLibrary: 'Opening Library', navHome: 'Going Home', navAbout: 'Opening About',
              analyze: 'Analyzing text', translate: 'Translating', memoryHooks: 'Memory Hooks',
              story: 'Generating Story', simplify: 'Simplifying', oppositeDay: 'Opposite Day',
              save: 'Saving', startQuiz: 'Starting Quiz', loadSample: 'Loading Sample',
            };
            queue.push({ action: data.action, label: intentLabels[data.action] || data.action });
          }
        }
      } catch { /* network error — fall through to tutor */ }
    }

    if (queue.length === 0) {
      // Nothing matched â€” forward to the Decipher Tutor as a text message
      showOverlay('ðŸ¤”', utterance, '');
      speak('Let me check that for you.');
      if (handlers.sendToTutor) {
        handlers.sendToTutor(utterance);
        // Open tutor panel
        const tutorPanel = document.getElementById('tutorPanel');
        const tutorInput = document.getElementById('tutorInput');
        if (tutorPanel) tutorPanel.classList.add('open');
        if (tutorInput) tutorInput.value = utterance;
      }
      await new Promise(r => setTimeout(r, 800));
      hideOverlay();
      return;
    }

    // Build human-readable confirmation
    const actionLabels = queue.map(q => {
      if (q.action === 'translate' && q.lang) return `Translating to ${q.lang}`;
      return q.label;
    });

    const confirmMsg =
      queue.length === 1
        ? `${actionLabels[0]}!`
        : `Doing everything you asked â€” ${actionLabels.join(', ')}.`;

    speak(confirmMsg);
    showOverlay('âœ…', utterance, '');

    await executeQueue(queue, handlers);

    await new Promise(r => setTimeout(r, 1200));
    hideOverlay();
  };

  recognition.onerror = (event) => {
    console.warn('[Voice] Recognition error:', event.error);
    const userErrors = {
      'no-speech':         'No speech detected. Try again.',
      'audio-capture':     'Microphone not found.',
      'not-allowed':       'Microphone access denied. Please allow it in browser settings.',
      'network':           'Network error during recognition.',
      'aborted':           '', // user stopped â€” no message
    };
    const msg = userErrors[event.error] || `Voice error: ${event.error}`;
    if (msg) showOverlay(`âš ï¸`, msg, '');
    speak(msg || '');
    setTimeout(hideOverlay, 2000);
  };

  recognition.onend = () => {
    isListening = false;
    // Don't call hideOverlay here â€” let onresult / onerror handle it
  };

  // Wire mic button
  if (voiceFab) {
    voiceFab.addEventListener('click', startListening);
  }

  // Also expose a programmatic trigger
  window.decipherVoice = { start: startListening, speak };

  }
