# Mets Tracker — Claude Code Handoff

## What This Is
A single-file HTML sports tracker app for MLB, defaulting to the New York Mets. All data is pulled live from public APIs. The file is self-contained with no build system, no dependencies, no package.json — just one HTML file.

**Current version:** v1.17
**File:** `mets app claude practice.html`

---

## How to Work on This Project

### File structure
There is only one file:
```
mets app claude practice.html   ← the entire app
mets_handoff.md                 ← full reference doc (read this too)
mets_claudecode_handoff.md      ← this file
```

### How to test changes
This app makes fetch() calls to external APIs. Two options:
- **Netlify Drop** — drag the file to drop.netlify.com, get a live URL instantly. Best for testing Media tab and API calls.
- **Local browser** — open the file directly in Chrome. Most features work except the Media tab (YouTube embed gives Error 153 on file://).

There is no dev server, no build step, no npm. Edit the file, reload the browser.

---

## Strict Workflow Rules
These rules were established over many iterations — please follow them exactly:

1. **Never assume** — always ask before proposing or touching any code
2. **Surgical edits only** — make the smallest possible change to achieve the goal. Do not reformat, reorganize, or clean up code that isn't being changed.
3. **No changes without explicit user approval** — show the old code and new code, wait for "approve" before writing to the file
4. **One change at a time** — break work into small steps, confirm each works before moving to the next
5. **No rewrites** — never rewrite large sections. Targeted edits only.
6. **Debug code** — if adding temporary debug logging, wrap it in `// DEBUG START` / `// DEBUG END` comments so it's easy to find and remove
7. **Version the file** — when a change is confirmed working, bump the version comment at the top of the file (e.g. v1.17 → v1.18)

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
let scheduleData = []             // populated when Schedule tab is visited
let rosterData = {hitting, pitching, fielding}
let statsCache = {hitting, pitching}
```

### Navigation
`showSection(id, btn)` — shows/hides sections by toggling `.active` class. Sections: `home`, `schedule`, `standings`, `stats`, `news`, `media`, `league`. Live game view is a separate overlay (`#liveView`), not a section.

### Team theming
`applyTeamTheme(team)` sets three CSS variables dynamically:
- `--blue` = team primary color
- `--orange` = team accent (secondary if contrast ≥ 3:1, else white)
- `--accent-text` = text color on accent surfaces (black or white based on luminance)

All other colors (`--dark`, `--card`, `--card2`, `--muted`, `--border`) are fixed.

---

## Home Screen Cards

### Left card — "Next Game" (`#todayGame`, `loadTodayGame()`)
Priority order:
1. Live game today → score + "▶ Watch Live" button
2. Upcoming game today → "TODAY" label + time
3. No game today or today's game is final → next upcoming game with date label

Series info shown below via `getSeriesInfo(g)`:
- Tries API fields first: `g.seriesGameNumber`, `g.gamesInSeries`, `g.seriesSummary.seriesStatus`
- Falls back to inferring from `scheduleData` (same opponent + venue within 4 days)
- Shows: "Game 2 of 3 · Mets lead 1-0"
- Note: fallback requires `scheduleData` to be populated (Schedule tab visited)

### Right card — "Next Series" (`#nextGame`, `loadNextGame()`)
- Fetches 28 days of schedule
- Groups games into series: same opponent + same venue + within 4 days of each other
- Finds first series with at least one non-Final game
- Renders gradient card with stacked game rows (time / W-L score / LIVE)

---

## APIs — What Works, What Doesn't

| Endpoint | Status | Notes |
|---|---|---|
| `/schedule` | ✅ Works | Primary source for all game data |
| `/standings` | ✅ Works | No season param needed |
| `/game/{pk}/linescore` | ✅ Works | Use this for live games |
| `/game/{pk}/boxscore` | ✅ Works | Player stats for completed games |
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
--orange        /* team accent — highlights, badges, dots */
--accent-text   /* text ON --orange surfaces */
--dark          /* #0a0f1e — page background */
--card          /* #111827 — card background */
--card2         /* #1a2236 — secondary card / input background */
--text          /* #e8eaf0 — body text */
--muted         /* #8892a4 — secondary text */
--border        /* #1e2d4a — borders */
```

---

## Known Issues (do not fix without asking)
1. Live game batter/pitcher stats re-fetched every refresh — should cache per matchup
2. Live game header score text not using `--accent-text` — may be invisible on some teams
3. SF Giants and Baltimore Orioles — secondary color passes contrast check but both are dark
4. `--dark`, `--card`, `--card2` not team-aware — deferred to v2
5. W/L/Live badges hardcoded green/red — not team-aware
6. Mobile/iPad layout not optimized
7. ESPN API has no fallback if blocked
8. Series info blank on cold load if Schedule tab not visited (scheduleData empty)
9. Around the League stat leaders use index-based mapping — fragile if API order changes
10. 27 of 30 YouTube channel IDs unverified

---

## Things That Are Intentionally Simple
- **No framework** — plain JS, no React, no Vue
- **No build system** — edit and refresh
- **No persistence** — team selection resets on reload (by design)
- **No backend** — all APIs are called directly from the browser
- **No error retry** (except YouTube) — API failures show inline error messages

Don't add complexity unless explicitly asked.
