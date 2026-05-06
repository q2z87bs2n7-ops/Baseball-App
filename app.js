const DEBUG=false; // Set true locally to enable verbose console logging

// ── Naming conventions ────────────────────────────────────────────────────────
// load*()    — fetch + cache + render a full section (loadTodayGame, loadSchedule)
// fetch*()   — async data fetch with session cache, returns data or null (fetchBoxscore, fetchCareerStats)
// render*()  — pure DOM write from already-loaded data (renderCalendar, renderFeed)
// poll*()    — recurring background fetch called on a timer (pollLeaguePulse, pollFocusLinescore)
// gen*()     — story carousel generator, returns array of story objects (genHRStories, genStreakStories)
// show*()    — opens an overlay or card into view (showPlayerCard, showLiveGame)
// open/close*() — paired overlay lifecycle (openCollection/closeCollection, openYesterdayRecap/closeYesterdayRecap)
// update*()  — partial DOM refresh without full re-render (updateFeedEmpty, updateCollectionUI)
// toggle*()  — binary on/off for settings/UI (toggleRadio, toggleGame, toggleDevTools)
// set*()     — sets a specific state value + triggers side-effects (setFocusGame, setRadioUI)
// tcLookup(id) — canonical team lookup; prefer over inline TEAMS.find() at call sites
// ─────────────────────────────────────────────────────────────────────────────

const SEASON=2026,WC_SPOTS=3,MLB_BASE='https://statsapi.mlb.com/api/v1';
const TEAMS=[
  {id:121,espnId:21,name:'New York Mets',short:'Mets',division:'National League East',league:'NL',primary:'#002D72',secondary:'#FF5910',youtubeUC:'UCgIMbGazP0uBDy9JVCqBUaA'},
  {id:144,espnId:15,name:'Atlanta Braves',short:'Braves',division:'National League East',league:'NL',primary:'#CE1141',secondary:'#13274F',youtubeUC:'UCNWnkblY5_kmf4OQ9l0LgnA'},
  {id:120,espnId:20,name:'Washington Nationals',short:'Nationals',division:'National League East',league:'NL',primary:'#AB0003',secondary:'#14225A',youtubeUC:'UCUnB3WNX238eraj5IK3fFEw'},
  {id:143,espnId:22,name:'Philadelphia Phillies',short:'Phillies',division:'National League East',league:'NL',primary:'#E81828',secondary:'#002D72',youtubeUC:'UC28ETlLi5Nc8NJMGyFlCUBA'},
  {id:146,espnId:28,name:'Miami Marlins',short:'Marlins',division:'National League East',league:'NL',primary:'#00A3E0',secondary:'#EF3340',youtubeUC:'UC1Gh_pQ7l41tyBn2HeJ1k-A'},
  {id:112,espnId:16,name:'Chicago Cubs',short:'Cubs',division:'National League Central',league:'NL',primary:'#0E3386',secondary:'#CC3433',youtubeUC:'UCnU7B7B0U0t2vs-2HMLjgvg'},
  {id:113,espnId:17,name:'Cincinnati Reds',short:'Reds',division:'National League Central',league:'NL',primary:'#C6011F',secondary:'#000000',youtubeUC:'UCENXPJrzbHXudxhURfk5NCg'},
  {id:158,espnId:8,name:'Milwaukee Brewers',short:'Brewers',division:'National League Central',league:'NL',primary:'#0a2351',secondary:'#b6922e',youtubeUC:'UCybiT6P8jSv7gIxC4cHXl2Q'},
  {id:134,espnId:23,name:'Pittsburgh Pirates',short:'Pirates',division:'National League Central',league:'NL',primary:'#27251F',secondary:'#FDB827',youtubeUC:'UCmBaK2wdmP1LZ9gLkkHiM4Q'},
  {id:138,espnId:24,name:'St. Louis Cardinals',short:'Cardinals',division:'National League Central',league:'NL',primary:'#C41E3A',secondary:'#0C2340',youtubeUC:'UCwaMqLYzbyp2IbFgcF_s5Og'},
  {id:109,espnId:29,name:'Arizona Diamondbacks',short:'D-backs',division:'National League West',league:'NL',primary:'#A71930',secondary:'#E3D4AD',youtubeUC:'UCRtxbf1TYosFt-jDDpXNH8w'},
  {id:115,espnId:27,name:'Colorado Rockies',short:'Rockies',division:'National League West',league:'NL',primary:'#33006f',secondary:'#C4CED4',youtubeUC:'UCdipDw91rGXCoTb6fLNJqbQ'},
  {id:119,espnId:19,name:'Los Angeles Dodgers',short:'Dodgers',division:'National League West',league:'NL',primary:'#005A9C',secondary:'#EF3E42',youtubeUC:'UC05cNJvMKzDLRPo59X2Xx7g'},
  {id:135,espnId:25,name:'San Diego Padres',short:'Padres',division:'National League West',league:'NL',primary:'#2F241D',secondary:'#FFC425',youtubeUC:'UCR4m_k1bAxB57xgNlNI9TtA'},
  {id:137,espnId:26,name:'San Francisco Giants',short:'Giants',division:'National League West',league:'NL',primary:'#FD5A1E',secondary:'#27251F',youtubeUC:'UChQ_jRZGIQc6m97NOx0zHAw'},
  {id:110,espnId:1,name:'Baltimore Orioles',short:'Orioles',division:'American League East',league:'AL',primary:'#DF4601',secondary:'#27251F',youtubeUC:'UCHMHsaIIFGhrrFuJ0YKbmLA'},
  {id:111,espnId:2,name:'Boston Red Sox',short:'Red Sox',division:'American League East',league:'AL',primary:'#BD3039',secondary:'#0D2B56',youtubeUC:'UCoLrny_Oky6BE206kOfTmiw'},
  {id:147,espnId:10,name:'New York Yankees',short:'Yankees',division:'American League East',league:'AL',primary:'#003087',secondary:'#C4CED4',youtubeUC:'UCmAQ_4ELJodnKuNqviK86Dg'},
  {id:139,espnId:30,name:'Tampa Bay Rays',short:'Rays',division:'American League East',league:'AL',primary:'#092C5C',secondary:'#8FBCE6',youtubeUC:'UCZaT7TplNF541ySP8SlHVGA'},
  {id:141,espnId:14,name:'Toronto Blue Jays',short:'Blue Jays',division:'American League East',league:'AL',primary:'#134A8E',secondary:'#1D2D5C',youtubeUC:'UCVPkZh_H6m_stW8hq-2-yNw'},
  {id:145,espnId:4,name:'Chicago White Sox',short:'White Sox',division:'American League Central',league:'AL',primary:'#27251F',secondary:'#C4CED4',youtubeUC:'UCve-Ci-M4CkBOmNi2LQdCRg'},
  {id:114,espnId:5,name:'Cleveland Guardians',short:'Guardians',division:'American League Central',league:'AL',primary:'#E31937',secondary:'#0C2340',youtubeUC:'UCQosdb4G1plIN7QQ32NALSw'},
  {id:116,espnId:6,name:'Detroit Tigers',short:'Tigers',division:'American League Central',league:'AL',primary:'#182d55',secondary:'#f26722',youtubeUC:'UCKKG465DFaJ3Yp-jQHA3jhw'},
  {id:118,espnId:7,name:'Kansas City Royals',short:'Royals',division:'American League Central',league:'AL',primary:'#174885',secondary:'#c0995a',youtubeUC:'UCIlBupBLr5AT3INyqgdZYow'},
  {id:142,espnId:9,name:'Minnesota Twins',short:'Twins',division:'American League Central',league:'AL',primary:'#002B5C',secondary:'#D31145',youtubeUC:'UCQuNhDjCMeTpzlHCbi6Fb4Q'},
  {id:117,espnId:18,name:'Houston Astros',short:'Astros',division:'American League West',league:'AL',primary:'#002D62',secondary:'#EB6E1F',youtubeUC:'UC1bbBpuSgnATb8EJ1vINmzA'},
  {id:108,espnId:3,name:'Los Angeles Angels',short:'Angels',division:'American League West',league:'AL',primary:'#BA0021',secondary:'#003263',youtubeUC:'UCJdHeG_fDYdOT8c07rUpsgQ'},
  {id:133,espnId:11,name:'Oakland Athletics',short:'Athletics',division:'American League West',league:'AL',primary:'#003831',secondary:'#EFB21E',youtubeUC:'UCeiRABiGBQTzpuEYohN_I1Q'},
  {id:136,espnId:12,name:'Seattle Mariners',short:'Mariners',division:'American League West',league:'AL',primary:'#0C2C56',secondary:'#c4ced4',youtubeUC:'UCFy0GbiTJtShy4tKkzl_5qg'},
  {id:140,espnId:13,name:'Texas Rangers',short:'Rangers',division:'American League West',league:'AL',primary:'#003278',secondary:'#C0111F',youtubeUC:'UCZjXWMvOrhc91chSDPDUspA'},
];

const MLB_THEME={id:-1,name:'Default',short:'MLB',primary:'#0E3386',secondary:'#CC3433'};

let activeTeam=TEAMS.find(t=>t.id===121),scheduleData=[],scheduleLoaded=false,rosterData={hitting:[],pitching:[],fielding:[]},statsCache={hitting:[],pitching:[]},currentRosterTab='hitting',currentLeaderTab='hitting',selectedPlayer=null,themeOverride=null,themeInvert=false,savedThemeForPulse=null,themeScope='full';
let newsFeedMode='mlb';
let newsSourceFilter='all';
let newsArticlesCache=[];
const NEWS_SOURCE_LABELS={mlb:'MLB.com',espn:'ESPN',mlbtr:'MLB Trade Rumors',fangraphs:'FanGraphs',cbs:'CBS Sports'};
const NEWS_SOURCE_ICONS={mlb:'⚾',espn:'📺',mlbtr:'💼',fangraphs:'📊',cbs:'🎙️'};

// ── Timing constants ─────────────────────────────────────────────────────────
const TIMING={
  PULSE_POLL_MS:      15000,  // pollLeaguePulse interval
  FOCUS_POLL_MS:       5000,  // pollFocusLinescore / focusFastTimer interval
  LIVE_REFRESH_MS:    30000,  // live game view auto-refresh
  HOME_LIVE_MS:       60000,  // home card live auto-refresh
  LEAGUE_REFRESH_MS:  60000,  // around the league matchup auto-refresh
  STORY_POOL_MS:      30000,  // buildStoryPool rebuild interval
  YESTERDAY_REFRESH_MS: 3600000, // yesterday recap hourly refresh
  CARD_DISMISS_MS:     5500,  // player/RBI card auto-dismiss
  CARD_CLOSE_ANIM_MS:   280,  // card close animation duration
  ALERT_DISMISS_MS:    8000,  // focus soft-alert auto-dismiss
  SIGNIN_CTA_MS:       8000,  // sign-in CTA auto-dismiss
  SYNC_INTERVAL_MS:   30000,  // background collection sync
};

// ── Timer registry — single audit point for all active timer handles ─────────
const TIMERS={
  _h:{},
  set:function(key,handle){if(this._h[key])clearInterval(this._h[key]);this._h[key]=handle;},
  clear:function(key){if(this._h[key]){clearInterval(this._h[key]);this._h[key]=null;}},
  clearAll:function(){Object.keys(this._h).forEach(function(k){if(TIMERS._h[k]){clearInterval(TIMERS._h[k]);TIMERS._h[k]=null;}});}
};

// ── League Pulse globals ──────────────────────────────────────────────────────
const MLB_BASE_V1_1='https://statsapi.mlb.com/api/v1.1';
let pulseInitialized=false;
let rbiCardCooldowns={}; // gamePk → ms timestamp of last key RBI card shown
let gameStates={},feedItems=[],enabledGames=new Set();
let myTeamLens=(localStorage.getItem('mlb_my_team_lens')==='1');
let countdownTimer=null,pulseTimer=null,isFirstPoll=true,pollDateStr=null;
let pulseAbortCtrl=null,focusAbortCtrl=null,liveAbortCtrl=null;
let soundSettings={master:false,hr:true,run:true,risp:true,dp:true,tp:true,gameStart:true,gameEnd:true,error:true};
let screenWakeLock=null;

// ── Session Storage & Sync globals ────────────────────────────────────────────
let mlbSessionToken=null;
let mlbAuthUser=null;
let mlbSyncInterval=null;
let shownSignInCTA=false;let signInCTACardCount=0;let signInCTATimer=null;

// ── Story Carousel globals (v2.7.1) ──────────────────────────────────────────
let storyPool=[],storyShownId=null,storyRotateTimer=null,storyPoolTimer=null,yesterdayRefreshTimer=null;
let onThisDayCache=null,yesterdayCache=null,dailyLeadersCache=null,dailyLeadersLastFetch=0;
let tomorrowPreview={dateStr:null,firstPitchMs:null,gameTime:null,gameCount:0,fetchedAt:0,inFlight:false};
let dailyHitsTracker={},dailyPitcherKs={},stolenBaseEvents=[];
let storyCarouselRawGameData={};
let probablePitcherStatsCache={};
let hrBatterStatsCache={};
let boxscoreCache={};
let inningRecapsFired=new Set(),inningRecapsPending={},lastInningState={},displayedStoryIds=new Set();
let transactionsCache=[],transactionsLastFetch=0;
let highLowCache=null,highLowLastFetch=0;
let liveWPCache={},liveWPLastFetch=0;
let perfectGameTracker={};

// ── Dev Tools tuning (real-time optimization) ──────────────────────────
let devTuning={
  rotateMs: 4500,          // Carousel rotation interval
  rbiThreshold: 10,        // Minimum RBI card score
  rbiCooldown: 90000,      // Per-game cooldown (ms)
  hr_priority: 100,
  hr_cooldown: 300000,     // 5 min
  biginning_priority: 75,
  biginning_threshold: 3,  // scoring plays per inning half
  walkoff_priority: 90,
  walkoff_cooldown: 300000,
  nohitter_inning_floor: 6,
  nohitter_priority: 95,
  basesloaded_enable: true,
  basesloaded_priority: 88,
  focus_critical: 120,       // score threshold for CRITICAL badge
  focus_high: 70,            // score threshold for HIGH badge
  focus_switch_margin: 25,   // rival game must score this much higher to trigger soft alert
  focus_alert_cooldown: 90000, // ms between soft alerts for same game
  hitstreak_floor: 10,       // min streak length to show hitting streak story
  hitstreak_priority: 65,    // base priority for hitting streak stories
  roster_priority_il: 40,    // priority for IL/DFA stories
  roster_priority_trade: 55, // priority for trade / call-up stories
  wp_leverage_floor: 2,      // min leverageIndex to show WP story
  wp_extreme_floor: 85,      // win probability % threshold for "extreme" story
  award_priority: 55,        // priority for award winner stories
  highlow_priority: 25,      // priority for season high/low stories
  livewp_priority: 30,       // priority for ambient live-game WP cards
  livewp_refresh_ms: 90000   // ms between contextMetrics batch refreshes
};
let devColorLocked=false;
let devShowPushOnDesktop=false;
let devColorOverrides={
  app:{dark:'',card:'',card2:'',border:'',primary:'',secondary:'',accent:'',accentText:'',headerText:''},
  pulse:{dark:'',card:'',card2:'',border:'',primary:'',secondary:'',accent:'',accentText:'',headerText:''}
};
const devTuningDefaults={
  rotateMs:4500,rbiThreshold:10,rbiCooldown:90000,
  hr_priority:100,hr_cooldown:300000,
  biginning_priority:75,biginning_threshold:3,
  walkoff_priority:90,walkoff_cooldown:300000,
  nohitter_inning_floor:6,nohitter_priority:95,
  basesloaded_enable:true,basesloaded_priority:88,
  focus_critical:120,focus_high:70,focus_switch_margin:25,focus_alert_cooldown:90000,
  hitstreak_floor:10,hitstreak_priority:65,roster_priority_il:40,roster_priority_trade:55,
  wp_leverage_floor:2,wp_extreme_floor:85,award_priority:55,highlow_priority:25,
  livewp_priority:30,livewp_refresh_ms:90000
};

// ── Focus Mode globals (v2.61) ────────────────────────────────────────────────
let focusGamePk=null;
let focusIsManual=false;
let focusFastTimer=null;
let focusCurrentAbIdx=null;
let focusState={
  balls:0,strikes:0,outs:0,inning:1,halfInning:'top',
  currentBatterId:null,currentBatterName:'',
  currentPitcherId:null,currentPitcherName:'',
  onFirst:false,onSecond:false,onThird:false,
  awayAbbr:'',homeAbbr:'',awayScore:0,homeScore:0,
  awayPrimary:'#444',homePrimary:'#444',
  tensionLabel:'NORMAL',tensionColor:'#9aa0a8',
  lastPitch:null,
  batterStats:null,pitcherStats:null
};
let focusPitchSequence=[];
let focusStatsCache={};
let focusLastTimecode=null;
let focusAlertShown={};   // gamePk → ms timestamp of last soft alert (90s cooldown)
let focusOverlayOpen=false;
let tabHiddenAt=null;     // ms timestamp when tab went hidden; null when visible
let collectionFilter='all';         // 'all' | 'HR' | 'RBI'
let collectionSort='newest';        // 'newest' | 'rarity' | 'team'
let collectionPage=0;               // 0-indexed page for binder display
let collectionCareerStatsCache={};  // playerId → career stat object (session-only)
let lastCollectionResult=null;      // {type,playerName,eventType,tier} — set by collectCard, read by flashCollectionRailMessage
let collectionSlotsDisplay=[];      // sorted slot array set by renderCollectionBook; openCardFromCollection indexes into this

// ── Yesterday Recap globals (v3.19.1) ─────────────────────────────────────────
let yesterdayContentCache={};      // gamePk → content API response (session-only)
let liveContentCache={};           // gamePk → {items:[],fetchedAt:ms} — re-fetched if >5min stale
let lastVideoClip=null;            // most recent matched live clip — used by dev tool
let videoClipPollTimer=null;
let yesterdayOverlayOpen=false;
let ydHighlightClips=[];           // top-5 editorial clips for the carousel (session)
let ydDateOffset=-1;               // days relative to today shown in recap; -1=yesterday (default)
let ydDisplayCache=null;           // non-null when showing a date other than yesterday; avoids polluting yesterdayCache used by story carousel

function getYdActiveCache(){return ydDisplayCache!==null?ydDisplayCache:(yesterdayCache||[]);}

// ── Demo Mode globals ──────────────────────────────────────────────────────────
let demoMode=false,demoGamesCache=[],demoPlayQueue=[],demoPlayIdx=0,demoTimer=null,demoStartTime=0,demoDate=null,demoCurrentTime=0;
// ── Side Rail News globals ──────────────────────────────────────────────────────
let mlbNewsFeed=[],newsCardIndex=0,newsRotateTimer=null;
const NEWS_ROTATE_MS=30000;

function tcLookup(id){var t=TEAMS.find(function(t){return t.id===id;});return t?{primary:t.primary,abbr:t.short,name:t.name}:{primary:'#444',abbr:'???',name:'Unknown'};}
async function fetchBoxscore(gamePk){
  if(!boxscoreCache[gamePk]){
    try{var bsR=await fetch(MLB_BASE+'/game/'+gamePk+'/boxscore');if(!bsR.ok)throw new Error(bsR.status);boxscoreCache[gamePk]=await bsR.json();}
    catch(e){return null;}
  }
  return boxscoreCache[gamePk];
}

// ── League Pulse functions ────────────────────────────────────────────────────
function initLeaguePulse() {
  initReal();
}
function initReal() {
  var mockBar=document.getElementById('mockBar');
  if(mockBar){mockBar.style.display='none';mockBar.style.setProperty('display','none','important');}
  // Midnight window: at 0–5am local, seed pollDateStr to yesterday so West Coast games are found
  if(!demoMode&&(new Date().getHours())<6){var _d=new Date();_d.setDate(_d.getDate()-1);pollDateStr=localDateStr(_d);}
  else{pollDateStr=localDateStr(getEffectiveDate());}
  loadRoster();
  loadOnThisDayCache(); loadYesterdayCache();
  loadTransactionsCache(); loadHighLowCache();
  if(newsRotateTimer){clearTimeout(newsRotateTimer);newsRotateTimer=null;}
  fetchMLBNewsFeed();
  document.removeEventListener('visibilitychange',onStoryVisibilityChange);
  document.addEventListener('visibilitychange',onStoryVisibilityChange);
  document.removeEventListener('visibilitychange',onNewsVisibilityChange);
  document.addEventListener('visibilitychange',onNewsVisibilityChange);
  pollLeaguePulse().then(function(){buildStoryPool();setFocusGame(focusGamePk);});
  pulseTimer=setInterval(pollLeaguePulse,TIMING.PULSE_POLL_MS);
  if(storyPoolTimer){clearInterval(storyPoolTimer);storyPoolTimer=null;}
  storyPoolTimer=setInterval(buildStoryPool,TIMING.STORY_POOL_MS);
  if(videoClipPollTimer){clearInterval(videoClipPollTimer);videoClipPollTimer=null;}
  videoClipPollTimer=setInterval(pollPendingVideoClips,30*1000);
  if(yesterdayRefreshTimer){clearInterval(yesterdayRefreshTimer);yesterdayRefreshTimer=null;}
  yesterdayRefreshTimer=setInterval(function(){
    loadYesterdayCache().then(function(){
      var ydCard=document.getElementById('yesterdayCard');
      if(ydCard&&ydCard.offsetParent!==null) renderYesterdayRecap();
    });
  },TIMING.YESTERDAY_REFRESH_MS);
}

async function pollLeaguePulse() {
  if(pulseAbortCtrl){pulseAbortCtrl.abort();}
  pulseAbortCtrl=new AbortController();
  var sig=pulseAbortCtrl.signal;
  var hasLive=Object.values(gameStates).some(function(g){return g.status==='Live';});
  // Hoist isMidnightWindow so both the date-flip guard and the yesterday fallback can use it
  var isMidnightWindow=!demoMode&&(new Date().getHours())<6;
  if (!hasLive) {
    // Fix 1: don't flip date while games from the current poll date are still in gameStates
    var hasGamesFromCurrentDate=pollDateStr&&Object.values(gameStates).some(function(g){
      return g.gameDateMs&&localDateStr(new Date(g.gameDateMs))===pollDateStr;
    });
    // Fix 3: safety net — don't advance past midnight until 6 AM local (skip in demo mode)
    if (!hasGamesFromCurrentDate&&!isMidnightWindow) {
      pollDateStr=localDateStr(getEffectiveDate());
    }
    // Day rollover: post-slate past midnight window → prune yesterday + advance to today.
    // Guard pollDateStr<todayStr so PPD-only days don't keep advancing into the future.
    else if (!isMidnightWindow&&isPostSlate()) {
      var todayStr=localDateStr(getEffectiveDate());
      if (pollDateStr<todayStr) {
        pruneStaleGames(todayStr);
        pollDateStr=todayStr;
      }
    }
  }
  var dateStr=pollDateStr;
  try {
    // Fetch from primary date
    var r=await fetch(MLB_BASE+'/schedule?sportId=1&date='+dateStr+'&hydrate=linescore,team,probablePitcher',{signal:sig});
    if(!r.ok) throw new Error(r.status);
    var d=await r.json();
    var games=(d.dates||[]).flatMap(function(dt){return dt.games||[]});

    // Try yesterday if: (a) no games at all, OR (b) midnight window with no live games in fetch
    var hasLiveInFetch=games.some(function(g){return g.status.abstractGameState==='Live';});
    if ((!games.length||(isMidnightWindow&&!hasLiveInFetch)) && !hasLive) {
      var yesterday=new Date();
      yesterday.setDate(yesterday.getDate()-1);
      var yDateStr=localDateStr(yesterday);
      var yr=await fetch(MLB_BASE+'/schedule?sportId=1&date='+yDateStr+'&hydrate=linescore,team,probablePitcher',{signal:sig});
      if(!yr.ok) throw new Error(yr.status);
      var yd=await yr.json();
      var yGames=(yd.dates||[]).flatMap(function(dt){return dt.games||[]});
      if (yGames.length) {
        games=yGames;
        dateStr=yDateStr;
        pollDateStr=dateStr;
      }
    }
    storyCarouselRawGameData={};
    games.forEach(function(g){storyCarouselRawGameData[g.gamePk]=g;});
    var pendingFinalItems={};
    games.forEach(function(g) {
      var pk=g.gamePk, newStatus=g.status.abstractGameState, detailed=g.status.detailedState||'';
      var away=g.teams.away, home=g.teams.home;
      var awayTc=tcLookup(away.team.id), homeTc=tcLookup(home.team.id);
      var ls=g.linescore||{}, gameTime=null, gameDateMs=null;
      if (g.gameDate) {
        try { var gd=new Date(g.gameDate); gameTime=gd.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}); gameDateMs=gd.getTime(); } catch(e){}
      }
      if (!gameStates[pk]) {
        gameStates[pk]={
          gamePk:pk, awayId:away.team.id, homeId:home.team.id,
          awayAbbr:away.team.abbreviation, homeAbbr:home.team.abbreviation,
          awayName:away.team.name, homeName:home.team.name,
          awayPrimary:awayTc.primary, homePrimary:homeTc.primary,
          awayScore:away.score||0, homeScore:home.score||0,
          awayW:away.leagueRecord?away.leagueRecord.wins:null, awayL:away.leagueRecord?away.leagueRecord.losses:null,
          homeW:home.leagueRecord?home.leagueRecord.wins:null, homeL:home.leagueRecord?home.leagueRecord.losses:null,
          status:newStatus, detailedState:detailed,
          inning:ls.currentInning||1, halfInning:(ls.inningHalf||'Top').toLowerCase(), outs:ls.outs||0,
          awayHits:ls.teams&&ls.teams.away?ls.teams.away.hits||0:0, homeHits:ls.teams&&ls.teams.home?ls.teams.home.hits||0:0,
          playCount:0, lastTimestamp:null, gameTime:gameTime, gameDateMs:gameDateMs,
          venueName:g.venue?g.venue.name:null,
          onFirst:!!(ls.offense&&ls.offense.first), onSecond:!!(ls.offense&&ls.offense.second), onThird:!!(ls.offense&&ls.offense.third),
        };
        if (!myTeamLens || gameStates[pk].awayId===activeTeam.id || gameStates[pk].homeId===activeTeam.id) enabledGames.add(pk);
        // Synthesise historical status items so they appear on first load (no sounds/alerts)
        var g0=gameStates[pk], ts0=gameDateMs?new Date(gameDateMs):new Date();
        if (newStatus==='Final') {
          var isHistPpd=detailed==='Postponed'||detailed==='Cancelled'||detailed==='Suspended';
          if (isHistPpd) {
            if (!gameDateMs||Date.now()>=gameDateMs) addFeedItem(pk,{type:'status',icon:'🌧️',label:'Game Postponed',sub:g0.awayAbbr+' @ '+g0.homeAbbr,playTime:ts0});
          } else {
            var durLabel=ls.gameDurationMinutes?'  ·  '+Math.floor(ls.gameDurationMinutes/60)+'h '+String(ls.gameDurationMinutes%60).padStart(2,'0')+'m':'';
            pendingFinalItems[pk]={sub:g0.awayAbbr+' '+(away.score||0)+', '+g0.homeAbbr+' '+(home.score||0)+durLabel};
          }
        } else if (newStatus==='Live'&&detailed==='In Progress') {
          addFeedItem(pk,{type:'status',icon:'⚾',label:'Game underway!',sub:g0.awayAbbr+' @ '+g0.homeAbbr,playTime:ts0});
        } else if (detailed.toLowerCase().indexOf('delay')!==-1) {
          addFeedItem(pk,{type:'status',icon:'🌧️',label:'Game Delayed',sub:g0.awayAbbr+' @ '+g0.homeAbbr+' · '+detailed,playTime:ts0});
        }
      } else {
        var prev=gameStates[pk];
        if (gameTime) prev.gameTime=gameTime; if (gameDateMs) prev.gameDateMs=gameDateMs;
        if (prev.detailedState!=='In Progress'&&detailed==='In Progress') {
          addFeedItem(pk,{type:'status',icon:'⚾',label:'Game underway!',sub:prev.awayAbbr+' @ '+prev.homeAbbr});
          playSound('gameStart');
        }
        if (prev.status!=='Final'&&newStatus==='Final') {
          var isGamePostponed=detailed==='Postponed'||detailed==='Cancelled'||detailed==='Suspended';
          if(isGamePostponed){addFeedItem(pk,{type:'status',icon:'🌧️',label:'Game Postponed',sub:prev.awayAbbr+' @ '+prev.homeAbbr});}
          else{addFeedItem(pk,{type:'status',icon:'🏁',label:'Game Final',sub:prev.awayAbbr+' '+(away.score||0)+', '+prev.homeAbbr+' '+(home.score||0)});playSound('gameEnd');}
          delete perfectGameTracker[pk];
        }
        if (detailed.toLowerCase().indexOf('delay')!==-1&&prev.detailedState.toLowerCase().indexOf('delay')===-1) {
          addFeedItem(pk,{type:'status',icon:'🌧️',label:'Game Delayed',sub:prev.awayAbbr+' @ '+prev.homeAbbr+' · '+detailed});
        }
        prev.detailedState=detailed; prev.status=newStatus;
        prev.awayScore=away.score||0; prev.homeScore=home.score||0;
        prev.inning=ls.currentInning||prev.inning; prev.halfInning=(ls.inningHalf||'Top').toLowerCase();
        prev.outs=ls.outs||0;
        if (ls.teams&&ls.teams.away) prev.awayHits=ls.teams.away.hits||0;
        if (ls.teams&&ls.teams.home) prev.homeHits=ls.teams.home.hits||0;
        prev.onFirst=!!(ls.offense&&ls.offense.first); prev.onSecond=!!(ls.offense&&ls.offense.second); prev.onThird=!!(ls.offense&&ls.offense.third);
      }
    });
    var liveGames=games.filter(function(g){return g.status.abstractGameState==='Live'||pendingFinalItems[g.gamePk];});
    await Promise.all(liveGames.map(function(g){return pollGamePlays(g.gamePk);}));
    Object.keys(pendingFinalItems).forEach(function(pk) {
      var pf=pendingFinalItems[pk];
      var gamePlays=feedItems.filter(function(fi){return fi.gamePk==pk&&fi.data&&fi.data.type==='play';});
      if (gamePlays.length>0) addFeedItem(+pk,{type:'status',icon:'🏁',label:'Game Final',sub:pf.sub,playTime:new Date(gamePlays[0].ts.getTime()+60000)});
    });
    if (isFirstPoll&&feedItems.length>0){feedItems.sort(function(a,b){return b.ts-a.ts;});renderFeed();}
    isFirstPoll=false;
    updateInningStates();
    renderTicker(); updateFeedEmpty();
    renderSideRailGames();
    pollPendingVideoClips();
    selectFocusGame();
    refreshDebugPanel();
  } catch(e){if(e.name!=='AbortError')console.error('poll error',e);}
}

async function pollGamePlays(gamePk) {
  try {
    var g=gameStates[gamePk]; if (!g) return;
    var tsResp=await fetch(MLB_BASE_V1_1+'/game/'+gamePk+'/feed/live/timestamps');
    if(!tsResp.ok) throw new Error(tsResp.status);
    var tsData=await tsResp.json();
    var latestTs=Array.isArray(tsData)?tsData[tsData.length-1]:null;
    if (latestTs&&latestTs===g.lastTimestamp) return;
    if (latestTs) g.lastTimestamp=latestTs;
    var r=await fetch(MLB_BASE+'/game/'+gamePk+'/playByPlay');
    if(!r.ok) throw new Error(r.status);
    var data=await r.json();
    var plays=(data.allPlays||[]).filter(function(p){return p.about&&p.about.isComplete;});
    var lastCount=g.playCount||0, isHistory=(lastCount===0&&plays.length>0)||tabHiddenAt!==null;
    plays.slice(lastCount).forEach(function(play) {
      var event=(play.result&&play.result.event)||'';
      var isScoringP=(play.about&&play.about.isScoringPlay)||false;
      var aScore=(play.result&&play.result.awayScore!=null)?play.result.awayScore:g.awayScore;
      var hScore=(play.result&&play.result.homeScore!=null)?play.result.homeScore:g.homeScore;
      var inning=(play.about&&play.about.inning)||g.inning;
      var halfInning=(play.about&&play.about.halfInning)||g.halfInning;
      var outs=(play.count&&play.count.outs)||0;
      var desc=(play.result&&play.result.description)||'—';
      var batterId=(play.matchup&&play.matchup.batter&&play.matchup.batter.id)||null;
      var batterName=(play.matchup&&play.matchup.batter&&play.matchup.batter.fullName)||'';
      var runners=play.runners||[];
      if (event.indexOf('Stolen Base')!==-1) {
        if (!isHistory) {
          var sbRunner=runners.find(function(r){return r.details&&r.details.eventType&&r.details.eventType.indexOf('stolen_base')!==-1;});
          var sbRunnerId=(sbRunner&&sbRunner.details&&sbRunner.details.runner&&sbRunner.details.runner.id)||batterId;
          var sbRunnerName=(sbRunner&&sbRunner.details&&sbRunner.details.runner&&sbRunner.details.runner.fullName)||batterName;
          var sbBase=event.indexOf('Home')!==-1?'home':event.indexOf('3B')!==-1?'3B':'2B';
          var sbKey=gamePk+'_'+(play.about&&play.about.atBatIndex!=null?play.about.atBatIndex:g.playCount+plays.indexOf(play));
          if (!stolenBaseEvents.some(function(e){return e.key===sbKey;})) {
            stolenBaseEvents.push({key:sbKey,gamePk:gamePk,runnerId:sbRunnerId,runnerName:sbRunnerName,base:sbBase,inning:inning,halfInning:halfInning,awayAbbr:g.awayAbbr,homeAbbr:g.homeAbbr,ts:playTime||new Date()});
          }
        }
        return; // carousel only — skip feed item
      }
      var hasRISP=outs<3&&runners.some(function(r){return r.movement&&!r.movement.isOut&&(r.movement.end==='2B'||r.movement.end==='3B');});
      var playClass=event==='Home Run'?'homerun':isScoringP?'scoring':hasRISP?'risp':'normal';
      var playTime=null; if (play.about&&play.about.startTime){try{playTime=new Date(play.about.startTime);}catch(e){}}
      var pitcherId=(play.matchup&&play.matchup.pitcher&&play.matchup.pitcher.id)||null;
      var pitcherName=(play.matchup&&play.matchup.pitcher&&play.matchup.pitcher.fullName)||'';
      var hrDistance=(event==='Home Run'&&play.hitData&&play.hitData.totalDistance>0)?Math.round(play.hitData.totalDistance):null;
      addFeedItem(gamePk,{type:'play',event:event,desc:desc,scoring:isScoringP,awayScore:aScore,homeScore:hScore,inning:inning,halfInning:halfInning,outs:outs,risp:hasRISP,playClass:playClass,playTime:playTime,batterId:batterId,batterName:batterName,pitcherName:pitcherName,distance:hrDistance});
      var isHitEvt=['Single','Double','Triple','Home Run'].indexOf(event)!==-1;
      if(perfectGameTracker[gamePk]===undefined) perfectGameTracker[gamePk]=true;
      if(['Walk','Hit By Pitch','Intentional Walk','Error','Fielders Choice','Catcher Interference'].indexOf(event)!==-1) perfectGameTracker[gamePk]=false;
      if(isHitEvt) perfectGameTracker[gamePk]=false;
      if (isHitEvt&&batterId){var dh=dailyHitsTracker[batterId]||{name:batterName,hits:0,hrs:0,gamePk:gamePk};dh.hits++;if(event==='Home Run')dh.hrs++;dh.name=batterName||dh.name;dh.gamePk=gamePk;dailyHitsTracker[batterId]=dh;}
      if (event==='Strikeout'&&pitcherId){var kkey=gamePk+'_'+pitcherId;var ke=dailyPitcherKs[kkey]||{name:pitcherName,ks:0,gamePk:gamePk};ke.ks++;ke.name=pitcherName||ke.name;dailyPitcherKs[kkey]=ke;}
      if (!isHistory) {
        var teamColor=halfInning==='top'?g.awayPrimary:g.homePrimary;
        var gameVisible=enabledGames.has(gamePk);
        if (event==='Home Run'){playSound('hr');if(batterId&&gameVisible){var _hrRbi=(play.result&&play.result.rbi!=null)?play.result.rbi:1;var _badge=getHRBadge(_hrRbi,halfInning,inning,aScore,hScore);showPlayerCard(batterId,batterName,g.awayId,g.homeId,halfInning,null,desc,_badge,gamePk);}}
        else if (isScoringP){var _rbi=(play.result&&play.result.rbi!=null)?play.result.rbi:0;var _rs=calcRBICardScore(_rbi,event,aScore,hScore,inning,halfInning);var _rbiOk=(Date.now()-(rbiCardCooldowns[gamePk]||0))>=devTuning.rbiCooldown;
if(_rbi>0&&_rs>=devTuning.rbiThreshold&&gameVisible&&batterId&&_rbiOk){rbiCardCooldowns[gamePk]=Date.now();showRBICard(batterId,batterName,g.awayId,g.homeId,halfInning,_rbi,event,aScore,hScore,inning,gamePk);}else{if(gameVisible)showAlert({icon:'🟢',event:'RUN SCORES · '+g.awayAbbr+' '+aScore+', '+g.homeAbbr+' '+hScore,desc:desc,color:teamColor,duration:4000});}playSound('run');}
        else if (event.indexOf('Triple Play')!==-1){if(gameVisible)showAlert({icon:'🔀',event:'TRIPLE PLAY · '+g.awayAbbr+' @ '+g.homeAbbr,desc:desc,color:'#9b59b6',duration:5000});playSound('tp');}
        else if (event.indexOf('Double Play')!==-1||event.indexOf('Grounded Into DP')!==-1){playSound('dp');}
        else if (event.indexOf('Error')!==-1){playSound('error');}
        else if (hasRISP){playSound('risp');}
        if(outs===3){var _rk=gamePk+'_'+inning+'_'+halfInning.toLowerCase();if(!inningRecapsFired.has(_rk))inningRecapsPending[_rk]={gamePk:gamePk,inning:inning,halfInning:halfInning.toLowerCase()};}
      }
    });
    // Patch Statcast distance and HR number into existing HR feed items once the data arrives
    plays.forEach(function(play){
      if(play.result&&play.result.event==='Home Run'){
        var newDesc=(play.result.description)||'';
        var pt=null;try{if(play.about&&play.about.startTime)pt=new Date(play.about.startTime);}catch(e){}
        var found=feedItems.find(function(i){return i.gamePk===gamePk&&i.data&&i.data.event==='Home Run'&&pt&&i.ts&&Math.abs(i.ts.getTime()-pt.getTime())<5000;});
        if(found){
          if(!found.data.distance&&play.hitData&&play.hitData.totalDistance>0) found.data.distance=Math.round(play.hitData.totalDistance);
          if(newDesc.match(/\(\d+\)/)&&!(found.data.desc||'').match(/\(\d+\)/)) found.data.desc=newDesc;
        }
      }
    });
    g.playCount=plays.length;
  } catch(e){}
}

// ── Demo State Export ────────────────────────────────────────────────────────────
function exportPulseStateAsSnapshot(){
  var snapshot={
    metadata:{exportedAt:new Date().toISOString(),season:SEASON},
    gameStates:gameStates,
    feedItems:feedItems.map(function(item){return{gamePk:item.gamePk,playTime:item.playTime.toISOString(),type:item.type,event:item.event,desc:item.desc,badge:item.badge,scoring:item.scoring,inning:item.inning,halfInning:item.halfInning,outs:item.outs,awayScore:item.awayScore,homeScore:item.homeScore,data:item.data};}),
    dailyLeadersCache:dailyLeadersCache||{},
    onThisDayCache:onThisDayCache||[],
    yesterdayCache:yesterdayCache||[],
    hrBatterStatsCache:hrBatterStatsCache,
    probablePitcherStatsCache:probablePitcherStatsCache,
    dailyHitsTracker:dailyHitsTracker,
    dailyPitcherKs:dailyPitcherKs,
    storyCarouselRawGameData:storyCarouselRawGameData,
    stolenBaseEvents:stolenBaseEvents,
    scheduleData:scheduleData
  };
  localStorage.setItem('mlb_demo_snapshot',JSON.stringify(snapshot));
  var json=JSON.stringify(snapshot,null,2);
  var modal=document.createElement('div');
  modal.style.cssText='position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.8);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px';
  modal.innerHTML='<div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:20px;max-width:600px;width:100%;max-height:80vh;display:flex;flex-direction:column">'
    +'<div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:12px">📸 Pulse State Exported</div>'
    +'<textarea id="exportJson" style="flex:1;background:var(--card2);border:1px solid var(--border);color:var(--muted);padding:12px;border-radius:8px;font-family:monospace;font-size:11px;resize:none;margin-bottom:12px">'+json+'</textarea>'
    +'<div style="display:flex;gap:10px">'
    +'<button onclick="var el=document.getElementById(\'exportJson\');navigator.clipboard.writeText(el.value).then(function(){alert(\'Copied!\');},function(){try{el.select();document.execCommand(\'copy\');alert(\'Copied!\');}catch(e){alert(\'Copy failed — please copy manually.\');}});this.parentElement.parentElement.parentElement.remove();" style="flex:1;background:var(--secondary);color:var(--accent-text);border:none;padding:10px;border-radius:6px;cursor:pointer;font-weight:600">📋 Copy</button>'
    +'<button onclick="this.parentElement.parentElement.parentElement.remove()" style="flex:1;background:var(--card2);color:var(--text);border:1px solid var(--border);padding:10px;border-radius:6px;cursor:pointer;font-weight:600">Close</button>'
    +'</div>'
    +'</div>';
  document.body.appendChild(modal);
  modal.onclick=function(e){if(e.target===modal)modal.remove();};
}

// ── Demo Mode Functions ──────────────────────────────────────────────────────────
async function loadDailyEventsJSON(){
  try{
    var r=await fetch('./daily-events.json');
    if(!r.ok) return null;
    var data=await r.json();
    if(data.feedItems){
      data.feedItems.forEach(function(item){
        if(item.playTime&&typeof item.playTime==='string'){
          item.playTime=new Date(item.playTime);
        }
        if(item.playTime&&!item.ts) item.ts=item.playTime;
      });
    }
    if(data.onThisDayCache){
      data.onThisDayCache.forEach(function(item){
        if(item.ts&&typeof item.ts==='string'){
          item.ts=new Date(item.ts);
        }
      });
    }
    if(data.yesterdayCache){
      data.yesterdayCache.forEach(function(item){
        if(item.ts&&typeof item.ts==='string'){
          item.ts=new Date(item.ts);
        }
      });
    }
    if(DEBUG) console.log('Demo: Loaded daily-events.json —',Object.keys(data.gameStates).length,'games,',data.feedItems.length,'plays');
    return data;
  }catch(e){
    console.error('Demo: Failed to load daily-events.json',e);
    return null;
  }
}

function getEffectiveDate(){
  return demoMode&&demoDate?demoDate:new Date();
}

function updateDemoBtnLabel(){
  var lbl=document.getElementById('demoBtnLabel');
  if(lbl) lbl.textContent=demoMode?'⏹ Exit Demo':'▶ Try Demo';
}

function toggleDemoMode() {
  if(demoMode) exitDemo();
  else initDemo();
  updateDemoBtnLabel();
}

async function initDemo() {
  if (pulseTimer) { clearInterval(pulseTimer); pulseTimer = null; }
  if (pulseAbortCtrl) { pulseAbortCtrl.abort(); pulseAbortCtrl = null; }
  if (storyRotateTimer) { clearInterval(storyRotateTimer); storyRotateTimer = null; }
  demoMode=true;
  pulseMockMode=false;
  document.body.classList.add('demo-active');
  var pulseSection=document.getElementById('pulse');
  if(pulseSection) pulseSection.classList.add('active');
  var main=document.getElementById('main');
  if(main) main.style.display='none';
  var feedWrap=document.getElementById('feedWrap');
  if(feedWrap) feedWrap.style.display='block';
  demoSpeedMs=10000;
  demoPaused=false;
  var mockBar=document.getElementById('mockBar');
  if(mockBar){
    mockBar.style.display='block';
    var badge=document.getElementById('mockBarBadge');
    if(badge) badge.textContent='📽️ Demo';
    document.getElementById('demoSpeed1x').style.display='';
    document.getElementById('demoSpeed10x').style.display='';
    document.getElementById('demoSpeed100x').style.display='';
    document.getElementById('demoSpeed1x').classList.add('active');
    document.getElementById('demoNextHRBtn').style.display='';
    document.getElementById('demoPauseBtn').style.display='';
    document.getElementById('demoForwardBtn').style.display='';
    document.getElementById('demoPauseBtn').textContent='⏸ Pause';
  }
  gameStates={};
  feedItems=[];
  scheduleData=[];
  enabledGames=new Set();
  storyPool=[];
  storyShownId=null;
  demoPlayQueue=[];
  demoPlayIdx=0;
  dailyLeadersCache=null;
  onThisDayCache=null;
  yesterdayCache=null;
  hrBatterStatsCache={};
  probablePitcherStatsCache={};
  dailyHitsTracker={};
  dailyPitcherKs={};
  storyCarouselRawGameData={};
  stolenBaseEvents=[];
  inningRecapsFired=new Set();inningRecapsPending={};lastInningState={};
  var jsonData=await loadDailyEventsJSON();
  if(!jsonData||!jsonData.gameStates){
    showAlert({icon:'⚠️',event:'Demo Load Failed',desc:'Could not load daily-events.json',color:'#e85d4f',duration:3000});
    return;
  }
  gameStates=jsonData.gameStates;
  // Reset all games to Preview status so demo replays from the start
  Object.values(gameStates).forEach(function(g){
    g.status='Preview';
    g.detailedState='Scheduled';
    g.inning=0;
    g.halfInning=null;
    g.outs=0;
    g.awayScore=0;
    g.homeScore=0;
    g.onFirst=false;
    g.onSecond=false;
    g.onThird=false;
  });
  feedItems=(jsonData.feedItems||[]).map(function(item){
    var ts=item.ts||item.playTime;
    if(ts&&typeof ts==='string') ts=new Date(ts);
    if(!(ts instanceof Date)) ts=new Date();
    return {gamePk:item.gamePk,data:item.data,ts:ts};
  });
  dailyLeadersCache=jsonData.dailyLeadersCache||null;
  onThisDayCache=jsonData.onThisDayCache||[];
  yesterdayCache=jsonData.yesterdayCache||[];
  hrBatterStatsCache=jsonData.hrBatterStatsCache||{};
  probablePitcherStatsCache=jsonData.probablePitcherStatsCache||{};
  dailyHitsTracker=jsonData.dailyHitsTracker||{};
  dailyPitcherKs=jsonData.dailyPitcherKs||{};
  storyCarouselRawGameData=jsonData.storyCarouselRawGameData||{};
  stolenBaseEvents=jsonData.stolenBaseEvents||[];
  scheduleData=jsonData.scheduleData||[];
  if(jsonData.gameStates){
    var earliestMs=Infinity;
    Object.values(jsonData.gameStates).forEach(function(g){
      if(g.gameDateMs&&g.gameDateMs<earliestMs) earliestMs=g.gameDateMs;
    });
    if(earliestMs!==Infinity) demoDate=new Date(earliestMs);
  }
  feedItems.forEach(function(item){
    if(item.playTime&&typeof item.playTime==='string') item.playTime=new Date(item.playTime);
  });
  onThisDayCache.forEach(function(item){if(item.ts&&typeof item.ts==='string') item.ts=new Date(item.ts);});
  yesterdayCache.forEach(function(item){if(item.ts&&typeof item.ts==='string') item.ts=new Date(item.ts);});
  // For demo mode, only enable games that have play data
  var gamesWithPlays=new Set();
  feedItems.forEach(function(item){if(item.gamePk) gamesWithPlays.add(item.gamePk);});
  Object.keys(gameStates).forEach(function(pk){
    if(demoMode){
      if(gamesWithPlays.has(parseInt(pk))) enabledGames.add(parseInt(pk));
    }else{
      enabledGames.add(parseInt(pk));
    }
  });
  demoPlayQueue=[];
  feedItems.forEach(function(item){
    var ts=item.playTime&&item.playTime.getTime?item.playTime.getTime():(new Date(item.ts)).getTime();
    var d=item.data||{};
    demoPlayQueue.push({
      gamePk:item.gamePk,ts:ts,
      event:d.event,desc:d.desc,type:d.type||'play',inning:d.inning,halfInning:d.halfInning,outs:d.outs,
      awayScore:d.awayScore,homeScore:d.homeScore,scoring:d.scoring,risp:d.risp,playClass:d.playClass,
      playTime:new Date(ts),batterId:d.batterId,batterName:d.batterName,pitcherName:d.pitcherName,distance:d.distance,
      icon:d.icon,label:d.label,sub:d.sub
    });
  });
  demoPlayQueue.sort(function(a,b){return a.ts-b.ts;});
  demoPlayIdx=0;
  // Demo starts at first play (game start notification), carousel context loaded from entire JSON dataset
  demoCurrentTime=demoPlayQueue.length>0?demoPlayQueue[0].ts:0;
  if(DEBUG) console.log('Demo: Loaded',enabledGames.size,'games from',localDateStr(demoDate),',',feedItems.length,'feed items,',demoPlayQueue.length,'plays queued');
  // Clear real feed DOM without rendering (pollDemoFeeds will add items via addFeedItem)
  var feed=document.getElementById('feed');
  if(feed) feed.innerHTML='';
  renderTicker();
  renderSideRailGames();
  await buildStoryPool();
  updateFeedEmpty();
  showAlert({icon:'▶',event:'Demo Mode',desc:enabledGames.size+' games · '+feedItems.length+' plays',color:'#7dd89e',duration:3000});
  if(storyRotateTimer) clearInterval(storyRotateTimer);
  storyRotateTimer=setInterval(rotateStory,devTuning.rotateMs);
  demoStartTime=Date.now();
  updateDemoBtnLabel();
  pollDemoFeeds();
}

async function loadDemoGames() {
  try{
    for(var dayOffset=1;dayOffset<=7;dayOffset++){
      var d=new Date();d.setDate(d.getDate()-dayOffset);
      var dateStr=d.getFullYear()+'-'+(d.getMonth()+1).toString().padStart(2,'0')+'-'+d.getDate().toString().padStart(2,'0');
      if(DEBUG) console.log('Demo: Fetching games from',dateStr);
      var r=await fetch(MLB_BASE+'/schedule?date='+dateStr+'&sportId=1');
      if(!r.ok) continue;
      var data=await r.json();
      var allGames=data.games||[];
      if(DEBUG) console.log('Demo: Found',allGames.length,'total games on',dateStr);
      var games=allGames.filter(function(g){return g.status.abstractGameState==='Final';});
      if(games.length>0){
        if(DEBUG) console.log('Demo: Loaded',games.length,'Final games from',dateStr);
        demoGamesCache=games.map(function(g){
          return{gamePk:g.gamePk,gameDateTime:g.gameDateTime,awayTeam:{id:g.teams.away.team.id,name:g.teams.away.name,shortName:g.teams.away.shortName},homeTeam:{id:g.teams.home.team.id,name:g.teams.home.name,shortName:g.teams.home.shortName},venue:g.venue||'',gameDetails:g};
        });
        return demoGamesCache;
      }
    }
    if(DEBUG) console.warn('Demo: No Final games found in past 7 days');
    return [];
  }catch(e){
    console.error('Demo: loadDemoGames error',e.message);
    return [];
  }
}

async function buildDemoPlayQueue(games) {
  demoPlayQueue=[];
  for(var i=0;i<games.length;i++){
    var g=games[i];
    try{
      var r=await fetch(MLB_BASE+'/game/'+g.gamePk+'/playByPlay');
      if(!r.ok) continue;
      var pbp=await r.json();
      if(pbp.allPlays&&pbp.allPlays.length>0){
        pbp.allPlays.forEach(function(p){
          if(p.result&&p.result.event){
            var evt=p.result.event,scorer=false,desc='',playEvent='other';
            if(['Home Run','Single','Double','Triple'].indexOf(evt)>-1){scorer=true;desc=(p.player?p.player.fullName+' ':'')+(p.result.description||evt);}else{desc=p.result.description||evt;}
            if(evt==='Home Run') playEvent='homerun';
            if(['Single','Double','Triple'].indexOf(evt)>-1) playEvent='hit';
            if(p.about&&p.about.inning&&p.about.halfInning){
              var awayRuns=0,homeRuns=0;
              if(p.liveData&&p.liveData.linescore&&p.liveData.linescore.teams){
                awayRuns=p.liveData.linescore.teams.away&&p.liveData.linescore.teams.away.runs?p.liveData.linescore.teams.away.runs:0;
                homeRuns=p.liveData.linescore.teams.home&&p.liveData.linescore.teams.home.runs?p.liveData.linescore.teams.home.runs:0;
              }
              demoPlayQueue.push({gamePk:g.gamePk,event:evt,desc:desc,scoring:scorer,inn:p.about.inning,half:(p.about.halfInning||'top').toLowerCase(),outs:p.count?p.count.outs:0,awayScore:awayRuns,homeScore:homeRuns,ts:p.about&&p.about.endTime?new Date(p.about.endTime).getTime():Date.now(),type:playEvent});
            }
          }
        });
      }
    }catch(e){
      if(DEBUG) console.warn('Demo: playByPlay error for gamePk',g.gamePk,e.message);
    }
  }
  demoPlayQueue.sort(function(a,b){return a.ts-b.ts;});
  demoPlayIdx=0;
  if(DEBUG) console.log('Demo: Built queue with',demoPlayQueue.length,'plays (real API data only)');
}

async function pollDemoFeeds(){
  if(!demoMode) return;
  if(demoPaused){
    clearTimeout(demoTimer);
    demoTimer=setTimeout(pollDemoFeeds,demoSpeedMs);
    return;
  }
  if(demoPlayIdx>=demoPlayQueue.length){
    renderDemoEndScreen();
    return;
  }
  var play=demoPlayQueue[demoPlayIdx];
  await advanceDemoPlay(play);
  demoPlayIdx++;
  clearTimeout(demoTimer);
  demoTimer=setTimeout(pollDemoFeeds,demoSpeedMs);
}

function setDemoSpeed(ms,btn){
  demoSpeedMs=ms;
  if(btn){
    document.querySelectorAll('#demoSpeed1x,#demoSpeed10x,#demoSpeed100x').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
  }
  if(demoMode&&!demoPaused&&demoTimer){
    clearTimeout(demoTimer);
    demoTimer=setTimeout(pollDemoFeeds,demoSpeedMs);
  }
}

function toggleDemoPause(){
  demoPaused=!demoPaused;
  var btn=document.getElementById('demoPauseBtn');
  if(btn) btn.textContent=demoPaused?'▶ Resume':'⏸ Pause';
  if(!demoPaused&&demoMode) pollDemoFeeds();
}

function backDemoPlay(){
  if(demoPlayIdx>0) demoPlayIdx--;
  clearTimeout(demoTimer);
  if(!demoPaused) pollDemoFeeds();
}

function forwardDemoPlay(){
  if(demoPlayIdx<demoPlayQueue.length) demoPlayIdx++;
  clearTimeout(demoTimer);
  if(!demoPaused) pollDemoFeeds();
}

function demoNextHR(){
  // Find next HR in queue starting from current position
  var nextHRIdx=-1;
  for(var i=demoPlayIdx;i<demoPlayQueue.length;i++){
    if(demoPlayQueue[i].event==='Home Run'){nextHRIdx=i;break;}
  }
  if(nextHRIdx===-1){showAlert({icon:'⚠️',event:'No more HRs',desc:'Reached end of demo',duration:2000});return;}
  // Jump to one before the HR
  demoPlayIdx=nextHRIdx-1;
  clearTimeout(demoTimer);
  // Advance to the HR
  if(demoPlayIdx<demoPlayQueue.length) demoPlayIdx++;
  var play=demoPlayQueue[demoPlayIdx];
  if(play){
    demoCurrentTime=play.ts;
    advanceDemoPlay(play).then(function(){
      demoPlayIdx++;
      demoPaused=true;
      var btn=document.getElementById('demoPauseBtn');
      if(btn) btn.textContent='▶ Resume';
    });
  }
}

async function advanceDemoPlay(play) {
  demoCurrentTime=play.ts;
  var g=gameStates[play.gamePk];
  if(!g) return;
  var feedData={playTime:new Date(play.ts)};
  if(play.type==='status'){
    feedData.type='status';
    feedData.icon=play.icon;
    feedData.label=play.label;
    feedData.sub=play.sub;
    if(play.label==='Game underway!'){
      g.status='Live';
      g.detailedState='In Progress';
    }else if(play.label==='Game Final'){
      g.status='Final';
    }
  }else{
    g.inning=play.inning;
    g.halfInning=play.halfInning;
    g.outs=play.outs;
    g.awayScore=play.awayScore;
    g.homeScore=play.homeScore;
    var badge='';
    if(play.event==='Home Run') badge='HR';
    else if(play.event==='Double') badge='2B';
    else if(play.event==='Triple') badge='3B';
    else if(play.event==='Single') badge='1B';
    feedData.type='play';
    feedData.event=play.event;
    feedData.desc=play.desc;
    feedData.badge=badge;
    feedData.scoring=play.scoring;
    feedData.inning=play.inning;
    feedData.halfInning=play.halfInning;
    feedData.outs=play.outs;
    feedData.awayScore=play.awayScore;
    feedData.homeScore=play.homeScore;
    feedData.risp=play.risp;
    feedData.playClass=play.playClass;
    // Fire alerts and sounds
    if(play.event==='Home Run'){
      playSound('hr');
      if(play.batterId) showPlayerCard(play.batterId,play.batterName||'',g.awayId,g.homeId,play.halfInning,null,play.desc,null,play.gamePk);
    }else if(play.scoring){
      showAlert({icon:'🟢',event:'RUN SCORES · '+g.awayAbbr+' '+play.awayScore+', '+g.homeAbbr+' '+play.homeScore,desc:play.desc,color:g.homePrimary,duration:4000});
      playSound('run');
    }
  }
  addFeedItem(play.gamePk,feedData);
  renderTicker();
  renderSideRailGames();
  await buildStoryPool();
}

function renderDemoEndScreen() {
  demoMode=false;
  clearTimeout(demoTimer);
  if(storyRotateTimer) clearInterval(storyRotateTimer);
  var overlay=document.createElement('div');
  overlay.className='demo-end-screen';
  overlay.innerHTML='<div class="demo-end-card"><div class="demo-end-headline">Demo Complete</div>'
    +'<div class="demo-end-summary">'+demoGamesCache.length+' games &middot; '+demoPlayQueue.length+' plays</div>'
    +'<div class="demo-end-tagline">Ready for live games? Enable Game Start Alerts in Settings.</div>'
    +'<button onclick="exitDemo()" style="margin-top:12px;background:var(--secondary);color:var(--accent-text);border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-weight:600">Exit Demo</button>'
    +'</div>';
  overlay.onclick=function(e){if(e.target===overlay) exitDemo();};
  document.body.appendChild(overlay);
  setTimeout(function(){
    if(document.body.contains(overlay)) exitDemo();
  },4000);
}

function exitDemo() {
  demoMode=false;
  demoPaused=false;
  clearTimeout(demoTimer);
  if(storyRotateTimer) clearInterval(storyRotateTimer);
  if(pulseAbortCtrl){pulseAbortCtrl.abort();pulseAbortCtrl=null;}
  if(focusAbortCtrl){focusAbortCtrl.abort();focusAbortCtrl=null;}
  var overlay=document.querySelector('.demo-end-screen');
  if(overlay) overlay.remove();
  document.body.classList.remove('demo-active');

  // Clear demo state completely
  demoMode=false;
  gameStates={};
  feedItems=[];
  enabledGames=new Set();
  storyPool=[];
  demoPlayQueue=[];
  demoPlayIdx=0;
  storyShownId=null;
  demoCurrentTime=0;
  inningRecapsFired=new Set();inningRecapsPending={};lastInningState={};

  // Aggressive DOM cleanup - wipe feed and ticker directly
  var feed=document.getElementById('feed');
  if(feed) feed.innerHTML='';
  var ticker=document.getElementById('gameTicker');
  if(ticker) ticker.innerHTML='';

  // Hide mock bar controls
  var mockBar=document.getElementById('mockBar');
  if(mockBar){
    mockBar.style.display='none';
    var btnNormal=document.getElementById('btnNormal');
    if(btnNormal) btnNormal.style.display='';
    var btnFast=document.getElementById('btnFast');
    if(btnFast) btnFast.style.display='';
    var btnSkip=document.getElementById('btnSkip');
    if(btnSkip) btnSkip.style.display='';
    var demoSpeed1x=document.getElementById('demoSpeed1x');
    if(demoSpeed1x) demoSpeed1x.style.display='none';
    var demoSpeed10x=document.getElementById('demoSpeed10x');
    if(demoSpeed10x) demoSpeed10x.style.display='none';
    var demoSpeed100x=document.getElementById('demoSpeed100x');
    if(demoSpeed100x) demoSpeed100x.style.display='none';
    var demoNextHRBtn=document.getElementById('demoNextHRBtn');
    if(demoNextHRBtn) demoNextHRBtn.style.display='none';
    var demoPauseBtn=document.getElementById('demoPauseBtn');
    if(demoPauseBtn) demoPauseBtn.style.display='none';
    var demoForwardBtn=document.getElementById('demoForwardBtn');
    if(demoForwardBtn) demoForwardBtn.style.display='none';
    var badge=document.getElementById('mockBarBadge');
    if(badge) badge.textContent='⚡ Mock';
  }

  // Update UI
  updateDemoBtnLabel();

  // Reset poll state so next poll fetches fresh data
  isFirstPoll=true;
  pollDateStr=null;  // Will be set by pollLeaguePulse()

  // Only restore real polling and re-render if staying in Pulse section
  var pulseSection=document.getElementById('pulse');
  var stayingInPulse=pulseSection&&pulseSection.classList.contains('active');

  if(stayingInPulse){
    // Explicitly clear and rebuild feed from empty feedItems
    renderFeed();
    // Render empty state for both feed and ticker immediately
    updateFeedEmpty();
    renderTicker();
    // Re-initialize real polling and story rotation
    if(pulseTimer) clearInterval(pulseTimer);
    pulseTimer=setInterval(pollLeaguePulse,TIMING.PULSE_POLL_MS);
    if(storyRotateTimer) clearInterval(storyRotateTimer);
    storyRotateTimer=setInterval(rotateStory,devTuning.rotateMs);
    // Fetch real data - pollLeaguePulse() will update with actual games/plays
    pollLeaguePulse();
  }else{
    // Exiting demo AND navigating to another section
    // Clear feed to prevent demo content from lingering
    var feed=document.getElementById('feed');
    if(feed) feed.innerHTML='';
    // Don't set feedWrap display - let CSS class logic handle it
    // showSection() will manage which section is visible
  }
}

function renderTicker() {
  var ticker=document.getElementById('gameTicker'), states=Object.values(gameStates);
  states=states.filter(function(g){return g.status==='Live';});
  if (!states.length){
    ticker.innerHTML='<div style="flex:1;display:flex;align-items:center;justify-content:center;padding:20px 12px;min-height:50px;">'
      +'<div style="text-align:center">'
      +'<div style="font-size:24px;margin-bottom:6px">⚾</div>'
      +'<div style="font-size:.81rem;font-weight:600;color:var(--text);margin-bottom:2px">No Live Games</div>'
      +'</div>'
      +'</div>';
    return;
  }
  states.sort(function(a,b){
    var aP=a.inning*2+(a.halfInning==='bottom'?1:0),bP=b.inning*2+(b.halfInning==='bottom'?1:0);
    if(bP!==aP)return bP-aP;
    var aMs=a.gameDateMs||0,bMs=b.gameDateMs||0; if(aMs!==bMs)return aMs-bMs;
    return a.awayAbbr.localeCompare(b.awayAbbr);
  });
  var html='';
  states.forEach(function(g) {
    var isLive=g.status==='Live', isFinal=g.status==='Final';
    var sc=isLive?'status-live':isFinal?'status-final':'status-preview';
    var half=g.halfInning==='top'?'▲':'▼';
    var isPostponed=isFinal&&(g.detailedState==='Postponed'||g.detailedState==='Cancelled'||g.detailedState==='Suspended');
    var innStr=isLive?(half+g.inning):isPostponed?'PPD':isFinal?'FINAL':g.gameTime?g.gameTime:'PRE';
    var warmupClass='';
    if(isLive&&(g.detailedState==='Warmup'||g.detailedState==='Pre-Game')){warmupClass=' warmup-state';}
    var dot=isLive?'<div class="ticker-live-dot'+warmupClass+'"></div>':'';
    var hasRunners=isLive&&(g.onFirst||g.onSecond||g.onThird);
    var fc=enabledGames.has(g.gamePk)?' feed-enabled':' feed-disabled';
    var rc=hasRunners?' has-risp':'';
    var outsHtml='';
    if(isLive){outsHtml='<span class="ticker-outs">'+[0,1,2].map(function(i){return '<span class="out-dot'+(i<g.outs?' out-on':'')+'"></span>';}).join('')+'</span>';}
    if (hasRunners) {
      html+='<div class="ticker-game '+sc+fc+rc+'" onclick="toggleGame('+g.gamePk+')">'
        +'<div class="ticker-top">'+dot
        +'<span class="ticker-score">'+g.awayAbbr+'&nbsp;<strong>'+g.awayScore+'</strong></span>'
        +'<span class="ticker-divider">·</span>'
        +'<span class="ticker-score"><strong>'+g.homeScore+'</strong>&nbsp;'+g.homeAbbr+'</span>'
        +'</div><div class="ticker-bottom">'+baseDiamondSvg(g.onFirst,g.onSecond,g.onThird)
        +'<span class="ticker-inning">'+innStr+'</span>'+outsHtml+'</div></div>';
    } else {
      var spacer=isLive?'<div class="ticker-dot-spacer"></div>':'';
      html+='<div class="ticker-game '+sc+fc+'" onclick="toggleGame('+g.gamePk+')">'
        +'<div class="ticker-row">'+dot+'<span class="ticker-score">'+g.awayAbbr+'&nbsp;<strong>'+g.awayScore+'</strong></span></div>'
        +'<div class="ticker-row">'+spacer+'<span class="ticker-score">'+g.homeAbbr+'&nbsp;<strong>'+g.homeScore+'</strong></span></div>'
        +'<div class="ticker-row"><span class="ticker-inning">'+innStr+'</span>'+outsHtml+'</div></div>';
    }
  });
  ticker.innerHTML=html;
}

function renderSideRailGames() {
  var upcomingHtml='', completedHtml='';
  var upcomingGames=[], completedGames=[];
  var filterDate=demoMode?localDateStr(demoDate):localDateStr(new Date());
  if(demoMode&&DEBUG) console.log('Demo: renderSideRailGames filtering to date',filterDate,'from',Object.keys(gameStates).length,'total games');
  Object.values(gameStates).forEach(function(g) {
    if(demoMode&&localDateStr(new Date(g.gameDateMs))!==filterDate) return;
    if (g.status==='Live') return;
    if (g.status==='Final') completedGames.push(g);
    else upcomingGames.push(g);
  });
  upcomingGames.sort(function(a,b){return (a.gameDateMs||0)-(b.gameDateMs||0);});
  completedGames.sort(function(a,b){return (b.gameDateMs||0)-(a.gameDateMs||0);});
  if (upcomingGames.length) {
    upcomingHtml+='<div class="side-rail-section-header"><span class="side-rail-section-title">Upcoming Today</span><span class="game-count">'+upcomingGames.length+'</span></div>';
    upcomingHtml+='<div class="side-rail-games-container">';
    upcomingGames.forEach(function(g) {
      var time=g.gameTime||'TBD';
      upcomingHtml+='<div class="side-rail-game" onclick="showLiveGame('+g.gamePk+')">'
        +'<span class="side-rail-game-time-badge">'+time+'</span>'
        +'<span class="side-rail-game-dot" style="background:'+g.awayPrimary+'"></span>'
        +'<span class="side-rail-game-abbr">'+g.awayAbbr+'</span>'
        +'<span class="side-rail-game-vs">@</span>'
        +'<span class="side-rail-game-dot" style="background:'+g.homePrimary+'"></span>'
        +'<span class="side-rail-game-abbr">'+g.homeAbbr+'</span>'
        +'</div>';
    });
    upcomingHtml+='</div>';
  }
  if (completedGames.length) {
    completedHtml+='<div class="side-rail-section-header"><span class="side-rail-section-title">Completed</span><span class="game-count">'+completedGames.length+'</span></div>';
    completedHtml+='<div class="side-rail-games-container">';
    completedGames.forEach(function(g) {
      var isPostponed=g.detailedState==='Postponed'||g.detailedState==='Cancelled'||g.detailedState==='Suspended';
      var scoreStr=isPostponed?'PPD':g.awayScore+'-'+g.homeScore;
      completedHtml+='<div class="side-rail-game" onclick="showLiveGame('+g.gamePk+')">'
        +'<span class="side-rail-game-score-badge">'+scoreStr+'</span>'
        +'<span class="side-rail-game-dot" style="background:'+g.awayPrimary+'"></span>'
        +'<span class="side-rail-game-abbr">'+g.awayAbbr+'</span>'
        +'<span class="side-rail-game-vs">@</span>'
        +'<span class="side-rail-game-dot" style="background:'+g.homePrimary+'"></span>'
        +'<span class="side-rail-game-abbr">'+g.homeAbbr+'</span>'
        +'</div>';
    });
    completedHtml+='</div>';
  }
  var gamesHtml=upcomingHtml+completedHtml;
  if (!gamesHtml) gamesHtml='<div style="color:var(--muted);font-size:.75rem;padding:12px;text-align:center;">No games today</div>';
  document.getElementById('sideRailGames').innerHTML=gamesHtml;
}

function fetchMLBNewsFeed() {
  function tryESPN() {
    var url='https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/news?limit=20';
    return fetch(url).then(function(r){
      if(!r.ok) throw new Error('HTTP '+r.status);
      return r.json();
    }).then(function(data){
      try{
        var articles=(data.articles||[]).filter(function(a){return a.headline&&a.headline.length>5;}).slice(0,6);
        var feed=[];
        articles.forEach(function(a){
          var title=a.headline||'';
          var link=(a.links&&a.links.web&&a.links.web.href)||'https://mlb.com';
          var imageUrl='';
          if(a.images&&a.images.length>0) {
            imageUrl=a.images[0].url||'';
          }
          feed.push({title:title,link:link,image:imageUrl});
        });
        if(feed.length>0) {
          if(DEBUG) console.log('[📰 News] ✅ ESPN JSON loaded successfully');
          return feed;
        } else {
          throw new Error('No articles in ESPN response');
        }
      }catch(e){
        if(DEBUG) console.log('[📰 News] ❌ ESPN parse error:',e);
        throw e;
      }
    });
  }
  function tryMLBProxy() {
    return fetch('/api/proxy-rss?feed=mlb').then(function(r){
      if(!r.ok) throw new Error('HTTP '+r.status);
      return r.json();
    }).then(function(data){
      if(!data.success||!data.articles) throw new Error('Invalid proxy response');
      var feed=data.articles.slice(0,6).map(function(a){
        return {title:a.title,link:a.link||'https://mlb.com',image:a.image||''};
      });
      if(feed.length>0) {
        if(DEBUG) console.log('[📰 News] ✅ MLB RSS proxy loaded successfully');
        return feed;
      } else {
        throw new Error('No items in proxy response');
      }
    }).catch(function(e){
      if(DEBUG) console.log('[📰 News] ❌ MLB RSS proxy error:',e);
      throw e;
    });
  }
  tryMLBProxy().then(function(feed){
    mlbNewsFeed=feed;
    renderMLBNewsFeed();
  }).catch(function(proxyErr){
    if(DEBUG) console.log('[📰 News] MLB RSS failed, trying ESPN fallback...');
    tryESPN().then(function(feed){
      mlbNewsFeed=feed;
      renderMLBNewsFeed();
    }).catch(function(e){
      if(DEBUG) console.log('[📰 News] ⚠️ All news sources failed');
      showNewsUnavailable();
    });
  });
}

function showNewsUnavailable() {
  var container=document.getElementById('newsCard');
  if(container) {
    container.innerHTML='<div style="color:var(--muted);font-size:.75rem;padding:20px;text-align:center;">News feed unavailable</div>';
  }
}

function renderMLBNewsFeed() {
  var container=document.getElementById('newsCard');
  if(!mlbNewsFeed.length){
    container.innerHTML='<div style="color:var(--muted);font-size:.75rem;padding:20px;text-align:center;">No news available</div>';
    return;
  }
  newsCardIndex=0;
  var html='';
  mlbNewsFeed.forEach(function(item,idx){
    var active=idx===0?' active':'';
    var imgHtml=isSafeNewsImage(item.image)?'<img class="news-card-image" src="'+forceHttps(item.image)+'" onerror="this.style.display=\'none\'" alt="news">'
      :'<div class="news-card-image" style="background:var(--card2);display:flex;align-items:center;justify-content:center;color:var(--muted);">📰</div>';
    html+='<div class="news-card-item'+active+'">'
      +imgHtml
      +'<div class="news-card-title">'+item.title+'</div>'
      +'<a class="news-card-link" href="'+item.link+'" target="_blank">Read more →</a>'
      +'</div>';
  });
  container.innerHTML=html;
  if(newsRotateTimer){clearTimeout(newsRotateTimer);newsRotateTimer=null;}
  newsRotateTimer=setTimeout(function(){rotateNewsCard();},NEWS_ROTATE_MS);
}

function nextNewsCard() {
  if(!mlbNewsFeed.length) return;
  newsCardIndex=(newsCardIndex+1)%mlbNewsFeed.length;
  showNewsCard(newsCardIndex);
}

function prevNewsCard() {
  if(!mlbNewsFeed.length) return;
  newsCardIndex=(newsCardIndex-1+mlbNewsFeed.length)%mlbNewsFeed.length;
  showNewsCard(newsCardIndex);
}

function showNewsCard(idx) {
  var items=document.querySelectorAll('.news-card-item');
  items.forEach(function(el,i){
    if(i===idx) el.classList.add('active');
    else el.classList.remove('active');
  });
  if(newsRotateTimer) clearTimeout(newsRotateTimer);
  newsRotateTimer=setTimeout(function(){rotateNewsCard();},NEWS_ROTATE_MS);
}

function rotateNewsCard() {
  if(!mlbNewsFeed.length||!pulseInitialized) return;
  newsCardIndex=(newsCardIndex+1)%mlbNewsFeed.length;
  showNewsCard(newsCardIndex);
}

// ── Story Carousel (v2.7.1) ───────────────────────────────────────────────────

function liveOrHighlight(id,eventTs){
  var recent=eventTs&&(Date.now()-eventTs.getTime())<=60000;
  return (recent&&!displayedStoryIds.has(id))?'live':'highlight';
}
function makeStory(id,type,tier,priority,icon,headline,sub,badge,gamePk,ts,cooldownMs,decayRate){
  var existing=storyPool.find(function(s){return s.id===id;});
  return {id:id,type:type,tier:tier,priority:priority,icon:icon,headline:headline,sub:sub,badge:badge,gamePk:gamePk||null,ts:ts||new Date(),lastShown:existing?existing.lastShown:null,cooldownMs:cooldownMs,decayRate:decayRate};
}

function genHRStories(){
  var out=[];
  // Group HR feed items by batterId so multi-homer games collapse into one story
  var hrsByBatter={};
  feedItems.forEach(function(item){
    if(!item.data||item.data.event!=='Home Run') return;
    if(demoMode&&item.ts.getTime()>demoCurrentTime) return;
    var g=gameStates[item.gamePk]; if(!g) return;
    var bid=item.data.batterId||('anon_'+item.gamePk+'_'+item.ts.getTime());
    if(!hrsByBatter[bid]) hrsByBatter[bid]=[];
    hrsByBatter[bid].push({item:item,g:g});
  });
  var multiWords=['','','second','third','fourth','fifth'];
  Object.keys(hrsByBatter).forEach(function(bid){
    var entries=hrsByBatter[bid];
    var latest=entries[entries.length-1];
    var item=latest.item, g=latest.g;
    var count=entries.length;
    var bname=item.data.batterName||'Player';
    // Stats: hrBatterStatsCache (populated by showPlayerCard) → statsCache fallback
    var statObj=hrBatterStatsCache[bid]||(function(){var c=(statsCache.hitting||[]).find(function(e){return e.player&&e.player.id==bid;});return c?c.stat:null;})();
    var statStr='';
    if(statObj&&statObj.homeRuns!=null) statStr=statObj.homeRuns+' HR · '+statObj.rbi+' RBI · '+fmtRate(statObj.avg)+' AVG · '+fmtRate(statObj.ops)+' OPS';
    var sub=g.awayAbbr+' @ '+g.homeAbbr+(statStr?' · '+statStr:'');
    var id, headline, priority;
    if(count===1){
      // Single homer — past tense descriptive
      id='hr_'+item.gamePk+'_'+item.ts.getTime();
      var pitcherStr=item.data.pitcherName?' off '+item.data.pitcherName:'';
      var distStr=item.data.distance?item.data.distance+'ft ':'';
      var innStr=item.data.inning?' in the '+ordinal(item.data.inning)+' inning':'';
      var hrNumMatch=(item.data.desc||'').match(/\((\d+)\)/);
      var hrTag=hrNumMatch?' (HR #'+hrNumMatch[1]+' this season)':'';
      headline=bname+' hit a '+distStr+'homer'+pitcherStr+innStr+hrTag;
      priority=devTuning.hr_priority;
    } else {
      // Multi-homer — replace original story; boost priority
      id='hr_multi_'+bid+'_'+entries[0].item.gamePk+'_'+count;
      var ordWord=multiWords[count]||(count+'th');
      var innStr2=item.data.inning?' in the '+ordinal(item.data.inning)+' inning':'';
      headline=bname+' hits his '+ordWord+' homer of the game'+innStr2+'!';
      priority=devTuning.hr_priority+(count-1)*15;
    }
    out.push(makeStory(id,'realtime',1,priority,'💥',headline,sub,'highlight',item.gamePk,item.ts,devTuning.hr_cooldown,0.5));
  });
  return out;
}

function genNoHitterWatch(){
  var out=[];
  Object.values(gameStates).forEach(function(g){
    if(g.status!=='Live'||g.detailedState!=='In Progress') return;
    if(g.inning<devTuning.nohitter_inning_floor) return;
    var nohitAway=g.awayHits===0, nohitHome=g.homeHits===0;
    if(!nohitAway&&!nohitHome) return;
    var id='nohit_'+g.gamePk;
    var pitchingTeam=nohitAway?g.homeAbbr:g.awayAbbr;
    var hittingTeam=nohitAway?g.awayAbbr:g.homeAbbr;
    var isPerfect=perfectGameTracker[g.gamePk]===true;
    var priority,headline;
    if(isPerfect){
      priority=99;
      headline=pitchingTeam+' working a perfect game through the '+ordinal(g.inning);
    } else {
      priority=devTuning.nohitter_priority;
      headline=pitchingTeam+' working a no-hitter through the '+ordinal(g.inning);
    }
    var sub=hittingTeam+' have 0 hits · '+g.awayAbbr+' '+g.awayScore+', '+g.homeAbbr+' '+g.homeScore;
    out.push(makeStory(id,'nohit',1,priority,'🚫',headline,sub,'live',g.gamePk,new Date(),2*60000,0.2));
  });
  return out;
}

function genWalkOffThreat(){
  var out=[];
  Object.values(gameStates).forEach(function(g){
    if(g.status!=='Live'||g.halfInning!=='bottom'||g.inning<9) return;
    var runnersOn=(g.onFirst?1:0)+(g.onSecond?1:0)+(g.onThird?1:0);
    var deficit=g.awayScore-g.homeScore; // positive = home trailing
    if(deficit<0||deficit>runnersOn+1) return; // home leading, or winning run not at bat
    var id='walkoff_'+g.gamePk+'_'+g.inning;
    var headline='Walk-off situation — '+g.homeAbbr+' in the bottom '+ordinal(g.inning);
    var sub=g.awayAbbr+' '+g.awayScore+', '+g.homeAbbr+' '+g.homeScore+' · '+ordinal(g.inning)+' inning';
    out.push(makeStory(id,'walkoff',1,devTuning.walkoff_priority,'🔔',headline,sub,'live',g.gamePk,new Date(),devTuning.walkoff_cooldown,0.9));
  });
  return out;
}

function genBasesLoaded(){
  if(!devTuning.basesloaded_enable) return [];
  var out=[];
  Object.values(gameStates).forEach(function(g){
    if(g.status!=='Live'||!g.onFirst||!g.onSecond||!g.onThird) return;
    var battingAbbr=g.halfInning==='top'?g.awayAbbr:g.homeAbbr;
    var half=g.halfInning==='top'?'Top':'Bot';
    var id='basesloaded_'+g.gamePk+'_'+g.inning+'_'+g.halfInning;
    var headline='Bases loaded — '+battingAbbr+' batting in the '+ordinal(g.inning);
    var sub=g.awayAbbr+' '+g.awayScore+', '+g.homeAbbr+' '+g.homeScore+' · '+half+' '+ordinal(g.inning);
    out.push(makeStory(id,'realtime',1,devTuning.basesloaded_priority,'🔔',headline,sub,'live',g.gamePk,new Date(),3*60000,0.8));
  });
  return out;
}

function genStolenBaseStories(){
  var out=[];
  stolenBaseEvents.forEach(function(sb){
    var isHome=sb.base==='home';
    var baseLabel=isHome?'home plate':sb.base;
    var halfInd=sb.halfInning==='top'?'▲':'▼';
    var sub=sb.awayAbbr+' @ '+sb.homeAbbr+' · '+halfInd+sb.inning;
    var sbId='sb_'+sb.key;
    out.push(makeStory(sbId,'realtime',isHome?1:2,isHome?85:55,'🏃',
      sb.runnerName+' steals '+baseLabel,sub,liveOrHighlight(sbId,sb.ts),sb.gamePk,sb.ts,5*60000,0.7));
  });
  return out;
}

function genBigInning(){
  var out=[], groups={};
  feedItems.forEach(function(item){
    if(!item.data||item.data.type!=='play'||!item.data.scoring) return;
    if(demoMode&&item.ts.getTime()>demoCurrentTime) return;
    var key=item.gamePk+'_'+item.data.inning+'_'+item.data.halfInning;
    if(!groups[key]) groups[key]={gamePk:item.gamePk,inning:item.data.inning,half:item.data.halfInning,runs:0,lastItem:item};
    groups[key].runs++;
    groups[key].lastItem=item;
  });
  Object.values(groups).forEach(function(grp){
    if(grp.runs<devTuning.biginning_threshold) return;
    var g=gameStates[grp.gamePk]; if(!g) return;
    var id='biginning_'+grp.gamePk+'_'+grp.inning+'_'+grp.half;
    var battingTeam=grp.half==='top'?g.awayAbbr:g.homeAbbr;
    var headline=battingTeam+' scored '+grp.runs+' runs in the '+ordinal(grp.inning);
    var sub=g.awayAbbr+' @ '+g.homeAbbr;
    out.push(makeStory(id,'realtime',1,devTuning.biginning_priority,'🔥',headline,sub,'highlight',grp.gamePk,grp.lastItem.ts,10*60000,0.4));
  });
  return out;
}

function genFinalScoreStories(){
  var out=[];
  Object.values(gameStates).forEach(function(g){
    if(g.status!=='Final') return;
    if(g.detailedState==='Postponed'||g.detailedState==='Cancelled'||g.detailedState==='Suspended') return;
    var id='final_'+g.gamePk;
    var winner=g.awayScore>g.homeScore?g.awayAbbr:g.homeAbbr;
    var loser=g.awayScore>g.homeScore?g.homeAbbr:g.awayAbbr;
    var ws=Math.max(g.awayScore,g.homeScore), ls=Math.min(g.awayScore,g.homeScore);
    var headline=winner+' defeat '+loser+' '+ws+'-'+ls;
    var sub='Final'+(g.venueName?' · '+g.venueName:'');
    var ts=g.gameDateMs?new Date(g.gameDateMs):new Date();
    out.push(makeStory(id,'game_status',2,80,'🏁',headline,sub,'final',g.gamePk,ts,15*60000,0.3));
  });
  return out;
}

function genStreakStories(){
  var out=[];
  if(!scheduleData||!scheduleData.length) return out;
  var streaksByTeam={};
  scheduleData.filter(function(g){return g.status.abstractGameState==='Final';}).forEach(function(g){
    var away=g.teams.away, home=g.teams.home;
    [away,home].forEach(function(side){
      var teamId=side.team.id;
      if(!streaksByTeam[teamId]) streaksByTeam[teamId]={id:teamId,name:side.team.name,games:[]};
      var isHome=(side===home);
      var myScore=isHome?home.score:away.score;
      var oppScore=isHome?away.score:home.score;
      if(myScore!=null&&oppScore!=null) streaksByTeam[teamId].games.push({win:myScore>oppScore,date:new Date(g.gameDate)});
    });
  });
  Object.values(streaksByTeam).forEach(function(team){
    team.games.sort(function(a,b){return b.date-a.date;});
    var streak=0, isWin=null;
    for(var i=0;i<team.games.length;i++){
      var g=team.games[i];
      if(i===0){isWin=g.win;streak=1;} else if(g.win===isWin){streak++;} else break;
    }
    if(streak<3) return;
    var id='streak_'+team.id+'_'+streak+'_'+(isWin?'W':'L');
    var headline=team.name+(isWin?' on a '+streak+'-game winning streak':' on a '+streak+'-game losing streak');
    out.push(makeStory(id,'streak',2,60,isWin?'🔥':'❄️',headline,'',isWin?'hot':'cold',null,new Date(),20*60000,0.1));
  });
  return out;
}

async function genMultiHitDay(){
  var out=[], dateStr=localDateStr(getEffectiveDate());
  var playerIds=Object.keys(dailyHitsTracker);
  for(var i=0;i<playerIds.length;i++){
    var batterId=playerIds[i];
    var entry=dailyHitsTracker[batterId];
    if(entry.hits<3&&!(entry.hits>=2&&entry.hrs>=1)) continue;
    var id='multihit_'+batterId+'_'+dateStr;
    var h=entry.hits, ab=entry.hits;
    if(!demoMode&&entry.gamePk){
      var bs=await fetchBoxscore(entry.gamePk);
      if(bs){
        var team=bs.teams&&bs.teams.away;
        var found=false;
        if(team&&team.players){Object.keys(team.players).forEach(function(pk){var p=team.players[pk];if(p.person&&p.person.id===parseInt(batterId)){h=p.stats.batting.hits;ab=p.stats.batting.atBats;found=true;}});}
        if(!found){team=bs.teams&&bs.teams.home;if(team&&team.players){Object.keys(team.players).forEach(function(pk){var p=team.players[pk];if(p.person&&p.person.id===parseInt(batterId)){h=p.stats.batting.hits;ab=p.stats.batting.atBats;}});}}
      }
    }
    var hrStr=entry.hrs?' with '+entry.hrs+' HR'+(entry.hrs>1?'s':''):'';
    var headline=demoMode?(entry.name+' goes '+h+'-for-today'+hrStr):(entry.name+' goes '+h+' for '+ab+hrStr);
    var g=gameStates[entry.gamePk]||{};
    var sub=g.awayAbbr&&g.homeAbbr?g.awayAbbr+' @ '+g.homeAbbr:'';
    out.push(makeStory(id,'daily_stat',2,55,'🏏',headline,sub,g.status==='Live'?'live':'today',entry.gamePk,new Date(),15*60000,0.1));
  }
  return out;
}

function genDailyLeaders(){
  var out=[];
  if(!dailyLeadersCache) return out;
  var cats=[
    {key:'homeRuns',       label:'Home Run Leaders',      icon:'🏏', fmtVal:null},
    {key:'battingAverage', label:'Batting Avg Leaders',   icon:'🎯', fmtVal:function(v){return (v+'').replace(/^0\./,'.');}},
    {key:'rbi',            label:'RBI Leaders',            icon:'🏏', fmtVal:null},
    {key:'stolenBases',    label:'Stolen Base Leaders',   icon:'🏃', fmtVal:null},
    {key:'wins',           label:'Pitching Wins Leaders', icon:'⚾', fmtVal:null},
    {key:'saves',          label:'Pitching Saves Leaders',icon:'⚾', fmtVal:null},
  ];
  var today=localDateStr(getEffectiveDate());
  cats.forEach(function(cat){
    var list=dailyLeadersCache[cat.key];
    if(!list||!list.length) return;
    var sub=list.slice(0,5).map(function(p,i){
      if(!p||!p.person) return '';
      var lastName=p.person.fullName.split(' ').slice(1).join(' ')||p.person.fullName;
      var val=cat.fmtVal?cat.fmtVal(p.value):p.value;
      return (i+1)+'. '+lastName+' '+val;
    }).filter(Boolean).join(' · ');
    var id='leader_'+cat.key+'_'+today;
    out.push(makeStory(id,'daily_stat',3,65,cat.icon,'MLB '+cat.label,sub,'leaders',null,new Date(),30*60000,0.05));
  });
  return out;
}

function genPitcherGem(){
  var out=[];
  Object.keys(dailyPitcherKs).forEach(function(key){
    var entry=dailyPitcherKs[key];
    if(entry.ks<8) return;
    var g=gameStates[entry.gamePk]||{};
    var id='kgem_'+key;
    var headline=entry.name+' has '+entry.ks+' strikeouts today';
    var sub=g.awayAbbr&&g.homeAbbr?g.awayAbbr+' @ '+g.homeAbbr+(g.status==='Live'?' · '+ordinal(g.inning):''):'';
    out.push(makeStory(id,'daily_stat',2,58,'⚡',headline,sub,g.status==='Live'?'live':'today',entry.gamePk,new Date(),10*60000,0.2));
  });
  return out;
}

function genOnThisDay(){
  if(!onThisDayCache||!onThisDayCache.length) return [];
  return onThisDayCache.map(function(item){
    return makeStory(item.id,'historical',4,20,item.icon,item.headline,item.sub,'onthisday',item.gamePk,item.ts,60*60000,0.5);
  });
}

function genYesterdayHighlights(){
  if(!yesterdayCache||!yesterdayCache.length) return [];
  return yesterdayCache.map(function(item){
    return makeStory(item.id,'yesterday',4,45,item.icon,item.headline,item.sub,'yesterday',item.gamePk,item.ts,30*60000,0.3);
  });
}

async function fetchMissingHRBatterStats(){
  if(demoMode){if(DEBUG) console.log('Demo: Skipping fetchMissingHRBatterStats API call');return;}
  var ids=[];
  feedItems.forEach(function(item){
    if(!item.data||item.data.event!=='Home Run') return;
    var bid=item.data.batterId;
    if(bid&&!hrBatterStatsCache[bid]) ids.push(bid);
  });
  var unique=[...new Set(ids)];
  if(!unique.length) return;
  await Promise.all(unique.map(async function(id){
    try{
      var r=await fetch(MLB_BASE+'/people/'+id+'/stats?stats=season&season='+SEASON+'&group=hitting');
      if(!r.ok) throw new Error(r.status);
      var d=await r.json();
      var stat=d.stats&&d.stats[0]&&d.stats[0].splits&&d.stats[0].splits[0]&&d.stats[0].splits[0].stat;
      if(stat) hrBatterStatsCache[id]=stat;
    }catch(e){}
  }));
}

async function loadProbablePitcherStats(){
  if(demoMode){if(DEBUG) console.log('Demo: Skipping loadProbablePitcherStats API call');return;}
  var ids=[];
  Object.values(storyCarouselRawGameData).forEach(function(raw){
    var awayPP=raw.teams&&raw.teams.away&&raw.teams.away.probablePitcher;
    var homePP=raw.teams&&raw.teams.home&&raw.teams.home.probablePitcher;
    if(awayPP&&awayPP.id&&!probablePitcherStatsCache[awayPP.id]) ids.push(awayPP.id);
    if(homePP&&homePP.id&&!probablePitcherStatsCache[homePP.id]) ids.push(homePP.id);
  });
  if(!ids.length) return;
  await Promise.all(ids.map(async function(id){
    try{
      var r=await fetch(MLB_BASE+'/people/'+id+'/stats?stats=season&season='+SEASON+'&group=pitching');
      if(!r.ok) throw new Error(r.status);
      var d=await r.json();
      var stat=d.stats&&d.stats[0]&&d.stats[0].splits&&d.stats[0].splits[0]&&d.stats[0].splits[0].stat;
      probablePitcherStatsCache[id]={wins:stat?stat.wins:0,losses:stat?stat.losses:0};
    }catch(e){probablePitcherStatsCache[id]={wins:0,losses:0};}
  }));
}

function genProbablePitchers(){
  var out=[], today=localDateStr(getEffectiveDate());
  var games=[];
  if(demoMode&&DEBUG) console.log('Demo: genProbablePitchers filtering to date',today,'found',Object.values(gameStates).filter(g=>localDateStr(new Date(g.gameDateMs))===today).length,'matching games');

  // Try to find today's games from gameStates (already fetched with probablePitcher by pollLeaguePulse)
  Object.values(gameStates).forEach(function(g){
    if(localDateStr(new Date(g.gameDateMs))===today&&g.awayAbbr&&g.homeAbbr&&g.status!=='Live'&&g.status!=='Final') {
      // Skip DH game 2 while game 1 for the same matchup is already live
      var rawG=storyCarouselRawGameData&&storyCarouselRawGameData[g.gamePk];
      if(rawG&&rawG.doubleHeader==='Y'&&rawG.gameNumber===2){
        var game1Live=Object.values(gameStates).some(function(s){
          return s.status==='Live'&&s.awayId===g.awayId&&s.homeId===g.homeId;
        });
        if(game1Live) return;
      }
      games.push(g);
    }
  });

  games.forEach(function(g){
    var awayAbbr=g.awayAbbr||'TBD', homeAbbr=g.homeAbbr||'TBD', awayPP='TBD', homePP='TBD';
    var awayPPId=null, homePPId=null;

    // Pitcher data might come from scheduleData during the poll — look in raw games if available
    if(storyCarouselRawGameData&&storyCarouselRawGameData[g.gamePk]){
      var raw=storyCarouselRawGameData[g.gamePk];
      if(raw.teams&&raw.teams.away&&raw.teams.away.probablePitcher&&raw.teams.away.probablePitcher.fullName){
        awayPP=raw.teams.away.probablePitcher.fullName;
        awayPPId=raw.teams.away.probablePitcher.id;
      }
      if(raw.teams&&raw.teams.home&&raw.teams.home.probablePitcher&&raw.teams.home.probablePitcher.fullName){
        homePP=raw.teams.home.probablePitcher.fullName;
        homePPId=raw.teams.home.probablePitcher.id;
      }
    }

    var awayWL=awayPPId&&probablePitcherStatsCache[awayPPId]?(probablePitcherStatsCache[awayPPId].wins+'-'+probablePitcherStatsCache[awayPPId].losses):'0-0';
    var homeWL=homePPId&&probablePitcherStatsCache[homePPId]?(probablePitcherStatsCache[homePPId].wins+'-'+probablePitcherStatsCache[homePPId].losses):'0-0';
    var headline=awayPP+' ('+awayWL+') ['+awayAbbr+'] vs '+homePP+' ('+homeWL+') ['+homeAbbr+']';
    var rawG2=storyCarouselRawGameData&&storyCarouselRawGameData[g.gamePk];
    var timeTBD=rawG2&&rawG2.status&&rawG2.status.startTimeTBD;
    var timeStr=timeTBD?'TBD':(g.gameTime||'TBD');
    out.push(makeStory('probable_'+g.gamePk,'contextual',4,40,'⚾',headline,'Today · '+timeStr,'probables',g.gamePk,new Date(g.gameDateMs),60*60000,0.05));
  });
  return out;
}

function updateInningStates(){
  // This function is called after gameStates are updated
  // It doesn't modify state - that happens in genInningRecapStories after recaps are generated
}

function genInningRecapStories(){
  var out=[];
  // Shared generation logic — called from both primary (3rd-out) and fallback (linescore) paths
  function genRecap(g,recapInning,recapHalf,recapKey){
    if(inningRecapsFired.has(recapKey)) return;
    var inningPlays=feedItems.filter(function(item){
      return item.gamePk===g.gamePk&&item.data&&item.data.inning===recapInning&&item.data.halfInning===recapHalf&&item.data.type==='play';
    });
    if(!inningPlays.length) return;
    var runs=0,strikeouts=0,walks=0,hrs=0,dps=0,errors=0,playerHRs=[],pitcherNames=new Set(),hadRisp=false,dpBatter=null;
    var isClean123=inningPlays.length===3&&!inningPlays.some(function(p){return p.data.scoring;});
    var runnersLeftOn=false;
    inningPlays.forEach(function(play){
      if(play.data.scoring) runs++;
      if(play.data.risp) hadRisp=true;
      if(play.data.desc.indexOf('strikes out')!==-1) strikeouts++;
      if(play.data.desc.indexOf('walk')!==-1) walks++;
      if(play.data.event==='Home Run'){hrs++;playerHRs.push(play.data.batterName);}
      if(play.data.desc.indexOf('double play')!==-1){dps++;if(!dpBatter)dpBatter=play.data.batterName;}
      if(play.data.desc.indexOf('error')!==-1) errors++;
      if(play.data.pitcherName) pitcherNames.add(play.data.pitcherName);
    });
    var lastPlay=inningPlays[inningPlays.length-1];
    runnersLeftOn=lastPlay.data.risp||lastPlay.data.onFirst||lastPlay.data.onSecond||lastPlay.data.onThird;
    var pitcher=pitcherNames.size===1?Array.from(pitcherNames)[0]:null;
    var battingTeam=recapHalf==='top'?g.awayName:g.homeName;
    var pittchingTeam=recapHalf==='top'?g.homeName:g.awayName;
    var halfLabel=recapHalf==='top'?'top':'bottom';
    var innStr=ordinal(recapInning);
    var priority=0,headline='';
    if(hrs>0&&runs>0){priority=100;var hrStr=hrs===1?playerHRs[0]+' goes deep':'Back-to-back homers';headline=hrStr+' in the '+halfLabel+' of the '+innStr+', '+battingTeam+' score '+runs;}
    else if(strikeouts===3&&inningPlays.length===3){priority=95;headline=pitcher?pitcher+' strikes out the side in the '+innStr:'Perfect strikeout inning in the '+innStr;}
    else if(runs>=2&&hrs===0){priority=90;headline=battingTeam+' score '+runs+' runs in the '+halfLabel+' of the '+innStr;}
    else if(runs>0&&hadRisp){priority=85;headline=battingTeam+' claw back in the '+innStr;}
    else if(runnersLeftOn&&runs===0&&inningPlays.length===3){priority=80;headline=battingTeam+' strand runners at the corners, '+runs+' runs in the '+halfLabel+' of the '+innStr;}
    else if(strikeouts>=2&&runs===0&&isClean123){priority=75;headline=pitcher?pitcher+' keeps '+pittchingTeam+' off the board with '+strikeouts+' Ks in the '+innStr:'Clean '+strikeouts+'-strikeout inning in the '+innStr;}
    else if(dps>0){priority=70;headline=dpBatter?dpBatter+' hits into a double play in the '+innStr:pittchingTeam+' turn a double play to escape the '+innStr;}
    else if(walks>=3){priority=65;headline=walks+' walks load the bases for '+battingTeam+' in the '+innStr;}
    else if(errors>0&&runs>0){priority=55;headline='Error plates a run — '+battingTeam+' capitalize in the '+innStr;}
    else if(strikeouts>=2&&isClean123){priority=40;headline=pitcher?pitcher+' retires the side with '+strikeouts+' Ks in the '+innStr:battingTeam+' go 1-2-3 with '+strikeouts+' strikeouts in the '+innStr;}
    else if(isClean123){priority=25;headline=battingTeam+' go 1-2-3 in the '+halfLabel+' of the '+innStr;}
    else if(runs>0){priority=45;headline=battingTeam+' score '+runs+' in the '+innStr;}
    else{priority=0;headline=runs+' runs for '+battingTeam+' in the '+halfLabel+' of the '+innStr;}
    if(!headline) return;
    inningRecapsFired.add(recapKey);
    var sub=battingTeam+' · '+ordinal(recapInning)+' inning';
    out.push(makeStory('inning_recap_'+recapKey,'inning_recap',2,priority,'📊',headline,sub,'inning_recap',g.gamePk,new Date(),0,0));
  }
  // Primary path: triggered at 3rd out in pollGamePlays — fires immediately when inning ends
  Object.keys(inningRecapsPending).forEach(function(recapKey){
    var p=inningRecapsPending[recapKey];
    var g=gameStates[p.gamePk];
    if(!g){delete inningRecapsPending[recapKey];return;}
    genRecap(g,p.inning,p.halfInning,recapKey);
    delete inningRecapsPending[recapKey];
    lastInningState[p.gamePk]={inning:p.inning,halfInning:p.halfInning};
  });
  // Fallback path: linescore transition detection (catches edge cases, e.g. zero-play innings)
  Object.values(gameStates).forEach(function(g){
    if(g.status!=='Live') return;
    var lastState=lastInningState[g.gamePk];
    if(!lastState){lastInningState[g.gamePk]={inning:g.inning,halfInning:g.halfInning};return;}
    if(lastState.inning===g.inning&&lastState.halfInning===g.halfInning) return;
    var recapKey=g.gamePk+'_'+lastState.inning+'_'+lastState.halfInning;
    if(inningRecapsFired.has(recapKey)){lastInningState[g.gamePk]={inning:g.inning,halfInning:g.halfInning};return;}
    genRecap(g,lastState.inning,lastState.halfInning,recapKey);
    lastInningState[g.gamePk]={inning:g.inning,halfInning:g.halfInning};
  });
  return out;
}

async function loadTransactionsCache(){
  try{
    var today=new Date(),start=new Date(today);
    start.setDate(start.getDate()-2);
    var fmt=function(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
    var r=await fetch(MLB_BASE+'/transactions?sportId=1&startDate='+fmt(start)+'&endDate='+fmt(today));
    if(!r.ok) throw new Error(r.status);
    var d=await r.json();
    var notable=['Injured List','Designated for Assignment','Selected','Called Up','Trade','Activated From'];
    transactionsCache=(d.transactions||[]).filter(function(t){return notable.some(function(kw){return (t.typeDesc||'').indexOf(kw)!==-1;});});
    transactionsLastFetch=Date.now();
  }catch(e){transactionsCache=transactionsCache||[];}
}


async function loadHighLowCache(){
  try{
    var stats=['homeRuns','strikeOuts','hits'];
    var allResults={};
    for(var i=0;i<stats.length;i++){
      try{
        var r=await fetch(MLB_BASE+'/highLow/player?sortStat='+stats[i]+'&season='+SEASON+'&sportId=1&gameType=R&limit=3');
        if(!r.ok) throw new Error(r.status);
        var d=await r.json();
        allResults[stats[i]]=d.results||[];
      }catch(e){allResults[stats[i]]=[];}
    }
    highLowCache=allResults;
    highLowLastFetch=Date.now();
  }catch(e){highLowCache=highLowCache||{};}
}

function genRosterMoveStories(){
  var out=[];
  if(!transactionsCache||!transactionsCache.length) return out;
  var cutoff=Date.now()-48*60*60*1000;
  transactionsCache.forEach(function(t){
    if(!t.person||!t.person.fullName) return;
    var txDate=t.date?new Date(t.date).getTime():0;
    if(txDate&&txDate<cutoff) return;
    var fullName=t.person.fullName;
    var desc=t.typeDesc||'';
    var icon,priority,headline;
    var toAbbr=t.toTeam&&t.toTeam.id?tcLookup(t.toTeam.id).abbr:'the majors';
    if(desc.indexOf('Activated')!==-1){
      icon='✅';priority=devTuning.roster_priority_il||40;
      headline=fullName+' ('+toAbbr+') activated';
    }else if(desc.indexOf('Injured List')!==-1){
      icon='🏥';priority=devTuning.roster_priority_il||40;
      var ilMatch=desc.match(/(\d+)-Day/);var ilDays=ilMatch?ilMatch[1]:'';
      headline=fullName+' ('+toAbbr+') placed on the '+(ilDays?ilDays+'-Day ':'')+'IL';
    }else if(desc.indexOf('Designated')!==-1){
      icon='⬇️';priority=devTuning.roster_priority_il||40;
      headline=fullName+' ('+toAbbr+') designated for assignment';
    }else if(desc.indexOf('Selected')!==-1||desc.indexOf('Called Up')!==-1){
      icon='⬆️';priority=devTuning.roster_priority_trade||55;
      headline=fullName+' called up by '+toAbbr;
    }else if(desc.indexOf('Trade')!==-1){
      icon='🔄';priority=devTuning.roster_priority_trade||55;
      var fromAbbr=t.fromTeam&&t.fromTeam.id?tcLookup(t.fromTeam.id).abbr:'the majors';
      headline=fullName+' traded from '+fromAbbr+' to '+toAbbr;
    }else{
      icon='📋';priority=35;
      headline=fullName+' ('+toAbbr+') — '+desc;
    }
    var id='roster_'+t.typeCode+'_'+(t.person.id||0)+'_'+(t.date||'today');
    var sub=toAbbr+(t.date?' · '+t.date:'');
    out.push(makeStory(id,'roster_move',3,priority,icon,headline,sub,'roster',null,t.date?new Date(t.date):new Date(),120*60000,0.2));
  });
  return out;
}

async function genWinProbabilityStories(){
  var out=[];
  if(!focusGamePk) return out;
  var g=gameStates[focusGamePk];
  if(!g||g.status!=='Live'||g.detailedState!=='In Progress') return out;
  try{
    var r=await fetch(MLB_BASE+'/game/'+focusGamePk+'/contextMetrics');
    if(!r.ok) throw new Error(r.status);
    var d=await r.json();
    var homeWP=d.homeWinProbability||50;
    var leverageIndex=d.leverageIndex||1;
    var wpAdded=Math.abs(d.homeWinProbabilityAdded||0);
    var isExtreme=homeWP>=(devTuning.wp_extreme_floor||85)||homeWP<=(100-(devTuning.wp_extreme_floor||85));
    var isHighLev=leverageIndex>=(devTuning.wp_leverage_floor||2);
    var isBigSwing=wpAdded>=20;
    if(!isExtreme&&!isHighLev&&!isBigSwing) return out;
    var favAbbr=homeWP>50?g.homeAbbr:g.awayAbbr;
    var favWP=homeWP>50?homeWP:(100-homeWP);
    var id='wp_'+focusGamePk+'_'+Math.round(homeWP/5)*5;
    var icon,headline,badge,tier,priority;
    if(leverageIndex>=3){
      icon='⚡';tier=1;priority=72;badge='live';
      headline='High leverage — '+g.awayAbbr+' @ '+g.homeAbbr;
    }else if(isExtreme){
      icon='📊';tier=2;priority=65;badge='live';
      headline=favAbbr+' are '+Math.round(favWP)+'% favorites in the '+ordinal(g.inning);
    }else{
      icon='📊';tier=2;priority=60;badge='live';
      headline='Win probability swings for '+favAbbr+' (+'+Math.round(wpAdded)+'%)';
    }
    var sub=g.awayAbbr+' @ '+g.homeAbbr+' · '+ordinal(g.inning)+' · '+Math.round(favWP)+'% WP';
    storyPool=storyPool.filter(function(s){return s.id.indexOf('wp_'+focusGamePk+'_')!==0;});
    out.push(makeStory(id,'realtime',tier,priority,icon,headline,sub,badge,focusGamePk,new Date(),3*60000,0.60));
  }catch(e){}
  return out;
}

function genSeasonHighStories(){
  var out=[];
  if(!highLowCache) return out;
  var SEASON_STR=String(SEASON);
  var configs=[
    {stat:'homeRuns',icon:'💥',label:'HR in a game',threshold:3},
    {stat:'strikeOuts',icon:'🔥',label:'strikeouts in a game',threshold:13},
    {stat:'hits',icon:'🏏',label:'hits in a game',threshold:4}
  ];
  configs.forEach(function(cfg){
    var results=highLowCache[cfg.stat]||[];
    if(!results.length) return;
    var top=results[0];
    if(!top||!top.person||!top.stat) return;
    var val=top.stat[cfg.stat]||0;
    if(val<cfg.threshold) return;
    var lastName=top.person.fullName.split(' ').slice(1).join(' ')||top.person.fullName;
    var teamAbbr=(top.team&&top.team.abbreviation)||'';
    var oppAbbr=(top.opponent&&top.opponent.abbreviation)||'';
    var dateStr=top.game&&top.game.gameDate?top.game.gameDate:'';
    var id='highlow_'+cfg.stat+'_'+top.person.id+'_'+SEASON_STR;
    var headline=SEASON_STR+' season high: '+lastName+' — '+val+' '+cfg.label;
    var sub=teamAbbr+(oppAbbr?' vs '+oppAbbr:'')+(dateStr?' · '+dateStr:'');
    out.push(makeStory(id,'contextual',4,devTuning.highlow_priority||25,'🎖️',headline,sub,'record',null,dateStr?new Date(dateStr):new Date(),24*60*60000,0.1));
  });
  return out;
}

async function loadLiveWPCache(){
  var livePks=Object.keys(gameStates).filter(function(pk){
    var g=gameStates[pk];return g&&g.status==='Live'&&g.detailedState==='In Progress';
  });
  if(!livePks.length){liveWPCache={};liveWPLastFetch=Date.now();return;}
  await Promise.all(livePks.map(function(pk){
    return fetch(MLB_BASE+'/game/'+pk+'/contextMetrics').then(function(r){if(!r.ok)throw new Error(r.status);return r.json();}).then(function(d){
      liveWPCache[pk]={homeWP:d.homeWinProbability||50,leverageIndex:d.leverageIndex||1,ts:Date.now()};
    }).catch(function(){});
  }));
  Object.keys(liveWPCache).forEach(function(pk){if(!gameStates[pk]||gameStates[pk].status!=='Live')delete liveWPCache[pk];});
  liveWPLastFetch=Date.now();
}

function genLiveWinProbStories(){
  var out=[];
  Object.keys(liveWPCache).forEach(function(pk){
    var g=gameStates[pk];
    if(!g||g.status!=='Live'||g.detailedState!=='In Progress') return;
    var c=liveWPCache[pk];
    var homeWP=c.homeWP;
    var favAbbr=homeWP>=50?g.homeAbbr:g.awayAbbr;
    var dogAbbr=homeWP>=50?g.awayAbbr:g.homeAbbr;
    var favWP=homeWP>=50?homeWP:(100-homeWP);
    var bucket=Math.round(homeWP/10)*10;
    var id='livewp_'+pk+'_'+bucket;
    var halfArrow=g.halfInning==='top'?'▲':'▼';
    var headline=favAbbr+' '+Math.round(favWP)+'% to win vs '+dogAbbr;
    var sub=g.awayAbbr+' @ '+g.homeAbbr+' · '+halfArrow+ordinal(g.inning)+' · '+g.awayScore+'–'+g.homeScore;
    out.push(makeStory(id,'contextual',4,devTuning.livewp_priority||30,'📈',headline,sub,'live',+pk,new Date(),15*60000,0.10));
  });
  return out;
}

function genDailyIntro(){
  var todayStr=localDateStr(getEffectiveDate());
  var todayGames=Object.values(gameStates).filter(function(g){
    return g.gameDateMs && localDateStr(new Date(g.gameDateMs))===todayStr;
  });
  if(!todayGames.length) return [];
  var liveCount =todayGames.filter(function(g){return g.status==='Live'&&g.detailedState==='In Progress';}).length;
  var finalCount=todayGames.filter(function(g){return g.status==='Final';}).length;
  if(liveCount>=2 || finalCount>=Math.ceil(todayGames.length/2)) return [];

  // Marquee duel — combined record above .500. Threshold scales naturally with the season:
  // aW+hW grows monotonically (every pitcher accrues wins) but (aW-aL)+(hW-hL) only grows
  // when pitchers are genuinely above average, so a fixed threshold works in May and August.
  var marquee=null;
  todayGames.forEach(function(g){
    var raw=storyCarouselRawGameData&&storyCarouselRawGameData[g.gamePk];
    if(!raw||!raw.teams) return;
    var aPP=raw.teams.away&&raw.teams.away.probablePitcher;
    var hPP=raw.teams.home&&raw.teams.home.probablePitcher;
    if(!aPP||!hPP) return;
    var aS=probablePitcherStatsCache[aPP.id]||{}, hS=probablePitcherStatsCache[hPP.id]||{};
    var aW=aS.wins||0, aL=aS.losses||0, hW=hS.wins||0, hL=hS.losses||0;
    if(aW<=aL||hW<=hL) return;
    var aboveZero=(aW-aL)+(hW-hL);
    if(!marquee||aboveZero>marquee.score){
      marquee={away:aPP.fullName,home:hPP.fullName,awayAbbr:g.awayAbbr,homeAbbr:g.homeAbbr,score:aboveZero,gamePk:g.gamePk};
    }
  });

  var n=todayGames.length, headline, sub, gamePk=null;
  if(marquee && marquee.score>=6){
    headline=marquee.away.split(' ').pop()+' vs '+marquee.home.split(' ').pop()+' is the matchup tonight.';
    sub=n+' games · '+marquee.awayAbbr+' @ '+marquee.homeAbbr+' headlines';
    gamePk=marquee.gamePk;
  } else {
    headline=n+' games on the slate. Pulse is on.';
    sub='Live play-by-play across every game';
  }
  return [makeStory('dailyintro_'+todayStr,'editorial',4,50,'📰',headline,sub,'today',gamePk,new Date(),4*60*60000,0.4)];
}

async function buildStoryPool(){
  var now=Date.now();
  if(now-dailyLeadersLastFetch>5*60000){loadDailyLeaders();dailyLeadersLastFetch=now;}
  if(now-transactionsLastFetch>120*60000){loadTransactionsCache();}
  if(now-highLowLastFetch>6*60*60000){loadHighLowCache();}
  if(now-liveWPLastFetch>(devTuning.livewp_refresh_ms||90000)){loadLiveWPCache();}
  await loadProbablePitcherStats();
  fetchMissingHRBatterStats();
  var multiHitStories=await genMultiHitDay();
  var wpStories=await genWinProbabilityStories();
  var fresh=[].concat(
    genHRStories(),genNoHitterWatch(),genWalkOffThreat(),genBasesLoaded(),genStolenBaseStories(),genBigInning(),
    genFinalScoreStories(),genStreakStories(),multiHitStories,genDailyLeaders(),
    genPitcherGem(),genOnThisDay(),genYesterdayHighlights(),genProbablePitchers(),genInningRecapStories(),
    wpStories,genRosterMoveStories(),genSeasonHighStories(),
    genLiveWinProbStories(),genDailyIntro()
  );
  // When daily intro picks the marquee path, drop the matching probable_{pk} card to avoid
  // surfacing the same pitcher matchup twice (editorial framing + game-by-game listing).
  var introMarquee=fresh.find(function(s){return s.type==='editorial'&&s.id.indexOf('dailyintro_')===0&&s.gamePk;});
  if(introMarquee){
    var dupId='probable_'+introMarquee.gamePk;
    fresh=fresh.filter(function(s){return s.id!==dupId;});
  }
  storyPool=fresh.slice().sort(function(a,b){return b.priority-a.priority;});
  var carousel=document.getElementById('storyCarousel');
  if(!carousel) return;
  if(storyPool.length){
    if(carousel.style.display==='none'){
      carousel.style.display='';
      rotateStory();
      if(!storyRotateTimer) storyRotateTimer=setInterval(rotateStory,devTuning.rotateMs);
    }
  } else {
    carousel.style.display='none';
    if(storyRotateTimer){clearInterval(storyRotateTimer);storyRotateTimer=null;}
  }
}

function rotateStory(){
  if(!storyPool.length) return;
  var now=Date.now();
  var maxCooldown=Math.max(storyPool.length*devTuning.rotateMs*1.5,2*60000);
  var eligible=storyPool.filter(function(s){return !s.lastShown||(now-s.lastShown.getTime())>Math.min(s.cooldownMs,maxCooldown);});
  if(!eligible.length){eligible=storyPool.slice().sort(function(a,b){return (a.lastShown?a.lastShown.getTime():0)-(b.lastShown?b.lastShown.getTime():0);});}
  var scored=eligible.map(function(s){
    var ageMin=(now-s.ts.getTime())/60000;
    var decay=Math.pow(Math.max(0,1-s.decayRate),ageMin/30);
    return {s:s,score:s.priority*decay};
  });
  scored.sort(function(a,b){return b.score-a.score;});
  showStoryCard(scored[0].s);
}

function showStoryCard(story){
  story.lastShown=new Date(); storyShownId=story.id;
  displayedStoryIds.add(story.id);
  renderStoryCard(story); updateStoryDots();
  refreshDebugPanel();
}

function renderStoryCard(story){
  var el=document.getElementById('storyCard'); if(!el) return;
  var badgeMap={live:'live',final:'final',today:'today',yesterday:'yesterday',onthisday:'onthisday',upcoming:'upcoming',leaders:'leaders',probables:'probables',highlight:'highlight',inning_recap:'inning_recap',hot:'hot',cold:'cold',streak:'streak',roster:'roster',award:'award',record:'award'};
  var labelMap={live:'LIVE',final:'FINAL',today:'TODAY',yesterday:'YESTERDAY',onthisday:'ON THIS DAY',upcoming:'UPCOMING',leaders:'LEADERS',probables:"TODAY'S PROBABLE PITCHERS",highlight:'HIGHLIGHT',inning_recap:'INNING RECAP',hot:'HOT',cold:'COLD',streak:'HITTING STREAK',roster:'ROSTER MOVE',award:'AWARD',record:'SEASON HIGH'};
  var bc=badgeMap[story.badge]||'today', bl=labelMap[story.badge]||'TODAY';
  el.className='story-card tier'+story.tier+(story.id.indexOf('biginning')===0?' story-biginning':'')+(story.id.indexOf('leader_')===0?' story-leaders':'');
  var videoBtn=story.videoUrl
    ?'<div style="margin-top:10px"><button onclick="openVideoOverlay(\''+story.videoUrl.replace(/'/g,"\\'")+'\',(\''+( (story.videoTitle||story.headline).replace(/'/g,"\\'") )+'\')" style="display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);border-radius:20px;color:#fff;font-size:.72rem;font-weight:700;padding:5px 13px;cursor:pointer;letter-spacing:.04em">▶ WATCH</button></div>'
    :'';
  el.innerHTML='<div><span class="story-badge '+bc+'">'+bl+'</span></div>'
    +'<div style="display:flex;align-items:flex-start;gap:6px;margin-top:2px">'
    +'<span class="story-icon">'+story.icon+'</span>'
    +'<div><div class="story-headline">'+story.headline+'</div>'
    +(story.sub?'<div class="story-sub">'+story.sub+'</div>':'')
    +videoBtn
    +'</div></div>';
}

function updateStoryDots(){
  var el=document.getElementById('storyDots'); if(!el) return;
  var max=Math.min(storyPool.length,8);
  var curIdx=storyPool.findIndex(function(s){return s.id===storyShownId;});
  var html='';
  for(var i=0;i<max;i++) html+='<div class="story-dot'+(i===curIdx?' active':'')+'"></div>';
  el.innerHTML=html;
}

function prevStory(){
  if(!storyPool.length) return;
  var idx=storyPool.findIndex(function(s){return s.id===storyShownId;});
  showStoryCard(storyPool[idx<=0?storyPool.length-1:idx-1]);
}

function nextStory(){
  if(!storyPool.length) return;
  var idx=storyPool.findIndex(function(s){return s.id===storyShownId;});
  showStoryCard(storyPool[idx>=storyPool.length-1?0:idx+1]);
}

function onStoryVisibilityChange(){
  if(document.hidden){clearInterval(storyRotateTimer);storyRotateTimer=null;}
  else if(pulseInitialized&&storyPool.length){rotateStory();storyRotateTimer=setInterval(rotateStory,devTuning.rotateMs);}
}

function onNewsVisibilityChange(){
  if(document.hidden){if(newsRotateTimer)clearTimeout(newsRotateTimer);newsRotateTimer=null;}
  else if(pulseInitialized&&mlbNewsFeed.length){newsRotateTimer=setTimeout(function(){rotateNewsCard();},NEWS_ROTATE_MS);}
}

async function loadOnThisDayCache(){
  onThisDayCache=[];
  var today=new Date();
  var mm=String(today.getMonth()+1).padStart(2,'0');
  var dd=String(today.getDate()).padStart(2,'0');
  for(var i=1;i<=3;i++){
    var yr=SEASON-i;
    try{
      var r=await fetch(MLB_BASE+'/schedule?date='+yr+'-'+mm+'-'+dd+'&sportId=1&hydrate=linescore,team');
      if(!r.ok) throw new Error(r.status);
      var d=await r.json();
      var games=(d.dates||[]).flatMap(function(dt){return dt.games||[];}).filter(function(g){return g.status.abstractGameState==='Final';});
      for(var j=0;j<games.length;j++){
        var g=games[j];
        var away=g.teams.away, home=g.teams.home;
        var winner=away.score>home.score?away.team.abbreviation:home.team.abbreviation;
        var loser=away.score>home.score?home.team.abbreviation:away.team.abbreviation;
        var ws=Math.max(away.score||0,home.score||0), ls=Math.min(away.score||0,home.score||0);
        var playerHighlight='', sigPlay='';
        try{
          var bs=await fetchBoxscore(g.gamePk);
          var allPlayers=Object.assign({},bs&&bs.teams&&bs.teams.home&&bs.teams.home.players||{},bs&&bs.teams&&bs.teams.away&&bs.teams.away.players||{});
          var topBatter=null, topBatterStats=null;
          var hrHitters={multi:[],single:[]};
          Object.values(allPlayers).forEach(function(p){
            if(!p.stats||!p.stats.batting) return;
            var bat=p.stats.batting;
            if(!bat.hits||bat.atBats<2) return;
            if(!topBatter||(bat.hits/bat.atBats)>(topBatterStats.hits/topBatterStats.atBats)) {topBatter=p;topBatterStats=bat;}
            if(bat.homeRuns&&bat.homeRuns>=2) hrHitters.multi.push({name:p.person.fullName.split(' ').pop(),hrs:bat.homeRuns});
            else if(bat.homeRuns===1) hrHitters.single.push(p.person.fullName.split(' ').pop());
          });
          var winPitcher=null, winPitcherStats=null, losePitcher=null, losePitcherStats=null, savePitcher=null;
          var allPitchers=[];
          Object.values(allPlayers).forEach(function(p){
            if(!p.stats||!p.stats.pitching) return;
            var pit=p.stats.pitching;
            if(p.gameStatus){
              if(p.gameStatus.isWinningPitcher) {winPitcher=p;winPitcherStats=pit;}
              if(p.gameStatus.isLosingPitcher) {losePitcher=p;losePitcherStats=pit;}
              if(p.gameStatus.isSavePitcher) savePitcher=p;
            }
            if(parseFloat(pit.inningsPitched||0)>0) allPitchers.push({p:p,stats:pit});
          });
          // Fallback: if gameStatus flags not available, use pitchers with most innings
          if(!winPitcher||!losePitcher){
            allPitchers.sort(function(a,b){return parseFloat(b.stats.inningsPitched||0)-parseFloat(a.stats.inningsPitched||0);});
            if(!winPitcher&&allPitchers.length) {winPitcher=allPitchers[0].p;winPitcherStats=allPitchers[0].stats;}
            if(!losePitcher&&allPitchers.length>1) {losePitcher=allPitchers[1].p;losePitcherStats=allPitchers[1].stats;}
          }
          var lines=[];
          if(topBatter&&topBatterStats) lines.push(topBatter.person.fullName.split(' ').pop()+' '+topBatterStats.hits+'-'+topBatterStats.atBats);
          if(winPitcher&&winPitcherStats) lines.push('W: '+winPitcher.person.fullName.split(' ').pop()+' '+winPitcherStats.inningsPitched+'IP, '+winPitcherStats.strikeOuts+'K, '+(winPitcherStats.earnedRuns||0)+' ER');
          if(losePitcher&&losePitcherStats) lines.push('L: '+losePitcher.person.fullName.split(' ').pop()+' '+losePitcherStats.inningsPitched+'IP, '+losePitcherStats.strikeOuts+'K, '+(losePitcherStats.earnedRuns||0)+' ER');
          if(savePitcher) lines.push('S: '+savePitcher.person.fullName.split(' ').pop());
          hrHitters.multi.forEach(function(h){lines.push(h.name+' '+h.hrs+'HR');});
          hrHitters.single.forEach(function(name){lines.push(name+' HR');});
          if(lines.length) playerHighlight=' · '+lines.join(' · ');
        }catch(e){}
        try{
          var pbResp=await fetch(MLB_BASE+'/game/'+g.gamePk+'/playByPlay');
          if(!pbResp.ok) throw new Error(pbResp.status);
          var pb=await pbResp.json();
          var plays=pb.allPlays||[];
          var lastPlay=plays[plays.length-1];
          if(lastPlay&&lastPlay.about&&lastPlay.about.isScoringPlay&&lastPlay.result){
            var evt=lastPlay.result.event||'';
            if(evt.indexOf('Home Run')!==-1&&lastPlay.about.inning>=9&&Math.abs(ws-ls)<=1) {sigPlay=' · Walk-off HR!';}
            else if(evt.indexOf('Grand Slam')!==-1) {sigPlay=' · Grand slam!';}
          }
          var allHits={away:0,home:0};
          plays.forEach(function(p){if(p.result&&['Single','Double','Triple','Home Run'].indexOf(p.result.event)!==-1){var half=(p.about.halfInning||'Top').toLowerCase();allHits[half==='top'?'away':'home']++;}});
          if(allHits.away===0||allHits.home===0) {sigPlay=' · No-hitter!';}
        }catch(e){}
        var headline='On this day in '+yr+': '+winner+' beat '+loser+' '+ws+'-'+ls+playerHighlight+sigPlay;
        onThisDayCache.push({id:'otd_'+yr+'_'+g.gamePk,icon:'📅',headline:headline,sub:(g.venue?g.venue.name:''),gamePk:g.gamePk,ts:new Date(g.gameDate||Date.now())});
      }
    }catch(e){}
  }
}

async function loadYdForDate(dateStr){
  // Fetches games for dateStr (YYYY-MM-DD) and returns an array of cache items.
  // Used by both loadYesterdayCache() (yesterday) and ydChangeDate() (any date).
  var result=[];
  try{
    var r=await fetch(MLB_BASE+'/schedule?date='+dateStr+'&sportId=1&hydrate=linescore,team');
    if(!r.ok) throw new Error(r.status);
    var d=await r.json();
    var games=(d.dates||[]).flatMap(function(dt){return dt.games||[];}).filter(function(g){
      if(g.status.abstractGameState!=='Final') return false;
      var detailed=g.status.detailedState||'';
      if(detailed==='Postponed'||detailed==='Cancelled'||detailed==='Suspended') return false;
      return true;
    });
    for(var i=0;i<games.length;i++){
      var g=games[i];
      var away=g.teams.away, home=g.teams.home;
      var winner=away.score>home.score?away.team.abbreviation:home.team.abbreviation;
      var loser=away.score>home.score?home.team.abbreviation:away.team.abbreviation;
      var ws=Math.max(away.score||0,home.score||0), ls=Math.min(away.score||0,home.score||0);
      var linescore=g.linescore||{};
      var dur=linescore.gameDurationMinutes?' · '+Math.floor(linescore.gameDurationMinutes/60)+'h '+String(linescore.gameDurationMinutes%60).padStart(2,'0')+'m':'';
      var playerHighlight='', sigPlay='';
      try{
        var bs=await fetchBoxscore(g.gamePk);
        var allPlayers=Object.assign({},bs&&bs.teams&&bs.teams.home&&bs.teams.home.players||{},bs&&bs.teams&&bs.teams.away&&bs.teams.away.players||{});
        var topBatter=null, topBatterStats=null;
        Object.values(allPlayers).forEach(function(p){
          if(!p.stats||!p.stats.batting) return;
          var bat=p.stats.batting;
          if(!bat.hits||bat.atBats<2) return;
          if(!topBatter||(bat.hits/bat.atBats)>(topBatterStats.hits/topBatterStats.atBats)) {topBatter=p;topBatterStats=bat;}
        });
        var winPitcher=null, winPitcherStats=null, losePitcher=null, losePitcherStats=null, savePitcher=null;
        var allPitchers=[];
        Object.values(allPlayers).forEach(function(p){
          if(!p.stats||!p.stats.pitching) return;
          var pit=p.stats.pitching;
          if(p.gameStatus){
            if(p.gameStatus.isWinningPitcher) {winPitcher=p;winPitcherStats=pit;}
            if(p.gameStatus.isLosingPitcher) {losePitcher=p;losePitcherStats=pit;}
            if(p.gameStatus.isSavePitcher) savePitcher=p;
          }
          if(parseFloat(pit.inningsPitched||0)>0) allPitchers.push({p:p,stats:pit});
        });
        if(!winPitcher||!losePitcher){
          allPitchers.sort(function(a,b){return parseFloat(b.stats.inningsPitched||0)-parseFloat(a.stats.inningsPitched||0);});
          if(!winPitcher&&allPitchers.length) {winPitcher=allPitchers[0].p;winPitcherStats=allPitchers[0].stats;}
          if(!losePitcher&&allPitchers.length>1) {losePitcher=allPitchers[1].p;losePitcherStats=allPitchers[1].stats;}
        }
        var lines=[];
        if(topBatter&&topBatterStats){var bline=topBatter.person.fullName.split(' ').pop()+' '+topBatterStats.hits+'-'+topBatterStats.atBats;if(topBatterStats.homeRuns>0)bline+=' '+topBatterStats.homeRuns+'HR';if(topBatterStats.rbi>0)bline+=' '+topBatterStats.rbi+'RBI';lines.push(bline);}
        if(winPitcher&&winPitcherStats) lines.push('W: '+winPitcher.person.fullName.split(' ').pop()+' '+winPitcherStats.inningsPitched+'IP, '+winPitcherStats.strikeOuts+'K, '+(winPitcherStats.earnedRuns||0)+' ER');
        if(losePitcher&&losePitcherStats) lines.push('L: '+losePitcher.person.fullName.split(' ').pop()+' '+losePitcherStats.inningsPitched+'IP, '+losePitcherStats.strikeOuts+'K, '+(losePitcherStats.earnedRuns||0)+' ER');
        if(savePitcher) lines.push('S: '+savePitcher.person.fullName.split(' ').pop());
        if(lines.length) playerHighlight=' · '+lines.join(' · ');
      }catch(e){}
      try{
        var pbResp2=await fetch(MLB_BASE+'/game/'+g.gamePk+'/playByPlay');
        if(!pbResp2.ok) throw new Error(pbResp2.status);
        var pb=await pbResp2.json();
        var plays=pb.allPlays||[];
        var lastPlay=plays[plays.length-1];
        if(lastPlay&&lastPlay.about&&lastPlay.about.isScoringPlay&&lastPlay.result){
          var evt=lastPlay.result.event||'';
          if(evt.indexOf('Home Run')!==-1&&lastPlay.about.inning>=9&&Math.abs(ws-ls)<=1) {sigPlay=' · Walk-off HR!';}
          else if(evt.indexOf('Grand Slam')!==-1) {sigPlay=' · Grand slam!';}
        }
        var allHits={away:0,home:0};
        plays.forEach(function(p){if(p.result&&['Single','Double','Triple','Home Run'].indexOf(p.result.event)!==-1){var half=(p.about.halfInning||'Top').toLowerCase();allHits[half==='top'?'away':'home']++;}});
        if(allHits.away===0||allHits.home===0) {sigPlay=' · No-hitter!';}
      }catch(e){}
      var headline=winner+' beat '+loser+' '+ws+'-'+ls+playerHighlight+sigPlay;
      var videoTitle=null;
      try{
        var cr=await fetch(MLB_BASE+'/game/'+g.gamePk+'/content');
        if(cr.ok){
          var cd=await cr.json();
          var items=(cd.highlights&&cd.highlights.highlights&&cd.highlights.highlights.items)||[];
          if(items.length&&items[0].headline) videoTitle=items[0].headline;
        }
      }catch(e){}
      result.push({id:'yday_'+g.gamePk+'_result',icon:'✅',headline:videoTitle||headline,sub:videoTitle?headline:(g.venue?g.venue.name:'')+dur,gamePk:g.gamePk,ts:new Date(g.gameDate||Date.now())});
    }
  }catch(e){}
  return result;
}

async function loadYesterdayCache(){
  yesterdayCache=[];
  var yd=new Date(); yd.setDate(yd.getDate()-1);
  var dateStr=yd.getFullYear()+'-'+String(yd.getMonth()+1).padStart(2,'0')+'-'+String(yd.getDate()).padStart(2,'0');
  yesterdayCache=await loadYdForDate(dateStr);
  // Prepend "Yesterday: " prefix so genYesterdayHighlights() story carousel reads it correctly
  yesterdayCache.forEach(function(item){item.headline='Yesterday: '+item.headline;});
  updateFeedEmpty();
}

async function loadDailyLeaders(){
  if(demoMode){if(DEBUG) console.log('Demo: Skipping loadDailyLeaders API call');return;}
  try{
    var rH=await fetch(MLB_BASE+'/stats/leaders?leaderCategories=homeRuns,battingAverage,rbi,stolenBases&season='+SEASON+'&statGroup=hitting&limit=5');
    if(!rH.ok) throw new Error(rH.status);
    var dH=await rH.json();
    var rP=await fetch(MLB_BASE+'/stats/leaders?leaderCategories=wins,saves&season='+SEASON+'&statGroup=pitching&limit=5');
    if(!rP.ok) throw new Error(rP.status);
    var dP=await rP.json();
    dailyLeadersCache={};
    [(dH.leagueLeaders||[]),(dP.leagueLeaders||[])].forEach(function(list){
      list.forEach(function(cat){if(cat.leaderCategory&&cat.leaders) dailyLeadersCache[cat.leaderCategory]=cat.leaders;});
    });
  }catch(e){}
}

function ordinal(n){return n===1?'1st':n===2?'2nd':n===3?'3rd':n+'th';}

// ── Debug Panel (v2.7.1) ──────────────────────────────────────────────────────
function refreshDebugPanel(){
  var panel=document.getElementById('debugPanel');
  if(!panel) return;

  var now=Date.now();
  var gameStatesArr=Object.values(gameStates);
  var liveCount=gameStatesArr.filter(function(g){return g.status==='Live';}).length;
  var finalCount=gameStatesArr.filter(function(g){return g.status==='Final';}).length;
  var previewCount=gameStatesArr.filter(function(g){return g.status==='Preview'||g.status==='Scheduled';}).length;

  var tier1=storyPool.filter(function(s){return s.tier===1;}).length;
  var tier2=storyPool.filter(function(s){return s.tier===2;}).length;
  var tier3=storyPool.filter(function(s){return s.tier===3;}).length;
  var tier4=storyPool.filter(function(s){return s.tier===4;}).length;

  var nextPollIn=Math.round((1042-Date.now())%15000/1000); if(nextPollIn<0)nextPollIn+=15;
  var nextRotateIn=storyRotateTimer?Math.round((devTuning.rotateMs-(now%(devTuning.rotateMs||20000)))/1000):'—';

  var html='<div style="padding:0;line-height:1.6">';
  html+='<div style="font-weight:600;margin-bottom:6px;color:var(--accent)">📊 Service Health</div>';
  html+='<div>Polls active: '+Object.keys(gameStates).length+'</div>';
  html+='<div>Live/Final/Preview: '+liveCount+' / '+finalCount+' / '+previewCount+'</div>';
  html+='<div>Feed items: '+feedItems.length+'</div>';
  html+='<div>Next poll in: '+nextPollIn+'s</div>';
  html+='<div style="margin-top:8px;font-weight:600;color:var(--accent)">💾 Caches</div>';
  html+='<div>On This Day: '+(onThisDayCache?onThisDayCache.length+' stories':'loading…')+'</div>';
  html+='<div>Yesterday: '+(yesterdayCache?yesterdayCache.length+' stories':'loading…')+'</div>';
  html+='<div>Daily Leaders: '+(dailyLeadersCache?'loaded':'loading…')+'</div>';
  html+='<div style="margin-top:8px;font-weight:600;color:var(--accent)">🎯 Story Pool ('+storyPool.length+')</div>';
  html+='<div>Tier 1/2/3/4: '+tier1+' / '+tier2+' / '+tier3+' / '+tier4+'</div>';
  html+='<div>Rotation active: '+(storyRotateTimer?'yes':'no')+'</div>';
  html+='<div>Next rotate in: '+nextRotateIn+'s</div>';
  html+='<div style="margin-top:8px;font-weight:600;color:var(--accent);margin-bottom:4px">All Stories ('+storyPool.length+')</div>';
  if(storyPool.length){
    storyPool.forEach(function(s,idx){
      var cooldownRemain=s.lastShown?Math.max(0,Math.round((s.cooldownMs-(now-s.lastShown.getTime()))/1000)):'—';
      var age=Math.round((now-s.ts.getTime())/1000);
      var ageStr=age<60?age+'s':Math.floor(age/60)+'m';
      var decay=Math.pow(Math.max(0,1-s.decayRate),age/60000/30);
      var score=s.priority*decay;
      var shownStr=s.lastShown?'shown '+Math.floor((now-s.lastShown.getTime())/1000)+'s ago':'never';
      var isCurrent=s.id===storyShownId?' ★':'';
      html+='<div style="margin-top:4px;padding:4px;background:rgba(255,255,255,0.04);border-radius:4px;border-left:2px solid var(--border)"><span style="color:var(--accent)">['+(idx+1)+'] T'+s.tier+isCurrent+'</span> '+s.headline.substring(0,50)+'<br/>'
        +'<span style="color:var(--muted);font-size:0.9em">'+s.type+' · pri '+Math.round(score)+' · '+ageStr+' old · cooldown '+cooldownRemain+'s · '+shownStr+'</span></div>';
    });
  } else {
    html+='<div style="color:var(--muted)">No stories yet</div>';
  }
  html+='</div>';
  panel.innerHTML=html;
}

// ── Focus Mode functions (v2.61) ──────────────────────────────────────────────

function calcFocusScore(g) {
  if(g.status!=='Live'||g.detailedState!=='In Progress') return 0;
  var diff=Math.abs(g.awayScore-g.homeScore);
  var closeness=diff===0?60:diff===1?45:diff===2?25:5;
  var runners=(g.onFirst?1:0)+(g.onSecond?1:0)+(g.onThird?1:0);
  var isRISP=g.onSecond||g.onThird;
  var isBL=g.onFirst&&g.onSecond&&g.onThird;
  var isWalkoff=g.halfInning==='bottom'&&g.inning>=9&&(g.awayScore-g.homeScore)<=runners+1&&g.awayScore>=g.homeScore;
  var isNoHit=g.inning>=6&&(g.awayHits===0||g.homeHits===0);
  var situation=isBL?40:isRISP?25:runners>0?15:0;
  if(isWalkoff) situation+=50;
  if(isNoHit) situation+=30;
  var countBonus=0;
  if(g.gamePk===focusGamePk){
    if(focusState.balls===3&&focusState.strikes===2) countBonus=20;
    else if(focusState.strikes===2) countBonus=12;
    if(focusState.outs===2) countBonus+=8;
  }
  var innMult=g.inning<=5?0.6:g.inning<=8?1.0:g.inning===9?1.5:2.0;
  return (closeness+situation+countBonus)*innMult;
}

function getTensionInfo(score) {
  if(score>=devTuning.focus_critical) return {label:'CRITICAL',color:'#e03030'};
  if(score>=devTuning.focus_high)     return {label:'HIGH',color:'#f59e0b'};
  return {label:'NORMAL',color:'#9aa0a8'};
}

function selectFocusGame() {
  var liveGames=Object.values(gameStates).filter(function(g){return g.status==='Live'&&g.detailedState==='In Progress';});
  if(!liveGames.length) return;
  var scored=liveGames.map(function(g){return {g:g,score:calcFocusScore(g)};});
  scored.sort(function(a,b){return b.score-a.score;});
  var best=scored[0];
  // Auto-select on first run or if current game is no longer live
  if(!focusGamePk||!gameStates[focusGamePk]||gameStates[focusGamePk].status!=='Live') {
    focusIsManual=false;
    setFocusGame(best.g.gamePk); return;
  }
  // Soft alert if a different game scores ≥25 higher (with 90s cooldown)
  if(best.g.gamePk!==focusGamePk&&best.score-calcFocusScore(gameStates[focusGamePk])>=devTuning.focus_switch_margin) {
    var now=Date.now();
    if(!focusAlertShown[best.g.gamePk]||(now-focusAlertShown[best.g.gamePk])>devTuning.focus_alert_cooldown) {
      focusAlertShown[best.g.gamePk]=now;
      var tension=getTensionInfo(best.score);
      showFocusAlert(best.g.gamePk,tension.label+' · '+best.g.awayAbbr+' @ '+best.g.homeAbbr);
    }
  }
}

function setFocusGame(pk) {
  if(!pk) return;
  focusGamePk=pk;
  focusPitchSequence=[];
  focusCurrentAbIdx=null;
  focusLastTimecode=null;
  focusState.batterStats=null;
  focusState.pitcherStats=null;
  dismissFocusAlert();
  if(focusFastTimer){clearInterval(focusFastTimer);focusFastTimer=null;}
  if(focusAbortCtrl){focusAbortCtrl.abort();focusAbortCtrl=null;}
  if(focusOverlayOpen) renderFocusOverlay();
  updateRadioForFocus();
  pollFocusLinescore();
  focusFastTimer=setInterval(pollFocusLinescore,TIMING.FOCUS_POLL_MS);
}
function setFocusGameManual(pk) {
  focusIsManual=true;
  setFocusGame(pk);
}
function resetFocusAuto() {
  focusIsManual=false;
  var live=Object.values(gameStates).filter(function(g){return g.status==='Live'&&g.detailedState==='In Progress';});
  if(!live.length) return;
  var scored=live.map(function(g){return {g:g,score:calcFocusScore(g)};});
  scored.sort(function(a,b){return b.score-a.score;});
  setFocusGame(scored[0].g.gamePk);
}

async function pollFocusLinescore() {
  if(!focusGamePk) return;
  if(demoMode) { renderFocusCard(); renderFocusMiniBar(); return; }
  if(focusAbortCtrl){focusAbortCtrl.abort();}
  focusAbortCtrl=new AbortController();
  var focusSig=focusAbortCtrl.signal;
  try {
    var r=await fetch(MLB_BASE+'/game/'+focusGamePk+'/linescore',{signal:focusSig});
    if(!r.ok) throw new Error(r.status);
    var ls=await r.json();
    var g=gameStates[focusGamePk]||{};
    var tension=getTensionInfo(calcFocusScore(g));
    focusState={
      balls:ls.balls||0, strikes:ls.strikes||0, outs:ls.outs||0,
      inning:ls.currentInning||g.inning||1,
      halfInning:ls.isTopInning===false?'bottom':'top',
      currentBatterId:(ls.offense&&ls.offense.batter&&ls.offense.batter.id)||null,
      currentBatterName:(ls.offense&&ls.offense.batter&&ls.offense.batter.fullName)||focusState.currentBatterName||'',
      currentPitcherId:(ls.defense&&ls.defense.pitcher&&ls.defense.pitcher.id)||null,
      currentPitcherName:(ls.defense&&ls.defense.pitcher&&ls.defense.pitcher.fullName)||focusState.currentPitcherName||'',
      onFirst:!!(ls.offense&&ls.offense.first),
      onSecond:!!(ls.offense&&ls.offense.second),
      onThird:!!(ls.offense&&ls.offense.third),
      awayAbbr:g.awayAbbr||'', homeAbbr:g.homeAbbr||'',
      awayScore:g.awayScore||0, homeScore:g.homeScore||0,
      awayPrimary:g.awayPrimary||'#444', homePrimary:g.homePrimary||'#444',
      tensionLabel:tension.label, tensionColor:tension.color,
      lastPitch:focusPitchSequence.length?focusPitchSequence[focusPitchSequence.length-1]:null,
      batterStats:focusStatsCache[(ls.offense&&ls.offense.batter&&ls.offense.batter.id)]||null,
      pitcherStats:focusStatsCache[(ls.defense&&ls.defense.pitcher&&ls.defense.pitcher.id)]||null
    };
    fetchFocusPlayerStats(focusState.currentBatterId, focusState.currentPitcherId);
    renderFocusCard(); renderFocusMiniBar();
    if(focusOverlayOpen) renderFocusOverlay();
    pollFocusRich(focusSig);
  } catch(e) {if(e.name!=='AbortError')console.error('pollFocusLinescore error',e);}
}

async function fetchFocusPlayerStats(batterId, pitcherId) {
  if(demoMode) return;
  var changed=false;
  if(batterId&&!focusStatsCache[batterId]) {
    try {
      var r=await fetch(MLB_BASE+'/people/'+batterId+'/stats?stats=season&group=hitting&season='+SEASON);
      if(!r.ok) throw new Error(r.status);
      var d=await r.json();
      var s=(d.stats&&d.stats[0]&&d.stats[0].splits&&d.stats[0].splits[0]&&d.stats[0].splits[0].stat)||{};
      focusStatsCache[batterId]={avg:s.avg||'—',obp:s.obp||'—',ops:s.ops||'—',hr:s.homeRuns!=null?s.homeRuns:'—',rbi:s.rbi!=null?s.rbi:'—'};
      changed=true;
    } catch(e){}
  }
  if(pitcherId&&!focusStatsCache[pitcherId]) {
    try {
      var r2=await fetch(MLB_BASE+'/people/'+pitcherId+'/stats?stats=season&group=pitching&season='+SEASON);
      if(!r2.ok) throw new Error(r2.status);
      var d2=await r2.json();
      var s2=(d2.stats&&d2.stats[0]&&d2.stats[0].splits&&d2.stats[0].splits[0]&&d2.stats[0].splits[0].stat)||{};
      focusStatsCache[pitcherId]={era:s2.era||'—',whip:s2.whip||'—',wins:s2.wins!=null?s2.wins:'—',losses:s2.losses!=null?s2.losses:'—'};
      changed=true;
    } catch(e){}
  }
  if(!changed) return;
  if(batterId&&focusStatsCache[batterId]) focusState.batterStats=focusStatsCache[batterId];
  if(pitcherId&&focusStatsCache[pitcherId]) focusState.pitcherStats=focusStatsCache[pitcherId];
  if(focusOverlayOpen) renderFocusOverlay();
}

async function pollFocusRich(sig) {
  if(!focusGamePk||demoMode) return;
  try {
    var data;
    if(!focusLastTimecode) {
      // First call: full feed to seed state and get initial timecode
      var r=await fetch(MLB_BASE_V1_1+'/game/'+focusGamePk+'/feed/live',sig?{signal:sig}:{});
      if(!r.ok) throw new Error(r.status);
      data=await r.json();
      var tsList=data&&data.metaData&&data.metaData.timeStamp;
      if(tsList) focusLastTimecode=tsList;
    } else {
      // Subsequent calls: delta only (~1-5KB vs ~500KB)
      var tsResp=await fetch(MLB_BASE_V1_1+'/game/'+focusGamePk+'/feed/live/timestamps',sig?{signal:sig}:{});
      if(!tsResp.ok) throw new Error(tsResp.status);
      var tsArr=await tsResp.json();
      var latest=Array.isArray(tsArr)&&tsArr.length?tsArr[tsArr.length-1]:null;
      if(!latest||latest===focusLastTimecode) return; // nothing new
      var dResp=await fetch(MLB_BASE_V1_1+'/game/'+focusGamePk+'/feed/live/diffPatch?startTimecode='+encodeURIComponent(focusLastTimecode)+'&endTimecode='+encodeURIComponent(latest),sig?{signal:sig}:{});
      if(!dResp.ok) throw new Error(dResp.status);
      var patch=await dResp.json();
      focusLastTimecode=latest;
      // diffPatch wraps currentPlay under liveData.plays.currentPlay same as full feed
      data=patch;
    }
    var cp=data&&data.liveData&&data.liveData.plays&&data.liveData.plays.currentPlay;
    if(!cp) return;
    var abIdx=cp.about&&cp.about.atBatIndex;
    if(focusCurrentAbIdx!==null&&focusCurrentAbIdx!==abIdx) focusPitchSequence=[];
    focusCurrentAbIdx=abIdx;
    var pitchEvents=(cp.playEvents||[]).filter(function(e){return e.isPitch||e.type==='pitch';});
    focusPitchSequence=pitchEvents.map(function(e){
      return {
        typeCode:(e.details&&e.details.type&&e.details.type.code)||'??',
        typeName:(e.details&&e.details.type&&e.details.type.description)||'',
        speed:(e.pitchData&&e.pitchData.startSpeed)||null,
        resultCode:(e.details&&e.details.code)||'',
        resultDesc:(e.details&&e.details.description)||'',
        sequenceIndex:e.pitchNumber||0
      };
    });
    if(focusPitchSequence.length) focusState.lastPitch=focusPitchSequence[focusPitchSequence.length-1];
    renderFocusCard();
    if(focusOverlayOpen) renderFocusOverlay();
  } catch(e) { if(e.name!=='AbortError') console.error('pollFocusRich error',e); }
}

function renderFocusCard() {
  var el=document.getElementById('focusCard'); if(!el) return;
  if(!focusGamePk||(!focusState.awayAbbr&&!demoMode)){el.style.display='none';return;}
  el.style.display='';
  var liveGames=Object.values(gameStates).filter(function(g){return g.status==='Live'&&g.detailedState==='In Progress';});
  var cardData=Object.assign({},focusState,{
    isManual: focusIsManual,
    allLiveGames: liveGames.map(function(g){
      return {gamePk:g.gamePk,awayAbbr:g.awayAbbr,homeAbbr:g.homeAbbr,
              awayPrimary:g.awayPrimary,homePrimary:g.homePrimary,
              inning:g.inning,isFocused:g.gamePk===focusGamePk};
    })
  });
  el.innerHTML=window.FocusCard.renderCard(cardData);
}

function renderFocusMiniBar() {
  var el=document.getElementById('focusMiniBar'); if(!el) return;
  if(!focusGamePk||!focusState.awayAbbr){el.style.display='none';return;}
  var half=focusState.halfInning==='bottom'?'▼':'▲';
  var liveGames=Object.values(gameStates).filter(function(g){return g.status==='Live'&&g.detailedState==='In Progress';});
  var showStrip=liveGames.length>1||focusIsManual;
  var stripHtml='';
  if(showStrip){
    stripHtml='<div style="display:flex;align-items:center;gap:5px;padding:3px 10px 4px;background:var(--p-dark,#080e1c);border-bottom:1px solid var(--p-border,#1e2d4a);overflow-x:auto;-webkit-overflow-scrolling:touch;">';
    if(focusIsManual){
      stripHtml+='<button onclick="resetFocusAuto()" style="flex:0 0 auto;padding:2px 7px;border-radius:4px;border:1px solid rgba(34,197,94,.35);background:rgba(34,197,94,.08);font:700 9px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.1em;color:#22c55e;cursor:pointer">↩ AUTO</button>';
    }
    liveGames.forEach(function(g){
      var focused=g.gamePk===focusGamePk;
      stripHtml+='<button'+(focused?'':' onclick="setFocusGameManual('+g.gamePk+')"')+' style="flex:0 0 auto;display:inline-flex;align-items:center;gap:3px;padding:2px 6px;border-radius:4px;border:'+(focused?'1.5px solid var(--p-accent,#3a4d75)':'1px solid var(--p-border,#1e2d4a)')+';background:transparent;cursor:'+(focused?'default':'pointer')+'">'
        +'<span style="width:4px;height:4px;border-radius:50%;background:'+(g.awayPrimary||'#3a4d75')+';flex:0 0 auto"></span>'
        +'<span style="font:700 9px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.04em;color:'+(focused?'var(--p-text,#e8eaf0)':'var(--p-muted,#9aa0a8)')+'">'+g.awayAbbr+'<span style="color:var(--p-border,#3a4d75);margin:0 2px">@</span>'+g.homeAbbr+'</span>'
        +'<span style="width:4px;height:4px;border-radius:50%;background:'+(g.homePrimary||'#3a4d75')+';flex:0 0 auto"></span>'
        +'</button>';
    });
    stripHtml+='</div>';
  }
  el.style.display='';
  el.innerHTML='<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 12px;background:var(--p-dark,#0c1426);border-bottom:1px solid var(--p-border,#1e2d4a);font-size:.75rem">'
    +'<span style="font:700 10px/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--p-text,#e8eaf0);letter-spacing:.06em">'+focusState.awayAbbr+' <strong>'+focusState.awayScore+'</strong> – <strong>'+focusState.homeScore+'</strong> '+focusState.homeAbbr+'</span>'
    +'<span style="font:600 10px/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--p-muted,#9aa0a8)">'+half+focusState.inning+' · '+focusState.balls+'-'+focusState.strikes+' · '+focusState.outs+' out</span>'
    +'<button onclick="openFocusOverlay()" style="padding:3px 8px;background:var(--p-dark,#0a0f1e);border:1px solid var(--p-border,#1e2d4a);border-radius:4px;color:var(--p-text,#e8eaf0);font:700 10px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.1em;cursor:pointer">FOCUS →</button>'
    +'</div>'
    +stripHtml;
}

function openFocusOverlay() {
  var el=document.getElementById('focusOverlay'); if(!el||!focusGamePk) return;
  focusOverlayOpen=true;
  el.style.display='flex';
  renderFocusOverlay();
}

function closeFocusOverlay() {
  var el=document.getElementById('focusOverlay'); if(!el) return;
  focusOverlayOpen=false;
  el.style.display='none';
}

function renderFocusOverlay() {
  var card=document.getElementById('focusOverlayCard'); if(!card) return;
  var liveGames=Object.values(gameStates).filter(function(g){return g.status==='Live'&&g.detailedState==='In Progress';});
  var data=Object.assign({},focusState,{
    pitchSequence: focusPitchSequence,
    allLiveGames: liveGames.map(function(g){
      return {gamePk:g.gamePk,awayAbbr:g.awayAbbr,homeAbbr:g.homeAbbr,
              awayScore:g.awayScore,homeScore:g.homeScore,inning:g.inning,
              halfInning:g.halfInning,isFocused:g.gamePk===focusGamePk};
    })
  });
  card.innerHTML=window.FocusCard.renderOverlay(data);
}

function showFocusAlert(pk, reason) {
  var el=document.getElementById('focusAlertBanner'); if(!el) return;
  el.style.display='';
  el.innerHTML='<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.35);border-radius:6px;margin:6px 0;font-size:.75rem">'
    +'<span>⚡ <strong style="color:var(--text)">'+reason+'</strong></span>'
    +'<div style="display:flex;gap:6px;flex-shrink:0">'
    +'<button onclick="setFocusGame('+pk+');dismissFocusAlert()" style="padding:3px 10px;background:#f59e0b;border:none;border-radius:4px;color:#000;font-weight:700;font-size:11px;cursor:pointer">Switch</button>'
    +'<button onclick="dismissFocusAlert()" style="padding:3px 8px;background:none;border:1px solid var(--border);border-radius:4px;color:var(--muted);font-size:11px;cursor:pointer">✕</button>'
    +'</div></div>';
}

function dismissFocusAlert() {
  var el=document.getElementById('focusAlertBanner'); if(el) el.style.display='none';
}

// ── End Focus Mode functions ──────────────────────────────────────────────────

// DEBUG: Replay an HR card from live feed (call replayHRCard() from console, or press Shift+R)
function replayHRCard(itemIndex) {
  var hrs = feedItems.filter(function(item) { return item.data && item.data.event === 'Home Run'; });
  if (!hrs.length) { alert('No home runs in feed yet'); return; }

  var idx = itemIndex !== undefined ? itemIndex : 0;
  if (idx < 0 || idx >= hrs.length) { alert('Index out of range'); return; }

  var item = hrs[idx];
  var play = item.data;
  var gs = gameStates[item.gamePk];
  if (!gs) { alert('Game state not found'); return; }

  var batterId = play.batterId;
  var batterName = play.batterName;
  var awayTeamId = gs.awayId;
  var homeTeamId = gs.homeId;
  var halfInning = play.halfInning || gs.halfInning;
  var badgeText = play.desc.includes('walk-off') ? 'WALK-OFF HOME RUN!' : '💥 HOME RUN!';

  showPlayerCard(batterId, batterName, awayTeamId, homeTeamId, halfInning, null, null, badgeText, item.gamePk);
  if(DEBUG) console.log('Replaying HR:', batterName, 'at', gs.awayAbbr + ' @ ' + gs.homeAbbr);
}

// DEBUG: Replay most recent RBI card from live feed (press Shift+E)
function replayRBICard(itemIndex) {
  var rbis = feedItems.filter(function(item) { return item.data && item.data.scoring && item.data.event !== 'Home Run' && item.data.batterId; });
  if (!rbis.length) { alert('No RBI plays in feed yet'); return; }
  var idx = itemIndex !== undefined ? itemIndex : 0;
  if (idx < 0 || idx >= rbis.length) { alert('Index out of range'); return; }
  var item = rbis[idx];
  var play = item.data;
  var gs = gameStates[item.gamePk];
  if (!gs) { alert('Game state not found'); return; }
  showRBICard(play.batterId, play.batterName, gs.awayId, gs.homeId, play.halfInning, 1, play.event, play.awayScore, play.homeScore, play.inning, item.gamePk);
  if(DEBUG) console.log('Replaying RBI:', play.batterName, play.event, 'at', gs.awayAbbr + ' @ ' + gs.homeAbbr);
}

// ── 📚 Card Collection ────────────────────────────────────────────────────────
function tierRank(t) { return {legendary:4,epic:3,rare:2,common:1}[t]||0; }

function getCardTier(badge, eventType, rbi) {
  if (eventType === 'HR') {
    if (badge.includes('WALK-OFF GRAND SLAM')) return 'legendary';
    if (badge.includes('WALK-OFF') || badge.includes('GRAND SLAM')) return 'epic';
    if (badge.includes('GO-AHEAD')) return 'rare';
    return 'common';
  } else {
    if (badge.includes('WALK-OFF') && (rbi||0) >= 2) return 'legendary';
    if (badge.includes('WALK-OFF') || (rbi||0) >= 3) return 'epic';
    if (badge.includes('GO-AHEAD') || badge.includes('TIES IT')) return 'rare';
    return 'common';
  }
}

function loadCollection() {
  try { return JSON.parse(localStorage.getItem('mlb_card_collection')||'{}'); } catch(e) { return {}; }
}

function saveCollection(obj) {
  try { localStorage.setItem('mlb_card_collection', JSON.stringify(obj)); } catch(e) {}
}

function showCollectedToast(type, playerName, eventType, tier) {
  var el = document.getElementById('cardCollectedToast');
  if (!el) return;
  var tierColor = { legendary:'#e03030', epic:'#f59e0b', rare:'#3b82f6', common:'#9aa0a8' }[tier] || '#9aa0a8';
  var lastName = playerName.split(' ').pop();
  var prefix, msg;
  if (type === 'new') {
    if (tier === 'legendary') { prefix = '🔴'; msg = 'LEGENDARY PULL! ' + lastName + ' ' + eventType; }
    else if (tier === 'epic') { prefix = '🟠'; msg = 'EPIC CARD! ' + lastName + ' ' + eventType; }
    else if (tier === 'rare') { prefix = '💎'; msg = 'Rare find — ' + lastName + ' ' + eventType; }
    else                      { prefix = '🎴'; msg = 'Card collected — ' + lastName + ' ' + eventType; }
  } else if (type === 'upgrade') {
    if (tier === 'legendary') { prefix = '🔴'; msg = 'UPGRADED TO LEGENDARY! ' + lastName; }
    else if (tier === 'epic') { prefix = '⚡'; msg = 'Upgraded to Epic! ' + lastName + ' ' + eventType; }
    else if (tier === 'rare') { prefix = '💎'; msg = 'Upgraded to Rare — ' + lastName + ' ' + eventType; }
    else                      { prefix = '⬆'; msg = 'Upgraded — ' + lastName + ' ' + eventType; }
  } else {
    if (tier === 'legendary') { prefix = '👑'; msg = 'Another legendary ' + lastName + ' moment!'; }
    else if (tier === 'epic') { prefix = '🔥'; msg = 'Epic variant added — ' + lastName; }
    else if (tier === 'rare') { prefix = '💎'; msg = 'Rare event added — ' + lastName + ' ' + eventType; }
    else                      { prefix = '✓'; msg = lastName + "'s " + eventType + ' card updated'; }
  }
  el.style.borderColor = tierColor + '99';
  el.style.boxShadow = (tier === 'legendary' || tier === 'epic') ? '0 0 14px ' + tierColor + '55' : '';
  el.innerHTML = '<span style="color:' + tierColor + ';font-weight:800;">' + prefix + '</span> ' + msg;
  var duration = (tier === 'legendary' || tier === 'epic') ? 2800 : 2100;
  el.style.animationDuration = duration + 'ms';
  el.style.display = 'block';
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
  setTimeout(function() { el.style.display = 'none'; el.classList.remove('show'); }, duration);
}

function collectCard(data, force) {
  var playerId = data.playerId, playerName = data.playerName, teamAbbr = data.teamAbbr;
  var teamPrimary = data.teamPrimary, teamSecondary = data.teamSecondary, position = data.position || '';
  var eventType = data.eventType, badge = data.badge || '', rbi = data.rbi || 0;
  var key = playerId + '_' + eventType;
  var tier = getCardTier(badge, eventType, rbi);

  if (demoMode && !force) {
    // Simulate the collection outcome so the rail flash message works during demo playback
    var demoCol = loadCollection();
    var demoEx = demoCol[key];
    if (!demoEx) {
      lastCollectionResult = { type:'new', playerName:playerName, eventType:eventType, tier:tier };
    } else {
      var dRank = tierRank(tier), dExRank = tierRank(demoEx.tier);
      lastCollectionResult = {
        type: dRank > dExRank ? 'upgrade' : 'dup',
        playerName: playerName, eventType: eventType, tier: tier
      };
    }
    return;
  }

  var col = loadCollection();
  var eventCtx = {
    badge: badge,
    date: new Date().toLocaleDateString('en-CA'),
    inning: data.inning || 0,
    halfInning: data.halfInning || 'top',
    awayAbbr: data.awayAbbr || '',
    homeAbbr: data.homeAbbr || '',
    awayScore: data.awayScore || 0,
    homeScore: data.homeScore || 0,
  };
  if (!col[key]) {
    col[key] = { playerId: playerId, playerName: playerName, teamAbbr: teamAbbr,
                 teamPrimary: teamPrimary, teamSecondary: teamSecondary, position: position,
                 eventType: eventType, tier: tier, collectedAt: Date.now(), events: [eventCtx] };
    lastCollectionResult = { type:'new', playerName:playerName, eventType:eventType, tier:tier };
    showCollectedToast('new', playerName, eventType, tier);
  } else {
    var existing = col[key];
    var newRank = tierRank(tier), existRank = tierRank(existing.tier);
    if (newRank > existRank) {
      existing.tier = tier;
      existing.events = [eventCtx];
      existing.collectedAt = Date.now();
      existing.teamPrimary = teamPrimary;
      existing.teamSecondary = teamSecondary;
      existing.position = position || existing.position;
      lastCollectionResult = { type:'upgrade', playerName:playerName, eventType:eventType, tier:tier };
      showCollectedToast('upgrade', playerName, eventType, tier);
    } else if (newRank === existRank) {
      if (existing.events.length < 10) existing.events.push(eventCtx);
      lastCollectionResult = { type:'dup', playerName:playerName, eventType:eventType, tier:tier };
      showCollectedToast('dup', playerName, eventType, tier);
    }
    // lower tier → silent no-op
  }
  saveCollection(col);
  updateCollectionUI();
  if(mlbSessionToken)syncCollection();
  else showSignInCTA();
}

async function fetchCareerStats(playerId, position) {
  if (collectionCareerStatsCache[playerId]) return collectionCareerStatsCache[playerId];
  var isPitcher = ['SP','RP','CP','P'].indexOf((position||'').toUpperCase()) !== -1;
  var group = isPitcher ? 'pitching' : 'hitting';
  try {
    var r = await fetch(MLB_BASE + '/people/' + playerId + '/stats?stats=career&group=' + group);
    if(!r.ok) throw new Error(r.status);
    var d = await r.json();
    var stat = d.stats && d.stats[0] && d.stats[0].splits && d.stats[0].splits[0] && d.stats[0].splits[0].stat;
    if (!stat) return null;
    var result = isPitcher
      ? { careerERA: fmt(stat.era,2), careerWHIP: fmt(stat.whip,2), careerW: stat.wins||0, careerK: stat.strikeOuts||0 }
      : { careerHR: stat.homeRuns||0, careerAVG: fmtRate(stat.avg), careerRBI: stat.rbi||0, careerOPS: fmtRate(stat.ops) };
    collectionCareerStatsCache[playerId] = result;
    return result;
  } catch(e) { return null; }
}

function openCollection() {
  var el = document.getElementById('collectionOverlay');
  if (!el) return;
  collectionPage = 0;
  el.style.display = 'flex';
  renderCollectionBook();
}

function closeCollection() {
  var el = document.getElementById('collectionOverlay');
  if (el) el.style.display = 'none';
}

// ── Yesterday Recap overlay (v3.19.1) ─────────────────────────────────────────
var ydPrevSection=null; // section to return to on close
function openYesterdayRecap() {
  yesterdayOverlayOpen=true;
  // reset to yesterday on every open so the date picker starts fresh
  ydDateOffset=-1;
  ydDisplayCache=null;
  // remember where we came from
  var active=document.querySelector('.section.active');
  ydPrevSection=active?active.id:null;
  // switch all sections off, activate yesterday
  document.querySelectorAll('.section').forEach(function(s){s.classList.remove('active');});
  document.querySelectorAll('nav button').forEach(function(b){b.classList.remove('active');});
  document.getElementById('yesterday').classList.add('active');
  window.scrollTo(0,0); // reset scroll before render so bar starts at top
  var lbl=document.getElementById('ydDateLabel');
  if(lbl) lbl.textContent=getYesterdayDisplayStr();
  var nextBtn=document.getElementById('ydNextDateBtn');
  if(nextBtn) nextBtn.disabled=true; // can't go forward from yesterday
  renderYesterdayRecap();
  requestAnimationFrame(function(){ window.scrollTo(0,0); }); // safety net for iOS Safari
}

async function ydChangeDate(dir){
  var newOffset=ydDateOffset+dir;
  if(newOffset>=0) return; // block today and future
  if(newOffset<-365) return; // reasonable floor
  ydDateOffset=newOffset;
  // update label and button states
  var lbl=document.getElementById('ydDateLabel');
  if(lbl) lbl.textContent=getYesterdayDisplayStr();
  var nextBtn=document.getElementById('ydNextDateBtn');
  if(nextBtn) nextBtn.disabled=(ydDateOffset>=-1);
  // show loading state while fetching
  var card=document.getElementById('yesterdayCard');
  if(card) card.innerHTML='<div style="padding:48px;text-align:center;color:var(--muted);font-size:.88rem">Loading…</div>';
  // clear any existing hero player to avoid stale video showing
  var heroRegion=document.getElementById('ydHeroRegion');
  if(heroRegion){heroRegion.dataset.mounted='';heroRegion.innerHTML='';}
  // load data for the selected date (or reuse yesterdayCache for -1)
  if(ydDateOffset===-1){
    ydDisplayCache=null;
  }else{
    ydDisplayCache=await loadYdForDate(getYesterdayDateStr());
  }
  renderYesterdayRecap();
  window.scrollTo(0,0);
}

function closeYesterdayRecap() {
  yesterdayOverlayOpen=false;
  document.querySelectorAll('.section').forEach(function(s){s.classList.remove('active');});
  var returnId=ydPrevSection||'pulse';
  var returnEl=document.getElementById(returnId);
  if(returnEl) returnEl.classList.add('active');
  // re-activate nav button for the return section
  document.querySelectorAll('nav button').forEach(function(b){
    var onclick=b.getAttribute('onclick')||'';
    if(onclick.indexOf("'"+returnId+"'")!==-1) b.classList.add('active');
  });
}

function getYesterdayDateStr() {
  var d=new Date(); d.setDate(d.getDate()+ydDateOffset);
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}

function getYesterdayDisplayStr() {
  var d=new Date(); d.setDate(d.getDate()+ydDateOffset);
  var months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return months[d.getMonth()]+' '+d.getDate()+', '+d.getFullYear();
}

function getYesterdayCollectedCards() {
  var ydStr=getYesterdayDateStr();
  try {
    var col=loadCollection();
    var slots=Object.values(col).filter(function(s){
      return s.events&&s.events.some(function(ev){return ev.date===ydStr;});
    });
    slots.sort(function(a,b){return tierRank(b.tier)-tierRank(a.tier);});
    return slots.slice(0,5);
  } catch(e){ return []; }
}

async function fetchGameContent(gamePk) {
  if(yesterdayContentCache[gamePk]) return yesterdayContentCache[gamePk];
  try {
    var r=await fetch(MLB_BASE+'/game/'+gamePk+'/content');
    var d=await r.json();
    yesterdayContentCache[gamePk]=d;
    return d;
  } catch(e){ yesterdayContentCache[gamePk]=null; return null; }
}

// ── 📽️ Video clip overlay ────────────────────────────────────────────────────

function openVideoOverlay(url, title) {
  var ov=document.getElementById('videoOverlay');
  var vid=document.getElementById('videoOverlayPlayer');
  var ttl=document.getElementById('videoOverlayTitle');
  if(!ov||!vid) return;
  if(ttl) ttl.textContent=title||'';
  vid.src=url;
  vid.load();
  vid.play().catch(function(){});
  ov.style.display='flex';
}

function closeVideoOverlay() {
  var ov=document.getElementById('videoOverlay');
  var vid=document.getElementById('videoOverlayPlayer');
  if(vid){vid.pause();vid.src='';}
  if(ov) ov.style.display='none';
}

async function devTestVideoClip() {
  // 1. Use most recent matched live clip
  if(lastVideoClip&&pickPlayback(lastVideoClip.playbacks)){
    openVideoOverlay(pickPlayback(lastVideoClip.playbacks),lastVideoClip.headline||lastVideoClip.blurb||'Highlight');
    return;
  }
  // 2. Use any cached yesterday content
  var keys=Object.keys(yesterdayContentCache);
  for(var i=0;i<keys.length;i++){
    var c=yesterdayContentCache[keys[i]];
    if(!c) continue;
    var items=(c.highlights&&c.highlights.highlights&&c.highlights.highlights.items)||[];
    var playable=items.filter(function(it){return it.type==='video'&&pickPlayback(it.playbacks);});
    if(playable.length){
      var clip=playable[2]||playable[0];
      lastVideoClip=clip;
      openVideoOverlay(pickPlayback(clip.playbacks),clip.headline||clip.blurb||'Highlight');
      return;
    }
  }
  // 3. Fetch yesterday's first game as fallback
  try{
    var yd=new Date(); yd.setDate(yd.getDate()-1);
    var ds=yd.getFullYear()+'-'+String(yd.getMonth()+1).padStart(2,'0')+'-'+String(yd.getDate()).padStart(2,'0');
    var r=await fetch(MLB_BASE+'/schedule?date='+ds+'&sportId=1&hydrate=team');
    if(!r.ok) throw new Error(r.status);
    var d=await r.json();
    var games=(d.dates||[]).flatMap(function(dt){return dt.games||[];});
    if(!games.length){alert('No clip available — open Yesterday Recap first');return;}
    var content=await fetchGameContent(games[0].gamePk);
    if(!content) throw new Error('no content');
    var items2=(content.highlights&&content.highlights.highlights&&content.highlights.highlights.items)||[];
    var playable2=items2.filter(function(it){return it.type==='video'&&pickPlayback(it.playbacks);});
    if(!playable2.length){alert('No playable clip found for yesterday');return;}
    lastVideoClip=playable2[0];
    openVideoOverlay(pickPlayback(playable2[0].playbacks),playable2[0].headline||playable2[0].blurb||'Highlight');
  }catch(e){alert('Could not load clip: '+(e&&e.message||e));}
}

async function pollPendingVideoClips() {
  // Scan feedItems for HR and scoring plays whose feed element hasn't been patched with a clip yet.
  var cutoff=Date.now()-2*60*60*1000;
  var feed=document.getElementById('feed');
  if(!feed) return;
  var pending=feedItems.filter(function(item){
    if(!item.data||!item.data.batterId) return false;
    if(item.data.event!=='Home Run'&&!item.data.scoring) return false;
    if(!item.ts||item.ts.getTime()<cutoff) return false;
    var el=feed.querySelector('[data-ts="'+item.ts.getTime()+'"][data-gamepk="'+item.gamePk+'"]');
    return el&&!el.dataset.clipPatched;
  });
  if(!pending.length) return;
  var byGame={};
  pending.forEach(function(item){(byGame[item.gamePk]=byGame[item.gamePk]||[]).push(item);});
  for(var pk in byGame){
    var gpk=+pk;
    var cached=liveContentCache[gpk];
    if(!cached||(Date.now()-cached.fetchedAt)>5*60*1000){
      try{
        var r=await fetch(MLB_BASE+'/game/'+gpk+'/content');
        if(!r.ok) continue;
        var d=await r.json();
        var all=(d.highlights&&d.highlights.highlights&&d.highlights.highlights.items)||[];
        // Keep only playable video clips; exclude data-visualization (darkroom, bat-track, etc.)
        liveContentCache[gpk]={items:all.filter(function(it){
          if(it.type!=='video'||!pickPlayback(it.playbacks)) return false;
          return !(it.keywordsAll||[]).some(function(kw){
            var v=(kw.value||kw.slug||'').toLowerCase();
            return v==='data-visualization'||v==='data_visualization';
          });
        }),fetchedAt:Date.now()};
      }catch(e){continue;}
    }
    var clips=(liveContentCache[gpk]&&liveContentCache[gpk].items)||[];
    if(!clips.length) continue;
    // Exclude Statcast/Savant clips — analysis overlays, not broadcast replays.
    function isStatcast(clip){
      var title=(clip.headline||clip.blurb||'').toLowerCase();
      if(title.indexOf('statcast')!==-1||title.indexOf('savant')!==-1) return true;
      return (clip.keywordsAll||[]).some(function(kw){
        var v=(kw.value||kw.slug||'').toLowerCase();
        return v==='statcast'||v==='savant';
      });
    }
    var broadcastClips=clips.filter(function(c){return !isStatcast(c);});
    // Prefer clips tagged home-run / scoring-play / walk-off (API uses hyphens, not underscores).
    var scoringClips=broadcastClips.filter(function(clip){
      return (clip.keywordsAll||[]).some(function(kw){
        var v=kw.value||kw.slug||'';
        return v==='home-run'||v==='scoring-play'||v==='walk-off';
      });
    });
    byGame[pk].forEach(function(item){
      var playTs=item.ts.getTime();
      var bid=String(item.data.batterId);
      function hasPlayer(clip){
        return (clip.keywordsAll||[]).some(function(kw){
          if(kw.type==='player_id') return String(kw.value||'')===bid;
          if(kw.slug&&kw.slug.startsWith('player_id-')) return kw.slug.split('-')[1]===bid;
          return false;
        });
      }
      // 4-tier priority: player_id in scoringClips → player_id in broadcastClips →
      // nearest-timestamp in scoringClips → nearest-timestamp in broadcastClips.
      // This prevents a player whose clip lacks the home-run tag from being matched
      // to another player's clip via timestamp when the game has mixed-tag clips.
      var playerFromScoring=scoringClips.filter(hasPlayer);
      var playerFromBroadcast=broadcastClips.filter(hasPlayer);
      var pool=playerFromScoring.length?playerFromScoring
              :playerFromBroadcast.length?playerFromBroadcast
              :scoringClips.length?scoringClips
              :broadcastClips;
      var isPlayerMatched=playerFromScoring.length||playerFromBroadcast.length;
      var best=null,bestDiff=Infinity;
      pool.forEach(function(clip){
        var clipTs=clip.date?new Date(clip.date).getTime():null;
        if(!clipTs) return;
        var diff=Math.abs(clipTs-playTs);
        if(diff<bestDiff){bestDiff=diff;best=clip;}
      });
      var limit=isPlayerMatched?Infinity:90*60*1000;
      if(best&&bestDiff<limit){
        lastVideoClip=best;
        patchFeedItemWithClip(playTs,gpk,best);
        patchStoryWithClip(gpk,item.data.batterId,item.data.batterName,best);
      }
    });
  }
}

function openVideoDebugPanel(){
  var p=document.getElementById('videoDebugPanel');
  if(!p) return;
  p.style.display='flex';
  renderVideoDebugPanel();
}
function closeVideoDebugPanel(){
  var p=document.getElementById('videoDebugPanel');
  if(p) p.style.display='none';
}
async function refreshVideoDebugPanel(){
  var btn=document.getElementById('videoDebugRefreshBtn');
  if(btn){btn.textContent='⏳ Fetching...';btn.disabled=true;}
  await pollPendingVideoClips();
  renderVideoDebugPanel();
  if(btn){btn.textContent='↻ Fetch Now';btn.disabled=false;}
}
function renderVideoDebugPanel(){
  var el=document.getElementById('videoDebugList');
  if(!el) return;
  var html='';

  // ── Section 1: HR / scoring play feed items and their clip-patch state ──────
  var feed=document.getElementById('feed');
  var cutoff=Date.now()-2*60*60*1000;
  var hrItems=feedItems.filter(function(item){
    if(!item.data||!item.data.batterId) return false;
    if(item.data.event!=='Home Run'&&!item.data.scoring) return false;
    return item.ts&&item.ts.getTime()>=cutoff;
  });
  html+='<div style="margin-bottom:16px;border:1px solid var(--border);border-radius:8px;overflow:hidden">';
  html+='<div style="background:var(--card2);padding:8px 12px;font-weight:700;color:var(--text)">🎯 HR / scoring plays in last 2h — '+hrItems.length+' found</div>';
  if(!hrItems.length){
    html+='<div style="padding:8px 12px;color:var(--muted)">No qualifying plays in feedItems yet.</div>';
  } else {
    hrItems.slice().reverse().forEach(function(item){
      var domEl=feed&&feed.querySelector('[data-ts="'+item.ts.getTime()+'"][data-gamepk="'+item.gamePk+'"]');
      var patched=domEl&&domEl.dataset.clipPatched==='1';
      var patchBadge=patched?'<span style="background:rgba(34,197,94,.2);color:#4ade80;padding:1px 6px;border-radius:4px">✓ clip attached</span>':'<span style="background:rgba(245,158,11,.18);color:#fbbf24;padding:1px 6px;border-radius:4px">⏳ pending</span>';
      var domBadge=domEl?'<span style="color:var(--muted)">in DOM</span>':'<span style="color:#f87171">not in DOM</span>';
      html+='<div style="padding:7px 12px;border-top:1px solid var(--border);display:flex;gap:8px;flex-wrap:wrap;align-items:center">';
      html+=patchBadge+' '+domBadge;
      html+='<span style="color:var(--text)">'+escHtml(item.data.batterName||'?')+'</span>';
      html+='<span style="color:var(--muted)">'+escHtml(item.data.event||'')+'</span>';
      html+='<span style="color:var(--muted);font-size:.65rem">pk:'+item.gamePk+' ts:'+new Date(item.ts).toLocaleTimeString()+'</span>';
      html+='</div>';
    });
  }
  html+='</div>';

  // ── Section 2: liveContentCache per game ───────────────────────────────────
  var pks=Object.keys(liveContentCache);
  html+='<div style="margin-bottom:8px;font-weight:700;color:var(--text);font-size:.8rem">📦 liveContentCache — '+pks.length+' game'+(pks.length===1?'':'s')+'</div>';
  if(!pks.length){
    html+='<div style="color:var(--muted);padding:8px 0 4px">No content fetched yet. Click "↻ Fetch Now" above after HR plays appear in the feed.</div>';
  }
  pks.forEach(function(pk){
    var entry=liveContentCache[pk];
    var clips=entry.items||[];
    var age=Math.round((Date.now()-entry.fetchedAt)/1000);
    html+='<div style="margin-bottom:16px;border:1px solid var(--border);border-radius:8px;overflow:hidden">';
    html+='<div style="background:var(--card2);padding:8px 12px;font-weight:700;color:var(--text);display:flex;justify-content:space-between;align-items:center">';
    html+='<span>Game '+pk+' &nbsp;<span style="color:var(--muted);font-weight:400">('+clips.length+' video clips)</span></span>';
    html+='<span style="color:var(--muted);font-size:.65rem;font-weight:400">fetched '+age+'s ago</span>';
    html+='</div>';
    if(!clips.length){
      html+='<div style="padding:8px 12px;color:var(--muted)">No playable video clips returned from API.</div>';
    } else {
      clips.forEach(function(clip,i){
        var title=(clip.headline||clip.blurb||'').toLowerCase();
        var isStatcast2=(title.indexOf('statcast')!==-1||title.indexOf('savant')!==-1)||
          (clip.keywordsAll||[]).some(function(kw){var v=(kw.value||kw.slug||'').toLowerCase();return v==='statcast'||v==='savant';});
        var hasScoringKw=(clip.keywordsAll||[]).some(function(kw){var v=kw.value||kw.slug||'';return v==='home-run'||v==='scoring-play'||v==='walk-off';});
        var playerIds=(clip.keywordsAll||[]).filter(function(kw){return kw.type==='player_id'||(kw.slug&&kw.slug.startsWith('player_id-'));}).map(function(kw){return kw.type==='player_id'?kw.value:kw.slug.split('-')[1];});
        var hasPlayback=!!pickPlayback(clip.playbacks);
        var clipTs=clip.date?new Date(clip.date).getTime():null;
        var clipAge=clipTs?Math.round((Date.now()-clipTs)/60000)+'m ago':'no date';
        var statcastBadge=isStatcast2?'<span style="background:rgba(220,60,60,.25);color:#f87171;padding:1px 5px;border-radius:4px">🚫SC</span>':'<span style="background:rgba(34,197,94,.15);color:#4ade80;padding:1px 5px;border-radius:4px">✓bc</span>';
        var scoringBadge=hasScoringKw?'<span style="background:rgba(245,158,11,.2);color:#fbbf24;padding:1px 5px;border-radius:4px">✓kw</span>':'<span style="color:var(--muted);padding:1px 5px">—kw</span>';
        var playbackBadge=hasPlayback?'<span style="color:#4ade80">✓mp4</span>':'<span style="color:#f87171">✗mp4</span>';
        html+='<div style="padding:6px 12px;border-top:1px solid var(--border);'+(isStatcast2?'opacity:.4':'')+'">';
        html+='<div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center;margin-bottom:3px">';
        html+='<span style="color:var(--muted);min-width:16px">'+i+'.</span>';
        html+=statcastBadge+' '+scoringBadge+' '+playbackBadge;
        html+='<span style="color:var(--muted);font-size:.62rem">'+clipAge+'</span>';
        html+='</div>';
        html+='<div style="color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px" title="'+escHtml(clip.headline||'')+'">'+escHtml(clip.headline||clip.blurb||'(no title)')+'</div>';
        if(playerIds.length) html+='<div style="color:var(--muted);font-size:.62rem">player_ids: '+escHtml(playerIds.join(', '))+'</div>';
        var kwTax=(clip.keywordsAll||[]).filter(function(kw){return kw.type==='taxonomy';}).map(function(kw){return kw.value||kw.slug;}).join(', ');
        if(kwTax) html+='<div style="color:var(--muted);font-size:.62rem">taxonomy: '+escHtml(kwTax)+'</div>';
        html+='</div>';
      });
    }
    html+='</div>';
  });

  el.innerHTML=html;
}
function escHtml(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function copyVideoDebug(){
  var btn=document.getElementById('videoDebugCopyBtn');
  function flash(t){if(btn){var o=btn.textContent;btn.textContent=t;setTimeout(function(){btn.textContent=o;},1800);}}
  var feed=document.getElementById('feed');
  var cutoff=Date.now()-2*60*60*1000;
  var pendingItems=feedItems.filter(function(item){
    return item.data&&item.data.batterId&&(item.data.event==='Home Run'||item.data.scoring)&&item.ts&&item.ts.getTime()>=cutoff;
  }).map(function(item){
    var domEl=feed&&feed.querySelector('[data-ts="'+item.ts.getTime()+'"][data-gamepk="'+item.gamePk+'"]');
    return {gamePk:item.gamePk,batterName:item.data.batterName,batterId:item.data.batterId,event:item.data.event,ts:item.ts.toISOString(),clipPatched:!!(domEl&&domEl.dataset.clipPatched==='1')};
  });
  var cacheOut={};
  Object.keys(liveContentCache).forEach(function(pk){
    var entry=liveContentCache[pk];
    cacheOut[pk]={fetchedAt:new Date(entry.fetchedAt).toISOString(),clipCount:(entry.items||[]).length,clips:(entry.items||[]).map(function(clip){
      var playerIds=(clip.keywordsAll||[]).filter(function(kw){return kw.type==='player_id'||(kw.slug&&kw.slug.startsWith('player_id-'));}).map(function(kw){return kw.type==='player_id'?kw.value:kw.slug.split('-')[1];});
      var taxonomy=(clip.keywordsAll||[]).filter(function(kw){return kw.type==='taxonomy';}).map(function(kw){return kw.value||kw.slug;});
      var isStatcast=(clip.headline||clip.blurb||'').toLowerCase().indexOf('statcast')!==-1||taxonomy.some(function(v){return v==='statcast'||v==='savant';});
      return {id:clip.id,headline:clip.headline||clip.blurb,date:clip.date,isStatcast:isStatcast,hasScoringKw:taxonomy.some(function(v){return v==='home-run'||v==='scoring-play'||v==='walk-off';}),playerIds:playerIds,taxonomy:taxonomy,hasPlayback:!!pickPlayback(clip.playbacks)};
    })};
  });
  var text=JSON.stringify({pendingFeedItems:pendingItems,liveContentCache:cacheOut},null,2);
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(function(){flash('✓ Copied!');}).catch(function(){fallbackCopy(text);flash('✓ Copied (fallback)');});
  } else { fallbackCopy(text); flash('✓ Copied (fallback)'); }
}


function patchFeedItemWithClip(feedItemTs,gamePk,clip){
  var url=pickPlayback(clip.playbacks);
  var thumb=pickHeroImage(clip);
  var title=clip.headline||clip.blurb||'Watch Highlight';
  if(!url) return;
  var el=document.querySelector('#feed [data-ts="'+feedItemTs+'"][data-gamepk="'+gamePk+'"]');
  if(!el||el.dataset.clipPatched) return;
  el.dataset.clipPatched='1';
  var wrap=document.createElement('div');
  wrap.style.cssText='margin-top:8px;cursor:pointer;position:relative;border-radius:6px;overflow:hidden;background:#000;line-height:0;width:80%;margin-left:auto;margin-right:auto';
  wrap.innerHTML=(thumb?'<img src="'+thumb+'" style="width:100%;aspect-ratio:16/9;object-fit:cover;display:block">':'<div style="width:100%;aspect-ratio:16/9;background:#111"></div>')
    +'<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center">'
    +'<div style="width:38px;height:38px;border-radius:50%;background:rgba(0,0,0,.65);display:flex;align-items:center;justify-content:center;color:#fff;font-size:1rem;padding-left:3px">▶</div>'
    +'</div>';
  wrap.onclick=function(e){e.stopPropagation();openVideoOverlay(url,title);};
  el.appendChild(wrap);
}

function patchStoryWithClip(gamePk,batterId,batterName,clip){
  var url=pickPlayback(clip.playbacks);
  if(!url) return;
  var lastName=(batterName||'').split(' ').pop();
  var story=storyPool.find(function(s){
    return s.gamePk===gamePk&&s.id.indexOf('hr_')===0&&lastName&&s.headline.indexOf(lastName)!==-1;
  });
  if(!story) return;
  story.videoUrl=url;
  story.videoThumb=pickHeroImage(clip)||null;
  story.videoTitle=clip.headline||clip.blurb||'';
  if(storyShownId===story.id) renderStoryCard(story);
}

// ─────────────────────────────────────────────────────────────────────────────

function pickPlayback(playbacks) {
  if(!playbacks||!playbacks.length) return null;
  var mp4=playbacks.find(function(p){return p.name==='mp4Avc';});
  if(mp4) return mp4.url;
  var any=playbacks.find(function(p){return p.url&&p.url.endsWith('.mp4');});
  return any?any.url:null;
}

function pickHeroImage(item) {
  if(!item||!item.image) return null;
  var raw=item.image.cuts;
  if(!raw) return null;
  // MLB API returns cuts as array [{src,width,aspectRatio}] or as object {"WxH":{src,...}}
  var cuts=Array.isArray(raw)?raw:Object.values(raw);
  if(!cuts.length) return null;
  var c16=cuts.filter(function(c){return c.aspectRatio==='16:9'&&(c.width||0)>=480;});
  c16.sort(function(a,b){return (a.width||0)-(b.width||0);});
  if(c16.length) return c16[0].src||c16[0].url||null;
  cuts.sort(function(a,b){return (b.width||0)-(a.width||0);});
  return cuts.length?(cuts[0].src||cuts[0].url||null):null;
}

async function renderYesterdayRecap() {
  var card=document.getElementById('yesterdayCard');
  if(!card) return;
  var activeCache=getYdActiveCache();
  if(!activeCache||!activeCache.length){
    var noGamesMsg=ydDateOffset===-1?'No games yesterday.':'No games played on '+getYesterdayDisplayStr()+'.';
    card.innerHTML='<div class="empty-state" style="padding:48px 24px">'+noGamesMsg+'</div>';
    return;
  }

  var ydCards=getYesterdayCollectedCards();
  var cardsHtml='';
  if(ydCards.length&&window.CollectionCard){
    // Pre-fetch career stats for all cards (same pattern as renderCollectionBook)
    await Promise.all(ydCards.map(function(s){
      return collectionCareerStatsCache[s.playerId]
        ? Promise.resolve()
        : fetchCareerStats(s.playerId, s.position).then(function(cs){ if(cs) collectionCareerStatsCache[s.playerId]=cs; });
    }));
    var miniCards=ydCards.map(function(s){
      var key=s.playerId+'_'+s.eventType;
      var displayEvent=s.events&&s.events[0]||null;
      var careerStats=collectionCareerStatsCache[s.playerId]||null;
      var cardHtml=window.CollectionCard.renderMiniCard(s,displayEvent,careerStats,null);
      // inject click handler onto the <article tag
      return cardHtml.replace('<article ','<article onclick="openCardFromKey(\''+key+'\')" style="cursor:pointer" ');
    }).join('');
    var cardsLabel='🎴 CARDS — '+getYesterdayDisplayStr().toUpperCase();
    cardsHtml='<div style="padding:16px 20px;border-top:1px solid var(--border)">'
      +'<div style="font-size:.7rem;font-weight:700;color:var(--muted);letter-spacing:.1em;margin-bottom:12px">'+cardsLabel+'</div>'
      +'<div class="yd-clip-strip" style="display:flex;gap:0.75rem;overflow-x:auto;padding-bottom:8px">'+miniCards+'</div>'
      +'</div>';
  }

  var tilesHtml=activeCache.map(function(item){
    var g=gameStates[item.gamePk];
    // Parse teams from headline: "Yesterday: WIN beat LOS W-L · ..."
    var awayId=null,homeId=null;
    // Try to get team IDs from scheduleData
    var sched=(scheduleData||[]).find(function(s){return s.gamePk===item.gamePk||s.gamePk===+item.gamePk;});
    if(sched){awayId=sched.teams&&sched.teams.away&&sched.teams.away.team&&sched.teams.away.team.id;homeId=sched.teams&&sched.teams.home&&sched.teams.home.team&&sched.teams.home.team.id;}
    var awayTeam=awayId&&TEAMS.find(function(t){return t.id===awayId;});
    var homeTeam=homeId&&TEAMS.find(function(t){return t.id===homeId;});
    var capRow='';
    if(awayTeam&&homeTeam){
      capRow='<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">'
        +'<img src="https://www.mlbstatic.com/team-logos/'+awayId+'.svg" style="width:28px;height:28px;object-fit:contain" onerror="this.style.display=\'none\'">'
        +'<span style="font-size:.75rem;font-weight:700;color:var(--muted)">'+awayTeam.short+'</span>'
        +'<span style="font-size:.72rem;color:var(--muted)">@</span>'
        +'<img src="https://www.mlbstatic.com/team-logos/'+homeId+'.svg" style="width:28px;height:28px;object-fit:contain" onerror="this.style.display=\'none\'">'
        +'<span style="font-size:.75rem;font-weight:700;color:var(--muted)">'+homeTeam.short+'</span>'
        +'</div>';
    }
    // Use the video's own title if available, otherwise fall back to generated story headline
    var contentItems=(yesterdayContentCache[item.gamePk]&&yesterdayContentCache[item.gamePk].highlights&&yesterdayContentCache[item.gamePk].highlights.highlights&&yesterdayContentCache[item.gamePk].highlights.highlights.items)||[];
    var videoTitle=contentItems[0]&&(contentItems[0].headline||contentItems[0].blurb);
    var headlineText=videoTitle||(item.headline.replace(/^Yesterday:\s*/,''));
    var videoRegion='<div id="ydvideo_'+item.gamePk+'" style="margin-top:10px"></div>';
    return '<div id="ydtile_'+item.gamePk+'" class="card" style="padding:16px 18px">'
      +capRow
      +'<div class="yd-tile-headline" style="font-size:.88rem;color:var(--text);font-weight:600;line-height:1.45">'+headlineText+'</div>'
      +(item.sub?'<div style="font-size:.72rem;color:var(--muted);margin-top:4px">'+item.sub+'</div>':'')
      +videoRegion
      +'<div style="margin-top:12px"><button onclick="showLiveGame('+item.gamePk+')" style="background:none;border:1px solid var(--border);border-radius:16px;color:var(--accent);font-size:.72rem;font-weight:600;padding:5px 12px;cursor:pointer">Box Score →</button></div>'
      +'</div>';
  }).join('');
  var tilesGrid='<div class="yd-tiles-grid">'+tilesHtml+'</div>';

  card.innerHTML=''
    +'<div id="ydHeroRegion"></div>'
    +'<div id="ydVideoMeta" style="max-width:1100px;margin:0 auto;padding:8px 4px 0"></div>'
    +'<div id="ydHeroesStrip"></div>'
    +tilesGrid
    +cardsHtml;

  // Lazy-load video strips as tiles scroll into view
  if('IntersectionObserver' in window) {
    var obs=new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(!entry.isIntersecting) return;
        var tile=entry.target;
        var pk=tile.dataset.gamepk;
        if(pk) { loadYesterdayVideoStrip(+pk); obs.unobserve(tile); }
      });
    },{root:null,rootMargin:'200px'});
    activeCache.forEach(function(item){
      var tile=document.getElementById('ydtile_'+item.gamePk);
      if(tile){ tile.dataset.gamepk=item.gamePk; obs.observe(tile); }
    });
  } else {
    // Fallback: load all immediately
    activeCache.forEach(function(item){ loadYesterdayVideoStrip(item.gamePk); });
  }
  // Eagerly load hero for the marquee game, then prefetch all game content
  // (prefetch resolves → buildTopHighlightsCarousel() builds the full clip carousel)
  loadYesterdayHero();
  prefetchAllYesterdayContent();
}

function pickMarqueeGame() {
  var cache=getYdActiveCache();
  if(!cache||!cache.length) return null;
  // Priority: walk-off > no-hitter > first game in cache (most notable by position)
  var walkoff=cache.find(function(item){return item.headline&&(item.headline.indexOf('Walk-off')!==-1||item.headline.indexOf('walk-off')!==-1);});
  if(walkoff) return walkoff;
  var nohit=cache.find(function(item){return item.headline&&item.headline.indexOf('No-hitter')!==-1;});
  if(nohit) return nohit;
  return cache[0];
}


function mountSharedPlayer(heroRegion) {
  if(!heroRegion||heroRegion.dataset.mounted) return;
  heroRegion.dataset.mounted='1';
  heroRegion.className='yd-hero-grid';
  heroRegion.innerHTML=
    '<div class="yd-player-col">'
    +'<div class="yd-video-wrap"><video id="ydSharedVideo" controls playsinline></video></div>'
    +'</div>';
}

async function loadYesterdayHero() {
  // Fast path: mount the player immediately with the marquee game's top editorial clip.
  // Full carousel (one clip per game) is built by buildTopHighlightsCarousel() after
  // prefetchAllYesterdayContent() resolves all game content.
  var heroRegion=document.getElementById('ydHeroRegion');
  if(!heroRegion) return;
  var marquee=pickMarqueeGame();
  if(!marquee) return;
  var content=await fetchGameContent(marquee.gamePk);
  if(!content) return;
  var items=(content.highlights&&content.highlights.highlights&&content.highlights.highlights.items)||[];
  var playable=items.filter(function(item){return !!pickPlayback(item.playbacks);});
  if(!playable.length) return;
  // Prefer index 2 (first actual play highlight); fall back to index 0 if fewer than 3 clips
  var first=playable[2]||playable[0];
  mountSharedPlayer(heroRegion);
  loadClipIntoSharedPlayer(
    pickPlayback(first.playbacks),
    pickHeroImage(first)||'',
    first.headline||first.blurb||'Top Highlight',
    first.blurb||'',
    'TOP HIGHLIGHT'
  );
}

function buildTopHighlightsCarousel() {
  // Runs after all game content is cached.
  // Collects items[2..4] (actual play highlights, skipping recap at 0 + condensed at 1)
  // from each game — marquee first. Builds vertical playlist on desktop, horizontal strip on mobile.
  var heroRegion=document.getElementById('ydHeroRegion');
  var ydCache=getYdActiveCache();
  if(!heroRegion||!ydCache||!ydCache.length) return;
  var marquee=pickMarqueeGame();
  var ordered=ydCache.slice().sort(function(a,b){
    if(marquee){
      if(a.gamePk===marquee.gamePk) return -1;
      if(b.gamePk===marquee.gamePk) return 1;
    }
    return 0;
  });
  ydHighlightClips=[];
  ordered.forEach(function(game){
    var content=yesterdayContentCache[game.gamePk];
    if(!content) return;
    var items=(content.highlights&&content.highlights.highlights&&content.highlights.highlights.items)||[];
    var playable=items.filter(function(item){return !!pickPlayback(item.playbacks);});
    // Take indices 2, 3, 4 — actual play highlights (skip 0=recap, 1=condensed)
    playable.slice(2,5).forEach(function(clip){ ydHighlightClips.push(clip); });
  });
  if(!ydHighlightClips.length) return;
  mountSharedPlayer(heroRegion);
  var existing=document.getElementById('ydClipCarousel');
  if(existing) existing.parentNode.removeChild(existing);
  var chips=ydHighlightClips.map(function(clip,i){
    var thumb=pickHeroImage(clip)||'';
    var title=(clip.headline||clip.blurb||'Highlight').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    return '<div class="yd-clip-chip'+(i===0?' active':'')+'" onclick="selectYdClip('+i+')">'
      +'<div class="yd-chip-thumb"><span style="font-size:1.1rem;color:var(--muted)">▶</span>'
      +(thumb?'<img src="'+thumb+'" onerror="this.style.display=\'none\'" alt="">':'')
      +'</div>'
      +'<div class="yd-chip-text">'+title+'</div>'
      +'</div>';
  }).join('');
  heroRegion.insertAdjacentHTML('beforeend',
    '<div id="ydClipCarousel" class="yd-playlist yd-clip-strip">'
    +'<div class="yd-playlist-kicker">TOP PLAYS</div>'
    +chips+'</div>'
  );
  // Load first clip into the player
  loadClipIntoSharedPlayer(
    pickPlayback(ydHighlightClips[0].playbacks),
    pickHeroImage(ydHighlightClips[0])||'',
    ydHighlightClips[0].headline||ydHighlightClips[0].blurb||'Top Highlight',
    ydHighlightClips[0].blurb||'',
    'TOP HIGHLIGHT'
  );
}

function selectYdClip(idx) {
  var carousel=document.getElementById('ydClipCarousel');
  if(carousel) carousel.querySelectorAll('.yd-clip-chip').forEach(function(c,i){ c.classList.toggle('active',i===idx); });
  var clip=ydHighlightClips[idx];
  if(!clip) return;
  loadClipIntoSharedPlayer(
    pickPlayback(clip.playbacks),
    pickHeroImage(clip)||'',
    clip.headline||clip.blurb||'Highlight',
    clip.blurb||'',
    'NOW PLAYING'
  );
}

function loadClipIntoSharedPlayer(url, poster, title, blurb, kicker) {
  var video=document.getElementById('ydSharedVideo');
  if(!video) return;
  stopAllMedia('highlight');
  video.pause();
  video.removeAttribute('src');
  video.load();
  if(poster) video.poster=poster; else video.removeAttribute('poster');
  video.src=url;
  var meta=document.getElementById('ydVideoMeta');
  if(meta){
    var k=kicker||'NOW PLAYING';
    var b=(blurb&&blurb!==title)?'<div style="font-size:.72rem;color:var(--muted);margin-top:2px">'+blurb+'</div>':'';
    meta.innerHTML='<div style="font-size:.62rem;font-weight:700;color:var(--muted);letter-spacing:.1em;margin-bottom:3px">'+k+'</div>'
      +'<div style="font-size:.92rem;font-weight:700;color:var(--text);line-height:1.35">'+(title||'')+'</div>'+b;
  }
  var heroRegion=document.getElementById('ydHeroRegion');
  if(heroRegion) heroRegion.scrollIntoView({behavior:'smooth',block:'start'});
}

async function prefetchAllYesterdayContent() {
  var cache=getYdActiveCache();
  if(!cache||!cache.length) return;
  await Promise.all(cache.map(function(item){return fetchGameContent(item.gamePk);}));
  buildAndRenderYesterdayHeroes();
  buildTopHighlightsCarousel();
}

function buildYesterdayHeroes() {
  // Returns array of hero objects derived purely from yesterdayContentCache — no new fetches
  var heroes=[];
  var seenPlayers={};
  var ydCache=getYdActiveCache();
  if(!ydCache.length) return heroes;
  ydCache.forEach(function(cacheItem){
    var content=yesterdayContentCache[cacheItem.gamePk];
    if(!content) return;
    var allItems=(content.highlights&&content.highlights.highlights&&content.highlights.highlights.items)||[];
    // Exclude data-visualization (darkroom) clips — they share player_ids but are analysis overlays
    var items=allItems.filter(function(clip){
      return !(clip.keywordsAll||[]).some(function(kw){
        var v=(kw.value||kw.slug||'').toLowerCase();
        return v==='data-visualization'||v==='data_visualization';
      });
    });
    // Group clips by player_id keyword
    var playerClips={};
    items.forEach(function(clip){
      if(!clip.keywordsAll) return;
      var pidKw=clip.keywordsAll.find(function(kw){return kw.type==='player_id'||kw.slug&&kw.slug.startsWith('player_id-');});
      if(!pidKw) return;
      var pid=pidKw.value||pidKw.displayName||pidKw.slug;
      if(!pid) return;
      if(!playerClips[pid]) playerClips[pid]={clips:[],name:'',isHR:false,isWalkoff:false,teamAbbr:''};
      playerClips[pid].clips.push(clip);
      // Detect HR
      var isHRClip=clip.keywordsAll.some(function(kw){return (kw.type==='taxonomy'&&kw.value==='home-run')||kw.slug==='home-run';});
      if(isHRClip) playerClips[pid].isHR=true;
      // Detect walk-off
      var isWO=(clip.headline||'').toLowerCase().indexOf('walk-off')!==-1||
               (clip.blurb||'').toLowerCase().indexOf('walk-off')!==-1||
               clip.keywordsAll.some(function(kw){return kw.value==='walk-off'||kw.slug==='walk-off';});
      if(isWO) playerClips[pid].isWalkoff=true;
      // Capture player name from headline if not yet set
      if(!playerClips[pid].name&&clip.headline) playerClips[pid].name=clip.headline.split("'")[0].split(' ').slice(0,2).join(' ');
    });
    // Build hero objects per player, dedup across all games
    Object.keys(playerClips).forEach(function(pid){
      if(seenPlayers[pid]) return;
      seenPlayers[pid]=true;
      var pc=playerClips[pid];
      if(!pc.isHR&&!pc.isWalkoff) return; // only HR hitters and walk-off heroes
      var hrCount=pc.clips.filter(function(c){return c.keywordsAll&&c.keywordsAll.some(function(kw){return kw.value==='home-run'||kw.slug==='home-run';});}).length;
      var role=pc.isWalkoff?'walkoff':hrCount>=2?'multi-HR':'HR';
      // Pick best clip: walk-off/HR first, then longest
      var clip=pc.clips.find(function(c){return pc.isWalkoff&&((c.headline||'').toLowerCase().indexOf('walk-off')!==-1);});
      if(!clip) clip=pc.clips.find(function(c){return c.keywordsAll&&c.keywordsAll.some(function(kw){return kw.value==='home-run'||kw.slug==='home-run';});});
      if(!clip) clip=pc.clips[0];
      var imgUrl=pickHeroImage(clip)||'';
      if(!imgUrl) return; // skip if no photo
      heroes.push({pid:pid,playerName:pc.name,role:role,hrCount:hrCount,imageUrl:imgUrl,blurb:clip.headline||clip.blurb||'',gamePk:cacheItem.gamePk,isWalkoff:pc.isWalkoff});
    });
  });
  // Sort: walk-off first, then multi-HR, then single HR
  var roleOrder={walkoff:0,'multi-HR':1,HR:2};
  heroes.sort(function(a,b){return (roleOrder[a.role]||9)-(roleOrder[b.role]||9);});
  return heroes;
}

function buildAndRenderYesterdayHeroes() {
  var stripEl=document.getElementById('ydHeroesStrip');
  if(!stripEl) return;
  var heroes=buildYesterdayHeroes();
  if(!heroes.length) return;
  var roleLabel={walkoff:'WALK-OFF','multi-HR':function(h){return h.hrCount+' HR';},'HR':'HR'};
  var tiles=heroes.map(function(h){
    var lbl=typeof roleLabel[h.role]==='function'?roleLabel[h.role](h):roleLabel[h.role];
    var lastName=h.playerName?h.playerName.split(' ').pop():h.playerName;
    return '<div onclick="scrollToYdTile('+h.gamePk+')" style="cursor:pointer;flex-shrink:0;width:110px;position:relative;border-radius:8px;overflow:hidden;border:1px solid var(--border)">'
      +'<img src="'+h.imageUrl+'" style="width:110px;height:74px;object-fit:cover;display:block" loading="lazy">'
      +'<div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,.82));padding:4px 6px">'
      +'<div style="font-size:.58rem;font-weight:700;color:#f59e0b;letter-spacing:.06em">'+lbl+'</div>'
      +'<div style="font-size:.68rem;font-weight:700;color:#fff">'+lastName+'</div>'
      +'</div>'
      +'</div>';
  }).join('');
  var heroesLabel=ydDateOffset===-1?'YESTERDAY\'S HEROES':'HEROES · '+getYesterdayDisplayStr().toUpperCase();
  stripEl.innerHTML='<div style="padding:10px 16px 0;border-top:1px solid var(--border)">'
    +'<div style="font-size:.65rem;font-weight:700;color:var(--muted);letter-spacing:.1em;margin-bottom:8px">'+heroesLabel+'</div>'
    +'<div class="yd-clip-strip" style="display:flex;gap:8px;overflow-x:auto;padding-bottom:8px">'+tiles+'</div>'
    +'</div>';
}

function scrollToYdTile(gamePk) {
  var tile=document.getElementById('ydtile_'+gamePk);
  if(tile) tile.scrollIntoView({behavior:'smooth',block:'start'});
}

async function loadYesterdayVideoStrip(gamePk) {
  var region=document.getElementById('ydvideo_'+gamePk);
  if(!region||region.dataset.loaded) return;
  region.dataset.loaded='1';
  var content=await fetchGameContent(gamePk);
  if(!content) return;
  var items=(content.highlights&&content.highlights.highlights&&content.highlights.highlights.items)||[];
  if(!items.length) return;
  // Filter to items that have an mp4 playback URL
  var playable=items.filter(function(item){return !!pickPlayback(item.playbacks);});
  if(!playable.length) return;
  region.innerHTML=renderHighlightStrip(playable, gamePk);
  // Patch tile headline now that content is loaded
  var tile=document.getElementById('ydtile_'+gamePk);
  if(tile&&playable[0]){
    var vTitle=playable[0].headline||playable[0].blurb;
    if(vTitle){
      var headlineEl=tile.querySelector('.yd-tile-headline');
      if(headlineEl) headlineEl.textContent=vTitle;
    }
  }
}

function renderHighlightStrip(items, gamePk) {
  // Show only items[0] — the game recap/highlight — as a single featured thumbnail.
  // items[1] (condensed game) and items[2+] (play highlights) surface in the top carousel.
  var item=items[0];
  if(!item) return '';
  var imgUrl=pickHeroImage(item)||'';
  var title=(item.headline||item.blurb||'Game Highlight').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  return '<div class="yd-game-thumb" onclick="playYesterdayClip('+JSON.stringify(gamePk)+',0)">'
    +(imgUrl
      ?'<img src="'+imgUrl+'" loading="lazy" alt="">'
      :'<div style="width:100%;height:140px;background:var(--card);display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:2rem">▶</div>')
    +'<div class="yd-game-thumb-play"><span>▶</span></div>'
    +'<div class="yd-game-thumb-label">'+title+'</div>'
    +'</div>';
}

function playYesterdayClip(gamePk, itemIndex) {
  var content=yesterdayContentCache[gamePk];
  if(!content) return;
  var items=(content.highlights&&content.highlights.highlights&&content.highlights.highlights.items)||[];
  var playable=items.filter(function(item){return !!pickPlayback(item.playbacks);});
  var item=playable[itemIndex];
  if(!item) return;
  // Deselect any active carousel chip since this is a per-game tile play
  var carousel=document.getElementById('ydClipCarousel');
  if(carousel) carousel.querySelectorAll('.yd-clip-chip').forEach(function(c){c.classList.remove('active');});
  loadClipIntoSharedPlayer(
    pickPlayback(item.playbacks),
    pickHeroImage(item)||'',
    item.headline||item.blurb||'Game Highlight',
    item.blurb||'',
    'GAME HIGHLIGHT'
  );
}

function filterCollection(f) { collectionFilter = f; collectionPage = 0; renderCollectionBook(); }
function sortCollection(s)   { collectionSort = s;   collectionPage = 0; renderCollectionBook(); }
function goCollectionPage(dir) {
  var col = loadCollection();
  var slots = Object.values(col);
  if (collectionFilter !== 'all') slots = slots.filter(function(s) { return s.eventType === collectionFilter; });
  if (collectionSort === 'team') {
    var abbrs = [];
    slots.forEach(function(s) { if (abbrs.indexOf(s.teamAbbr) === -1) abbrs.push(s.teamAbbr); });
    abbrs.sort();
    collectionPage = Math.max(0, Math.min(abbrs.length - 1, collectionPage + dir));
  } else {
    var totalPages = Math.max(1, Math.ceil(slots.length / 9));
    collectionPage = Math.max(0, Math.min(totalPages - 1, collectionPage + dir));
  }
  renderCollectionBook();
}

async function renderCollectionBook() {
  var book = document.getElementById('collectionBook');
  if (!book) return;
  var col = loadCollection();
  var slots = Object.values(col);
  if (collectionFilter !== 'all') slots = slots.filter(function(s) { return s.eventType === collectionFilter; });
  var teamContext = null;
  if (collectionSort === 'rarity') {
    slots.sort(function(a,b) { return tierRank(b.tier) - tierRank(a.tier) || b.collectedAt - a.collectedAt; });
  } else if (collectionSort === 'team') {
    // Build sorted unique team list, then isolate the current team as a single page
    var teamAbbrs = [];
    slots.forEach(function(s) { if (teamAbbrs.indexOf(s.teamAbbr) === -1) teamAbbrs.push(s.teamAbbr); });
    teamAbbrs.sort();
    var teamCount = teamAbbrs.length;
    collectionPage = Math.max(0, Math.min(Math.max(0, teamCount - 1), collectionPage));
    var currentAbbr = teamAbbrs[collectionPage] || '';
    slots = slots.filter(function(s) { return s.teamAbbr === currentAbbr; });
    slots.sort(function(a,b) { return tierRank(b.tier) - tierRank(a.tier); });
    var td = TEAMS.find(function(t) { return t.short === currentAbbr; });
    teamContext = {
      abbr: currentAbbr,
      primary:   (td && td.primary)   || '#444444',
      secondary: (td && td.secondary) || '#888888',
      teamId:    td ? td.id : null,
      teamIdx:   collectionPage,
      teamCount: teamCount,
    };
  } else {
    slots.sort(function(a,b) { return b.collectedAt - a.collectedAt; });
  }

  if (collectionSort !== 'team') {
    var totalPages = Math.max(1, Math.ceil(slots.length / 9));
    collectionPage = Math.min(collectionPage, totalPages - 1);
  }

  // Fetch career stats for visible slots (all slots in team view; current page for others)
  var pageSlots = (collectionSort === 'team')
    ? slots
    : slots.slice(collectionPage * 9, (collectionPage + 1) * 9);
  var careerStatsMap = Object.assign({}, collectionCareerStatsCache);
  await Promise.all(pageSlots.map(async function(slot) {
    if (!careerStatsMap[slot.playerId]) {
      var cs = await fetchCareerStats(slot.playerId, slot.position);
      if (cs) careerStatsMap[slot.playerId] = cs;
    }
  }));

  collectionSlotsDisplay = slots.slice(); // snapshot for openCardFromCollection index lookup
  book.innerHTML = window.CollectionCard.renderBook({
    slots: slots,
    filter: collectionFilter,
    sort: collectionSort,
    page: collectionPage,
    careerStatsMap: careerStatsMap,
    teamContext: teamContext,
  });
}

function openCardFromCollection(idx) {
  var slot = collectionSlotsDisplay[idx];
  if (!slot || !slot.events || !slot.events.length) return;

  // Pick a random event from this slot's stored events (all at current tier)
  var ev = slot.events[Math.floor(Math.random() * slot.events.length)];

  // Resolve team IDs from stored abbreviations
  var awayTeam = TEAMS.find(function(t) { return t.short === ev.awayAbbr; });
  var homeTeam = TEAMS.find(function(t) { return t.short === ev.homeAbbr; });
  var awayTeamId = awayTeam ? awayTeam.id : 0;
  var homeTeamId = homeTeam ? homeTeam.id : 0;

  // Leave collection open — playerCardOverlay (z-index 600) renders above it (z-index 500)
  if (slot.eventType === 'HR') {
    // Build overrideStats in MLB API field-name format so resolvePlayerCardData can use it
    var careerStats = collectionCareerStatsCache[slot.playerId];
    var overrideStats = null;
    if (careerStats && careerStats.careerHR !== undefined) {
      overrideStats = {
        avg:       careerStats.careerAVG,
        ops:       careerStats.careerOPS,
        homeRuns:  careerStats.careerHR,
        rbi:       careerStats.careerRBI,
        _position: slot.position,  // fallback for rosterData miss
      };
    } else if (slot.position) {
      overrideStats = { _position: slot.position };
    }
    showPlayerCard(slot.playerId, slot.playerName, awayTeamId, homeTeamId, ev.halfInning, overrideStats, null, ev.badge, null);

  } else {
    // RBI — extract event type label from stored badge for getRBIBadge recompute
    var badgeUp = (ev.badge || '').toUpperCase();
    var eventType = '';
    if      (badgeUp.indexOf('SINGLE')  !== -1) eventType = 'Single';
    else if (badgeUp.indexOf('DOUBLE')  !== -1) eventType = 'Double';
    else if (badgeUp.indexOf('TRIPLE')  !== -1) eventType = 'Triple';
    else if (badgeUp.indexOf('SAC FLY') !== -1) eventType = 'Sac Fly';
    else if (badgeUp.indexOf('WALK')    !== -1) eventType = 'Walk';
    else if (badgeUp.indexOf('HBP')     !== -1) eventType = 'HBP';
    // Extract stored RBI count from badge ("2-RUN …" → 2, else 1)
    var rbiMatch = badgeUp.match(/^(\d+)-RUN/);
    var rbi = rbiMatch ? parseInt(rbiMatch[1]) : 1;
    showRBICard(slot.playerId, slot.playerName, awayTeamId, homeTeamId, ev.halfInning, rbi, eventType, ev.awayScore, ev.homeScore, ev.inning, null);
  }
}

function openCardFromKey(key) {
  // Stable lookup by playerId_eventType — used from Yesterday Recap cards strip
  // where collectionSlotsDisplay may not be populated yet
  var col=loadCollection();
  var slot=col[key];
  if(!slot||!slot.events||!slot.events.length) return;
  // Sync collectionSlotsDisplay so openCardFromCollection(idx) works if called later
  var sorted=Object.values(col).sort(function(a,b){return (b.collectedAt||0)-(a.collectedAt||0);});
  collectionSlotsDisplay=sorted;
  var idx=sorted.indexOf(slot);
  if(idx===-1){ collectionSlotsDisplay.push(slot); idx=collectionSlotsDisplay.length-1; }
  openCardFromCollection(idx);
}

function updateCollectionUI() {
  var col = loadCollection();
  var count = Object.keys(col).length;
  var countEl = document.getElementById('collectionCountLabel');
  if (countEl) countEl.textContent = count;
  renderCollectionRailModule();
}

function renderCollectionRailModule() {
  var el = document.getElementById('collectionRailModule');
  if (!el || !window.CollectionCard) return;
  var col = loadCollection();
  var count = Object.keys(col).length;
  el.innerHTML = window.CollectionCard.renderRailModule(count);
}

function flashCollectionRailMessage() {
  if (!lastCollectionResult) return;
  var el = document.getElementById('collectionRailModule');
  if (!el) return;
  var r = lastCollectionResult;
  lastCollectionResult = null;
  var tierColor = { legendary:'#e03030', epic:'#f59e0b', rare:'#3b82f6', common:'#9aa0a8' }[r.tier] || '#9aa0a8';
  var name = r.playerName.split(' ').pop();
  var label, sublabel;
  if (r.type === 'new') {
    if (r.tier === 'legendary')   { label = '🔴 LEGENDARY PULL!';     sublabel = name + ' ' + r.eventType; }
    else if (r.tier === 'epic')   { label = '⚡ EPIC CARD!';           sublabel = name + ' ' + r.eventType; }
    else if (r.tier === 'rare')   { label = '💎 Rare Find!';           sublabel = name + ' ' + r.eventType; }
    else                          { label = '🎴 Card Collected';       sublabel = name + ' ' + r.eventType; }
  } else if (r.type === 'upgrade') {
    if (r.tier === 'legendary')   { label = '🔴 LEGENDARY UPGRADE!';   sublabel = name + ' ' + r.eventType; }
    else if (r.tier === 'epic')   { label = '⚡ Upgraded to Epic!';    sublabel = name + ' ' + r.eventType; }
    else if (r.tier === 'rare')   { label = '💎 Upgraded to Rare';     sublabel = name + ' ' + r.eventType; }
    else                          { label = '⬆ Upgraded';             sublabel = name + ' ' + r.eventType; }
  } else {
    if (r.tier === 'legendary')   { label = '👑 Legendary';            sublabel = 'Another ' + name + ' moment!'; }
    else if (r.tier === 'epic')   { label = '🔥 Epic Variant';         sublabel = 'Added to collection'; }
    else if (r.tier === 'rare')   { label = '💎 Rare Variant';         sublabel = name + ' ' + r.eventType; }
    else                          { label = '✓ Already Have';          sublabel = name + ' ' + r.eventType; }
  }
  var dotGlow = (r.tier === 'legendary' || r.tier === 'epic') ? ';box-shadow:0 0 6px ' + tierColor : '';
  el.innerHTML =
    '<div onclick="openCollection()" style="' +
      'display:flex;align-items:center;gap:8px;padding:8px 12px;cursor:pointer;' +
      'border-radius:8px;border:1px solid ' + tierColor + '55;' +
      'background:linear-gradient(90deg,' + tierColor + '22,transparent);' +
      'font-size:.75rem;color:var(--text);white-space:nowrap;overflow:hidden;">' +
      '<span style="width:8px;height:8px;border-radius:50%;background:' + tierColor + ';flex-shrink:0' + dotGlow + '"></span>' +
      '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;">' +
        '<span style="font-weight:700;color:' + tierColor + ';">' + label + '</span>' +
        ' <span style="color:var(--muted);">' + sublabel + '</span>' +
      '</span>' +
      '<span style="color:var(--muted);font-size:11px;flex-shrink:0;">Open →</span>' +
    '</div>';
  setTimeout(function() { renderCollectionRailModule(); }, 4000);
}

function generateTestCard() {
  // Hitting-only entries from active team roster (with known position)
  var rosterEntries = (rosterData.hitting || []).map(function(p) {
    return {
      personId:   p.person.id,
      personName: p.person.fullName,
      teamData:   activeTeam,
      position:   (p.position && p.position.abbreviation) || 'OF'
    };
  });

  // League leaders pool — hitting categories from leagueLeadersCache and dailyLeadersCache
  var seenIds = {};
  rosterEntries.forEach(function(e) { seenIds[e.personId] = true; });
  var leaderEntries = [];
  function addLeadersFromMap(map) {
    Object.keys(map).forEach(function(cat) {
      (map[cat] || []).forEach(function(l) {
        if (!l.person || !l.person.id || seenIds[l.person.id]) return;
        var td = (l.team && l.team.id) ? TEAMS.find(function(t){return t.id===l.team.id;}) : null;
        if (!td) return;
        seenIds[l.person.id] = true;
        leaderEntries.push({
          personId:   l.person.id,
          personName: l.person.fullName,
          teamData:   td,
          position:   'OF'
        });
      });
    });
  }
  // Around the League hitting leaders (populated when League tab visited)
  if (leagueLeadersCache && leagueLeadersCache.hitting) addLeadersFromMap(leagueLeadersCache.hitting);
  // Pulse daily leaders — hitting only (HR/AVG/RBI/SB, not Wins/Saves)
  if (dailyLeadersCache) {
    var hitCats = { homeRuns:1, battingAverage:1, runsBattedIn:1, stolenBases:1 };
    var hitOnly = {};
    Object.keys(dailyLeadersCache).forEach(function(k){ if(hitCats[k]) hitOnly[k]=dailyLeadersCache[k]; });
    addLeadersFromMap(hitOnly);
  }

  var fullPool = rosterEntries.concat(leaderEntries);
  if (!fullPool.length) { showCollectedToast('new', 'No roster loaded', '', 'common'); return; }

  var p = fullPool[Math.floor(Math.random() * fullPool.length)];
  var eventType = Math.random() > 0.5 ? 'HR' : 'RBI';
  var tiers = ['common','common','rare','epic','legendary'];
  var tier = tiers[Math.floor(Math.random() * tiers.length)];
  var badgeMap = {
    HR:  { legendary:'WALK-OFF GRAND SLAM!', epic:'GRAND SLAM!', rare:'GO-AHEAD HOME RUN!', common:'💥 HOME RUN!' },
    RBI: { legendary:'WALK-OFF DOUBLE!', epic:'WALK-OFF SINGLE!', rare:'GO-AHEAD SINGLE!', common:'RBI SINGLE!' }
  };
  var rbiByTier = { legendary:2, epic:1, rare:1, common:1 };
  var innings = [1,2,3,4,5,6,7,8,9];
  var halves  = ['top','bottom'];
  var scores  = [0,1,2,3,4,5];
  collectCard({
    playerId:      p.personId,
    playerName:    p.personName,
    teamAbbr:      p.teamData.short,
    teamPrimary:   p.teamData.primary,
    teamSecondary: p.teamData.secondary,
    position:      p.position,
    eventType:     eventType,
    badge:         badgeMap[eventType][tier],
    rbi:           rbiByTier[tier],
    inning:        innings[Math.floor(Math.random()*innings.length)],
    halfInning:    halves[Math.floor(Math.random()*halves.length)],
    awayAbbr:      'NYM',
    homeAbbr:      p.teamData.short,
    awayScore:     scores[Math.floor(Math.random()*scores.length)],
    homeScore:     scores[Math.floor(Math.random()*scores.length)],
  }, true);  // force=true bypasses demoMode guard
}

function resetCollection() {
  if (!confirm('Reset collection? This cannot be undone.')) return;
  localStorage.removeItem('mlb_card_collection');
  updateCollectionUI();
  if (mlbSessionToken) {
    fetch((window.API_BASE||'')+'/api/collection/reset',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+mlbSessionToken}
    }).catch(()=>{});
  }
  alert('Collection reset');
}

function baseDiamondSvg(on1,on2,on3) {
  var litStyle='fill:#ffd000;filter:drop-shadow(0 0 3px rgba(255,208,0,0.85))';
  var dimStyle='fill:var(--muted,#9aa0a8);opacity:0.4';
  return '<svg class="ticker-diamond" width="28" height="24" viewBox="0 0 28 24" aria-hidden="true">'
    +'<path d="M14,21 L24,12 L14,3 L4,12 Z" fill="none" style="stroke:var(--border,rgba(255,255,255,0.1))" stroke-width="1.2" opacity="0.45"/>'
    +'<circle cx="14" cy="21" r="2" style="'+dimStyle+'"/>'
    +'<circle cx="24" cy="12" r="3" style="'+(on1?litStyle:dimStyle)+'"/>'
    +'<circle cx="14" cy="3"  r="3" style="'+(on2?litStyle:dimStyle)+'"/>'
    +'<circle cx="4"  cy="12" r="3" style="'+(on3?litStyle:dimStyle)+'"/>'
    +'</svg>';
}

function startCountdown(targetMs) {
  if (countdownTimer){clearInterval(countdownTimer);countdownTimer=null;}
  function tick() {
    var el=document.getElementById('heroCountdown');
    if (!el){clearInterval(countdownTimer);countdownTimer=null;return;}
    var diff=targetMs-Date.now();
    if (diff<=0){el.textContent='Starting now';}
    else if (diff>=3600000){var hrs=Math.floor(diff/3600000),mins=Math.ceil((diff%3600000)/60000);el.textContent='First pitch in '+hrs+'h'+(mins>0?' '+mins+'m':'');}
    else{var mins=Math.ceil(diff/60000);el.textContent='First pitch in '+mins+'m';}
  }
  tick(); countdownTimer=setInterval(tick,30000);
}

function localDateStr(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}

function scrollToGame(gamePk){var el=document.querySelector('[data-gamepk="'+gamePk+'"]');if(el)el.scrollIntoView({behavior:'smooth',block:'center'});}

function toggleGame(gamePk) {
  gamePk=+gamePk;
  if (enabledGames.has(gamePk)){
    enabledGames.delete(gamePk);
    document.querySelectorAll('[data-gamepk="'+gamePk+'"]').forEach(function(el){el.classList.add('feed-hidden');});
  } else {
    enabledGames.add(gamePk);
    document.querySelectorAll('[data-gamepk="'+gamePk+'"]').forEach(function(el){el.classList.remove('feed-hidden');});
  }
  updateFeedEmpty(); renderTicker();
}

function myTeamGamePks() {
  var out=new Set();
  Object.values(gameStates).forEach(function(g){
    if (g.awayId===activeTeam.id||g.homeId===activeTeam.id) out.add(g.gamePk);
  });
  return out;
}
function applyMyTeamLens(on) {
  myTeamLens=!!on;
  localStorage.setItem('mlb_my_team_lens', myTeamLens?'1':'0');
  var btn=document.getElementById('myTeamLensBtn'),knob=document.getElementById('myTeamLensKnob');
  if (btn) btn.classList.toggle('on', myTeamLens);
  if (knob) knob.style.left=myTeamLens?'21px':'2px';
  if (myTeamLens) {
    var keep=myTeamGamePks();
    enabledGames=new Set();
    keep.forEach(function(pk){ enabledGames.add(pk); });
    document.querySelectorAll('[data-gamepk]').forEach(function(el){
      var pk=+el.getAttribute('data-gamepk');
      el.classList.toggle('feed-hidden', !keep.has(pk));
    });
  } else {
    Object.keys(gameStates).forEach(function(pk){ enabledGames.add(+pk); });
    document.querySelectorAll('[data-gamepk]').forEach(function(el){ el.classList.remove('feed-hidden'); });
  }
  if (typeof renderTicker==='function') renderTicker();
  updateFeedEmpty();
}
function toggleMyTeamLens(){ applyMyTeamLens(!myTeamLens); }

function updateFeedEmpty() {
  var feed=document.getElementById('feed');
  var hasVisible=!!feed.querySelector('.feed-item:not(.feed-hidden)');
  var hasAnyGames=Object.keys(gameStates).length>0;
  var hasLiveInProgress=Object.values(gameStates).some(function(g){return g.status==='Live'&&g.detailedState==='In Progress';});
  var postSlate=isPostSlate();
  var intermission=!postSlate&&isIntermission();
  var showHype=(!hasVisible&&!(myTeamLens&&hasLiveInProgress))||(!hasAnyGames)||postSlate||intermission;
  if (showHype) renderEmptyState(postSlate, intermission);
  document.getElementById('feedEmpty').style.display=showHype?'':'none';
  var hideWhenEmpty=['gameTicker','sideRailNews','sideRailGames','myTeamLensBtn'];
  document.getElementById('pulse').classList.toggle('pulse-empty', !hasAnyGames || showHype);
  hideWhenEmpty.forEach(function(id){
    var el=document.getElementById(id);
    if(el) el.style.display=showHype?'none':'';
  });
  var ybtn=document.getElementById('ptbYestBtn');
  if(ybtn) ybtn.style.display=(yesterdayCache&&yesterdayCache.length&&!showHype)?'':'none';
}

function isPostSlate() {
  var games=Object.values(gameStates);
  if (!games.length) return false;
  if (!games.every(function(g){return g.status==='Final';})) return false;
  var lastTerminalMs=0;
  feedItems.forEach(function(fi){
    if (fi.data&&fi.data.type==='status'&&(fi.data.label==='Game Final'||fi.data.label==='Game Postponed')) {
      var ms=fi.ts.getTime(); if (ms>lastTerminalMs) lastTerminalMs=ms;
    }
  });
  if (!lastTerminalMs) return false;
  return (Date.now()-lastTerminalMs) > (devTuning.postSlateRevertMs||20*60*1000);
}

function isIntermission() {
  var games=Object.values(gameStates);
  if (!games.length) return false;
  if (!games.some(function(g){return g.status==='Final';})) return false;
  if (games.some(function(g){return g.status==='Live'&&g.detailedState==='In Progress';})) return false;
  if (!games.some(function(g){return g.status!=='Final';})) return false;
  var lastTerminalMs=0;
  feedItems.forEach(function(fi){
    if (fi.data&&fi.data.type==='status'&&(fi.data.label==='Game Final'||fi.data.label==='Game Postponed')) {
      var ms=fi.ts.getTime(); if (ms>lastTerminalMs) lastTerminalMs=ms;
    }
  });
  if (!lastTerminalMs) return false;
  return (Date.now()-lastTerminalMs) > (devTuning.intermissionRevertMs||20*60*1000);
}

function pruneStaleGames(beforeDateStr) {
  Object.keys(gameStates).forEach(function(pk) {
    var g=gameStates[pk];
    if (g.status!=='Final'||!g.gameDateMs) return;
    var gDate=localDateStr(new Date(g.gameDateMs));
    if (gDate<beforeDateStr) {
      delete gameStates[pk];
      enabledGames.delete(+pk);
    }
  });
  feedItems=feedItems.filter(function(fi){return gameStates[fi.gamePk]!==undefined;});
  renderFeed();
}

async function fetchTomorrowPreview() {
  if (tomorrowPreview.inFlight) return;
  if (Date.now()-tomorrowPreview.fetchedAt < 10*60*1000) return;
  tomorrowPreview.inFlight=true;
  try {
    var seed=pollDateStr?pollDateStr.split('-').map(Number):null;
    var nextDate=seed?new Date(seed[0],seed[1]-1,seed[2]):new Date();
    nextDate.setDate(nextDate.getDate()+1);
    var ts=localDateStr(nextDate);
    var r=await fetch(MLB_BASE+'/schedule?sportId=1&date='+ts+'&hydrate=team');
    if(!r.ok) throw new Error(r.status);
    var d=await r.json();
    var games=(d.dates||[]).flatMap(function(dt){return dt.games||[];});
    tomorrowPreview.dateStr=ts;
    tomorrowPreview.gameCount=games.length;
    if (games.length) {
      games.sort(function(a,b){return new Date(a.gameDate).getTime()-new Date(b.gameDate).getTime();});
      var first=games[0], ms=new Date(first.gameDate).getTime();
      tomorrowPreview.firstPitchMs=ms;
      tomorrowPreview.gameTime=new Date(ms).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
    } else {
      tomorrowPreview.firstPitchMs=null;
      tomorrowPreview.gameTime=null;
    }
    tomorrowPreview.fetchedAt=Date.now();
    if (isPostSlate()) renderEmptyState(true);
  } catch(e){if(DEBUG)console.warn('fetchTomorrowPreview',e);}
  finally{tomorrowPreview.inFlight=false;}
}

function pulseGreeting() {
  var h=new Date().getHours();
  if (h<6)  return {kicker:'Late innings', headline:'West coast still in play.',     tagline:'West coast still on the wire.'};
  if (h<11) return {kicker:'Good morning', headline:"Here's what you missed.",      tagline:"Last night's wrap, today's slate."};
  if (h<14) return {kicker:'Midday slate', headline:'First pitches roll in soon.',  tagline:'Lineups going up. First pitch soon.'};
  if (h<17) return {kicker:'Pre-game',     headline:'Lineups locked.',              tagline:"Lineups locked. We're close."};
  if (h<22) return {kicker:'Game on',      headline:'Action across the league.',    tagline:'Every game, one feed.'};
  return            {kicker:'Late night',  headline:'West coast finals shaking out.', tagline:'West coast finals shaking out.'};
}

function renderEmptyState(postSlate, intermission) {
  var el=document.getElementById('feedEmpty');
  var upcoming=Object.values(gameStates).filter(function(g){
    if(!(g.status==='Preview'||g.status==='Scheduled'||(g.status==='Live'&&g.detailedState!=='In Progress'))) return false;
    // Exclude DH game 2 while its game 1 partner is live
    var rawG=storyCarouselRawGameData&&storyCarouselRawGameData[g.gamePk];
    if(rawG&&rawG.doubleHeader==='Y'&&rawG.gameNumber==2){
      if(Object.values(gameStates).some(function(s){return s.status==='Live'&&s.awayId===g.awayId&&s.homeId===g.homeId;})) return false;
    }
    return true;
  });
  upcoming.sort(function(a,b){var aMs=a.gameDateMs||0,bMs=b.gameDateMs||0;if(aMs!==bMs)return aMs-bMs;return a.awayAbbr.localeCompare(b.awayAbbr);});
  if (!upcoming.length){
    el.className='';
    if (postSlate) {
      fetchTomorrowPreview();
      var subText='Live play-by-play returns when games begin.';
      var countdownHtml='';
      if (tomorrowPreview.firstPitchMs) {
        countdownHtml='<div id="heroCountdown" style="margin-top:14px;font-size:1rem;color:var(--accent);font-weight:700"></div>';
        var n=tomorrowPreview.gameCount;
        subText='Next slate · '+n+' '+(n===1?'game':'games')+' · first pitch '+(tomorrowPreview.gameTime||'TBD');
      } else if (tomorrowPreview.fetchedAt && tomorrowPreview.gameCount===0) {
        subText='No games scheduled in the next slate.';
      }
      var slateRecapCta=(yesterdayCache&&yesterdayCache.length)?'<button onclick="openYesterdayRecap()" style="margin-top:20px;display:inline-flex;align-items:center;gap:7px;background:none;border:1px solid var(--accent);color:var(--accent);font-size:.8rem;font-weight:700;letter-spacing:.06em;padding:9px 18px;border-radius:7px;cursor:pointer">📺 Yesterday\'s Highlights →</button>':'';
      el.innerHTML='<span class="empty-icon">🏁</span><div class="empty-title">Slate complete</div><div class="empty-sub">'+subText+'</div>'+countdownHtml+slateRecapCta;
      if (tomorrowPreview.firstPitchMs) startCountdown(tomorrowPreview.firstPitchMs);
    } else {
      var g0=pulseGreeting();
      el.innerHTML='<span class="empty-icon">⚾</span><div class="empty-title">'+g0.kicker+'</div><div class="empty-sub">'+g0.headline+'</div>';
    }
    return;
  }
  el.className='has-upcoming';
  var hero=upcoming[0], rest=upcoming.slice(1), n=upcoming.length;
  var heroGrad=themeOverride===MLB_THEME?'linear-gradient(90deg,'+MLB_THEME.primary+' 0%,#111827 45%,'+MLB_THEME.primary+' 100%)':'linear-gradient(90deg,'+hero.awayPrimary+' 0%,#111827 45%,'+hero.homePrimary+' 100%)';
  var greeting=pulseGreeting();
  var labelText=intermission
    ? 'NEXT UP &middot; '+n+(n===1?' GAME REMAINING':' GAMES REMAINING')
    : n+(n===1?' UPCOMING GAME':' UPCOMING GAMES');
  var hypeRecapCta=(yesterdayCache&&yesterdayCache.length)?'<button onclick="openYesterdayRecap()" style="display:inline-flex;align-items:center;gap:7px;margin:8px 0 14px;background:none;border:1px solid var(--accent);color:var(--accent);font-size:.78rem;font-weight:700;letter-spacing:.06em;padding:7px 16px;border-radius:7px;cursor:pointer">📺 Yesterday\'s Highlights →</button>':'';
  var hypeBlock=intermission?'':
    '<div class="empty-hype-block"><button class="demo-cta" onclick="toggleDemoMode()">'+(demoMode?'⏹ Exit Demo':'▶ Try Demo')+'</button><div class="empty-hype-headline">'+greeting.headline+'</div>'
    +hypeRecapCta
    +'<div class="empty-hype-pills"><span class="hype-pill hr">💥 Home Runs</span><span class="hype-pill scoring">🟢 Scoring Plays</span><span class="hype-pill risp">⚡ RISP</span></div>'
    +'<div class="empty-hype-sub">Play-by-play from every MLB game surfaces here the moment a game starts.</div></div>';
  var html='<div class="empty-upcoming-label">'+labelText+'</div>'
    +hypeBlock
    +'<div class="upcoming-hero" style="background:'+heroGrad+'">'
    +'<div class="upcoming-hero-kicker">NEXT UP</div>'
    +'<div class="upcoming-matchup-row">'
    +'<div style="display:flex;align-items:center;gap:9px"><img class="upcoming-cap" src="https://www.mlbstatic.com/team-logos/'+hero.awayId+'.svg" onerror="this.style.display=\'none\'"><div class="upcoming-team-name">'+hero.awayAbbr+'</div></div>'
    +'<div class="upcoming-at">@</div>'
    +'<div style="display:flex;align-items:center;gap:9px;flex-direction:row-reverse"><img class="upcoming-cap" src="https://www.mlbstatic.com/team-logos/'+hero.homeId+'.svg" onerror="this.style.display=\'none\'"><div class="upcoming-team-name">'+hero.homeAbbr+'</div></div>'
    +'</div>'
    +'<div class="upcoming-foot"><div><div class="upcoming-foot-time">'+(hero.gameTime||'TBD')+'</div><div class="upcoming-foot-countdown" id="heroCountdown"></div></div>'
    +(hero.venueName?'<div class="upcoming-foot-venue">'+hero.venueName+'</div>':'')+'</div></div>';
  if (rest.length) {
    html+='<div class="upcoming-grid">';
    rest.forEach(function(g){
      html+='<div class="matchup-card"><div style="font-size:.65rem;color:var(--muted);margin-bottom:4px">'+(g.gameTime||'TBD')+'</div>'
        +'<div style="display:flex;align-items:center;justify-content:center;gap:6px">'
        +'<div style="text-align:center"><img class="matchup-cap" src="https://www.mlbstatic.com/team-logos/'+g.awayId+'.svg" onerror="this.style.display=\'none\'"><div style="font-size:.8rem;font-weight:700;color:var(--text)">'+g.awayAbbr+'</div><div style="font-size:.62rem;color:var(--muted)">'+(g.awayW!=null?'('+g.awayW+'-'+g.awayL+')':'')+'</div></div>'
        +'<span style="color:var(--muted);font-size:.8rem">vs</span>'
        +'<div style="text-align:center"><img class="matchup-cap" src="https://www.mlbstatic.com/team-logos/'+g.homeId+'.svg" onerror="this.style.display=\'none\'"><div style="font-size:.8rem;font-weight:700;color:var(--text)">'+g.homeAbbr+'</div><div style="font-size:.62rem;color:var(--muted)">'+(g.homeW!=null?'('+g.homeW+'-'+g.homeL+')':'')+'</div></div>'
        +'</div></div>';
    });
    html+='</div>';
  }
  el.innerHTML=html;
  if (hero.gameDateMs) startCountdown(hero.gameDateMs);
}

function addFeedItem(gamePk,data) {
  var item={gamePk:gamePk,data:data,ts:data.playTime||new Date()};
  var idx=feedItems.findIndex(function(fi){return fi.ts<=item.ts;});
  if(idx===-1) feedItems.push(item); else feedItems.splice(idx,0,item);
  if(feedItems.length>600) feedItems.length=600;
  var el=buildFeedEl(item);
  el.dataset.ts=item.ts.getTime();
  if(!enabledGames.has(+gamePk)) el.classList.add('feed-hidden');
  var feed=document.getElementById('feed');
  var tsMs=item.ts.getTime();
  var sibling=Array.from(feed.children).find(function(c){return +c.dataset.ts<tsMs;});
  feed.insertBefore(el,sibling||null);
  updateFeedEmpty();
}

function buildFeedEl(item) {
  var el=document.createElement('div'), g=gameStates[item.gamePk], d=item.data;
  if (d.type==='status') {
    el.className='feed-item status-change'; el.setAttribute('data-gamepk',item.gamePk);
    el.innerHTML='<div class="status-row"><span class="status-icon">'+d.icon+'</span><span class="status-label">'+d.label+'</span><span class="status-sub">'+d.sub+'</span></div>';
    return el;
  }
  var cls='feed-item';
  if (d.playClass==='homerun') cls+=' homerun';
  else if (d.playClass==='scoring') cls+=' scoring';
  else if (d.playClass==='risp') cls+=' risp';
  el.className=cls; el.setAttribute('data-gamepk',item.gamePk);
  var half=d.halfInning==='top'?'▲':'▼';
  var innStr=half+ordinal(d.inning), outsStr=d.outs===1?'1 out':d.outs+' outs';
  var timeStr=item.ts.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
  var metaHtml='<div class="feed-meta">'
    +'<span class="feed-game-tag"><span class="feed-team-dot" style="background:'+g.awayPrimary+'"></span>'+g.awayAbbr+'&nbsp;<strong>'+d.awayScore+'</strong></span>'
    +'<span class="feed-sep">·</span>'
    +'<span class="feed-game-tag"><strong>'+d.homeScore+'</strong>&nbsp;'+g.homeAbbr+'<span class="feed-team-dot" style="background:'+g.homePrimary+'"></span></span>'
    +'<span class="feed-sep">·</span><span>'+innStr+'</span><span class="feed-sep">·</span><span>'+outsStr+'</span>'
    +'<span class="feed-time">'+timeStr+'</span></div>';
  var icon=d.event==='Home Run'?'💥 ':d.scoring?'🟢 ':'';
  var scoreBadge='';
  if (d.scoring) {
    var awayScores=(d.halfInning==='top');
    var awayHtml=awayScores?'<span class="feed-score-scorer">'+g.awayAbbr+'&thinsp;'+d.awayScore+'</span>':g.awayAbbr+'&thinsp;'+d.awayScore;
    var homeHtml=!awayScores?'<span class="feed-score-scorer">'+d.homeScore+'&thinsp;'+g.homeAbbr+'</span>':d.homeScore+'&thinsp;'+g.homeAbbr;
    scoreBadge='<span class="feed-score-badge">'+awayHtml+'<span class="feed-score-sep">·</span>'+homeHtml+'</span>';
  }
  var rispBadge=d.risp?'<span class="risp-tag">⚡ RISP</span>':'';
  var evt=d.event||'', playBadge='';
  if (evt==='Single') playBadge='<span class="play-tag hit-tag">1B</span>';
  else if (evt==='Double') playBadge='<span class="play-tag hit-tag">2B</span>';
  else if (evt==='Triple') playBadge='<span class="play-tag hit-tag">3B</span>';
  else if (evt==='Walk'||evt==='Intent Walk') playBadge='<span class="play-tag walk-tag">BB</span>';
  else if (evt==='Strikeout') playBadge='<span class="play-tag k-tag">K</span>';
  else if (evt.indexOf('Error')!==-1) playBadge='<span class="play-tag err-tag">E</span>';
  else if (evt.indexOf('Triple Play')!==-1) playBadge='<span class="play-tag tp-tag">TP</span>';
  else if (evt.indexOf('Double Play')!==-1||evt.indexOf('Grounded Into DP')!==-1) playBadge='<span class="play-tag dp-tag">DP</span>';
  el.innerHTML=metaHtml+'<div class="feed-play">'+icon+d.desc+rispBadge+playBadge+scoreBadge+'</div>';
  return el;
}

function renderFeed() {
  var feed=document.getElementById('feed');
  if(!feed) return;
  feed.innerHTML='';
  feedItems.forEach(function(item){
    if(demoMode&&item.ts.getTime()>demoCurrentTime) return;
    var el=buildFeedEl(item);el.dataset.ts=item.ts.getTime();if(!enabledGames.has(+item.gamePk))el.classList.add('feed-hidden');feed.appendChild(el);
  });
  updateFeedEmpty();
}

function showAlert(opts) {
  var icon=opts.icon||'🔔', evtLabel=opts.event||'', desc=opts.desc||'', color=opts.color||'#e03030', duration=opts.duration||5000;
  var stack=document.getElementById('alertStack'), el=document.createElement('div');
  el.className='alert-toast'; el.style.borderLeftColor=color; el.style.setProperty('--toast-duration',duration+'ms');
  el.innerHTML='<span class="alert-icon">'+icon+'</span><div class="alert-body"><div class="alert-event">'+evtLabel+'</div><div class="alert-desc">'+desc+'</div></div><div class="alert-progress"></div>';
  el.addEventListener('click',function(){dismissAlert(el);}); stack.appendChild(el);
  setTimeout(function(){dismissAlert(el);},duration);
}
function dismissAlert(el){if(!el.parentNode)return;el.classList.add('dismissing');setTimeout(function(){el.remove();},300);}

async function resolvePlayerCardData(batterId, batterName, awayTeamId, homeTeamId, halfInning, overrideStats, descHint, gamePk) {
  var battingTeamId = halfInning === 'top' ? awayTeamId : homeTeamId;
  var teamData = TEAMS.find(function(t) { return t.id === battingTeamId; }) || {};
  var stat = null, jerseyNumber = null, position = null;
  if (overrideStats) {
    stat = overrideStats;
  } else {
    var cached = (statsCache.hitting || []).find(function(e) { return e.player && e.player.id === batterId; });
    if (cached) { stat = cached.stat; }
    if (!stat) {
      try {
        var r = await fetch(MLB_BASE + '/people/' + batterId + '/stats?stats=season&season=' + SEASON + '&group=hitting');
        if(!r.ok) throw new Error(r.status);
        var d = await r.json();
        stat = d.stats && d.stats[0] && d.stats[0].splits && d.stats[0].splits[0] && d.stats[0].splits[0].stat;
      } catch(e) { stat = null; }
    }
  }
  if (stat && batterId) hrBatterStatsCache[batterId] = stat;
  var rEntry = (rosterData.hitting || []).find(function(p) { return p.person && p.person.id === batterId; });
  if (!rEntry) rEntry = (rosterData.pitching || []).find(function(p) { return p.person && p.person.id === batterId; });
  if (rEntry && rEntry.jerseyNumber) jerseyNumber = rEntry.jerseyNumber;
  position = (rEntry && rEntry.position && rEntry.position.abbreviation) || null;
  // Caller-supplied hints (e.g. from collection slot) fill gaps when rosterData doesn't have this player
  if (!position && overrideStats && overrideStats._position) position = overrideStats._position;
  if (!jerseyNumber && overrideStats && overrideStats._jersey) jerseyNumber = overrideStats._jersey;
  if ((!position || !jerseyNumber) && gamePk) {
    try {
      var bs = await fetchBoxscore(gamePk);
      var allPlayers = Object.values(bs.teams.away.players).concat(Object.values(bs.teams.home.players));
      var playerData = allPlayers.find(function(p) { return p.person && p.person.id === batterId; });
      if (playerData) {
        if (!jerseyNumber && playerData.jerseyNumber) jerseyNumber = playerData.jerseyNumber;
        if (!position && playerData.position && playerData.position.code) {
          var posCode = playerData.position.code;
          var posMap = {'1':'P','2':'C','3':'1B','4':'2B','5':'3B','6':'SS','7':'LF','8':'CF','9':'RF','10':'DH'};
          position = posMap[posCode] || playerData.position.code;
        }
      }
    } catch(e) {}
  }
  var hrCount = stat ? (stat.homeRuns != null ? stat.homeRuns : '—') : '—';
  if (descHint) { var _m=descHint.match(/\((\d+)\)/); if(_m){var _n=parseInt(_m[1],10);if(typeof hrCount!=='number'||hrCount<_n)hrCount=_n;} }
  return {
    batterId: batterId,
    batterName: batterName,
    teamData: teamData,
    teamAbbr: teamData.short || '???',
    jerseyNumber: jerseyNumber,
    position: position || '—',
    hrCount: hrCount,
    hrPrev: (typeof hrCount === 'number' && hrCount >= 1) ? hrCount - 1 : hrCount,
    avg: stat ? fmtRate(stat.avg) : '—',
    ops: stat ? fmtRate(stat.ops) : '—',
    rbi: stat ? (stat.rbi != null ? stat.rbi : '—') : '—',
  };
}

async function showPlayerCard(batterId, batterName, awayTeamId, homeTeamId, halfInning, overrideStats, descHint, badgeText, gamePk) {
  var overlay = document.getElementById('playerCardOverlay');
  var card    = document.getElementById('playerCard');
  if (!overlay || !card) return;
  card.innerHTML = '<div class="pc-loading">Loading player card…</div>';
  overlay.classList.remove('closing');
  overlay.classList.add('open');
  var d = await resolvePlayerCardData(batterId, batterName, awayTeamId, homeTeamId, halfInning, overrideStats, descHint, gamePk);
  card.innerHTML = window.PulseCard.render({
    batterId: d.batterId,
    name: d.batterName,
    team: { short: d.teamAbbr, primary: d.teamData.primary, secondary: d.teamData.secondary },
    position: d.position,
    jersey: d.jerseyNumber,
    badge: (badgeText || 'HOME RUN'),
    stats: { avg: d.avg, ops: d.ops, hr: d.hrPrev, rbi: d.rbi },
    highlight: 'hr',
  });
  if (typeof d.hrCount === 'number' && d.hrCount >= 1) {
    setTimeout(function() {
      var el = card.querySelector('.pc-hr-val');
      if (el) { el.textContent = d.hrCount; el.classList.add('counting'); }
    }, 500);
  }
  if (window._playerCardTimer) clearTimeout(window._playerCardTimer);
  window._playerCardTimer = setTimeout(dismissPlayerCard, TIMING.CARD_DISMISS_MS);
  // COLLECTION HOOK — HR
  if (!demoMode) {
    var gs = gameStates[gamePk] || {};
    collectCard({
      playerId: d.batterId, playerName: d.batterName,
      teamAbbr: d.teamAbbr, teamPrimary: d.teamData.primary, teamSecondary: d.teamData.secondary,
      position: d.position || '',
      eventType: 'HR', badge: badgeText || '💥 HOME RUN!',
      inning: gs.inning || 0, halfInning: halfInning,
      awayAbbr: gs.awayAbbr || '', homeAbbr: gs.homeAbbr || '',
      awayScore: gs.awayScore || 0, homeScore: gs.homeScore || 0,
    });
  }
}

function dismissPlayerCard() {
  var overlay = document.getElementById('playerCardOverlay');
  if (!overlay || !overlay.classList.contains('open')) return;
  flashCollectionRailMessage();
  if (window._playerCardTimer) { clearTimeout(window._playerCardTimer); window._playerCardTimer = null; }
  overlay.classList.add('closing');
  setTimeout(function() { overlay.classList.remove('open','closing'); document.getElementById('playerCard').innerHTML='<div class="pc-loading">Loading player card…</div>'; }, TIMING.CARD_CLOSE_ANIM_MS);
}

function getHRBadge(rbi, halfInning, inning, aScore, hScore) {
  var battingAfter = halfInning === 'bottom' ? hScore : aScore;
  var fieldingScore = halfInning === 'bottom' ? aScore : hScore;
  var battingBefore = battingAfter - rbi;
  var deficitBefore = fieldingScore - battingBefore;
  var marginAfter = battingAfter - fieldingScore;
  var isWalkoff = halfInning === 'bottom' && inning >= 9 && deficitBefore >= 0 && marginAfter > 0;
  var isGoAhead = deficitBefore >= 0 && marginAfter > 0;
  var isGrandSlam = rbi === 4;
  if (isWalkoff && isGrandSlam) return 'WALK-OFF GRAND SLAM!';
  if (isWalkoff) return 'WALK-OFF HOME RUN!';
  if (isGrandSlam) return 'GRAND SLAM!';
  if (isGoAhead) return 'GO-AHEAD HOME RUN!';
  return '💥 HOME RUN!';
}

// ── Key RBI card helpers ──────────────────────────────────────────────────────
function calcRBICardScore(rbi, event, aScore, hScore, inning, halfInning) {
  if (!rbi || rbi < 1) return 0;
  var base = rbi === 1 ? 10 : rbi === 2 ? 25 : rbi === 3 ? 40 : 55;
  var hitMult = event === 'Double' ? 1.5 : event === 'Triple' ? 2.0 :
    (['Sac Fly','Sac Bunt','Walk','Hit By Pitch','Grounded Into DP','Field\'s Choice'].indexOf(event) !== -1 ? 0.7 : 1.0);
  var battingAfter = halfInning === 'top' ? aScore : hScore;
  var fieldingScore = halfInning === 'top' ? hScore : aScore;
  var battingBefore = battingAfter - rbi;
  var deficitBefore = fieldingScore - battingBefore; // positive = batting team was behind
  var marginAfter = battingAfter - fieldingScore;    // positive = batting team now leads
  var ctx = 0;
  if (deficitBefore >= 0 && marginAfter > 0) ctx += 30;       // go-ahead
  else if (deficitBefore > 0 && marginAfter === 0) ctx += 25; // equalizer
  if (deficitBefore >= 3 && marginAfter >= -1) ctx += 20;     // comeback component
  if (marginAfter - rbi >= 5) ctx -= 15;                      // was already leading by 5+
  var innMult = inning <= 3 ? 0.4 : inning <= 6 ? 0.75 : inning <= 8 ? 1.0 : inning === 9 ? 1.4 : 1.6;
  var score = (base * hitMult + ctx) * innMult;
  return score;
}

function getRBIBadge(rbi, event, halfInning, inning, deficitBefore, marginAfter) {
  var lm = {'Single':'SINGLE','Double':'DOUBLE','Triple':'TRIPLE','Sac Fly':'SAC FLY','Walk':'WALK','Hit By Pitch':'HBP'};
  var label = lm[event] || null;
  var goAhead = deficitBefore >= 0 && marginAfter > 0;
  var equalizer = deficitBefore > 0 && marginAfter === 0;
  if (goAhead && halfInning === 'bottom' && inning >= 9 && label) return 'WALK-OFF ' + label + '!';
  if (goAhead && label) return 'GO-AHEAD ' + label + '!';
  if (equalizer && label) return label + ' TIES IT!';
  if (rbi >= 2 && label) return rbi + '-RUN ' + label;
  if (label) return 'RBI ' + label + '!';
  return 'RBI!';
}

async function showRBICard(batterId, batterName, awayTeamId, homeTeamId, halfInning, rbi, event, aScore, hScore, inning, gamePk) {
  var overlay = document.getElementById('playerCardOverlay');
  var card    = document.getElementById('playerCard');
  if (!overlay || !card) return;
  var battingTeamId = halfInning === 'top' ? awayTeamId : homeTeamId;
  var teamData  = TEAMS.find(function(t) { return t.id === battingTeamId; }) || {};
  var awayData  = TEAMS.find(function(t) { return t.id === awayTeamId; })   || {};
  var homeData  = TEAMS.find(function(t) { return t.id === homeTeamId; })   || {};
  var teamAbbr  = teamData.short || '???';
  var awayAbbr  = awayData.short || 'AWY';
  var homeAbbr  = homeData.short || 'HME';
  card.innerHTML = '<div class="pc-loading">Loading player card…</div>';
  overlay.classList.remove('closing');
  overlay.classList.add('open');
  var stat = null;
  var cached = (statsCache.hitting || []).find(function(e) { return e.player && e.player.id === batterId; });
  if (cached) stat = cached.stat;
  if (!stat) {
    try {
      var r = await fetch(MLB_BASE + '/people/' + batterId + '/stats?stats=season&season=' + SEASON + '&group=hitting');
      if(!r.ok) throw new Error(r.status);
      var d = await r.json();
      stat = d.stats && d.stats[0] && d.stats[0].splits && d.stats[0].splits[0] && d.stats[0].splits[0].stat;
    } catch(e) { stat = null; }
  }
  var rbiSeason = stat ? (stat.rbi  != null ? stat.rbi  : '—') : '—';
  var hits      = stat ? (stat.hits != null ? stat.hits : '—') : '—';
  var avg       = stat ? fmtRate(stat.avg) : '—';
  var ops       = stat ? fmtRate(stat.ops) : '—';
  var rbiPrev   = (typeof rbiSeason === 'number' && rbiSeason >= rbi) ? rbiSeason - rbi : rbiSeason;
  var battingAfter  = halfInning === 'top' ? aScore : hScore;
  var fieldingScore = halfInning === 'top' ? hScore : aScore;
  var deficitBefore = fieldingScore - (battingAfter - rbi);
  var marginAfter   = battingAfter - fieldingScore;
  var badge    = getRBIBadge(rbi, event, halfInning, inning, deficitBefore, marginAfter);
  var innLabel = (halfInning === 'top' ? '▲' : '▼') + inning;
  var photoUrl = 'https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/' + batterId + '/headshot/67/current';
  var rEntry = (rosterData.hitting || []).find(function(p) { return p.person && p.person.id === batterId; });
  if (!rEntry) rEntry = (rosterData.pitching || []).find(function(p) { return p.person && p.person.id === batterId; });
  var jerseyNumber = rEntry && rEntry.jerseyNumber ? rEntry.jerseyNumber : null;
  var position = (rEntry && rEntry.position && rEntry.position.abbreviation) || null;
  if ((!position || !jerseyNumber) && gamePk) {
    try {
      var bs = await fetchBoxscore(gamePk);
      var allPlayers = Object.values(bs.teams.away.players).concat(Object.values(bs.teams.home.players));
      var playerData = allPlayers.find(function(p) { return p.person && p.person.id === batterId; });
      if (playerData) {
        if (!jerseyNumber && playerData.jerseyNumber) jerseyNumber = playerData.jerseyNumber;
        if (!position && playerData.position && playerData.position.code) {
          var posCode = playerData.position.code;
          var posMap = {'1':'P','2':'C','3':'1B','4':'2B','5':'3B','6':'SS','7':'LF','8':'CF','9':'RF','10':'DH'};
          position = posMap[posCode] || playerData.position.code;
        }
      }
    } catch(e) {}
  }
  position = position || '—';
  card.innerHTML = window.PulseCard.render({
    batterId: batterId,
    name: batterName,
    team: { short: teamAbbr, primary: teamData.primary, secondary: teamData.secondary },
    position: position,
    jersey: jerseyNumber,
    badge: badge,
    stats: { avg: avg, ops: ops, h: hits, rbi: rbiPrev },
    highlight: 'rbi',
  });
  if (typeof rbiSeason === 'number' && rbiSeason >= 1) {
    setTimeout(function() {
      var el = card.querySelector('.pc-rbi-val');
      if (el) { el.textContent = rbiSeason; el.classList.add('counting'); }
    }, 500);
  }
  if (window._playerCardTimer) clearTimeout(window._playerCardTimer);
  window._playerCardTimer = setTimeout(dismissPlayerCard, TIMING.CARD_DISMISS_MS);
  // COLLECTION HOOK — RBI
  if (!demoMode) {
    collectCard({
      playerId: batterId, playerName: batterName,
      teamAbbr: teamAbbr, teamPrimary: teamData.primary, teamSecondary: teamData.secondary,
      position: position || '',
      eventType: 'RBI', badge: badge, rbi: rbi,
      inning: inning, halfInning: halfInning,
      awayAbbr: awayAbbr, homeAbbr: homeAbbr,
      awayScore: aScore, homeScore: hScore,
    });
  }
}

function confirmDevToolsChanges(){
  var fields=[
    ['rotateMs','tuneRotateMs'],['rbiThreshold','tuneRbiThreshold'],['rbiCooldown','tuneRbiCooldown'],
    ['hr_priority','tuneHRPriority'],['hr_cooldown','tuneHRCooldown'],
    ['biginning_priority','tuneBigInningPriority'],['biginning_threshold','tuneBigInningThreshold'],
    ['walkoff_priority','tuneWalkoffPriority'],['nohitter_inning_floor','tuneNohitterFloor'],
    ['basesloaded_priority','tuneBasesLoadedPriority'],
    ['hitstreak_floor','tuneHitstreakFloor'],['hitstreak_priority','tuneHitstreakPriority'],
    ['roster_priority_il','tuneRosterPriorityIL'],['roster_priority_trade','tuneRosterPriorityTrade'],
    ['wp_leverage_floor','tuneWPLeverageFloor'],['wp_extreme_floor','tuneWPExtremeFloor'],
    ['livewp_priority','tuneLiveWPPriority'],['livewp_refresh_ms','tuneLiveWPRefresh'],
    ['focus_critical','tuneFocusCritical'],['focus_high','tuneFocusHigh'],
    ['focus_switch_margin','tuneFocusSwitchMargin'],['focus_alert_cooldown','tuneFocusAlertCooldown']
  ];
  fields.forEach(function(f){var el=document.getElementById(f[1]);if(el&&el.value!=='')updateTuning(f[0],el.value);});
  var btn=document.getElementById('devConfirmBtn');
  btn.textContent='✓ Applied!';btn.classList.add('applied');
  setTimeout(function(){btn.textContent='Confirm Changes';btn.classList.remove('applied');},1500);
}
function toggleSoundPanel(){var p=document.getElementById('soundPanel');p.style.display=p.style.display==='none'?'':'none';}
// MLB Stats API teamId → primary flagship radio broadcast (extracted from radio.net)
// `format`: 'hls' uses Hls.js (or native Safari); 'direct' is plain <audio> AAC/MP3
const MLB_TEAM_RADIO={
  108:{name:'KLAA Angels Radio',     url:'https://klaa.streamguys1.com/live',                                                              format:'direct'},
  109:{name:'KTAR 620 AM',           url:'https://playerservices.streamtheworld.com/api/livestream-redirect/KTARAMAAC.aac',               format:'direct'},
  110:{name:'WBAL 1090 AM',          url:'https://playerservices.streamtheworld.com/api/livestream-redirect/WBALAMAAC.aac',               format:'direct'},
  111:{name:'WEEI 850 AM',           url:'https://live.amperwave.net/manifest/audacy-weeifmaac-hlsc.m3u8',                               format:'hls'},
  112:{name:'WSCR 670 The Score',    url:'https://live.amperwave.net/manifest/audacy-wscramaac-hlsc.m3u8',                               format:'hls'},
  113:{name:'700 WLW',               url:'https://playerservices.streamtheworld.com/api/livestream-redirect/WLWAMAAC.aac',                format:'direct'},
  114:{name:'WTAM 1100 AM',          url:'https://stream.revma.ihrhls.com/zc1749/hls.m3u8',                                              format:'hls'},
  115:{name:'KOA 850 / 94.1',        url:'https://playerservices.streamtheworld.com/api/livestream-redirect/KOAAMAAC.aac',                format:'direct'},
  116:{name:'WXYT 97.1 The Ticket',  url:'https://live.amperwave.net/manifest/audacy-wxytfmaac-hlsc.m3u8',                               format:'hls'},
  117:{name:'SportsTalk 790 AM',     url:'https://stream.revma.ihrhls.com/zc2257',                                                        format:'direct'},
  118:{name:'96.5 The Fan KFNZ',     url:'https://playerservices.streamtheworld.com/api/livestream-redirect/KFNZFMAAC.aac',               format:'direct'},
  119:{name:'KLAC AM 570 LA Sports', url:'https://playerservices.streamtheworld.com/api/livestream-redirect/KLACAMAAC.aac',               format:'direct'},
  120:{name:'WJFK The Fan 106.7',    url:'https://live.amperwave.net/manifest/audacy-wjfkfmaac-hlsc.m3u8',                               format:'hls'},
  121:{name:'WCBS 880 AM',           url:'https://live.amperwave.net/manifest/audacy-wcbsamaac-hlsc.m3u8',                               format:'hls'},
  133:{name:'KSTE 650 AM Sacramento',url:'https://playerservices.streamtheworld.com/api/livestream-redirect/KSTEAMAAC.aac',               format:'direct'},
  134:{name:'KDKA-FM 93.7 The Fan',  url:'https://live.amperwave.net/manifest/audacy-kdkafmaac-hlsc.m3u8',                               format:'hls'},
  135:{name:'KWFN 97.3 The Fan',     url:'https://live.amperwave.net/manifest/audacy-kwfnfmaac-llhlsc.m3u8',                             format:'hls'},
  136:{name:'Seattle Sports 710 AM', url:'https://bonneville.cdnstream1.com/2642_48.aac',                                                format:'direct'},
  137:{name:'KNBR 104.5 / 680',      url:'https://playerservices.streamtheworld.com/api/livestream-redirect/KNBRAMAAC.aac',               format:'direct'},
  138:{name:'KMOX NewsRadio 1120',   url:'https://live.amperwave.net/manifest/audacy-kmoxamaac-llhlsc.m3u8',                             format:'hls'},
  139:{name:'WDAE 95.3 FM / 620 AM', url:'https://playerservices.streamtheworld.com/api/livestream-redirect/WDAEAMAAC.aac',               format:'direct'},
  140:{name:'105.3 The Fan KRLD',    url:'https://live.amperwave.net/manifest/audacy-krldfmaac-hlsc.m3u8',                               format:'hls'},
  141:{name:'CJCL Sportsnet 590',    url:'https://rogers-hls.leanstream.co/rogers/tor590.stream/playlist.m3u8',                          format:'hls'},
  142:{name:'WCCO News Talk 830',    url:'https://live.amperwave.net/manifest/audacy-wccoamaac-llhlsc.m3u8',                             format:'hls'},
  143:{name:'94 WIP Sportsradio',    url:'https://live.amperwave.net/manifest/audacy-wipfmaac-hlsc.m3u8',                                format:'hls'},
  144:{name:'680 The Fan / 93.7 FM', url:'https://stream.zeno.fm/q9458433dm8uv',                                                         format:'direct'},
  145:{name:'WMVP ESPN 1000 AM',     url:'https://playerservices.streamtheworld.com/api/livestream-redirect/WMVPAMAAC.aac',               format:'direct'},
  146:{name:'WQAM 560 AM',           url:'https://live.amperwave.net/manifest/audacy-wqamamaac-hlsc.m3u8',                               format:'hls'},
  147:{name:'WFAN 66 / 101.9',       url:'https://live.amperwave.net/manifest/audacy-wfanamaac-hlsc.m3u8',                               format:'hls'},
  158:{name:'WTMJ Newsradio 620',    url:'https://playerservices.streamtheworld.com/api/livestream-redirect/WTMJAMAAC.aac',               format:'direct'}
};
const FALLBACK_RADIO={name:'Fox Sports Radio',url:'https://ais-sa1.streamon.fm/7852_128k.aac',format:'direct'};
// Approved team IDs whose flagship feeds verifiably play live game audio.
// Source of truth: in-app Radio Check sweep — last updated 2026-05-02.
// Update this Set as the sweep grows; non-approved teams skip to Fox Sports fallback.
const APPROVED_RADIO_TEAM_IDS=new Set([108,114,116,117,140,142,144,146,147]);
var radioAudio=null;
var radioHls=null;
var radioCurrentTeamId=null;  // teamId whose broadcast is currently loaded; null = fallback
function pickRadioForFocus(){
  if(focusGamePk&&gameStates[focusGamePk]){
    var g=gameStates[focusGamePk];
    if(MLB_TEAM_RADIO[g.homeId]&&APPROVED_RADIO_TEAM_IDS.has(g.homeId)) return Object.assign({teamId:g.homeId,abbr:g.homeAbbr},MLB_TEAM_RADIO[g.homeId]);
    if(MLB_TEAM_RADIO[g.awayId]&&APPROVED_RADIO_TEAM_IDS.has(g.awayId)) return Object.assign({teamId:g.awayId,abbr:g.awayAbbr},MLB_TEAM_RADIO[g.awayId]);
  }
  return Object.assign({teamId:null,abbr:''},FALLBACK_RADIO);
}
function stopAllMedia(except){
  if(except!=='radio'&&radioAudio&&!radioAudio.paused){stopRadio();}
  if(except!=='youtube'){var yt=document.getElementById('homeYoutubePlayer');if(yt&&yt.contentWindow){try{yt.contentWindow.postMessage(JSON.stringify({event:'command',func:'pauseVideo',args:''}),'*');}catch(e){}}}
  if(except!=='highlight'){document.querySelectorAll('video').forEach(function(v){if(!v.paused)v.pause();});}
}
function toggleRadio(){if(radioAudio&&!radioAudio.paused){stopRadio();}else{startRadio();}}
function startRadio(){stopAllMedia('radio');loadRadioStream(pickRadioForFocus());}
function loadRadioStream(pick){
  if(radioHls){try{radioHls.destroy();}catch(e){}radioHls=null;}
  if(!radioAudio){radioAudio=new Audio();radioAudio.preload='none';}
  radioAudio.pause();
  radioCurrentTeamId=pick.teamId;
  var isHls=pick.format==='hls';
  var nativeHls=radioAudio.canPlayType('application/vnd.apple.mpegurl');
  if(isHls&&window.Hls&&Hls.isSupported()){
    radioHls=new Hls();
    radioHls.loadSource(pick.url);
    radioHls.attachMedia(radioAudio);
    radioHls.on(Hls.Events.ERROR,function(_,d){if(d.fatal){console.error('HLS fatal:',d);handleRadioError(new Error(d.details||'HLS error'));}});
    radioAudio.play().then(function(){setRadioUI(true,pick);}).catch(handleRadioError);
  }else if(isHls&&nativeHls){
    radioAudio.src=pick.url;
    radioAudio.play().then(function(){setRadioUI(true,pick);}).catch(handleRadioError);
  }else{
    radioAudio.src=pick.url;
    radioAudio.play().then(function(){setRadioUI(true,pick);}).catch(handleRadioError);
  }
}
function stopRadio(){
  if(radioAudio){radioAudio.pause();}
  if(radioHls){try{radioHls.destroy();}catch(e){}radioHls=null;}
  radioCurrentTeamId=null;
  setRadioUI(false,null);
}
function handleRadioError(err){
  console.error('Radio play failed:',err);
  alert('Radio failed: '+(err&&err.message?err.message:'unknown'));
  setRadioUI(false,null);
}
function setRadioUI(on,pick){
  var t=document.getElementById('radioToggle'),k=document.getElementById('radioToggleKnob'),s=document.getElementById('radioStatusText');
  if(t){
    if(on){
      t.style.background='#22c55e';k.style.left='21px';
      var label=pick&&pick.name?pick.name:'Radio';
      if(pick&&pick.abbr) label=pick.abbr+' · '+label;
      s.textContent='Playing · '+label;
    }else{
      t.style.background='var(--border)';k.style.left='3px';
      s.textContent='Off · Auto-pairs to focus game';
    }
  }
  var ptbDot=document.getElementById('ptbRadioDot');
  if(ptbDot) ptbDot.style.display=on?'inline-block':'none';
}
function updateRadioForFocus(){
  if(!radioAudio||radioAudio.paused) return;
  var pick=pickRadioForFocus();
  if(pick.teamId!==radioCurrentTeamId) loadRadioStream(pick);
}

// ── 🔍 Radio Check ────────────────────────────────────────────────────────
var radioCheckResults={}; // key: teamId or 'fallback' → 'yes'|'no' (absent = untested)
var radioCheckNotes={};   // key: teamId or 'fallback' → free-text note
var radioCheckPlayingKey=null;
// Default notes seeded once (preserves user edits via mlb_radio_check_notes_seeded_v2 flag).
// Approved/working stations verified 2026-05-02 sweep.
// Untested per CLAUDE.md: 112 CHC, 137 SF.
// URL updated in v3.34.1 (not yet confirmed): 109, 110, 113, 115, 118, 119, 121, 133, 139, 145, 158.
var RADIO_CHECK_DEFAULT_NOTES={
  '108':'Confirmed working — live game audio (verified 2026-05-02)',
  '109':'URL updated v3.34.1 — not yet confirmed',
  '110':'URL updated v3.34.1 — not yet confirmed',
  '112':'Not yet confirmed — needs Radio Check sweep',
  '113':'URL updated v3.34.1 — not yet confirmed',
  '114':'Confirmed working — live game audio (verified 2026-05-02)',
  '115':'URL updated v3.34.1 — not yet confirmed',
  '116':'Confirmed working — live game audio (verified 2026-05-02)',
  '117':'Confirmed working — live game audio (verified 2026-05-02)',
  '118':'URL updated v3.34.1 — not yet confirmed',
  '119':'URL updated v3.34.1 — not yet confirmed',
  '121':'URL updated v3.34.1 — not yet confirmed',
  '133':'URL updated v3.34.1 — not yet confirmed',
  '137':'Not yet confirmed — needs Radio Check sweep',
  '139':'URL updated v3.34.1 — not yet confirmed',
  '140':'Confirmed working — live game audio (verified 2026-05-02)',
  '142':'Confirmed working — live game audio (verified 2026-05-02)',
  '144':'Confirmed working — live game audio (verified 2026-05-02)',
  '145':'URL updated v3.34.1 — not yet confirmed',
  '146':'Confirmed working — live game audio (verified 2026-05-02)',
  '147':'Confirmed working — live game audio (verified 2026-05-02)',
  '158':'URL updated v3.34.1 — not yet confirmed'
};
function loadRadioCheckResults(){
  try{var s=localStorage.getItem('mlb_radio_check');if(s)radioCheckResults=JSON.parse(s)||{};}catch(e){radioCheckResults={};}
  try{var n=localStorage.getItem('mlb_radio_check_notes');if(n)radioCheckNotes=JSON.parse(n)||{};}catch(e){radioCheckNotes={};}
  // One-time seed of default notes (preserves user-entered notes — only fills empty keys).
  try{
    if(!localStorage.getItem('mlb_radio_check_notes_seeded_v2')){
      Object.keys(RADIO_CHECK_DEFAULT_NOTES).forEach(function(k){
        if(!radioCheckNotes[k]) radioCheckNotes[k]=RADIO_CHECK_DEFAULT_NOTES[k];
      });
      saveRadioCheckNotes();
      localStorage.setItem('mlb_radio_check_notes_seeded_v2','1');
    }
  }catch(e){}
}
function saveRadioCheckResults(){
  try{localStorage.setItem('mlb_radio_check',JSON.stringify(radioCheckResults));}catch(e){}
}
function saveRadioCheckNotes(){
  try{localStorage.setItem('mlb_radio_check_notes',JSON.stringify(radioCheckNotes));}catch(e){}
}
function openRadioCheck(){
  loadRadioCheckResults();
  document.getElementById('radioCheckOverlay').style.display='flex';
  renderRadioCheckList();
  toggleSettings(); // close settings panel
}
function closeRadioCheck(){
  document.getElementById('radioCheckOverlay').style.display='none';
  radioCheckStop();
}
function radioCheckEntries(){
  var entries=[];
  Object.keys(MLB_TEAM_RADIO).forEach(function(tid){
    var team=TEAMS.find(function(t){return t.id===+tid;});
    entries.push({key:tid,teamId:+tid,teamName:team?team.name:'Team '+tid,abbr:team?team.short:'',station:MLB_TEAM_RADIO[tid].name,url:MLB_TEAM_RADIO[tid].url,format:MLB_TEAM_RADIO[tid].format});
  });
  entries.sort(function(a,b){return a.teamName.localeCompare(b.teamName);});
  entries.push({key:'fallback',teamId:null,teamName:'(Fallback)',abbr:'',station:FALLBACK_RADIO.name,url:FALLBACK_RADIO.url,format:FALLBACK_RADIO.format});
  return entries;
}
function renderRadioCheckList(){
  var list=document.getElementById('radioCheckList');
  if(!list)return;
  var entries=radioCheckEntries();
  var html=entries.map(function(e){
    var status=radioCheckResults[e.key]||'';
    var note=(radioCheckNotes[e.key]||'').replace(/"/g,'&quot;');
    var playing=radioCheckPlayingKey===e.key;
    var gameLive=radioCheckTeamHasLiveGame(e.teamId);
    return '<div style="padding:0.5rem 0.625rem;border-bottom:1px solid var(--border);'+(playing?'background:rgba(34,197,94,.08)':'')+'">'+
      '<div style="display:flex;align-items:center;gap:8px">'+
        '<button onclick="radioCheckPlay(\''+e.key+'\')" style="background:'+(playing?'#22c55e':'var(--card2)')+';border:1px solid var(--border);color:'+(playing?'#000':'var(--text)')+';font-size:.7rem;padding:6px 10px;border-radius:6px;cursor:pointer;font-weight:700;flex-shrink:0;min-width:36px">▶</button>'+
        '<div style="flex:1;min-width:0">'+
          '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">'+
            '<span style="font-size:.78rem;font-weight:700;color:var(--text)">'+e.teamName+(e.abbr?' <span style="color:var(--muted);font-weight:500">· '+e.abbr+'</span>':'')+'</span>'+
            (gameLive?'<span style="display:inline-flex;align-items:center;gap:3px;background:rgba(34,197,94,.15);border:1px solid #22c55e;border-radius:10px;padding:1px 6px;font-size:.6rem;font-weight:700;color:#22c55e">● GAME ON</span>':'')+
          '</div>'+
          '<div style="font-size:.66rem;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+e.station+' · '+e.format.toUpperCase()+'</div>'+
        '</div>'+
        '<div style="display:flex;gap:4px;flex-shrink:0">'+
          '<button onclick="radioCheckSet(\''+e.key+'\',\'yes\')" title="Tap again to clear" style="cursor:pointer;background:'+(status==='yes'?'#22c55e':'var(--card2)')+';color:'+(status==='yes'?'#000':'var(--text)')+';border:1px solid var(--border);border-radius:6px;padding:5px 8px;font-size:.7rem;font-weight:700">✅</button>'+
          '<button onclick="radioCheckSet(\''+e.key+'\',\'no\')" title="Tap again to clear" style="cursor:pointer;background:'+(status==='no'?'#e03030':'var(--card2)')+';color:'+(status==='no'?'#fff':'var(--text)')+';border:1px solid var(--border);border-radius:6px;padding:5px 8px;font-size:.7rem;font-weight:700">❌</button>'+
        '</div>'+
      '</div>'+
      '<input type="text" value="'+note+'" oninput="radioCheckSetNote(\''+e.key+'\',this.value)" placeholder="Notes (e.g. plays ads during games)" style="margin-top:6px;width:100%;background:var(--card2);border:1px solid var(--border);color:var(--text);font-size:.72rem;padding:6px 8px;border-radius:6px;box-sizing:border-box">'+
    '</div>';
  }).join('');
  var done=Object.values(radioCheckResults).filter(function(v){return v==='yes'||v==='no';}).length;
  var summary='<div style="padding:0.5rem 0.625rem;font-size:.7rem;color:var(--muted);text-align:center">'+done+' of '+entries.length+' checked</div>';
  list.innerHTML=summary+html;
}
function radioCheckTeamHasLiveGame(teamId){
  if(!teamId) return false;
  return Object.values(gameStates).some(function(g){
    return g.status==='Live'&&g.detailedState==='In Progress'&&(g.awayId===teamId||g.homeId===teamId);
  });
}
function radioCheckPlay(key){
  var entries=radioCheckEntries();
  var e=entries.find(function(x){return x.key===key;});
  if(!e)return;
  radioCheckPlayingKey=key;
  var pick={teamId:e.teamId,abbr:e.abbr,name:e.station,url:e.url,format:e.format};
  loadRadioStream(pick);
  renderRadioCheckList();
}
function radioCheckStop(){
  radioCheckPlayingKey=null;
  if(radioAudio&&!radioAudio.paused)stopRadio();
  if(document.getElementById('radioCheckOverlay').style.display!=='none')renderRadioCheckList();
}
function radioCheckSet(key,val){
  if(radioCheckResults[key]===val) delete radioCheckResults[key];
  else radioCheckResults[key]=val;
  saveRadioCheckResults();
  renderRadioCheckList();
}
function radioCheckSetNote(key,val){
  if(val) radioCheckNotes[key]=val;
  else delete radioCheckNotes[key];
  saveRadioCheckNotes();
}
function radioCheckReset(){
  radioCheckResults={};
  radioCheckNotes={};
  saveRadioCheckResults();
  saveRadioCheckNotes();
  renderRadioCheckList();
}
function radioCheckCopy(){
  var entries=radioCheckEntries();
  var lines=['MLB Radio Check Results','Date: '+new Date().toISOString().slice(0,10),''];
  var works=[],broken=[],untested=[];
  entries.forEach(function(e){
    var s=radioCheckResults[e.key];
    var note=radioCheckNotes[e.key]||'';
    var block=['• '+e.teamName+(e.abbr?' ('+e.abbr+')':'')+' — '+e.station+' — '+e.url];
    if(note) block.push('  📝 '+note);
    if(s==='yes')works.push.apply(works,block);
    else if(s==='no')broken.push.apply(broken,block);
    else untested.push.apply(untested,block);
  });
  lines.push('✅ WORKS ('+works.filter(function(l){return l.charAt(0)==='•';}).length+'):');lines.push.apply(lines,works.length?works:['  (none marked)']);lines.push('');
  lines.push('❌ BROKEN ('+broken.filter(function(l){return l.charAt(0)==='•';}).length+'):');lines.push.apply(lines,broken.length?broken:['  (none marked)']);lines.push('');
  if(untested.length){lines.push('⏳ UNTESTED ('+untested.filter(function(l){return l.charAt(0)==='•';}).length+'):');lines.push.apply(lines,untested);}
  var text=lines.join('\n');
  var btn=document.getElementById('radioCheckCopyBtn');
  function flash(msg){if(!btn)return;var orig=btn.textContent;btn.textContent=msg;setTimeout(function(){btn.textContent=orig;},1800);}
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(function(){flash('✓ Copied!');},function(){fallbackCopy(text);flash('✓ Copied (fallback)');});
  }else{
    fallbackCopy(text);flash('✓ Copied (fallback)');
  }
}
function fallbackCopy(text){
  var ta=document.createElement('textarea');
  ta.value=text;ta.style.position='fixed';ta.style.opacity='0';
  document.body.appendChild(ta);ta.select();
  try{document.execCommand('copy');}catch(e){}
  document.body.removeChild(ta);
}

// ── 🔬 News Source Test (TEMP — remove after News tab QA) ────────────────
var NEWS_TEST_SOURCES=['fangraphs','mlbtraderumors','cbssports','yahoo','sbnation_mets','baseballamerica','mlb_direct','reddit_baseball','espn_news'];
var newsTestResults={}; // key → result object from proxy
function openNewsSourceTest(){
  document.getElementById('newsSourceTestOverlay').style.display='flex';
  renderNewsSourceTest();
}
function closeNewsSourceTest(){
  document.getElementById('newsSourceTestOverlay').style.display='none';
}
function renderNewsSourceTest(){
  var list=document.getElementById('newsSourceTestList');
  if(!list)return;
  if(!Object.keys(newsTestResults).length){
    list.innerHTML='<div style="padding:20px;text-align:center;color:var(--muted)">Click "▶ Run All" to test each source.</div>';
    return;
  }
  var rows=NEWS_TEST_SOURCES.map(function(k){
    var r=newsTestResults[k];
    if(!r) return '<div style="padding:8px 10px;border-bottom:1px solid var(--border);color:var(--muted)"><b>'+k+'</b> · pending</div>';
    if(r.pending) return '<div style="padding:8px 10px;border-bottom:1px solid var(--border);color:var(--muted)"><b>'+k+'</b> · ⏳ testing…</div>';
    var ok=r.ok&&r.status>=200&&r.status<300&&(r.itemCount>0);
    var icon=ok?'✅':'❌';
    var line1='<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span style="font-size:1rem">'+icon+'</span><b style="color:var(--text)">'+k+'</b><span style="color:var(--muted);font-size:.7rem">HTTP '+(r.status||'?')+' · '+(r.kind||'?')+' · '+(r.byteLength||0)+'b · '+(r.elapsedMs||0)+'ms · '+(r.itemCount||0)+' items</span></div>';
    var line2=r.firstTitle?'<div style="margin-top:4px;font-size:.7rem;color:var(--muted)">First: '+escapeHtml(r.firstTitle).slice(0,140)+'</div>':'';
    var line3=r.error?'<div style="margin-top:4px;font-size:.7rem;color:#e03030">Error: '+escapeHtml(r.error)+'</div>':'';
    var line4=r.sample?'<details style="margin-top:4px"><summary style="cursor:pointer;font-size:.65rem;color:var(--muted)">sample (first 600 chars)</summary><pre style="margin:4px 0 0;padding:6px 8px;background:var(--card2);border:1px solid var(--border);border-radius:6px;font-size:.62rem;color:var(--text);white-space:pre-wrap;word-break:break-all;max-height:160px;overflow-y:auto">'+escapeHtml(r.sample)+'</pre></details>':'';
    return '<div style="padding:10px;border-bottom:1px solid var(--border)">'+line1+line2+line3+line4+'</div>';
  }).join('');
  list.innerHTML=rows;
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function runNewsSourceTest(){
  var btn=document.getElementById('newsTestRunBtn');
  if(btn){btn.disabled=true;btn.textContent='⏳ Running…';}
  newsTestResults={};
  NEWS_TEST_SOURCES.forEach(function(k){newsTestResults[k]={pending:true};});
  renderNewsSourceTest();
  var promises=NEWS_TEST_SOURCES.map(function(k){
    return fetch(API_BASE+'/api/proxy-test?source='+encodeURIComponent(k))
      .then(function(r){return r.json();})
      .then(function(j){newsTestResults[k]=j;renderNewsSourceTest();})
      .catch(function(e){newsTestResults[k]={ok:false,error:'fetch failed: '+(e&&e.message||e)};renderNewsSourceTest();});
  });
  Promise.all(promises).then(function(){
    if(btn){btn.disabled=false;btn.textContent='▶ Run All';}
  });
}
function copyNewsSourceTest(){
  var lines=['MLB News Source Test','Date: '+new Date().toISOString(),'Proxy: '+API_BASE+'/api/proxy-test',''];
  NEWS_TEST_SOURCES.forEach(function(k){
    var r=newsTestResults[k];
    lines.push('── '+k+' ──');
    if(!r||r.pending){lines.push('  (not tested)');lines.push('');return;}
    lines.push('  url:        '+(r.url||'?'));
    lines.push('  status:     '+(r.status||'?')+' · ok='+!!r.ok);
    lines.push('  kind:       '+(r.kind||'?'));
    lines.push('  contentType:'+(r.contentType||'?'));
    lines.push('  bytes:      '+(r.byteLength||0));
    lines.push('  elapsedMs:  '+(r.elapsedMs||0));
    lines.push('  itemCount:  '+(r.itemCount||0));
    lines.push('  firstTitle: '+(r.firstTitle||''));
    if(r.error) lines.push('  error:      '+r.error);
    if(r.sample){
      lines.push('  sample (first 600 chars):');
      r.sample.split('\n').forEach(function(ln){lines.push('    '+ln);});
    }
    lines.push('');
  });
  var text=lines.join('\n');
  var btn=document.getElementById('newsTestCopyBtn');
  function flash(msg){if(!btn)return;var orig=btn.textContent;btn.textContent=msg;setTimeout(function(){btn.textContent=orig;},1800);}
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(function(){flash('✓ Copied!');},function(){fallbackCopy(text);flash('✓ Copied (fallback)');});
  }else{
    fallbackCopy(text);flash('✓ Copied (fallback)');
  }
}
// ── /News Source Test ─────────────────────────────────────────────────────
function toggleDevTools(){var p=document.getElementById('devToolsPanel');var opening=p.style.display!=='block';p.style.display=opening?'block':'none';if(opening){document.getElementById('tuneRotateMs').value=devTuning.rotateMs;document.getElementById('tuneRbiThreshold').value=devTuning.rbiThreshold;document.getElementById('tuneRbiCooldown').value=devTuning.rbiCooldown;document.getElementById('tuneHRPriority').value=devTuning.hr_priority;document.getElementById('tuneHRCooldown').value=devTuning.hr_cooldown;document.getElementById('tuneBigInningPriority').value=devTuning.biginning_priority;document.getElementById('tuneBigInningThreshold').value=devTuning.biginning_threshold;document.getElementById('tuneWalkoffPriority').value=devTuning.walkoff_priority;document.getElementById('tuneNohitterFloor').value=devTuning.nohitter_inning_floor;document.getElementById('tuneBasesLoadedEnable').checked=devTuning.basesloaded_enable;document.getElementById('tuneBasesLoadedPriority').value=devTuning.basesloaded_priority;var tHF=document.getElementById('tuneHitstreakFloor');if(tHF)tHF.value=devTuning.hitstreak_floor||10;var tHP=document.getElementById('tuneHitstreakPriority');if(tHP)tHP.value=devTuning.hitstreak_priority||65;var tRI=document.getElementById('tuneRosterPriorityIL');if(tRI)tRI.value=devTuning.roster_priority_il||40;var tRT=document.getElementById('tuneRosterPriorityTrade');if(tRT)tRT.value=devTuning.roster_priority_trade||55;var tWL=document.getElementById('tuneWPLeverageFloor');if(tWL)tWL.value=devTuning.wp_leverage_floor||2;var tWE=document.getElementById('tuneWPExtremeFloor');if(tWE)tWE.value=devTuning.wp_extreme_floor||85;var tLP=document.getElementById('tuneLiveWPPriority');if(tLP)tLP.value=devTuning.livewp_priority||30;var tLR=document.getElementById('tuneLiveWPRefresh');if(tLR)tLR.value=devTuning.livewp_refresh_ms||90000;document.getElementById('tuneFocusCritical').value=devTuning.focus_critical;document.getElementById('tuneFocusHigh').value=devTuning.focus_high;document.getElementById('tuneFocusSwitchMargin').value=devTuning.focus_switch_margin;document.getElementById('tuneFocusAlertCooldown').value=devTuning.focus_alert_cooldown;document.getElementById('lockThemeToggle').checked=devColorLocked;}}

// Delegated click handler for Dev Tools panel — replaces 11 inline onclick attributes (M3)
document.addEventListener('DOMContentLoaded',function(){
  var panel=document.getElementById('devToolsPanel');
  if(!panel)return;
  panel.addEventListener('click',function(e){
    var btn=e.target.closest('[data-dt-action]');
    if(!btn)return;
    var action=btn.dataset.dtAction;
    if(action==='close'){toggleDevTools();}
    else if(action==='demo'){toggleDemoMode();toggleDevTools();}
    else if(action==='replayHR'){replayHRCard();toggleDevTools();}
    else if(action==='replayRBI'){replayRBICard();toggleDevTools();}
    else if(action==='cardVariants'){window.PulseCard.demo();toggleDevTools();}
    else if(action==='testCard'){generateTestCard();toggleDevTools();}
    else if(action==='testClip'){devTestVideoClip();toggleDevTools();}
    else if(action==='resetCollection'){resetCollection();}
    else if(action==='newsTest'){openNewsSourceTest();toggleDevTools();}
    else if(action==='videoDebug'){openVideoDebugPanel();toggleDevTools();}
    else if(action==='resetTuning'){resetTuning();}
    else if(action==='captureApp'){captureCurrentTheme('app');}
    else if(action==='capturePulse'){captureCurrentTheme('pulse');}
    else if(action==='refreshDebug'){refreshDebugPanel();}
    else if(action==='confirm'){confirmDevToolsChanges();}
  });
});

function updateTuning(param,val){
  if(param==='basesloaded_enable'){
    devTuning[param]=val==='true';
    if(DEBUG) console.log('✓ Bases Loaded '+(devTuning[param]?'enabled':'disabled'));
    return;
  }
  var parsed=parseInt(val,10);
  if(isNaN(parsed)||parsed<1)return;
  devTuning[param]=parsed;
  if(param==='rotateMs'){
    if(storyRotateTimer){clearInterval(storyRotateTimer);storyRotateTimer=null;}
    if(pulseInitialized&&!demoMode)storyRotateTimer=setInterval(rotateStory,devTuning.rotateMs);
    if(DEBUG) console.log('✓ Carousel rotation updated to '+parsed+'ms');
  }else{
    if(DEBUG) console.log('✓ '+param+' updated to '+parsed);
  }
}

function resetTuning(){
  devTuning=Object.assign({},devTuningDefaults);
  document.getElementById('tuneRotateMs').value=devTuningDefaults.rotateMs;
  document.getElementById('tuneRbiThreshold').value=devTuningDefaults.rbiThreshold;
  document.getElementById('tuneRbiCooldown').value=devTuningDefaults.rbiCooldown;
  document.getElementById('tuneHRPriority').value=devTuningDefaults.hr_priority;
  document.getElementById('tuneHRCooldown').value=devTuningDefaults.hr_cooldown;
  document.getElementById('tuneBigInningPriority').value=devTuningDefaults.biginning_priority;
  document.getElementById('tuneBigInningThreshold').value=devTuningDefaults.biginning_threshold;
  document.getElementById('tuneWalkoffPriority').value=devTuningDefaults.walkoff_priority;
  document.getElementById('tuneNohitterFloor').value=devTuningDefaults.nohitter_inning_floor;
  document.getElementById('tuneBasesLoadedEnable').checked=devTuningDefaults.basesloaded_enable;
  document.getElementById('tuneBasesLoadedPriority').value=devTuningDefaults.basesloaded_priority;
  document.getElementById('tuneFocusCritical').value=devTuningDefaults.focus_critical;
  document.getElementById('tuneFocusHigh').value=devTuningDefaults.focus_high;
  document.getElementById('tuneFocusSwitchMargin').value=devTuningDefaults.focus_switch_margin;
  document.getElementById('tuneFocusAlertCooldown').value=devTuningDefaults.focus_alert_cooldown;
  if(storyRotateTimer){clearInterval(storyRotateTimer);storyRotateTimer=null;}
  if(pulseInitialized&&!demoMode)storyRotateTimer=setInterval(rotateStory,devTuning.rotateMs);
  if(DEBUG) console.log('✓ Dev tuning reset to defaults');
}

function updateColorOverride(context,colorVar,value){
  devColorOverrides[context][colorVar]=value;
  if(devColorLocked){
    if(context==='app') applyTeamTheme(activeTeam);
    else applyPulseMLBTheme();
  }
  if(DEBUG) console.log('✓ '+context+' theme.'+colorVar+' → '+value);
}

function captureCurrentTheme(context){
  var cssVarMap={dark:'--dark',card:'--card',card2:'--card2',border:'--border',primary:'--primary',secondary:'--secondary',accent:'--accent',accentText:'--accent-text',headerText:'--header-text'};
  var root=document.documentElement;
  Object.keys(cssVarMap).forEach(function(v){
    var cssVal=getComputedStyle(root).getPropertyValue(cssVarMap[v]).trim();
    devColorOverrides[context][v]=cssVal;
    var elId='color'+context.charAt(0).toUpperCase()+context.slice(1)+v.charAt(0).toUpperCase()+v.slice(1);
    var el=document.getElementById(elId);
    if(el) el.value=cssVal;
  });
  if(DEBUG) console.log('✓ Captured current '+context+' theme colors');
}

function toggleColorLock(enable){
  devColorLocked=enable;
  if(enable){
    if(!devColorOverrides.app.primary) captureCurrentTheme('app');
    if(!devColorOverrides.pulse.primary) captureCurrentTheme('pulse');
    applyTeamTheme(activeTeam);
    if(DEBUG) console.log('✓ Theme lock enabled — auto-switching disabled');
  }else{
    applyTeamTheme(activeTeam);
    applyPulseMLBTheme();
    if(DEBUG) console.log('✓ Theme lock disabled — auto-switching restored');
  }
  document.getElementById('lockThemeToggle').checked=devColorLocked;
}

function setSoundPref(key,val){soundSettings[key]=val;if(key==='master')document.getElementById('soundRows').classList.toggle('master-off',!val);localStorage.setItem('mlb_sound_settings',JSON.stringify(soundSettings));}
function playSound(type){
  if (!soundSettings.master||!soundSettings[type]) return;
  if(type==='hr')playHrSound();else if(type==='run')playRunSound();else if(type==='risp')playRispSound();
  else if(type==='dp')playDpSound();else if(type==='tp')playTpSound();
  else if(type==='gameStart')playGameStartSound();else if(type==='gameEnd')playGameEndSound();else if(type==='error')playErrorSound();
}
function _makeCtx(){return new(window.AudioContext||window.webkitAudioContext)();}
function _closeCtx(ctx,dur){setTimeout(function(){try{ctx.close();}catch(e){};},(dur+0.6)*1000);}
function _osc(ctx,freq,t0,dur,vol,wave,attack){var osc=ctx.createOscillator(),g=ctx.createGain();osc.connect(g);g.connect(ctx.destination);osc.type=wave||'sine';osc.frequency.value=freq;var at=ctx.currentTime+t0,att=attack||0.005;g.gain.setValueAtTime(0.0001,at);g.gain.exponentialRampToValueAtTime(vol,at+att);g.gain.exponentialRampToValueAtTime(0.0001,at+dur);osc.start(at);osc.stop(at+dur+0.05);}
function _ns(ctx,t0,dur,vol,attack,filterType,filterFreq,filterQ){var len=Math.ceil(ctx.sampleRate*(dur+0.1)),buf=ctx.createBuffer(1,len,ctx.sampleRate),d=buf.getChannelData(0);for(var i=0;i<len;i++)d[i]=Math.random()*2-1;var src=ctx.createBufferSource();src.buffer=buf;var filt=ctx.createBiquadFilter();filt.type=filterType||'bandpass';filt.frequency.value=filterFreq||1000;filt.Q.value=filterQ!==undefined?filterQ:1;var g=ctx.createGain();src.connect(filt);filt.connect(g);g.connect(ctx.destination);var at=ctx.currentTime+t0,att=attack||0.003;g.gain.setValueAtTime(0.0001,at);g.gain.exponentialRampToValueAtTime(vol,at+att);g.gain.exponentialRampToValueAtTime(0.0001,at+dur);src.start(at);src.stop(at+dur+0.05);}
function playHrSound(){try{var ctx=_makeCtx();_ns(ctx,0,0.07,0.32,0.001,'highpass',2200,0.8);_ns(ctx,0,0.05,0.22,0.001,'bandpass',900,3.0);_osc(ctx,140,0,0.06,0.18,'sine',0.001);_ns(ctx,0.05,0.90,0.09,0.08,'lowpass',300,1.0);_closeCtx(ctx,1.2);}catch(e){}}
function playRunSound(){try{var ctx=_makeCtx();_osc(ctx,523,0,0.55,0.18,'sine');_osc(ctx,659,0.15,0.50,0.18,'sine');_osc(ctx,784,0.30,0.60,0.18,'sine');_closeCtx(ctx,1.0);}catch(e){}}
function playRispSound(){try{var ctx=_makeCtx();_ns(ctx,0,0.10,0.20,0.003,'lowpass',180,2.0);_ns(ctx,0.13,0.14,0.16,0.004,'lowpass',220,1.5);_closeCtx(ctx,0.4);}catch(e){}}
function playDpSound(){try{var ctx=_makeCtx();_ns(ctx,0,0.06,0.28,0.001,'bandpass',750,5);_ns(ctx,0.10,0.06,0.28,0.001,'bandpass',750,5);_closeCtx(ctx,0.4);}catch(e){}}
function playTpSound(){try{var ctx=_makeCtx();_osc(ctx,392,0,0.12,0.17,'triangle');_osc(ctx,523,0.11,0.12,0.17,'triangle');_osc(ctx,659,0.22,0.12,0.17,'triangle');_osc(ctx,784,0.33,0.32,0.17,'triangle');_closeCtx(ctx,0.8);}catch(e){}}
function playGameStartSound(){try{var ctx=_makeCtx();_osc(ctx,523,0,0.14,0.16,'triangle');_osc(ctx,587,0.13,0.14,0.16,'triangle');_osc(ctx,659,0.26,0.14,0.16,'triangle');_osc(ctx,784,0.39,0.38,0.16,'triangle');_closeCtx(ctx,1.0);}catch(e){}}
function playGameEndSound(){try{var ctx=_makeCtx();_osc(ctx,784,0,0.65,0.15,'sine');_osc(ctx,659,0.38,0.65,0.15,'sine');_osc(ctx,523,0.76,0.80,0.15,'sine');_closeCtx(ctx,1.8);}catch(e){}}
function playErrorSound(){try{var ctx=_makeCtx();_ns(ctx,0,0.18,0.22,0.003,'lowpass',160,1.5);_osc(ctx,130,0.02,0.16,0.10,'sine');_closeCtx(ctx,0.5);}catch(e){}}

function fmt(v,d){d=d===undefined?3:d;if(v==null||v==='')return'—';var n=parseFloat(v);if(isNaN(n))return v;return n.toFixed(d);}
function fmtRate(v,d){d=d===undefined?3:d;if(v==null||v==='')return'—';var n=parseFloat(v);if(isNaN(n))return v;var s=n.toFixed(d);return(n>0&&n<1)?s.slice(1):s;}
function fmtDateTime(ds){var d=new Date(ds);return d.toLocaleDateString('en-US',{month:'short',day:'numeric'})+' '+d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});}
function capImgError(el,primary,secondary,letter){el.onerror=null;var p=(primary||'#333').replace(/#/g,'%23'),s=(secondary||'#fff').replace(/#/g,'%23');el.src='data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="'+p+'"/><text x="32" y="41" text-anchor="middle" font-family="system-ui,sans-serif" font-size="28" font-weight="800" fill="'+s+'">'+letter+'</text></svg>';}
function teamCapImg(teamId,name,primary,secondary,cls){var letter=(name||'?')[0].toUpperCase();var p=encodeURIComponent(primary||'#333'),s=encodeURIComponent(secondary||'#fff');return'<img src="https://www.mlbstatic.com/team-logos/'+teamId+'.svg" class="'+(cls||'card-cap')+'" onerror="capImgError(this,\''+primary+'\',\''+secondary+'\',\''+letter+'\')">';}

function relLuminance(hex){hex=hex.replace('#','');var n=parseInt(hex,16),r=((n>>16)&255)/255,g=((n>>8)&255)/255,b=(n&255)/255;r=r<=0.03928?r/12.92:Math.pow((r+0.055)/1.055,2.4);g=g<=0.03928?g/12.92:Math.pow((g+0.055)/1.055,2.4);b=b<=0.03928?b/12.92:Math.pow((b+0.055)/1.055,2.4);return 0.2126*r+0.7152*g+0.0722*b;}
function contrastRatio(hexA,hexB){var lA=relLuminance(hexA),lB=relLuminance(hexB);return(Math.max(lA,lB)+0.05)/(Math.min(lA,lB)+0.05);}
function hslHex(h,s,l){s/=100;l/=100;var a=s*Math.min(l,1-l),f=function(n){var k=(n+h/30)%12,c=l-a*Math.max(Math.min(k-3,9-k,1),-1);return Math.round(255*c).toString(16).padStart(2,'0');};return'#'+f(0)+f(8)+f(4);}
function hslLighten(hex,targetL){hex=hex.replace('#','');var n=parseInt(hex,16),r=((n>>16)&255)/255,g=((n>>8)&255)/255,b=(n&255)/255,max=Math.max(r,g,b),min=Math.min(r,g,b),h=0,s=0,l=(max+min)/2;if(max!==min){var d=max-min;s=l>0.5?d/(2-max-min):d/(max+min);if(max===r)h=((g-b)/d+(g<b?6:0))/6;else if(max===g)h=((b-r)/d+2)/6;else h=((r-g)/d+4)/6;}return hslHex(Math.round(h*360),Math.round(s*100),Math.round(targetL*100));}
function pickAccent(secondaryHex,cardHex){var sLum=relLuminance(secondaryHex),cCon=contrastRatio(secondaryHex,cardHex);if(sLum>=0.18&&cCon>=3.0)return secondaryHex;var lifted=hslLighten(secondaryHex,0.65);if(contrastRatio(lifted,cardHex)>=3.0)return lifted;return'#FFB273';}
function pickHeaderText(primaryHex){return relLuminance(primaryHex)>0.5?'#0a0f1e':'#ffffff';}
function applyTeamTheme(team){
  if(devColorLocked&&devColorOverrides.app.primary){
    document.documentElement.style.setProperty('--dark',devColorOverrides.app.dark);
    document.documentElement.style.setProperty('--card',devColorOverrides.app.card);
    document.documentElement.style.setProperty('--card2',devColorOverrides.app.card2);
    document.documentElement.style.setProperty('--border',devColorOverrides.app.border);
    document.documentElement.style.setProperty('--primary',devColorOverrides.app.primary);
    document.documentElement.style.setProperty('--secondary',devColorOverrides.app.secondary);
    document.documentElement.style.setProperty('--accent',devColorOverrides.app.accent);
    document.documentElement.style.setProperty('--accent-text',devColorOverrides.app.accentText);
    document.documentElement.style.setProperty('--header-text',devColorOverrides.app.headerText);
    return;
  }
  // Clear any previously header-scoped vars so switching nav→full doesn't leave stale overrides
  var hdr=document.querySelector('header');
  if(hdr){['--primary','--secondary','--accent','--accent-text','--header-text'].forEach(function(v){hdr.style.removeProperty(v);});}
  var ct=themeOverride||team;
  var cp=themeInvert?ct.secondary:ct.primary,cs=themeInvert?ct.primary:ct.secondary;
  var l1=relLuminance(cp),l2=relLuminance(cs),ratio=(Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05),accent=ratio>=3?cs:'#ffffff',accentLum=relLuminance(accent);
  if(accentLum<0.05){accent='#ffffff';accentLum=1;}
  var accentText=accentLum>0.4?'#111827':'#ffffff';
  var hueOf=function(hex){hex=hex.replace('#','');var r=parseInt(hex.substr(0,2),16)/255,g=parseInt(hex.substr(2,2),16)/255,b=parseInt(hex.substr(4,2),16)/255,max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min,h=0;if(d){if(max===r)h=((g-b)/d+(g<b?6:0))/6;else if(max===g)h=((b-r)/d+2)/6;else h=((r-g)/d+4)/6;}return Math.round(h*360);};
  var h=hueOf(cp),cardHex=hslHex(h,45,22);
  var safeAccent=pickAccent(accent,cardHex),headerText=pickHeaderText(cp);
  if(themeScope==='nav'){
    // Global: always MLB_THEME (neutral) — rest of app is unaffected by team switching
    var dp=MLB_THEME.primary,ds=MLB_THEME.secondary;
    var dl1=relLuminance(dp),dl2=relLuminance(ds),dr=(Math.max(dl1,dl2)+0.05)/(Math.min(dl1,dl2)+0.05);
    var dacc=dr>=3?ds:'#ffffff',daccLum=relLuminance(dacc);
    if(daccLum<0.05){dacc='#ffffff';daccLum=1;}
    var daccText=daccLum>0.4?'#111827':'#ffffff';
    var dh=hueOf(dp),dcard=hslHex(dh,45,22);
    var dSafeAcc=pickAccent(dacc,dcard),dHdrText=pickHeaderText(dp);
    document.documentElement.style.setProperty('--dark',hslHex(dh,50,18));
    document.documentElement.style.setProperty('--card',dcard);
    document.documentElement.style.setProperty('--card2',hslHex(dh,40,26));
    document.documentElement.style.setProperty('--border',hslHex(dh,35,30));
    document.documentElement.style.setProperty('--primary',dp);
    document.documentElement.style.setProperty('--secondary',dacc);
    document.documentElement.style.setProperty('--accent-text',daccText);
    document.documentElement.style.setProperty('--accent',dSafeAcc);
    document.documentElement.style.setProperty('--header-text',dHdrText);
    try{localStorage.setItem('mlb_theme_vars',JSON.stringify({'--dark':hslHex(dh,50,18),'--card':dcard,'--card2':hslHex(dh,40,26),'--border':hslHex(dh,35,30),'--primary':dp,'--secondary':dacc,'--accent-text':daccText,'--accent':dSafeAcc,'--header-text':dHdrText}));}catch(e){}
    // <header> element: team vars scoped here only — logo, team name, nav strip, bottom border
    if(hdr){
      hdr.style.setProperty('--primary',cp);
      hdr.style.setProperty('--secondary',accent);
      hdr.style.setProperty('--accent-text',accentText);
      hdr.style.setProperty('--accent',safeAccent);
      hdr.style.setProperty('--header-text',headerText);
    }
    document.querySelector('.logo').innerHTML='<img src="https://www.mlbstatic.com/team-logos/'+team.id+'.svg" style="height:32px;width:32px"> <span>'+team.short.toUpperCase()+'</span>';
    document.title=team.short+' Tracker';
    var tcmN=document.getElementById('themeColorMeta');if(tcmN)tcmN.setAttribute('content',cp);
    var chipN=document.getElementById('teamChip');if(chipN)chipN.textContent=team.name.toUpperCase();
    return;
  }
  document.documentElement.style.setProperty('--dark',hslHex(h,50,18));
  document.documentElement.style.setProperty('--card',cardHex);
  document.documentElement.style.setProperty('--card2',hslHex(h,40,26));
  document.documentElement.style.setProperty('--border',hslHex(h,35,30));
  document.documentElement.style.setProperty('--primary',cp);
  document.documentElement.style.setProperty('--secondary',accent);
  document.documentElement.style.setProperty('--accent-text',accentText);
  document.documentElement.style.setProperty('--accent',safeAccent);
  document.documentElement.style.setProperty('--header-text',headerText);
  try{localStorage.setItem('mlb_theme_vars',JSON.stringify({'--dark':hslHex(h,50,18),'--card':cardHex,'--card2':hslHex(h,40,26),'--border':hslHex(h,35,30),'--primary':cp,'--secondary':accent,'--accent-text':accentText,'--accent':safeAccent,'--header-text':headerText}));}catch(e){}
  document.querySelector('.logo').innerHTML='<img src="https://www.mlbstatic.com/team-logos/'+team.id+'.svg" style="height:32px;width:32px"> <span>'+team.short.toUpperCase()+'</span>';
  document.title=team.short+' Tracker';
  var tcm=document.getElementById('themeColorMeta');if(tcm)tcm.setAttribute('content',cp);
  var chip=document.getElementById('teamChip');if(chip)chip.textContent=team.name.toUpperCase();
}

// ── Pulse color schemes ─────────────────────────────────────────────────────
const PULSE_SCHEME = {
  dark: {
    label:'Navy', emoji:'⚾',
    dark:'#0F1B2E', card:'#172B4D', card2:'#1E3A5F', border:'#2C4A7F',
    accent:'#cfd3dc', accentSoft:'rgba(255,255,255,0.08)', accentStrong:'#ffffff',
    text:'#e8eaf0', muted:'#9aa0a8',
    scoringBg:'rgba(60,190,100,0.10)', scoringBorder:'rgba(60,190,100,0.28)',
    hrBg:'rgba(160,100,255,0.10)', hrBorder:'rgba(160,100,255,0.40)',
    statusBg:'rgba(80,140,255,0.08)', statusBorder:'rgba(80,140,255,0.22)'
  },
  light: {
    label:'Light', emoji:'☀️',
    dark:'#F1F5F9', card:'#FFFFFF', card2:'#E8EDF3', border:'#CBD5E1',
    accent:'#2563EB', accentSoft:'rgba(37,99,235,0.08)', accentStrong:'#1E40AF',
    text:'#0F172A', muted:'#64748B',
    scoringBg:'rgba(22,163,74,0.07)', scoringBorder:'rgba(22,163,74,0.32)',
    hrBg:'rgba(109,40,217,0.07)', hrBorder:'rgba(109,40,217,0.28)',
    statusBg:'rgba(37,99,235,0.06)', statusBorder:'rgba(37,99,235,0.22)'
  }
};
let pulseColorScheme=(function(){try{return localStorage.getItem('mlb_pulse_scheme')||'dark';}catch(e){return'dark';}})();

function applyPulseMLBTheme(){
  if(devColorLocked&&devColorOverrides.pulse.primary){
    document.documentElement.style.setProperty('--dark',devColorOverrides.pulse.dark);
    document.documentElement.style.setProperty('--p-dark',devColorOverrides.pulse.dark);
    document.documentElement.style.setProperty('--p-card',devColorOverrides.pulse.card);
    document.documentElement.style.setProperty('--p-card2',devColorOverrides.pulse.card2);
    document.documentElement.style.setProperty('--p-border',devColorOverrides.pulse.border);
    return;
  }
  var s=PULSE_SCHEME[pulseColorScheme]||PULSE_SCHEME.dark;
  document.documentElement.style.setProperty('--dark',s.dark);
  document.documentElement.style.setProperty('--p-dark',s.dark);
  document.documentElement.style.setProperty('--p-card',s.card);
  document.documentElement.style.setProperty('--p-card2',s.card2);
  document.documentElement.style.setProperty('--p-border',s.border);
  document.documentElement.style.setProperty('--p-accent',s.accent);
  document.documentElement.style.setProperty('--p-accent-soft',s.accentSoft);
  document.documentElement.style.setProperty('--p-accent-strong',s.accentStrong);
  document.documentElement.style.setProperty('--p-text',s.text);
  document.documentElement.style.setProperty('--p-muted',s.muted);
  document.documentElement.style.setProperty('--p-scoring-bg',s.scoringBg);
  document.documentElement.style.setProperty('--p-scoring-border',s.scoringBorder);
  document.documentElement.style.setProperty('--p-hr-bg',s.hrBg);
  document.documentElement.style.setProperty('--p-hr-border',s.hrBorder);
  document.documentElement.style.setProperty('--p-status-bg',s.statusBg);
  document.documentElement.style.setProperty('--p-status-border',s.statusBorder);
}

function setPulseColorScheme(scheme){
  pulseColorScheme=scheme;
  try{localStorage.setItem('mlb_pulse_scheme',scheme);}catch(e){}
  var ps=document.getElementById('pulse');
  if(ps&&ps.classList.contains('active'))applyPulseMLBTheme();
  updatePulseToggle();
}
function updatePulseToggle(){
  var isLight=pulseColorScheme==='light';
  var btn=document.getElementById('ptbSchemeBtn');
  var icon=document.getElementById('ptbSchemeIcon');
  if(icon) icon.textContent=isLight?'☀️':'🌙';
}
function toggleSettings(){document.getElementById('settingsPanel').classList.toggle('open');}
document.addEventListener('click',function(e){
  if(!document.querySelector('.settings-wrap').contains(e.target))document.getElementById('settingsPanel').classList.remove('open');
  var tt=document.getElementById('calTooltip');if(tt&&tt.classList.contains('open')&&!e.target.closest('.cal-day'))tt.classList.remove('open');
});

function buildThemeSelect(){
  var sel=document.getElementById('themeSelect');sel.innerHTML='<option value="-1">Default</option><option value="0">Follow Team</option>';var lastDiv='';
  TEAMS.forEach(function(t){
    if(t.division!==lastDiv){var og=document.createElement('optgroup');og.label=t.division;sel.appendChild(og);lastDiv=t.division;}
    var opt=document.createElement('option');opt.value=t.id;opt.textContent=t.name;sel.lastChild.appendChild(opt);
  });
}

function switchTheme(val){
  if(val==='0'){themeOverride=null;}
  else if(val==='-1'){themeOverride=MLB_THEME;}
  else{themeOverride=TEAMS.find(t=>t.id===parseInt(val));}
  localStorage.setItem('mlb_theme',val);
  applyTeamTheme(activeTeam);
}

function switchThemeScope(val){
  themeScope=val;
  try{localStorage.setItem('mlb_theme_scope',val);}catch(e){}
  applyTeamTheme(activeTeam);
}

function toggleInvert(){
  themeInvert=!themeInvert;
  localStorage.setItem('mlb_invert',themeInvert);
  var t=document.getElementById('invertToggle'),k=document.getElementById('invertToggleKnob');
  t.style.background=themeInvert?'var(--primary)':'var(--border)';
  k.style.left=themeInvert?'21px':'3px';
  applyTeamTheme(activeTeam);
  loadTodayGame();loadNextGame();
}

// ── Session & Sync Functions ──────────────────────────────────────────────────
function signInWithGitHub(){
  const state=Math.random().toString(36).slice(2,15);
  const githubAuthUrl='https://github.com/login/oauth/authorize?'+
    'client_id=Ov23lilv8CB5JzyvevZE&'+
    'redirect_uri='+encodeURIComponent(window.location.origin+'/api/auth/github')+'&'+
    'state='+state+'&'+
    'scope=user:email';
  window.location=githubAuthUrl;
}
function signInWithEmail(){
  var email=prompt('Enter your email to receive a sign-in link:');
  if(!email||!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/))return alert('Invalid email');
  fetch((window.API_BASE||'')+'/api/auth/email-request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email})}).then(r=>r.json()).then(d=>{if(d.error)alert('Error: '+d.error);else alert(d.message);}).catch(e=>alert('Network error'));
}
function signOut(){
  if(!confirm('Sign out and disconnect sync?'))return;
  mlbSessionToken=null;mlbAuthUser=null;
  localStorage.removeItem('mlb_session_token');localStorage.removeItem('mlb_auth_user');
  clearInterval(mlbSyncInterval);mlbSyncInterval=null;
  updateSyncUI();
}
function updateSyncUI(){
  var panel=document.getElementById('syncStatus');
  if(!panel)return;
  if(mlbSessionToken&&mlbAuthUser){
    panel.innerHTML='<div style="font-size:.72rem;color:var(--text)">✓ Synced · '+mlbAuthUser+'</div><button onclick="signOut()" style="background:var(--card2);border:1px solid var(--border);color:var(--text);font-size:.72rem;padding:5px 10px;border-radius:8px;cursor:pointer">Sign Out</button>';
  }else{
    panel.innerHTML='<button onclick="signInWithGitHub()" style="background:var(--card2);border:1px solid var(--border);color:var(--text);font-size:.72rem;padding:6px 12px;border-radius:8px;cursor:pointer;width:100%;text-align:left">🔐 Sign in with GitHub</button><button onclick="signInWithEmail()" style="background:var(--card2);border:1px solid var(--border);color:var(--text);font-size:.72rem;padding:6px 12px;border-radius:8px;cursor:pointer;width:100%;margin-top:6px;text-align:left">✉️ Sign in with Email</button>';
  }
}
async function syncCollection(){
  if(!mlbSessionToken)return;
  try{
    const local=loadCollection();
    const r=await fetch((window.API_BASE||'')+'/api/collection-sync',{method:'PUT',headers:{'Content-Type':'application/json','Authorization':'Bearer '+mlbSessionToken},body:JSON.stringify({localCollection:local})});
    if(r.ok){
      const data=await r.json();
      if(data.collection){
        saveCollection(data.collection);
        if(DEBUG) console.log('[Sync] Collection synced',Object.keys(data.collection).length,'cards');
      }
    }
  }catch(e){console.error('[Sync] Collection error',e);}
}
async function mergeCollectionOnSignIn(){
  if(!mlbSessionToken)return;
  try{
    const r=await fetch((window.API_BASE||'')+'/api/collection/sync?token='+mlbSessionToken);
    if(r.ok){
      const data=await r.json();
      if(data.collection&&Object.keys(data.collection).length>0){
        const local=loadCollection();
        const merged=mergeCollectionSlots(local,data.collection);
        saveCollection(merged);
        updateCollectionUI();
        if(DEBUG) console.log('[Sync] Merged',Object.keys(merged).length,'cards from server');
      }
    }
  }catch(e){console.error('[Sync] Merge error',e);}
}
function mergeCollectionSlots(local,remote){
  function tierRank(t){const ranks={legendary:4,epic:3,rare:2,common:1};return ranks[t]||0;}
  const merged={...local,...remote};
  Object.keys(local).forEach(k=>{
    if(remote[k]){
      const lr=tierRank(local[k].tier),rr=tierRank(remote[k].tier);
      if(lr>rr){merged[k]=local[k];}
      else if(rr>lr){merged[k]=remote[k];}
      else{
        const newer=local[k].collectedAt>=remote[k].collectedAt?local[k]:remote[k];
        const em=new Map();
        (local[k].events||[]).forEach(e=>em.set(e.date+':'+e.badge,e));
        (remote[k].events||[]).forEach(e=>em.set(e.date+':'+e.badge,e));
        const events=Array.from(em.values()).sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,10);
        merged[k]={...newer,events:events};
      }
    }
  });
  return merged;
}
function startSyncInterval(){
  if(mlbSyncInterval)return;
  mlbSyncInterval=setInterval(async()=>{
    syncCollection();
  },TIMING.SYNC_INTERVAL_MS);
}
function showSignInCTA(){
  if(mlbSessionToken||shownSignInCTA)return;
  signInCTACardCount++;
  if(signInCTACardCount<3)return;
  shownSignInCTA=true;
  var el=document.getElementById('signInCTA');
  el.style.display='block';
  el.style.pointerEvents='auto';
  // Slide-up + fade-in on next frame
  requestAnimationFrame(function(){
    el.style.opacity='1';
    el.style.transform='translateX(-50%) translateY(0)';
    // Progress bar shrink over 8s
    var bar=document.getElementById('signInCTABar');
    if(bar){requestAnimationFrame(function(){bar.style.transform='scaleX(0)'});}
  });
  signInCTATimer=setTimeout(closeSignInCTA,TIMING.SIGNIN_CTA_MS);
}
function closeSignInCTA(){
  if(signInCTATimer){clearTimeout(signInCTATimer);signInCTATimer=null;}
  var el=document.getElementById('signInCTA');
  el.style.opacity='0';
  el.style.transform='translateX(-50%) translateY(16px)';
  el.style.pointerEvents='none';
  setTimeout(function(){el.style.display='none';},260);
}

function buildTeamSelect(){
  var sel=document.getElementById('teamSelect');sel.innerHTML='';var lastDiv='';
  TEAMS.forEach(function(t){
    if(t.division!==lastDiv){var og=document.createElement('optgroup');og.label=t.division;sel.appendChild(og);lastDiv=t.division;}
    var opt=document.createElement('option');opt.value=t.id;opt.textContent=t.name;if(t.id===activeTeam.id)opt.selected=true;sel.lastChild.appendChild(opt);
  });
}

function switchTeam(teamId){
  if(homeLiveTimer){clearInterval(homeLiveTimer);homeLiveTimer=null;}
  activeTeam=TEAMS.find(t=>t.id===parseInt(teamId));localStorage.setItem('mlb_team',teamId);applyTeamTheme(activeTeam);
  document.getElementById('settingsPanel').classList.remove('open');
  scheduleData=[];scheduleLoaded=false;rosterData={hitting:[],pitching:[],fielding:[]};statsCache={hitting:[],pitching:[]};selectedPlayer=null;
  document.getElementById('playerStats').innerHTML='<div style="color:var(--muted);font-size:.9rem;padding:20px 0;text-align:center">Select a player to view stats</div>';
  loadTodayGame();loadNextGame();loadNews();loadStandings();loadRoster();loadHomeYoutubeWidget();
  if(document.getElementById('schedule').classList.contains('active'))loadSchedule();
  if(myTeamLens) applyMyTeamLens(true);
}

async function requestScreenWakeLock(){
  if(!navigator.wakeLock)return;
  try{
    screenWakeLock=await navigator.wakeLock.request('screen');
    screenWakeLock.addEventListener('release',()=>{screenWakeLock=null;});
  }catch(e){
    console.warn('Wake lock request failed:',e);
  }
}

async function releaseScreenWakeLock(){
  if(screenWakeLock){
    try{
      await screenWakeLock.release();
      screenWakeLock=null;
    }catch(e){
      console.warn('Wake lock release failed:',e);
    }
  }
}

function onSoundPanelClickOutside(e){
  var panel=document.getElementById('soundPanel'),btn=document.getElementById('ptbSoundBtn');
  if(panel&&panel.style.display!=='none'&&!panel.contains(e.target)&&btn&&!btn.contains(e.target))panel.style.display='none';
  var dbgPanel=document.getElementById('devToolsPanel'),dbgBtn=document.getElementById('btnDevTools');
  if(dbgPanel&&dbgPanel.style.display!=='none'&&!dbgPanel.contains(e.target)&&dbgBtn&&!dbgBtn.contains(e.target))dbgPanel.style.display='none';
}

function showSection(id,btn){
  if(demoMode)exitDemo();
  if(document.getElementById('liveView').classList.contains('active'))closeLiveView();
  if(id!=='league'&&leagueRefreshTimer){clearInterval(leagueRefreshTimer);leagueRefreshTimer=null;}
  if(id!=='home'&&homeLiveTimer){clearInterval(homeLiveTimer);homeLiveTimer=null;}
  document.querySelectorAll('.section').forEach(function(s){s.classList.remove('active');});
  document.querySelectorAll('nav button').forEach(function(b){b.classList.remove('active');});
  document.getElementById(id).classList.add('active');btn.classList.add('active');
  if(id==='pulse'){
    savedThemeForPulse=themeOverride;
    applyPulseMLBTheme();
    requestScreenWakeLock();
  }else{
    releaseScreenWakeLock();
    if(savedThemeForPulse!==undefined){applyTeamTheme(activeTeam);}
  }
  if(id==='schedule'&&!scheduleLoaded)loadSchedule();
  if(id==='standings')loadStandings();
  if(id==='stats'&&!rosterData.hitting.length){loadRoster();loadLeaders();}else if(id==='stats')loadLeaders();
  if(id==='league')loadLeagueView();
  if(id==='news')loadNews();
}

// --- NEXT GAME CARD ---
// Returns the opp color most distinct from myPrimary. Falls back to oppSecondary
// when oppPrimary is too close (RGB Euclidean distance < 60), or to oppPrimary
// unchanged when both opp colors are too similar (e.g., Yankees navy/navy vs Mets blue).
function pickOppColor(oppPrimary,oppSecondary,myPrimary){
  function rgbDist(a,b){
    a=(a||'').replace('#','');b=(b||'').replace('#','');
    if(a.length<6||b.length<6)return 999;
    var ar=parseInt(a.substr(0,2),16),ag=parseInt(a.substr(2,2),16),ab=parseInt(a.substr(4,2),16);
    var br=parseInt(b.substr(0,2),16),bg=parseInt(b.substr(2,2),16),bb=parseInt(b.substr(4,2),16);
    return Math.sqrt(Math.pow(ar-br,2)+Math.pow(ag-bg,2)+Math.pow(ab-bb,2));
  }
  if(rgbDist(oppPrimary,myPrimary)>=60)return oppPrimary;
  if(oppSecondary&&rgbDist(oppSecondary,myPrimary)>=60)return oppSecondary;
  return oppPrimary;
}
function getSeriesInfo(g){
  var sn=g.seriesGameNumber||(g.seriesSummary&&g.seriesSummary.seriesGameNumber);
  var total=g.gamesInSeries||(g.seriesSummary&&g.seriesSummary.gamesInSeries);
  var desc=g.seriesSummary&&g.seriesSummary.seriesStatus?g.seriesSummary.seriesStatus:null;
  if(sn&&total&&desc)return'Game '+sn+' of '+total+' · '+desc;
  if(!scheduleData.length)return sn&&total?'Game '+sn+' of '+total:null;
  var oppId=g.teams.home.team.id===activeTeam.id?g.teams.away.team.id:g.teams.home.team.id;
  var venueId=g.venue&&g.venue.id,gameDateStr=g.gameDate.split('T')[0];
  var series=scheduleData.filter(function(s){
    var sOpp=s.teams.home.team.id===activeTeam.id?s.teams.away.team.id:s.teams.home.team.id;
    var sVenue=s.venue&&s.venue.id,daysDiff=Math.abs((new Date(s.gameDate.split('T')[0])-new Date(gameDateStr))/86400000);
    return sOpp===oppId&&sVenue===venueId&&daysDiff<=4;
  }).sort(function(a,b){return new Date(a.gameDate)-new Date(b.gameDate);});
  if(!sn&&series.length<2)return null;
  var gameNum=sn||(series.findIndex(function(s){return s.gamePk===g.gamePk;})+1);
  var gameTotal=total||series.length,myW=0,oppW=0;
  series.forEach(function(s){if(s.status.abstractGameState!=='Final')return;var myT=s.teams.home.team.id===activeTeam.id?s.teams.home:s.teams.away;if(myT.isWinner)myW++;else oppW++;});
  var recStr='';
  if(myW>oppW)recStr=' · '+activeTeam.short+' lead '+myW+'-'+oppW;
  else if(oppW>myW){var oN=g.teams.home.team.id===activeTeam.id?g.teams.away.team.teamName:g.teams.home.team.teamName;recStr=' · '+oN+' lead '+oppW+'-'+myW;}
  else if(myW>0)recStr=' · Tied '+myW+'-'+myW;
  return'Game '+gameNum+' of '+gameTotal+recStr;
}

function renderNextGame(g,label){
  var home=g.teams.home,away=g.teams.away,teamHome=home.team.id===activeTeam.id;
  var opp=teamHome?away:home,my=teamHome?home:away;
  var status=g.status.abstractGameState,seriesInfo=getSeriesInfo(g);
  var oppD=TEAMS.find(function(t){return t.id===opp.team.id;})||{};
  var myD=TEAMS.find(function(t){return t.id===my.team.id;})||{};
  var showScores=status==='Live'||status==='Final';
  var oppScore=showScores?(opp.score!=null?opp.score:0):'';
  var myScore=showScores?(my.score!=null?my.score:0):'';
  var oppKicker=teamHome?'VS':'AT';
  var myKicker=teamHome?'HOME':'AWAY';
  var topBadge='';
  if(status==='Live'){var inn=g.linescore&&g.linescore.currentInning?(g.linescore.inningHalf==='Bottom'?'▼ ':'▲ ')+g.linescore.currentInning+' · ':'';topBadge='<span class="hero-live-meta">'+inn+'<span class="hero-live-dot"></span>LIVE</span>';}
  else if(status==='Final'){var mW=my.isWinner;topBadge='<span class="badge badge-final">FINAL</span> <span class="badge '+(mW?'badge-w':'badge-l')+'">'+(mW?'W':'L')+'</span>';}
  var bottomRight='';
  if(status==='Live'){bottomRight='<button onclick="showLiveGame('+g.gamePk+')" class="btn-primary">▶ Watch Live</button>';}
  else if(status!=='Final'){bottomRight='<div class="hero-meta-strong">'+(teamHome?'🏟️ Home':'✈️ Away')+' · '+fmtDateTime(g.gameDate)+'</div>';}
  var themeTeamMy=themeOverride||myD;
  var myPrimaryForClash=themeInvert?(themeTeamMy.secondary||activeTeam.primary):(themeTeamMy.primary||activeTeam.primary);
  var oppPrimary=pickOppColor(oppD.primary||'#333',oppD.secondary,myPrimaryForClash);
  var html='<div class="game-big surface-hero has-opp-tint" style="--opp-primary:'+oppPrimary+'">';
  html+='<div class="hero-kicker-row"><span class="eyebrow eyebrow--accent">'+label+'</span>';
  if(topBadge)html+=' '+topBadge;
  html+='</div>';
  html+='<div class="ng-grid">';
  html+=teamCapImg(opp.team.id,opp.team.teamName,oppPrimary,oppD.secondary||'#fff');
  html+='<div class="ng-team-left"><div class="eyebrow">'+oppKicker+'</div><div class="ng-name">'+opp.team.teamName+'</div>'+(showScores?'<div class="ng-score">'+oppScore+'</div>':'')+'</div>';
  html+='<div class="hero-divider">—</div>';
  html+='<div class="ng-team-right"><div class="eyebrow">'+myKicker+'</div><div class="ng-name">'+my.team.teamName+'</div>'+(showScores?'<div class="ng-score">'+myScore+'</div>':'')+'</div>';
  html+=teamCapImg(my.team.id,my.team.teamName,myD.primary||'#333',myD.secondary||'#fff');
  html+='</div>';
  html+='<div class="hero-bottom-row">';
  html+='<div class="hero-meta">'+(seriesInfo||'')+'</div>';
  html+=bottomRight;
  html+='</div></div>';
  return html;
}

async function loadTodayGame(){
  if(homeLiveTimer){clearInterval(homeLiveTimer);homeLiveTimer=null;}
  var now=new Date(),today=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');
  document.getElementById('todayGame').innerHTML='<div class="loading">Loading next game...</div>';
  try{
    var r=await fetch(MLB_BASE+'/schedule?sportId=1&date='+today+'&teamId='+activeTeam.id+'&hydrate=linescore,team,seriesStatus,gameInfo');
    var d=await r.json(),todayGames=(d.dates&&d.dates[0]&&d.dates[0].games)?d.dates[0].games:[];
    var liveGame=todayGames.find(function(g){return g.status.abstractGameState==='Live'&&g.status.detailedState!=='Warmup'&&g.status.detailedState!=='Pre-Game';});
    var upcomingToday=todayGames.find(function(g){return g.status.abstractGameState==='Preview'||g.status.abstractGameState==='Scheduled'||(g.status.abstractGameState==='Live'&&(g.status.detailedState==='Warmup'||g.status.detailedState==='Pre-Game'));});
    var gameToRender=liveGame||upcomingToday;
    if(gameToRender&&!scheduleData.length){try{var gd=new Date(gameToRender.gameDate),s7=new Date(gd);s7.setDate(gd.getDate()-7);var e7=new Date(gd);e7.setDate(gd.getDate()+7);var fmtD=function(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};var sr=await fetch(MLB_BASE+'/schedule?sportId=1&startDate='+fmtD(s7)+'&endDate='+fmtD(e7)+'&teamId='+activeTeam.id+'&hydrate=team,linescore');var srd=await sr.json();(srd.dates||[]).forEach(function(dt){dt.games.forEach(function(g){scheduleData.push(g);});});}catch(e){}}
    if(liveGame){document.getElementById('todayGame').innerHTML=renderNextGame(liveGame,'TODAY');homeLiveTimer=setInterval(loadTodayGame,TIMING.HOME_LIVE_MS);return;}
    if(upcomingToday){document.getElementById('todayGame').innerHTML=renderNextGame(upcomingToday,'TODAY');return;}
    var end=new Date();end.setDate(end.getDate()+14);
    var endStr=end.getFullYear()+'-'+String(end.getMonth()+1).padStart(2,'0')+'-'+String(end.getDate()).padStart(2,'0');
    var r2=await fetch(MLB_BASE+'/schedule?sportId=1&startDate='+today+'&endDate='+endStr+'&teamId='+activeTeam.id+'&hydrate=linescore,team,seriesStatus,gameInfo');
    var d2=await r2.json(),nextGame=null;
    for(var i=0;i<(d2.dates||[]).length;i++){var u=(d2.dates[i].games||[]).find(function(g){return g.status.abstractGameState==='Preview'||g.status.abstractGameState==='Scheduled';});if(u){nextGame=u;break;}}
    if(!nextGame){document.getElementById('todayGame').innerHTML='<div class="game-big surface-hero"><div class="card-title">NEXT GAME</div><div class="empty-state">No upcoming games found</div></div>';return;}
    var gd=new Date(nextGame.gameDate),label=gd.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}).toUpperCase();
    document.getElementById('todayGame').innerHTML=renderNextGame(nextGame,label);
  }catch(e){document.getElementById('todayGame').innerHTML='<div class="error">Could not load next game</div>';}
}

// --- NEXT SERIES CARD ---
async function loadNextGame(){
  document.getElementById('nextGame').innerHTML='<div class="loading">Loading next series...</div>';
  try{
    var now=new Date(),today=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');
    var end=new Date();end.setDate(end.getDate()+28);
    var endStr=end.getFullYear()+'-'+String(end.getMonth()+1).padStart(2,'0')+'-'+String(end.getDate()).padStart(2,'0');
    var r=await fetch(MLB_BASE+'/schedule?sportId=1&startDate='+today+'&endDate='+endStr+'&teamId='+activeTeam.id+'&hydrate=team,linescore,venue,probablePitcher');
    var d=await r.json(),allGames=[];
    (d.dates||[]).forEach(function(dt){dt.games.forEach(function(g){allGames.push(g);});});
    var seriesList=[],used=new Set();
    allGames.forEach(function(g){
      if(used.has(g.gamePk))return;
      var oppId=g.teams.home.team.id===activeTeam.id?g.teams.away.team.id:g.teams.home.team.id;
      var venueId=g.venue&&g.venue.id,gDate=new Date(g.gameDate);
      var group=allGames.filter(function(s){
        if(used.has(s.gamePk))return false;
        var sOpp=s.teams.home.team.id===activeTeam.id?s.teams.away.team.id:s.teams.home.team.id;
        var sVenue=s.venue&&s.venue.id,daysDiff=Math.abs((new Date(s.gameDate)-gDate)/86400000);
        return sOpp===oppId&&sVenue===venueId&&daysDiff<=4;
      }).sort(function(a,b){return new Date(a.gameDate)-new Date(b.gameDate);});
      group.forEach(function(s){used.add(s.gamePk);});seriesList.push(group);
    });
    var currentIdx=-1;
    for(var i=0;i<seriesList.length;i++){if(seriesList[i].some(function(g){return g.status.abstractGameState!=='Final';})){currentIdx=i;break;}}
    var nextSeries=currentIdx>=0&&currentIdx+1<seriesList.length?seriesList[currentIdx+1]:null;
    if(!nextSeries||!nextSeries.length){document.getElementById('nextGame').innerHTML='<div class="game-big surface-hero"><div class="card-title">NEXT SERIES</div><div class="empty-state">No upcoming series found</div></div>';return;}
    var first=nextSeries[0],teamHome=first.teams.home.team.id===activeTeam.id,oppTeam=teamHome?first.teams.away.team:first.teams.home.team;
    var oppD=TEAMS.find(function(t){return t.id===oppTeam.id;})||{};
    var oppPrimary=oppD.primary||'#333',oppSecondary=oppD.secondary||'#fff';
    var d1=new Date(nextSeries[0].gameDate),d2=new Date(nextSeries[nextSeries.length-1].gameDate);
    var dateRange=d1.toLocaleDateString('en-US',{month:'short',day:'numeric'}).toUpperCase();
    if(nextSeries.length>1)dateRange+=' — '+d2.toLocaleDateString('en-US',{month:'short',day:'numeric'}).toUpperCase();
    var venue=first.venue&&first.venue.name?first.venue.name:'';
    var numGames=nextSeries.length;
    var html='<div class="game-big surface-hero has-ghost">';
    html+=teamCapImg(oppTeam.id,oppTeam.teamName,oppSecondary,oppPrimary,'series-ghost');
    html+='<div class="hero-content">';
    html+='<div class="hero-top-row">';
    html+='<div class="eyebrow eyebrow--accent">NEXT SERIES</div>';
    html+='<div class="hero-meta-right">'+dateRange+'</div></div>';
    html+='<div class="hero-opp-row">';
    html+=teamCapImg(oppTeam.id,oppTeam.teamName,oppPrimary,oppSecondary);
    html+='<div><div class="eyebrow">'+(teamHome?'VS':'AT')+'</div>';
    html+='<div class="hero-opp-name">'+oppTeam.teamName.toUpperCase()+'</div>';
    html+='<div class="hero-opp-meta">'+(venue?venue+' · ':'')+numGames+' game'+(teamHome?' home series':' road series')+'</div>';
    html+='</div></div>';
    html+='<div class="hero-day-strip">';
    nextSeries.forEach(function(g){
      var status=g.status.abstractGameState,gDate=new Date(g.gameDate);
      var dayLabel=gDate.toLocaleDateString('en-US',{weekday:'short'}).toUpperCase();
      var myT=g.teams.home.team.id===activeTeam.id?g.teams.home:g.teams.away,oppT=g.teams.home.team.id===activeTeam.id?g.teams.away:g.teams.home;
      html+='<div class="hero-day-cell">';
      html+='<div class="hero-day-label">'+dayLabel+'</div>';
      if(status==='Final'){var w=myT.isWinner;html+='<span class="badge '+(w?'badge-w':'badge-l')+'" style="font-size:.62rem">'+(w?'W':'L')+' '+myT.score+'-'+oppT.score+'</span>';}
      else if(status==='Live'){html+='<div class="hero-day-live"><span class="matchup-live-dot"></span>LIVE</div><div class="hero-day-score">'+myT.score+'-'+oppT.score+'</div>';}
      else{html+='<div class="hero-day-time">'+gDate.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})+'</div>';}
      html+='</div>';
    });
    html+='</div></div></div>';
    document.getElementById('nextGame').innerHTML=html;
  }catch(e){document.getElementById('nextGame').innerHTML='<div class="error">Could not load next series</div>';}
}

var calMonth=new Date().getMonth(),calYear=new Date().getFullYear(),selectedGamePk=null;

async function loadSchedule(){
  document.getElementById('calGrid').innerHTML='<div class="loading">Loading schedule...</div>';
  document.getElementById('scheduleTitle').innerHTML=SEASON+' '+activeTeam.short+' Schedule <button class="refresh-btn" onclick="loadSchedule()">↻ Refresh</button>';
  try{
    var r=await fetch(MLB_BASE+'/schedule?sportId=1&season='+SEASON+'&teamId='+activeTeam.id+'&hydrate=team,linescore,game,probablePitcher');
    var d=await r.json();scheduleData=[];
    (d.dates||[]).forEach(function(dt){dt.games.forEach(function(g){scheduleData.push(g);});});
    scheduleLoaded=true;calMonth=new Date().getMonth();calYear=new Date().getFullYear();renderCalendar();
  }catch(e){document.getElementById('calGrid').innerHTML='<div class="error">Could not load schedule</div>';}
}

function changeMonth(dir){calMonth+=dir;if(calMonth>11){calMonth=0;calYear++;}if(calMonth<0){calMonth=11;calYear--;}selectedGamePk=null;document.getElementById('gameDetail').innerHTML='';renderCalendar();}

function renderCalendar(){
  var months=['January','February','March','April','May','June','July','August','September','October','November','December'];
  document.getElementById('calMonthLabel').textContent=months[calMonth]+' '+calYear;
  var days=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],today=new Date(),firstDay=new Date(calYear,calMonth,1).getDay(),daysInMonth=new Date(calYear,calMonth+1,0).getDate();
  var gamesByDate={};scheduleData.forEach(function(g){var _d=new Date(g.gameDate),ds=_d.getFullYear()+'-'+String(_d.getMonth()+1).padStart(2,'0')+'-'+String(_d.getDate()).padStart(2,'0');if(!gamesByDate[ds])gamesByDate[ds]=[];gamesByDate[ds].push(g);});
  Object.keys(gamesByDate).forEach(function(ds){gamesByDate[ds].sort(function(a,b){return a.gamePk-b.gamePk;});});
  var html='<div class="cal-grid">';
  days.forEach(function(d){html+='<div class="cal-header">'+d+'</div>';});
  for(var i=0;i<firstDay;i++)html+='<div class="cal-day empty"></div>';
  for(var day=1;day<=daysInMonth;day++){
    var ds=calYear+'-'+String(calMonth+1).padStart(2,'0')+'-'+String(day).padStart(2,'0'),dayGames=gamesByDate[ds]||[];
    var isToday=today.getFullYear()===calYear&&today.getMonth()===calMonth&&today.getDate()===day;
    var isSelected=dayGames.some(function(gm){return gm.gamePk===selectedGamePk;});
    var isDH=dayGames.length>1;
    var classes='cal-day'+(dayGames.length?' has-game':'')+(isToday?' today':'')+(isSelected?' selected':'');
    var onclick=dayGames.length?'onclick="selectCalGame('+dayGames[0].gamePk+',event)"':'';
    var inner='<div class="cal-day-num">'+day+'</div>';
    if(dayGames.length){
      var g0=dayGames[0],home0=g0.teams.home,away0=g0.teams.away,teamHome=home0.team.id===activeTeam.id,opp0=teamHome?away0:home0;
      inner+='<div class="cal-game-info"><div class="cal-opp" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><span class="cal-ha">'+(teamHome?'vs ':'@ ')+'</span>'+opp0.team.teamName+(isDH?' <span style="font-size:.55rem;font-weight:700;color:var(--accent);letter-spacing:.04em">DH</span>':'')+'</div>';
      var dotW=false,dotL=false,dotLive=false,dotPPD=false;
      dayGames.forEach(function(gm,idx){
        var myT=gm.teams.home.team.id===activeTeam.id?gm.teams.home:gm.teams.away;
        var opT=gm.teams.home.team.id===activeTeam.id?gm.teams.away:gm.teams.home;
        var st=gm.status.abstractGameState,dtl=gm.status.detailedState||'';
        var ppd=dtl==='Postponed'||dtl==='Cancelled'||dtl==='Suspended';
        var calLive=st==='Live'&&dtl!=='Warmup'&&dtl!=='Pre-Game';
        var wrap=isDH?'<div onclick="event.stopPropagation();selectCalGame('+gm.gamePk+',event)" style="cursor:pointer;display:flex;align-items:center;gap:3px;margin-top:2px"><span style="font-size:.6rem;color:var(--muted);flex-shrink:0">G'+(idx+1)+':</span>':'';
        var wrapEnd=isDH?'</div>':'';
        if(ppd){
          dotPPD=true;
          inner+=wrap+'<span class="cal-result" style="background:rgba(150,150,150,.15);color:var(--muted);border:1px solid rgba(150,150,150,.4)'+(isDH?';font-size:.6rem;padding:1px 5px':'')+'">PPD</span>'+wrapEnd;
        } else if(st==='Final'){
          var mW=myT.isWinner,sc=(myT.score!=null&&opT.score!=null)?myT.score+'-'+opT.score:'?-?';
          inner+=wrap+'<span class="cal-result '+(mW?'cal-w':'cal-l')+'"'+(isDH?' style="font-size:.6rem;padding:1px 5px"':'')+'>'+(mW?'W':'L')+' '+sc+'</span>'+wrapEnd;
          if(mW)dotW=true;else dotL=true;
        } else if(calLive){
          var sc=(myT.score!=null&&opT.score!=null)?myT.score+'-'+opT.score:'?-?';
          inner+=wrap+'<span class="cal-result" style="background:rgba(100,100,120,.12);color:rgba(255,255,255,.6);border:1px solid rgba(255,255,255,.2)'+(isDH?';font-size:.6rem;padding:1px 5px':'')+'">LIVE '+sc+'</span>'+wrapEnd;
          dotLive=true;
        } else {
          var t=new Date(gm.gameDate),ts=t.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
          inner+=wrap+(isDH?'<span style="font-size:.65rem;color:var(--accent)">'+ts+'</span>':'<div class="cal-upcoming">'+ts+'</div>')+wrapEnd;
        }
      });
      inner+='</div>';
      var dotCls='cal-dot '+(dotLive?'cal-dot-live':(dotW&&!dotL)?'cal-dot-w':(!dotW&&dotL)?'cal-dot-l':(dotPPD&&!dotW&&!dotL)?'cal-dot-ppd':'cal-dot-up');
      inner+='<span class="'+dotCls+'"></span>';
    }
    html+='<div class="'+classes+'" '+onclick+'>'+inner+'</div>';
  }
  html+='</div>';document.getElementById('calGrid').innerHTML=html;
}

function switchBoxTab(bsId,side){
  var other=side==='away'?'home':'away';
  document.getElementById(bsId+'_'+side).style.display='block';document.getElementById(bsId+'_'+other).style.display='none';
  document.getElementById(bsId+'_'+side+'_btn').classList.add('is-active');
  document.getElementById(bsId+'_'+other+'_btn').classList.remove('is-active');
}
function buildBoxscore(players){
  var hitters=[],pitchers=[];
  Object.values(players).forEach(function(p){var bat=p.stats&&p.stats.batting,pit=p.stats&&p.stats.pitching;if(bat&&bat.atBats>0)hitters.push({name:p.person.fullName,order:p.battingOrder||999,ab:bat.atBats,h:bat.hits,r:bat.runs,rbi:bat.rbi,bb:bat.baseOnBalls,k:bat.strikeOuts,hr:bat.homeRuns});if(pit&&(parseFloat(pit.inningsPitched||0)>0||pit.outs>0))pitchers.push({name:p.person.fullName,ip:pit.inningsPitched||'0.0',h:pit.hits,r:pit.runs,er:pit.earnedRuns,bb:pit.baseOnBalls,k:pit.strikeOuts,hr:pit.homeRuns,pc:pit.numberOfPitches||'—'});});
  hitters.sort(function(a,b){return a.order-b.order;});
  var t='<div style="margin-bottom:12px"><div style="font-size:.68rem;font-weight:700;text-transform:uppercase;color:var(--accent);margin-bottom:6px">Batting</div>';
  t+='<div style="overflow-x:auto"><table class="linescore-table"><thead><tr><th style="text-align:left;min-width:130px">Player</th><th>AB</th><th>H</th><th>R</th><th>RBI</th><th>BB</th><th>K</th><th>HR</th></tr></thead><tbody>';
  if(!hitters.length)t+='<tr><td colspan="8" style="color:var(--muted)">No data</td></tr>';
  hitters.forEach(function(p){t+='<tr><td style="text-align:left">'+p.name+'</td><td>'+p.ab+'</td><td>'+p.h+'</td><td>'+p.r+'</td><td>'+p.rbi+'</td><td>'+p.bb+'</td><td>'+p.k+'</td><td>'+p.hr+'</td></tr>';});
  t+='</tbody></table></div><div style="font-size:.68rem;font-weight:700;text-transform:uppercase;color:var(--accent);margin:10px 0 6px">Pitching</div>';
  t+='<div style="overflow-x:auto"><table class="linescore-table"><thead><tr><th style="text-align:left;min-width:130px">Player</th><th>IP</th><th>H</th><th>R</th><th>ER</th><th>BB</th><th>K</th><th>HR</th><th>PC</th></tr></thead><tbody>';
  if(!pitchers.length)t+='<tr><td colspan="9" style="color:var(--muted)">No data</td></tr>';
  pitchers.forEach(function(p){t+='<tr><td style="text-align:left">'+p.name+'</td><td>'+p.ip+'</td><td>'+p.h+'</td><td>'+p.r+'</td><td>'+p.er+'</td><td>'+p.bb+'</td><td>'+p.k+'</td><td>'+p.hr+'</td><td>'+p.pc+'</td></tr>';});
  return t+'</tbody></table></div></div>';
}

async function selectCalGame(gamePk,evt){
  var cellRect=evt?evt.currentTarget.getBoundingClientRect():null;
  selectedGamePk=gamePk;renderCalendar();
  var g=scheduleData.find(function(x){return x.gamePk===gamePk;});if(!g)return;
  // Find all games on same local date (DH support)
  var ds=localDateStr(new Date(g.gameDate));
  var dayGames=scheduleData.filter(function(x){return localDateStr(new Date(x.gameDate))===ds;}).sort(function(a,b){return a.gamePk-b.gamePk;});
  var isDH=dayGames.length>1;
  if(cellRect&&window.innerWidth<=480){
    var home=g.teams.home,away=g.teams.away,teamHome=home.team.id===activeTeam.id;
    var opp=teamHome?away:home,myT=teamHome?home:away,status=g.status.abstractGameState;
    var isPostponed=g.status.detailedState==='Postponed'||g.status.detailedState==='Cancelled'||g.status.detailedState==='Suspended';
    var gameDate=new Date(g.gameDate);
    var dateStr=gameDate.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})+(isDH?' · DH':'');
    var badgeHtml='';
    if(isPostponed)badgeHtml='<span class="cal-result" style="background:rgba(150,150,150,.15);color:var(--muted);border:1px solid rgba(150,150,150,.4)">PPD</span>';
    else if(status==='Final'){var mW=myT.isWinner,sc=(myT.score!=null&&opp.score!=null)?myT.score+'-'+opp.score:'?-?';badgeHtml='<span class="cal-result '+(mW?'cal-w':'cal-l')+'">'+(mW?'W':'L')+' '+sc+'</span>';}
    else if(status==='Live'){var sc=(myT.score!=null&&opp.score!=null)?myT.score+'-'+opp.score:'?-?';badgeHtml='<span class="cal-result" style="background:rgba(100,100,120,.12);color:rgba(255,255,255,.6);border:1px solid rgba(255,255,255,.2)">● LIVE '+sc+'</span>';}
    else badgeHtml='<span style="font-size:.8rem;color:var(--accent)">'+gameDate.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})+'</span>';
    var tt=document.getElementById('calTooltip');
    tt.innerHTML='<div class="cal-tt-opp">'+(teamHome?'vs ':'@ ')+opp.team.teamName+'</div><div class="cal-tt-date">'+dateStr+'</div>'+badgeHtml;
    var ttW=190,left=cellRect.left+cellRect.width/2-ttW/2;
    left=Math.max(8,Math.min(left,window.innerWidth-ttW-8));
    tt.style.cssText='left:'+left+'px;top:'+(cellRect.top-8)+'px;transform:translateY(-100%);min-width:'+ttW+'px';
    tt.classList.add('open');
  }
  var detail=document.getElementById('gameDetail');
  detail.innerHTML='<div class="loading">Loading game details...</div>';
  try{
    var panels=await Promise.all(dayGames.map(function(gm,idx){return buildGameDetailPanel(gm,isDH?idx+1:null);}));
    detail.innerHTML=panels.join('');
    detail.scrollIntoView({behavior:'smooth',block:'nearest'});
  }catch(e){detail.innerHTML='<div class="error">Could not load game details</div>';}
}

function playHighlightVideo(el,url){
  stopAllMedia('highlight');
  var video=document.createElement('video');
  video.controls=true;video.style.cssText='width:100%;display:block;background:#000';
  video.addEventListener('error',function(e){
    console.error('Video load error:',e,video.error);
    video.innerHTML='<div style="color:#e03030;padding:20px;text-align:center">Video failed to load. Please try refreshing.</div>';
  });
  video.addEventListener('canplay',function(){
    if(DEBUG) console.log('Video ready to play');
    video.play().catch(function(err){console.error('Autoplay blocked:',err);});
  },{once:true});
  var src=document.createElement('source');src.src=url;src.type='video/mp4';video.appendChild(src);
  el.replaceWith(video);
}
async function buildGameDetailPanel(g,gameNum){
  var home=g.teams.home,away=g.teams.away,gameDate=new Date(g.gameDate);
  var status=g.status.abstractGameState,detailed=g.status.detailedState||'';
  var isPostponed=detailed==='Postponed'||detailed==='Cancelled'||detailed==='Suspended';
  var sep=gameNum>1?'<div class="detail-separator"></div>':'';
  var label=gameNum?'<div class="detail-game-label">Game '+gameNum+'</div>':'';
  var title=away.team.teamName+' @ '+home.team.teamName;
  if(isPostponed){
    var html=sep+'<div class="boxscore-wrap">'+label+'<div class="boxscore-title">'+title+' &nbsp;·&nbsp; '+gameDate.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'})+'</div>';
    html+='<div class="game-notes-grid"><div class="game-note-box"><div class="game-note-label">Status</div><div class="game-note-val is-muted">'+detailed+'</div></div>';
    html+='<div class="game-note-box"><div class="game-note-label">Venue</div><div class="game-note-val">'+(g.venue&&g.venue.name?g.venue.name:'TBD')+'</div></div></div></div>';
    return html;
  }
  if(status!=='Final'&&status!=='Live'){
    var html=sep+'<div class="boxscore-wrap">'+label+'<div class="boxscore-title">'+title+' &nbsp;·&nbsp; '+gameDate.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})+' '+gameDate.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})+'</div>';
    html+='<div class="game-notes-grid"><div class="game-note-box"><div class="game-note-label">Location</div><div class="game-note-val">'+(g.venue&&g.venue.name?g.venue.name:'TBD')+'</div></div>';
    var awayPP=(away.probablePitcher&&away.probablePitcher.fullName)?away.probablePitcher.fullName:'TBD',homePP=(home.probablePitcher&&home.probablePitcher.fullName)?home.probablePitcher.fullName:'TBD';
    html+='<div class="game-note-box"><div class="game-note-label">Probable Pitchers</div><div class="game-note-val">'+away.team.teamName+': '+awayPP+'</div><div class="game-note-val">'+home.team.teamName+': '+homePP+'</div></div></div></div>';
    return html;
  }
  if(status==='Live'){
    var ls=g.linescore||{},half=ls.inningHalf||'Top',inn=ls.currentInning||'?';
    var aScore=away.score!=null?away.score:0,hScore=home.score!=null?home.score:0;
    var html=sep+'<div class="boxscore-wrap">'+label+'<div class="boxscore-title">'+title+' &nbsp;·&nbsp; '+gameDate.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})+'</div>';
    html+='<div class="game-notes-grid"><div class="game-note-box"><div class="game-note-label">Score</div><div class="game-note-val">'+away.team.teamName+' '+aScore+', '+home.team.teamName+' '+hScore+'</div></div>';
    html+='<div class="game-note-box"><div class="game-note-label">Status</div><div class="game-note-val"><span class="live-indicator">● LIVE</span> · '+half+' '+inn+'</div></div></div>';
    html+='<button onclick="showLiveGame('+g.gamePk+')" class="watch-live-btn">▶ Watch Live</button></div>';
    return html;
  }
  // Final — fetch linescore + boxscore + content (highlights)
  var responses=await Promise.all([fetch(MLB_BASE+'/game/'+g.gamePk+'/linescore'),fetch(MLB_BASE+'/game/'+g.gamePk+'/boxscore'),fetch(MLB_BASE+'/game/'+g.gamePk+'/content')]);
  var ls=await responses[0].json(),bs=await responses[1].json(),content=await responses[2].json();
  var highlight=content.highlights&&content.highlights.highlights&&content.highlights.highlights.items&&content.highlights.highlights.items[0]?content.highlights.highlights.items[0]:null;
  var highlightUrl=highlight?pickPlayback(highlight.playbacks):null;
  var thumbCuts=highlight&&highlight.image&&highlight.image.cuts?highlight.image.cuts:[];
  var thumbCut=thumbCuts.find(function(c){return c.width>=640&&c.width<=960;})||thumbCuts[thumbCuts.length-1]||null;
  var thumbUrl=thumbCut?thumbCut.src:null;
  var html=sep+'<div class="final-game-grid">';
  // TOP-LEFT: Linescore + Video
  html+='<div class="boxscore-wrap"><div class="boxscore-title">'+title+' &nbsp;·&nbsp; '+gameDate.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'})+'</div>';
  var innings=ls.innings||[];
  html+='<div class="linescore-scroll"><table class="linescore-table"><thead><tr><th></th>';
  innings.forEach(function(inn){html+='<th>'+inn.num+'</th>';});
  html+='<th class="rhe-start">R</th><th>H</th><th>E</th></tr></thead><tbody>';
  html+='<tr><td>'+away.team.teamName+'</td>';innings.forEach(function(inn){html+='<td>'+(inn.away&&inn.away.runs!=null?inn.away.runs:'—')+'</td>';});
  html+='<td class="rhe rhe-start">'+(ls.teams&&ls.teams.away&&ls.teams.away.runs!=null?ls.teams.away.runs:'—')+'</td><td class="rhe">'+(ls.teams&&ls.teams.away&&ls.teams.away.hits!=null?ls.teams.away.hits:'—')+'</td><td class="rhe">'+(ls.teams&&ls.teams.away&&ls.teams.away.errors!=null?ls.teams.away.errors:'—')+'</td></tr>';
  html+='<tr><td>'+home.team.teamName+'</td>';innings.forEach(function(inn){html+='<td>'+(inn.home&&inn.home.runs!=null?inn.home.runs:'—')+'</td>';});
  html+='<td class="rhe rhe-start">'+(ls.teams&&ls.teams.home&&ls.teams.home.runs!=null?ls.teams.home.runs:'—')+'</td><td class="rhe">'+(ls.teams&&ls.teams.home&&ls.teams.home.hits!=null?ls.teams.home.hits:'—')+'</td><td class="rhe">'+(ls.teams&&ls.teams.home&&ls.teams.home.errors!=null?ls.teams.home.errors:'—')+'</td></tr>';
  html+='</tbody></table></div>';
  // Video below linescore
  if(highlightUrl){
    var highlightHeadline=highlight.headline||'Full Game Highlight';
    var safeUrl=highlightUrl.replace(/'/g,"\\'");
    html+='<div class="detail-highlight">';
    if(thumbUrl){
      html+='<div onclick="playHighlightVideo(this,\''+safeUrl+'\')" class="detail-highlight-thumb">';
      html+='<img src="'+thumbUrl+'" loading="lazy">';
      html+='<div class="detail-highlight-overlay">';
      html+='<div class="detail-highlight-play">';
      html+='<span class="detail-highlight-arrow">▶</span></div></div></div>';
    }else{
      html+='<div class="detail-highlight-video"><video controls preload="none"><source src="'+highlightUrl+'" type="video/mp4"></video></div>';
    }
    html+='<div class="detail-highlight-meta"><div class="detail-highlight-kicker">Highlights</div><div class="detail-highlight-title">'+highlightHeadline+'</div></div>';
    html+='</div>';
  }
  html+='</div>';
  // TOP-RIGHT: Active team stats
  var awayAbbr=away.team.abbreviation||away.team.teamName,homeAbbr=home.team.abbreviation||home.team.teamName;
  var isHomeActive=activeTeam.id===home.team.id,activeAbbr=isHomeActive?homeAbbr:awayAbbr,activeTeamName=isHomeActive?home.team.teamName:away.team.teamName;
  var activePlayers=isHomeActive?(bs.teams&&bs.teams.home&&bs.teams.home.players?bs.teams.home.players:{}):(bs.teams&&bs.teams.away&&bs.teams.away.players?bs.teams.away.players:{});
  var activeBox=buildBoxscore(activePlayers);
  html+='<div class="boxscore-wrap"><div class="detail-team-header">'+activeTeamName+'</div>';
  html+=activeBox+'</div>';
  // BOTTOM-LEFT: Game summary
  if(bs.info&&bs.info.length){
    html+='<div class="boxscore-wrap"><div class="game-note-label">Game Summary</div>';
    bs.info.forEach(function(item){if(!item.value)return;var val=item.value.replace(/\.$/,'').trim();if(!item.label)html+='<div class="detail-summary-note">'+val+'</div>';else html+='<div class="detail-summary-row"><span class="detail-summary-label">'+item.label+'</span><span>'+val+'</span></div>';});
    html+='</div>';
  }
  // BOTTOM-RIGHT: Opposition team stats
  var oppPlayers=isHomeActive?(bs.teams&&bs.teams.away&&bs.teams.away.players?bs.teams.away.players:{}):(bs.teams&&bs.teams.home&&bs.teams.home.players?bs.teams.home.players:{});
  var oppBox=buildBoxscore(oppPlayers),oppTeamName=isHomeActive?away.team.teamName:home.team.teamName;
  html+='<div class="boxscore-wrap"><div class="detail-team-header">'+oppTeamName+'</div>';
  html+=oppBox+'</div>';
  html+='</div>';
  return html;
}

async function loadStandings(){
  document.getElementById('nlEast').innerHTML='<div class="loading">Loading...</div>';
  try{
    var r=await fetch(MLB_BASE+'/standings?leagueId=103,104&standingsTypes=regularSeason&hydrate=team,division,league');
    var d=await r.json(),divMap={};
    (d.records||[]).forEach(function(rec){divMap[rec.division.id]={name:rec.division.name,league:rec.league.name,teams:rec.teamRecords};});
    renderDivStandings(divMap);renderNLWC(divMap);renderOtherDivWC(divMap);renderFullStandings(divMap);renderHomeStandings(divMap);
    document.getElementById('divTitle').textContent='🔥 '+activeTeam.division;
    document.getElementById('wcTitle').textContent='🃏 '+activeTeam.league+' Wild Card Race';
    document.getElementById('otherDivWCTitle').textContent='🃏 '+(activeTeam.league==='NL'?'AL':'NL')+' Wild Card Race';
    document.getElementById('homeDivTitle').textContent=activeTeam.division+' Snapshot';
  }catch(e){['nlEast','nlWC','otherDivWC','fullStandings','homeStandings'].forEach(function(id){var el=document.getElementById(id);if(el)el.innerHTML='<div class="error">Could not load standings</div>';});}
}

function standingsTable(teams){
  var html='<table class="standings-table"><thead><tr><th>#</th><th>Team</th><th>W</th><th>L</th><th>PCT</th><th>GB</th></tr></thead><tbody>';
  teams.forEach(function(t,i){var isActive=t.team.id===activeTeam.id;html+='<tr class="'+(isActive?'active-row':'')+'"><td>'+(i+1)+'</td><td><strong>'+t.team.teamName+'</strong></td><td>'+t.wins+'</td><td>'+t.losses+'</td><td>'+t.winningPercentage+'</td><td>'+t.gamesBack+'</td></tr>';});
  return html+'</tbody></table>';
}
function renderDivStandings(divMap){var f=Object.values(divMap).find(function(d){return d.name===activeTeam.division;});document.getElementById('nlEast').innerHTML=f?standingsTable(f.teams):'<div class="error">Division not found</div>';}
function renderNLWC(divMap){
  var league=activeTeam.league==='NL'?'National League':'American League';
  var leagueDivs=Object.values(divMap).filter(function(d){return d.league===league;});
  var leaders=new Set(leagueDivs.map(function(d){return d.teams[0]&&d.teams[0].team.id;}));
  var allLeague=[];leagueDivs.forEach(function(d){allLeague=allLeague.concat(d.teams);});
  var wc=allLeague.filter(function(t){return!leaders.has(t.team.id);}).sort(function(a,b){return parseFloat(b.winningPercentage)-parseFloat(a.winningPercentage);}).slice(0,9);
  var top=wc[0],topW=top?top.wins:0,topL=top?top.losses:0;
  var html='<table class="standings-table"><thead><tr><th>#</th><th>Team</th><th>W</th><th>L</th><th>PCT</th><th>GB</th></tr></thead><tbody>';
  wc.forEach(function(t,i){var isActive=t.team.id===activeTeam.id,gb=i===0?'—':(((topW-t.wins)+(t.losses-topL))/2).toFixed(1),cls=(isActive?'active-row':'')+(i===WC_SPOTS-1?' wc-cutoff-row':'');html+='<tr class="'+cls.trim()+'"><td>'+(i+1)+'</td><td><strong>'+t.team.teamName+'</strong></td><td>'+t.wins+'</td><td>'+t.losses+'</td><td>'+t.winningPercentage+'</td><td>'+gb+'</td></tr>';});
  html+='</tbody></table><div class="wc-cutoff-label">Wild Card cutoff</div>';
  document.getElementById('nlWC').innerHTML=html;
}
function renderOtherDivWC(divMap){
  var otherLeague=activeTeam.league==='NL'?'American League':'National League';
  var leagueDivs=Object.values(divMap).filter(function(d){return d.league===otherLeague;});
  var leaders=new Set(leagueDivs.map(function(d){return d.teams[0]&&d.teams[0].team.id;}));
  var teams=[];leagueDivs.forEach(function(d){d.teams.forEach(function(t){if(!leaders.has(t.team.id))teams.push(t);});});
  teams.sort(function(a,b){return parseFloat(b.winningPercentage)-parseFloat(a.winningPercentage);});
  var top=teams[0],topW=top?top.wins:0,topL=top?top.losses:0;
  var html='<table class="standings-table"><thead><tr><th>#</th><th>Team</th><th>W</th><th>L</th><th>PCT</th><th>GB</th></tr></thead><tbody>';
  teams.slice(0,9).forEach(function(t,i){var gb=i===0?'—':(((topW-t.wins)+(t.losses-topL))/2).toFixed(1),cls=i===WC_SPOTS-1?'wc-cutoff-row':'';html+='<tr class="'+cls+'"><td>'+(i+1)+'</td><td><strong>'+t.team.teamName+'</strong></td><td>'+t.wins+'</td><td>'+t.losses+'</td><td>'+t.winningPercentage+'</td><td>'+gb+'</td></tr>';});
  html+='</tbody></table><div class="wc-cutoff-label">Wild Card cutoff</div>';
  document.getElementById('otherDivWC').innerHTML=html;
}
function renderFullStandings(divMap){
  var al=Object.values(divMap).filter(function(d){return d.league==='American League';}),nl=Object.values(divMap).filter(function(d){return d.league==='National League';});
  var isNL=activeTeam.league==='NL',primary=isNL?nl:al,secondary=isNL?al:nl;
  var primarySorted=primary.slice().sort(function(a,b){return a.name===activeTeam.division?-1:b.name===activeTeam.division?1:0;});
  var html='';
  primarySorted.concat(secondary).forEach(function(div){
    if(div.name===activeTeam.division)return;
    html+='<div class="div-header">'+div.name+'</div><table class="standings-table"><thead><tr><th>Team</th><th>W</th><th>L</th><th>PCT</th><th>GB</th></tr></thead><tbody>';
    div.teams.forEach(function(t){var isActive=t.team.id===activeTeam.id;html+='<tr class="'+(isActive?'active-row':'')+'"><td><strong>'+t.team.teamName+'</strong></td><td>'+t.wins+'</td><td>'+t.losses+'</td><td>'+t.winningPercentage+'</td><td>'+t.gamesBack+'</td></tr>';});
    html+='</tbody></table>';
  });
  document.getElementById('fullStandings').innerHTML=html;
}
function renderHomeStandings(divMap){
  var f=Object.values(divMap).find(function(d){return d.name===activeTeam.division;});
  if(!f){document.getElementById('homeStandings').innerHTML='<div class="error">No data</div>';return;}
  var html='<table class="standings-table"><thead><tr><th>Team</th><th>W</th><th>L</th><th>GB</th></tr></thead><tbody>';
  f.teams.forEach(function(t){var isActive=t.team.id===activeTeam.id;html+='<tr class="'+(isActive?'active-row':'')+'"><td><strong>'+t.team.teamName+'</strong></td><td>'+t.wins+'</td><td>'+t.losses+'</td><td>'+t.gamesBack+'</td></tr>';});
  document.getElementById('homeStandings').innerHTML=html+'</tbody></table>';
}

function selectLeaderPill(group,stat,btn){var selId=group==='hitting'?'hitLeaderStat':'pitLeaderStat';var sel=document.getElementById(selId);if(sel)sel.value=stat;var pillsId=group==='hitting'?'hitLeaderPills':'pitLeaderPills';document.getElementById(pillsId).querySelectorAll('.leader-pill').forEach(function(b){b.classList.remove('active');});btn.classList.add('active');loadLeaders();}
function switchLeaderTab(tab,btn){currentLeaderTab=tab;document.querySelectorAll('.stat-tabs button').forEach(function(b){b.classList.remove('active');});btn.classList.add('active');document.getElementById('hitLeaderStat').style.display=tab==='hitting'?'block':'none';document.getElementById('pitLeaderStat').style.display=tab==='pitching'?'block':'none';document.getElementById('hitLeaderPills').style.display=tab==='hitting'?'flex':'none';document.getElementById('pitLeaderPills').style.display=tab==='pitching'?'flex':'none';loadLeaders();}
function loadLeaders(){
  var group=currentLeaderTab,stat=group==='hitting'?document.getElementById('hitLeaderStat').value:document.getElementById('pitLeaderStat').value,data=statsCache[group];
  if(!data||!data.length){document.getElementById('leaderList').innerHTML='<div style="color:var(--muted);padding:12px;font-size:.85rem">Stats still loading...</div>';return;}
  var isAsc=['era','whip','walksAndHitsPerInningPitched'].indexOf(stat)>-1;
  var sorted=data.filter(function(s){return s.stat[stat]!=null&&s.stat[stat]!=='';}).slice().sort(function(a,b){return isAsc?parseFloat(a.stat[stat])-parseFloat(b.stat[stat]):parseFloat(b.stat[stat])-parseFloat(a.stat[stat]);}).slice(0,10);
  if(!sorted.length){document.getElementById('leaderList').innerHTML='<div style="color:var(--muted);padding:12px;font-size:.85rem">No data for this stat yet</div>';return;}
  var html='';
  sorted.forEach(function(s,i){var val=parseFloat(s.stat[stat]),display=val<1&&val>0?val.toFixed(3).slice(1):Number.isInteger(val)?val:val.toFixed(2);html+='<div class="player-item" onclick="selectPlayer('+s.player.id+',\''+group+'\')">'+'<div style="display:flex;align-items:center;gap:10px"><span style="color:var(--accent);font-weight:800;width:18px;font-size:.85rem">'+(i+1)+'</span><div><div class="player-name" style="font-size:.85rem">'+(s.player.fullName||'—')+'</div><div class="player-pos">'+(s.position&&s.position.abbreviation?s.position.abbreviation:'')+'</div></div></div><div style="font-size:1.1rem;font-weight:800;color:var(--accent)">'+display+'</div></div>';});
  document.getElementById('leaderList').innerHTML=html;
}
async function fetchAllPlayerStats(){
  var groups=['hitting','pitching'];
  for(var gi=0;gi<groups.length;gi++){
    var group=groups[gi],players=group==='hitting'?rosterData.hitting:rosterData.pitching;if(!players.length)continue;
    var results=await Promise.all(players.map(async function(p){try{var r=await fetch(MLB_BASE+'/people/'+p.person.id+'/stats?stats=season&season='+SEASON+'&group='+group);var d=await r.json();var stat=d.stats&&d.stats[0]&&d.stats[0].splits&&d.stats[0].splits[0]&&d.stats[0].splits[0].stat;if(!stat)return null;return{player:p.person,position:p.position,stat:stat};}catch(e){return null;}}));
    statsCache[group]=results.filter(function(x){return x!==null;});
  }
  loadLeaders();
}
async function loadRoster(){
  document.getElementById('playerList').innerHTML='<div class="loading">Loading players...</div>';
  document.getElementById('rosterTitle').textContent=SEASON+' '+activeTeam.short+' Players';
  try{
    var r=await fetch(MLB_BASE+'/teams/'+activeTeam.id+'/roster?rosterType=40Man&season='+SEASON+'&hydrate=person');
    var d=await r.json(),roster=d.roster||[];
    rosterData.hitting=roster.filter(function(p){return p.position&&['P','TWP'].indexOf(p.position.abbreviation)===-1;});
    rosterData.pitching=roster.filter(function(p){return p.position&&(p.position.abbreviation==='P'||p.position.abbreviation==='TWP');});
    rosterData.fielding=rosterData.hitting.slice();renderPlayerList();fetchAllPlayerStats();
    if(rosterData.hitting.length)selectPlayer(rosterData.hitting[0].person.id,'hitting');
  }catch(e){document.getElementById('playerList').innerHTML='<div class="error">Could not load players</div>';}
}
function renderPlayerList(){
  var players=rosterData[currentRosterTab]||[];if(!players.length){document.getElementById('playerList').innerHTML='<div class="loading">No players found</div>';return;}
  var html='';
  players.forEach(function(p){var sel=selectedPlayer&&selectedPlayer.person&&selectedPlayer.person.id===p.person.id;html+='<div class="player-item'+(sel?' selected':'')+'" onclick="selectPlayer('+p.person.id+',\''+currentRosterTab+'\')">'+'<div><div class="player-name">'+p.person.fullName+'</div><div class="player-pos">#'+(p.jerseyNumber||'—')+' · '+(p.position&&p.position.name?p.position.name:'—')+'</div></div><span class="player-chevron">›</span></div>';});
  document.getElementById('playerList').innerHTML=html;
}
function switchRosterTab(tab,btn){currentRosterTab=tab;selectedPlayer=null;document.querySelectorAll('.stat-tab').forEach(function(b){b.classList.remove('active');});btn.classList.add('active');var players=rosterData[tab]||[];if(players.length)selectPlayer(players[0].person.id,tab);else{renderPlayerList();document.getElementById('playerStatsTitle').textContent='Player Stats';document.getElementById('playerStats').innerHTML='<div class="empty-state">No players available</div>';}}
async function selectPlayer(id,type){
  var playerObj=(rosterData[type]||[]).find(function(p){return p.person.id===id;})||{person:{id:id}};
  selectedPlayer=playerObj;renderPlayerList();
  document.getElementById('playerStatsTitle').textContent=playerObj.person&&playerObj.person.fullName?playerObj.person.fullName:'Player Stats';
  document.getElementById('playerStats').innerHTML='<div class="loading">Loading stats...</div>';
  try{var group=type==='pitching'?'pitching':type==='fielding'?'fielding':'hitting';var r=await fetch(MLB_BASE+'/people/'+id+'/stats?stats=season&season='+SEASON+'&group='+group);var d=await r.json();var stats=d.stats&&d.stats[0]&&d.stats[0].splits&&d.stats[0].splits[0]&&d.stats[0].splits[0].stat;if(!stats){document.getElementById('playerStats').innerHTML='<div class="empty-state">No '+SEASON+' stats available yet</div>';if(window.innerWidth<=767||(window.innerWidth<=1024&&window.matchMedia('(orientation:portrait)').matches)){document.getElementById('playerStats').scrollIntoView({behavior:'smooth',block:'end'});}return;}renderPlayerStats(stats,group);if(window.innerWidth<=767||(window.innerWidth<=1024&&window.matchMedia('(orientation:portrait)').matches)){document.getElementById('playerStats').scrollIntoView({behavior:'smooth',block:'end'});}}catch(e){document.getElementById('playerStats').innerHTML='<div class="error">Could not load stats</div>';}
}
function renderPlayerStats(s,group){
  var pid=selectedPlayer&&selectedPlayer.person&&selectedPlayer.person.id;
  var jerseyOverlay=(selectedPlayer&&selectedPlayer.jerseyNumber)?'<div class="headshot-jersey-pill">#'+selectedPlayer.jerseyNumber+'</div>':'';
  var html=pid?'<div class="headshot-frame"><img src="https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/'+pid+'/headshot/67/current">'+jerseyOverlay+'</div>':'';
  var boxes=[];
  if(group==='hitting')boxes=[{v:fmtRate(s.avg),l:'AVG'},{v:s.homeRuns,l:'HR'},{v:s.rbi,l:'RBI'},{v:fmtRate(s.ops),l:'OPS'},{v:s.hits,l:'H'},{v:s.doubles,l:'2B'},{v:s.triples,l:'3B'},{v:s.strikeOuts,l:'K'},{v:s.baseOnBalls,l:'BB'},{v:s.runs,l:'R'},{v:s.stolenBases,l:'SB'},{v:s.plateAppearances,l:'PA'}];
  else if(group==='pitching')boxes=[{v:fmt(s.era,2),l:'ERA'},{v:fmt(s.whip,2),l:'WHIP'},{v:s.strikeOuts,l:'K'},{v:s.wins+'-'+s.losses,l:'W-L'},{v:fmt(s.inningsPitched,1),l:'IP'},{v:s.hits,l:'H'},{v:s.baseOnBalls,l:'BB'},{v:s.homeRuns,l:'HR'},{v:fmt(s.strikeoutWalkRatio,2),l:'K/BB'},{v:fmt(s.strikeoutsPer9Inn,2),l:'K/9'},{v:fmt(s.walksPer9Inn,2),l:'BB/9'},{v:s.saves,l:'SV'}];
  else boxes=[{v:fmtRate(s.fielding),l:'FPCT'},{v:s.putOuts,l:'PO'},{v:s.assists,l:'A'},{v:s.errors,l:'E'},{v:s.chances,l:'TC'},{v:s.doublePlays,l:'DP'}];
  var cols=group==='fielding'?3:4;
  html+='<div class="stat-grid stat-grid--cols-'+cols+'">';
  boxes.forEach(function(b,i){html+='<div class="stat-box'+(i===0?' hero':'')+'"><div class="stat-val">'+(b.v!=null?b.v:'—')+'</div><div class="stat-lbl">'+b.l+'</div></div>';});
  document.getElementById('playerStats').innerHTML=html+'</div>';
}

function escapeNewsHtml(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function forceHttps(url){return url?url.replace(/^http:/,'https:'):url;}
// Only load images from known news CDN domains — prevents browser requests to unexpected
// third-party hosts (e.g. podcast avatars in RSS feeds) which can trigger corporate firewalls.
var NEWS_IMAGE_HOSTS=/\.(mlb\.com|mlbstatic\.com|espn\.com|espncdn\.com|cbssports\.com|cbsi\.com|fangraphs\.com|mlbtraderumors\.com|wp\.com|wordpress\.com|cloudfront\.net|fastly\.net|akamaized\.net|amazonaws\.com|imgix\.net|twimg\.com)$/;
function isSafeNewsImage(url){if(!url)return false;try{return NEWS_IMAGE_HOSTS.test(new URL(url).hostname);}catch(e){return false;}}
function decodeNewsHtml(s){var map={'&quot;':'"','&amp;':'&','&lt;':'<','&gt;':'>','&#39;':"'",'&apos;':"'"};return String(s||'').replace(/&(?:#\d+|#x[0-9a-f]+|quot|amp|lt|gt|apos?);/gi,function(e){return map[e.toLowerCase()]||e;}).replace(/&#(\d+);/g,function(m,code){return String.fromCharCode(parseInt(code,10));}).replace(/&#x([0-9a-f]+);/gi,function(m,code){return String.fromCharCode(parseInt(code,16));}); }
function fmtNewsDate(iso){if(!iso)return '';var d=new Date(iso);if(isNaN(d.getTime()))return '';return d.toLocaleDateString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});}
function mkEspnRow(a){var pub=a.published?new Date(a.published).toLocaleDateString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'';var link=(a.links&&a.links.web&&a.links.web.href)?a.links.web.href:'#';var headline=escapeNewsHtml(decodeNewsHtml(a.headline||''));return '<div class="news-item"><div class="news-dot"></div><div class="news-body"><div class="news-title"><a href="'+link+'" target="_blank">'+headline+'</a></div><div class="news-meta">'+pub+(a.byline?' · '+a.byline:'')+'</div></div></div>';}
function mkProxyNewsRow(item){
  var icon=NEWS_SOURCE_ICONS[item.source]||'📰';
  var sourceClass=item.source?' news-thumb--'+item.source:'';
  var thumb=isSafeNewsImage(item.image)
    ? '<div class="news-thumb'+sourceClass+'"><img src="'+escapeNewsHtml(forceHttps(item.image))+'" alt="" onerror="this.parentNode.innerHTML=\'<span class=&quot;news-thumb-placeholder&quot;>'+icon+'</span>\'"></div>'
    : '<div class="news-thumb'+sourceClass+'"><span class="news-thumb-placeholder">'+icon+'</span></div>';
  var src=NEWS_SOURCE_LABELS[item.source]||item.source||'';
  var kicker=src?'<div class="news-source-kicker">VIA '+escapeNewsHtml(src)+'</div>':'';
  var date=fmtNewsDate(item.pubDate);
  var link=item.link||'#';
  var title=escapeNewsHtml(decodeNewsHtml(item.title||''));
  return '<div class="news-item">'+thumb+'<div class="news-body">'+kicker+'<div class="news-title"><a href="'+escapeNewsHtml(link)+'" target="_blank" rel="noopener">'+title+'</a></div>'+(date?'<div class="news-meta">'+date+'</div>':'')+'</div></div>';
}
function renderNewsList(){
  var el=document.getElementById('newsFull');if(!el)return;
  var items=newsSourceFilter==='all'?newsArticlesCache:newsArticlesCache.filter(function(a){return a.source===newsSourceFilter;});
  if(!items.length){el.innerHTML='<div class="loading">No articles for this source.</div>';return;}
  el.innerHTML=items.map(mkProxyNewsRow).join('');
}
function selectNewsSource(key,btn){
  newsSourceFilter=key;
  var pills=document.querySelectorAll('#newsSourcePills .stat-tab');
  pills.forEach(function(p){p.classList.remove('active');});
  if(btn)btn.classList.add('active');
  else{var match=document.querySelector('#newsSourcePills .stat-tab[data-source="'+key+'"]');if(match)match.classList.add('active');}
  renderNewsList();
}
async function loadNews(){
  var fullEl=document.getElementById('newsFull'),homeEl=document.getElementById('homeNews');
  var teamBtn=document.getElementById('newsTeamBtn');if(teamBtn)teamBtn.textContent=activeTeam.short;
  if(fullEl)fullEl.innerHTML='<div class="loading">Loading news...</div>';if(homeEl)homeEl.innerHTML='<div class="loading">Loading news...</div>';
  var teamUrl='https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/news?team='+activeTeam.espnId+'&limit=20';
  if(newsFeedMode==='team'){
    // Team mode: ESPN-only (unchanged path)
    try{
      var resp=await fetch(teamUrl);
      var d=await resp.json();
      var arts=(d.articles||[]).filter(function(a){return a.headline;});
      if(!arts.length)throw new Error('No articles');
      if(fullEl)fullEl.innerHTML=arts.map(mkEspnRow).join('');
      if(homeEl)homeEl.innerHTML=arts.slice(0,5).map(mkEspnRow).join('');
    }catch(e){var msg='<div class="error">News unavailable (ESPN API may be blocked by browser).</div>';if(fullEl)fullEl.innerHTML=msg;if(homeEl)homeEl.innerHTML=msg;}
    return;
  }
  // MLB mode: multi-source via /api/proxy-news for full list, ESPN team for home card
  try{
    var responses=await Promise.all([fetch(API_BASE+'/api/proxy-news'),fetch(teamUrl)]);
    var d=await responses[0].json();
    newsArticlesCache=Array.isArray(d.articles)?d.articles:[];
    if(!newsArticlesCache.length)throw new Error('No articles');
    renderNewsList();
    if(homeEl){var hD=await responses[1].json();var hArts=(hD.articles||[]).filter(function(a){return a.headline;});homeEl.innerHTML=hArts.slice(0,5).map(mkEspnRow).join('')||'<div class="loading">No news available</div>';}
  }catch(e){
    // Fallback: ESPN MLB feed direct (legacy behaviour) so the page never goes empty
    try{
      var fb=await fetch('https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/news?limit=20');
      var fbD=await fb.json();var fbArts=(fbD.articles||[]).filter(function(a){return a.headline;});
      if(fullEl)fullEl.innerHTML=fbArts.map(mkEspnRow).join('');
      if(homeEl){var hResp=await fetch(teamUrl);var hJ=await hResp.json();homeEl.innerHTML=(hJ.articles||[]).filter(function(a){return a.headline;}).slice(0,5).map(mkEspnRow).join('')||'<div class="loading">No news available</div>';}
    }catch(e2){var msg='<div class="error">News unavailable (proxy and ESPN both failed).</div>';if(fullEl)fullEl.innerHTML=msg;if(homeEl)homeEl.innerHTML=msg;}
  }
}
function switchNewsFeed(mode,btn){
  newsFeedMode=mode;
  ['newsMlbBtn','newsTeamBtn'].forEach(function(id){var el=document.getElementById(id);if(el)el.classList.remove('active');});
  if(btn)btn.classList.add('active');
  var pills=document.getElementById('newsSourcePills');if(pills)pills.style.display=(mode==='mlb')?'flex':'none';
  loadNews();
}

var liveGamePk=null,liveInterval=null;
function showLiveGame(gamePk){liveGamePk=gamePk;document.querySelector('.main').style.display='none';document.getElementById('liveView').classList.add('active');fetchLiveGame();liveInterval=setInterval(fetchLiveGame,TIMING.LIVE_REFRESH_MS);}
function closeLiveView(){clearInterval(liveInterval);liveInterval=null;if(liveAbortCtrl){liveAbortCtrl.abort();liveAbortCtrl=null;}liveGamePk=null;document.getElementById('liveView').classList.remove('active');document.querySelector('.main').style.display='block';}
async function fetchLiveGame(){
  if(liveAbortCtrl){liveAbortCtrl.abort();}
  liveAbortCtrl=new AbortController();
  var liveSig=liveAbortCtrl.signal;
  try{
    var responses=await Promise.all([fetch(MLB_BASE+'/game/'+liveGamePk+'/linescore',{signal:liveSig}),fetch(MLB_BASE+'/game/'+liveGamePk+'/boxscore',{signal:liveSig}),fetch(MLB_BASE+'/schedule?gamePk='+liveGamePk,{signal:liveSig})]);
    var ls=await responses[0].json(),bs=await responses[1].json(),sd=await responses[2].json();
    var gameState=(sd.dates&&sd.dates[0]&&sd.dates[0].games&&sd.dates[0].games[0])?sd.dates[0].games[0].status.abstractGameState:'Live';
    var isFinal=gameState==='Final';
    var homeTeam=bs.teams&&bs.teams.home&&bs.teams.home.team?bs.teams.home.team:{},awayTeam=bs.teams&&bs.teams.away&&bs.teams.away.team?bs.teams.away.team:{};
    var inningHalf=ls.isTopInning?'▲':'▼',inning=ls.currentInning||'—';
    var headerHtml=isFinal
      ?'<div class="live-status">FINAL</div>'
      :'<div class="live-status">'+inningHalf+' '+inning+' &nbsp;·&nbsp; <span class="live-indicator">● LIVE</span></div>';
    headerHtml+='<div class="live-score"><div class="live-team"><div class="live-team-name">'+(awayTeam.abbreviation||awayTeam.name||'Away')+'</div><div class="live-team-score">'+(ls.teams&&ls.teams.away?ls.teams.away.runs:0)+'</div></div><div class="live-score-divider">—</div><div class="live-team"><div class="live-team-name">'+(homeTeam.abbreviation||homeTeam.name||'Home')+'</div><div class="live-team-score">'+(ls.teams&&ls.teams.home?ls.teams.home.runs:0)+'</div></div></div>';
    document.getElementById('liveHeader').innerHTML=headerHtml;
    var balls=ls.balls||0,strikes=ls.strikes||0,outs=ls.outs||0,bHtml='',sHtml='',oHtml='';
    for(var i=0;i<4;i++)bHtml+='<div class="count-dot ball'+(i<balls?' on':'')+'"></div>';
    for(var i=0;i<3;i++)sHtml+='<div class="count-dot strike'+(i<strikes?' on':'')+'"></div>';
    for(var i=0;i<3;i++)oHtml+='<div class="count-dot out'+(i<outs?' on':'')+'"></div>';
    document.getElementById('liveBalls').innerHTML=bHtml;document.getElementById('liveStrikes').innerHTML=sHtml;document.getElementById('liveOuts').innerHTML=oHtml;
    var offense=ls.offense||{},on='var(--accent)',off='none',offStroke='var(--muted)';
    document.getElementById('base1').setAttribute('fill',offense.first?on:off);document.getElementById('base1').setAttribute('stroke',offense.first?on:offStroke);
    document.getElementById('base2').setAttribute('fill',offense.second?on:off);document.getElementById('base2').setAttribute('stroke',offense.second?on:offStroke);
    document.getElementById('base3').setAttribute('fill',offense.third?on:off);document.getElementById('base3').setAttribute('stroke',offense.third?on:offStroke);
    var batter=offense.batter||{},pitcher=ls.defense&&ls.defense.pitcher?ls.defense.pitcher:{},batterStats='',pitcherStats='';
    if(batter.id){try{var br=await fetch(MLB_BASE+'/people/'+batter.id+'/stats?stats=season&season='+SEASON+'&group=hitting');if(!br.ok)throw new Error(br.status);var bd=await br.json();var bst=bd.stats&&bd.stats[0]&&bd.stats[0].splits&&bd.stats[0].splits[0]&&bd.stats[0].splits[0].stat;if(bst)batterStats='AVG '+fmtRate(bst.avg)+' · OBP '+fmtRate(bst.obp)+' · OPS '+fmtRate(bst.ops);}catch(e){}}
    if(pitcher.id){try{var pr=await fetch(MLB_BASE+'/people/'+pitcher.id+'/stats?stats=season&season='+SEASON+'&group=pitching');if(!pr.ok)throw new Error(pr.status);var pd=await pr.json();var pst=pd.stats&&pd.stats[0]&&pd.stats[0].splits&&pd.stats[0].splits[0]&&pd.stats[0].splits[0].stat;if(pst)pitcherStats='ERA '+fmt(pst.era,2)+' · WHIP '+fmt(pst.whip,2);}catch(e){}}
    var pitcherGameLine='';
    if(pitcher.id){var allPl=Object.assign({},bs.teams&&bs.teams.home&&bs.teams.home.players||{},bs.teams&&bs.teams.away&&bs.teams.away.players||{});var pitEntry=Object.values(allPl).find(function(p){return p.person&&p.person.id===pitcher.id;});if(pitEntry&&pitEntry.stats&&pitEntry.stats.pitching){var ps=pitEntry.stats.pitching;pitcherGameLine='Today: '+(ps.inningsPitched||'0.0')+' IP · '+(ps.hits||0)+' H · '+(ps.earnedRuns||0)+' ER · '+(ps.strikeOuts||0)+' K'+(ps.numberOfPitches?' · '+ps.numberOfPitches+' PC':'');}}
    document.getElementById('liveMatchup').innerHTML='<div class="matchup-player"><div class="matchup-role">🏏 Batting</div><div class="matchup-name">'+(batter.fullName||'—')+'</div><div class="matchup-stats">'+batterStats+'</div></div><div class="matchup-player"><div class="matchup-role">⚾ Pitching</div><div class="matchup-name">'+(pitcher.fullName||'—')+'</div><div class="matchup-stats">'+pitcherStats+'</div>'+(pitcherGameLine?'<div class="matchup-stats is-strong">'+pitcherGameLine+'</div>':'')+'</div>';
    var innings=ls.innings||[],lsHtml='<div class="linescore-scroll"><table class="linescore-table"><thead><tr><th></th>';
    innings.forEach(function(inn){lsHtml+='<th>'+inn.num+'</th>';});
    lsHtml+='<th class="rhe-start">R</th><th>H</th><th>E</th></tr></thead><tbody>';
    ['away','home'].forEach(function(side){var name=side==='away'?(awayTeam.abbreviation||'Away'):(homeTeam.abbreviation||'Home');lsHtml+='<tr><td>'+name+'</td>';innings.forEach(function(inn){lsHtml+='<td>'+(inn[side]&&inn[side].runs!=null?inn[side].runs:'—')+'</td>';});var tot=ls.teams&&ls.teams[side]?ls.teams[side]:{};lsHtml+='<td class="rhe rhe-start">'+(tot.runs!=null?tot.runs:'—')+'</td><td class="rhe">'+(tot.hits!=null?tot.hits:'—')+'</td><td class="rhe">'+(tot.errors!=null?tot.errors:'—')+'</td></tr>';});
    lsHtml+='</tbody></table></div>';document.getElementById('liveLinescore').innerHTML=lsHtml;
    var awayPlayers=bs.teams&&bs.teams.away&&bs.teams.away.players?bs.teams.away.players:{},homePlayers=bs.teams&&bs.teams.home&&bs.teams.home.players?bs.teams.home.players:{};
    var awayAbbr=awayTeam.abbreviation||awayTeam.name||'Away',homeAbbr=homeTeam.abbreviation||homeTeam.name||'Home';
    document.getElementById('liveBoxscore').innerHTML='<div class="boxscore-wrap live-stack-card"><div class="live-card-title">Box Score</div><div class="boxscore-tabs"><button onclick="switchBoxTab(\'live_bs\',\'away\')" id="live_bs_away_btn" class="pill is-active">'+awayAbbr+'</button><button onclick="switchBoxTab(\'live_bs\',\'home\')" id="live_bs_home_btn" class="pill">'+homeAbbr+'</button></div><div id="live_bs_away">'+buildBoxscore(awayPlayers)+'</div><div id="live_bs_home" style="display:none">'+buildBoxscore(homePlayers)+'</div></div>';
    var giHtml='';
    if(bs.info&&bs.info.length){giHtml='<div class="boxscore-wrap live-stack-card"><div class="live-card-title">Game Info</div><div class="game-note-box">';bs.info.forEach(function(item){if(!item.value)return;var val=item.value.replace(/\.$/,'').trim();if(!item.label)giHtml+='<div class="detail-summary-note">'+val+'</div>';else giHtml+='<div class="detail-summary-row"><span class="detail-summary-label">'+item.label+'</span><span>'+val+'</span></div>';});giHtml+='</div></div>';}
    document.getElementById('liveGameInfo').innerHTML=giHtml;
    if(isFinal){if(liveInterval){clearInterval(liveInterval);liveInterval=null;}document.getElementById('liveRefreshTime').textContent='Game Final';}
  }catch(e){if(e.name!=='AbortError')document.getElementById('liveHeader').innerHTML='<div class="error">Could not load live game data</div>';}
  fetchPlayByPlay();
}
async function fetchPlayByPlay(){
  try{
    var r=await fetch(MLB_BASE+'/game/'+liveGamePk+'/playByPlay');
    var data=await r.json();
    var plays=(data.allPlays||[]).filter(function(p){return p.about&&p.about.isComplete;});
    if(!plays.length){document.getElementById('livePlayByPlay').innerHTML='';return;}
    var html='<div class="boxscore-wrap live-stack-card"><div class="live-card-title">Play Log</div>';
    var reversed=plays.slice().reverse();
    var lastKey=null;
    reversed.forEach(function(play){
      var inn=play.about.inning,half=play.about.halfInning==='top'?'▲':'▼';
      var key=half+inn;
      var ord=inn===1?'1st':inn===2?'2nd':inn===3?'3rd':inn+'th';
      if(key!==lastKey){
        if(lastKey!==null)html+='</div>';
        html+='<div class="play-log-inning">'+half+' '+ord+'</div><div class="play-log-group">';
        lastKey=key;
      }
      var isScore=play.about.isScoringPlay;
      var desc=(play.result.description||'—').replace(/\.$/,'');
      var score=isScore?'<span class="play-log-score">'+play.result.awayScore+'-'+play.result.homeScore+'</span>':'';
      html+='<div class="play-log-entry'+(isScore?' play-log-scoring':'')+'">'+(isScore?'🟢 ':'')+desc+(score?' · '+score:'')+'</div>';
    });
    if(lastKey!==null)html+='</div>';
    html+='</div>';
    document.getElementById('livePlayByPlay').innerHTML=html;
  }catch(e){}
}

const MLB_FALLBACK_UC='UCoLrcjPV5tBJkzGBFm-6_sA';
var selectedVideoId=null,mediaVideos=[];

function loadHomeYoutubeWidget(){
  var uc=activeTeam.youtubeUC||MLB_FALLBACK_UC,teamName=activeTeam.youtubeUC?activeTeam.name:'MLB',channelUrl='https://www.youtube.com/channel/'+uc;
  var themeTeam=themeOverride||activeTeam,bannerColor=themeInvert?themeTeam.secondary:themeTeam.primary;
  var grad='background:linear-gradient(135deg,'+bannerColor+' 0%,var(--dark) 100%)';
  document.getElementById('homeYoutubeHeader').innerHTML='<div style="'+grad+';border-radius:12px 12px 0 0;padding:16px 20px;display:flex;align-items:center;justify-content:space-between"><div><div style="font-size:.7rem;font-weight:700;text-transform:uppercase;color:rgba(255,255,255,.6);margin-bottom:2px">📺 Official Channel</div><div style="font-size:1.1rem;font-weight:800;color:#fff">'+teamName+'</div></div><a href="'+channelUrl+'" target="_blank" style="font-size:.78rem;color:rgba(255,255,255,.7);text-decoration:none;border:1px solid rgba(255,255,255,.3);padding:5px 12px;border-radius:6px">Open in YouTube ↗</a></div>';
  loadMediaFeed(uc);
}

function isDesktop(){return window.matchMedia('(min-width:1025px)').matches&&!('ontouchstart' in window);}
function updatePushRowVisibility(){var row=document.getElementById('pushRow');if(!row)return;row.style.display=(!isDesktop()||devShowPushOnDesktop)?'flex':'none';}
function togglePushOnDesktop(){devShowPushOnDesktop=!devShowPushOnDesktop;var toggle=document.getElementById('pushDesktopToggle'),knob=document.getElementById('pushDesktopToggleKnob');toggle.style.background=devShowPushOnDesktop?'var(--secondary)':'var(--border)';knob.style.left=devShowPushOnDesktop?'18px':'2px';updatePushRowVisibility();}
async function loadMediaFeed(uc){
  var listEl=document.getElementById('homeYoutubeList');
  try{
    var r=await fetch(API_BASE+'/api/proxy-youtube?channel='+encodeURIComponent(uc));
    if(!r.ok)throw new Error('HTTP '+r.status);
    var json=await r.json();
    if(!json.success||!json.videos||!json.videos.length)throw new Error(json.message||'No videos');
    mediaVideos=json.videos;
    renderMediaList();selectMediaVideo(mediaVideos[0].videoId);
  }catch(e){if(listEl)listEl.innerHTML='<div class="error" style="padding:12px;color:var(--muted);font-size:.9rem">Could not load videos: '+e.message+'</div>';}
}
function renderMediaList(){var listEl=document.getElementById('homeYoutubeList');if(!listEl)return;var html='';mediaVideos.forEach(function(v){var sel=v.videoId===selectedVideoId;html+='<div onclick="selectMediaVideo(\''+v.videoId+'\')" style="cursor:pointer;padding:10px;border-bottom:1px solid var(--border);background:'+(sel?'color-mix(in srgb,var(--accent) 12%,transparent)':'transparent')+';'+(sel?'border-left:3px solid var(--accent)':'border-left:3px solid transparent')+'"><img src="'+v.thumb+'" style="width:100%;border-radius:4px;margin-bottom:6px;display:block" loading="lazy"/><div style="font-size:.72rem;font-weight:600;color:'+(sel?'var(--accent)':'var(--text)')+';line-height:1.3;margin-bottom:3px">'+v.title+'</div><div style="font-size:.65rem;color:var(--muted)">'+v.date+'</div></div>';});listEl.innerHTML=html;}
function selectMediaVideo(videoId){stopAllMedia('youtube');selectedVideoId=videoId;var player=document.getElementById('homeYoutubePlayer');if(player)player.src='https://www.youtube-nocookie.com/embed/'+videoId+'?rel=0&enablejsapi=1';renderMediaList();}

var leagueLeaderTab='hitting',leagueLeadersCache={hitting:{},pitching:{}},leagueStandingsMap={},leagueMatchupOffset=0;
let homeLiveTimer=null;
let leagueRefreshTimer=null;
async function loadLeagueView(){if(leagueRefreshTimer){clearInterval(leagueRefreshTimer);leagueRefreshTimer=null;}leagueMatchupOffset=0;['matchupYest','matchupToday','matchupTomor'].forEach(function(id,i){var el=document.getElementById(id);if(el)el.classList.toggle('active',i===1);});var lbl=document.getElementById('matchupDayLabel');if(lbl)lbl.textContent="Today's";await loadLeagueStandings();loadLeagueMatchups();loadLeagueNews();loadLeagueLeaders();leagueRefreshTimer=setInterval(loadLeagueMatchups,TIMING.LEAGUE_REFRESH_MS);}
async function loadLeagueStandings(){try{var r=await fetch(MLB_BASE+'/standings?leagueId=103,104&standingsTypes=regularSeason&hydrate=team');var d=await r.json();leagueStandingsMap={};(d.records||[]).forEach(function(rec){(rec.teamRecords||[]).forEach(function(t){leagueStandingsMap[t.team.id]={w:t.wins,l:t.losses};});});}catch(e){}}
async function loadLeagueMatchups(){
  var el=document.getElementById('leagueMatchups');
  var dayLabels=["Yesterday's","Today's","Tomorrow's"],dayLabel=dayLabels[leagueMatchupOffset+1];
  el.style.transition='opacity 0.18s ease';el.style.opacity='0.3';
  var now=new Date();now.setDate(now.getDate()+leagueMatchupOffset);
  var dateStr=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');
  try{
    var r=await fetch(MLB_BASE+'/schedule?sportId=1&date='+dateStr+'&hydrate=linescore,team');var d=await r.json(),games=[];
    (d.dates||[]).forEach(function(dt){games=games.concat(dt.games||[]);});
    games.sort(function(a,b){return new Date(a.gameDate).getTime()-new Date(b.gameDate).getTime();});
    if(!games.length){el.innerHTML='<div class="empty-state">No games scheduled '+dayLabel.replace("'s","")+'</div>';requestAnimationFrame(function(){el.style.opacity='1';});return;}
    var html='<div class="matchup-grid">';
    games.forEach(function(g){
      var home=g.teams.home,away=g.teams.away,status=g.status.abstractGameState,detailed=g.status.detailedState;
      var actuallyLive=status==='Live'&&detailed!=='Warmup'&&detailed!=='Pre-Game';
      var clickable=(actuallyLive||status==='Final');
      var statusHtml='';
      if(actuallyLive){var inn=g.linescore&&g.linescore.currentInning?(g.linescore.inningHalf==='Bottom'?'Bot ':'Top ')+g.linescore.currentInning:'In Progress';statusHtml='<div class="matchup-status is-live"><span class="matchup-live-dot"></span>LIVE · '+inn+'</div>';}
      else if(status==='Final')statusHtml='<div class="matchup-status">FINAL</div>';
      else{var t=new Date(g.gameDate);statusHtml='<div class="matchup-status">'+t.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})+'</div>';}
      var scoreOrVs;if(actuallyLive){scoreOrVs='<span class="matchup-score">'+(away.score!=null?away.score:0)+'</span><span class="matchup-divider">—</span><span class="matchup-score">'+(home.score!=null?home.score:0)+'</span>';}else if(status==='Final'){var awayWon=away.score>home.score;scoreOrVs='<span class="matchup-score'+(awayWon?'':' is-dim')+'">'+(away.score!=null?away.score:0)+'</span><span class="matchup-divider">—</span><span class="matchup-score'+(awayWon?' is-dim':'')+'">'+(home.score!=null?home.score:0)+'</span>';}else{scoreOrVs='<span class="matchup-vs">vs</span>';}
      var awayRec=leagueStandingsMap[away.team.id],homeRec=leagueStandingsMap[home.team.id];
      var awayD=TEAMS.find(function(t){return t.id===away.team.id;})||{},homeD=TEAMS.find(function(t){return t.id===home.team.id;})||{};
      html+='<div class="matchup-card"'+(clickable?' onclick="showLiveGame('+g.gamePk+')"':'')+'>'+statusHtml+'<div class="matchup-score-row"><div class="matchup-team">'+teamCapImg(away.team.id,away.team.teamName,awayD.primary||'#333',awayD.secondary||'#fff','matchup-cap')+'<div class="matchup-abbr">'+(away.team.abbreviation||away.team.teamName)+'</div><div class="matchup-record">'+(awayRec?'('+awayRec.w+'-'+awayRec.l+')':'')+'</div></div>'+scoreOrVs+'<div class="matchup-team">'+teamCapImg(home.team.id,home.team.teamName,homeD.primary||'#333',homeD.secondary||'#fff','matchup-cap')+'<div class="matchup-abbr">'+(home.team.abbreviation||home.team.teamName)+'</div><div class="matchup-record">'+(homeRec?'('+homeRec.w+'-'+homeRec.l+')':'')+'</div></div></div></div>';
    });
    el.innerHTML=html+'</div>';
  }catch(e){el.innerHTML='<div class="error">Could not load games</div>';}
  requestAnimationFrame(function(){el.style.opacity='1';});
}
function switchMatchupDay(offset,btn){
  leagueMatchupOffset=offset;
  ['matchupYest','matchupToday','matchupTomor'].forEach(function(id){var el=document.getElementById(id);if(el)el.classList.remove('active');});
  if(btn)btn.classList.add('active');
  var labels=["Yesterday's","Today's","Tomorrow's"],lbl=document.getElementById('matchupDayLabel');
  if(lbl)lbl.textContent=labels[offset+1];
  loadLeagueMatchups();
}
async function loadLeagueNews(){var el=document.getElementById('leagueNews');el.innerHTML='<div class="loading">Loading...</div>';try{var r=await fetch('https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/news?limit=15');var d=await r.json(),articles=(d.articles||[]).filter(function(a){return a.headline;}).slice(0,10);if(!articles.length)throw new Error('none');var html='';articles.forEach(function(a){var pub=a.published?new Date(a.published).toLocaleDateString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'';var link=(a.links&&a.links.web&&a.links.web.href)?a.links.web.href:'#';var headline=escapeNewsHtml(decodeNewsHtml(a.headline||''));html+='<div class="news-item"><div class="news-dot"></div><div><div class="news-title"><a href="'+link+'" target="_blank">'+headline+'</a></div><div class="news-meta">'+pub+(a.byline?' · '+a.byline:'')+'</div></div></div>';});el.innerHTML=html;}catch(e){el.innerHTML='<div class="error">News unavailable (ESPN API may be blocked by browser).</div>';}}
var LEAGUE_HIT_STATS=[{label:'HR',cats:'homeRuns',decimals:0},{label:'AVG',cats:'battingAverage',decimals:3,noLeadZero:true},{label:'OPS',cats:'onBasePlusSlugging',decimals:3,noLeadZero:true},{label:'RBI',cats:'runsBattedIn',decimals:0},{label:'SB',cats:'stolenBases',decimals:0},{label:'BB',cats:'walks',decimals:0}];
var LEAGUE_PIT_STATS=[{label:'SO',cats:'strikeouts',decimals:0},{label:'WHIP',cats:'walksAndHitsPerInningPitched',decimals:2},{label:'ERA',cats:'earnedRunAverage',decimals:2},{label:'W',cats:'wins',decimals:0},{label:'SV',cats:'saves',decimals:0},{label:'IP',cats:'inningsPitched',decimals:1}];
async function loadLeagueLeaders(){var el=document.getElementById('leagueLeaders');el.innerHTML='<div class="loading">Loading leaders...</div>';var stats=leagueLeaderTab==='hitting'?LEAGUE_HIT_STATS:LEAGUE_PIT_STATS,group=leagueLeaderTab;try{var cats=stats.map(function(s){return s.cats;}).join(',');var r=await fetch(MLB_BASE+'/stats/leaders?leaderCategories='+cats+'&season='+SEASON+'&leaderGameTypes=R&limit=10&statGroup='+group+'&hydrate=person');var d=await r.json(),leaderMap={};(d.leagueLeaders||[]).forEach(function(cat){var key=cat.leaderCategory;if(key)leaderMap[key]=cat.leaders||[];});leagueLeadersCache[leagueLeaderTab]=leaderMap;renderLeagueLeaders(leaderMap,stats);}catch(e){el.innerHTML='<div class="error">Could not load leaders</div>';}}
function renderLeagueLeaders(leaderMap,stats){var el=document.getElementById('leagueLeaders'),html='<div class="league-leaders-grid">';stats.forEach(function(s){var leaders=leaderMap[s.cats]||[];html+='<div class="leader-stat-card"><div class="leader-stat-label">'+s.label+'</div>';if(!leaders.length)html+='<div class="empty-state" style="padding:6px;font-size:.8rem">No data</div>';leaders.slice(0,10).forEach(function(l,i){var val=l.value;if(val!=null){var n=parseFloat(val);if(!isNaN(n))val=s.noLeadZero&&n>0&&n<1?n.toFixed(s.decimals).slice(1):n.toFixed(s.decimals);}html+='<div class="leader-row"><div class="leader-row-left"><span class="leader-rank">'+(i+1)+'</span><span class="leader-name">'+((l.person&&l.person.fullName)||'—')+'</span></div><span class="leader-val">'+val+'</span></div>';});html+='</div>';});el.innerHTML=html+'</div>';}
function switchLeagueLeaderTab(tab,btn){leagueLeaderTab=tab;document.getElementById('leagueHitTab').classList.toggle('active',tab==='hitting');document.getElementById('leaguePitTab').classList.toggle('active',tab==='pitching');var cached=leagueLeadersCache[tab],stats=tab==='hitting'?LEAGUE_HIT_STATS:LEAGUE_PIT_STATS;if(cached&&Object.keys(cached).length)renderLeagueLeaders(cached,stats);else loadLeagueLeaders();}

const API_BASE='https://baseball-app-sigma.vercel.app';
const VAPID_PUBLIC_KEY='BPI_UHKC-1UI9uIacuEooLwnRaRcGgIf1tji_5PiNhr6lcpQrgs2PqKyhfdhsYtxSxaUaENoAiZ7781iBvOlZWE';

function urlBase64ToUint8Array(b64){var pad='='.repeat((4-b64.length%4)%4),raw=atob((b64+pad).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)));}

async function subscribeToPush(){
  try{
    var reg=await navigator.serviceWorker.ready;
    var sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(VAPID_PUBLIC_KEY)});
    await fetch((API_BASE||'')+'/api/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(sub)});
    localStorage.setItem('mlb_push','1');
    document.getElementById('pushStatusText').textContent='On';
  }catch(err){
    document.getElementById('pushToggle').style.background='var(--border)';
    document.getElementById('pushToggleKnob').style.left='3px';
    document.getElementById('pushStatusText').textContent='Permission Denied';
  }
}

async function unsubscribeFromPush(){
  try{
    var reg=await navigator.serviceWorker.ready;
    var sub=await reg.pushManager.getSubscription();
    if(sub){await sub.unsubscribe();await fetch((API_BASE||'')+'/api/subscribe',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:sub.endpoint})});}
  }catch(e){}
  localStorage.removeItem('mlb_push');
  document.getElementById('pushStatusText').textContent='Off';
}

function togglePush(){
  var tog=document.getElementById('pushToggle'),knob=document.getElementById('pushToggleKnob');
  var enabled=localStorage.getItem('mlb_push')==='1';
  if(!enabled){
    if(!('serviceWorker' in navigator&&'PushManager' in window)){document.getElementById('pushStatusText').textContent='Not Supported On This Browser';return;}
    if(!VAPID_PUBLIC_KEY){document.getElementById('pushStatusText').textContent='Push Not Configured Yet';return;}
    tog.style.background='var(--secondary)';knob.style.left='21px';
    subscribeToPush();
  }else{
    tog.style.background='var(--border)';knob.style.left='3px';
    unsubscribeFromPush();
  }
}

(async function(){
  var sv=function(k){return localStorage.getItem(k);};
  // Restore soundSettings from localStorage
  if(sv('mlb_sound_settings')){try{soundSettings=JSON.parse(sv('mlb_sound_settings'));}catch(e){}}
  // Restore session token
  mlbSessionToken=sv('mlb_session_token');mlbAuthUser=sv('mlb_auth_user');
  // Handle auth from OAuth redirect
  const params=new URLSearchParams(window.location.search);
  const authToken=params.get('auth_token'),authMethod=params.get('auth_method');
  if(authToken&&authMethod){
    mlbSessionToken=authToken;
    localStorage.setItem('mlb_session_token',authToken);
    if(authMethod==='github'){mlbAuthUser=params.get('github_login')||'GitHub User';}
    else if(authMethod==='email'){mlbAuthUser=params.get('email')||'Email User';}
    localStorage.setItem('mlb_auth_user',mlbAuthUser);
    // Clean up URL
    window.history.replaceState({},'',window.location.pathname);
    await mergeCollectionOnSignIn();
    startSyncInterval();
  }else if(mlbSessionToken){
    startSyncInterval();
  }
  if(sv('mlb_team'))activeTeam=TEAMS.find(t=>t.id===parseInt(sv('mlb_team')))||activeTeam;
  var storedTheme=sv('mlb_theme');
  if(!storedTheme||storedTheme==='-1'){themeOverride=MLB_THEME;}
  else if(storedTheme==='0'){themeOverride=null;}
  else{themeOverride=TEAMS.find(t=>t.id===parseInt(storedTheme))||null;}
  if(sv('mlb_invert')==='true')themeInvert=true;
  if(sv('mlb_theme_scope')==='nav')themeScope='nav';
  buildTeamSelect();buildThemeSelect();updatePulseToggle();
  document.getElementById('themeSelect').value=storedTheme||'-1';
  if(sv('mlb_theme_scope'))document.getElementById('themeScopeSelect').value=sv('mlb_theme_scope');
  if(themeInvert){var it=document.getElementById('invertToggle'),ik=document.getElementById('invertToggleKnob');it.style.background='var(--primary)';ik.style.left='21px';}
  if(sv('mlb_push')==='1'){var pt=document.getElementById('pushToggle'),pk=document.getElementById('pushToggleKnob');if(pt){pt.style.background='var(--secondary)';pk.style.left='21px';}document.getElementById('pushStatusText').textContent='On';}
  applyTeamTheme(activeTeam);loadTodayGame();loadNextGame();loadNews();loadStandings();loadRoster();loadHomeYoutubeWidget();
  updateCollectionUI();
  updateSyncUI();
  pulseInitialized=true;initLeaguePulse();
  // Pulse-first cold-open: mirror showSection('pulse') side-effects so theme + wake-lock match the active landing section
  savedThemeForPulse=themeOverride;
  applyPulseMLBTheme();
  requestScreenWakeLock();
  applyMyTeamLens(myTeamLens);
})();

document.addEventListener('visibilitychange',function(){
  if(document.hidden){
    tabHiddenAt=Date.now();
    releaseScreenWakeLock();
    // Pause data polling while tab is hidden
    if(pulseTimer){clearInterval(pulseTimer);pulseTimer=null;}
    if(storyPoolTimer){clearInterval(storyPoolTimer);storyPoolTimer=null;}
    if(focusFastTimer){clearInterval(focusFastTimer);focusFastTimer=null;}
    if(homeLiveTimer){clearInterval(homeLiveTimer);homeLiveTimer=null;}
    if(leagueRefreshTimer){clearInterval(leagueRefreshTimer);leagueRefreshTimer=null;}
  } else {
    if(pulseInitialized&&!demoMode){
      // Keep tabHiddenAt set during catch-up so pollGamePlays treats missed plays as history
      // (suppresses HR/RBI cards and sounds for plays that fired while tab was hidden).
      // Clear it only after the catch-up poll completes.
      pollLeaguePulse().finally(function(){tabHiddenAt=null;});
      pulseTimer=setInterval(pollLeaguePulse,TIMING.PULSE_POLL_MS);
      storyPoolTimer=setInterval(buildStoryPool,TIMING.STORY_POOL_MS);
      if(focusGamePk) focusFastTimer=setInterval(pollFocusLinescore,TIMING.FOCUS_POLL_MS);
    } else {
      tabHiddenAt=null;
    }
  }
});

document.addEventListener('keydown',function(e){
  if(e.key==='Escape'&&focusOverlayOpen) { closeFocusOverlay(); return; }
  if(e.shiftKey && e.key === 'H') { toggleDemoMode(); }
  if(e.shiftKey && e.key === 'R') { replayHRCard(); }
  if(e.shiftKey && e.key === 'E') { replayRBICard(); }
  if(e.shiftKey && e.key === 'V') { window.PulseCard.demo(); }
  if(e.shiftKey && e.key === 'D') { toggleDevTools(); }
  if(e.shiftKey && e.key === 'F') { window.FocusCard && window.FocusCard.demo(); }
  if(e.shiftKey && e.key === 'G') { generateTestCard(); }
  if(e.shiftKey && e.key === 'C') { window.CollectionCard && window.CollectionCard.demo(); }
  if(e.shiftKey && e.key === 'W') { devTestVideoClip(); }
  if(e.shiftKey && e.key === 'N') { openNewsSourceTest(); } // TEMP — News tab QA
});

document.addEventListener('click',onSoundPanelClickOutside);

if('serviceWorker' in navigator){navigator.serviceWorker.register('sw.js').catch(function(){});}
