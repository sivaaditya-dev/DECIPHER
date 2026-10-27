/**
 * modules/sanitizer.js
 * Production-grade DOMPurify-based HTML and Markdown sanitizer for AI outputs.
 * 
 * Neutralizes Stored and Reflected XSS vectors from LLM responses, user chat,
 * and speech recognition inputs. Provides graceful fallback in Node/Jest environments.
 */

const DEFAULT_CONFIG = {
  ALLOWED_TAGS: [
    'b', 'strong', 'i', 'em', 'u', 's', 'strike',
    'p', 'br', 'hr', 'blockquote', 'code', 'pre',
    'ul', 'ol', 'li', 'span', 'div', 'mark',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'button', 'a', 'details', 'summary'
  ],
  ALLOWED_ATTR: [
    'href', 'target', 'rel', 'class', 'id', 'title',
    'aria-label', 'aria-hidden', 'aria-expanded', 'aria-controls',
    'role', 'tabindex', 'style',
    'data-word', 'data-type', 'data-index', 'data-target', 'data-session-id'
  ],
  ALLOW_DATA_ATTR: true,
  FORBID_TAGS: ['script', 'style', 'iframe', 'frame', 'object', 'embed', 'form', 'input'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'ontoggle', 'onbegin', 'formaction']
};

/**
 * Escapes unsafe HTML characters into entities.
 * Safe for embedding raw text into HTML contexts.
 * 
 * @param {string} str - Raw input string
 * @returns {string} Entity-escaped string
 */
export function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>'"]/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[char] || char));
}

/**
 * Decodes common numeric and named HTML entities for URL analysis.
 * @param {string} str - Raw attribute value
 * @returns {string} Decoded text
 */
function decodeHTMLEntities(str) {
  if (!str) return '';
  return str
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex) => {
      try { return String.fromCodePoint(parseInt(hex, 16)); } catch { return ''; }
    })
    .replace(/&#([0-9]+);?/g, (_, dec) => {
      try { return String.fromCodePoint(parseInt(dec, 10)); } catch { return ''; }
    })
    .replace(/&colon;?/gi, ':')
    .replace(/&tab;?/gi, '\t')
    .replace(/&newline;?/gi, '\n');
}

/**
 * Checks whether a URL attribute value contains an executable or dangerous scheme.
 * @param {string} rawVal - Attribute value
 * @returns {boolean} True if dangerous
 */
function isDangerousURL(rawVal) {
  if (!rawVal) return false;
  const decoded = decodeHTMLEntities(rawVal);
  const clean = decoded.replace(/[\x00-\x20\s\u00A0\u2000-\u200B]/g, '').toLowerCase();
  if (/^(?:javascript|vbscript):/i.test(clean) || /javascript:|vbscript:/i.test(clean)) return true;
  if (/^data:(?:text\/html|image\/svg\+xml)/i.test(clean) || /data:text\/html/i.test(clean)) return true;
  return false;
}

/**
 * Pure fallback sanitizer for environments where DOMPurify is unavailable (e.g. Node.js/Jest, offline).
 * Strips script tags, style tags, dangerous elements, executable schemes, and event handlers.
 * 
 * @param {string} html - HTML string to sanitize
 * @returns {string} Cleaned HTML string
 */
