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
Real-time scoring plays, home runs, and RISP moments from all simultaneous games in a single chronological stream. Desktop layout: main feed + ticker + Story Carousel on the left, upcoming games + news carousel + At-Bat Focus on the right. Sticky ticker across the top with team scores, inning, and base diamond. Sound alerts (HR crack, run chime, RISP heartbeat) synthesized in real time; highlight clips embedded inline when available.

### 📖 Story Carousel — 20 narrative generators
Rotating digest that surfaces story moments alongside the play feed. Covers HRs, walk-offs, no-hitters, perfect games, big innings, bases-loaded situations, hitting streaks, probable pitchers, and more. Rotates via priority + time decay scoring — pre-game pools favor probable pitchers, mid-game pools surge with HR/walk-off cards.

### 🎯 At-Bat Focus Mode
Live pitch-by-pitch tracker that auto-selects the most exciting game in progress based on closeness, runners on, count, and inning. Compact card on desktop, mini-bar on mobile, full overlay with pitch sequence and base diamond one tap away. Manual game switcher with sky-blue `↩ AUTO` pill to override the pick.

### 📼 Yesterday's Recap
Full-screen replay of the previous day's slate with official MLB highlight clips per game, heroes strip (top batter/pitcher), and recap tiles with linescore.

### 📚 Card Collection
Auto-collects player cards on HRs and key RBIs in four rarity tiers: Legendary (walk-off grand slam), Epic (grand slam/walk-off), Rare (go-ahead/tie), Common (everything else). Optional cross-device sync via GitHub OAuth or email.

### 📻 Live Game Radio
Auto-pairs the focused game's flagship radio station (10 verified teams: LAA, CLE, DET, HOU, TEX, MIN, ATL, MIA, NYY, SF). Built-in Radio Check sweep tool for testing and updating approved stations.

### 🎬 Demo Mode
Full-day replay from a recorded MLB slate — no API calls, works offline. In-app recorder captures live state passively, speed controls (1× / 10× / 30×), and a ⏹ Exit Demo button. Classic Radio in demo mode plays vintage broadcasts from the Internet Archive.

### 🔔 PWA + Push Notifications
Installable as a native app on iOS and Android. Game-start alerts via Web Push backed by Upstash Redis. GitHub Actions cron checks the MLB schedule every 5 minutes and fires push notifications to subscribers.

### 🎨 30-team theming
Switching teams dynamically re-colors the entire UI (page background, cards, borders, accents). Pulse has its own dark navy palette, toggleable to light mode via ☀️/🌙 button. Theme overrides and color invert available in Settings.

### 📊 Complete MLB companion
Beyond Pulse, full section coverage: **Schedule** (calendar view with doubleheader support, click-to-expand boxscores/linescore), **Standings** (division standings, Wild Card race, full MLB), **Stats** (daily leaders, 40-man roster, individual player stats), **Around the League** (all MLB matchups with day toggle), **News** (aggregated from ESPN, MLB RSS, and YouTube team channels), and **Live Game View** (detailed linescore, inning-by-inning play log, box score tabs with batting/pitching stats).

### 🛠️ Developer Tools
Built-in debugging suite accessible via `Shift+D`: Log Capture (ring buffer), App State Inspector, Network Trace, storage inspectors (localStorage, service worker cache), diagnostic snapshot export, and live control panel. Additionally, Pulse optimization tuning panel with real-time sliders for feed rotation speed, RBI scoring thresholds, and cooldown timers — test carousel behavior instantly without rebuilding.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML + CSS + ES6 modules — `index.html` + `styles.css` + ~38 modules under `src/` bundled into `dist/app.bundle.js` via esbuild |
| Sidecar JS | `assets/vendor/focusCard.js`, `assets/vendor/pulse-card-templates.js`, `assets/vendor/collectionCard.js` (IIFE modules, all `defer` in `<head>` — exposed via `window.*`) |
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
dist/app.bundle.js        — bundled IIFE build (~520KB), built by Vercel on prod deploy (not committed)
assets/vendor/focusCard.js              — At-Bat Focus Mode visual templates
assets/vendor/pulse-card-templates.js   — HR/RBI player card variants (4 templates)
assets/vendor/collectionCard.js         — Card Collection binder visuals
assets/daily-events.json                — Demo Mode static snapshot (2.2MB)
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

## Known constraints

<details>
<summary>Things that aren't broken but are worth knowing</summary>

- **MLB Stats API is unofficial.** Stable for years, but no SLA. Some endpoints (`/game/{pk}/feed/color`) are documented in the spec but return 404 in practice.
- **Audacy radio rights gap.** ~14 MLB market flagships hosted by Audacy stream alternate content during games. Excluded from auto-pairing via an `APPROVED_RADIO_TEAM_IDS` allowlist.
- **GitHub Actions cron is approximate.** Configured for `*/5` but in practice runs closer to once per hour on the free tier — switching to Vercel Cron is on the backlog.
- **Theming relies on contrast heuristics.** Teams with very dark secondary colours (Giants, Orioles) get a luminance floor applied to keep accents readable.
- **Classic Radio is a POC.** The archive.org broadcast pool is hardcoded (4 recordings). Easy to expand to a `teamId → URL[]` map — just hasn't been needed yet.

</details>

---

## Credits

- **[MLB Stats API](https://statsapi.mlb.com/)** — every live data point in the app
- **[ESPN](https://www.espn.com/)** — news headlines (unofficial endpoint)
- **[MLB.com RSS](https://www.mlb.com/)** — team and league-wide news feeds
- **[MLB Trade Rumors](https://www.mlbtraderumors.com/)** — trade and roster news
- **[FanGraphs](https://www.fangraphs.com/)** — advanced baseball analysis
- **[CBS Sports](https://www.cbssports.com/)** — sports news and coverage
- **[YouTube](https://www.youtube.com/)** — team channel feeds and highlight videos
- **[Hls.js](https://github.com/video-dev/hls.js)** — HLS streaming for radio
- **[Internet Archive](https://archive.org/)** — classic MLB broadcast recordings used in Demo Mode
- **[Upstash](https://upstash.com/)** — Redis for push subscriptions and card sync
- **[Vercel](https://vercel.com/)** — serverless hosting for the API layer
- **Built primarily in collaboration with [Claude](https://claude.com/)** — see [CLAUDE.md](./CLAUDE.md) for the full handoff doc that drives the development loop

This project is not affiliated with, endorsed by, or sponsored by Major League Baseball or any MLB club. Team names, logos, and colours are property of their respective owners.
