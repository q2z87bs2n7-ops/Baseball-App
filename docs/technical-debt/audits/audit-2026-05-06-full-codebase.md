# Technical Debt Audit — Full Codebase (2026-05-06)
**Date:** 2026-05-06  
**Branch:** `claude/tech-debt-sprint-e6fO0`  
**Scope:** Full codebase (`index.html`, `sw.js`, `src/**/*.js`, `styles.css`, `build.mjs`)  
**Total LOC:** ~8,725 LOC (src/) + ~830 (index.html) + ~500 (sw.js) + ~1,200 (styles.css) = ~11,255 LOC

---

## Summary

**Total Issues Found:** 28 (5 HIGH, 8 MEDIUM, 15 LOW)  
**Estimated Effort to Fix All:** 15–20 hours  
**Recommended This Sprint:** 3–4 hours (HIGH + critical MEDIUM)

---

## CRITICAL ISSUES

### (none — no production blockers)

---

## HIGH PRIORITY (Must Fix)

### H1: Widespread `var` Declarations (~1,629 instances)

**Severity:** HIGH  
**Location:** Across all `src/**/*.js` files (every module), plus `sw.js` (4 instances), `index.html` inline script (2 instances)  
**Issue:** Legacy ES5 style `var` declarations used throughout codebase instead of `let`/`const`. Blocks modernization goal and creates subtle scoping bugs.

**Examples:**
```javascript
// src/main.js
var mockBar=document.getElementById('mockBar');
var snapshot={...};
var json=JSON.stringify(...);

// src/focus/mode.js
var diff=Math.abs(g.awayScore-g.homeScore);
var closeness=...;
var runners=...;

// sw.js
var url = new URL(e.request.url);
var data = {};
```

**Root Cause:** Codebase evolved from ES5 prototype to ES6 modules, but variable declarations weren't updated during modularization (v3.40).

**Impact:**
- **Scoping bugs:** `var` is function-scoped, not block-scoped. Can cause variable capture issues in loops/callbacks
- **Hoisting confusion:** `var` declarations are hoisted to top of scope
- **Code quality:** Violates modern JS standards
- **Maintainability:** Makes refactoring harder

**Scope:** ~1,629 instances across 36 JS files

**Fix:** Global find-and-replace:
1. `var ` → `const ` (majority of cases, non-reassigned variables)
2. Manual inspection for cases where reassignment occurs → convert to `let`
3. Verify no semantic changes (e.g., hoisting behavior)

**Risk:** MEDIUM — regex replacement could miss edge cases. Requires comprehensive testing.

**Effort Estimate:** 
- Automated replacement: 30 min
- Manual review of reassignments: 1 hour
- Testing: 1 hour
- **Total: 2.5 hours**

---

### H2: Fetch Calls Without `.ok` Validation (~57 instances)

**Severity:** HIGH  
**Location:** Distributed across `src/` modules (focus/mode.js, collection/book.js, carousel/generators.js, cards/playerCard.js, dev/youtube-debug.js, dev/news-test.js, auth/oauth.js, etc.)  
**Issue:** Many `fetch()` calls don't validate response status (`.ok` check) before calling `.json()`. Silent failures on HTTP errors (4xx, 5xx).

**Examples:**
```javascript
// src/collection/book.js
var r = await fetch(MLB_BASE + '/people/' + playerId + '/stats?stats=career&group=' + group);
var d = await r.json();  // Could fail silently if status 500

// src/auth/oauth.js
.then(r => r.json())  // No .ok check first

// src/focus/mode.js
var r=await fetch(MLB_BASE+'/game/'+state.focusGamePk+'/linescore',{signal:focusSig});
var ls=await r.json();  // Will throw if 500, but no explicit error handling
```

**Root Cause:** Early prototyping pattern; error handling wasn't prioritized.

**Impact:**
- **Silent failures:** App continues as if data loaded, but it's undefined
- **User confusion:** UI shows empty/broken state without explanation
- **Debugging difficulty:** Network failures hard to trace in dev tools
- **Crashes:** `.json()` on error responses can throw, causing unhandled promise rejections

**Scope:** ~57 fetch calls without `.ok` checks

**Fix Pattern:**
```javascript
// Before
const r = await fetch(url);
const data = await r.json();

// After
const r = await fetch(url);
if (!r.ok) throw new Error(`HTTP ${r.status}: ${url}`);
const data = await r.json();
```

**Effort Estimate:**
- Find all occurrences: 15 min (grep already done)
- Add `.ok` checks: 1 hour (mostly templated edits)
- Testing: 45 min
- **Total: 2 hours**

---

### H3: Promise Chains Without `.catch()` (~34 instances)

**Severity:** HIGH  
**Location:** Distributed (particularly in dev/youtube-debug.js, dev/news-test.js, carousel/generators.js, collection/book.js)  
**Issue:** Promise chains (`.then()`) without `.catch()` or `try/catch` for async/await. Unhandled rejections cause crashes or silent failures.

