# MLB Tracker — Project Handoff

## What This Is
A single-file HTML sports tracker app for MLB, defaulting to the New York Mets. All data is pulled live from public APIs — no build system, no dependencies beyond the push notification backend. The main app lives in `index.html`.

**Current version:** v2.4 (v1.61 was the final v1 release — v2.x began with the League Pulse merge; v2.2 merged calendar/doubleheader/PPD fixes; v2.3 merged Pulse PPD + historical status items; v2.4 merged Pulse feed ordering fixes)
**File:** `index.html` (renamed from `mets-app.html` at v1.40 for GitHub Pages compatibility)
**Default team:** New York Mets (id: 121)

---

## Workflow Rules

1. **Never assume** — always ask before proposing or touching any code
2. **Surgical edits only** — smallest possible change; do not reformat or reorganise surrounding code
3. **No changes without explicit user approval** — show old/new before applying
4. **Break changes into small steps** — confirm each works before proceeding
5. **Git branching** — all changes go to a `claude/` branch first; only merge to `main` when explicitly asked
6. **Debug code** — wrap temporary logging in `// DEBUG START` / `// DEBUG END` for easy removal
7. **Version every change** — bump both the `<title>` tag and the in-app settings panel version string on every commit. From v2.x onward: use `v2.x.y` format — increment `y` for each commit on a branch (v2.1.1, v2.1.2…); increment `x` and drop the patch on merge to main (v2.2). **Also bump `CACHE` in `sw.js`** (e.g. `mlb-v54` → `mlb-v55`) on every commit that changes app content — this forces the PWA to update for installed users.
8. **No rewrites** — never rewrite large sections. Targeted edits only.

---

## Architecture Overview

### Repo structure
```
index.html              — main app (HTML + CSS + JS, all inline)
sw.js                   — service worker (PWA caching + push event handling)
manifest.json           — PWA manifest (install metadata, icons)
icons/                  — app icons (icon-192.png, icon-512.png, icon-180.png, icon-maskable-512.png, favicon.svg, icon-mono.svg)
api/subscribe.js        — Vercel serverless: store/remove push subscriptions in Upstash Redis
api/notify.js           — Vercel serverless: check MLB schedule, fire push notifications
.github/workflows/      — notify-cron.yml: GitHub Actions cron (*/5 * * * *) pings /api/notify
                          test-push.yml: manual workflow_dispatch to fire a test push to all subscribers
api/test-push.js        — Vercel serverless: sends a test push immediately (bypasses game schedule check)
vercel.json             — Vercel function config (maxDuration)
package.json            — web-push + @upstash/redis dependencies (for Vercel functions only)
```

### Deployment
- **Static app (index.html, sw.js, manifest, icons)**: GitHub Pages — `main` branch, root directory
- **Push API (`/api/*`)**: Vercel Hobby — `https://baseball-app-sigma.vercel.app`
- **Cron trigger**: GitHub Actions (free) pings `/api/notify` every 5 minutes

### Single file, all inline
Everything — HTML, CSS, JavaScript — is in `index.html`. No imports, no modules, no external scripts for the app itself. Edit the file, push to branch, done.

### Key global state
```javascript
const SEASON = 2026                    // hardcoded — update each season
const MLB_BASE = 'https://statsapi.mlb.com/api/v1'
const MLB_BASE_V1_1 = 'https://statsapi.mlb.com/api/v1.1'  // Pulse only — v1 timestamps path 404s
const TEAMS = [...]                    // 30 teams with colors, IDs, YouTube channel IDs

let activeTeam = TEAMS.find(t => t.id === 121)   // defaults to Mets
let scheduleData = []                  // populated by loadSchedule() or cold-load ±7 day fetch
let scheduleLoaded = false             // true only after full-season fetch completes
let rosterData = { hitting, pitching, fielding }
let statsCache = { hitting, pitching }
let selectedPlayer = null              // full roster object — includes person, position, jerseyNumber (jerseyNumber is null when loaded from team stats endpoint)

// ── ⚡ Pulse globals ──────────────────────────────────────────────────────────
let pulseMockMode    = false           // persisted to localStorage('mlb_pulse_mock')
let pulseInitialized = false           // lazy-init guard — set true on first Pulse nav
let gameStates       = {}             // gamePk → { awayAbbr, homeAbbr, awayPrimary, homePrimary,
                                      //   awayScore, homeScore, status, detailedState,
                                      //   inning, halfInning, outs, playCount, lastTimestamp,
                                      //   gameTime, gameDateMs, venueName, onFirst, onSecond, onThird }
let feedItems        = []             // all feed items newest-first (never pruned)
let enabledGames     = new Set()      // gamePks whose plays are visible in the feed
let mockPlayPtrs     = {}, mockGameQueue = [], mockTimerId = null
let mockSpeedMs      = 6000, totalMockPlays = 0, playedMockPlays = 0
let countdownTimer   = null, alertId = 0, isFirstPoll = true, pollDateStr = null
let soundSettings    = { master:false, hr:true, run:true, risp:true,
                         dp:true, tp:true, gameStart:true, gameEnd:true, error:true }
```

### Navigation
`showSection(id, btn)` — shows/hides sections by toggling `.active` class. Nav order: `home`, `pulse`, `league`, `schedule`, `news`, `standings`, `stats`, `media`. Live game view is a separate overlay (`#liveView`), not a section. **Calling `showSection` while the live view is active automatically closes it first.**

`pulse` is lazy-initialised: `initLeaguePulse()` fires only on the first navigation to the section via a `pulseInitialized` guard inside `showSection`. The sound panel click-outside handler is also registered at that point.

### Team theming
`applyTeamTheme(team)` sets nine CSS variables dynamically:

| Variable | Value |
|---|---|
| `--primary` | Team primary colour — header, active nav |
| `--secondary` | Team accent — secondary if contrast ≥ 3:1 AND luminance ≥ 0.05, else `#ffffff` |
| `--accent-text` | Text ON `--secondary` surfaces — black or white based on luminance |
| `--dark` | Page background — hsl(teamHue, 50%, 18%) |
| `--card` | Card background — hsl(teamHue, 45%, 22%) |
| `--card2` | Secondary card / input — hsl(teamHue, 40%, 26%) |
| `--border` | Borders — hsl(teamHue, 35%, 30%) |
| `--accent` | Contrast-safe accent for text/borders on dark surfaces — raw secondary if lum≥0.18 && contrast≥3.0 on --card, else HSL-lightened to L=65%, else #FFB273 |
| `--header-text` | Text colour on header gradient — #0a0f1e if primary luminance > 0.5, else #ffffff |

**Accent luminance floor:** if the computed accent has luminance < 0.05 (near-black, e.g. Giants/Orioles secondary `#27251F`), it is forced to `#ffffff`.

