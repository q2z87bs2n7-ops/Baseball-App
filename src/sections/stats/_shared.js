// Shared helpers for the Stats tab modules (leaders / roster / player).
// These would otherwise force circular imports between the sub-modules.

import { state } from '../../state.js';

// HOT / COLD thresholds: last-15 OPS absolute values.
// Only badge players who have played >= 7 of last 10 games (strong recency requirement).
// HOT if last-15 OPS >= .900, COLD if < .500.
export const HOT_COLD_OPS_HOT = 0.900;
export const HOT_COLD_OPS_COLD = 0.500;
export const HOT_COLD_MIN_GAMES_IN_10 = 7;
export const HOT_COLD_TTL_MS = 12 * 60 * 60 * 1000;

// Center an active tab inside its horizontally-scrolling container. Only scrolls
// when the container actually overflows, so it's a no-op on desktop where tabs
// fit on one row. Used by switchLeaderTab + switchRosterTab + switchPlayerStatsTab.
export function scrollTabIntoView(btn){
  if(!btn||!btn.parentElement)return;
  const p=btn.parentElement;
  if(p.scrollWidth<=p.clientWidth)return;
  const tgt=btn.offsetLeft-(p.clientWidth-btn.offsetWidth)/2;
  p.scrollTo({left:Math.max(0,tgt),behavior:'smooth'});
}

// Returns inline HOT/COLD badge HTML for a player, or '' if no signal.
// Reads state.lastNCache (populated by roster's fetchLastN).
// Requires >= 7 games in last 10 (active player check).
// HOT: last-15 OPS >= .900. COLD: last-15 OPS < .600.
// Used by leaders.js#loadLeaders + roster.js#renderPlayerList.
export function hotColdBadge(playerId){
  const cached = state.lastNCache[playerId];
  if(!cached || !cached.last10 || !cached.last15) return '';
  const gp10 = parseInt(cached.last10.gamesPlayed, 10) || 0;
  if(gp10 < HOT_COLD_MIN_GAMES_IN_10) return '';
  const l15 = parseFloat(cached.last15.ops);
  if(isNaN(l15)) return '';
  const fmtO = function(n){ const s = n.toFixed(3); return s.charAt(0)==='0'?s.slice(1):s; };
  const tip = 'Last 15 OPS '+fmtO(l15)+' ('+gp10+'/10 games)';
  if(l15 >= HOT_COLD_OPS_HOT) return ' <span class="story-badge hot stats-hot-cold" title="'+tip+'">🔥 HOT</span>';
  if(l15 < HOT_COLD_OPS_COLD) return ' <span class="story-badge cold stats-hot-cold" title="'+tip+'">❄ COLD</span>';
  return '';
}
