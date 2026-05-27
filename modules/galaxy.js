/**
 * galaxy.js — 3D Galaxy Word Map
 * 
 * Uses Three.js to render the user's vocabulary as an interactive star field.
 * Stars = words. Size & brightness = quiz accuracy. Click = word card flyout.
 * Scroll = zoom. Constellation lines between related words.
 */

import * as THREE from 'three';

let scene, camera, renderer, raycaster, mouse;
let starMeshes = [];
let wordData = [];
let animFrameId = null;
let container = null;
let cardOverlay = null;
let isInitialized = false;

// ─── Init Galaxy ───────────────────────────────────────────────────────────────
export function initGalaxy(containerEl, words = []) {
  if (!containerEl) return;
  container = containerEl;
  wordData = words;

  // Clean up if re-initializing
  if (isInitialized) destroyGalaxy();

  // Set up container
  container.style.cssText = `
    position: relative; width: 100%; height: 480px;
    border-radius: 20px; overflow: hidden;
    background: radial-gradient(ellipse at center, #0a0a1f 0%, #020208 100%);
    border: 1px solid rgba(255,255,255,0.06);
    cursor: crosshair;
  `;

  // Three.js scene
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x020208, 0.0012);

  // Camera
  camera = new THREE.PerspectiveCamera(65, container.clientWidth / container.clientHeight, 0.1, 2000);
  camera.position.set(0, 0, 60);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);

  // Raycaster for click detection
  raycaster = new THREE.Raycaster();
  raycaster.params.Points.threshold = 2;
  mouse = new THREE.Vector2();

  // Nebula background particles
  _addNebulaParticles();

  // Word stars
  _buildStars(words);

  // Constellation lines (connect words that share a letter prefix)
  _buildConstellations(words);

  // Event listeners
  renderer.domElement.addEventListener('click', _onStarClick);
  renderer.domElement.addEventListener('mousemove', _onMouseMove);
  container.addEventListener('wheel', _onScroll, { passive: true });

  // Resize observer
  const ro = new ResizeObserver(() => {
    if (!camera || !renderer || !container) return;
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  });
  ro.observe(container);

  // Word card overlay
  _buildCardOverlay();

  // Animate counter
  _updateCounter(words.length);

  // Start render loop
  isInitialized = true;
  _animate();
}

// ─── Nebula Background Particles ──────────────────────────────────────────────
function _addNebulaParticles() {
  const count = 3000;
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  const palette = [
    [0.2, 0.1, 0.6],  // deep purple
    [0.1, 0.2, 0.5],  // blue
    [0.4, 0.1, 0.3],  // magenta
    [0.05, 0.05, 0.15], // dark blue
  ];

  for (let i = 0; i < count; i++) {
    positions[i * 3]     = (Math.random() - 0.5) * 800;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 800;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 800;
    const c = palette[Math.floor(Math.random() * palette.length)];
    const brightness = 0.3 + Math.random() * 0.7;
    colors[i * 3]     = c[0] * brightness;
    colors[i * 3 + 1] = c[1] * brightness;
    colors[i * 3 + 2] = c[2] * brightness;
  }

  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color',    new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.PointsMaterial({
    size: 0.5, vertexColors: true, transparent: true, opacity: 0.6,
    sizeAttenuation: true,
  });

  scene.add(new THREE.Points(geo, mat));
}

