// Entry point. Boots the app: loads profile from localStorage, wires nav,
// initialises the play screen, registers the service worker.

import { state } from './state.js';
import { APP_VERSION, LS_PROFILE, LS_PROFILE_NAMES } from './config/constants.js';
import { wireNav, showSection } from './ui/nav.js';
import { initPlayScreen } from './ui/play.js';

function loadProfile() {
  try {
    state.profile = localStorage.getItem(LS_PROFILE) || null;
    const names = localStorage.getItem(LS_PROFILE_NAMES);
    if (names) state.profileNames = JSON.parse(names);
  } catch {
    /* localStorage unavailable — fine, run as guest */
  }
}

function renderProfileChip() {
  const el = document.getElementById('profileChip');
  if (!el) return;
  el.textContent = state.profile ? state.profileNames[state.profile] : 'Tap to set profile';
}

function renderVersion() {
  const el = document.getElementById('versionLabel');
  if (el) el.textContent = APP_VERSION;
}

function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      console.warn('SW registration failed', err);
    });
  });
}

function boot() {
  loadProfile();
  wireNav();
  initPlayScreen();
  renderProfileChip();
  renderVersion();
  showSection('home');
  registerSW();
  console.log(`Actor Link v${APP_VERSION} ready`);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
