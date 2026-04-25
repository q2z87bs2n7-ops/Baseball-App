# League Pulse — Handover Document

**Branch:** `claude/league-pulse`
**File:** `league-pulse.html` (standalone prototype)
**Current version:** v0.7-dev
**Repo:** `q2z87bs2n7-ops/Baseball-App`

---

## What We're Building

League Pulse is a global live MLB feed — a single view that aggregates play-by-play from every simultaneous game. The concept is: instead of watching one team, you see every scoring play, home run, and RISP moment across the whole league as they happen, in one chronological stream.

The business request came from a feedback document reviewed during this session. Key requirements:

- Scrolling ticker bar showing all live games sorted by game progress
- Per-game feed toggle: click a ticker chip to show/hide that game's plays
- Play-by-play feed with inline RISP badges and score badges highlighting the scoring team
- On-screen toast alerts for HR and scoring plays
- Sound alerts (HR, Run, RISP, Game Start, Game End) with a settings panel
- Empty state showing upcoming games styled like the index.html home screen
- Mock data mode for testing without live games

---

## Architecture — Why a Separate File

League Pulse is developed in `league-pulse.html`, not `index.html`. This is intentional:

- `index.html` is the production app (v1.59). Any conflict or regression there affects live users.
- League Pulse is a new module that will eventually be integrated into `index.html` as a new section — but only after it is stable and reviewed.
- The dev branch `claude/league-pulse` was branched from `main` (which has the latest prod `index.html`) but all active work is only in `league-pulse.html`. `index.html` is never touched on this branch.
- When integration happens, the CSS variables, theme utilities, and team data from `league-pulse.html` will collapse into the existing `index.html` infrastructure (they already share the same system — this was deliberate).

---

## Branch & File Setup

```
branch:  claude/league-pulse
file:    league-pulse.html   (~2040 lines, single-file HTML + CSS + JS)
do not:  touch index.html, sw.js, manifest.json, or any production files
deploy:  open league-pulse.html directly in a browser (no build step)
         YouTube embeds need a served URL — not needed here
         MLB API calls work from any origin (no CORS restriction observed)
```

---

## CSS / Theme System

League Pulse uses the same CSS variable system as `index.html`. The same nine variables are set dynamically:

| Variable | Role |
|---|---|
| `--primary` | Header border, active states |
| `--secondary` | Raw team accent |
| `--accent` | Contrast-safe accent for text/borders on dark surfaces |
| `--accent-text` | Text on `--secondary` surfaces |
| `--header-text` | Text on primary-coloured surfaces |
| `--dark` | Page background |
| `--card` | Card background |
| `--card2` | Secondary card / inputs |
| `--border` | Borders |

`applyLeaguePulseTheme(primaryHex, secondaryHex)` is a direct port of `applyTeamTheme` from `index.html`. The full set of colour utilities (`relLuminance`, `contrastRatio`, `hslHex`, `hslLighten`, `pickAccent`, `pickHeaderText`) are also ported verbatim.

Default theme on load: **Mets** (`#002D72` primary, `#FF5910` secondary). This is hardcoded in `initMock()` and `initReal()`. When integrating into `index.html`, this would follow the active team selection.

---

## Features Built (v0.7-dev)

### Ticker Bar
All games shown as scrollable horizontal chips. Sorted: Live (most-progressed inning first) → Preview (by time) → Final (dimmed). Each chip shows away score · home score · inning or time.

- Live chips: pulsing red dot + inning indicator (`▲3`, `▼7`)
- Preview chips: show scheduled local time (`7:05 PM`)
- Final chips: `FINAL` label, 55% opacity

**Per-game feed toggle (Item 2):** Clicking a chip toggles that game's plays in the feed. Enabled chips get a 2px `--accent` bottom bar (inset box-shadow). Disabled chips dim to 32% + mild grayscale. State lives in `enabledGames` (a `Set` of gamePks). Feed items get `feed-hidden` class (display:none) — history is preserved so re-enabling restores all past plays. `updateFeedEmpty()` is called after every toggle so the empty state updates correctly.

