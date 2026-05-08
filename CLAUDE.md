# MLB Tracker — Project Handoff

## What This Is
An MLB sports tracker, defaulting to the New York Mets. All data is pulled live from public APIs. Source lives under `src/` as ES6 modules, bundled with esbuild into `dist/app.bundle.js`; CSS in `styles.css`; HTML skeleton in `index.html`.

**Current version:** v3.47

**Recent versions** (full history in `CHANGELOG.md`):
- **v3.47** — **Radio button stays ON during archive feed loading.** UX polish: when loading an archive broadcast, the radio button now displays immediately in a "(loading…)" state instead of flickering off then back on. Once metadata loads and playback starts, the label updates to the final broadcast title. Improves perceived smoothness of feed switching in Dev Tools QC panel.
- **v3.47.5** — **Demo Feeds QC panel.** Replaced random archive test button with a Dev Tools panel showing all 4 available archive.org broadcasts individually. Each broadcast has a ▶ Play button for independent testing. Panel displays broadcast title (e.g., "1969 Mets vs Orioles WS Game 5"), truncated URL filename, and plays at random offset (30-90 min) when triggered. New `playArchiveUrl(url)` export allows QA to test each historical broadcast separately and know exactly which one is playing.
- **v3.47.4** — **Fix demo mode audio dropout.** When Demo Mode rapidly switches focus games (every play tick), the classic radio was calling `_playUrl()` with a random archive URL, causing unnecessary pause-load cycles. Added URL caching: if the same URL is already queued/playing, skip the pause-load sequence and just update the offset. Eliminates audio fluttering during demo replay.
- **v3.47.3** — **Add demo archive test button.** New 🎬 Test Demo Feeds button in Dev Tools Actions for testing archive radio playback with random offset matching demo behavior.
- **v3.47.2** — **Archive feed test button.** Adds test button in Dev Tools for triggering demo archive feed playback.
- **v3.47.1** — **Demo focus respects manual override.** `selectFocusGame()`'s demo branch now early-returns when `state.focusIsManual` is true (same gate as live mode) and stops assigning `state.focusIsManual` from the captured `entry.isManual` flag. Without these fixes, the recorder user's heavy ATH @ PHI focus track (11/12 entries in the current sample) was yanking the demo viewer back to that game within a play or two of any manual switch via the focus switcher chips.
- **v3.47** — **Classic Radio in demo.** New `src/radio/classic.js` module streams full-length classic MLB broadcasts from archive.org as background atmosphere in Demo Mode. No timestamp sync — picks a random URL from a hardcoded pool of 4 files (1957 Giants/Dodgers Vin Scully, 1968 Yankees/Red Sox Mantle final, 1969 Mets/Orioles WS Game 5, 1970 Padres/Mets Seaver 19K) and a random offset between the 30-min and 90-min mark (skips pre-game and post-game). On every focus-game switch in demo, re-rolls a fresh URL + offset. The existing `toggleRadio()` (📻 nav button + settings toggle) is demo-aware: in demo it delegates to `devTestClassicRadio` instead of live streams, with shared `setRadioUI` so the green "Playing" indicator + status label work identically. Also accessible via Dev Tools → 🎙️ Classic Radio (POC). Defensive `stopRadio()` on every roll silences any leaked live-radio audio. Console logs `[classic radio] play` / `[classic radio] roll on focus switch` with decoded broadcast titles for diagnostics. `exitDemo` calls `stopClassic` so audio doesn't bleed into live mode. Hardcoded pool means this is technically a POC — easy to expand to a `teamId → URL[]` map later if desired.
- **v3.46** — **Demo Mode v2.** Major overhaul of the static demo experience.
  - **In-app Recorder** (`src/dev/recorder.js`) captures live Pulse state into a fresh `daily-events.json`. Hooks `pollLeaguePulse`, `pollGamePlays`, `pollFocusRich`, `fetchGameContent`, `fetchBoxscore`, `addFeedItem`, `fetchFocusPlayerStats`, `setFocusGame` as passive observers — zero added API calls. UI lives under Dev Tools → 📼 Recorder. On Start: deep-clones `state.*` baseline, then layers observer captures + 30s cache snapshots. On export: stamps `metadata.exportedAt`/`durationMs`/`midRun` so mid-run downloads are valid; recording continues uninterrupted. `trimClip()` strips clips to demo essentials (~87% smaller). Hard caps + soft warn at 5 MB / auto-stop at 10 MB.
  - **Recorder v2 schema** in `daily-events.json` adds `metadata`, `pitchTimeline`, `boxscoreSnapshots`, `contentCacheTimeline`, `focusStatsCache`, `focusTrack`, `lastVideoClip`. Story-carousel caches now nested under `caches.*` (loader still falls back to legacy top-level shape).
  - **Demo replay rewrite.** `initDemo` splits `feedItems` by `metadata.startedAt` into backlog + queue. Backlog plays pre-load into the feed at demo open (tune-into-Pulse-mid-game UX) and walk through `gameStates` so ticker + side-rail show the correct mid-day distribution. Queue is recording-period plays only — first replayed event is the first new play after Record was clicked. `demoCurrentTime` starts at the first queue play, so `pitchTimeline`/`contentCacheTimeline`/`focusTrack` lookups land cleanly.
  - **Consumer expansion.** Focus Mode in demo rebuilds `focusState` + pitch sequence from `pitchTimeline` envelopes (with bootstrap progression that walks through envelopes by `demoPlayIdx` fraction). `selectFocusGame` follows `focusTrack[]` for faithful auto/manual switching, falls back to `focusTrack[0]` until demo time crosses the recording window. `fetchBoxscore` reads `boxscoreSnapshots` in demo. `pollPendingVideoClips` walks `contentCacheTimeline` and patches feed items with ▶ tiles. HR + RBI cards collect into a session-only `state.demoCardCount` (real localStorage stays untouched). Open Collection in demo shows a sign-in CTA. RBI cards now fire in demo (rbi inferred from score delta, calcRBICardScore + threshold).
  - **Carousel demo guards.** `genWinProbabilityStories` now early-returns in demo (was hitting `/contextMetrics` API and surfacing nonsense "100% favorites" cards). `genLiveWinProbStories` reads from hydrated `liveWPCache`.
  - **Demo control panel updates.** Speed buttons now 1x / 10x / 30x (was 1x/10x/100x — 100x was unwatchable). New ⏹ Exit Demo button. 🔥 Next HR now fast-forwards at 20x through plays (animated) until an HR fires, then auto-pauses on the HR card. Disclaimer toast at demo start now wraps multi-line and stays for 12 s, calling out demo limitations (focus pitch data limited, radio simulated).
  - **Clean exit + auto-resume live polling.** `exitDemo` clears every cache `initDemo` populated and calls a new `resumeLivePulse` callback that mirrors `initReal`'s live section: refires loaders, runs `pollLeaguePulse → buildStoryPool → setFocusGame`, restarts pulse/storyPool/videoClip timers. No more blank Pulse after exit.
  - **Yesterday Recap demo support.** Anchored to `state.demoDate` so "yesterday" maps to the day before the demo (May 5 in the current sample). Always fetches fresh via `loadYdForDate` in demo (`fetchGameContent` no longer guards on demoMode), so videos load.
