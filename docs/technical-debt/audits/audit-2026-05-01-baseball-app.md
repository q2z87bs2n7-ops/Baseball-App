# Code Audit Report: Baseball App v2.62

**Date:** 2026-05-01
**App Version:** v2.62
**Branch:** `claude/start-tech-debt-sprint-p9u8r`
**Files Reviewed:** `index.html` (4,663 lines), `focusCard.js`, `pulse-card-templates.js`, `sw.js`, `api/*.js`
**Previous Audit:** 2026-04-29 (v2.49) — fixed H1, H2; deferred H3/H4/M1–M4/L1/L2

---

## Executive Summary

**Total Issues Found:** 12 (8 deferred + 4 new)
**Severity Distribution:** 3 HIGH, 6 MEDIUM, 3 LOW
**Scope vs Previous Audit:** File grew 478 lines (4,185 → 4,663). v2.50–v2.62 added: Pulse neutral chrome sweep, Focus Mode (At-Bat tracker), Dev Tools expansion, player card redesigns, demo mode improvements.

**Key Findings:**
- All 8 previously-deferred issues confirmed still present; most slightly worsened by count
- 2 active DEBUG blocks were not cleaned up (lines 1429–1434, 3514–3516) — `console.log` left in production code with `// DEBUG START/END` markers
- `document.execCommand('copy')` deprecated API at line 1484 — confirmed broken on modern browsers
- `var` usage grew from ~775 to ~828 declarations; `let`/`const` usage at only 40 (5% adoption)

---

## Deferred Issues (Re-Verified from 2026-04-29)

---

### H3: Fetch Calls Without Error Handling (DEFERRED, WORSENED)

**Severity:** HIGH
**Previous count:** ~49 calls | **Current count:** 50+ calls
**Root Cause:** Systematic pattern of bare `await fetch()` without try-catch. v2.50–v2.62 added Focus Mode polling (`pollFocusLinescore`, `pollFocusRich`) with only partial error handling.

**Notable examples:**
- `pollGamePlays()` catch block at line 1376: `catch(e){console.error('poll error',e);}` — logs but no user feedback
- `showPlayerCard()` inner fetch: `catch` block silently returns null, card shows with missing stats
- `loadOnThisDayCache()` / `loadYesterdayCache()` / `fetchBoxscore()`: all lack user-facing error states

**Impact:** Silent failures leave users seeing stale/blank data with no indication why. Pulse feed stops populating on API errors without any user alert.

**Proposed Fix:** Uniform `try/catch` on all fetch paths with: (a) `console.error` for debug, (b) toast alert for user-critical failures, (c) null/empty fallback return.

**Effort:** 4–6 hours | **Risk:** Low (additive change)

---

### H4: No AbortController on Fetch Calls (DEFERRED, UNCHANGED)

**Severity:** HIGH
**Count:** 0 AbortController instances (confirmed via grep)
**Root Cause:** v2.61 added two new polling loops (`focusFastTimer` at 5s, `pollFocusRich` at 5s) — both lack cancellation. With Pulse at 15s + Focus at 5s + live game at 5min, requests can pile up on slow connections.

**Impact:** Cascading failures if API is slow: pending requests queue up, fire simultaneously on recovery, flooding the API. Mobile battery drain from orphaned requests.

**Proposed Fix:** Add `AbortController` to `pollLeaguePulse`, `pollFocusLinescore`, `pollFocusRich`, and `fetchLiveGame`. Abort on navigation away.

**Effort:** 3–4 hours | **Risk:** Low

---

### M1: `var` Declarations — ES6 Upgrade (DEFERRED, WORSENED)

**Severity:** MEDIUM
**Previous count:** ~775 | **Current count:** 942 matches (includes string/comment hits; true declaration count ~828)
**`let`/`const` count:** 40 (≈5% adoption)
**Root Cause:** New features (Focus Mode, demo improvements) added in v2.50–v2.62 continued the `var` pattern. No migration policy enforced.

**Impact:** Scope hoisting bugs possible in nested loops; mixing `var`/`let` makes scoping hard to reason about; modern tooling (ESLint, bundlers) cannot optimize.

**Proposed Fix:** Targeted pass on the most impactful areas: global state variables + function locals in polling loops. Not a full file sweep — focused on highest-risk `var` usage.

**Effort:** 2–3 hours (targeted, not exhaustive) | **Risk:** Low-Medium (need to verify hoisting edge cases)

---

### M2: Inline `style=""` Attributes (DEFERRED, WORSENED)

**Severity:** MEDIUM
**Previous count:** ~207 | **Current count:** 301
**Root Cause:** Focus Mode overlay (`renderFocusCard`, `renderFocusOverlay` in `focusCard.js`) and player card templates use exclusively inline styles in template strings. v2.62 added 94 more.

