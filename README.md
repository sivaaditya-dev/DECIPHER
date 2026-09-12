# Decipher

> **Upload any text, PDF, image, or YouTube video. AI extracts vocabulary, translates it, and trains you until every word sticks.**

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Gemini AI](https://img.shields.io/badge/Gemini_2.5-4285F4?logo=google&logoColor=white)](https://ai.google.dev/)
[![Firebase](https://img.shields.io/badge/Firebase-FF6F00?logo=firebase&logoColor=white)](https://firebase.google.com/)

---

## Features

| Feature | Description |
|---|---|
| **Any Input** | Paste text, upload PDFs/DOCXs, snap a photo (OCR), or paste a YouTube link |
| **Deep AI Analysis** | Extracts complex words with definitions, synonyms, and context |
| **211-Language Translation** | Translates words, highlights cultural nuances, detects cognates |
| **3 Quiz Modes** | Standard, Reverse, and AI-generated Fill-in-the-blank |
| **Memory Hooks** | AI-generated mnemonics and vocabulary stories |
| **Pronunciation Coach** | Speak into mic and get scored on native-speaker accuracy |
| **Socratic AI Tutor** | Slide-out chat to ask questions about your passage |
| **Daily Challenges** | Ranked system (Iron to Word Master) with leaderboard |
| **Profile & Galaxy Word Map** | Activity heatmap, mastered words wall, 3D vocabulary star field |
| **Voice Assistant** | Control every feature hands-free by voice |

---

## Getting Started

### Prerequisites
- Node.js 18+
- Google Gemini API Key (free): https://aistudio.google.com/app/apikey
- Firebase Project (free tier): https://console.firebase.google.com/

### 1. Clone
```bash
git clone https://github.com/YOUR_USERNAME/decipher.git
cd decipher
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment variables
```bash
cp .env.example .env
```
Edit `.env` and add your Gemini API Key:
```
GEMINI_API_KEY=your_key_here
APP_URL=http://localhost:3000
```

### 4. Configure Firebase
```bash
cp firebase-config.example.js firebase-config.js
```
Fill in your Firebase credentials from the Firebase Console (Project Settings > General > Your apps > Web app).

For the server-side Firebase Admin SDK:
1. Firebase Console > Project Settings > Service Accounts
2. Click "Generate new private key"
3. Save the file as `serviceAccountKey.json` in the project root

> IMPORTANT: Never commit firebase-config.js, serviceAccountKey.json, or .env — they are in .gitignore.

### 5. Run
```bash
npm start
```
Open http://localhost:3000

---

## Project Structure

```
decipher/
├── modules/           # Frontend JS modules
├── assets/            # Static assets
├── tests/             # Automated tests
├── .github/           # GitHub issue/PR templates
├── server.js          # Express backend
├── main.js            # Frontend entry point
├── index.html         # App shell
├── styles.css         # All styles
├── firebase-config.example.js
├── .env.example
└── package.json
```

---

## Security

Never commit: `.env`, `firebase-config.js`, `serviceAccountKey.json`

See [SECURITY.md](SECURITY.md) for vulnerability reporting.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## License

[MIT License](LICENSE)
