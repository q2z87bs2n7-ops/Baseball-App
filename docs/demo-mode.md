# MLB Tracker — Demo Mode

Self-contained replay of a captured MLB session from a static `daily-events.json` snapshot. No live API calls during replay (with two specific exceptions, called out below). Originally added v2.27 as a thin "play through a JSON file" feature; rebuilt end-to-end at **v3.46** as Demo Mode v2.

## Architecture overview

Demo Mode v2 is two systems that meet at one file:

1. **Recorder** (`src/dev/recorder.js`) captures live Pulse state into a recorder-v2 JSON.
2. **Replay** (`src/demo/mode.js` + scattered consumer branches) loads that JSON and animates Pulse from it.

The bridge is the schema of `daily-events.json` itself.

## `daily-events.json` schema (recorder v2)

Top-level keys produced by the recorder, consumed by `loadDailyEventsJSON` + `initDemo`:

| Key | Shape | Captured by | Consumed by |
|---|---|---|---|
| `metadata` | `{recorderVersion:2, startedAt, exportedAt, durationMs, midRun, season}` | `Recorder.start` + `_stampExportMetadata` | `initDemo` for backlog/queue cutoff |
| `gameStates` | `{gamePk → game state object}` | snapshotted at end of each `pollLeaguePulse` | `initDemo` (selectively reset, see below) |
| `feedItems` | `[{gamePk, data, ts}]` | `addFeedItem` observer + baseline deep-clone | replayed and pre-loaded |
| `scheduleData` | `[…]` | snapshotted at Stop | `state.scheduleData` |
| `pitchTimeline` | `{gamePk → [{atBatIndex, ts, batterId/Name, pitcherId/Name, balls, strikes, outs, inning, halfInning, runners, awayScore, homeScore, pitches:[{typeCode, typeName, speed, resultCode, resultDesc, sequenceIndex, eventTs}]}]}` | `pollGamePlays` (15 s broad) + `pollFocusRich` (5 s GUMBO, wins on merge) | Focus Mode replay |
| `boxscoreSnapshots` | `{gamePk → [{ts, data}]}` | `fetchBoxscore` cache miss | `fetchBoxscore` demo branch |
| `contentCacheTimeline` | `{gamePk → [{ts, items:[trimmed clip]}]}` | `pollPendingVideoClips` cache write | demo `pollPendingVideoClips` branch |
| `lastVideoClip` | trimmed clip object | snapshot at Stop | `devTestVideoClip` fallback |
| `caches.*` | `dailyLeadersCache`, `onThisDayCache`, `yesterdayCache`, `hrBatterStatsCache`, `probablePitcherStatsCache`, `storyCarouselRawGameData`, `dailyHitsTracker`, `dailyPitcherKs`, `stolenBaseEvents`, `transactionsCache`, `liveWPCache`, `perfectGameTracker`, `highLowCache` | 30 s recorder snapshot timer | hydrated to top-level `state.*` (loader keeps backwards-compat fallback to legacy top-level shape) |
| `focusStatsCache` | `{playerId → batter or pitcher stats}` | `fetchFocusPlayerStats` observer | demo `fetchFocusPlayerStats` |
| `focusTrack` | `[{ts, focusGamePk, isManual, tensionLabel}]` | `setFocusGame` calls + `pollLeaguePulse` samples | demo `selectFocusGame` |

`trimClip` (`src/dev/recorder.js`) strips clips to demo essentials (id/headline/blurb/date/type/keywordsAll + one `mp4Avc` playback URL + one 16:9 ≥480 w image cut). On a representative 73-clip baseline this knocked clips from 13.4 KB avg → 1.7 KB avg (87.6 % reduction).

## Recorder

UI lives under **Dev Tools → 📼 Recorder**. Buttons:

- **Start / Stop** — toggle. On Start: deep-clones `state.gameStates`, `state.feedItems` (capped at last 200), `state.scheduleData`, `state.liveContentCache` (folded into `contentCacheTimeline` at startedAt), `state.yesterdayContentCache`, `state.boxscoreCache`, `state.focusStatsCache`, all the `caches.*` keys; then starts a 30 s snapshot timer + a 5 s status timer.
- **Download JSON** — primary export path. Builds a Blob, triggers a download with filename `daily-events-{YYYY-MM-DD-HHMM}.json`. Works mid-recording (recording continues, `metadata.midRun:true` stamped).
- **Copy JSON** — clipboard fallback. Multi-MB clipboard writes can silently fail on Safari/iOS, so Download is preferred for long captures.
- **Reset** — gated on `!Recorder.active`; clears `Recorder.data`.

