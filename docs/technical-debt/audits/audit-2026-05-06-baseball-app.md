# Technical Debt Audit — 2026-05-06
**Date:** 2026-05-06  
**Branch:** `claude/tech-debt-sprint-e6fO0`  
**File(s) Scanned:** `index.html` (~830 lines)

---

## Summary

**Total Issues Found:** 11 (1 HIGH, 3 MEDIUM, 7 LOW)  
**Deferred from previous sprints:** H3 (Fetch error handling), H4 (AbortController) — in `src/` modules, not HTML

---

## CRITICAL ISSUES

### (none)

---

## HIGH PRIORITY (Must Fix)

### H1: Inline Theme Flash Script Uses `var` ⚠️

**Severity:** HIGH  
**Location:** `index.html:7`  
**Issue:** The inline theme-flash prevention script (required to be synchronous) uses `var` declarations instead of `const`/`let`.

```javascript
// Current (line 7)
var v=JSON.parse(localStorage.getItem('mlb_theme_vars')||'null');
if(v&&typeof v==='object'){for(var k in v){...}}

// Should be
const v=JSON.parse(localStorage.getItem('mlb_theme_vars')||'null');
if(v&&typeof v==='object'){for(const k in v){...}}
```

**Root Cause:** Oversight in modernization to ES6. This script predates the refactor and wasn't caught in previous sprints.

**Impact:** Code quality. No functional impact, but violates the modernization goal (M1 from v3.33).

**Fix:** Replace `var` → `const` in the inline script. Safe because: (1) const is block-scoped (both vars are in same scope), (2) no reassignment occurs.

---

## MEDIUM PRIORITY (Should Fix)

### M1: Remaining Inline Style Attributes (~263+ instances)

**Severity:** MEDIUM  
**Location:** `index.html` — distributed throughout (lines 24, 49–50, 54, 62, 65, 72, 80, 91, 109, 118–121, 148, 157, ...)  
**Issue:** Inline `style="..."` attributes should be extracted to CSS utility classes or `<style>` blocks. Deferred from v3.33 audit.

**Examples:**
```html
<!-- Current -->
<div style="display:flex;align-items:center;gap:8px">
<input style="width:100%;padding:4px;background:var(--card2);border:1px solid var(--border);color:var(--text);border-radius:4px">
<button style="margin-left:8px">...

<!-- Better approach (CSS utility class) -->
<div class="flex items-center gap-2">
<input class="input-field">
<button class="ml-2">...
```

**Root Cause:** Rapid prototyping in earlier versions; these patterns accumulated. Previous audit (v3.33) deferred in favor of higher-priority fixes.

**Impact:** 
- Makes CSS refactoring harder
- Inline styles bypass z-index stacking contexts (e.g., overlays with fixed positioning)
- Makes responsive design harder (no media query support in inline styles)
- Maintenance: changing a common pattern requires finding/replacing many times

**Scope:** ~263 inline style attributes in Dev Tools panel (lines 427–786), overlay tuning controls, debug panels.

**Fix Strategy (Deferred / Low Immediate Cost):**
- Extract common patterns to utility classes: `.dt-input`, `.overlay-base`, `.button-base`
- Keep development overlay heavily inlined for now (lower priority)
- Focus extraction on high-visibility/frequently-changed areas

**Priority:** LOW for this sprint — can defer further.

---

### M2: Dynamic onclick Handlers as Template Strings (~40+ instances)

**Severity:** MEDIUM  
**Location:** `index.html` — distributed (lines 27–33, 36, 40, 44, 48, etc.)  
**Issue:** Many buttons use inline `onclick="functionName(...)"` instead of `addEventListener()`. Deferred from v3.33 audit.

**Examples:**
```html
<!-- Current -->
<button onclick="showSection('pulse',this)">⚡<span>Pulse</span></button>
<button onclick="switchTeam(this.value)"></button>
<button onclick="selectLeaderPill('hitting','avg',this)">AVG</button>

<!-- Better approach (added via JavaScript) -->
<button data-action="show-section" data-section="pulse">...</button>
<!-- Then in JS: btn.addEventListener('click', () => showSection('pulse', btn)) -->
```

**Root Cause:** Early prototyping pattern; matches previous sprint audits but remains partially unfixed.

