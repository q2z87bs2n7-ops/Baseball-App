# Module Graph

Final layout of the bundled JS introduced over v3.39, completed in v3.40.0,
and decommissioned-from-fallback in v3.42.0. Source-of-truth lives under `src/`;
`build.mjs` runs esbuild → `dist/app.bundle.js` (IIFE, ~620KB). `index.html`
loads the bundle via a static `<script defer>`. Emergency revert path: the
`pre-bundle-cleanup-v3.41` git tag still has the legacy `app.js` + `USE_BUNDLE`
flag wiring in place.

In v4.14 (the loaders.js split) `package.json` `"version"` became the single
source of truth for the user-facing version, the cache-bust query strings,
and the SW `CACHE` constant. `build.mjs` reads `package.json` and injects
`__APP_VERSION__` via esbuild's `define` for the JS bundle (consumed by
`src/main.js` for the settings panel slot and by `src/dev/panels.js` for
the diagnostic snapshot). For `sw.js` and `index.html`, `build.mjs` does a
post-build regex replacement (the `define` approach failed for sw.js because
the source file is also the build output — after the first substitution
the identifier was gone and subsequent builds were no-ops; v4.14.0 fix).
Bumping any of those manually is no longer required.

---

## File map

```
src/
  main.js              ~680 lines  — Boot IIFE, initLeaguePulse + initReal
                                     callback wiring, top-level event listeners,
                                     the window-global bridge that re-exposes
                                     ~95 functions to HTML inline handlers.
                                     Plus a few small helpers that don't yet
                                     have a natural home (fetchBoxscore,
                                     localDateStr, capImgError, teamCapImg,
                                     pruneStaleGames, refreshDebugPanel,
                                     showSection, getSeriesInfo, renderNextGame).
  state.js                          — Single mutable hot-state container.
                                     ALL importers receive a live binding;
                                     never copy state into a module-local var.

  config/
    constants.js                    — SEASON, WC_SPOTS, MLB_BASE,
                                     MLB_BASE_V1_1, API_BASE, TEAMS,
                                     MLB_THEME, NEWS_SOURCE_LABELS/ICONS,
                                     TIMING.
    podcasts.js                     — TEAM_PODCASTS (curated Apple
                                     Podcasts collectionIds keyed by MLB
                                     team id) + fallbackPodcastTerm().
                                     Consumed by sections/home.js.

  devtools-feed/
    devLog.js                       — console wrap + ring buffer + devTrace
                                     + window error/rejection listeners.
                                     SIDE EFFECTS ON IMPORT — must import first.
    devNet.js                       — fetch wrap + devNetLog ring buffer.
                                     SIDE EFFECTS ON IMPORT.

  utils/
    format.js                       — tcLookup, fmt, fmtRate, fmtDateTime,
                                     fmtNewsDate, pickOppColor, etDateStr,
                                     etDatePlus, etHour (all pure).
    news.js                         — NEWS_IMAGE_HOSTS allowlist +
                                     isSafeNewsImage + escapeNewsHtml,
                                     forceHttps, decodeNewsHtml (HTML helpers
                                     hoisted from sections/loaders.js in v4.14).
    boxscore.js                     — buildBoxscore (batting + pitching tables
                                     for Schedule + Live; hoisted in v4.14).
    stats-math.js                   — Stats Tab v2 (Sprints 1+2):
                                     LEADER_CATS_FOR_PERCENTILE catalog,
                                     computePercentile, tierFromPercentile,
                                     pctBar, rankCaption, avgChip, leagueAverage,
                                     teamAverage, leaderEntry. Backs Team Stats /
                                     Leaders percentile bars + Player Stats
                                     Overview hero panel + grid Avg-chip
                                     rendering. (fetchLeagueLeaders moved to
                                     src/data/leaders.js in v4.14.)

  data/
    clips.js                        — pickPlayback, pickHeroImage, fetchGameContent,
                                     patchFeedItemWithClip, pollPendingVideoClips,
                                     devTestVideoClip — single source of truth
                                     for video clip discovery + DOM patching.
    leaders.js                      — fetchLeagueLeaders (TTL-cached league-wide
                                     leader rankings in state.leagueLeaders;
                                     used by stats/leaders.js + stats/player.js
                                     percentile chips + sections/league.js).
                                     Hoisted from loaders.js in v4.14.

  ui/
    overlays.js                     — openVideoOverlay, closeVideoOverlay,
                                     dismissPlayerCard, closeSignInCTA.
    theme.js                        — applyTeamTheme, applyPulseMLBTheme,
                                     setPulseColorScheme, switchTeam,
                                     switchTheme, switchThemeScope,
                                     toggleSettings, toggleInvert,
                                     buildThemeSelect, buildTeamSelect.
    sound.js                        — Web Audio synthesis: 8 per-event sounds
                                     + soundSettings (hydrates on import).
    wakelock.js                     — Screen Wake Lock API wrapper.
    lens.js                         — myTeamGamePks, applyMyTeamLens,
                                     toggleMyTeamLens, toggleGame.

  feed/
    render.js                       — renderTicker, renderSideRailGames,
                                     addFeedItem, buildFeedEl, renderFeed,
                                     renderEmptyState, updateFeedEmpty,
                                     isPostSlate, isIntermission,
                                     hypeHeadline, baseDiamondSvg,
                                     startCountdown, showAlert, dismissAlert,
                                     fetchTomorrowPreview.

  pulse/
    poll.js                         — pollLeaguePulse, pollGamePlays,
                                     getEffectiveDate. Hot poller — diffs
                                     /schedule into state.gameStates and
                                     fires HR/RBI cards on per-game playByPlay.
    news-carousel.js                — loadPulseNews, nextNewsCard, prevNewsCard,
                                     renderPulseNewsCard. Rotating headline
                                     carousel in Pulse side rail.

  carousel/
    rotation.js                     — buildStoryPool, rotateStory, showStoryCard,
                                     renderStoryCard, updateStoryDots,
                                     prevStory, nextStory, onStoryVisibilityChange.
    generators.js                   — All gen* story generators (~22 of them);
                                     loadOnThisDayCache, loadYesterdayCache,
                                     loadTransactionsCache, loadHighLowCache,
                                     loadDailyLeaders, loadProbablePitcherStats,
                                     loadLiveWPCache, loadYdForDate.

  focus/
    mode.js                         — calcFocusScore, selectFocusGame,
                                     setFocusGame, setFocusGameManual,
                                     resetFocusAuto, pollFocusLinescore,
                                     renderFocusCard, renderFocusMiniBar,
                                     openFocusOverlay, closeFocusOverlay,
                                     dismissFocusAlert.

  overlay/
    scorecard.js                    — Old-school scoring-book overlay
                                     (openScorecardOverlay, closeScorecardOverlay).
                                     Fetches feed/live (v1.1): line-score header,
                                     diamond-per-PA with fielder notation
                                     (6-3/F8/K/ꓘ), traced base paths, in-cell
                                     ball-strike + pitch count, inning-ending
                                     diagonals, advancement reason codes
                                     (SB/WP/PB/BK/E), runner-out markers
                                     (CS/PO), Manfred-runner (MR) handling,
                                     batting-around stacking, PH/PR sub tags,
                                     and a full pitcher table with W/L/S.
                                     Runner tracking is base-keyed (not
                                     id-keyed) so pinch-runners inherit the
                                     base. Self-refreshes on LIVE_REFRESH_MS
                                     while a live game is open.

  cards/
    playerCard.js                   — resolvePlayerCardData, showPlayerCard,
                                     showRBICard, getHRBadge, getRBIBadge,
                                     calcRBICardScore, replayHRCard, replayRBICard.

  collection/
    book.js                         — Tier system + storage + book overlay
                                     (loadCollection, saveCollection, collectCard,
                                     fetchCareerStats, openCollection,
                                     closeCollection, filterCollection,
                                     sortCollection, goCollectionPage,
                                     renderCollectionBook, openCardFromCollection,
                                     openCardFromKey, updateCollectionUI,
                                     flashCollectionRailMessage, generateTestCard,
                                     resetCollection, tierRank).
    sync.js                         — Cross-device card sync to Upstash Redis
                                     (syncCollection, mergeCollectionOnSignIn,
                                     mergeCollectionSlots, startSyncInterval).

  radio/
    stations.js                     — MLB_TEAM_RADIO (30 stations),
                                     FALLBACK_RADIO, APPROVED_RADIO_TEAM_IDS,
                                     RADIO_CHECK_DEFAULT_NOTES.
    engine.js                       — pickRadioForFocus, toggleRadio,
                                     loadRadioStream, stopRadio, stopAllMedia,
                                     updateRadioForFocus, getCurrentTeamId.
    check.js                        — Radio Check sweep tool (open/close,
                                     play/stop/try-custom, set/setNote,
                                     reset, copy).

  push/
    push.js                         — VAPID_PUBLIC_KEY, urlBase64ToUint8Array,
                                     subscribeToPush, unsubscribeFromPush,
                                     togglePush.

  auth/
    oauth.js                        — signInWithGitHub, signInWithEmail.
    session.js                      — signOut, updateSyncUI, showSignInCTA.

  nav/                              — Mobile nav behavioral helpers (v4.4,
                                     Direction A). All behaviors are mobile-only,
                                     gated by matchMedia('(max-width: 480px)').
                                     CSS in `@media (max-width: 480px)` block of
                                     styles.css.
    behavior.js                     — installHideOnScroll: scroll-down >40px adds
                                     'nav-hidden' (translateY 110%); any negative
                                     delta restores within 220ms (iOS cubic-bezier).
                                     captureScroll/restoreScroll: Map<sectionId,
                                     scrollY> per-section memory, instant restore.
                                     installHashRouter + navTo + syncHash: all nav
                                     clicks set location.hash; back/forward/refresh/
                                     deep links all route correctly; falls back to
                                     'pulse'. setNavDot/clearNavDot/refreshNavDots/
                                     installNavDotsRefresh: green pulse (.nav-dot.live)
                                     on Schedule when team is live; orange
                                     (.nav-dot.fresh) for new-card / breaking-news;
                                     refreshed on 30s interval. attachLongPress +
                                     installNavLongPress: 500ms hold, vibrate(8).
    sheet.js                        — openMoreSheet/closeMoreSheet/toggleMoreSheet
                                     (mobile More sheet — News/Standings/Stats tabs
                                     hidden from bottom nav, surface here via
                                     .more-sheet + .more-sheet-backdrop sibling of
                                     <nav>), plus #pulseTopBar overflow sheet
                                     open/close (.ptb-overflow, 26×26 squared;
                                     Sound/Yesterday-jump/Theme move here on mobile).
                                     #pulseTopBar and #ydSectionBar share the
                                     .section-bar component. Stat/boxscore tabs
                                     (.stat-tabs, .boxscore-tabs) horizontal-scroll
                                     with mask-image fade; active tab uses
                                     scrollIntoView({inline:'center'}) scoped to
                                     the tabs container, never the document.

  sections/                         — Per-section loaders. Split from a single
                                     loaders.js (~2,750 LOC) in v4.14 across
                                     7 sibling files + a 6-module stats/
                                     subtree. Each file owns its own private
                                     state (timers, calendar nav state, etc.)
                                     and per-module callback setter where
                                     main.js needs to inject helpers.
    home.js                         — loadTodayGame, loadNextGame,
                                     loadHomeYoutubeWidget, selectMediaVideo,
                                     clearHomeTimer + setHomeCallbacks
                                     (renderNextGame, teamCapImg).
    schedule.js                     — loadSchedule, changeMonth, selectCalGame,
                                     switchBoxTab, playHighlightVideo. Owns
                                     calMonth/calYear/selectedGamePk state.
                                     Local pickPlayback intentionally distinct
                                     from data/clips.js#pickPlayback (different
                                     return types).
    standings.js                    — loadStandings (also writes the Home
                                     page's Division Snapshot card). One
                                     /standings call hydrates 5 renderers.
    news.js                         — selectNewsSource, loadNews,
                                     switchNewsFeed, toggleNewsTeamLens.
                                     Exports mkEspnRow for League's news pane.
    league.js                       — loadLeagueView, loadLeagueMatchups,
                                     switchMatchupDay, switchLeagueLeaderTab,
                                     clearLeagueTimer + setLeagueCallbacks
                                     (teamCapImg). Reads state.leagueLeaders.
    live.js                         — showLiveGame, closeLiveView, fetchLiveGame
                                     (full-screen overlay; linescore + boxscore
                                     + matchup + play log; polls every
                                     TIMING.LIVE_REFRESH_MS).
    yesterday.js                    — Yesterday Recap overlay (open/close,
                                     date picker, hero player carousel,
                                     heroes strip, per-game tile grid,
                                     collected-cards strip).
    stats/
      _shared.js                    — HOT_COLD_THRESHOLD, HOT_COLD_TTL_MS;
                                     scrollTabIntoView (used by 3 tab
                                     switchers); hotColdBadge (used by
                                     leaders + roster). Avoids cycles
                                     between leaders/roster/player.
      leaders.js                    — selectLeaderPill, switchLeaderTab,
                                     loadLeaders, toggleLeaderMore,
                                     toggleQualifiedOnly. Exports
                                     isQualified for player.js.
      team.js                       — loadTeamStats (Team Stats strip + L10
                                     form line). Private: extractTeamStat,
                                     computeLast10RunDiff, extractTeamRecord,
                                     fetchTeamRanks, renderTeamStats.
      roster.js                     — loadRoster, switchRosterTab,
                                     renderPlayerList (exported for player.js
                                     circular). Private: fetchAllPlayerStats,
                                     fetchLastN, fetchLastNForRoster,
                                     rosterBucketKey/InlineStatFor/TeamBest.
      player.js                     — Player detail card (~1,230 LOC, the
                                     biggest module): selectPlayer,
                                     switchPlayerStatsTab, dismissCareerSwipeHint,
                                     installStatsQuickNav, switchVsBasis +
                                     all 6 tab renderers (overview / splits /
                                     gamelog / arsenal / advanced / career),
                                     sparkline SVG, hot-zone heat map,
                                     6 TTL caches.
      compare.js                    — openCompareOverlay, closeCompareOverlay,
                                     setCompareSlot, setCompareGroup
                                     (head-to-head player comparison overlay).

  demo/
    mode.js                         — toggleDemoMode, setDemoSpeed,
                                     toggleDemoPause, backDemoPlay,
                                     forwardDemoPlay, demoNextHR, exitDemo,
                                     loadDemoGames, buildDemoPlayQueue.

  dev/
    tuning.js                       — Dev Tools panel UI: toggleDevTools,
                                     updateTuning, resetTuning, color-override
                                     helpers, confirmDevToolsChanges, and the
                                     panel-wide delegated click dispatcher
                                     (initDevToolsClickDelegator).
    panels.js                       — Log Capture, App State, Network Trace,
                                     localStorage, Service Worker, Test
                                     Notification, Live Controls (Force Focus
                                     + Force Recap), Diagnostic Snapshot.
    youtube-debug.js                — YouTube channel sweep + custom test.
    video-debug.js                  — HR clip pipeline inspector.
    news-test.js                    — News source endpoint sweep.

dist/
  app.bundle.js                     — Committed IIFE bundle (~464KB) that
                                     GitHub Pages serves. Regenerated by
                                     GitHub Actions on push to main.
  app.bundle.js.map                 — Sourcemap for browser DevTools.

build.mjs                           — esbuild driver. `npm run build` →
                                     dist/app.bundle.js + sourcemap.
                                     `npm run watch` for dev.
```

