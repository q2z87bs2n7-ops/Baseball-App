# Sprint Summary: 2026-05-04-baseball-app

**Status:** ✅ COMPLETE
**Branch:** `claude/tech-debt-audit-e5E4H`
**Date:** 2026-05-04
**App Version:** v3.32.1 → v3.33
**CACHE:** mlb-v471 → mlb-v472

---

## Issues Fixed (9 of 9)

| ID | Title | Severity | Effort |
|---|---|---|---|
| N5 | 3 unguarded `console.log` calls | LOW | 5 min |
| N6 | `.catch().then()` false "Copied!" confirmation | LOW | 10 min |
| L2 | Naming convention documentation | LOW | 30 min |
| L1 | Magic numbers → `TIMING` constant object | LOW | 1h |
| H3 | `r.ok` validation at ~25 fetch call sites | HIGH | 3h |
| M4 | `homeLiveTimer` nav-away leak + `TIMERS` registry | MEDIUM | 1.5h |
| M1 | Targeted `var` → `const` in sync/sign-in code | MEDIUM | 30 min |
| M2 | 6 Dev Tools CSS utility classes; ~77 inline attrs removed | MEDIUM | 1h |
| M3 | Dev Tools onclick → delegated addEventListener | MEDIUM | 1h |

**Total:** ~8.5 hours across two sessions (audit session + remediation session)

---

## Code Changes Summary

**`index.html`** (v3.32.1 → v3.33)
- `const TIMING` — 12 timing constants, wired into 12 call sites
- `const TIMERS` — lightweight registry object with `.set/.clear/.clearAll`
- Naming convention comment block after `const DEBUG`
- `r.ok` checks added to ~25 fetch call sites across 19 functions
- `homeLiveTimer` cleared in `showSection()` on any nav away from home
- `syncCollection`, `mergeCollectionOnSignIn`, `mergeCollectionSlots`, `signInWithGitHub`, auth handler: `var` → `const` (~30 declarations)
- 6 CSS utility classes: `.dt-label-muted`, `.dt-input`, `.dt-label`, `.dt-grid-2`, `.dt-box`, `.dt-color-input`
- 13 Dev Tools `onclick` handlers replaced with `data-dt-action` + single delegated listener
- 3 `console.log` calls wrapped in `if(DEBUG)`
- exportJson copy button: `.catch().then()` → `.then(onSuccess, onFail)` with distinct failure message

**`sw.js`**
- CACHE: `mlb-v471` → `mlb-v472`

---

## Partially Addressed (Remain Open)

| ID | What was done | What remains |
|---|---|---|
| M1 | ~30 declarations in newest feature code | ~1,070 remaining `var` declarations |
| M2 | 6 classes, ~77 attrs | ~263 remaining inline style attrs |
| M3 | Dev Tools panel (13 handlers) | Dynamic template-string handlers in Radio Check, binder, ticker chips |

---

## Result

- **UAT:** ✅ Passed
- **Regressions:** 0
- **QA checks:** 35/35 passed

---

## Reports

- [Full Audit](../audits/audit-2026-05-04-baseball-app.md)
- [Remediation & Code Changes](../remediation/remediation-2026-05-04-baseball-app.md)
- [QA Test Results](../qa/qa-2026-05-04-baseball-app.md)