### Play-by-Play Feed
Newest plays at top. Each item shows:
- Coloured team dot + score line (meta row)
- Inning + outs
- Play description
- `⚡ RISP` inline badge (amber) on non-scoring plays with runners on 2nd/3rd
- Score badge on scoring plays — scoring team side full brightness, other side dimmed

Play classification drives visual treatment:
- `homerun` — amber tint background
- `scoring` — red tint background
- `risp` — yellow left accent stripe (3px border-left)
- `status-change` — blue tint, centred (game start / game end / delay)

### Toast Alerts
Fixed stack below header. HR alerts persist 6s, run alerts 4s. Progress bar drains in real time. Click to dismiss early. Multiple alerts stack vertically.

### Sound Settings Panel (Items 6 + 7)
`🔊` button in header opens a fixed overlay panel (270px, top-right). Contains:

- **Master toggle** — disables all sounds; dims and blocks per-event rows when off
- **Per-event toggles:** 💥 Home Run, 🔴 Run Scores, ⚡ RISP, ⚾ Game Start, 🏁 Game End
- RISP starts **off** by default (most frequent event, would be noisy)
- Closes on click outside

Sound stubs use Web Audio API (`OscillatorNode`) — each event has a distinct tone shape:

| Event | Tone |
|---|---|
| HR | Ascending major arpeggio C5→E5→G5→C6 |
| Run | Two rising notes G4→B4 |
| RISP | Soft triangle ping A5 (quiet) |
| Game Start | Bright two-note rise C5→G5 |
| Game End | Three-note descend G5→E5→C5 |

These are **stubs** — functional but not final. Real audio files or a sound theme system are in the backlog. `playSound(type)` is the single call point; it checks `soundSettings.master && soundSettings[type]` before playing. Wrapped in try/catch — silent if Web Audio unavailable.

### Mock / Live Mode Toggle (Item 14)
Two-button pill in the header: `⚡ Mock` and `● Live`. `switchMode(toReal)` tears down all state, resets the feed and alerts, flips `mockMode`, and calls `initMock()` or `initReal()`. The mock controls bar (speed, skip, reset) is shown only in mock mode.

### Empty State — Upcoming Games (Item 12)
When the feed has no visible plays, `renderEmptyState()` checks `gameStates` for Preview/Scheduled games and renders:

- Hype tagline: *"Every scoring play, home run, and RISP moment — surfaces here the moment a game goes live."*
- **Hero card** — 3-stop gradient (away primary → `#111827` → home primary), team caps, abbreviated names, game time, venue name
- **2-col grid** — compact cards for remaining upcoming games

Falls back to plain `⚾ League Pulse` placeholder when no upcoming games exist (off-season). `renderEmptyState()` is called by `updateFeedEmpty()`, which is called from `addFeedItem`, `toggleGame`, `renderFeed`, `resetMock`, and the tail of `poll()`.

---

## APIs

### Schedule (all games)
```
GET https://statsapi.mlb.com/api/v1/schedule
  ?sportId=1
  &date=YYYY-MM-DD          (local date string — never toISOString(), it returns UTC)
  &hydrate=linescore,team
```
Returns `dates[].games[]`. Key fields per game:
- `gamePk` — unique game ID
- `status.abstractGameState` — `"Live"` | `"Preview"` | `"Scheduled"` | `"Final"`
- `status.detailedState` — more granular (e.g. `"In Progress"`, `"Rain Delay"`)
- `gameDate` — ISO UTC string; convert to local time with `new Date(g.gameDate).toLocaleTimeString()`
- `teams.away.team.id`, `.abbreviation`, `.name`
- `teams.home.team.id`, `.abbreviation`, `.name`
- `teams.away.score`, `teams.home.score`
- `venue.name`
- `linescore.currentInning`, `.inningHalf`, `.outs`

