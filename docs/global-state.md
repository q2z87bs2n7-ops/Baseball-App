# MLB Tracker — Global State Reference

All hot mutable state lives in `src/state.js` as properties of a single exported `state` object. Every module that imports `state` receives a live binding — mutating `state.gameStates[pk]` or `state.feedItems` propagates everywhere. Constants are in `src/config/constants.js`. This file is the authoritative list.

```javascript
const SEASON = 2026                    // hardcoded — update each season
const MLB_BASE = 'https://statsapi.mlb.com/api/v1'
const MLB_BASE_V1_1 = 'https://statsapi.mlb.com/api/v1.1'  // Pulse only — v1 timestamps path 404s
const TEAMS = [...]                    // 30 teams with colors, IDs, YouTube channel IDs

let activeTeam = TEAMS.find(t => t.id === 121)   // defaults to Mets
let scheduleData = []                  // populated by loadSchedule() or cold-load ±7 day fetch
let scheduleLoaded = false             // true only after full-season fetch completes
let rosterData = { hitting, pitching, fielding }
let statsCache = { hitting, pitching }
let selectedPlayer = null              // full roster object — includes person, position, jerseyNumber (jerseyNumber is null when loaded from team stats endpoint)
let newsFeedMode = 'mlb'               // 'mlb' (no team filter) | 'team' (activeTeam.espnId filter); home card always shows team news
let themeScope = 'full'               // 'full' = team theme applied to whole app | 'nav' = team vars scoped to <header> only, rest of app uses MLB_THEME neutral colors; persisted to localStorage('mlb_theme_scope')

// ── 📊 Stats Tab v2 globals (Sprints 1+2, v4.6.7 → v4.6.16) ─────────────────
let qualifiedOnly    = true             // Leaders Qualified toggle — default ON (PA ≥ 3.1×G hitters, IP ≥ 1×G pitchers); persisted to localStorage('mlb_stats_qualified_only')
let vsLeagueBasis    = 'mlb'            // 'mlb' | 'team' — Player Stats Compare basis pill; persisted to localStorage('mlb_stats_vs_basis')
let activeStatsTab   = 'overview'       // 'overview' | 'splits' | 'gamelog' | 'advanced' — active Player Stats tab; persisted to localStorage('mlb_stats_tab')
let selectedPlayerStat = null           // { stat, group } — most-recent season-stat blob for the selected player; cached so tab re-renders don't refetch
let teamStats        = null             // { hitting, pitching, standingsRecord } — populated by loadTeamStats(); feeds the Team Stats card + qualified threshold
let leagueLeaders    = {}               // (group + ':' + leaderCategory) → [{playerId, value, rank}, ...] — TTL-cached MLB-wide leaderboards backing percentile bars + league averages
let gameLogCache     = {}               // (playerId + ':' + group) → { games:[...], ts } — 24h TTL; feeds Game Log tab + Overview hero sparkline
let statSplitsCache  = {}               // (playerId + ':' + group) → { splits:[...], ts } — 24h TTL; feeds Splits tab
let pitchArsenalCache= {}               // playerId → { data:[...], ts } — 24h TTL; feeds Advanced tab donut for pitchers; pct values are normalized to a 0–100 scale at fetch time even when the API returns fractions
let lastNCache       = {}               // playerId → { last15: <stat>, ts } — 12h TTL; feeds HOT/COLD inline badges (last-15 OPS Δ vs season OPS ≥ ±0.080)

// ── 📊 Stats Tab v3 globals (Sprint 3, v4.6.18 → v4.6.25) ──────────────────
let advancedHittingCache = {}            // playerId → { stat: {merged blob}, ts } — 24h TTL; sabermetrics + seasonAdvanced merged, feeds the Advanced tab metrics grid for hitters
let hotColdCache         = {}            // playerId → { data:[zone splits], ts } — 24h TTL; /people/{id}/stats?stats=hotColdZones, feeds the strike-zone heat map under Advanced (hitters)
let careerCache          = {}            // playerId → { hitting:[year rows], pitching:[year rows], ts } — 24h TTL; feeds Career tab year-by-year tables
let careerSwipeHintShown = false        // persisted in localStorage('mlb_stats_career_hint_shown'); gates the one-time mobile "← Swipe to see more →" banner above the Career table (v4.9)
// Compare overlay state (in-memory only; no persistence)
let compareOpen          = false
let compareA             = null         // full roster player object {person, position, jerseyNumber}
let compareB             = null
let compareGroup         = 'hitting'    // 'hitting' | 'pitching'

// ── ⚡ Pulse globals ──────────────────────────────────────────────────────────
let pulseInitialized = false           // lazy-init guard — set true on first Pulse nav
let gameStates       = {}             // gamePk → { awayAbbr, homeAbbr, awayName, homeName, awayPrimary, homePrimary,
                                      //   awayId, homeId, awayScore, homeScore, awayHits, homeHits,
                                      //   status, detailedState, inning, halfInning, outs, playCount, lastTimestamp,
                                      //   gameTime, gameDateMs, venueName, onFirst, onSecond, onThird }
let feedItems        = []             // all feed items newest-first (never pruned)
let enabledGames     = new Set()      // gamePks whose plays are visible in the feed
let countdownTimer   = null, pulseTimer = null, isFirstPoll = true, pollDateStr = null
// pulseTimer — stores setInterval handle from initReal()
let soundSettings    = { master:false, hr:true, run:true, risp:true,
                         dp:true, tp:true, gameStart:true, gameEnd:true, error:true }
let rbiCardCooldowns = {}              // gamePk → ms timestamp of last key RBI card shown (90s cooldown)
let pulseColorScheme = (...)           // 'dark' | 'light' — active Pulse color scheme; persisted to localStorage('mlb_pulse_scheme'); defaults 'light'
let pendingVideoQueue= []              // unused stub — feedItems is source of truth for clip matching
let liveContentCache = {}             // gamePk → {items:[], fetchedAt:ms} — re-fetched if >5min stale; data-visualization clips excluded at fill time; separate from yesterdayContentCache
let lastVideoClip    = null           // most recent matched live clip object — used by devTestVideoClip() as first fallback
let videoClipPollTimer = null         // setInterval handle (30s) for pollPendingVideoClips()

// ── 📖 Story Carousel globals (v2.7.1+) ──────────────────────────────────────
let storyPool        = []               // array of story objects ready to rotate
let storyShownId     = null             // id of currently displayed story
let storyRotateTimer = null             // setInterval handle from initReal()
let storyPoolTimer   = null             // setInterval handle (30s) for buildStoryPool() — decoupled from 15s pollLeaguePulse()
let onThisDayCache   = null             // cached stories from 3 years ago (same date)
let yesterdayCache   = null             // cached stories from yesterday's games — populated by loadYesterdayCache() at Pulse init; used by genYesterdayHighlights() story carousel; never modified by date picker
let ydDateOffset     = -1               // days relative to today shown in Yesterday Recap; -1=yesterday (default); updated by ydChangeDate()
let ydDisplayCache   = null             // non-null when user has navigated to a date other than yesterday via date picker; avoids polluting yesterdayCache used by story carousel; cleared on each openYesterdayRecap()
let dailyLeadersCache= null             // cached top 3 leaders per stat category
let dailyLeadersLastFetch=0             // timestamp of last leaders fetch
let dailyHitsTracker = {}               // batterId → hit count (reset daily)
let dailyPitcherKs   = {}               // pitcherId → strikeout count (reset daily)
let stolenBaseEvents = []               // live stolen base plays for carousel story generator (not added to feed)
let storyCarouselRawGameData={}         // gamePk → raw schedule API game object (doubleHeader, gameNumber, status.startTimeTBD, probablePitcher)
let probablePitcherStatsCache={}        // pitcherId → {wins, losses} — fetched by loadProbablePitcherStats()
let hrBatterStatsCache={}               // batterId → hitting stat object — populated by showPlayerCard() and fetchMissingHRBatterStats()
let boxscoreCache={}                    // gamePk → boxscore data object — populated by genMultiHitDay() async fetch
// carousel rotation interval — read from devTuning.rotateMs (default 4500ms; was STORY_ROTATE_MS constant pre-v2.60)

// ── 📊 Inning Recap globals (v2.46+) ───────────────────────────────────────
let inningRecapsFired=new Set()         // {gamePk}_{inning}_{halfInning} — deduplication, one recap per inning
let inningRecapsPending={}              // recapKey → {gamePk, inning, halfInning} — queued by pollGamePlays on outs===3; processed by genInningRecapStories primary path
let lastInningState={}                  // gamePk → {inning, halfInning} — fallback transition detection in genInningRecapStories

// ── 🎯 At-Bat Focus Mode globals (v2.61) ─────────────────────────────────────
let focusGamePk=null                    // gamePk of the currently focused game (null = none selected)
let focusFastTimer=null                 // setInterval handle for 5s linescore + GUMBO polls
let focusCurrentAbIdx=null             // atBatIndex of the current play — resets focusPitchSequence on change
let focusState={                        // live state for the focused game — fed directly to window.FocusCard.renderCard/renderOverlay
  balls:0,strikes:0,outs:0,inning:1,halfInning:'top',
  currentBatterId:null,currentBatterName:'',
  currentPitcherId:null,currentPitcherName:'',
  onFirst:false,onSecond:false,onThird:false,
  awayAbbr:'',homeAbbr:'',awayScore:0,homeScore:0,
  awayPrimary:'#444',homePrimary:'#444',
  tensionLabel:'NORMAL',tensionColor:'#9aa0a8',
  lastPitch:null,batterStats:null,pitcherStats:null
}
let focusPitchSequence=[]              // array of pitch objects for current at-bat (oldest first); reset on new AB
let focusStatsCache={}                 // playerId → stats object — session-scoped cache; batter → hitting stats, pitcher → pitching stats
let focusLastTimecode=null             // last-seen GUMBO timecode string; null = seed required; reset in setFocusGame(); used by pollFocusRich() to request diffPatch deltas instead of full feed
let focusAlertShown={}                 // gamePk → ms timestamp of last soft alert shown (90s cooldown)
let focusOverlayOpen=false             // true when #focusOverlay is visible
let focusIsManual=false                // true when user manually picked a game via compact switcher; cleared by selectFocusGame() auto-pick and resetFocusAuto()
let tabHiddenAt=null                   // ms timestamp when tab went hidden (Page Visibility API); null when tab is visible; used by pollGamePlays isHistory extension to suppress sounds/popups for catch-up plays on tab return

// ── 📖 Card Collection globals (v3.0) ────────────────────────────────────────
let collectionFilter='all'             // 'all' | 'HR' | 'RBI' — current filter in binder
let collectionSort='newest'            // 'newest' | 'rarity' | 'team' — current sort in binder
let collectionPage=0                   // 0-indexed page (or team index when sort==='team')
let collectionCareerStatsCache={}      // playerId → { careerHR, careerAVG, careerRBI, careerOPS }
                                       //            or { careerERA, careerWHIP, careerW, careerK }
                                       // session-only — not persisted to localStorage
let lastCollectionResult=null          // { type:'new'|'upgrade'|'dup', playerName, eventType, tier }
                                       // set by collectCard() at collect time; consumed by flashCollectionRailMessage()
let collectionSlotsDisplay=[]          // sorted/filtered slot snapshot set by renderCollectionBook() at render time
                                       // openCardFromCollection(idx) indexes into this for stable idx mapping
```

