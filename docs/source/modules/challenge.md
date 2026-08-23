# `challenge.js` — Daily Word Challenge

**File:** `modules/challenge.js`

Manages the Daily Word Challenge feature: rendering the daily word card, handling MCQ and fill-in-the-blank answers, updating streak/rank, and displaying the leaderboard.

---

## Feature Overview

Every day, Gemini generates a new challenging English word (shared by all users, cached in Firestore). Users answer **two questions**:

1. **MCQ** — Pick the correct definition from 4 choices.
2. **Sentence** — Fill in the blank in an example sentence.

Each correct answer awards **1 point**. Points accumulate into a **rank system** with a 6-month decay mechanic.

---

## Rank System

| Tier | Points Required |
|------|----------------|
| 🥉 Bronze | 0–4 |
| 🥈 Silver | 5–14 |
| 🥇 Gold | 15–29 |
| 💎 Diamond | 30–59 |
| 🏆 Legend | 60+ |

Rank points decay by 6 every 6 months to keep the leaderboard competitive.

---

## Public API

### `initChallenge(auth)`
Bootstraps the challenge module, loads today's word and the user's challenge data.

### `renderLeaderboard(type)`
Fetches and renders the top-10 leaderboard.

| Param | Options |
|-------|---------|
| `type` | `'global'` \| `'weekly'` |
