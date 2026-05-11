// Shared helpers for the Stats tab modules (leaders / roster / player).
// These would otherwise force circular imports between the sub-modules.

import { state } from '../../state.js';

// HOT / COLD thresholds: last-15 OPS absolute values.
// Only badge players who have played at least 1 game in last 15.
// HOT if last-15 OPS >= 0.750, COLD if < 0.600.
export const HOT_COLD_OPS_HOT = 0.750;
export const HOT_COLD_OPS_COLD = 0.600;
export const HOT_COLD_MIN_GAMES = 1;
export const HOT_COLD_TTL_MS = 12 * 60 * 60 * 1000;

// Center an active tab inside its horizontally-scrolling container. Only scrolls
// when the container actually overflows, so it's a no-op on desktop where tabs
// fit on one row. Used by switchLeaderTab + switchRosterTab + switchPlayerStatsTab.
export function scrollTabIntoView(btn){
  if(!btn||!btn.parentElement)return;
  var p=btn.parentElement;
  if(p.scrollWidth<=p.clientWidth)return;
  var tgt=btn.offsetLeft-(p.clientWidth-btn.offsetWidth)/2;
  p.scrollTo({left:Math.max(0,tgt),behavior:'smooth'});
}

// Returns inline HOT/COLD badge HTML for a player, or '' if no signal.
// Reads state.lastNCache (populated by roster's fetchLastN).
// HOT: last-15 OPS >= 0.750. COLD: last-15 OPS < 0.600.
// Only badges players who have played >= 1 game in last 15.
// Used by leaders.js#loadLeaders + roster.js#renderPlayerList.
export function hotColdBadge(playerId){
  var cached = state.lastNCache[playerId];
  if(!cached || !cached.last15) return '';
  var l15stat = cached.last15;
  var gp = parseInt(l15stat.gamesPlayed, 10) || 0;
  if(gp < HOT_COLD_MIN_GAMES) return '';
  var l15 = parseFloat(l15stat.ops);
  if(isNaN(l15)) return '';
  var fmtO = function(n){ var s = n.toFixed(3); return s.charAt(0)==='0'?s.slice(1):s; };
  var tip = 'Last 15 OPS '+fmtO(l15)+' ('+gp+' games)';
  if(l15 >= HOT_COLD_OPS_HOT) return ' <span class="story-badge hot stats-hot-cold" title="'+tip+'">🔥 HOT</span>';
  if(l15 < HOT_COLD_OPS_COLD) return ' <span class="story-badge cold stats-hot-cold" title="'+tip+'">❄ COLD</span>';
  return '';
}
