# Mets Tracker — New Conversation Handoff

## What This Is
A single-file HTML sports tracker app for MLB, defaulting to the New York Mets. All data is pulled live from public APIs — no Claude involvement during use. The file is self-contained with no dependencies.

---

## Workflow Rules (strictly follow these)
1. **Never assume** — always ask before proposing or touching any code
2. **`update` only** — `rewrite` is banned. Only targeted `update` calls permitted
3. **No changes without explicit user approval** — show old/new before applying
4. **Break changes into small steps** — QC after each step before proceeding
5. **User downloads and tests locally** — app requires local file or Netlify to test APIs
6. **User keeps local copies as version rollback** — no version history in Claude
7. **Debug code** uses `// DEBUG START` / `// DEBUG END` markers for easy removal
8. **Prod artifact title** includes version number e.g. "Mets Tracker v1.17 — PROD"

---

## Current State
- **Version:** v1.17
- **File:** `mets app claude practice.html`
- **Hosting:** User deploys manually via Netlify Drop or local Chrome
- **Default team:** New York Mets (id: 121)

---

## APIs Used
| API | Endpoint | Auth | Notes |
|---|---|---|---|
| MLB Stats API | `https://statsapi.mlb.com/api/v1` | None | Unofficial, no key needed |
| ESPN News | `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/news` | None | Unofficial, CORS issues in some browsers |
| MLB Linescore | `/game/{gamePk}/linescore` | None | Used for live + completed games |
| MLB Boxscore | `/game/{gamePk}/boxscore` | None | Used for completed game player stats |
| MLB Feed Live | `/game/{gamePk}/feed/live` | None | **Known 404 for some games** — do not use, use linescore instead |
| MLB Schedule | `/schedule?sportId=1&season=2026&teamId={id}` | None | Full season schedule |
| MLB Schedule (all teams) | `/schedule?sportId=1&date={today}&hydrate=linescore,team` | None | Used for Around the League matchups — no teamId filter |
| MLB Standings | `/standings?leagueId=103,104` | None | No season param — pulls current live standings |
| MLB Roster | `/teams/{id}/roster?rosterType=active&season=2026` | None | Active roster |
| YouTube RSS Feed | `https://www.youtube.com/feeds/videos.xml?channel_id={UC_ID}` | None | CORS-blocked direct — fetched via allorigins.win proxy with 3-attempt retry |
| allorigins.win proxy | `https://api.allorigins.win/get?url={encoded_url}` | None | Public CORS proxy — used to fetch YouTube RSS. No SLA, monitor for reliability |
| MLB Stat Leaders | `/stats/leaders?leaderCategories={cats}&season=2026&leaderGameTypes=R&statGroup={hitting|pitching}&limit=10` | None | League-wide stat leaders. **statGroup param is required** — omitting it causes hitting/pitching data to mix |

---

## Design System
The app uses a dynamic CSS variable system set per team in `applyTeamTheme()`:

| Variable | Purpose |
|---|---|
| `--blue` | Team primary color — header bg, active elements |
| `--orange` | Team accent — either secondary color or white if contrast fails |
| `--accent-text` | Text ON accent-colored surfaces — black or white for readability |

**Accessibility logic in `applyTeamTheme()`:**
1. Calculate contrast ratio of secondary vs primary
2. If ratio ≥ 3:1 → use secondary as accent, else use `#ffffff`
3. Calculate luminance of accent → if lum > 0.4 → accent-text = `#111827`, else `#ffffff`

**Fixed neutrals (not team-aware yet):**
- `--dark: #0a0f1e` — page background
- `--card: #111827` — card background
- `--card2: #1a2236` — secondary card background
- `--muted: #8892a4` — muted text
- `--border: #1e2d4a` — borders

---

## App Pages & Sections

