# Technical Debt Audit — 2026-05-17
**Date:** 2026-05-17  
**Branch:** `claude/tech-debt-sprint-f1Zgf`  
**Version at audit:** 4.28.6  
**Scope:** Full codebase (`src/**/*.js`, `sw.js`, `index.html`, `styles.css`)  
**Prior sprint:** 2026-05-06 (branch `claude/tech-debt-sprint-e6fO0`)

---

## Context: What Changed Since Last Sprint

The 2026-05-06 sprint fixed H2 (fetch .ok at 3 call sites), H3 (promise error at 1 site), and M3 (4 aria-labels). Major new code landed after that sprint: Baseball Buzz Bluesky rail (`src/pulse/baseball-buzz.js`, v4.28.2–v4.28.6), which added new fetch calls and promise chains without the safety patterns the previous sprint was establishing.

**var count grew:** ~1,629 → ~2,485 (+856 from new code)  
**onclick count grew:** ~40 → ~140 (new UI added)

---

## Summary

**Total Issues Found:** 9 (3 HIGH, 3 MEDIUM, 3 LOW)  
**Carry-forward from prior audits:** H1 (var), M1 (onclicks), M2 (aria-labels)  
**New this sprint:** H2-new, H3-new (new code without safety patterns)

---

## HIGH PRIORITY

### H1: `var` Declarations — 2,485 instances (↑ from 1,629)

**Severity:** HIGH  
**Carry-forward from:** 2026-05-06 audit (deferred — now top priority)  
**Location:** All `src/**/*.js` files  

**Top files:**
| File | var count |
|------|-----------|
| `src/carousel/generators.js` | 301 |
| `src/sections/stats/player.js` | 271 |
| `src/overlay/scorecard.js` | 142 |
| `src/dev/panels.js` | 142 |
| `src/sections/yesterday.js` | 114 |
| `src/feed/render.js` | 99 |
| `src/pulse/poll.js` | 90 |
| `src/cards/playerCard.js` | 88 |
| `src/collection/book.js` | 85 |
| `src/demo/mode.js` | 82 |

Plus `sw.js`: 5 vars (lines 26, 36, 41, 42, 55)

**Root Cause:** ES5 → ES6 module migration (v3.40) didn't update declarations. New Baseball Buzz code (v4.28.x) added more vars, growing the total.

**Impact:** Function-scoped `var` causes subtle bugs in loops/callbacks; blocks linting; violates modern JS standards.

**Fix:** Automated pass — `var ` → `const ` for non-reassigned, `let ` for reassigned. Requires manual review of ~50 reassigned cases.

**Risk:** MEDIUM — comprehensive testing required after replacement.  
**Effort:** 3–4 hours

---

### H2: Fetch Calls Without `.ok` Validation — ~18 call sites

**Severity:** HIGH  
**Carry-forward:** Partially addressed in 2026-05-04 and 2026-05-06 sprints at specific call sites; many remain, and new code added more.  

**Examples (critical paths):**
```javascript
// src/sections/news.js:56
var resp = await fetch(teamUrl);
var j = await resp.json();  // No .ok — crashes on 4xx/5xx

// src/sections/live.js:72
var r = await fetch(MLB_BASE + '/game/' + liveGamePk + '/playByPlay');
// No .ok check before r.json()

// src/focus/mode.js:283,296,319,326,331
// Five fetch calls in pitch-by-pitch loop — none with .ok

// src/collection/sync.js:15,33
// Two sync fetch calls — no .ok

// src/collection/book.js:167
var r = await fetch(MLB_BASE + '/people/' + playerId + '/stats...');
// No .ok check
```

**Fix Pattern:**
```javascript
const r = await fetch(url);
if (!r.ok) throw new Error(`HTTP ${r.status}`);
const data = await r.json();
```

**Effort:** 1.5–2 hours

---

### H3: Promise Chains Without `.catch()` — ~35 chains

**Severity:** HIGH  
**Partially addressed:** 1 site fixed in 2026-05-06 sprint; 34+ remain.  

**Critical examples:**
```javascript
// src/main.js:304
pollLeaguePulse().then(function(){buildStoryPool();...})  // No .catch()

// src/main.js:316
loadYesterdayCache().then(function(){...})  // No .catch()

// src/sections/yesterday.js:49
loadYdForDate(getYesterdayDateStr()).then(function(data){...})  // No .catch()

// src/sections/stats/player.js:33,84,88
fetchGameLog(id, group).then(function(){...})  // No .catch() (×3)

// src/dev/youtube-debug.js:66,179
// Nested .then without outer .catch()
```

