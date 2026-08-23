# `spidey.js` — Spidey-Sense Animation

**File:** `modules/spidey.js`

A visual feedback animation triggered after each quiz answer. The "spidey-sense" effect is a nod to the Spider-Man "tingle" — a brief particle burst or visual ripple that celebrates correct answers and signals wrong ones.

---

## Public API

### `initSpidey(canvasId?)`
Initializes the Spidey animation system.

### `triggerSpidey({ isCorrect, word })`
Fires the animation based on the quiz answer result.

| Param | Type | Description |
|-------|------|-------------|
| `isCorrect` | boolean | `true` → celebration burst, `false` → red shake effect. |
| `word` | string | The word that was being quizzed (used for labeling). |

The animation is registered as the spidey callback in `quiz.js` via `setSpideyCallback(triggerSpidey)`.