**Split-brain rule:** on-dark accent text and borders use `--accent`; solid brand fills use `--secondary`.

**Theme persistence (T32):** `applyTeamTheme` writes `{--dark, --card, --card2, --border, --primary, --secondary, --accent, --accent-text, --header-text}` to `localStorage.mlb_theme_vars`. An inline `<script>` in `<head>` reads and applies these vars before `<style>` renders, preventing flash-of-wrong-theme on reload.

**Linescore table first-column width:** `.linescore-table td:first-child{min-width:36px}` — global default (all screen sizes). Team abbreviations (MIN/NYM) fit in 36px; player-name columns in boxscore tables are held wider by their `<th min-width:130px>` inline style.

**Responsive breakpoints** (single `@media` block at end of `<style>`):
- `≤1024px` (iPad landscape + portrait): `.grid3` and `.live-grid` collapse to 1 column; `.matchup-grid` goes 3→2 cols; header wraps; `.main` padding reduced to 12px
- `≤1024px and ≥481px` (tablet band only): header `flex-wrap:nowrap` (prevents wrapping bug); `.logo span` hidden (SVG stays); nav icon-only (`.nav-label` hidden); `.settings-wrap` flex-shrink:0 stays right-aligned; header position:sticky
- `≤767px` (portrait / phone): `.grid2` also collapses to 1 column; `.card-cap` shrinks to 40px; `.series-ghost` shrinks to 220px
- `≤480px` (iPhone): `html,body{overflow-x:hidden}` prevents page-level horizontal scroll (both required — iOS Safari has independent scroll contexts for `html` and `body`); nav becomes fixed bottom bar with short labels visible (`.nav-label` shown at 9.5px); nav bg is `color-mix(--primary 94%)` with backdrop-blur and soft 1px border-top; active state uses accent top-underline (`inset 0 2px 0 var(--accent)`); safe-area inset bottom padding; `.team-chip` hidden; header `position:static` scrolls away; `.game-big{padding:16px}` (down from 24px — gives content more room on narrow screens); `.live-view` side padding zeroed (`padding-left:0;padding-right:0`) — inner wrapper div already provides `padding:20px`, removing the duplicate outer padding that made the live score too tight; `.ng-grid{gap:8px}`, `.ng-name{font-size:18px}`, `.ng-score{font-size:26px}` — shrinks the 5-column Next Game card grid on narrow viewports (long team names like "Atlanta Braves" at 26px bold overflowed on 375–390px phones); `.stat-grid` → 2-col; `.game-notes-grid`, `.media-layout`, `.league-leaders-grid` → 1-col; `.card` padding 12px; `.cal-day` min-height 44px, `.cal-game-info` hidden, `.cal-dot` shown; `.main` and `.live-view` get `padding-bottom:calc(72px + env(safe-area-inset-bottom))`; **Live game mobile fixes (v1.45.2–4):** `.live-score{gap:24px}` (down from 48px); `.live-team-score{font-size:2.2rem}` (down from 3rem); `.matchup-stats` and `.play-log-entry` get `word-break:break-word`; `.boxscore-wrap{padding:10px}`; **Matchup day controls (v1.60):** `.matchup-day-controls .refresh-label{display:none}` — hides "Refresh" text leaving only the ↻ icon; `.matchup-day-controls .refresh-btn{min-width:36px}` for adequate touch target without overflowing the row

**Layout utility classes:**
- `.grid2` — 2-column grid, 1fr 1fr, 16px gap. Collapses at 767px.
- `.grid3` — 3-column grid, 1fr 1fr 1fr, 16px gap. Collapses at 1024px. (Stats section)
- `.matchup-grid` — 3-column grid, repeat(3,1fr), 8px gap. Goes 2-col at 1024px, 1-col at 480px. (League matchups)
- `.live-grid` — unequal 3-col (1fr 1.2fr 1.4fr). Collapses at 1024px. (Live game view)
- `.live-card` — card inside `.live-grid`. Has `min-width:0` (required — grid items default to `min-width:auto`, which lets table content push the track wider than `1fr` and break the layout on mobile)
- `.media-layout` — 25%/75% grid for media tab (video list + player). Collapses to 1-col at 480px.
- `.league-leaders-grid` — 2-col grid for league leader panels. Collapses to 1-col at 480px.
- `.nav-label` — wraps nav button text. Visible at ≤480px at 9.5px (labels: Home/Pulse/League/Schedule/News/Standings/Stats/Media). Hidden at ≤1024px tablet band (icons only).
- `.team-chip` — static team name pill in header between logo and nav. Shown at ≥481px, hidden at ≤480px. Updated by `applyTeamTheme`. Not a dropdown — no click handler.
- `.matchup-card` — subtle card surface inside matchup grid: rgba(0,0,0,.18) bg, 1px solid rgba(255,255,255,.05) border, 8px radius. :hover darkens slightly. Replaces per-card team gradient.
- `.card-cap` — 56px team logo img used in home cards. Shrinks to 40px at ≤767px.
- `.series-ghost` — 300px absolutely-positioned ghosted opp logo in Next Series card, opacity .12. Shrinks to 220px at ≤767px.
- `.sub-kicker` — secondary label utility: .68rem, weight 700, .1em letter-spacing, var(--muted) colour.
- `.stat-box.hero` — first stat in each group spans 2 columns, `.stat-val` at 2.2rem.
- `.ng-grid` / `.ng-name` / `.ng-score` — classes on the 5-column Next Game card grid container, team name divs, and score divs respectively. Used only by the ≤480px media query to shrink font sizes on narrow phones (18px name, 26px score). Not styled at larger breakpoints.

**Rule:** All layout grids must use CSS classes, not inline `style=` grid definitions — so the `@media` block can override them without touching HTML.

**Fixed neutrals** (not team-aware):
- `--text: #e8eaf0` — body text
- `--muted: #9aa0a8` — muted/secondary text

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
| `/game/{pk}/playByPlay` | ✅ | Completed at-bat log for live/finished games. Returns `allPlays[]`, `scoringPlays[]`, `playsByInning[]`. Use this for play-by-play display — lighter than feed/live. |
| `/game/{pk}/feed/live` | ⚠️ | **v1 path 404s.** Use `v1.1` (`statsapi.mlb.com/api/v1.1/game/{pk}/feed/live`) — returns full GUMBO object (plays + linescore + boxscore in one call). Large payload (~500KB). Companion endpoints: `/feed/live/timestamps` and `/feed/live/diffPatch` for efficient polling. |
| `/api/v1.1/game/{pk}/feed/live/timestamps` | ✅ | **Pulse only.** Returns array of timestamp strings; last element = most recent state change. Compare to stored `g.lastTimestamp` — if unchanged, skip the playByPlay fetch. **Must use `MLB_BASE_V1_1` — v1 path returns 404.** |
| ESPN News API | ⚠️ | Unofficial, may be CORS-blocked in some browsers |
| YouTube RSS via allorigins.win | ⚠️ | Public proxy, no SLA. 3-attempt retry in place. Media tab only. |

