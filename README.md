# MLB Tracker

A real-time pitch-by-pitch tracker that auto-focuses on the most exciting MLB game in progress — no build step, no dependencies.

**[▶ Live demo](https://q2z87bs2n7-ops.github.io/Baseball-App/)** &nbsp;·&nbsp; **[Source](https://github.com/q2z87bs2n7-ops/Baseball-App)** &nbsp;·&nbsp; **[Project handoff doc](./CLAUDE.md)**

> Default team is the New York Mets. Switch to any of the 30 MLB teams in Settings — the entire UI re-themes around the team's colours.

---

## Why this exists

I wanted a personal scoreboard that did three things at once: aggregate every meaningful play across all live MLB games into one stream, auto-detect which game I should actually be watching, and read like a sports broadcast graphics package rather than a stats table. None of the apps I tried did all three, so I started building one in a single HTML file and kept going.

It's a personal project, not a product. There's no business model, no sign-up gate, no analytics. Optional account sync exists only so card collections survive across devices. Everything else works fully unsigned-in.

---

## Feature highlights

### ⚡ Pulse — league-wide live feed
The app's landing section. Every scoring play, home run, and runner-in-scoring-position moment across all simultaneous games in one chronological stream. Two-column desktop layout: ~700px left column (ticker, Story Carousel, feed) + 320px right rail (upcoming/completed games, news carousel, At-Bat Focus card).

A ⚡ MLB PULSE top bar carries icon-only buttons for Sound Alerts (🔊), Live Game Radio (📻), and a Pulse light/dark theme toggle (☀️/🌙). A **MY TEAM** lens pill filters the feed and ticker to the active team's game only — useful when you want team-specific focus inside the league-wide stream.

The feed is state-aware across the day: a pre-game hype card shows a countdown to first pitch; mid-day intermissions between games show a countdown to the next game rather than the hype state; once every game is final a post-slate screen shows "Slate complete" with a countdown to tomorrow's first pitch. Sound alerts (HR bat crack, run chime, RISP heartbeat, etc.) are synthesised live with the Web Audio API — no audio files. A sticky ticker shows every game as a chip with team scores, inning, base diamond, and out indicators.

### 📖 Story Carousel — 22 narrative generators
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

Polls linescore (~5KB) every 5s for B/S/O and runners; pitches come from the GUMBO v1.1 feed using `diffPatch` deltas (~5KB instead of ~500KB) once seeded. A compact card sits in the side rail on desktop, a slim mini-bar appears on phone/iPad portrait, and a full overlay with pitch sequence, count pips, base diamond, and matchup stats is one tap away. Manual game switcher chips with a sky-blue `↩ AUTO` pill let you override the auto-pick.

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
Auto-pairs the focused game's flagship terrestrial radio station to a `<audio>` element, with Hls.js for HLS streams and native audio for direct AAC/MP3. Currently 9 verified teams: LAA, CLE, DET, HOU, TEX, MIN, ATL, MIA, NYY. The remaining 21 stations are in the codebase but excluded from auto-pairing — most are Audacy-owned flagships that hold OTA simulcast rights but not MLB streaming rights, so their digital streams play alternate content (talk shows, ads) during games. A built-in **Radio Check** sweep tool lets me test, mark ✅/❌, take notes per station, and copy categorised markdown to update the approved list.

### 🎬 Demo Mode
Full-day replay of 23 games (8 with full play-by-play) and 619 plays from a static `daily-events.json` snapshot. No API calls — works fully offline. Speeds 1×/10×/100×, pause/resume, and a "Next HR" button to fast-forward. Story Carousel filters stories temporally so future events don't appear before the replay reaches them.

### 🔔 PWA + Push Notifications
Installable as a native app on iOS and Android. Game-start alerts via Web Push, with subscriptions stored in Upstash Redis. A GitHub Actions cron pings the `/api/notify` Vercel function every 5 minutes, which checks the MLB schedule and fires VAPID-signed push messages to subscribers, deduplicating per-game with a 24h TTL key.

### 🎨 30-team theming
Switching teams swaps nine CSS variables computed from the team's primary colour (page background, card surfaces, borders, accents, header text contrast). Pulse uses its own independent palette — dark navy by default, switchable to a light mode via the ☀️/🌙 toggle in the Pulse top bar — so the league-wide feed stays visually consistent regardless of which team is selected. Theme overrides and a colour-invert toggle live in Settings. Every team has verified ESPN IDs (for news) and YouTube channel IDs (for media).

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML/CSS/JS — `index.html` (structure) + `styles.css` (all CSS) + `app.js` (all JS, `defer`) |
| Sidecar JS | `focusCard.js`, `pulse-card-templates.js`, `collectionCard.js` (IIFE modules, all `defer` in `<head>`) |
| Streaming | [Hls.js](https://github.com/video-dev/hls.js) (light build, CDN, ~50KB) for HLS radio streams |
| Data | [MLB Stats API](https://statsapi.mlb.com/api/v1/) — public, no auth |
| News | ESPN news endpoint + MLB RSS via Vercel proxy |
| Backend | Vercel serverless functions (Node) |
| Storage | Upstash Redis (push subscriptions, sessions, card sync) |
| Auth | GitHub OAuth + email magic-link (SendGrid) |
| Hosting | GitHub Pages (static app) + Vercel (serverless API) |
| Cron | GitHub Actions scheduled workflow |

**No build system.** No bundler, no transpiler, no npm install for the app itself. Edit the right file, push to `main`, GitHub Pages serves it.

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
                         RSS proxy,
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
- Service worker caches app shell (`index.html`, `styles.css`, `app.js`, sidecar JS) for offline boot
- Theme variables persisted to localStorage and applied via inline `<script>` in `<head>` to prevent flash-of-wrong-theme on reload

---

## Running it locally

```bash
git clone https://github.com/q2z87bs2n7-ops/Baseball-App.git
cd Baseball-App
python3 -m http.server 8000   # or any static server
```

Open `http://localhost:8000`. That's the whole setup — no npm, no env vars required for the app. Push notifications and card sync require the Vercel functions and env vars listed in [CLAUDE.md](./CLAUDE.md#vercel-environment-variables), but everything else works against the public MLB Stats API.

> Note: YouTube embeds in the Media tab return `Error 153` on `file://` URLs. Use a local server, not double-click.

---

## Project structure

```
index.html                — HTML structure only (no CSS, no JS)
styles.css                — all CSS
app.js                    — all JavaScript
focusCard.js              — At-Bat Focus Mode visual templates
pulse-card-templates.js   — HR/RBI player card variants (4 templates)
collectionCard.js         — Card Collection binder visuals
daily-events.json         — Demo Mode static snapshot (562KB)
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
.github/workflows/        — notify cron + manual test push
CLAUDE.md                 — full project handoff (~200KB)
```

For the full breakdown of architecture, every API endpoint, every CSS variable, every story generator, and every quirk — see **[CLAUDE.md](./CLAUDE.md)**.

---

## Status & roadmap

**Current version:** v3.34 (May 2026).

The app is feature-complete for personal use and stable in daily operation. Active development is incremental — feature branches under `claude/*`, version bumped on every commit, service worker `CACHE` constant bumped to force PWA refresh.

Open backlog items live at the bottom of [CLAUDE.md → Feature Backlog](./CLAUDE.md#feature-backlog). Highlights:

- Career stats expansion on player cards (last 10-game average, hot streak context)
- Replacement radio URLs for Audacy-affected stations (rights gap)
- Sound system upgrade from Web Audio synthesis to CC0 MP3 samples (infrastructure already in place)
- Dynamic season year (currently `SEASON = 2026` is hardcoded)
- News fallback source (MLB RSS) when ESPN endpoint is CORS-blocked

---

## Known constraints

<details>
<summary>Things that aren't broken but are worth knowing</summary>

- **MLB Stats API is unofficial.** Stable for years, but no SLA. Some endpoints (`/game/{pk}/feed/color`) are documented in the spec but return 404 in practice.
- **Audacy radio rights gap.** ~14 MLB market flagships hosted by Audacy stream alternate content during games. Excluded from auto-pairing via an `APPROVED_RADIO_TEAM_IDS` allowlist.
- **GitHub Actions cron is approximate.** Configured for `*/5` but in practice runs closer to once per hour on the free tier — switching to Vercel Cron is on the backlog.
- **Theming relies on contrast heuristics.** Teams with very dark secondary colours (Giants, Orioles) get a luminance floor applied to keep accents readable.
- **Leaders index mapping is empirical.** The `/stats/leaders` endpoint doesn't guarantee response order matches the requested category order. Re-test if results look wrong after API changes.

</details>

---

## Credits

- **[MLB Stats API](https://statsapi.mlb.com/)** — every live data point in the app
- **[ESPN](https://www.espn.com/)** — news headlines (unofficial endpoint)
- **[Hls.js](https://github.com/video-dev/hls.js)** — HLS streaming for radio
- **[Upstash](https://upstash.com/)** — Redis for push subscriptions and card sync
- **[Vercel](https://vercel.com/)** — serverless hosting for the API layer
- **Built primarily in collaboration with [Claude](https://claude.com/)** — see [CLAUDE.md](./CLAUDE.md) for the full handoff doc that drives the development loop

This project is not affiliated with, endorsed by, or sponsored by Major League Baseball or any MLB club. Team names, logos, and colours are property of their respective owners.
