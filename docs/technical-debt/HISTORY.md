# Technical Debt Sprint History

**Archive of all completed technical debt sprints.**

## Active Sprint

None. To start one, say **"Start tech debt sprint"** in conversation with Claude.

## Completed Sprints

### Sprint: 2026-05-04-baseball-app
**Status:** ✅ COMPLETE
**Branch:** `claude/tech-debt-audit-e5E4H`
**Merged:** 2026-05-04

**Issues fixed:**
- HIGH: 1 (H3 — r.ok fetch validation at ~25 call sites)
- MEDIUM: 4 (M1 targeted var→const, M2 CSS class extraction, M3 Dev Tools onclick→addEventListener, M4 timer leak + registry)
- LOW: 4 (N5 console.log guards, N6 copy chain fix, L1 TIMING constants, L2 naming conventions)
- Partially addressed: M1, M2, M3 (bulk work deferred)

**Result:** 9 issues fixed, 0 regressions, 35/35 QA checks passed, UAT passed.

**Code Changes:**
- `index.html`: 9 fixes, v3.32.1 → v3.33
- `sw.js`: cache mlb-v471 → mlb-v472

**Reports:**
- [Full Audit](./audits/audit-2026-05-04-baseball-app.md)
- [Remediation & Code Changes](./remediation/remediation-2026-05-04-baseball-app.md)
- [QA Test Results](./qa/qa-2026-05-04-baseball-app.md)
- [Sprint Summary](./sprints/sprint-2026-05-04-baseball-app.md)

**Known issues that remain open:**
- M1: ~1,070 remaining `var` declarations — deferred to future sprint
- M2: ~263 remaining inline style attrs — deferred to future sprint
- M3: dynamic template-string onclick handlers (Radio Check rows, binder, ticker) — deferred to future sprint

---

### Sprint: 2026-05-01-baseball-app
**Status:** ✅ COMPLETE
**Branch:** `claude/start-tech-debt-sprint-p9u8r`
**Merged:** 2026-05-01

**Issues fixed:**
- HIGH: 2 (N1 DEBUG console.log blocks, H4 AbortController on polling loops)
- MEDIUM: 3 (N2 Clipboard API, N3 DEBUG flag, N4 Focus null guard)
- Deferred: 8 (H3, M1–M4, L1–L2)

**Result:** 5 issues fixed, 0 regressions, 15/15 QA checks passed, UAT passed.

**Code Changes:**
- `index.html`: 5 fixes, version v2.62 → v2.62.1
- `sw.js`: cache mlb-v300 → mlb-v301

**Reports:**
- [Full Audit](./audits/audit-2026-05-01-baseball-app.md)
- [Remediation & Code Changes](./remediation/remediation-2026-05-01-baseball-app.md)
- [QA Test Results](./qa/qa-2026-05-01-baseball-app.md)
- [Sprint Summary](./sprints/sprint-2026-05-01-baseball-app.md)

**Known issues from this sprint that remain open:**
- H3: Fetch error handling (50+ calls) — Deferred to future sprint
- M1–M4: Medium priority issues — Deferred to future sprint
- L1–L2: Low priority issues — Deferred to future sprint

---

### Sprint: 2026-04-29-baseball-app
**Status:** ✅ COMPLETE  
**Branch:** `claude/tech-debt-sprint-GdCbY`  
**Merged:** 2026-04-29  

**Issues fixed:**
- HIGH: 2 (Empty updateHeader() stub, Sound panel listener duplication)
- Already Correct: 1 (Visibility listener duplication)
- Deferred: 8 (H3–H4, M1–M4, L1–L2)

**Result:** 2 issues fixed, 1 audit finding (already correct), 0 regressions, 12/12 QA tests passed.

**Test Results:**
- Automated QA: ✅ 12/12 passed (code validation, syntax, regression)
- User UAT: ✅ Approved (sound panel behavior, Pulse navigation, general regression)

**Code Changes:**
- `index.html`: 3 lines changed (H1 removal, H2 listener fix, version bump)
- `sw.js`: 1 line changed (cache version bump)

**Reports:**
- [Full Audit](./audits/audit-2026-04-29-baseball-app.md)
- [Remediation & Code Changes](./remediation/remediation-2026-04-29-baseball-app.md)
- [QA Test Results](./qa/qa-2026-04-29-baseball-app.md)
- [Sprint Summary](./sprints/sprint-2026-04-29-baseball-app.md)

**Known issues from this sprint that remain open:**
- H3: Fetch error handling (49 calls) — Deferred to future sprint
- H4: AbortController on fetch calls — Deferred to future sprint
- M1–M4: Medium priority issues — Deferred to future sprint
- L1–L2: Low priority issues — Deferred to future sprint

---

## How to Read This Archive

Each completed sprint includes:
- **Sprint ID:** Unique identifier (date + name)
- **Status:** ✅ COMPLETE
- **Branch:** Git branch used
- **Merged:** Date merged to main
- **Issues fixed:** Count by severity
- **Links:** To full audit, remediation, QA reports

### Example Entry

```
### Sprint: 2026-04-29-cleanup
**Status:** ✅ COMPLETE  
**Branch:** `tech-debt/2026-04-29-cleanup`  
**Merged:** 2026-04-29  

**Issues fixed:**
- HIGH: 2 (DEBUG logging, updateHeader stub)
- MEDIUM: 4 (var→let conversions, event listener cleanup, etc.)
- LOW: 3 (unused globals, magic numbers, naming consistency)

**Result:** All 9 issues fixed, 0 regressions.

**Reports:**
- [Full Audit](./audits/audit-2026-04-29-cleanup.md)
- [Remediation & Code Changes](./remediation/remediation-2026-04-29-cleanup.md)
- [QA Test Results](./qa/qa-2026-04-29-cleanup.md)

**Known issues from this sprint that remain open:**
- None
```

---

## Querying Historical Issues

### Find All HIGH Priority Issues (Across All Sprints)

Check each `audit-{date}.md` file in the `audits/` folder for issues marked HIGH.

### Find Issues Related to a Feature

Check HISTORY.md for sprint summaries, then read the full audit report.

### Find Issues Fixed Between Two Dates

Use git log: `git log --oneline --grep="tech-debt" --since="2026-04-01" --until="2026-05-01"`

---

## Note on Historical Context

When starting a new sprint, Claude automatically reads:
- All previous audit files
- This HISTORY.md
- Previous remediation results

This ensures new sprints understand what was already fixed and what remains.

---
