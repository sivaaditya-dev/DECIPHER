# Getting Started

This guide walks you through cloning **Decipher**, wiring up the required credentials, and running the app locally in under 5 minutes.

## Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Node.js | ≥ 18.x | LTS recommended |
| npm | ≥ 9.x | Bundled with Node |
| A Google Gemini API key | — | Free tier available |
| A Firebase project | — | Free Spark plan works |

---

## 1. Clone & Install

```bash
git clone https://github.com/your-username/decipher.git
cd decipher
npm install
```

---

## 2. Environment Variables

Create a `.env` file in the project root:

```text
GEMINI_API_KEY=your_gemini_api_key_here
PORT=3000
```

> **Where to get the Gemini key:** Visit [Google AI Studio](https://aistudio.google.com/) → *Get API Key*.

---

## 3. Firebase Setup

Decipher uses **Firebase Admin SDK** (server-side) and the **Firebase JS SDK** (client-side).

### 3a. Firebase Admin (Server)

1. Go to your [Firebase Console](https://console.firebase.google.com/) → Project Settings → Service Accounts.
2. Click **Generate new private key** — this downloads `serviceAccountKey.json`.
3. Place that file in the project root (it is already listed in `.gitignore` — **never commit it**).

### 3b. Firebase Client (Browser)

1. In the Firebase Console → Project Settings → General → Your apps → Web app.
2. Copy the config object and paste it into `firebase-config.js`:

```js
// firebase-config.js
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

### 3c. Enable Firestore & Auth

- **Firestore Database** — create it in *production* or *test* mode.
- **Authentication** — enable *Email/Password* and *Google* providers.

---

## 4. Run the App

```bash
npm start
# App is live at http://localhost:3000
```

Alternatively use `npm run dev` (alias for `node server.js`).

---

## 5. Verify It Works

1. Open `http://localhost:3000` in Chrome or Edge.
2. You should see the Decipher landing page with a looping video hero.
3. Navigate to **Studio**, paste any text, and click **Decipher It** — vocabulary cards should appear within a few seconds.

---

## Common Issues

| Problem | Fix |
|---------|-----|
| `serviceAccountKey.json` not found | Make sure the file is in the project root, not a subdirectory. |
| `GEMINI_API_KEY` error | Double-check your `.env` file is in the root and has no extra spaces. |
| Voice assistant not working | Use Chrome or Edge; allow microphone permissions. |
| PDF returns no text | The PDF may be a scanned image — use the OCR (camera) input instead. |
