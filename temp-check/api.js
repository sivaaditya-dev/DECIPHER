/**
 * API Module
 * Centralizes all server communication. Every fetch call lives here.
 */

export const API_BASE = '/api';

export const SPINNER_SVG = `<svg class="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;

// --------------------
// Auth Header Helper
// --------------------
let _auth = null;
export function setAuth(authInstance) {
  _auth = authInstance;
}

export async function getAuthHeaders() {
  if (!_auth || !_auth.currentUser) return { 'Content-Type': 'application/json' };
  try {
    const token = await _auth.currentUser.getIdToken(true);
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  } catch (err) {
    console.error('Error getting auth token:', err);
    _auth.signOut();
    return null;
  }
}

// --------------------
// AI Analysis
// --------------------
/**
 * Analyze text for vocabulary using the AI endpoint.
 * @param {string} text
 * @param {string} theme
 * @returns {Promise<Array>} vocab list
 */
export async function analyzeText(text, theme) {
  const response = await fetch(`${API_BASE}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, theme }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown server error.' }));
    throw new Error(err.error || 'Analysis failed');
  }
  return response.json();
}

// --------------------
// PDF Upload
// --------------------
/**
 * Upload a PDF or EPUB file and get extracted text back.
 * @param {File} file
 * @returns {Promise<{text: string, pageCount: number, fileName: string}>}
 */
export async function extractPdfText(file) {
  const formData = new FormData();
  formData.append('document', file);

  const response = await fetch(`${API_BASE}/extract-pdf`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'PDF extraction failed.' }));
    throw new Error(err.error || 'PDF extraction failed.');
  }
  return response.json();
}

// --------------------
// Translation
// --------------------
/**
 * Translate a vocab list into a target language.
 * Also returns cultural notes and mirror word (false friend) detection.
 * @param {Array} vocabList - Array of {term, def, syn, context}
 * @param {string} targetLang - Full language name (e.g., "Spanish")
 * @returns {Promise<Array>} Translated vocab with {term, translatedDef, translatedContext, culturalNote, mirrorWord}
 */
export async function translateVocabList(vocabList, targetLang) {
  const response = await fetch(`${API_BASE}/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vocabList, targetLang }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Translation failed.' }));
    throw new Error(err.error || 'Translation failed.');
  }
  return response.json();
}

// --------------------
// Story Generation
// --------------------
/**
 * Generate a contextual story integrating all vocabulary words.
 * @param {string[]} words
 * @returns {Promise<{story: string}>}
 */
export async function generateStory(words) {
  const response = await fetch(`${API_BASE}/story`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ words }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Story generation failed.' }));
    throw new Error(err.error || 'Story generation failed.');
  }
  return response.json();
}

// --------------------
// Memory Hooks (Mnemonics)
// --------------------
/**
 * Generate creative memory hooks for each vocabulary word.
 * @param {Array} vocabList - [{term, def}]
 * @returns {Promise<Array>} [{term, mnemonic}]
 */
export async function generateMnemonics(vocabList) {
  const response = await fetch(`${API_BASE}/mnemonic`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vocabList }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Mnemonic generation failed.' }));
    throw new Error(err.error || 'Mnemonic generation failed.');
  }
  return response.json();
}

// --------------------
// Passage Simplifier
// --------------------
/**
 * Simplify a passage into Plain English or ELI5.
 * @param {string} text
 * @param {'plain'|'eli5'} level
 * @returns {Promise<{simplified: string, level: string}>}
 */
export async function simplifyPassage(text, level = 'plain') {
  const response = await fetch(`${API_BASE}/simplify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, level }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Simplification failed.' }));
    throw new Error(err.error || 'Simplification failed.');
  }
  return response.json();
}

// --------------------
// SRS Quiz Questions
// --------------------
/**
 * Generate fill-in-the-blank SRS quiz sentences for each word.
 * @param {Array} vocabList - [{term, def}]
 * @returns {Promise<Array>} [{term, sentence}]
 */
export async function generateSRSQuestions(vocabList) {
  const response = await fetch(`${API_BASE}/srs-questions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vocabList }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'SRS generation failed.' }));
    throw new Error(err.error || 'SRS generation failed.');
  }
  return response.json();
}

// --------------------
// Library (History)
// --------------------
/**
 * Save the current session to the user's personal library.
 */
export async function saveSession(snippet, words) {
  const headers = await getAuthHeaders();
  if (!headers) throw new Error('Authentication error. Please log in again.');

  const response = await fetch(`${API_BASE}/history`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ snippet, words }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Save failed.' }));
    throw new Error(err.error || 'Save failed.');
  }
  return response.json();
}

/**
 * Fetch the user's saved library of sessions.
 */
export async function fetchLibrary() {
  const headers = await getAuthHeaders();
  if (!headers) throw new Error('Authentication error.');

  const response = await fetch(`${API_BASE}/history`, { headers });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Failed to fetch library.' }));
    throw new Error(err.error || `HTTP error! status: ${response.status}`);
  }
  return response.json();
}

/**
 * Fetch a specific saved session by its Firestore document ID.
 */
export async function fetchSession(id) {
  const headers = await getAuthHeaders();
  if (!headers) throw new Error('Authentication error.');

  const response = await fetch(`${API_BASE}/history/${id}`, { headers });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Session not found.' }));
    throw new Error(err.error || `HTTP error! status: ${response.status}`);
  }
  return response.json();
}

/**
 * Delete all sessions for the currently logged-in user.
 */
export async function clearLibrary() {
  const headers = await getAuthHeaders();
  if (!headers) throw new Error('Authentication error.');

  const response = await fetch(`${API_BASE}/history`, { method: 'DELETE', headers });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Clear failed.' }));
    throw new Error(err.error || `HTTP error! status: ${response.status}`);
  }
  return response.json();
}
// --------------------
// Image OCR
// --------------------
export async function extractImageText(imageFile) {
  const formData = new FormData();
  formData.append('image', imageFile);
  const response = await fetch(`${API_BASE}/ocr`, { method: 'POST', body: formData });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'OCR failed.' }));
    throw new Error(err.error || 'Image text extraction failed.');
  }
  return response.json();
}

// --------------------
// YouTube Transcript
// --------------------
export async function fetchYouTubeTranscript(url) {
  const response = await fetch(`${API_BASE}/youtube-transcript`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Transcript fetch failed.' }));
    throw new Error(err.error || 'Could not fetch transcript.');
  }
  return response.json();
}

// --------------------
// Socratic Tutor Chat
// --------------------
export async function sendChatMessage(messages, passage, vocabList) {
  const response = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, passage, vocabList }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Chat failed.' }));
    throw new Error(err.error || 'Tutor unavailable.');
  }
  return response.json();
}

// --------------------
// Opposite Day
// --------------------
export async function generateOppositeDay(text, vocabList) {
  const response = await fetch(`${API_BASE}/opposite-day`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, vocabList }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Opposite Day failed.' }));
    throw new Error(err.error || 'Generation failed.');
  }
  return response.json();
}
