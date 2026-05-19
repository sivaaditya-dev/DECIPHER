/**
 * Auth Module
 * Manages Firebase Google authentication and all related UI state.
 */

import { showToast } from './toast.js';
import { setAuth } from './api.js';

let auth = null;
let provider = null;
let currentUser = null;
let onUserChangedCallback = null;

/**
 * Initialize Firebase auth with the app instance.
 * @param {object} firebaseApp - already-initialized firebase app
 * @param {Function} onUserChanged - called with (user|null) on auth state change
 */
export function initAuth(firebaseApp, onUserChanged) {
  auth = firebaseApp.auth();
  provider = new firebase.auth.GoogleAuthProvider();
  setAuth(auth); // Pass auth instance to api.js for token retrieval
  onUserChangedCallback = onUserChanged;

  auth.onAuthStateChanged((user) => {
    currentUser = user;
    onUserChanged(user);
  });
}

/**
 * Get the currently signed-in user (or null).
 */
export function getCurrentUser() {
  return currentUser;
}

/**
 * Trigger Google sign-in popup or sign out, depending on current state.
 */
export function handleAuthButtonClick() {
  if (currentUser) {
    auth
      .signOut()
      .then(() => showToast('Signed out successfully.', 'info'))
      .catch((err) => {
        console.error('Sign out error:', err);
        showToast('Failed to sign out. Please try again.', 'error');
      });
  } else {
    auth
      .signInWithPopup(provider)
      .then(async (result) => {
        const firstName = result.user.displayName.split(' ')[0];
        showToast(`Welcome, ${firstName}! 🎉`, 'success');

        // Send welcome email only on very first sign-in
        const isNew = result.additionalUserInfo?.isNewUser;
        if (isNew && result.user.email) {
          try {
            await fetch('/api/send-welcome-email', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name:  result.user.displayName,
                email: result.user.email,
              }),
            });
            console.log('✅ Welcome email dispatched for', result.user.email);
          } catch (emailErr) {
            // Email failure is non-critical — don't block the user
            console.warn('Welcome email failed (non-critical):', emailErr);
          }
        }
      })
      .catch((err) => {
        if (err.code !== 'auth/popup-closed-by-user') {
          console.error('Login failed:', err);
          showToast('Login failed. Please try again.', 'error');
        }
      });
  }
}
