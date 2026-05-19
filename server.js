require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const { YoutubeTranscript } = require('youtube-transcript');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');
const admin = require('firebase-admin');
const { Resend } = require('resend');
const cron = require('node-cron');


const app = express();
const PORT = process.env.PORT || 3000;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Multer instances — memory storage
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
try {
  const serviceAccount = require("./serviceAccountKey.json");
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log("✅ Connected to Firebase Firestore!");
} catch (error) {
  console.error("❌ ERROR: Could not load serviceAccountKey.json.");
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
      // EPUB is a ZIP with HTML inside — basic extraction
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
      You are a creative memory coach and linguistics expert. For each vocabulary word, create a vivid, memorable "Memory Hook" — a fun mental image, wordplay, or short story that connects the word's sound/spelling directly to its meaning.

      Rules:
      - Keep each mnemonic to 1-2 punchy sentences.
      - Use vivid imagery, humor, or surprising wordplay where possible.
      - The hook should make the meaning instantly recalled.
      - Do NOT just restate the definition. Be creative!

      Example: "Gregarious" (def: sociable, fond of company) →
      Mnemonic: "Think of GREG who's always HILARIOUS at parties — he never shuts up because he loves being around people!"

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
    : 'Rewrite this passage in clear, straightforward Modern English (B1–B2 level). Remove jargon, complex syntax, and archaic language. Keep all ideas intact — just make them easy to read.';

  try {
    const prompt = `${levelInstruction}\n\nPassage:\n"${text}"\n\nReturn ONLY the rewritten passage as plain text — no headings, no bullet points, no formatting.`;
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
      - Each sentence must be 10–22 words long.
      - Do NOT include the actual word anywhere else in the sentence.

      Example: "proliferate" →
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

  const systemPrompt = `You are "Decipher Tutor", the intelligent assistant built into Decipher — an AI vocabulary learning app.

You have two abilities:
1. ANSWER vocabulary and comprehension questions.
2. NAVIGATE/TRIGGER app features on behalf of the user.

== AVAILABLE ACTIONS ==
When you detect ANY navigational or feature-triggering intent, prepend the EXACT action tag at the very start of your reply (before anything else). Choose the single most relevant action:

[ACTION:navStudio]    — User wants to go to Studio (analyzer, input text, reading passage)
[ACTION:navQuiz]      — User wants to go to the Quiz page/tab
[ACTION:navLibrary]   — User wants to go to the Library (saved sessions)
[ACTION:navHome]      — User wants to go to the home/landing page
[ACTION:memoryHooks]  — User wants memory hooks, mnemonics, memory aids for words
[ACTION:quiz]         — User wants to start/take/begin the quiz immediately
[ACTION:translate]    — User wants to translate vocabulary words
[ACTION:story]        — User wants to generate a vocabulary story
[ACTION:simplify]     — User wants to simplify/rewrite the passage (ELI5, plain English)
[ACTION:oppositeDay]  — User wants antonyms or the Opposite Day feature

== CRITICAL RULES FOR ACTIONS ==
- Detect intent from ANY language (Tamil, Hindi, Spanish, French, Arabic, etc.) and ANY accent or phrasing variation.
- Examples of what to recognize:
  * "memory hooks" / "mnemonic" / "yaad karne ka tarika" / "moyens mnémotechniques" / "aide-mémoire" / "ways to remember" → [ACTION:memoryHooks]
  * "quiz" / "test me" / "pariksha" / "quiz karo" / "interrogation" / "practise" → [ACTION:quiz]
  * "translate" / "anuvad" / "traduire" / "traducir" → [ACTION:translate]
  * "library" / "saved" / "meri library" / "bibliothèque" → [ACTION:navLibrary]
  * "studio" / "analyzer" / "go back" / "input" → [ACTION:navStudio]
  * "simplify" / "ELI5" / "explain simple" / "aasaan bhasha" / "simple karo" → [ACTION:simplify]
  * "story" / "generate story" / "kahani" / "histoire" → [ACTION:story]
- If NO action is needed (user just asking a vocabulary question), do NOT include any [ACTION:...] tag.
- NEVER make up action tags. Only use the ones listed above.
- After the action tag, give a SHORT confirmation (1 sentence) + helpful tip if needed.
  Example: "[ACTION:memoryHooks] ✅ Navigating to Studio and generating Memory Hooks for your words!"

== CONTEXT ==
Active reading passage (first 1000 chars): "${passageSnippet}"
Vocabulary words being studied: ${contextWords}

== AS A TUTOR ==
- Help students understand words with vivid analogies and real-world examples.
- Use the Socratic method — ask occasional follow-up questions.
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
    const prompt = `Rewrite this passage by replacing vocabulary words with their antonyms or opposite concepts. Make the result subtly absurd and fun — the meaning should flip but the sentence structure should stay readable. ${terms}

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
app.get('/api/history', verifyToken, async (req, res) => {
  const userId = req.user.uid; // Get UID from verified token

  try {
    // Let Firestore do the sorting and limiting to save memory and read costs
    const snapshot = await sessionsCollection
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();
    
    let history = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      const dateString = data.createdAt ? data.createdAt.toDate().toLocaleDateString() : new Date().toLocaleDateString();
      
      history.push({
        id: doc.id,
        date: dateString,
        snippet: data.snippet,
        words: data.words
      });
    });

    res.json(history);
  } catch (err) {
    console.error("Error fetching history from database:", err);
    res.status(500).json({ error: "Failed to fetch history. Please check the server logs for more details." });
  }
});