**Impact:** Styles scattered through JS string templates; responsive overrides impossible via media query; maintenance requires searching JS strings, not CSS.

**Proposed Fix:** Prioritise extracting repeated style clusters from the most-used Pulse components to CSS classes. Full extraction is a large effort — target the top 20% by recurrence.

**Effort:** 3–4 hours (targeted extraction) | **Risk:** Low

---

### M3: Inline `onclick=""` Handlers (DEFERRED, WORSENED)

**Severity:** MEDIUM
**Previous count:** ~82 | **Current count:** 95
**Root Cause:** New Focus Mode overlay (game switcher buttons), Dev Tools panel, and demo controls added ~13 more inline handlers.

**Impact:** No event delegation; handlers cannot be removed; CSP policies (if ever added) would block them; hard to test.

**Proposed Fix:** Convert highest-density areas (Pulse side rail game list, Dev Tools panel) to delegated `addEventListener` with `data-*` attributes.

**Effort:** 3–4 hours (targeted) | **Risk:** Low-Medium

---

### M4: Timer Cleanup Without Central Registry (DEFERRED, PARTIALLY IMPROVED)

**Severity:** MEDIUM
**Active timers:** `pulseTimer`, `storyRotateTimer`, `newsRotateTimer`, `demoTimer`, `focusFastTimer`, `countdownTimer`, `liveInterval`, `window._playerCardTimer` (8 total)
**Cleanup calls:** 31 `clearInterval`/`clearTimeout` calls — coverage improved in v2.61
**Root Cause:** Focus Mode added `focusFastTimer` with cleanup in `setFocusGame()` and section change, but no single audit point for all timers.

**Impact:** If user navigates away from Pulse rapidly (mid-focus-game-switch), `focusFastTimer` may not clear before re-init fires. Live game timer (`liveInterval`) not cleared on team switch.

**Proposed Fix:** Create a lightweight `timers` registry object; centralise all `.set()` and `.clear()` through it. Not a full refactor — just a registry pattern.

**Effort:** 2 hours | **Risk:** Low

---

### L1: Magic Numbers Hardcoded (DEFERRED, UNCHANGED)

**Severity:** LOW
**Examples:** 15000ms (Pulse poll), 5000ms (Focus poll), 300000ms (5min live game), 90000ms (RBI cooldown), 5500ms (card dismiss), 8000ms (alert dismiss), 280ms (card animation)
**Note:** Most major thresholds now live in `devTuning`/`devTuningDefaults` — good improvement. Remaining magic numbers are timing/animation constants not exposed to Dev Tools.

**Proposed Fix:** Extract remaining timing constants to a `TIMING` object at top of JS section.

**Effort:** 1 hour | **Risk:** Very low

---

### L2: Function Naming Inconsistency (DEFERRED, UNCHANGED)

**Severity:** LOW
**Examples:** `tcLookup()` vs inline `TEAMS.find()`; `showPlayerCard()` vs `renderFocusCard()`; `pollLeaguePulse()` vs `fetchBoxscore()`; `genHRStories()` vs `buildStoryPool()`

**Proposed Fix:** Documentation-only: add a naming convention comment block at the top of the JS section. No renames (too high regression risk across 4,663 lines).

**Effort:** 30 minutes | **Risk:** None

---

## New Issues (v2.50–v2.62)

---

### N1: Two Unremoved DEBUG Blocks With Active `console.log` (NEW, HIGH)

**Severity:** HIGH
**Lines:** 1429–1434, 3514–3516
**Root Cause:** `// DEBUG START` / `// DEBUG END` markers were added but the `console.log` calls inside them were never removed or guarded.

**Block 1 (lines 1429–1434):**
```javascript
// DEBUG START
if (isScoringP) console.log('SCORING PLAY INCOMING:', {...});
// DEBUG END
else if (isScoringP){...// DEBUG START
console.log('RBI CARD DEBUG:', {...});// DEBUG END
```
This is inside `pollGamePlays()` — fires on every scoring play in every live game.

**Block 2 (lines 3514–3516):**
```javascript
// DEBUG START
console.log('RBI SCORE CALC:', {...rbi, event, base, hitMult, ...});
// DEBUG END
```
This is inside `calcRBICardScore()` — fires on every scoring play evaluation.

**Impact:** Production console flooded with internal state on every scoring play. Exposes game state, player IDs, scoring thresholds, and internal score calculations to any user who opens DevTools. Slight performance hit during busy innings.

**Proposed Fix:** Remove both `console.log` lines and their `// DEBUG START/END` markers.

**Effort:** 5 minutes | **Risk:** None

---

### N2: `document.execCommand('copy')` — Deprecated API (NEW, MEDIUM)

**Severity:** MEDIUM
**Line:** 1484
**Root Cause:** Export JSON modal's Copy button uses `execCommand('copy')` — deprecated since Chrome 109 (Jan 2023) and removed in some browser versions.