### Play-by-Play (per live game)
```
GET https://statsapi.mlb.com/api/v1/game/{gamePk}/playByPlay
```
Returns `allPlays[]`. Each completed play (`about.isComplete === true`) has:
- `result.event` — `"Home Run"`, `"Strikeout"`, `"Single"`, etc.
- `result.description` — human-readable play description
- `result.awayScore`, `result.homeScore`
- `about.isScoringPlay` — boolean
- `about.inning`, `about.halfInning` — `"top"` | `"bottom"`
- `count.outs`
- `runners[]` — each runner has `movement.start` (`"1B"` | `"2B"` | `"3B"` | `null`)

**RISP detection:** `runners.some(r => r.movement.start === '2B' || r.movement.start === '3B')`

New-play detection: store `g.playCount` (last seen index). On each poll, `plays.slice(g.playCount)` gives only new plays. Update `g.playCount = plays.length` after processing.

### Timestamps stale check (v1.1 path)
```
GET https://statsapi.mlb.com/api/v1.1/game/{gamePk}/feed/live/timestamps
```
Returns an array of timestamp strings. Last element = most recent state change. Compare against stored `g.lastTimestamp` — if unchanged, skip the playByPlay fetch entirely. Saves a round-trip during pitching changes, between innings, or any quiet period.

**Important:** the `feed/live` family requires `v1.1` not `v1` — the v1 path returns 404. `MLB_BASE_V1_1` is defined separately in the code for this reason.

### Polling cadence
- `poll()` fires every **15 seconds** via `setInterval(poll, 15000)`
- Each tick: 1 schedule fetch + (per live game) 1 timestamps check + (if changed) 1 playByPlay fetch
- Worst-case latency from a real play to appearing in the feed: ~15 seconds

---

## Mock Data

Mock mode exists because the MLB season has gaps (off-days, off-season) and testing needs live-game behaviour without waiting for real games.

### Structure
`MOCK_DATA` in `league-pulse.html` contains two keys:

**`games`** — array of game descriptors:
```js
{ gamePk, awayId, homeId, status, gameTime?, venueName? }
// status: 'Live' | 'Preview' | 'Final'
// awayId/homeId: MLB team IDs matching the TC object
```

**`plays`** — object keyed by gamePk, each value an array of play objects:
```js
{ event, desc, scoring, aScore, hScore, inn, half, outs, risp }
// event: string matching MLB event names ('Home Run', 'Strikeout', etc.)
// half: 'top' | 'bottom'
// Special sentinel: event === '__GAME_START__' transitions a Preview game to Live
```

### Current mock games (4 games, ~55 plays total)
| gamePk | Matchup | Starting status |
|---|---|---|
| 1001 | NYM @ ATL | Live |
| 1002 | NYY @ BOS | Live |
| 1003 | LAD @ SF | Live |
| 1004 | HOU @ TEX | Preview (starts with `__GAME_START__` sentinel) |

### Round-robin engine
`mockTick()` runs on an interval (`mockSpeedMs`, default 6000ms). It rotates through `mockGameQueue` (array of gamePks), finding the next game with remaining plays and calling `advanceMockGame(pk, play)`. This ensures plays interleave across games rather than completing one game fully before moving to the next.

Controls in the mock bar: Normal (6s) / Fast (1.5s) / Skip (fire one play immediately) / Reset (full reinit).

### Adding more mock plays
To extend the mock data, add objects to `MOCK_DATA.plays[gamePk]`. To add a new game, add a descriptor to `MOCK_DATA.games` and a plays array at the same gamePk key. Use team IDs from the `TC` object. Use `__GAME_START__` as the first play for any Preview-status game.

---

## Key Functions Reference

