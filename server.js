require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');

// Polyfill for DOMMatrix missing in Node environments (Vercel)
if (typeof global.DOMMatrix === 'undefined') {
  global.DOMMatrix = class DOMMatrix {
    constructor() {
      this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0;
    }
  };
}
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const { YoutubeTranscript } = require('youtube-transcript');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');
const admin = require('firebase-admin');



const app = express();
const PORT = process.env.PORT || 3000;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Multer instances ??? memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = require('path').extname(file.originalname).toLowerCase();
    if (['.pdf','.epub','.docx'].includes(ext) ||
        file.mimetype === 'application/pdf' ||
        file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
      cb(null, true);
    else cb(new Error('Only PDF, DOCX and EPUB files are supported.'));
  }
});
const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are supported for OCR.'));
  }
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('.'));

// --- CONNECT TO FIREBASE ---
  // --- CONNECT TO FIREBASE ---
  try {
    let serviceAccount;
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } else {
      serviceAccount = require("./serviceAccountKey.json");
    }
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log("Connected to Firebase Firestore!");
  } catch (error) {
    console.error("ERROR: Could not load Firebase credentials.");
    console.error(error);
    process.exit(1);
  }

const db = admin.firestore();
const sessionsCollection = db.collection('sessions'); 

// --- MIDDLEWARE ---
const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(403).json({ error: "Unauthorized: No token provided." });
  }

  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken; // Attach user info (like uid) to the request
    next();
  } catch (error) {
    console.error("Error verifying token:", error);
    res.status(403).json({ error: "Unauthorized: Invalid token." });
  }
};

// --- ROUTES ---

