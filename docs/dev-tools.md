# MLB Tracker — Dev Tools

Dev Tools panel (`#devToolsPanel`) is a centered modal opened via `toggleDevTools()`. On open, populates all tuning inputs from live `devTuning`/`devColorLocked` values. Uses `p.style.display !== 'block'` (not `=== 'none'`) to detect closed state — panel starts with CSS `display:none` (no inline style), so checking for `'none'` would fail on first open.

## Keyboard Shortcuts (global)

| Shortcut | Command | Purpose |
|---|---|---|
| `Shift+H` | `toggleDemoMode()` | Toggle demo mode on/off |
| `Shift+R` | `replayHRCard()` | Replay most recent HR card from live feed |
| `Shift+E` | `replayRBICard()` | Replay most recent RBI card from live feed |
| `Shift+V` | `window.PulseCard.demo()` | Cycle through all four HR card template variants |
| `Shift+D` | `toggleDevTools()` | Toggle Dev Tools panel open/closed |
| `Shift+F` | `window.FocusCard.demo()` | Open Focus Mode demo overlay with sample data |
| `Shift+G` | `generateTestCard()` | Inject one random card into the collection (bypasses demo mode guard) |
| `Shift+W` | `devTestVideoClip()` | Open video overlay with most recent live clip → yesterdayContentCache fallback → fetches yesterday's first game |
| `Shift+L` | open Dev Tools + scroll to Log Capture | Opens Dev Tools (if closed), expands the Log Capture details, scrolls it into view |

Keyboard listener is located in `app.js` near the bottom, after the `visibilitychange` event listener.

## Panel contents

- **▶ Try Demo / ⏹ Exit Demo** (`Shift+H`) — `toggleDemoMode()`; label updates via `updateDemoBtnLabel()`
- **🎬 Replay HR** (`Shift+R`) — `replayHRCard()`: scans `feedItems` for HR plays, calls `showPlayerCard()` with real game data
- **💰 Replay RBI** (`Shift+E`) — `replayRBICard()`: scans `feedItems` for non-HR scoring plays; bypasses cooldown
- **💫 Card Variants** (`Shift+V`) — `window.PulseCard.demo()`: cycle through all 4 HR card templates (V1 Stylized, V2 Jumbotron, V3 Comic/Pop Art, V4 Broadcast)
- **🎴 Test Card** (`Shift+G`) — `generateTestCard()`: injects one random card into collection with `force=true`. Pool = `rosterData.hitting` + hitting leaders from `leagueLeadersCache.hitting` + `dailyLeadersCache` (deduplicated)
- **📽️ Test Clip** (`Shift+W`) — `devTestVideoClip()`: fallback chain: `lastVideoClip` → `yesterdayContentCache` → fetch yesterday's first game content

### Tuning panels (require "Confirm Changes" button to apply)

**⚡ Pulse Tuning:**
- Carousel Rotation (ms) — `devTuning.rotateMs` (default 4500)
- RBI Card Threshold — `devTuning.rbiThreshold` (default 10)
- RBI Cooldown (ms) — `devTuning.rbiCooldown` (default 90000)
- Reset to Defaults button

**📖 Carousel Story Rules:**
- Home Run — Priority (`hr_priority` default 100) + Cooldown ms (`hr_cooldown` default 300000)
- Big Inning — Priority (`biginning_priority` 75) + Runs Threshold (`biginning_threshold` 3)
- Walk-Off Threat — Priority (`walkoff_priority` 90)
- No-Hitter Watch — Inning Floor (`nohitter_inning_floor` 6)
- Bases Loaded — Enable checkbox (`basesloaded_enable` true, **immediate**) + Priority (`basesloaded_priority` 88)

**🎯 Focus Mode Tuning:**
- CRITICAL score ≥ (`focus_critical` default 120)
- HIGH score ≥ (`focus_high` default 70)
- Switch margin in points (`focus_switch_margin` default 25)
- Alert cooldown ms (`focus_alert_cooldown` default 90000)

**🎨 Theme Tuning:**
- Color pickers for App Theme (Primary, Secondary, Dark BG, Card BG) and Pulse Theme (Dark BG, Card BG)
- Copy button captures current live CSS vars into pickers
- Lock Theme checkbox (`devColorLocked`) — disables auto-switching when team changes