- **v3.43.3** — Settings menu polish + Giants radio confirmed (KNBR 104.5/680). Cards Collected emoji updated, Appearance block consolidated, Sync Collection compacted. Dev Tools: stripped explanatory text from 5 action buttons.
- **v3.43** — News carousel + News-tab image fixes. Carousel rolled back from `/api/proxy-news` aggregator to MLB-RSS-then-ESPN fallback. `MLB_RSS_FEEDS.mlb` updated to `/feeds/news/rss.xml` (was deprecated `/feeds/rss.xml` returning 500). MLB.com self-closing `<image href="..."/>` tag now extracted by `parseRssItems`. Radio Check moved Settings → Dev Tools.
- **v3.42.x** — News carousel restored to Pulse side rail; `fmtRate` import bug; Demo Mode `DEBUG` undefined fix; legacy `app.js` removed (bundle is sole source of truth).
- **v3.40.0** — Modular refactor complete. `src/main.js` ~680 LOC orchestration; everything else extracted under `src/<subsystem>/`. Single `state.js` container. See `docs/module-graph.md`.
- **v3.39.0** — Initial bundle scaffolding (esbuild + first module extraction).
- **v3.38** — Dev Tools enhancement series: Log Capture, App State Inspector, Network Trace, localStorage + SW inspectors, Diagnostic Snapshot, Live Controls.

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
7. **Version every change** — bump `<title>` tag + settings panel version string on every commit. Use `vX.Y.Z` format. On a `claude/` branch, increment the patch `Z` per commit (e.g. `v3.49.3` → `v3.49.4`). On merge to main, bump the minor `Y` and drop the patch in a separate commit (e.g. branch ships `v3.49.4` → main becomes `v3.50`); the next branch then starts adding patches against `v3.50`. **Also bump `CACHE` in `sw.js`** on every commit that changes app content (CSS / JS / HTML body); version-string-only release commits do not need a CACHE bump.
8. **No rewrites** — never rewrite large sections. Targeted edits only.