// AI Analysis (Unchanged)
app.post('/api/analyze', async (req, res) => {
  const { text, theme } = req.body;
  if (!text || text.length < 20) return res.status(400).json({ error: "Text too short." });

  try {
    const themePrompt = theme && theme !== 'General' 
      ? `Focus the definitions and context strongly around the domain of ${theme}. ` 
      : '';

    const prompt = `
      You are an advanced vocabulary extraction tool. 
      Read the following text and extract the most difficult, complex, or advanced vocabulary words. 
      Limit the extraction to a maximum of 25 words.
      ${themePrompt}
      For each word, provide:
      1. The word itself (term)
      2. A concise definition based on how it is used in the text
      3. A common synonym
      4. The exact sentence or clause from the text where it was used (context).
      Text to analyze: "${text}"
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: "ARRAY",
                items: {
                    type: "OBJECT",
                    properties: { term: { type: "STRING" }, def: { type: "STRING" }, syn: { type: "STRING" }, context: { type: "STRING" } },
                    required: ["term", "def", "syn", "context"]
                }
            }
        }
    });

    res.json(JSON.parse(response.text));
  } catch (error) {
    console.error('Error during AI analysis:', error);
    res.status(500).json({ error: 'AI analysis failed. Please check the server logs for more details.' });
  }
});

// --- PDF / EPUB TEXT EXTRACTION ---
app.post('/api/extract-pdf', upload.single('document'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded. Please attach a PDF or EPUB.' });
  }

  const ext = path.extname(req.file.originalname).toLowerCase();

  try {
    if (ext === '.pdf' || req.file.mimetype === 'application/pdf') {
      // --- Parse PDF ---
      const data = await pdfParse(req.file.buffer);

      if (!data.text || data.text.trim().length < 50) {
        return res.status(422).json({
          error: 'Could not extract readable text from this PDF. It may be a scanned image without OCR layer.'
        });
      }

      // Limit to first ~6000 characters to stay within AI token budgets
      const truncated = data.text.replace(/\s+/g, ' ').trim().slice(0, 20000);

      return res.json({
        text: truncated,
        pageCount: data.numpages,
        fileName: req.file.originalname,
        truncated: data.text.length > 20000
      });
    }

    if (ext === '.epub') {
      // EPUB is a ZIP with HTML inside ??? basic extraction
      // For now, return a friendly error pointing users toward PDF
      return res.status(422).json({
        error: 'EPUB support is coming soon. Please convert your e-book to PDF first.'
      });
    }

    return res.status(400).json({ error: 'Unsupported file type.' });
  } catch (err) {
    console.error('PDF extraction error:', err);
    res.status(500).json({ error: 'Failed to process the file. Ensure it is a valid, non-password-protected PDF.' });
  }
});

// Multer error handler (file size limit, file type rejection, etc.)
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File too large. Maximum size is 100MB for documents, 20MB for images.' });
    }
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
});

// --- CONTEXTUAL TRANSLATION (with Cultural Notes & Mirror Word Detection) ---
app.post('/api/translate', async (req, res) => {
  const { vocabList, targetLang } = req.body;
  if (!vocabList || !Array.isArray(vocabList) || vocabList.length === 0) {
    return res.status(400).json({ error: 'No vocabulary list provided.' });
  }
  if (!targetLang) {
    return res.status(400).json({ error: 'No target language specified.' });
  }

  try {
    const prompt = `
      You are a professional multilingual educator and linguist. Your job is to translate English vocabulary into ${targetLang} in a way that is pedagogically rich.

      For EACH word in the list below, provide ALL of the following:

      1. "translatedDef": Translate the English definition into ${targetLang}. Preserve educational tone.
      2. "translatedContext": Translate the context sentence into ${targetLang}. Keep it natural.
      3. "culturalNote": If the word carries a cultural nuance, idiomatic meaning, or if the concept exists differently in ${targetLang}-speaking cultures, write a SHORT insightful note (1-2 sentences, in English for clarity). If there is no significant cultural note, return an empty string.
      4. "mirrorWord": Check if the English word LOOKS or SOUNDS similar to a word in ${targetLang} but has a completely DIFFERENT meaning. If such a pair exists, return an object with:
         - "nativeWord": The visually/phonetically similar word in ${targetLang}
         - "nativeMeaning": What that native word actually means (in English)
         - "alert": A friendly, educational warning in English (e.g., "Heads up! The word 'X' in ${targetLang} looks very similar but actually means 'Y'. Don't let it fool you!")
         If NO mirror word exists, return { "nativeWord": "", "nativeMeaning": "", "alert": "" }.

      Keep the original English "term" UNCHANGED in your response.

      Vocabulary list:
      ${JSON.stringify(vocabList.map(v => ({ term: v.term, def: v.def, context: v.context })))}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              term:              { type: 'STRING' },
              translatedDef:     { type: 'STRING' },
              translatedContext: { type: 'STRING' },
              culturalNote:      { type: 'STRING' },
              mirrorWord: {
                type: 'OBJECT',
                properties: {
                  nativeWord:    { type: 'STRING' },
                  nativeMeaning: { type: 'STRING' },
                  alert:         { type: 'STRING' }
                },
                required: ['nativeWord', 'nativeMeaning', 'alert']
              }
            },
            required: ['term', 'translatedDef', 'translatedContext', 'culturalNote', 'mirrorWord']
          }
        }
      }
    });

    res.json(JSON.parse(response.text));
  } catch (error) {
    console.error('Translation error:', error);
    res.status(500).json({ error: 'Translation failed. Please try again.' });
  }
});

// --- MEMORY HOOK / MNEMONIC GENERATOR ---
app.post('/api/mnemonic', async (req, res) => {
  const { vocabList } = req.body;
  if (!vocabList || !Array.isArray(vocabList) || vocabList.length === 0) {
    return res.status(400).json({ error: 'No vocabulary list provided.' });
  }
  try {
    const prompt = `
      You are a creative memory coach and linguistics expert. For each vocabulary word, create a vivid, memorable "Memory Hook" ??? a fun mental image, wordplay, or short story that connects the word's sound/spelling directly to its meaning.

      Rules:
      - Keep each mnemonic to 1-2 punchy sentences.
      - Use vivid imagery, humor, or surprising wordplay where possible.
      - The hook should make the meaning instantly recalled.
      - Do NOT just restate the definition. Be creative!

      Example: "Gregarious" (def: sociable, fond of company) ???
      Mnemonic: "Think of GREG who's always HILARIOUS at parties ??? he never shuts up because he loves being around people!"

      Words to process:
      ${JSON.stringify(vocabList.map(v => ({ term: v.term, def: v.def })))}
    `;
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              term:     { type: 'STRING' },
              mnemonic: { type: 'STRING' }
            },
            required: ['term', 'mnemonic']
          }
        }
      }
    });
    res.json(JSON.parse(response.text));
  } catch (err) {
    console.error('Mnemonic error:', err);
    res.status(500).json({ error: 'Memory hook generation failed.' });
  }
});

