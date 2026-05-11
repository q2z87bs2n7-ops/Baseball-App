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
Four-card layout (Stats Tab Revamp Sprints 1+2+3 shipped under v4.7; mobile-polish + Today's Leaders removal in v4.9):
**Team Stats** (top, full-width) → **Leaders | Roster | Player Stats** (three-column row).

Today's Leaders module was removed in v4.8.6 — it duplicated ~95% of the League → Stat Leaders card (same `state.leagueLeaders` source, near-identical category list).

A sticky 4-chip quick-nav (`#statsQuickNav` / `installStatsQuickNav()` in `src/sections/stats/player.js`) appears at the top of `#stats` on mobile only (≤480px, gated by media query). Tapping a chip smooth-scrolls to the matching card; an IntersectionObserver lights the active chip. Hidden at ≥481px so iPad/desktop layout is unchanged.

### Team Stats card (`#teamStats`, `loadTeamStats()`)
Full-width card showing team-wide hitting + pitching tiles (HR / RBI / AVG / OPS / ERA / WHIP / K / SV) + a record / last-10 / run-diff form line. Each tile shows the stat value alongside a `#N MLB` rank chip in `var(--accent)` (chip text uses `--accent` not `--primary` so dark-primary teams stay readable).

Source: `/teams/{id}/stats?stats=season&group=hitting,pitching` + `/standings` (record context).

### Leaders card
Roster leaders for the active team. Top of the card has a **Qualified toggle** (default ON, `state.qualifiedOnly`, persisted) that hides players below the threshold (PA ≥ 3.1×G hitters, IP ≥ 1×G pitchers); footer caption surfaces the hidden count. Stat selection by pill row — hitting (`AVG · HR · RBI · OPS · OBP · SLG · H · SB`) and pitching (`ERA · WHIP · K · W · L · SV · IP`) plus a dashed `+ more` pill at the end of each row that expands an extras row inline (BB, R, 2B, 3B, K, PA for hitting; K/9, BB/9, K/BB, BB, H, HR for pitching). `selectLeaderPill` clears `.active` across both rows; `loadLeaders` finds the active pill in either. `switchLeaderTab` collapses BOTH extras rows on tab switch (avoids the v4.6.12 bug where pitching extras leaked into the hitting tab — root cause: `[hidden]` shadowed by `.stat-tabs { display:flex }`, fixed by `.leader-pill-extras[hidden] { display:none !important }`). Hot/Cold inline badges next to hitter names where last-15 OPS Δ vs season OPS ≥ ±0.080 (🔥 HOT / ❄ COLD).

### Roster card (`#playerList`)
40-man roster with hitting/pitching/fielding tabs, grouped by position bucket: hitting/fielding into 🧤 Catchers / ⚾ Infielders / 🏃 Outfielders / 🦾 DH; pitching into 🎯 Starters / 🔥 Relievers (split by GS/G ratio when `state.statsCache.pitching` is populated). Sticky section headers with bucket label + count chip. Each row shows: name + HOT/COLD badge · `#22 · Right Field · .312 / 28 HR / .962 OPS` (hitting) or `· 3.81 ERA · 67 K · 1.18 WHIP` (pitching) + a thin mini-bar beneath showing the player vs the team-best (OPS for hitting, ERA inverted for pitching).

### Player Stats card (`#playerStats`) — 5 tabs
Tabs persist via `state.activeStatsTab` → `localStorage('mlb_stats_tab')`. `renderPlayerStats` is the orchestrator that emits all five panels (only the active one visible). Switching tabs is a class-flip — no `/people` refetch. Per-tab fetchers (Splits / Game Log / Advanced / Career) lazy-load on first visit and cache for 24h. Fielding view auto-collapses to Overview only.

`v4.6.23` adds a **qualification gate** on rank/percentile: rate stats (AVG / OBP / SLG / OPS / ERA / WHIP) suppress rank caption + percentile bar when the player is below threshold (PA ≥ 3.1×G hitters, IP ≥ 1×G pitchers); the Avg chip + value still render. Hero shows a dashed "Below qualification · rank not shown" pill. Counting stats (HR / RBI / K / SB / BB / R / 2B / 3B / H) always show rank.

The card title row also has a **⇄ Compare** trigger (v4.6.24) that opens the Compare overlay.

| Tab | What it shows |
|---|---|
| **Overview** | Headshot · two-pill `Compare [VS MLB] [VS TEAM]` basis toggle (default VS MLB; persisted) · full-width hero panel: 4rem display number + `#N of M Qualified Players` rank + 6px percentile bar + `★ Elite` pill + `Avg: X` chip + 7-day rolling sparkline · 4-col supporting grid where each box has stat / label / percentile bar / `MLB #N` rank caption / `Avg: X` chip. Tier coloring: hero panel always; supporting boxes only at extremes (≥ 90 or ≤ 10). Rank suppressed for `lowerIsBetter` counting stats (hitter K, pitcher BB/H/HR allowed) because `/stats/leaders` returns those leaderboards "most X first" regardless of polarity — the pool contains the worst players, so any below-pool value would spuriously resolve to #1 (v4.17.9). |
| **Splits** | Two-column layout — left col stacks `vs Handedness` (vs LHP / vs RHP) + `Home / Away`; right col shows `Situations` (RISP / Bases Empty / Runners On / Late & Close). Each row: split label + slash line `.AVG / .OBP / .SLG` + OPS-relative mini-bar + OPS value + PA count. Pitcher splits show "opponents' AVG/OBP/SLG" hint banner. Source: `/people/{id}/stats?stats=statSplits&sitCodes=vl,vr,h,a,risp,e,r,lc&season=2026&group=…`. |
| **Game Log** | Up to 10 mini-cards most-recent-first (date · opp `@ABC`/`vsXYZ` · line `3/4 · 2HR` or `5.2IP · 7K · 1ER`). Cards: green/red left-border = W/L, purple inset shadow = HR-game. Tap → opens `#liveView` for that gamePk. L10 summary strip below: AVG/HR/RBI/OPS or ERA/K/WHIP/IP, all client-side aggregated. Source: `/people/{id}/stats?stats=gameLog&season=2026&group=…`. |
| **Advanced** | **Pitchers** (Sprint 2): 140px SVG donut + ranked list from `/people/{id}/stats?stats=pitchArsenal&season=2026`. Each pitch type gets a deterministic color (FF=red, SI=orange, SL=yellow, CU=purple, CH=green, FC=pink, FS=teal, ST=gold, etc.); donut center shows the most-used pitch's pct and label. **Hitters** (Sprint 3): hero trio (wOBA · BABIP · wRC+) + supporting metric grid (ISO / wRAA / wRC / BB rate / K rate / P/PA / AB/HR / GO/AO / XBH / TB) from `/people/{id}/stats?stats=sabermetrics + seasonAdvanced`, **plus** a 3x3 strike-zone heat map (`?stats=hotColdZones`) showing batting AVG by zone with a red→yellow→green heat scale. Source-note disclaims that Statcast (xBA / xwOBA / exit velo / barrel rate) lives on Baseball Savant and isn't proxied here. |
| **Career** | Sprint 3. Year-by-year tables for hitting + pitching (two-way players get both, primary group first). Hitting cols: Year · Team · G · PA · AVG · HR · RBI · SB · OBP · SLG · OPS. Pitching cols: Year · Team · G · IP · W · L · ERA · WHIP · K · BB · SV. Sticky header row, horizontal-scroll on narrow viewports (min-width 560px). Source: `/people/{id}/stats?stats=yearByYear&group=hitting,pitching`. (Awards module dropped pre-prod in v4.6.21; the `/people/{id}/awards` endpoint is unused.) |

### Compare overlay (`#compareOverlay`)
Sprint 3 (Batch D, last shipped feature). Same-team head-to-head comparison launched from the **⇄ Compare** trigger pill on the Player Stats card. Two slot cards (headshot · name · jersey · position · roster dropdown) side-by-side; group toggle (⚾ Hitting / 🥎 Pitching) when both groups have entries. Each row of the comparison grid shows `[A value] · STAT LABEL · [B value]` with the winner cell highlighted green and polarity-aware (lower-better for ERA / WHIP / BB-9 / counting losses). Re-uses `state.statsCache` season stats — no extra fetches when both players are warm.

Cross-team compare deferred (would need a name-search picker + per-player season-stat fetches). Z-index 600.

### Stats v2 helpers (`src/utils/stats-math.js`)

| Helper | Purpose |
|---|---|
| `LEADER_CATS_FOR_PERCENTILE` | 27-stat catalog mapping internal stat keys → MLB API leader categories (with `decimals` and `lowerIsBetter` flags). |
| `fetchLeagueLeaders(group)` | TTL-cached league leader pulls keyed by `group + ':' + leaderCategory`. Stored in `state.leagueLeaders`. |
| `computePercentile(group, statKey, raw)` | Binary-search rank → 0–99 percentile against the cached leader board. Returns `{ percentile, rank, total, outsideTop }`. `outsideTop=true` when the player's value never beats nor ties any entry in the leader pool — the rank-fallback `arr.length` doesn't actually mean "tied for last", it means "below the leader pool entirely" (v4.8.11 — renderers skip the rank caption + bar when set so `#100 of 100` doesn't render misleadingly). |
| `tierFromPercentile(p)` | `'elite'` ≥ 90 / `'good'` 70–89 / `'mid'` 30–69 / `'bad'` < 30. |
| `pctBar(p)` / `rankCaption(rank, total)` | HTML fragments for the percentile bar + `MLB #N` caption used by the Overview grid + hero panel. |
| `avgChip(playerVal, basisVal, decimals, lowerIsBetter)` | `<span class="delta-chip avg-chip pos|neg">Avg: X</span>` — shows the basis average (league or team) directly, color-coded by polarity. Replaced the prior `deltaChip` `+/−Δ` rendering in v4.6.12. |
| `leagueAverage(group, statKey)` / `teamAverage(group, statKey)` | Mean of every entry in the leaders cache (league) or `state.statsCache` (team) for the requested stat. |

### Per-player caches (24h TTL unless noted)

`state.gameLogCache[playerId+':'+group]` · `state.statSplitsCache[playerId+':'+group]` · `state.pitchArsenalCache[playerId]` · `state.advancedHittingCache[playerId]` · `state.hotColdCache[playerId]` · `state.careerCache[playerId]` · `state.lastNCache[playerId]` (12h TTL — last-15 OPS for HOT/COLD).

Sources: `/teams/{id}/roster?rosterType=40Man` + `/people/{id}/stats` (season / gameLog / statSplits / pitchArsenal / lastXGames variants).

## 🌐 Around the League
Matchups: all MLB games, 3-per-row, day toggle (Yesterday/Today/Tomorrow), opacity fade on switch. Live games show inning. Clickable → live game view. ⚠️ **Leaders index mapping is fragile** — API doesn't guarantee response order matches `leaderCategories` order; re-test empirically after API changes.

Sources: `/schedule?sportId=1&date={date}&hydrate=linescore,team` + `/stats/leaders` with `statGroup` param

## ⚡ Pulse
Global live MLB play-by-play feed — scoring plays, home runs, RISP across all simultaneous games. Lazy-loaded on first nav. **Desktop/iPad Landscape (≥1025px):** CSS Grid 700px + 320px side rail with games module + news carousel. **≤767px:** side rail hidden, single column.

Ticker: live-only chips sorted by inning progress. Expanded chip (base diamond SVG) fires when `g.onFirst || g.onSecond || g.onThird`. Feed: newest-first, inserted at correct chronological position via `data-ts` attributes.

**`#pulseTopBar`** uses the shared `.section-bar` component (v4.4): eyebrow `⚡ MLB PULSE` + Lens/Radio toggles inline + a `⋯` overflow that opens `#pulseOverflowSheet` with Yesterday, Sound, and Theme. A second `⋯` launcher opens `#pulseShortcuts` with Demo Mode, Cards, and Sound. On mobile the launcher pills (`.ptb-launcher`) hide inline and surface only from the overflow sheet. Lens + Radio (`.ptb-toggle`) stay inline so their on/off state is always visible.

**`#playerCardOverlay` must stay top-level DOM** (sibling of `#focusOverlay`, `#collectionOverlay`, `#devToolsPanel`) — never nested inside `#pulse`. Sections create stacking contexts that trap z-index. Current z-index: 600.

Full HTML structure, feed item types, HR/RBI badge logic, scoring formulas, sound system, live polling strategy, video clip matching: `docs/pulse-feed.md`.
Story carousel (15 generators, rotation engine, all story types): `docs/story-carousel.md`.

## ◷ Yesterday Recap (overlay)
Triggered from the Pulse story carousel or the ticker. Implemented as an overlay (`src/sections/yesterday.js`), not a `<section>`. **`#ydSectionBar`** uses the shared `.section-bar` component (v4.4.8): eyebrow `◷ HIGHLIGHTS` (renamed from "YESTERDAY" in v4.4.10) + a date scrubber (`‹ DATE ›`) as the primary control + a back button. Body shows hero player carousel, heroes strip, per-game tile grid, and collected-cards strip.

## 📰 News
ESPN headlines with a **MY TEAM lens toggle** (`#newsTeamBtn`) using the `ptb-lens ptb-toggle` CSS pattern (matching the Pulse MY TEAM lens). Toggle calls `toggleNewsTeamLens()` → `switchNewsFeed(mode)`. Source selector pills (`#newsSourcePills`) visible only in MLB-wide mode; "MLB.com" is the default source pill label. Defaults to MLB-wide (no team filter). Home card always shows team news regardless of toggle.

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
- **Toggle element type (v4.6.4):** Radio, Invert, and Push toggles are `<button role="switch" aria-checked="false">` (converted from `<div role="checkbox">` for accessibility). `aria-checked` is reactively updated by `setRadioUI()`, `toggleInvert()`, and the push subscribe/unsubscribe functions.
