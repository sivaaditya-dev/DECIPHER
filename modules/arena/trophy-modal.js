/**
 * trophy-modal.js — Victory & Defeat Modal System for the Lexicon Coliseum
 * Decipher Language Learning Platform
 *
 * Renders an animated overlay modal showing match outcome, statistics,
 * and contextual savage arbiter commentary.
 *
 * Exports:
 *   showVictoryModal(stats, botName, onRematch, onLobby)
 *   showDefeatModal(stats, botName, onRematch, onLobby)
 *   hideResultModal()
 */

import { rankByWeight } from './lexical-weight.js';

/** Savage Arbiter defeat one-liners keyed by bot archetype */
const ARBITER_ROASTS = {
  rookie: [
    "You just got out-vocabularied by a Rookie. Take the weekend to reconsider your life.",
    "The Rookie beat you. The Rookie. Words fail me — which is more than I can say for them.",
    "Even the Rookie knew 'ephemeral' was temporary. Apparently, so was your performance.",
  ],
  scholar: [
    "The Scholar has filed your performance under 'Case Study: Cognitive Atrophy'.",
    "An academic humiliation. The Scholar took notes. They were short notes.",
    "You brought a dictionary to a battle. The Scholar brought mastery. There is a difference.",
  ],
  grandInquisitor: [
    "The Grand Inquisitor was not impressed. The Grand Inquisitor is never impressed.",
    "You faced the Inquisitor. The Inquisitor found you... linguistically insufficient.",
    "Nobody expects to lose to the Grand Inquisitor. And yet, here we are. Here. We. Are.",
  ],
};

/** Victory quips from the Savage Arbiter */
const ARBITER_PRAISES = [
  "Statistically improbable. Linguistically devastating. Well played.",
  "You may now carry the insufferable air of someone who knows what 'perspicacious' means.",
  "The chain has spoken. Your vocabulary is a weapon. Use it responsibly.",
  "Iron and words. Yours bent iron today.",
  "Even the Grand Inquisitor takes notes when you fight like that.",
];

/**
 * Formats milliseconds into a human-readable "Xm Ys" string.
 * @param {number} ms
 * @returns {string}
 */
