/**
 * Toast Notification System
 * Replaces all alert() calls with a lightweight, non-intrusive toast UI.
 */

let container = null;

function getContainer() {
  if (!container) {
    container = document.getElementById('toast-container');
  }
  return container;
}

/**
 * Show a toast notification.
 * @param {string} message - The message to display.
 * @param {'info'|'success'|'error'|'warning'} type - Toast style.
 * @param {number} duration - How long (ms) before auto-dismiss.
 */
export function showToast(message, type = 'info', duration = 3500) {
  const c = getContainer();
  if (!c) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
  };

  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span class="toast-message">${message}</span>
    <button class="toast-close" aria-label="Dismiss">✕</button>
  `;

  toast.querySelector('.toast-close').addEventListener('click', () => dismiss(toast));

  c.appendChild(toast);

  // Trigger entrance animation
  requestAnimationFrame(() => toast.classList.add('toast-show'));

  // Auto-dismiss after duration
  setTimeout(() => dismiss(toast), duration);
}

function dismiss(toast) {
  toast.classList.remove('toast-show');
  toast.classList.add('toast-hide');
  toast.addEventListener('transitionend', () => toast.remove(), { once: true });
}