// ─── Build Stars (one per word) ────────────────────────────────────────────────
function _buildStars(words) {
  starMeshes = [];
  if (!words || words.length === 0) {
    _addEmptyState();
    return;
  }

  words.forEach((word, i) => {
    const accuracy = word.accuracy ?? 0.5; // 0..1
    const size = 0.6 + accuracy * 2.4;   // 0.6 → 3.0

    // Color: low accuracy = dim blue, high accuracy = bright gold/white
    const r = accuracy > 0.7 ? 1 : 0.3 + accuracy * 0.7;
    const g = accuracy > 0.5 ? 0.8 * accuracy : 0.2 + accuracy * 0.4;
    const b = accuracy < 0.5 ? 0.8 : 0.3 + (1 - accuracy) * 0.5;

    const geo = new THREE.SphereGeometry(size, 8, 8);
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(r, g, b),
      transparent: true,
      opacity: 0.85 + accuracy * 0.15,
    });
    const mesh = new THREE.Mesh(geo, mat);

    // Position in a sphere shell for galaxy feel
    const phi   = Math.acos(-1 + (2 * i) / words.length);
    const theta = Math.sqrt(words.length * Math.PI) * phi;
    const radius = 20 + Math.random() * 35;
    mesh.position.set(
      radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.sin(phi) * Math.sin(theta) * 0.5,
      radius * Math.cos(phi)
    );

    // Glow point light for bright stars
    if (accuracy > 0.7) {
      const light = new THREE.PointLight(new THREE.Color(r, g, b), 0.8, 8);
      light.position.copy(mesh.position);
      scene.add(light);
    }

    mesh.userData = { word: word.term || word, index: i, accuracy };
    scene.add(mesh);
    starMeshes.push(mesh);
  });
}

// ─── Build Constellation Lines ─────────────────────────────────────────────────
function _buildConstellations(words) {
  if (!words || words.length < 2) return;

  const lineMat = new THREE.LineBasicMaterial({
    color: 0x334466, transparent: true, opacity: 0.2,
  });

  // Connect words whose first 2 letters match
  for (let i = 0; i < starMeshes.length; i++) {
    for (let j = i + 1; j < starMeshes.length; j++) {
      const w1 = (words[i]?.term || words[i] || '').toLowerCase();
      const w2 = (words[j]?.term || words[j] || '').toLowerCase();
      if (w1.slice(0, 2) === w2.slice(0, 2) && w1.slice(0, 2) !== '') {
        const geo = new THREE.BufferGeometry().setFromPoints([
          starMeshes[i].position,
          starMeshes[j].position,
        ]);
        scene.add(new THREE.Line(geo, lineMat));
      }
    }
  }
}

