/**
 * grammar-explainer.js - Deep Grammar, Nuance, Collocation & Etymology Drawer
 * Decipher Language Learning Platform
 */

let drawerEl = null;
let currentTerm = '';

export function initGrammarExplainer() {
  if (document.getElementById('decipherGrammarDrawer')) return;

  const markup = `
    <div id="decipherGrammarDrawer" class="grammar-drawer-backdrop" style="display:none;" role="dialog" aria-modal="true" aria-label="Grammar & Nuance Explainer">
      <div class="grammar-drawer-panel">
        <div class="grammar-drawer-header">
          <div class="grammar-header-info">
            <span class="grammar-badge">AI GRAMMAR & NUANCE</span>
            <h3 id="grammarDrawerTerm" class="grammar-term">--</h3>
          </div>
          <button id="closeGrammarDrawerBtn" class="grammar-close-btn" aria-label="Close">&times;</button>
        </div>

        <div class="grammar-drawer-content">
          <!-- Nuance & Register -->
          <div class="grammar-section">
            <h4 class="grammar-section-title"><span>🔍</span> Nuance & Register</h4>
            <div id="grammarRegisterTag" class="grammar-pill-row">
              <span class="grammar-pill pill-formal">Academic / Formal</span>
              <span class="grammar-pill pill-cefr">CEFR B2-C1</span>
            </div>
            <p id="grammarNuanceDesc" class="grammar-desc">
              Carries a connotation of thoughtful deliberation rather than spontaneous impulse.
            </p>
          </div>

          <!-- Collocations -->
          <div class="grammar-section">
            <h4 class="grammar-section-title"><span>🔗</span> Essential Collocations</h4>
            <ul id="grammarCollocationsList" class="grammar-collocations">
              <li><strong>Play a pivotal role</strong> in the outcome</li>
              <li><strong>Serve as a catalyst</strong> for innovation</li>
            </ul>
          </div>

          <!-- Etymology & Root -->
          <div class="grammar-section">
            <h4 class="grammar-section-title"><span>🌱</span> Etymology & Roots</h4>
            <p id="grammarEtymologyDesc" class="grammar-desc">
              From Latin <em>radix</em> (root), later evolving through Anglo-Norman French into Middle English.
            </p>
          </div>

          <!-- Context Generator -->
          <div class="grammar-section">
            <h4 class="grammar-section-title"><span>📝</span> Example Usage in Context</h4>
            <div id="grammarExampleBox" class="grammar-example-box">
              <p id="grammarSentence" class="grammar-sentence">"The discovery proved to be a milestone in modern linguistics."</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', markup);

  drawerEl = document.getElementById('decipherGrammarDrawer');
  document.getElementById('closeGrammarDrawerBtn')?.addEventListener('click', closeGrammarExplainer);
  drawerEl?.addEventListener('click', (e) => {
    if (e.target === drawerEl) closeGrammarExplainer();
  });
}

export function openGrammarExplainer(term, context = {}) {
  if (!drawerEl) initGrammarExplainer();
  currentTerm = term || 'Comprehensive';

  const termEl = document.getElementById('grammarDrawerTerm');
  if (termEl) termEl.textContent = currentTerm;

  const descEl = document.getElementById('grammarNuanceDesc');
  if (descEl) {
    descEl.textContent = `When using "${currentTerm}", speakers convey precise technical meaning with high clarity. Often favored in professional discourse.`;
  }

  const collEl = document.getElementById('grammarCollocationsList');
  if (collEl) {
    collEl.innerHTML = `
      <li><strong>Highly ${currentTerm}</strong> in scope and methodology</li>
      <li><strong>A ${currentTerm} approach</strong> to problem solving</li>
      <li><strong>Demonstrates ${currentTerm}</strong> comprehension</li>
    `;
  }

  const sentEl = document.getElementById('grammarSentence');
  if (sentEl) {
    sentEl.textContent = context.sentence || `The team presented a ${currentTerm.toLowerCase()} overview during the executive briefing.`;
  }

  if (drawerEl) drawerEl.style.display = 'flex';
}

export function closeGrammarExplainer() {
  if (drawerEl) drawerEl.style.display = 'none';
}
