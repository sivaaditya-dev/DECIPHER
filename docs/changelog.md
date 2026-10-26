# Decipher — Changelog

All notable changes to Decipher are documented in this file.  
Format: [Conventional Commits](https://www.conventionalcommits.org) · [Keep a Changelog](https://keepachangelog.com)

---

## [Unreleased] — Oct 16–26, 2026 — Studio & Intelligence Upgrade

### ✨ New Features

#### 🔍 Command Palette (Oct 16)
- **`modules/palette.js`** — Spotlight-style `Ctrl+K` command palette with fuzzy search over all app actions
- **`modules/shortcuts.js`** — Global keyboard power shortcuts (`g+h`, `g+s`, `g+l`, `g+p`, `g+c` for navigation; `?` to open palette)
- All new features auto-register as palette commands for instant discoverability

#### 🎙️ Audio Pronunciation Studio (Oct 17)
- **`modules/audio-studio.js`** — Full microphone recording via Web Audio API with real-time frequency visualizer
- Side-by-side native TTS vs. user recording comparison with pronunciation feedback
- VU meter bars, recording pulse animation, waveform canvas with live rendering

#### 🎴 3D Flashcard SRS Engine (Oct 18)
- **`modules/flashcards.js`** — 3D CSS perspective card-flip review mode (Hardware-accelerated `rotateY`)
- SuperMemo SM-2 scheduling algorithm with **Again / Hard / Good / Easy** rating buttons
- Keyboard-driven: `Space` to flip, `1-4` to rate, `Esc` to exit

#### 📖 AI Grammar & Nuance Explainer (Oct 19)
- **`modules/grammar-explainer.js`** — Slide-in glassmorphic drawer showing register, collocations, etymology, and context sentences for any vocabulary term
- CEFR tier and register pills (Formal, Academic, Colloquial)

#### ⚡ RSVP Speed Reader (Oct 20)
- **`modules/speed-reader.js`** — Rapid Serial Visual Presentation engine (150–750 WPM, adjustable)
- Optimal Recognition Point (ORP) highlight in red — eye fixation training for faster comprehension
- Punctuation-aware pause durations; `Space` to play/pause, arrow keys to jump ±10 words

#### 📥 Study Export Suite (Oct 21)
- **`modules/export-suite.js`** — Anki-compatible `.tsv` export, CSV export, and browser-based printable A4 flashcard sheet generator
- **`docs/anki-import-guide.md`** — Step-by-step Anki import walkthrough

#### 🧘 Zen Focus Room & Ambient Sound (Oct 22)
- **`modules/zen-focus.js`** — Full Pomodoro timer (25 min focus / 5 min break) with animated SVG ring progress and chime alerts
- Web Audio API ambient sound synthesizer: Pink noise (ocean/rain), binaural focus tone (10Hz alpha)

#### 🏆 Trophy Cabinet & Gamification (Oct 23)
- **`modules/trophies.js`** — 6 unlockable achievement badges (Bronze / Silver / Gold tiers) persisted in `localStorage`
- Canvas-based confetti celebration animation on trophy unlock
- Streak freeze protection logic

#### 🔖 CEFR Vocabulary Filter & Batch Actions (Oct 24)
- **`modules/vocab-indexer.js`** — CEFR A1–C2 difficulty estimator, smart domain tagging (science, business, academic), collection filter engine
- Batch export, batch quiz, and batch delete operations on selected vocabulary sets

#### 📶 Offline PWA (Oct 25)
- **`sw.js`** — Service worker with cache-first strategy for all static assets and modules; network-first for live `/api/` routes
- **`modules/pwa.js`** — Lightweight SW registration with HTTPS/localhost safety guard
- CSS layout containment (`contain`, `content-visibility`, `will-change`) for measurably faster repaints

#### 🔗 Navigation Unification (Oct 26)
- All studio modules (Flashcards, Audio Studio, Speed Reader, Zen Focus, Grammar Explainer, Export) auto-register as Command Palette commands
- Extra power shortcuts: `Ctrl+Shift+F` (Flashcards), `Ctrl+Shift+R` (Speed Reader), `Ctrl+Shift+Z` (Zen Timer), `Ctrl+Shift+P` (Pronunciation Studio)

---

### 🧪 Test Coverage Added
| Test File | Covers |
|---|---|
| `tests/shortcuts.test.js` | Hotkey registry, chord dispatch, unregistered fallback |
| `tests/vocab-indexer.test.js` | CEFR estimator, query filter, CEFR filter |
| `tests/pwa.test.js` | Cache constants, API route detection, POST bypass |

---

### 📚 Documentation
- `docs/anki-import-guide.md` — Anki import walkthrough
- `CONTRIBUTING.md` — Commit convention reference

---

## Previous Releases
See [git log](https://github.com/) for full history prior to Oct 16, 2026.
