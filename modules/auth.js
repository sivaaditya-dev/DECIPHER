/**
 * auth.js — Multi-Provider Auth Module
 * 
 * Supports:
 *  - Google OAuth (Firebase)
 *  - GitHub OAuth (Firebase — requires GitHub provider enabled in Firebase Console)
 *  - Email / Password (Firebase)
 * 
 * Exposes:
 *  - initAuth(firebaseApp, onUserChanged)
 *  - showAuthModal(mode) — 'signin' | 'signup'
 *  - handleAuthButtonClick()
 *  - getCurrentUser()
 */

import { showToast } from './toast.js';
import { setAuth } from './api.js';

let auth = null;
let googleProvider = null;
let currentUser = null;
let onUserChangedCallback = null;
let modalEl = null;
let currentMode = 'signin'; // 'signin' | 'signup'

// ─── Init ──────────────────────────────────────────────────────────────────────
export function initAuth(firebaseApp, onUserChanged) {
  auth = firebaseApp.auth();
  googleProvider = new firebase.auth.GoogleAuthProvider();

  setAuth(auth);
  onUserChangedCallback = onUserChanged;

  auth.onAuthStateChanged((user) => {
    currentUser = user;
    onUserChanged(user);
  });

  // Build the modal DOM once
  _buildModal();
}

export function getCurrentUser() {
  return currentUser;
}

// ─── Show Auth Modal ───────────────────────────────────────────────────────────
export function showAuthModal(mode = 'signin') {
  if (currentUser) {
    // Already logged in → sign out instead
    _doSignOut();
    return;
  }
  currentMode = mode;
  if (!modalEl) _buildModal();
  _renderModalContent();
  modalEl.classList.add('auth-modal-open');
  document.body.style.overflow = 'hidden';
  // Focus first input after animation
  setTimeout(() => modalEl.querySelector('input')?.focus(), 300);
}

export function hideAuthModal() {
  if (!modalEl) return;
  modalEl.classList.remove('auth-modal-open');
  document.body.style.overflow = '';
}

// Keep backward compat
export function handleAuthButtonClick() {
  if (currentUser) {
    _doSignOut();
  } else {
    showAuthModal('signin');
  }
}

// ─── Sign Out ──────────────────────────────────────────────────────────────────
function _doSignOut() {
  auth.signOut()
    .then(() => showToast('Signed out successfully.', 'info'))
    .catch((err) => {
      console.error('Sign out error:', err);
      showToast('Failed to sign out. Please try again.', 'error');
    });
}

// ─── Build Modal DOM ───────────────────────────────────────────────────────────
function _buildModal() {
  if (modalEl) return;
  modalEl = document.createElement('div');
  modalEl.id = 'authModal';
  modalEl.className = 'auth-modal-backdrop';
  modalEl.innerHTML = `<div class="auth-modal-box" role="dialog" aria-modal="true" aria-label="Authentication"></div>`;
  document.body.appendChild(modalEl);

  // Close on backdrop click
  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) hideAuthModal();
  });

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalEl.classList.contains('auth-modal-open')) hideAuthModal();
  });
}

