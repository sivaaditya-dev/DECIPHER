const fs = require('fs');

let css = fs.readFileSync('styles.css', 'utf8');

// Replace all font-family definitions
css = css.replace(/Space Grotesk/g, 'Instrument Serif');
css = css.replace(/Inter/g, 'Barlow');

// Apply luxury dark mode colors to :root
const darkRegex = /:root\s*\{[^}]+\}/;
const newDark = `:root {
  --bg: #000000;
  --surface: #0a0a0a;
  --card: rgba(255,255,255,0.03);
  --border: rgba(255,255,255,0.12);
  --accent: #ffffff;
  --accent-hover: rgba(255,255,255,0.9);
  --accent-glow: rgba(255,255,255,0.15);
  --accent-muted: rgba(255,255,255,0.05);
  --secondary: #a78bfa;
  --secondary-glow: rgba(167,139,250,0.22);
  --text-main: #ffffff;
  --text-muted: rgba(255,255,255,0.6);
  --red: #f87171; --amber: #fbbf24; --green: #34d399;
  --logo-c1: #ffffff; --logo-c2: rgba(255,255,255,0.6);
}`;
css = css.replace(darkRegex, newDark);

// Replace default .glass with .liquid-glass and add .liquid-glass-strong
const glassRegex = /\.glass\s*\{[^}]+\}/;
const newGlass = `.liquid-glass {
  background: rgba(255, 255, 255, 0.02);
  background-blend-mode: luminosity;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.05), 0 4px 30px rgba(0, 0, 0, 0.1);
}
.liquid-glass-strong {
  background: rgba(255, 255, 255, 0.05);
  background-blend-mode: luminosity;
  backdrop-filter: blur(30px);
  -webkit-backdrop-filter: blur(30px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: 4px 4px 4px rgba(0,0,0,0.1), inset 0 1px 1px rgba(255,255,255,0.2);
}
.glass {
  background: var(--card);
  backdrop-filter: blur(18px);
  border: 1px solid var(--border);
}`;
css = css.replace(glassRegex, newGlass);

// Append video background and typography overrides
const extraStyles = `
/* Luxury Typography & Video Background */
.hero-bg-video {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%;
  object-fit: cover; z-index: 0; opacity: 0.5; mix-blend-mode: screen;
}
.hero-title { font-style: italic; letter-spacing: -1px; }
h1, h2, h3, h4, .vocab-term { font-style: italic; }
.vocab-term { text-transform: lowercase; font-size: 20px; }
`;
css = css + '\n' + extraStyles;

// Update remaining glass classes that missed the replace in index.html (like panels)
// We already replaced in index.html, but let's make sure `.glass` works correctly anyway.

fs.writeFileSync('styles.css', css);
console.log('styles.css updated with agency-landing aesthetics');
