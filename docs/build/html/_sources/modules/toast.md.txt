# `toast.js` — Toast Notifications

**File:** `modules/toast.js`

A lightweight, zero-dependency toast notification utility.

---

## Public API

### `showToast(message, type?, duration?)`

Displays a brief notification at the bottom of the screen.

| Param | Type | Default | Options |
|-------|------|---------|---------|
| `message` | string | — | Any string. |
| `type` | string | `'info'` | `'info'` \| `'success'` \| `'warning'` \| `'error'` |
| `duration` | number | `3500` | Milliseconds until auto-dismiss. |

**Example:**

```js
import { showToast } from './toast.js';

showToast('Session saved!', 'success');
showToast('You need at least 4 words.', 'warning', 5000);
```

Toasts stack vertically and auto-dismiss. Clicking a toast closes it immediately.
