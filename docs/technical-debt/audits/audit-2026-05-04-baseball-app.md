# Code Audit Report: Baseball App v3.32.1

**Date:** 2026-05-04
**App Version:** v3.32.1 (`sw.js` CACHE: `mlb-v471`)
**Branch:** `claude/tech-debt-audit-e5E4H`
**Files Reviewed:** `index.html` (7,151 lines), `focusCard.js` (659 lines), `pulse-card-templates.js` (256 lines), `collectionCard.js` (607 lines), `sw.js` (48 lines)
**Previous Audit:** 2026-05-01 (v2.62, 4,663 lines) — fixed N1, N3 (mostly), N4, H4; deferred H3/M1–M4/L1/L2

---

## Executive Summary

**Total Issues Found:** 10 (8 deferred + 2 new)
**Severity Distribution:** 1 HIGH (deferred), 5 MEDIUM (deferred), 2 LOW (deferred), 2 LOW (new)
**File growth:** 4,663 → 7,151 lines (+2,488 lines, +53%) since last audit. Major new features: Yesterday Recap, Card Collection, Live Game Radio, Pulse rebrand, day-shape state machine, 6 new story generators, My Team lens, sign-in/sync system.

**Fixes confirmed since last audit (v2.62 → v3.32):**
- ✅ H4 — AbortController added: `pulseAbortCtrl`, `focusAbortCtrl`, `liveAbortCtrl` all present
- ✅ N1 — Both `// DEBUG START/END` blocks removed; no markers remain in codebase
- ✅ N3 — `const DEBUG=false` added at line 1547; majority of console.log calls wrapped in `if(DEBUG)`
- ✅ N4 — Null guards added to `pollFocusLinescore` for batter/pitcher name fields

**Net status:** 4 of 12 prior issues resolved. 8 deferred issues remain (H3, M1–M4, L1–L2). 2 new LOW issues identified.

---

## Deferred Issues (Re-Verified from 2026-05-01)

---

### H3: Fetch Calls Without `r.ok` Validation (DEFERRED, WORSENED)

**Severity:** HIGH
**Previous count:** ~50 fetch calls | **Current count:** ~71 fetch calls; ~20 lack `r.ok` check before `.json()`
**Root Cause:** File grew by 53%. New features (Yesterday Recap, Card Collection sync, story generators, Radio Check) added fetch calls continuing the bare `await fetch()` then `.json()` pattern. No team-wide convention to check `.ok` before parsing.

**Notable missing `r.ok` checks (sampled):**
- Line 1888: `pollGamePlays` timestamps fetch — if API returns 503, `.json()` throws SyntaxError, caught silently
- Lines 3624/3626: `loadDailyLeaders` — both hitting and pitching fetches lack `.ok`; empty catch `{}` means silent failure
- Line 3156: `loadTransactionsCache` — transactions fetch has try-catch but no `.ok`
- Line 3227: `loadLiveWPCache` contextMetrics fetch — no `.ok`
- Line 3474: `loadOnThisDayCache` — no `.ok`
- Line 4137: `fetchCareerStats` — no `.ok`, though try-catch returns null on error

**Why it matters in practice:** Most are wrapped in try-catch, so a non-JSON body (e.g., Cloudflare 503 HTML) throws a SyntaxError that's silently swallowed. The real risk is a 4xx/5xx response with a valid JSON error body (e.g., `{"error":"Too Many Requests"}`) which parses successfully and is treated as good data — causing downstream errors that are harder to trace.

**Proposed Fix:** Add `if(!r.ok) throw new Error(r.status)` immediately after each `await fetch(...).json()` or before `.json()`. One line per call site.

**Effort:** 3–4 hours (71 sites; targeted on highest-risk ones first) | **Risk:** Low

---

### M1: `var` Declarations — ES6 Upgrade (DEFERRED, WORSENED)

**Severity:** MEDIUM
**Previous count:** ~828 `var` declarations | **Current count:** ~1,373 raw matches (~1,100 estimated declarations, accounting for string/comment hits)
**`let`/`const` count:** 74 (≈6% adoption — marginal improvement from 5%)
**Root Cause:** All new features continued the `var` pattern. No migration policy enforced.

**Impact:** Hoisting bugs possible in nested loops; `var` inside `if`/`for` blocks leaks to function scope; modern tooling cannot optimise.

**Proposed Fix:** Targeted pass on new feature code (Yesterday Recap, Card Collection, Radio, Sign-in) which were written entirely in `var`. Not a full file sweep.

**Effort:** 2–3 hours (targeted) | **Risk:** Low-Medium

---

### M2: Inline `style=""` Attributes (DEFERRED, WORSENED)

