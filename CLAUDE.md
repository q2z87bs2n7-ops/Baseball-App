# MLB Tracker — Project Handoff

## What This Is
A single-file HTML sports tracker app for MLB, defaulting to the New York Mets. All data is pulled live from public APIs — no build system, no dependencies beyond the push notification backend. The main app lives in `index.html`.

**Current version:** v2.21 (v1.61 was the final v1 release — v2.x began with the League Pulse merge; v2.2 merged calendar/doubleheader/PPD fixes; v2.3 merged Pulse PPD + historical status items; v2.4 merged Pulse feed ordering fixes; v2.5 merged DH mobile calendar fix; v2.6 merged DH full detail panel + PPD dot; v2.6.1 added News Feed MLB/Team toggle; v2.7 merged Pulse player card flash + HR feed improvements; v2.7.1+ added Story Carousel event stream with 12 story generators, priority-weighted rotation, and pitcher stats display; v2.8 adds UI/UX improvements: nav reorder (League before Pulse), Standings redesign with other divisions Wild Card race, balanced home card heights; v2.9 merges Story Carousel polish: HR card redesign with past-tense headline/YTD stats/multi-homer collapse/HIGHLIGHT badge, probable pitcher W-L record, streak/leader card sub-line cleanup, auto-rotate 10s, DH game 2 excluded from NEXT UP hero card, lazy Statcast distance update for HR headlines; v2.9.1 adds big-inning HIGHLIGHT badge + crimson card background, HR description patch on stale first-delivery, player card +1 fix via desc hint; v2.9.2 consolidates daily leader stories to one-per-stat with MLB top-5 ranked list and expands stats to HR/AVG/RBI/SB/Wins/Saves; v2.10 Pulse UI polish: distinct HR colors — teal for Story Carousel tier-1 cards, violet for feed play items; ⚡ Pulse section banner (no hairline rule); feedWrap contained-module border; v2.11 walk-off story fires on game state alone (bottom 9th+, tied/1-run, no runner requirement); per-inning ID + 5-min cooldown prevents repeated firing in same inning; v2.12 adds bases loaded story card (tier-1, priority 88, per half-inning), leader card player names match headline size/color; v2.12.1 tightens walk-off detection to winning-run-at-bat logic: fires when deficit ≤ runners-on-base + 1, correctly handles tied/down-1/down-2-with-runners scenarios; v2.12.2 big-inning card sub-line shows "AWAY @ HOME" only, score removed; v2.12.3 story carousel cooldowns dynamically capped to pool size × 1.5 × rotate interval so thin pre-game pools recycle cards in seconds not hours; v2.13 Pulse ticker chip redesign: chips stack teams vertically (away row / home row / inning+outs row) for compact width; out-dot indicators (3 circles, hollow outline → filled red per out) on both normal and RISP chips; live dot changed red → green (#22c55e) to avoid clash; home-row dot-spacer aligns team abbreviations on shared left edge; RISP bottom row now left-aligns diamond + inning + outs together; v2.14 adds stolen base carousel story: 💨 tier-2/priority-55 card for 2B/3B steals, 🏃 tier-1/priority-85 for steal of home; carousel only — stolen base plays intercepted before feed; isHistory guard fires live events only; v2.15 Pulse two-column layout redesign: desktop/iPad landscape only (≥1025px) with ~700px left column (ticker, story carousel, feed) + ~320px right column (side rail games + news carousel); ticker filtered to Live games only (no Preview/Final); side rail unified module with Upcoming/Completed games sections; MLB news carousel via backend proxy (primary) + ESPN JSON fallback; YouTube channel feed proxy added for reliable Media tab video loading; responsive: side rail hidden at ≤1024px, Pulse reverts to single-column centered; v2.16 merged QC fixes from main; v2.17 adds Pulse header redesign (moved "⚡ Pulse" to side rail with "MLB Pulse ⚡" logo branding) and dual-source news fetching with console debug logging; v2.18 fixes Pulse display bug (ID selector specificity override) and adds proxy-rss.js serverless function for MLB RSS feed parsing (supports general feed + all 30 team-specific feeds, bypasses CORS); v2.19 fixes MLB RSS proxy fallback (changed data.videos → data.articles for correct field mapping); v2.20 corrects news source priority for Pulse side rail (MLB RSS primary via /api/proxy-rss, ESPN JSON fallback); v2.21 redesigns Pulse side rail layout (doubles pulseFeedHeader height with centered 23px icon, swaps news/games module order, extends newsCarousel to 700px width, aligns news top with previous games position via margin-top:70px))
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
api/test-push.js        — Vercel serverless: sends a test push immediately (bypasses game schedule check)
api/proxy-rss.js        — Vercel serverless: fetch + parse MLB RSS feeds server-side, return JSON (supports mlb + all 30 team feeds; bypasses CORS)
api/proxy-youtube.js    — Vercel serverless: fetch + parse YouTube channel feeds server-side, return JSON (bypasses CORS)
.github/workflows/      — notify-cron.yml: GitHub Actions cron (*/5 * * * *) pings /api/notify
                          test-push.yml: manual workflow_dispatch to fire a test push to all subscribers
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
let newsFeedMode = 'mlb'               // 'mlb' (no team filter) | 'team' (activeTeam.espnId filter); home card always shows team news

// ── ⚡ Pulse globals ──────────────────────────────────────────────────────────
let pulseMockMode    = false           // persisted to localStorage('mlb_pulse_mock')
let pulseInitialized = false           // lazy-init guard — set true on first Pulse nav
let gameStates       = {}             // gamePk → { awayAbbr, homeAbbr, awayName, homeName, awayPrimary, homePrimary,
                                      //   awayId, homeId, awayScore, homeScore, awayHits, homeHits,
                                      //   status, detailedState, inning, halfInning, outs, playCount, lastTimestamp,
                                      //   gameTime, gameDateMs, venueName, onFirst, onSecond, onThird }
let feedItems        = []             // all feed items newest-first (never pruned)
let enabledGames     = new Set()      // gamePks whose plays are visible in the feed
let mockPlayPtrs     = {}, mockGameQueue = [], mockTimerId = null
let mockSpeedMs      = 6000, totalMockPlays = 0, playedMockPlays = 0
let countdownTimer   = null, pulseTimer = null, alertId = 0, isFirstPoll = true, pollDateStr = null
// pulseTimer — stores setInterval handle from initReal() so switchMode() can clear it
let soundSettings    = { master:false, hr:true, run:true, risp:true,
                         dp:true, tp:true, gameStart:true, gameEnd:true, error:true }

// ── 📖 Story Carousel globals (v2.7.1+) ──────────────────────────────────────
let storyPool        = []               // array of story objects ready to rotate
let storyShownId     = null             // id of currently displayed story
let storyRotateTimer = null             // setInterval handle from initReal()
let onThisDayCache   = null             // cached stories from 3 years ago (same date)
let yesterdayCache   = null             // cached stories from yesterday's games
let dailyLeadersCache= null             // cached top 3 leaders per stat category
let dailyLeadersLastFetch=0             // timestamp of last leaders fetch
let dailyHitsTracker = {}               // batterId → hit count (reset daily)
let dailyPitcherKs   = {}               // pitcherId → strikeout count (reset daily)
let stolenBaseEvents = []               // live stolen base plays for carousel story generator (not added to feed)
let storyCarouselRawGameData={}         // gamePk → raw schedule API game object (doubleHeader, gameNumber, status.startTimeTBD, probablePitcher)
let probablePitcherStatsCache={}        // pitcherId → {wins, losses} — fetched by loadProbablePitcherStats()
let hrBatterStatsCache={}               // batterId → hitting stat object — populated by showPlayerCard() and fetchMissingHRBatterStats()
const STORY_ROTATE_MS=10000             // auto-advance every 10 seconds (was 20s pre-v2.9)
```

### Navigation
`showSection(id, btn)` — shows/hides sections by toggling `.active` class. Nav order: `home`, `league`, `pulse`, `schedule`, `news`, `standings`, `stats`, `media`. Live game view is a separate overlay (`#liveView`), not a section. **Calling `showSection` while the live view is active automatically closes it first.**

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
| `/game/{pk}/feed/color` | ❌ | Documented in MLB Stats API spec (`default: "v1"`) but returns 404 for all 2026 games. Confirmed dead across gamePks 824203, 824527, 824934. Do not use. |
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
--risp-accent                     /* yellow — defined but no longer used as border stripe; RISP items rely on ⚡ badge only */
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

**Doubleheaders (v2.2/v2.5/v2.6):** `renderCalendar` uses `gamesByDate` (array per date, sorted by gamePk) instead of the former single-game `gameByDate`. Cells with two games show a `DH` badge next to the opponent name and stacked `G1:` / `G2:` rows, each independently clickable via `event.stopPropagation()`. The outer cell onclick defaults to G1 — on desktop this is a fallback for clicks outside the G1/G2 rows; on mobile it is the only active target (the inner rows are hidden inside `.cal-game-info` which is `display:none` at ≤480px). Mobile dot logic: live > all-W > all-L > all-PPD (grey) > split/upcoming. Clicking any DH cell populates `#gameDetail` with **both** games stacked, each rendered independently by `buildGameDetailPanel`.

**Mobile calendar (≤480px):** cells show day number + colour-coded dot only (`.cal-dot`: green=W, red=L, pulsing red=Live, grey=PPD, accent=upcoming/split). Tapping a game cell shows a fixed-position `.cal-tooltip` above the cell with opponent, short date, and result/time/PPD badge — data from `scheduleData`, no API call. DH tooltip date line appends `· DH`. Tooltip dismisses on tap outside. The `#gameDetail` panel below the calendar is also populated with full game info for all games on that date.

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
- **Wild Card Race — Other Divisions** — top 9 non-division-leaders from the OTHER divisions in active team's league (excludes active team's own division). Orange cutoff after position 3. Separate card below the league WC card.
- **Full MLB Standings** (right column) — all 5 other divisions (all except active team's division). Active team's league listed first. `renderFullStandings` — unchanged.

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

#### Two-Column Layout Redesign (v2.15)

**Desktop/iPad Landscape (≥1025px):**
- CSS Grid: `display: grid; grid-template-columns: 700px 320px; gap: 12px;`
- Left column (~700px): Ticker, Story Carousel, Feed (unchanged from v2.14)
- Right column (~320px): **Side Rail** with unified games module + news carousel
  - **Games Module:** Upcoming (Scheduled + Preview, sorted by start time) and Completed (Final, sorted newest-first) sections. Each game shows team color dot + away abbr @ home abbr + time (upcoming) or score (completed). Click navigates to Live View.
  - **News Module:** Auto-rotating carousel (30s) with prev/next controls. Shows title + image + link. Sources: MLB RSS (primary via `/api/proxy-rss?feed=mlb`) → ESPN JSON fallback.

**Responsive Breakpoints:**
- **≥1025px (Desktop):** Two-column layout visible; side rail active
- **768–1024px (Tablet Landscape):** Side rail may be hidden depending on content width; Pulse may remain two-column or revert to single-column (test confirmed working at 768px+)
- **≤767px (Tablet Portrait/Mobile):** Side rail `display: none`; Pulse reverts to single-column centered (pre-v2.15 layout). Max-width 700px on left column maintained.

**Ticker Filter (v2.15):**
- Now shows **Live games only** (removes Preview/Scheduled/Final)
- Sorted by inning progress (most-advanced first)
- Empty state shows placeholder text; side rail displays all non-live games

**News Feed Strategy (v2.15.9):**
- **Primary:** MLB RSS via backend proxy `/api/proxy-rss?feed=mlb` (fixed v2.15.8 to handle CDATA and image tags)
- **Fallback:** ESPN JSON API at `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/news?limit=20`
- Both return same `{title, link, image}` format to carousel; console logs which source loaded

**Media Tab YouTube Proxy (v2.15.9):**
- New backend proxy `/api/proxy-youtube.js` available for future Media tab improvements
- Fetches YouTube channel feed server-side (bypasses CORS), returns `{videoId, title, thumb, date}` JSON
- Usage: `fetch('/api/proxy-youtube?channel=UCxxxxxx')`
- Eliminates dependency on allorigins.win (free proxy with no SLA)
- Media tab currently hidden (Settings toggle); proxy ready when feature is revisited

**HTML structure (`#pulse` section):**
- `#soundPanel` — `position:fixed` floating overlay, hidden by default; triggered by `🔊 Configure` in Settings
- `#alertStack` — `position:fixed` toast stack for run/triple-play alerts (HR events do NOT fire a toast — the player card replaces it)
- `#playerCardOverlay` — `position:fixed` full-screen semi-transparent overlay; contains `#playerCard`; shown on HR events in both real and mock mode (v2.7)
- `#gameTicker` — `position:sticky` below header; horizontal scrollable chip bar
- `#mockBar` — inline (not fixed); shown only when `pulseMockMode` is true
- `#feedWrap > #feedEmpty + #feed` — empty/upcoming state and live play items

**Ticker bar:** All games as scrollable horizontal chips. Sorted: Live (most-progressed inning first) → Preview/Scheduled (by `gameDateMs` asc) → Final (dimmed). Clicking a chip toggles that game's plays in the feed (`enabledGames` Set). Final games with `detailedState` Postponed/Cancelled/Suspended show `PPD` instead of `FINAL`.

**Normal chip layout (v2.13):** Three stacked rows — (1) green live dot + away abbr + away score, (2) invisible dot-spacer + home abbr + home score [spacer aligns both abbreviations on the same left edge], (3) inning/time + out-dot indicators. Out dots: 3 small circles (red outline when empty, filled `#e03030` when recorded); only shown for live games. Live dot is green (`#22c55e`) with a matching green pulse-ring animation — changed from red to avoid clashing with the red out dots.

**RISP chip layout (v2.13):** Fires when `g.onSecond || g.onThird`. Top row: green live dot + away abbr · score + divider + score · home abbr (horizontal, unchanged). Bottom row: 28×24px base diamond SVG (`baseDiamondSvg()`) + inning + out-dot indicators — all left-aligned with `gap: 6px` (no `justify-content: space-between`).

**Feed:** Newest plays at top. Each item shows: coloured team dots + score (meta row), inning + outs, play description, play-type badge (1B/2B/3B/BB/K/E/DP/TP), ⚡ RISP badge, and score badge on scoring plays (scoring side full brightness). Play classification drives visual treatment: `homerun` (strong amber tint + 3px amber left border stripe — visually outranks scoring plays), `scoring` (green tint), `risp` (no border stripe — ⚡ badge and base diamond chip provide sufficient treatment), `status-change` (blue tint, centred — game start/end/delay). **Game Delayed status items (v2.7)** show team abbreviations: "🌧️ Game Delayed — SD @ AZ · Delayed Start".

**Empty state:** When no visible plays exist, `renderEmptyState()` renders a hype block + hero upcoming-game card (3-stop gradient, team caps, countdown timer via `startCountdown()`) + 2-col grid for remaining games. Falls back to plain `⚾ League Pulse` placeholder off-season.

**Mock mode:** Controlled by `pulseMockMode` (toggle in Settings, persisted to `localStorage('mlb_pulse_mock')`). `MOCK_DATA` contains 4 games (NYM@ATL, NYY@BOS, LAD@SF, HOU@TEX) with ~55 scripted plays. Round-robin engine (`mockTick()`) advances one play per tick across games. Mock bar (Normal/Fast/Skip/Reset controls) is inline below the ticker. Each mock HR play has an embedded `mockStats` object `{avg, homeRuns, rbi, ops}` — passed as `overrideStats` to `showPlayerCard` to bypass the live API fetch in mock mode.

**Player card overlay (v2.7):** When a home run fires (real or mock), `showPlayerCard` renders a baseball-card-style overlay: player headshot from `img.mlbstatic.com` (generic silhouette fallback), name, team abbreviation, "💥 HOME RUN!" badge, and a stat grid (AVG · OPS · HR with count-up animation from N−1 → N · RBI). A context pill shows "HR #N in SEASON — milestone!" on multiples of 5, or "🏆 HR leader on the team" if `statsCache` confirms it — no extra API calls needed. Card auto-dismisses after 5.5s or on tap/click anywhere. `isHistory` guard prevents cards from firing on initial feed load. In real mode, `statsCache` is checked first; if the player isn't in cache (opponent player), `/people/{id}/stats` is fetched. In mock mode, `overrideStats` bypasses the fetch entirely.

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

Source: `/schedule?sportId=1&date={date}&hydrate=linescore,team,probablePitcher` + `/game/{pk}/playByPlay` + `/api/v1.1/game/{pk}/feed/live/timestamps`

---

#### 📖 Story Carousel — Curated Event Stream (v2.7.1+)

A rotating single-card digest layer surfacing high-level game narratives alongside the play-by-play feed. Not filtered by user's active team — league-wide stories only. Auto-rotates every 20s with manual prev/next controls. Each story has cooldowns so repeats are throttled and decay rates so older stories naturally deprioritise.

**HTML structure:**
- `#storyCarousel` — Container below `#gameTicker`, above `#mockBar`
- `#storyCard` — Single story card with badge, icon, headline, sub
- `.story-controls` — Manual prev/next buttons and progress dots

**Story object shape:**
```javascript
{
  id: string,           // Unique per story type: "hr_gamePk_playCount", "nohit_gamePk", etc.
  type: string,         // Category: 'realtime', 'game_status', 'daily_stat', 'historical', 'contextual', 'yesterday'
  tier: 1|2|3|4,        // Priority tier — determines display color and lifecycle
  priority: number,     // Base priority 1–100; combined with decay for final score
  icon: string,         // Emoji icon (💥, 🔥, 🏆, etc.)
  headline: string,     // Main text: "Ohtani homers (8) — LAD lead 3-1"
  sub: string,          // Context: "LAD @ SF · ▼5th"
  badge: string,        // 'LIVE', 'TODAY', 'YESTERDAY', 'ON THIS DAY', 'UPCOMING'
  gamePk: number|null,  // Associated game or null for league-wide stories
  ts: Date,             // When story occurred (for age calculation and sorting)
  lastShown: Date|null, // Last display time; null = never shown
  cooldownMs: number,   // Min milliseconds before re-display (1–60 min)
  decayRate: number,    // Fraction lost per 30-minute window (0.05–0.90)
}
```

**Story tiers and lifecycle:**

| Tier | Type | Examples | Cooldown | Decay/30m | Notes |
|---|---|---|---|---|---|
| 1 | `realtime` | Home run | 5 min | 50% | New story per HR; playCount dedup |
| 1 | `realtime` | No-hitter watch (inning ≥6, 0 hits) | 2 min | 20% | One per game; removed when hit occurs |
| 1 | `realtime` | Walk-off threat (9th+, winning run at bat: deficit ≤ runners+1) | 5 min | 90% | One per inning; fires when winning run is at the plate |
| 1 | `realtime` | Big inning (3+ scoring plays in sequence) | 10 min | 40% | One per inning-half |
| 1 | `realtime` | Steal of home | 5 min | 70% | Tier-1 elevated; one per play (stable atBatIndex key) |
| 2 | `realtime` | Stolen base (2B or 3B) | 5 min | 70% | One per steal; `isHistory` guard — live events only |
| 2 | `game_status` | Final score + comeback label | 15 min | 30% | One per game (stable ID) |
| 2 | `game_status` | Win/loss streak ≥3 games | 20 min | 10% | Checks all 30 teams in scheduleData |
| 3 | `daily_stat` | Multi-hit day (≥3 hits or ≥2 hits+1 HR) | 15 min | 10% | One per batter per day; tracks `dailyHitsTracker` |
| 3 | `daily_stat` | Daily leaders — top 3 per stat | 30 min | — | HR/RBI/H (hitting); K/SV (pitching); weighted priority [1.0, 0.7, 0.45] |
| 3 | `daily_stat` | Pitcher gem (≥8 Ks in-progress) | 10 min | 20% | One per pitcher per game |
| 4 | `historical` | On This Day (same date, last 3 seasons) | 60 min | 50% | Loaded once at Pulse init |
| 4 | `contextual` | Yesterday's game highlights (final scores + W/L pitcher stats + top batter) | 30 min | 30% | Loaded once at Pulse init; naturally deprioritised when live games exist |
| 4 | `contextual` | Probable pitchers for today (all teams) | 60 min | 5% | Format: "PitcherName [ABR] vs PitcherName [ABR]" |

**Story generators (called every 15s poll):**

1. **`genHRStories()`** — Source: `feedItems`. Groups HR plays by `batterId` so multi-homer games collapse into one story. **Single HR:** ID `hr_{gamePk}_{ts}`, past-tense headline "Player hit a [Xft] homer off Pitcher in the Nth inning (HR #N this season)"; distance from `item.data.distance` (lazily populated by Statcast — see `pollGamePlays` patch loop). **Multi-homer:** ID `hr_multi_{batterId}_{gamePk}_{count}`, "Player hits his second homer…"; priority boosted +15 per additional HR; original single-HR story auto-drops when multi-homer takes over. Sub-line: "AWAY @ HOME · N HR · N RBI · .AVG AVG · .OPS OPS" from `hrBatterStatsCache` → `statsCache` fallback. Badge: `highlight` (orange). Priority: 100 (single), 115+ (multi). Cooldown: 5 min.

2. **`genNoHitterWatch()`** — Source: `gameStates` linescore. Detects: `status === 'Live'` AND `away.hits === 0 || home.hits === 0` AND `inning >= 6`. ID: `nohit_{gamePk}` (one per game, updates description as innings advance). Priority: 95. Cooldown: 2 min. Removed when a hit occurs.

3. **`genWalkOffThreat()`** — Source: `gameStates`. Detects: `halfInning === 'bottom'` AND `inning >= 9` AND winning run is at bat (`deficit ≤ runnersOn + 1`, where deficit = awayScore − homeScore). Fires when tied (deficit 0, batter is the winning run), down 1 with any runner on, down 2 with 2+ runners on, or down 3 with bases loaded. Does NOT fire when home is leading or when trailing by more than runners+1 can cover. ID: `walkoff_{gamePk}_{inning}` (per-inning, resets cleanly for extra innings). Priority: 90. Cooldown: 5 min (prevents repeated firing within same inning), 90% decay.

4. **`genBasesLoaded()`** — Source: `gameStates`. Detects: `status === 'Live'` AND `onFirst && onSecond && onThird`. Fires any inning, any half. ID: `basesloaded_{gamePk}_{inning}_{halfInning}` (per half-inning). Headline: "Bases loaded — [batting team] batting in the Nth". Priority: 88. Cooldown: 3 min. Decay: 80%. Standard tier-1 teal card.

5. **`genStolenBaseStories()`** — Source: `stolenBaseEvents[]` (populated by `pollGamePlays` for live steals; stolen base plays are intercepted before `addFeedItem` — carousel only). Runner extracted from `play.runners[].details` (`eventType: 'stolen_base_*'`); falls back to batter at plate if not found. **Regular steal (2B/3B):** tier-2, priority 55, icon 💨, headline "Player steals 3B". **Steal of home:** tier-1, priority 85, icon 🏃, headline "Player steals home plate". Sub: `"AWAY @ HOME · ▲/▼N"`. ID: `sb_{gamePk}_{atBatIndex}` (one per steal event, never collapses). Cooldown: 5 min. Decay: 70%. `isHistory` guard: only plays received during the live session are captured — no back-fill from game start.

6. **`genBigInning()`** — Source: `feedItems` (3+ consecutive scoring plays in same inning/half). ID: `biginning_{gamePk}_{inning}_{half}`. Priority: 75. Cooldown: 10 min. Badge: `highlight`. Card gets `.story-biginning` CSS class (crimson background, distinct from HR amber).

7. **`genFinalScoreStories()`** — Source: `gameStates` where `status === 'Final'`. Headline: "Final: NYM 5, PHI 2". Adds "comeback" label if trailing by 3+ after 5th. ID: `final_{gamePk}` (stable, won't re-generate). Priority: 80. Cooldown: 15 min.

8. **`genStreakStories()`** — Source: `scheduleData` (all teams, not filtered). Counts consecutive W/L. Fires when streak ≥3. ID: `streak_{teamId}_{streakLength}` (updates as streak grows). Headline: "Mets have won 5 in a row". Priority: 60. Cooldown: 20 min.

9. **`genMultiHitDay()`** — Source: `feedItems` (aggregates hits per batter). Threshold: ≥3 hits OR ≥2 hits + 1 HR. Uses `dailyHitsTracker` for in-memory count. ID: `multihit_{batterId}_{date}`. Headline: "Alonso goes 3-for-4 with a homer". Priority: 55. Cooldown: 15 min per player.

10. **`genDailyLeaders()`** — Source: `/stats/leaders` (fresh fetch every 5 min, cached in `dailyLeadersCache`). Covers: HR, AVG, RBI, SB (hitting); Wins, SV (pitching). Top 5 per category in a single story per stat (` · `-separated inline list). ID: `leader_{stat}_{date}`. Headline: "MLB Home Run Leaders". Sub: "1. LastName N · 2. LastName N · …". Sub styled via `.story-leaders` class (14px, `var(--text)`, weight 600 — matches headline). Cooldown: 30 min.

11. **`genPitcherGem()`** — Source: `feedItems` + linescore (pitcher K count). Detects: ≥8 Ks in progress. Uses `dailyPitcherKs` for in-memory tracking. ID: `kgem_{gamePk}_{pitcherId}`. Headline: "Senga has 10 Ks through 7". Priority: 58. Cooldown: 10 min.

12. **`genOnThisDay()`** — Source: `/schedule?date={MM/DD, 3-year lookback}&season={year}&hydrate=linescore,boxscore,playByPlay` (fetched once at Pulse init, cached). Extracts top batter (by avg), starting pitcher stats (W/L/IP/K/ER), multi-HR hitters, walk-offs, grand slams, no-hitters. ID: `otd_{year}_{gamePk}`. Headline: "On this day 2024: Mets beat PHI 5-2 · deGrom 12K". Priority: 20 (low, contextual only). Cooldown: 60 min.

13. **`genYesterdayHighlights()`** — Source: `/schedule?date={yesterday}&hydrate=linescore,boxscore` (fetched once at Pulse init, cached). Filters for Final games (excludes PPD/Cancelled/Suspended). Extracts: W/L pitcher (by `gameStatus.isWinningPitcher` / `isLosingPitcher` flags) with IP/K/ER stats, save pitcher (if exists), top batter (by batting avg), multi-HR hitters. ID: `yday_{gamePk}_{type}`. Headline: "Yesterday: NYM 5, PHI 2 · W: deGrom 7IP, 10K · L: Wheeler 6IP, 2ER". Priority: 45. Cooldown: 30 min. Shown prominently when <2 live games.

14. **`genProbablePitchers()`** — Source: `scheduleData` (today only) OR `gameStates` fallback. Hydrate param: `probablePitcher`. Filters: `abstractGameState !== 'Final'` AND `localDate === today`. Extracts pitcher names from `g.teams.away/home.probablePitcher.fullName` or "TBD". ID: `probable_{gamePk}`. Headline: "Scherzer [NYM] vs Kershaw [LAD] · 7:05 PM". Priority: 40. Cooldown: 60 min.

**Rotation engine:**

```javascript
const STORY_ROTATE_MS = 10_000;  // auto-advance every 10 seconds

function rotateStory() {
  const now = Date.now();
  
  // Cap effective cooldown relative to pool size so pre-game thin pools
  // don't lock cards out for their full nominal cooldown (e.g. 60 min for
  // probable pitchers when only 3 stories exist). Floor: 2 minutes.
  const maxCooldown = Math.max(storyPool.length * STORY_ROTATE_MS * 1.5, 2 * 60_000);

  // Eligible = effective cooldown expired OR never shown
  let eligible = storyPool.filter(s =>
    !s.lastShown || (now - s.lastShown.getTime()) > Math.min(s.cooldownMs, maxCooldown)
  );
  
  // Fallback: if nothing eligible, pick least-recently-shown
  if (!eligible.length) {
    eligible = [...storyPool].sort((a,b) =>
      (a.lastShown?.getTime()||0) - (b.lastShown?.getTime()||0)
    );
  }
  
  if (!eligible.length) return;
  
  // Score: priority × decay^(ageMinutes / 30)
  const scored = eligible.map(s => {
    const ageMin = (now - s.ts.getTime()) / 60_000;
    const decay = Math.pow(1 - s.decayRate, ageMin / 30);
    return { s, score: s.priority * decay };
  });
  
  scored.sort((a,b) => b.score - a.score);
  showStoryCard(scored[0].s);
}
```

**Pool builder (`buildStoryPool()`):**
Called at end of every `pollLeaguePulse()` (every 15s). Generates fresh stories from all 13 generators, merges with existing pool (preserving `lastShown` timestamps), drops stale ones (e.g., walk-offs that resolved). Result: `storyPool` is always up-to-date with current state, and stories never reappear within their cooldown window.

**Data refresh schedule:**

| Data | Fetch interval | Method | Cache key |
|---|---|---|---|
| Story pool rebuild | Every 15s (Pulse poll) | `buildStoryPool()` at end of `pollLeaguePulse()` | `storyPool` array |
| Daily leaders | Every 5 min | Separate timer in `initReal()` | `dailyLeadersCache` |
| Yesterday cache | Once at Pulse init | `loadYesterdayCache()` | `yesterdayCache` array |
| On This Day cache | Once at Pulse init | `loadOnThisDayCache()` (3 API calls) | `onThisDayCache` array |
| Story rotation | Every 20 sec | `storyRotateTimer` interval | current story ID in `storyShownId` |
| Daily hit tracker | Reset daily (implicit) | Incremented in `pollGamePlays()` on each play | `dailyHitsTracker` object |
| Daily pitcher K tracker | Reset daily (implicit) | Incremented in `pollGamePlays()` on strikeout plays | `dailyPitcherKs` object |
| Stolen base event tracker | Reset on mode switch / reset | Populated in `pollGamePlays()` for live steals (skipped when `isHistory`) | `stolenBaseEvents` array |

**Page Visibility API integration:**
```javascript
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    clearInterval(storyRotateTimer);
    storyRotateTimer = null;
  } else if (pulseInitialized) {
    rotateStory();  // Immediately refresh on tab return
    storyRotateTimer = setInterval(rotateStory, STORY_ROTATE_MS);
  }
});
```
Pauses rotation when tab is inactive, resumes on return — saves resources and prevents stale stories from showing on delayed re-focus.

**Early-day / sole-game handling:**
Pool composition naturally adapts:
- **Pre-game (< 2 live games):** Dominated by Upcoming (Probable Pitchers) + Yesterday + On This Day stories
- **Mid-day (games in progress):** Realtime (HR, no-hitter, walk-off, big inning) + Daily Stats dominate
- **Late day (all Final):** Digest stories (Final scores, multi-hit, streaks) dominate

No explicit "mode" needed — the priority + decay math handles adaptation automatically. Low-tier contextual stories naturally deprioritise when high-tier realtime stories exist.

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
ESPN headlines with an **MLB / Team toggle** (pill buttons, `stat-tab` style). Defaults to MLB-wide stream (no team filter). Team pill shows `activeTeam.short` and updates on team switch via `loadNews()`. The home card's "Latest News" widget always shows team news regardless of the toggle state. Manual refresh button. Source: ESPN News API — MLB mode: `?limit=20`; Team mode: `?team={espnId}&limit=20`. When in MLB mode, a second parallel fetch gets team news for the home card.

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
| `selectCalGame(gamePk, evt)` | Finds all games on the same local date, shows mobile tooltip for the tapped game, then renders all games via `buildGameDetailPanel` in parallel into `#gameDetail`. DH dates show both panels stacked with Game 1 / Game 2 labels. |
| `buildGameDetailPanel(g, gameNum)` | Async — returns HTML for one game's detail panel. Handles all states independently: PPD (status + venue card), Upcoming (probable pitchers from scheduleData), Live (score + inning from hydrated linescore + Watch Live button), Final (fetches linescore + boxscore). `gameNum` null = single game (no label/separator); 1 = first DH game; 2+ = adds divider above. |
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
| `showPlayerCard(batterId, batterName, awayTeamId, homeTeamId, halfInning, overrideStats)` | Shows HR player card overlay. Resolves stats from `statsCache` → live API fetch → `overrideStats` (mock). Renders headshot, name, team abbr, "💥 HOME RUN!" badge, AVG/OPS/HR count-up/RBI, context pill. Auto-dismisses after 5.5s. |
| `dismissPlayerCard()` | Adds `.closing` animation class, hides overlay after 280ms. Also bound to overlay click/tap. |
| `showAlert(opts)` | Creates and stacks a `position:fixed` toast; auto-dismisses after `opts.duration` ms. Not fired for HR events — player card replaces it. |
| `dismissAlert(el)` | Adds `.dismissing` class, removes element after 300ms transition |
| `mockTick()` | Advances one play in round-robin order across `mockGameQueue`; marks remaining Live games Final when all plays exhausted |
| `advanceMockGame(pk, play)` | Applies one mock play to `gameStates`, calls `addFeedItem`, fires alerts and sounds |
| `setMockSpeed(ms, btn)` | Updates `mockSpeedMs`, restarts mock tick interval |
| `resetMock()` | Clears all Pulse state and re-calls `initMock()` |
| `toggleSoundPanel()` | Shows/hides `#soundPanel` overlay |
| `setSoundPref(key, val)` | Updates `soundSettings[key]`; master toggle also applies `.master-off` to `#soundRows` |
| `playSound(type)` | Checks `soundSettings.master && soundSettings[type]`, calls appropriate `playXxxSound()` |
| `_makeCtx()` / `_closeCtx()` / `_osc()` / `_ns()` | Web Audio primitives — shared by all Pulse sound functions |
| `genStolenBaseStories()` | Generates 💨/🏃 carousel story cards from `stolenBaseEvents[]`; tier-1 for steal of home (priority 85), tier-2 for 2B/3B steals (priority 55); one story per steal event (stable `sb_{gamePk}_{atBatIndex}` ID); never adds to feed |

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
- [x] Calendar — DH cell mobile fix: outer onclick restored (defaults to G1); inner rows hidden on mobile so outer was the only target — tapping did nothing and left two cells highlighted (v2.5)
- [x] Calendar — DH detail panel shows both games: `buildGameDetailPanel` extracted, called for all games on date in parallel; each state (PPD, Upcoming, Live, Final) handled independently with Game 1/2 labels (v2.6)
- [x] Calendar — PPD mobile dot: `cal-dot-ppd` (grey `--muted`) added; shown when all games on a date are PPD and no result recorded; W+PPD and L+PPD still show result dot (v2.6)
- [x] News — MLB/Team toggle pills added to News Feed section; defaults to MLB stream; team pill label updates on team switch; home card always shows team news (v2.6.1)
- [x] Calendar — Linescore R/H/E null guards tightened (`!=null` per field) to prevent `undefined` display on partial-data games (v2.2)
- [x] ⚡ Pulse — Ticker shows `PPD` instead of `FINAL` for postponed/cancelled/suspended games (v2.2)
- [x] ⚡ Pulse — 🌧️ "Game Postponed" feed item fired instead of 🏁 "Game Final" + gameEnd sound for PPD transitions (v2.2)
- [x] ⚡ Pulse — Historical status items synthesised on first load: Game Final (with `linescore.gameDurationMinutes` duration label + accurate end-time sort), Game Postponed, Game Underway, Game Delayed (v2.2)
- [x] ⚡ Pulse — Game Final feed item anchored after last play timestamp (`pendingFinalItems` deferred insert); omitted if no plays found; PPD item suppressed before scheduled game time (v2.3)
- [x] ⚡ Pulse — Feed items inserted at correct timestamp position on every poll; late-arriving plays no longer float to top (v2.3)
- [x] ⚡ Pulse — Player card flash on HR: baseball-card overlay with headshot, AVG/OPS/HR count-up animation/RBI, milestone + team-leader context pill; auto-dismisses 5.5s; mock plays have embedded stats to bypass API (v2.7)
- [x] ⚡ Pulse — HR toast suppressed — player card replaces it; run/TP toasts unaffected (v2.7)
- [x] ⚡ Pulse — HR feed items: stronger amber background + 3px amber left border stripe; visually outranks green scoring plays (v2.7)
- [x] ⚡ Pulse — RISP left accent stripe removed; ⚡ badge + base diamond chip on ticker are sufficient (v2.7)
- [x] ⚡ Pulse — Game Delayed feed items now show team abbreviations ("SD @ AZ · Delayed Start") in both initial-load and live-update paths (v2.7)
- [x] ⚡ Pulse — Real poll interval leak into mock mode fixed: `pulseTimer` global stores `setInterval` handle; `switchMode()` clears it (v2.7)
- [x] 📖 Story Carousel — Event stream with priority-weighted rotation, cooldowns, and decay (v2.7.1+). 13 story generators covering realtime (HR, no-hitter, walk-off, bases loaded, big inning), game status (final, streak), daily stats (multi-hit, leaders, pitcher gem), and historical (yesterday, on this day, probable pitchers)
- [x] 📖 Story Carousel — Auto-rotate every 20s with manual prev/next; Display winning/losing/save pitcher with IP/K/ER stats in yesterday/on-this-day stories
- [x] 📖 Story Carousel — HR card redesign: past-tense headline, YTD stats sub-line (HR/RBI/AVG/OPS), HIGHLIGHT badge, multi-homer collapse with priority boost (v2.9)
- [x] 📖 Story Carousel — Probable pitcher W-L record shown in matchup headline (fetched via `loadProbablePitcherStats`); defaults to 0-0 (v2.9)
- [x] 📖 Story Carousel — Streak/leader sub-lines cleaned up; Season Leader badge replaces TODAY badge on leader cards (v2.9)
- [x] 📖 Story Carousel — Auto-rotate reduced to 10s (was 20s) (v2.9)
- [x] 📖 Story Carousel — Probable Pitchers badge changed from UPCOMING to TODAY'S PROBABLE PITCHERS (v2.9)
- [x] ⚡ Pulse — DH game 2 excluded from NEXT UP empty-state hero card while game 1 is live (v2.9)
- [x] 📖 Story Carousel — Lazy Statcast distance: `pollGamePlays` patches `item.data.distance` on subsequent fetches once `hitData.totalDistance` populates; HR headline shows "Xft" when available (v2.9)
- [x] 📖 Story Carousel — Big-inning card: HIGHLIGHT badge + crimson background (`rgba(220,60,60,0.13)`) via `.story-biginning` CSS class, distinct from HR amber (v2.9.1)
- [x] 📖 Story Carousel — Big-inning card sub-line simplified to "AWAY @ HOME" — score removed (v2.12.2)
- [x] 📖 Story Carousel — Cooldowns dynamically capped to `pool.length × STORY_ROTATE_MS × 1.5` (floor 2 min) so thin pre-game pools recycle cards in seconds rather than hitting 60-min nominal cooldowns (v2.12.3)
- [x] ⚡ Pulse — Ticker chips stacked vertically: away-team row / home-team row / inning+outs row; reduces chip width significantly vs prior horizontal layout (v2.13)
- [x] ⚡ Pulse — Out-dot indicators on ticker chips: 3 small circles (red hollow outline → filled `#e03030`) showing current out count; displayed on both normal and RISP chips' inning row; only visible for live games (v2.13)
- [x] ⚡ Pulse — Live dot changed from red to green (`#22c55e`, pulse-ring animation updated to match) to avoid visual clash with red out-dot indicators (v2.13)
- [x] ⚡ Pulse — Dot-spacer on home-team row of normal chips so both team abbreviations share the same left edge regardless of live-dot presence (v2.13)
- [x] ⚡ Pulse — RISP chip bottom row left-aligns diamond + inning + outs with `gap: 6px`; removed `justify-content: space-between` that previously pushed inning to the far right (v2.13)
- [x] 📖 Story Carousel — Stolen base story card: 💨 tier-2/priority-55 for 2B/3B steals, 🏃 tier-1/priority-85 for steal of home; carousel-only (stolen base plays intercepted before feed via `stolenBaseEvents[]` tracker); `isHistory` guard ensures only live events fire (v2.14)
- [x] ⚡ Pulse — HR play description patched on subsequent polls when MLB API delivers initial play without season count in parentheses; `pollGamePlays` patch loop extended to update `item.data.desc` alongside distance (v2.9.1)
- [x] ⚡ Pulse — Player card +1 fix: `desc` passed to `showPlayerCard` as `descHint`; HR number extracted from description used as floor for `hrCount` when stats API is stale; milestone context pill uses resolved `hrCount` (v2.9.1)
- [x] 📖 Story Carousel — Daily leaders consolidated to one story per stat with MLB top-5 ranked list (last name + value, `<br>`-separated); stats expanded from {HR, H, RBI, K, SV} to {HR, AVG, RBI, SB, Pitching Wins, Saves}; fetch limit raised 1→5 (v2.9.2)
- [x] ⚡ Pulse — Distinct HR colors: Story Carousel tier-1 HR cards use teal (`rgba(0,195,175)`); feed HR play items use violet (`rgba(160,100,255)`) via `--hr-bg`/`--hr-border`; previously both shared amber (v2.10/v2.11)
- [x] ⚡ Pulse — ⚡ Pulse banner: flush-left label only (hairline rule removed); bolt uses `var(--accent)`, text in `var(--muted)` uppercase (v2.10/v2.11)
- [x] ⚡ Pulse — feedWrap contained-module: `1px solid var(--border)` border + `border-radius` gives the feed a self-contained card feel distinct from the carousel above (v2.10)
- [x] 📖 Story Carousel — Daily leader sub-lines (1–5 rankings) now single horizontal row joined with ` · ` instead of stacked `<br>` lines; `.story-leaders` CSS class makes sub-text match headline size (14px, `var(--text)`, weight 600) (v2.11)
- [x] 📖 Story Carousel — Walk-off story fires on game state alone (bottom 9th+, tied/1-run) — no runner on base required; per-inning ID (`walkoff_{pk}_{inning}`) so extra innings each get a fresh card; cooldown raised 1m → 5m to prevent repeated firing within the same inning (v2.11)
- [x] 📖 Story Carousel — Walk-off detection tightened to winning-run-at-bat logic: `deficit ≤ runnersOn + 1` — correctly fires for tied/down-1-with-runner/down-2-with-2-runners/bases-loaded-down-3; no longer fires when home leads or trailing by more than runners can cover (v2.12.1)
- [x] 📖 Story Carousel — Bases loaded story card: tier-1, priority 88, fires any inning/half when all three bases occupied; per half-inning ID prevents duplicate; 3-min cooldown, 80% decay (v2.12)
- [ ] 📖 Story Carousel — HR distance via Statcast (`hitData.totalDistance` in `/game/{pk}/playByPlay`) needs real-world verification — field may not populate for all games or all parks; confirm distance appears in headlines during live play
- [ ] ⚡ Pulse — "Game underway!" feed ordering: status items for games transitioning to In Progress appear near the top of the newest-first feed instead of being anchored to the game's scheduled start time; root cause likely `gameDateMs` null/stale or else-branch `playTime` missing at line 1162; deferred — data usage too high to investigate further
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
