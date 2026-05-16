# MLB Tracker — Old-School Scorecard

Added v4.20.11 (shipped to main as v4.21.0). A full-screen overlay that
reconstructs a traditional baseball scoring-book from the MLB `feed/live`
payload — for any live or completed game.

## HTML structure

- `#scorecardOverlay` — `position:fixed` full-screen modal, `z-index:650`
  (between `#collectionOverlay` 500 and `#focusOverlay` 700). Backdrop
  click on the `#scorecardOverlay` div closes it.
- `#scorecardCard` — inner scroll container (`max-width:1280px`, `margin:auto`).
- Added once in `index.html` as a top-level sibling of the other overlays.

## Launch points

- Schedule game-detail panel — "📋 Scorecard" button on Live games,
  "📋 View Scorecard" on Final games (`src/sections/schedule.js`).
- Live Game View toolbar — "📋 Scorecard" button → `liveScorecard()` in
  `src/sections/live.js` (uses the currently-shown `liveGamePk`).
- `window.openScorecardOverlay(gamePk)` / `window.closeScorecardOverlay()`.

## Data source

One fetch per open: `${MLB_BASE_V1_1}/game/{gamePk}/feed/live`. That single
payload supplies the batting order + substitutions
(`liveData.boxscore.teams`), every plate appearance
(`liveData.plays.allPlays` with `runners[].credits`, `playEvents[]`,
`hitData`), the line score (`liveData.linescore`), pitching lines, and
W/L/S decisions (`liveData.decisions`). Self-refreshes on
`TIMING.LIVE_REFRESH_MS` while the open game is Live.

## Rendering

- **Line-score header** — inning strip + R / H / E / LOB per team.
- **Batting grid** — rows = lineup slots with substitution sub-rows
  (PH/PR tags parsed from substitution descriptions); columns = innings.
- **Diamond per plate appearance** (`diamondSVG`):
  - traced base path to the furthest base reached; interior filled when
    the run scored
  - fielder notation: `6-3`, `4-6-3 DP`, `F8`, `L6`, `P4`, `E5`, `FC`,
    `SAC`/`SF`, `K` (swinging) / `ꓘ` (called); out-type prefix from
    `hitData.trajectory`
  - one accent **dot per RBI** (top-left); authoritative **out number**
    from `play.count.outs` (top-right); **inning-ending diagonal**
  - **ball-strike + pitch count** caption just below the diamond, from `playEvents`
  - **batted-ball spray vector** from `hitData.coordinates` — true
    direction within the ±45° fair wedge + depth; grounders straight,
    fly balls/popups arced
  - **advancement reason codes** (SB/WP/PB/BK/E) and **runner-out
    markers** (CS/PO) annotated on the path
  - **batting around** — multiple PAs in one inning render as stacked
    mini-diamonds
- **Pitcher table** per team — IP/BF/H/R/ER/BB/K/HR/P-S with (W)/(L)/(S).

## Runner tracking (important)

Runner advancement is **base-keyed**, not runner-id-keyed: a map of which
batter's run currently occupies 1B/2B/3B. This makes pinch-runners inherit
the base correctly (the run is credited to the batter who started it),
correctly marks caught-stealing/pickoff outs, and lets the Manfred
extra-innings runner be synthesised as an `MR` cell so extra-inning runs
don't under-count vs. the R column. The base map resets each half-inning.

## Files

| Concern | File |
|---|---|
| All scorecard logic + rendering | `src/overlay/scorecard.js` |
| Overlay shell | `index.html` (`#scorecardOverlay`) |
| Styles (`.sc-*`) | `styles.css` |
| State (`scorecardOverlayOpen`, `scorecardGamePk`, `scorecardModel`, `scorecardCache`) | `src/state.js` |
| Window exports + Escape-to-close | `src/main.js` |
| Launch buttons | `src/sections/schedule.js`, `src/sections/live.js` |

## Behaviour notes

- **Per-inning LOB** — a "Left on base" footer row per team, counted from
  the base map at each half-inning rollover; game totals in the line-score
  `LOB` column.
- **Live re-render** preserves the overlay's vertical scroll and each
  grid's horizontal pan; a failed *refresh* keeps the existing view (only
  the *first* load shows an error).
- **Final games** are cached in `state.scorecardCache` for the session
  (immutable for the day) — instant reopen, no refetch. Live games always
  refetch on `LIVE_REFRESH_MS`.
- **Accessibility** — `role="dialog"`/`aria-modal`/`aria-labelledby`,
  per-cell `aria-label` summaries (SVGs are `aria-hidden`), a Tab focus
  trap, and Esc-to-close.
- **Print** — a `@media print` stylesheet yields a clean black-on-white
  landscape printout (chrome hidden, teams kept off page breaks); 🖨 button
  in the header.

## Known limitations

- Spray vectors are a geometric approximation of the Gameday coordinate
  system — direction and relative depth are right; exact landing spot is
  approximate.
- Demo Mode is unsupported (the overlay hits the live API, not the demo
  dataset) — consistent with the rest of the live-data surface.