// --- PASSAGE SIMPLIFIER (ELI5 / PLAIN ENGLISH) ---
app.post('/api/simplify', async (req, res) => {
  const { text, level } = req.body;
  if (!text || text.length < 20) return res.status(400).json({ error: 'Text too short.' });

  const levelInstruction = level === 'eli5'
    ? 'Rewrite this passage as if explaining to a curious, bright 12-year-old. Use simple everyday words, fun analogies, short sentences, and a conversational tone. Keep ALL the core ideas.'
    : 'Rewrite this passage in clear, straightforward Modern English (B1???B2 level). Remove jargon, complex syntax, and archaic language. Keep all ideas intact ??? just make them easy to read.';

  try {
    const prompt = `${levelInstruction}\n\nPassage:\n"${text}"\n\nReturn ONLY the rewritten passage as plain text ??? no headings, no bullet points, no formatting.`;
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    res.json({ simplified: response.text.trim(), level });
  } catch (err) {
    console.error('Simplify error:', err);
    res.status(500).json({ error: 'Simplification failed.' });
  }
});

// --- SRS (SPACED REPETITION) QUIZ QUESTION BATCH GENERATOR ---
app.post('/api/srs-questions', async (req, res) => {
  const { vocabList } = req.body;
  if (!vocabList || !Array.isArray(vocabList) || vocabList.length === 0) {
    return res.status(400).json({ error: 'No vocabulary list provided.' });
  }
  try {
    const prompt = `
      You are a language quiz designer. For each vocabulary word below, create ONE fill-in-the-blank sentence.

      Rules:
      - Use ___ (three underscores) to mark exactly where the word goes.
      - The sentence must be realistic: a news headline, business email, academic text, or everyday conversation.
      - Context clues should make the meaning inferable but NOT give away the word directly.
      - Each sentence must be 10???22 words long.
      - Do NOT include the actual word anywhere else in the sentence.

      Example: "proliferate" ???
      "Social media platforms continue to ___ at an astonishing rate, with millions of new accounts created daily."

      Words:
      ${JSON.stringify(vocabList.map(v => ({ term: v.term, def: v.def })))}
    `;
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              term:     { type: 'STRING' },
              sentence: { type: 'STRING' }
            },
            required: ['term', 'sentence']
          }
        }
      }
    });
    res.json(JSON.parse(response.text));
  } catch (err) {
    console.error('SRS error:', err);
    res.status(500).json({ error: 'SRS question generation failed.' });
  }
});

// --- IMAGE OCR (Gemini Vision) ---
app.post('/api/ocr', uploadImage.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded.' });
  try {
    const b64 = req.file.buffer.toString('base64');
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ parts: [
        { text: 'Extract ALL readable text from this image exactly as it appears. Return ONLY the raw text, no commentary, no formatting.' },
        { inlineData: { mimeType: req.file.mimetype, data: b64 } }
      ]}]
    });
    const text = response.text.trim();
    if (!text || text.length < 10) return res.status(422).json({ error: 'Could not read text from this image. Please use a clearer photo.' });
    res.json({ text });
  } catch (err) {
    console.error('OCR error:', err);
    res.status(500).json({ error: 'Image text extraction failed.' });
  }
});

// --- YOUTUBE / URL TRANSCRIPT ---
app.post('/api/youtube-transcript', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'No URL provided.' });
  try {
    const transcript = await YoutubeTranscript.fetchTranscript(url, { lang: 'en' });
    const text = transcript.map(t => t.text).join(' ').replace(/\s+/g, ' ').trim();
    if (!text || text.length < 20) return res.status(422).json({ error: 'No captions found for this video. Please try a video with captions/subtitles enabled.' });
    res.json({ text: text.slice(0, 20000), wordCount: text.split(' ').length });
  } catch (err) {
    console.error('YouTube transcript error:', err);
    res.status(400).json({ error: 'Could not fetch transcript. Ensure the YouTube video has captions enabled and the URL is correct.' });
  }
});

