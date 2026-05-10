# MLB Tracker — Pulse Feed Internals

Details for the ⚡ Pulse section's feed, ticker, overlays, and HR/RBI card logic. For Story Carousel details see `docs/story-carousel.md`. For Focus Mode see `docs/focus-mode.md`.

## HTML structure (`#pulse` section)

- `#soundPanel` — `position:fixed` floating overlay, hidden by default; triggered by `🔊` button. **Top-level in DOM** (sibling of `#devToolsPanel`, outside `#pulse`) — if nested inside `#pulse` it would be hidden with the section when navigating away. Click-outside handler (`onSoundPanelClickOutside`) is always-on via `document.addEventListener('click',...)` — handles both `#soundPanel` and `#devToolsPanel` dismiss.
- `#alertStack` — `position:fixed` toast stack for triple-play and other non-run alerts (HR events fire a player card instead; routine runs fire no toast as of v4.10.4)
- `#playerCardOverlay` — `position:fixed` full-screen semi-transparent overlay; contains `#playerCard`; shown on HR events. **Must remain top-level DOM** (z-index 600). See Critical DOM placement note below.
- `#pulseTopBar` — brand strip above `#gameTicker`. Contains: ⚡ MLB PULSE wordmark + `#ptbYestBtn` + `#myTeamLensBtn` + `#ptbSoundBtn` (🔊) + `#ptbRadioBtn` (📻) + `#ptbSchemeBtn` (☀️/🌙).
- `#yesterday` — `class="section"` inside `.main` (sibling to `#pulse`) — normal section, not an overlay. Opened via `openYesterdayRecap()`; closed via `closeYesterdayRecap()` which restores `ydPrevSection` (defaults `'pulse'`). Contains `#ydSectionBar` (sticky, same CSS as `#pulseTopBar`) + `#yesterdayCard`.
- `#gameTicker` — `position:sticky` below header; horizontal scrollable chip bar
- `#mockBar` — inline (not fixed); shown only when `pulseMockMode` is true
- `#feedWrap > #feedEmpty + #feed` — empty/upcoming state and live play items
- `#videoOverlay` — top-level sibling of all overlays, z-index 800. Contains `#videoOverlayTitle` + `#videoOverlayPlayer` (`<video controls>`). Opened by `openVideoOverlay(url, title)`, closed by `closeVideoOverlay()` or backdrop click. Never auto-opens.

### Critical DOM placement rule

**`#playerCardOverlay` must remain at top-level DOM** (sibling of `#focusOverlay`, `#collectionOverlay`, `#devToolsPanel`, `#soundPanel`) — never nested inside `#pulse` or any section. Sections create stacking contexts and can be `display:none`, which either traps the overlay's z-index or hides it entirely. Current z-index: 600 (above binder's 500, below focusOverlay's 700, below videoOverlay's 800).

## Ticker bar

All games as scrollable horizontal chips. Sort order: Live (most-progressed inning first) → Preview/Scheduled (by `gameDateMs` asc) → Final (dimmed). Clicking a chip toggles that game's plays in the feed (`enabledGames` Set). Final games with `detailedState` Postponed/Cancelled/Suspended show `PPD` instead of `FINAL`.

**Normal chip layout (v2.13):** Three stacked rows — (1) green live dot + away abbr + away score, (2) invisible dot-spacer + home abbr + home score, (3) inning/time + out-dot indicators. Out dots: 3 small circles (red outline when empty, filled `#e03030` when recorded). Live dot is green (`#22c55e`) with pulse-ring animation.

**Expanded chip layout (v2.52):** Fires when **any base is occupied** (`g.onFirst || g.onSecond || g.onThird`) — variable `hasRunners`. Top row: `away abbr · score | score · home abbr` (horizontal). Bottom row: 28×24px base diamond SVG (`baseDiamondSvg()`) + inning + out-dot indicators — `gap: 6px`, left-aligned. CSS class `.has-risp` retained for styling.

## Feed

Newest plays at top. Each item shows: coloured team dots + score (meta row), inning + outs, play description, play-type badge (1B/2B/3B/BB/K/E/DP/TP), ⚡ RISP badge, and score badge on scoring plays.

**Play classification → visual treatment:**
- `homerun` — strong amber tint + 3px amber left border stripe (outranks scoring plays visually)
- `scoring` — green tint
- `risp` — no border stripe; ⚡ badge + base diamond chip provide sufficient treatment
- `status-change` — blue tint, centred — game start/end/delay (e.g. "🌧️ Game Delayed — SD @ AZ · Delayed Start")

**Feed sort order (v2.3):** `addFeedItem` maintains newest-first order on every insert via `data-ts` attributes. Late-arriving plays insert at the correct chronological position.

**`feedItems` cap:** 600 entries — oldest trimmed to prevent DOM growth.

## HR/RBI player card logic

### HR badge logic (`getHRBadge`)

