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
| Section loaders + Yesterday Recap | `src/sections/loaders.js`, `src/sections/yesterday.js` | (this file) |
| Dev Tools | `src/dev/tuning.js`, `src/dev/panels.js`, `src/dev/{youtube,video,news}-debug.js` | `docs/dev-tools.md` |
| Auth + push | `src/auth/oauth.js`, `src/auth/session.js`, `src/push/push.js` | `docs/pwa-push.md` |

The signatures listed in the rest of this file are organised by topic, not by module. The legacy `app.js` (preserved as `USE_BUNDLE=false` fallback) still inlines all of these — function names are identical so external onclick handlers and keyboard shortcuts work for both code paths.

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

| Function | Purpose |
|---|---|
| `loadRoster()` | Fetches 40-man roster; splits hitting/pitching/fielding, auto-selects first hitter |
| `fetchAllPlayerStats()` | Fetches season stats for all roster players in parallel; populates `statsCache` for Leaders panel |
| `loadLeaders()` | Sorts and renders team leader list from statsCache |
| `switchRosterTab(tab, btn)` | Switches roster tab, auto-selects first player of new tab |
| `selectPlayer(id, type)` | Looks up full player object from rosterData, updates card title, fetches and renders season stats |
| `renderPlayerStats(s, group)` | Renders stat grid with player position subtitle. 4-col for hitting/pitching, 3-col for fielding. |
| `selectLeaderPill(group, stat, btn)` | Sets leader stat select + active pill, calls `loadLeaders()` |

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
| `setRadioUI(on, pick)` | Updates `#radioToggle` + `#radioStatusText`. Also syncs `#ptbRadioBtn`. |
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
| `getYdActiveCache()` | Returns `ydDisplayCache` when non-null (date navigation active), otherwise `yesterdayCache`. |
| `loadYdForDate(dateStr)` | Async — fetches schedule + boxscore + playByPlay for `dateStr`. Used by both `loadYesterdayCache()` and `ydChangeDate()`. |
| `ydChangeDate(dir)` | Increments/decrements `ydDateOffset`. Guards: blocks today/future and >365 days back. Calls `loadYdForDate()` into `ydDisplayCache`. |

## Formatting Utilities

| Function | Purpose |
|---|---|
| `fmt(v, d)` | Formats a numeric stat to `d` decimal places (default 3); returns `—` for null/empty |
| `fmtRate(v, d)` | Like `fmt` but strips leading zero for values 0–1 (e.g. `.312` not `0.312`). Use for AVG, OBP, OPS, FPCT. |
| `forceHttps(url)` | Replaces `http:` with `https:`. Applied to all news image URLs to prevent mixed-content warnings. |
