# `profile.js` — User Profile

**File:** `modules/profile.js`

Manages the user profile modal: display name, avatar selection, and preferred TTS voice. Profile data is persisted to Firestore via `/api/profile`.

---

## Features

- Display name editing with live preview.
- Avatar selection from a grid of pre-set illustrated avatars.
- Voice preference selector (TTS voice used by the voice assistant).
- Persistent save/load via the authenticated `/api/profile` endpoint.

---

## Public API

### `initProfile(auth)`
Initializes the profile module with the Firebase auth instance.

### `showProfileModal()`
Opens the profile editing modal.

### `loadProfile()`
Fetches the user's profile from Firestore and populates the form fields.

### `saveProfile()`
Validates and saves the current form values to Firestore.
