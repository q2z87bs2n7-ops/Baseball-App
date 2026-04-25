# League Pulse — Handover Document

**Status:** Merged into `index.html` as the ⚡ Pulse nav section (v2.1)
**Branch:** `claude/league-pulse-review-UWWTe`
**Prototype file:** `league-pulse.html` (archived — do not edit; source of truth is now `index.html`)
**Repo:** `q2z87bs2n7-ops/Baseball-App`

---

## What It Is

League Pulse is a global live MLB feed — a single view that aggregates play-by-play from every simultaneous game. Instead of watching one team, the user sees every scoring play, home run, and RISP moment across the whole league as they happen, in one chronological stream.

Features shipped:
- Scrolling sticky ticker bar showing all live games sorted by game progress
- Per-game feed toggle: click a ticker chip to show/hide that game's plays
- Play-by-play feed with inline RISP badges and score badges highlighting the scoring team
- On-screen toast alerts for HR and scoring plays
- Web Audio sound alerts (HR, Run, RISP, DP, TP, Game Start, Game End, Error)
- Empty state showing upcoming games styled like the home screen (hero card + countdown + grid)
- Mock data mode for testing without live games
- Mock mode toggle and Sound Alerts trigger both live in the ⚙️ Settings panel

---

## Migration Notes (prototype → index.html)

League Pulse was developed as a standalone prototype (`league-pulse.html`, ~2370 lines) then migrated into `index.html` as a lazy-loaded nav section in v2.1. Key decisions made during migration:

**Namespace renames (to avoid collisions with index.html globals):**
| Prototype | Merged | Reason |
|---|---|---|
| `mockMode` | `pulseMockMode` | too generic at module scope |
| `init()` | `initLeaguePulse()` | bare `init` is a dangerous global |
| `poll()` | `pollLeaguePulse()` | generic name |

**Dropped from prototype (already in index.html):**
- `relLuminance`, `contrastRatio`, `hslHex`, `hslLighten`, `pickAccent`, `pickHeaderText` — colour utilities exist in index.html; LP copies removed
- `applyLeaguePulseTheme()` — dropped entirely; `applyTeamTheme()` already sets all 9 CSS vars globally
- `const TC = {...}` team colour lookup object — replaced by `tcLookup(id)`, a thin wrapper around the existing `TEAMS` array (`t.short` maps to `abbr`)
- `const MLB_BASE` re-declaration — index.html's copy used
- `var soundSettings` declaration — moved to the LP globals block alongside other state

**Structural changes:**
- Standalone header (brand, live count, mode toggle pill) dropped entirely — not needed inside a nav section
- `#pulseControls` info bar (live count, last-updated, sound button) was built, then removed after review — deemed unnecessary chrome
- Mock bar changed from `position:fixed; bottom:0` (conflicted with mobile nav) to inline placement inside `#pulse` between ticker and feed
- Mock mode toggle moved to ⚙️ Settings panel as a slide toggle (persisted to `localStorage` key `mlb_pulse_mock`)
- Sound alerts trigger (`🔊 Configure` button, `id="btnSound"`) moved to ⚙️ Settings panel; click-outside-to-dismiss handler still works because the `id` is preserved
- `updateHeader()` function became a no-op stub after the controls bar was removed; its 3 call sites in the poll/mock loops are left in place

**Lazy initialisation:**
`initLeaguePulse()` fires only on first navigation to the Pulse section via a guard in `showSection()`:
```js
if (id === 'pulse' && !pulseInitialized) {
  pulseInitialized = true;
  initLeaguePulse();
  // sound panel click-outside handler registered here too
}
```

---

## Architecture in index.html

### HTML structure (`#pulse` section)
```
#pulse.section
  #soundPanel           — position:fixed overlay, hidden by default
  #alertStack           — position:fixed toast stack
  #gameTicker           — position:sticky below header
  #mockBar              — inline (shown only in mock mode)
  #feedWrap
    #feedEmpty          — empty/upcoming state
    #feed               — live play items
```

### Settings panel additions
- **⚡ Pulse: Mock Mode** — slide toggle, calls `togglePulseMockMode()`, persisted to `localStorage('mlb_pulse_mock')`
- **⚡ Pulse: Sound Alerts** — `🔊 Configure` button (`id="btnSound"`), calls `toggleSoundPanel()`

### CSS additions to index.html
New vars added to `:root`:
```css
--header-h: 60px        /* sticky ticker offset */
--ticker-h: 50px
--mockbar-h: 48px
--radius: 10px
--scoring-bg / --scoring-border
--hr-bg / --hr-border
--risp-accent
--status-bg / --status-border
```
`#feedWrap` padding-bottom: `24px` desktop; `calc(72px + env(safe-area-inset-bottom) + 24px)` mobile (clears fixed nav).

---

## Global State (as merged)

