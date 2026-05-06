# MLB Tracker — At-Bat Focus Mode

Live pitch-by-pitch tracker added v2.61. Auto-selects the most exciting game using a tension formula and surfaces pitch type, speed, and result in real time. Fills the 1–10 min silence between completed plays.

## HTML structure

- `#focusCard` — compact card at top of `#sideRail` (desktop/iPad landscape only); `display:none` until a live game is selected
- `#focusMiniBar` — slim strip below `#gameTicker` inside `#pulseLeft`; visible on phone (≤480px) and iPad portrait (481–1024px); hidden on desktop/iPad landscape (`@media(min-width:1025px) { display:none !important }`)
- `#focusOverlay` — `position:fixed` full-screen modal (`z-index:1100`); backdrop click on the `#focusOverlay` div (not `#focusOverlayCard`) closes it
- `#focusOverlayCard` — inner scroll container (`max-width:520px; max-height:90vh; overflow-y:auto`); custom 4px dark navy scrollbar via webkit + Firefox `scrollbar-width:thin`
- `#focusAlertStack` — `position:fixed` soft-alert banner area for game-switch suggestions

## Responsive behaviour

| Viewport | Side rail | `#focusCard` | `#focusMiniBar` |
|---|---|---|---|
| ≥1025px (desktop / iPad landscape) | Visible | Visible (top of rail) | Hidden |
| 481–1024px (iPad portrait) | Hidden | Hidden | **Visible** |
| ≤480px (phone) | Hidden | Hidden | **Visible** |

## Data flow

```
pollLeaguePulse() (15s)
  └─ selectFocusGame()           — scores all live games, may call setFocusGame() or showFocusAlert()

setFocusGame(pk)
  └─ pollFocusLinescore()        — fires immediately, then every 5s via focusFastTimer
       ├─ /game/{pk}/linescore   — Tier 1 (~5KB): B/S/O, inning, runners, score, batter/pitcher IDs+names
       ├─ fetchFocusPlayerStats()— async, session-cached; skipped if both players already in focusStatsCache
       ├─ pollFocusRich()        — Tier 2 GUMBO (~500KB): pitch-by-pitch for current at-bat
       │    └─ /api/v1.1/game/{pk}/feed/live
       │         └─ liveData.plays.currentPlay.playEvents (filter isPitch)
       ├─ renderFocusCard()      — window.FocusCard.renderCard(focusState) → #focusCard
       ├─ renderFocusMiniBar()   — slim strip → #focusMiniBar
       └─ renderFocusOverlay()   — window.FocusCard.renderOverlay({...focusState, pitchSequence, allLiveGames}) → #focusOverlayCard (only if overlay open)
```

**GUMBO fetch strategy:** No timestamp stale check — `/feed/live/timestamps` only updates on completed plays, not per pitch. GUMBO is fetched unconditionally every 5s. At ~500KB per call this is acceptable for a single focused game.

**At-bat reset:** `focusCurrentAbIdx` tracks `cp.about.atBatIndex`. When it changes (new at-bat), `focusPitchSequence` is cleared and `focusState.lastPitch` is set to null.

## Focus Score Formula (`calcFocusScore`)

```javascript
function calcFocusScore(g) {
  var diff = Math.abs(g.awayScore - g.homeScore);
  var closeness = diff===0?60:diff===1?45:diff===2?25:5;
  var runners = (g.onFirst?1:0)+(g.onSecond?1:0)+(g.onThird?1:0);
  var isRISP = g.onSecond||g.onThird;
  var isBL = g.onFirst&&g.onSecond&&g.onThird;
  var isWalkoff = g.halfInning==='bottom'&&g.inning>=9&&
                  (g.awayScore-g.homeScore)<=runners+1&&g.awayScore>=g.homeScore;
  var isNoHit = g.inning>=6&&(g.awayHits===0||g.homeHits===0);
  var situation = isBL?40:isRISP?25:runners>0?15:0;
  if(isWalkoff) situation+=50;
  if(isNoHit) situation+=30;
  var countBonus=0;
  if(g.gamePk===focusGamePk){
    if(focusState.balls===3&&focusState.strikes===2) countBonus=20;
    else if(focusState.strikes===2) countBonus=12;
  }
  if(g.outs===2) countBonus+=8;
  var innMult = g.inning<=5?0.6:g.inning<=8?1.0:g.inning===9?1.5:2.0;
  return (closeness+situation+countBonus)*innMult;
}
```

