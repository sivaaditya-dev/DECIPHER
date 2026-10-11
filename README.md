# Decipher AI — Vocabulary Learning Platform

A premium AI-powered vocabulary learning web application built with HTML, CSS, and vanilla JavaScript, backed by an Express.js server and the Google Gemini API.

## ✨ Features
- **AI Text Analysis** — paste any text and get instant vocabulary breakdowns, definitions, and usage examples
- **Voice Assistant** — multi-language speech recognition with acoustic feedback (Ctrl+Shift+V to activate)
- **Decipher AI Chat** — Lena-style floating chatbot with Markdown rendering, timestamps, and copy-to-clipboard
- **Smart Quiz** — SRS-powered flashcard quiz with animated score reveals and progress bars
- **Challenge Mode** — daily vocab challenges with streak tracking
- **Library** — save, filter, and search past sessions
- **Profile Dashboard** — view your learning stats with animated progress indicators
- **Multi-Language** — 100+ language support for both text analysis and voice input

## 🚀 Getting Started

`ash
npm install
npm run dev
`

Visit http://localhost:3000

## 🔑 Environment Variables

Create a .env file:
`
GEMINI_API_KEY=your_key_here
FIREBASE_SERVICE_ACCOUNT=your_firebase_json
`

## 📁 Project Structure
`
├── index.html         # Main SPA shell
├── styles.css         # Global design system
├── main.js            # Entry point + event orchestration
├── server.js          # Express API backend
└── modules/
    ├── api.js         # Gemini API wrappers
    ├── auth.js        # Firebase authentication
    ├── voice.js       # Web Speech API integration
    ├── audio.js       # Acoustic cue engine
    ├── quiz.js        # SRS quiz engine
    ├── challenge.js   # Daily challenge system
    ├── profile.js     # User profile management
    └── ui.js          # DOM rendering utilities
`

## 🛠️ Tech Stack
- **Frontend**: Vanilla HTML/CSS/JS (ES Modules)
- **Backend**: Node.js + Express.js
- **AI**: Google Gemini 2.0 Flash
- **Auth/DB**: Firebase Auth + Firestore
- **Deployment**: Vercel
