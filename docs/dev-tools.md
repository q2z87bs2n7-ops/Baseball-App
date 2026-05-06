# MLB Tracker — Dev Tools

Dev Tools panel (`#devToolsPanel`) is a centered modal opened via `toggleDevTools()`. On open, populates all tuning inputs from live `devTuning`/`devColorLocked` values. Uses `p.style.display !== 'block'` (not `=== 'none'`) to detect closed state — panel starts with CSS `display:none` (no inline style), so checking for `'none'` would fail on first open.

## Layout (v3.38.8)

Width: `min(760px, 94vw)` — bumped from 560 to fit comfortably on iPad landscape and avoid cramped collapsibles. `@media (min-width:1280px)` widens to 820px for desktop. Max-height 92vh, vertical-scrolling.

Sections are organised into four IA groups (small `.dt-group-hd` separator labels):

1. **Actions** — buttons + 🎯 Live Controls. "Do something" verbs.
2. **Inspectors** — read-only state views. "What's happening?" Order: 📊 App State → 🔍 Log Capture → 🌐 Network → 💾 localStorage → ⚙️ Service Worker → 📖 Story Carousel Debug.
3. **Tuning** — config that requires the bottom Confirm Changes button. Order: ⚡ Pulse → 📖 Carousel Story Rules → 🎯 Focus → 🎨 Theme.
4. **Export** — 📋 Copy Diagnostic Snapshot button (one-tap clipboard bundle of everything from groups 1–2).

Sticky footer: **Confirm Changes** (commits all numeric tuning fields).

## Keyboard Shortcuts (global)

| Shortcut | Mnemonic | Command | Purpose |
|---|---|---|---|
| `Shift+D` | **D**ev tools | `toggleDevTools()` | Toggle Dev Tools panel open/closed |
| `Shift+M` | de**M**o / Mock | `toggleDemoMode()` | Toggle demo mode on/off |
| `Shift+H` | **H**ome run | `replayHRCard()` | Replay most recent HR card from live feed |
| `Shift+B` | r**B**i | `replayRBICard()` | Replay most recent RBI card from live feed |
| `Shift+V` | **V**ariants | `window.PulseCard.demo()` | Cycle through all four HR card template variants |
| `Shift+F` | **F**ocus | `window.FocusCard.demo()` | Open Focus Mode demo overlay with sample data |
| `Shift+C` | **C**ollection | `window.CollectionCard.demo()` | Open Card Collection demo |
| `Shift+G` | **G**enerate | `generateTestCard()` | Inject one random card into the collection (bypasses demo mode guard) |
| `Shift+P` | **P**lay clip | `devTestVideoClip()` | Open video overlay with most recent live clip → yesterdayContentCache fallback → fetches yesterday's first game |
| `Shift+N` | **N**ews | `openNewsSourceTest()` | Run News Source diagnostic |
| `Shift+L` | **L**og | open Dev Tools + scroll to Log Capture | Expand and focus Log Capture |
| `Shift+S` | **S**tate | open Dev Tools + scroll to App State | Expand and focus App State Inspector |
| `Shift+I` | **I**nfo dump | `copyDiagnosticSnapshot()` | One-tap copy full diagnostic snapshot to clipboard |

(Renamed in v3.38.8: was `Shift+H/R/E/W` → `Shift+M/H/B/P` for clearer mnemonics.)

Keyboard listener is located in `app.js` near the bottom, after the `visibilitychange` event listener.

## Panel contents

- **▶ Try Demo / ⏹ Exit Demo** (`Shift+M`) — `toggleDemoMode()`; label updates via `updateDemoBtnLabel()`
- **🎬 Replay HR** (`Shift+H`) — `replayHRCard()`: scans `feedItems` for HR plays, calls `showPlayerCard()` with real game data
- **💰 Replay RBI** (`Shift+B`) — `replayRBICard()`: scans `feedItems` for non-HR scoring plays; bypasses cooldown
- **💫 Card Variants** (`Shift+V`) — `window.PulseCard.demo()`: cycle through all 4 HR card templates (V1 Stylized, V2 Jumbotron, V3 Comic/Pop Art, V4 Broadcast)
- **🎴 Test Card** (`Shift+G`) — `generateTestCard()`: injects one random card into collection with `force=true`. Pool = `rosterData.hitting` + hitting leaders from `leagueLeadersCache.hitting` + `dailyLeadersCache` (deduplicated)
- **📽️ Test Clip** (`Shift+P`) — `devTestVideoClip()`: fallback chain: `lastVideoClip` → `yesterdayContentCache` → fetch yesterday's first game content

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