**Total:** ~45 modules, ~7,800 LOC distributed across `src/`. `main.js` is
~795 lines of orchestration glue. Original monolith was 7,127 lines. The v4.14
loaders.js split (12 commits across 13 modules) is the most recent extraction
wave.

---

## Runtime dependencies

Files that are NOT part of the bundle but must be present in the repo / served at runtime. Before deleting any file in repo root or `icons/`, grep `index.html`, `src/`, `sw.js`, and `manifest.json` for references first.

| File | Loaded by | Purpose |
|---|---|---|
| `dist/styles.min.css` | `index.html` `<link rel="stylesheet">` + `sw.js` SHELL | Minified CSS (built from `styles.css`; not committed — Vercel rebuilds) |
| `dist/app.bundle.js` | `index.html` `<script defer>` | Bundled modular JS |
| `assets/vendor/pulse-card-templates.js` | `index.html` `<script defer>` | HR/RBI player card overlays |
| `assets/vendor/focusCard.js` | `index.html` `<script defer>` | At-Bat Focus Mode visuals |
| `assets/vendor/collectionCard.js` | `index.html` `<script defer>` | Card Collection binder visuals |
| `assets/daily-events.json` | `src/demo/mode.js` `fetch(...)` | Demo Mode replay data (~2.5MB) |
| `manifest.json` | `index.html` `<link rel="manifest">` | PWA install metadata |
| `icons/favicon.svg` | `index.html` `<link rel="icon">` | Browser tab icon |
| `icons/icon-180.png` | `index.html` `<link rel="apple-touch-icon">` | iOS home screen icon |
| `icons/icon-192.png` | `sw.js` SHELL + `manifest.json` | PWA icon |
| `icons/icon-512.png` | `sw.js` SHELL + `manifest.json` | PWA icon (splash) |
| `icons/icon-maskable-512.png` | `manifest.json` | PWA maskable icon |
| `icons/icon-mono.svg` | `manifest.json` | iOS 16.4+ monochrome icon |

