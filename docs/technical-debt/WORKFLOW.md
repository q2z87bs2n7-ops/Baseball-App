# Technical Debt Sprint Workflow

## Overview

A **technical debt sprint** is an on-demand audit + remediation cycle. It's triggered explicitly, runs through 5 stages, and results in improved code quality.

**You control it.** Every stage has checkpoints where you make decisions.

---

## When You Trigger a Sprint

You say: **"Start tech debt sprint"** or **"Begin tech debt audit"**

Claude responds: Creates a working document and begins the audit.

---

## The 5 Stages

### Stage 1: AUDIT (Claude)

Claude performs a comprehensive code review:
- Scans the entire codebase (currently `index.html` + supporting files)
- Identifies issues across categories: Code Cleanup, Code Quality, Safety, Maintainability, Performance
- Assigns severity: HIGH (must fix), MEDIUM (should fix), LOW (nice to fix)
- Documents findings with root cause, impact, and proposed fix

**Files created:**
- `.claude/tech-debt-session.md` (working checklist, git-ignored)
- `audits/audit-{date}.md` (committed to branch)

**Checkpoint:** Claude presents findings. You decide:
- ✅ "Fix all of them"
- ⚠️ "Skip issue X" — Requires explicit confirmation: *"I understand X won't be fixed. Confirmed."*
- ❌ "Abort sprint" — Cleans up, ends sprint

---

### Stage 2: REMEDIATION (Claude)

Claude applies approved fixes:
- One fix per commit (linked in remediation report)
- Each commit includes issue number + description
- Before/after code documented
- Manual testing per fix

**Files created:**
- `remediation/remediation-{date}.md` (committed to branch)

**Progress:** `.claude/tech-debt-session.md` updated with checklist of fixed issues

**Checkpoint:** Claude announces remediation complete. You respond:
- ✅ "Proceed to QA"
- ⏸️ "Pause here" — Session ends, I remember state via session.md

---

### Stage 3: QA (Claude)

Claude runs comprehensive testing:
- **Functional tests** — All major sections (Home, Schedule, Pulse, Live View, Settings)
- **Regression tests** — Existing features still work after fixes
- **Code quality** — No console errors, no new undefined references
- **Device/browser tests** — Mobile (375px), Tablet (768px), Desktop (1920px)
- **Edge cases** — Rapid team switch, demo mode, doubleheaders, etc.

**Files created:**
- `qa/qa-{date}.md` (committed to branch)

**Result:** ✅ PASS or ❌ FAIL (with list of issues)

**Checkpoint:** Claude announces QA result:
- ✅ **PASS:** "QA complete. Ready for your UAT testing."
- ❌ **FAIL:** "QA found issues: [list]. Should we fix them or abort?"
  - If fix: Return to Stage 2 (remediation), repeat
  - If abort: Clean up, end sprint

---

### Stage 4: UAT (You)

You test the branch in your browser:
- Test the fixes personally
- Check for regressions in your normal workflow
- Verify on your device (mobile/tablet/desktop)

**Duration:** As long as you need

**Checkpoint:** You respond:
- ✅ "UAT complete, ready to merge"
- ⚠️ "Found issues: [list]" — Return to Stage 2 (remediation), repeat
- ❌ "Abort" — Clean up, end sprint

---

### Stage 5: FINALIZATION (Claude)

Claude wraps up:
1. Creates `sprints/sprint-{date}-summary.md` (high-level recap)
2. Appends to `docs/technical-debt/HISTORY.md` (permanent archive)
3. Creates PR, waits for final approval
4. Merges to main
5. Tags commit: `tech-debt-{date}-complete`
6. Deletes `.claude/tech-debt-session.md` locally (was never committed)

**Result:** All audit/remediation/QA files now in main, permanently archived.

---

## Checkpoint Summary

| Stage | Claude Says | You Respond | Claude Does |
|---|---|---|---|
| Audit | "9 issues found. Approve all?" | "Skip X. Fix Y-Z." | Waits for approval |
| Remediation | "Fixes applied." | "Proceed to QA" or "Pause" | Advances or pauses |
| QA | "QA: PASS" | "Ready for UAT" | Advances to UAT |
| QA | "QA: FAIL" | "Fix issues" or "Abort" | Repeats Stage 2 or cleans up |
| UAT | (none — you control this) | "UAT complete" or "Found issues" | Advances or repeats Stage 2 |
| Finalization | "Creating PR..." | "Merge it" | Merges, archives, done |