### 🏠 Home (default view)
**Purpose:** Quick overview dashboard on load
**Contents:**
- **Next Game card** (left) — shows the most relevant upcoming game. Priority order: (1) live game today → shows score + "▶ Watch Live" button, (2) upcoming game today → shows "TODAY" label + time, (3) next upcoming game → shows date label. Also shows series info below the game: "Game 2 of 3 · Mets lead 1-0". Series info pulled from API fields (`seriesGameNumber`, `gamesInSeries`, `seriesSummary.seriesStatus`) with fallback inference from `scheduleData` (same opponent + venue within 4 days). Series record calculated from prior game results in the series. Source: `/schedule?date={today}&teamId={id}&hydrate=linescore,team,seriesStatus,gameInfo`
- **Next Series card** (right) — finds the next series with at least one unplayed game. Groups games by opponent + venue within 4-day window. Gradient uses both teams' colors. Shows opponent, venue, date range, and per-game rows (time if upcoming, W/L + score if completed, LIVE badge if in progress). Series record shown inline if any games already played. Source: `/schedule?startDate={today}&endDate={+28days}&teamId={id}&hydrate=team,linescore,venue`
- **Division Snapshot** — compact standings table for active team's division. Source: `/standings`
- **Latest News** — top 5 headlines from ESPN, links to full articles. Source: ESPN News API

**Known fragility — game state strings:** The MLB API uses both `"Preview"` and `"Scheduled"` as `abstractGameState` for upcoming games. Both are checked in `loadTodayGame()`. If today's upcoming game isn't showing, verify which state the API is returning.

### 📅 Schedule
**Purpose:** Full season calendar view with game results
**Contents:**
- Monthly calendar grid (Sun–Sat), navigable with ◀ ▶ arrows
- Each game day shows: opponent, home/away, W/L + score for completed, time for upcoming
- Today highlighted with orange circle
- **Clicking a completed game** expands detail panel below calendar:
  - **Player Boxscore** — tabbed by away/home team abbreviation. Batting table (AB, H, R, RBI, BB, K, HR) and Pitching table (IP, H, R, ER, BB, K, HR, PC). Only players with AB > 0 or IP > 0. Source: `/game/{gamePk}/boxscore`
  - **Linescore** — inning-by-inning R/H/E. Source: `/game/{gamePk}/linescore`
  - **Game Summary** — all `bs.info` label/value pairs from boxscore (WP, weather, attendance, umpires, etc.)
- **Clicking an upcoming game** shows: location, probable pitchers
**Source:** `/schedule?season=2026&teamId={id}&hydrate=team,linescore,game`

### 🏆 Standings
**Purpose:** MLB standings with focus on active team's division and wild card
**Contents:**
- **Division standings** — full table for active team's division (W, L, PCT, GB). Active team highlighted.
- **Wild Card Race** — top 9 non-division-leader teams in active team's league. GB calculated from top WC team. Orange cutoff line after position 3.
- **Full MLB Standings** — all 6 divisions. Active team's league shown first, active team's division at top. Active team highlighted with ●.
**Source:** `/standings?leagueId=103,104&standingsTypes=regularSeason&hydrate=team,division,league`

### 📊 Stats
**Purpose:** Team roster stats and player leaders
**Contents:**
- **Leaders panel** — dropdown to select stat (AVG, HR, RBI, OPS, ERA, WHIP etc.), hitting/pitching tabs. Ranked top 10 players. Clicking a player loads their stats. Source: cached from roster stat calls
- **Roster list** — active roster with hitting/pitching/fielding tabs. Jersey number, position. No isolated scrollbar — flows with page. Clicking loads player stats. Source: `/teams/{id}/roster`
- **Player Stats panel** — full stat grid for selected player. Hitting (12 stats), Pitching (12 stats), Fielding (6 stats). Source: `/people/{id}/stats`
- **Column widths:** `grid-template-columns:1fr 1.2fr 1.4fr` — Leaders narrowest, Player Stats widest

### 🌐 Around the League
**Purpose:** League-wide daily overview — all games, news, and stat leaders
**Contents:**
- **Today's Matchups** — compact 4-per-row grid of all MLB games today. Each card shows team abbreviations, W-L record in brackets, score (if live/final) or game time (if upcoming). Team color gradients. Live/Final games are clickable → routes to live game view. Source: `/schedule?sportId=1&date={today}&hydrate=linescore,team` + `/standings` for records
- **MLB News** — general MLB headlines (no team filter), top 10. Source: ESPN News API (no `team=` param)
- **Stat Leaders** — tabbed hitting/pitching. 2×2 grid, top 10 per stat. Hitting: AVG, HR, RBI, OPS. Pitching: ERA, WHIP, SO, W. Source: `/stats/leaders` with `statGroup` param
- **Caching:** leader results cached per tab in `leagueLeadersCache` — switching tabs doesn't re-fetch. Standings cached in `leagueStandingsMap` flat map of `teamId → {w, l}`