function formatDuration(ms) {
  const totalSec = Math.floor(ms / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

/**
 * Formats a stat block row.
 * @param {string} label
 * @param {string|number} value
 * @returns {string}
 */
function statRow(label, value) {
  return `<div class="trophy-stat-row">
    <span class="trophy-stat-label">${label}</span>
    <span class="trophy-stat-value">${value}</span>
  </div>`;
}

/**
 * Builds the modal DOM and injects it into document.body.
 * @param {'victory'|'defeat'} type
 * @param {Object} stats - From IronChainEngine stats
 * @param {string} botId - Bot archetype id for roast selection
 * @param {string} botDisplayName - e.g. "🥇 Grand Inquisitor"
 * @param {function} onRematch
 * @param {function} onLobby
 */
function buildModal(type, stats, botId, botDisplayName, onRematch, onLobby) {
  hideResultModal(); // Remove any existing modal

  const isVictory = type === 'victory';
  const isTimeout = stats.result === 'timeout';

  // Arbiter quote selection
  let arbiterQuote;
  if (isVictory) {
    arbiterQuote = ARBITER_PRAISES[Math.floor(Math.random() * ARBITER_PRAISES.length)];
  } else {
    const roasts = ARBITER_ROASTS[botId] || ARBITER_ROASTS.scholar;
    arbiterQuote = roasts[Math.floor(Math.random() * roasts.length)];
  }

  // Top 3 heaviest words the player deployed
  const topWords = rankByWeight(stats.playerWords.filter(w => !w.isFiller)).slice(0, 3);
  const topWordsHTML = topWords.length
    ? topWords.map(w => `
        <span class="trophy-word-chip trophy-tier-${w.tier.toLowerCase()}">
          ${w.word} <small>(${w.tier} · ${w.weight}kg)</small>
        </span>`).join('')
    : '<span class="trophy-word-chip">—</span>';

  const html = `
<div id="arenaResultModal" class="arena-modal-overlay ${isVictory ? 'victory-overlay' : 'defeat-overlay'}" role="dialog" aria-modal="true" aria-label="${isVictory ? 'Victory' : 'Defeat'}">
  <div class="arena-modal-card ${isVictory ? 'victory-card' : 'defeat-card'}">

    <!-- Trophy / Defeat Icon -->
    <div class="trophy-icon ${isVictory ? 'trophy-bounce' : 'defeat-shake'}" aria-hidden="true">
      ${isVictory ? '🏆' : '💀'}
    </div>

    <!-- Result Title -->
    <h2 class="trophy-title ${isVictory ? 'trophy-title-gold' : 'trophy-title-red'}">
      ${isVictory
        ? (isTimeout ? '⏱️ TIME — YOU WIN!' : 'CHAIN BROKEN — VICTORY!')
        : (isTimeout ? '⏱️ TIME — YOU LOSE.' : `KO — ${botDisplayName} WINS`)}
    </h2>

    <!-- Arbiter Quote -->
    <blockquote class="arbiter-quote">
      <span class="arbiter-label">The Savage Arbiter:</span>
      "${arbiterQuote}"
    </blockquote>

    <!-- Match Stats -->
    <div class="trophy-stats">
      ${statRow('⛓️ Your Total Pull', `${stats.playerTotalKg.toLocaleString()} kg`)}
      ${statRow('🤖 Bot Total Pull',  `${stats.botTotalKg.toLocaleString()} kg`)}
      ${statRow('⚡ Max Combo',       `×${stats.maxCombo}`)}
      ${statRow('📝 Words Deployed',  stats.playerWords.filter(w => !w.isFiller).length)}
      ${statRow('❄️ Fillers Dropped', stats.playerWords.filter(w => w.isFiller).length)}
      ${statRow('⏱️ Match Duration',  formatDuration(stats.durationMs))}
    </div>

    <!-- Top Words -->
    <div class="trophy-top-words">
      <div class="trophy-top-words-label">🎯 Your Heaviest Words</div>
      <div class="trophy-words-row">${topWordsHTML}</div>
    </div>

    <!-- CTAs -->
    <div class="trophy-cta-row">
      <button id="trophyRematch" class="arena-btn arena-btn-primary">⚔️ Rematch</button>
      <button id="trophyLobby"   class="arena-btn arena-btn-ghost">🏠 Choose Opponent</button>
    </div>
  </div>
</div>`;

  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  const modal = wrapper.firstElementChild;
  document.body.appendChild(modal);

  // Bind CTAs
  document.getElementById('trophyRematch')?.addEventListener('click', () => {
    hideResultModal();
    onRematch?.();
  });
  document.getElementById('trophyLobby')?.addEventListener('click', () => {
    hideResultModal();
    onLobby?.();
  });

  // Allow Escape key to go to lobby
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      document.removeEventListener('keydown', escHandler);
      hideResultModal();
      onLobby?.();
    }
  };
  document.addEventListener('keydown', escHandler);
}

/**
 * Shows the victory modal.
 * @param {Object} stats
 * @param {string} botId
 * @param {string} botDisplayName
 * @param {function} onRematch
 * @param {function} onLobby
 */
export function showVictoryModal(stats, botId, botDisplayName, onRematch, onLobby) {
  buildModal('victory', stats, botId, botDisplayName, onRematch, onLobby);
}

/**
 * Shows the defeat modal.
 * @param {Object} stats
 * @param {string} botId
 * @param {string} botDisplayName
 * @param {function} onRematch
 * @param {function} onLobby
 */
export function showDefeatModal(stats, botId, botDisplayName, onRematch, onLobby) {
  buildModal('defeat', stats, botId, botDisplayName, onRematch, onLobby);
}

/**
 * Removes the result modal from the DOM.
 */
export function hideResultModal() {
  const existing = document.getElementById('arenaResultModal');
  if (existing) existing.remove();
}