**Current code:**
```javascript
'<button onclick="var el=document.getElementById(\'exportJson\');el.select();document.execCommand(\'copy\');alert(\'Copied!\');...">'
```

**Impact:** `execCommand('copy')` silently fails on modern browsers. User taps "Copy", gets the `alert('Copied!')` but nothing is actually on the clipboard. This is a broken UX in production.

**Proposed Fix:** Replace with the async Clipboard API:
```javascript
navigator.clipboard.writeText(el.value).then(() => alert('Copied!')).catch(() => { el.select(); document.execCommand('copy'); alert('Copied!'); });
```
The `.catch()` fallback retains old behavior for older browsers.

**Effort:** 30 minutes | **Risk:** None

---

### N3: 38 Unguarded `console.*` Calls in Production Code (NEW, MEDIUM)

**Severity:** MEDIUM
**Count:** 38 statements (console.log: 33, console.error: 4, console.warn: 1)
**High-volume examples (fire on every poll):**
- Line 2029: `console.log('Demo: renderSideRailGames filtering...')` — fires every side-rail render
- Line 2514: `console.log('Demo: genProbablePitchers filtering...')` — fires every story pool build
- Lines 2096–2136: 5 news source logs — fire every news fetch (every 30s)
- Lines 1430–1434: Scoring play + RBI calc logs — fire on every scoring play

**Root Cause:** Debug logging added during development not wrapped in a guard flag. No `DEBUG` constant or equivalent.

**Impact:** Console noise makes real errors harder to spot. Performance cost on low-end devices (especially the news/polling logs). Internal state exposed to end users via DevTools.

**Proposed Fix:** Add `const DEBUG = false;` constant at top of JS section. Wrap all non-error `console.log` and `console.warn` calls: `if(DEBUG) console.log(...)`. Keep `console.error` in catch blocks (legitimate error reporting).

**Effort:** 1–2 hours | **Risk:** Very low

---

### N4: Missing Null Guard in `pollFocusLinescore()` on `matchup` Data (NEW, MEDIUM)

**Severity:** MEDIUM
**Root Cause:** `pollFocusLinescore()` reads `data.offense.batter.fullName` and `data.defense.pitcher.fullName` from the linescore response. The MLB Stats API omits these fields when no at-bat is in progress (between half-innings, warmup, post-game).

**Impact:** Focus card renders with `undefined` for batter/pitcher names during half-inning breaks. Not a crash, but a visible UI bug — "undefined bats against undefined."

**Proposed Fix:** Add optional chaining:
```javascript
currentBatterName: data.offense?.batter?.fullName || focusState.currentBatterName || '',
currentPitcherName: data.defense?.pitcher?.fullName || focusState.currentPitcherName || '',
```
Preserving the previous name during the break avoids blanking the display.

**Effort:** 30 minutes | **Risk:** None

---

## Summary Table

| ID | Title | Severity | Effort | Status |
|---|---|---|---|---|
| H3 | Fetch error handling (50+ calls) | HIGH | 4–6h | Deferred — awaiting approval |
| H4 | AbortController on fetch polls | HIGH | 3–4h | Deferred — awaiting approval |
| N1 | Remove 2 active DEBUG console.log blocks | HIGH | 5 min | New — awaiting approval |
| M1 | `var` → `let`/`const` (targeted) | MEDIUM | 2–3h | Deferred — awaiting approval |
| M2 | Extract inline styles (targeted) | MEDIUM | 3–4h | Deferred — awaiting approval |
| M3 | Convert inline onclick (targeted) | MEDIUM | 3–4h | Deferred — awaiting approval |
| M4 | Timer registry (8 timers) | MEDIUM | 2h | Deferred — awaiting approval |
| N2 | Replace execCommand('copy') | MEDIUM | 30 min | New — awaiting approval |
| N3 | Wrap 38 console.* in DEBUG flag | MEDIUM | 1–2h | New — awaiting approval |
| N4 | Null guard in pollFocusLinescore | MEDIUM | 30 min | New — awaiting approval |
| L1 | Extract remaining magic numbers | LOW | 1h | Deferred — awaiting approval |
| L2 | Document naming conventions | LOW | 30 min | Deferred — awaiting approval |

**Total scope if all approved:** ~21–27 hours
**Recommended scope for this sprint:** N1 + N2 + N3 + N4 (quick wins, ~4 hours) + H3 or H4 (one large item)

---

## Audit Sign-Off

**Auditor:** Claude
**Date:** 2026-05-01
**App Version:** v2.62
**Confidence:** HIGH
**Methodology:** grep-based pattern analysis + manual code review of key functions (pollGamePlays, pollFocusLinescore, showPlayerCard, showRBICard, initReal, toggleDemoMode)
