// Pure formatting helpers — no side effects, no dependencies on mutable state.
// Stat-display rules per CLAUDE.md "Stat Display Conventions" section.

import { TEAMS } from '../config/constants.js';

// Team lookup — id → { primary, abbr, name }. Returns a sentinel on miss.
export function tcLookup(id) {
  var t = TEAMS.find(function(t) { return t.id === id; });
  return t ? { primary: t.primary, abbr: t.short, name: t.name } : { primary: '#444', abbr: '???', name: 'Unknown' };
}

// Fixed-decimal stat formatter. Used for ERA, WHIP, K/9, BB/9, K/BB.
export function fmt(v, d) {
  d = d === undefined ? 3 : d;
  if (v == null || v === '') return '—';
  var n = parseFloat(v);
  if (isNaN(n)) return v;
  return n.toFixed(d);
}

// Rate formatter — strips leading zero for 0 < val < 1 (AVG, OBP, SLG, OPS, FPCT).
export function fmtRate(v, d) {
  d = d === undefined ? 3 : d;
  if (v == null || v === '') return '—';
  var n = parseFloat(v);
  if (isNaN(n)) return v;
  var s = n.toFixed(d);
  return (n > 0 && n < 1) ? s.slice(1) : s;
}

// "Mar 4 7:10 PM" style date+time.
export function fmtDateTime(ds) {
  var d = new Date(ds);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' +
         d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// News article timestamp formatter — "Mar 4 7:10 PM" or '' on bad input.
export function fmtNewsDate(iso) {
  if (!iso) return '';
  var d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// Opponent-color contrast picker. Falls back to opp primary if both opp colors
// are within RGB Euclidean distance 60 of myPrimary (e.g. Yankees navy vs Mets
// blue — distinct enough to read as "different team" only beyond that floor).
export function pickOppColor(oppPrimary, oppSecondary, myPrimary) {
  function rgbDist(a, b) {
    a = (a || '').replace('#', '');
    b = (b || '').replace('#', '');
    if (a.length < 6 || b.length < 6) return 999;
    var ar = parseInt(a.substr(0, 2), 16), ag = parseInt(a.substr(2, 2), 16), ab = parseInt(a.substr(4, 2), 16);
    var br = parseInt(b.substr(0, 2), 16), bg = parseInt(b.substr(2, 2), 16), bb = parseInt(b.substr(4, 2), 16);
    return Math.sqrt(Math.pow(ar - br, 2) + Math.pow(ag - bg, 2) + Math.pow(ab - bb, 2));
  }
  if (rgbDist(oppPrimary, myPrimary) >= 60) return oppPrimary;
  if (oppSecondary && rgbDist(oppSecondary, myPrimary) >= 60) return oppSecondary;
  return oppPrimary;
}
