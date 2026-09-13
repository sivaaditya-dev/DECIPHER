# Decipher

> **Upload any text, PDF, image, or YouTube video. AI extracts vocabulary, translates it, and trains you until every word sticks.**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-decipher--zeta.vercel.app-E8182A?style=flat-square&logo=vercel&logoColor=white)](https://decipher-zeta.vercel.app)
[![MIT License](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Gemini AI](https://img.shields.io/badge/Gemini_2.5_Flash-4285F4?style=flat-square&logo=google&logoColor=white)](https://ai.google.dev/)
[![Firebase](https://img.shields.io/badge/Firebase-FF6F00?style=flat-square&logo=firebase&logoColor=white)](https://firebase.google.com/)
[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-000?style=flat-square&logo=vercel)](https://vercel.com)

---

## Live Demo

**[https://decipher-zeta.vercel.app](https://decipher-zeta.vercel.app)**

No installation needed. Try it directly in your browser.

---

## Features

| Feature | Description |
|---|---|
| **Any Input** | Paste text, upload PDFs/DOCXs, snap a photo (OCR), or paste a YouTube link |
| **Deep AI Analysis** | Extracts complex words with definitions, synonyms, and context |
| **200+ Language Translation** | Translates words, highlights cultural nuances, detects cognates |
| **3 Quiz Modes** | Standard, Reverse, and AI-generated Fill-in-the-blank |
| **Memory Hooks** | AI-generated mnemonics and vocabulary stories |
| **Pronunciation Coach** | Speak into mic and get scored on native-speaker accuracy |
| **Decipher Tutor** | Slide-out AI chat to ask questions about your passage |
| **ELI5 Simplifier** | Rewrite any text in plain English in one click |
| **Opposite Day** | Flip every word to its antonym for deeper semantic understanding |
| **Cloud Library** | Save and revisit past vocabulary sessions (requires Google sign-in) |

---

## Getting Started (Local Development)

### Prerequisites
- Node.js 18+
- Google Gemini API Key (free): https://aistudio.google.com/app/apikey
- Firebase Project (free tier): https://console.firebase.google.com/

### 1. Clone
```bash
git clone https://github.com/sivaaditya-dev/DECIPHER.git
cd DECIPHER
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment variables
```bash
cp .env.example .env
```
Open `.env` and fill in:
- `GEMINI_API_KEY` — your Google Gemini API key
- `FIREBASE_SERVICE_ACCOUNT` — your Firebase Admin SDK service account JSON (for the server)
- `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, etc. — your Firebase client config

### 4. Start the development server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Deploying to Vercel

Decipher is deployed and running at [decipher-zeta.vercel.app](https://decipher-zeta.vercel.app).

To deploy your own fork:

1. Fork this repo and import it into [Vercel](https://vercel.com)
2. Set Framework Preset to **Other** in Vercel project settings
3. Add all environment variables from `.env.example` in Vercel Dashboard → Settings → Environment Variables
4. For `FIREBASE_SERVICE_ACCOUNT`, paste the **entire JSON content** of your `serviceAccountKey.json`
5. Deploy — Vercel will auto-deploy on every push to `main`

---

## Project Structure

```
DECIPHER/
├── index.html          # Single-page app shell
├── main.js             # Frontend entry point
├── styles.css          # All styles
├── server.js           # Express backend + all API routes
├── modules/            # Frontend JS modules
│   ├── auth.js         # Firebase authentication
│   ├── api.js          # API call helpers
│   ├── quiz.js         # Quiz logic
│   ├── profile.js      # User profile + galaxy map
│   └── ...
├── api/
│   └── index.js        # Vercel serverless entry point
├── assets/             # Static assets (favicon, etc.)
├── vercel.json         # Vercel routing config
├── .env.example        # Environment variable template
└── CONTRIBUTING.md     # Contribution guide
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| AI Engine | Google Gemini 2.5 Flash |
| Auth & Database | Firebase Auth + Firestore |
| Backend | Node.js + Express.js |
| Deployment | Vercel (serverless) |
| PDF Parsing | pdf-parse + Mammoth |
| OCR | Tesseract.js via Gemini Vision |

---

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide.

Quick start: fork → clone → set up `.env` → `npm run dev` → make changes → open a PR.

---

## Security

Found a vulnerability? Please read [SECURITY.md](SECURITY.md) before opening a public issue.

---

## License

[MIT License](LICENSE) &mdash; free to use, fork, and build on.