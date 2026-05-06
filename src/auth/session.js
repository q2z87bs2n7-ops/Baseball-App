// ── Session + Sync UI ───────────────────────────────────────────────────────
// signOut    — wipes local session, clears sync interval, refreshes UI
// updateSyncUI — renders signed-in / signed-out toolbar widget
// showSignInCTA — slide-up toast nudging signed-out users (after 3 cards)

import { state } from '../state.js';
import { TIMING } from '../config/constants.js';
import { closeSignInCTA } from '../ui/overlays.js';

export function signOut() {
  if (!confirm('Sign out and disconnect sync?')) return;
  state.mlbSessionToken = null;
  state.mlbAuthUser = null;
  localStorage.removeItem('mlb_session_token');
  localStorage.removeItem('mlb_auth_user');
  clearInterval(state.mlbSyncInterval);
  state.mlbSyncInterval = null;
  updateSyncUI();
}

export function updateSyncUI() {
  var panel = document.getElementById('syncStatus');
  if (!panel) return;
  if (state.mlbSessionToken && state.mlbAuthUser) {
    panel.innerHTML = '<div style="font-size:.72rem;color:var(--text)">✓ Synced · ' + state.mlbAuthUser + '</div><button onclick="signOut()" style="background:var(--card2);border:1px solid var(--border);color:var(--text);font-size:.72rem;padding:5px 10px;border-radius:8px;cursor:pointer">Sign Out</button>';
  } else {
    panel.innerHTML = '<button onclick="signInWithGitHub()" style="background:var(--card2);border:1px solid var(--border);color:var(--text);font-size:.72rem;padding:6px 12px;border-radius:8px;cursor:pointer;width:100%;text-align:left">🔐 Sign in with GitHub</button><button onclick="signInWithEmail()" style="background:var(--card2);border:1px solid var(--border);color:var(--text);font-size:.72rem;padding:6px 12px;border-radius:8px;cursor:pointer;width:100%;margin-top:6px;text-align:left">✉️ Sign in with Email</button>';
  }
}

export function showSignInCTA() {
  if (state.mlbSessionToken || state.shownSignInCTA) return;
  state.signInCTACardCount++;
  if (state.signInCTACardCount < 3) return;
  state.shownSignInCTA = true;
  var el = document.getElementById('signInCTA');
  if (!el) return;
  el.style.display = 'block';
  el.style.pointerEvents = 'auto';
  requestAnimationFrame(function() {
    el.style.opacity = '1';
    el.style.transform = 'translateX(-50%) translateY(0)';
    var bar = document.getElementById('signInCTABar');
    if (bar) { requestAnimationFrame(function() { bar.style.transform = 'scaleX(0)'; }); }
  });
  state.signInCTATimer = setTimeout(closeSignInCTA, TIMING.SIGNIN_CTA_MS);
}
