# Sprint Summary — 2026-05-17-baseball-app

**Sprint ID:** 2026-05-17-baseball-app  
**Branch:** `claude/tech-debt-sprint-f1Zgf`  
**Date:** 2026-05-17  
**Version range:** 4.28.6 → 4.28.18  

---

## Overview

Largest sprint to date. The primary goal was to complete the `var` → `const`/`let` migration (deferred from every previous sprint), finish fetch error handling, and modernise the mobile nav. All HIGH and MEDIUM items were resolved — only L1 (dead code) was deferred.

---

## Issues Fixed

| ID | Severity | Description | Commits |
|----|----------|-------------|---------|
| H1 | HIGH | `var` → `const`/`let` across all 51 `src/` files (2,485 declarations) | `c00da55` |
| H2 | HIGH | `.ok` guards on 15 fetch call sites (news.js ×4, live.js ×4, player.js ×7) | `836e685`, `ca9deaf`, `3b781ad` |
| H3 | HIGH | `.catch()` on 11 unguarded promise chains (main.js ×3, yesterday.js ×1, player.js ×7) | `d7dd5ab`, `796622a`, `b9abb14` |
| M1 | MEDIUM | Removed 7 inline `onclick` from nav buttons; added `installNavClicks` delegated handler | `3c2a866` |
| M2 | MEDIUM | Added `aria-label` to 5 unlabelled interactive elements | `7574181` |
| M3 | MEDIUM | 5 `var` → `const`/`let` in `sw.js` | `0053b8a` |

**Deferred:** L1 (dead-code removal) — skipped by user decision.

---

## UAT Fixes

Two regressions surfaced during UAT and were resolved before finalization:

| Fix | Root cause | Commit |
|-----|-----------|--------|
| M1 regression — more button blanking page | `installNavClicks` intercepted the `more` button (`data-section="more"`) and called `showSection('more')`, which crashed because there is no `#more` element. Guard added: `document.getElementById(section)` existence check before routing. | `7ee2fd0` |
| iOS click-outside close unresponsive | iOS Safari only fires `click` on non-interactive elements that carry `cursor:pointer`. Tapping empty background between cards never reached the document-level listener that closes settings/tooltip. Fixed by adding `cursor:pointer` to `body` scoped to `@media (pointer:coarse)`. | `3e21544` |

---

## Code Changes

| File | Change |
|------|--------|
| `src/**/*.js` (51 files) | `var` → `const`/`let` throughout |
| `src/sections/news.js` | `.ok` checks on 4 fetch sites |
| `src/sections/live.js` | `.ok` checks on 4 fetch sites |
| `src/sections/stats/player.js` | `.ok` checks on 7 fetch sites + `.catch()` on 7 chains |
| `src/main.js` | `.catch()` on 3 chains; added `installNavClicks` import+call |
| `src/sections/yesterday.js` | `.catch()` on 1 chain |
| `src/nav/behavior.js` | `installNavClicks` export added; UAT guard fix |
| `index.html` | 7 nav `onclick` removed; 5 `aria-label` additions |
| `sw.js` | 5 `var` → `const`/`let` |
| `styles.css` | `cursor:pointer` on `@media (pointer:coarse)` body |

---

## QA Results

**10/10 checks passed.** See full report: [`qa/qa-2026-05-17-baseball-app.md`](../qa/qa-2026-05-17-baseball-app.md)

---

## Known Issues Remaining Open

- **L1:** Dead-code removal (unused variables, unreachable branches) — deferred by user decision.
- **M1 (remainder):** 133 non-nav inline `onclick` handlers in `index.html` — deferred to future sprint.
