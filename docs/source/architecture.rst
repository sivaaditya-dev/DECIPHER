Architecture & System Design
=============================

This document provides a comprehensive overview of DECIPHER's multi-tier architecture, client engines, resilience handlers, and server-side middleware.

System Topology
---------------

.. code-block:: text

   ┌────────────────────────────────────────────────────────────────────────┐
   │                       Browser Client (SPA & PWA)                       │
   │                                                                        │
   │   index.html  ──►  main.js  ──►  modules/                             │
   │                                                                        │
   │   [Learning & Retention]      [Studio & Media]       [Persistence]     │
   │    • srs.js (SM-2 Engine)      • audio-studio.js      • storage-idb.js │
   │    • drill.js (Weak Words)     • export-suite.js      • pwa.js / sw.js │
   │    • analytics.js (Curves)     • shortcuts.js (a11y)  • sanitizer.js   │
   └───────────────────────────────────┬────────────────────────────────────┘
                                       │ HTTPS / JSON REST
                                       ▼
   ┌────────────────────────────────────────────────────────────────────────┐
   │                        Express Server (server.js)                      │
   │                                                                        │
   │   [Middleware & Security]     [Resilience Engine]    [API Endpoints]   │
   │    • validateRequestBody       • api/gemini-          • /api/analyze    │
   │    • RateLimit-* Headers         resilience.js        • /api/quiz       │
   │    • Helmet & Hardened CORS    • Exponential Backoff  • /api/sync/batch │
   └────────────────────┬──────────────────────────────────┬────────────────┘
                        │                                  │
                        ▼                                  ▼
             ┌─────────────────────┐            ┌─────────────────────┐
             │ Google Gemini API   │            │ Firebase Cloud      │
             │ (gemini-2.5-flash)  │            │ (Firestore & Auth)  │
             └─────────────────────┘            └─────────────────────┘

Core Architectural Tiers
------------------------

1. Client Presentation Tier
~~~~~~~~~~~~~~~~~~~~~~~~~~~
* **Single Page Shell (`index.html`)**: Fully modular section-based layout for Studio, Quiz, Flashcards, Drill Room, Library, and Profile.
* **Master Orchestrator (`main.js`)**: Coordinates state transitions, navigation dispatch (`decipherNav`), and view lifecycles.
* **Design System (`styles.css`)**: Glassmorphism aesthetic, fluid responsive typography, and high-contrast accessible `:focus-visible` states.

2. Modular Client Engines (`modules/`)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
* **SuperMemo SM-2 Spaced Repetition (`modules/srs.js`)**: Calculates intervals, ease factors, repetition counts, and due dates.
* **Weak Words Drill Room (`modules/drill.js`)**: Mistake taxonomy classifier (typo, near-miss, semantic confusion) with practice card UI.
* **Retention Analytics (`modules/analytics.js`)**: Computes exponential Ebbinghaus memory retention ($R = e^{-t/S}$) and rolling 7-day velocity.
* **Media & Audio Studio (`modules/audio-studio.js`)**: Web Audio API frequency visualizer with real-time waveform canvas and IPA syllable parser.
* **Multi-Format Export Suite (`modules/export-suite.js`)**: Formats vocabulary for Anki cloze-deletion (with dark CSS), Notion, and Quizlet.
* **Unified Shortcuts & Accessibility (`modules/shortcuts.js`)**: Chord navigation (`g+h`, `g+s`, etc.), quiz/flashcard controls, and ARIA live announcements.
* **Offline IndexedDB Adapter (`modules/storage-idb.js`)**: Structured browser storage for offline vocabulary decks with in-memory fallback.
* **Service Worker Sync (`sw.js`, `modules/pwa.js`)**: Background sync queue for study progress and offline-first asset caching.
* **Security & Sanitization (`modules/sanitizer.js`)**: Strict DOMPurify-based whitelist for AI HTML and markdown output.

3. Server Middleware & API Resilience
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
* **Request Validation Middleware (`server.js`)**: Declarative schema validator enforcing type and length constraints before route execution.
* **Rate-Limit Telemetry Headers**: Standard RFC-compliant `RateLimit-Limit`, `RateLimit-Remaining`, and `RateLimit-Reset` headers.
* **Gemini API Resilience (`api/gemini-resilience.js`)**: Exponential backoff retry handler with full jitter and schema fallback parser.
* **Offline-to-Online Batch Sync (`/api/sync/batch`)**: Processes queued offline reviews and reconciles SRS parameters.
