# App Pages & Sections

## 🏠 Home
**Left card — "Next Game"** (`#todayGame`, `loadTodayGame()`) — priority: (1) live game with score + Watch Live, (2) upcoming today, (3) next upcoming. Series info via `getSeriesInfo(g)`. Layout: 5-column row [opp cap] [opp name/score] [—] [my name/score] [my cap]. Background: opp primary → #111827 50% → active-team colour (built in `renderNextGame`, NOT via `gameGradient()` — see Critical Traps in CLAUDE.md).

**Right card — "Next Series"** (`#nextGame`, `loadNextGame()`) — fetches 28 days, groups into series, finds the **second** series with any non-Final game (skips current series). 3-stop gradient.

`gameGradient(g)` uses away→home order and is only used by `renderGameBig` (schedule/history cards). `renderNextGame` builds its own gradient so opponent is always left and active team always right — would be wrong for away games if using `gameGradient`.

**Division Snapshot** — compact standings for active team's division.
**Latest News** — top 5 ESPN headlines.
**YouTube Widget** (`#homeYoutubeWidget`) — team YouTube channel, 25%/75% two-panel layout. Loaded by `loadHomeYoutubeWidget()` → `loadMediaFeed(uc)`. **Requires deployed URL** — YouTube embeds return Error 153 on `file://`.

## 📅 Schedule
Monthly calendar grid (Sun–Sat). `scheduleLoaded` flag prevents double-fetch when `scheduleData` is pre-populated by cold-load ±7 day fetch. Doubleheaders: `renderCalendar` uses `gamesByDate` (array per date) — DH cells show `G1:`/`G2:` rows, each independently clickable. Mobile (≤480px): colour-coded dots only; tapping shows `.cal-tooltip` from `scheduleData` (no API call).

Clicking completed game (desktop): boxscore tabs (Batting + Pitching, AB>0/IP>0 only) + linescore (R/H/E, `!=null` guards) + game summary (bs.info pairs). PPD: info card only, no linescore fetch. Upcoming: location + probable pitchers.

Source: `/schedule?season=2026&teamId={id}&hydrate=team,linescore,game`

## 🏆 Standings
Division standings (active team highlighted) + Wild Card Race (top 9 non-division-leaders, orange cutoff after 3) + WC Other Divisions (excludes active team's division) + Full MLB Standings.

Source: `/standings?leagueId=103,104&standingsTypes=regularSeason&hydrate=team,division,league`

## 📊 Stats
Three-column layout: Leaders | Roster (40-man, hitting/pitching/fielding tabs, first player auto-selected) | Player Stats (headshot + 12-stat grid, hitting/pitching 4-col, fielding 3-col, first stat `.hero`).

Source: `/teams/{id}/roster?rosterType=40Man` + `/people/{id}/stats`

## 🌐 Around the League
Matchups: all MLB games, 3-per-row, day toggle (Yesterday/Today/Tomorrow), opacity fade on switch. Live games show inning. Clickable → live game view. ⚠️ **Leaders index mapping is fragile** — API doesn't guarantee response order matches `leaderCategories` order; re-test empirically after API changes.

Sources: `/schedule?sportId=1&date={date}&hydrate=linescore,team` + `/stats/leaders` with `statGroup` param

## ⚡ Pulse
Global live MLB play-by-play feed — scoring plays, home runs, RISP across all simultaneous games. Lazy-loaded on first nav. **Desktop/iPad Landscape (≥1025px):** CSS Grid 700px + 320px side rail with games module + news carousel. **≤767px:** side rail hidden, single column.

Ticker: live-only chips sorted by inning progress. Expanded chip (base diamond SVG) fires when `g.onFirst || g.onSecond || g.onThird`. Feed: newest-first, inserted at correct chronological position via `data-ts` attributes.

**`#pulseTopBar`** uses the shared `.section-bar` component (v4.4): eyebrow `⚡ MLB PULSE` + Lens/Radio toggles inline + a `⋯` overflow that opens a sheet with Sound, Yesterday-jump, and Theme. On mobile the launcher pills (`.ptb-launcher`) hide inline and surface only from the overflow sheet. Lens + Radio (`.ptb-toggle`) stay inline so their on/off state is always visible.

**`#playerCardOverlay` must stay top-level DOM** (sibling of `#focusOverlay`, `#collectionOverlay`, `#devToolsPanel`) — never nested inside `#pulse`. Sections create stacking contexts that trap z-index. Current z-index: 600.

Full HTML structure, feed item types, HR/RBI badge logic, scoring formulas, sound system, live polling strategy, video clip matching: `docs/pulse-feed.md`.
Story carousel (15 generators, rotation engine, all story types): `docs/story-carousel.md`.

## ◷ Yesterday Recap (overlay)
Triggered from the Pulse story carousel or the ticker. Implemented as an overlay (`src/sections/yesterday.js`), not a `<section>`. **`#ydSectionBar`** uses the shared `.section-bar` component (v4.4.8): eyebrow `◷ HIGHLIGHTS` (renamed from "YESTERDAY" in v4.4.10) + a date scrubber (`‹ DATE ›`) as the primary control + a back button. Body shows hero player carousel, heroes strip, per-game tile grid, and collected-cards strip.

## 📰 News
ESPN headlines, MLB / Team toggle (pill buttons). Defaults to MLB-wide (no team filter). Team pill shows `activeTeam.short`. Home card always shows team news regardless of toggle.

## ⚾ Live Game View
Triggered from Home card or matchup grid. Score header + count/runners + current matchup + linescore + play log (newest first, grouped by inning half) + box score (tabbed away/home) + game info. FINAL header and auto-refresh stop when `abstractGameState === 'Final'`. Auto-refresh every 5 minutes.

Source: `/game/{gamePk}/linescore` + `/game/{gamePk}/boxscore` + `/game/{gamePk}/playByPlay` (v1 path — do NOT use `feed/live` v1, it 404s)

## ⚙️ Settings
- **Select Team** — dropdown of all 30 teams; switching reloads all data, reapplies theme, resets caches
- **Color Theme** — overrides colours independently of active team; persists across team switches
- **Invert Colours** — swaps primary and secondary; works with theme override
- **🔔 Game Start Alerts** — push toggle; hidden on desktop via CSS `@media(min-width:1025px){ #pushRow { display:none !important } }`
- **📻 Live Game Radio** (`#radioRow`, `#radioToggle`) — calls `toggleRadio()`; auto-pairs to focused game's flagship station if in `APPROVED_RADIO_TEAM_IDS`, else Fox Sports. Also toggled from `#ptbRadioBtn`; both synced by `setRadioUI()`.
- **🛠️ Dev Tools** — `toggleDevTools()` opens `#devToolsPanel`. Includes 🔍 Radio Check sweep tool (moved from Settings in v3.43). See `docs/dev-tools.md` and `docs/radio-system.md`.
- Panel closes on click outside. All settings persist via `localStorage`.