**Script load chain (all `<script defer>`):** `pulse-card-templates.js` → `focusCard.js` → `collectionCard.js` → `app.bundle.js` — executed in DOM order after document parses. The theme-flash prevention snippet at `index.html:7` is the only inline-and-synchronous script.

---

## Layering rule

Modules import only from strictly lower layers — never from a higher layer or peer.

```
Layer 6:  main.js                       (boot IIFE, event listeners, SW register)
Layer 5:  bridge in main.js             (Object.assign(window, {...}) at the bottom)
Layer 4:  sections/, dev/, demo/, nav/  (UI section loaders, dev tools, mobile nav)
Layer 3:  carousel/, focus/, feed/, collection/, cards/, radio/, push/
Layer 2:  pulse/, ui/, data/            (polling, theme, helpers)
Layer 1:  state.js, config/, devtools-feed/, utils/, auth/  (foundation)
```

Cross-cutting events (e.g. "polling triggers a carousel update") use direct
imports today rather than an event bus. The dependency graph is a strict DAG —
verified by esbuild's circular-import warnings (none at the time of v3.40.0).

---

## Hot-state contract

`state.js` exports a single mutable `state` object. Every importer receives a
live binding to the same object:

```js
import { state } from '../state.js';

state.gameStates[gamePk] = newGame;   // mutation visible everywhere
```

