# UI & Themes

Decipher ships with a **luxury editorial design system** built in Vanilla CSS (`styles.css`, ~3500 lines). This page documents the theming system, design tokens, and key UI patterns.

---

## Themes

Three themes are available, switchable at runtime via `ui.js`'s `setTheme()`:

| Theme | Class on `body` | Palette |
|-------|-----------------|---------|
| 🌑 **Cyber Dark** | `theme-dark` (default) | Deep navy/black background, electric blue accent `#6C8EFF`, frosted glass cards |
| 🌸 **Sakura Light** | `theme-sakura` | Warm peach `#FDF0E8` background, espresso brown `#4A2C2A` text, rose accent |
| 🔴 **Matte Red** | `theme-red` | Dark charcoal background, vivid crimson `#E53935` accent |

Theme preference is saved to `localStorage` as `decipher-theme` and restored on next load.

---

## Design Tokens (CSS Custom Properties)

All colours and spacings are set as CSS variables on `:root` (overridden per theme):

```css
:root {
  --bg:       #0a0e1a;   /* Page background */
  --surface:  #111827;   /* Card background */
  --accent:   #6C8EFF;   /* Primary accent colour */
  --text:     #e2e8f0;   /* Body text */
  --text-dim: #94a3b8;   /* Muted / secondary text */
  --border:   rgba(255,255,255,0.08);
  --glass:    rgba(255,255,255,0.05);  /* Glassmorphism fill */
}
```

---

## Glassmorphism Cards

Vocabulary cards and the navigation bar use the glassmorphism effect:

```css
.vocab-card {
  background: var(--glass);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--border);
  border-radius: 16px;
}
```

---

## Navigation

The nav bar (`<nav class="navbar">`) is fixed at the top. It gains a `scrolled` class after 50px of scroll, which increases the blur and adds a subtle shadow. Links are highlighted based on the active view.

---

## View System

Decipher is a **Single Page Application**. Views are `<section>` elements:

| Section ID | View |
|------------|------|
| `landingSection` | Landing / Home |
| `studioView` | Text input + Vocabulary Studio |
| `dojoView` | Quiz Dojo |
| `libraryView` | Saved Sessions Library |
| `aboutView` | About page |

`main.js`'s `decipherNav(viewId)` shows one section at a time by toggling a `hidden` class.

---

## Typography

- **Font:** [Inter](https://fonts.google.com/specimen/Inter) (loaded from Google Fonts) — clean, modern, highly legible.
- **Headings:** Semi-bold (600) with tight letter-spacing.
- **Body:** Regular (400) at 16px base size.

---

## Animations & Micro-interactions

| Element | Effect |
|---------|--------|
| Vocab cards | `slideInUp` on appear, hover lifts with box-shadow |
| Hero section | Full-screen looping video background |
| Galaxy canvas | Interactive 3D star particle system |
| Auth modal | Scale + opacity transition on open/close |
| Quiz options | Colour-flip animation on selection (green = correct, red = wrong) |
| Toast | Slides in from bottom-right, fades out |
| Nav links | Underline slide-in hover effect |