## ⚡ Pulse Diagnostics (added v3.38.14)

Permanent debug tool in **Dev Tools → App State → ⚡ Pulse Diagnostics** designed to eliminate guesswork when Pulse is showing an unexpected empty state. Displays:

### Summary metrics
- **Current time** — ISO timestamp showing what the app thinks the time is
- **Greeting** — what empty-state headline would be displayed based on hour-of-day logic
- **Game counts** — live (In Progress), upcoming (Preview/Scheduled), final, enabled, total

### Why empty state shows
Analysis section that checks:
- **No upcoming games found** — whether the empty state triggers because all games are Final
- **Intermission flag** — whether hype block is being suppressed during mid-day gaps
- **Live games** — count of games currently In Progress

### All games table
Complete list of every game in `gameStates` with:
- Matchup (away @ home)
- Status (Preview/Scheduled/Live/Final) + detailed status
- Enabled flag (✓ or ✗ indicating whether game is in `enabledGames`)
- Inning + half-inning (for Live games only)

Sorted chronologically by game time, making it easy to trace which games are tracked and why certain ones are/aren't showing in the feed.

**Button:** Click the **⚡ Pulse Diagnostics** section header to copy the full diagnostic report as Markdown with all tables. Paste into a chat for context.

## Video Debug panel

Available in Dev Tools → Video Debug section. Shows `liveContentCache` state, last matched clip (`lastVideoClip`), and per-game clip counts. Useful for diagnosing clip-matching failures.

## 🧪 Custom-URL Testers (added v3.38.9)

Two paste-and-try tools designed for hunting replacement URLs without editing code or redeploying.

### 🔍 Radio Check → Try a Custom URL
A new section pinned at the top of the existing Radio Check overlay (Settings → 🔍 Radio Check). Paste any HLS (`.m3u8`) or MP3/Icecast stream URL, pick the format (or leave on `auto` — auto-detects HLS by extension), and tap **▶ Play**. The URL flows through the existing radio engine via `loadRadioStream({teamId:null, abbr:'TEST', name:'Custom · …', url, format})` so Hls.js routing, error handling, and the focus-pair UI all behave the same way as approved stations. Status row reports `playing` / failure so you don't have to listen for audio. Tap **⏹ Stop** in the footer to end the test (also clears the status row).

