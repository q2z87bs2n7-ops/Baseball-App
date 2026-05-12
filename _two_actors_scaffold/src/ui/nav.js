// Section navigation. Toggles .active class on <section> elements and
// matching nav buttons. Overlays are managed separately (see overlays.js).

import { state } from '../state.js';

const SECTIONS = ['home', 'play', 'scoreboard', 'history', 'settings'];

export function showSection(id) {
  if (!SECTIONS.includes(id)) return;
  state.currentScreen = id;
  document.querySelectorAll('main > section.screen').forEach((s) => {
    s.classList.toggle('active', s.id === id);
  });
  document.querySelectorAll('.bottom-nav button').forEach((b) => {
    b.classList.toggle('active', b.dataset.go === id);
  });
}

export function wireNav() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-go]');
    if (!btn) return;
    showSection(btn.dataset.go);
  });
}