**⚠️ Known fragility — Stat Leaders index mapping:**
The `/stats/leaders` API does not return results in the same order as the requested `leaderCategories`. The app uses **index-based mapping** (position in response array → position in stats config array) rather than matching by `leaderCategory` string. The current array order in `LEAGUE_HIT_STATS` and `LEAGUE_PIT_STATS` was determined empirically by testing. If results look wrong after an API change, re-test each position and reorder the arrays accordingly.

### 📺 Media (hidden by default, toggled via Settings)
**Purpose:** Watch official team YouTube channel videos in-app
**Contents:**
- Team gradient header with team name and "Open in YouTube ↗" link
- Two-panel layout: 25% scrollable video list (left) / 75% player (right)
- Video list — up to 15 most recent videos from team's official YouTube channel. Shows thumbnail, title, date. Selected video highlighted with orange left border
- Clicking a video loads it into the player with autoplay
- On load: most recent video auto-selected
- On team switch: feed reloads automatically if Media tab is active
- **Fallback:** teams without a `youtubeUC` show MLB main channel (`UCoLrcjPV5tBJkzGBFm-6_sA`)
- **Hidden by default** — enabled via toggle in Settings panel (session only, resets on reload)
- **⚠️ file:// local testing shows Error 153** — always test Media tab on Netlify, not local file
**Source:** YouTube RSS via allorigins.win proxy → 3-attempt retry loop (1s delay between attempts) → DOMParser XML → `getElementsByTagNameNS('http://www.youtube.com/xml/schemas/2015', 'videoId')`

### 📰 News
**Purpose:** Latest team news feed
**Contents:**
- Full list of headlines from ESPN for the active team
- Each item: headline (linked), date, byline
- Manual refresh button
**Source:** ESPN News API `?team={espnId}&limit=20`

### ⚾ Live Game View (triggered from Home or Around the League)
**Purpose:** Real-time in-progress game view
**Contents:**
- **Score header** — away/home team abbreviations, current runs, inning + top/bottom indicator, LIVE badge
- **Count & Runners card** — balls (4 dots), strikes (3 dots), outs (3 dots). SVG baseball diamond with runners highlighted in team accent color
- **Current Matchup card** — current batter (name + season AVG/OBP/OPS) and pitcher (name + season ERA/WHIP)
- **Linescore card** — live inning-by-inning R/H/E
- **At Bat** — current batter name and on-deck batter
- **Refresh time** — last updated timestamp
- Manual ↻ Refresh button, auto-refresh every 5 minutes
- ← Back button returns to Home and clears interval
**Source:** `/game/{gamePk}/linescore` + `/game/{gamePk}/boxscore` (NOT feed/live — returns 404)

### ⚙️ Settings (gear icon in header)
**Purpose:** Switch active team + configure app options
**Contents:**
- Dropdown of all 30 MLB teams grouped by division
- Switching team reloads all data, reapplies theme, resets caches
- **Media Tab toggle** — slide toggle, defaults off. Shows/hides 📺 Media nav button. Redirects to Home if Media is active when toggled off. Controlled by `mediaEnabled` var + `toggleMedia()` function
- Resets to Mets on page reload (session only, no persistence)

---

## Key Functions Reference

| Function | Purpose |
|---|---|
| `applyTeamTheme(team)` | Sets CSS vars, logo, title for active team |
| `switchTeam(teamId)` | Resets all state and reloads all data for new team |
| `loadTodayGame()` | Left home card — live → upcoming today → next upcoming |
| `getSeriesInfo(g)` | Returns series string e.g. "Game 2 of 3 · Mets lead 1-0". API fields first, scheduleData fallback |
| `renderNextGame(g, label)` | Renders the left home card HTML |
| `loadNextGame()` | Right home card — finds and renders next series with upcoming games |
| `loadSchedule()` | Fetches full season, populates scheduleData, renders calendar |
| `renderCalendar()` | Draws monthly calendar grid from scheduleData |
| `selectCalGame(gamePk)` | Loads linescore + boxscore for clicked game |
| `loadStandings()` | Fetches standings, calls all four render functions |
| `loadRoster()` | Fetches active roster, splits hitting/pitching/fielding |
| `fetchAllPlayerStats()` | Batch fetches season stats for all roster players |
| `loadLeaders()` | Sorts and renders leader list from statsCache |
| `loadLeagueView()` | Orchestrates all Around the League loads |
| `loadLeagueMatchups()` | Today's all-team schedule grid |
| `loadLeagueLeaders()` | Fetches /stats/leaders, maps by index to LEAGUE_*_STATS arrays |
| `showLiveGame(gamePk)` | Hides main, shows live view, starts auto-refresh |
| `fetchLiveGame()` | Polls linescore + boxscore for live game data |
| `loadMedia()` | Builds media card HTML, calls loadMediaFeed |
| `loadMediaFeed(uc)` | Fetches YouTube RSS via allorigins proxy, 3-attempt retry |
| `gameGradient(g)` | Returns inline style string for two-team color gradient |