Binary toggles (checkboxes, color pickers) apply **immediately**. Numeric inputs require **Confirm Changes** → `confirmDevToolsChanges()` → calls `updateTuning()` for each; flashes green "✓ Applied!" for 1.5s.

## `replayHRCard(itemIndex)` details

- Scans `feedItems` for all plays with `event === 'Home Run'`
- `itemIndex` optional (0 = most recent, 1 = second-most-recent, etc.)
- Extracts batter, team, game context from boxscore (including position and jersey number)
- Calls `showPlayerCard()` → displays a random template variant
- Logs: `"Replaying HR: {name} at {away} @ {home}"`

## Video Debug panel

Available in Dev Tools → Video Debug section. Shows `liveContentCache` state, last matched clip (`lastVideoClip`), and per-game clip counts. Useful for diagnosing clip-matching failures.

## 🌐 Network Trace (added v3.38.4)

Wraps `window.fetch` once at boot to capture metadata about every HTTP request the app makes. Surfaced as the "🌐 Network" collapsible in Dev Tools, between App State and Log Capture.

**Captured per request:** `{ts, method, url, status, ok, ms, sizeBytes, errorMsg}`. Ring buffer cap is 50 (`DEV_NET_CAP`).

**Important:** the wrap is metadata-only. It never touches `response.body` — the original `Response` is returned unchanged so consumers that read JSON, text, or stream the body see no behaviour change. `sizeBytes` is read from the `Content-Length` response header and may be `null` for chunked / cross-origin responses (correctness over completeness).

**Side effect:** non-2xx responses also flow into Log Capture as `[net]` warn entries; network failures (DNS, offline, CORS preflight failures) flow in as `[net]` errors. This means even when the Network details panel is closed you'll see slow/broken endpoints in the log.

**Collapsible UI:**
- One row per request, newest first. Color: red if `!ok` or status ≥ 400, amber if 3xx.
- Format: `time · METHOD STATUS · ms · size · shortened-url`. Hovering a row shows the full URL via `title=` attribute.
- 📋 Copy — Markdown table of every entry; appends a "Failed requests" section listing any non-OK rows for fast triage.
- Clear / 🔄 — empty buffer / re-render.

**Limitations:**
- Service worker (`sw.js`) fetches and any pre-`app.js` scripts (`pulse-card-templates.js`, `focusCard.js`, `collectionCard.js`) are not wrapped. Those modules don't make network calls today.
- `XMLHttpRequest` is not wrapped — the app uses `fetch` exclusively.

**Functions** (all in `app.js`):
- IIFE `wrapFetch()` at top of file installs the wrap before any fetches run
- `renderNetTrace()` — table renderer
- `copyNetTraceAsMarkdown()` — clipboard export
- `clearNetTrace()` — buffer reset + re-render
- `_shortUrl(u)`, `_fmtBytes(n)` — render helpers

**Globals:** `devNetLog` (ring buffer array), `DEV_NET_CAP` (50).

## 📊 App State Inspector (added v3.38.3)

Read-only views over the major in-memory state globals. Lives as a collapsible "📊 App State" section directly above Log Capture in the Dev Tools panel. Lazy: nothing renders until the `<details>` is opened (`toggle` event listener installed at `DOMContentLoaded`).

**Subsections:** Each rendered into a `.dt-box` with its own mini 📋 button:
- **Context** — version, section, activeTeam, demoMode, pulseInitialized, pulseColorScheme, themeScope, themeOverride, themeInvert, devColorLocked, radioCurrentTeamId, focusGamePk, focusIsManual, viewport
- **🎯 Focus** — `focusGamePk`, `focusIsManual`, plus pretty-printed focused-game line if available
- **🎮 gameStates** — one row per game: matchup · status · score · inning/outs · base runners · enabled/hidden flag. Sorted Live → Upcoming → Final.
- **📰 feedItems** — most recent 30 (DOM); mini-Copy exports up to 50 to clipboard. Columns: time · type · label/desc · scoring star.
- **📖 storyPool** — sorted by priority. Columns: priority · type · headline · cooldown remaining · `◀ shown` indicator on the currently-displayed story.

**📋 Copy All State** at the bottom dumps all five subsections as one Markdown report — the workhorse paste-to-Claude action. Top-of-doc `## Context` is JSON-fenced; gameStates / feedItems / storyPool are Markdown tables; Focus is JSON-fenced.