// Get a specific session by ID (Unchanged)
app.get('/api/history/:id', verifyToken, async (req, res) => {
  try {
    const doc = await sessionsCollection.doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: "Session not found" });

    const sessionData = doc.data();
    // SECURITY CHECK: Ensure the user requesting the session is the one who owns it
    if (sessionData.userId !== req.user.uid) return res.status(403).json({ error: "Forbidden: You do not own this session." });
    res.json({ id: doc.id, ...sessionData });
  } catch (err) {
    console.error("Error fetching session by ID:", err);
    res.status(500).json({ error: "Invalid ID format or database error. Please check the server logs." });
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

// ═══════════════════════════════════════════════════════════════
// EMAIL SYSTEM — Resend + node-cron
// ═══════════════════════════════════════════════════════════════

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const APP_URL = process.env.APP_URL || 'http://localhost:3000';
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Decipher <onboarding@resend.dev>';

// ── EMAIL TEMPLATES ────────────────────────────────────────────
function welcomeEmailHTML(name) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Decipher</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:Arial,sans-serif;background:#05101e;color:#fff;}
    .wrap{max-width:600px;margin:0 auto;padding:40px 24px;}
    .logo{font-size:26px;font-weight:700;font-style:italic;margin-bottom:32px;letter-spacing:-0.5px;}
    .hero-text{font-size:34px;font-weight:700;line-height:1.2;margin-bottom:16px;letter-spacing:-0.5px;}
    .intro{font-size:15px;color:rgba(255,255,255,0.65);line-height:1.7;margin-bottom:32px;}
    .step{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:20px 22px;margin-bottom:12px;display:flex;align-items:flex-start;gap:16px;}
    .step-icon{font-size:24px;flex-shrink:0;margin-top:2px;}
    .step-title{font-size:15px;font-weight:600;margin-bottom:4px;}
    .step-desc{font-size:13px;color:rgba(255,255,255,0.55);line-height:1.6;}
    .cta{display:inline-block;background:#fff;color:#000;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;margin-top:28px;}
    .divider{height:1px;background:rgba(255,255,255,0.08);margin:32px 0;}
    .footer{font-size:12px;color:rgba(255,255,255,0.3);line-height:1.6;}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="logo">Decipher<sup style="font-size:9px;">®</sup></div>
    <h1 class="hero-text">Welcome, ${name}! 🎉<br>Let's unlock some words.</h1>
    <p class="intro">You've just gained access to an AI-powered vocabulary engine. Here are the 3 most powerful things you can do right now:</p>

    <div class="step">
      <div class="step-icon">✍️</div>
      <div>
        <div class="step-title">1. Open Studio and paste any text</div>
        <div class="step-desc">Upload a PDF, paste an article, or use the YouTube transcript feature. Gemini AI will extract and define all key vocabulary in seconds.</div>
      </div>
    </div>
    <div class="step">
      <div class="step-icon">💡</div>
      <div>
        <div class="step-title">2. Generate AI Memory Hooks</div>
        <div class="step-desc">After analyzing text, click "Memory Hooks" in Studio. Gemini creates a vivid mnemonic for every word — making them impossible to forget.</div>
      </div>
    </div>
    <div class="step">
      <div class="step-icon">🎯</div>
      <div>
        <div class="step-title">3. Head to the Quiz tab</div>
        <div class="step-desc">Test yourself across 3 quiz modes: Standard (multiple choice), Reverse (translation to English), and Smart Quiz (AI fill-in-the-blank sentences).</div>
      </div>
    </div>

    <a href="${APP_URL}" class="cta">Start Learning Now →</a>

    <div class="divider"></div>
    <div class="footer">
      <p>You received this because you signed up for Decipher with your Google account.</p>
      <p style="margin-top:8px;">© 2025 Decipher. AI Vocabulary Intelligence.</p>
    </div>
  </div>
</body>
</html>`;
}

function weeklyReportHTML(name, stats) {
  const { sessions, words, quizzes, topLang } = stats;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Weekly Decipher Report</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:Arial,sans-serif;background:#05101e;color:#fff;}
    .wrap{max-width:600px;margin:0 auto;padding:40px 24px;}
    .logo{font-size:26px;font-weight:700;font-style:italic;margin-bottom:32px;}
    .hero-text{font-size:28px;font-weight:700;line-height:1.25;margin-bottom:12px;}
    .intro{font-size:15px;color:rgba(255,255,255,0.65);line-height:1.7;margin-bottom:32px;}
    .stats-grid{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:28px;}
    .stat{flex:1;min-width:120px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:20px 18px;text-align:center;}
    .stat-n{font-size:36px;font-weight:700;line-height:1;margin-bottom:6px;}
    .stat-l{font-size:12px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.08em;}
    .tip{background:rgba(255,255,255,0.04);border-left:3px solid rgba(255,255,255,0.3);border-radius:0 10px 10px 0;padding:16px 18px;margin-bottom:20px;font-size:14px;color:rgba(255,255,255,0.7);line-height:1.6;}
    .cta{display:inline-block;background:#fff;color:#000;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;}
    .divider{height:1px;background:rgba(255,255,255,0.08);margin:28px 0;}
    .footer{font-size:12px;color:rgba(255,255,255,0.3);line-height:1.6;}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="logo">Decipher<sup style="font-size:9px;">®</sup></div>
    <h1 class="hero-text">Your Week in Review, ${name} 📊</h1>
    <p class="intro">Here's what you accomplished on Decipher this week. Keep going — every word you master is a door you unlock.</p>

    <div class="stats-grid">
      <div class="stat"><div class="stat-n">${sessions}</div><div class="stat-l">Sessions</div></div>
      <div class="stat"><div class="stat-n">${words}</div><div class="stat-l">Words Deciphered</div></div>
      <div class="stat"><div class="stat-n">${quizzes}</div><div class="stat-l">Quizzes Saved</div></div>
      <div class="stat"><div class="stat-n">${topLang || '—'}</div><div class="stat-l">Top Language</div></div>
    </div>

    <div class="tip">💡 <strong>Pro tip:</strong> Try the Smart Quiz mode this week — Gemini creates unique fill-in-the-blank sentences so every session is different.</div>

    <a href="${APP_URL}" class="cta">Continue Learning →</a>

    <div class="divider"></div>
    <div class="footer">
      <p>You're receiving this weekly digest because you use Decipher. You can disable it in your account settings.</p>
      <p style="margin-top:8px;">© 2025 Decipher. AI Vocabulary Intelligence.</p>
    </div>
  </div>
</body>
</html>`;
}

// ── WELCOME EMAIL ENDPOINT ─────────────────────────────────────
app.post('/api/send-welcome-email', async (req, res) => {
  if (!resend) return res.status(503).json({ error: 'Email service not configured. Add RESEND_API_KEY to .env' });
  const { name, email } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'name and email required' });
  try {
    const data = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `Welcome to Decipher, ${name.split(' ')[0]}! 🎉`,
      html: welcomeEmailHTML(name.split(' ')[0]),
    });
    console.log('✅ Welcome email sent to', email, data.id);
    res.json({ success: true, id: data.id });
  } catch (err) {
    console.error('Welcome email error:', err);
    res.status(500).json({ error: 'Failed to send welcome email.' });
  }
});