**Fix:** Add `.catch(function(e){ devLog('...', e); })` to each unguarded chain.

**Effort:** 1.5 hours

---

## MEDIUM PRIORITY

### M1: Inline `onclick` Handlers in `index.html` — 140 instances (↑ from ~40)

**Severity:** MEDIUM  
**Carry-forward from:** 2026-05-04 audit; count tripled due to new feature additions.  

**Location distribution:**
- Nav buttons: 7 (lines 66–73)
- Leader pill buttons: 18+ (lines 225–241)
- Roster/stat tabs: 8 (lines 267–283)
- News source buttons: 6 (lines 331–336)
- Remaining: scattered through 980 lines

**Root Cause:** All new UI (Buzz, stats, schedule panel) added onclicks inline.

**Impact:** Hard to audit event handlers; no CSP compatibility; harder to unit-test.

**Recommendation for this sprint:** Fix nav buttons (7) + critical settings buttons — keep data-driven dynamic handlers deferred (too risky to refactor en masse).

**Effort:** 30 min (phase 1 only)

---

### M2: Missing `aria-label` on Interactive Elements — ~20 elements

**Severity:** MEDIUM  
**Partially addressed:** 4 labels added in 2026-05-06 sprint; 20+ still missing (new UI added since).  

**Critical gaps:**
| Lines | Elements | Issue |
|-------|---------|-------|
| 225–241 | 18 leader pill buttons | No aria-label |
| 267–269 | 3 roster tab buttons | No aria-label |
| 279–283 | 5 player stat tabs | No aria-label |
| 296–298 | 3 matchup day buttons | No aria-label |
| 310–311 | 2 league leader tabs | No aria-label |
| 327 | Refresh news button | No aria-label |
| 331–336 | 6 news source buttons | No aria-label |
| 371–373 | 2 story nav buttons | No aria-label |

**Fix:** Add `aria-label="..."` to each button/interactive element.

**Effort:** 20–30 min

---

### M3: `sw.js` var Declarations — 5 instances

**Severity:** MEDIUM (LOW functional impact, HIGH symbolic)  
**Location:** `sw.js` lines 26, 36, 41, 42, 55  

```javascript
// sw.js:26
var url = new URL(e.request.url);
// sw.js:36
var data = {};
// sw.js:41-42
var title = data.title || "MLB Tracker";
var opts = {...};
// sw.js:55
var w = ws.find(function(w2) {...})
```

**Fix:** `var` → `const` (all 5 are non-reassigned).

**Effort:** 5 min

---

## LOW PRIORITY

### L1: Dead Code / Unused Variables (~15 instances)
Carry-forward from prior audits. Mainly in dev modules.  
**Effort:** 30 min

### L2: Magic Numbers (~80+ instances)
Carry-forward from prior audits. Tuning-related — deferred.  
**Effort:** 2 hours

### L3: Unoptimized Dev Tools Re-renders
`src/dev/panels.js` full re-render on state change. No functional impact.  
**Effort:** 2–3 hours

---

## DEFERRED FROM PREVIOUS SPRINTS (still open)

| Issue | First Seen | Status |
|-------|-----------|--------|
| M1: Inline styles (263+ in index.html) | 2026-05-04 | Still deferred |
| M4: Magic numbers (80+ in src/) | 2026-05-06 | Still deferred |
| M5: DOM null guards | 2026-05-06 | Still deferred |
| M6: Inconsistent error logging | 2026-05-06 | Still deferred |
| M7: Listener cleanup in dynamic elements | 2026-05-06 | Still deferred |
| M8: Naming conventions | 2026-05-06 | Still deferred |
| L1–L15: Code quality | 2026-05-04 | Still deferred |

---

## RECOMMENDED APPROACH THIS SPRINT

### Core (3–4 hours, highest ROI)
1. **H1** — `var` → `const`/`let` across all `src/**/*.js` + `sw.js` (automated + review)
2. **H2** — Add `.ok` checks to ~18 fetch call sites
3. **H3** — Add `.catch()` to ~35 promise chains

### Quick wins (30 min each)
4. **M2** — Add missing `aria-label` attributes (~20 elements)
5. **M3** — Fix `sw.js` 5 var declarations (trivial, 5 min)

### Defer
- M1 (onclick refactor): too large for this sprint
- L1–L3: lower priority

**Expected outcome:** Modernized declarations, comprehensive error handling, improved accessibility. Zero regressions.
