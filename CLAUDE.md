# MLB Tracker — Project Handoff

## What This Is
A single-file HTML sports tracker app for MLB, defaulting to the New York Mets. All data is pulled live from public APIs — no build system, no dependencies, no package.json. The entire app lives in one file.

**Current version:** v1.37
**File:** `mets-app.html`
**Default team:** New York Mets (id: 121)

---

## Workflow Rules

1. **Never assume** — always ask before proposing or touching any code
2. **Surgical edits only** — smallest possible change; do not reformat or reorganise surrounding code
3. **No changes without explicit user approval** — show old/new before applying
4. **Break changes into small steps** — confirm each works before proceeding
5. **Git branching** — all changes go to `claude/review-readme-cx0F3` first; only merge to `main` when explicitly asked. Push with `git push -u origin claude/review-readme-cx0F3`
6. **Debug code** — wrap temporary logging in `// DEBUG START` / `// DEBUG END` for easy removal
7. **Version every change** — bump both the `<title>` tag and the in-app settings panel version string on every commit. Use `v1.xx.yy` format: increment `yy` for each commit on a branch (v1.33.1, v1.33.2…); increment `xx` and drop the patch on merge to main (v1.34).
8. **No rewrites** — never rewrite large sections. Targeted edits only.

---

## Architecture Overview

### Single file, all inline
Everything — HTML, CSS, JavaScript — is in `mets-app.html`. No imports, no modules, no external scripts. Edit the file, push to branch, done.

### Key global state
```javascript
const SEASON = 2026                    // hardcoded — update each season
const MLB_BASE = 'https://statsapi.mlb.com/api/v1'
const TEAMS = [...]                    // 30 teams with colors, IDs, YouTube channel IDs

let activeTeam = TEAMS.find(t => t.id === 121)   // defaults to Mets
let scheduleData = []                  // populated by loadSchedule() or cold-load ±7 day fetch
let scheduleLoaded = false             // true only after full-season fetch completes
let rosterData = { hitting, pitching, fielding }
let statsCache = { hitting, pitching }
let selectedPlayer = null              // full roster object — includes person, position, jerseyNumber (jerseyNumber is null when loaded from team stats endpoint)
```

### Navigation
`showSection(id, btn)` — shows/hides sections by toggling `.active` class. Sections: `home`, `schedule`, `standings`, `stats`, `news`, `media`, `league`. Live game view is a separate overlay (`#liveView`), not a section. **Calling `showSection` while the live view is active automatically closes it first.**

### Team theming
`applyTeamTheme(team)` sets seven CSS variables dynamically:

| Variable | Value |
|---|---|
| `--blue` | Team primary colour — header, active nav |
| `--orange` | Team accent — secondary if contrast ≥ 3:1 AND luminance ≥ 0.05, else `#ffffff` |
| `--accent-text` | Text ON `--orange` surfaces — black or white based on luminance |
| `--dark` | Page background — hsl(teamHue, 50%, 18%) |
| `--card` | Card background — hsl(teamHue, 45%, 22%) |
| `--card2` | Secondary card / input — hsl(teamHue, 40%, 26%) |
| `--border` | Borders — hsl(teamHue, 35%, 30%) |

**Accent luminance floor:** if the computed accent has luminance < 0.05 (near-black, e.g. Giants/Orioles secondary `#27251F`), it is forced to `#ffffff`.

**Responsive breakpoints** (single `@media` block at end of `<style>`):
- `≤1024px` (iPad landscape + portrait): `.grid3` and `.live-grid` collapse to 1 column; `.matchup-grid` goes 4→2 cols; header wraps; `.main` padding reduced to 12px
- `≤767px` (portrait / phone): `.grid2` also collapses to 1 column

