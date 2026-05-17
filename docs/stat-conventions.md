# Stat Display Conventions

> Extracted from CLAUDE.md. See CLAUDE.md "Stat Display Conventions" for the summary.

How every numeric stat is formatted for display. Helpers live in `src/utils/format.js` (`fmt`, `fmtRate`) — see `docs/functions.md`.

| Category | Stats | Format | Rule |
|---|---|---|---|
| Rate (no leading zero) | AVG, OBP, SLG, OPS, FPCT | `.xxx` | `fmtRate(v)` — strips leading zero when 0 < val < 1 |
| Traditional pitching | ERA | `z.xx` | `fmt(v, 2)` |
| Traditional pitching | WHIP | `z.xx` | `fmt(v, 2)` |
| Per-9 / ratio | K/9, BB/9, K/BB | `z.xx` | `fmt(v, 2)` |
| Innings pitched | IP | `x.x` | Pass-through string — tenths = outs, not fractions. Never parse/round. |
| Counting | HR, RBI, H, K, BB, R, SB, PA, AB, W, L, SV, GS, ER, PC, E, PO, A, TC, DP | integer | Raw value, no `toFixed` |
