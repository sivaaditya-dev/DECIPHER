const fs = require('fs');

// 1. UPDATE index.html
let html = fs.readFileSync('index.html', 'utf8');

// Replace Google Fonts
html = html.replace(
  '<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">',
  '<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Barlow:wght@300;400;500;600&display=swap" rel="stylesheet">'
);

// Replace hero background layer with Video
html = html.replace(
  '<div class="hero-bg-layer" id="heroBg"></div>',
  `<video autoPlay loop muted playsInline class="hero-bg-video">
      <source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260307_083826_e938b29f-a43a-41ec-a153-3d4730578ab8.mp4" type="video/mp4">
    </video>`
);

// Update title typography classes
html = html.replace('font-family:\'Space Grotesk\'', 'font-family:\'Instrument Serif\'; font-style:italic');
html = html.replace('font-family:\'Space Grotesk\'', 'font-family:\'Instrument Serif\'; font-style:italic');

// Apply liquid-glass styles
html = html.replace(/class="glass/g, 'class="liquid-glass');
html = html.replace(/btn-primary/g, 'btn-primary liquid-glass-strong');

fs.writeFileSync('index.html', html);
console.log('✅ index.html updated with typography and video bg.');

// 2. UPDATE styles.css
let css = fs.readFileSync('styles.css', 'utf8');

// Replace font-families
css = css.replace(/Space Grotesk/g, 'Instrument Serif');
css = css.replace(/Inter/g, 'Barlow');

// Update dark theme palette to Luxury Dark (Black + White + Liquid Glass)
const darkPaletteRegex = /:root\{[\s\S]*?\}/;
const newDarkPalette = `:root {
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
css = css.replace(darkPaletteRegex, newDarkPalette);

// Add liquid-glass classes
const liquidGlassCSS = `
/* Liquid Glass Utility Classes */
.liquid-glass {
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
.hero-bg-video {
  position: absolute; top: 15%; left: 0; width: 100%; height: 100%;
  object-fit: contain; z-index: 0; opacity: 0.6; mix-blend-mode: screen;
}
.hero-title { font-style: italic; letter-spacing: -1px; }
h1, h2, h3, h4, .vocab-term { font-style: italic; }
.vocab-term { text-transform: lowercase; font-size: 20px; }
`;
css = css + '\\n' + liquidGlassCSS;

fs.writeFileSync('styles.css', css);
console.log('✅ styles.css updated with liquid-glass and luxury dark theme.');
