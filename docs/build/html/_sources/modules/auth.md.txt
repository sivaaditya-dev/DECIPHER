# `auth.js` — Authentication Module

**File:** `modules/auth.js`

Handles all user identity concerns: sign-in, sign-up, sign-out, and the auth modal UI. Supports three providers — Google OAuth, Email/Password, and password reset.

---

## Initialization

### `initAuth(firebaseApp, onUserChanged)`

Must be called once at app startup.

| Param | Type | Description |
|-------|------|-------------|
| `firebaseApp` | object | The initialized Firebase app instance. |
| `onUserChanged` | `(user) => void` | Callback fired whenever auth state changes (sign-in or sign-out). `user` is `null` when signed out. |

**Side effects:**
- Registers a `firebase.auth.onAuthStateChanged` listener.
- Calls `setAuth(auth)` to wire the `api.js` module for authenticated requests.
- Builds the modal DOM element (once, lazily).

---

## Modal Control

### `showAuthModal(mode?)`

Opens the sign-in / sign-up modal.

| Param | Default | Options |
|-------|---------|---------|
| `mode` | `'signin'` | `'signin'` \| `'signup'` |

If a user is already signed in, calling this will **sign them out** instead.

### `hideAuthModal()`

Closes the modal and restores page scroll.

### `handleAuthButtonClick()`

Convenience function wired to the auth button in the nav bar. Signs out if logged in, shows the sign-in modal if not.

---

## User State

### `getCurrentUser()`

**Returns:** The current Firebase `User` object, or `null` if signed out.

---

## Internal Flow

### Sign In with Google
Calls `auth.signInWithPopup(googleProvider)`. On success, hides the modal and shows a welcome toast.

### Email Sign In
Validates email + password, then calls `auth.signInWithEmailAndPassword()`.

### Email Sign Up
Validates all fields (name, email, password match), calls `auth.createUserWithEmailAndPassword()`, then `user.updateProfile({ displayName: fullName })`.

### Forgot Password
Calls `auth.sendPasswordResetEmail(email)` — the user receives a reset link.

---

## Error Handling

Firebase error codes are mapped to friendly human-readable messages:

| Firebase Code | Displayed Message |
|---------------|------------------|
| `auth/user-not-found` | No account found with that email. |
| `auth/wrong-password` | Incorrect password. Try again. |
| `auth/email-already-in-use` | An account with that email already exists. |
| `auth/weak-password` | Password is too weak. Use at least 8 characters. |
| `auth/too-many-requests` | Too many attempts. Please wait a moment. |