**Layout utility classes:**
- `.grid2` — 2-column grid, 1fr 1fr, 16px gap. Collapses at 767px.
- `.grid3` — 3-column grid, 1fr 1fr 1fr, 16px gap. Collapses at 1024px. (Stats section)
- `.matchup-grid` — 4-column grid, repeat(4,1fr), 10px gap. Goes 2-col at 1024px. (League matchups)
- `.live-grid` — unequal 3-col (1fr 1.2fr 1.4fr). Collapses at 1024px. (Live game view)

**Rule:** All layout grids must use CSS classes, not inline `style=` grid definitions — so the `@media` block can override them without touching HTML.

**Fixed neutrals** (not team-aware):
- `--text: #e8eaf0` — body text
- `--muted: #8892a4` — muted/secondary text

---

## APIs

| Endpoint | Status | Notes |
|---|---|---|
| `/schedule` | ✅ | Primary source for all game data |
| `/game/{pk}/linescore` | ✅ | Live and completed games |
| `/game/{pk}/boxscore` | ✅ | Player stats for live and completed games |
| `/standings` | ✅ | No season param needed |
| `/teams/{id}/roster` | ✅ | Roster by type — Stats tab uses `rosterType=40Man` to include IL players. `active` only returns the 26-man. `/teams/{id}/stats` returns team aggregate only, not per-player. |
| `/people/{id}/stats` | ✅ | Individual player season stats |
| `/stats/leaders` | ✅ | Requires `statGroup` param — omitting it mixes hitting/pitching data |
| `/game/{pk}/feed/live` | ❌ | 404s — do not use. Use linescore instead. |
| ESPN News API | ⚠️ | Unofficial, may be CORS-blocked in some browsers |
| YouTube RSS via allorigins.win | ⚠️ | Public proxy, no SLA. 3-attempt retry in place. Media tab only. |

**Game state strings:**
- `abstractGameState`: `"Live"`, `"Final"`, `"Preview"`, `"Scheduled"` — both `Preview` and `Scheduled` mean upcoming; both are checked
- Use `abstractGameState` (reliable). `detailedState` is more granular but less stable.

---

## CSS Variables Quick Reference
```css
--blue          /* team primary — header, active nav */
--orange        /* team accent — highlights, badges, card titles */
--accent-text   /* text ON --orange surfaces */
--dark          /* page background */
--card          /* card background */
--card2         /* secondary card / input background */
--border        /* borders */
--text          /* #e8eaf0 — body text (fixed) */
--muted         /* #8892a4 — secondary text (fixed) */
```

---

## App Pages & Sections

### 🏠 Home
**Left card — "Next Game"** (`#todayGame`, `loadTodayGame()`)
Priority order: (1) live game today → score + "▶ Watch Live" button, (2) upcoming game today → "TODAY" label + time, (3) next upcoming game → date label.

Series info below via `getSeriesInfo(g)`:
- Tries API fields first: `seriesGameNumber`, `gamesInSeries`, `seriesSummary.seriesStatus`
- If `seriesStatus` is null (common for live games), falls through to compute record from `scheduleData`
- On cold load, `loadTodayGame` fetches a ±7 day schedule window to populate `scheduleData` before rendering, so series record is available immediately without visiting the Schedule tab
- Shows: `"Game 2 of 3 · Mets lead 1-0"`

**Right card — "Next Series"** (`#nextGame`, `loadNextGame()`)
- Fetches 28 days of schedule; groups games into series (same opponent + same venue + within 4 days)
- Finds the **second** series with any non-Final game (i.e. the series after the current/active one, not the current one)
- Gradient card with stacked game rows (time / W-L score / LIVE)

**Division Snapshot** — compact standings for active team's division. Source: `/standings`

**Latest News** — top 5 ESPN headlines. Source: ESPN News API

---

### 📅 Schedule
Monthly calendar grid (Sun–Sat), navigable with ◀ ▶ arrows. Today highlighted.

`scheduleLoaded` flag controls whether `loadSchedule()` is called on tab visit. This flag was introduced because `scheduleData` can be pre-populated by the cold-load ±7 day fetch, which previously prevented the full season from ever loading.

