# `quiz.js` — Quiz Engine

**File:** `modules/quiz.js`

Implements three quiz modes driven by the user's vocabulary list. The modal UI is embedded in `index.html`; this module only controls its logic and state.

---

## Quiz Modes

| Mode | Prompt | Answer Type |
|------|--------|-------------|
| **Standard** | "What does `<term>` mean?" | Choose the correct English definition (4 choices) |
| **Reverse** | Shows the *translated* definition | Choose the correct English term (4 choices) |
| **SRS (Smart Quiz)** | Shows an AI fill-in-the-blank sentence | Choose the correct English term (4 choices) |

---

## Public API

### `setVocabList(list)`
Sets the full vocabulary list. Required before starting a quiz.

### `setTranslatedVocabList(list)`
Provides translated data for Reverse Mode. Also enables/disables the Reverse Mode tab button.

### `setSRSQuestions(questions)`
Provides pre-generated SRS sentences (`[{term, sentence}]`). Enables the SRS mode tab.

### `getMode()`
Returns the currently selected mode string: `'standard'` | `'reverse'` | `'srs'`.

### `startQuiz(srsSentences?)`
Opens the quiz modal and begins the session.

- Requires at least **4 words** in the vocab list.
- Randomly shuffles and picks up to **10 questions**.
- If mode is `'reverse'`, translated list must not be empty.
- If mode is `'srs'`, SRS questions must exist (either pre-loaded or passed as argument).

### `closeQuiz()`
Closes the quiz modal with a scale/fade animation.

### `initQuiz()`
Advances from the start screen to the first question.

### `nextQuestion()`
Moves to the next question or shows the end screen.

### `initQuizModeTabs()`
Wires click listeners to the three mode tab buttons (`modeStandard`, `modeReverse`, `modeSRS`).

---

## Spidey Integration

### `setSpideyCallback(fn)`
Registers a callback to be fired after each answer:

```js
setSpideyCallback(({ isCorrect, word }) => {
  // trigger a Spidey-sense animation
});
```

---

## Scoring

- Each correct answer increments `quizState.score`.
- At the end screen, score is shown as a percentage.
- Toast messages are shown based on performance:
  - **100%** → "Perfect! Flawless Mode!"
  - **≥ 70%** → "Great work!"
  - **< 70%** → Encouragement message.