**Examples:**
```javascript
// src/carousel/generators.js
return fetch(MLB_BASE+'/game/'+pk+'/contextMetrics').then(function(r){
  if(!r.ok)throw new Error(r.status);
  return r.json();
}).then(function(d){
  // ... process data
  // NO .catch() — any error above is unhandled
});

// src/dev/youtube-debug.js
return r.json().then(function(j) {
  // ... process
  // NO .catch()
});
```

**Root Cause:** Rapid prototyping; error boundaries not established.

**Impact:**
- **Unhandled rejections:** Chrome throws `Uncaught (in promise)` errors in console
- **Silent failures:** Promise rejects but no one catches it
- **App instability:** Can cause memory leaks, orphaned intervals

**Scope:** ~34 promise chains without catch handlers

**Fix:** Add `.catch()` to all promise chains or wrap in `try/catch`.

**Effort Estimate:**
- Identify all chains: 20 min
- Add error handlers: 1 hour
- Testing: 30 min
- **Total: 1.5 hours**

---

### H4: AbortController Usage Incomplete (~6 instances)

**Severity:** HIGH  
**Location:** `src/focus/mode.js` (line 72), `src/pulse/poll.js` (line 73+), `src/demo/mode.js`  
**Issue:** Polling loops use `AbortController` in some places but not consistently. Can leak fetch requests on component unmount.

**Examples:**
```javascript
// src/focus/mode.js (line 72) — Good
if(state.focusAbortCtrl){state.focusAbortCtrl.abort();state.focusAbortCtrl=null;}

// But some polling loops don't have abort handlers — they continue fetching after state cleanup
```

**Root Cause:** Partial implementation from previous audit; coverage gaps remain.

**Impact:**
- **Memory leaks:** Abandoned fetch requests consume network/battery
- **Polling artifacts:** Stale data updates after user switches focus

**Scope:** ~6 polling functions

**Fix:** Add AbortController to all active polling functions.

**Effort Estimate:**
- Identify gaps: 20 min
- Add AbortController: 1 hour
- Testing: 45 min
- **Total: 2 hours**

---

## MEDIUM PRIORITY (Should Fix)

### M1: Remaining Inline Style Attributes in `index.html` (~263+ instances)

**Severity:** MEDIUM  
**Status:** Deferred from v3.33 audit; still present  
**Examples:** (see HTML-only audit above)  
**Effort:** 2–3 hours  
**Recommendation:** Defer to future sprint

---

### M2: Remaining `onclick` Handlers in `index.html` (~40+ instances)

**Severity:** MEDIUM  
**Status:** Deferred from v3.33 audit; still present  
**Recommendation:** Fix Phase 1 (nav + settings) this sprint, Phase 2 (data-driven) later

---

### M3: Missing Accessibility Labels (~12 instances)

**Severity:** MEDIUM  
**Location:** `index.html` toggle divs, sound panel controls  
**Recommendation:** Quick add of `aria-label` + `role="checkbox"`, ~10 min

---

### M4: Magic Numbers & Hardcoded Strings (~80+ instances)

**Severity:** MEDIUM  
**Location:** Distributed across `src/`  
**Examples:**
```javascript
// src/focus/mode.js
var innMult=g.inning<=5?0.6:g.inning<=8?1.0:g.inning===9?1.5:2.0;  // Magic multiplier
var situation=isBL?40:isRISP?25:runners>0?15:0;  // Magic scoring values

// src/carousel/generators.js
.filter(function(s){return s.tier===1;}).length  // Hardcoded tier number
```

**Root Cause:** Feature development; constants not extracted.

**Impact:** Harder to tune; changes require code editing instead of config changes.

**Fix:** Extract to `src/config/constants.js` or subsystem-level constants.

