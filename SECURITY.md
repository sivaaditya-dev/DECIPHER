# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| main    | Yes       |

## Reporting a Vulnerability

**Please do NOT report security vulnerabilities through public GitHub issues.**

If you discover a security vulnerability in Decipher, please report it privately:

1. Open a [GitHub Security Advisory](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing/privately-reporting-a-security-vulnerability) in this repository.
2. Alternatively, email the maintainers directly (see GitHub profile for contact).

Please include:
- A description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We will acknowledge your report within 48 hours and aim to release a fix within 14 days.

---

## Known Considerations

- **Firebase client config** (`firebase-config.js`) contains API keys that are visible to the browser. This is standard practice for Firebase web apps — security is enforced through [Firebase Security Rules](https://firebase.google.com/docs/rules), not by hiding keys. Ensure your Firestore and Auth rules are properly configured.
- **`serviceAccountKey.json`** is a private key with admin access to your Firebase project. It must never be committed or exposed publicly.
- **Gemini API key** in `.env` should have usage limits set in [Google AI Studio](https://aistudio.google.com/) to prevent unexpected charges.