```js
const MLB_BASE_V1_1 = 'https://statsapi.mlb.com/api/v1.1'
let pulseMockMode    = false        // persisted to localStorage('mlb_pulse_mock')
let pulseInitialized = false        // lazy-init guard — set true on first Pulse nav
let gameStates       = {}           // gamePk → { awayAbbr, homeAbbr, awayPrimary, homePrimary,
                                    //   awayScore, homeScore, status, detailedState,
                                    //   inning, halfInning, outs, playCount, lastTimestamp,
                                    //   gameTime, gameDateMs, venueName, onFirst, onSecond, onThird }
let feedItems        = []           // all feed items newest-first (never pruned)
let enabledGames     = new Set()    // gamePks whose plays are visible in the feed
let mockPlayPtrs     = {}           // gamePk → index of next play to emit
let mockGameQueue    = []           // rotating round-robin order
let mockTimerId      = null
let mockSpeedMs      = 6000
let totalMockPlays   = 0
let playedMockPlays  = 0
let countdownTimer   = null         // setInterval handle for hero card countdown
let alertId          = 0
let isFirstPoll      = true         // true until first pollLeaguePulse() completes
let pollDateStr      = null
let soundSettings    = { master:false, hr:true, run:true, risp:true,
                         dp:true, tp:true, gameStart:true, gameEnd:true, error:true }
```

`tcLookup(id)` replaces the prototype's `TC` object:
```js
function tcLookup(id) {
  var t = TEAMS.find(function(t){ return t.id === id; });
  return t ? { primary:t.primary, abbr:t.short, name:t.name } : { primary:'#444', abbr:'???', name:'Unknown' };
}
```

---

## Key Functions Reference (merged names)

| Function | Purpose |
|---|---|
| `initLeaguePulse()` | Entry point — calls `initMock` or `initReal` based on `pulseMockMode` |
| `switchMode(toReal)` | Tears down all state, resets DOM, calls `updatePulseMockToggleUI()`, then `initMock` or `initReal` |
| `togglePulseMockMode()` | Flips `pulseMockMode`, writes to localStorage, updates Settings toggle UI, calls `switchMode` if already initialised |
| `updatePulseMockToggleUI()` | Updates the Settings panel toggle knob position and background colour |
| `initMock()` | Shows mock bar, populates `gameStates` from `MOCK_DATA` via `tcLookup`, sets `enabledGames`, calls `startMockTick` |
| `initReal()` | Hides mock bar, calls `pollLeaguePulse()` then sets 15s interval |
| `pollLeaguePulse()` | Fetches schedule, updates `gameStates` (incl. `detailedState`, base runners), fires game-start/delay events, runs `Promise.all(pollGamePlays)` for live games, sorts feed on `isFirstPoll`, calls `renderTicker` + `updateHeader` + `updateFeedEmpty` |
| `pollGamePlays(gamePk)` | Timestamps stale check → if changed, fetches `/playByPlay`, uses `isHistory` flag to suppress alerts/sounds for pre-existing plays |
| `renderTicker()` | Sorts `gameStates` (Live by inning desc, Preview by `gameDateMs` asc, Final last) and rebuilds ticker HTML |
| `updateHeader()` | No-op stub — call sites retained but function body is empty |
| `baseDiamondSvg(on1,on2,on3)` | 28×24px inline SVG diamond; occupied bases lit amber with glow |
| `startCountdown(targetMs)` | 30s interval updating `#heroCountdown` with "First pitch in Xm" |
| `toggleGame(gamePk)` | Adds/removes gamePk from `enabledGames`, applies `feed-hidden` class, calls `updateFeedEmpty` + `renderTicker` |
| `addFeedItem(gamePk, data)` | Prepends item to `feedItems` and DOM; applies `feed-hidden` if game disabled |
| `buildFeedEl(item)` | Builds DOM element; handles status-change items and play items (with play-type badge, RISP badge, score badge) |
| `updateFeedEmpty()` | Checks for visible feed items; calls `renderEmptyState()` and shows/hides `#feedEmpty` |
| `renderEmptyState()` | Renders hype block + hero upcoming card (with countdown) + 2-col grid, or plain placeholder |
| `showAlert(opts)` | Creates and stacks a toast; auto-dismisses after `opts.duration` ms; click to dismiss |
| `dismissAlert(el)` | Adds `dismissing` class, removes after 300ms |
| `mockTick()` | Advances one play in round-robin order; marks remaining Live games Final when plays exhausted |
| `advanceMockGame(pk, play)` | Applies one play to `gameStates`, calls `addFeedItem`, fires alerts and sounds |
| `setMockSpeed(ms, btn)` | Updates `mockSpeedMs`, restarts tick interval |
| `resetMock()` | Clears all state and re-calls `initMock()` |
| `toggleSoundPanel()` | Shows/hides `#soundPanel` overlay |
| `setSoundPref(key, val)` | Updates `soundSettings[key]`; master toggle also applies `.master-off` CSS class to `#soundRows` |
| `playSound(type)` | Checks `soundSettings.master && soundSettings[type]`, calls appropriate `playXxxSound()` |
| `_makeCtx()` / `_closeCtx()` / `_osc()` / `_ns()` | Web Audio primitives shared by all sound functions |

