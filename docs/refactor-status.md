# app.js Modularize — Session Resume

> One-page handoff. Read this first when picking up the modularize work.
> Companion docs: `docs/module-graph.md` (layering rule) +
> `/root/.claude/plans/switching-to-opus-provide-functional-knuth.md` (original plan).

---

## Status: paused at v3.39.9, awaiting browser test

Branch `claude/code-review-MyyeV` is pushed to origin with all extraction
commits below. **`main` is untouched** — production is still on v3.38.x.
Three rollback paths remain available; see "Revert" at the bottom.

---

## What's been extracted

```
src/
  main.js              ~6900 lines  (down from 7127 — the legacy app.js is
                                    preserved verbatim alongside as
                                    fallback when USE_BUNDLE = false)
  config/
    constants.js          70 lines  SEASON, WC_SPOTS, MLB_BASE,
                                    MLB_BASE_V1_1, API_BASE, TEAMS,
                                    MLB_THEME, NEWS_SOURCE_LABELS/ICONS,
                                    TIMING
  diag/
    devLog.js             58 lines  console wrap + ring buffer +
                                    devTrace + window error/rejection
                                    listeners. SIDE EFFECTS ON IMPORT —
                                    must be imported first.
    devNet.js             45 lines  fetch wrap + devNetLog ring buffer.
                                    SIDE EFFECTS ON IMPORT.
  utils/
    format.js             61 lines  tcLookup, fmt, fmtRate, fmtDateTime,
                                    fmtNewsDate, pickOppColor (all pure)
    news.js               13 lines  NEWS_IMAGE_HOSTS allowlist regex +
                                    isSafeNewsImage
  ui/
    wakelock.js           26 lines  Screen Wake Lock API wrapper.
                                    screenWakeLock state encapsulated.
    sound.js             117 lines  Web Audio synthesis: 8 per-event
                                    sounds + audio primitives + soundSettings
                                    (hydrates from localStorage on import).
                                    onSoundPanelClickOutside — note: also
                                    handles Dev Tools panel close-on-click;
                                    that branch should move to dev/panel.js
                                    when that subsystem is extracted.
  push/
    push.js               79 lines  VAPID_PUBLIC_KEY, urlBase64ToUint8Array,
                                    subscribeToPush, unsubscribeFromPush,
                                    togglePush
  radio/
    stations.js           95 lines  MLB_TEAM_RADIO (30 station URLs),
                                    FALLBACK_RADIO, APPROVED_RADIO_TEAM_IDS,
                                    RADIO_CHECK_DEFAULT_NOTES
  auth/
    oauth.js              33 lines  signInWithGitHub + signInWithEmail
                                    (stateless redirect/POST initiators)
```

**Modular total: ~660 lines across 11 files.** `main.js` ~6900 lines remaining.

---

## Commit log (most recent first)

| SHA prefix | Version | What |
|---|---|---|
| (this commit) | v3.39.9 | docs/refactor-status.md (this file) |
| 4664bfb | v3.39.8 | auth/oauth.js — sign-in initiators |
| e3c1d74 | v3.39.7 | radio/stations.js — radio data |
| 030b432 | v3.39.6 | ui/sound.js — sound system |
| 9e104e7 | v3.39.5 | version catch-up for v3.39.1–v3.39.5 |
| 79b185f | v3.39.5 | push/push.js + API_BASE → constants |
| b80a188 | v3.39.4 | ui/wakelock.js |
| 73e2fef | v3.39.3 | utils/format.js + utils/news.js |
| 4955a32 | v3.39.2 | diag/devLog.js + diag/devNet.js |
| 103f9f6 | v3.39.1 | (fix) remove undefined names from bridge |
| c4322cf | v3.39.0 | wire bundle into index.html with USE_BUNDLE flag |
| dfc5753 | — | lift app.js → src/main.js + first constants extraction |
| ee4264f | — | esbuild scaffolding |

---

## What's left + the next decision

These subsystems still live entirely in `main.js` because they all read or
mutate hot shared state (`gameStates`, `feedItems`, `focusGamePk`,
`activeTeam`, `scheduleData`, `enabledGames`, `myTeamLens`, `themeOverride`,
`themeInvert`, `themeScope`, `pulseInitialized`):

