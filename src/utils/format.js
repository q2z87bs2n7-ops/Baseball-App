// Pure formatting helpers — no side effects, no dependencies on mutable state.
// Stat-display rules per CLAUDE.md "Stat Display Conventions" section.

import { TEAMS } from '../config/constants.js';

// Team lookup — id → { primary, abbr, name }. Returns a sentinel on miss.
export function tcLookup(id) {
  const t = TEAMS.find(function(t) { return t.id === id; });
  return t ? { primary: t.primary, abbr: t.short, name: t.name } : { primary: '#444', abbr: '???', name: 'Unknown' };
}

// Fixed-decimal stat formatter. Used for ERA, WHIP, K/9, BB/9, K/BB.
export function fmt(v, d) {
  d = d === undefined ? 3 : d;
  if (v == null || v === '') return '—';
  const n = parseFloat(v);
  if (isNaN(n)) return v;
  return n.toFixed(d);
}

// Rate formatter — strips leading zero for 0 < val < 1 (AVG, OBP, SLG, OPS, FPCT).
export function fmtRate(v, d) {
  d = d === undefined ? 3 : d;
  if (v == null || v === '') return '—';
  const n = parseFloat(v);
  if (isNaN(n)) return v;
  const s = n.toFixed(d);
  return (n > 0 && n < 1) ? s.slice(1) : s;
}

// "Mar 4 7:10 PM" style date+time.
export function fmtDateTime(ds) {
  const d = new Date(ds);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' +
         d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// News article timestamp formatter — "Mar 4 7:10 PM" or '' on bad input.
export function fmtNewsDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// MLB schedule's anchor zone is America/New_York. Building "today" / "yesterday"
// from the user's local clock breaks for non-US users (e.g. Australia, where
// local "today" is the MLB schedule's "tomorrow"). Use these helpers for any
// date that gets sent to the MLB API or matched against game dates.
const ET_DATE_FMT = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
const ET_HOUR_FMT = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false });

export function etDateStr(d) { return ET_DATE_FMT.format(d || new Date()); }
export function etHour(d) { return parseInt(ET_HOUR_FMT.format(d || new Date()), 10) % 24; }
export function etDatePlus(dateStr, days) {
  const p = dateStr.split('-').map(Number);
  const u = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  u.setUTCDate(u.getUTCDate() + days);
  return u.getUTCFullYear() + '-' + String(u.getUTCMonth() + 1).padStart(2, '0') + '-' + String(u.getUTCDate()).padStart(2, '0');
}

// Opponent-color contrast picker. Falls back to opp primary if both opp colors
// are within RGB Euclidean distance 60 of myPrimary (e.g. Yankees navy vs Mets
// blue — distinct enough to read as "different team" only beyond that floor).
export function pickOppColor(oppPrimary, oppSecondary, myPrimary) {
  function rgbDist(a, b) {
    a = (a || '').replace('#', '');
    b = (b || '').replace('#', '');
    if (a.length < 6 || b.length < 6) return 999;
    const ar = parseInt(a.substr(0, 2), 16), ag = parseInt(a.substr(2, 2), 16), ab = parseInt(a.substr(4, 2), 16);
    const br = parseInt(b.substr(0, 2), 16), bg = parseInt(b.substr(2, 2), 16), bb = parseInt(b.substr(4, 2), 16);
    return Math.sqrt(Math.pow(ar - br, 2) + Math.pow(ag - bg, 2) + Math.pow(ab - bb, 2));
  }
  if (rgbDist(oppPrimary, myPrimary) >= 60) return oppPrimary;
  if (oppSecondary && rgbDist(oppSecondary, myPrimary) >= 60) return oppSecondary;
  return oppPrimary;
}