**Clicking a completed game** expands detail panel:
- Boxscore — tabbed by team. Batting (AB, H, R, RBI, BB, K, HR) and Pitching (IP, H, R, ER, BB, K, HR, PC). Only players with AB > 0 or IP > 0.
- Linescore — inning-by-inning R/H/E
- Game Summary — all `bs.info` label/value pairs (WP, weather, attendance, umpires)

**Clicking an upcoming game** shows: location, probable pitchers.

Source: `/schedule?season=2026&teamId={id}&hydrate=team,linescore,game`

---

### 🏆 Standings
- **Division standings** — active team's division, active team highlighted
- **Wild Card Race** — top 9 non-division-leaders in active team's league. Orange cutoff after position 3.
- **Full MLB Standings** — all 6 divisions. Active team's league first, active team's division at top.

Source: `/standings?leagueId=103,104&standingsTypes=regularSeason&hydrate=team,division,league`

---

### 📊 Stats
Three-column layout: Leaders | Roster | Player Stats

**Leaders panel** — dropdown to select stat, hitting/pitching tabs, top 10 ranked players. Clicking a player loads their stats. Source: `statsCache`, populated by `fetchAllPlayerStats()`.

**Players list** — 40-man roster (hitting/pitching/fielding tabs). Includes IL players (10-day, 60-day) and anyone on the 40-man, not just the active 26. Jersey number and position shown. On load and on tab switch, the first player in the list is **automatically selected** so the Player Stats panel is never empty.

**Player Stats panel** — updates title to the selected player's name. Shows player headshot (100px wide, fixed 130px height placeholder to prevent layout shift; Cloudinary fallback to generic silhouette), `#34 · Catcher` subtitle, then full stat grid: Hitting (12 stats, 4-col), Pitching (12 stats, 4-col), Fielding (6 stats, 3-col). Source: `/people/{id}/stats`; headshots from `img.mlbstatic.com`.

Source: `/teams/{id}/roster?rosterType=40Man` + `/people/{id}/stats` (via `fetchAllPlayerStats` for cache, individual fetch on click)

---

### 🌐 Around the League
- **Today's Matchups** — all MLB games, 4-per-row grid. Live games show inning (e.g. `"● LIVE · Top 5"`). Clickable → live game view. Source: `/schedule?sportId=1&date={today}&hydrate=linescore,team` + standings for records
- **MLB News** — MLB-wide headlines, no team filter. Source: ESPN News API
- **Stat Leaders** — hitting/pitching tabs, 2×2 grid, top 10 per stat. Source: `/stats/leaders` with `statGroup` param

⚠️ **Leaders index mapping is fragile** — the API does not guarantee response order matches requested `leaderCategories` order. App uses index-based mapping. If results look wrong after an API change, re-test each position empirically.

---

### 📺 Media
Hidden by default — enabled via Settings toggle (session only, resets on reload).
- Team gradient header, two-panel layout: 25% video list / 75% player
- Most recent video auto-selected on load
- Teams without `youtubeUC` fall back to MLB main channel
- **⚠️ Requires deployed URL** — YouTube embeds return Error 153 on `file://`

Source: YouTube RSS via allorigins.win proxy → 3-attempt retry (1s delay) → DOMParser XML

---

### 📰 News
Team-specific headlines from ESPN. Manual refresh. Source: ESPN News API `?team={espnId}&limit=20`

---

### ⚾ Live Game View
Triggered from Home card or Around the League matchup grid.