// ─── Render Modal Content ──────────────────────────────────────────────────────
function _renderModalContent() {
  const box = modalEl.querySelector('.auth-modal-box');
  const isSignIn = currentMode === 'signin';

  box.innerHTML = `
    <!-- Header -->
    <div class="am-header">
      <div class="am-logo">
        <svg viewBox="0 0 36 36" width="32" height="32" fill="none">
          <circle cx="18" cy="18" r="17" stroke="rgba(255,255,255,0.15)" stroke-width="1.5"/>
          <path d="M18 8 L22 14 L30 15 L24 21 L26 29 L18 25 L10 29 L12 21 L6 15 L14 14 Z" 
                fill="none" stroke="#6C8EFF" stroke-width="1.5" stroke-linejoin="round"/>
          <circle cx="18" cy="18" r="3" fill="#6C8EFF" opacity="0.8"/>
        </svg>
        <span class="am-logo-text">Decipher</span>
      </div>
      <button class="am-close-btn" id="amCloseBtn" aria-label="Close">✕</button>
    </div>

    <!-- Title -->
    <h2 class="am-title">${isSignIn ? 'Sign in to your account' : 'Create your account'}</h2>
    <p class="am-subtitle">${isSignIn ? 'Welcome back! Pick up where you left off.' : 'Join the community. Start mastering words today.'}</p>

    <!-- OAuth Providers -->
    <div class="am-providers">
      <button class="am-provider-btn am-google" id="amGoogleBtn">
        <svg viewBox="0 0 24 24" width="20" height="20">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Continue with Google
      </button>
    </div>

    <!-- Divider -->
    <div class="am-divider"><span>or</span></div>

    <!-- Email Form -->
    <form class="am-form" id="amForm" novalidate>
      ${!isSignIn ? `
      <div class="am-field">
        <label class="am-label" for="amFullName">Full name</label>
        <input class="am-input" type="text" id="amFullName" name="fullName" 
               placeholder="Your full name" autocomplete="name" required/>
      </div>` : ''}
      <div class="am-field">
        <label class="am-label" for="amEmail">Email address</label>
        <input class="am-input" type="email" id="amEmail" name="email" 
               placeholder="you@example.com" autocomplete="email" required/>
      </div>
      <div class="am-field">
        <label class="am-label" for="amPassword">
          Password
          ${isSignIn ? '<button type="button" class="am-forgot" id="amForgotBtn">Forgot password?</button>' : ''}
        </label>
        <div class="am-input-wrap">
          <input class="am-input" type="password" id="amPassword" name="password"
                 placeholder="${isSignIn ? 'Your password' : 'Create a password (min. 8 chars)'}"
                 autocomplete="${isSignIn ? 'current-password' : 'new-password'}" required minlength="8"/>
          <button type="button" class="am-pw-toggle" id="amPwToggle" aria-label="Show password">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
            </svg>
          </button>
        </div>
      </div>
      ${!isSignIn ? `
      <div class="am-field">
        <label class="am-label" for="amConfirmPw">Confirm password</label>
        <div class="am-input-wrap">
          <input class="am-input" type="password" id="amConfirmPw" name="confirmPw"
                 placeholder="Repeat your password" autocomplete="new-password" required/>
        </div>
      </div>` : ''}
      
      <div class="am-error" id="amError" style="display:none"></div>

      <button type="submit" class="am-submit-btn" id="amSubmitBtn">
        <span id="amSubmitText">${isSignIn ? 'Sign in' : 'Create account'}</span>
        <span class="am-submit-spinner" id="amSpinner" style="display:none">
          <svg class="am-spin" viewBox="0 0 24 24" width="18" height="18" fill="none">
            <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" stroke-width="3"/>
            <path d="M12 2a10 10 0 0 1 10 10" stroke="white" stroke-width="3" stroke-linecap="round"/>
          </svg>
        </span>
      </button>
    </form>

    <!-- Toggle Sign In / Sign Up -->
    <div class="am-toggle">
      ${isSignIn 
        ? `New here? <button type="button" class="am-toggle-btn" id="amToggleMode">Create an account</button>`
        : `Already have an account? <button type="button" class="am-toggle-btn" id="amToggleMode">Sign in</button>`
      }
    </div>

    <!-- Terms (sign up only) -->
    ${!isSignIn ? `<p class="am-terms">By creating an account you agree to our <a href="#" class="am-link" id="amTermsLink">Terms of Service</a>.</p>` : ''}
  `;

  // ── Wire events ──────────────────────────────────────────────────────────────
  box.querySelector('#amCloseBtn').addEventListener('click', hideAuthModal);

  box.querySelector('#amGoogleBtn').addEventListener('click', () => _signInWithProvider(googleProvider, 'Google'));

  box.querySelector('#amForm').addEventListener('submit', (e) => {
    e.preventDefault();
    isSignIn ? _doEmailSignIn() : _doEmailSignUp();
  });

  box.querySelector('#amToggleMode').addEventListener('click', () => {
    currentMode = isSignIn ? 'signup' : 'signin';
    _renderModalContent();
  });

  const pwToggle = box.querySelector('#amPwToggle');
  const pwInput = box.querySelector('#amPassword');
  if (pwToggle && pwInput) {
    pwToggle.addEventListener('click', () => {
      const isHidden = pwInput.type === 'password';
      pwInput.type = isHidden ? 'text' : 'password';
    });
  }

  const forgotBtn = box.querySelector('#amForgotBtn');
  if (forgotBtn) {
    forgotBtn.addEventListener('click', _doForgotPassword);
  }

  const termsLink = box.querySelector('#amTermsLink');
  if (termsLink) {
    termsLink.addEventListener('click', (e) => {
      e.preventDefault();
      const m = document.getElementById('termsModal');
      if (m) m.style.display = 'flex';
    });
  }
}