// --- DECIPHER TUTOR CHAT ---
app.post('/api/chat', async (req, res) => {
  const { messages, passage, vocabList } = req.body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'No messages provided.' });
  }
  const contextWords = vocabList ? vocabList.map(v => `"${v.term}" (${v.def})`).join('; ') : 'None';
  const passageSnippet = passage ? passage.substring(0, 1000) : 'No passage loaded.';

  const systemPrompt = `You are "Decipher Tutor", the intelligent assistant built into Decipher ??? an AI vocabulary learning app.

You have two abilities:
1. ANSWER vocabulary and comprehension questions.
2. NAVIGATE/TRIGGER app features on behalf of the user.

== AVAILABLE ACTIONS ==
When you detect ANY navigational or feature-triggering intent, prepend the EXACT action tag at the very start of your reply (before anything else). Choose the single most relevant action:

[ACTION:navStudio]    ??? User wants to go to Studio (analyzer, input text, reading passage)
[ACTION:navQuiz]      ??? User wants to go to the Quiz page/tab
[ACTION:navLibrary]   ??? User wants to go to the Library (saved sessions)
[ACTION:navHome]      ??? User wants to go to the home/landing page
[ACTION:memoryHooks]  ??? User wants memory hooks, mnemonics, memory aids for words
[ACTION:quiz]         ??? User wants to start/take/begin the quiz immediately
[ACTION:translate]    ??? User wants to translate vocabulary words
[ACTION:story]        ??? User wants to generate a vocabulary story
[ACTION:simplify]     ??? User wants to simplify/rewrite the passage (ELI5, plain English)
[ACTION:oppositeDay]  ??? User wants antonyms or the Opposite Day feature

== CRITICAL RULES FOR ACTIONS ==
- Detect intent from ANY language (Tamil, Hindi, Spanish, French, Arabic, etc.) and ANY accent or phrasing variation.
- Examples of what to recognize:
  * "memory hooks" / "mnemonic" / "yaad karne ka tarika" / "moyens mn??motechniques" / "aide-m??moire" / "ways to remember" ??? [ACTION:memoryHooks]
  * "quiz" / "test me" / "pariksha" / "quiz karo" / "interrogation" / "practise" ??? [ACTION:quiz]
  * "translate" / "anuvad" / "traduire" / "traducir" ??? [ACTION:translate]
  * "library" / "saved" / "meri library" / "biblioth??que" ??? [ACTION:navLibrary]
  * "studio" / "analyzer" / "go back" / "input" ??? [ACTION:navStudio]
  * "simplify" / "ELI5" / "explain simple" / "aasaan bhasha" / "simple karo" ??? [ACTION:simplify]
  * "story" / "generate story" / "kahani" / "histoire" ??? [ACTION:story]
- If NO action is needed (user just asking a vocabulary question), do NOT include any [ACTION:...] tag.
- NEVER make up action tags. Only use the ones listed above.
- After the action tag, give a SHORT confirmation (1 sentence) + helpful tip if needed.
  Example: "[ACTION:memoryHooks] ??? Navigating to Studio and generating Memory Hooks for your words!"

== CONTEXT ==
Active reading passage (first 1000 chars): "${passageSnippet}"
Vocabulary words being studied: ${contextWords}

== AS A TUTOR ==
- Help students understand words with vivid analogies and real-world examples.
- Use the Socratic method ??? ask occasional follow-up questions.
- Keep responses concise (2-4 sentences for simple questions).
- Always connect word explanations back to the passage context.
- Respond warmly and encouragingly.`;

  try {
    const history = messages.slice(0, -1).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));
    const lastMessage = messages[messages.length - 1].content;
    const fullPrompt = `${systemPrompt}\n\nStudent says: ${lastMessage}`;
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: history.length > 0
        ? [...history, { role: 'user', parts: [{ text: fullPrompt }] }]
        : fullPrompt
    });
    res.json({ reply: response.text.trim() });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Tutor is unavailable. Please try again.' });
  }
});


