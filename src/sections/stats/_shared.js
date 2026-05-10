// Shared helpers for the Stats tab modules (leaders / roster / player).
// These would otherwise force circular imports between the sub-modules.

import { state } from '../../state.js';

// HOT / COLD threshold: last-15 OPS Δ vs season OPS. ±0.080 per Idea #03.
export const HOT_COLD_THRESHOLD = 0.080;
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
// Reads state.lastNCache (populated by roster's fetchLastN) and
// state.statsCache.hitting (populated by roster's fetchAllPlayerStats).
// Used by leaders.js#loadLeaders + roster.js#renderPlayerList.
export function hotColdBadge(playerId){
  var cached = state.lastNCache[playerId];
  if(!cached || !cached.last15) return '';
  var seasonEntry = (state.statsCache.hitting || []).find(function(p){ return p.player && p.player.id === playerId; });
  if(!seasonEntry || !seasonEntry.stat) return '';
  var l15 = parseFloat(cached.last15.ops);
  var sea = parseFloat(seasonEntry.stat.ops);
  if(isNaN(l15) || isNaN(sea)) return '';
  var delta = l15 - sea;
  var fmtO = function(n){ var s = n.toFixed(3); return s.charAt(0)==='0'?s.slice(1):s; };
  var tip = 'Last 15 OPS '+fmtO(l15)+' vs season '+fmtO(sea);
  if(delta >= HOT_COLD_THRESHOLD) return ' <span class="story-badge hot stats-hot-cold" title="'+tip+'">🔥 HOT</span>';
  if(delta <= -HOT_COLD_THRESHOLD) return ' <span class="story-badge cold stats-hot-cold" title="'+tip+'">❄ COLD</span>';
  return '';
}
