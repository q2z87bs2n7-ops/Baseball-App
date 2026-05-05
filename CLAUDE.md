# MLB Tracker — Project Handoff

## What This Is
An MLB sports tracker for MLB, defaulting to the New York Mets. All data is pulled live from public APIs — no build system, no dependencies beyond the push notification backend. The app is split across three files: `index.html` (HTML structure), `styles.css` (all CSS), and `app.js` (all JavaScript).

**Current version:** v3.35

**Version history** (full detail in `CHANGELOG.md`):

- **v1.x** — initial build: schedule, standings, stats, live game view, PWA install, push notifications, team theming
- **v2.1** — League Pulse merged: live league-wide feed, story carousel, sound alerts, mock/demo mode
- **v2.x** — incremental: doubleheader/PPD support, HR/RBI player cards (Topps-style, 4 variants), Focus Mode pitch-by-pitch tracker (v2.61), Card Collection binder (v3.0), radio engine (v3.9)
- **v3.9** — performance: `feedItems` cap, story pool timer decoupled from poll, diffPatch GUMBO; Live Game Radio focus-paired engine + Radio Check sweep tool
- **v3.11** — 6 new story carousel generators: hitting streaks, roster moves, win probability, awards, season highs, perfect game watch
- **v3.19** — Pulse-first rebrand: app cold-opens on MLB Pulse, Home renamed "My Team", My Team lens toggle
- **v3.20** — Yesterday Recap as dedicated section (video highlights, heroes strip, per-game tiles); midnight window fix for West Coast games
- **v3.30** — V3 design unification (7 phases): design tokens, CSS class system, inline-style elimination, hero card subtle-ification, button consolidation, Standings polish
- **v3.31** — multi-source news aggregator; team color updates (Rockies/Tigers/Royals/Mariners/Brewers per 2026 brand)
- **v3.32** — floating panels (Settings/Sound/DevTools/RadioCheck) follow Pulse light/dark theme via `:has()` CSS scoping
- **v3.33** — tech-debt sprint (see `docs/technical-debt/sprints/`)
- **v3.34** — monolith split: `index.html` → `index.html` + `styles.css` + `app.js`; bug fixes: YouTube proxy regex, HR/RBI card flood on tab return, news image allowlist (corporate firewall), YouTube media layout swap (player left, list right 260px)
- **v3.35** — version bump to main; consolidates v3.34.x patch series

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
index.html              — HTML skeleton only: structure, overlays, nav, section divs. No CSS or JS.
styles.css              — all CSS: variables, layout classes, media queries, animations (linked via <link rel="stylesheet">)
app.js                  — all JavaScript: every function, global variable, and the boot IIFE (loaded via <script defer> in <head>)
focusCard.js            — runtime dependency: defines window.FocusCard.renderCard/renderOverlay/renderPitchPill/demo() for At-Bat Focus Mode
pulse-card-templates.js — runtime dependency: defines window.PulseCard.render()/demo() for HR/RBI card overlays
daily-events.json       — runtime dependency: static snapshot for client-facing Demo Mode
collectionCard.js       — runtime dependency: defines window.CollectionCard.renderBook/renderMiniCard/renderRailModule/demo() for Card Collection binder visuals
demo.html               — non-production design test harness for collectionCard.js; publicly accessible on GitHub Pages but not linked from the app; safe to delete before any merge
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
- **Static app (index.html, styles.css, app.js, sw.js, manifest, icons)**: GitHub Pages — `main` branch, root directory
- **Push API (`/api/*`)**: Vercel Hobby — `https://baseball-app-sigma.vercel.app`
- **Cron trigger**: GitHub Actions (free) pings `/api/notify` every 5 minutes

### Session Storage & Cross-Device Sync (v3.8+)

Sign-in is **100% optional** — app is fully functional without it. Signed-in users get card collection sync across devices and sessions.

**Auth methods:** GitHub OAuth + Email magic-link. Both map to a shared opaque `userId` in Upstash Redis — accounts unify automatically if the same email is used for both methods.

**Session:** 40-char random token, 90-day TTL, stored in `localStorage('mlb_session_token')`. Issued by Vercel serverless callbacks (`/api/auth/github`, `/api/auth/email-verify`).

**Collection sync:** `GET/PUT/POST /api/collection-sync` against Upstash Redis key `collection:{userId}`. Merge strategy: highest tier wins; same tier keeps newer `collectedAt` + merged events (deduped, capped 10). Background sync every 30s via `startSyncInterval()`.

**Vercel env vars required:** `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `EMAIL_API_KEY`, `EMAIL_FROM_ADDRESS`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`.

**Frontend functions:** `signInWithGitHub()`, `signInWithEmail()`, `handleAuthCallback()`, `mergeCollectionOnSignIn()`, `syncCollection()`, `startSyncInterval()`, `loadCollection()`, `saveCollection(obj)`.

**Known limits:** SendGrid sender must be verified; Apple private relay emails need same relay address for account unification; sessions expire 90 days (no data loss — collection persists in Redis).

> Full OAuth flow steps, magic-link flow steps, Redis key schema, setup instructions, and data model: see `docs/auth-architecture.md`.

### Runtime dependencies — DO NOT DELETE
Every file below is a production dependency loaded at runtime. Deleting any of them breaks the live app for users.

| File | Loaded by | Purpose |
|---|---|---|
| `styles.css` | `index.html` `<link rel="stylesheet">` | All app CSS — required for any visual rendering |
| `app.js` | `index.html` `<script defer>` | All app JavaScript — required for all functionality |
| `focusCard.js` | `index.html` `<script defer>` | Defines `window.FocusCard.renderCard()`, `.renderOverlay()`, `.renderPitchPill()`, `.demo()` — required for At-Bat Focus Mode visuals |
| `pulse-card-templates.js` | `index.html` `<script defer>` | Defines `window.PulseCard.render()` + `.demo()` — required for all HR/RBI player card overlays |
| `collectionCard.js` | `index.html` `<script defer>` | Defines `window.CollectionCard.renderBook()`, `.renderMiniCard()`, `.renderRailModule()`, `.demo()` — required for Card Collection binder visuals |
| `daily-events.json` | `app.js` `fetch('./daily-events.json')` | Static snapshot for Demo Mode — client-facing feature, not a dev artifact |
| `manifest.json` | `index.html` `<link rel="manifest">` | PWA install metadata |
| `icons/favicon.svg` | `index.html` `<link rel="icon">` | Browser tab icon |
| `icons/icon-180.png` | `index.html` `<link rel="apple-touch-icon">` | iOS home screen icon |
| `icons/icon-192.png` | `sw.js` SHELL cache + `manifest.json` | PWA icon (Android/install prompt) |
| `icons/icon-512.png` | `sw.js` SHELL cache + `manifest.json` | PWA icon (splash screen) |
| `icons/icon-maskable-512.png` | `manifest.json` | PWA maskable icon |
| `icons/icon-mono.svg` | `manifest.json` | iOS 16.4+ monochrome icon |

**Rule:** before deleting any file in the repo root or `icons/`, grep `index.html`, `app.js`, `sw.js`, and `manifest.json` for references first.

### File responsibilities — which file to edit

| Change type | File |
|---|---|
| Add/move an HTML element, section, overlay, button | `index.html` |
| Change how something looks (colours, layout, spacing, animations) | `styles.css` |
| Add/fix a function, API call, global variable, game logic | `app.js` |
| New feature with HTML + CSS + JS aspects | all three |
| PWA caching behaviour or push notification handler | `sw.js` |
| Version bump (`<title>` tag + settings panel `<div class="settings-version">`) | `index.html` |
| `CACHE` constant bump (forces PWA refresh) | `sw.js` |

**Script load order (all `defer` in `<head>`):** `pulse-card-templates.js` → `focusCard.js` → `collectionCard.js` → `app.js`. The `defer` attribute means all four download in parallel with HTML parsing and execute in document order after parse completes. `app.js` must remain last so `window.PulseCard`, `window.FocusCard`, and `window.CollectionCard` are defined before the boot IIFE runs. Hls.js is loaded `async` (independent, order-insensitive). The theme-flash prevention snippet at `index.html:7` is the only inline script — it must stay inline so it runs synchronously before CSS renders.

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
let themeScope = 'full'               // 'full' = team theme applied to whole app | 'nav' = team vars scoped to <header> only, rest of app uses MLB_THEME neutral colors; persisted to localStorage('mlb_theme_scope')

// ── ⚡ Pulse globals ──────────────────────────────────────────────────────────
let pulseInitialized = false           // lazy-init guard — set true on first Pulse nav
let gameStates       = {}             // gamePk → { awayAbbr, homeAbbr, awayName, homeName, awayPrimary, homePrimary,
                                      //   awayId, homeId, awayScore, homeScore, awayHits, homeHits,
                                      //   status, detailedState, inning, halfInning, outs, playCount, lastTimestamp,
                                      //   gameTime, gameDateMs, venueName, onFirst, onSecond, onThird }
let feedItems        = []             // all feed items newest-first (never pruned)
let enabledGames     = new Set()      // gamePks whose plays are visible in the feed
let countdownTimer   = null, pulseTimer = null, isFirstPoll = true, pollDateStr = null
// pulseTimer — stores setInterval handle from initReal()
let soundSettings    = { master:false, hr:true, run:true, risp:true,
                         dp:true, tp:true, gameStart:true, gameEnd:true, error:true }
let rbiCardCooldowns = {}              // gamePk → ms timestamp of last key RBI card shown (90s cooldown)
let pulseColorScheme = (...)           // 'dark' | 'light' — active Pulse color scheme; persisted to localStorage('mlb_pulse_scheme'); defaults 'light'
let pendingVideoQueue= []              // {gamePk, batterId, batterName, feedItemTs, playTs} — HR plays awaiting a matched clip from /game/{pk}/content
let liveContentCache = {}             // gamePk → {items:[], fetchedAt:ms} — re-fetched if >5min stale; separate from yesterdayContentCache
let lastVideoClip    = null           // most recent matched live clip object — used by devTestVideoClip() as first fallback
let videoClipPollTimer = null         // setInterval handle (2min) for pollPendingVideoClips()

// ── 📖 Story Carousel globals (v2.7.1+) ──────────────────────────────────────
let storyPool        = []               // array of story objects ready to rotate
let storyShownId     = null             // id of currently displayed story
let storyRotateTimer = null             // setInterval handle from initReal()
let storyPoolTimer   = null             // setInterval handle (30s) for buildStoryPool() — decoupled from 15s pollLeaguePulse()
let onThisDayCache   = null             // cached stories from 3 years ago (same date)
let yesterdayCache   = null             // cached stories from yesterday's games — populated by loadYesterdayCache() at Pulse init; used by genYesterdayHighlights() story carousel; never modified by date picker
let ydDateOffset     = -1               // days relative to today shown in Yesterday Recap; -1=yesterday (default); updated by ydChangeDate()
let ydDisplayCache   = null             // non-null when user has navigated to a date other than yesterday via date picker; avoids polluting yesterdayCache used by story carousel; cleared on each openYesterdayRecap()
let dailyLeadersCache= null             // cached top 3 leaders per stat category
let dailyLeadersLastFetch=0             // timestamp of last leaders fetch
let dailyHitsTracker = {}               // batterId → hit count (reset daily)
let dailyPitcherKs   = {}               // pitcherId → strikeout count (reset daily)
let stolenBaseEvents = []               // live stolen base plays for carousel story generator (not added to feed)
let storyCarouselRawGameData={}         // gamePk → raw schedule API game object (doubleHeader, gameNumber, status.startTimeTBD, probablePitcher)
let probablePitcherStatsCache={}        // pitcherId → {wins, losses} — fetched by loadProbablePitcherStats()
let hrBatterStatsCache={}               // batterId → hitting stat object — populated by showPlayerCard() and fetchMissingHRBatterStats()
let boxscoreCache={}                    // gamePk → boxscore data object — populated by genMultiHitDay() async fetch
// carousel rotation interval — read from devTuning.rotateMs (default 4500ms; was STORY_ROTATE_MS constant pre-v2.60)

// ── 📊 Inning Recap globals (v2.46+) ───────────────────────────────────────
let inningRecapsFired=new Set()         // {gamePk}_{inning}_{halfInning} — deduplication, one recap per inning
let inningRecapsPending={}              // recapKey → {gamePk, inning, halfInning} — queued by pollGamePlays on outs===3; processed by genInningRecapStories primary path
let lastInningState={}                  // gamePk → {inning, halfInning} — fallback transition detection in genInningRecapStories

// ── 🎯 At-Bat Focus Mode globals (v2.61) ─────────────────────────────────────
let focusGamePk=null                    // gamePk of the currently focused game (null = none selected)
let focusFastTimer=null                 // setInterval handle for 5s linescore + GUMBO polls
let focusCurrentAbIdx=null             // atBatIndex of the current play — resets focusPitchSequence on change
let focusState={                        // live state for the focused game — fed directly to window.FocusCard.renderCard/renderOverlay
  balls:0,strikes:0,outs:0,inning:1,halfInning:'top',
  currentBatterId:null,currentBatterName:'',
  currentPitcherId:null,currentPitcherName:'',
  onFirst:false,onSecond:false,onThird:false,
  awayAbbr:'',homeAbbr:'',awayScore:0,homeScore:0,
  awayPrimary:'#444',homePrimary:'#444',
  tensionLabel:'NORMAL',tensionColor:'#9aa0a8',
  lastPitch:null,batterStats:null,pitcherStats:null
}
let focusPitchSequence=[]              // array of pitch objects for current at-bat (oldest first); reset on new AB
let focusStatsCache={}                 // playerId → stats object — session-scoped cache; batter → hitting stats, pitcher → pitching stats
let focusLastTimecode=null             // last-seen GUMBO timecode string; null = seed required; reset in setFocusGame(); used by pollFocusRich() to request diffPatch deltas instead of full feed
let focusAlertShown={}                 // gamePk → ms timestamp of last soft alert shown (90s cooldown)
let focusOverlayOpen=false             // true when #focusOverlay is visible
let focusIsManual=false                // true when user manually picked a game via compact switcher; cleared by selectFocusGame() auto-pick and resetFocusAuto()
let tabHiddenAt=null                   // ms timestamp when tab went hidden (Page Visibility API); null when tab is visible; used by pollGamePlays isHistory extension to suppress sounds/popups for catch-up plays on tab return

// ── 📖 Card Collection globals (v3.0) ────────────────────────────────────────
let collectionFilter='all'             // 'all' | 'HR' | 'RBI' — current filter in binder
let collectionSort='newest'            // 'newest' | 'rarity' | 'team' — current sort in binder
let collectionPage=0                   // 0-indexed page (or team index when sort==='team')
let collectionCareerStatsCache={}      // playerId → { careerHR, careerAVG, careerRBI, careerOPS }
                                       //            or { careerERA, careerWHIP, careerW, careerK }
                                       // session-only — not persisted to localStorage
let lastCollectionResult=null          // { type:'new'|'upgrade'|'dup', playerName, eventType, tier }
                                       // set by collectCard() at collect time; consumed by flashCollectionRailMessage()
let collectionSlotsDisplay=[]          // sorted/filtered slot snapshot set by renderCollectionBook() at render time
                                       // openCardFromCollection(idx) indexes into this for stable idx mapping
