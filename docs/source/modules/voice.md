# `voice.js` — Voice Assistant

**File:** `modules/voice.js`

Integrates the **Web Speech API** (SpeechRecognition + SpeechSynthesis) to give Decipher hands-free voice control. No API key needed — everything runs in the browser.

> **Browser support:** Chrome, Edge, and modern Android browsers. The mic FAB is automatically hidden in unsupported browsers.

---

## Initialization

### `initVoiceAssistant(handlers)`

Call once during app startup.

```js
initVoiceAssistant({
  loadSample,
  clickAnalyze,
  clickMemoryHooks,
  clickStory,
  clickOppositeDay,
  clickSimplify,
  clickSave,
  clickTranslate,
  setLangSelect,
  clickStartQuiz,
  clickStartSmartQuiz,
  currentVocabList,
  decipherNav,      // () => navFn  (getter — resolved at call time)
  sendToTutor,
});
```

All `handlers` are optional; missing ones cause the related voice command to silently no-op.

---

## Supported Voice Commands

The assistant matches spoken phrases to action intents regardless of language or phrasing.

| Utterance Examples | Action |
|--------------------|--------|
| "Studio", "go back", "analyze" | Navigate to Studio |
| "Quiz", "test me", "dojo" | Navigate to Quiz |
| "Library", "saved sessions" | Navigate to Library |
| "Home", "landing", "main page" | Navigate to Home |
| "Load sample", "open demo" | Load a sample text |
| "Analyze", "decipher", "extract" | Run vocabulary analysis |
| "Memory hooks", "mnemonic", "remember" | Generate mnemonics |
| "Story", "generate story" | Generate vocabulary story |
| "Opposite day", "antonym" | Run Opposite Day |
| "Simplify", "ELI5", "plain English" | Simplify passage |
| "Save", "bookmark" | Save current session |
| "Translate to Tamil" | Set language + translate |
| "Smart quiz", "SRS", "fill in the blank" | Start SRS quiz |
| "Start quiz", "begin test" | Start standard quiz |

---

## Multi-Step Commands

Commands can be chained in a single utterance using conjunctions:

```
"Load sample, analyze, then translate to French"
"Use demo and start quiz"
"Memory hooks, then save"
```

The assistant parses the utterance into an ordered queue and executes each action sequentially with a 600ms stagger.

---

## Translation Language Extraction

When the user says "translate to X", the module extracts the language name from the utterance. It searches a built-in list of 30+ languages and falls back to a regex pattern `/(translate|into|to|in)\s+([a-z]+)/i`.

---

## Text-to-Speech

The assistant speaks back a confirmation before executing the action queue:

- **Single action:** `"Translating to Tamil!"`
- **Multiple actions:** `"Doing everything you asked — Loading a sample text, Analyzing the text."`

It prefers a Neural/Natural English voice from the browser's voice list if available.

---

## Fallback to Tutor Chat

If no intent is matched, the utterance is forwarded to the Socratic Tutor chat panel as a text message, and the tutor panel is opened automatically.

---

## Global API

After initialization, a global escape hatch is available on `window`:

```js
window.decipherVoice.start();         // Start listening programmatically
window.decipherVoice.speak("Hello!"); // Speak text programmatically
```
