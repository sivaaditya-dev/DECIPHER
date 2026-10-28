import { calculateSM2, SRSQueueManager } from './srs.js';
export { calculateSM2, SRSQueueManager };
export const srsQueue = new SRSQueueManager();

/**
 * flashcards.js - 3D Perspective Flashcard SRS Engine (SuperMemo SM-2)
 * Decipher Language Learning Platform
 */

let modalEl = null;
let cardEl = null;
let currentDeck = [];
let currentIndex = 0;
let isFlipped = false;

export function initFlashcards() {
  if (document.getElementById('decipherFlashcardsModal')) return;

  const markup = `
    <div id="decipherFlashcardsModal" class="fc-backdrop" style="display:none;" role="dialog" aria-modal="true" aria-label="3D Flashcard SRS Deck">
      <div class="fc-container">
        <div class="fc-header">
          <div class="fc-header-left">
            <span class="fc-icon">🎴</span>
            <div>
              <h3 class="fc-title">Flashcard Deck</h3>
              <span id="fcProgressLabel" class="fc-progress-label">Card 1 of 10</span>
            </div>
          </div>
          <button id="closeFcBtn" class="fc-close-btn" aria-label="Close">&times;</button>
        </div>

        <div class="fc-card-scene">
          <div id="fcCard" class="fc-card" tabindex="0" role="button" aria-label="Flashcard - click or press space to flip">
            <!-- Front Face -->
            <div class="fc-card-face fc-card-front">
              <span class="fc-face-badge">TERM</span>
              <div id="fcWord" class="fc-word">--</div>
              <div id="fcPhonetic" class="fc-phonetic"></div>
              <div class="fc-flip-hint">Click or press <kbd>Space</kbd> to flip</div>
            </div>

            <!-- Back Face -->
            <div class="fc-card-face fc-card-back">
              <span class="fc-face-badge fc-badge-back">DEFINITION</span>
              <div id="fcMeaning" class="fc-meaning">--</div>
              <div id="fcExample" class="fc-example"></div>
              <div id="fcTranslation" class="fc-translation"></div>
            </div>
          </div>
        </div>

        <!-- Rating Controls (SM-2 SRS) -->
        <div class="fc-controls" id="fcControls">
          <button class="fc-rate-btn fc-btn-again" data-grade="1" title="Shortcut: 1">
            <span class="rate-grade">Again</span>
            <span class="rate-interval">&lt; 10m</span>
            <kbd>1</kbd>
          </button>
          <button class="fc-rate-btn fc-btn-hard" data-grade="3" title="Shortcut: 2">
            <span class="rate-grade">Hard</span>
            <span class="rate-interval">1d</span>
            <kbd>2</kbd>
          </button>
          <button class="fc-rate-btn fc-btn-good" data-grade="4" title="Shortcut: 3">
            <span class="rate-grade">Good</span>
            <span class="rate-interval">3d</span>
            <kbd>3</kbd>
          </button>
          <button class="fc-rate-btn fc-btn-easy" data-grade="5" title="Shortcut: 4">
            <span class="rate-grade">Easy</span>
            <span class="rate-interval">5d</span>
            <kbd>4</kbd>
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', markup);

  modalEl = document.getElementById('decipherFlashcardsModal');
  cardEl = document.getElementById('fcCard');

  document.getElementById('closeFcBtn')?.addEventListener('click', closeFlashcards);
  modalEl?.addEventListener('click', (e) => {
    if (e.target === modalEl) closeFlashcards();
  });

  cardEl?.addEventListener('click', flipCard);

  // Rating buttons
  document.querySelectorAll('.fc-rate-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const grade = parseInt(btn.dataset.grade, 10);
      rateCurrentCard(grade);
    });
  });

  // Hotkeys: Space (flip), 1-4 (rate)
  window.addEventListener('keydown', handleFcKey);
}

export function openFlashcards(deck) {
  if (!modalEl) initFlashcards();
  if (deck && deck.length > 0) {
    srsQueue.addCards(deck);
    currentDeck = deck.map(c => srsQueue.getCard(c.id || c.term || c.word) || c);
  } else {
    currentDeck = srsQueue.getDueCards();
  }

  if (!currentDeck || currentDeck.length === 0) {
    if (window.showToast) window.showToast('No vocabulary cards found. Analyze text first!', 'warning');
    return;
  }
  currentIndex = 0;
  isFlipped = false;
  if (modalEl) modalEl.style.display = 'flex';
  renderCurrentCard();
}

export function closeFlashcards() {
  if (modalEl) modalEl.style.display = 'none';
  isFlipped = false;
  if (cardEl) cardEl.classList.remove('is-flipped');
}

export function flipCard() {
  if (!cardEl) return;
  isFlipped = !isFlipped;
  cardEl.classList.toggle('is-flipped', isFlipped);
}

// calculateSM2 is imported and re-exported from ./srs.js

function renderCurrentCard() {
  if (currentIndex >= currentDeck.length) {
    showDeckFinished();
    return;
  }

  isFlipped = false;
  if (cardEl) cardEl.classList.remove('is-flipped');

  const card = currentDeck[currentIndex];
  const progressLabel = document.getElementById('fcProgressLabel');
  if (progressLabel) progressLabel.textContent = `Card ${currentIndex + 1} of ${currentDeck.length}`;

  const wordEl = document.getElementById('fcWord');
  const phonEl = document.getElementById('fcPhonetic');
  const meanEl = document.getElementById('fcMeaning');
  const egEl = document.getElementById('fcExample');
  const transEl = document.getElementById('fcTranslation');

  if (wordEl) wordEl.textContent = card.word || card.term || '--';
  if (phonEl) phonEl.textContent = card.phonetic ? `/${card.phonetic}/` : '';
  if (meanEl) meanEl.textContent = card.definition || card.meaning || 'No definition available.';
  if (egEl) egEl.textContent = card.example ? `"${card.example}"` : '';
  if (transEl) transEl.textContent = card.translation ? `Translation: ${card.translation}` : '';
}

function rateCurrentCard(grade) {
  if (currentDeck.length === 0 || currentIndex >= currentDeck.length) return;
  const current = currentDeck[currentIndex];
  const cardId = current.id || current.term || current.word;
  const updated = srsQueue.recordReview(cardId, grade);
  currentDeck[currentIndex] = updated;

  currentIndex++;
  renderCurrentCard();
}

function showDeckFinished() {
  const scene = document.querySelector('.fc-card-scene');
  const controls = document.getElementById('fcControls');
  if (scene) {
    scene.innerHTML = `
      <div class="fc-complete-card">
        <span class="complete-icon">🎉</span>
        <h3>Deck Completed!</h3>
        <p>You have reviewed all ${currentDeck.length} cards in this study session.</p>
        <button id="fcRestartBtn" class="fc-btn-primary">Review Again</button>
      </div>
    `;
    document.getElementById('fcRestartBtn')?.addEventListener('click', () => {
      currentIndex = 0;
      initFlashcards();
      renderCurrentCard();
    });
  }
  if (controls) controls.style.display = 'none';
}

function handleFcKey(e) {
  if (!modalEl || modalEl.style.display !== 'flex') return;

  if (e.code === 'Space') {
    e.preventDefault();
    flipCard();
  } else if (e.key === '1') {
    e.preventDefault();
    rateCurrentCard(1);
  } else if (e.key === '2') {
    e.preventDefault();
    rateCurrentCard(3);
  } else if (e.key === '3') {
    e.preventDefault();
    rateCurrentCard(4);
  } else if (e.key === '4') {
    e.preventDefault();
    rateCurrentCard(5);
  } else if (e.key === 'Escape') {
    e.preventDefault();
    closeFlashcards();
  }
}
