# REST API Reference

The backend exposes a JSON REST API at `/api`. All AI-powered endpoints call **Google Gemini 2.5 Flash**. Protected endpoints require a Firebase ID token.

---

## Authentication

Protected routes must include an `Authorization` header:

```
Authorization: Bearer <Firebase ID Token>
```

The server validates it via `admin.auth().verifyIdToken()`. On failure it returns `403 Forbidden`.

---

## Vocabulary Analysis

### `POST /api/analyze`

Extracts complex vocabulary from a block of text using Gemini AI.

**Request Body**

```json
{
  "text": "Your passage or article text here...",
  "theme": "Science"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `text` | string | ✅ | The passage to analyze. Minimum 20 characters. |
| `theme` | string | ❌ | Domain hint (e.g. `"Law"`, `"Medicine"`, `"General"`). Steers Gemini's definitions. |

**Response** `200 OK`

```json
[
  {
    "term": "ephemeral",
    "def": "Lasting for a very short time.",
    "syn": "transient",
    "context": "These ephemeral connections shaped the city's culture."
  }
]
```

Up to 25 words are returned.

---

## Document Extraction

### `POST /api/extract-pdf`

Extracts text from an uploaded **PDF** or **DOCX** file (max 100 MB).

**Request** — `multipart/form-data`

| Field | Type | Description |
|-------|------|-------------|
| `document` | File | A `.pdf` or `.docx` file. |

**Response** `200 OK`

```json
{
  "text": "Extracted text (up to 20,000 characters)...",
  "pageCount": 12,
  "fileName": "my-article.pdf",
  "truncated": false
}
```

---

## Image OCR

### `POST /api/ocr`

Uses Gemini Vision to extract all readable text from an uploaded image (max 20 MB).

**Request** — `multipart/form-data`

| Field | Type | Description |
|-------|------|-------------|
| `image` | File | Any common image format (JPEG, PNG, WebP…). |

**Response** `200 OK`

```json
{ "text": "All text found in the image..." }
```

---

## YouTube Transcript

### `POST /api/youtube-transcript`

Fetches the English caption transcript from a YouTube video URL.

**Request Body**

```json
{ "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }
```

**Response** `200 OK`

```json
{
  "text": "Full transcript text (up to 20,000 characters)...",
  "wordCount": 3241
}
```

---

## Translation

### `POST /api/translate`

Translates a vocabulary list into any of 51 supported languages. Also detects **cultural notes** and **mirror words** (false friends).

**Request Body**

```json
{
  "vocabList": [
    { "term": "ephemeral", "def": "...", "context": "..." }
  ],
  "targetLang": "Tamil"
}
```

**Response** `200 OK`

```json
[
  {
    "term": "ephemeral",
    "translatedDef": "மிகவும் குறுகிய காலம் நீடிக்கும்.",
    "translatedContext": "இந்த நொடிப்பொழுது தொடர்புகள்...",
    "culturalNote": "Tamil literature often uses the metaphor of morning dew for ephemeral things.",
    "mirrorWord": {
      "nativeWord": "",
      "nativeMeaning": "",
      "alert": ""
    }
  }
]
```

---

## Memory Hooks (Mnemonics)

### `POST /api/mnemonic`

Generates vivid, memorable mnemonics for each vocabulary word.

**Request Body**

```json
{
  "vocabList": [{ "term": "gregarious", "def": "Fond of company; sociable." }]
}
```

**Response** `200 OK`

```json
[{ "term": "gregarious", "mnemonic": "Think of GREG who's always HILARIOUS at parties..." }]
```

---

## Passage Simplifier

### `POST /api/simplify`

Rewrites a passage into simpler language.

**Request Body**

```json
{
  "text": "The phenomenon of quantum entanglement...",
  "level": "eli5"
}
```

| `level` | Description |
|---------|-------------|
| `"plain"` | Clear B1–B2 English, removes jargon. |
| `"eli5"` | Explain Like I'm 5 — very simple, fun analogies. |

**Response** `200 OK`

```json
{ "simplified": "Imagine two magic coins...", "level": "eli5" }
```

---

## Opposite Day

### `POST /api/opposite-day`

Rewrites a passage by replacing key vocabulary with their antonyms — subtly absurd.

**Request Body**

```json
{
  "text": "The brave knight stormed the fortress.",
  "vocabList": [{ "term": "brave" }, { "term": "stormed" }]
}
```

**Response** `200 OK`

```json
{ "opposite": "The cowardly knight tiptoed past the sandbox." }
```

---

## Story Generation

### `POST /api/story`

Generates a short paragraph that weaves all vocabulary words into a coherent narrative.

**Request Body**

```json
{ "words": ["ephemeral", "gregarious", "tenacious"] }
```

**Response** `200 OK`

```json
{ "story": "Despite the ephemeral nature of fame, the gregarious singer remained tenacious..." }
```

---

## SRS Quiz Questions

### `POST /api/srs-questions`

Generates AI-written fill-in-the-blank sentences for Spaced Repetition quizzes.

**Request Body**

```json
{
  "vocabList": [{ "term": "proliferate", "def": "Increase rapidly in number." }]
}
```

**Response** `200 OK`

```json
[{ "term": "proliferate", "sentence": "Social media platforms continue to ___ at an astonishing rate." }]
```

---

## Socratic Tutor Chat

### `POST /api/chat`

Multi-turn conversational AI tutor. Understands navigation intents and answers vocabulary questions.

**Request Body**

```json
{
  "messages": [
    { "role": "user", "content": "What does ephemeral mean in this context?" }
  ],
  "passage": "The ephemeral beauty of cherry blossoms...",
  "vocabList": [{ "term": "ephemeral", "def": "..." }]
}
```

**Response** `200 OK`

```json
{ "reply": "Great question! In this passage, ephemeral describes how briefly cherry blossoms bloom..." }
```

Action tags (e.g. `[ACTION:navQuiz]`) may be prepended to the reply to trigger UI navigation.

---

## User Library (Sessions)

All library endpoints require authentication.

### `POST /api/history` 🔒

Save the current session.

**Body:** `{ "snippet": "...", "words": [...] }`  
**Response:** `{ "success": true, "id": "firestoreDocId" }`

---

### `GET /api/history` 🔒

Fetch the current user's 20 most recent sessions (sorted by date, newest first).

**Response:** Array of session objects `{ id, date, snippet, words }`.

---

### `GET /api/history/:id` 🔒

Fetch a specific session by Firestore document ID.

---

### `DELETE /api/history` 🔒

Delete **all** sessions belonging to the current user.

---

## User Profile

### `GET /api/profile` 🔒

Fetch the user's saved preferences (`displayName`, `avatarId`, `voiceId`).

### `POST /api/profile` 🔒

Save/update profile preferences (partial updates supported via merge).

**Allowed fields:** `displayName`, `avatarId`, `voiceId`.

---

## Daily Word Challenge

### `GET /api/daily-word`

Returns today's daily vocabulary challenge word (shared by all users, cached in Firestore).

**Response**

```json
{
  "word": "perspicacious",
  "phonetic": "/ˌpɜːr.spɪˈkeɪ.ʃəs/",
  "partOfSpeech": "adjective",
  "definition": "Having a ready insight into things; shrewd.",
  "wrongChoices": ["extremely talkative", "easily frightened", "showing great generosity"],
  "sentence": "The ___ detective immediately noticed the discrepancy in the alibi.",
  "date": "2026-08-23"
}
```

---

### `POST /api/challenge/submit` 🔒

Record a user's challenge attempt. Handles streak tracking, rank points, and weekly score updates.

**Body:** `{ "mcqCorrect": true, "sentenceCorrect": false, "date": "2026-08-23" }`

**Response:** Updated user stats object.

---

### `GET /api/challenge/leaderboard`

Fetch the top-10 leaderboard.

**Query param:** `?type=global` (default) or `?type=weekly`.

---

### `GET /api/challenge/me` 🔒

Fetch the current user's personal challenge stats (streak, rank points, total correct).
