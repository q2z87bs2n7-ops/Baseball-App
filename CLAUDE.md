# MLB Tracker — Project Handoff

## What This Is
An MLB sports tracker, defaulting to the New York Mets. All data is pulled live from public APIs — no build system, no dependencies beyond the push notification backend. Split across three files: `index.html` (HTML structure), `styles.css` (all CSS), `app.js` (all JavaScript).

**Current version:** v3.38.10

**Version history** (full detail in `CHANGELOG.md`):
- **v1.x** — initial build: schedule, standings, stats, live game view, PWA install, push notifications, team theming
- **v2.1** — League Pulse merged: live league-wide feed, story carousel, sound alerts, demo mode
- **v2.x** — incremental: doubleheader/PPD support, HR/RBI player cards (Topps-style, 4 variants), Focus Mode pitch-by-pitch tracker (v2.61), Card Collection binder (v3.0), radio engine (v3.9)
- **v3.9** — performance: `feedItems` cap, story pool timer decoupled from poll, diffPatch GUMBO; Live Game Radio focus-paired engine + Radio Check sweep tool
- **v3.11–v3.20** — 6 new story generators; Pulse-first rebrand; Yesterday Recap section
- **v3.30** — V3 design unification: design tokens, CSS class system, inline-style elimination
- **v3.31–v3.33** — multi-source news aggregator; floating panels Pulse-themed; tech-debt sprint
- **v3.34** — monolith split: `index.html` → `index.html` + `styles.css` + `app.js`
- **v3.35** — version bump to main; consolidates v3.34.x patch series
- **v3.36** — HR video clips: fix 4 bugs; drop pendingVideoQueue; Video Debug panel in Dev Tools
- **v3.37** — taxonomy hyphens fix; exclude darkroom clips; 4-tier player matching; remove `patchStoryWithClip`
- **v3.37.3** — exclude ABS challenge clips (carry batter player_id but are pitch-review overlays)
- **v3.37.5** — remove timestamp fallback from clip matching; player_id match only
- **v3.38** — carousel logic improvements: clawback requires trailing/tied score; inning recap runs use actual differential
- **v3.38.1–v3.38.10** — Dev Tools enhancement series: in-app Log Capture (console wrap + uncaught errors); App State Inspector (gameStates / feedItems / focusState / storyPool); Network Trace (fetch wrap with metadata-only ring buffer); localStorage + Service Worker inspectors; Test Notification + 🎯 Live Controls (Force Focus, Force Inning Recap); 📋 Diagnostic Snapshot one-tap clipboard export; panel reflow (Actions / Inspectors / Tuning / Export with width bump 560→760); cleaner shortcut mnemonics (Shift+M deMo, Shift+H Home run, Shift+B rBi, Shift+P Play clip, Shift+S State, Shift+I Info dump); custom-URL testers for radio + YouTube channels

**File:** `index.html` (renamed from `mets-app.html` at v1.40 for GitHub Pages)
**Default team:** New York Mets (id: 121)

---

## Workflow Rules

1. **Never assume** — always ask before proposing or touching any code
2. **Surgical edits only** — smallest possible change; do not reformat or reorganise surrounding code
3. **No changes without explicit user approval** — show old/new before applying
4. **Break changes into small steps** — confirm each works before proceeding
5. **Git branching** — all changes go to a `claude/` branch first; only merge to `main` when explicitly asked
6. **Debug code** — wrap temporary logging in `// DEBUG START` / `// DEBUG END` for easy removal
7. **Version every change** — bump `<title>` tag + settings panel version string on every commit. Use `v2.x.y` format — increment `y` per branch commit; drop patch on merge to main. **Also bump `CACHE` in `sw.js`** on every commit that changes app content.
8. **No rewrites** — never rewrite large sections. Targeted edits only.

---

## Architecture Overview