**Severity:** MEDIUM
**Previous count:** 301 | **Current count:** 340
**Root Cause:** New features (Card Collection binder, Yesterday Recap layout, Radio Check overlay, sign-in CTA toast) use inline styles in JS template strings. `collectionCard.js` and `pulse-card-templates.js` are also heavily inline-styled.

**Impact:** Responsive overrides impossible via `@media`; styles scattered across JS strings; maintenance requires searching template literals.

**Proposed Fix:** Extract repeated style clusters from highest-use Pulse components to CSS classes. Full extraction not feasible — target top 20% by recurrence.

**Effort:** 3–4 hours (targeted) | **Risk:** Low

---

### M3: Inline `onclick=""` Handlers (DEFERRED, WORSENED)

**Severity:** MEDIUM
**Previous count:** 95 | **Current count:** 136
**Root Cause:** New features (Card Collection binder nav, Radio Check rows, Yesterday Recap, sign-in CTA, Dev Tools) added ~41 more inline handlers.

**Impact:** No event delegation; handlers cannot be removed; CSP policies would block them; untestable.

**Proposed Fix:** Convert highest-density areas (Pulse side rail, Dev Tools panel, binder) to delegated `addEventListener` with `data-*` attributes.

**Effort:** 3–4 hours (targeted) | **Risk:** Low-Medium

---

### M4: Timer Cleanup Without Central Registry (DEFERRED, UNCHANGED)

**Severity:** MEDIUM
**Active timer globals (11 total):**
- `pulseTimer`, `storyRotateTimer`, `storyPoolTimer`, `countdownTimer` — Pulse polling
- `yesterdayRefreshTimer` — hourly yesterday refresh (new since v2.62)
- `focusFastTimer` — 5s focus mode polling
- `newsRotateTimer` — news carousel rotation
- `demoTimer` — demo mode playback
- `liveInterval` — live game view refresh
- `homeLiveTimer`, `leagueRefreshTimer` — home card and league tab auto-refresh (new since v2.62)

**`clearInterval`/`clearTimeout` calls:** 39 (up from 31 at last audit — coverage tracking new timers)
**Root Cause:** Each new feature adds its own timer global. No single audit point.

**Potential gap:** `homeLiveTimer` is cleared in `loadTodayGame()` and `switchTeam()` but not on section navigate-away (navigating to Schedule while a live home card is showing leaves the timer running until next `loadTodayGame()` call).

**Proposed Fix:** Lightweight `TIMERS` registry object (`TIMERS.set(key, handle)` / `TIMERS.clear(key)`). Not a full refactor — just a registry pattern with `clearAll()` on team switch.

**Effort:** 2 hours | **Risk:** Low

---

### L1: Magic Numbers Hardcoded (DEFERRED, UNCHANGED)

**Severity:** LOW
**Examples:**
- `5000` ms (focus poll interval) — hardcoded in `setFocusGame()` 3 times
- `3600000` ms (1hr yesterday refresh) — in `initReal()`
- `30000` ms (30s story pool rebuild) — in `initReal()`
- `5500` ms (player card dismiss) — in `showPlayerCard()`
- `8000` ms (sign-in CTA auto-dismiss) — in `showSignInCTA()`
- `280` ms (card close animation) — in `dismissPlayerCard()`

**Note:** Major thresholds are in `devTuning`/`devTuningDefaults` — good. Remaining are timing/animation constants not user-tunable.

**Proposed Fix:** Extract remaining timing constants to a `TIMING` constant object at top of JS section.

**Effort:** 1 hour | **Risk:** Very low

---

### L2: Function Naming Inconsistency (DEFERRED, UNCHANGED)

**Severity:** LOW
**Examples (old + new):**
- `tcLookup()` vs inline `TEAMS.find()` (50+ call sites, mixed usage)
- `loadYesterdayCache()` vs `fetchGameContent()` vs `fetchCareerStats()` — inconsistent `load`/`fetch` prefix convention
- `renderEmptyState()` vs `updateFeedEmpty()` — both touch the empty state but different verbs
- `openYesterdayRecap()` vs `closeYesterdayRecap()` vs `openCollection()` vs `closeCollection()` — consistent within pairs but no global convention

**Proposed Fix:** Documentation-only: add naming convention comment block at top of JS section. No renames (regression risk across 7,151 lines).

**Effort:** 30 minutes | **Risk:** None

---

## New Issues (v2.62 → v3.32)

---

### N5: 3 Unguarded `console.log` Calls Outside `DEBUG` Flag (NEW, LOW)

**Severity:** LOW
**Lines:**
- Line 6105: `console.log('[Sync] Collection synced', ...)` — inside `syncCollection()`; fires every 30s when signed in
- Line 6121: `console.log('[Sync] Merged', ...)` — inside `mergeCollectionOnSignIn()`; fires on sign-in
- Line 6547: `console.log('Video ready to play')` — inside `playHighlightVideo()`; fires every time a highlight video becomes ready

