# MLB Tracker

A real-time pitch-by-pitch tracker that auto-focuses on the most exciting MLB game in progress — no runtime dependencies, no auth required.

**[▶ Live demo](https://q2z87bs2n7-ops.github.io/Baseball-App/)** &nbsp;·&nbsp; **[Source](https://github.com/q2z87bs2n7-ops/Baseball-App)** &nbsp;·&nbsp; **[Project handoff doc](./CLAUDE.md)**

> Default team is the New York Mets. Switch to any of the 30 MLB teams in Settings — the entire UI re-themes around the team's colours.

---

## Why this exists

For context, I have experience in Product Ownership of mobile applications but I can't code myself. What started as a work-related learning experience with Claude Code and Design via the web GUI, expanded into a 2 week after hours hobby project that turned a single HTML file into a basic modular ES6 app with esbuild bundling.

Features developed from basic content (News, Schedule, Results, Live games) to include a league-wide play-by-play feed (Pulse), a focus mode that auto-selects the most exciting game with pitch-by-pitch tracking and live radio, a rotating dynamic story carousel that updates throughout the day with 20+ generators surfacing narrative moments, and curated highlights and clips from games in progress and previous day's games. Additional features include a card collection system, a replayable pulse demo mode with vintage radio broadcasts replacing the live audio feeds, 30-team theming, developer tools and PWA support with push notifications.

It's not intended for any commercial use. The MLB Stats API is public and real-time — excellent to work with and deserves more credit than Claude or I. Optional account sync exists only so collections survive across devices. Everything else works unsigned-in. Optimal experience is on an iPad in landscape, but breakpoints support mobile and desktop too.

---

## Feature highlights

### ⚡ Pulse — league-wide live feed
The app's landing section. Every scoring play, home run, and runner-in-scoring-position moment across all simultaneous games flows into one chronological stream. The desktop layout splits into a ~700px main column — ticker, Story Carousel, and feed — with a 320px right rail holding upcoming/completed games, a news carousel, and the At-Bat Focus card.

A top bar carries controls for Sound Alerts (🔊), Live Game Radio (📻), Yesterday's Recap, and a light/dark theme toggle (☀️/🌙). A **MY TEAM** lens pill narrows the feed and ticker to just the active team's game. The sticky ticker runs across the top of the feed showing every game as a chip — team scores, inning, base diamond, and out indicators at a glance.

The feed tracks the shape of the day: pre-game shows a countdown to first pitch, gaps between games show a countdown to the next one, and once the slate wraps a "Slate complete" screen counts down to tomorrow. Sound alerts — HR bat crack, run chime, RISP heartbeat — are synthesised in real time with the Web Audio API, no audio files needed. When a home run or key scoring play fires, a full-screen player card overlay pops up with the batter's headshot and situation detail; where an official MLB highlight clip is available, a ▶ tile appears in the feed and the video plays inline through the same overlay.

### 📖 Story Carousel — 20 narrative generators
A rotating digest layer that surfaces story-level moments alongside the play feed. Generators cover home runs, walk-off threats, no-hitter watches, perfect game tracking, big innings, bases-loaded situations, stolen bases, end-of-inning recaps, multi-hit days, daily MLB leaders, hitting streaks, roster moves, win probability swings, award winners, season highs, on-this-day, yesterday's highlights, probable pitchers, and pre-game editorial matchup cards. Stories rotate via a priority × decay scoring algorithm with per-story cooldowns:

```javascript
// Each tick, eligible stories are scored by priority weighted with time decay
score = priority * (1 - decayRate) ^ (ageMinutes / 30)
```

Pre-game pools naturally lean on probable pitchers and yesterday recaps; mid-game pools surge with HR/walk-off/no-hitter cards. No mode flag needed — the maths handles it.

### 🎯 At-Bat Focus Mode
A live pitch-by-pitch tracker that auto-selects the most exciting game in progress using a tension formula combining closeness, runners on, count, and inning multiplier:

```javascript
// Simplified — closeness + situation bonuses, scaled by inning
score = (closeness + situation + countBonus) * inningMultiplier
// 9th-inning, bases loaded, full count, tied = ~2× extras-multiplier territory
```

Polls linescore (~5KB) every 5s for B/S/O and runners; pitches come from the GUMBO v1.1 feed using `diffPatch` deltas (~5KB instead of ~500KB) once seeded. A compact card sits in the side rail on desktop, a slim mini-bar appears on phone/iPad portrait, and a full overlay with pitch sequence, count pips, base diamond, and matchup stats is one tap away. Manual game switcher chips with a sky-blue `↩ AUTO` pill let you override the auto-pick. In Demo Mode, Focus follows the recorded focus track faithfully — including any manual overrides captured during the recording session.

### 📼 Yesterday's Recap
A dedicated full-screen section (accessible from the ⚡ top bar when yesterday's data is ready) that replays the previous day's slate as a media-rich digest. Features a shared video player with a scrollable playlist of official MLB highlight clips per game, a heroes strip (top batter and W/L pitcher per game), and per-game recap tiles with linescore and headline. Video content is sourced from the MLB `/game/{pk}/content` endpoint. The section shares the Pulse navy theme and uses the same top bar for visual consistency.

### 📚 Card Collection
Every HR or key RBI event auto-collects a player card. Four rarity tiers derived from situation:

| Tier | Trigger |
|---|---|
| Legendary | Walk-off grand slam |
| Epic | Grand slam, walk-off home run, walk-off RBI |
| Rare | Go-ahead, game-tying |
| Common | Everything else |

Higher-tier events upgrade existing slots; same-tier duplicates are appended to a 10-event history per slot. The binder UI is a 3×3 pocket grid with rarity glow borders, team-tinted pages (when sorted by team), career stats fetched from the MLB API, and a watermark logo. Tapping a card replays the original Pulse player card overlay.

Optional cross-device sync via GitHub OAuth or email magic-link, backed by Upstash Redis. Sign-in is fully optional — localStorage works alone.

### 📻 Live Game Radio
Auto-pairs the focused game's flagship terrestrial radio station to a `<audio>` element, with Hls.js for HLS streams and native audio for direct AAC/MP3. Currently 10 verified teams: LAA, CLE, DET, HOU, TEX, MIN, ATL, MIA, NYY, SF. The remaining 20 stations are in the codebase but excluded from auto-pairing — most are Audacy-owned flagships that hold OTA simulcast rights but not MLB streaming rights, so their digital streams play alternate content (talk shows, ads) during games. A built-in **Radio Check** sweep tool (under Dev Tools) lets you test, mark ✅/❌, take notes per station, and copy categorised markdown to update the approved list.

### 🎙️ Classic Radio — Demo Mode atmosphere
When Demo Mode is active, the 📻 radio button streams full-length classic MLB broadcasts from the Internet Archive rather than live radio. A curated pool of four legendary calls — Vin Scully on the 1957 Giants/Dodgers, the 1968 Mantle farewell Yankees/Red Sox game, the 1969 Mets/Orioles World Series Game 5, and Tom Seaver's 19-strikeout game in 1970 — plays from a random offset between the 30-minute and 90-minute mark, skipping pre-game and post-game dead air. On every auto-focus switch in demo, a fresh broadcast + offset is rolled. The 📻 nav button and the status indicator work identically to live radio — the green "Playing" badge and broadcast title update the same way. Accessible independently via Dev Tools → 🎙️ Classic Radio.

### 🎬 Demo Mode
Full-day replay of a recorded MLB slate with no API calls — works fully offline.

Key capabilities:
- **In-app Recorder** (`src/dev/recorder.js`) — captures live Pulse state passively with zero added API calls. Exports a `daily-events.json` with pitch timelines, boxscore snapshots, content cache, focus track, and story carousel caches. `trimClip()` strips to demo essentials (~87% smaller). Hard cap at 10 MB with a 5 MB soft warning.
- **Backlog + queue replay** — feed items before recording started play as a pre-load backlog (tune-into-Pulse-mid-game UX); plays captured during recording form the live queue.
- **Faithful focus replay** — demo follows the `focusTrack[]` recorded during the session, including user-triggered manual switches. A manual switch during demo correctly overrides auto behaviour.
- **Speed controls** — 1× (10s/play), 10× (1s/play), 30× (~333ms/play). ⏹ Exit Demo button. 🔥 Next HR fast-forwards at 20× through plays until an HR fires, then auto-pauses.
- **Video tiles in demo** — `pollPendingVideoClips` walks the `contentCacheTimeline` and patches feed items with ▶ video tiles at the right replay moment.
- **Clean exit** — `exitDemo` clears every demo cache and calls `resumeLivePulse`, which re-fires loaders, restarts all polling timers, and runs `pollLeaguePulse → buildStoryPool → setFocusGame`. No blank Pulse after exit.
- **Dev Tools QC panel** — shows all 4 archive.org broadcasts individually with ▶ Play buttons and broadcast titles for independent testing.

### 🔔 PWA + Push Notifications
Installable as a native app on iOS and Android. Game-start alerts via Web Push, with subscriptions stored in Upstash Redis. A GitHub Actions cron pings the `/api/notify` Vercel function every 5 minutes, which checks the MLB schedule and fires VAPID-signed push messages to subscribers, deduplicating per-game with a 24h TTL key.

### 🎨 30-team theming
Switching teams swaps nine CSS variables computed from the team's primary colour (page background, card surfaces, borders, accents, header text contrast). Pulse uses its own independent palette — dark navy by default, switchable to a light mode via the ☀️/🌙 toggle in the Pulse top bar — so the league-wide feed stays visually consistent regardless of which team is selected. Theme overrides and a colour-invert toggle live in Settings. Every team has verified ESPN IDs (for news) and YouTube channel IDs (for media).

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML + CSS + ES6 modules — `index.html` + `styles.css` + ~38 modules under `src/` bundled into `dist/app.bundle.js` via esbuild |
| Sidecar JS | `focusCard.js`, `pulse-card-templates.js`, `collectionCard.js` (IIFE modules, all `defer` in `<head>` — exposed via `window.*`) |
| Bundler | [esbuild](https://esbuild.github.io/) — single command (`npm run build`), IIFE output, ~520KB |
| Streaming | [Hls.js](https://github.com/video-dev/hls.js) (light build, CDN, ~50KB) for HLS radio streams |
| Data | [MLB Stats API](https://statsapi.mlb.com/api/v1/) — public, no auth |
| News | ESPN news endpoint + MLB RSS via Vercel proxy |
| Backend | Vercel serverless functions (Node) |
| Storage | Upstash Redis (push subscriptions, sessions, card sync) |
| Auth | GitHub OAuth + email magic-link (SendGrid) |
| Hosting | GitHub Pages (static app) + Vercel (serverless API) |
| Cron | GitHub Actions scheduled workflow |

**Build pipeline is opt-in for source edits only.** Push to `main` and GitHub Actions rebuilds the bundle automatically — but `dist/app.bundle.js` is also committed so a manual run isn't required for static hosting.

---

## How it works

```
                        ┌──────────────────────┐
                        │  GitHub Pages         │
                        │  index.html + assets  │
                        └──────────┬───────────┘
                                   │
                                   ▼
            ┌──────────────────────────────────────────┐
            │           Browser (PWA capable)           │
            │  ┌────────────────────────────────────┐  │
            │  │  Pulse · Carousel · Focus · Cards  │  │
            │  └────────────────────────────────────┘  │
            └────┬──────────────┬─────────────┬───────┘
                 │              │             │
                 ▼              ▼             ▼
       MLB Stats API    Vercel /api/*    Hls.js → radio CDN
       (live data)      (push, auth,     (terrestrial AAC/HLS)
                         RSS proxy,      + archive.org (demo)
                         card sync)
                              │
                              ▼
                       Upstash Redis
                       (subs, sessions, cards)
                              ▲
                              │
                       GitHub Actions cron
                       (every 5 min → /api/notify)
```

**Data refresh cadences:**

- Pulse poll: 15s (schedule, linescore, play-by-play, timestamps stale check)
- Story pool rebuild: 30s (decoupled from Pulse poll)
- Story rotation: 4.5s (configurable via Dev Tools)
- Focus Mode linescore + GUMBO: 5s
- Live game view: 30s
- Home card / Around the League: 60s while active
- Card collection background sync: 30s (when signed in)
- Push notify cron: every 5 min

**Performance touches:**

- `feedItems` capped at 600 entries (oldest trimmed)
- GUMBO `diffPatch` after initial seed — first call ~500KB, subsequent ~1–5KB
- Boxscore cache shared across story generators
- Service worker caches app shell (`index.html`, `dist/styles.min.css`, `dist/app.bundle.js`, sidecar JS) for offline boot
- Theme variables persisted to localStorage and applied via inline `<script>` in `<head>` to prevent flash-of-wrong-theme on reload

---

## Running it locally

```bash
git clone https://github.com/q2z87bs2n7-ops/Baseball-App.git
cd Baseball-App
python3 -m http.server 8000   # or any static server
```

Open `http://localhost:8000`. That's the whole setup — no npm, no env vars required for the app. Auth (GitHub OAuth, email magic-link) and push notifications require the Vercel functions and env vars listed in [CLAUDE.md](./CLAUDE.md#session-storage--cross-device-sync) — they will silently fail without Vercel. Everything else works against the public MLB Stats API.

> Note: YouTube embeds in the Home tab YouTube widget return `Error 153` on `file://` URLs. Use a local server, not double-click.

---

## Project structure

```
index.html                — HTML structure only (no CSS, no JS)
styles.css                — all CSS
src/                      — ES6 module source (~38 files): main.js + state.js
                            + config/ + diag/ + utils/ + data/ + ui/ + feed/
                            + pulse/ + carousel/ + focus/ + cards/ + collection/
                            + radio/ + push/ + auth/ + sections/ + demo/ + dev/
                            (full map: docs/module-graph.md)
build.mjs                 — esbuild driver
dist/app.bundle.js        — bundled IIFE build (~520KB), served by GitHub Pages
focusCard.js              — At-Bat Focus Mode visual templates
pulse-card-templates.js   — HR/RBI player card variants (4 templates)
collectionCard.js         — Card Collection binder visuals
daily-events.json         — Demo Mode static snapshot (2.2MB)
sw.js                     — service worker (PWA cache + push handler)
manifest.json             — PWA install metadata
icons/                    — diamond-themed PWA icon set
api/
  ├── subscribe.js        — push subscribe/unsubscribe
  ├── notify.js           — schedule check + push fire (cron target)
  ├── test-push.js        — manual push test
  ├── proxy-rss.js        — MLB/team RSS proxy (CORS bypass)
  ├── proxy-youtube.js    — YouTube channel feed proxy
  ├── auth/github.js      — GitHub OAuth callback
  ├── auth/email-*.js     — email magic-link request + verify
  └── collection-sync.js  — cross-device card sync
.github/workflows/        — build (auto bundle on push to main)
                            + notify cron + manual test push
CLAUDE.md                 — full project handoff (~28KB)
docs/                     — per-feature deep-dives + module graph + backlog
```

For the full breakdown of architecture, every API endpoint, every CSS variable, every story generator, and every quirk — see **[CLAUDE.md](./CLAUDE.md)** and the per-subsystem docs in [`docs/`](./docs).

---

## Status & roadmap

**Current version:** v3.47 (May 2026).

Active development is incremental — feature branches under `claude/*`, version bumped on every commit, service worker `CACHE` constant bumped to force PWA refresh. v3.40.0 completed the modular refactor; source lives under `src/` as ES6 modules and ships through esbuild. v3.46 overhauled Demo Mode with a full in-app recorder and replay engine. v3.47 added classic radio atmosphere and UX polish to the demo experience.

Open backlog items live in [`docs/BACKLOG.md`](./docs/BACKLOG.md). Highlights:

- Career stats expansion on player cards (last 10-game average, hot streak context)
- Replacement radio URLs for Audacy-affected stations (rights gap)
- Expanding Classic Radio pool to a per-team URL map
- Dynamic season year (currently `SEASON = 2026` is hardcoded)
- GitHub Actions cron reliability (free tier runs ~once/hour rather than every 5 min)

---

## Known constraints

<details>
<summary>Things that aren't broken but are worth knowing</summary>

- **MLB Stats API is unofficial.** Stable for years, but no SLA. Some endpoints (`/game/{pk}/feed/color`) are documented in the spec but return 404 in practice.
- **Audacy radio rights gap.** ~14 MLB market flagships hosted by Audacy stream alternate content during games. Excluded from auto-pairing via an `APPROVED_RADIO_TEAM_IDS` allowlist.
- **GitHub Actions cron is approximate.** Configured for `*/5` but in practice runs closer to once per hour on the free tier — switching to Vercel Cron is on the backlog.
- **Theming relies on contrast heuristics.** Teams with very dark secondary colours (Giants, Orioles) get a luminance floor applied to keep accents readable.
- **Leaders index mapping is empirical.** The `/stats/leaders` endpoint doesn't guarantee response order matches the requested category order. Re-test if results look wrong after API changes.
- **Classic Radio is a POC.** The archive.org broadcast pool is hardcoded (4 recordings). Easy to expand to a `teamId → URL[]` map — just hasn't been needed yet.

</details>

---

## Credits

- **[MLB Stats API](https://statsapi.mlb.com/)** — every live data point in the app
- **[ESPN](https://www.espn.com/)** — news headlines (unofficial endpoint)
- **[Hls.js](https://github.com/video-dev/hls.js)** — HLS streaming for radio
- **[Internet Archive](https://archive.org/)** — classic MLB broadcast recordings used in Demo Mode
- **[Upstash](https://upstash.com/)** — Redis for push subscriptions and card sync
- **[Vercel](https://vercel.com/)** — serverless hosting for the API layer
- **Built primarily in collaboration with [Claude](https://claude.com/)** — see [CLAUDE.md](./CLAUDE.md) for the full handoff doc that drives the development loop

This project is not affiliated with, endorsed by, or sponsored by Major League Baseball or any MLB club. Team names, logos, and colours are property of their respective owners.