**Never** assign `let local = state.gameStates;` and mutate `local` — fine for
read-only views (`Object.values(state.gameStates)`), but assignments must go
through `state.X` to stay synced across modules. Same rule for `state.feedItems`,
`state.focusGamePk`, `state.activeTeam`, `state.scheduleData`, `state.enabledGames`,
`state.myTeamLens`, `state.themeOverride`, etc. — they are reassigned by switchTeam,
demo enter/exit, and the Pulse poll cleanup path.

---

## Callback injection pattern

A handful of modules sit slightly above their natural layer because they fire
events that must trigger work on a higher layer (e.g. `collectCard` in
`collection/book.js` needs to call `showPlayerCard` from `cards/playerCard.js`,
but `cards/playerCard.js` ALSO calls `collectCard`). To avoid circular static
imports, the callee receives a callback at boot time:

```js
// cards/playerCard.js (Layer 3)
let _collectCard = null;
export function setPlayerCardCallbacks(cbs) { _collectCard = cbs.collectCard; }
export function showPlayerCard(...) {
  // ...
  if (!state.demoMode && _collectCard) _collectCard({ ... });
}

// main.js boot
setPlayerCardCallbacks({ collectCard, fetchBoxscore });
```

Where the dependency direction is unambiguous (e.g. `data/clips.js` is used by
`pulse/poll.js`, `sections/yesterday.js`, `dev/video-debug.js`), modules import
directly. Callback injection is reserved for the few genuinely circular cases
plus the orchestration glue still living in `main.js`.