### Repo structure
```
index.html              — HTML skeleton only: structure, overlays, nav, section divs. No CSS or JS.
styles.css              — all CSS: variables, layout classes, media queries, animations
app.js                  — all JavaScript: every function, global variable, and the boot IIFE
focusCard.js            — runtime dependency: window.FocusCard.renderCard/renderOverlay/renderPitchPill/demo()
pulse-card-templates.js — runtime dependency: window.PulseCard.render()/demo() for HR/RBI card overlays
daily-events.json       — runtime dependency: static snapshot for client-facing Demo Mode
collectionCard.js       — runtime dependency: window.CollectionCard.renderBook/renderMiniCard/renderRailModule/demo()
sw.js                   — service worker (PWA caching + push event handling)
manifest.json           — PWA manifest (install metadata, icons)
icons/                  — app icons (icon-192.png, icon-512.png, icon-180.png, icon-maskable-512.png, favicon.svg, icon-mono.svg)
api/subscribe.js        — Vercel serverless: store/remove push subscriptions in Upstash Redis
api/notify.js           — Vercel serverless: check MLB schedule, fire push notifications
api/test-push.js        — Vercel serverless: sends a test push immediately
api/proxy-rss.js        — Vercel serverless: fetch + parse MLB RSS feeds, return JSON (bypasses CORS)
api/proxy-youtube.js    — Vercel serverless: fetch + parse YouTube channel feeds, return JSON (bypasses CORS)
.github/workflows/      — notify-cron.yml (*/5 * * * *); test-push.yml (manual)
vercel.json             — Vercel function config (maxDuration)
package.json            — web-push + @upstash/redis (for Vercel functions only)
```

### Deployment
- **Static app**: GitHub Pages — `main` branch, root directory
- **Push API (`/api/*`)**: Vercel Hobby — `https://baseball-app-sigma.vercel.app`
- **Cron**: GitHub Actions (free) pings `/api/notify` every 5 minutes

### Session Storage & Cross-Device Sync
Sign-in is **100% optional**. Signed-in users get card collection sync. Auth: GitHub OAuth + Email magic-link. Session: 40-char random token, 90-day TTL, `localStorage('mlb_session_token')`. Collection sync: `GET/PUT/POST /api/collection-sync` → Upstash Redis `collection:{userId}`. Merge: highest tier wins; same tier keeps newer `collectedAt` + merged events (deduped, capped 10). Vercel env vars required: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `EMAIL_API_KEY`, `EMAIL_FROM_ADDRESS`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`. Full setup: `docs/auth-architecture.md`.

### Runtime dependencies — DO NOT DELETE

| File | Loaded by | Purpose |
|---|---|---|
| `styles.css` | `index.html` `<link rel="stylesheet">` | All app CSS |
| `app.js` | `index.html` `<script defer>` | All app JavaScript |
| `focusCard.js` | `index.html` `<script defer>` | At-Bat Focus Mode visuals |
| `pulse-card-templates.js` | `index.html` `<script defer>` | HR/RBI player card overlays |
| `collectionCard.js` | `index.html` `<script defer>` | Card Collection binder visuals |
| `daily-events.json` | `app.js` `fetch('./daily-events.json')` | Demo Mode — client-facing feature |
| `manifest.json` | `index.html` `<link rel="manifest">` | PWA install metadata |
| `icons/favicon.svg` | `index.html` `<link rel="icon">` | Browser tab icon |
| `icons/icon-180.png` | `index.html` `<link rel="apple-touch-icon">` | iOS home screen icon |
| `icons/icon-192.png` | `sw.js` SHELL cache + `manifest.json` | PWA icon |
| `icons/icon-512.png` | `sw.js` SHELL cache + `manifest.json` | PWA icon (splash) |
| `icons/icon-maskable-512.png` | `manifest.json` | PWA maskable icon |
| `icons/icon-mono.svg` | `manifest.json` | iOS 16.4+ monochrome icon |

**Rule:** before deleting any file in repo root or `icons/`, grep `index.html`, `app.js`, `sw.js`, and `manifest.json` for references first.

### File responsibilities

| Change type | File |
|---|---|
| Add/move an HTML element, section, overlay, button | `index.html` |
| Change how something looks (colours, layout, spacing, animations) | `styles.css` |
| Add/fix a function, API call, global variable, game logic | `app.js` |
| New feature with HTML + CSS + JS aspects | all three |
| PWA caching behaviour or push notification handler | `sw.js` |
| Version bump (`<title>` tag + settings panel `<div class="settings-version">`) | `index.html` |
| `CACHE` constant bump (forces PWA refresh) | `sw.js` |

**Script load order (all `defer`):** `pulse-card-templates.js` → `focusCard.js` → `collectionCard.js` → `app.js`. `app.js` must remain last. Theme-flash prevention snippet at `index.html:7` is the only inline script — must stay inline.

### Key global state

Full declarations with all fields: `docs/global-state.md`. Key variables:

```javascript
const SEASON = 2026                    // hardcoded — update each season
const MLB_BASE = 'https://statsapi.mlb.com/api/v1'
const MLB_BASE_V1_1 = 'https://statsapi.mlb.com/api/v1.1'  // Pulse only — v1 timestamps path 404s
const TEAMS = [...]                    // 30 teams with colors, IDs, YouTube channel IDs

