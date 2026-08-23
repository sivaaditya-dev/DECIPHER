# Database Schema

Decipher uses **Cloud Firestore** (NoSQL) with the following top-level collections.

---

## `sessions`

Stores vocabulary learning sessions saved by users from the Library panel.

**Document ID:** Auto-generated Firestore ID.

| Field | Type | Description |
|-------|------|-------------|
| `userId` | string | Firebase UID of the session owner. |
| `snippet` | string | First ~200 characters of the analyzed passage. |
| `words` | array | Array of vocab objects `{term, def, syn, context}`. |
| `createdAt` | Timestamp | Server-side Firestore timestamp. |

**Security:** Queries are always filtered by `where('userId', '==', uid)` — users cannot access each other's sessions.

---

## `userProfiles`

Stores optional user preferences. Document ID is the Firebase UID.

| Field | Type | Description |
|-------|------|-------------|
| `displayName` | string | Custom display name. |
| `avatarId` | string | Selected avatar identifier. |
| `voiceId` | string | Preferred Web Speech TTS voice name. |

Written with `{ merge: true }` — partial updates are safe.

---

## `dailyWords`

Caches the Gemini-generated daily challenge word. Document ID is the date string `YYYY-MM-DD`.

| Field | Type | Description |
|-------|------|-------------|
| `word` | string | The vocabulary word. |
| `phonetic` | string | IPA pronunciation. |
| `partOfSpeech` | string | `noun`, `verb`, `adjective`, etc. |
| `definition` | string | One-sentence definition. |
| `wrongChoices` | array | 3 plausible but incorrect definitions. |
| `sentence` | string | Fill-in-the-blank sentence (uses `___`). |
| `date` | string | `YYYY-MM-DD` |
| `generatedAt` | string | ISO timestamp of generation. |

The first request of the day generates and caches the word; subsequent requests return the cached document.

---

## `challengeUsers`

Tracks each user's overall challenge statistics. Document ID is Firebase UID.

| Field | Type | Description |
|-------|------|-------------|
| `totalCorrect` | number | Cumulative correct answers across all challenges. |
| `currentStreak` | number | Consecutive days played. |
| `longestStreak` | number | All-time best streak. |
| `rankPoints` | number | Points used to calculate rank tier. |
| `rankResetDate` | string | ISO date of last 6-month rank decay. |
| `lastPlayedDate` | string | `YYYY-MM-DD` of last challenge played. |
| `weeklyScore` | number | Points scored in the current week. |
| `weeklyResetDate` | string | Current week key `YYYY-Www`. |
| `displayName` | string | Copied from Firebase token for leaderboard display. |
| `photoURL` | string | Profile photo URL from Firebase. |

---

## `challengeLeaderboard`

Global all-time leaderboard. Document ID is Firebase UID.

| Field | Type | Description |
|-------|------|-------------|
| `displayName` | string | User's display name. |
| `photoURL` | string | Profile photo URL. |
| `totalCorrect` | number | Total correct answers. |
| `currentStreak` | number | Current daily streak. |
| `rankPoints` | number | Rank score. |

Indexed and ordered by `totalCorrect DESC`. Top 10 are fetched.

---

## `challengeWeekly/{weekKey}/entries`

Weekly leaderboard entries. `weekKey` format: `2026-W34`.

| Field | Type | Description |
|-------|------|-------------|
| `displayName` | string | User's display name. |
| `photoURL` | string | Profile photo URL. |
| `weeklyScore` | number | Points scored this week. |

Ordered by `weeklyScore DESC`. Top 10 are fetched.
