# MLB Tracker — Demo Mode

Self-contained replay of a full MLB day (April 27-28, 2026) from static `daily-events.json` snapshot. No API calls required — works offline once loaded. Added v2.27.

## How It Works

**Data Source:** `daily-events.json` (562KB)
- 23 total games (8 with full play-by-play data)
- 619 plays spanning April 27 10:09 PM through April 28 5:34 AM
- Pre-computed caches: dailyLeadersCache, onThisDayCache, yesterdayCache, hrBatterStatsCache, probablePitcherStatsCache, dailyHitsTracker, dailyPitcherKs, storyCarouselRawGameData, stolenBaseEvents, scheduleData
- Format: `{gameStates, feedItems, ...caches}` — direct snapshot from live Pulse export

**Starting Demo:**
- Click **"▶ Try Demo"** button in Pulse empty state (top-right hype block) or Dev Tools panel (`Shift+M`)
- `toggleDemoMode()` calls `initDemo()` and updates the Dev Tools button label
- `initDemo()` loads `daily-events.json` via `fetch()`
- Resets all games to `Preview` status for chronological replay
- Sets `demoCurrentTime` to first play's timestamp (22:09:51 UTC = 6:09 PM ET, CLE vs TB game start)
- Populates `demoPlayQueue` from `feedItems`, sorted oldest-first
- Alert shows game count and play count
- **Playback begins immediately** — `demoCurrentTime` is an internal counter, never compared to `Date.now()`

## Playback Mechanics

**Speed Controls** (in mock bar when demo is active):
- **1x** — 10 seconds per play (real-time simulation)
- **10x** — 1 second per play
- **100x** — 100ms per play (rapid skip-through)

Changing speed takes effect immediately — `setDemoSpeed` cancels the pending `setTimeout` and sets a new one at the new interval (v2.55.4 fix).

**Pause/Resume:** ⏸ Pause button stops playback; ▶ Resume continues from current play

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

## Carousel Temporal Filtering

Story generators filter by timestamp — only stories where `item.ts.getTime() <= demoCurrentTime` are shown:

```javascript
// In genHRStories, genBigInning, etc.
if(demoMode && item.ts.getTime() > demoCurrentTime) return;  // skip future items
```

**Known Limitation:** Carousel may show some contextual stories early (probable pitchers for all 23 games, daily leaders) while real-time stories (HR, big inning, walk-off) wait for plays to be reached. [Backlog: improve carousel pooling algorithm]

## Key Functions

| Function | Purpose |
|---|---|
| `toggleDemoMode()` | Entry point — calls `initDemo()` or `exitDemo()`, then `updateDemoBtnLabel()` |
| `updateDemoBtnLabel()` | Updates Dev Tools button label between "▶ Try Demo" and "⏹ Exit Demo" |
| `loadDailyEventsJSON()` | Async fetch + parse `./daily-events.json`, convert timestamp strings to Date objects |
| `initDemo()` | Reset state, load JSON, build demoPlayQueue, render UI, start playback |
| `pollDemoFeeds()` | Main playback loop — advance one play per `demoSpeedMs` interval |
| `advanceDemoPlay(play)` | Apply play to gameState, fire alerts/sounds, update feed, rebuild carousel |
| `setDemoSpeed(ms, btn)` | Update `demoSpeedMs`, highlight speed button, cancel pending timer and restart at new speed immediately |
| `toggleDemoPause()` | Pause/resume playback, update button text |
| `renderDemoEndScreen()` | Show "Demo Complete" overlay, auto-dismiss after 4s |
| `exitDemo()` | Clear demo state, reset UI, return to live mode |

## Demo Globals

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
let devShowPushOnDesktop = false  // retained but uncalled (v2.57.11) — push row hidden via CSS media query
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

## Files Involved

| File | Role |
|---|---|
| `daily-events.json` | Static snapshot (8 games, 619 plays, all caches) — served via GitHub Pages; required for Demo Mode in production |
| `app.js` | All demo code: loadDailyEventsJSON, initDemo, pollDemoFeeds, advanceDemoPlay, UI controls |
| `sw.js` | Cache versioning for PWA update |
