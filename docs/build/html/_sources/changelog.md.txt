# Changelog

All notable changes to Decipher are documented here.

---

## [1.0.0] — 2026-08-23

### 🎉 Initial Open Source Release

**Core Features**
- AI vocabulary extraction from free text (Gemini 2.5 Flash, up to 25 words).
- PDF / DOCX document upload with text extraction.
- Image OCR via Gemini Vision.
- YouTube video transcript extraction.
- Contextual translation into 51 languages with cultural notes and mirror word detection.
- Memory hook (mnemonic) generation.
- Vocabulary story generation.
- Passage simplifier — Plain English and ELI5 modes.
- Opposite Day — antonym passage rewrite.
- Three quiz modes: Standard, Reverse, SRS (fill-in-the-blank).

**AI Tutor**
- Socratic Tutor chat panel with conversation history.
- Action tags for in-chat navigation (`[ACTION:navQuiz]`, etc.).
- Multi-language intent recognition.

**Voice Assistant**
- Web Speech API integration (no API key required).
- Multi-step chained commands.
- Language extraction for translate commands.
- TTS confirmation feedback.

**Authentication & Cloud**
- Firebase Auth — Google OAuth and Email/Password.
- Firestore Cloud Library — save and resume sessions.
- User profile (display name, avatar, voice preference).
- Password reset via email.

**Daily Word Challenge**
- Daily AI-generated vocabulary challenge (shared globally).
- MCQ + fill-in-the-blank questions.
- Streak tracking, rank system with 6-month decay.
- Global and weekly leaderboards.

**Design**
- Three premium themes: Cyber Dark, Sakura Light, Matte Red.
- Glassmorphism UI cards.
- Interactive galaxy particle animation.
- Spidey-sense quiz feedback animation.
- Full-screen video hero background.
- Responsive layout (mobile + desktop).