---

## Session Continuity

### Before You Log Off

You say: **"Done for today"** or **"I'm logging off"**

Claude confirms:
```
Before we stop, let me check:

1. Current stage: [AUDIT | REMEDIATION | QA | UAT]?
2. Any blockers or incomplete work?
3. Is the current stage documented so I can resume?

[If incomplete] What should I remember?
[If complete] Confirmed. I'll resume from here.
```

---

### Next Session

Claude automatically reads:
- `.claude/tech-debt-session.md` (current sprint progress)
- Latest audit/remediation/qa files (what's been done)
- `docs/technical-debt/HISTORY.md` (all previous sprints)
- `docs/technical-debt/audits/` (all historical issues)

Claude says:
```
Welcome back. Sprint 2026-XX-XX-{name}:
- Audit: ✅ Complete (9 issues)
- Remediation: ✅ Complete (8 fixed)
- QA: ⏳ In progress (testing started)
- UAT: ⏳ Pending

Previous sprints found:
- 2026-04-15: Pulse state (5 fixed)
- 2026-03-20: CSS refactor (3 fixed)

Known historical issues still open:
- Magic numbers in timeouts (from 2026-03-20)
- Event listener cleanup (from 2026-04-15)

Resuming QA testing...
```

---

## Testing Detail

### Functional Smoke Tests (Per Section)

**Home Tab:**
- Next game card renders
- Series info displays correctly
- Live badge appears for active games
- Watch Live button opens live view

**Schedule Tab:**
- Calendar navigates months
- Dates with games show correct opponents
- Doubleheader games show both G1/G2
- PPD (postponed) games show grey badge
- Clicking a game shows detail panel

**Pulse Section:**
- Ticker shows live games only
- Story carousel rotates every 4.5s
- Feed items sorted newest-first
- HR player card fires with stats
- No console errors

**Live Game View:**
- Score updates
- Play-by-play log populates
- Box score tabs work (away/home, batting/pitching)
- Runs indicator shows correctly
- Close returns to home

**Settings:**
- Team dropdown switches theme
- Color theme override works
- Invert colors toggle works
- Media tab toggle shows/hides section

### Regression Tests (After Fixes)

- No new console errors
- No new undefined references
- All intervals clear on page exit
- Event listeners attach once (no duplicates)
- Theme persistence works across page reload
- Mobile nav doesn't overflow at ≤480px
- iPad landscape Pulse layout stable at 1024px

### Device Testing

- **Mobile (375px):** Calendar dots, nav fixed bottom, no horizontal scroll
- **Tablet (768px):** Schedule detail panel, Pulse responsive
- **Desktop (1920px):** All sections render, zoom scaling works

---

## Archive & History

All audit files remain in `docs/technical-debt/` permanently:
- Never deleted
- Searchable by date
- Linked from HISTORY.md
- Queryable: *"Show me all HIGH priority issues across all audits"*

Each sprint summary includes:
- Sprint ID, date, branch
- Issues fixed (count by severity)
- What was changed (links to code)
- QA results
- Links to full audit/remediation/qa files

---

## Examples

### Example: Skip an Issue

**Audit finds:**
1. DEBUG logging (HIGH)
2. Magic numbers (LOW)

**You respond:** "Fix #1, skip #2"

**Claude confirms:** "I understand magic numbers won't be fixed. Confirmed?"

**You:** "Confirmed."

**Claude:** Applies only fix #1, proceeds to remediation.

---

### Example: Resume Mid-Sprint

**Session 1:** Audit complete, remediation in progress (4/9 fixed)

**Session 2:** You say "Back to tech debt work"

**Claude:** Reads `.claude/tech-debt-session.md`
```
Remediation: In progress (4/9 fixed)
Remaining:
1. ⏳ Event listener cleanup
2. ⏳ Magic numbers extraction
3. ⏳ Naming consistency (genXxx functions)
4. ⏳ Unused globals removal
```

**Claude:** "Resuming with issue #5 (event listener cleanup)..."

---

## Next Steps

- To start a sprint, say: **"Start tech debt sprint"**
- To see history: Read [HISTORY.md](./HISTORY.md)
- To understand the codebase context, read [CLAUDE.md](../../CLAUDE.md)