## Tension labels

| Score | Label | Color |
|---|---|---|
| ≥ 120 (configurable via `devTuning.focus_critical`) | CRITICAL | `#e03030` (red) |
| 70–119 (configurable via `devTuning.focus_high`) | HIGH | `#f59e0b` (amber) |
| < 70 | NORMAL | `#9aa0a8` (muted) |

## window.FocusCard API (`focusCard.js`)

Standalone IIFE (no imports, no build). Exports `window.FocusCard` with four methods. All rendering is pure HTML string generation — no DOM side effects.

**`renderCard(data)`** — compact side-rail card. Shows: team seam, LIVE badge + tension pill + inning, score row with batting indicator, B/S/O pip rows + base diamond, matchup names, last-pitch strip, OPEN FOCUS button.

**`renderOverlay(data)`** — full modal card. Same inputs plus `pitchSequence[]` and `allLiveGames[]`. Shows: team seam, topbar (LIVE/inning/tension/close ✕), scoreboard, hero count pips + diamond, matchup with batter stats (AVG/OPS/HR/RBI) and pitcher stats (ERA/WHIP/W/L), last-pitch strip, pitch sequence pills (wrapping row, oldest→newest), game switcher strip.

**`renderPitchPill(pitch)`** — single pitch chip. Shows: sequence index, result color stripe, pitch full name (`typeName`) + speed, result label. `typeName` falls back to `typeCode` if absent.

**`demo()`** — mounts full overlay with hardcoded sample data (NYM @ PHI, bottom 8th, full count, bases loaded). Bound to `Shift+F` via `window.__fcShiftFBound` guard.

## Pitch type codes (MLB Stats API)

Full name lives in `details.type.description` in GUMBO → stored as `typeName` in `focusPitchSequence`. Always display `typeName`; `typeCode` is for deduplication only.

| Code | Name | Code | Name |
|---|---|---|---|
| `FF` | Four-Seam Fastball | `SL` | Slider |
| `SI` | Sinker | `ST` | Sweeper |
| `FC` | Cutter | `CU` | Curveball |
| `FS` | Splitter | `KC` | Knuckle Curve |
| `FA` | Fastball (generic) | `CH` | Changeup |
| `FO` | Forkball | `KN` | Knuckleball |
| `SC` | Screwball | `EP` | Eephus |
| `IN` | Intentional Ball | `PO` | Pitchout |

## Pitch result codes

| Code | Meaning | Color |
|---|---|---|
| `B` | Ball | `#7a8597` (gray) |
| `C` | Called Strike | `#f59e0b` (amber) |
| `S` | Swinging Strike | `#e03030` (red) |
| `F` | Foul | `#f97316` (orange) |
| `T` | Foul Tip | `#ef4444` (red-orange) |
| `X` | In Play | `#22c55e` (green) |

## Demo Mode compatibility

Focus Mode globals are not populated during Demo Mode — `pollFocusLinescore` and `pollFocusRich` both guard on `demoMode` and return early. `#focusCard` and `#focusMiniBar` remain hidden during demo playback.

## Auto-switch logic

`selectFocusGame()` runs after every `pollLeaguePulse()` (15s). If a non-focused game scores ≥ `devTuning.focus_switch_margin` (default 25) points higher, `showFocusAlert()` fires a dismissible banner with 90s per-game cooldown (`focusAlertShown`). On first call with no focused game, calls `setFocusGame()` immediately.

`setFocusGameManual(pk)` — user-initiated switch from compact switcher chips. Sets `focusIsManual=true` → `↩ AUTO` pill appears. `resetFocusAuto()` — clears manual flag, re-scores all live games, re-picks best.
