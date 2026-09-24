/**
 * voice-languages.js — Multi-Language Support Data for the Voice Assistant
 *
 * Contains 100 major world languages with:
 *  - BCP-47 locale codes for Web Speech API recognition.lang
 *  - Human-readable display names (English + native script)
 *  - Grouped by region for the language selector UI
 */

export const VOICE_LANGUAGES = [
  // === South Asia ===
  { code: 'ta-IN', name: 'Tamil',      native: 'தமிழ்',        region: 'South Asia' },
  { code: 'hi-IN', name: 'Hindi',      native: 'हिन्दी',        region: 'South Asia' },
  { code: 'te-IN', name: 'Telugu',     native: 'తెలుగు',        region: 'South Asia' },
  { code: 'kn-IN', name: 'Kannada',    native: 'ಕನ್ನಡ',         region: 'South Asia' },
  { code: 'ml-IN', name: 'Malayalam',  native: 'മലയാളം',        region: 'South Asia' },
  { code: 'mr-IN', name: 'Marathi',    native: 'मराठी',         region: 'South Asia' },
  { code: 'gu-IN', name: 'Gujarati',   native: 'ગુજરાતી',       region: 'South Asia' },
  { code: 'pa-IN', name: 'Punjabi',    native: 'ਪੰਜਾਬੀ',        region: 'South Asia' },
  { code: 'bn-IN', name: 'Bengali',    native: 'বাংলা',          region: 'South Asia' },
  { code: 'ur-PK', name: 'Urdu',       native: 'اردو',           region: 'South Asia' },
  { code: 'si-LK', name: 'Sinhala',   native: 'සිංහල',          region: 'South Asia' },
  { code: 'ne-NP', name: 'Nepali',    native: 'नेपाली',         region: 'South Asia' },
  // === East Asia ===
  { code: 'zh-CN', name: 'Chinese (Simplified)',   native: '普通话',  region: 'East Asia' },
  { code: 'zh-TW', name: 'Chinese (Traditional)', native: '繁體中文', region: 'East Asia' },
  { code: 'ja-JP', name: 'Japanese',  native: '日本語',          region: 'East Asia' },
  { code: 'ko-KR', name: 'Korean',    native: '한국어',          region: 'East Asia' },
  // === Southeast Asia ===
  { code: 'vi-VN', name: 'Vietnamese',native: 'Tiếng Việt',     region: 'Southeast Asia' },
  { code: 'th-TH', name: 'Thai',      native: 'ภาษาไทย',        region: 'Southeast Asia' },
  { code: 'id-ID', name: 'Indonesian',native: 'Bahasa Indonesia',region: 'Southeast Asia' },
  { code: 'ms-MY', name: 'Malay',     native: 'Bahasa Melayu',  region: 'Southeast Asia' },
  { code: 'tl-PH', name: 'Filipino',  native: 'Filipino',       region: 'Southeast Asia' },
  { code: 'my-MM', name: 'Burmese',   native: 'မြန်မာဘာသာ',     region: 'Southeast Asia' },
  { code: 'km-KH', name: 'Khmer',     native: 'ភាសាខ្មែរ',      region: 'Southeast Asia' },
  { code: 'lo-LA', name: 'Lao',       native: 'ພາສາລາວ',         region: 'Southeast Asia' },
  // === English ===
  { code: 'en-US', name: 'English (US)', native: 'English (US)', region: 'English' },
  { code: 'en-GB', name: 'English (UK)', native: 'English (UK)', region: 'English' },
  { code: 'en-AU', name: 'English (AU)', native: 'English (AU)', region: 'English' },
  // === Western Europe ===
  { code: 'es-ES', name: 'Spanish (Spain)',  native: 'Español',       region: 'Western Europe' },
  { code: 'es-MX', name: 'Spanish (Mexico)',native: 'Español (MX)',   region: 'Western Europe' },
  { code: 'fr-FR', name: 'French',           native: 'Français',       region: 'Western Europe' },
  { code: 'de-DE', name: 'German',           native: 'Deutsch',         region: 'Western Europe' },
  { code: 'it-IT', name: 'Italian',          native: 'Italiano',        region: 'Western Europe' },
  { code: 'pt-PT', name: 'Portuguese (PT)',  native: 'Português',       region: 'Western Europe' },
  { code: 'pt-BR', name: 'Portuguese (BR)', native: 'Português (BR)',  region: 'Western Europe' },
  { code: 'nl-NL', name: 'Dutch',            native: 'Nederlands',      region: 'Western Europe' },
  { code: 'pl-PL', name: 'Polish',           native: 'Polski',          region: 'Western Europe' },
  { code: 'sv-SE', name: 'Swedish',          native: 'Svenska',         region: 'Western Europe' },
  { code: 'no-NO', name: 'Norwegian',        native: 'Norsk',           region: 'Western Europe' },
  { code: 'da-DK', name: 'Danish',           native: 'Dansk',           region: 'Western Europe' },
  { code: 'fi-FI', name: 'Finnish',          native: 'Suomi',           region: 'Western Europe' },
  { code: 'el-GR', name: 'Greek',            native: 'Ελληνικά',        region: 'Western Europe' },
  { code: 'cs-CZ', name: 'Czech',            native: 'Čeština',         region: 'Western Europe' },
  { code: 'sk-SK', name: 'Slovak',           native: 'Slovenčina',      region: 'Western Europe' },
  { code: 'hu-HU', name: 'Hungarian',        native: 'Magyar',          region: 'Western Europe' },
  { code: 'ro-RO', name: 'Romanian',         native: 'Română',          region: 'Western Europe' },
  { code: 'ca-ES', name: 'Catalan',          native: 'Català',          region: 'Western Europe' },
  { code: 'hr-HR', name: 'Croatian',         native: 'Hrvatski',        region: 'Western Europe' },
  { code: 'sr-RS', name: 'Serbian',          native: 'Srpski',          region: 'Western Europe' },
  { code: 'sl-SI', name: 'Slovenian',        native: 'Slovenščina',     region: 'Western Europe' },
  { code: 'bg-BG', name: 'Bulgarian',        native: 'Български',       region: 'Western Europe' },
  { code: 'uk-UA', name: 'Ukrainian',        native: 'Українська',      region: 'Western Europe' },
  { code: 'lt-LT', name: 'Lithuanian',       native: 'Lietuvių',        region: 'Western Europe' },
  { code: 'lv-LV', name: 'Latvian',          native: 'Latviešu',        region: 'Western Europe' },
  { code: 'et-EE', name: 'Estonian',         native: 'Eesti',           region: 'Western Europe' },
  { code: 'is-IS', name: 'Icelandic',        native: 'Íslenska',        region: 'Western Europe' },
  { code: 'mk-MK', name: 'Macedonian',       native: 'Македонски',      region: 'Western Europe' },
  { code: 'sq-AL', name: 'Albanian',         native: 'Shqip',           region: 'Western Europe' },
  { code: 'mt-MT', name: 'Maltese',          native: 'Malti',           region: 'Western Europe' },
  { code: 'cy-GB', name: 'Welsh',            native: 'Cymraeg',         region: 'Western Europe' },
  { code: 'ga-IE', name: 'Irish',            native: 'Gaeilge',         region: 'Western Europe' },
  // === Eastern Europe ===
  { code: 'ru-RU', name: 'Russian',          native: 'Русский',         region: 'Eastern Europe' },
  { code: 'be-BY', name: 'Belarusian',       native: 'Беларуская',      region: 'Eastern Europe' },
  // === Middle East / West Asia ===
  { code: 'ar-SA', name: 'Arabic',           native: 'العربية',         region: 'Middle East' },
  { code: 'he-IL', name: 'Hebrew',           native: 'עברית',           region: 'Middle East' },
  { code: 'fa-IR', name: 'Persian',          native: 'فارسی',           region: 'Middle East' },
  { code: 'tr-TR', name: 'Turkish',          native: 'Türkçe',          region: 'Middle East' },
  { code: 'az-AZ', name: 'Azerbaijani',      native: 'Azərbaycan',      region: 'Middle East' },
  { code: 'hy-AM', name: 'Armenian',         native: 'Հայերեն',         region: 'Middle East' },
  { code: 'ka-GE', name: 'Georgian',         native: 'ქართული',         region: 'Middle East' },
  { code: 'kk-KZ', name: 'Kazakh',           native: 'Қазақша',         region: 'Middle East' },
  { code: 'uz-UZ', name: 'Uzbek',            native: "O'zbek",          region: 'Middle East' },
  // === Africa ===
  { code: 'sw-KE', name: 'Swahili',          native: 'Kiswahili',       region: 'Africa' },
  { code: 'yo-NG', name: 'Yoruba',           native: 'Yorùbá',          region: 'Africa' },
  { code: 'ig-NG', name: 'Igbo',             native: 'Igbo',            region: 'Africa' },
  { code: 'ha-NG', name: 'Hausa',            native: 'Hausa',           region: 'Africa' },
  { code: 'am-ET', name: 'Amharic',          native: 'አማርኛ',            region: 'Africa' },
  { code: 'zu-ZA', name: 'Zulu',             native: 'isiZulu',         region: 'Africa' },
  { code: 'af-ZA', name: 'Afrikaans',        native: 'Afrikaans',       region: 'Africa' },
  { code: 'xh-ZA', name: 'Xhosa',            native: 'isiXhosa',        region: 'Africa' },
  { code: 'so-SO', name: 'Somali',           native: 'Soomaali',        region: 'Africa' },
  // === Pacific ===
  { code: 'mi-NZ', name: 'Maori',            native: 'Te Reo Maori',    region: 'Pacific' },
];

/** Returns all BCP-47 codes */
export const ALL_VOICE_LANG_CODES = VOICE_LANGUAGES.map(l => l.code);

/** Get a language entry by BCP-47 code */
export function getLangByCode(code) {
  return VOICE_LANGUAGES.find(l => l.code === code) || null;
}

/** Get all unique regions for grouping the selector UI */
export function getRegions() {
  const seen = new Set();
  return VOICE_LANGUAGES.reduce((acc, l) => {
    if (!seen.has(l.region)) { seen.add(l.region); acc.push(l.region); }
    return acc;
  }, []);
}
/** Default language code */
export const DEFAULT_VOICE_LANG = 'en-US';

/** Get the persisted voice language from localStorage, falls back to en-US */
export function getStoredVoiceLang() {
  try { return localStorage.getItem('decipher_voice_lang') || DEFAULT_VOICE_LANG; }
  catch { return DEFAULT_VOICE_LANG; }
}

/** Persist the chosen voice language */
export function setStoredVoiceLang(code) {
  try { localStorage.setItem('decipher_voice_lang', code); } catch { /* ignore */ }
}
