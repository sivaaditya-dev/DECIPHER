# Architecture

This page explains how Decipher's frontend, backend, and external services are wired together.

---

## High-Level Overview

```
┌─────────────────────────────────────────────────────┐
│                    Browser (Client)                  │
│                                                      │
│  index.html  ──►  main.js  ──►  /modules/*.js        │
│                                                      │
│   auth.js  quiz.js  api.js  voice.js  galaxy.js      │
│   languages.js  profile.js  challenge.js  toast.js  │
└─────────────────────────────┬───────────────────────┘
                              │  HTTP / REST
                              ▼
┌─────────────────────────────────────────────────────┐
│               Node.js + Express Server               │
│                   (server.js)                        │
│                                                      │
│   /api/analyze      /api/translate   /api/mnemonic   │
│   /api/simplify     /api/story       /api/ocr        │
│   /api/chat         /api/srs-questions               │
│   /api/youtube-transcript            /api/history    │
│   /api/profile      /api/daily-word  /api/challenge  │
└────────────┬─────────────────────────┬──────────────┘
             │                         │
             ▼                         ▼
  ┌──────────────────┐     ┌─────────────────────────┐
  │  Google Gemini   │     │   Firebase Admin SDK     │
  │  2.5 Flash API   │     │                         │
  │  (AI reasoning)  │     │  Firestore (database)   │
  └──────────────────┘     │  Auth (token verify)    │
                           └─────────────────────────┘
```

---

## Frontend Layer

### `index.html`
The single HTML file that contains every view (Studio, Quiz, Library, About, landing). Each view is a `<section>` that is shown/hidden via `main.js`'s navigation system.

### `main.js`
The application's entry point and orchestrator (~1700 lines). Responsibilities:
- Bootstrapping all modules on `DOMContentLoaded`.
- Implementing the `decipherNav()` navigation state machine.
- Coordinating between modules (e.g., passing vocab list from `api.js` to `quiz.js`).
- Managing global UI state (active theme, active view, sidebar panels).

### `modules/`
Each file is a focused ES Module with a clear single responsibility:

| Module | Responsibility |
|--------|---------------|
| `api.js` | All `fetch()` calls to the backend. Never used by modules other than through this file. |
| `auth.js` | Firebase Authentication — modal UI, sign-in, sign-up, sign-out. |
| `quiz.js` | Quiz logic for Standard, Reverse, and SRS modes. |
| `voice.js` | Web Speech API integration — voice command parsing and TTS. |
| `galaxy.js` | 3D particle / galaxy canvas animation on the landing page. |
| `languages.js` | Translation panel UI and 51-language selector. |
| `profile.js` | User profile modal, avatar selection, display name management. |
| `challenge.js` | Daily Word Challenge UI, leaderboard rendering, streak tracking. |
| `spidey.js` | Spidey-sense animation triggered on quiz answer events. |
| `samples.js` | Bundled sample texts for 20+ domains (science, literature, law…). |
| `toast.js` | Lightweight toast notification utility. |
| `ui.js` | Shared UI helpers (scroll effects, theme switching, nav toggles). |

---

## Backend Layer

### `server.js`
A single Express.js file (~800 lines) that:
- Configures middleware (CORS, JSON body parser, Multer).
- Initialises Firebase Admin SDK.
- Defines all REST API routes (see [API Reference](api-reference)).
- Runs on `PORT` (default 3000) and serves the static frontend files.

### AI Integration
Every AI call uses the `@google/genai` SDK:
```js
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', ... });
```
Structured JSON responses are enforced via `responseMimeType` and `responseSchema` to guarantee predictable, parseable output.

---

## External Services

| Service | Used For |
|---------|----------|
| **Google Gemini 2.5 Flash** | Vocabulary extraction, translation, mnemonics, story generation, OCR, simplification, SRS questions, Tutor chat, daily word generation |
| **Firebase Firestore** | Persisting user sessions (library), daily word cache, challenge leaderboard, user challenge stats, user profiles |
| **Firebase Authentication** | Identity (Google OAuth + Email/Password). JWTs verified server-side on protected routes. |
| **Web Speech API** | Voice command recognition (client-side, no API key). |

---

## Security Model

- All endpoints that read/write user-specific data require a **Firebase ID token** in the `Authorization: Bearer <token>` header.
- The `verifyToken` middleware decodes and validates the JWT using `admin.auth().verifyIdToken()`.
- Users can only read and delete **their own** Firestore documents (enforced in query filters: `where('userId', '==', uid)`).
- `serviceAccountKey.json` and `.env` are listed in `.gitignore` and must **never be committed**.