**Root Cause:** The `DEBUG` constant and wrapping pattern were applied to the Pulse/demo/carousel sections of the file, but the Card Collection sync and Yesterday Recap video sections (added later in v3.x) were not retrofitted.

**Note:** `console.warn` at lines 6204 and 6214 (wake lock failures) are in `catch` blocks and are legitimate operational signals — leave those as-is.

**Impact:** Console noise for signed-in users (sync log fires every 30s); exposes card count to DevTools; minor performance cost on video load.

**Proposed Fix:** Wrap each in `if(DEBUG)`:
```javascript
// Line 6105
if(DEBUG) console.log('[Sync] Collection synced', Object.keys(data.collection).length, 'cards');

// Line 6121
if(DEBUG) console.log('[Sync] Merged', Object.keys(merged).length, 'cards from server');

// Line 6547
if(DEBUG) console.log('Video ready to play');
```

**Effort:** 5 minutes | **Risk:** None

---

### N6: `.catch().then()` Chain in exportJson Modal — "Copied!" on Failure (NEW, LOW)

**Severity:** LOW
**Line:** 1989
**Current code:**
```javascript
navigator.clipboard.writeText(el.value)
  .catch(function(){ el.select(); document.execCommand('copy'); })
  .then(function(){ alert('Copied!'); });
```

**Bug:** `.catch()` swallows the rejection and returns a resolved promise. `.then()` then always fires regardless of whether either copy method succeeded. If `navigator.clipboard` fails **and** `execCommand('copy')` also fails (e.g., no selection, sandboxed iframe), the user still sees `alert('Copied!')` — false confirmation.

**Additionally:** The modal is removed synchronously (`this.parentElement...remove()`) before the async chain resolves, so the `alert()` fires against an already-removed DOM context. No crash, but the sequencing is surprising.

**Proposed Fix:** Use `.then()/.catch()` (not `.catch().then()`) so success and failure are handled independently:
```javascript
navigator.clipboard.writeText(el.value)
  .then(function(){ alert('Copied!'); })
  .catch(function(){
    try { el.select(); document.execCommand('copy'); alert('Copied!'); }
    catch(e) { alert('Copy failed — please copy manually.'); }
  });
```

**Effort:** 10 minutes | **Risk:** None

---

## Summary Table

| ID | Title | Severity | Effort | Status |
|---|---|---|---|---|
| H3 | Fetch calls missing `r.ok` check (~20 sites) | HIGH | 3–4h | Deferred — awaiting approval |
| M1 | `var` → `let`/`const` (~1,100 declarations) | MEDIUM | 2–3h | Deferred — awaiting approval |
| M2 | Inline `style=` attributes (340) | MEDIUM | 3–4h | Deferred — awaiting approval |
| M3 | Inline `onclick=` handlers (136) | MEDIUM | 3–4h | Deferred — awaiting approval |
| M4 | Timer cleanup / central registry (11 timers) | MEDIUM | 2h | Deferred — awaiting approval |
| L1 | Magic numbers — extract to TIMING object | LOW | 1h | Deferred — awaiting approval |
| L2 | Function naming convention doc | LOW | 30 min | Deferred — awaiting approval |
| N5 | 3 unguarded `console.log` calls | LOW | 5 min | **New — awaiting approval** |
| N6 | `.catch().then()` chain — false "Copied!" | LOW | 10 min | **New — awaiting approval** |

**Total scope if all approved:** ~15–20 hours
**Recommended scope for this sprint:** N5 + N6 (15 min, zero risk quick wins) — plus one deferred item if desired

---

## Confirmed Fixed (Do Not Re-Audit)

| ID | Title | Fixed in | Notes |
|---|---|---|---|
| H4 | AbortController on fetch polls | v3.x | `pulseAbortCtrl`, `focusAbortCtrl`, `liveAbortCtrl` all present |
| N1 | Two active DEBUG console.log blocks | v3.x | No `// DEBUG START/END` markers remain |
| N2 | `execCommand('copy')` as primary | v3.x | Now fallback inside `fallbackCopy()` with try-catch |
| N3 | 38 unguarded console calls | v3.x | `const DEBUG=false` + `if(DEBUG)` wrapping; 3 new unguarded calls tracked as N5 |
| N4 | Null guard in `pollFocusLinescore` | v3.x | Optional chaining on `offense?.batter`, `defense?.pitcher` |

---

## Audit Sign-Off

**Auditor:** Claude
**Date:** 2026-05-04
**App Version:** v3.32.1
**Confidence:** HIGH
**Methodology:** grep-based pattern analysis + manual code review of key functions (`pollLeaguePulse`, `pollFocusLinescore`, `syncCollection`, `loadDailyLeaders`, `loadTransactionsCache`, `playHighlightVideo`, timer globals); cross-referenced against previous audit findings.