export function fallbackSanitize(html) {
  if (typeof html !== 'string') return '';
  let sanitized = html;

  // 1. Remove dangerous executable/embed elements (script, style, iframe, object, embed, frame, form, input)
  // Repeat in loop to prevent nested mutation bypasses (e.g. <scr<script>ipt>)
  let prev;
  do {
    prev = sanitized;
    sanitized = sanitized.replace(/<script\b[\s\S]*?(?:<\/script>|$)/gi, '');
    sanitized = sanitized.replace(/<style\b[\s\S]*?(?:<\/style>|$)/gi, '');
    sanitized = sanitized.replace(/<iframe\b[\s\S]*?(?:<\/iframe>|$)/gi, '');
    sanitized = sanitized.replace(/<object\b[\s\S]*?(?:<\/object>|$)/gi, '');
    sanitized = sanitized.replace(/<\/?(?:embed|frame|form|input)\b[^>]*>?/gi, '');
  } while (sanitized !== prev);

  // 2. Strip dangerous form action attributes (action, formaction) unconditionally
  sanitized = sanitized.replace(/(?:[\s\/'"]|^)(?:action|formaction)\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, '');

  // 3. Strip dangerous URL schemes (javascript:, data:text/html, vbscript:) with entity decoding
  sanitized = sanitized.replace(/(href|src)\s*=\s*(?:'([^']*)'|"([^"]*)"|([^\s>]+))/gi, (match, attr, v1, v2, v3) => {
    const val = v1 !== undefined ? v1 : (v2 !== undefined ? v2 : v3);
    if (isDangerousURL(val)) return '';
    return match;
  });

  // 4. Strip all inline event handlers (on*) regardless of whitespace, slash, or quote delimiter
  sanitized = sanitized.replace(/(?<=[\s\/'"<^]|\b)on[a-z0-9_-]+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, '');

  return sanitized;
}

/**
 * Get active DOMPurify instance if available in current scope.
 */
function getDOMPurify() {
  if (typeof window !== 'undefined' && window.DOMPurify && typeof window.DOMPurify.sanitize === 'function') {
    return window.DOMPurify;
  }
  if (typeof globalThis !== 'undefined' && globalThis.DOMPurify && typeof globalThis.DOMPurify.sanitize === 'function') {
    return globalThis.DOMPurify;
  }
  return null;
}

/**
 * Sanitizes dirty HTML using DOMPurify (if available) or defensive regex fallback.
 * 
 * @param {string} dirtyHtml - Unsanitized HTML string
 * @param {object} customConfig - Optional DOMPurify configuration overrides
 * @returns {string} Sanitized safe HTML
 */
export function sanitizeHTML(dirtyHtml, customConfig = {}) {
  if (dirtyHtml === null || dirtyHtml === undefined) return '';
  const input = typeof dirtyHtml === 'string' ? dirtyHtml : String(dirtyHtml);

  const purify = getDOMPurify();
  if (purify) {
    const config = { ...DEFAULT_CONFIG, ...customConfig };
    return purify.sanitize(input, config);
  }

  return fallbackSanitize(input);
}

/**
 * Lightweight, safe Markdown parser.
 * Converts headings, bold, italic, lists, links, and code blocks into HTML.
 * Protects code blocks and inline code from unexpected formatting.
 * 
 * @param {string} text - Raw Markdown string
 * @returns {string} HTML string
 */
export function parseMarkdown(text) {
  if (!text || typeof text !== 'string') return '';
  let out = text;

  // 1. Isolate code blocks (```code```)
  const codeBlocks = [];
  out = out.replace(/```([\s\S]*?)```/g, (_, code) => {
    const id = `@@@CODEBLOCK${codeBlocks.length}@@@`;
    codeBlocks.push(`<pre><code>${escapeHTML(code.trim())}</code></pre>`);
    return id;
  });

  // 2. Isolate inline code (`code`)
  const inlineCodes = [];
  out = out.replace(/`([^`]+)`/g, (_, code) => {
    const id = `@@@INLINECODE${inlineCodes.length}@@@`;
    inlineCodes.push(`<code>${escapeHTML(code)}</code>`);
    return id;
  });

  // 3. Headings (# h1, ## h2, ### h3)
  out = out.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  out = out.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  out = out.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // 4. Blockquotes
  out = out.replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>');

  // 5. Lists (unordered before asterisks)
  out = out.replace(/^[-*]\s+(.*)$/gm, '<ul><li>$1</li></ul>');
  out = out.replace(/<\/ul>\s*<ul>/g, '');

  // 6. Lists (ordered)
  out = out.replace(/^\d+\.\s+(.*)$/gm, '<ol><li>$1</li></ol>');
  out = out.replace(/<\/ol>\s*<ol>/g, '');

  // 7. Bold
  out = out.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/__(.*?)__/g, '<strong>$1</strong>');

  // 8. Italic
  out = out.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
  out = out.replace(/\b_([^_]+)_\b/g, '<em>$1</em>');

  // 9. Links [text](url) - only allow safe http/https/mailto or relative paths
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+|\/[^\s)]+)\)/gi, (_, txt, url) => {
    return `<a href="${escapeHTML(url.trim())}" target="_blank" rel="noopener noreferrer">${txt}</a>`;
  });

  // 10. Paragraphs / double line breaks
  out = out.replace(/\n\n+/g, '</p><p>');

  // 11. Restore protected code blocks & inline code
  inlineCodes.forEach((code, idx) => {
    out = out.replace(`@@@INLINECODE${idx}@@@`, code);
  });
  codeBlocks.forEach((block, idx) => {
    out = out.replace(`@@@CODEBLOCK${idx}@@@`, block);
  });

  return out;
}

/**
 * Sanitizes Markdown by parsing formatting constructs into HTML and passing through DOMPurify.
 * 
 * @param {string} text - Raw Markdown string
 * @param {object} customConfig - Optional DOMPurify configuration overrides
 * @returns {string} Sanitized safe HTML
 */
export function sanitizeMarkdown(text, customConfig = {}) {
  const parsed = parseMarkdown(text);
  return sanitizeHTML(parsed, customConfig);
}

/**
 * Safely sets the innerHTML of a DOM element after running input through sanitization.
 * 
 * @param {HTMLElement} element - Target DOM element
 * @param {string} content - HTML or Markdown content
 * @param {boolean} isMarkdown - Set true if content contains Markdown
 */
export function safeSetInnerHTML(element, content, isMarkdown = false) {
  if (!element) return;
  const clean = isMarkdown ? sanitizeMarkdown(content) : sanitizeHTML(content);
  element.innerHTML = clean;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    escapeHTML,
    fallbackSanitize,
    sanitizeHTML,
    parseMarkdown,
    sanitizeMarkdown,
    safeSetInnerHTML
  };
}
