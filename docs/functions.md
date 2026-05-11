# MLB Tracker — Key Functions Reference

Functions are split across ~30 ES6 modules under `src/` (full file map: `docs/module-graph.md`). The brief locator below points each cluster to its module; per-subsystem deep-dives have full signatures + behavior.

| Subsystem | Module | Deep-dive |
|---|---|---|
| Pulse polling, video clips, HR/RBI cards | `src/pulse/poll.js`, `src/data/clips.js`, `src/cards/playerCard.js` | `docs/pulse-feed.md` |
| Story carousel + generators | `src/carousel/rotation.js`, `src/carousel/generators.js` | `docs/story-carousel.md` |
| Focus Mode | `src/focus/mode.js` | `docs/focus-mode.md` |
| Card collection + sync | `src/collection/book.js`, `src/collection/sync.js` | `docs/card-collection.md` |
| Radio | `src/radio/stations.js`, `src/radio/engine.js`, `src/radio/check.js` | `docs/radio-system.md` |
| Demo Mode | `src/demo/mode.js` | `docs/demo-mode.md` |
| Theme + UI primitives | `src/ui/theme.js`, `src/ui/sound.js`, `src/ui/overlays.js`, `src/ui/lens.js`, `src/ui/wakelock.js` | `docs/css-variables.md` |
| Section loaders + Yesterday Recap | `src/sections/{home,schedule,standings,news,league,live,yesterday}.js` + `src/sections/stats/{leaders,team,roster,player,compare,_shared}.js` | (this file) |
| Dev Tools | `src/dev/tuning.js`, `src/dev/panels.js`, `src/dev/{youtube,video,news}-debug.js` | `docs/dev-tools.md` |
| Auth + push | `src/auth/oauth.js`, `src/auth/session.js`, `src/push/push.js` | `docs/pwa-push.md` |

The signatures listed in the rest of this file are organised by topic, not by module.

## Theme & CSS

| Function | Purpose |
|---|---|
| `applyPulseMLBTheme()` | Sets `--p-dark`, `--p-card`, `--p-card2`, `--p-border`, `--p-accent*`, `--p-text`, `--p-muted`, `--p-scoring/hr/status-*` globals from active `PULSE_SCHEME` entry. `#pulse`/`#yesterday` CSS blocks remap them to `--dark`/`--card` etc. via `var(--p-*)` scoping. Also sets `--dark` globally for body background. Respects `devColorLocked`. |
| `setPulseColorScheme(scheme)` | Sets `pulseColorScheme`, persists to `localStorage('mlb_pulse_scheme')`, calls `applyPulseMLBTheme()` + `updatePulseToggle()`. |
| `updatePulseToggle()` | Updates `#ptbSchemeBtn` (toggles `.on` CSS class) and `#ptbSchemeIcon` text (☀️ for light, 🌙 for dark). Settings slide-toggle elements removed in v3.26. |
| `applyTeamTheme(team)` | Sets 9 CSS vars, persists to `localStorage.mlb_theme_vars`, updates logo, page title, theme-color meta, `.team-chip` text. In `themeScope==='nav'` mode, scopes team vars to `<header>` only. |
| `switchThemeScope(val)` | Sets `themeScope` ('full'\|'nav'), persists, calls `applyTeamTheme(activeTeam)`. |
| `hueOf(hex)` | Extracts HSL hue (0–360) from a hex colour string |
| `hslHex(h, s, l)` | Converts HSL values to hex colour string |
| `relLuminance(hex)` | WCAG relative luminance of a hex colour |
| `contrastRatio(hexA, hexB)` | WCAG contrast ratio between two hex colours |
| `hslLighten(hex, targetL)` | Keep hue/sat, push L to targetL (0–1) |
| `pickAccent(secondaryHex, cardHex)` | Returns contrast-safe `--accent` value for a team |
| `pickHeaderText(primaryHex)` | Returns `#0a0f1e` or `#ffffff` for header text |
| `pickOppColor(oppPrimary, oppSecondary, myPrimary)` | Returns opp color most distinct from user's primary. RGB Euclidean distance threshold 60 — falls back to opp secondary, then keeps oppPrimary on graceful degrade. |
| `updateColorOverride(context, colorVar, value)` | Stores color picker change into `devColorOverrides[context][colorVar]`; if `devColorLocked`, immediately re-applies theme. |
| `captureCurrentTheme(context)` | Reads all nine CSS vars from `document.documentElement`, writes into `devColorOverrides[context]` + updates color picker inputs. |
| `toggleColorLock(enable)` | Sets `devColorLocked`; on enable captures both themes if not yet captured; calls `applyTeamTheme`/`applyPulseMLBTheme`. |

## Navigation & Team