| Subsystem | Approx LOC in main.js | Reads/writes |
|---|---|---|
| Pulse polling (pollLeaguePulse, pollGamePlays, pollPendingVideoClips) | ~600 | gameStates, feedItems, enabledGames |
| Story Carousel (15 gen* + buildStoryPool + showStoryCard) | ~1000 | gameStates, feedItems, storyPool, displayedStoryIds |
| Focus Mode (calcFocusScore, selectFocusGame, polls, overlay) | ~400 | focusGamePk, focusIsManual, gameStates |
| Card Collection (collectCard, openCollection, binder, sync helpers) | ~800 | feedItems, collectionData (own state) |
| Feed Render (renderFeed, renderTicker, addFeedItem, renderEmptyState) | ~450 | feedItems, gameStates, enabledGames, myTeamLens |
| Radio engine (pickRadioForFocus, toggleRadio, loadRadioStream, etc.) | ~120 | focusGamePk, gameStates |
| Radio Check sweep tool (openRadioCheck, etc.) | ~150 | own state + MLB_TEAM_RADIO |
| Demo Mode (toggleDemoMode, demo loop, demoNextHR) | ~440 | gameStates, feedItems, demoState |
| Dev Tools panel (renderLogCapture, renderAppState, renderNetTrace, …) | ~1000 | reads everything |
| Section loaders (loadTodayGame, loadSchedule, loadStandings, loadLeagueView, loadStats, loadRoster, loadNews, showLiveGame, openYesterdayRecap) | ~1100 | activeTeam, scheduleData |
| Theme/UI (applyTeamTheme, applyPulseMLBTheme, switchTeam, switchTheme, toggleInvert, applyMyTeamLens) | ~400 | activeTeam, themeOverride, themeInvert, themeScope, myTeamLens |
| Sync (signOut, updateSyncUI, syncCollection, mergeCollectionOnSignIn, mergeCollectionSlots, startSyncInterval, showSignInCTA) | ~120 | mlbSessionToken + collection |

### Hot-state assignment audit (the blocker)

`grep -nE "(^|[^a-zA-Z_])(activeTeam|scheduleData|gameStates|feedItems|focusGamePk|focusIsManual|enabledGames|myTeamLens|pulseInitialized|themeOverride|themeInvert|themeScope) ?="`
finds **~30 reassignment sites** across main.js — `gameStates = {}`, `feedItems = []`, `enabledGames = new Set()`, `scheduleData = []` are all reset in switchTeam, demo enter/exit, and the Pulse poll cleanup path.

ES module live bindings are read-only on the importer side, so any
extraction has to either (a) wrap state in a single mutable object, or
(b) export setters for every reassigned binding. (a) is fewer concepts
but bigger diff; (b) keeps existing call sites bare-named but adds setter
imports.

### Two paths the user is choosing between

**Path A — single `state` object container**
- `src/state.js` exports `export const state = { gameStates: {}, feedItems: [], ... }`
- All bare references throughout main.js become `state.gameStates`, `state.feedItems`, etc.
- Subsystem extractions get clean `import { state } from '../state.js'` instead of plumbing dozens of args
- Risk: ~hundreds of references to update in a single commit; regex-replace risks matching string literals + comments
- Mitigation: do it in one big commit, run smoke tests immediately, USE_BUNDLE flag is the bailout

**Path B — per-subsystem state colocation + event bus**
- Each subsystem owns its own state inside its module
- Cross-subsystem reads go through getter exports + a shared `EventTarget` on `state.bus`
- Risk: more architectural decisions per extraction (which subsystem "owns" gameStates? probably Pulse polling)
- Slow + safe: each subsystem extraction is its own commit

Recommended: **Path A**. The reference-update churn is one-time; the architecture stays close to the current mental model; USE_BUNDLE is a one-line revert if Path A breaks something subtle.

---

## Verify the bundle still works

```bash
git pull origin claude/code-review-MyyeV
python3 -m http.server 8080
# Open http://localhost:8080
# Hard-reload (Ctrl+Shift+R / Cmd+Shift+R) to bypass SW cache
# Confirm Settings panel reads "v3.39.x" (current = v3.39.9)
# Smoke test: Pulse, My Team (Home), Schedule, League, News, Standings, Stats
# Settings: switch team, switch theme, toggle invert, sound panel, Dev Tools
# Shortcuts: Shift+M (demo), Shift+H (HR card), Shift+I (snapshot)
```

If anything is broken, open DevTools console and look for the first
ReferenceError or undefined function — that tells us which extraction
introduced the regression. Commits are independent enough that
`git revert <sha>` of any single one should cleanly undo just that
extraction.

---

## Revert paths (in increasing severity)

| Severity | Action | Effect |
|---|---|---|
| **L1 — Single-line panic** | edit `index.html`: `window.USE_BUNDLE = false`; commit + push | Next reload runs legacy `app.js`. Modules are dead code. |
| **L2 — Revert one extraction** | `git revert <sha>` of a specific extraction commit | Removes that module + restores its inline code. Bundle rebuilds on next push to main. |
| **L3 — Full revert pre-merge** | merge has not happened yet — just don't merge to main. | Production unaffected. |
| **L4 — SW cache pinned old bundle** | bump `sw.js` `CACHE` (already at mlb-v548 → bump to mlb-v549) | Next SW activation drops old caches. |

---

## When picking up next session

Resume prompt for a fresh Claude Code session (paste verbatim):

> Continuing the modularize-app.js work on branch `claude/code-review-MyyeV`. Read `docs/refactor-status.md` first — it has the current state, what's been extracted, and the Path A vs Path B decision. Don't re-explore the codebase from scratch.

That doc + the CHANGELOG entries (v3.39.0 through current) + this branch's
git log are sufficient context to resume without re-deriving anything.
