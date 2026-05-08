Run a bloat audit across documentation and HTML structure. This is a **report-only** command — surface findings and ask before changing anything.

---

## Phase 1 — CLAUDE.md vs docs/ audit

CLAUDE.md is an **index and quick-reference** document. Its job is to orient Claude quickly and link out to `docs/` for detail. It should NOT duplicate prose that already lives in a `docs/` file.

1. Read `CLAUDE.md` in full.
2. Read every file under `docs/` (skip `docs/technical-debt/` subdirs unless a CLAUDE.md section seems to duplicate their content).
3. For each section in CLAUDE.md, ask: *"Does this section contain detail that already exists — or belongs — in a specific `docs/` file?"*

Flag any of the following as **CLAUDE.md bloat**:
- Paragraphs or tables that are verbatim duplicates (or near-duplicates) of content in a `docs/` file
- Sections whose full detail belongs in a docs file but the docs file either doesn't exist yet or doesn't cover it
- Implementation specifics (exact function signatures, full data schemas, full CSS variable tables, step-by-step workflows) that should live in a subsystem doc
- Version history entries older than the 5 most recent that are not referenced anywhere else — these belong only in `CHANGELOG.md` if one exists, or should be trimmed
- Any block in CLAUDE.md that is longer than ~15 lines on a topic that already has a dedicated `docs/` file

For each flagged item report:
```
[CLAUDE.md BLOAT] Section: "<heading>"
  Issue: <one sentence — what's wrong>
  Belongs in: <docs/filename.md> (exists / does not exist)
  Suggested action: <trim to summary + link | move to docs file | keep — explain why>
```

---

## Phase 2 — index.html logic audit

`index.html` must be **structure only**: skeleton divs, nav, overlays, `<link>` and `<script>` tags. No logic.

1. Read `index.html` in full.
2. Scan for each of the following violation types:

**A. Inline `<script>` blocks with application logic**
- The ONE permitted inline script is the theme-flash prevention snippet near line 7 — it must stay inline and synchronous. Flag everything else.

**B. Inline `<style>` blocks**
- No `<style>` tags should exist in the body or head (beyond any injected at runtime by JS). All CSS belongs in `styles.css`.

**C. HTML attribute event handlers**
- Any `onclick=`, `onchange=`, `onsubmit=`, `oninput=`, `onload=` etc. inline on elements. All listeners belong in `src/` JS modules.

**D. Hardcoded application data**
- JSON blobs, config objects, team data, or API URLs embedded as `data-*` attributes or inside script tags.

**E. Templating logic**
- `if`/`for`/`while` or template-literal construction inside any inline script (excluding the theme snippet).

**F. Non-structural content that should be JS-rendered**
- Large blocks of repeated HTML that clearly represent a data-driven list (e.g. a hardcoded team list, a hardcoded nav item per team). Static structural nav items are fine.

For each flagged item report:
```
[INDEX.HTML LOGIC] Line ~<n>: <element or snippet>
  Violation type: <A/B/C/D/E/F> — <label>
  Should move to: <styles.css | src/subsystem/file.js | describe where>
  Risk to move: <low | medium — explain if medium>
```

---

## Phase 3 — Summary

After both phases, print a summary table:

```
BLOAT AUDIT SUMMARY
===================
CLAUDE.md issues:    X found
index.html issues:   Y found

Recommended fixes (in priority order):
1. ...
2. ...
```

Then ask: *"Would you like me to fix any of these? List the numbers you want addressed and I'll show old/new before applying anything."*

Do not make any edits without explicit approval.
