// ── Shared Mutable State Container (Path A)
// All hot-state globals that are reassigned or heavily mutated by multiple
// subsystems are wrapped in a single state object. This allows safe extraction
// of subsystems without circular dependencies or plumbing dozens of args.
// Import pattern: import { state } from '../state.js'
// Usage: state.gameStates, state.feedItems, state.activeTeam = ..., etc.

import { TEAMS } from './config/constants.js';

export const state = {
  // ── Team & UI State ──────────────────────────────────────────────────────
  activeTeam: TEAMS.find(t => t.id === 121),  // Mets default
  themeOverride: null,
  themeInvert: false,
  savedThemeForPulse: null,
  themeScope: 'full',

  // ── Schedule & Section State ─────────────────────────────────────────────
  scheduleData: [],
  scheduleLoaded: false,
  rosterData: { hitting: [], pitching: [], fielding: [] },
  statsCache: { hitting: [], pitching: [] },
  currentRosterTab: 'hitting',
  currentLeaderTab: 'hitting',
  selectedPlayer: null,

  // ── Stats Tab v2 (Sprint 1+) ─────────────────────────────────────────────
  // leagueLeaders: keyed `${group}:${leaderCategory}` → sorted [{playerId, value, rank}]
  leagueLeaders: {},
  leagueLeadersFetchedAt: {},      // keyed by group → ms timestamp
  leagueLeadersInflight: {},       // keyed by group → in-flight Promise
  // teamStats: { hitting, pitching, fielding } each = MLB stats payload + ranks
  teamStats: { hitting: null, pitching: null, fielding: null, ranks: {} },
  teamStatsFetchedAt: 0,
  teamStatsInflight: null,
  // lastNCache: playerId → { last15: <stat object>, season: <stat object>, ts }
  lastNCache: {},
  // Persisted prefs
  qualifiedOnly: (typeof localStorage !== 'undefined' && localStorage.getItem('mlb_stats_qualified_only') === '0') ? false : true,
  vsLeagueBasis: (typeof localStorage !== 'undefined' && localStorage.getItem('mlb_stats_vs_basis')) || 'mlb',

  // ── News State ───────────────────────────────────────────────────────────
  newsFeedMode: 'mlb',
  newsSourceFilter: 'all',
  newsArticlesCache: [],
  pulseNewsArticles: [],
  pulseNewsIndex: 0,

  // ── League Pulse State ───────────────────────────────────────────────────
  pulseInitialized: false,
  gameStates: {},
  feedItems: [],
  enabledGames: new Set(),
  myTeamLens: (typeof localStorage !== 'undefined' && localStorage.getItem('mlb_my_team_lens') === '1'),
  rbiCardCooldowns: {},
  countdownTimer: null,
  pulseTimer: null,
  isFirstPoll: true,
  pollDateStr: null,
  pulseAbortCtrl: null,
  focusAbortCtrl: null,
  liveAbortCtrl: null,

  // ── Session & Sync State ─────────────────────────────────────────────────
  mlbSessionToken: null,
  mlbAuthUser: null,
  mlbSyncInterval: null,
  shownSignInCTA: false,
  signInCTACardCount: 0,
  signInCTATimer: null,

  // ── Story Carousel State ─────────────────────────────────────────────────
  storyPool: [],
  storyShownId: null,
  storyRotateTimer: null,
  storyPoolTimer: null,
  yesterdayRefreshTimer: null,
  onThisDayCache: null,
  yesterdayCache: null,
  dailyLeadersCache: null,
  dailyLeadersLastFetch: 0,
  tomorrowPreview: { dateStr: null, firstPitchMs: null, gameTime: null, gameCount: 0, fetchedAt: 0, inFlight: false },
  dailyHitsTracker: {},
  dailyPitcherKs: {},
  stolenBaseEvents: [],
  storyCarouselRawGameData: {},
  probablePitcherStatsCache: {},
  hrBatterStatsCache: {},
  boxscoreCache: {},
  inningRecapsFired: new Set(),
  inningRecapsPending: {},
  lastInningState: {},
  displayedStoryIds: new Set(),
  transactionsCache: [],
  transactionsLastFetch: 0,
  highLowCache: null,
  highLowLastFetch: 0,
  liveWPCache: {},
  liveWPLastFetch: 0,
  perfectGameTracker: {},

  // ── Dev Tuning State ─────────────────────────────────────────────────────
  devTuning: {
    rotateMs: 4500,
    rbiThreshold: 10,
    rbiCooldown: 90000,
    hr_priority: 100,
    hr_cooldown: 300000,
    biginning_priority: 75,
    biginning_threshold: 3,
    walkoff_priority: 90,
    walkoff_cooldown: 300000,
    nohitter_inning_floor: 6,
    nohitter_priority: 95,
    basesloaded_enable: true,
    basesloaded_priority: 88,
    focus_critical: 120,
    focus_high: 70,
    focus_switch_margin: 25,
    focus_alert_cooldown: 90000,
    hitstreak_floor: 10,
    hitstreak_priority: 65,
    roster_priority_il: 40,
    roster_priority_trade: 55,
    wp_leverage_floor: 2,
    wp_extreme_floor: 85,
    award_priority: 55,
    highlow_priority: 25,
    livewp_priority: 30,
    livewp_refresh_ms: 90000
  },
  devColorLocked: false,
  devShowPushOnDesktop: false,
  devColorOverrides: {
    app: { dark: '', card: '', card2: '', border: '', primary: '', secondary: '', accent: '', accentText: '', headerText: '' },
    pulse: { dark: '', card: '', card2: '', border: '', primary: '', secondary: '', accent: '', accentText: '', headerText: '' }
  },

  // ── Focus Mode State ─────────────────────────────────────────────────────
  focusGamePk: null,
  focusIsManual: false,
  focusFastTimer: null,
  focusCurrentAbIdx: null,
  focusState: {
    balls: 0, strikes: 0, outs: 0, inning: 1, halfInning: 'top',
    currentBatterId: null, currentBatterName: '',
    currentPitcherId: null, currentPitcherName: '',
    onFirst: false, onSecond: false, onThird: false,
    awayAbbr: '', homeAbbr: '', awayScore: 0, homeScore: 0,
    awayPrimary: '#444', homePrimary: '#444',
    tensionLabel: 'NORMAL', tensionColor: '#9aa0a8',
    lastPitch: null,
    batterStats: null, pitcherStats: null
  },
  focusPitchSequence: [],
  focusStatsCache: {},
  focusLastTimecode: null,
  focusAlertShown: {},
  focusOverlayOpen: false,
  tabHiddenAt: null,

  // ── Collection State ─────────────────────────────────────────────────────
  collectionFilter: 'all',
  collectionSort: 'newest',
  collectionPage: 0,
  collectionCareerStatsCache: {},
  lastCollectionResult: null,
  collectionSlotsDisplay: [],

  // ── Yesterday Recap State ────────────────────────────────────────────────
  yesterdayContentCache: {},
  liveContentCache: {},
  lastVideoClip: null,
  videoClipPollTimer: null,
  yesterdayOverlayOpen: false,
  ydHighlightClips: [],
  ydDateOffset: -1,
  ydDisplayCache: null,

  // ── Demo Mode State ──────────────────────────────────────────────────────
  demoMode: false,
  demoGamesCache: [],
  demoPlayQueue: [],
  demoPlayIdx: 0,
  demoTimer: null,
  demoStartTime: 0,
  demoDate: null,
  demoCurrentTime: 0,
  // Demo Mode v2 hydration targets (populated only by initDemo from
  // daily-events.json; consumed by PR-3 demo branches in Focus Mode,
  // pollPendingVideoClips, fetchBoxscore, etc.)
  pitchTimeline: {},          // gamePk → [{atBatIndex, ts, pitches:[...], ...}]
  boxscoreSnapshots: {},      // gamePk → [{ts, data}]
  contentCacheTimeline: {},   // gamePk → [{ts, items:[trimmed clips]}]
  focusTrack: [],             // [{ts, focusGamePk, isManual, tensionLabel}]
  demoCardCount: 0            // session-only counter; rail chip increments as HR cards fire in demo (real localStorage untouched)
};
