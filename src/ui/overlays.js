// ── UI Overlays ─────────────────────────────────────────────────────────────
// Self-contained open/close lifecycle for transient overlays:
//  - Video clip overlay (#videoOverlay) — used by feed clip patches and Yesterday Recap
//  - Player card overlay (#playerCardOverlay) — HR/RBI card dismissal
//  - Sign-in CTA toast (#signInCTA) — auto-hides after timeout

import { state } from '../state.js';
import { TIMING } from '../config/constants.js';

let _flashCollectionRailMessage = null;

export function setOverlayCallbacks(cbs) {
  if (cbs.flashCollectionRailMessage) _flashCollectionRailMessage = cbs.flashCollectionRailMessage;
}

export function openVideoOverlay(url, title) {
  var ov = document.getElementById('videoOverlay');
  var vid = document.getElementById('videoOverlayPlayer');
  var ttl = document.getElementById('videoOverlayTitle');
  if (!ov || !vid) return;
  if (ttl) ttl.textContent = title || '';
  vid.src = url;
  vid.load();
  ov.style.display = 'flex';
}

export function closeVideoOverlay() {
  var ov = document.getElementById('videoOverlay');
  var vid = document.getElementById('videoOverlayPlayer');
  if (vid) { vid.pause(); vid.src = ''; }
  if (ov) ov.style.display = 'none';
}

export function dismissPlayerCard() {
  var overlay = document.getElementById('playerCardOverlay');
  if (!overlay || !overlay.classList.contains('open')) return;
  if (_flashCollectionRailMessage) _flashCollectionRailMessage();
  if (window._playerCardTimer) { clearTimeout(window._playerCardTimer); window._playerCardTimer = null; }
  overlay.classList.add('closing');
  setTimeout(function() {
    overlay.classList.remove('open', 'closing');
    document.getElementById('playerCard').innerHTML = '<div class="pc-loading">Loading player card…</div>';
  }, TIMING.CARD_CLOSE_ANIM_MS);
}

export function closeSignInCTA() {
  if (state.signInCTATimer) { clearTimeout(state.signInCTATimer); state.signInCTATimer = null; }
  var el = document.getElementById('signInCTA');
  if (!el) return;
  el.style.opacity = '0';
  el.style.transform = 'translateX(-50%) translateY(16px)';
  el.style.pointerEvents = 'none';
  setTimeout(function() { el.style.display = 'none'; }, 260);
}