**Game state strings:**
- `abstractGameState`: `"Live"`, `"Final"`, `"Preview"`, `"Scheduled"` — both `Preview` and `Scheduled` mean upcoming; both are checked
- Use `abstractGameState` (reliable). `detailedState` is more granular but less stable.
- **Warmup exclusion (v1.61):** `abstractGameState` becomes `"Live"` ~20–30 min before first pitch (during warmup). The code now excludes `detailedState === 'Warmup'` and `detailedState === 'Pre-Game'` from all live-game logic — these states are treated as upcoming instead. Applied in `loadTodayGame`, `renderCalendar`, and `loadLeagueMatchups`.
- **Postponed/Cancelled/Suspended (v2.2):** A `detailedState` of `'Postponed'`, `'Cancelled'`, or `'Suspended'` on a `Final` game means no score was recorded. These are treated as PPD throughout — calendar shows a grey `PPD` badge (not `L undefined-undefined`), Pulse ticker shows `PPD` instead of `FINAL`, `selectCalGame` renders a Postponed info card instead of fetching the linescore, and Pulse fires 🌧️ "Game Postponed" instead of 🏁 "Game Final".

---

## CSS Variables Quick Reference
```css
--primary       /* team primary — header, active nav */
--secondary     /* team accent — highlights, badges, card titles */
--accent        /* contrast-safe accent for text/borders on dark — computed per-team */
--header-text   /* text on header gradient — #0a0f1e or #ffffff based on primary luminance */
--accent-text   /* text ON --secondary surfaces */
--dark          /* page background */
--card          /* card background */
--card2         /* secondary card / input background */
--border        /* borders */
--text          /* #e8eaf0 — body text (fixed) */
--muted         /* #9aa0a8 — secondary text (fixed) */

/* ⚡ Pulse-specific (added v2.1) */
--header-h      /* 60px — used by Pulse ticker sticky offset and soundPanel top position */
--ticker-h      /* 50px — min-height of #gameTicker */
--mockbar-h     /* 48px — height of #mockBar */
--radius        /* 10px — shared border-radius for Pulse cards */
--scoring-bg / --scoring-border   /* green tint for scoring play feed items */
--hr-bg / --hr-border             /* amber tint for home run feed items */
--risp-accent                     /* yellow — left border stripe on RISP feed items */
--status-bg / --status-border     /* blue tint for status-change feed items */
```

---

## App Pages & Sections

### 🏠 Home
**Left card — "Next Game"** (`#todayGame`, `loadTodayGame()`)
Priority order: (1) live game today → score + "▶ Watch Live" button + inline `▼ 9 · ● LIVE` inning indicator (no red pill), (2) upcoming game today → "TODAY" label + time, (3) next upcoming game → date label.

Series info below via `getSeriesInfo(g)`:
- Tries API fields first: `seriesGameNumber`, `gamesInSeries`, `seriesSummary.seriesStatus`
- If `seriesStatus` is null (common for live games), falls through to compute record from `scheduleData`
- On cold load, `loadTodayGame` fetches a ±7 day schedule window to populate `scheduleData` before rendering, so series record is available immediately without visiting the Schedule tab
- Shows: `"Game 2 of 3 · Mets lead 1-0"`

Layout is a 5-column inline row — [opp cap] [opp name/score] [—] [my name/score] [my cap]. Cap logos from `mlbstatic.com/team-logos/{teamId}.svg` with `onerror` fallback SVG. Status kicker (TODAY/date) centred at top; series info left + Watch Live button right in bottom row. Handles live (with scores), upcoming (no scores, date-time right), and final states.

Background is a 3-stop gradient: **opp primary → #111827 50% → active-team colour** — opponent colour always on the left (matching opp name position), active team colour always on the right (matching my team position). This is built directly from `oppD.primary`/`myD.primary` in `renderNextGame`, NOT via `gameGradient()` (which uses away→home order and would be wrong when the active team is away). Active team colour respects both settings: uses `secondary` instead of `primary` when `themeInvert` is on, and uses `themeOverride` team colours when a colour theme override is set (matching `applyTeamTheme` logic). Same invert/override logic applies to the Next Series card gradient.

