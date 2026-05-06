# Module Graph

Final layout of the bundled JS introduced over v3.39 and completed in v3.40.0.
Source-of-truth lives under `src/`; `build.mjs` runs esbuild → `dist/app.bundle.js`
(IIFE, ~464KB). `index.html` loads the bundle via dynamic `<script>` insertion
gated on a `USE_BUNDLE` flag. The legacy monolithic `app.js` is preserved verbatim
as a one-flag-flip fallback while the bundle proves stable.

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

  diag/
    devLog.js                       — console wrap + ring buffer + devTrace
                                     + window error/rejection listeners.
                                     SIDE EFFECTS ON IMPORT — must import first.
    devNet.js                       — fetch wrap + devNetLog ring buffer.
                                     SIDE EFFECTS ON IMPORT.

  utils/
    format.js                       — tcLookup, fmt, fmtRate, fmtDateTime,
                                     fmtNewsDate, pickOppColor (all pure).
    news.js                         — NEWS_IMAGE_HOSTS allowlist + isSafeNewsImage.

  data/
    boxscore.js                     — fetchBoxscore + boxscore cache.
    clips.js                        — pickPlayback, pickHeroImage, fetchGameContent,
                                     patchFeedItemWithClip, pollPendingVideoClips,
                                     devTestVideoClip — single source of truth
                                     for video clip discovery + DOM patching.

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
                                     pulseGreeting, baseDiamondSvg,
                                     startCountdown, showAlert, dismissAlert,
                                     fetchTomorrowPreview.

  pulse/
    poll.js                         — pollLeaguePulse, pollGamePlays,
                                     getEffectiveDate. Hot poller — diffs
                                     /schedule into state.gameStates and
                                     fires HR/RBI cards on per-game playByPlay.

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

  sections/
    loaders.js                      — All section loaders: loadTodayGame,
                                     loadNextGame, loadHomeYoutubeWidget,
                                     loadSchedule, changeMonth, selectCalGame,
                                     switchBoxTab, playHighlightVideo,
                                     loadStandings, loadRoster, switchRosterTab,
                                     selectPlayer, loadLeaders, switchLeaderTab,
                                     selectLeaderPill, loadNews, switchNewsFeed,
                                     selectNewsSource, loadLeagueView,
                                     loadLeagueMatchups, switchMatchupDay,
                                     switchLeagueLeaderTab, showLiveGame,
                                     closeLiveView, fetchLiveGame.
    yesterday.js                    — Yesterday Recap overlay (open/close,
                                     date picker, hero player carousel,
                                     heroes strip, per-game tile grid,
                                     collected-cards strip).

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

app.js                              — Legacy fallback (preserved verbatim).
                                     Loaded only when USE_BUNDLE = false.
                                     Do NOT edit; will be removed once the
                                     bundle is fully proven.
```

**Total:** ~30 modules, ~6,500 LOC distributed across `src/`. `main.js` is now
~680 lines of orchestration glue. Original monolith was 7,127 lines.

---

## Layering rule

Modules import only from strictly lower layers — never from a higher layer or peer.

```
Layer 6:  main.js                 (boot IIFE, event listeners, SW register)
Layer 5:  bridge in main.js       (Object.assign(window, {...}) at the bottom)
Layer 4:  sections/, dev/, demo/  (UI section loaders + dev tools)
Layer 3:  carousel/, focus/, feed/, collection/, cards/, radio/, push/
Layer 2:  pulse/, ui/, data/      (polling, theme, helpers)
Layer 1:  state.js, config/, diag/, utils/, auth/  (foundation)
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

Service worker cache: bump `CACHE` in `sw.js` whenever `dist/app.bundle.js`
ships behavior change. Index.html cache-bust querystring (`?v=3.X.Y`) and the
settings panel version both bumped on each commit.

GitHub Actions (`.github/workflows/build.yml`) auto-rebuilds the bundle on
push to `main` if `src/**` or `build.mjs` changes — guarded with
`[skip ci]` + bot-user check to prevent loops.

---

## Revert paths

| Severity | Action | Effect |
|---|---|---|
| **L1** | edit `index.html`: `window.USE_BUNDLE = false`; commit + push | Next reload runs legacy `app.js`. Modules become dead code. |
| **L2** | `git revert <sha>` of a specific extraction commit | Removes that module + restores its inline code (only valid for a single extraction; the v3.40.0 series has cumulative dependencies). |
| **L3** | bump `CACHE` in `sw.js` after L1 | Next SW activation drops cached bundle. |

L1 is the panic button — one HTML edit, one commit, ~30s.