| Function | Purpose |
|---|---|
| `applyLeaguePulseTheme(primary, secondary)` | Sets all 9 CSS vars on `:root`. Ported from index.html's `applyTeamTheme`. |
| `init()` | Entry point. Sets toggle button state, wires close-outside listener, calls `initMock` or `initReal`. |
| `switchMode(toReal)` | Tears down all state, resets DOM, calls `initMock` or `initReal`. |
| `initMock()` | Applies theme, shows mock bar, populates `gameStates` from `MOCK_DATA`, sets `enabledGames`, calls `startMockTick`. |
| `initReal()` | Hides mock bar, applies theme, calls `poll()` then sets 15s interval. |
| `poll()` | Fetches schedule, updates `gameStates`, fires `pollGamePlays` for each live game, then calls `renderTicker` + `updateHeader` + `updateFeedEmpty`. |
| `pollGamePlays(gamePk)` | Timestamps stale check → if changed, fetches `/playByPlay`, slices new plays, calls `addFeedItem` for each. |
| `renderTicker()` | Sorts `gameStates` and rebuilds ticker HTML. Live sorted by inning progress descending. |
| `toggleGame(gamePk)` | Adds/removes gamePk from `enabledGames`, bulk-applies `feed-hidden` to DOM items, calls `updateFeedEmpty` + `renderTicker`. |
| `addFeedItem(gamePk, data)` | Prepends item to `feedItems` and DOM. Applies `feed-hidden` immediately if game is disabled. |
| `updateFeedEmpty()` | Checks for any `.feed-item:not(.feed-hidden)`. If none, calls `renderEmptyState()`. Shows/hides `#feedEmpty`. |
| `renderEmptyState()` | Renders upcoming-games hero card + grid, or plain placeholder if no upcoming games. |
| `showAlert(opts)` | Creates and stacks a toast. Auto-dismisses after `opts.duration` ms. |
| `playSound(type)` | Checks `soundSettings.master && soundSettings[type]`, then calls the appropriate stub. |
| `mockTick()` | Advances one play in round-robin order. Handles exhaustion → marks remaining Live games as Final. |
| `advanceMockGame(pk, play)` | Applies one play to `gameStates`, calls `addFeedItem`, fires alerts and sounds. |
| `resetMock()` | Clears all state and re-calls `initMock()`. |
| `toggleSoundPanel()` | Shows/hides `#soundPanel`. |
| `setSoundPref(key, val)` | Updates `soundSettings[key]`. Master toggle also applies `.master-off` CSS class. |

---

## Global State

```js
let mockMode        = true;          // false = real API mode
let gameStates      = {};            // gamePk → { awayAbbr, homeAbbr, awayPrimary, homePrimary,
                                     //   awayScore, homeScore, status, inning, halfInning,
                                     //   outs, playCount, lastTimestamp, gameTime, venueName }
let feedItems       = [];            // all feed items newest-first (never pruned — full history)
let enabledGames    = new Set();     // gamePks whose plays are visible in the feed
let mockPlayPtrs    = {};            // gamePk → index of next play to emit
let mockGameQueue   = [];            // rotating round-robin order
let mockTimerId     = null;
let mockSpeedMs     = 6000;
let totalMockPlays  = 0;
let playedMockPlays = 0;
let alertId         = 0;
var soundSettings   = { master, hr, run, risp, gameStart, gameEnd };
```

---

## Backlog

Items are roughly prioritised. Items marked `[proto]` need design review before implementation.

### Sound
- [ ] **Real audio files** — replace Web Audio stubs with actual `.mp3`/`.ogg` files. The stub architecture (`playSound(type)` → individual functions) is designed for easy swap-out.
- [ ] **Sound theme packs** — e.g. Classic (organ stabs), Subtle (UI tones), Stadium (crowd/PA). Panel already has the structure to add a theme selector row.

### Feed & Data
- [ ] **Feed item cap logos** — add small team cap image to each feed item's meta row alongside the coloured dot, matching the ticker chip style.
- [ ] **Historical play load** — when switching to a completed game in the ticker, load its full play log so the feed shows the whole game, not just plays seen since page load.
- [ ] **Score differential in ticker** — show which team leads and by how much, e.g. a subtle `+2` badge on the leading team's score.
- [ ] **Game filter persistence** — save `enabledGames` to `localStorage` so the user's game selections survive a page reload.

