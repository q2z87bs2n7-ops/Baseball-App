import { state } from './state.js';
import { VALUE_LABEL } from './cards.js';

export function renderFence(fenceEl) {
  fenceEl.innerHTML = '';
  state.fence.forEach((slot, i) => {
    const card = document.createElement('div');
    card.className = 'fence-card';
    card.dataset.value = slot.value;
    card.dataset.slot = String(i);
    if (i === state.ramp.slot) card.classList.add('has-ramp');
    const portrait = document.createElement('div');
    portrait.className = 'portrait';
    const value = document.createElement('div');
    value.className = 'value';
    value.textContent = VALUE_LABEL[slot.value] || slot.value;
    card.appendChild(portrait);
    card.appendChild(value);
    fenceEl.appendChild(card);
  });
}

export function flashCard(fenceEl, slot, isHomerun) {
  const card = fenceEl.querySelector(`.fence-card[data-slot="${slot}"]`);
  if (!card) return;
  card.classList.add('hit');
  if (isHomerun) card.style.boxShadow = '0 0 0 4px #c4163c, 0 8px 18px rgba(196,22,60,0.6)';
  setTimeout(() => {
    card.classList.remove('hit');
    card.style.boxShadow = '';
  }, 700);
}

export function updateHud(hud) {
  hud.score.textContent = state.score;
  hud.outs.textContent = state.outs;
  hud.strikes.textContent = state.strikes;
  hud.atBat.textContent = state.atBat;
}

export function showResult(banner, text, kind) {
  banner.textContent = text;
  banner.hidden = false;
  banner.className = '';
  banner.classList.add('show');
  if (kind === 'hr') banner.classList.add('hr');
  if (kind === 'out') banner.classList.add('out');
  return new Promise((resolve) => {
    setTimeout(() => {
      banner.classList.remove('show');
      setTimeout(() => {
        banner.hidden = true;
        banner.className = '';
        resolve();
      }, 250);
    }, 1000);
  });
}

export function updateTimingCursor(cursorEl, t) {
  cursorEl.style.left = `${t * 100}%`;
}