// ─── OAuth Provider Sign In ────────────────────────────────────────────────────
function _signInWithProvider(provider, name) {
  _setLoading(true);
  auth.signInWithPopup(provider)
    .then((result) => {
      const firstName = result.user.displayName?.split(' ')[0] || 'there';
      showToast(`Welcome, ${firstName}! 🎉`, 'success');
      hideAuthModal();
    })
    .catch((err) => {
      if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
        console.error(`${name} login error:`, err);
        _showError(_friendlyError(err));
      }
    })
    .finally(() => _setLoading(false));
}

// ─── Email Sign In ─────────────────────────────────────────────────────────────
function _doEmailSignIn() {
  const email = document.getElementById('amEmail')?.value?.trim();
  const password = document.getElementById('amPassword')?.value;
  if (!email || !password) { _showError('Please fill in all fields.'); return; }

  _setLoading(true);
  auth.signInWithEmailAndPassword(email, password)
    .then((result) => {
      const firstName = result.user.displayName?.split(' ')[0] || 'back';
      showToast(`Welcome back, ${firstName}! 🎉`, 'success');
      hideAuthModal();
    })
    .catch((err) => {
      console.error('Email sign-in error:', err);
      _showError(_friendlyError(err));
    })
    .finally(() => _setLoading(false));
}

// ─── Email Sign Up ─────────────────────────────────────────────────────────────
function _doEmailSignUp() {
  const fullName = document.getElementById('amFullName')?.value?.trim();
  const email    = document.getElementById('amEmail')?.value?.trim();
  const password = document.getElementById('amPassword')?.value;
  const confirm  = document.getElementById('amConfirmPw')?.value;

  if (!fullName) { _showError('Please enter your full name.'); return; }
  if (!email)    { _showError('Please enter your email address.'); return; }
  if (!password || password.length < 8) { _showError('Password must be at least 8 characters.'); return; }
  if (password !== confirm) { _showError('Passwords do not match.'); return; }

  _setLoading(true);
  auth.createUserWithEmailAndPassword(email, password)
    .then(async (result) => {
      // Set display name
      await result.user.updateProfile({ displayName: fullName });
      showToast(`Account created! Welcome, ${fullName.split(' ')[0]}! 🎉`, 'success');
      hideAuthModal();
    })
    .catch((err) => {
      console.error('Email sign-up error:', err);
      _showError(_friendlyError(err));
    })
    .finally(() => _setLoading(false));
}

// ─── Forgot Password ───────────────────────────────────────────────────────────
function _doForgotPassword() {
  const email = document.getElementById('amEmail')?.value?.trim();
  if (!email) { _showError('Enter your email address above, then click Forgot Password.'); return; }

  auth.sendPasswordResetEmail(email)
    .then(() => {
      showToast(`Reset email sent to ${email} — check your inbox!`, 'success');
    })
    .catch((err) => {
      console.error('Password reset error:', err);
      _showError(_friendlyError(err));
    });
}

// ─── UI Helpers ────────────────────────────────────────────────────────────────
function _setLoading(loading) {
  const btn    = document.getElementById('amSubmitBtn');
  const text   = document.getElementById('amSubmitText');
  const spinner= document.getElementById('amSpinner');
  const githubBtn = document.getElementById('amGithubBtn');
  const googleBtn = document.getElementById('amGoogleBtn');
  if (!btn) return;
  btn.disabled = loading;
  if (text)    text.style.display = loading ? 'none' : '';
  if (spinner) spinner.style.display = loading ? 'inline-flex' : 'none';
  if (githubBtn) githubBtn.disabled = loading;
  if (googleBtn) googleBtn.disabled = loading;
}

function _showError(msg) {
  const el = document.getElementById('amError');
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
  // Auto-clear after 6s
  clearTimeout(el._timeout);
  el._timeout = setTimeout(() => { el.style.display = 'none'; }, 6000);
}

function _friendlyError(err) {
  const map = {
    'auth/user-not-found':       'No account found with that email.',
    'auth/wrong-password':       'Incorrect password. Try again.',
    'auth/invalid-credential':   'Invalid email or password.',
    'auth/email-already-in-use': 'An account with that email already exists. Sign in instead.',
    'auth/weak-password':        'Password is too weak. Use at least 8 characters.',
    'auth/invalid-email':        'Please enter a valid email address.',
    'auth/too-many-requests':    'Too many attempts. Please wait a moment and try again.',
    'auth/network-request-failed': 'Network error. Check your connection.',
    'auth/account-exists-with-different-credential': 'An account already exists with this email using a different sign-in method.',
  };
  return map[err.code] || err.message || 'Something went wrong. Please try again.';
}

