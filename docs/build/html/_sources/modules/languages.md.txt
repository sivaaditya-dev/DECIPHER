# `languages.js` — Translation Panel

**File:** `modules/languages.js`

Manages the translation panel UI including the 51-language selector, the rendering of translated vocabulary cards, cultural notes, and mirror word (false friend) alerts.

---

## Key Features

- **51 language support** — from Tamil and Hindi to Arabic, Japanese, and Swahili.
- **Cultural Notes** — AI-generated insights about how a word's meaning shifts across cultures.
- **Mirror Word Detection** — Flags "false friends": words that look similar to the target language's word but mean something completely different.

---

## Public API

### `initLanguages(onTranslateCallback)`
Wires up the language selector dropdown and translate button.

| Param | Type | Description |
|-------|------|-------------|
| `onTranslateCallback` | function | Called when the user clicks translate, receiving `(vocabList, targetLang)`. |

### `setTranslationData(translatedList)`
Populates the translation panel with the returned translation data.

### `getSelectedLanguage()`
Returns the currently selected language name (e.g., `"Tamil"`).

### `setLanguage(langName)`
Programmatically sets the language dropdown selection. Used by the Voice Assistant's `setLangSelect` handler.