// ─── Empty State ───────────────────────────────────────────────────────────────
function _addEmptyState() {
  // Show a placeholder text in the 3D scene using an HTML overlay
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: absolute; inset: 0; display: flex;
    flex-direction: column; align-items: center; justify-content: center;
    pointer-events: none; color: rgba(255,255,255,0.3);
    font-family: 'Outfit', sans-serif; text-align: center;
  `;
  overlay.innerHTML = `
    <div style="font-size:3rem;margin-bottom:12px">🌌</div>
    <div style="font-size:1.1rem;font-weight:600">Your galaxy is empty</div>
    <div style="font-size:0.85rem;margin-top:8px;opacity:0.7">Master words in Quiz & Challenge to populate your universe</div>
  `;
  container.appendChild(overlay);
}

// ─── Render Loop ───────────────────────────────────────────────────────────────
let galaxyRotY = 0;
function _animate() {
  animFrameId = requestAnimationFrame(_animate);
  // Slow auto-rotation
  galaxyRotY += 0.0008;
  scene.rotation.y = galaxyRotY;
  // Subtle camera bob
  camera.position.y = Math.sin(Date.now() * 0.0003) * 2;
  renderer.render(scene, camera);
}

// ─── Mouse / Click Events ──────────────────────────────────────────────────────
let hoveredStar = null;
function _onMouseMove(e) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width)  * 2 - 1;
  mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(starMeshes);
  if (hits.length > 0) {
    const star = hits[0].object;
    if (hoveredStar !== star) {
      if (hoveredStar) hoveredStar.material.opacity = 0.85;
      hoveredStar = star;
      star.material.opacity = 1;
      star.scale.setScalar(1.4);
      renderer.domElement.style.cursor = 'pointer';
    }
  } else {
    if (hoveredStar) {
      hoveredStar.material.opacity = 0.85;
      hoveredStar.scale.setScalar(1);
      hoveredStar = null;
      renderer.domElement.style.cursor = 'crosshair';
    }
  }
}

function _onStarClick(e) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width)  * 2 - 1;
  mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(starMeshes);
  if (hits.length > 0) {
    const star = hits[0].object;
    const wordIdx = star.userData.index;
    if (wordData[wordIdx]) _showWordCard(wordData[wordIdx], e.clientX, e.clientY);
  } else {
    _hideWordCard();
  }
}

function _onScroll(e) {
  camera.position.z = Math.max(20, Math.min(150, camera.position.z + e.deltaY * 0.05));
}

// ─── Word Card Overlay ─────────────────────────────────────────────────────────
function _buildCardOverlay() {
  if (cardOverlay) return;
  cardOverlay = document.createElement('div');
  cardOverlay.id = 'galaxyWordCard';
  cardOverlay.style.cssText = `
    position: fixed; z-index: 10001; pointer-events: all;
    background: linear-gradient(145deg, rgba(10,5,30,0.97), rgba(5,0,20,0.99));
    border: 1px solid rgba(100,120,255,0.35);
    border-radius: 16px; padding: 20px 24px;
    box-shadow: 0 8px 40px rgba(80,100,255,0.3), 0 0 0 1px rgba(255,255,255,0.04);
    max-width: 280px; min-width: 220px;
    opacity: 0; transition: opacity 0.2s, transform 0.2s;
    transform: scale(0.9) translateY(8px);
    display: none;
    font-family: 'Outfit', sans-serif;
  `;
  cardOverlay.innerHTML = `
    <button id="gwcClose" style="
      position:absolute;top:10px;right:12px;background:none;border:none;
      color:rgba(255,255,255,0.4);cursor:pointer;font-size:1rem;padding:2px;
    ">✕</button>
    <div id="gwcTerm" style="font-size:1.3rem;font-weight:800;color:#e0e7ff;margin-bottom:6px"></div>
    <div id="gwcDef" style="font-size:0.85rem;color:rgba(255,255,255,0.65);line-height:1.5;margin-bottom:12px"></div>
    <div id="gwcAccuracy" style="font-size:0.75rem;color:rgba(150,180,255,0.7)"></div>
  `;
  document.body.appendChild(cardOverlay);
  cardOverlay.querySelector('#gwcClose').addEventListener('click', _hideWordCard);
}

function _showWordCard(word, clientX, clientY) {
  if (!cardOverlay) _buildCardOverlay();

  const term = word.term || word;
  const def  = word.def || word.definition || '';
  const acc  = word.accuracy != null ? Math.round(word.accuracy * 100) + '% accuracy' : '';

  cardOverlay.querySelector('#gwcTerm').textContent = term;
  cardOverlay.querySelector('#gwcDef').textContent = def;
  cardOverlay.querySelector('#gwcAccuracy').textContent = acc ? `⭐ ${acc}` : '';

  // Position near click, keep within viewport
  const margin = 16;
  const w = 280;
  const h = 160;
  let x = clientX + 12;
  let y = clientY - 80;
  if (x + w > window.innerWidth - margin)  x = clientX - w - 12;
  if (y + h > window.innerHeight - margin) y = window.innerHeight - h - margin;
  if (y < margin) y = margin;

  cardOverlay.style.left  = x + 'px';
  cardOverlay.style.top   = y + 'px';
  cardOverlay.style.display = 'block';

  requestAnimationFrame(() => {
    cardOverlay.style.opacity = '1';
    cardOverlay.style.transform = 'scale(1) translateY(0)';
  });
}

function _hideWordCard() {
  if (!cardOverlay) return;
  cardOverlay.style.opacity = '0';
  cardOverlay.style.transform = 'scale(0.9) translateY(8px)';
  setTimeout(() => { if (cardOverlay) cardOverlay.style.display = 'none'; }, 200);
}

// ─── Counter ───────────────────────────────────────────────────────────────────
function _updateCounter(count) {
  const counter = document.getElementById('galaxyStarCount');
  if (counter) counter.textContent = count;
}

// ─── Destroy ───────────────────────────────────────────────────────────────────
export function destroyGalaxy() {
  if (animFrameId) cancelAnimationFrame(animFrameId);
  if (renderer) {
    renderer.dispose();
    renderer.domElement.remove();
  }
  if (cardOverlay) { cardOverlay.remove(); cardOverlay = null; }
  scene = camera = renderer = raycaster = null;
  starMeshes = [];
  isInitialized = false;
}