### Capture surfaces (passive observers)

All hooks are guarded one-liners — `if (window.Recorder && window.Recorder.active) window.Recorder._captureX(...)`:

| Surface | Hook site | What's captured |
|---|---|---|
| `gameStates` | end of `pollLeaguePulse` (`src/pulse/poll.js`) | deep-clone of `state.gameStates` (overwrite — replay only needs final state) |
| `feedItems` | wrap on `addFeedItem` (`src/feed/render.js`) | `{gamePk, data, ts}` append, dedup against last 20 by `gamePk+ts+type+event` |
| `pitchTimeline` (broad) | inside `pollGamePlays` per-play forEach (`src/pulse/poll.js`) | Per-AB envelope from `play.playEvents.filter(isPitch)` |
| `pitchTimeline` (focus) | end of `pollFocusRich` pitch parse (`src/focus/mode.js`) | Same key; merges by `atBatIndex+sequenceIndex` so 5 s GUMBO wins over 15 s playByPlay |
| `boxscoreSnapshots` | inside `fetchBoxscore` cache miss (`src/main.js`) | `{ts, data}` push |
| `contentCacheTimeline` | inside `pollPendingVideoClips` cache write (`src/data/clips.js`) | `{ts, items: trimClip(items)}` push |
| `focusStatsCache` | inside `fetchFocusPlayerStats` cache write (`src/focus/mode.js`) | per-player stat block |
| `focusTrack` | inside `setFocusGame` + end of `pollLeaguePulse` | `{ts, focusGamePk, isManual, tensionLabel}` (dedup contiguous identical samples) |
| Cache snapshots | new 30 s timer in `Recorder` | latest deep-clone of every key under `caches.*` |

### Caps + safety

- Per-game caps: 5000 pitch entries / 200 content-cache deltas / 10 boxscore snapshots
- Status line recomputes total bytes every 5 s as `JSON.stringify(Recorder.data).length`
- **5 MB** soft warn (status text amber, one-time `_note`)
- **10 MB** hard cap (auto-Stop + `alert()` so the user can decide whether to Download or Reset)

The recorder makes **zero** added API calls — it observes existing live polls.

## Replay (`src/demo/mode.js`)

### Starting demo

Click **▶ Try Demo** in the Pulse empty-state hype block, the Dev Tools panel, or hit `Shift+M`. `toggleDemoMode()` calls `initDemo()`.

### `initDemo`

1. Cancels live timers (`pulseTimer`, `pulseAbortCtrl`, `storyRotateTimer`).
2. Sets `state.demoMode = true`, applies `.demo-active` class, shows `mockBar`.
3. Hydrates `state.gameStates` from JSON.
4. Hydrates all `caches.*` keys to top-level `state.*` (with backwards-compat fallback to legacy top-level shape).
5. Hydrates recorder-v2 keys: `pitchTimeline`, `boxscoreSnapshots`, `contentCacheTimeline`, `focusStatsCache`, `focusTrack`, `lastVideoClip`.
6. Sets `state.demoDate` from earliest captured `gameDateMs`.
7. Splits feedItems by `metadata.startedAt` into **backlog** (`ts < startedAt`) and **queue** (`ts >= startedAt`).
8. Resets `gameStates` selectively: only games **touched** by any feedItem get reset to Preview. Games with no plays at all (Final games whose Game Final entry was pushed off the recorder cap, plus genuine Preview games) keep their captured state — otherwise they sit in Upcoming forever because no replay event would flip them.
9. Walks **backlog** in chronological order: each play advances the corresponding `gameState` (status, inning, halfInning, outs, awayScore, homeScore) and renders into the feed via `_addFeedItem`. After this pass, ticker + side-rail show the snapshot a user would have seen if they'd opened Pulse exactly at the recorder's Start time.
10. Builds `demoPlayQueue` from queue items only — first replayed event is the first new play after Record was clicked.
11. `demoCurrentTime = state.demoPlayQueue[0].ts`. This is in the recording window, so `pitchTimeline` / `contentCacheTimeline` / `focusTrack` lookups land on real data immediately.
12. Renders ticker + side-rail + story pool. Fires the demo-start toast (12 s, multi-line, with limitations text).
13. `pollDemoFeeds()` begins.