**Impact:**
- **Event delegation problems:** Can't use event bubbling; each button gets its own listener (memory overhead)
- **Dynamic generation overhead:** Inline onclick requires string concatenation/template literals for dynamic values (Radio Check sweep tool, ticker chips, binder rows)
- **Security:** Potential XSS vectors if string interpolation isn't careful (though currently safe in this codebase)
- **Testability:** Harder to mock/stub behavior
- **Maintainability:** Logic split between HTML attributes and JS handlers

**Scope:** 
- Simple cases: nav buttons (7 buttons, lines 27–33)
- Data-driven cases: Leader stat pills (14+ buttons, lines 149–164), sound prefs (8 checkboxes, lines 677–684), live controls tuning (many inputs with `onchange=`)
- Dynamic generation: Radio Check list rows (~30 teams), binder rows (cards), ticker chips

**Fix Strategy:**
- **Phase 1:** Replace static nav buttons (7) + settings controls (15) with addEventListener
- **Phase 2:** Replace Leader stat pills (14+) + sound prefs (8) with data attributes + event delegation
- **Deferred to future sprint:** Dynamic onclick handlers (Radio Check, binder, ticker) — requires full refactor of those subsystems

**Priority:** MEDIUM — Nav + Settings are high-traffic; could be fixed in this sprint for Phase 1 only.

---

### M3: Missing Accessibility Labels on Interactive Elements

**Severity:** MEDIUM  
**Location:** Distributed (lines 55, 62, 69, 271, 273, 283, etc.)  
**Issue:** Several interactive elements lack `aria-label`, `aria-describedby`, or accessible names.

**Examples:**
```html
<!-- Current — no accessible name for button -->
<div onclick="toggleInvert()" id="invertToggle" class="settings-toggle">
  <div id="invertToggleKnob" class="settings-toggle-knob"></div>
</div>

<!-- Better -->
<button onclick="toggleInvert()" id="invertToggle" class="settings-toggle" aria-label="Toggle invert colors">
  <div id="invertToggleKnob" class="settings-toggle-knob"></div>
</button>

<!-- Or use semantic HTML -->
<label>
  <input type="checkbox" onchange="toggleInvert()">
  Invert Colors
</label>
```

**Root Cause:** Rapid prototyping with custom toggles instead of native `<input type="checkbox">` elements.

**Impact:** 
- Screen reader users can't understand button purpose
- Mobile assistive tech can't interact with toggles
- Violates WCAG 2.1 Level AA (accessibility standard)

**Scope:** ~12 toggle divs (push, radio, invert, master sound, checkboxes for tuning)

**Fix:** Add `role="checkbox"` + `aria-checked` or convert to semantic `<input type="checkbox">` with labels.

---

## LOW PRIORITY (Nice to Fix)

### L1: Unused/Orphaned HTML Elements

**Severity:** LOW  
**Location:** Various  
**Issue:** A few elements are hidden by default or may be unused remnants.

**Examples:**
- Line 688: `<!-- TEMP — News source diagnostic. Remove after News tab QA. -->` — comment suggests this overlay is temporary, but it's still in the code
- Line 412: `<!-- TEMP — News source diagnostic. Remove after News tab QA. -->` — orphaned comment on dev tool button

**Root Cause:** Code left from feature work; marked for removal but forgotten.