### Empty State
- [ ] **Countdown timer** — on the hero upcoming game card, show a live "First pitch in Xm" countdown (as seen in the third screenshot reference). Requires a `setInterval` updating the time display.
- [ ] **Probable pitchers** — add `probablePitcher` to the schedule hydrate (`hydrate=linescore,team,probablePitcher`) and display pitcher names on the hero card and grid cards. Field path: `g.teams.away.probablePitcher.fullName`.

### Player Tracking `[proto]`
- [ ] **Follow a player** — tap a player name in any feed item to "pin" them. Pinned player plays get a distinct highlight across all games. State: `trackedPlayers = Set<playerName>`.
- [ ] **Player appearance count** — small badge on pinned player showing how many times they've appeared in today's feed.

### Integration with index.html
- [ ] **Design review** — side-by-side comparison of League Pulse and index.html to align card styling, typography, spacing, and icon usage before merge.
- [ ] **30-team colour testing** — verify ticker chip legibility, feed item contrast, and empty state gradients across all 30 team primaries. Teams with very dark or very light primaries (Giants `#FD5A1E`, White Sox `#27251F`) need manual checks.
- [ ] **Merge into index.html** — add League Pulse as a new nav section (`league-pulse` or `pulse`). The CSS variable system and TC/theme utilities already match; the main work is collapsing `league-pulse.html`'s JS into `index.html`'s function namespace and wiring up the nav button.
- [ ] **Remove mock mode from production build** — `mockMode`, `MOCK_DATA`, mock controls bar, and mock engine functions should be stripped (or guarded behind a dev flag) before shipping in `index.html`.

### Header / Controls UX
- [ ] **Move sound button and mode toggle out of header** — both controls currently live in `.header-right`. Move them into a `#pulseControls` bar between the ticker and feed so the header shows only brand + live count. Mock controls bar should also move from `position:fixed` bottom to inline. Needs a design pass before implementing — the first attempt was reverted as the result wasn't satisfactory.
- [ ] **Demo mode** — replace mock mode with a polished "Demo" mode users can trigger to understand the feed when no games are live. Requires significantly more mock play data before building. Do not design until mock dataset is expanded.
- [ ] **Mobile sound** — Web Audio API tones are unreliable on iOS/iPadOS (autoplay policy). Revisit with real audio files or a user-gesture-gated unlock pattern.
- [ ] **Countdown to first pitch for delayed games** — the countdown timer on the empty state uses the advertised start time; it has no way to reflect rain delays or pushbacks. Needs a strategy (e.g. poll `detailedState` and hide/update countdown when delay is detected).

### Infrastructure
- [ ] **Push notification integration** — wire League Pulse game-start events to the existing push notification system (`api/notify.js` + Upstash Redis). Currently push fires for the active team only; League Pulse could offer league-wide alerts.
- [ ] **Off-season / no-games state** — the plain `⚾ League Pulse` placeholder is fine but could show a "Next game" date or season start countdown when there are genuinely no games scheduled.

---

## Commit History Summary

| Commit | What |
|---|---|
| `819d244` | Bug fix: empty state shows on first Live load; hype tagline added above cards |
| `5cd352a` | Perf: 15s polling + timestamps stale check to skip unchanged games |
| `4f72e49` | Sound stubs (5 Web Audio tones) + settings panel with per-event toggles |
| `f3a82e4` | Mock/Live mode toggle pill in header |
| `3724464` | Upcoming-games empty state (hero card + 2-col grid) |
| `97e7d68` | Clickable ticker chips toggle per-game feed filter |
| `82226b6` | Ticker sort, scroll-on-click, preview game time |
| `faf6309` | index.html CSS/theme system ported to League Pulse |
| `66023d3` | RISP inline badge, score badge with scorer highlighting |
| `603d529` | Mock engine, controls bar, real polling skeleton |
| `e6a5683` | Initial HTML shell + CSS |