// --- OPPOSITE DAY GENERATOR ---
app.post('/api/opposite-day', async (req, res) => {
  const { text, vocabList } = req.body;
  if (!text || text.length < 20) return res.status(400).json({ error: 'Text too short.' });
  const terms = vocabList && vocabList.length > 0
    ? `Focus on replacing these key words with their opposites: ${vocabList.map(v => v.term).join(', ')}.`
    : '';
  try {
    const prompt = `Rewrite this passage by replacing vocabulary words with their antonyms or opposite concepts. Make the result subtly absurd and fun ??? the meaning should flip but the sentence structure should stay readable. ${terms}

Original: "${text}"

Return ONLY the rewritten passage as plain text.`;
    const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
    res.json({ opposite: response.text.trim() });
  } catch (err) {
    console.error('Opposite day error:', err);
    res.status(500).json({ error: 'Opposite Day generation failed.' });
  }
});

// NEW: Contextual Story Generation
app.post('/api/story', async (req, res) => {
  const { words } = req.body;
  if (!words || !Array.isArray(words) || words.length === 0) {
    return res.status(400).json({ error: "No words provided to generate a story." });
  }

  try {
    const prompt = `
      Write a short, engaging paragraph or very short story (maximum 150 words) 
      that correctly integrates all of the following vocabulary words:
      ${words.join(', ')}.
      Make the context clear enough so the meaning of the words is reinforced. 
      Do not use any markdown formatting, just return plain text.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    res.json({ story: response.text });
  } catch (error) {
    console.error("Error generating story:", error);
    res.status(500).json({ error: "Story generation failed." });
  }
});

// UPGRADED: Save session WITH User ID
app.post('/api/history', verifyToken, async (req, res) => {
  const { snippet, words } = req.body;
  const userId = req.user.uid; // Get UID from verified token
  if (!words || words.length === 0) return res.status(400).json({ error: "No words to save." });

  try {
    const newSession = {
      snippet,
      words,
      userId, // Attach the user's ID to this specific list
      createdAt: admin.firestore.FieldValue.serverTimestamp() 
    };
    
    const docRef = await sessionsCollection.add(newSession);
    res.json({ success: true, id: docRef.id });
  } catch (err) {
    console.error("Error saving session to database:", err);
    res.status(500).json({ error: "Failed to save to database. Please check the server logs for more details." });
  }
});

// UPGRADED: Get history ONLY for the logged-in user
// No .orderBy() - requires composite index. Sort in JS instead.
app.get('/api/history', verifyToken, async (req, res) => {
  const userId = req.user.uid;
  try {
    const snapshot = await sessionsCollection.where('userId', '==', userId).get();
    let history = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      history.push({
        id: doc.id,
        _ts: data.createdAt ? data.createdAt.toMillis() : 0,
        date: data.createdAt ? data.createdAt.toDate().toLocaleDateString() : new Date().toLocaleDateString(),
        snippet: data.snippet,
        words: data.words
      });
    });
    history.sort((a, b) => b._ts - a._ts);
    history = history.slice(0, 20).map(({ _ts, ...rest }) => rest);
    res.json(history);
  } catch (err) {
    console.error('Error fetching history:', err);
    res.status(500).json({ error: 'Failed to fetch history.' });
  }
});

// Get a specific session by ID
app.get('/api/history/:id', verifyToken, async (req, res) => {
  try {
    const doc = await sessionsCollection.doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Session not found' });
    const sessionData = doc.data();
    if (sessionData.userId !== req.user.uid) return res.status(403).json({ error: 'Forbidden.' });
    res.json({ id: doc.id, ...sessionData });
  } catch (err) {
    console.error('Error fetching session by ID:', err);
    res.status(500).json({ error: 'Invalid ID format or database error.' });
  }
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// PROFILE ENDPOINTS
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// GET /api/profile â€” fetch user's profile preferences
app.get('/api/profile', verifyToken, async (req, res) => {
  const uid = req.user.uid;
  try {
    const doc = await db.collection('userProfiles').doc(uid).get();
    if (!doc.exists) return res.json({});
    res.json(doc.data());
  } catch (err) {
    console.error('Profile fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch profile.' });
  }
});

// POST /api/profile â€” save/update profile preferences (merge)
app.post('/api/profile', verifyToken, async (req, res) => {
  const uid = req.user.uid;
  const allowed = ['displayName', 'avatarId', 'voiceId'];
  const updates = {};
  allowed.forEach(k => { if (req.body[k] != null) updates[k] = req.body[k]; });
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No valid fields.' });
  try {
    await db.collection('userProfiles').doc(uid).set(updates, { merge: true });
    res.json({ success: true });
  } catch (err) {
    console.error('Profile save error:', err);
    res.status(500).json({ error: 'Failed to save profile.' });
  }
});



// UPGRADED: Clear ONLY the logged-in user's history
app.delete('/api/history', verifyToken, async (req, res) => {
  const userId = req.user.uid; // Get UID from verified token

  try {
    const snapshot = await sessionsCollection.where('userId', '==', userId).get();
    const batch = db.batch();
    
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    
    res.json({ success: true, message: "User library cleared" });
  } catch (err) {
    console.error("Error clearing user library:", err);
    res.status(500).json({ error: "Failed to clear library. Please check the server logs." });
  }
});


// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// DAILY WORD CHALLENGE ENDPOINTS
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// GET /api/daily-word â€” returns today's word (cached in Firestore, shared by all users)
app.get('/api/daily-word', async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const docRef = db.collection('dailyWords').doc(today);
  try {
    const snap = await docRef.get();
    if (snap.exists) return res.json(snap.data());

    const prompt = `You are a vocabulary teacher. Generate a challenging English word for today's Daily Word Challenge.
Return a JSON object with EXACTLY these fields (no markdown, no extra text):
{
  "word": "the vocabulary word",
  "phonetic": "/pronunciation/",
  "definition": "clear, one-sentence definition",
  "wrongChoices": ["wrong def 1", "wrong def 2", "wrong def 3"],
  "sentence": "A sentence with the word replaced by ___ so users fill in the blank.",
  "partOfSpeech": "noun/verb/adjective/etc"
}
Choose a sophisticated but real English word. wrongChoices should be plausible but clearly wrong. sentence must contain exactly ___ (three underscores) for the blank.`;

    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });
    const raw = result.response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const jsonStr = raw.replace(/```json|```/g, '').trim();
    const wordData = JSON.parse(jsonStr);
    wordData.date = today;
    wordData.generatedAt = new Date().toISOString();
    await docRef.set(wordData);
    res.json(wordData);
  } catch (err) {
    console.error('Error generating daily word:', err);
    res.status(500).json({ error: 'Failed to generate daily word.' });
  }
});

// GET /api/challenge/leaderboard?type=global|weekly â€” top 10 entries
app.get('/api/challenge/leaderboard', async (req, res) => {
  const type = req.query.type === 'weekly' ? 'weekly' : 'global';
  try {
    if (type === 'global') {
      const snap = await db.collection('challengeLeaderboard')
        .orderBy('totalCorrect', 'desc').limit(10).get();
      const entries = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
      res.json({ entries });
    } else {
      const now = new Date();
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const weekNum = Math.ceil(((now - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
      const weekKey = `${now.getFullYear()}-W${String(weekNum).padStart(2,'0')}`;
      const snap = await db.collection('challengeWeekly').doc(weekKey)
        .collection('entries').orderBy('weeklyScore', 'desc').limit(10).get();
      const entries = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
      res.json({ entries, weekKey });
    }
  } catch (err) {
    console.error('Error fetching leaderboard:', err);
    res.status(500).json({ error: 'Failed to fetch leaderboard.' });
  }
});

// POST /api/challenge/submit â€” record a completed daily challenge attempt
app.post('/api/challenge/submit', verifyToken, async (req, res) => {
  const uid = req.user.uid;
  const { mcqCorrect, sentenceCorrect, date } = req.body;
  if (!date) return res.status(400).json({ error: 'date required' });

  try {
    const userRef = db.collection('challengeUsers').doc(uid);
    const snap = await userRef.get();
    const today = new Date().toISOString().slice(0, 10);
    let data = snap.exists ? snap.data() : {
      totalCorrect: 0, currentStreak: 0, longestStreak: 0,
      rankPoints: 0, lastPlayedDate: null, rankResetDate: new Date().toISOString(),
      displayName: req.user.name || 'Anonymous',
      photoURL: req.user.picture || null,
      weeklyScore: 0, weeklyResetDate: null
    };

    if (data.lastPlayedDate === today) {
      return res.json({ alreadyPlayed: true, data });
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toISOString().slice(0,10);
    if (data.lastPlayedDate === yStr) {
      data.currentStreak = (data.currentStreak || 0) + 1;
    } else {
      data.currentStreak = 1;
    }
    data.longestStreak = Math.max(data.longestStreak || 0, data.currentStreak);
    data.lastPlayedDate = today;

    const pointsEarned = (mcqCorrect ? 1 : 0) + (sentenceCorrect ? 1 : 0);
    data.totalCorrect = (data.totalCorrect || 0) + pointsEarned;
    data.rankPoints = (data.rankPoints || 0) + pointsEarned;

    // 6-month rank drop (6 tiers) check
    const resetDate = new Date(data.rankResetDate || new Date());
    const monthsElapsed = (new Date() - resetDate) / (1000 * 60 * 60 * 24 * 30);
    if (monthsElapsed >= 6) {
      data.rankPoints = Math.max(0, (data.rankPoints || 0) - 6);
      data.rankResetDate = new Date().toISOString();
    }

    // Weekly score tracking
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const weekNum = Math.ceil(((now - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
    const weekKey = `${now.getFullYear()}-W${String(weekNum).padStart(2,'0')}`;
    if (data.weeklyResetDate !== weekKey) {
      data.weeklyScore = 0;
      data.weeklyResetDate = weekKey;
    }
    data.weeklyScore = (data.weeklyScore || 0) + pointsEarned;

    await userRef.set(data, { merge: true });

    const lbRef = db.collection('challengeLeaderboard').doc(uid);
    await lbRef.set({
      displayName: data.displayName, photoURL: data.photoURL,
      totalCorrect: data.totalCorrect, currentStreak: data.currentStreak,
      rankPoints: data.rankPoints
    }, { merge: true });

    const wlRef = db.collection('challengeWeekly').doc(weekKey).collection('entries').doc(uid);
    await wlRef.set({
      displayName: data.displayName, photoURL: data.photoURL,
      weeklyScore: data.weeklyScore
    }, { merge: true });

    res.json({ success: true, data, pointsEarned });
  } catch (err) {
    console.error('Error submitting challenge:', err);
    res.status(500).json({ error: 'Failed to submit challenge.' });
  }
});

// GET /api/challenge/me â€” get current user's challenge data
app.get('/api/challenge/me', verifyToken, async (req, res) => {
  try {
    const snap = await db.collection('challengeUsers').doc(req.user.uid).get();
    if (!snap.exists) return res.json({ newUser: true });
    res.json(snap.data());
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user data.' });
  }
});



// 404 handler — must be last route
app.use((req, res) => {
  if (req.accepts('html')) {
    res.status(404).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>404 – Page Not Found | Decipher</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      min-height: 100vh; display: flex; align-items: center; justify-content: center;
      background: #0a0a0f; color: #fff;
      font-family: 'Inter', -apple-system, sans-serif; text-align: center; padding: 24px;
    }
    .container { max-width: 480px; }
    .code { font-size: 7rem; font-weight: 900; line-height: 1;
      background: linear-gradient(135deg, #6C8EFF, #A78BFA);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    h1 { font-size: 1.5rem; margin: 16px 0 8px; }
    p { color: rgba(255,255,255,0.5); font-size: 0.95rem; margin-bottom: 32px; }
    a { display: inline-block; padding: 12px 28px;
      background: linear-gradient(135deg, #6C8EFF, #A78BFA);
      color: #fff; border-radius: 12px; text-decoration: none;
      font-weight: 600; transition: opacity 0.2s; }
    a:hover { opacity: 0.85; }
  </style>
</head>
<body>
  <div class="container">
    <div class="code">404</div>
    <h1>Page not found</h1>
    <p>The page you're looking for doesn't exist or has been moved.</p>
    <a href="/">Go back home</a>
  </div>
</body>
</html>`);
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});
// Only start the HTTP server when running locally (not on Vercel)
if (require.main === module) {
  app.listen(PORT, () => console.log('Backend running on http://localhost:' + PORT));
}

module.exports = app;
