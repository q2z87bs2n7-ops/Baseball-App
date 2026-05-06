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