**Effort:** 1–2 hours (lower priority; doesn't break functionality)

---

### M5: Missing Error Boundaries for DOM Access

**Severity:** MEDIUM  
**Location:** Various (e.g., `src/main.js`, `src/feed/render.js`)  
**Issue:** `document.getElementById()` calls don't guard against null; can crash if element missing.

**Examples:**
```javascript
// src/main.js
var mockBar=document.getElementById('mockBar');  // Could be null

// Safe pattern:
const mockBar = document.getElementById('mockBar');
if (!mockBar) { console.warn('mockBar not found'); return; }
```

**Impact:** Silent crashes if HTML structure changes.

**Effort:** 1 hour

---

### M6: Inconsistent Error Logging

**Severity:** MEDIUM  
**Location:** Throughout  
**Issue:** Errors caught but not logged, or logged in inconsistent ways (some use `devLog`, some use `console.error`).

**Impact:** Debugging difficulty.

**Effort:** 1–2 hours

---

### M7: Event Listener Cleanup in Dynamic Contexts

**Severity:** MEDIUM  
**Location:** Dev Tools panel, sound panel, collection binder  
**Issue:** Dynamic elements added via innerHTML have attached listeners, but listeners aren't removed when elements are replaced.

**Examples:**
```javascript
// src/dev/panels.js
div.innerHTML = '<button onclick="foo()">...';  // Creates new listeners each render

// Better:
const btn = document.createElement('button');
btn.addEventListener('click', foo);
```

**Impact:** Memory leaks in long sessions; dev tools become slow.

**Effort:** 2–3 hours

---

### M8: Inconsistent Naming Conventions

**Severity:** MEDIUM  
**Location:** Throughout  
**Issue:** Functions use mixed naming: `camelCase` (standard), `_privatePrefix` (inconsistent), `getX` vs `fetchX` (unclear).

**Impact:** API confusion; harder to learn codebase.

**Effort:** 3–4 hours (large refactor, lower ROI)

---

## LOW PRIORITY (Nice to Fix)

### L1: Unused Variables & Dead Code (~15 instances)

**Severity:** LOW  
**Examples:**
- Vars assigned but never used
- Functions defined but never called (in dev modules mainly)

**Effort:** 30 min

---

### L2: Unoptimized Re-renders in Dev Tools

**Severity:** LOW  
**Location:** `src/dev/panels.js`  
**Issue:** Full re-render on every state change; could batch updates.

**Effort:** 2–3 hours (optimization, no functional impact)

---

### L3: Missing JSDoc Comments

**Severity:** LOW  
**Location:** ~50+ functions across `src/`  
**Issue:** Key functions lack parameter/return documentation.

**Effort:** 2–3 hours

---

### L4: Hardcoded Z-Index Values in `index.html`

**Severity:** LOW  
**Status:** From HTML audit; still present  
**Effort:** 20 min (CSS variable extraction)

---

### L5: Minified vs. Pretty-Printed CSS

**Severity:** LOW  
**Location:** `styles.css` (minified on line 1–2, then pretty-printed below)  
**Issue:** Inconsistent formatting; line 1 is minified, rest is formatted.

**Effort:** 20 min (formatter pass)

---

### L6–L15: Minor Code Quality Issues

- L6: Inconsistent quotes (' vs ")
- L7: Missing semicolons in some files
- L8: Overly long functions (some >300 LOC)
- L9: Deeply nested conditionals (>4 levels)
- L10: Magic array indices
- L11: Unused imports
- L12: Inconsistent null-checking patterns
- L13: No input validation in some API responses
- L14: Global state mutation in callbacks
- L15: String-based HTML generation (XSS risk if not careful)

**Combined Effort:** 3–4 hours

---

## DEFERRED FROM PREVIOUS SPRINTS

All previously deferred issues remain:
- **M1–M3:** Inline styles, onclick handlers, accessibility (HTML-only, deferred to future sprint)
- **M4–M8:** Magic numbers, error boundaries, event cleanup, naming (src/ refactor, large scope)

---

## RECOMMENDED APPROACH

### This Sprint (4–5 hours, High ROI)

**Must Fix:**
1. **H1** — `var` → `const`/`let` (2.5 hours, automated + testing)
2. **H2** — Add `.ok` checks to fetch calls (2 hours)
3. **M2 Phase 1** — Fix nav + settings onclick (15 min)
4. **M3** — Add aria-labels (10 min)

**Optional (if time permits):**
- **H3** — Add `.catch()` to promise chains (1.5 hours)

**Total:** 4.5–6 hours

**Expected Outcome:** Modernized code, improved error handling, better accessibility. Zero regressions.

### Future Sprints

- **H4** — Complete AbortController coverage
- **M4–M8** — Medium refactors (magic numbers, error boundaries, etc.)
- **L1–L15** — Code quality polish
- **HTML refactor** — Inline styles/onclick handlers (Phase 2)

---

## Files Most Affected

| File | Issues | Priority |
|---|---|---|
| `src/main.js` | var (100+), console.log, magic numbers | HIGH |
| `src/carousel/generators.js` | var (50+), fetch errors, magic numbers | HIGH |
| `src/dev/panels.js` | var (30+), inline HTML, listener cleanup | HIGH |
| `src/focus/mode.js` | var (40+), fetch errors, incomplete AbortController | HIGH |
| `src/sections/loaders.js` | var (50+), fetch errors | HIGH |
| `sw.js` | var (4) | HIGH |
| `index.html` | inline styles (263+), onclick (40+), var (2) | MEDIUM |

---

## Risk Assessment

**Automated `var` replacement:** MEDIUM risk
- Regex: `/^\s*var\s+/gm` → `const`
- Requires: Spot-check ~50 instances, manual check for reassignments
- Test: Full QA suite after replacement

**Adding `.ok` checks:** LOW risk
- Templated edits
- Can be tested incrementally (one file at a time)

**Promise `.catch()` chains:** LOW risk
- Templated edits
- Safe to add without side effects

---

## Implementation Proposal

**If proceeding with full audit (user chose "Expand"):**

**Checkpoint Question:** How aggressive should we be this sprint?

- ✅ **Conservative:** H1 (var→const) + H2 (fetch .ok) only = 4.5 hours
- ⚠️ **Balanced:** Above + M2 Phase 1 + M3 = 5 hours
- 🚀 **Ambitious:** Above + H3 (promise .catch) = 6.5 hours

---