---

## Window-global bridge

`src/main.js` ends with `Object.assign(window, { ... })` exposing ~95 functions
to HTML inline `onclick=` handlers and the keyboard-shortcut listener. When
adding/removing a function:

1. Move the function into the appropriate module.
2. `export` it from the module.
3. `import` it back at the top of `main.js`.
4. Reference it in the bridge — same name, no decoration.

Verification command:

```bash
grep -onE 'on(click|change|input|submit|keydown)="[a-zA-Z_]+' index.html \
  | sed -E 's/.*"//' | sort -u > /tmp/handlers.txt
grep -oE '\b[a-zA-Z_]+\b' src/main.js | sort -u > /tmp/exposed.txt
comm -23 /tmp/handlers.txt /tmp/exposed.txt
# Expected: empty (every HTML handler name is in the bridge)
```

---

## Build / dev workflow

| Command | Effect |
|---|---|
| `npm run build` | One-shot bundle to `dist/app.bundle.js` + `.map` |
| `npm run watch` | esbuild watch mode for local development |
| `python3 -m http.server 8080` | Local dev server (Service Worker requires non-`file://`) |

Version: bump `package.json` `"version"` only. From v4.14, `build.mjs` reads
that field at build time, injects it as `__APP_VERSION__` via esbuild's
`define` (consumed by `sw.js` for `CACHE` and `src/main.js` for the settings
panel slot), and rewrites the `?v=X.Y.Z` cache-bust query strings on
`dist/app.bundle.js` + `dist/styles.min.css` in `index.html`. The `<title>`
tag is intentionally version-free (pre-v4 design call).

Vercel rebuilds the bundle on every prod push. The preview workflow rebuilds
before publishing `claude/*` branches to GitHub Pages. `build.yml` was
removed in v4.1 — dist/ is no longer committed to the repo.

---

## Revert paths

| Severity | Action | Effect |
|---|---|---|
| **L1** | `git checkout pre-bundle-cleanup-v3.41` (or cherry-pick its `index.html` + `sw.js` + restore `app.js`) | Restores the `USE_BUNDLE` flag and the legacy `app.js` fallback. |
| **L2** | `git revert <sha>` of a specific extraction commit | Removes that module + restores its inline code (only valid for a single extraction; the v3.40.0 series has cumulative dependencies). |
| **L3** | bump `CACHE` in `sw.js` after L1 | Next SW activation drops cached bundle. |
