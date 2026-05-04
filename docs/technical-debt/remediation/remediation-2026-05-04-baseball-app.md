# Remediation Report: Baseball App v3.32.1 → v3.33

**Date:** 2026-05-04
**Branch:** `claude/tech-debt-audit-e5E4H`
**Audit:** `audits/audit-2026-05-04-baseball-app.md`
**Version:** v3.32.1 → v3.33 | CACHE mlb-v471 → mlb-v472

---

## Issues Fixed (9 of 9 approved)

### N5 — 3 unguarded `console.log` calls (LOW)
**Lines fixed:** 6105, 6121, 6547
Wrapped each in `if(DEBUG)`:
```javascript
// Before
console.log('[Sync] Collection synced', Object.keys(data.collection).length, 'cards');
// After
if(DEBUG) console.log('[Sync] Collection synced', Object.keys(data.collection).length, 'cards');
```
Same pattern applied to `mergeCollectionOnSignIn` and `playHighlightVideo` ready-to-play log.

---

### N6 — `.catch().then()` false confirmation bug (LOW)
**Line:** 1989 (exportJson Copy button)
```javascript
// Before — .then() fires even after both copy methods fail
navigator.clipboard.writeText(el.value)
  .catch(function(){ el.select(); document.execCommand('copy'); })
  .then(function(){ alert('Copied!'); });

// After — branched correctly; fallback try-catch with distinct failure message
navigator.clipboard.writeText(el.value)
  .then(function(){ alert('Copied!'); },
        function(){ try{ el.select(); document.execCommand('copy'); alert('Copied!'); }
                    catch(e){ alert('Copy failed — please copy manually.'); } });
```

---

### L2 — Naming convention doc (LOW)
Added `// ── Naming conventions ──` comment block after `const DEBUG=false` (line ~1550).
Documents 11 prefixes: `load/fetch/render/poll/gen/show/open/close/update/toggle/set` + `tcLookup` note.
No code changes — documentation only.

---

### L1 — Magic numbers → TIMING constant (LOW)
Added `const TIMING` object before League Pulse globals (line ~1607):
```javascript
const TIMING={
  PULSE_POLL_MS:        15000,
  FOCUS_POLL_MS:         5000,
  LIVE_REFRESH_MS:      30000,
  HOME_LIVE_MS:         60000,
  LEAGUE_REFRESH_MS:    60000,
  STORY_POOL_MS:        30000,
  YESTERDAY_REFRESH_MS: 3600000,
  CARD_DISMISS_MS:       5500,
  CARD_CLOSE_ANIM_MS:     280,
  ALERT_DISMISS_MS:      8000,
  SIGNIN_CTA_MS:         8000,
  SYNC_INTERVAL_MS:     30000,
};
```
Wired into 12 call sites across `initReal()`, `loadTodayGame()`, `loadLeagueView()`, `showPlayerCard()`, `dismissPlayerCard()`, `showSignInCTA()`, `startSyncInterval()`, `fetchLiveGame()`.

---

### H3 — `r.ok` validation before `.json()` (HIGH)
**~25 fetch call sites** hardened with `if(!r.ok) throw new Error(r.status)` before every `.json()` call.

**Sites fixed:**
| Function | Fetch target |
|---|---|
| `fetchBoxscore` | `/game/{pk}/boxscore` |
| `pollLeaguePulse` | Primary schedule + yesterday fallback |
| `pollGamePlays` | Timestamps + playByPlay |
| `fetchMissingHRBatterStats` | Per-batter `/people/{id}/stats` |
| `loadProbablePitcherStats` | Per-pitcher `/people/{id}/stats` |
| `loadHighLowCache` | Per-stat `/highLow/player` (already had) |
| `genWinProbabilityStories` | `/game/{pk}/contextMetrics` |
| `loadLiveWPCache` | `/game/{pk}/contextMetrics` (Promise.all chain) |
| `loadOnThisDayCache` | Schedule + playByPlay |
| `loadYesterdayCache` | Schedule + playByPlay |
| `loadDailyLeaders` | Hitting + pitching leaders |
| `pollFocusLinescore` | `/game/{pk}/linescore` |
| `fetchFocusPlayerStats` | Batter + pitcher stats |
| `pollFocusRich` | Feed/live seed + timestamps + diffPatch |
| `fetchCareerStats` | `/people/{id}/stats?stats=career` |
| `loadTransactionsCache` | `/transactions` |
| `fetchTomorrowPreview` | Next-day schedule |
| `resolvePlayerCardData` | Batter stats (both call sites) |
| `fetchLiveGame` batter/pitcher | Inline live-view matchup stats |

Note: `console.warn` at lines 6204/6214 (wake lock catch blocks) left as-is — legitimate operational signals.

---

### M4 — Timer leak + registry (MEDIUM)
Two changes:

**1. `homeLiveTimer` nav-away leak fixed** in `showSection()`:
```javascript
// Before: only cleared in loadTodayGame() and switchTeam()
// After: also cleared on any section nav-away from home
if(id!=='home'&&homeLiveTimer){clearInterval(homeLiveTimer);homeLiveTimer=null;}
```

**2. `TIMERS` registry added** after `TIMING` constant:
```javascript
const TIMERS={
  _h:{},
  set:function(key,handle){if(this._h[key])clearInterval(this._h[key]);this._h[key]=handle;},
  clear:function(key){if(this._h[key]){clearInterval(this._h[key]);this._h[key]=null;}},
  clearAll:function(){Object.keys(this._h).forEach(function(k){if(TIMERS._h[k]){clearInterval(TIMERS._h[k]);TIMERS._h[k]=null;}});}
};
```
Registry is now available for wiring up the 11 timer globals in a future sprint. `clearAll()` can be called on team switch as a safety net.

---

### M1 — Targeted `var` → `const`/`let` (MEDIUM)
Targeted pass on the newest feature code (Card Collection sync + sign-in):

- `syncCollection()` — `var local`, `var r`, `var data` → `const`
- `mergeCollectionOnSignIn()` — `var r`, `var data`, `var local`, `var merged` → `const`
- `mergeCollectionSlots()` — `var merged`, `var lr`, `var rr`, `var newer`, `var em`, `var events` → `const`; inner `var r` renamed to `ranks` (clash avoidance)
- `signInWithGitHub()` — `var state`, `var githubAuthUrl` → `const`
- IIFE auth handler — `var params`, `var authToken`, `var authMethod` → `const`

~30 declarations converted. Bulk conversion of remaining ~1,070 `var` declarations deferred (M1 remains open as a future sprint item).

---

### M2 — Extract inline styles to CSS classes (MEDIUM)
Added 6 utility CSS classes extracted from the 5 most-repeated inline style patterns:

```css
.dt-label-muted  { font-size:.6rem; color:var(--muted) }
.dt-input        { width:100%; padding:3px; background:var(--card); border:1px solid var(--border); color:var(--text); border-radius:3px; font-size:.65rem }
.dt-label        { font-weight:600; color:var(--text); margin-bottom:4px }
.dt-grid-2       { display:grid; grid-template-columns:1fr 1fr; gap:6px }
.dt-box          { padding:8px; background:var(--card2); border-radius:4px }
.dt-color-input  { width:100%; height:30px; cursor:pointer; border:1px solid var(--border); border-radius:3px }
```

**Inline attributes replaced:** ~77 (20 + 19 + 11 + 11 + 10 + 6 occurrences respectively).
Full extraction of remaining 263 inline styles deferred (M2 remains open for future sprint).

---

### M3 — Dev Tools panel onclick → delegated listener (MEDIUM)
Converted 13 static HTML `onclick` handlers in `#devToolsPanel` to `data-dt-action` attributes + single delegated `addEventListener` on the panel.

```javascript
// Single delegated handler replaces 13 inline onclick= attributes
document.addEventListener('DOMContentLoaded', function() {
  var panel = document.getElementById('devToolsPanel');
  panel.addEventListener('click', function(e) {
    var btn = e.target.closest('[data-dt-action]');
    if (!btn) return;
    var action = btn.dataset.dtAction;
    // ... dispatch map ...
  });
});
```

Actions dispatched: `close`, `demo`, `replayHR`, `replayRBI`, `cardVariants`, `testCard`, `resetCollection`, `newsTest`, `resetTuning`, `captureApp`, `capturePulse`, `refreshDebug`, `confirm`.

Remaining dynamic template-string onclick handlers (Radio Check rows, binder cards, Pulse ticker chips) deferred — they require `data-*` attribute threading through multiple template functions (M3 remains partially open).

---

## Files Changed

| File | Changes |
|---|---|
| `index.html` | N5, N6, L1, L2, H3 (25 sites), M4, M1, M2, M3 — v3.32.1 → v3.33 |
| `sw.js` | CACHE mlb-v471 → mlb-v472 |

---

## Risk Assessment

| Fix | Risk | Notes |
|---|---|---|
| N5 / N6 | None | Console guards + branch fix |
| L1 / L2 | None | Additive constant + comment |
| H3 | Very Low | Throws in existing try-catch; degrades gracefully |
| M4 timer leak | Very Low | Additive clearInterval guard in showSection |
| M4 registry | None | Registry object unused until wired |
| M1 | Low | Targeted conversions in async functions; `const` on non-reassigned locals |
| M2 | Low | CSS class extraction; visual regression possible only if computed specificity changes |
| M3 | Low | Delegated listener; `data-dt-action` replaces onclick; same dispatch logic |
