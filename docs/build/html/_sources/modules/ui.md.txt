# `ui.js` — Shared UI Utilities

**File:** `modules/ui.js`

Houses miscellaneous UI helpers used across the application that don't belong to any single feature module.

---

## Responsibilities

- **Theme Switching** — Applies the active theme class (`theme-dark`, `theme-sakura`, `theme-red`) to `document.body` and persists the choice to `localStorage`.
- **Scroll Effects** — Adds/removes CSS classes on the nav bar based on scroll position (e.g. adding a `scrolled` class for the glassmorphism blur effect).
- **Navigation Toggle** — Opens/closes the mobile hamburger menu.
- **Intersection Observer** — Animates elements into view as the user scrolls the landing page (fade-in-up transitions).

---

## Public API

### `initUI()`
Must be called once at startup. Wires all scroll and resize listeners, applies the saved theme, and initialises intersection observers.

### `setTheme(themeName)`
Programmatically switch the active theme.

| Param | Options |
|-------|---------|
| `themeName` | `'dark'` \| `'sakura'` \| `'red'` |
