# `galaxy.js` — Galaxy Animation

**File:** `modules/galaxy.js`

Renders an interactive 3D particle galaxy on the landing page hero canvas using the `requestAnimationFrame` loop and 2D Canvas API.

---

## Overview

The galaxy consists of hundreds of small star particles arranged in a spiral pattern. On mouse movement, the galaxy subtly rotates toward the cursor, creating a parallax depth effect.

---

## Public API

### `initGalaxy(canvasId)`
Initializes and starts the galaxy animation on the given canvas element.

| Param | Type | Description |
|-------|------|-------------|
| `canvasId` | string | The `id` attribute of the `<canvas>` element. |

The function sets up the particle system, attaches a `mousemove` listener to the window, and starts the render loop.

---

## Notes

- The animation is automatically paused via the Page Visibility API when the tab is hidden, to save CPU/GPU resources.
- On small screens (< 768px), the particle count is reduced for performance.