---

## Architecture Overview

### Repo structure
```
index.html              — HTML skeleton only: structure, overlays, nav, section divs. No CSS or JS. Loads `dist/app.bundle.js` via a static `<script defer>` after the three runtime-dep IIFEs.
styles.css              — all CSS source: variables, layout classes, media queries, animations. Edit this file; build emits the minified artifact below.
dist/styles.min.css     — committed minified CSS (~64KB) that GitHub Pages serves. Regenerated by GitHub Actions on push to main.
src/main.js             — boot IIFE + initReal callback wiring + top-level event listeners + window-global bridge. ~680 LOC of orchestration; everything substantive lives under src/<subsystem>/.
src/state.js            — single mutable hot-state container; all importers receive a live binding.
src/config/constants.js — SEASON, WC_SPOTS, MLB_BASE, MLB_BASE_V1_1, API_BASE, TEAMS, MLB_THEME, NEWS_SOURCE_LABELS/ICONS, TIMING.
src/devtools-feed/      — devLog.js (console wrap + ring buffer) + devNet.js (fetch wrap). Runtime instrumentation feeding the Dev Tools panel inspectors. SIDE EFFECTS ON IMPORT.
src/utils/              — format.js (fmt/fmtRate/tcLookup/pickOppColor) + news.js (NEWS_IMAGE_HOSTS allowlist).
src/data/               — boxscore.js + clips.js (pickPlayback/pickHeroImage/pollPendingVideoClips/devTestVideoClip).
src/ui/                 — overlays.js (video + player-card overlays), theme.js (applyTeamTheme/applyPulseMLBTheme), sound.js, wakelock.js, lens.js (My Team filter).
src/feed/render.js      — renderTicker, renderFeed, addFeedItem, showAlert, pulseGreeting, ticker chips.
src/pulse/poll.js       — pollLeaguePulse, pollGamePlays, getEffectiveDate.
src/carousel/           — rotation.js (buildStoryPool, rotateStory) + generators.js (~22 gen* story generators + cache loaders).
src/focus/mode.js       — Focus Mode (calcFocusScore, polling, overlay).
src/cards/playerCard.js — showPlayerCard, showRBICard, getHRBadge, getRBIBadge, calcRBICardScore, replayHR/RBICard.
src/collection/         — book.js (tier system + binder UI + collectCard) + sync.js (cross-device Redis sync).
src/radio/              — stations.js (data) + engine.js (toggleRadio/loadRadioStream) + check.js (sweep tool).
src/push/push.js        — Web Push lifecycle.
src/auth/               — oauth.js (sign-in initiators) + session.js (signOut/updateSyncUI/showSignInCTA).
src/sections/           — loaders.js (every section loader) + yesterday.js (Yesterday Recap overlay).
src/demo/mode.js        — Demo Mode (replay engine, speed controls).
src/dev/                — tuning.js (panel UI + click delegator), panels.js (Log/AppState/Net/Storage/SW/LiveControls/Snapshot inspectors), youtube-debug.js, video-debug.js, news-test.js.
build.mjs               — esbuild driver. `npm run build` → `dist/app.bundle.js` + sourcemap and `dist/styles.min.css` (in parallel). `npm run watch` for dev.
dist/app.bundle.js      — committed IIFE bundle (~464KB) that GitHub Pages serves. Regenerated by GitHub Actions on push to main.
focusCard.js            — runtime dependency: window.FocusCard.renderCard/renderOverlay/renderPitchPill/demo().
pulse-card-templates.js — runtime dependency: window.PulseCard.render()/demo() for HR/RBI card overlays.
daily-events.json       — runtime dependency: static snapshot for client-facing Demo Mode.
collectionCard.js       — runtime dependency: window.CollectionCard.renderBook/renderMiniCard/renderRailModule/demo().
sw.js                   — service worker (PWA caching + push event handling).
manifest.json           — PWA manifest (install metadata, icons).
icons/                  — app icons (icon-192.png, icon-512.png, icon-180.png, icon-maskable-512.png, favicon.svg, icon-mono.svg).
api/subscribe.js        — Vercel serverless: store/remove push subscriptions in Upstash Redis.
api/notify.js           — Vercel serverless: check MLB schedule, fire push notifications.
api/test-push.js        — Vercel serverless: sends a test push immediately.
api/proxy-rss.js        — Vercel serverless: fetch + parse MLB RSS feeds, return JSON (bypasses CORS).
api/proxy-youtube.js    — Vercel serverless: fetch + parse YouTube channel feeds, return JSON (bypasses CORS).
.github/workflows/      — build.yml (auto-rebuild bundle on push to main) + notify-cron.yml (*/5 * * * *) + test-push.yml (manual).
vercel.json             — Vercel function config (maxDuration).
package.json            — esbuild devDep + web-push + @upstash/redis (Vercel functions).
```

