# Voice Assistant — Multilingual Support

Decipher's voice assistant supports **100+ world languages** for voice command input, including Tamil, Hindi, Arabic, Spanish, French, Chinese, Japanese, Korean, and many more.

## How It Works

### Three-Layer Intent Detection Pipeline

When you speak a command, the system runs it through three layers in sequence:

1. **English Regex Patterns** (oice.js — VOICE_INTENTS)
   - Fast, offline, zero-latency matching for English commands.
   - Examples: "analyze", "go to quiz", "translate to Spanish"

2. **Multilingual Keyword Fallback** (oice-intents-multilang.js)
   - Offline regex patterns for 20+ major languages.
   - Covers Tamil, Hindi, Spanish, French, Arabic, Chinese, Korean, Japanese, and more.
   - Examples: Tamil "பகுப்பாய்வு" → nalyze, Hindi "परीक्षा" → 
avQuiz

3. **Gemini AI Fallback** (/api/voice-intent)
   - If neither regex layer matches, the transcript is sent to Gemini 2.5 Flash.
   - Handles any of the 100+ languages with natural phrasing, slang, and mixed-language commands.
   - Returns one of the structured action tags (e.g., [ACTION:analyze]).

### Language Picker UI

- A **language selector** appears at the top of the voice overlay.
- Clicking it opens a searchable dropdown with all 100 languages, grouped by region.
- The selected language is set as ecognition.lang on the Web Speech API.
- Your choice is **persisted in localStorage** (decipher_voice_lang) and restored on the next visit.

## Supported Languages (Highlights)

| Region | Languages |
|---|---|
| South Asia | Tamil, Hindi, Telugu, Kannada, Malayalam, Marathi, Gujarati, Punjabi, Bengali, Urdu |
| East Asia | Mandarin (Simplified & Traditional), Japanese, Korean, Cantonese |
| Southeast Asia | Malay, Indonesian, Thai, Vietnamese, Filipino, Burmese, Khmer |
| Europe | Spanish, French, German, Italian, Portuguese, Dutch, Russian, Polish, Ukrainian, + 20 more |
| Middle East | Arabic, Persian/Farsi, Hebrew, Turkish |
| Africa | Swahili, Amharic, Yoruba, Hausa, Zulu |
| Americas | Spanish (Mexico/Argentina), Portuguese (Brazil), French (Canada) |

## Technical Architecture

- \modules/voice-languages.js\ — Language data map (100 languages with BCP-47 codes)
- \modules/voice-intents-multilang.js\ — Multilingual regex keyword patterns
- \modules/voice.js\ — Core voice assistant (updated for multilingual support)
- \server.js\ — \POST /api/voice-intent\ Gemini endpoint

## Voice Recognition Notes

- The Web Speech API's accuracy depends on the browser's built-in language models.
- Chrome and Edge have the best support for non-English languages.
- Firefox has limited language support for SpeechRecognition.
- For best results with Tamil and Indian languages, use Chrome on Android or desktop.