**Impact:** Minimal (hidden elements don't affect performance much). Adds ~50 lines of unused DOM.

**Fix:** Remove the temp comments and verify the elements are actually used, then clean up if not.

---

### L2: Magic z-index Values

**Severity:** LOW  
**Location:** Lines 349 (700), 352 (500), 356 (800), 366 (950), 560 (560), 738 (550), 770 (560), etc.  
**Issue:** Z-index values are hardcoded and scattered throughout without a centralized registry.

```html
<!-- Current -->
<div id="focusOverlay" style="...z-index:700;...">
<div id="collectionOverlay" style="...z-index:500;...">
<div id="videoOverlay" style="...z-index:800;...">

<!-- Better — extract to :root vars or JS const -->
:root {
  --z-overlay-player-card: 600;
  --z-focus-overlay: 700;
  --z-video-overlay: 800;
  --z-sign-in-cta: 950;
}
```

**Root Cause:** Inline styles + unplanned growth of z-index needs.

**Impact:** Stacking context bugs if overlays interact (minor risk, currently working).

**Fix:** Extract to CSS variables.

---

### L3: CSS Media Query Fragmentation

**Severity:** LOW  
**Location:** Inline media queries in stylesheets (e.g., `@media(min-width:1025px)`)  
**Issue:** Media queries are split between inline styles and `styles.css`. Not a code smell, but could be consolidated.

**Root Cause:** Feature-by-feature development.

**Impact:** Minimal — works correctly, just slightly harder to maintain.

**Fix:** Defer to next CSS refactor sprint.

---

### L4: Missing HTML5 Semantic Elements

**Severity:** LOW  
**Location:** Various (especially dev tools panel, sound panel)  
**Issue:** Several sections use `<div>` instead of semantic `<section>`, `<nav>`, `<article>`, etc.

**Examples:**
```html
<!-- Current -->
<div id="devToolsPanel">
  <div class="dev-panel-hd">
  <div class="dev-buttons">

<!-- Better -->
<aside id="devToolsPanel" aria-label="Developer Tools">
  <header class="dev-panel-hd">
  <div class="dev-buttons">
```

**Root Cause:** Legacy code; semantics weren't a priority during prototyping.

**Impact:** Minimal — screen readers can still infer structure. Improves SEO negligibly (not a public site).

**Fix:** Can defer indefinitely; low value.

---

### L5: Hardcoded Error/Loading Messages

**Severity:** LOW  
**Location:** Throughout (e.g., lines 92, 98, 102, 110, etc.)  
**Issue:** Loading messages are hardcoded in HTML instead of using constants or i18n strings.

```html
<!-- Current -->
<div class="loading">Loading next game...</div>
<div class="loading">Loading next series...</div>
<div class="loading">Loading standings...</div>

<!-- Better -->
<div class="loading" data-i18n="load.nextgame">Loading...</div>
```

**Root Cause:** Early prototyping; i18n never implemented.

**Impact:** Hard to update messages globally; not a code quality issue per se.

**Fix:** Nice to have, but out of scope for tech debt sprint.

---

### L6: Inconsistent Attribute Ordering

**Severity:** LOW  
**Location:** Throughout (class, id, style, onclick, etc. in different orders)  
**Issue:** HTML attributes follow no consistent order (id first vs last, style before onclick vs after, etc.).

**Example:**
```html
<!-- Line 27 -->
<button class="active" onclick="showSection('pulse',this)">

<!-- Line 48 -->
<select id="themeSelect" class="settings-select" onchange="switchTheme(this.value)"></select>

<!-- Line 50 -->
<select id="themeScopeSelect" class="settings-select" style="flex:1" onchange="switchThemeScope(this.value)">
```

**Root Cause:** Multiple authors, no linter rule.

**Impact:** Cosmetic; no functional impact.

**Fix:** Would require a formatter pass (defer).

---

## DEFERRED FROM PREVIOUS SPRINTS

### H3: Fetch Error Handling (49+ calls)
**Status:** In `src/` modules, not in HTML. Deferred from v3.33 / v3.32 audits.  
**Note:** Out of scope for this audit (HTML-only). See `docs/technical-debt/audits/` for history.

### H4: AbortController on Polling Loops
**Status:** Partially fixed in v3.32. Remaining cases deferred.  
**Note:** Out of scope for this audit (HTML-only). Lives in `src/pulse/poll.js`, etc.

---

## RECOMMENDATIONS

### This Sprint (Highest ROI)
1. **H1** — Fix the `var` in theme-flash script (2 minutes, quick win)
2. **M2 Phase 1** — Replace nav button onclick (7 buttons, ~5 min) + settings checkboxes (~10 min) = 15 min total
3. **M3** — Add `aria-label` to toggles (~10 min, copy-paste)

**Estimated effort:** 30 min  
**Estimated impact:** Better code quality, improved accessibility, no regressions

### Future Sprints
- **M1** — Inline styles refactor (larger task, 1–2 hours)
- **M2 Phase 2** — Data attributes + event delegation for dynamic controls (2–3 hours)
- **L1–L6** — Cosmetic fixes (low priority, can batch with other refactors)

---

## Files Affected

| File | Type | Estimate |
|---|---|---|
| `index.html` | HTML | 30 min edits + QA |

---