---

## Known Open Issues (priority order)
1. **Live game — batter/pitcher stats not caching** — season stats re-fetched on every refresh. Should cache and only re-fetch when matchup changes
2. **Live game — header text color** — score text in live header not yet using `--accent-text`, may be invisible for some teams
3. **Giants/Orioles dark-on-dark** — SF Giants (#FD5A1E primary, #27251F secondary) and Baltimore Orioles (#DF4601 primary, #27251F secondary) — secondary passes contrast check but both are dark, worth reviewing visually
4. **Dark backgrounds not team-aware** — `--dark`, `--card`, `--card2` are fixed navy/dark. Deferred to v2
5. **Badges not team-aware** — W/L (green/red), Live (red) are hardcoded. In backlog
6. **Mobile/iPad layout** — not yet reviewed or optimized
7. **News fallback** — if ESPN API blocked, no fallback. Should try MLB RSS
8. **Today's date uses local time** — fixed for EST but worth noting for other timezones
9. **Around the League leaders index mapping** — fragile, empirically derived. Document any re-ordering needed after API changes
10. **allorigins.win proxy** — no SLA, free public service. Retry logic (3 attempts, 1s gap) mitigates intermittent failures. Fallback candidates: `corsproxy.io` or self-hosted Netlify proxy
11. **Media tab — all 30 team YouTube channel IDs need QC** — visit `youtube.com/channel/{youtubeUC}` for each team to verify correct channel loads
12. **Next Game series info cold load** — `getSeriesInfo()` fallback relies on `scheduleData` being populated. On fresh page load, series info may be blank until Schedule tab is visited. API fields (`seriesGameNumber` etc.) are the primary source and don't require scheduleData.

---

## Hardcoding Risks
| Item | Risk | Fix |
|---|---|---|
| `SEASON = 2026` | Must update each season | Derive from system date or MLB API |
| Team colors in TEAMS array | Teams rebrand — colors go stale | Verify each offseason |
| ESPN team IDs | Different system from MLB IDs, manually mapped | Build dynamic mapping |
| `WC_SPOTS = 3` | Rule change risk | Already a named const — easy to update |
| ESPN API endpoint | Unofficial, undocumented | Monitor for breakage |
| MLB Stats API base URL | Unofficial | Watch for deprecation |
| Leaders `cats` array order | Index-based mapping means order matters | Re-test empirically if results look wrong |
| allorigins.win proxy URL | Free public proxy, no SLA | Monitor — swap URL if it goes down. Retry logic already in place |
| YouTube channel IDs (`youtubeUC`) | Teams may rebrand/change channels | Verify each offseason. 27 of 30 unverified — QC needed |
| Game state strings | MLB API uses both `"Preview"` and `"Scheduled"` for upcoming games | Both are checked — verify if new states appear |

---

## Feature Backlog
- [ ] Cache live game batter/pitcher stats
- [ ] Fix live header text color accessibility
- [ ] Team-aware dark backgrounds (v2)
- [ ] Team-aware W/L/Live badges
- [ ] Mobile/iPad layout optimization
- [ ] News fallback source
- [ ] Player headshots (MLB API serves them)
- [ ] Logos (deferred)
- [ ] Pitcher matchup preview on upcoming games
- [ ] Last 10 games record widget
- [ ] Dynamic season year
- [ ] QC all 30 team YouTube channel IDs
- [ ] Consider more reliable CORS proxy for YouTube RSS
- [x] Next Game / Next Series home cards — replaced Today's Game + Next Game with smarter cards