**Right card — "Next Series"** (`#nextGame`, `loadNextGame()`)
- Fetches 28 days of schedule; groups games into series (same opponent + same venue + within 4 days)
- Finds the **second** series with any non-Final game (i.e. the series after the current/active one, not the current one)
- 3-stop gradient (opp-primary → #111827 55% → active-team-primary). Large ghosted opp logo (300px, opacity:.12, position:absolute bottom-right). Main row: 64px cap + VS/AT kicker / opponent name at 40px weight-900 / venue + game count. Below: 3-column game strip (day abbrev + time per cell) replacing stacked rows. Opponent name colour guarded by `pickHeaderText(oppPrimary)` for light-primary teams.

**Division Snapshot** — compact standings for active team's division. Source: `/standings`

**Latest News** — top 5 ESPN headlines. Source: ESPN News API

---

### 📅 Schedule
Monthly calendar grid (Sun–Sat), navigable with ◀ ▶ arrows. Today highlighted.

`scheduleLoaded` flag controls whether `loadSchedule()` is called on tab visit. This flag was introduced because `scheduleData` can be pre-populated by the cold-load ±7 day fetch, which previously prevented the full season from ever loading.

**Doubleheaders (v2.2):** `renderCalendar` uses `gamesByDate` (array per date, sorted by gamePk) instead of the former single-game `gameByDate`. Cells with two games show a `DH` badge next to the opponent name and stacked `G1:` / `G2:` rows, each independently clickable. The outer cell onclick is suppressed for DH cells; individual row `onclick` uses `event.stopPropagation()`. Mobile dot logic: live > all-W > all-L > split/PPD/upcoming.

**Mobile calendar (≤480px):** cells show day number + colour-coded dot only (`.cal-dot`: green=W, red=L, pulsing red=Live, accent=upcoming/PPD/split). Tapping a game cell shows a fixed-position `.cal-tooltip` above the cell with opponent, short date, and result/time/PPD badge — data from `scheduleData`, no API call. Tooltip dismisses on tap outside. The `#gameDetail` panel below the calendar is also populated with full boxscore/linescore/game info (same as desktop).

**Clicking a completed game** (desktop) expands detail panel:
- Boxscore — tabbed by team. Batting (AB, H, R, RBI, BB, K, HR) and Pitching (IP, H, R, ER, BB, K, HR, PC). Only players with AB > 0 or IP > 0.
- Linescore — inning-by-inning R/H/E. R/H/E cells use `!=null` guards (not just truthy) to avoid showing `undefined` for partial-data games.
- Game Summary — all `bs.info` label/value pairs (WP, weather, attendance, umpires). Duration shown as `"T"` label.

**Clicking a postponed/cancelled/suspended game** shows a Postponed info card (status + venue) — no linescore fetch attempted.

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

**Player Stats panel** — updates title to the selected player's name. Shows player headshot (100px wide, fixed 130px height placeholder to prevent layout shift; Cloudinary fallback to generic silhouette) with jersey number overlay pill; then full stat grid: Hitting (12 stats, 4-col), Pitching (12 stats, 4-col), Fielding (6 stats, 3-col). First stat per group gets `.hero` class — spans 2 columns, stat value at 2.2rem. Source: `/people/{id}/stats`; headshots from `img.mlbstatic.com`.

Source: `/teams/{id}/roster?rosterType=40Man` + `/people/{id}/stats` (via `fetchAllPlayerStats` for cache, individual fetch on click)

---

### 🌐 Around the League
- **Matchups** — all MLB games, 3-per-row grid. Day toggle (Yesterday | Today | Tomorrow) above the grid switches the date; active pill uses `--secondary`. Switching days fades existing content to opacity 0.3 (no layout jump) then fades new content in via `requestAnimationFrame`. State tracked in `leagueMatchupOffset` (-1/0/1); resets to 0 (Today) each time the League tab is opened. Each cell is a `.matchup-card` with subtle surface (no per-card team gradient). Live games show inning (e.g. `"● LIVE · Top 5"`). Clickable → live game view. Source: `/schedule?sportId=1&date={date}&hydrate=linescore,team` + standings for records
- **MLB News** — MLB-wide headlines, no team filter. Source: ESPN News API
- **Stat Leaders** — hitting/pitching tabs, 2×2 grid, top 10 per stat. Source: `/stats/leaders` with `statGroup` param

⚠️ **Leaders index mapping is fragile** — the API does not guarantee response order matches requested `leaderCategories` order. App uses index-based mapping. If results look wrong after an API change, re-test each position empirically.

---

### ⚡ Pulse
Global live MLB play-by-play feed — aggregates every scoring play, home run, and RISP moment across all simultaneous games in one chronological stream. Lazy-loaded on first nav to the section.

**HTML structure (`#pulse` section):**
- `#soundPanel` — `position:fixed` floating overlay, hidden by default; triggered by `🔊 Configure` in Settings
- `#alertStack` — `position:fixed` toast stack for HR/run alerts
- `#gameTicker` — `position:sticky` below header; horizontal scrollable chip bar
- `#mockBar` — inline (not fixed); shown only when `pulseMockMode` is true
- `#feedWrap > #feedEmpty + #feed` — empty/upcoming state and live play items

**Ticker bar:** All games as scrollable horizontal chips. Sorted: Live (most-progressed inning first) → Preview/Scheduled (by `gameDateMs` asc) → Final (dimmed). Each chip shows away score · home score · inning or start time. Final games with `detailedState` Postponed/Cancelled/Suspended show `PPD` instead of `FINAL`. Clicking a chip toggles that game's plays in the feed (`enabledGames` Set). When a live game has a runner on 2nd or 3rd (`g.onSecond || g.onThird`), the chip expands to a 2-row layout with a 28×24px base diamond SVG (`baseDiamondSvg()`).

**Feed:** Newest plays at top. Each item shows: coloured team dots + score (meta row), inning + outs, play description, play-type badge (1B/2B/3B/BB/K/E/DP/TP), ⚡ RISP badge, and score badge on scoring plays (scoring side full brightness). Play classification drives visual treatment: `homerun` (amber tint), `scoring` (green tint), `risp` (yellow left stripe), `status-change` (blue tint, centred — game start/end/delay).

**Empty state:** When no visible plays exist, `renderEmptyState()` renders a hype block + hero upcoming-game card (3-stop gradient, team caps, countdown timer via `startCountdown()`) + 2-col grid for remaining games. Falls back to plain `⚾ League Pulse` placeholder off-season.

**Mock mode:** Controlled by `pulseMockMode` (toggle in Settings, persisted to `localStorage('mlb_pulse_mock')`). `MOCK_DATA` contains 4 games (NYM@ATL, NYY@BOS, LAD@SF, HOU@TEX) with ~55 scripted plays. Round-robin engine (`mockTick()`) advances one play per tick across games. Mock bar (Normal/Fast/Skip/Reset controls) is inline below the ticker.

**Live mode:** `pollLeaguePulse()` fetches all games every 15s. Game-start fires only when `detailedState` transitions to `'In Progress'` (not on warmup). Timestamps stale check (`/api/v1.1/game/{pk}/feed/live/timestamps`) skips the playByPlay fetch when nothing has changed. On first poll, all pre-existing plays load as history with no alerts or sounds (`isHistory` flag), then sorted chronologically across games.

**Historical status items (v2.2/v2.3):** When a game is first added to `gameStates` (initial creation path), a status feed item is synthesised silently based on current state — no sounds or alerts:
- `Final` (non-PPD) → 🏁 "Game Final · AWAY X, HOME Y · Zh Mm" — deferred to `pendingFinalItems`; plays are also fetched for the completed game; item is added at `lastPlay.ts + 60s` so it sorts after the final recorded play. Omitted entirely if no plays are found.
- `Final` + PPD → 🌧️ "Game Postponed" — `playTime` = `gameDateMs`. Suppressed if `Date.now() < gameDateMs` (postponement announced before scheduled start — ticker chip still shows PPD immediately).
- `Live` + `In Progress` → ⚾ "Game underway!" — `playTime` = `gameDateMs`
- `detailedState` contains `'delay'` → 🌧️ "Game Delayed" — `playTime` = `gameDateMs`

These items are only ever added once (subsequent polls use the update path). `pendingFinalItems` games are included in the `pollGamePlays` pass so plays are fetched before the Final item is positioned.

**Feed sort order (v2.3):** `addFeedItem` maintains newest-first order on every insert — both in the `feedItems` array and in the DOM via `data-ts` attributes on each element. Late-arriving plays (old timestamp received in a later poll) are inserted at the correct chronological position instead of floating to the top.

**Sound alerts:** Web Audio API synthesized tones — no external files. Master defaults off. Events: HR (bat crack), Run (bell chime), RISP (heartbeat), DP (glove pops), TP (bugle fanfare), Game Start (organ riff), Game End (descending chime), Error (dirt thud). `playSound(type)` is the single call point — checks `soundSettings.master && soundSettings[type]`.

**Migration notes:** League Pulse was built as standalone `league-pulse.html` (~2370 lines) then merged into `index.html`. Key changes on merge: `mockMode`→`pulseMockMode`, `init()`→`initLeaguePulse()`, `poll()`→`pollLeaguePulse()`; `TC` object replaced by `tcLookup(id)` (wraps `TEAMS.find`, uses `t.short` for abbr); all 6 colour utilities and `applyLeaguePulseTheme()` dropped (index.html copies used); standalone header dropped; mock bar changed from `position:fixed;bottom:0` to inline; sound/mock controls moved into Settings panel.

Source: `/schedule?sportId=1&date={date}&hydrate=linescore,team` + `/game/{pk}/playByPlay` + `/api/v1.1/game/{pk}/feed/live/timestamps`

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

- **Score header** — team abbreviations, current runs, and status line. Status is fetched via `/schedule?gamePk={pk}` (bundled in the same `Promise.all` as linescore + boxscore): `abstractGameState === 'Final'` → shows `FINAL`, stops auto-refresh interval, sets timestamp to "Game Final"; otherwise shows inning indicator + `● LIVE` badge. This means the live view correctly labels completed games opened from Yesterday's matchups.
- **Count & Runners** — balls/strikes/outs dots, SVG diamond with runners in team accent colour
- **Current Matchup** — batter (name + AVG/OBP/OPS) and pitcher (name + ERA/WHIP + today's game line: IP/H/ER/K/PC from boxscore)
- **Linescore** — live inning-by-inning R/H/E
- **Play Log** — every completed at-bat for the whole game, grouped by inning half, most recent first. Scoring plays highlighted in `--accent` with score badge (e.g. `🔴 Pete Alonso homers … · 3-2`). Fetched separately from `playByPlay` endpoint on each refresh.
- **Box Score** — tabbed away/home batting and pitching tables
- **Game Info** — weather, attendance, umpires from `bs.info`
- **Last updated timestamp** at bottom
- Auto-refresh every 5 minutes; manual ↻ Refresh button
- ← Back returns to Home; nav buttons also close the live view

Source: `/game/{gamePk}/linescore` + `/game/{gamePk}/boxscore` + `/game/{gamePk}/playByPlay` (v1 path — do NOT use `feed/live` v1, it 404s)

---

### ⚙️ Settings
- **Select Team** — dropdown of all 30 MLB teams grouped by division; switching reloads all data, reapplies theme, resets all caches
- **Color Theme** — dropdown of all 30 teams + "Default (Follow Team)"; overrides colours independently of the active team; persists across team switches
- **Invert Colours** — slide toggle; swaps primary and secondary colours; works with theme override
- **Media Tab** — slide toggle, defaults off; shows/hides Media section in nav
- **⚡ Pulse: Mock Mode** — slide toggle (`id="pulseMockToggle"`); calls `togglePulseMockMode()`; persisted to `localStorage('mlb_pulse_mock')`; initialised in startup IIFE
- **⚡ Pulse: Sound Alerts** — `🔊 Configure` button (`id="btnSound"`); calls `toggleSoundPanel()` to show/hide the floating `#soundPanel` overlay; `id` preserved so click-outside-to-dismiss handler still works
- Panel closes on click outside
- All settings persist across page reloads via `localStorage` (team, theme, invert, media tab, pulse mock mode)
- Version number at bottom

---

## Key Functions Reference

| Function | Purpose |
|---|---|
| `applyTeamTheme(team)` | Sets 9 CSS vars (--primary, --secondary, --accent, --header-text, --accent-text, --dark, --card, --card2, --border), persists to localStorage.mlb_theme_vars, updates logo, page title, theme-color meta, and `.team-chip` text |
| `switchTeam(teamId)` | Resets all state and reloads all data for new team |
| `loadTodayGame()` | Left home card — fetches ±7 day window on cold load for series record |
| `getSeriesInfo(g)` | Returns series string e.g. `"Game 2 of 3 · Mets lead 1-0"`. API desc first, scheduleData fallback |
| `renderNextGame(g, label)` | Renders the left home card HTML |
| `loadNextGame()` | Right home card — finds and renders series after the current one |
| `loadSchedule()` | Fetches full season, sets `scheduleLoaded=true`, renders calendar |
| `renderCalendar()` | Draws monthly calendar grid from scheduleData. Uses `gamesByDate` (array per date) to support doubleheaders — DH cells show G1/G2 rows each independently clickable. PPD/Cancelled/Suspended games show grey `PPD` badge. |
| `changeMonth(dir)` | Navigates calendar month, calls renderCalendar |
| `selectCalGame(gamePk, evt)` | On mobile (≤480px): shows `.cal-tooltip` above tapped cell with opponent/date/result/PPD badge from `scheduleData` (no API call), then falls through to populate `#gameDetail`. On desktop: loads linescore + boxscore into `#gameDetail` panel. Postponed/Cancelled/Suspended games render a Postponed info card and return early — no linescore fetch. |
| `buildBoxscore(players)` | Global — builds batting + pitching tables from boxscore players object. Used by both historical and live game views |
| `switchBoxTab(bsId, side)` | Switches active tab in a boxscore panel |
| `loadStandings()` | Fetches standings, calls all four render functions |
| `loadRoster()` | Fetches 40-man roster from `/teams/{id}/roster?rosterType=40Man`; splits hitting/pitching/fielding, auto-selects first hitter |
| `fetchAllPlayerStats()` | Fetches season stats for all roster players in parallel; populates `statsCache` for the Leaders panel |
| `loadLeaders()` | Sorts and renders team leader list from statsCache |
| `switchRosterTab(tab, btn)` | Switches roster tab, auto-selects first player of new tab |
| `selectPlayer(id, type)` | Looks up full player object from rosterData, updates card title, fetches and renders season stats |
| `renderPlayerStats(s, group)` | Renders stat grid with player position subtitle. 4-col for hitting/pitching, 3-col for fielding. Uses `fmtRate` for AVG/OPS/FPCT; ERA at 2dp; K/BB, K/9, BB/9 at 2dp; WHIP at 3dp. |
| `loadLeagueView()` | Orchestrates all Around the League loads |
| `loadLeagueMatchups()` | All-team schedule grid for the selected day (offset -1/0/1); fades content via opacity instead of replacing with a spinner to avoid layout jump |
| `switchMatchupDay(offset, btn)` | Sets `leagueMatchupOffset`, updates active pill + `#matchupDayLabel`, calls `loadLeagueMatchups()` |
| `loadLeagueLeaders()` | Fetches /stats/leaders, maps by index to LEAGUE_*_STATS arrays |
| `showLiveGame(gamePk)` | Hides main, shows live view, starts auto-refresh |
| `fetchLiveGame()` | Polls linescore + boxscore + `/schedule?gamePk=` (one `Promise.all`); shows FINAL header and stops interval for completed games, otherwise shows inning + LIVE badge. Calls `fetchPlayByPlay()` on each refresh. |
| `fetchPlayByPlay()` | Fetches `/game/{gamePk}/playByPlay`; renders completed at-bat log grouped by inning half into `#livePlayByPlay`. Scoring plays highlighted. Silent no-op on error. |
| `closeLiveView()` | Clears refresh interval, hides live view, restores main |
| `showSection(id, btn)` | Switches sections; calls closeLiveView() first if live view is active |
| `loadMedia()` | Builds media card HTML, calls loadMediaFeed |
| `loadMediaFeed(uc)` | Fetches YouTube RSS via allorigins proxy, 3-attempt retry |
| `gameGradient(g)` | Returns inline style string for two-team colour gradient (away primary → #111827 → home primary). Used by `renderGameBig` (schedule/history cards). **Not** used by `renderNextGame` — that card builds its own layout-aware gradient so opponent is always left and active team always right. |
| `hueOf(hex)` | Extracts HSL hue (0–360) from a hex colour string |
| `hslHex(h, s, l)` | Converts HSL values to hex colour string |
| `relLuminance(hex)` | WCAG relative luminance of a hex colour |
| `contrastRatio(hexA, hexB)` | WCAG contrast ratio between two hex colours |
| `hslLighten(hex, targetL)` | Keep hue/sat, push L to targetL (0–1) |
| `fmt(v, d)` | Formats a numeric stat to `d` decimal places (default 3); returns `—` for null/empty |
| `fmtRate(v, d)` | Like `fmt` but strips the leading zero for values between 0 and 1 — e.g. `.312` not `0.312`. Use for AVG, OBP, OPS, FPCT. |
| `pickAccent(secondaryHex, cardHex)` | Returns contrast-safe `--accent` value for a team |
| `pickHeaderText(primaryHex)` | Returns `#0a0f1e` or `#ffffff` for header text |
| `capImgError(el, primary, secondary, letter)` | `onerror` handler — swaps broken logo img to fallback SVG circle |
| `teamCapImg(teamId, name, primary, secondary, cls)` | Returns `<img>` tag for team cap logo with fallback |
| `selectLeaderPill(group, stat, btn)` | Sets leader stat select + active pill, calls `loadLeaders()` |
| `togglePush()` | Reads current push state, calls subscribe or unsubscribe, updates toggle UI |
| `subscribeToPush()` | Registers push subscription via PushManager, POSTs to `/api/subscribe`, saves `mlb_push` to localStorage |
| `unsubscribeFromPush()` | Unsubscribes PushManager, DELETEs from `/api/subscribe`, removes `mlb_push` from localStorage |
| `urlBase64ToUint8Array(b64)` | Converts VAPID public key from URL-safe base64 to Uint8Array for PushManager |
| `tcLookup(id)` | Returns `{ primary, abbr, name }` for a team ID by wrapping `TEAMS.find()`; replaces the standalone `TC` object from the League Pulse prototype. `abbr` maps to `t.short`. |
| `initLeaguePulse()` | Pulse entry point — calls `initMock` or `initReal` based on `pulseMockMode` |
| `switchMode(toReal)` | Tears down all Pulse state, resets DOM, calls `updatePulseMockToggleUI()`, then `initMock` or `initReal` |
| `togglePulseMockMode()` | Flips `pulseMockMode`, persists to localStorage, updates Settings toggle UI, calls `switchMode` if already initialised |
| `updatePulseMockToggleUI()` | Updates Settings panel toggle knob position and background for mock mode state |
| `initMock()` | Shows mock bar, populates `gameStates` from `MOCK_DATA` via `tcLookup`, sets `enabledGames`, starts mock tick |
| `initReal()` | Hides mock bar, calls `pollLeaguePulse()`, sets 15s poll interval |
| `pollLeaguePulse()` | Fetches schedule, updates `gameStates` (incl. `detailedState`, base runners), fires game-start/delay/final/postponed events. On initial game creation synthesises historical status items (no sounds). Runs `Promise.all(pollGamePlays)` for live games **and** completed games with pending Final items; positions 🏁 item after last play. Sorts feed on first poll. |
| `pollGamePlays(gamePk)` | Timestamps stale check → if changed, fetches `/playByPlay`, uses `isHistory` flag to suppress alerts/sounds for pre-existing plays |
| `renderTicker()` | Sorts `gameStates` and rebuilds sticky ticker HTML; expanded RISP chip with base diamond SVG when `g.onSecond \|\| g.onThird` |
| `updateHeader()` | No-op stub — call sites retained in mock/poll loops but body is empty (controls bar was removed) |
| `baseDiamondSvg(on1,on2,on3)` | Returns 28×24px inline SVG diamond; occupied bases lit amber with glow |
| `startCountdown(targetMs)` | 30s interval updating `#heroCountdown` with "First pitch in Xm" / "Starting now" |
| `toggleGame(gamePk)` | Adds/removes gamePk from `enabledGames`, applies `feed-hidden` to DOM items, calls `updateFeedEmpty` + `renderTicker` |
| `addFeedItem(gamePk, data)` | Inserts item into `feedItems` array and DOM in correct newest-first position (via `data-ts` attribute lookup); applies `feed-hidden` if game is disabled |
| `buildFeedEl(item)` | Builds DOM element for a feed item — status-change items (game start/end/delay) or play items (with play-type badge, RISP badge, score badge) |
| `updateFeedEmpty()` | Checks for visible feed items; calls `renderEmptyState()` if none; shows/hides `#feedEmpty` |
| `renderEmptyState()` | Renders hype block + hero upcoming-game card (gradient, caps, countdown) + 2-col grid, or plain placeholder if no upcoming games |
| `showAlert(opts)` | Creates and stacks a `position:fixed` toast; auto-dismisses after `opts.duration` ms |
| `dismissAlert(el)` | Adds `.dismissing` class, removes element after 300ms transition |
| `mockTick()` | Advances one play in round-robin order across `mockGameQueue`; marks remaining Live games Final when all plays exhausted |
| `advanceMockGame(pk, play)` | Applies one mock play to `gameStates`, calls `addFeedItem`, fires alerts and sounds |
| `setMockSpeed(ms, btn)` | Updates `mockSpeedMs`, restarts mock tick interval |
| `resetMock()` | Clears all Pulse state and re-calls `initMock()` |
| `toggleSoundPanel()` | Shows/hides `#soundPanel` overlay |
| `setSoundPref(key, val)` | Updates `soundSettings[key]`; master toggle also applies `.master-off` to `#soundRows` |
| `playSound(type)` | Checks `soundSettings.master && soundSettings[type]`, calls appropriate `playXxxSound()` |
| `_makeCtx()` / `_closeCtx()` / `_osc()` / `_ns()` | Web Audio primitives — shared by all Pulse sound functions |

---

## PWA & Push Notifications (added v1.40)

### PWA
- `manifest.json` — `display: standalone`, `start_url: "./"`, `scope: "./"` (relative paths required for GitHub Pages subdirectory)
- `sw.js` — install caches app shell (`./`, `./manifest.json`, `./icons/*`); activate cleans old caches; fetch handler is cache-first for same-origin; push and notificationclick handlers
- **All paths in manifest, sw.js, and `<head>` are relative** (no leading `/`) — GitHub Pages serves the app at `/Baseball-App/` so absolute paths break
- `applyTeamTheme()` updates `<meta name="theme-color">` with the active team primary colour
- Icons: Diamond design (top-down baseball field, navy `#0F1B33` bg, warm `#E85D1F` accent). Files: `icon-512.png` (any), `icon-192.png` (any), `icon-180.png` (apple-touch-icon), `icon-maskable-512.png` (maskable), `icon-mono.svg` (monochrome iOS 16.4+), `favicon.svg` (browser tab). `manifest.json` has separate entries for `any`/`maskable`/`monochrome` purposes; `orientation: "any"` for iPad landscape.

### Push Notifications
- Toggle in Settings panel: **🔔 Game Start Alerts** — persisted to `localStorage('mlb_push')`
- `togglePush()` / `subscribeToPush()` / `unsubscribeFromPush()` / `urlBase64ToUint8Array()` in `index.html`
- Subscription POSTed to `${API_BASE}/api/subscribe` → stored in Upstash Redis under key `push:<b64-endpoint-hash>`
- `api/notify.js` checks MLB schedule, notifies for games starting within 10 minutes **or started up to 2 minutes ago** (cron may fire after scheduled start), deduplicates via `notified:<gamePk>` key (24h TTL), auto-removes stale subscriptions (410/404 responses)
- `api/test-push.js` sends a real push to all subscribers immediately — use the **Test Push Notification** GitHub Actions workflow (workflow_dispatch) to trigger it for QC
- Redis env vars injected by Vercel/Upstash integration: `KV_REST_API_URL` and `KV_REST_API_TOKEN`

### VAPID Keys (do not regenerate without re-subscribing all devices)
- Public key is hardcoded in `index.html` as `VAPID_PUBLIC_KEY` constant
- Private key is in Vercel env var `VAPID_PRIVATE_KEY` only — never in code
- `VAPID_SUBJECT` = operator email in Vercel env vars
- `NOTIFY_TOKEN` (Vercel) must match `NOTIFY_SECRET` (GitHub Actions secret) — authenticates cron calls to `/api/notify`

### Update workflow (PWA-specific)
On every commit that changes app content, bump **three** things:
1. `<title>` version string in `index.html`
2. Settings panel version string in `index.html`
3. `CACHE` constant in `sw.js` (e.g. `mlb-v4` → `mlb-v5`) — forces cache refresh for installed PWA users

---

## Known Open Issues

1. **News fallback** — if ESPN API is CORS-blocked, no fallback source.
4. **Around the League leaders index mapping** — empirically derived, fragile. Re-test if API response order changes.
5. **allorigins.win proxy** — no SLA, free service. Retry logic (3 attempts, 1s gap) mitigates failures.
6. **YouTube channel IDs** — 27 of 30 `youtubeUC` values unverified. QC needed each offseason.
7. **Date strings use local time** — all `startDate`/`endDate` params in `index.html` are built from `getFullYear`/`getMonth`/`getDate` (local). Avoid `toISOString().split('T')[0]` for date params — it returns UTC and will be one day ahead after ~8 PM ET, causing games to be skipped (fixed v1.45.5). `api/notify.js` intentionally uses UTC since it runs on Vercel servers and compares timestamps, not dates. **Calendar `gameByDate` key also uses local timezone conversion (fixed v1.61)** — previously used `gameDate.split('T')[0]` (UTC), which placed evening US games on the wrong calendar cell.

---

## Hardcoding Risks

| Item | Risk | Fix |
|---|---|---|
| `SEASON = 2026` | Must update each season | Derive from system date or MLB API |
| Team colours in TEAMS array | Teams rebrand | Verify each offseason |
| ESPN team IDs | Different system from MLB IDs, manually mapped | Verified against ESPN API Apr 2026 — all 30 correct as of v1.46; re-verify each offseason |
| `WC_SPOTS = 3` | Rule change risk | Already a named const |
| ESPN API endpoint | Unofficial, undocumented | Monitor for breakage |
| MLB Stats API base URL | Unofficial | Watch for deprecation |
| Leaders `cats` array order | Index-based mapping — order matters | Re-test empirically if results look wrong |
| allorigins.win proxy URL | Free public proxy, no SLA | Swap URL if it goes down; retry logic already in place |
| YouTube channel IDs (`youtubeUC`) | Teams may rebrand/change channels | Verify each offseason |
| Game state strings | MLB uses both `"Preview"` and `"Scheduled"` for upcoming | Both checked — verify if new states appear |

---

## Stat Display Conventions

| Category | Stats | Format | Rule |
|---|---|---|---|
| Rate (no leading zero) | AVG, OBP, SLG, OPS, FPCT | `.xxx` | `fmtRate(v)` — strips leading zero when 0 < val < 1 |
| Traditional pitching | ERA | `z.xx` | `fmt(v, 2)` |
| Traditional pitching | WHIP | `z.xx` | `fmt(v, 2)` |
| Per-9 / ratio | K/9, BB/9, K/BB | `z.xx` | `fmt(v, 2)` |
| Innings pitched | IP | `x.x` | Pass-through string — tenths = outs, not fractions. Never parse/round. |
| Counting | HR, RBI, H, K, BB, R, SB, PA, AB, W, L, SV, GS, ER, PC, E, PO, A, TC, DP | integer | Raw value, no `toFixed` |

## Feature Backlog

- [x] ⚡ Pulse — League-wide live play-by-play feed merged into index.html as lazy-loaded nav section (v2.1)
- [x] ⚡ Pulse — Mock mode toggle and Sound Alerts trigger moved to Settings panel (v2.1)
- [x] ⚡ Pulse — Mock bar inline (not fixed-position); no conflict with mobile nav (v2.1)
- [x] ⚡ Pulse — Game-start fires on `detailedState === 'In Progress'` only, not warmup (v2.1)
- [x] ⚡ Pulse — Timestamps stale check skips playByPlay fetch when game state unchanged (v2.1)
- [x] ⚡ Pulse — Historical plays load on first poll without alerts/sounds; sorted chronologically across all games (v2.1)
- [x] Calendar — Postponed/Cancelled/Suspended games show grey `PPD` badge instead of crashing to "L undefined-undefined"; `selectCalGame` renders info card, skips linescore fetch (v2.2)
- [x] Calendar — Doubleheader support: `gamesByDate` array per date; DH cells show `DH` badge + stacked G1/G2 rows each independently clickable; dot reflects combined result (v2.2)
- [x] Calendar — Linescore R/H/E null guards tightened (`!=null` per field) to prevent `undefined` display on partial-data games (v2.2)
- [x] ⚡ Pulse — Ticker shows `PPD` instead of `FINAL` for postponed/cancelled/suspended games (v2.2)
- [x] ⚡ Pulse — 🌧️ "Game Postponed" feed item fired instead of 🏁 "Game Final" + gameEnd sound for PPD transitions (v2.2)
- [x] ⚡ Pulse — Historical status items synthesised on first load: Game Final (with `linescore.gameDurationMinutes` duration label + accurate end-time sort), Game Postponed, Game Underway, Game Delayed (v2.2)
- [x] ⚡ Pulse — Game Final feed item anchored after last play timestamp (`pendingFinalItems` deferred insert); omitted if no plays found; PPD item suppressed before scheduled game time (v2.3)
- [x] ⚡ Pulse — Feed items inserted at correct timestamp position on every poll; late-arriving plays no longer float to top (v2.3)
- [ ] ⚡ Pulse — Real audio files to replace Web Audio API stubs
- [ ] ⚡ Pulse — Feed item cap logos (small team image in meta row alongside coloured dot)
- [ ] ⚡ Pulse — Probable pitchers on empty state hero card (`hydrate=probablePitcher`)
- [ ] ⚡ Pulse — Persist `enabledGames` to localStorage (game filter survives reload)
- [ ] ⚡ Pulse — 30-team colour QA across ticker chips and empty state gradients
- [ ] ⚡ Pulse — Push notification integration for league-wide game-start alerts
- [ ] Switch cron trigger from GitHub Actions to Vercel Cron (`vercel.json`) — GitHub Actions scheduled workflows are unreliable on free tier (fires ~once per hour in practice vs every 5 min as configured), making game-start alerts miss most windows; Vercel Cron runs directly on the same infra as the notify function and is more reliable
- [ ] Push notification team filter — currently fires for any MLB game start; add per-user team preference stored with subscription in Redis
- [ ] Clean up KV naming — rename `const kv` variable to `redis` in all three api files; rename env vars `KV_REST_API_URL`/`KV_REST_API_TOKEN` to clearer Upstash-prefixed names in both code and Vercel dashboard (env var names were auto-generated by Vercel's Upstash integration)
- [x] Rename `--blue`/`--orange` CSS vars to `--primary`/`--secondary` — names are misleading for non-blue/orange teams (v1.45.1)
- [x] Fix live header text colour — `.live-team-name` and `.live-team-score` now use `var(--header-text)` instead of hardcoded `#fff`/`--accent-text` (v1.54)
- [x] Team-aware live badge — tinted/outlined using `--accent` (v1.53); W/L badges intentionally kept as fixed green/red (semantic meaning)
- [x] Team cap logos in Around the League matchup grid — `teamCapImg()` with `capImgError()` SVG fallback; drop-shadow for dark logo visibility (v1.55)
- [x] Yesterday/Today/Tomorrow day toggle on Around the League matchups — opacity fade transition, resets to Today on tab open (v1.58)
- [x] Live game view shows FINAL (not LIVE) for completed games — `/schedule?gamePk=` fetched in same `Promise.all`, stops auto-refresh when Final (v1.58)
- [x] Standardise stat display formatting — `fmtRate` for no-leading-zero rate stats; ERA 2dp; WHIP 3dp everywhere; K/BB, K/9, BB/9 2dp (v1.59)
- [x] Mobile: hide "Refresh" label on matchup day controls (≤480px), icon-only ↻ with adequate touch target, prevents row overflow on narrow screens (v1.60)
- [x] Warmup/Pre-Game state no longer shown as Live — `detailedState` exclusion applied in home card, calendar, and Around the League (v1.61)
- [x] Calendar date timezone fix — `gameByDate` keyed by local date (via `new Date()`) instead of UTC `gameDate.split('T')[0]`; fixes evening games appearing on wrong calendar day (v1.61)
- [ ] News fallback source (MLB RSS)
- [ ] Last 10 games record widget
- [ ] Dynamic season year
- [ ] QC all 30 team YouTube channel IDs
- [ ] Consider more reliable CORS proxy for YouTube RSS
- [x] --accent / --header-text theme vars, cross-team contrast safety (v1.39)
- [x] Theme flash prevention — localStorage pre-render hydration (v1.39)
- [x] W/L outlined neutral badge pills; cal LIVE pill (v1.39)
- [x] Nav active state soft pill; header text via --header-text (v1.39)
- [x] Hero stat box (first stat spans 2-col at 2.2rem) (v1.39)
- [x] Jersey # overlay pill on player headshot (v1.39)
- [x] Leader stat filter pills above select dropdowns (v1.39)
- [x] Opposition-forward home cards — 5-col Next Game, ghosted Next Series (v1.39.1)
- [x] Live game play-by-play log — every at-bat result grouped by inning, scoring plays highlighted (v1.45)
- [x] Remove redundant At Bat card from live game view — Current Matchup already shows batter (v1.44)
- [x] Mobile calendar game stats fix — tap now shows tooltip AND populates #gameDetail panel below (v1.43)
- [x] iPhone horizontal scroll fix — `html{overflow-x:hidden}` + `.live-view` side padding zeroed + `.game-big{padding:16px}` (v1.42)
- [x] Home screen horizontal scroll fix — `html,body{overflow-x:hidden}` + `.ng-grid`/`.ng-name`/`.ng-score` mobile font overrides on Next Game card (v1.43.1)
- [x] Today card live state: remove LIVE duplication from label, replace red badge-live pill with subtle inline dot + inning indicator (v1.42.1)
- [x] Mobile calendar: dot indicators + tap tooltip (v1.41.4)
- [x] Mobile nav: short labels back, backdrop-blur bg, safe-area padding, accent underline active (v1.41.1)
- [x] iPad portrait header: stays one line, team chip added, logo wordmark collapses (v1.41.2)
- [x] Diamond PWA icon set — team-neutral, maskable/monochrome/favicon variants (v1.41.3)
- [x] PWA install support — manifest, service worker, icons, apple meta tags (v1.40)
- [x] Web Push game-start notifications — Vercel + Upstash Redis + GitHub Actions cron (v1.40)
- [x] Game Start Alerts toggle in Settings panel (v1.40)
- [x] Today's matchup subtle card surfaces, 3-col grid (v1.40)
- [x] iPhone layout — fixed bottom icon nav bar, scrollable header, settings scrolls with header (v1.38)
- [x] Extract inline grid styles to CSS classes (.media-layout, .league-leaders-grid) for responsive control (v1.38)
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