**Functions** (all in `app.js`):
- `renderAppState()` — top-level renderer
- `copyAppStateAsMarkdown()` — full snapshot to clipboard
- `_stateContext()`, `_stateGameStatesArr()`, `_stateFeedItemsArr(limit)`, `_stateStoryPoolArr()`, `_stateFocusObj()` — pure data shapers
- `_stateAsMarkdownContext()`, `_stateAsMarkdownGames()`, `_stateAsMarkdownFeed()`, `_stateAsMarkdownStories()`, `_stateAsMarkdownFocus()` — per-section serializers used by mini-Copy buttons and Copy All
- `_kvList(obj)`, `_section(title,action,body)`, `_miniCopyBtn(action)` — render helpers
- `_copyToClipboard(text, btnId)` — shared clipboard helper used by App State + future inspectors (Phases 3–6)

The inspector reads everything via `typeof X !== 'undefined'` guards so it stays safe even if a state global is renamed or removed.

## 🔍 Log Capture (added v3.38.1)

In-memory ring buffer (`devLog`, cap 500) populated by a `console.log/warn/error/info` wrap installed at the top of `app.js`. Also captures uncaught errors via `window.error` and `window.unhandledrejection` listeners. Surfaced in Dev Tools as a collapsible "🔍 Log Capture" section between the existing tuning panels and Story Carousel Debug.

**Why:** the highest-value debugging loop for this project is *paste real app logs into Claude*. The browser DevTools console isn't reachable from iPad/phone PWA installs, and even on desktop you have to flip windows and hand-pick lines. Log Capture brings the same data into the app itself.

**Controls:**
- Level dropdown — `all` (default) / `error` / `warn+` / `log+` (filters by minimum severity)
- Free-text filter — substring match against `msg`, `src`, and `level`
- 📋 Copy — writes a Markdown table of the filtered entries to the clipboard via `navigator.clipboard.writeText()` with `fallbackCopy()` fallback. Output format:
  ```
  # MLB Pulse — Log Capture
  Captured: 2026-05-06T18:30:00.000Z
  Total entries: 247 (showing 38 after filter)

  | time | level | src | message |
  |---|---|---|---|
  | 18:29:14.121 | error | promise | TypeError: ... |
  ```
- Clear — empties the ring buffer
- 🔄 — re-renders without changing anything

**Behaviour:**
- Render is lazy: nothing is built until the `<details>` is opened (via `toggle` event), and live-updates only when the level/filter inputs change. Closed Dev Tools = zero overhead.
- Newest entries render at top of the list; copy output preserves chronological order.
- The console wrap is a strict superset — every original `console.*` call still fires, so existing `if(DEBUG)` workflows are unaffected.
- Errors thrown anywhere — even in untouched code paths — flow into the buffer at `level:'error'`, `src:'window'` (sync errors) or `src:'promise'` (unhandled rejections).

**Functions** (all in `app.js`):
- `pushDevLog(level, src, args)` — internal, called by the console wrap and error listeners
- `devTrace(src, ...args)` — **always-on** event tracer (added v3.38.2). Pushes to `devLog` regardless of `DEBUG`. Use at major event boundaries — boot, navigation, polls, focus changes, theme apply, collection adds, radio start/stop, etc. Also forwards to `console.log` when `DEBUG=true`.
- `renderLogCapture()` — re-renders the list from current filter state
- `copyLogAsMarkdown()` — clipboard export
- `clearDevLog()` — empties `devLog` and re-renders
- `_filteredDevLog()`, `_logLevelRank()`, `_fmtLogTs()` — internal helpers

**Globals:** `devLog` (ring buffer array), `DEV_LOG_CAP` (500).

**Current `devTrace` instrumentation points** (v3.38.2):
- `boot` — script load
- `sw` — service worker register/fail
- `theme` — `applyTeamTheme(team)`
- `nav` — `showSection(id)`
- `pulse` — `initLeaguePulse()` (first nav only, lazy)
- `demo` — `toggleDemoMode()`
- `focus` — `setFocusGameManual(pk)`
- `collect` — `collectCard(data, force)`
- `radio` — `startRadio()` / `stopRadio()`

Add a new `devTrace('<src>', ...)` call at any new event boundary you want surfaced in Log Capture — keep them low-volume (one per user-meaningful event, never per poll tick or animation frame).