// ── WEEKLY REPORT CRON (every Sunday 9:00 AM IST = 3:30 AM UTC) ────────────
cron.schedule('30 3 * * 0', async () => {
  if (!resend) { console.log('[Cron] No RESEND_API_KEY — skipping weekly emails'); return; }
  console.log('[Cron] Starting weekly email reports...');
  try {
    const db = admin.firestore();
    // Get all users from Firebase Auth (page through)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const listResult = await admin.auth().listUsers(1000);
    let sent = 0;
    for (const user of listResult.users) {
      if (!user.email) continue;
      try {
        // Fetch their sessions from last 7 days
        const snapshot = await db.collection('sessions')
          .where('userId', '==', user.uid)
          .where('savedAt', '>=', admin.firestore.Timestamp.fromDate(sevenDaysAgo))
          .get();
        const sessions = snapshot.size;
        if (sessions === 0) continue; // skip inactive users
        let words = 0, quizzes = 0;
        const langCount = {};
        snapshot.forEach(doc => {
          const d = doc.data();
          words   += Array.isArray(d.vocab) ? d.vocab.length : 0;
          quizzes += d.quizTaken ? 1 : 0;
          if (d.translatedLang) langCount[d.translatedLang] = (langCount[d.translatedLang] || 0) + 1;
        });
        const topLang = Object.keys(langCount).sort((a,b) => langCount[b]-langCount[a])[0] || null;
        const firstName = (user.displayName || user.email).split(' ')[0];
        await resend.emails.send({
          from: FROM_EMAIL,
          to: user.email,
          subject: `Your weekly Decipher report — ${sessions} session${sessions !== 1 ? 's' : ''} this week 📊`,
          html: weeklyReportHTML(firstName, { sessions, words, quizzes, topLang }),
        });
        sent++;
        console.log(`  ✉️  Sent weekly report to ${user.email}`);
      } catch (userErr) {
        console.error(`  ❌ Failed for ${user.email}:`, userErr.message);
      }
    }
    console.log(`[Cron] Weekly reports done. Sent: ${sent}`);
  } catch (err) {
    console.error('[Cron] Weekly report failed:', err);
  }
}, { timezone: 'Asia/Kolkata' });

app.listen(PORT, () => console.log(`🚀 Backend running on http://localhost:${PORT}`));