let activeTeam = TEAMS.find(t => t.id === 121)   // defaults to Mets
let scheduleData = [], scheduleLoaded = false
let rosterData = { hitting, pitching, fielding }
let statsCache = { hitting, pitching }
let feedItems = []             // all feed items newest-first
let gameStates = {}            // gamePk → { awayAbbr, homeAbbr, awayScore, homeScore, status,
                               //   detailedState, inning, halfInning, outs, onFirst/Second/Third, ... }
let focusGamePk = null         // gamePk of focused game (Focus Mode)
let demoMode = false           // true when Demo Mode active
let devColorLocked = false     // when true, theme uses devColorOverrides instead of computed values
const devTuning = { rotateMs:4500, rbiThreshold:10, rbiCooldown:90000, ... }  // full object in docs/global-state.md
```

### Navigation
`showSection(id, btn)` — shows/hides sections by toggling `.active` class. Nav order: `pulse`, `home`, `schedule`, `league`, `news`, `standings`, `stats`. Pulse is first and the default-active section. Live game view is a separate overlay (`#liveView`), not a section. Calling `showSection` while live view is active automatically closes it first.

`pulse` is lazy-initialised: `initLeaguePulse()` fires only on first nav via `pulseInitialized` guard.

### Team theming
`applyTeamTheme(team)` sets nine CSS variables dynamically:

| Variable | Value |
|---|---|
| `--primary` | Team primary colour — header, active nav |
| `--secondary` | Team accent — secondary if contrast ≥ 3:1 AND luminance ≥ 0.05, else `#ffffff` |
| `--accent-text` | Text ON `--secondary` surfaces |
| `--dark` | Page background — hsl(teamHue, 50%, 18%) |
| `--card` | Card background — hsl(teamHue, 45%, 22%) |
| `--card2` | Secondary card / input — hsl(teamHue, 40%, 26%) |
| `--border` | Borders — hsl(teamHue, 35%, 30%) |
| `--accent` | Contrast-safe accent for text/borders on dark — raw secondary or HSL-lightened or #FFB273 |
| `--header-text` | Text on header gradient — #0a0f1e if primary luminance > 0.5, else #ffffff |

All variables are **runtime-computed** — not declared in `styles.css`. Persisted to `localStorage.mlb_theme_vars` and reapplied inline before `<style>` renders to prevent flash-of-wrong-theme.

Full CSS variable reference, V3 design tokens, utility classes, and responsive breakpoints: `docs/css-variables.md`.

---

## APIs

