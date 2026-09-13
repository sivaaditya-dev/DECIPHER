# Contributing to Decipher

Thank you for taking the time to contribute! Decipher is an open-source AI vocabulary tool. Every bug fix, feature, and doc improvement counts.

**Live site:** [https://decipher-zeta.vercel.app](https://decipher-zeta.vercel.app)
**GitHub:** [https://github.com/sivaaditya-dev/DECIPHER](https://github.com/sivaaditya-dev/DECIPHER)

---

## Local Setup

### 1. Fork & Clone
```bash
git clone https://github.com/YOUR_USERNAME/DECIPHER.git
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

Open `.env` and fill in your own keys:

| Variable | Where to get it |
|---|---|
| `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/app/apikey) (free) |
| `FIREBASE_SERVICE_ACCOUNT` | Firebase Console > Project Settings > Service accounts > Generate key (paste the entire JSON content) |
| `FIREBASE_API_KEY` | Firebase Console > Project Settings > Your apps > Web app config |
| `FIREBASE_AUTH_DOMAIN` | Same as above |
| `FIREBASE_PROJECT_ID` | Same as above |
| `FIREBASE_STORAGE_BUCKET` | Same as above |
| `FIREBASE_MESSAGING_SENDER_ID` | Same as above |
| `FIREBASE_APP_ID` | Same as above |

### 4. Start local dev server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Making Changes

- All frontend code is in `index.html`, `main.js`, `styles.css`, and the `modules/` folder.
- All backend API routes are in `server.js`.
- `api/index.js` is the Vercel serverless entry point — do not remove it.
- Never commit `serviceAccountKey.json` or `.env` (both are in `.gitignore`).
- Never commit `firebase-config.js` — it is gitignored. The server generates it at `/api/firebase-config` from env vars.

---

## Submitting a PR

1. Create a feature branch: `git checkout -b feat/your-feature`
2. Make your changes and test locally
3. Commit with a clear message: `git commit -m "Feat: describe what you did"`
4. Push and open a Pull Request on GitHub

**PR checklist:**
- [ ] App starts without errors (`npm run dev`)
- [ ] No API keys or secrets are committed
- [ ] Changes are scoped and focused (one feature or fix per PR)
- [ ] Commit messages are clear and descriptive

---

## Reporting Bugs

Open a [GitHub Issue](https://github.com/sivaaditya-dev/DECIPHER/issues) with:
- Steps to reproduce
- Expected vs actual behaviour
- Browser/OS if it's a frontend issue

---

## Questions?

Open a discussion on [GitHub](https://github.com/sivaaditya-dev/DECIPHER/discussions) or tag the issue with `question`.