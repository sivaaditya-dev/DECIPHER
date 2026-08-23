# `api.js` — Backend Communication Layer

**File:** `modules/api.js`

Centralizes every `fetch()` call to the Express server. No other module makes raw HTTP requests — they all go through this module. This keeps networking logic in one place and makes it easy to swap the base URL or add global error handling.

---

## Constants

### `API_BASE`
```js
export const API_BASE = '/api';
```
Base path prepended to every request. Change this if you deploy the backend to a different origin.

---

## Auth Header Management

### `setAuth(authInstance)`
Stores the Firebase `auth` object so that `getAuthHeaders()` can obtain fresh ID tokens.

```js
setAuth(auth); // called once during app init
```

### `getAuthHeaders()`
Returns an object of HTTP headers suitable for authenticated requests.

```js
const headers = await getAuthHeaders();
// { Authorization: 'Bearer eyJ...', 'Content-Type': 'application/json' }
```

If no user is signed in, returns only `{ 'Content-Type': 'application/json' }`.  
On token error, signs the user out and returns `null`.

---

## AI Functions

### `analyzeText(text, theme)`

Sends text to `/api/analyze` and returns an array of vocabulary objects.

| Param | Type | Description |
|-------|------|-------------|
| `text` | string | The passage to analyze. |
| `theme` | string | Optional domain hint. |

**Returns:** `Promise<Array<{term, def, syn, context}>>`

---

### `translateVocabList(vocabList, targetLang)`

Sends the vocab array to `/api/translate`.

| Param | Type | Description |
|-------|------|-------------|
| `vocabList` | Array | `[{term, def, syn, context}]` |
| `targetLang` | string | Full language name, e.g. `"Tamil"` |

**Returns:** `Promise<Array<{term, translatedDef, translatedContext, culturalNote, mirrorWord}>>`

---

### `generateStory(words)`

**Param:** `words` — `string[]`  
**Returns:** `Promise<{story: string}>`

---

### `generateMnemonics(vocabList)`

**Param:** `vocabList` — `[{term, def}]`  
**Returns:** `Promise<Array<{term, mnemonic}>>`

---

### `simplifyPassage(text, level)`

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `text` | string | — | Passage to simplify |
| `level` | `'plain'` \| `'eli5'` | `'plain'` | Simplification depth |

**Returns:** `Promise<{simplified: string, level: string}>`

---

### `generateSRSQuestions(vocabList)`

**Param:** `vocabList` — `[{term, def}]`  
**Returns:** `Promise<Array<{term, sentence}>>`

---

### `generateOppositeDay(text, vocabList)`

**Params:** `text` (string), `vocabList` (array)  
**Returns:** `Promise<{opposite: string}>`

---

### `sendChatMessage(messages, passage, vocabList)`

Sends a multi-turn chat history to the Socratic Tutor endpoint.

**Returns:** `Promise<{reply: string}>`

---

## File / Media Functions

### `extractPdfText(file)`

**Param:** `file` — a browser `File` object (PDF or DOCX)  
**Returns:** `Promise<{text, pageCount, fileName, truncated}>`

### `extractImageText(imageFile)`

**Param:** `imageFile` — a browser `File` object (any image)  
**Returns:** `Promise<{text: string}>`

### `fetchYouTubeTranscript(url)`

**Param:** `url` — YouTube video URL  
**Returns:** `Promise<{text: string, wordCount: number}>`

---

## Library Functions

### `saveSession(snippet, words)`
Saves the current session. **Requires auth.**

### `fetchLibrary()`
Returns the user's 20 most recent saved sessions. **Requires auth.**

### `fetchSession(id)`
Fetches a single session by Firestore doc ID. **Requires auth.**

### `clearLibrary()`
Deletes all of the current user's sessions. **Requires auth.**
