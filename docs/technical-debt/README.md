# Technical Debt Management

## Quick Start

To understand how technical debt sprints work, see [WORKFLOW.md](./WORKFLOW.md).

## Current Status

No active sprint. To start one, say **"Start tech debt sprint"** in a conversation with Claude.

## Latest Sprint Activity

See [HISTORY.md](./HISTORY.md) for completed sprints and audit archive.

## What Happens During a Sprint

1. **Audit** — Full code review, findings documented
2. **Remediation** — Fixes applied with before/after code
3. **QA** — Comprehensive testing, results documented
4. **UAT** — You test in browser
5. **Finalization** — Code merged to main, documented

## Files Per Sprint

| File | Purpose |
|---|---|
| `audits/audit-{date}.md` | Full code review findings (Severity, Root Cause, Fix) |
| `remediation/remediation-{date}.md` | Before/after code, testing results |
| `qa/qa-{date}.md` | QA test results & sign-off |
| `sprints/sprint-{date}-summary.md` | High-level recap merged to main |

## Archive Strategy

All audit files are permanent and searchable by date. You can query historical issues across previous sprints.

---

**See:** [WORKFLOW.md](./WORKFLOW.md) for detailed process