### Per-play replay

Each `demoSpeedMs` interval, `pollDemoFeeds` calls `advanceDemoPlay(play)`:

- Sets `state.demoCurrentTime = play.ts`.
- For status plays: sets `g.status` to Live or Final per label.
- For play plays: infers Live for still-Preview games (recovery for Game-underway entries pushed off the baseline cap), captures pre-update score deltas, advances `gameState` (inning/halfInning/outs/score). Fires HR card via `_showPlayerCard` for Home Runs; for other scoring plays, infers `rbi` from score delta + runs `calcRBICardScore` against `devTuning.rbiThreshold` + cooldown — fires `_showRBICard` if it qualifies, falls back to a green RUN SCORES toast otherwise.
- Calls `_addFeedItem(play.gamePk, feedData)` to render the item.
- Re-renders ticker + side-rail.
- Calls `_selectFocusGame()` (walks `focusTrack[]`) + `_pollFocusLinescore()` (rebuilds `focusState` from `pitchTimeline` envelope at `demoCurrentTime`) + `_pollPendingVideoClips()` (walks `contentCacheTimeline` and patches feed items with ▶ tiles).
- Calls `_buildStoryPool()` to refresh carousel.

### Speed controls

| Button | `demoSpeedMs` | Effect |
|---|---|---|
| **1x** | 10 000 ms | ~real-time replay |
| **10x** | 1 000 ms | quick |
| **30x** | 333 ms | fast-forward |

Changing speed cancels the pending `setTimeout` and starts a new one at the new interval.

### Other controls

- **⏸ Pause / ▶ Resume** — stops/starts `pollDemoFeeds`
- **🔥 Next HR** — flips `demoSpeedMs` to 500 ms (20x) until `advanceDemoPlay` processes a Home Run, then restores prior speed and auto-pauses on the HR card. Animated, not a hard skip.
- **Forward ▶** — advance one play
- **⏹ Exit Demo** — calls `exitDemo()`

## Consumer demo branches

Demo isn't just `pollDemoFeeds` — every consumer that would otherwise hit a live API has a demo branch:

| Consumer | Live behaviour | Demo behaviour |
|---|---|---|
| `pollFocusLinescore` (`src/focus/mode.js`) | fetches `/linescore` | calls `hydrateFocusFromDemo()` (rebuilds `focusState` from `pitchTimeline[focusGamePk]` envelope at `demoCurrentTime`; bootstrap fallback walks envelopes by `demoPlayIdx` fraction) |
| `pollFocusRich` | fetches GUMBO | early-return (sequence already populated by `hydrateFocusFromDemo`) |
| `fetchFocusPlayerStats` | fetches `/people/{id}/stats` | early-return (`focusStatsCache` already hydrated) |
| `selectFocusGame` | tension-scores live games | walks `focusTrack[]` for `ts ≤ demoCurrentTime`; falls back to `focusTrack[0]` (the recorder user's focus target) until demo crosses the recording window; falls back to tension scoring if `focusTrack` empty |
| `fetchBoxscore` (`src/main.js`) | fetches `/boxscore` | returns newest `boxscoreSnapshots[gamePk]` entry where `ts ≤ demoCurrentTime`, or `null` |
| `pollPendingVideoClips` (`src/data/clips.js`) | fetches `/game/{pk}/content` per game | walks `contentCacheTimeline[gamePk]` for newest snapshot ≤ demoCurrentTime (with latest-snapshot fallback), copies items to `liveContentCache`, runs the existing match-by-batterId + filter + `patchFeedItemWithClip` logic unchanged |
| `genWinProbabilityStories` (`src/carousel/generators.js`) | fetches `/contextMetrics` | early-return — would otherwise return final-game metrics with `homeWinProbability=100` for replayed Final games |
| `genLiveWinProbStories` | reads `state.liveWPCache` (live-loaded) | reads `state.liveWPCache` (hydrated from JSON) — works unchanged |
| `collectCard` HR/RBI hook (`src/cards/playerCard.js`, `src/collection/book.js`) | persists to `localStorage('mlb_card_collection')` | simulates the result for `lastCollectionResult`, increments session-only `state.demoCardCount`, calls `updateCollectionUI` (real localStorage stays untouched) |
| `updateCollectionUI` + rail count chip | reads localStorage count | reads `state.demoCardCount` in demo |
| `openCollection` | renders binder | renders "🎴 Sign in to start your real collection — these aren't saved" CTA in demo |

### Two consumers that **do** hit live APIs in demo (intentional)

- **Yesterday Recap.** `getYesterdayDateStr` / `getYesterdayDisplayStr` anchor on `state.demoDate` so "yesterday" maps to `demoDate - 1`. Forward navigation capped by `offset >= 0`. `openYesterdayRecap` and `ydChangeDate` both call `loadYdForDate(getYesterdayDateStr())` — fetches real `/schedule` + per-game `/playByPlay` + `/content` for the demo's anchor day. We deliberately don't read `state.yesterdayCache` in demo because it holds the recorder user's wall-clock yesterday, which doesn't match the demo anchor.
- **`fetchGameContent`** (`src/data/clips.js`). No `demoMode` guard. Yesterday Recap and `devTestVideoClip` both call it for real historical content. The Pulse demo replay path uses its own `pollPendingVideoClips`/`contentCacheTimeline` branch — it never touches `fetchGameContent`.

## Classic Radio (atmosphere audio)

**Added v3.47.** When the user toggles the radio button (📻 in the focus card or in Settings) while demo mode is active, `toggleRadio()` delegates to `devTestClassicRadio()` instead of the live-radio engine. Classic Radio (`src/radio/classic.js`) streams full-length classic MLB broadcasts directly from archive.org as background atmosphere — no timestamp sync, just vintage commentary + crowd noise.

| Behaviour | Detail |
|---|---|
| Pool | Hardcoded list of 4 archive.org MP3 URLs (1957 Giants/Dodgers Vin Scully, 1968 Yankees/Red Sox Mantle final, 1969 Mets/Orioles WS Game 5, 1970 Padres/Mets Seaver 19K) |
| Pick | Random from pool on each activation and each focus switch |
| Offset | Random in [30 min, 90 min] of the broadcast (skips pre-game / post-game; caps to `dur - 60s` if file shorter than 91 min) |
| Volume | Defaults 0.4 (`setClassicVolume` exposed for future UI) |
| Re-roll | `rollClassicOnSwitch()` fires from `setFocusGame` on every focus change while `_active` is true; defensively calls `stopRadio()` before rolling so live radio can't leak back |
| UI | `setRadioUI(true, {abbr:'CLASSIC', name: <title>})` makes the existing radio button show green + "Playing · CLASSIC · <title>" — same visual feedback as live |
| Live radio interlock | While classic is active, `setFocusGame` skips `updateRadioForFocus()` so live streams can't switch on focus change |
| Exit | `exitDemo` calls `stopClassic()` so audio doesn't bleed into live mode |

CORS: archive.org serves direct-MP3 with permissive CORS for plain `<audio>` playback. We don't set `crossOrigin` (would only matter for Web Audio API sample access).

Console diagnostics: `[classic radio] play: <title>` and `[classic radio] roll on focus switch: <title>` log on each pick. Transient `MediaError` / `AbortError` warnings on desktop during rapid focus switches are expected (race between `audio.pause()` and pending `play()` promise) and don't block playback.

## Exit demo

`exitDemo()`:

1. Clears `demoTimer`, `storyRotateTimer`, demo abort controllers.
2. Resets `state.demoMode = false`, all demo control flags, demo end overlay.
3. Clears every cache `initDemo` populated from JSON (dailyLeadersCache, onThisDayCache, yesterdayCache, hr/probable pitcher stats, daily hits/Ks, storyCarouselRawGameData, stolenBaseEvents, transactionsCache, liveWPCache, perfectGameTracker, highLowCache, focusStatsCache, lastVideoClip, liveContentCache, yesterdayContentCache, boxscoreCache) + resets the `lastFetch` timestamps for the time-gated loaders.
4. Clears feed DOM + ticker DOM, hides demo control panel buttons.
5. Calls a `resumeLivePulse` callback (defined in `main.js`) that:
   - Clears `pulseTimer` / `storyPoolTimer` / `videoClipPollTimer` if they're somehow alive
   - Re-sets `pollDateStr`
   - Renders empty state immediately (so user sees hype card during fetch)
   - Refires `loadOnThisDayCache` / `loadYesterdayCache` / `loadTransactionsCache` / `loadHighLowCache`
   - Runs `pollLeaguePulse().then(buildStoryPool + setFocusGame)`
   - Restarts all three timers

End state: a clean, fully-populated live Pulse view (or hype/empty card if no live games), no demo residue.

## Demo globals

Hot mutable state lives in `src/state.js`. Demo-only fields:

```javascript
state.demoMode               // bool — true while demo is active
state.demoGamesCache         // populated by legacy loadDemoGames (unused in v2 init flow)
state.demoPlayQueue          // [{gamePk, ts, type, event, ...}] — queue items only
state.demoPlayIdx            // index into demoPlayQueue
state.demoTimer              // setTimeout handle for poll loop
state.demoStartTime          // wall-clock ms when demo opened (for elapsed display)
state.demoDate               // earliest captured gameDateMs as a Date
state.demoCurrentTime        // ms — set to play.ts as each play replays
state.demoCardCount          // session-only counter for HR/RBI collections in demo

// Recorder v2 hydration targets (populated only in demo):
state.pitchTimeline          // {gamePk → AB envelopes}
state.boxscoreSnapshots      // {gamePk → snapshots}
state.contentCacheTimeline   // {gamePk → snapshots}
state.focusTrack             // [{ts, focusGamePk, isManual, tensionLabel}]
```

Encapsulated in `src/demo/mode.js`:

```javascript
let demoPaused           // bool
let demoSpeedMs          // 10000 (1x), 1000 (10x), 333 (30x), 500 (20x HR seek)
let _hrSeekActive        // bool — set true while 🔥 Next HR is fast-forwarding
let _hrSeekPriorSpeed    // ms — saved before HR seek, restored on HR fire
```

## Files involved

| File | Role |
|---|---|
| `daily-events.json` | Recorder v2 snapshot, served via GitHub Pages. ~2 MB raw, ~250 KB gzipped. **Not in `sw.js` SHELL cache** — only fetched on Try Demo click. |
| `src/dev/recorder.js` | The recorder — `window.Recorder` API, baseline + observers, caps, Download/Copy/Reset, status UI |
| `src/demo/mode.js` | All demo replay code: `toggleDemoMode`, `loadDailyEventsJSON`, `initDemo`, `pollDemoFeeds`, `advanceDemoPlay`, `setDemoSpeed`, `toggleDemoPause`, `forwardDemoPlay`, `demoNextHR`, `exitDemo`, `renderDemoEndScreen`, `setDemoCallbacks` |
| `src/state.js` | Demo-only state fields (see above) |
| `src/focus/mode.js` | `hydrateFocusFromDemo`, demo branches in `pollFocusLinescore` / `selectFocusGame` |
| `src/data/clips.js` | Demo branch in `pollPendingVideoClips` |
| `src/main.js` | `fetchBoxscore` demo branch, `resumeLivePulse` callback, demo callback wiring |
| `src/cards/playerCard.js` | `_collectCard` always called (no `!demoMode` wrapper) |
| `src/collection/book.js` | `collectCard` demo branch with `demoCardCount`, `updateCollectionUI` demo branch, `openCollection` demo CTA |
| `src/sections/yesterday.js` | `_ydAnchorDate`, demo-aware date helpers, `openYesterdayRecap` + `ydChangeDate` fetch via `loadYdForDate` in demo |
| `src/carousel/generators.js` | `genWinProbabilityStories` demo guard |
| `src/feed/render.js` | `addFeedItem` recorder hook |
| `src/pulse/poll.js` | `pollLeaguePulse`/`pollGamePlays` recorder hooks |
| `index.html` | Demo control panel (`mockBar`), demo button labels, recorder UI block |
| `styles.css` | `.alert-event`/`.alert-desc` wrap (no nowrap), demo-active styling |
| `sw.js` | Cache versioning |
