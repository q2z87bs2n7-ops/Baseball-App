// Stat math + decoration helpers for the Stats tab. Pure functions; no DOM
// access, no fetches. Source-of-truth for percentile lookups is
// state.leagueLeaders, populated by fetchLeagueLeaders() in src/sections/loaders.js.

import { state } from '../state.js';
import { LEADER_CATS_FOR_PERCENTILE } from '../config/constants.js';

// Map a player-stat field (e.g. 'avg') + group → leader-category metadata.
export function leaderEntry(group, statKey) {
  return LEADER_CATS_FOR_PERCENTILE.find(function(e) {
    return e.group === group && e.key === statKey;
  });
}

// Compute {rank, total, percentile, outsideTop} for a player's value against
// the league leaders cache. Returns null if cache empty or stat not
// configured. Higher rank number = worse (rank 1 = league best). Polarity
// controlled by entry.lowerIsBetter (e.g. ERA: lower = better). The
// `outsideTop` flag is true when the player's value strictly loses to every
// entry in the leader pool (and doesn't tie the last one) — so the rank
// fallback `arr.length` doesn't actually mean "tied for last in the
// leaderboard", it means "below the leader pool entirely". Used by the
// renderer to swap "#100 of 100 MLB" for "Outside MLB top 100" so a qualified
// hitter just below the leader cohort doesn't look like a bug.
export function computePercentile(group, statKey, value) {
  if (value == null || value === '') return null;
  var entry = leaderEntry(group, statKey);
  if (!entry) return null;
  var arr = state.leagueLeaders[group + ':' + entry.leaderCategory];
  if (!arr || !arr.length) return null;
  var v = parseFloat(value);
  if (isNaN(v)) return null;
  // arr is sorted best→worst by fetchLeagueLeaders. Find first index where v
  // would no longer beat the existing entry — that's our rank.
  var rank = arr.length;
  var foundInPool = false;
  for (var i = 0; i < arr.length; i++) {
    var beats = entry.lowerIsBetter ? v < arr[i].value : v > arr[i].value;
    if (beats) { rank = i + 1; foundInPool = true; break; }
    var ties = v === arr[i].value;
    if (ties) { rank = i + 1; foundInPool = true; break; }
  }
  var total = arr.length;
  var percentile = Math.max(0, Math.min(100, Math.round(((total - rank) / Math.max(1, total - 1)) * 100)));
  return { rank: rank, total: total, percentile: percentile, outsideTop: !foundInPool };
}

// Quality tier from percentile. Used for both bar color and box-bg accent.
export function tierFromPercentile(p) {
  if (p == null) return null;
  if (p >= 90) return 'elite';
  if (p >= 65) return 'good';
  if (p >= 30) return 'mid';
  return 'bad';
}

// Colored percentile bar HTML. Empty string when percentile unavailable.
export function pctBar(percentile) {
  if (percentile == null) return '';
  var tier = tierFromPercentile(percentile);
  return '<div class="pct-bar pct-bar--' + tier + '"><i style="width:' + percentile + '%"></i></div>';
}

// "#9 · Top 6%" caption when in the top decile, "#41" otherwise. Caller is
// responsible for skipping this entirely when the player is outside the
// leader pool (see renderOverviewTab in loaders.js).
export function rankCaption(rank, total) {
  if (rank == null || total == null) return '';
  var topPct = total ? Math.max(1, Math.round((rank / total) * 100)) : 100;
  var label = '#' + rank + (topPct <= 10 ? ' · Top ' + topPct + '%' : '');
  return '<div class="rank-caption"><span>MLB</span><b>' + label + '</b></div>';
}

// "Avg: X" comparison chip. Shows the basis (league or team) average of the
// stat directly — caller decides which basis. Coloring: green when the player
// beats the basis, red when below. Polarity flips for lower-is-better stats
// via the `lowerIsBetter` flag. decimals controls formatting; rate-style
// values (decimals ≥ 3) drop their leading zero (.248 not 0.248).
export function avgChip(playerValue, basisValue, decimals, lowerIsBetter) {
  if (basisValue == null) return '';
  decimals = decimals === undefined ? 3 : decimals;
  var b = parseFloat(basisValue);
  if (isNaN(b)) return '';
  var s = b.toFixed(decimals);
  if (decimals >= 3 && s.charAt(0) === '0') s = s.slice(1);
  var p = playerValue == null ? NaN : parseFloat(playerValue);
  var cls = '';
  if (!isNaN(p)) {
    var beats = lowerIsBetter ? p < b : p > b;
    cls = beats ? ' pos' : ' neg';
  }
  return '<span class="delta-chip avg-chip' + cls + '">Avg: ' + s + '</span>';
}

// Mean of every entry in the league leaders cache for a stat. Approximates
// "average qualified player" — fetchLeagueLeaders pulls /stats/leaders with
// limit=300 (server-capped at ~100 per category in practice). Returns null if
// the cache is empty or the stat isn't configured.
export function leagueAverage(group, statKey) {
  var entry = leaderEntry(group, statKey);
  if (!entry) return null;
  var arr = state.leagueLeaders[group + ':' + entry.leaderCategory];
  if (!arr || !arr.length) return null;
  var sum = 0;
  for (var i = 0; i < arr.length; i++) sum += arr[i].value;
  return sum / arr.length;
}

// Mean across the active team's roster from state.statsCache. Used for the
// "vs team" basis option. Returns null if statsCache is empty for the group.
export function teamAverage(group, statKey) {
  var pool = state.statsCache[group] || [];
  if (!pool.length) return null;
  var sum = 0, n = 0;
  for (var i = 0; i < pool.length; i++) {
    var raw = pool[i].stat ? pool[i].stat[statKey] : null;
    var v = raw == null ? NaN : parseFloat(raw);
    if (!isNaN(v)) { sum += v; n++; }
  }
  return n ? sum / n : null;
}