| Function | Purpose |
|---|---|
| `showSection(id, btn)` | Switches sections; calls `closeLiveView()` first if live view is active |
| `switchTeam(teamId)` | Resets all state and reloads all data for new team |
| `capImgError(el, primary, secondary, letter)` | `onerror` handler — swaps broken logo img to fallback SVG circle |
| `teamCapImg(teamId, name, primary, secondary, cls)` | Returns `<img>` tag for team cap logo with fallback |
| `tcLookup(id)` | Returns `{ primary, abbr, name }` for a team ID. `abbr` maps to `t.short`. |
| `gameGradient(g)` | Returns inline style string for two-team colour gradient (away → #111827 → home). Used by `renderGameBig`. **Not** used by `renderNextGame` (builds its own layout-aware gradient). |

## Home Tab

| Function | Purpose |
|---|---|
| `loadTodayGame()` | Left home card — fetches ±7 day window on cold load for series record |
| `getSeriesInfo(g)` | Returns series string e.g. `"Game 2 of 3 · Mets lead 1-0"`. API desc first, scheduleData fallback |
| `renderNextGame(g, label)` | Renders the left home card HTML |
| `loadNextGame()` | Right home card — finds and renders series after the current one |
| `loadHomeYoutubeWidget()` | Builds team-colored YouTube header, calls `loadMediaFeed(uc)`; replaced old `loadMedia()` when Media tab was folded into Home |
| `loadMediaFeed(uc)` | Fetches YouTube channel RSS via `/api/proxy-youtube`, populates `mediaVideos[]`, auto-selects first video |

## Schedule Tab

| Function | Purpose |
|---|---|
| `loadSchedule()` | Fetches full season, sets `scheduleLoaded=true`, renders calendar |
| `renderCalendar()` | Draws monthly calendar grid. Uses `gamesByDate` (array per date) to support doubleheaders. PPD/Cancelled/Suspended show grey `PPD` badge. |
| `changeMonth(dir)` | Navigates calendar month, calls `renderCalendar` |
| `selectCalGame(gamePk, evt)` | Finds all games on same local date, shows mobile tooltip, renders all games via `buildGameDetailPanel` into `#gameDetail`. |
| `buildGameDetailPanel(g, gameNum)` | Async — returns HTML for one game's detail panel. Handles PPD, Upcoming, Live, Final states. `gameNum` null = single game; 1 = first DH; 2+ = adds divider. |
| `buildBoxscore(players)` | Builds batting + pitching tables from boxscore players object. Used by historical and live views. |
| `switchBoxTab(bsId, side)` | Switches active tab in a boxscore panel |

## Standings Tab

| Function | Purpose |
|---|---|
| `loadStandings()` | Fetches standings, calls all four render functions |

## Stats Tab

The Stats Tab Revamp (Sprints 1+2, shipped under v4.7) added the Team Stats card, percentile / tier visualizations, vs-MLB / vs-team comparison chips, HOT/COLD badges, position-grouped Roster, and a 4-tab Player Stats card (Overview / Splits / Game Log / Advanced). Math + caching helpers live in `src/utils/stats-math.js`; UI wiring spread across `src/sections/stats/{leaders,team,roster,player,compare}.js` (split from a single `loaders.js` in v4.14). `fetchLeagueLeaders` lives in `src/data/leaders.js`.

### Section loaders

| Function | Purpose |
|---|---|
| `loadTeamStats()` | Fetches `/teams/{id}/stats?stats=season&group=hitting,pitching` + `/standings`; renders the full-width Team Stats card (HR / RBI / AVG / OPS / ERA / WHIP / K / SV tiles + record / last-10 / run-diff form line). Populates `state.teamStats` (also drives the Qualified threshold). |
| `loadRoster()` | Fetches 40-man roster; splits hitting/pitching/fielding, auto-selects first hitter |
| `fetchAllPlayerStats()` | Fetches season stats for all roster players in parallel; populates `state.statsCache`. Kicks off `fetchLastNForRoster()` for HOT/COLD badges. |
| `loadLeaders()` | Sorts and renders team leader list from `statsCache`. Honors `state.qualifiedOnly` (PA ≥ 3.1×G hitters, IP ≥ 1×G pitchers). Footer caption surfaces hidden count. Reads active pill from BOTH `#…LeaderPills` and `#…LeaderPillsExtras`. |
| `switchLeaderTab(tab, btn)` | Switches hitting/pitching leader tab. Collapses BOTH extras rows + resets every `+ more` pill on tab switch (avoids the v4.6.12 leak). |
| `selectLeaderPill(group, stat, btn)` | Clears `.active` across both rows for the group, marks `btn` active, re-runs `loadLeaders()`. Stat read from `dataset.stat`. |
| `toggleLeaderMore(group, btn)` | Expand / collapse the extras pill row for `'hitting'` / `'pitching'`. Toggles the `[hidden]` attr; relies on `.leader-pill-extras[hidden] { display:none !important }` to override the `.stat-tabs { display:flex }` cascade. |
| `toggleQualifiedOnly()` | Flips `state.qualifiedOnly`, persists to `localStorage('mlb_stats_qualified_only')`, re-renders the Leaders + the toggle UI. |

### Roster + Player Stats

| Function | Purpose |
|---|---|
| `switchRosterTab(tab, btn)` | Switches roster tab, auto-selects first player of new tab |
| `renderPlayerList()` | Roster card renderer. Buckets players by position (C / IF / OF / DH for hitting/fielding; SP / RP for pitching), emits sticky section headers, inline stat line, mini-bar vs team-best. Adds HOT/COLD badge for hitters. |
| `selectPlayer(id, type)` | Looks up the full player object from `rosterData`, updates card title, fetches season stats, kicks off `fetchGameLog()` in parallel (so the Overview sparkline and Game Log tab have data ready). |
| `renderPlayerStats(s, group)` | **Tab orchestrator** (Sprint 2). Caches `state.selectedPlayerStat`, syncs `#playerTabs` UI, emits all four tab panels (only the active one visible). Re-triggers lazy loaders for whichever non-Overview tab is active when the user changes player. Fielding view auto-collapses to Overview only. |
| `renderOverviewTab(s, group)` | Returns the Overview HTML: headshot · `Compare [VS MLB] [VS TEAM]` basis pills · hero panel (4rem stat + rank + percentile bar + Avg chip + tier pill + sparkline) · 4-col supporting grid (each box: stat / label / percentile bar / `MLB · #N` rank caption / Avg chip). |
| `switchPlayerStatsTab(tab, btn)` | Switches Player Stats tab. Persists to `localStorage('mlb_stats_tab')`. Fires the lazy renderer for the target tab if its cache is empty (`fetchGameLog` / `fetchStatSplits` / `fetchPitchArsenal`); class-flip if cached. |
| `switchVsBasis(basis)` | Toggles `state.vsLeagueBasis` between `'mlb'` and `'team'`. Re-renders Overview using the cached `state.statsCache` entry — no `/people` refetch. Persisted. |

### Per-tab data + renderers (Sprint 2)

| Function | Purpose |
|---|---|
| `fetchGameLog(playerId, group)` | Pulls `/people/{id}/stats?stats=gameLog&season=2026&group=…` into `state.gameLogCache`. 24h TTL. Returns the splits array. |
| `renderGameLogTab(playerId, group)` | Renders last-10 mini-cards (date · opp · line) + L10 summary strip into the Game Log panel. Cards: green/red border = W/L, purple inset = HR-game. Tap → `showLiveGame(gamePk)`. |
| `onGameLogResolved(playerId, group)` | After-fetch hook — repaints both the Overview hero (sparkline) and the Game Log panel for the active player when they're still selected. |
| `fetchStatSplits(playerId, group)` | Pulls `/people/{id}/stats?stats=statSplits&sitCodes=vl,vr,h,a,risp,e,r,lc&season=2026&group=…` into `state.statSplitsCache`. 24h TTL. |
| `renderSplitsTab(playerId, group)` | Renders the Splits panel: vs Handedness + Home/Away (left col) + Situations (right col). Each row: slash line + OPS-relative mini-bar + PA count. Pitcher splits show the "opponents'" hint banner. |
| `fetchPitchArsenal(playerId)` | Pulls `/people/{id}/stats?stats=pitchArsenal&season=2026` into `state.pitchArsenalCache`. 24h TTL. Reads pitch identity from `stat.type.code` / `stat.type.description` (v4.6.15 fix); normalizes `stat.percentage` from fraction → 0-100 scale. |
| `renderArsenalTab(playerId)` | Renders the donut + ranked list into the Advanced panel for pitchers. Donut + list stack vertically at all viewports (v4.6.16). |
| `fetchLastN(playerId, n=15)` | Pulls last-15-games hitting stats; cached in `state.lastNCache` with 12h TTL. |
| `fetchLastNForRoster()` | Batched `fetchLastN` for every hitter in the active roster; re-renders Leaders + Roster on completion. |
| `hotColdBadge(playerId)` | Returns the inline `🔥 HOT` / `❄ COLD` badge HTML when last-15 OPS Δ vs season OPS ≥ ±0.080; otherwise `''`. Hover tooltip shows both numbers. |
| `computeRollingSeries(games, group, heroKey, windowSize)` | Rolls AVG/OPS for hitters / ERA for pitchers across the gameLog. Emits points once 2+ games are in the window. |
| `renderSparklineSVG(series, opts)` | Returns an SVG sparkline (~320×56) with `currentColor` stroke + faint area fill, today-marker dot, trend label (▲/▼/▬ + magnitude). Pitching flips y-axis polarity (lower line = better). Tier-aware via `.hero-spark-wrap--{elite,good,bad}`. |

### Sprint 3 additions (Stats v3 — v4.6.18 → v4.6.25)

#### Statcast / Advanced (hitters)
| Function | Purpose |
|---|---|
| `fetchAdvancedHitting(playerId)` | Pulls `/people/{id}/stats?stats=sabermetrics` + `?stats=seasonAdvanced` in parallel and merges the stat blobs. 24h TTL on `state.advancedHittingCache`. (`expectedStatistics` is NOT used — Statcast metrics like xBA / xwOBA / exit velo / barrel rate live on Baseball Savant which we don't proxy; see v4.6.19 fix note.) |
| `loadAdvancedHittingForTab(playerId)` | Driver — fires `fetchAdvancedHitting` and `fetchHotColdZones` in parallel, then re-renders. |
| `renderAdvancedHittingTab(playerId)` | Hero trio (wOBA · BABIP · wRC+ or ISO) + supporting metric grid (ISO / wRAA / wRC / BB rate / K rate / P-PA / AB-HR / GO-AO / XBH / TB) + sabermetrics source-note + heat map section. |

#### Strike-zone heat map (hitters)
| Function | Purpose |
|---|---|
| `fetchHotColdZones(playerId)` | Pulls `/people/{id}/stats?stats=hotColdZones&group=hitting` into `state.hotColdCache`. 24h TTL. |
| `pickAvgZoneMatrix(splits)` | Picks the "Batting Avg" matrix from the multi-stat hot/cold payload; falls back to whatever's first when AVG isn't present. |
| `avgHeatColor(value)` | 3-stop heat scale lerp (red ≤.180 → yellow ~.250 → green ≥.380). Returns CSS rgba. |
| `renderHotZoneSection(playerId)` | 3x3 strike-zone CSS-grid heat map with axis labels, AVG values per cell, legend, catcher-view caption. Embedded inside the Advanced tab beneath the metrics grid. |

#### Career year-by-year
| Function | Purpose |
|---|---|
| `ensureCareerLoaded(playerId, group)` | Lazy-load entrypoint for the Career tab. Pulls `/people/{id}/stats?stats=yearByYear&group=hitting,pitching` into `state.careerCache`. 24h TTL. (Awards module dropped pre-prod in v4.6.21.) |
| `renderCareerTab(playerId, group)` | Renders year-by-year hitting + pitching tables (two-way players get both, primary group first). Sorted ascending (Baseball Reference convention). Sticky header, horizontal-scroll on narrow viewports, accent-colored rate cells. |

#### Mobile polish helpers (v4.9)
| Function | Purpose |
|---|---|
| `installStatsQuickNav()` | Idempotent installer for the mobile-only sticky 4-chip quick-nav at the top of `#stats` (Team / Leaders / Roster / Player). Wires a delegated click handler that smooth-scrolls to the matching card and an IntersectionObserver (`rootMargin: -45%`) that lights the active chip as the user scrolls. Hidden via CSS at ≥481px. Called from main.js Stats dispatch. |
| `dismissCareerSwipeHint()` | One-shot dismissal of the `← Swipe to see more →` hint banner above the Career table on mobile. Persists via `localStorage.mlb_stats_career_hint_shown` so the hint stays gone across sessions. |

(Today's Leaders module — `loadTodaysLeaders` / `renderTodaysLeaders` / `switchTodaysLeadersTab` / `toggleTodaysLeadersExpanded` — was removed in v4.8.6 as redundant with the League → Stat Leaders card.)

#### Compare overlay (Sprint 3 Batch D)
| Function | Purpose |
|---|---|
| `openCompareOverlay()` | Opens the `#compareOverlay`. Pre-fills slot A with `state.selectedPlayer`, picks a default slot B from the active team's roster (skipping A). Sets `compareGroup` from the active roster tab. |
| `closeCompareOverlay()` | Closes the overlay; restores body scroll. |
| `setCompareSlot(slot, playerId)` | Updates `compareA` or `compareB` to the chosen roster player; re-renders. |
| `setCompareGroup(group)` | Toggles between hitting/pitching; repicks defaults from the new pool when current slots aren't in it. |
| `compareBoxesFor(group)` / `compareFmt(box, val)` / `compareStatFor(playerId, group)` | Stat catalog (mirrors the Player Stats Overview boxes), value formatter, and `state.statsCache` lookup helper used by `renderCompare`. |
| `renderCompare()` | Renders the full overlay body — group bar + two slot pickers + comparison row grid. Polarity-aware winner detection (lower-better for ERA / WHIP / BB-9 / counting losses). |

#### Team Stats helpers (also Sprint 3)
| Function | Purpose |
|---|---|
| `computeLast10RunDiff(schedPayload, teamId)` | Aggregates run differential from the active team's last 10 final games. Pulled from a `/schedule?hydrate=linescore` window fetched in parallel inside `loadTeamStats`. Replaces the standings-aggregate runDifferential reading on the Last-10 form line (v4.6.23 fix). |

### Math helpers (`src/utils/stats-math.js`)

| Function | Purpose |
|---|---|
| `fetchLeagueLeaders(group)` | TTL-cached `/stats/leaders` pulls keyed by `group + ':' + leaderCategory`. Stored on `state.leagueLeaders`. |
| `leaderEntry(group, statKey)` | Returns the `LEADER_CATS_FOR_PERCENTILE` entry (`{ leaderCategory, decimals, lowerIsBetter }`) for a stat key, or `null`. |
| `computePercentile(group, statKey, raw)` | Binary-search rank → `{ percentile (0–99), rank, total, outsideTop }` against the cached leaderboard. Polarity-aware via `lowerIsBetter`. `outsideTop=true` when the player's value never beats nor ties any entry — caller (`renderOverviewTab`) skips the rank caption + bar in that case so `#100 of 100` doesn't render misleadingly (v4.8.11). |
| `tierFromPercentile(p)` | `'elite'` ≥ 90, `'good'` 70–89, `'mid'` 30–69, `'bad'` < 30. |
| `pctBar(p)` | Returns `<div class="pct-bar"><i style="width:N%"></i></div>` HTML — the thin colored bar beneath each stat box. |
| `rankCaption(rank, total)` | Returns `<div class="pct-rank">MLB · #N</div>` HTML. |
| `avgChip(playerVal, basisVal, decimals, lowerIsBetter)` | Returns `<span class="delta-chip avg-chip pos|neg">Avg: X</span>` — basis average shown directly, color-coded by polarity (green = player beats basis, red = worse). Replaced `+/−Δ` rendering in v4.6.12. |
| `leagueAverage(group, statKey)` | Mean across the league-leaders cache for the requested stat. |
| `teamAverage(group, statKey)` | Mean across `state.statsCache[group]` for the requested stat. |

## News Tab

| Function | Purpose |
|---|---|
| `loadNews()` | Fetches headlines from active source; filters to team news when `state.newsFeedMode === 'team'`; populates `#newsFeed`. |
| `switchNewsFeed(mode)` | Sets `state.newsFeedMode` ('mlb' or 'team'), syncs `#newsTeamBtn` `.on` class + knob position, shows/hides `#newsSourcePills` (visible in mlb mode only), calls `loadNews()`. |
| `toggleNewsTeamLens()` | Toggles between `'mlb'` and `'team'` modes by calling `switchNewsFeed`. Exposed on `window` via main.js bridge. |
| `selectNewsSource(source, btn)` | Sets active news source pill, calls `loadNews()`. |

## Around the League Tab

| Function | Purpose |
|---|---|
| `loadLeagueView()` | Orchestrates all Around the League loads |
| `loadLeagueMatchups()` | All-team schedule grid for selected day (offset -1/0/1); fades via opacity to avoid layout jump |
| `switchMatchupDay(offset, btn)` | Sets `leagueMatchupOffset`, updates active pill + `#matchupDayLabel`, calls `loadLeagueMatchups()` |
| `loadLeagueLeaders()` | Fetches `/stats/leaders`, maps by index to LEAGUE_*_STATS arrays |

## Live Game View

| Function | Purpose |
|---|---|
| `showLiveGame(gamePk)` | Hides main, shows live view, starts auto-refresh |
| `fetchLiveGame()` | Polls linescore + boxscore + `/schedule?gamePk=` (`Promise.all`); shows FINAL or LIVE badge. Calls `fetchPlayByPlay()` on each refresh. |
| `fetchPlayByPlay()` | Fetches `/game/{gamePk}/playByPlay`; renders at-bat log grouped by inning half into `#livePlayByPlay`. Silent no-op on error. |
| `closeLiveView()` | Clears refresh interval, hides live view, restores main |

## Pulse Feed

| Function | Purpose |
|---|---|
| `initLeaguePulse()` | Pulse entry point — calls `initReal()` directly |
| `initReal()` | Hides mock bar, loads roster + caches, calls `pollLeaguePulse()`, sets 15s poll interval |
| `pollLeaguePulse()` | Fetches schedule, updates `gameStates`, fires game events. Runs `Promise.all(pollGamePlays)`. Sorts feed on first poll. |
| `pollGamePlays(gamePk)` | Timestamps stale check → if changed, fetches `/playByPlay`, uses `isHistory` flag to suppress alerts/sounds for pre-existing plays |
| `renderTicker()` | Sorts `gameStates` and rebuilds sticky ticker HTML; expanded chip with base diamond SVG when any runner on |
| `updateHeader()` | No-op stub — call sites retained in poll loops but body is empty |
| `baseDiamondSvg(on1,on2,on3)` | Returns 28×24px inline SVG diamond; occupied bases lit amber with glow |
| `startCountdown(targetMs)` | 30s interval updating `#heroCountdown` with "First pitch in Xm" / "Starting now" |
| `toggleGame(gamePk)` | Adds/removes gamePk from `enabledGames`, applies `feed-hidden` to DOM items |
| `addFeedItem(gamePk, data)` | Inserts item into `feedItems` array and DOM in correct newest-first position via `data-ts` |
| `buildFeedEl(item)` | Builds DOM element for a feed item — status-change or play items |
| `updateFeedEmpty()` | Checks for visible feed items; calls `renderEmptyState()` if none. Controls `#ptbYestBtn` visibility. `hideWhenEmpty` array: `['gameTicker','sideRailNews','sideRailGames','myTeamLensBtn']`. |
| `renderEmptyState()` | Renders hype block + hero upcoming-game card + 2-col grid, or plain placeholder if no upcoming games |
| `fetchBoxscore(gamePk)` | Async cache helper — returns `boxscoreCache[gamePk]` or fetches `/game/{pk}/boxscore`. Returns `null` on error. |
| `resolvePlayerCardData(...)` | Async — resolves stats, jersey number, position for HR player card. Returns plain data object. |
| `showPlayerCard(...)` | Shows HR player card overlay. Awaits `resolvePlayerCardData()`, renders via `window.PulseCard.render()`. Auto-dismisses after 5.5s. |
| `dismissPlayerCard()` | Adds `.closing` animation, hides overlay after 280ms. Shared by HR and RBI cards. |
| `getHRBadge(rbi, halfInning, inning, aScore, hScore)` | Returns dynamic badge label. Priority: WALK-OFF GRAND SLAM → WALK-OFF HR → GRAND SLAM → GO-AHEAD HR → 💥 HOME RUN. |
| `calcRBICardScore(rbi, event, aScore, hScore, inning, halfInning)` | Returns weighted importance score for non-HR scoring play. Score ≥ `devTuning.rbiThreshold` triggers `showRBICard`. |
| `getRBIBadge(rbi, event, halfInning, inning, deficitBefore, marginAfter)` | Returns dynamic badge label for RBI card. Priority: WALK-OFF → GO-AHEAD → TIES IT → N-RUN → RBI EVENT → RBI. |
| `showRBICard(...)` | Shows key RBI card overlay (reuses `#playerCardOverlay`). 90s per-game cooldown via `rbiCardCooldowns{}`. |
| `showAlert(opts)` | Creates and stacks a `position:fixed` toast; auto-dismisses after `opts.duration` ms. |
| `dismissAlert(el)` | Adds `.dismissing` class, removes element after 300ms transition |
| `toggleSoundPanel()` | Shows/hides `#soundPanel` overlay |
| `setSoundPref(key, val)` | Updates `soundSettings[key]`; master toggle applies `.master-off` to `#soundRows` |
| `playSound(type)` | Checks `soundSettings.master && soundSettings[type]`, calls appropriate `playXxxSound()` |
| `_makeCtx()` / `_closeCtx()` / `_osc()` / `_ns()` | Web Audio primitives — shared by all Pulse sound functions |
| `updateInningStates()` | Called post-poll; placeholder for inning transition detection |
| `genInningRecapStories()` | One-shot end-of-inning recap cards. Primary path: processes `inningRecapsPending{}`. Fallback: `lastInningState` linescore transition. 19 templates, priorities 0–100. |
| `replayRBICard(itemIndex)` | Dev tool — scans `feedItems` for most recent non-HR scoring play, calls `showRBICard()` bypassing cooldown. |

## Video Clips

| Function | Purpose |
|---|---|
| `openVideoOverlay(url, title)` | Shows `#videoOverlay` (z-index 800) with given MP4 URL and title. |
| `closeVideoOverlay()` | Pauses and clears `#videoOverlayPlayer` src, hides `#videoOverlay`. |
| `devTestVideoClip()` | Dev tool — opens video overlay: `lastVideoClip` → `yesterdayContentCache` → fetch yesterday's first game. |
| `pollPendingVideoClips()` | Background poll (every 30s). Scans `feedItems` for unpatched HR/scoring plays. Fetches `/game/{pk}/content` (cached 5min, darkroom clips excluded). 2-tier player_id match: scoring-tagged clips → broadcast clips. ABS challenge clips excluded. On match: sets `lastVideoClip`, calls `patchFeedItemWithClip`. |
| `patchFeedItemWithClip(feedItemTs, gamePk, clip)` | Finds feed item DOM node via `data-ts` + `data-gamepk`, appends thumbnail + ▶ overlay. Guards double-patch via `el.dataset.clipPatched`. |

## At-Bat Focus Mode

| Function | Purpose |
|---|---|
| `calcFocusScore(g)` | Returns numeric tension score. Formula: closeness (0–60) + situation bonus + count bonus × inning multiplier (0.6→2.0). |
| `selectFocusGame()` | Evaluates all live games via `calcFocusScore()`. If non-focused game scores ≥20pts higher, fires `showFocusAlert()`. Auto-picks on first call. Hooked into `pollLeaguePulse()`. |
| `setFocusGame(pk)` | Switches focus. Resets pitch sequence, player stats, alerts. Starts `pollFocusLinescore()` every 5s via `focusFastTimer`. |
| `setFocusGameManual(pk)` | User-initiated switch. Sets `focusIsManual=true` then calls `setFocusGame(pk)`. |
| `resetFocusAuto()` | Clears `focusIsManual`, re-scores games, calls `setFocusGame()` with highest scorer. |
| `pollFocusLinescore()` | Fetches `/game/{pk}/linescore` (~5KB). Updates `focusState`. Calls `pollFocusRich()`, then renders both card and overlay. |
| `pollFocusRich()` | Fetches `/api/v1.1/game/{pk}/feed/live` GUMBO (~500KB) unconditionally every 5s. Populates `focusPitchSequence[]`. Detects new at-bat via `atBatIndex` change. Skipped in `demoMode`. |
| `fetchFocusPlayerStats(batterId, pitcherId)` | Session-cached — checks `focusStatsCache` before fetching. Skipped in `demoMode`. |
| `renderFocusCard()` | Injects `window.FocusCard.renderCard(focusState)` into `#focusCard`. |
| `renderFocusOverlay()` | Calls `window.FocusCard.renderOverlay({...focusState, pitchSequence, allLiveGames})` into `#focusOverlayCard`. |
| `renderFocusMiniBar()` | Renders score strip + optional second row (game switcher) into `#focusMiniBar`. |
| `openFocusOverlay()` | Sets `focusOverlayOpen=true`, shows `#focusOverlay`, calls `renderFocusOverlay()`. |
| `closeFocusOverlay()` | Sets `focusOverlayOpen=false`, hides `#focusOverlay`. |
| `showFocusAlert(pk, reason)` | Fires soft-alert banner in `#focusAlertStack`. 90s cooldown. Auto-dismisses after 8s. |
| `dismissFocusAlert()` | Clears focus alert. Called on manual dismiss, `setFocusGame()`, and overlay open. |

## Card Collection

| Function | Purpose |
|---|---|
| `loadCollection()` | Parses `mlb_card_collection` from localStorage. Returns `{}` on parse error. |
| `saveCollection(obj)` | JSON.stringify + localStorage.setItem for `mlb_card_collection`. |
| `getCardTier(badge, eventType, rbi)` | Returns tier string from badge text + event type. |
| `tierRank(t)` | Returns integer 1–4: legendary=4, epic=3, rare=2, common=1. |
| `collectCard(data, force)` | Main collection entry. Sets `lastCollectionResult` before any guard. `force=true` bypasses `demoMode` guard. |
| `showCollectedToast(type, name, eventType, tier)` | 2s fixed pill: "🎴 New card", "⬆ Upgraded", or "✓ Already have". |
| `updateCollectionUI()` | Updates `#collectionCountLabel` + re-renders `#collectionRailModule`. |
| `openCollection()` | Sets `#collectionOverlay` to `display:flex`, calls `renderCollectionBook()`. |
| `closeCollection()` | Sets `#collectionOverlay` to `display:none`. |
| `renderCollectionBook()` | Builds sorted/filtered slots, fetches career stats, injects `window.CollectionCard.renderBook()` into `#collectionBook`. |
| `renderCollectionRailModule()` | Calls `window.CollectionCard.renderRailModule(totalCount)` into `#collectionRailModule`. |
| `flashCollectionRailMessage()` | Called by `dismissPlayerCard()`. Reads `lastCollectionResult`, renders tier-colored pill in rail; reverts after 4s. |
| `fetchCareerStats(playerId, position)` | Async — checks `collectionCareerStatsCache` first. Hitters: HR/AVG/RBI/OPS. Pitchers: ERA/WHIP/W/K. |
| `openCardFromCollection(idx)` | Looks up `collectionSlotsDisplay[idx]`, calls `showPlayerCard()` or `showRBICard()`. Maps `collectionCareerStatsCache` fields to MLB API names for `overrideStats`. |
| `filterCollection(f)` | Sets `collectionFilter`, resets `collectionPage=0`, calls `renderCollectionBook()`. |
| `sortCollection(s)` | Sets `collectionSort`, resets `collectionPage=0`, calls `renderCollectionBook()`. |
| `goCollectionPage(dir)` | Increments/decrements `collectionPage` (clamps). Calls `renderCollectionBook()`. |
| `generateTestCard()` | Dev tool — picks random player from roster + leader caches, calls `collectCard({...}, true)`. |

## Radio

| Function | Purpose |
|---|---|
| `pickRadioForFocus()` | Returns `{teamId, abbr, name, url, format}` for current focus game. Checks home then away, both gated on `APPROVED_RADIO_TEAM_IDS`. Falls through to `FALLBACK_RADIO` (Fox Sports). |
| `toggleRadio()` | Slide toggle entry — calls `stopRadio()` or `startRadio()`. |
| `startRadio()` | Calls `loadRadioStream(pickRadioForFocus())`. |
| `loadRadioStream(pick)` | Tears down prior `radioHls`. Routes to Hls.js / Safari native HLS / plain `<audio>`. |
| `stopRadio()` | Pauses audio, destroys `radioHls`, clears `radioCurrentTeamId`, calls `setRadioUI(false, null)`. |
| `handleRadioError(err)` | Console error + `alert()` + `setRadioUI(false, null)`. |
| `setRadioUI(on, pick)` | Updates `#radioToggle` + `#radioStatusText`. Also syncs `#ptbRadioBtn` dot. Sets `aria-checked` on the toggle button. |
| `updateRadioForFocus()` | Hooked into `setFocusGame(pk)`. Reloads stream if focus changes and radio is playing. |
| `openRadioCheck()` | Loads results+notes from localStorage, shows `#radioCheckOverlay`, closes Settings. |
| `closeRadioCheck()` | Hides overlay, calls `radioCheckStop()`. |
| `radioCheckEntries()` | Builds entry array — all `MLB_TEAM_RADIO` teams + fallback. |
| `renderRadioCheckList()` | Renders all entries into `#radioCheckList`. |
| `radioCheckPlay(key)` | Calls `loadRadioStream(...)` directly. Bypasses `APPROVED_RADIO_TEAM_IDS` gate. |
| `radioCheckStop()` | Clears playingKey; stops radio; re-renders list. |
| `radioCheckSet(key, val)` | Toggle: if already set to `val`, deletes it; else sets it. Prevents accidental lock-in. |
| `radioCheckSetNote(key, val)` | Sets/deletes note. No re-render (cursor stability). |
| `radioCheckReset()` | Clears both `radioCheckResults` and `radioCheckNotes` + saves + re-renders. |
| `radioCheckCopy()` | Builds categorised markdown; writes to clipboard. Falls back to `fallbackCopy()`. |
| `fallbackCopy(text)` | Hidden `<textarea>` + `execCommand('copy')` clipboard fallback. |

## Push Notifications

| Function | Purpose |
|---|---|
| `togglePush()` | Reads current push state, calls subscribe or unsubscribe, updates toggle UI |
| `subscribeToPush()` | Registers PushManager subscription, POSTs to `/api/subscribe`, saves `mlb_push` to localStorage |
| `unsubscribeFromPush()` | Unsubscribes PushManager, DELETEs from `/api/subscribe`, removes `mlb_push` |
| `urlBase64ToUint8Array(b64)` | Converts VAPID public key from URL-safe base64 to Uint8Array |
| `isDesktop()` | **Retained but uncalled (v2.57.11).** Desktop hide now CSS-only. |
| `updatePushRowVisibility()` | **Retained but uncalled (v2.57.11).** Superseded by CSS media query. |
| `togglePushOnDesktop()` | **Retained but uncalled (v2.57.11).** Dev Tools toggle removed. |

## Dev Tools

| Function | Purpose |
|---|---|
| `confirmDevToolsChanges()` | Reads all numeric Dev Tools inputs; calls `updateTuning()` for each; flashes "✓ Applied!" for 1.5s |
| `toggleDevTools()` | Shows/hides `#devToolsPanel`. On open, populates all tuning inputs. Uses `p.style.display !== 'block'` (not `=== 'none'`) — panel starts with CSS `display:none`, so `=== 'none'` would fail on first open. |
| `updateTuning(param, val)` | Generic handler for all `devTuning` fields. Restarts `storyRotateTimer` when `rotateMs` changes. |

## Yesterday Recap

| Function | Purpose |
|---|---|
| `openYesterdayRecap(offset?)` | Opens the Yesterday Recap overlay. Optional `offset` (default `-1`) sets the initial `ydDateOffset`; pass `0` to open directly at today. Next-button disabled state and data fetch both respect the initial offset. |
| `getYdActiveCache()` | Returns `ydDisplayCache` when non-null (date navigation active), otherwise `yesterdayCache`. |
| `loadYdForDate(dateStr)` | Async — fetches schedule + boxscore + playByPlay for `dateStr`. Used by both `loadYesterdayCache()` and `ydChangeDate()`. |
| `ydChangeDate(dir)` | Increments/decrements `ydDateOffset`. Guards: blocks future (offset > 0) and >365 days back. Today (offset 0) is reachable via `›`. Calls `loadYdForDate()` into `ydDisplayCache`. |

## Formatting Utilities

| Function | Purpose |
|---|---|
| `fmt(v, d)` | Formats a numeric stat to `d` decimal places (default 3); returns `—` for null/empty |
| `fmtRate(v, d)` | Like `fmt` but strips leading zero for values 0–1 (e.g. `.312` not `0.312`). Use for AVG, OBP, OPS, FPCT. |
| `forceHttps(url)` | Replaces `http:` with `https:`. Applied to all news image URLs to prevent mixed-content warnings. |