- **Score header** — team abbreviations, current runs, inning indicator, LIVE badge
- **Count & Runners** — balls/strikes/outs dots, SVG diamond with runners in team accent colour
- **Current Matchup** — batter (name + AVG/OBP/OPS) and pitcher (name + ERA/WHIP + today's game line: IP/H/ER/K/PC from boxscore)
- **Linescore** — live inning-by-inning R/H/E
- **Box Score** — tabbed away/home batting and pitching tables
- **Game Info** — weather, attendance, umpires from `bs.info`
- **Last updated timestamp** at bottom
- Auto-refresh every 5 minutes; manual ↻ Refresh button
- ← Back returns to Home; nav buttons also close the live view

Source: `/game/{gamePk}/linescore` + `/game/{gamePk}/boxscore` (NOT `feed/live` — returns 404)

---

### ⚙️ Settings
- **Select Team** — dropdown of all 30 MLB teams grouped by division; switching reloads all data, reapplies theme, resets all caches
- **Color Theme** — dropdown of all 30 teams + "Default (Follow Team)"; overrides colours independently of the active team; persists across team switches
- **Invert Colours** — slide toggle; swaps primary and secondary colours; works with theme override
- **Media Tab** — slide toggle, defaults off; shows/hides Media section in nav
- Panel closes on click outside
- All settings persist across page reloads via `localStorage` (team, theme, invert, media tab)
- Version number at bottom (e.g. `v1.37`)

---

## Key Functions Reference

| Function | Purpose |
|---|---|
| `applyTeamTheme(team)` | Sets all 7 CSS vars, logo, page title for active team |
| `switchTeam(teamId)` | Resets all state and reloads all data for new team |
| `loadTodayGame()` | Left home card — fetches ±7 day window on cold load for series record |
| `getSeriesInfo(g)` | Returns series string e.g. `"Game 2 of 3 · Mets lead 1-0"`. API desc first, scheduleData fallback |
| `renderNextGame(g, label)` | Renders the left home card HTML |
| `loadNextGame()` | Right home card — finds and renders series after the current one |
| `loadSchedule()` | Fetches full season, sets `scheduleLoaded=true`, renders calendar |
| `renderCalendar()` | Draws monthly calendar grid from scheduleData |
| `changeMonth(dir)` | Navigates calendar month, calls renderCalendar |
| `selectCalGame(gamePk)` | Loads linescore + boxscore for a clicked calendar game |
| `buildBoxscore(players)` | Global — builds batting + pitching tables from boxscore players object. Used by both historical and live game views |
| `switchBoxTab(bsId, side)` | Switches active tab in a boxscore panel |
| `loadStandings()` | Fetches standings, calls all four render functions |
| `loadRoster()` | Fetches 40-man roster from `/teams/{id}/roster?rosterType=40Man`; splits hitting/pitching/fielding, auto-selects first hitter |
| `fetchAllPlayerStats()` | Fetches season stats for all roster players in parallel; populates `statsCache` for the Leaders panel |
| `loadLeaders()` | Sorts and renders team leader list from statsCache |
| `switchRosterTab(tab, btn)` | Switches roster tab, auto-selects first player of new tab |
| `selectPlayer(id, type)` | Looks up full player object from rosterData, updates card title, fetches and renders season stats |
| `renderPlayerStats(s, group)` | Renders stat grid with player position subtitle. 4-col for hitting/pitching, 3-col for fielding |
| `loadLeagueView()` | Orchestrates all Around the League loads |
| `loadLeagueMatchups()` | Today's all-team schedule grid with live inning display |
| `loadLeagueLeaders()` | Fetches /stats/leaders, maps by index to LEAGUE_*_STATS arrays |
| `showLiveGame(gamePk)` | Hides main, shows live view, starts auto-refresh |
| `fetchLiveGame()` | Polls linescore + boxscore; renders score, count, matchup, linescore, box score, game info |
| `closeLiveView()` | Clears refresh interval, hides live view, restores main |
| `showSection(id, btn)` | Switches sections; calls closeLiveView() first if live view is active |
| `loadMedia()` | Builds media card HTML, calls loadMediaFeed |
| `loadMediaFeed(uc)` | Fetches YouTube RSS via allorigins proxy, 3-attempt retry |
| `gameGradient(g)` | Returns inline style string for two-team colour gradient |
| `hueOf(hex)` | Extracts HSL hue (0–360) from a hex colour string |
| `hslHex(h, s, l)` | Converts HSL values to hex colour string |

---

## Known Open Issues

1. **Live game — stats not caching** — season stats for batter/pitcher re-fetched on every refresh. Should cache and only re-fetch when matchup changes.
2. **Live game — header text colour** — score text in live header not using `--accent-text`. May be invisible for some team colour combinations.
3. **Badges not team-aware** — W/L (green/red) and Live (red) badges are hardcoded colours.
4. **Mobile/iPad layout** — not reviewed or optimised.
5. **News fallback** — if ESPN API is CORS-blocked, no fallback source.
6. **Around the League leaders index mapping** — empirically derived, fragile. Re-test if API response order changes.
7. **allorigins.win proxy** — no SLA, free service. Retry logic (3 attempts, 1s gap) mitigates failures.
8. **YouTube channel IDs** — 27 of 30 `youtubeUC` values unverified. QC needed each offseason.
9. **Today's date uses local time** — works for EST but worth noting for other timezones.

---

## Hardcoding Risks

| Item | Risk | Fix |
|---|---|---|
| `SEASON = 2026` | Must update each season | Derive from system date or MLB API |
| Team colours in TEAMS array | Teams rebrand | Verify each offseason |
| ESPN team IDs | Different system from MLB IDs, manually mapped | Build dynamic mapping |
| `WC_SPOTS = 3` | Rule change risk | Already a named const |
| ESPN API endpoint | Unofficial, undocumented | Monitor for breakage |
| MLB Stats API base URL | Unofficial | Watch for deprecation |
| Leaders `cats` array order | Index-based mapping — order matters | Re-test empirically if results look wrong |
| allorigins.win proxy URL | Free public proxy, no SLA | Swap URL if it goes down; retry logic already in place |
| YouTube channel IDs (`youtubeUC`) | Teams may rebrand/change channels | Verify each offseason |
| Game state strings | MLB uses both `"Preview"` and `"Scheduled"` for upcoming | Both checked — verify if new states appear |

---

## Feature Backlog

- [ ] iPhone layout optimisation
- [ ] Cache live game batter/pitcher stats per matchup
- [ ] Fix live header text colour accessibility (`--accent-text`)
- [ ] Team-aware W/L/Live badges
- [ ] News fallback source (MLB RSS)
- [ ] Last 10 games record widget
- [ ] Dynamic season year
- [ ] QC all 30 team YouTube channel IDs
- [ ] Consider more reliable CORS proxy for YouTube RSS
- [x] Persist user settings via localStorage — team, theme, invert, media tab (v1.37)
- [x] Player headshots in stats panel with layout-shift-free placeholder (v1.37)
- [x] Probable pitcher hydration fix — no longer shows TBD when pitchers are announced (v1.37)
- [x] Schedule tab auto-loads on first visit (`scheduleLoaded` flag — v1.31)
- [x] Auto-select first player in stats; player name in card title (v1.32)
- [x] Stats tab shows 40-man roster (includes IL players) instead of active 26-man only (v1.33)
- [x] Next Game / Next Series home cards
- [x] Team-aware backgrounds (hue from primary, all bg vars dynamic)
- [x] Series record on cold load (±7 day fetch in loadTodayGame)
- [x] Next Series shows series after current, not current series
- [x] Live game enriched — box score, pitcher game line, game info
- [x] Nav works from live view — showSection closes live view first
- [x] Version number in settings panel
- [x] Giants/Orioles dark accent fix — luminance floor enforced
- [x] Nav team logo (SVG from mlbstatic.com) replaces ⚾ emoji; team name only, no "Tracker" suffix (v1.36)
- [x] Color Theme override dropdown in settings — pick any team's colours independently of active team (v1.36)
- [x] Invert Colours toggle in settings — swaps primary and secondary colours (v1.36)
- [x] Settings panel closes on click outside (v1.36)
- [x] iPad responsive layout — CSS grid classes + media queries at ≤1024px and ≤767px (v1.35)
