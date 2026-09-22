/**
 * voice-intents-multilang.js - Multilingual keyword patterns for the Voice Assistant
 *
 * These patterns extend the core English VOICE_INTENTS with keywords from
 * Tamil, Hindi, Spanish, French, Arabic, and 20+ other major languages.
 * Used as a fast, offline-first fallback before querying the Gemini API.
 */

/**
 * MULTILINGUAL_INTENT_PATTERNS
 * Each entry maps multilingual phrases to an action key.
 */
export const MULTILINGUAL_INTENT_PATTERNS = [

  // Navigate to Studio
  {
    action: 'navStudio',
    label: 'Navigating to Studio',
    patterns: [
      /(\u0baa\u0b95\u0bc1\u0baa\u0bcd\u0baa\u0bbe\u0baf\u0bcd\u0bb5\u0bc1|\u0bb8\u0bcd\u0b9f\u0bc1\u0b9f\u0bbf\u0baf\u0bcb)/u,
      /(\u0935\u093f\u0936\u094d\u0932\u0947\u0937\u0923 \u0915\u0930\u094b|\u0938\u094d\u091f\u0942\u0921\u093f\u092f\u094b)/u,
      /(analizar|ir al estudio|estudio)/i,
      /(analyser|aller au studio|studio)/i,
      /(\u062a\u062d\u0644\u064a\u0644|\u0627\u0644\u0627\u0633\u062a\u0648\u062f\u064a\u0648)/u,
      /(\u5206\u6790|\u5de5\u4f5c\u5ba4)/u,
      /(\ubd84\uc11d|\uc2a4\ud29c\ub514\uc624)/u,
    ],
  },

  // Navigate to Quiz
  {
    action: 'navQuiz',
    label: 'Navigating to Quiz',
    patterns: [
      /(\u0bb5\u0bbf\u0ba9\u0bbe\u0b9f\u0bbf \u0bb5\u0bbf\u0ba9\u0bbe|\u0ba4\u0bc7\u0bb0\u0bcd\u0bb5\u0bc1)/u,
      /(\u092a\u0930\u0940\u0915\u094d\u0937\u093e|\u0915\u094d\u0935\u093f\u091c\u093c|\u091f\u0947\u0938\u094d\u091f)/u,
      /(cuestionario|examen|prueba)/i,
      /(questionnaire|examen)/i,
      /(\u0627\u062e\u062a\u0628\u0627\u0631|\u0645\u0633\u0627\u0628\u0642\u0629)/u,
      /(\u6d4b\u9a8c|\u8003\u8bd5)/u,
      /(\ud034\uc988|\uc2dc\ud5d8)/u,
    ],
  },

  // Navigate to Library
  {
    action: 'navLibrary',
    label: 'Opening Library',
    patterns: [
      /(\u0ba8\u0bc2\u0bb2\u0b95\u0bae\u0bcd|\u0b9a\u0bc7\u0bae\u0bbf\u0b95\u0bcd\u0b95\u0baa\u0bcd\u0baa\u0b9f\u0bcd\u0b9f)/u,
      /(\u092a\u0941\u0938\u094d\u0924\u0915\u093e\u0932\u092f|\u0932\u093e\u0907\u092c\u094d\u0930\u0947\u0930\u0940)/u,
      /(biblioteca|guardado|historial)/i,
      /(biblioth[eè]que|enregistr[eé])/i,
      /(\u0645\u0643\u062a\u0628\u0629|\u0645\u062d\u0641\u0648\u0638)/u,
      /(\u56fe\u4e66\u9986|\u6536\u85cf)/u,
      /(\ub77c\uc774\ube0c\ub7ec\ub9ac|\uc800\uc7a5)/u,
    ],
  },

  // Go Home
  {
    action: 'navHome',
    label: 'Going Home',
    patterns: [
      /(\u0bae\u0bc1\u0b95\u0baa\u0bcd\u0baa\u0bc1|\u0bb5\u0bc0\u0b9f\u0bc1)/u,
      /(\u0939\u094b\u092e|\u092e\u0941\u0916\u094d\u092f \u092a\u0943\u0937\u094d\u0920)/u,
      /(inicio|p[aá]gina principal)/i,
      /(accueil|page d.accueil)/i,
      /(\u0627\u0644\u0631\u0626\u064a\u0633\u064a\u0629)/u,
      /(\u9996\u9875|\u4e3b\u9875)/u,
      /(\ud648|\uba54\uc778)/u,
    ],
  },

  // Translate
  {
    action: 'translate',
    label: 'Translating vocabulary',
    patterns: [
      /(\u0bae\u0bca\u0bb4\u0bbf\u0baa\u0bc6\u0baf\u0bb0\u0bcd|\u0bae\u0bca\u0bb4\u0bbf\u0bae\u0bbe\u0bb1\u0bcd\u0bb1\u0bc1)/u,
      /(\u0905\u0928\u0941\u0935\u093e\u0926|\u0905\u0928\u0941\u0935\u093e\u062f \u0915\u0930\u094b)/u,
      /(traducir|traducci[oó]n)/i,
      /(traduire|traduction)/i,
      /(\u062a\u0631\u062c\u0645|\u062a\u0631\u062c\u0645\u0629)/u,
      /(\u7ffb\u8bd1|\u8bd1\u6210)/u,
      /(\ubc88\uc5ed|\ubc88\uc5ed\ud558\ub2e4)/u,
    ],
  },

  // Memory Hooks
  {
    action: 'memoryHooks',
    label: 'Generating Memory Hooks',
    patterns: [
      /(\u0ba8\u0bbf\u0ba9\u0bc8\u0bb5\u0b95 \u0b89\u0ba4\u0bb5\u0bbf|\u0bae\u0ba9\u0baa\u0bcd\u0baa\u0bbe\u0b9f)/u,
      /(\u092f\u093e\u0926 \u0915\u0930\u0928\u0947 \u0915\u0947|\u0938\u094d\u092e\u0943\u0924\u093f)/u,
      /(ayuda memoria|mnemot[eé]cnica)/i,
      /(aide-m[eé]moire|mn[eé]motechnique)/i,
      /(\u0648\u0633\u064a\u0644\u0629 \u062a\u0630\u0643\u0631|\u062d\u0641\u0638)/u,
    ],
  },

  // Simplify
  {
    action: 'simplify',
    label: 'Simplifying the passage',
    patterns: [
      /(\u0b8e\u0bb3\u0bbf\u0bae\u0bc8\u0baa\u0bcd\u0baa\u0b9f\u0bc1\u0ba4\u0bcd\u0ba4\u0bc1|\u0b9a\u0bc1\u0bb0\u0bc1\u0b95\u0bcd\u0b95\u0bc1)/u,
      /(\u0938\u0930\u0932 \u0915\u0930\u094b|\u0906\u0938\u093e\u0928 \u092d\u093e\u0937\u093e)/u,
      /(simplificar|texto simple)/i,
      /(simplifier|simplification)/i,
      /(\u062a\u0628\u0633\u064a\u0637|\u0628\u0633\u0637 \u0627\u0644\u0646\u0635)/u,
    ],
  },

  // Story
  {
    action: 'story',
    label: 'Generating a Story',
    patterns: [
      /(\u0b95\u0ba4\u0bc8|\u0b95\u0ba4\u0bc8 \u0b89\u0bb0\u0bc1\u0bb5\u0bbe\u0b95\u0bcd\u0b95\u0bc1)/u,
      /(\u0915\u0939\u093e\u0928\u0940|\u0915\u0939\u093e\u0928\u0940 \u092c\u0928\u093e\u0913)/u,
      /(cuento|historia|generar historia)/i,
      /(histoire|raconter)/i,
      /(\u0642\u0635\u0629|\u0627\u062d\u0643\u0650 \u0642\u0635\u0629)/u,
      /(\u6545\u4e8b|\u751f\u6210\u6545\u4e8b)/u,
    ],
  },

  // Save
  {
    action: 'save',
    label: 'Saving the session',
    patterns: [
      /(\u0b9a\u0bc7\u0bae\u0bbf|\u0baa\u0bbe\u0ba4\u0bc1\u0b95\u0bbe\u0b95\u0bcd\u0b95)/u,
      /(\u092c\u091a\u093e\u0913|\u0938\u0947\u0935 \u0915\u0930\u094b)/u,
      /(guardar|salvar)/i,
      /(sauvegarder|enregistrer)/i,
      /(\u0627\u062d\u0641\u0638|\u062d\u0641\u0638)/u,
      /(\u4fdd\u5b58|\u5132\u5b58)/u,
    ],
  },
];

/**
 * Parse multilingual commands from a speech transcript.
 * Returns an array of { action, label } objects, or [] if none match.
 * Same shape as parseCommands() in voice.js for drop-in compatibility.
 */
export function parseMultilingualCommands(utterance) {
  const queue = [];
  const seen = new Set();
  for (const intent of MULTILINGUAL_INTENT_PATTERNS) {
    if (seen.has(intent.action)) continue;
    for (const pattern of intent.patterns) {
      if (pattern.test(utterance)) {
        queue.push({ action: intent.action, label: intent.label });
        seen.add(intent.action);
        break;
      }
    }
  }
  return queue;
}