Full module map and layering rule: `docs/module-graph.md`.

### Deployment
- **Static app**: GitHub Pages — `main` branch, root directory
- **Push API (`/api/*`)**: Vercel Hobby — `https://baseball-app-sigma.vercel.app`
- **Cron**: GitHub Actions (free) pings `/api/notify` every 5 minutes

### Session Storage & Cross-Device Sync
Sign-in is **100% optional**. Signed-in users get card collection sync. Auth: GitHub OAuth + Email magic-link. Session: 40-char random token, 90-day TTL, `localStorage('mlb_session_token')`. Collection sync: `GET/PUT/POST /api/collection-sync` → Upstash Redis `collection:{userId}`. Merge: highest tier wins; same tier keeps newer `collectedAt` + merged events (deduped, capped 10). Vercel env vars required: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `EMAIL_API_KEY`, `EMAIL_FROM_ADDRESS`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`. Full setup: `docs/auth-architecture.md`.

### Runtime dependencies — DO NOT DELETE

| File | Loaded by | Purpose |
|---|---|---|
| `dist/styles.min.css` | `index.html` `<link rel="stylesheet">` + `sw.js` SHELL cache | Minified CSS served at runtime (built from `styles.css` source) |
| `dist/app.bundle.js` | `index.html` `<script defer>` | Bundled modular JS |
| `focusCard.js` | `index.html` `<script defer>` | At-Bat Focus Mode visuals |
| `pulse-card-templates.js` | `index.html` `<script defer>` | HR/RBI player card overlays |
| `collectionCard.js` | `index.html` `<script defer>` | Card Collection binder visuals |
| `daily-events.json` | `src/demo/mode.js` `fetch('./daily-events.json')` | Demo Mode — client-facing feature |
| `manifest.json` | `index.html` `<link rel="manifest">` | PWA install metadata |
| `icons/favicon.svg` | `index.html` `<link rel="icon">` | Browser tab icon |
| `icons/icon-180.png` | `index.html` `<link rel="apple-touch-icon">` | iOS home screen icon |
| `icons/icon-192.png` | `sw.js` SHELL cache + `manifest.json` | PWA icon |
| `icons/icon-512.png` | `sw.js` SHELL cache + `manifest.json` | PWA icon (splash) |
| `icons/icon-maskable-512.png` | `manifest.json` | PWA maskable icon |
| `icons/icon-mono.svg` | `manifest.json` | iOS 16.4+ monochrome icon |

**Rule:** before deleting any file in repo root or `icons/`, grep `index.html`, `src/`, `sw.js`, and `manifest.json` for references first.

### File responsibilities

| Change type | File |
|---|---|
| Add/move an HTML element, section, overlay, button | `index.html` |
| Change how something looks (colours, layout, spacing, animations) | `styles.css` |
| Add/fix a JS function, API call, game logic | `src/<subsystem>/*.js` (find module via `docs/module-graph.md`) |
| New cross-cutting state | `src/state.js` |
| New section loader / overlay | `src/sections/loaders.js` or new `src/sections/<name>.js` |
| New feature with HTML + CSS + JS aspects | `index.html` + `styles.css` + relevant `src/` modules |
| PWA caching behaviour or push notification handler | `sw.js` |
| Version bump | `index.html` (title + settings-version + bundle/CSS cache-bust `?v=`) |
| `CACHE` constant bump (forces PWA refresh) | `sw.js` |

**Script load chain:** `pulse-card-templates.js` → `focusCard.js` → `collectionCard.js` → `dist/app.bundle.js` (all `<script defer>` in `<head>`, executed in order after the document parses). Theme-flash prevention snippet at `index.html:7` is the only inline-and-synchronous script — must stay inline. (Note: a previous dynamic script-insert pattern caused the bundle to execute **async**; the readyState guard in `src/dev/tuning.js` is no longer load-order-critical but is harmless.)

**Where to edit:** always edit `src/**/*.js` and rebuild the bundle (`npm run build`) before pushing.

### Key global state

All hot mutable state lives in `src/state.js` as properties of a single exported `state` object — every importer receives a live binding. Constants are in `src/config/constants.js`. Full declarations: `docs/global-state.md`.

```javascript
// src/config/constants.js
export const SEASON = 2026                    // hardcoded — update each season
export const MLB_BASE = 'https://statsapi.mlb.com/api/v1'
export const MLB_BASE_V1_1 = 'https://statsapi.mlb.com/api/v1.1'  // Pulse only — v1 timestamps path 404s
export const TEAMS = [...]                    // 30 teams with colors, IDs, YouTube channel IDs

