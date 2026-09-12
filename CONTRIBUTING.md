# Contributing to Decipher

Thank you for your interest in contributing! This guide will help you get set up.

---

## Local Setup

1. Fork the repo and clone it:
   ```bash
   git clone https://github.com/YOUR_USERNAME/decipher.git
   cd decipher
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy and configure secrets:
   ```bash
   cp .env.example .env
   cp firebase-config.example.js firebase-config.js
   ```
   Fill in your own API keys. See README.md for detailed instructions.

4. Start the development server:
   ```bash
   npm run dev
   ```

---

## Security Rules

> **NEVER commit these files:**
> - `.env`
> - `firebase-config.js`
> - `serviceAccountKey.json`
>
> All three are in `.gitignore`. If you accidentally commit a secret, rotate the key immediately.

---

## Making Changes

- **One feature per PR.** Keep pull requests focused and small.
- **Branch naming:** `feat/your-feature`, `fix/bug-description`, `docs/what-you-updated`
- **Commit messages:** Use imperative mood: "Add export button" not "Added export button"
- **Test your changes:** Run `npm test` before submitting.

---

## Pull Request Checklist

- [ ] I have tested my changes locally
- [ ] No secrets are included in my commit
- [ ] My code follows the existing style (vanilla JS, no extra frameworks)
- [ ] I have updated the README if I added a new feature

---

## Reporting Bugs

Use the [Bug Report](.github/ISSUE_TEMPLATE/bug_report.md) issue template.

For **security vulnerabilities**, please read [SECURITY.md](SECURITY.md) first — do NOT open a public issue.
