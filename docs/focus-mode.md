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

Updated v4.11.1 with higher-fidelity runner quality tiers, inning-scaled no-hitter bonus, late-tight bonus, and reachability gate for extras blowouts.

```javascript
export function calcFocusScore(g) {
  if(g.status!=='Live'||g.detailedState!=='In Progress') return 0;
  var diff=Math.abs(g.awayScore-g.homeScore);
  var closeness=diff===0?60:diff===1?45:diff===2?28:diff===3?20:diff===4?8:3;
  var runners=(g.onFirst?1:0)+(g.onSecond?1:0)+(g.onThird?1:0);
  var isBL=g.onFirst&&g.onSecond&&g.onThird;
  var isWalkoff=g.halfInning==='bottom'&&g.inning>=9&&(g.awayScore-g.homeScore)<=runners+1&&g.awayScore>=g.homeScore;
  var isNoHit=g.inning>=6&&(g.awayHits===0||g.homeHits===0);
  var situation=isBL?40:(g.onThird&&(g.onSecond||g.onFirst))?35:g.onThird?28:(g.onSecond&&g.onFirst)?22:g.onSecond?20:runners>0?12:0;
  if(isWalkoff) situation+=50;
  if(isNoHit) situation+=Math.min((g.inning-4)*18,120);           // scales 36→120 over innings 6→10+
  if(g.inning>=6&&diff<=2&&runners===0) situation+=Math.min((g.inning-5)*6,24); // late-tight pitcher duel bonus
  var countBonus=0;
  if(g.gamePk===state.focusGamePk){
    if(state.focusState.balls===3&&state.focusState.strikes===2) countBonus=20;
    else if(state.focusState.strikes===2) countBonus=12;
    if(state.focusState.outs===2) countBonus+=8;
  }
  var innMult=g.inning<=3?0.5:g.inning<=5?0.75:g.inning<=8?1.0:g.inning===9?1.5:1.8;
  if(g.inning>=9&&diff>runners+2&&!isNoHit) innMult=Math.min(innMult,1.0); // reachability gate: no extras inflation on blowouts
  return (closeness+situation+countBonus)*innMult;
}
```

**Key formula components:**
- **Closeness** — tied (60), 1-run (45), 2-run (28), 3-run (20), 4-run (8), blowout (3)
- **Situation** — 6-tier runner quality: bases loaded (40), 2nd+3rd or 1st+3rd (35), 3rd only (28), 1st+2nd (22), 2nd only (20), 1st only (12)
- **Walkoff bonus** — +50 when home team trails by ≤ runners + 1 in bottom 9+
- **No-hitter bonus** — scales `min((inning−4)×18, 120)` from inning 6 onward
- **Late-tight bonus** — `min((inning−5)×6, 24)` for scoreless/1–2-run games with empty bases in late innings (pitcher duel)
- **Count bonus** — full-count +20, 2-strike +12, 2-out +8 (focused game only)
- **Inning multiplier** — 0.5× (1–3), 0.75× (4–5), 1.0× (6–8), 1.5× (9th), 1.8× (extras)
- **Reachability gate** — caps extras multiplier at 1.0× when lead > runners+2 and no no-hitter, preventing blowout inflation

## Tension labels

| Score | Label | Color |
|---|---|---|
| ≥ 120 (configurable via `devTuning.focus_critical`) | CRITICAL | `#e03030` (red) |
| 70–119 (configurable via `devTuning.focus_high`) | HIGH | `#f59e0b` (amber) |
| < 70 | NORMAL | `#9aa0a8` (muted) |

## Pulse ticker tension accent (v4.11.2+)

`calcFocusScore()` is also used to color-accent every live `.ticker-game` chip in `#gameTicker`. `tensionBand(score)` in `src/feed/render.js` maps the raw score to one of 10 CSS classes (`.tb-1`–`.tb-10`) applied to the chip. The class drives `border-top-color` — a subtle green→red gradient that lets users spot the hottest game at a glance without any new chrome.

| Class | Score range | Color | Meaning |
|---|---|---|---|
| `.tb-1` | 1–15 | `#16a34a` dark green | Early-inning, uneventful |
| `.tb-2` | 16–40 | `#22c55e` green | Mild interest |
| `.tb-3` | 41–55 | `#84cc16` yellow-green | Moderate |
| `.tb-4` | 56–72 | `#a3e635` lime | Getting interesting |
| `.tb-5` | 73–84 | `#eab308` yellow | Elevated (close late, pitcher duel) |
| `.tb-6` | 85–100 | `#f59e0b` amber | High tension |
| `.tb-7` | 101–115 | `#f97316` orange | Very tense |
| `.tb-8` | 116–145 | `#ea580c` deep orange | Clutch situation |
| `.tb-9` | 146–210 | `#dc2626` red | Near-critical |
| `.tb-10` | > 210 | `#b91c1c` dark red | Maximum (no-hitter late / extras walkoff) |

Non-live games (score = 0) receive no `.tb-*` class — border-top falls back to the default chip style.

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

**v4.19.3+**: Focus Mode is fully functional in demo. `pollFocusLinescore` short-circuits to `hydrateFocusFromDemo` (rebuilds `focusState` from the matching `pitchTimeline[focusGamePk]` envelope at `demoCurrentTime`); `pollFocusRich` still early-returns (its sequence is already populated by hydrate). The focus card animates pitch-by-pitch:

1. `advanceDemoPlay` calls `_animateFocusPitches(play)` for `play.type === 'play'` plays in the focused game.
2. The animator walks the matching atBat envelope and ticks `state.demoCurrentTime` to each pitch's `eventTs` (sub-tick), calling `pollFocusLinescore → hydrateFocusFromDemo` between pitches.
3. `hydrateFocusFromDemo` slices `envelope.pitches` to those with `eventTs ≤ demoCurrentTime`, and uses the latest revealed pitch's `ballsAfter/strikesAfter/outsAfter` for the displayed B/S/O.
4. Total animation budget capped at `min(demoSpeedMs × 0.5, 4000ms)`; at 100x speed the animation compresses to near-zero.

`#focusCard` and `#focusMiniBar` are visible during demo. Stats panels read from `state.focusStatsCache` (recorded during the source session).

**Legacy recordings** without per-pitch `ballsAfter/strikesAfter/outsAfter` fall back to the envelope's end-of-AB B/S/O — sub-tick still animates pitch entries through `focusPitchSequence` but the count display jumps once at AB end instead of ticking mid-AB.

## Auto-switch logic

`selectFocusGame()` runs after every `pollLeaguePulse()` (15s). If a non-focused game scores ≥ `devTuning.focus_switch_margin` (default 25) points higher, `showFocusAlert()` fires a dismissible banner with 90s per-game cooldown (`focusAlertShown`). On first call with no focused game, calls `setFocusGame()` immediately.

`setFocusGameManual(pk)` — user-initiated switch from compact switcher chips. Sets `focusIsManual=true` → `↩ AUTO` pill appears. `resetFocusAuto()` — clears manual flag, re-scores all live games, re-picks best.
