# Mets Tracker — Claude Code Handoff

## What This Is
A single-file HTML sports tracker app for MLB, defaulting to the New York Mets. All data is pulled live from public APIs. The file is self-contained with no build system, no dependencies, no package.json — just one HTML file.

**Current version:** v1.30
**File:** `mets-app.html`

---

## How to Work on This Project

### File structure
There is only one file:
```
mets-app.html                    ← the entire app
mets-claudecode-handoff.md       ← this file
mets-handoff-v117.md             ← full reference doc (read this too)
```

### How to test changes
This app makes fetch() calls to external APIs. Git is set up — push to the dev branch and the user pulls/deploys from there. The Media tab requires a deployed URL (YouTube embeds give Error 153 on `file://`).

There is no dev server, no build step, no npm. Edit the file, push to branch.

### Git workflow
- **Dev branch:** `claude/review-readme-cx0F3` — all changes go here first
- **Main branch:** only merge when the user explicitly asks
- Push with: `git push origin claude/review-readme-cx0F3`
- Never push directly to `main` without being asked

---

## Strict Workflow Rules
These rules were established over many iterations — please follow them exactly:

1. **Never assume** — always ask before proposing or touching any code
2. **Surgical edits only** — make the smallest possible change to achieve the goal. Do not reformat, reorganize, or clean up code that isn't being changed.
3. **No changes without explicit user approval** — show the old code and new code, wait for "approve" before writing to the file
4. **One change at a time** — break work into small steps, confirm each works before moving to the next
5. **No rewrites** — never rewrite large sections. Targeted edits only.
6. **Debug code** — if adding temporary debug logging, wrap it in `// DEBUG START` / `// DEBUG END` comments so it's easy to find and remove
7. **Version the file** — bump the `<title>` tag version and the in-app settings panel version string on every confirmed change (e.g. v1.30 → v1.31)

---

## Architecture Overview

### Single file, all inline
Everything — HTML, CSS, JavaScript — is in one file. No imports, no modules, no external scripts.

### Key global state
```javascript
const SEASON = 2026               // hardcoded — update each season
const MLB_BASE = 'https://statsapi.mlb.com/api/v1'
const TEAMS = [...]               // 30 teams with colors, IDs, YouTube channel IDs

let activeTeam = TEAMS.find(t => t.id === 121)  // defaults to Mets
let scheduleData = []             // populated when Schedule tab is visited, or by loadTodayGame on cold load
let rosterData = {hitting, pitching, fielding}
let statsCache = {hitting, pitching}
```

### Navigation
`showSection(id, btn)` — shows/hides sections by toggling `.active` class. Sections: `home`, `schedule`, `standings`, `stats`, `news`, `media`, `league`. Live game view is a separate overlay (`#liveView`), not a section. **Calling `showSection` while the live view is active will automatically close it first.**

### Team theming
`applyTeamTheme(team)` sets seven CSS variables dynamically:
- `--blue` = team primary color
- `--orange` = team accent (secondary if contrast ≥ 3:1 AND luminance ≥ 0.05, else white)
- `--accent-text` = text color on accent surfaces (black or white based on luminance)
- `--dark` = page background — hsl(teamHue, 50%, 18%)
- `--card` = card background — hsl(teamHue, 45%, 22%)
- `--card2` = secondary card — hsl(teamHue, 40%, 26%)
- `--border` = borders — hsl(teamHue, 35%, 30%)

The hue is extracted from the team's primary colour, so each team gets a distinctly tinted dark background while remaining readable.

**Accent luminance floor:** if the computed accent colour has luminance < 0.05 (near-black, e.g. Giants/Orioles secondary), it is forced to `#ffffff` to prevent invisible text on dark backgrounds.

---

## Home Screen Cards

### Left card — "Next Game" (`#todayGame`, `loadTodayGame()`)
Priority order:
1. Live game today → score + "▶ Watch Live" button
2. Upcoming game today → "TODAY" label + time
3. No game today or today's game is final → next upcoming game with date label

Series info shown below via `getSeriesInfo(g)`:
- Tries API fields first: `g.seriesGameNumber`, `g.gamesInSeries`, `g.seriesSummary.seriesStatus`
- If `seriesStatus` is null (common for live games), falls through to compute record from `scheduleData`
- On cold load, `loadTodayGame` fetches a ±7 day schedule window to populate `scheduleData` before rendering, so the series record is available immediately
- Shows: "Game 2 of 3 · Mets lead 1-0"

### Right card — "Next Series" (`#nextGame`, `loadNextGame()`)
- Fetches 28 days of schedule
- Groups games into series: same opponent + same venue + within 4 days of each other
- Finds the **second** series with any non-Final game (i.e. the series after the current/active one)
- Renders gradient card with stacked game rows (time / W-L score / LIVE)

---

## APIs — What Works, What Doesn't

| Endpoint | Status | Notes |
|---|---|---|
| `/schedule` | ✅ Works | Primary source for all game data |
| `/standings` | ✅ Works | No season param needed |
| `/game/{pk}/linescore` | ✅ Works | Use this for live games |
| `/game/{pk}/boxscore` | ✅ Works | Player stats for live and completed games |
| `/game/{pk}/feed/live` | ❌ 404s | Do not use |
| `/stats/leaders` | ✅ Works | Requires `statGroup` param — omitting it mixes data |
| `/teams/{id}/roster` | ✅ Works | |
| `/people/{id}/stats` | ✅ Works | |
| ESPN News API | ⚠️ Unofficial | May be CORS-blocked in some browsers |
| YouTube RSS via allorigins.win | ⚠️ No SLA | 3-attempt retry in place. Media tab only. |

**Game state strings to know:**
- `abstractGameState`: `"Live"`, `"Final"`, `"Preview"`, `"Scheduled"` — both Preview and Scheduled mean upcoming
- `abstractGameState` is the reliable field. `detailedState` is more granular but less stable.

---

## CSS Variables Quick Reference
```css
--blue          /* team primary — header, active nav */
--orange        /* team accent — highlights, badges, dots, card titles */
--accent-text   /* text ON --orange surfaces */
--dark          /* page background — team hue at 18% lightness */
--card          /* card background — team hue at 22% lightness */
--card2         /* secondary card / input background — team hue at 26% lightness */
--text          /* #e8eaf0 — body text */
--muted         /* #8892a4 — secondary text */
--border        /* borders — team hue at 30% lightness */
```

All variables except `--text` and `--muted` are set dynamically by `applyTeamTheme()` on every team switch.

---

## Known Issues (do not fix without asking)
1. Live game batter/pitcher stats re-fetched every refresh — should cache per matchup
2. Live game header score text not using `--accent-text` — may be invisible on some teams
3. W/L/Live badges hardcoded green/red — not team-aware
4. Mobile/iPad layout not optimized
5. ESPN API has no fallback if blocked
6. Around the League stat leaders use index-based mapping — fragile if API order changes
7. 27 of 30 YouTube channel IDs unverified

---

## Things That Are Intentionally Simple
- **No framework** — plain JS, no React, no Vue
- **No build system** — edit and push
- **No persistence** — team selection resets on reload (by design)
- **No backend** — all APIs are called directly from the browser
- **No error retry** (except YouTube) — API failures show inline error messages

Don't add complexity unless explicitly asked.
