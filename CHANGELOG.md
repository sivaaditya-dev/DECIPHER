# DECIPHER — Changelog

All notable changes to the DECIPHER platform are documented in this file.  
Format adheres to [Keep a Changelog](https://keepachangelog.com) and adheres to [Conventional Commits](https://www.conventionalcommits.org).

---

## [1.2.0] — 2026-11-07 — Spaced Repetition, Offline Sync, Resilience, Security & CI/CD Sprint

The November 2026 production sprint executed a 12-day development cycle across 30 production commits, upgrading DECIPHER to an enterprise-grade AI vocabulary learning platform.

### 🌟 Key Feature Highlights

#### 1. 🧠 SuperMemo SM-2 Spaced Repetition & Retention Analytics (Oct 28, Oct 31, Nov 03)
- Implemented SuperMemo SM-2 interval and ease-factor calculation engine with minimum $EF \ge 1.3$ bound (`modules/srs.js`).
- Local review queue manager with due date tracking, overdue sorting, and mature card classification.
- Weak Words drill room with automatic mistake taxonomy classification (`spelling_typo`, `near_miss`, `confused_definition`) and graduation threshold.
- Ebbinghaus retention curve generator ($R = e^{-t/S}$) and rolling 7-day learning velocity calculations (`modules/analytics.js`).
- Interactive pure-SVG retention curve chart and mastery breakdown cards in Studio view.

#### 2. 📶 Offline PWA & IndexedDB Persistence (Nov 01)
- Added `IndexedDBStorageAdapter` (`modules/storage-idb.js`) supporting persistent local vocabulary decks with automatic in-memory fallback for non-browser runtimes.
- Service worker background sync queue (`sw.js`, `modules/pwa.js`) enabling offline review queuing and automatic online synchronization.

#### 3. ⚡ Gemini 2.5 Flash API Resilience & Schema Fallback Parser (Nov 04)
- Exponential backoff retry handler with full randomized jitter (`api/gemini-resilience.js`), recovering gracefully from HTTP 429 and 503 transient errors.
- Schema fallback parser stripping markdown code fences, repairing trailing commas, and applying resilient vocabulary schema defaults.

#### 4. 🛡️ Server Security, Request Validation Middleware & Rate-Limit Telemetry (Oct 27, Nov 05)
- DOMPurify-based XSS sanitizer for AI output rendering (`modules/sanitizer.js`).
- Centralized request body validation middleware (`server.js`) enforcing strict type and length schemas across all API endpoints.
- RFC-compliant rate-limiting telemetry headers (`RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`) and hardened HTTP security headers.

#### 5. 📤 Multi-Format Export Suite (Oct 29)
- Anki cloze-deletion formatter (`{{c1::word::hint}}`) with custom dark CSS card templates (`modules/export-suite.js`).
- Notion and Quizlet-compatible Markdown table and TSV generators.

#### 6. 🎙️ Web Audio Studio & Phonetics Engine (Oct 30)
- Real-time Web Audio API frequency visualizer canvas with HiDPI display scaling (`modules/audio-studio.js`).
- Phonetic IPA syllable breakdown and primary/secondary stress indicators.

#### 7. ♿ Keyboard Shortcuts & Accessibility Suite (Nov 02)
- Comprehensive chord navigation (`g+h`, `g+s`, `g+l`, `g+p`, `g+c`) and hotkey mapping (`?`, `Ctrl+Shift+F`, etc.) via `modules/shortcuts.js`.
- Full keyboard operability for Quiz (`1-4`, `Enter`) and 3D Flashcards (`Space`, `1-4`, arrow keys).
- WCAG 2.1 AA ARIA live region announcer (`#a11yLiveAnnouncer`) and luminous `:focus-visible` focus rings.

#### 8. 🤖 CI/CD Automation, Sphinx Documentation & Quality Assurance (Nov 06, Nov 07)
- Multi-version Node.js matrix test workflow on GitHub Actions (`.github/workflows/ci.yml`).
- Automated security audit step (`npm audit --audit-level=high`).
- Comprehensive Sphinx 9.1 documentation suite (`docs/source/`) featuring architecture, SM-2 engine, and accessibility guides.
- Extensive unit and integration test expansion achieving 220+ passing tests with zero regressions.

---

### 📋 Complete 30-Commit Sprint Index

| # | Timestamp (+0530) | Type | Scope | Description | Affected Files |
|---|-------------------|------|-------|-------------|----------------|
| 1 | 2026-10-27T11:00:00+05:30 | `chore` | `git` | ignore playwright test artifacts and clean tracked test cache | `.gitignore`, `test-results/` |
| 2 | 2026-10-27T16:30:00+05:30 | `feat` | `security` | implement DOMPurify-based HTML and markdown sanitizer for AI outputs | `modules/sanitizer.js`, `main.js` |
| 3 | 2026-10-28T10:15:00+05:30 | `feat` | `srs` | implement SuperMemo SM-2 interval and ease-factor calculation engine | `modules/srs.js` |
| 4 | 2026-10-28T14:30:00+05:30 | `feat` | `srs` | add local review queue manager with due date tracking | `modules/srs.js` |
| 5 | 2026-10-28T18:00:00+05:30 | `test` | `srs` | add comprehensive unit test suite for SM-2 interval transitions | `tests/srs.test.js` |
| 6 | 2026-10-29T11:30:00+05:30 | `feat` | `export` | add Anki cloze-deletion and custom CSS deck export formatting | `modules/export-suite.js` |
| 7 | 2026-10-29T16:00:00+05:30 | `feat` | `export` | add Notion and Quizlet-compatible Markdown table generator | `modules/export-suite.js` |
| 8 | 2026-10-30T10:00:00+05:30 | `feat` | `audio` | add real-time Web Audio API frequency visualizer canvas | `modules/audio-studio.js` |
| 9 | 2026-10-30T14:15:00+05:30 | `feat` | `audio` | add phonetic IPA syllable breakdown and stress indicator | `modules/audio-studio.js` |
| 10 | 2026-10-30T17:45:00+05:30 | `test` | `audio` | add audio studio browser compatibility and fallback tests | `tests/audio.test.js` |
| 11 | 2026-11-01T11:00:00+05:30 | `feat` | `drill` | add dedicated Weak Words review queue with failure analytics | `modules/drill.js` |
| 12 | 2026-10-31T16:00:00+05:30 | `feat` | `ui` | add Drill Room interactive practice card component in Studio view | `modules/drill.js`, `index.html`, `styles.css` |
| 13 | 2026-11-01T10:30:00+05:30 | `feat` | `pwa` | implement IndexedDB storage adapter for offline vocabulary decks | `modules/storage-idb.js`, `modules/pwa.js` |
| 14 | 2026-11-01T14:30:00+05:30 | `feat` | `pwa` | add service worker background sync queue for offline study progress | `sw.js`, `modules/pwa.js` |
| 15 | 2026-11-01T18:00:00+05:30 | `test` | `pwa` | add unit tests for IndexedDB CRUD operations and offline fallbacks | `tests/pwa-idb.test.js` |
| 16 | 2026-11-02T11:00:00+05:30 | `feat` | `a11y` | add full keyboard shortcut mapping for Quiz and Flashcards | `modules/shortcuts.js`, `modules/quiz.js`, `modules/flashcards.js` |
| 17 | 2026-11-02T16:30:00+05:30 | `feat` | `a11y` | add ARIA live regions and high-contrast focus rings for screen readers | `index.html`, `styles.css` |
| 18 | 2026-11-03T10:15:00+05:30 | `feat` | `analytics` | add retention rate curve and daily learning velocity calculations | `modules/analytics.js` |
| 19 | 2026-11-03T14:30:00+05:30 | `feat` | `ui` | add interactive visual progress charts and retention breakdown card | `modules/analytics.js`, `styles.css` |
| 20 | 2026-11-03T18:00:00+05:30 | `test` | `analytics` | add unit tests for learning velocity and retention calculations | `tests/analytics.test.js` |
| 21 | 2026-11-04T10:30:00+05:30 | `feat` | `api` | add exponential backoff retry handler with jitter for Gemini API calls | `api/gemini-resilience.js` |
| 22 | 2026-11-04T14:45:00+05:30 | `feat` | `api` | add structured schema fallback parser for non-standard Gemini responses | `api/gemini-resilience.js`, `server.js` |
| 23 | 2026-11-04T18:15:00+05:30 | `test` | `api` | add mock unit tests for Gemini API retry mechanism and payload parsing | `tests/gemini-resilience.test.js` |
| 24 | 2026-11-05T11:00:00+05:30 | `feat` | `security` | implement strict request body validation middleware for all API routes | `server.js` |
| 25 | 2026-11-05T16:30:00+05:30 | `feat` | `security` | add security headers and rate-limit telemetry headers | `server.js` |
| 26 | 2026-11-06T11:00:00+05:30 | `test` | `unit` | add comprehensive unit tests for request validation middleware | `tests/validation.test.js` |
| 27 | 2026-11-06T16:30:00+05:30 | `test` | `integration` | add end-to-end integration tests for offline-to-online sync flow | `tests/offline-sync.test.js`, `server.js` |
| 28 | 2026-11-07T10:15:00+05:30 | `ci` | `ci` | add GitHub Actions workflow for automated test, lint, and security audit (.github/workflows/ci.yml) | `.github/workflows/ci.yml` |
| 29 | 2026-11-07T14:00:00+05:30 | `docs` | `docs` | update Sphinx documentation with architecture, SM-2 engine, and a11y guides | `docs/source/`, `docs/build/html/` |
| 30 | 2026-11-07T17:30:00+05:30 | `chore` | `release` | bump version to v1.2.0 and update CHANGELOG with Nov feature sprint | `package.json`, `CHANGELOG.md`, `docs/source/conf.py` |

---

## [1.1.0] — 2026-10-26 — Studio & Intelligence Upgrade
- Added Command Palette (`modules/palette.js`), Audio Pronunciation Studio (`modules/audio-studio.js`), 3D Flashcards SRS (`modules/flashcards.js`), RSVP Speed Reader (`modules/speed-reader.js`), Zen Focus Room (`modules/zen-focus.js`), Trophy gamification (`modules/trophies.js`), and CEFR Vocabulary Filter (`modules/vocab-indexer.js`).

## [1.0.0] — 2026-08-23 — Initial Release
- Core AI vocabulary learning application with Gemini 2.5 Flash, Firebase authentication, and Web Speech API.