---

## APIs Used

### Schedule (all games)
```
GET /api/v1/schedule?sportId=1&date=YYYY-MM-DD&hydrate=linescore,team
```
Key fields: `gamePk`, `status.abstractGameState`, `status.detailedState`, `gameDate`, `teams.away/home.team.id/abbreviation/name/score`, `venue.name`, `linescore.currentInning/inningHalf/outs`, `linescore.offense.first/second/third` (truthy objects — NOT `.onFirst` etc.)

### Play-by-Play (per live game)
```
GET /api/v1/game/{gamePk}/playByPlay
```
`allPlays[]` filtered by `about.isComplete`. New-play detection via stored `g.playCount`. RISP: `runners.some(r => !r.movement.isOut && (r.movement.end === '2B' || '3B'))`.

### Timestamps stale check
```
GET /api/v1.1/game/{gamePk}/feed/live/timestamps
```
Returns array of strings; last element = latest state change. Compare to `g.lastTimestamp` — skip playByPlay fetch if unchanged. **Requires v1.1 path — v1 returns 404.** `MLB_BASE_V1_1` const used for this.

### Polling cadence
`pollLeaguePulse()` every 15s. Each tick: 1 schedule fetch + per-live-game timestamps check + (if changed) 1 playByPlay fetch.

---

## Mock Data

`MOCK_DATA` (defined in `index.html` globals block) has two keys:

**`games`** — array of `{ gamePk, awayId, homeId, status, gameTime?, venueName? }`. `awayId`/`homeId` are MLB team IDs resolved via `tcLookup()`.

**`plays`** — object keyed by gamePk, each value an array of `{ event, desc, scoring, aScore, hScore, inn, half, outs, risp }`. Special sentinel `event === '__GAME_START__'` transitions a Preview game to Live.

Current mock games (4 games): NYM@ATL (Live), NYY@BOS (Live), LAD@SF (Live), HOU@TEX (Preview with `__GAME_START__` sentinel).

Round-robin engine: `mockTick()` rotates `mockGameQueue`, advancing one play per tick. Controls: Normal (6s) / Fast (1.5s) / Skip / Reset.

---

## Sound System

Web Audio API synthesized tones — no external files. Each event has a distinct tone shape:

| Event | Tone |
|---|---|
| HR | Bat crack (highpass noise burst) + impact thud + crowd swell |
| Run | Ascending bell chime C5→E5→G5 |
| RISP | Heartbeat lub-dub (low filtered noise pulses) |
| Double Play | Two glove-pop bursts |
| Triple Play | "Charge!" fanfare G4→C5→E5→G5 (triangle) |
| Game Start | Stadium organ riff C5→D5→E5→G5 |
| Game End | Descending chime G5→E5→C5 |
| Error | Ball-hits-dirt thud |

Master defaults to **off**. All per-event toggles default **on** (user enables master to activate).

---

## Backlog

### Active
- [ ] **Real audio files** — replace Web Audio stubs with `.mp3`/`.ogg` files
- [ ] **Feed item cap logos** — small team logo in each feed item meta row
- [ ] **Probable pitchers on empty state** — add `probablePitcher` to schedule hydrate
- [ ] **Game filter persistence** — save `enabledGames` to localStorage
- [ ] **30-team colour QA** — verify ticker chip legibility and empty state gradients across all primaries
- [ ] **Mobile sound** — Web Audio unreliable on iOS; revisit with real files or gesture-gated unlock
- [ ] **Push notification integration** — wire Pulse game-start events to existing push system

### Done
- [x] Merged into `index.html` as lazy-loaded ⚡ Pulse nav section (v2.1)
- [x] Mock mode toggle moved to Settings panel (v2.1)
- [x] Sound alerts trigger moved to Settings panel (v2.1)
- [x] Mock bar inline (not fixed-position) — no mobile nav conflict (v2.1)
- [x] Warmup/Pre-Game detection — game-start fires on `detailedState === 'In Progress'` only (prototype)
- [x] Countdown timer on empty state hero card (prototype v0.9-dev)
- [x] Expanded RISP ticker chip with base diamond SVG (prototype)
- [x] Timestamps stale check — skip playByPlay fetch when unchanged (prototype)
- [x] Historical play load on first poll — no alerts/sounds for pre-existing plays (prototype)
- [x] Chronological feed sort across games on first poll (prototype)