| Endpoint | Status | Notes |
|---|---|---|
| `/schedule` | ✅ | Primary source for all game data |
| `/game/{pk}/linescore` | ✅ | Live and completed games |
| `/game/{pk}/boxscore` | ✅ | Player stats for live and completed games |
| `/standings` | ✅ | No season param needed |
| `/teams/{id}/roster` | ✅ | Stats tab uses `rosterType=40Man` to include IL players |
| `/people/{id}/stats` | ✅ | Individual player season stats |
| `/stats/leaders` | ✅ | Requires `statGroup` param — omitting it mixes hitting/pitching data |
| `/game/{pk}/playByPlay` | ✅ | Completed at-bat log. Returns `allPlays[]`, `scoringPlays[]`, `playsByInning[]`. |
| `/game/{pk}/feed/live` | ⚠️ | **v1 path 404s.** Use `v1.1` (`MLB_BASE_V1_1`). Large payload (~500KB). |
| `/api/v1.1/game/{pk}/feed/live/timestamps` | ✅ | **Pulse only.** Last element = most recent change. Must use `MLB_BASE_V1_1`. |
| `/game/{pk}/content` | ✅ | `highlights.highlights.items[]` with headline, blurb, playbacks[], image.cuts[]. |
| `/game/{pk}/feed/color` | ❌ | Returns 404 for all 2026 games — do not use. |
| ESPN News API | ⚠️ | Unofficial, may be CORS-blocked |
| YouTube RSS via allorigins.win | ⚠️ | Public proxy, no SLA. 3-attempt retry in place. |

**Game state strings:** `abstractGameState`: `"Live"`, `"Final"`, `"Preview"`, `"Scheduled"` — both Preview and Scheduled mean upcoming. `abstractGameState` becomes `"Live"` ~20–30 min before first pitch (warmup) — code excludes `detailedState === 'Warmup'` and `'Pre-Game'`. A `detailedState` of `'Postponed'`, `'Cancelled'`, or `'Suspended'` on a Final game = PPD — shown as grey badge, no score.

---

## CSS Variables

All variables are runtime-computed by `applyTeamTheme()` and `applyPulseMLBTheme()` — not in `styles.css`. Full reference including Pulse-specific vars (`--p-*`), V3 design tokens, responsive breakpoints, and all utility classes: `docs/css-variables.md`.

Fixed neutrals: `--text: #e8eaf0`, `--muted: #9aa0a8`.

---

## App Pages & Sections

### 🏠 Home
**Left card — "Next Game"** (`#todayGame`, `loadTodayGame()`) — priority: (1) live game with score + Watch Live, (2) upcoming today, (3) next upcoming. Series info via `getSeriesInfo(g)`. Layout: 5-column row [opp cap] [opp name/score] [—] [my name/score] [my cap]. Background: opp primary → #111827 50% → active-team colour (built in `renderNextGame`, NOT via `gameGradient()` — see below).

**Right card — "Next Series"** (`#nextGame`, `loadNextGame()`) — fetches 28 days, groups into series, finds the **second** series with any non-Final game (skips current series). 3-stop gradient.

`gameGradient(g)` uses away→home order and is only used by `renderGameBig` (schedule/history cards). `renderNextGame` builds its own gradient so opponent is always left and active team always right — would be wrong for away games if using `gameGradient`.

**Division Snapshot** — compact standings for active team's division.
**Latest News** — top 5 ESPN headlines.
**YouTube Widget** (`#homeYoutubeWidget`) — team YouTube channel, 25%/75% two-panel layout. Loaded by `loadHomeYoutubeWidget()` → `loadMediaFeed(uc)`. **Requires deployed URL** — YouTube embeds return Error 153 on `file://`.

### 📅 Schedule
Monthly calendar grid (Sun–Sat). `scheduleLoaded` flag prevents double-fetch when `scheduleData` is pre-populated by cold-load ±7 day fetch. Doubleheaders: `renderCalendar` uses `gamesByDate` (array per date) — DH cells show `G1:`/`G2:` rows, each independently clickable. Mobile (≤480px): colour-coded dots only; tapping shows `.cal-tooltip` from `scheduleData` (no API call).

Clicking completed game (desktop): boxscore tabs (Batting + Pitching, AB>0/IP>0 only) + linescore (R/H/E, `!=null` guards) + game summary (bs.info pairs). PPD: info card only, no linescore fetch. Upcoming: location + probable pitchers.

Source: `/schedule?season=2026&teamId={id}&hydrate=team,linescore,game`