Badge label computed at `pollGamePlays` call site, passed as `badgeText` to `showPlayerCard`. Priority:
1. `WALK-OFF GRAND SLAM!` — bottom 9th+, 4 RBIs, batting team was tied/behind, now leads
2. `WALK-OFF HOME RUN!` — bottom 9th+, batting team was tied/behind, now leads
3. `GRAND SLAM!` — 4 RBIs, any other situation
4. `GO-AHEAD HOME RUN!` — batting team was tied/behind, now leads (not walk-off)
5. `💥 HOME RUN!` — fallback

### Key RBI card scoring formula (`calcRBICardScore`)

`score = (baseRBI × hitMultiplier + contextBonus) × inningMultiplier`

| Component | Values |
|---|---|
| Base RBI score | 1 RBI → 10, 2 → 25, 3 → 40, 4 → 55 |
| Hit type multiplier | Sac fly/walk/GIDP/FC → 0.7; Single → 1.0; Double → 1.5; Triple → 2.0 |
| Context bonus (additive) | Go-ahead +30; Equalizer +25; Comeback (down 3+, now within 1) +20; Blowout suppressor (already leading 5+) −15 |
| Inning multiplier | Inn 1–3 → 0.4; 4–6 → 0.75; 7–8 → 1.0; 9 → 1.4; 10+ → 1.6 |

Score ≥ `devTuning.rbiThreshold` (default 10) triggers `showRBICard`. Per-game cooldown: 90s via `rbiCardCooldowns{}`.

### Key RBI badge logic (`getRBIBadge`)

Priority:
1. `WALK-OFF [EVENT]!` — bottom 9th+, go-ahead
2. `GO-AHEAD [EVENT]!` — batting team was tied/behind, now leads
3. `[EVENT] TIES IT!` — batting team was behind, now tied
4. `[N]-RUN [EVENT]` — 2+ RBIs, no game-state flip
5. `RBI [EVENT]!` — 1 RBI, no game-state flip
6. `RBI!` — event has no clean label (GIDP, FC, etc.)

Event label map: Single → `SINGLE`, Double → `DOUBLE`, Triple → `TRIPLE`, Sac Fly → `SAC FLY`, Walk → `WALK`, HBP → `HBP`.

## Sound alerts

Web Audio API synthesized tones — no external files. Master defaults off. Events: HR (bat crack), Run (bell chime), RISP (heartbeat), DP (glove pops), TP (bugle fanfare), Game Start (organ riff), Game End (descending chime), Error (dirt thud). `playSound(type)` checks `soundSettings.master && soundSettings[type]`.

## Live mode polling

`pollLeaguePulse()` fetches all games every 15s. Game-start fires only when `detailedState` transitions to `'In Progress'` (not on warmup). Timestamps stale check (`/api/v1.1/game/{pk}/feed/live/timestamps`) skips the playByPlay fetch when nothing has changed. On first poll, all pre-existing plays load as history with no alerts or sounds (`isHistory` flag), then sorted chronologically across games.

## Historical status items (v2.2/v2.3)

When a game is first added to `gameStates`, a status feed item is synthesised silently (no sounds):
- `Final` (non-PPD) → 🏁 "Game Final · AWAY X, HOME Y · Zh Mm" — deferred to `pendingFinalItems`; positioned at `lastPlay.ts + 60s`. Omitted entirely if no plays found.
- `Final` + PPD → 🌧️ "Game Postponed" — suppressed if `Date.now() < gameDateMs`
- `Live` + `In Progress` → ⚾ "Game underway!" — `playTime = gameDateMs`
- `detailedState` contains `'delay'` → 🌧️ "Game Delayed" — `playTime = gameDateMs`

These are only ever added once; subsequent polls use the update path.

## Video clip matching (`pollPendingVideoClips`)

Background poll every 30s. Scans `feedItems` for HR and scoring plays whose DOM element lacks `data-clip-patched`. Fetches `/game/{pk}/content` per game (cached in `liveContentCache`, 5min TTL; data-visualization/darkroom clips excluded at fill time).

**Matching (2-tier, player_id only):**
1. `player_id` in scoring-tagged clips
2. `player_id` in broadcast clips

**Excluded clips:**
- Statcast/Savant clips (keyword filter)
- ABS challenge clips (`isABSChallenge()` — carries batter's player_id but is a pitch-review overlay, not a batting highlight)

No timestamp fallback — unmatched plays retry on next 30s poll rather than showing a wrong clip.

On match: sets `lastVideoClip`, calls `patchFeedItemWithClip(feedItemTs, gamePk, clip)` which appends thumbnail + ▶ overlay div to the DOM element and guards against double-patching via `el.dataset.clipPatched`.

Source: `/schedule?sportId=1&date={date}&hydrate=linescore,team,probablePitcher` + `/game/{pk}/playByPlay` + `/api/v1.1/game/{pk}/feed/live/timestamps`
