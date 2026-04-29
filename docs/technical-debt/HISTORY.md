# Technical Debt Sprint History

**Archive of all completed technical debt sprints.**

## Active Sprint

None. To start one, say **"Start tech debt sprint"** in conversation with Claude.

## Completed Sprints

(None yet. This section will grow as sprints are completed.)

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
