// ── My Team Lens + Game Toggle ──────────────────────────────────────────────
// Per-game show/hide controls for the Pulse feed:
//   - applyMyTeamLens / toggleMyTeamLens — restrict feed to active team's games
//   - toggleGame — per-game show/hide (used by ticker chips)
//   - myTeamGamePks — set of gamePks for active team

import { state } from '../state.js';
import { renderTicker, updateFeedEmpty } from '../feed/render.js';

export function myTeamGamePks() {
  var out = new Set();
  Object.values(state.gameStates).forEach(function(g) {
    if (g.awayId === state.activeTeam.id || g.homeId === state.activeTeam.id) out.add(g.gamePk);
  });
  return out;
}

export function applyMyTeamLens(on) {
  state.myTeamLens = !!on;
  localStorage.setItem('mlb_my_team_lens', state.myTeamLens ? '1' : '0');
  var btn = document.getElementById('myTeamLensBtn'), knob = document.getElementById('myTeamLensKnob');
  if (btn) btn.classList.toggle('on', state.myTeamLens);
  if (knob) knob.style.left = state.myTeamLens ? '21px' : '2px';
  if (state.myTeamLens) {
    var keep = myTeamGamePks();
    state.enabledGames = new Set();
    keep.forEach(function(pk) { state.enabledGames.add(pk); });
    document.querySelectorAll('[data-gamepk]').forEach(function(el) {
      var pk = +el.getAttribute('data-gamepk');
      el.classList.toggle('feed-hidden', !keep.has(pk));
    });
  } else {
    Object.keys(state.gameStates).forEach(function(pk) { state.enabledGames.add(+pk); });
    document.querySelectorAll('[data-gamepk]').forEach(function(el) { el.classList.remove('feed-hidden'); });
  }
  if (typeof renderTicker === 'function') renderTicker();
  updateFeedEmpty();
}

export function toggleMyTeamLens() { applyMyTeamLens(!state.myTeamLens); }

export function toggleGame(gamePk) {
  gamePk = +gamePk;
  if (state.enabledGames.has(gamePk)) {
    state.enabledGames.delete(gamePk);
    document.querySelectorAll('[data-gamepk="' + gamePk + '"]').forEach(function(el) { el.classList.add('feed-hidden'); });
  } else {
    state.enabledGames.add(gamePk);
    document.querySelectorAll('[data-gamepk="' + gamePk + '"]').forEach(function(el) { el.classList.remove('feed-hidden'); });
  }
  updateFeedEmpty();
  renderTicker();
}