// src/state.js
export const state = {
  activeTeam: TEAMS.find(t => t.id === 121),  // defaults to Mets
  scheduleData: [], scheduleLoaded: false,
  rosterData: { hitting, pitching, fielding },
  statsCache: { hitting, pitching },
  feedItems: [],                              // all feed items newest-first
  gameStates: {},                             // gamePk → { awayAbbr, homeAbbr, awayScore, ... }
  focusGamePk: null,                          // gamePk of focused game (Focus Mode)
  demoMode: false,                            // true when Demo Mode active
  devColorLocked: false,
  devTuning: { rotateMs: 4500, rbiThreshold: 10, rbiCooldown: 90000, ... },
  // ...
};
```

**Mutation rule:** importers must mutate via `state.X` (e.g. `state.gameStates[pk] = newGame`). Never `let local = state.gameStates;` and reassign — that breaks the live binding for other modules. Reads via destructuring or `Object.values(state.gameStates)` are fine.

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
- **🛠️ Dev Tools** — `toggleDevTools()` opens `#devToolsPanel`. Includes 🔍 Radio Check sweep tool (moved from Settings in v3.43). See `docs/dev-tools.md` and `docs/radio-system.md`.
- Panel closes on click outside. All settings persist via `localStorage`.

---

## Key Functions Reference

All bundle functions organised by subsystem: `docs/functions.md`. Key subsystem docs:
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

Background terrestrial sports-radio that auto-pairs to the focused game. Source of truth (`src/radio/stations.js`):

```javascript
export const APPROVED_RADIO_TEAM_IDS = new Set([108,114,116,117,137,140,142,144,146,147]);
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
| `APPROVED_RADIO_TEAM_IDS` Set | Hand-curated — last updated 2026-05-06 | Update Set when sweep results change |
| Hls.js CDN URL | `cdn.jsdelivr.net/npm/hls.js@1.5.18` — pinned, free CDN | Bundle locally if CDN unreliable |
| `NEWS_IMAGE_HOSTS` allowlist | Hand-curated CDN domain list — thumbnails silently fall back to placeholder if CDN changes | Add new hostname to `NEWS_IMAGE_HOSTS` regex in `src/utils/news.js` |

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