```

### Navigation
`showSection(id, btn)` — shows/hides sections by toggling `.active` class. Nav order: `home`, `pulse`, `schedule`, `league`, `news`, `standings`, `stats`, `media`. Live game view is a separate overlay (`#liveView`), not a section. **Calling `showSection` while the live view is active automatically closes it first.**

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
- `≤1024px and ≥481px` (tablet band only): header `flex-wrap:nowrap` (prevents wrapping bug); `.logo span` hidden (SVG stays); nav icon-only (`.nav-label` hidden); `.settings-wrap` flex-shrink:0 stays right-aligned; header `position:sticky; z-index:100` — **must stay 100**, not lower. A sticky header creates a stacking context; if its z-index drops below `#gameTicker` (z-index:90) the absolutely-positioned `.settings-panel` (z-index:200 within the header's context) will render underneath the ticker on iPad portrait.
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
- `.nav-label` — wraps nav button text. Visible at ≤480px at 9.5px (labels: Home/Pulse/Schedule/League/News/Standings/Stats/Media). Hidden at ≤1024px tablet band (icons only).
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
| `/game/{pk}/content` | ✅ | Per-game media content. Returns `highlights.highlights.items[]` — each item has `headline`, `blurb`, `playbacks[]` (video URLs by bitrate/format, use `FLASH_2500K_1280X720` or last playback entry for best quality), `image.cuts[]` (thumbnail at various resolutions). Used by Yesterday Recap to display official MLB highlight clips per game. First item (`items[0]`) is typically the full game highlight reel. |
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

/* ⚡ Pulse theme indirection tokens (added v3.22.9) */
/* Set globally by applyPulseMLBTheme(). Re-mapped inside #pulse and #yesterday via
   --dark: var(--p-dark) etc., so Pulse sections get theme colors while the rest of
   the app (settings panel, header) continues to read the team-color --dark/--card vars. */
--p-dark / --p-card / --p-card2 / --p-border   /* background layers */
--p-accent / --p-accent-soft / --p-accent-strong /* accent shades */
--p-text / --p-muted                            /* text layers */
--p-scoring-bg / --p-scoring-border             /* feed scoring tint */
--p-hr-bg / --p-hr-border                       /* feed HR tint */
--p-status-bg / --p-status-border               /* feed status-change tint */

/* 🎨 V3 unification design tokens (added v3.31) */
--radius-sm  /* 6px  — chips, inset elements, ghost buttons */
--radius     /* 10px — default card / surface radius */
--radius-lg  /* 14px — hero cards (Next Game, Next Series, Live header) */
--radius-pill /* 999px — pill toggles, primary CTAs */
--eyebrow-sz  /* .68rem — uppercase kicker labels (was 13 inconsistent variants pre-v3.31) */
--eyebrow-ls  /* .1em   — eyebrow letter-spacing */
--eyebrow-fw  /* 700    — eyebrow font-weight */
--score-hero  /* 38px   — hero scoreboard digits (Home Next Game, Live header) */
--score-md    /* 1.4rem — secondary scoreboard digits */
--score-sm    /* 1.1rem — matchup-grid scoreboard digits */
--name-hero   /* 26px   — hero team name */
--name-md     /* .95rem — secondary team name */
--tint-primary        /* color-mix(--primary 10%, transparent) — subtle team-color overlay */
--tint-primary-strong /* color-mix(--primary 14%, transparent) — top-of-hero tint */
--accent-line         /* 2px solid var(--primary) — accent stripe (active rows, hero top, WC cutoff) */
--opp-primary         /* set inline on .surface-hero.has-opp-tint via style="--opp-primary:#XXX";
                         consumed by .has-opp-tint horizontal gradient. Computed by pickOppColor()
                         to avoid clash with user's primary. */
```

### V3 design system utilities (added v3.31)
Foundation classes that the post-v3.31 chrome reads from. Apply these by class instead of inline `style=` attributes whenever possible.

| Class | Purpose |
|---|---|
| `.eyebrow` / `.eyebrow--accent` | Uppercase kicker label (.68rem, .1em tracking, 700 weight). Accent variant for card titles. |
| `.surface` | Default neutral chrome — `var(--card)` + 1px `var(--border)` + `var(--radius)`. |
| `.surface-hero` | Toned-down hero card — `var(--card)` + `--tint-primary-strong` top fade + `var(--accent-line)` top stripe + `var(--radius-lg)`. |
| `.surface-hero.has-opp-tint` | Adds horizontal opp-color tint from the left, fed by `--opp-primary` CSS var. |
| `.surface-hero.has-ghost` | Modifier for hero cards with absolute-positioned `.series-ghost` opp-logo (Next Series). Applies `position:relative; overflow:hidden`. |
| `.surface-tinted` | Subtle primary-tint variant of `.surface`. |
| `.pill` / `.pill.is-active` | Pill toggle primitive — pill radius, transparent until active. Active state solid `var(--secondary)`. Used by `.stat-tab` (inheriting), live-view boxscore tabs, and any tab toggle. |
| `.btn-ghost` | Transparent button with border — `var(--radius-sm)`, accent border + color on hover. Refresh / back / cal-nav buttons. |
| `.btn-primary` | Solid primary CTA — `var(--secondary)` bg, `--accent-text` color, `var(--radius-sm)`. |
| `.score-hero/-md/-sm`, `.name-hero/-md` | Typography primitives consuming the score/name scale tokens. |
| `.empty-state` | Generic muted/centered "no data" pill (`color:var(--muted); padding:16px; text-align:center; font-size:.85rem`). Used for "No games scheduled", "No players available", "No SEASON stats yet". |
| `.live-indicator` | Bold green LIVE label (`color:#22c55e; font-weight:700`). |
| `.linescore-scroll` | Horizontal-scroll wrapper for `.linescore-table` on narrow viewports. |
| `.linescore-table .rhe-start` | 2px left-border separator before the R column (header + RHE row cells). |
| `.settings-row` (+ `--block`) | Unified settings panel row pattern — flex row with consistent padding/border-top. Block variant stacks label above content (used by Select Team / Color Theme / Sync Collection rows). |
| `.settings-row__label`, `.settings-section-label`, `.settings-select`, `.settings-action`, `.settings-toggle(/-knob)`, `.settings-version` | Settings panel primitives (added v3.30.11). |
| `.matchup-status(.is-live)`, `.matchup-live-dot`, `.matchup-score-row`, `.matchup-team`, `.matchup-abbr`, `.matchup-record`, `.matchup-score(.is-dim)`, `.matchup-divider`, `.matchup-vs` | Around the League matchup grid card chrome (added v3.30.5). |
| `.leader-stat-card`, `.leader-stat-label`, `.leader-row(/-row-left)`, `.leader-rank`, `.leader-name`, `.leader-val` | League / team stat-leader card chrome (added v3.30.5). |
| `.detail-separator`, `.detail-game-label`, `.detail-team-header`, `.detail-highlight-*` (thumb/overlay/play/arrow/video/meta/kicker/title), `.detail-summary-note/-row/-label` | Schedule game-detail panel chrome (added v3.30.6). |
| `.headshot-frame` (+ `img` selector), `.headshot-jersey-pill`, `.player-chevron`, `.stat-grid.--cols-3/-4` (wrapped in `@media(min-width:481px)`) | Stats panel chrome (added v3.30.7). |
| `.live-status`, `.live-score-divider`, `.live-stack-card`, `.boxscore-tabs`, `.matchup-stats.is-strong` | Live view chrome (added v3.30.8). |
| `.hero-kicker-row`, `.hero-divider`, `.hero-bottom-row`, `.hero-meta(-strong)`, `.hero-live-meta`, `.hero-live-dot`, `.hero-content`, `.hero-top-row`, `.hero-meta-right`, `.hero-opp-row`, `.hero-opp-name`, `.hero-opp-meta`, `.hero-day-strip`, `.hero-day-cell`, `.hero-day-label`, `.hero-day-time`, `.hero-day-live`, `.hero-day-score`, `.ng-team-left`, `.ng-team-right`, `.watch-live-btn`, `.cal-nav-btn`, `.wc-cutoff-row`, `.wc-cutoff-label` | Hero card + supporting chrome (added v3.30.9–v3.30.10). |

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
- Media tab currently hidden (Dev Tools toggle); proxy ready when feature is revisited

**HTML structure (`#pulse` section):**
- `#soundPanel` — `position:fixed` floating overlay, hidden by default; triggered by `🔊` button in Settings. **Top-level in the DOM** (sibling of `#devToolsPanel`, outside `#pulse`) — if it were inside `#pulse` it would be hidden with the section when navigating away. Click-outside handler (`onSoundPanelClickOutside`) is always-on via a single global `document.addEventListener('click',...)` — handles both `#soundPanel` and `#devToolsPanel` dismiss in one function.
- `#alertStack` — `position:fixed` toast stack for run/triple-play alerts (HR events do NOT fire a toast — the player card replaces it)
- `#playerCardOverlay` — `position:fixed` full-screen semi-transparent overlay; contains `#playerCard`; shown on HR events in both real and mock mode (v2.7)
- `#pulseTopBar` — brand strip above `#gameTicker`; shares CSS rule with `#ydSectionBar` (Yesterday Recap heading) so both render identically. Contains: ⚡ MLB PULSE wordmark (`.ptb-kicker` / `.ptb-bolt` / `.ptb-brand`) on the left; right side wraps `#ptbYestBtn` ("YESTERDAY'S RECAP" pill — `display:none` until `loadYesterdayCache()` resolves AND live feed is active; visibility exclusively controlled by `updateFeedEmpty()` — race-proof) + `#myTeamLensBtn` (MY TEAM toggle — hidden during hype/post-slate/intermission states via `hideWhenEmpty` in `updateFeedEmpty()`) + `#ptbSoundBtn` (🔊 icon-only pill; calls `toggleSoundPanel()`) + `#ptbRadioBtn` (📻 icon-only pill; calls `toggleRadio()`; synced by `setRadioUI()` via `.on` class) + `#ptbSchemeBtn` (☀️/🌙 icon-only pill; calls `setPulseColorScheme()`; `#ptbSchemeIcon` text driven by `updatePulseToggle()`).
- `#yesterday` — `class="section"` inside `.main` (sibling to `#pulse`) — normal section, not an overlay. Opened via `openYesterdayRecap()` (called from `#ptbYestBtn` or any future entry point); closed via `closeYesterdayRecap()` which restores `ydPrevSection` (defaults to `'pulse'`). Contains `#ydSectionBar` (same CSS as `#pulseTopBar` + `position:sticky; top:var(--header-h); z-index:80; margin-bottom:16px`; shows ⚡ MLB PULSE · ‹ [date] › on left — the `.yd-date-btn` chevron buttons call `ydChangeDate(-1/+1)`; `#ydNextDateBtn` starts disabled (can't go past yesterday); ← BACK pill on right using `.ptb-lens` class) + `#yesterdayCard` (content injected by `renderYesterdayRecap()`).
- `#gameTicker` — `position:sticky` below header; horizontal scrollable chip bar
- `#mockBar` — inline (not fixed); shown only when `pulseMockMode` is true
- `#feedWrap > #feedEmpty + #feed` — empty/upcoming state and live play items

**Ticker bar:** All games as scrollable horizontal chips. Sorted: Live (most-progressed inning first) → Preview/Scheduled (by `gameDateMs` asc) → Final (dimmed). Clicking a chip toggles that game's plays in the feed (`enabledGames` Set). Final games with `detailedState` Postponed/Cancelled/Suspended show `PPD` instead of `FINAL`.

**Normal chip layout (v2.13):** Three stacked rows — (1) green live dot + away abbr + away score, (2) invisible dot-spacer + home abbr + home score [spacer aligns both abbreviations on the same left edge], (3) inning/time + out-dot indicators. Out dots: 3 small circles (red outline when empty, filled `#e03030` when recorded); only shown for live games. Live dot is green (`#22c55e`) with a matching green pulse-ring animation — changed from red to avoid clashing with the red out dots.

**Expanded chip layout (v2.13, expanded v2.52):** Fires when **any base is occupied** (`g.onFirst || g.onSecond || g.onThird`) — was RISP-only (`onSecond || onThird`) prior to v2.52. Top row: green live dot + away abbr · score + divider + score · home abbr (horizontal, unchanged). Bottom row: 28×24px base diamond SVG (`baseDiamondSvg()`) + inning + out-dot indicators — all left-aligned with `gap: 6px` (no `justify-content: space-between`). Variable in `renderTicker()` named `hasRunners`; `.has-risp` CSS class retained for styling.

**Feed:** Newest plays at top. Each item shows: coloured team dots + score (meta row), inning + outs, play description, play-type badge (1B/2B/3B/BB/K/E/DP/TP), ⚡ RISP badge, and score badge on scoring plays (scoring side full brightness). Play classification drives visual treatment: `homerun` (strong amber tint + 3px amber left border stripe — visually outranks scoring plays), `scoring` (green tint), `risp` (no border stripe — ⚡ badge and base diamond chip provide sufficient treatment), `status-change` (blue tint, centred — game start/end/delay). **Game Delayed status items (v2.7)** show team abbreviations: "🌧️ Game Delayed — SD @ AZ · Delayed Start".

**Empty state:** When no visible plays exist, `renderEmptyState()` renders a hype block + hero upcoming-game card (3-stop gradient, team caps, countdown timer via `startCountdown()`) + 2-col grid for remaining games. Falls back to plain `⚾ League Pulse` placeholder off-season.

**Mock mode:** Removed in v2.33 — Demo Mode (see below) provides all replay/simulation features. No mock-mode control functions or data remain.

**Player card overlay (v2.7):** When a home run fires (real or mock), `showPlayerCard` renders a baseball-card-style overlay: player headshot from `img.mlbstatic.com` (generic silhouette fallback), name, team abbreviation, dynamic badge (see below), and a stat grid (AVG · OPS · HR with count-up animation from N−1 → N · RBI). A context pill shows "HR #N in SEASON — milestone!" on multiples of 5, or "🏆 HR leader on the team" if `statsCache` confirms it — no extra API calls needed. Card auto-dismisses after 5.5s or on tap/click anywhere. `isHistory` guard prevents cards from firing on initial feed load. In real mode, `statsCache` is checked first; if the player isn't in cache (opponent player), `/people/{id}/stats` is fetched. In mock mode, `overrideStats` bypasses the fetch entirely.

**HR card badge logic (`getHRBadge`, v2.28):** Badge label is computed at the `pollGamePlays` call site using score/inning data and passed as optional 8th parameter `badgeText` to `showPlayerCard`. Priority order:
1. `WALK-OFF GRAND SLAM!` — bottom 9th+, 4 RBIs, batting team was tied/behind, now leads
2. `WALK-OFF HOME RUN!` — bottom 9th+, batting team was tied/behind, now leads
3. `GRAND SLAM!` — 4 RBIs, any other situation
4. `GO-AHEAD HOME RUN!` — batting team was tied/behind, now leads (not walk-off)
5. `💥 HOME RUN!` — fallback (all other cases)

**Key RBI card overlay (v2.28):** For non-HR scoring plays in Pulse, `showRBICard` fires when a scoring play meets a threshold score (≥ 30) derived from a four-component weighted formula. Reuses `#playerCardOverlay`/`#playerCard` and `dismissPlayerCard`. Badge is dynamic (see `getRBIBadge`). Stat grid: AVG · OPS · H · RBI — RBI animates up by `play.result.rbi` (from seasonRBI − rbi → seasonRBI). Context pill shows live score + inning. Auto-dismisses after 5.5s. When card fires, the "🟢 RUN SCORES" toast is suppressed; sound logic is untouched. Per-game cooldown: 90 seconds (`rbiCardCooldowns{}` global).

**Key RBI card scoring formula (`calcRBICardScore`):**
`score = (baseRBI × hitMultiplier + contextBonus) × inningMultiplier`

| Component | Values |
|---|---|
| Base RBI score | 1 RBI → 10, 2 → 25, 3 → 40, 4 → 55 |
| Hit type multiplier | Sac fly/walk/GIDP/FC → 0.7; Single → 1.0; Double → 1.5; Triple → 2.0 |
| Context bonus (additive) | Go-ahead (was tied/behind, now leads) +30; Equalizer (was behind, now tied) +25; Comeback (was down 3+, now within 1 or better) +20; Blowout suppressor (was already leading by 5+) −15 |
| Inning multiplier | Inn 1–3 → 0.4; 4–6 → 0.75; 7–8 → 1.0; 9 → 1.4; 10+ → 1.6 |

**Key RBI badge logic (`getRBIBadge`):** Priority order:
1. `WALK-OFF [EVENT]!` — bottom 9th+, go-ahead
2. `GO-AHEAD [EVENT]!` — batting team was tied/behind, now leads
3. `[EVENT] TIES IT!` — batting team was behind, now tied
4. `[N]-RUN [EVENT]` — 2+ RBIs, no game-state flip
5. `RBI [EVENT]!` — 1 RBI, no game-state flip
6. `RBI!` — event has no clean label (GIDP, FC, etc.)

Event label map: Single → `SINGLE`, Double → `DOUBLE`, Triple → `TRIPLE`, Sac Fly → `SAC FLY`, Walk → `WALK`, HBP → `HBP`.

**Live mode:** `pollLeaguePulse()` fetches all games every 15s. Game-start fires only when `detailedState` transitions to `'In Progress'` (not on warmup). Timestamps stale check (`/api/v1.1/game/{pk}/feed/live/timestamps`) skips the playByPlay fetch when nothing has changed. On first poll, all pre-existing plays load as history with no alerts or sounds (`isHistory` flag), then sorted chronologically across games.

**Historical status items (v2.2/v2.3):** When a game is first added to `gameStates` (initial creation path), a status feed item is synthesised silently based on current state — no sounds or alerts:
- `Final` (non-PPD) → 🏁 "Game Final · AWAY X, HOME Y · Zh Mm" — deferred to `pendingFinalItems`; plays are also fetched for the completed game; item is added at `lastPlay.ts + 60s` so it sorts after the final recorded play. Omitted entirely if no plays are found.
- `Final` + PPD → 🌧️ "Game Postponed" — `playTime` = `gameDateMs`. Suppressed if `Date.now() < gameDateMs` (postponement announced before scheduled start — ticker chip still shows PPD immediately).
- `Live` + `In Progress` → ⚾ "Game underway!" — `playTime` = `gameDateMs`
- `detailedState` contains `'delay'` → 🌧️ "Game Delayed" — `playTime` = `gameDateMs`

These items are only ever added once (subsequent polls use the update path). `pendingFinalItems` games are included in the `pollGamePlays` pass so plays are fetched before the Final item is positioned.

**Feed sort order (v2.3):** `addFeedItem` maintains newest-first order on every insert — both in the `feedItems` array and in the DOM via `data-ts` attributes on each element. Late-arriving plays (old timestamp received in a later poll) are inserted at the correct chronological position instead of floating to the top.

**Sound alerts:** Web Audio API synthesized tones — no external files. Master defaults off. Events: HR (bat crack), Run (bell chime), RISP (heartbeat), DP (glove pops), TP (bugle fanfare), Game Start (organ riff), Game End (descending chime), Error (dirt thud). `playSound(type)` is the single call point — checks `soundSettings.master && soundSettings[type]`.

**Migration notes:** League Pulse was built as standalone `league-pulse.html` (~2370 lines) then merged into `index.html`. Key changes on merge: `mockMode`→`pulseMockMode`, `init()`→`initLeaguePulse()`, `poll()`→`pollLeaguePulse()`; `TC` object replaced by `tcLookup(id)` (wraps `TEAMS.find`, uses `t.short` for abbr); all 6 colour utilities and `applyLeaguePulseTheme()` dropped (index.html copies used); standalone header dropped; mock bar changed from `position:fixed;bottom:0` to inline; sound controls moved into Settings panel. Mock mode itself was removed entirely in v2.33.

Source: `/schedule?sportId=1&date={date}&hydrate=linescore,team,probablePitcher` + `/game/{pk}/playByPlay` + `/api/v1.1/game/{pk}/feed/live/timestamps`

---

#### 📖 Story Carousel — Curated Event Stream (v2.7.1+)

A rotating single-card digest layer surfacing high-level game narratives alongside the play-by-play feed. Not filtered by user's active team — league-wide stories only. Auto-rotates every 20s with manual prev/next controls. Each story has cooldowns so repeats are throttled and decay rates so older stories naturally deprioritise.

**HTML structure:**
- `#storyCarousel` — Container below `#gameTicker`, above `#mockBar`
- `#storyCard` — Single story card with badge, icon, headline, sub
- `.story-controls` — Manual prev/next buttons and progress dots

**Pool sort order (v2.59):** `storyPool` is sorted by `priority` descending after each `buildStoryPool()` call. Manual ‹ › navigation and dots reflect this ranked order (highest priority = first dot). Auto-rotation still uses the `priority × decay` scoring algorithm independently.

**Nav buttons (v2.59):** Edge-mounted `position:absolute` ghost buttons on `.story-card-wrap` — borderless, no background, 45% opacity muted chevrons that fade to full on hover. Half-in/half-out of the card border so they never overlap text.

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

13. **`genYesterdayHighlights()`** — Source: `/schedule?date={yesterday}&hydrate=linescore,boxscore` (fetched once at Pulse init, cached). Filters for Final games (excludes PPD/Cancelled/Suspended). Extracts: W/L pitcher (by `gameStatus.isWinningPitcher` / `isLosingPitcher` flags) with IP/K/ER stats, save pitcher (if exists), top batter (by batting avg), multi-HR hitters. ID: `yday_{gamePk}_{type}`. **Headline:** uses MLB video title from `/game/{pk}/content` `items[0].headline` when available (e.g. "Aaron Judge's homer leads Yankees over Red Sox"); stats line moves to `sub`. Falls back to generated "Yesterday: NYM 5, PHI 2 · W: deGrom…" when content endpoint returns nothing. Priority: 45. Cooldown: 30 min. Shown prominently when <2 live games.

14. **`genProbablePitchers()`** — Source: `scheduleData` (today only) OR `gameStates` fallback. Hydrate param: `probablePitcher`. Filters: `abstractGameState !== 'Final'` AND `localDate === today`. Extracts pitcher names from `g.teams.away/home.probablePitcher.fullName` or "TBD". ID: `probable_{gamePk}`. Headline: "Scherzer [NYM] vs Kershaw [LAD] · 7:05 PM". Priority: 40. Cooldown: 60 min.

15. **`genInningRecapStories()`** — One-shot end-of-inning narrative summaries. Fires exactly once per half-inning when `inning` or `halfInning` changes in `gameStates`. Tracked via `lastInningState` (per-game) and `inningRecapsFired` Set (deduplication). Source: `feedItems` filtered to completed inning's plays. 19 recap templates with priority conflict resolution: HR+runs (100) > perfect K (95) > multi-run (90) > comeback (85) > stranded runners (80) > shutout+Ks (75) > DP escape (70) > walk-heavy (65) > error-led (55) > single run (45) > 1-2-3+Ks (40) > 1-2-3 (25) > fallback (0). Tier-2 stories, no cooldown/decay (one per inning, never repeats). Headlines use full team names and pitcher names where applicable. Sub-line: `"{Team Name} · {Inning number}"`. Metrics extracted: runs scored, strikeouts, walks, HRs, DPs, errors, RISP indicator, clean-inning flag. Console debugging helpers available for manual testing (see "Inning Recap Testing" below).

**Inning Recap Testing (v2.46+):**
View/manipulate inning recaps in browser console:
```javascript
// Check current state
Object.entries(gameStates).filter(([pk,g])=>g.status==='Live').forEach(([pk,g])=>console.log(`${g.awayAbbr} @ ${g.homeAbbr} · ${ordinal(g.inning)} ${g.halfInning} (${g.outs} outs)`));
console.log('lastInningState:', lastInningState);
console.log('inningRecapsFired:', Array.from(inningRecapsFired));

// Manually advance inning (first live game)
var pk=Object.keys(gameStates).find(k=>gameStates[k].status==='Live');
var g=gameStates[pk];
g.halfInning==='top'?g.halfInning='bottom':({g.inning++, g.halfInning='top'}); g.outs=0;
await buildStoryPool();

// Check recaps in pool
storyPool.filter(s=>s.type==='inning_recap').forEach(s=>console.log(`${s.priority}: ${s.headline}`));

// Reset & retry
inningRecapsFired.clear(); await buildStoryPool();
```

**Rotation engine:**

```javascript
// Rotation interval read from devTuning.rotateMs (default 4500ms)

function rotateStory() {
  const now = Date.now();
  
  // Cap effective cooldown relative to pool size so pre-game thin pools
  // don't lock cards out for their full nominal cooldown (e.g. 60 min for
  // probable pitchers when only 3 stories exist). Floor: 2 minutes.
  const maxCooldown = Math.max(storyPool.length * devTuning.rotateMs * 1.5, 2 * 60_000);

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
Called at end of every `pollLeaguePulse()` (every 15s). Generates fresh stories from all 15 generators, merges with existing pool (preserving `lastShown` timestamps), drops stale ones (e.g., walk-offs that resolved). Result: `storyPool` is always up-to-date with current state, and stories never reappear within their cooldown window. Inning recaps are one-shot per inning and tracked separately via `inningRecapsFired` Set.

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
    storyRotateTimer = setInterval(rotateStory, devTuning.rotateMs);
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
Hidden by default — enabled via the **Media Tab → Show in Navigation** toggle inside the Dev Tools panel. Does not persist across page reloads.
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
- **🔔 Game Start Alerts** — slide toggle; subscribes/unsubscribes to push notifications for game starts. **Hidden on desktop via CSS** (`@media(min-width:1025px){ #pushRow { display:none !important } }`) — push is unreliable on desktop browsers. Visible on mobile and tablet (≤1024px) unchanged. The JS functions `isDesktop()`, `updatePushRowVisibility()`, `togglePushOnDesktop()`, and the `devShowPushOnDesktop` variable remain in the codebase but are not called — retained in case a UI toggle is added back later.
- **📻 Live Game Radio** (`#radioRow`) — slide toggle (`id="radioToggle"`); calls `toggleRadio()`; auto-pairs to current focus game's flagship terrestrial radio if the home team (or away as fallback) is in `APPROVED_RADIO_TEAM_IDS`, else falls through to Fox Sports. Status text (`#radioStatusText`) shows current state — see "📻 Live Game Radio System" section below for details. Also toggled from `#ptbRadioBtn` in `#pulseTopBar` (both synced by `setRadioUI()`).
- **🔍 Radio Check** — "Open" button; calls `openRadioCheck()` to show `#radioCheckOverlay` for sweep-testing every station + Fox Sports fallback with per-station ▶/✅/❌/notes. Results persist to localStorage. See "📻 Live Game Radio System" below.
- **🛠️ Dev Tools** — "Open" button (`id="btnDevTools"`); calls `toggleDevTools()` to show/hide the floating `#devToolsPanel` overlay
- Panel closes on click outside
- All settings persist across page reloads via `localStorage` (team, theme, invert, push subscription)
- Version number at bottom (`v2.57.9`)

**Dev Tools panel (`#devToolsPanel`)** — centered modal (`top:50%; left:50%; transform:translate(-50%,-50%); width:380px; max-height:90vh; overflow-y:auto`). Contains:
- **▶ Try Demo / ⏹ Exit Demo** (`Shift+H`) — toggles demo mode via `toggleDemoMode()`; label updates via `updateDemoBtnLabel()`
- **🎬 Replay HR** (`Shift+R`) — calls `replayHRCard()` to replay most recent HR card from live feed
- **💰 Replay RBI** (`Shift+E`) — calls `replayRBICard()` to replay most recent non-HR RBI card from live feed; bypasses cooldown
- **💫 Card Variants** (`Shift+V`) — calls `window.PulseCard.demo()` to cycle through all four HR card template variants
- **🎴 Test Card** (`Shift+G`) — calls `generateTestCard()` to inject one random player card into the collection; bypasses demo mode guard via `force=true`; pool is `rosterData.hitting` (no pitchers) + hitting leaders from `leagueLeadersCache.hitting` and `dailyLeadersCache` (deduplicated, cross-team colors resolved via TEAMS); falls back to active team roster if leader caches are empty
- **📽️ Test Clip** (`Shift+W`) — calls `devTestVideoClip()`; opens `#videoOverlay` with a real MLB clip. Fallback chain: `lastVideoClip` (most recent live match) → `yesterdayContentCache` (populated when Yesterday Recap is opened) → fetches yesterday's first game content on the fly
- **Media Tab → Show in Navigation** — slide toggle; calls `toggleMedia()`; shows/hides the Media nav button and section
- ~~Push Alerts → Show on Desktop~~ — removed; desktop hide is now CSS-only (`#pushRow { display:none }` at ≥1025px)
- **⚡ Pulse Tuning** (`<details>` collapsible) — numeric inputs for `devTuning` (do **not** apply on keystroke — require Confirm Changes):
  - *Carousel Rotation (ms)* — `devTuning.rotateMs`; default 4500
  - *RBI Card Threshold* — `devTuning.rbiThreshold`; default 10
  - *RBI Cooldown (ms)* — `devTuning.rbiCooldown`; default 90000
  - Reset to Defaults button resets `devTuning` + repopulates inputs immediately
- **📖 Carousel Story Rules** (`<details>` collapsible) — numeric inputs (require Confirm Changes):
  - *Home Run* — Priority (`hr_priority`; default 100) + Cooldown ms (`hr_cooldown`; default 300000)
  - *Big Inning* — Priority (`biginning_priority`; default 75) + Runs Threshold (`biginning_threshold`; default 3)
  - *Walk-Off Threat* — Priority (`walkoff_priority`; default 90)
  - *No-Hitter Watch* — Inning Floor (`nohitter_inning_floor`; default 6)
  - *Bases Loaded* — Enable checkbox (`basesloaded_enable`; default true, **immediate**) + Priority (`basesloaded_priority`; default 88)
- **🎯 Focus Mode Tuning** (`<details>` collapsible) — numeric inputs (require Confirm Changes):
  - *Badge Thresholds* — CRITICAL score ≥ (`focus_critical`; default 120) + HIGH score ≥ (`focus_high`; default 70); scores below HIGH show NORMAL
  - *Auto-Switch Alert* — Switch margin in points (`focus_switch_margin`; default 25; rival game must score this many pts higher to trigger a suggestion) + Alert cooldown ms (`focus_alert_cooldown`; default 90000)
  - `getTensionInfo()` and `selectFocusGame()` both read these values — changes take effect on the next poll (within 5s)
- **🎨 Theme Tuning** (`<details>` collapsible) — color pickers for App Theme (Primary, Secondary, Dark BG, Card BG) and Pulse Theme (Dark BG, Card BG); Copy button captures current live CSS vars into pickers; Lock Theme checkbox (`devColorLocked`) disables auto-switching when team changes. Color pickers apply **immediately** (live preview); Lock Theme checkbox is **immediate**.
- **Confirm Changes** — sticky footer button; reads all numeric inputs from Pulse Tuning + Carousel Story Rules + Focus Mode Tuning and calls `updateTuning()` for each; flashes green "✓ Applied!" for 1.5s. Binary toggles (checkboxes, on/off knobs, color pickers) apply immediately without needing Confirm.
- ✕ close button (`.debug-close` — styled with border + 14px h-padding for easy tap target); also closes on click outside

---

## Key Functions Reference

| Function | Purpose |
|---|---|
| `applyPulseMLBTheme()` | Sets `--p-dark`, `--p-card`, `--p-card2`, `--p-border`, `--p-accent*`, `--p-text`, `--p-muted`, `--p-scoring/hr/status-*` globals from active `PULSE_SCHEME` entry. `#pulse`/`#yesterday` CSS blocks remap them to `--dark`/`--card` etc. via `var(--p-*)` scoping. Also sets `--dark` globally for body background. Respects `devColorLocked`. |
| `setPulseColorScheme(scheme)` | Sets `pulseColorScheme`, persists to `localStorage('mlb_pulse_scheme')`, calls `applyPulseMLBTheme()` + `updatePulseToggle()`. |
| `updatePulseToggle()` | Updates `#ptbSchemeBtn` (toggles `.on` CSS class) and `#ptbSchemeIcon` text (☀️ for light, 🌙 for dark) to reflect current `pulseColorScheme`. Settings slide-toggle elements (`#pulseSchemeToggle`/`#pulseSchemeKnob`) removed in v3.26. |
| `applyTeamTheme(team)` | Sets 9 CSS vars (--primary, --secondary, --accent, --header-text, --accent-text, --dark, --card, --card2, --border), persists to localStorage.mlb_theme_vars, updates logo, page title, theme-color meta, and `.team-chip` text. In `themeScope==='nav'` mode, sets body/page vars from `MLB_THEME` neutral colors and scopes team vars to `<header>` element only. |
| `switchThemeScope(val)` | Sets `themeScope` ('full'\|'nav'), persists to `localStorage('mlb_theme_scope')`, calls `applyTeamTheme(activeTeam)`. Wired to Theme Scope dropdown in Settings. |
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
| `forceHttps(url)` | Replaces `http:` with `https:` on a URL string; returns the original value unchanged if falsy. Applied to all news image URLs before rendering to prevent mixed-content browser warnings. |
| `pickAccent(secondaryHex, cardHex)` | Returns contrast-safe `--accent` value for a team |
| `pickHeaderText(primaryHex)` | Returns `#0a0f1e` or `#ffffff` for header text |
| `pickOppColor(oppPrimary, oppSecondary, myPrimary)` | Added v3.30.12. Returns the opp color most distinct from the user's effective primary so the opp tint on Next Game card always reads as "different team". RGB Euclidean distance threshold 60 — falls back to opp secondary when oppPrimary too close (e.g., Cubs blue vs Mets blue). When both opp colors are too close (e.g., Yankees navy/navy vs Mets blue), keeps oppPrimary unchanged for graceful degrade. |
| `capImgError(el, primary, secondary, letter)` | `onerror` handler — swaps broken logo img to fallback SVG circle |
| `teamCapImg(teamId, name, primary, secondary, cls)` | Returns `<img>` tag for team cap logo with fallback |
| `selectLeaderPill(group, stat, btn)` | Sets leader stat select + active pill, calls `loadLeaders()` |
| `togglePush()` | Reads current push state, calls subscribe or unsubscribe, updates toggle UI |
| `subscribeToPush()` | Registers push subscription via PushManager, POSTs to `/api/subscribe`, saves `mlb_push` to localStorage |
| `unsubscribeFromPush()` | Unsubscribes PushManager, DELETEs from `/api/subscribe`, removes `mlb_push` from localStorage |
| `urlBase64ToUint8Array(b64)` | Converts VAPID public key from URL-safe base64 to Uint8Array for PushManager |
| `tcLookup(id)` | Returns `{ primary, abbr, name }` for a team ID by wrapping `TEAMS.find()`; replaces the standalone `TC` object from the League Pulse prototype. `abbr` maps to `t.short`. |
| `initLeaguePulse()` | Pulse entry point — calls `initReal()` directly (mock mode removed in v2.33) |
| `initReal()` | Hides mock bar, loads roster + caches, calls `pollLeaguePulse()`, sets 15s poll interval |
| `isDesktop()` | **Retained but uncalled (v2.57.11).** Was used to hide 🔔 push row on desktop; replaced by CSS `@media(min-width:1025px){ #pushRow{display:none!important} }`. Kept in case a UI toggle is re-added. |
| `updatePushRowVisibility()` | **Retained but uncalled (v2.57.11).** Was called on page load and from `togglePushOnDesktop()` to show/hide `#pushRow`. Superseded by CSS media query. |
| `togglePushOnDesktop()` | **Retained but uncalled (v2.57.11).** Was wired to a Dev Tools toggle; Dev Tools toggle was removed. Superseded by CSS media query. |
| `confirmDevToolsChanges()` | Reads all numeric Dev Tools inputs (Pulse Tuning + Carousel Story Rules + Focus Mode Tuning) and calls `updateTuning()` for each; flashes "✓ Applied!" green on the button for 1.5s |
| `toggleDevTools()` | Shows/hides `#devToolsPanel`; on open, populates all tuning inputs (Pulse Tuning + Carousel Story Rules + Focus Mode Tuning + Theme Tuning) from live `devTuning`/`devColorLocked` values. Uses `p.style.display !== 'block'` (not `=== 'none'`) to detect closed state — panel starts with CSS display:none (no inline style), so checking for 'none' would fail on first open. |
| `updateTuning(param, val)` | Generic handler for all `devTuning` fields — handles `basesloaded_enable` as boolean, all others as int; restarts `storyRotateTimer` at new `devTuning.rotateMs` when `rotateMs` changes |
| `updateColorOverride(context, colorVar, value)` | Stores a color picker change into `devColorOverrides[context][colorVar]`; if `devColorLocked`, immediately re-applies the relevant theme function |
| `captureCurrentTheme(context)` | Reads all nine CSS vars from `document.documentElement` and writes them into `devColorOverrides[context]` + updates the color picker inputs |
| `toggleColorLock(enable)` | Sets `devColorLocked`; on enable captures both app + pulse themes if not yet captured; calls `applyTeamTheme`/`applyPulseMLBTheme` to apply or release the lock |
| `pollLeaguePulse()` | Fetches schedule, updates `gameStates` (incl. `detailedState`, base runners), fires game-start/delay/final/postponed events. On initial game creation synthesises historical status items (no sounds). Runs `Promise.all(pollGamePlays)` for live games **and** completed games with pending Final items; positions 🏁 item after last play. Sorts feed on first poll. |
| `pollGamePlays(gamePk)` | Timestamps stale check → if changed, fetches `/playByPlay`, uses `isHistory` flag to suppress alerts/sounds for pre-existing plays |
| `renderTicker()` | Sorts `gameStates` and rebuilds sticky ticker HTML; expanded chip with base diamond SVG when any runner on (`g.onFirst \|\| g.onSecond \|\| g.onThird`) — variable `hasRunners` (v2.52) |
| `updateHeader()` | No-op stub — call sites retained in mock/poll loops but body is empty (controls bar was removed) |
| `baseDiamondSvg(on1,on2,on3)` | Returns 28×24px inline SVG diamond; occupied bases lit amber with glow |
| `startCountdown(targetMs)` | 30s interval updating `#heroCountdown` with "First pitch in Xm" / "Starting now" |
| `toggleGame(gamePk)` | Adds/removes gamePk from `enabledGames`, applies `feed-hidden` to DOM items, calls `updateFeedEmpty` + `renderTicker` |
| `addFeedItem(gamePk, data)` | Inserts item into `feedItems` array and DOM in correct newest-first position (via `data-ts` attribute lookup); applies `feed-hidden` if game is disabled |
| `buildFeedEl(item)` | Builds DOM element for a feed item — status-change items (game start/end/delay) or play items (with play-type badge, RISP badge, score badge) |
| `updateFeedEmpty()` | Checks for visible feed items; calls `renderEmptyState()` if none; shows/hides `#feedEmpty`. Controls `#ptbYestBtn` visibility (shows only during live-feed state, not hype/post-slate/intermission — single authoritative source). `showHype = (!hasVisible&&!(myTeamLens&&hasLiveInProgress))\|\|(!hasAnyGames)\|\|postSlate\|\|intermission` where `hasLiveInProgress = gameStates values with status==='Live'&&detailedState==='In Progress'`. `hideWhenEmpty` array: `['gameTicker','sideRailNews','sideRailGames','myTeamLensBtn']`. |
| `renderEmptyState()` | Renders hype block + hero upcoming-game card (gradient, caps, countdown) + 2-col grid, or plain placeholder if no upcoming games |
| `fetchBoxscore(gamePk)` | Async cache helper — returns `boxscoreCache[gamePk]` if populated, otherwise fetches `/game/{pk}/boxscore`, stores result, and returns it. Returns `null` on network error. Used by genMultiHitDay, loadOnThisDayCache, loadYesterdayCache, showPlayerCard, showRBICard. |
| `resolvePlayerCardData(batterId, batterName, awayTeamId, homeTeamId, halfInning, overrideStats, descHint, gamePk)` | Async — resolves all data needed to render an HR player card: stats (`statsCache` → live API fetch → `overrideStats`), jersey number and position (rosterData → boxscore fallback via `fetchBoxscore` for opposing players). Returns a plain data object; no DOM side effects. |
| `showPlayerCard(batterId, batterName, awayTeamId, homeTeamId, halfInning, overrideStats, descHint, badgeText, gamePk)` | Shows HR player card overlay. Opens overlay with loading state, awaits `resolvePlayerCardData()`, then renders via `window.PulseCard.render()`. AVG/OPS/HR count-up animation. Auto-dismisses after 5.5s. |
| `dismissPlayerCard()` | Adds `.closing` animation class, hides overlay after 280ms. Also bound to overlay click/tap. Shared by both HR and RBI cards. |
| `getHRBadge(rbi, halfInning, inning, aScore, hScore)` | Returns dynamic badge label for HR card. Priority: WALK-OFF GRAND SLAM → WALK-OFF HOME RUN → GRAND SLAM → GO-AHEAD HOME RUN → 💥 HOME RUN (fallback). Computed at `pollGamePlays` call site and passed as `badgeText`. |
| `calcRBICardScore(rbi, event, aScore, hScore, inning, halfInning)` | Returns weighted importance score (0–∞) for a non-HR scoring play. Score ≥ `devTuning.rbiThreshold` (default 10) triggers `showRBICard`. Components: base RBI score × hit-type multiplier + context bonus (go-ahead/equalizer/comeback/blowout-suppressor) × inning multiplier. |
| `getRBIBadge(rbi, event, halfInning, inning, deficitBefore, marginAfter)` | Returns dynamic badge label for RBI card. Priority: WALK-OFF EVENT → GO-AHEAD EVENT → EVENT TIES IT → N-RUN EVENT → RBI EVENT → RBI (fallback). |
| `showRBICard(batterId, batterName, awayTeamId, homeTeamId, halfInning, rbi, event, aScore, hScore, inning, gamePk)` | Shows key RBI card overlay (reuses `#playerCardOverlay`). Fetches hitting stats, renders headshot + dynamic badge + AVG/OPS/H/RBI (RBI animates +N). Jersey/position resolved from rosterData; falls back to `fetchBoxscore(gamePk)` for opposing players. Context pill shows live score + inning. Suppresses run toast when fired; 90s per-game cooldown via `rbiCardCooldowns{}`. |
| `showAlert(opts)` | Creates and stacks a `position:fixed` toast; auto-dismisses after `opts.duration` ms. Not fired for HR events — player card replaces it. |
| `dismissAlert(el)` | Adds `.dismissing` class, removes element after 300ms transition |
| `toggleSoundPanel()` | Shows/hides `#soundPanel` overlay |
| `setSoundPref(key, val)` | Updates `soundSettings[key]`; master toggle also applies `.master-off` to `#soundRows` |
| `playSound(type)` | Checks `soundSettings.master && soundSettings[type]`, calls appropriate `playXxxSound()` |
| `_makeCtx()` / `_closeCtx()` / `_osc()` / `_ns()` | Web Audio primitives — shared by all Pulse sound functions |
| `genStolenBaseStories()` | Generates 💨/🏃 carousel story cards from `stolenBaseEvents[]`; tier-1 for steal of home (priority 85), tier-2 for 2B/3B steals (priority 55); one story per steal event (stable `sb_{gamePk}_{atBatIndex}` ID); never adds to feed |
| `updateInningStates()` | Called post-poll; placeholder for inning transition detection (logic in `genInningRecapStories`) |
| `genInningRecapStories()` | Generates one-shot end-of-inning recap cards. **Primary path (v2.59):** processes `inningRecapsPending{}` keys queued by `pollGamePlays()` at `outs===3` — fires immediately when the inning ends with feedItems fully populated. **Fallback path:** `lastInningState` linescore transition detection for edge cases (zero-play innings, isHistory catch-up). Inner `genRecap(g, recapInning, recapHalf, recapKey)` closure shared by both paths. `inningRecapsFired` Set deduplicates across paths. 19 templates with priorities 0–100. Tier-2, no cooldown/decay. |
| `replayRBICard(itemIndex)` | Dev tool — scans `feedItems` for most recent non-HR scoring play, calls `showRBICard()` directly (bypasses cooldown). `itemIndex` optional (0 = most recent). Callable from console or `Shift+E`. |
| `openVideoOverlay(url, title)` | Shows `#videoOverlay` (z-index 800) with the given MP4 URL and title string. Sets `<video src>`, calls `play()`. Backdrop click or ✕ button calls `closeVideoOverlay()`. |
| `closeVideoOverlay()` | Pauses and clears `#videoOverlayPlayer` src, hides `#videoOverlay`. |
| `devTestVideoClip()` | Dev tool — opens video overlay using fallback chain: `lastVideoClip` → `yesterdayContentCache` → fetch yesterday's first game. Wired to `Shift+W` and Dev Tools panel. |
| `pollPendingVideoClips()` | Background poll (every 2min, started by `initReal()`). Groups `pendingVideoQueue` by gamePk, fetches `/game/{pk}/content` (cached in `liveContentCache`, re-fetched if >5min stale), matches clips via `keywordsAll[player_id]` + clip date ≥ play timestamp. On match: sets `lastVideoClip`, calls `patchFeedItemWithClip` + `patchStoryWithClip`, removes from queue. |
| `patchFeedItemWithClip(feedItemTs, gamePk, clip)` | Finds the HR feed item DOM node via `data-ts` + `data-gamepk`, appends a thumbnail + ▶ overlay div. Clicking opens `openVideoOverlay()`. Guards against double-patching via `el.dataset.clipPatched`. |
| `patchStoryWithClip(gamePk, batterId, batterName, clip)` | Finds the matching HR story in `storyPool` by gamePk + batter last name in headline. Sets `story.videoUrl`, `story.videoThumb`, `story.videoTitle`. If that story is currently displayed (`storyShownId === story.id`), calls `renderStoryCard()` immediately to show the ▶ WATCH pill. |
| `calcFocusScore(g)` | Returns a numeric tension score for a live game object from `gameStates`. Formula: closeness (0–60) + situation bonus (runners/RISP/bases-loaded/walk-off/no-hitter) + count bonus (full count +20, 2-strike +12, 2-out +8) × inning multiplier (0.6 early → 2.0 extras). Higher = more exciting. Used by `selectFocusGame()` to auto-pick the best game. |
| `selectFocusGame()` | Evaluates all live games via `calcFocusScore()`. If a non-focused game scores ≥20pts higher, fires a soft alert via `showFocusAlert()`. On first call with no focused game, calls `setFocusGame()` with the top scorer. Hooked into end of `pollLeaguePulse()`. |
| `setFocusGame(pk)` | Switches focus to `gamePk pk`. Resets `focusPitchSequence`, `focusCurrentAbIdx`, player stats, dismisses any open alert. If overlay is open, re-renders it. Starts `pollFocusLinescore()` immediately and schedules it every 5s via `focusFastTimer`. Does not modify `focusIsManual` — callers control that flag. |
| `setFocusGameManual(pk)` | User-initiated game switch from compact switcher chips. Sets `focusIsManual=true` then calls `setFocusGame(pk)`. Causes `↩ AUTO` pill to appear in `#focusCard` and `#focusMiniBar`. |
| `resetFocusAuto()` | Clears `focusIsManual=false`, re-scores all live `In Progress` games via `calcFocusScore()`, calls `setFocusGame()` with the highest scorer. Wired to the sky-blue (`#7dd3fc`) `↩ AUTO` pill in both compact views — sky blue chosen to be positive but non-intrusive (avoids clash with the green run/score color). |
| `pollFocusLinescore()` | Fetches `/game/{pk}/linescore` (Tier 1, ~5KB). Updates `focusState` with balls/strikes/outs/inning/halfInning/runners/score/matchup names/team colors. Computes `tensionLabel`/`tensionColor` via `calcFocusScore`. Seeds `batterStats`/`pitcherStats` from `focusStatsCache` immediately; calls `fetchFocusPlayerStats()` async for new players. Calls `pollFocusRich()` for pitch sequence, then `renderFocusCard()` and `renderFocusOverlay()`. |
| `pollFocusRich()` | Fetches `/api/v1.1/game/{pk}/feed/live` (Tier 2 GUMBO, ~500KB) every 5s unconditionally (no timestamp stale check — timestamps only change per completed play, not per pitch). Reads `liveData.plays.currentPlay.playEvents`, filters to pitch events (`isPitch` or `type==='pitch'`), populates `focusPitchSequence[]`. Detects new at-bat via `cp.about.atBatIndex` change and resets sequence. Updates `focusState.lastPitch`. Skipped in `demoMode`. |
| `fetchFocusPlayerStats(batterId, pitcherId)` | Session-cached stat fetcher. Checks `focusStatsCache` before fetching. Batter: `/people/{id}/stats?group=hitting` → `{avg,obp,ops,hr,rbi}`. Pitcher: `/people/{id}/stats?group=pitching` → `{era,whip,wins,losses}`. On new data, copies into `focusState.batterStats`/`.pitcherStats` and re-renders overlay. Skipped in `demoMode`. |
| `renderFocusCard()` | Passes `{...focusState, isManual:focusIsManual, allLiveGames:[...]}` (awayPrimary/homePrimary included, no scores) to `window.FocusCard.renderCard()` and injects into `#focusCard`. Shows card when `focusGamePk` is set, hides otherwise. |
| `renderFocusOverlay()` | Calls `window.FocusCard.renderOverlay({...focusState, pitchSequence:focusPitchSequence, allLiveGames:[...]})` and injects into `#focusOverlayCard`. `allLiveGames` built from `gameStates` (Live only, current game flagged `isFocused:true`). Large overlay unchanged from v2.61. |
| `renderFocusMiniBar()` | Renders a score strip + optional second row into `#focusMiniBar` (phone/iPad portrait). Top row: score, inning/count/outs, FOCUS → button. Second row (when >1 live game or `focusIsManual`): `↩ AUTO` pill + `AWY@HME` chips for all live games. Hidden on desktop/iPad landscape via CSS. |
| `openFocusOverlay()` | Sets `focusOverlayOpen=true`, shows `#focusOverlay` (`display:flex`), calls `renderFocusOverlay()`. |
| `closeFocusOverlay()` | Sets `focusOverlayOpen=false`, hides `#focusOverlay` (`display:none`). |
| `showFocusAlert(pk, reason)` | Fires a dismissible soft-alert banner in `#focusAlertStack` suggesting a game switch. Checks `focusAlertShown[pk]` 90s cooldown. Auto-dismisses after 8s. |
| `dismissFocusAlert()` | Clears the focus alert from `#focusAlertStack`. Called on manual dismiss, on `setFocusGame()`, and on overlay open. |
| `loadCollection()` | Parses `mlb_card_collection` from localStorage, returns plain object keyed by `{playerId}_{HR\|RBI}`. Returns `{}` on parse error. |
| `saveCollection(obj)` | JSON.stringify + localStorage.setItem for `mlb_card_collection`. |
| `getCardTier(badge, eventType, rbi)` | Returns tier string (`'common'`\|`'rare'`\|`'epic'`\|`'legendary'`) from badge text, event type, and optional rbi count. HR: badge text drives tier (WALK-OFF GRAND SLAM → legendary, GRAND SLAM/WALK-OFF → epic, GO-AHEAD → rare, else common). RBI: WALK-OFF + rbi≥2 → legendary, WALK-OFF or rbi≥3 → epic, GO-AHEAD/TIES IT → rare, else common. |
| `tierRank(t)` | Returns integer 1–4 for tier comparison: legendary=4, epic=3, rare=2, common=1. Returns 0 for unknown. |
| `collectCard(data, force)` | Main collection entry point. Computes tier, checks existing slot in localStorage, applies upgrade/append/no-op rule. Sets `lastCollectionResult` before any guard. `force=true` bypasses `demoMode` guard (used by `generateTestCard()`). In demo mode without force: simulates what would happen, sets `lastCollectionResult`, then returns without persisting. Calls `showCollectedToast()` and `updateCollectionUI()` after each successful collect. |
| `showCollectedToast(type, name, eventType, tier)` | 2s fixed pill at bottom: "🎴 New card — Judge HR" / "⬆ Upgraded — Judge HR → Epic" / "✓ Already have Judge". Animates via `toastPop` CSS keyframes. |
| `updateCollectionUI()` | Updates `#collectionCountLabel` in settings row + re-renders `#collectionRailModule`. |
| `openCollection()` | Sets `#collectionOverlay` to `display:flex`, calls `renderCollectionBook()`. |
| `closeCollection()` | Sets `#collectionOverlay` to `display:none`. |
| `renderCollectionBook()` | Builds sorted/filtered slots array, picks a random `displayEvent` per slot, fetches career stats for visible slots in parallel via `fetchCareerStats()`, sets `collectionSlotsDisplay[]` snapshot, injects `window.CollectionCard.renderBook()` HTML into `#collectionBook`. Sort modes: `newest` (by `collectedAt` desc), `rarity` (by `tierRank` desc then `collectedAt`), `team` (one team per page — `collectionPage` acts as team index through sorted unique `teamAbbr[]`; builds `teamContext` for visual layer). |
| `renderCollectionRailModule()` | Calls `window.CollectionCard.renderRailModule(totalCount)` and injects into `#collectionRailModule`. |
| `flashCollectionRailMessage()` | Called by `dismissPlayerCard()` to show collect outcome in rail. Reads `lastCollectionResult`, clears it, renders a tier-colored pill (new/upgrade/dup message with player last name + event type) into `#collectionRailModule`; auto-reverts to normal rail module after 4s via `setTimeout(renderCollectionRailModule, 4000)`. No-op if `lastCollectionResult` is null. |
| `fetchCareerStats(playerId, position)` | Async — checks `collectionCareerStatsCache[playerId]` first. Fetches `/people/{id}/stats?stats=career&group=hitting` (or `pitching` for pitchers: SP/RP/CP). Hitters return `{ careerHR, careerAVG, careerRBI, careerOPS }`; pitchers return `{ careerERA, careerWHIP, careerW, careerK }`. Stores result in cache. Returns `null` on error. |
| `openCardFromCollection(idx)` | Looks up `collectionSlotsDisplay[idx]`, picks a random event from `slot.events[]`, resolves team IDs from TEAMS, then calls `showPlayerCard()` for HR slots or `showRBICard()` for RBI slots. Leaves binder open — `#playerCardOverlay` (z-index 600) renders above binder (z-index 500). Maps `collectionCareerStatsCache` fields to MLB API field names (`careerHR→homeRuns`, `careerAVG→avg`, etc.) for `overrideStats`. Passes `_position` hint so `resolvePlayerCardData()` can use it for opposing players not in `rosterData`. |
| `filterCollection(f)` | Sets `collectionFilter`, resets `collectionPage=0`, calls `renderCollectionBook()`. |
| `sortCollection(s)` | Sets `collectionSort`, resets `collectionPage=0`, calls `renderCollectionBook()`. |
| `goCollectionPage(dir)` | Increments/decrements `collectionPage`. In team sort: navigates through sorted unique `teamAbbr[]` (clamps 0 to teamCount−1). In other sorts: navigates through 9-card pages (clamps 0 to totalPages−1). Calls `renderCollectionBook()`. |
| `generateTestCard()` | Dev tool — builds a hitters-only pool from `rosterData.hitting` + hitting leaders from `leagueLeadersCache.hitting` (League tab) and `dailyLeadersCache` (Pulse polling), deduplicated by player ID. Team colors for non-roster players resolved via `TEAMS.find(t.id)`. Picks random `eventType` (HR/RBI) and `tier` (weighted toward common), maps tier→badge text, calls `collectCard({...}, true)` with `force=true` to bypass demo guard. Toasts gracefully if no roster loaded. Bypasses all Pulse card/feed/sound/alert flows — only calls `collectCard()`. |
| `pickRadioForFocus()` | Returns `{teamId, abbr, name, url, format}` for the radio source to play. Checks `gameStates[focusGamePk]` home team first, then away — both **gated on `APPROVED_RADIO_TEAM_IDS.has(teamId)`** in addition to `MLB_TEAM_RADIO[teamId]` existing. Falls through to `FALLBACK_RADIO` (Fox Sports) when no focus game OR neither team is approved. Pure function — no DOM side effects. |
| `toggleRadio()` | Slide toggle entry — if `radioAudio` is playing, calls `stopRadio()`; else `startRadio()`. |
| `startRadio()` | Calls `loadRadioStream(pickRadioForFocus())`. |
| `loadRadioStream(pick)` | Tears down any prior `radioHls` instance, creates `<audio>` if needed, sets `radioCurrentTeamId`, then routes to Hls.js (if `format==='hls'` and `Hls.isSupported()`), Safari native HLS (`audio.canPlayType('application/vnd.apple.mpegurl')`), or plain `<audio>` (direct AAC/MP3). Calls `setRadioUI(true, pick)` on play, `handleRadioError` on failure. |
| `stopRadio()` | Pauses audio, destroys `radioHls`, clears `radioCurrentTeamId`, calls `setRadioUI(false, null)`. |
| `handleRadioError(err)` | Console error + `alert()` + `setRadioUI(false, null)`. |
| `setRadioUI(on, pick)` | Updates `#radioToggle` background colour, knob position, and `#radioStatusText` content. Also syncs `#ptbRadioBtn` via `.on` class toggle. On: green knob right + "Playing · ABBR · Station Name" or "Playing · Fox Sports Radio". Off: bordered knob left + "Off · Auto-pairs to focus game". Both Settings toggle and top-bar button are kept in sync by this single function. |
| `updateRadioForFocus()` | Hooked into `setFocusGame(pk)` (`index.html:3106`). When `radioAudio` is playing, calls `pickRadioForFocus()` and reloads stream if `pick.teamId !== radioCurrentTeamId`. Silent no-op when audio is paused (preserves user's "off" intent across focus shifts). |
| `openRadioCheck()` | Loads results+notes from localStorage, shows `#radioCheckOverlay`, calls `renderRadioCheckList()`, closes Settings panel. |
| `closeRadioCheck()` | Hides overlay, calls `radioCheckStop()`. |
| `radioCheckEntries()` | Builds entry array — all `MLB_TEAM_RADIO` teams (sorted by team name) + Fox Sports fallback appended last. Each entry: `{key, teamId, teamName, abbr, station, url, format}`. |
| `renderRadioCheckList()` | Renders all entries into `#radioCheckList`. Per-row: ▶ play button, name + station, ✅ / ❌ status buttons (tap-to-clear via `radioCheckSet`), notes `<input>` bound to `radioCheckSetNote` on `oninput`. Header shows "N of M checked" running count. |
| `radioCheckPlay(key)` | Sets `radioCheckPlayingKey`, calls `loadRadioStream(...)` for the row's URL. **Bypasses** `APPROVED_RADIO_TEAM_IDS` gate — testing path. |
| `radioCheckStop()` | Clears `radioCheckPlayingKey`; if audio is playing calls `stopRadio()`; re-renders list. |
| `radioCheckSet(key, val)` | If `radioCheckResults[key] === val`, **deletes** the entry (toggle off); else sets `radioCheckResults[key] = val`. Saves + re-renders. Prevents accidental status lock-in from a stray tap. |
| `radioCheckSetNote(key, val)` | Sets/deletes `radioCheckNotes[key]` and saves. **No re-render** so the textarea cursor doesn't jump on every keystroke. |
| `radioCheckReset()` | Clears both `radioCheckResults` and `radioCheckNotes` + saves both + re-renders. |
| `radioCheckCopy()` | Builds categorised markdown (✅ Works / ❌ Broken / ⏳ Untested) with per-station notes interleaved as `📝 …` indented lines; writes to clipboard via `navigator.clipboard.writeText()`, falls back to `fallbackCopy()`. Flashes "✓ Copied!" on the button for 1.8s. |
| `fallbackCopy(text)` | Hidden `<textarea>` + `document.execCommand('copy')` clipboard fallback for browsers without `navigator.clipboard`. |
| `getYdActiveCache()` | Returns `ydDisplayCache` when non-null (user has navigated to a non-yesterday date), otherwise `yesterdayCache`. All Yesterday Recap rendering functions route through this so they always show data for the currently-selected date. |
| `loadYdForDate(dateStr)` | Async — fetches schedule + boxscore + playByPlay for `dateStr` (YYYY-MM-DD), builds and returns an array of cache items (same shape as `yesterdayCache` entries but without "Yesterday: " headline prefix). Used by both `loadYesterdayCache()` and `ydChangeDate()`. |
| `ydChangeDate(dir)` | Increments/decrements `ydDateOffset` by `dir` (-1 or +1). Guards: blocks navigation to today/future (offset ≥ 0) and > 365 days back. Updates `#ydDateLabel`, toggles `#ydNextDateBtn` disabled state, shows loading state, calls `loadYdForDate()` into `ydDisplayCache` (or clears it when returning to -1), then calls `renderYesterdayRecap()`. |

---

## 🎯 At-Bat Focus Mode (added v2.61)

Live pitch-by-pitch tracker that fills the 1–10 min silence between completed plays. Auto-selects the most exciting game in progress and surfaces pitch type, speed, and result in real time.

### HTML structure

- `#focusCard` — compact card at top of `#sideRail` (desktop/iPad landscape only); `display:none` until a live game is selected
- `#focusMiniBar` — slim one-line strip below `#gameTicker` inside `#pulseLeft`; visible on phone (≤480px) and iPad portrait (481–1024px); hidden on desktop/iPad landscape (`@media(min-width:1025px) { display:none !important }`)
- `#focusOverlay` — `position:fixed` full-screen modal (`z-index:1100`); backdrop click on the `#focusOverlay` div (not `#focusOverlayCard`) closes it
- `#focusOverlayCard` — inner scroll container (`max-width:520px; max-height:90vh; overflow-y:auto`); custom 4px dark navy scrollbar via webkit + Firefox `scrollbar-width:thin`
- `#focusAlertStack` — `position:fixed` soft-alert banner area for game-switch suggestions

### Data flow

```
pollLeaguePulse() (15s)
  └─ selectFocusGame()           — scores all live games, may call setFocusGame() or showFocusAlert()

setFocusGame(pk)
  └─ pollFocusLinescore()        — fires immediately, then every 5s via focusFastTimer
       ├─ /game/{pk}/linescore   — Tier 1 (~5KB): B/S/O, inning, runners, score, batter/pitcher IDs+names
       ├─ fetchFocusPlayerStats()— async, session-cached; skipped if both players already in focusStatsCache
       ├─ pollFocusRich()        — Tier 2 GUMBO (~500KB): pitch-by-pitch for current at-bat
       │    └─ /api/v1.1/game/{pk}/feed/live
       │         └─ liveData.plays.currentPlay.playEvents (filter isPitch)
       ├─ renderFocusCard()      — window.FocusCard.renderCard(focusState) → #focusCard
       ├─ renderFocusMiniBar()   — slim strip → #focusMiniBar
       └─ renderFocusOverlay()   — window.FocusCard.renderOverlay({...focusState, pitchSequence, allLiveGames}) → #focusOverlayCard (only if overlay open)
```

**GUMBO fetch strategy:** No timestamp stale check — `/feed/live/timestamps` only updates on completed plays, not per pitch. GUMBO is fetched unconditionally every 5s. At ~500KB per call this is acceptable for a single focused game.

**At-bat reset:** `focusCurrentAbIdx` tracks `cp.about.atBatIndex`. When it changes (new at-bat), `focusPitchSequence` is cleared and `focusState.lastPitch` is set to null.

### Focus Score Formula (`calcFocusScore`)

```javascript
function calcFocusScore(g) {
  var diff = Math.abs(g.awayScore - g.homeScore);
  var closeness = diff===0?60:diff===1?45:diff===2?25:5;
  var runners = (g.onFirst?1:0)+(g.onSecond?1:0)+(g.onThird?1:0);
  var isRISP = g.onSecond||g.onThird;
  var isBL = g.onFirst&&g.onSecond&&g.onThird;
  var isWalkoff = g.halfInning==='bottom'&&g.inning>=9&&
                  (g.awayScore-g.homeScore)<=runners+1&&g.awayScore>=g.homeScore;
  var isNoHit = g.inning>=6&&(g.awayHits===0||g.homeHits===0);
  var situation = isBL?40:isRISP?25:runners>0?15:0;
  if(isWalkoff) situation+=50;
  if(isNoHit) situation+=30;
  var countBonus=0;
  if(g.gamePk===focusGamePk){
    if(focusState.balls===3&&focusState.strikes===2) countBonus=20;
    else if(focusState.strikes===2) countBonus=12;
  }
  if(g.outs===2) countBonus+=8;
  var innMult = g.inning<=5?0.6:g.inning<=8?1.0:g.inning===9?1.5:2.0;
  return (closeness+situation+countBonus)*innMult;
}
```

### Tension labels

| Score | Label | Color |
|---|---|---|
| ≥ 120 | CRITICAL | `#e03030` (red) |
| 70–119 | HIGH | `#f59e0b` (amber) |
| < 70 | NORMAL | `#9aa0a8` (muted) |

### window.FocusCard API (`focusCard.js`)

`focusCard.js` is a standalone IIFE (no imports, no build). It exports `window.FocusCard` with four methods. All rendering is pure HTML string generation — no DOM side effects.

**`renderCard(data)`** — compact side-rail card. Inputs: full `focusState` object. Outputs: HTML string. Shows: team seam, LIVE badge + tension pill + inning, score row with batting indicator, B/S/O pip rows + base diamond, matchup names, last-pitch strip (pitch name + speed + result) or "AT-BAT START — 0 PITCHES", OPEN FOCUS button.

**`renderOverlay(data)`** — full modal card. Same inputs plus `pitchSequence[]` and `allLiveGames[]`. Shows: team seam, topbar (LIVE/inning/tension/close ✕), scoreboard, hero count pips + diamond, matchup with batter stats (AVG/OPS/HR/RBI) and pitcher stats (ERA/WHIP/W/L), last-pitch strip, pitch sequence pills (wrapping row, oldest→newest), game switcher strip.

**`renderPitchPill(pitch)`** — single pitch chip. Shows: sequence index, result color stripe, pitch full name (`typeName`) + speed, result label. `typeName` falls back to `typeCode` if absent.

**`demo()`** — mounts full overlay with hardcoded sample data (NYM @ PHI, bottom 8th, full count, bases loaded). Bound to `Shift+F` via `window.__fcShiftFBound` guard. Close button + backdrop click both dismiss.

### Pitch type codes (MLB Stats API)

Full name lives in `details.type.description` in GUMBO → stored as `typeName` in `focusPitchSequence`. Always display `typeName`; `typeCode` is for deduplication only.

| Code | Name | Code | Name |
|---|---|---|---|
| `FF` | Four-Seam Fastball | `SL` | Slider |
| `SI` | Sinker | `ST` | Sweeper |
| `FC` | Cutter | `CU` | Curveball |
| `FS` | Splitter | `KC` | Knuckle Curve |
| `FA` | Fastball (generic) | `CH` | Changeup |
| `FO` | Forkball | `KN` | Knuckleball |
| `SC` | Screwball | `EP` | Eephus |
| `IN` | Intentional Ball | `PO` | Pitchout |

### Pitch result codes

| Code | Meaning | Color |
|---|---|---|
| `B` | Ball | `#7a8597` (gray) |
| `C` | Called Strike | `#f59e0b` (amber) |
| `S` | Swinging Strike | `#e03030` (red) |
| `F` | Foul | `#f97316` (orange) |
| `T` | Foul Tip | `#ef4444` (red-orange) |
| `X` | In Play | `#22c55e` (green) |

### Responsive behaviour

| Viewport | Side rail | `#focusCard` | `#focusMiniBar` |
|---|---|---|---|
| ≥1025px (desktop / iPad landscape) | Visible | Visible (top of rail) | Hidden |
| 481–1024px (iPad portrait) | Hidden | Hidden | **Visible** |
| ≤480px (phone) | Hidden | Hidden | **Visible** |

### Demo Mode compatibility

Focus Mode globals (`focusGamePk`, `focusFastTimer`, `focusState`, `focusPitchSequence`, `focusStatsCache`) are not populated during Demo Mode — `pollFocusLinescore` and `pollFocusRich` both guard on `demoMode` and return early. `#focusCard` and `#focusMiniBar` remain hidden during demo playback.

---

## 📖 Card Collection System (added v3.0)

Auto-collects a player card every time an HR or key RBI event fires in Pulse. Cards are stored per-player per-event-type (one HR slot + one RBI slot per player). Slots upgrade when a higher-tier event is captured; same-tier duplicates are stored and randomly shown for variety. Users browse their collection in a binder-style overlay.

### Tier System

**HR tiers** (derived from badge text at collection time):

| Tier | Badge matches | Glow |
|---|---|---|
| `legendary` | "WALK-OFF GRAND SLAM" | `#e03030` red |
| `epic` | "GRAND SLAM" OR "WALK-OFF" | `#f59e0b` amber |
| `rare` | "GO-AHEAD" | `#3b82f6` blue |
| `common` | everything else (solo HR) | `var(--muted)` subtle |

**RBI tiers** (badge + explicit rbi count — count passed explicitly since badge doesn't embed it for walk-offs):

| Tier | Condition | Glow |
|---|---|---|
| `legendary` | "WALK-OFF" in badge AND rbi ≥ 2 | `#e03030` red |
| `epic` | "WALK-OFF" in badge (1 RBI) OR rbi ≥ 3 | `#f59e0b` amber |
| `rare` | "GO-AHEAD" OR "TIES IT" in badge | `#3b82f6` blue |
| `common` | everything else | `var(--muted)` subtle |

**Why not 4 RBI for legendary RBI tier:** 4-RBI walk-off = walk-off grand slam = fired as an HR event, never as an RBI event. The RBI card fires for non-HR scoring plays only, so max achievable RBI on a single RBI-card event is 3 (bases loaded single/double/triple).

**Tier rank for comparison:** legendary(4) > epic(3) > rare(2) > common(1)

### Data Model

**localStorage key:** `mlb_card_collection`  
**Format:** plain object keyed by `{playerId}_{HR|RBI}`

```javascript
slot = {
  playerId:      number,
  playerName:    string,
  teamAbbr:      string,
  teamPrimary:   string,   // hex — for card background tint
  teamSecondary: string,   // hex — for accent
  position:      string,   // e.g. "RF", "SP", "RP" — determines hitting vs pitching career stats
  eventType:     'HR' | 'RBI',
  tier:          'common' | 'rare' | 'epic' | 'legendary',
  collectedAt:   number,   // ms — of first collection at this tier (for sort)
  events: [                // all collected events at current tier (1+, capped at 10)
    {
      badge:       string,  // "GRAND SLAM!", "GO-AHEAD HOME RUN!", etc.
      date:        string,  // "2026-05-01" (en-CA format)
      inning:      number,
      halfInning:  string,
      awayAbbr:    string,
      homeAbbr:    string,
      awayScore:   number,
      homeScore:   number,
    }
  ]
}
```

**Upgrade rule:** new tier rank > existing → replace slot tier + events[], update `collectedAt`. Same rank → append event to `events[]` (cap 10). Lower rank → silent no-op.

**Player headshot URL** derived at render time from `playerId`:  
`https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/{playerId}/headshot/67/current`  
Never stored (avoids stale URLs).

**Career stats** fetched at render time from `/people/{id}/stats?stats=career&group=hitting` (or `pitching` for SP/RP/CP). Cached in `collectionCareerStatsCache` (session-only). Hitters: `{ careerHR, careerAVG, careerRBI, careerOPS }`. Pitchers: `{ careerERA, careerWHIP, careerW, careerK }`.

**Team logo URL** for binder watermark: `https://www.mlbstatic.com/team-logos/{teamId}.svg` — derived at render time from `teamId` passed in `teamContext`, never stored.

### Collection Lifecycle

1. **HR fires** in `showPlayerCard()` → `collectCard({...eventType:'HR', badge:badgeText, ...})` called (not in demo mode)
2. **RBI fires** in `showRBICard()` → `collectCard({...eventType:'RBI', badge, rbi, ...})` called (not in demo mode)
3. `collectCard()` sets `lastCollectionResult` before any guard, runs tier + upgrade logic, calls `showCollectedToast()` + `updateCollectionUI()`
4. **Player card dismisses** → `dismissPlayerCard()` calls `flashCollectionRailMessage()` → reads `lastCollectionResult`, renders tier-colored pill in `#collectionRailModule`, auto-reverts to normal rail module after 4s
5. **Demo mode simulation:** `collectCard()` in demo mode (without `force=true`) reads current collection state, determines what would have happened (new/upgrade/dup), sets `lastCollectionResult` for rail flash, then returns without persisting — so rail flash works during demo playback

### HTML Elements

**`#collectionOverlay`** — full-screen modal (top-level sibling of `#focusOverlay`, z-index 500):
```html
<div id="collectionOverlay" style="display:none;position:fixed;inset:0;z-index:500;
     background:rgba(0,0,0,.85);align-items:center;justify-content:center;overflow-y:auto"
     onclick="if(event.target===this)closeCollection()">
  <div id="collectionBook" style="width:100%;max-width:960px;max-height:90vh;
       overflow-y:auto;border-radius:12px"></div>
</div>
```

**`#cardCollectedToast`** — brief fixed pill (top-level, z-index 450):
```html
<div id="cardCollectedToast" style="display:none;position:fixed;bottom:90px;left:50%;
     transform:translateX(-50%);z-index:450;pointer-events:none;..."></div>
```

**`#collectionRailModule`** — inside `#sideRail`, above news carousel. Renders count chip + "Open →" CTA; replaced temporarily by `flashCollectionRailMessage()` after player card dismissal.

**Settings panel row** — "📚 Cards Collected: N [Open]" — **first item** in the settings panel (above Select Team). Count is inline in the label via `<span id="collectionCountLabel">` updated by `updateCollectionUI()`. No separate grey subtitle row. "Open" button calls `openCollection();toggleSettings()`.

### window.CollectionCard API (`collectionCard.js`)

`collectionCard.js` is a standalone IIFE (no imports, no build). CSS injected once via `<style id="cc-styles">`. All classes prefixed `.cc-*`.

**`renderBook({ slots, filter, sort, page, careerStatsMap, teamContext })`** — full binder interior. `slots` is the already-filtered/sorted array from index.html. `careerStatsMap` is `playerId → careerStats`. `teamContext` is `{ abbr, primary, secondary, teamId, teamIdx, teamCount }` or null for non-team sorts.
- Standard 3×3 pocket grid (9 cards per page)
- Team sort: page background tinted with team primary at ~5% opacity + 2px primary border-top; 200×200px team logo watermark at 5% opacity centered on page
- Filter bar: "All | HR | RBI" pills + "Newest / Rarity / Team" sort toggle
- Empty state: ghost pockets with 🔒 icon
- Page nav: "◀ Page N / M ▶" or team nav footer with logo + ABBR + "(N of M)" in team sort

**`renderMiniCard(slot, displayEvent, careerStats, idx)`** — single card inside a pocket sleeve (~140×200px). Shows: headshot, player name, team abbr, tier badge with rarity glow border, event type label, career stat grid (4 stats), date + badge as flavor text. `onclick="openCardFromCollection(N)"`.

**`renderRailModule(totalCount)`** — compact Pulse side rail module: "🎴 N cards" count chip + "Open Collection →" button. Injected into `#collectionRailModule`.

**`demo()`** — mounts binder overlay with 9 sample slots across all tiers. Not bound to a keyboard shortcut (use Settings or `openCollection()` in console).

### Hook Points

**HR hook** — inside `showPlayerCard()`, after `card.innerHTML = window.PulseCard.render(renderCtx)`:
```javascript
if (!demoMode) {
  collectCard({
    playerId: d.batterId, playerName: d.batterName, teamAbbr: d.teamAbbr,
    teamPrimary: d.teamData.primary, teamSecondary: d.teamData.secondary,
    position: d.position || '', eventType: 'HR',
    badge: badgeText || '💥 HOME RUN!',
    inning: (gameStates[gamePk]||{}).inning || 0,
    halfInning, awayAbbr, homeAbbr, awayScore, homeScore,
  });
}
```

**RBI hook** — inside `showRBICard()`, after `window.PulseCard.render(renderCtx)`:
```javascript
if (!demoMode) {
  collectCard({
    playerId: batterId, playerName: batterName, teamAbbr, teamPrimary, teamSecondary,
    position: position || '', eventType: 'RBI', badge, rbi,
    inning, halfInning, awayAbbr, homeAbbr, awayScore: aScore, homeScore: hScore,
  });
}
```

### Critical DOM Placement Rule

**`#playerCardOverlay` must remain at top-level DOM** (sibling of `#focusOverlay`, `#collectionOverlay`, `#devToolsPanel`, `#soundPanel`) — never nested inside `#pulse` or any other section. Sections create stacking contexts and can be `display:none`, which either traps the overlay's z-index or hides it entirely when the collection is opened from non-Pulse sections. This is the same established pattern as `#soundPanel` (moved in v2.57.6). Current z-index: 600 (above binder's 500).

**`#videoOverlay`** — top-level sibling of all other overlays. z-index: 800 (above `#playerCardOverlay` 600, `#focusOverlay` 700 — intentionally highest non-modal overlay so it covers the feed when open). Contains `#videoOverlayTitle` (clip headline) and `#videoOverlayPlayer` (`<video controls>`). Opened by `openVideoOverlay(url, title)`, closed by `closeVideoOverlay()` or backdrop click. Never auto-opens — always user-initiated via ▶ button on feed item or ▶ WATCH pill on story card.

### demo.html

`demo.html` at repo root is a non-production design test harness for `collectionCard.js` visuals. It is publicly accessible on GitHub Pages but not linked from the app. It can be deleted before merging to main if desired — it is not referenced by `index.html`, `sw.js`, or `manifest.json`.

---

## 📻 Live Game Radio System (added v3.9.b–f)

Background terrestrial sports-radio audio that auto-pairs to the user's currently-focused live game. Plays the home team's flagship station (away team's as in-game fallback) when that team's feed is on the **approved** list, else falls through to Fox Sports Radio. Designed to fill the silence between in-app events without competing with MLB.tv. **No MLB.tv content is involved** — these are public over-the-air sports-radio simulcasts that the stations themselves host on their own websites.

### ⚙️ Approved teams — source of truth (READ FIRST)

Whether a team's flagship feed plays in 📻 Live Game Radio is controlled by **one place**:

```javascript
// app.js ~line 4059
const APPROVED_RADIO_TEAM_IDS = new Set([108,114,116,117,140,142,144,146,147]);
```

To enable a team: add its `teamId` to this Set, bump the comment date, bump app version + `sw.js` CACHE, commit. To disable: remove its `teamId`. The `MLB_TEAM_RADIO` URL map stays untouched — entries for unapproved teams are skipped at pick-time. The Radio Check tool (below) is the workflow for verifying URLs before adding them.

#### ✅ Currently enabled (9 teams — last sweep 2026-05-02)

| `teamId` | Team | Flagship station | Format |
|---|---|---|---|
| 108 | Los Angeles Angels | KLAA Angels Radio | direct |
| 114 | Cleveland Guardians | WTAM 1100 AM | hls |
| 116 | Detroit Tigers | WXYT 97.1 The Ticket | hls |
| 117 | Houston Astros | SportsTalk 790 AM | direct |
| 140 | Texas Rangers | 105.3 The Fan KRLD | hls |
| 142 | Minnesota Twins | WCCO News Talk 830 | hls |
| 144 | Atlanta Braves | 680 The Fan / 93.7 FM | direct |
| 146 | Miami Marlins | WQAM 560 AM | hls |
| 147 | New York Yankees | WFAN 66 / 101.9 | hls |

#### ❌ Currently disabled (21 teams)

URL is in `MLB_TEAM_RADIO` (so Radio Check can still test it), but `APPROVED_RADIO_TEAM_IDS` excludes the team so auto-pairing skips to fallback. Status column reflects last sweep + v3.34.1 URL/station rewrites.

| `teamId` | Team | Flagship station | Status |
|---|---|---|---|
| 109 | Arizona Diamondbacks | KTAR 620 AM | ⏳ URL updated v3.34.1 (KMVP Bonneville → KTAR StreamTheWorld) — untested |
| 110 | Baltimore Orioles | WBAL 1090 AM | ⏳ Station replaced v3.34.1 (WJZ Audacy → WBAL iHeart) — untested |
| 111 | Boston Red Sox | WEEI 850 AM | ❌ Broken (Audacy rights) |
| 112 | Chicago Cubs | WSCR 670 The Score | ⏳ Untested |
| 113 | Cincinnati Reds | 700 WLW | ⏳ URL updated v3.34.1 (revma → StreamTheWorld) — untested |
| 115 | Colorado Rockies | KOA 850 / 94.1 | ⏳ URL updated v3.34.1 (revma → StreamTheWorld) — untested |
| 118 | Kansas City Royals | 96.5 The Fan KFNZ | ⏳ Station rebrand v3.34.1 (KCSP → KFNZ) — untested |
| 119 | Los Angeles Dodgers | KLAC AM 570 LA Sports | ⏳ URL updated v3.34.1 (revma → StreamTheWorld) — untested |
| 120 | Washington Nationals | WJFK The Fan 106.7 | ❌ Broken (Audacy rights) |
| 121 | New York Mets | WCBS 880 AM | ⏳ Station replaced v3.34.1 (1010 WINS → WCBS, both Audacy) — untested |
| 133 | Oakland Athletics | KSTE 650 AM Sacramento | ⏳ Station replaced v3.34.1 (WDGG WV → KSTE Sacramento) — untested |
| 134 | Pittsburgh Pirates | KDKA-FM 93.7 The Fan | ❌ Broken (Audacy rights) |
| 135 | San Diego Padres | KWFN 97.3 The Fan | ❌ Broken (Audacy rights) |
| 136 | Seattle Mariners | Seattle Sports 710 AM | ❌ Broken (Bonneville rebrand of KIRO; URL unchanged) |
| 137 | San Francisco Giants | KNBR 104.5 / 680 | ⏳ Untested |
| 138 | St. Louis Cardinals | KMOX NewsRadio 1120 | ❌ Broken (Audacy rights) |
| 139 | Tampa Bay Rays | WDAE 95.3 FM / 620 AM | ⏳ Station replaced v3.34.1 (WYGM → WDAE per 2026 Rays guide) — untested |
| 141 | Toronto Blue Jays | CJCL Sportsnet 590 | ❌ Broken (likely Canada geo-locked) |
| 143 | Philadelphia Phillies | 94 WIP Sportsradio | ❌ Broken (Audacy rights) |
| 145 | Chicago White Sox | WMVP ESPN 1000 AM | ⏳ URL updated v3.34.1 (Goodkarma/amperwave → StreamTheWorld) — untested |
| 158 | Milwaukee Brewers | WTMJ Newsradio 620 | ⏳ URL updated v3.34.1 (Goodkarma/amperwave → StreamTheWorld) — untested |

#### 🌧️ Audacy rights gap — known constraint

Many MLB market flagships are owned by Audacy (URLs match `live.amperwave.net/manifest/audacy-*`). Audacy holds OTA simulcast rights for these stations but **does not** hold MLB streaming rights. During live games their digital streams play **alternate content** (national talk shows, ads, or silence) instead of the OTA broadcast. The radio.net-published URL is correct for the station, but the stream itself is not game audio. There is no fix from the URL side — replacement URLs must come from non-Audacy sources (iHeartRadio `stream.revma.ihrhls.com/...`, StreamTheWorld `playerservices.streamtheworld.com/.../*.aac`, Bonneville `bonneville.cdnstream1.com/...`, or station-specific apps).

### Architecture

```
[ Settings panel ]
   ├─ 📻 Live Game Radio toggle (id="radioToggle")
   │     └─ toggleRadio() → startRadio()/stopRadio()
   │           └─ pickRadioForFocus()  ← APPROVED_RADIO_TEAM_IDS gate
   │                 └─ MLB_TEAM_RADIO[homeId] || MLB_TEAM_RADIO[awayId] || FALLBACK_RADIO
   │           └─ loadRadioStream(pick)
   │                 ├─ Hls.js (window.Hls)         if format==='hls' && Hls.isSupported()
   │                 ├─ Safari native HLS           if format==='hls' && audio.canPlayType('application/vnd.apple.mpegurl')
   │                 └─ <audio> direct AAC/MP3      otherwise
   │
   └─ 🔍 Radio Check button → openRadioCheck()
         └─ #radioCheckOverlay (z-index 550)
               ├─ per-station ▶ / ✅ / ❌ / notes textarea
               ├─ 📋 Copy Results → markdown to clipboard
               └─ persisted to localStorage:
                   • mlb_radio_check        (status: 'yes'|'no')
                   • mlb_radio_check_notes  (free-text per station)

[ Focus Mode ]
   └─ setFocusGame(pk)  (app.js:2252)
         └─ updateRadioForFocus()  (app.js:2264)
               └─ if currently playing AND new pick.teamId !== radioCurrentTeamId → loadRadioStream(pick)
```

**Focus selection is unchanged.** The radio follows focus; it never influences which game gets focused. `selectFocusGame()`, `calcFocusScore()`, and the focus alert/switch logic are all untouched by the v3.9.c–f work.

### Globals

```javascript
// MLB Stats API teamId → primary flagship radio broadcast (radio.net-sourced)
const MLB_TEAM_RADIO = { 108:{name,url,format}, ..., 158:{name,url,format} };  // 30 entries

// Approved team IDs — gate for auto-pairing. Update as Radio Check sweep grows.
const APPROVED_RADIO_TEAM_IDS = new Set([108,114,116,117,140,142,144,146,147]);

// Fallback when neither focused team is approved (and when no focus game)
const FALLBACK_RADIO = { name:'Fox Sports Radio', url:'https://ais-sa1.streamon.fm/7852_128k.aac', format:'direct' };

var radioAudio = null;        // <audio> element, lazily created on first play
var radioHls   = null;        // Hls.js instance (null when direct stream / stopped)
var radioCurrentTeamId = null; // teamId whose feed is loaded; null = fallback
```

### Hls.js dependency

CDN script tag in `<head>`:

```html
<!-- index.html:15 -->
<script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.18/dist/hls.light.min.js" async></script>
```

Light build (~50KB). Not stored in repo, not in `sw.js` SHELL cache. If the CDN goes down, all `format:'hls'` streams break in non-Safari browsers; Safari users keep working via native `audio.canPlayType('application/vnd.apple.mpegurl')`.

### Stream format routing in `loadRadioStream(pick)`

| Condition | Path |
|---|---|
| `pick.format === 'hls'` AND `window.Hls && Hls.isSupported()` | Hls.js attaches via `loadSource` + `attachMedia` |
| `pick.format === 'hls'` AND `radioAudio.canPlayType('application/vnd.apple.mpegurl')` truthy | Safari native — set `audio.src = pick.url` |
| else (`format === 'direct'`, AAC/MP3) | Plain `<audio>` — `audio.src = pick.url` |

`radioHls` is destroyed before any source swap to prevent fd leaks on rapid focus changes.

### 🔍 Radio Check tool

Self-test panel for sweeping every station in `MLB_TEAM_RADIO` + Fox Sports fallback. Used to verify which streams actually play live game audio (vs ads/alternate content during games).

**Open via:** Settings → 🔍 Radio Check row → "Open" → `openRadioCheck()`. Modal `#radioCheckOverlay` (z-index 550, top-level DOM, click-backdrop dismisses).

**Per-station row:**
- ▶ Play — `radioCheckPlay(key)` → `loadRadioStream(...)` directly. Bypasses approval gate (the tool is for testing, not gated playback).
- ✅ Works — tap to mark; tap again to clear (no accidental lock-in)
- ❌ Broken — tap to mark; tap again to clear
- Notes textarea — free text per station; saves on every keystroke via `radioCheckSetNote(key, val)` (no re-render, cursor stable)

**Persistence:**

| Key | Shape | Purpose |
|---|---|---|
| `localStorage.mlb_radio_check` | `{ teamId\|'fallback': 'yes'\|'no' }` | Status (absent = untested) |
| `localStorage.mlb_radio_check_notes` | `{ teamId\|'fallback': 'string' }` | Per-station free-text notes |

**Footer controls:**
- ⏹ Stop — stops playback without closing
- Reset — clears both `mlb_radio_check` and `mlb_radio_check_notes`
- 📋 Copy Results — `radioCheckCopy()` builds markdown report and writes to clipboard via `navigator.clipboard.writeText` (with `fallbackCopy()` `<textarea>` + `execCommand('copy')` fallback for older browsers):

```
MLB Radio Check Results
Date: YYYY-MM-DD

✅ WORKS (N):
• Team Name (Abbr) — Station — URL
  📝 optional note

❌ BROKEN (N):
• …

⏳ UNTESTED (N):
• …
```

**Default notes seed (v3.34.1):** `RADIO_CHECK_DEFAULT_NOTES` constant (`app.js`, alongside `radioCheckResults`/`radioCheckNotes` declarations) maps `teamId` → string. `loadRadioCheckResults()` performs a one-time merge into `radioCheckNotes` gated by `localStorage.mlb_radio_check_notes_seeded_v2`; only fills empty keys so user-entered notes are preserved. Three categories: "Confirmed working — live game audio (verified 2026-05-02)" for the 9 approved teams, "URL updated v3.34.1 — not yet confirmed" for the 11 stations whose URL changed in v3.34.1, and "Not yet confirmed — needs Radio Check sweep" for the 2 originally-untested stations (CHC 112, SF 137). Bump the seed flag (`_v2` → `_v3` etc.) when you want a re-seed pass.

### Workflow — updating the approved pool

1. Open Settings → 🔍 Radio Check
2. ▶ test each station, mark ✅/❌, add notes (e.g. "plays ads from first pitch")
3. 📋 Copy Results
4. Paste into a Claude session
5. **Edit `APPROVED_RADIO_TEAM_IDS` only** (`index.html` ~line 4198) — add `teamId`s for newly-verified ✅ stations, remove any newly-failing ❌ ones
6. Update the comment "last updated YYYY-MM-DD"
7. Bump `<title>` + settings panel version + `sw.js` CACHE
8. Commit + push to `claude/focus-mode-team-radio` (or current radio branch)

`MLB_TEAM_RADIO` URL map only needs editing when a station's stream URL itself changes (which is rare — radio.net's URLs are stable).

### Known issues / future backlog

- **Audacy rights gap** (above) — affects ~14 stations; needs URL replacements from iHeart / StreamTheWorld / Bonneville
- **Oakland flagship** — WDGG The Dawg 93.7 may not be the current flagship after the A's Sacramento move; needs research
- **Toronto** — CJCL Sportsnet 590 may be Canada-geo-locked, not a URL fix
- **Per-team override UI** — backlog; user can't currently choose to listen to away team when both approved (always picks home)
- **Demo Mode** does not interact with radio; toggle is functional but `pickRadioForFocus()` returns Fox Sports during demo (no real focus game)

---

## 📽️ Demo Mode (added v2.27)

Self-contained replay of a full MLB day (April 27-28, 2026) from static `daily-events.json` snapshot. **No API calls required** — works offline once loaded.

### How It Works

**Data Source:** `daily-events.json` (562KB)
- 23 total games (8 with full play-by-play data)
- 619 plays spanning April 27 10:09 PM through April 28 5:34 AM
- Pre-computed caches: dailyLeadersCache, onThisDayCache, yesterdayCache, hrBatterStatsCache, probablePitcherStatsCache, dailyHitsTracker, dailyPitcherKs, storyCarouselRawGameData, stolenBaseEvents, scheduleData
- Format: `{gameStates, feedItems, ...caches}` — direct snapshot from live Pulse export

**Starting Demo:**
- Click **"▶ Try Demo"** button in Pulse empty state (top-right hype block) or Dev Tools panel (`Shift+H`)
- `toggleDemoMode()` calls `initDemo()` and updates the Dev Tools button label
- `initDemo()` loads `daily-events.json` via `fetch()`
- Resets all games to `Preview` status for chronological replay
- Sets `demoCurrentTime` to first play's timestamp (22:09:51 UTC = 6:09 PM ET, CLE vs TB game start)
- Populates `demoPlayQueue` from `feedItems`, sorted oldest-first
- Alert shows game count and play count
- **Playback begins immediately** — no wall-clock waiting; `demoCurrentTime` is an internal counter that advances play-by-play, never compared to `Date.now()`

### Playback Mechanics

**Speed Controls** (in mock bar when demo is active):
- **1x** — 10 seconds per play (real-time simulation)
- **10x** — 1 second per play
- **100x** — 100ms per play (rapid skip-through)

Changing speed takes effect immediately — `setDemoSpeed` cancels the pending `setTimeout` and sets a new one at the new interval (v2.55.4 fix).

**Pause/Resume:** ⏸ Pause button stops playback; ▶ Resume continues from current play

**Forward ▶:** Advance one play manually (useful when paused)

**Flow:**
1. `pollDemoFeeds()` loops through `demoPlayQueue` at `demoSpeedMs` interval
2. Each tick calls `advanceDemoPlay(play)`:
   - Updates `demoCurrentTime` to play's timestamp
   - Updates game state (inning, score, runners)
   - Fires **HR player cards** with stats and count-up animation
   - Fires **scoring play alerts** (🟢 toast with team colors)
   - Plays audio cues (drum roll for HR, bell for run, etc.)
   - Adds item to `feedItems` via `addFeedItem()`
   - Triggers `renderTicker()` (game chip updates)
   - Calls `buildStoryPool()` to refresh carousel
3. Loop continues until all plays exhausted, then shows "Demo Complete" overlay

### Carousel Temporal Filtering

Story generators (genHRStories, genBigInning, etc.) **filter by timestamp** — only stories where `item.ts.getTime() <= demoCurrentTime` are shown. This prevents future events from appearing before they're "played":

```javascript
// In genHRStories, genBigInning, etc.
if(demoMode&&item.ts.getTime()>demoCurrentTime) return;  // skip future items
```

**As demo plays advance:**
- demoCurrentTime advances per play
- Story generators see one more chunk of feedItems
- New HR and big-inning cards appear naturally
- Historical stories ("On This Day", "Yesterday Highlights", "Probable Pitchers") visible from start

**Known Limitation:** Carousel may show some contextual stories early (probable pitchers for all 23 games, daily leaders, etc.) while real-time stories (HR, big inning, walk-off) wait for plays to be reached. [Backlog: improve carousel pooling algorithm]

### Key Functions

| Function | Purpose |
|---|---|
| `toggleDemoMode()` | Entry point for Try Demo / Exit Demo button — calls `initDemo()` or `exitDemo()`, then `updateDemoBtnLabel()` |
| `updateDemoBtnLabel()` | Updates Dev Tools button label between "▶ Try Demo" and "⏹ Exit Demo" based on `demoMode` state |
| `loadDailyEventsJSON()` | Async fetch + parse `./daily-events.json`, convert timestamp strings to Date objects |
| `initDemo()` | Reset state, load JSON, build demoPlayQueue, render UI, start playback |
| `pollDemoFeeds()` | Main playback loop — advance one play per `demoSpeedMs` interval |
| `advanceDemoPlay(play)` | Apply play to gameState, fire alerts/sounds, update feed, rebuild carousel |
| `setDemoSpeed(ms, btn)` | Update `demoSpeedMs`, highlight speed button, cancel pending timer and restart at new speed immediately |
| `toggleDemoPause()` | Pause/resume playback, update button text |
| `renderDemoEndScreen()` | Show "Demo Complete" overlay, auto-dismiss after 4s |
| `exitDemo()` | Clear demo state, reset UI, return to live mode (if desired) |

### Demo Globals

```javascript
let demoMode = false              // true when demo active
let demoGamesCache = []           // game objects loaded from JSON (used for end screen count)
let demoDate = null               // earliest game date from JSON
let demoCurrentTime = 0           // current replay timestamp (ms) — internal counter, never compared to Date.now()
let demoPlayQueue = []            // plays sorted by timestamp
let demoPlayIdx = 0               // current play index in queue
let demoTimer = null              // setTimeout handle for playback loop
let demoStartTime = 0             // wall-clock ms when demo was started (for elapsed-time display)
let demoSpeedMs = 10000           // milliseconds per play advance (1x = 10000ms)
let demoPaused = false            // pause/resume state
const devTuning = {               // live-tunable Pulse parameters (editable via Dev Tools panel)
  rotateMs: 4500,                 //   carousel rotation interval (ms)
  rbiThreshold: 10,               //   minimum RBI card score to trigger showRBICard
  rbiCooldown: 90000,             //   per-game RBI card cooldown (ms)
  hr_priority: 100,               //   HR story priority
  hr_cooldown: 300000,            //   HR story cooldown (5 min)
  biginning_priority: 75,         //   Big Inning story priority
  biginning_threshold: 3,         //   scoring plays required per inning-half
  walkoff_priority: 90,           //   Walk-off Threat story priority
  walkoff_cooldown: 300000,       //   Walk-off Threat cooldown (5 min)
  nohitter_inning_floor: 6,       //   earliest inning to fire No-Hitter Watch
  nohitter_priority: 95,          //   No-Hitter Watch story priority
  basesloaded_enable: true,       //   enable/disable Bases Loaded story
  basesloaded_priority: 88,       //   Bases Loaded story priority
  focus_critical: 120,            //   Focus badge CRITICAL threshold
  focus_high: 70,                 //   Focus badge HIGH threshold
  focus_switch_margin: 25,        //   pts rival game must exceed current to trigger soft alert
  focus_alert_cooldown: 90000     //   ms between soft alerts per game
}
let devColorLocked = false        // when true, applyTeamTheme/applyPulseMLBTheme use devColorOverrides instead of computed values
let devShowPushOnDesktop = false  // **retained but uncalled (v2.57.11)** — push row hidden via CSS media query instead; variable kept in case UI toggle is re-added
let devColorOverrides = {         // custom color values set via Theme Tuning pickers
  app:   { dark:'', card:'', card2:'', border:'', primary:'', secondary:'', accent:'', accentText:'', headerText:'' },
  pulse: { dark:'', card:'', card2:'', border:'', primary:'', secondary:'', accent:'', accentText:'', headerText:'' }
}
const devTuningDefaults = {
  rotateMs:4500, rbiThreshold:10, rbiCooldown:90000,
  hr_priority:100, hr_cooldown:300000,
  biginning_priority:75, biginning_threshold:3,
  walkoff_priority:90, walkoff_cooldown:300000,
  nohitter_inning_floor:6, nohitter_priority:95,
  basesloaded_enable:true, basesloaded_priority:88,
  focus_critical:120, focus_high:70, focus_switch_margin:25, focus_alert_cooldown:90000
}
```

### Files Involved

| File | Role |
|---|---|
| `daily-events.json` | Static snapshot (8 games, 619 plays, all caches) — served via GitHub Pages; required for Demo Mode in production |
| `app.js` | All demo code: loadDailyEventsJSON, initDemo, pollDemoFeeds, advanceDemoPlay, UI controls |
| `sw.js` | Cache versioning for PWA update |

---

## PWA & Push Notifications (added v1.40)

### PWA
- `manifest.json` — `display: standalone`, `start_url: "./"`, `scope: "./"` (relative paths required for GitHub Pages subdirectory)
- `sw.js` — install caches app shell (`./`, `./manifest.json`, `./icons/*`); activate cleans old caches; fetch handler is cache-first for same-origin; push and notificationclick handlers
- **All paths in manifest, sw.js, and `<head>` are relative** (no leading `/`) — GitHub Pages serves the app at `/Baseball-App/` so absolute paths break
- `applyTeamTheme()` updates `<meta name="theme-color">` with the active team primary colour
- Icons: Outfield Horizon design — stadium sunset scene with a heartbeat/pulse line across a twilight sky (`#FFB37A`→`#E16A8A`→`#7C2D5C`), outfield wall with yellow HR line (`#FFD400`), green grass with mowing stripes, and a small baseball at the pulse peak. Hero variant (full detail: sun glow, wall ad panels, mowing stripes) used for 512/192/180; maskable variant (content inside Android 80% safe zone) for `icon-maskable-512.png`; monochrome silhouette for `icon-mono.svg` / `favicon.svg`. `manifest.json` `background_color`: `#7C2D5C` (sky base), `theme_color`: `#0E3E1A` (wall green), `short_name`: `"Pulse"`. Files: `icon-512.png` (any), `icon-192.png` (any), `icon-180.png` (apple-touch-icon), `icon-maskable-512.png` (maskable), `icon-mono.svg` (monochrome iOS 16.4+), `favicon.svg` (browser tab). `manifest.json` has separate entries for `any`/`maskable`/`monochrome` purposes; `orientation: "any"` for iPad landscape.

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

## Dev Tools

### Keyboard Shortcuts (global)

| Shortcut | Command | Purpose |
|---|---|---|
| `Shift+H` | `toggleDemoMode()` | Toggle demo mode on/off (enter or exit) |
| `Shift+R` | `replayHRCard()` | Replay most recent HR card from live feed |
| `Shift+E` | `replayRBICard()` | Replay most recent RBI card from live feed |
| `Shift+V` | `window.PulseCard.demo()` | Cycle through all four HR card template variants |
| `Shift+D` | `toggleDevTools()` | Toggle Dev Tools panel open/closed |
| `Shift+F` | `window.FocusCard.demo()` | Open Focus Mode demo overlay with sample data |
| `Shift+G` | `generateTestCard()` | Inject one random card into the collection (bypasses demo mode guard) |
| `Shift+W` | `devTestVideoClip()` | Open video overlay with most recent live clip → yesterdayContentCache fallback → fetches yesterday's first game |

### Demo Mode (Shift+H)

Replays a full day of games (April 27-28, 2026) from `daily-events.json` snapshot without API calls. Shows all four HR card variants during playback. Includes speed controls (1x/10x/100x), pause/resume, and "Next HR" button to fast-forward to next home run.

### HR Card Replay (Shift+R) — v2.49+

Replays a home run card from the live feed without demo mode overhead. Useful for QC'ing the four card variants (V1–V4) with real game data and team colors.

**Console Function:** `replayHRCard(itemIndex)`

**Usage:**
- **Most recent HR:** Press `Shift+R` (shows the last/most recent HR that occurred)
- **Specific HR by index:** Call `replayHRCard(0)` for most recent, `replayHRCard(1)` for second-most-recent, etc.

**What it does:**
- Scans `feedItems` array for all plays with `event === 'Home Run'`
- Extracts batter, team, and game context from boxscore (including position and jersey number)
- Calls `showPlayerCard()` with the HR data
- Displays a random template variant
- Logs action to console: `"Replaying HR: {name} at {away} @ {home}"`

### Card Variants (Shift+V) — v2.49+

Calls `window.PulseCard.demo()` to immediately display a randomly selected HR card template variant without needing a live HR event. Useful for visual QC of all four templates (V1 Stylized Graphic, V2 Stadium Jumbotron, V3 Comic/Pop Art, V4 Sports Broadcast).

**Keyboard Listener:**
Located in `index.html` near the end, after the `visibilitychange` event listener:
```javascript
document.addEventListener('keydown', function(e) {
  if(e.shiftKey && e.key === 'H') { toggleDemoMode(); }
  if(e.shiftKey && e.key === 'R') { replayHRCard(); }
  if(e.shiftKey && e.key === 'E') { replayRBICard(); }
  if(e.shiftKey && e.key === 'V') { window.PulseCard.demo(); }
  if(e.shiftKey && e.key === 'D') { toggleDevTools(); }
  if(e.shiftKey && e.key === 'F') { window.FocusCard.demo(); }
  if(e.shiftKey && e.key === 'G') { generateTestCard(); }
});
```

---

## Known Open Issues

1. **News fallback** — if ESPN API is CORS-blocked, no fallback source.
4. **Around the League leaders index mapping** — empirically derived, fragile. Re-test if API response order changes.
5. **allorigins.win proxy** — no SLA, free service. Retry logic (3 attempts, 1s gap) mitigates failures.
6. **YouTube channel IDs** — 27 of 30 `youtubeUC` values unverified. QC needed each offseason.
7. **Date strings use local time** — all `startDate`/`endDate` params in `index.html` are built from `getFullYear`/`getMonth`/`getDate` (local). Avoid `toISOString().split('T')[0]` for date params — it returns UTC and will be one day ahead after ~8 PM ET, causing games to be skipped (fixed v1.45.5). `api/notify.js` intentionally uses UTC since it runs on Vercel servers and compares timestamps, not dates. **Calendar `gameByDate` key also uses local timezone conversion (fixed v1.61)** — previously used `gameDate.split('T')[0]` (UTC), which placed evening US games on the wrong calendar cell.
8. **Audacy radio rights gap** — ~14 MLB market flagships hosted by Audacy (URLs `live.amperwave.net/manifest/audacy-*`) play alternate content during games (talk shows / ads) instead of the OTA simulcast, because Audacy holds OTA rights but not MLB streaming rights. The radio.net-published URL is correct for the station but useless for game audio. Affected teams default to Fox Sports fallback via `APPROVED_RADIO_TEAM_IDS`. Fix requires sourcing replacement URLs from non-Audacy CDNs (iHeartRadio / StreamTheWorld / Bonneville / station apps). See "📻 Live Game Radio System" → "Audacy rights gap".
9. **Hls.js CDN dependency** — `hls.light.min.js@1.5.18` loaded from `cdn.jsdelivr.net` (not stored in repo, not in `sw.js` SHELL cache). If the CDN goes down, all `format:'hls'` radio streams break in non-Safari browsers; Safari users keep working via native HLS. Worth bundling locally if the CDN ever becomes unreliable.
10. **News image allowlist (`NEWS_IMAGE_HOSTS`)** — added v3.34.17 to prevent browser requests to unexpected RSS thumbnail domains (e.g. `jotcast.com` podcast avatars) triggering corporate firewalls (Check Point UserCheck). Side effect: if a legitimate news source (CBS, FanGraphs, MLB Trade Rumors) serves images from a CDN domain not in the allowlist, those thumbnails silently show the source icon placeholder instead. Allowlist is in `app.js` alongside `isSafeNewsImage()`. If thumbnails go missing after a source changes CDN, add the new hostname to `NEWS_IMAGE_HOSTS`.

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
| `MLB_TEAM_RADIO` URLs | radio.net-sourced; stations may change CDNs or drop streams | Re-run 🔍 Radio Check sweep periodically; replace broken URLs |
| `APPROVED_RADIO_TEAM_IDS` Set | Hand-curated from Radio Check sweep — last updated 2026-05-02 | Update Set when sweep results change; comment date should match |
| Hls.js CDN URL | `cdn.jsdelivr.net/npm/hls.js@1.5.18/dist/hls.light.min.js` — pinned version, free CDN, no SLA | Bundle locally if CDN unreliable; pinned version avoids surprise upgrades |
| `NEWS_IMAGE_HOSTS` allowlist (`app.js`) | Hand-curated CDN domain list — if a news source migrates image CDN, their thumbnails silently fall back to placeholder icon with no visible error | If thumbnails go missing after source change, add new hostname to `NEWS_IMAGE_HOSTS` regex in `app.js` |

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

- [x] 🎯 Focus Mode — `calcFocusScore()` auto-selects most exciting live game; `selectFocusGame()` hooked into `pollLeaguePulse()` (v2.61)
- [x] 🎯 Focus Mode — Tier 1 linescore poll every 5s: balls/strikes/outs/runners/matchup names/score/team colors (v2.61)
- [x] 🎯 Focus Mode — Tier 2 GUMBO fetch every 5s: full `focusPitchSequence` for current at-bat; new-AB detection resets sequence (v2.61)
- [x] 🎯 Focus Mode — `#focusCard` compact card in right side rail (desktop/iPad landscape); full-width within 320px rail (v2.61)
- [x] 🎯 Focus Mode — `#focusMiniBar` slim strip below ticker; visible on phone and iPad portrait, hidden on desktop/iPad landscape via CSS (v2.61)
- [x] 🎯 Focus Mode — `#focusOverlay` full modal with hero count pips, diamond, matchup stats, pitch sequence, game switcher; custom 4px scrollbar (v2.61)
- [x] 🎯 Focus Mode — Soft alert `#focusAlertStack` for game-switch suggestions; 90s per-game cooldown (v2.61)
- [x] 🎯 Focus Mode — `focusCard.js` visual templates: `window.FocusCard.renderCard/renderOverlay/renderPitchPill/demo()`; `Shift+F` shortcut (v2.61)
- [x] 🎯 Focus Mode — Session-cached player stats (`focusStatsCache`); batter AVG/OPS/HR/RBI + pitcher ERA/WHIP/W/L in overlay (v2.61)
- [x] 🎯 Focus Mode — Pitch types shown as full name (`typeName`: "Sinker", "Sweeper") not abbreviated code; `typeCode` fallback if absent (v2.61)
- [x] 🎯 Focus Mode — Last-pitch strip in both compact card and overlay: pitch name + speed + result with color-coded dot (v2.61)
- [x] 🎯 Focus Mode — Demo Mode guard: all focus polls return early when `demoMode=true`; focus card hidden during demo (v2.61)
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
- [x] 📖 Story Carousel — Cooldowns dynamically capped to `pool.length × devTuning.rotateMs × 1.5` (floor 2 min) so thin pre-game pools recycle cards in seconds rather than hitting 60-min nominal cooldowns (v2.12.3)
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
- [ ] 📖 Card Collection — Binder scrolls on desktop because `#collectionBook` uses `max-height:90vh` (not an explicit `height`), so `.cc-binder{height:100%}` resolves against content height and the flex chain has no definite reference; `.cc-page` overflows when `.cc-grid{min-height:600px}` + 44px padding exceeds available space. Fix: change `#collectionBook` to `height:min(96vh,920px)` (definite height) + widen `max-width:960px` → `1200px` + drop `min-height:600px` from `.cc-grid` so `height:100%` fills naturally. Needs visual QA before shipping — previous attempt at the fix was reverted due to look/feel concerns.
- [ ] ⚡ Pulse — HR/RBI player cards: Career stats expansion — 2024 career HR high by year, hot streak context (last 10-game average, current streak), populate from `/people/{id}/stats` with season=all; currently shows placeholders (deferred to future branch, v2.31)
- [ ] 📖 Story Carousel — HR distance via Statcast (`hitData.totalDistance` in `/game/{pk}/playByPlay`) needs real-world verification — field may not populate for all games or all parks; confirm distance appears in headlines during live play
- [ ] ⚡ Pulse — "Game underway!" feed ordering: status items for games transitioning to In Progress appear near the top of the newest-first feed instead of being anchored to the game's scheduled start time; root cause likely `gameDateMs` null/stale or else-branch `playTime` missing at line 1162; deferred — data usage too high to investigate further
- [ ] ⚡ Pulse — Sound system upgrade: replace Web Audio API synthesis with real CC0 MP3 samples. Infrastructure is fully in place (branch `claude/explore-platform-sound-LSGL8`, merged fixes to main via v2.64.x). To complete: source 9 CC0 audio files from Pixabay (no attribution required), encode each as base64 (`base64 -i file.mp3` on macOS), paste into `SOUND_DATA` object in index.html. Events needing samples: `hr` (bat crack + crowd), `run` (bell/chime), `risp` (heartbeat/tension), `sb` (whoosh), `dp` (glove pop ×2), `tp` (bugle fanfare), `gameStart` (organ riff), `gameEnd` (descending chime), `error` (thud). Synthesis fallbacks remain active for any key left as empty string. iOS/shared-context fix already landed (v2.64.4): single `_audioCtx` created on master-toggle user gesture, `playSound()` awaits resume via `.then()` before dispatching, prevents silent audio on suspended context. UAT checklist: `Shift+R` (HR), `Shift+E` (RBI/run), demo at 10x for DP/TP/SB/error/RISP, 1x for gameStart/gameEnd.
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

---

## Technical Debt Management

Technical debt audits are tracked in a dedicated workflow system. When code quality improvements are needed, a **technical debt sprint** can be triggered.

### How It Works

**You trigger it:** Say *"Start tech debt sprint"* in conversation with Claude.

**Claude executes:**
1. **Audit** — Full code review, findings documented in `docs/technical-debt/audits/`
2. **Remediation** — Fixes applied with before/after code in `docs/technical-debt/remediation/`
3. **QA** — Comprehensive testing, results in `docs/technical-debt/qa/`
4. **UAT** — You test in browser
5. **Finalization** — Code merged to main with summary in `docs/technical-debt/sprints/`

### Key Features

- **Checkpoints:** Explicit user acknowledgement before each stage (no auto-proceeding)
- **Session continuity:** Can pause mid-sprint and resume across sessions without losing context
- **Historical awareness:** Claude automatically reads all previous audit findings when starting a new sprint
- **Permanent archive:** All audit reports stay in `docs/technical-debt/` forever, searchable by date
- **Version tracking:** Each audit notes the app version it was conducted on

### Entry Points

- **Process guide:** See `docs/technical-debt/WORKFLOW.md` (read once to understand)
- **Quick reference:** See `docs/technical-debt/README.md`
- **Completed sprints:** See `docs/technical-debt/HISTORY.md` (append-only archive)
- **All audits:** Browse `docs/technical-debt/audits/`, `remediation/`, `qa/`, `sprints/` folders

---