Use case: hunting for replacement URLs for the [Audacy rights gap](./radio-system.md#audacy-rights-gap) — try an iHeart / StreamTheWorld / Bonneville URL, confirm it actually plays game audio (not ads), then add it to `MLB_TEAM_RADIO`.

**Function:** `radioCheckTryCustom()` in `app.js`. URL is validated as `http(s)://`. Format `auto` looks for `.m3u8` extension (with optional querystring) → HLS, else MP3.

### 📺 YouTube Channel Test
New Dev Tools button (next to 🔬 News Source Test). Single overlay, two sections:

**Try a Custom Channel** — pinned at top of the modal. Paste:
- A raw UC channel id (`UCgIMbGazP0uBDy9JVCqBUaA`), or
- A channel URL (`https://www.youtube.com/channel/UCxxx`)

`@handle` / `/user/` / `/c/` URLs aren't supported (would need YouTube API to resolve handle → UC). The error message tells the user how to find the UC.

**▶ Fetch** hits `/api/proxy-youtube?channel=UCxxx`, shows HTTP status, video count, response time, and previews the latest 5 videos with thumbnails. **⚙ Apply to {team}** sets `activeTeam.youtubeUC = uc` (session-only — TEAMS array is not modified) and calls `loadHomeYoutubeWidget()` so the home page reloads with the new channel for visual verification. Switching teams or refreshing reverts.

**Sweep all 30** — bottom of the modal. Tests every team's `youtubeUC` plus the `MLB_FALLBACK_UC` and reports HTTP status + video count + response time per row. Per-row ▶ button retests just that channel. **📋 Copy Results** outputs ✅/❌/⏳ Markdown grouped by status. Ported from `claude/debug-youtube-api-SYBtV` branch (Anthropic, May 2026, with a custom-channel section added).

**Functions** (all in `app.js`):
- `parseYTChannelInput(s)` — UC/URL parser; returns `{uc}` or `{error}`
- `ytDebugFetchCustom()` — one-channel fetch + preview
- `ytDebugApplyToTeam(uc)` — session-only `activeTeam.youtubeUC` override + widget reload
- `openYoutubeDebug()` / `closeYoutubeDebug()` — modal lifecycle (pre-fills input with current `activeTeam.youtubeUC`)
- `ytDebugEntries()` — TEAMS array + MLB fallback
- `runYoutubeDebugAll()` / `runYoutubeDebugOne(key)` — sweep
- `renderYoutubeDebugList()`, `ytDebugReset()`, `ytDebugCopy()` — UI

## 📋 Diagnostic Snapshot (added v3.38.7)

The headline feature for the v3.38 enhancement series: a single button that bundles **everything** the inspectors capture into one Markdown document and writes it to the clipboard. Drop it into a Claude chat and the agent has full context — version, section, active team, focus state, every game's status, last 50 feed events, story pool with priorities and cooldowns, last 50 log entries, last 50 network calls (with a separate "Failed" section), localStorage sizes, and Service Worker state.

Lives in its own footer block above the existing "Confirm Changes" button so it's visible without expanding any collapsible.

**Why it matters:** the 5 individual inspectors are great when you know which one to look at. The snapshot is for "something's weird, let me show you everything." It's the answer to "open DevTools and screenshot these 6 tabs" — except it works on iPad and the output is text, not an image, so Claude can actually read it.

**Format outline:**
```
# MLB Pulse — Diagnostic Snapshot
Generated: <ISO>
Version: vX · Section: pulse · Active team: Mets (id:121)
demoMode: false · pulseInitialized: true · pulseColorScheme: dark · themeScope: full
Focus: gamePk=824934 · manual=false · radioCurrentTeamId: 121
Viewport: 1280×800
UA: ...

## Counts
- gameStates: 12 · feedItems: 247 · storyPool: 18 · enabledGames: 12 · devLog: 312 · devNetLog: 46

## Context              ← JSON-fenced
## Focus                ← JSON-fenced
## gameStates           ← Markdown table
## feedItems (50)       ← Markdown table
## storyPool            ← Markdown table
## Service Worker       ← bullet list
## localStorage sizes   ← bullet list
## Last 50 logs         ← Markdown table
## Last N network calls ← Markdown table + Failed section
```

Calls `_refreshSWState()` asynchronously after copy so the next snapshot picks up fresh SW data without slowing this one down. Reuses every existing inspector serializer (`_stateAsMarkdownContext()` / `_stateAsMarkdownFocus()` / `_stateAsMarkdownGames()` / `_stateAsMarkdownFeed(50)` / `_stateAsMarkdownStories()`) so format consistency is automatic.

**Function:** `copyDiagnosticSnapshot()` in `app.js`.

## 🔔 Test Notification + 🎯 Live Controls (added v3.38.6)

### 🔔 Test Notification
A new button in the Actions row that calls `registration.showNotification()` directly via the active service worker. Verifies on-device notification surfacing — permission state, OS-level delivery, icon/badge rendering — without exercising the Vercel + Upstash + VAPID server pipeline.

End-to-end push tests still belong in `.github/workflows/test-push.yml` because `/api/test-push.js` requires the `NOTIFY_TOKEN` server secret, which can't safely live in browser code.

Permission flow: if `Notification.permission === 'denied'` it alerts the user; if `'default'` it triggers `Notification.requestPermission()`; if `'granted'` it fires immediately. Result is logged to Log Capture as `[notif]`.

### 🎯 Live Controls
A new collapsible directly under the Actions buttons — lazy-rendered with the current set of live games on toggle.

**Force Focus** — replaces auto-scoring (`calcFocusScore`) with a manual pin. Dropdown lists every `gameStates[pk]` where `status==='Live'`, sorted by inning desc. Apply button calls existing `setFocusGameManual(pk)`. The current focus gamePk is shown beneath. Reset by tapping the `↩ AUTO` pill in the focus card itself (existing UX — not duplicated here).

**Force Inning Recap** — surfaces the previously console-only workflow that was documented in CLAUDE.md (now `docs/dev-tools.md`). Game dropdown + half-inning + inning-number; "Queue" pushes a `{gamePk, inning, halfInning}` entry into `inningRecapsPending[…]`, deletes any matching `inningRecapsFired` entry so it can re-fire, then calls `buildStoryPool()` to surface it. The inning + half are auto-prefilled from the selected game's current state.

**Empty state:** When `gameStates` has no Live games, the panel suggests Demo Mode (Shift+M) which seeds a populated `gameStates` from `daily-events.json`.

**Functions** (all in `app.js`):
- `testLocalNotification()` — permission + showNotification flow
- `renderLiveControls()` — populates dropdowns, wires inning auto-sync
- `_liveGamesForControls()` — pure data shaper
- `forceFocusGo()`, `forceRecapGo()` — apply handlers

## 💾 localStorage + ⚙️ Service Worker (added v3.38.5)

Two side-by-side inspectors that surface persistent state and PWA cache state — both opaque to the browser DevTools console anyway, and completely unreachable from an iPad PWA install.

### 💾 localStorage
Auto-enumerates all keys starting with `mlb_*` so it future-proofs against new keys. For each:
- Key name (monospace), byte size, and a 🗑 button (with confirm) to delete the single key
- Inline preview: pretty-printed JSON in a nested `<details>` if the value parses as JSON, otherwise truncated raw string
- 📋 Copy emits a Markdown summary table + a `## Full values` section with each key's full content (JSON-fenced when applicable). Drop the whole thing into Claude when sync, theme, or auth is misbehaving.

Currently surfaces (as of v3.38.5): `mlb_my_team_lens`, `mlb_demo_snapshot`, `mlb_card_collection`, `mlb_radio_check`, `mlb_radio_check_notes`, `mlb_radio_check_notes_seeded_v2`, `mlb_sound_settings`, `mlb_theme`, `mlb_theme_vars`, `mlb_theme_scope`, `mlb_invert`, `mlb_pulse_scheme`, `mlb_team`, `mlb_session_token`, `mlb_auth_user`, `mlb_push`. Any new `mlb_*` key shows up automatically.

### ⚙️ Service Worker
- Read-only state via `navigator.serviceWorker.getRegistration()`: scope, active script URL, controller URL, "update waiting" flag, error if registration failed.
- **↻ Force Update** — calls `reg.update()`, posts `SKIP_WAITING` to any waiting worker, alerts the user if a new version was fetched. (sw.js already calls `self.skipWaiting()` at install, so the postMessage is belt-and-braces.)
- **⚠ Unregister + Reload** — confirm-gated nuclear option: unregisters the SW, deletes every `caches.keys()` entry, hard-reloads. Use when stale shell cache is suspected.
- 📋 Copy outputs the state as a Markdown bullet list.

**Functions** (all in `app.js`):
- `renderStorageInspector()`, `clearLsKey(key)`, `copyStorageAsMarkdown()`
- `_lsKeys()`, `_lsEntry(k)` — internal data shapers
- `renderSWInspector()`, `_refreshSWState()`, `copySWStateAsMarkdown()`
- `swForceUpdate()`, `swUnregisterAndReload()`

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

**Current `devTrace` instrumentation points** (v3.38.14):
- `boot` — script load
- `sw` — service worker register/fail
- `theme` — `applyTeamTheme(team)`
- `nav` — `showSection(id)`
- `pulse` — `initLeaguePulse()` (first nav only, lazy)
- `demo` — `toggleDemoMode()`
- `focus` — `setFocusGameManual(pk)`
- `collect` — `collectCard(data, force)`
- `radio` — `startRadio()` / `stopRadio()`
- `poll` — `pollLeaguePulse()` start/end + schedule fetch result + game final transitions (v3.38.14)
- `empty` — `renderEmptyState()` logic with upcoming/postSlate/intermission flags (v3.38.14)

**Pulse state-change logging** (v3.38.14) — add a new `devTrace('poll', ...)` call at any new polling boundary you want surfaced:
- `pollLeaguePulse start` — hasLive, pollDate, game counts, enabled count
- `schedule fetch` — date polled, games returned
- `game final` — which game went final and score
- `pollLeaguePulse end` — live, final, total games, enabled, feedItems
- `renderEmptyState` — upcoming count, postSlate flag, intermission flag

These traces help trace exactly which poll triggered state changes and why the empty state is showing what it shows.

Keep new traces low-volume (one per user-meaningful event, never per poll tick or animation frame).
