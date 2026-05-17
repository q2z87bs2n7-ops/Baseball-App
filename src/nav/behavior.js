// Mobile nav behavioral helpers (Phase 4 of the mobile-nav rework).
// Each helper installs at module-init time and is a no-op on viewports/states
// where it doesn't apply, so callers can install unconditionally.

import { state } from '../state.js';

const HIDE_THRESHOLD_DELTA = 4;   // px of downward scroll before hiding
const SHOW_NEAR_TOP = 40;         // px from top where nav is always shown

let lastScrollY = 0;
let scrollTicking = false;

// Hide the bottom nav while the user scrolls DOWN, restore it the instant they
// scroll UP or reach the top of the page. Throttled with rAF to stay cheap.
export function installHideOnScroll() {
  const nav = document.querySelector('nav');
  if (!nav) return;
  lastScrollY = window.scrollY;

  window.addEventListener('scroll', () => {
    if (scrollTicking) return;
    scrollTicking = true;
    requestAnimationFrame(() => {
      const y = window.scrollY;
      const delta = y - lastScrollY;
      if (delta < 0 || y < SHOW_NEAR_TOP) {
        nav.classList.remove('nav-hidden');
      } else if (delta > HIDE_THRESHOLD_DELTA) {
        nav.classList.add('nav-hidden');
      }
      lastScrollY = y;
      scrollTicking = false;
    });
  }, { passive: true });
}

// ── Phase 4b: scroll memory ─────────────────────────────────────────────────
// Per-section scroll position cache. showSection captures and restores via
// these helpers; suppressNextRestore lets the caller force a fresh top scroll
// (e.g. when opening a "fresh" view like Yesterday Recap on first load).
const scrollMemory = new Map();

export function captureScroll(sectionId) {
  if (!sectionId) return;
  scrollMemory.set(sectionId, window.scrollY);
}

export function restoreScroll(sectionId) {
  const y = scrollMemory.get(sectionId) || 0;
  // rAF so layout has settled after the section toggle
  requestAnimationFrame(() => window.scrollTo(0, y));
}

// ── Phase 4c: hash routing ──────────────────────────────────────────────────
// Sync URL hash with the active section so deep links + back/forward + refresh
// all work. The hash is the section id (e.g. "#schedule"). Inline onclick
// handlers still call showSection directly; this just adds a parallel path.

let hashRouterInstalled = false;
let suppressHashChange = false;

// Set hash without triggering a hashchange-driven re-nav (caller already
// navigated via showSection).
export function syncHash(sectionId) {
  if (!sectionId) return;
  const target = '#' + sectionId;
  if (location.hash === target) return;
  suppressHashChange = true;
  history.replaceState(null, '', target);
  // hashchange doesn't fire for replaceState, but guard anyway
  setTimeout(() => { suppressHashChange = false; }, 0);
}

export function installHashRouter(showSectionFn) {
  if (hashRouterInstalled) return;
  hashRouterInstalled = true;

  window.addEventListener('hashchange', () => {
    if (suppressHashChange) return;
    const id = location.hash.slice(1);
    if (!id) return;
    if (!document.getElementById(id)) return;
    const btn = document.querySelector('nav button[data-section="' + id + '"]');
    showSectionFn(id, btn || undefined);
  });

  // Initial deep-link landing: if the user opened with a non-default hash,
  // navigate there after the cold-open has settled (Pulse-first init still
  // runs; we just redirect to the requested section right after).
  const initial = location.hash.slice(1);
  if (initial && initial !== 'pulse' && document.getElementById(initial)) {
    requestAnimationFrame(() => {
      const btn = document.querySelector('nav button[data-section="' + initial + '"]');
      showSectionFn(initial, btn || undefined);
    });
  }
}

// ── Phase 4d: live-state nav dots ───────────────────────────────────────────
// Tiny coloured indicator dot rendered absolutely on a nav button. State is
// "live" (green pulsing — user's team has a live game) or "fresh" (orange —
// new content). Pass null to clear.

function ensureNavDot(btn) {
  let dot = btn.querySelector('.nav-dot');
  if (!dot) {
    dot = document.createElement('span');
    dot.className = 'nav-dot';
    btn.appendChild(dot);
  }
  return dot;
}

export function setNavDot(sectionName, kind) {
  const btn = document.querySelector('nav button[data-section="' + sectionName + '"]');
  if (!btn) return;
  const dot = ensureNavDot(btn);
  dot.classList.toggle('live', kind === 'live');
  dot.classList.toggle('fresh', kind === 'fresh');
}

export function clearNavDot(sectionName) {
  setNavDot(sectionName, null);
}

// Re-evaluate all dots from current app state. Hooked off a low-frequency
// timer so it stays in sync without coupling to every state-mutating path.
export function refreshNavDots() {
  if (!state.activeTeam || !state.gameStates) {
    clearNavDot('schedule');
    return;
  }
  const teamId = state.activeTeam.id;
  const games = Object.values(state.gameStates);
  const myLive = games.some(function(g) {
    if (!g) return false;
    if (g.awayId !== teamId && g.homeId !== teamId) return false;
    if (g.detailedState === 'Warmup' || g.detailedState === 'Pre-Game') return false;
    return g.status === 'Live';
  });
  setNavDot('schedule', myLive ? 'live' : null);
}

let navDotsTimer = null;
export function installNavDotsRefresh(intervalMs) {
  if (navDotsTimer) clearInterval(navDotsTimer);
  refreshNavDots();
  navDotsTimer = setInterval(refreshNavDots, intervalMs || 30000);
}

// ── Phase 4e: long-press shortcuts ──────────────────────────────────────────
// Trigger a callback after the user has held a pointer down for `ms` ms.
// Cancels on movement, release, or pointer leave. Optional haptic on fire.

export function attachLongPress(el, handler, ms) {
  if (!el || typeof handler !== 'function') return;
  const delay = ms || 500;
  let timer = null;
  let pressed = false;

  function start(e) {
    pressed = true;
    timer = setTimeout(function() {
      if (!pressed) return;
      try { navigator.vibrate && navigator.vibrate(8); } catch (err) {}
      handler(e);
    }, delay);
  }
  function cancel() {
    pressed = false;
    if (timer) { clearTimeout(timer); timer = null; }
  }

  el.addEventListener('touchstart', start, { passive: true });
  el.addEventListener('touchend', cancel);
  el.addEventListener('touchmove', cancel);
  el.addEventListener('touchcancel', cancel);
  el.addEventListener('mousedown', start);
  el.addEventListener('mouseup', cancel);
  el.addEventListener('mouseleave', cancel);
}

// Install long-press triggers on the bottom-nav buttons. Each section can
// open its own shortcut sheet (defined in sheet.js). For now only Pulse
// surfaces a shortcut sheet — other tabs are a no-op until their handlers
// are wired.
export function installNavLongPress(handlers) {
  const map = handlers || {};
  document.querySelectorAll('nav button[data-section]').forEach(function(btn) {
    const section = btn.getAttribute('data-section');
    const h = map[section];
    if (typeof h === 'function') attachLongPress(btn, h);
  });
}

// Delegated click handler for the 7 section nav buttons (replaces inline onclick).
export function installNavClicks(showSectionFn) {
  const nav = document.querySelector('header nav');
  if (!nav) return;
  nav.addEventListener('click', function(e) {
    const btn = e.target.closest('button[data-section]');
    if (!btn) return;
    const section = btn.getAttribute('data-section');
    if (section) showSectionFn(section, btn);
  });
}