## Demo Mode globals

See `docs/demo-mode.md` for the full `demoMode`, `demoPlayQueue`, `devTuning`, `devColorOverrides`, and related globals.

## Radio globals

```javascript
var radioAudio = null;        // <audio> element, lazily created on first play
var radioHls   = null;        // Hls.js instance (null when direct stream / stopped)
var radioCurrentTeamId = null; // teamId whose feed is loaded; null = fallback
```

## localStorage keys

| Key | Purpose |
|---|---|
| `mlb_session_token` | Auth session (40-char random, 90-day TTL) |
| `mlb_push` | Push subscription state |
| `mlb_theme_vars` | Persisted CSS vars (flash-of-wrong-theme prevention) |
| `mlb_theme_scope` | `'full'` or `'nav'` theme scope |
| `mlb_pulse_scheme` | `'dark'` or `'light'` Pulse color scheme |
| `mlb_card_collection` | Card collection JSON |
| `mlb_radio_check` | Radio sweep results (`{ teamId: 'yes'|'no' }`) |
| `mlb_radio_check_notes` | Radio sweep free-text notes |
| `mlb_radio_check_notes_seeded_v2` | One-time seed flag for default notes |
| `mlb_stats_qualified_only` | Stats v2 — Leaders Qualified toggle (`'1'` / `'0'`); default ON when key absent |
| `mlb_stats_vs_basis` | Stats v2 — Player Stats Compare basis (`'mlb'` / `'team'`); default `'mlb'` |
| `mlb_stats_tab` | Stats v2 — active Player Stats tab (`'overview'` / `'splits'` / `'gamelog'` / `'advanced'`) |