### 🏆 Standings
Division standings (active team highlighted) + Wild Card Race (top 9 non-division-leaders, orange cutoff after 3) + WC Other Divisions (excludes active team's division) + Full MLB Standings.

Source: `/standings?leagueId=103,104&standingsTypes=regularSeason&hydrate=team,division,league`

### 📊 Stats
Three-column layout: Leaders | Roster (40-man, hitting/pitching/fielding tabs, first player auto-selected) | Player Stats (headshot + 12-stat grid, hitting/pitching 4-col, fielding 3-col, first stat `.hero`).

Source: `/teams/{id}/roster?rosterType=40Man` + `/people/{id}/stats`

### 🌐 Around the League
Matchups: all MLB games, 3-per-row, day toggle (Yesterday/Today/Tomorrow), opacity fade on switch. Live games show inning. Clickable → live game view. ⚠️ **Leaders index mapping is fragile** — API doesn't guarantee response order matches `leaderCategories` order; re-test empirically after API changes.

Sources: `/schedule?sportId=1&date={date}&hydrate=linescore,team` + `/stats/leaders` with `statGroup` param

### ⚡ Pulse
Global live MLB play-by-play feed — scoring plays, home runs, RISP across all simultaneous games. Lazy-loaded on first nav. **Desktop/iPad Landscape (≥1025px):** CSS Grid 700px + 320px side rail with games module + news carousel. **≤767px:** side rail hidden, single column.

Ticker: live-only chips sorted by inning progress. Expanded chip (base diamond SVG) fires when `g.onFirst || g.onSecond || g.onThird`. Feed: newest-first, inserted at correct chronological position via `data-ts` attributes.

**`#playerCardOverlay` must stay top-level DOM** (sibling of `#focusOverlay`, `#collectionOverlay`, `#devToolsPanel`) — never nested inside `#pulse`. Sections create stacking contexts that trap z-index. Current z-index: 600.

Full HTML structure, feed item types, HR/RBI badge logic, scoring formulas, sound system, live polling strategy, video clip matching: `docs/pulse-feed.md`.
Story carousel (15 generators, rotation engine, all story types): `docs/story-carousel.md`.

### 📰 News
ESPN headlines, MLB / Team toggle (pill buttons). Defaults to MLB-wide (no team filter). Team pill shows `activeTeam.short`. Home card always shows team news regardless of toggle.

### ⚾ Live Game View
Triggered from Home card or matchup grid. Score header + count/runners + current matchup + linescore + play log (newest first, grouped by inning half) + box score (tabbed away/home) + game info. FINAL header and auto-refresh stop when `abstractGameState === 'Final'`. Auto-refresh every 5 minutes.

Source: `/game/{gamePk}/linescore` + `/game/{gamePk}/boxscore` + `/game/{gamePk}/playByPlay` (v1 path — do NOT use `feed/live` v1, it 404s)

### ⚙️ Settings
- **Select Team** — dropdown of all 30 teams; switching reloads all data, reapplies theme, resets caches
- **Color Theme** — overrides colours independently of active team; persists across team switches
- **Invert Colours** — swaps primary and secondary; works with theme override
- **🔔 Game Start Alerts** — push toggle; hidden on desktop via CSS `@media(min-width:1025px){ #pushRow { display:none !important } }`
- **📻 Live Game Radio** (`#radioRow`, `#radioToggle`) — calls `toggleRadio()`; auto-pairs to focused game's flagship station if in `APPROVED_RADIO_TEAM_IDS`, else Fox Sports. Also toggled from `#ptbRadioBtn`; both synced by `setRadioUI()`.
- **🔍 Radio Check** — sweep-test every station + Fox Sports fallback. See `docs/radio-system.md`.
- **🛠️ Dev Tools** — `toggleDevTools()` opens `#devToolsPanel`. See `docs/dev-tools.md`.
- Panel closes on click outside. All settings persist via `localStorage`.

---

## Key Functions Reference

All `app.js` functions organised by subsystem: `docs/functions.md`. Key subsystem docs:
- Pulse feed, HR/RBI cards, video clips: `docs/pulse-feed.md`
- Story carousel generators and rotation: `docs/story-carousel.md`
- At-Bat Focus Mode: `docs/focus-mode.md`
- Card Collection: `docs/card-collection.md`
- Radio system: `docs/radio-system.md`
- Demo Mode: `docs/demo-mode.md`

---

## 🎯 At-Bat Focus Mode

Live pitch-by-pitch tracker. Auto-selects most exciting game via `calcFocusScore()` (closeness + situation + count × inning multiplier). Polls linescore every 5s (Tier 1, ~5KB) and GUMBO every 5s unconditionally (Tier 2, ~500KB — timestamps only update per completed play, not per pitch). `focusIsManual=true` when user picks a game via compact switcher; `↩ AUTO` pill resets to auto-scoring.

Compact views: `#focusCard` in side rail (≥1025px desktop); `#focusMiniBar` below ticker (≤1024px). Full overlay: `#focusOverlay` (z-index 1100). Disabled during Demo Mode.

Full data flow, `calcFocusScore()` formula, tension labels, pitch type/result codes, `window.FocusCard` API: `docs/focus-mode.md`.

---

## 📖 Card Collection System

Auto-collects a player card every HR or key RBI event (live only, not demo). One HR slot + one RBI slot per player. 4 tiers: common < rare < epic < legendary. Higher tier replaces slot; same tier appends to `events[]` (capped 10); lower tier is no-op. Stored in `localStorage('mlb_card_collection')`, optionally synced to Redis.

`#collectionOverlay` (z-index 500) — full-screen binder. `#collectionRailModule` — compact side rail count chip. `flashCollectionRailMessage()` shows tier-colored result pill after card dismissal.

Full tier definitions, data model, lifecycle, `window.CollectionCard` API: `docs/card-collection.md`.

---

## 📻 Live Game Radio System

Background terrestrial sports-radio that auto-pairs to the focused game. Source of truth (read first):

```javascript
// app.js ~line 4431
const APPROVED_RADIO_TEAM_IDS = new Set([108,114,116,117,140,142,144,146,147]);
```

To enable a team: add `teamId` to this Set, bump comment date, bump version + `sw.js` CACHE. Falls through to Fox Sports Radio when no approved team is focused. ⚠️ Audacy-hosted stations (`live.amperwave.net/manifest/audacy-*`) play alternate content during games — never add Audacy URLs to `APPROVED_RADIO_TEAM_IDS`.

Enabled teams, disabled teams, Radio Check tool, Hls.js routing: `docs/radio-system.md`.

---

## 📽️ Demo Mode

Self-contained replay of April 27-28, 2026 from `daily-events.json` (562KB, 619 plays, 23 games). No API calls. Speeds: 1x (10s/play), 10x (1s/play), 100x (100ms/play). Toggle via `Shift+M` or "▶ Try Demo" button.

`devTuning` object, all demo globals, key functions: `docs/demo-mode.md`.

---

## PWA & Push Notifications

`manifest.json`: `display:standalone`, `start_url:"./"`, `scope:"./"` — all relative paths (GitHub Pages serves at `/Baseball-App/`). Push toggle hidden on desktop via CSS. `api/notify.js` fires for games starting within 10 min or started up to 2 min ago; deduplicates via `notified:{gamePk}` Redis key (24h TTL).

On every content commit, bump three things: (1) `<title>` version, (2) settings panel version, (3) `CACHE` in `sw.js`.

Icons, VAPID key storage, cron setup: `docs/pwa-push.md`.

---

## Dev Tools

| Shortcut | Mnemonic | Command |
|---|---|---|
| `Shift+D` | **D**ev tools | `toggleDevTools()` — toggle panel open/closed |
| `Shift+M` | de**M**o | `toggleDemoMode()` |
| `Shift+H` | **H**ome run | `replayHRCard()` |
| `Shift+B` | r**B**i | `replayRBICard()` |
| `Shift+V` | **V**ariants | `window.PulseCard.demo()` — cycle the 4 HR card templates |
| `Shift+F` | **F**ocus | `window.FocusCard.demo()` |
| `Shift+C` | **C**ollection | `window.CollectionCard.demo()` |
| `Shift+G` | **G**enerate | `generateTestCard()` — inject one random card into collection |
| `Shift+P` | **P**lay clip | `devTestVideoClip()` — live clip → yesterday cache → fetch fallback |
| `Shift+N` | **N**ews | `openNewsSourceTest()` |
| `Shift+L` | **L**og | open Dev Tools, scroll to Log Capture |
| `Shift+S` | **S**tate | open Dev Tools, scroll to App State |
| `Shift+I` | **I**nfo dump | `copyDiagnosticSnapshot()` — full snapshot to clipboard |

Panel contents, all tuning fields and defaults, `replayHRCard()` details, inspector + snapshot details: `docs/dev-tools.md`.

---

## ⚠️ Critical Gotchas

These are subtle bugs that could be silently re-introduced. Full issue list: `docs/KNOWN_ISSUES.md`.

1. **Date strings use local time** — all `startDate`/`endDate` params are built from `getFullYear`/`getMonth`/`getDate` (local). Avoid `toISOString().split('T')[0]` for date params — it returns UTC and will be one day ahead after ~8 PM ET, causing games to be skipped (fixed v1.45.5). `api/notify.js` intentionally uses UTC since it runs on Vercel servers. **Calendar `gameByDate` key also uses local timezone** (fixed v1.61) — previously used `gameDate.split('T')[0]` (UTC), placing evening US games on the wrong calendar cell.

2. **Audacy radio rights gap** — ~14 MLB market flagships hosted by Audacy (`live.amperwave.net/manifest/audacy-*`) play alternate content during games (talk shows / ads), not OTA simulcast. Adding an Audacy-hosted team to `APPROVED_RADIO_TEAM_IDS` will silently stream ads. Fix requires sourcing replacement URLs from iHeart / StreamTheWorld / Bonneville. See `docs/radio-system.md` → Audacy rights gap.

---

## Hardcoding Risks

| Item | Risk | Fix |
|---|---|---|
| `SEASON = 2026` | Must update each season | Derive from system date or MLB API |
| Team colours in TEAMS array | Teams rebrand | Verify each offseason |
| ESPN team IDs | Different system from MLB IDs | Verified Apr 2026 — re-verify each offseason |
| `WC_SPOTS = 3` | Rule change risk | Already a named const |
| ESPN API endpoint | Unofficial, undocumented | Monitor for breakage |
| MLB Stats API base URL | Unofficial | Watch for deprecation |
| Leaders `cats` array order | Index-based mapping — order matters | Re-test empirically if results look wrong |
| allorigins.win proxy URL | Free public proxy, no SLA | Swap URL if it goes down; retry logic in place |
| YouTube channel IDs (`youtubeUC`) | Teams may rebrand/change channels | Verify each offseason |
| Game state strings | MLB uses both `"Preview"` and `"Scheduled"` | Both checked — verify if new states appear |
| `MLB_TEAM_RADIO` URLs | radio.net-sourced; stations may change CDNs | Re-run 🔍 Radio Check sweep periodically |
| `APPROVED_RADIO_TEAM_IDS` Set | Hand-curated — last updated 2026-05-02 | Update Set when sweep results change |
| Hls.js CDN URL | `cdn.jsdelivr.net/npm/hls.js@1.5.18` — pinned, free CDN | Bundle locally if CDN unreliable |
| `NEWS_IMAGE_HOSTS` allowlist | Hand-curated CDN domain list — thumbnails silently fall back to placeholder if CDN changes | Add new hostname to `NEWS_IMAGE_HOSTS` regex in `app.js` |

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

---

## Feature Backlog

Full backlog in `docs/BACKLOG.md`. Active blocker: card binder scroll on desktop (see `docs/KNOWN_ISSUES.md` #7).

---

## Technical Debt Management

Say *"Start tech debt sprint"* to trigger a sprint. Claude executes: Audit → Remediation → QA → UAT → Finalization, with explicit user checkpoints between each stage.

- **Process guide:** `docs/technical-debt/WORKFLOW.md`
- **Quick reference:** `docs/technical-debt/README.md`
- **Completed sprints:** `docs/technical-debt/HISTORY.md`
- **All audits:** `docs/technical-debt/audits/`, `remediation/`, `qa/`, `sprints/`
