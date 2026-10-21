# Decipher to Anki Import Guide

This guide walks through exporting your custom vocabulary decks from Decipher into **Anki** for cross-device spaced repetition study.

---

## 1. Exporting from Decipher

1. In Decipher, navigate to **Vocabulary Library** or analyze any study text.
2. Open the **Command Palette** (`Ctrl+K` or `Cmd+K`) and type **"Export to Anki"**, or click the **Export to Anki** button.
3. Decipher generates a compliant `.txt` file formatted with tab-separated columns (`Front`, `Back`, `Tags`).

---

## 2. Importing into Anki Desktop

1. Open **Anki Desktop**.
2. Click **File -> Import...** (`Ctrl+I`).
3. Select your exported file (e.g. `decipher_anki_vocabulary.txt`).
4. In the Anki Import dialog:
   - **Type**: Select `Basic` or `Basic (and reversed card)`.
   - **Deck**: Choose your destination deck or create a new one (e.g., `Decipher English`).
   - **Field mapping**:
     - Field 1 -> `Front`
     - Field 2 -> `Back`
     - Field 3 -> `Tags`
   - Ensure **"Allow HTML in fields"** is checked.
5. Click **Import**.

---

## 3. Features Included in Decipher Decks
- **IPA Phonetics**: Accurate phonetic pronunciation transcriptions.
- **Audio Hints**: Text-to-speech cues matching native US/UK accents.
- **Context Sentences**: Real-world usage examples.
- **CEFR Difficulty Tags**: Filter cards by A1, B1, C1, or C2 tiers.
