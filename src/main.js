// ── Module imports ───────────────────────────────────────────────────────────
// Diag (devLog + devNet) is imported FIRST — the modules wrap console.log
// and window.fetch as side-effects of import, so any code below that logs
// or fetches is captured.
import { DEV_LOG_CAP, devLog, pushDevLog, devTrace } from './diag/devLog.js';
import { DEV_NET_CAP, devNetLog } from './diag/devNet.js';
import {
  SEASON, WC_SPOTS, MLB_BASE, MLB_BASE_V1_1, API_BASE,
  TEAMS, MLB_THEME,
  NEWS_SOURCE_LABELS, NEWS_SOURCE_ICONS,
  TIMING,
} from './config/constants.js';
import {
  tcLookup, fmt, fmtRate, fmtDateTime, fmtNewsDate, pickOppColor,
} from './utils/format.js';
import { NEWS_IMAGE_HOSTS, isSafeNewsImage } from './utils/news.js';
import { requestScreenWakeLock, releaseScreenWakeLock } from './ui/wakelock.js';
import {
  soundSettings, playSound, setSoundPref,
  toggleSoundPanel, onSoundPanelClickOutside,
} from './ui/sound.js';
import {
  setThemeCallbacks, applyTeamTheme, applyPulseMLBTheme, setPulseColorScheme, updatePulseToggle,
  toggleSettings, setupSettingsClickOutside, toggleInvert, buildThemeSelect, buildTeamSelect,
  switchTheme, switchThemeScope, switchTeam,
} from './ui/theme.js';
import {
  setFeedCallbacks, baseDiamondSvg, startCountdown, isPostSlate, isIntermission,
  fetchTomorrowPreview, pulseGreeting, updateFeedEmpty, renderEmptyState,
  addFeedItem, buildFeedEl, renderFeed, renderTicker, renderSideRailGames,
  showAlert, dismissAlert,
} from './feed/render.js';
// Radio station constants (MLB_TEAM_RADIO, FALLBACK_RADIO, APPROVED_RADIO_TEAM_IDS,
// RADIO_CHECK_DEFAULT_NOTES) are imported directly by radio/engine.js and radio/check.js.
import {
  pickRadioForFocus, stopAllMedia, toggleRadio, startRadio, loadRadioStream,
  stopRadio, updateRadioForFocus, getCurrentTeamId,
} from './radio/engine.js';
import {
  setRadioCheckCallbacks, openRadioCheck, closeRadioCheck,
  radioCheckPlay, radioCheckTryCustom, radioCheckStop,
  radioCheckSet, radioCheckSetNote, radioCheckReset, radioCheckCopy,
} from './radio/check.js';
import {
  setYoutubeDebugCallbacks, openYoutubeDebug, closeYoutubeDebug,
  ytDebugFetchCustom, ytDebugApplyToTeam, runYoutubeDebugAll, runYoutubeDebugOne,
  ytDebugReset, ytDebugCopy,
} from './dev/youtube-debug.js';
import {
  openNewsSourceTest, closeNewsSourceTest, runNewsSourceTest, copyNewsSourceTest,
} from './dev/news-test.js';
import {
  toggleDemoMode, setDemoSpeed, toggleDemoPause, backDemoPlay, forwardDemoPlay,
  demoNextHR, exitDemo, loadDemoGames, buildDemoPlayQueue, setDemoCallbacks,
} from './demo/mode.js';
import {
  calcFocusScore, selectFocusGame, setFocusGame, setFocusGameManual, resetFocusAuto,
  pollFocusLinescore, renderFocusCard, renderFocusMiniBar,
  openFocusOverlay, closeFocusOverlay, renderFocusOverlay, dismissFocusAlert,
} from './focus/mode.js';
import {
  setRotationCallbacks, buildStoryPool, rotateStory, showStoryCard, renderStoryCard, updateStoryDots,
  prevStory, nextStory, onStoryVisibilityChange,
} from './carousel/rotation.js';
import {
  setSectionCallbacks, clearHomeTimer, clearLeagueTimer,
  loadTodayGame, loadNextGame, loadHomeYoutubeWidget, selectMediaVideo,
  loadSchedule, changeMonth, selectCalGame, switchBoxTab, playHighlightVideo,
  loadStandings,
  selectLeaderPill, switchLeaderTab, loadLeaders, loadRoster, switchRosterTab, selectPlayer,
  selectNewsSource, loadNews, switchNewsFeed,
  loadLeagueView, loadLeagueMatchups, switchMatchupDay, switchLeagueLeaderTab,
  showLiveGame, closeLiveView, fetchLiveGame,
} from './sections/loaders.js';
import {
  setSyncCallbacks, syncCollection, mergeCollectionOnSignIn, mergeCollectionSlots, startSyncInterval,
} from './collection/sync.js';
import {
  setCarouselCallbacks, loadOnThisDayCache, loadYesterdayCache, loadTransactionsCache, loadHighLowCache,
} from './carousel/generators.js';
import { signInWithGitHub, signInWithEmail } from './auth/oauth.js';
import {
  VAPID_PUBLIC_KEY, urlBase64ToUint8Array,
  subscribeToPush, unsubscribeFromPush, togglePush,
} from './push/push.js';
import { state } from './state.js';

const DEBUG=false; // Set true locally to enable verbose console logging
devTrace('boot','app.js loaded · '+new Date().toISOString());

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

// Constants (SEASON, WC_SPOTS, MLB_BASE, TEAMS, MLB_THEME, NEWS_SOURCE_*, TIMING)
// imported from ./config/constants.js at top of file.
// Hot-state globals are now imported from ./state.js

// ── Timer registry — single audit point for all active timer handles ─────────
const TIMERS={
  _h:{},
  set:function(key,handle){if(this._h[key])clearInterval(this._h[key]);this._h[key]=handle;},
  clear:function(key){if(this._h[key]){clearInterval(this._h[key]);this._h[key]=null;}},
  clearAll:function(){Object.keys(this._h).forEach(function(k){if(TIMERS._h[k]){clearInterval(TIMERS._h[k]);TIMERS._h[k]=null;}});}
};

// ── Hot state globals ────────────────────────────────────────────────────────
// All mutable state is now imported from ./state.js
// soundSettings imported from ./ui/sound.js (hydrated from localStorage on import)
// screenWakeLock state encapsulated inside ./ui/wakelock.js
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

// ── Helper function for Yesterday Recap ─────────────────────────────────────
function getYdActiveCache(){return state.ydDisplayCache!==null?state.ydDisplayCache:(state.yesterdayCache||[]);}
const NEWS_ROTATE_MS=30000;

// tcLookup imported from ./utils/format.js
async function fetchBoxscore(gamePk){
  if(!state.boxscoreCache[gamePk]){
    try{var bsR=await fetch(MLB_BASE+'/game/'+gamePk+'/boxscore');if(!bsR.ok)throw new Error(bsR.status);state.boxscoreCache[gamePk]=await bsR.json();}
    catch(e){return null;}
  }
  return state.boxscoreCache[gamePk];
}

// ── League Pulse functions ────────────────────────────────────────────────────
function getEffectiveDate(){
  return state.demoMode&&state.demoDate?state.demoDate:new Date();
}

function initLeaguePulse() {
  devTrace('pulse','initLeaguePulse · first nav to Pulse');
  initReal();
}
function initReal() {
  setCarouselCallbacks({ updateFeedEmpty: updateFeedEmpty, fetchBoxscore: fetchBoxscore, localDateStr: localDateStr, getEffectiveDate: getEffectiveDate, tcLookup: tcLookup });
  setRotationCallbacks({ refreshDebugPanel: refreshDebugPanel });
  setSyncCallbacks({ loadCollection: loadCollection, saveCollection: saveCollection, updateCollectionUI: updateCollectionUI });
  setThemeCallbacks({ loadTodayGame: loadTodayGame, loadNextGame: loadNextGame, loadNews: loadNews, loadStandings: loadStandings, loadRoster: loadRoster, loadHomeYoutubeWidget: loadHomeYoutubeWidget, applyMyTeamLens: applyMyTeamLens, clearHomeLiveTimer: clearHomeTimer });
  setFeedCallbacks({ localDateStr: localDateStr });
  setSectionCallbacks({ renderNextGame: renderNextGame, getSeriesInfo: getSeriesInfo, localDateStr: localDateStr, teamCapImg: teamCapImg, capImgError: capImgError });
  setRadioCheckCallbacks({ toggleSettings: toggleSettings });
  setYoutubeDebugCallbacks({ loadHomeYoutubeWidget: loadHomeYoutubeWidget });
  var mockBar=document.getElementById('mockBar');
  if(mockBar){mockBar.style.display='none';mockBar.style.setProperty('display','none','important');}
  // Midnight window: at 0–5am local, seed state.pollDateStr to yesterday so West Coast games are found
  if(!state.demoMode&&(new Date().getHours())<6){var _d=new Date();_d.setDate(_d.getDate()-1);state.pollDateStr=localDateStr(_d);}
  else{state.pollDateStr=localDateStr(getEffectiveDate());}
  loadRoster();
  loadOnThisDayCache(); loadYesterdayCache();
  loadTransactionsCache(); loadHighLowCache();
  document.removeEventListener('visibilitychange',onStoryVisibilityChange);
  document.addEventListener('visibilitychange',onStoryVisibilityChange);
  pollLeaguePulse().then(function(){buildStoryPool();setFocusGame(state.focusGamePk);});
  state.pulseTimer=setInterval(pollLeaguePulse,TIMING.PULSE_POLL_MS);
  if(state.storyPoolTimer){clearInterval(state.storyPoolTimer);state.storyPoolTimer=null;}
  state.storyPoolTimer=setInterval(buildStoryPool,TIMING.STORY_POOL_MS);
  if(state.videoClipPollTimer){clearInterval(state.videoClipPollTimer);state.videoClipPollTimer=null;}
  state.videoClipPollTimer=setInterval(pollPendingVideoClips,30*1000);
  if(state.yesterdayRefreshTimer){clearInterval(state.yesterdayRefreshTimer);state.yesterdayRefreshTimer=null;}
  state.yesterdayRefreshTimer=setInterval(function(){
    loadYesterdayCache().then(function(){
      var ydCard=document.getElementById('yesterdayCard');
      if(ydCard&&ydCard.offsetParent!==null) renderYesterdayRecap();
    });
  },TIMING.YESTERDAY_REFRESH_MS);
}

async function pollLeaguePulse() {
  if(state.pulseAbortCtrl){state.pulseAbortCtrl.abort();}
  state.pulseAbortCtrl=new AbortController();
  var sig=state.pulseAbortCtrl.signal;
  var hasLive=Object.values(state.gameStates).some(function(g){return g.status==='Live';});
  devTrace('poll','pollLeaguePulse start · hasLive='+hasLive+' · pollDate='+state.pollDateStr+' · games='+Object.keys(state.gameStates).length+' · enabled='+state.enabledGames.size);
  // Hoist isMidnightWindow so both the date-flip guard and the yesterday fallback can use it
  var isMidnightWindow=!state.demoMode&&(new Date().getHours())<6;
  if (!hasLive) {
    // Fix 1: don't flip date while games from the current poll date are still in state.gameStates
    var hasGamesFromCurrentDate=state.pollDateStr&&Object.values(state.gameStates).some(function(g){
      return g.gameDateMs&&localDateStr(new Date(g.gameDateMs))===state.pollDateStr;
    });
    // Fix 3: safety net — don't advance past midnight until 6 AM local (skip in demo mode)
    if (!hasGamesFromCurrentDate&&!isMidnightWindow) {
      state.pollDateStr=localDateStr(getEffectiveDate());
    }
    // Day rollover: post-slate past midnight window → prune yesterday + advance to today.
    // Guard state.pollDateStr<todayStr so PPD-only days don't keep advancing into the future.
    else if (!isMidnightWindow&&isPostSlate()) {
      var todayStr=localDateStr(getEffectiveDate());
      if (state.pollDateStr<todayStr) {
        pruneStaleGames(todayStr);
        state.pollDateStr=todayStr;
      }
    }
  }
  var dateStr=state.pollDateStr;
  try {
    // Fetch from primary date
    var r=await fetch(MLB_BASE+'/schedule?sportId=1&date='+dateStr+'&hydrate=linescore,team,probablePitcher',{signal:sig});
    if(!r.ok) throw new Error(r.status);
    var d=await r.json();
    var games=(d.dates||[]).flatMap(function(dt){return dt.games||[]});
    devTrace('poll','schedule fetch · date='+dateStr+' · games='+games.length);

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
        state.pollDateStr=dateStr;
      }
    }
    state.storyCarouselRawGameData={};
    games.forEach(function(g){state.storyCarouselRawGameData[g.gamePk]=g;});
    var pendingFinalItems={};
    games.forEach(function(g) {
      var pk=g.gamePk, newStatus=g.status.abstractGameState, detailed=g.status.detailedState||'';
      var away=g.teams.away, home=g.teams.home;
      var awayTc=tcLookup(away.team.id), homeTc=tcLookup(home.team.id);
      var ls=g.linescore||{}, gameTime=null, gameDateMs=null;
      if (g.gameDate) {
        try { var gd=new Date(g.gameDate); gameTime=gd.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}); gameDateMs=gd.getTime(); } catch(e){}
      }
      if (!state.gameStates[pk]) {
        state.gameStates[pk]={
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
        if (!state.myTeamLens || state.gameStates[pk].awayId===state.activeTeam.id || state.gameStates[pk].homeId===state.activeTeam.id) state.enabledGames.add(pk);
        // Synthesise historical status items so they appear on first load (no sounds/alerts)
        var g0=state.gameStates[pk], ts0=gameDateMs?new Date(gameDateMs):new Date();
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
        var prev=state.gameStates[pk];
        if (gameTime) prev.gameTime=gameTime; if (gameDateMs) prev.gameDateMs=gameDateMs;
        if (prev.detailedState!=='In Progress'&&detailed==='In Progress') {
          addFeedItem(pk,{type:'status',icon:'⚾',label:'Game underway!',sub:prev.awayAbbr+' @ '+prev.homeAbbr});
          playSound('gameStart');
        }
        if (prev.status!=='Final'&&newStatus==='Final') {
          devTrace('poll','game final · '+prev.awayAbbr+' @ '+prev.homeAbbr+' · '+prev.awayScore+'-'+prev.homeScore);
          var isGamePostponed=detailed==='Postponed'||detailed==='Cancelled'||detailed==='Suspended';
          if(isGamePostponed){addFeedItem(pk,{type:'status',icon:'🌧️',label:'Game Postponed',sub:prev.awayAbbr+' @ '+prev.homeAbbr});}
          else{addFeedItem(pk,{type:'status',icon:'🏁',label:'Game Final',sub:prev.awayAbbr+' '+(away.score||0)+', '+prev.homeAbbr+' '+(home.score||0)});playSound('gameEnd');}
          delete state.perfectGameTracker[pk];
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
      var gamePlays=state.feedItems.filter(function(fi){return fi.gamePk==pk&&fi.data&&fi.data.type==='play';});
      if (gamePlays.length>0) addFeedItem(+pk,{type:'status',icon:'🏁',label:'Game Final',sub:pf.sub,playTime:new Date(gamePlays[0].ts.getTime()+60000)});
    });
    if (state.isFirstPoll&&state.feedItems.length>0){state.feedItems.sort(function(a,b){return b.ts-a.ts;});renderFeed();}
    state.isFirstPoll=false;
    updateInningStates();
    renderTicker(); updateFeedEmpty();
    renderSideRailGames();
    pollPendingVideoClips();
    selectFocusGame();
    refreshDebugPanel();
    var live=Object.values(state.gameStates).filter(function(g){return g.status==='Live'&&g.detailedState==='In Progress';}).length;
    var final=Object.values(state.gameStates).filter(function(g){return g.status==='Final';}).length;
    devTrace('poll','pollLeaguePulse end · live='+live+' · final='+final+' · games='+Object.keys(state.gameStates).length+' · enabled='+state.enabledGames.size+' · state.feedItems='+state.feedItems.length);
  } catch(e){if(e.name!=='AbortError')console.error('poll error',e);}
}

async function pollGamePlays(gamePk) {
  try {
    var g=state.gameStates[gamePk]; if (!g) return;
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
    var lastCount=g.playCount||0, isHistory=(lastCount===0&&plays.length>0)||state.tabHiddenAt!==null;
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
          if (!state.stolenBaseEvents.some(function(e){return e.key===sbKey;})) {
            state.stolenBaseEvents.push({key:sbKey,gamePk:gamePk,runnerId:sbRunnerId,runnerName:sbRunnerName,base:sbBase,inning:inning,halfInning:halfInning,awayAbbr:g.awayAbbr,homeAbbr:g.homeAbbr,ts:playTime||new Date()});
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
      if(state.perfectGameTracker[gamePk]===undefined) state.perfectGameTracker[gamePk]=true;
      if(['Walk','Hit By Pitch','Intentional Walk','Error','Fielders Choice','Catcher Interference'].indexOf(event)!==-1) state.perfectGameTracker[gamePk]=false;
      if(isHitEvt) state.perfectGameTracker[gamePk]=false;
      if (isHitEvt&&batterId){var dh=state.dailyHitsTracker[batterId]||{name:batterName,hits:0,hrs:0,gamePk:gamePk};dh.hits++;if(event==='Home Run')dh.hrs++;dh.name=batterName||dh.name;dh.gamePk=gamePk;state.dailyHitsTracker[batterId]=dh;}
      if (event==='Strikeout'&&pitcherId){var kkey=gamePk+'_'+pitcherId;var ke=state.dailyPitcherKs[kkey]||{name:pitcherName,ks:0,gamePk:gamePk};ke.ks++;ke.name=pitcherName||ke.name;state.dailyPitcherKs[kkey]=ke;}
      if (!isHistory) {
        var teamColor=halfInning==='top'?g.awayPrimary:g.homePrimary;
        var gameVisible=state.enabledGames.has(gamePk);
        if (event==='Home Run'){playSound('hr');if(batterId&&gameVisible){var _hrRbi=(play.result&&play.result.rbi!=null)?play.result.rbi:1;var _badge=getHRBadge(_hrRbi,halfInning,inning,aScore,hScore);showPlayerCard(batterId,batterName,g.awayId,g.homeId,halfInning,null,desc,_badge,gamePk);}}
        else if (isScoringP){var _rbi=(play.result&&play.result.rbi!=null)?play.result.rbi:0;var _rs=calcRBICardScore(_rbi,event,aScore,hScore,inning,halfInning);var _rbiOk=(Date.now()-(state.rbiCardCooldowns[gamePk]||0))>=state.devTuning.rbiCooldown;
if(_rbi>0&&_rs>=state.devTuning.rbiThreshold&&gameVisible&&batterId&&_rbiOk){state.rbiCardCooldowns[gamePk]=Date.now();showRBICard(batterId,batterName,g.awayId,g.homeId,halfInning,_rbi,event,aScore,hScore,inning,gamePk);}else{if(gameVisible)showAlert({icon:'🟢',event:'RUN SCORES · '+g.awayAbbr+' '+aScore+', '+g.homeAbbr+' '+hScore,desc:desc,color:teamColor,duration:4000});}playSound('run');}
        else if (event.indexOf('Triple Play')!==-1){if(gameVisible)showAlert({icon:'🔀',event:'TRIPLE PLAY · '+g.awayAbbr+' @ '+g.homeAbbr,desc:desc,color:'#9b59b6',duration:5000});playSound('tp');}
        else if (event.indexOf('Double Play')!==-1||event.indexOf('Grounded Into DP')!==-1){playSound('dp');}
        else if (event.indexOf('Error')!==-1){playSound('error');}
        else if (hasRISP){playSound('risp');}
        if(outs===3){var _rk=gamePk+'_'+inning+'_'+halfInning.toLowerCase();if(!state.inningRecapsFired.has(_rk))state.inningRecapsPending[_rk]={gamePk:gamePk,inning:inning,halfInning:halfInning.toLowerCase()};}
      }
    });
    // Patch Statcast distance and HR number into existing HR feed items once the data arrives
    plays.forEach(function(play){
      if(play.result&&play.result.event==='Home Run'){
        var newDesc=(play.result.description)||'';
        var pt=null;try{if(play.about&&play.about.startTime)pt=new Date(play.about.startTime);}catch(e){}
        var found=state.feedItems.find(function(i){return i.gamePk===gamePk&&i.data&&i.data.event==='Home Run'&&pt&&i.ts&&Math.abs(i.ts.getTime()-pt.getTime())<5000;});
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
    gameStates:state.gameStates,
    feedItems:state.feedItems.map(function(item){return{gamePk:item.gamePk,playTime:item.playTime.toISOString(),type:item.type,event:item.event,desc:item.desc,badge:item.badge,scoring:item.scoring,inning:item.inning,halfInning:item.halfInning,outs:item.outs,awayScore:item.awayScore,homeScore:item.homeScore,data:item.data};}),
    dailyLeadersCache:state.dailyLeadersCache||{},
    onThisDayCache:state.onThisDayCache||[],
    yesterdayCache:state.yesterdayCache||[],
    hrBatterStatsCache:state.hrBatterStatsCache,
    probablePitcherStatsCache:state.probablePitcherStatsCache,
    dailyHitsTracker:state.dailyHitsTracker,
    dailyPitcherKs:state.dailyPitcherKs,
    storyCarouselRawGameData:state.storyCarouselRawGameData,
    stolenBaseEvents:state.stolenBaseEvents,
    scheduleData:state.scheduleData
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


// ── Feed Render (v3.39.22) ─── EXTRACTED to feed/render.js
// Functions imported: renderTicker, renderSideRailGames, addFeedItem, buildFeedEl,
// renderFeed, renderEmptyState, updateFeedEmpty, isPostSlate, isIntermission,
// fetchTomorrowPreview, pulseGreeting, baseDiamondSvg, startCountdown, showAlert, dismissAlert

function showNewsUnavailable() {
  var container=document.getElementById('newsCard');
  if(container) {
    container.innerHTML='<div style="color:var(--muted);font-size:.75rem;padding:20px;text-align:center;">News feed unavailable</div>';
  }
}

// ── Story Carousel (v3.39.14) ─── EXTRACTED to carousel/rotation.js + carousel/generators.js
// Functions now imported: buildStoryPool, rotateStory, showStoryCard, renderStoryCard,
// updateStoryDots, prevStory, nextStory, onStoryVisibilityChange

function updateInningStates(){
  // Called after gameStates are updated; actual state mutations happen in genInningRecapStories
}

// ── Debug Panel (v2.7.1) ──────────────────────────────────────────────────────
function refreshDebugPanel(){
  var panel=document.getElementById('debugPanel');
  if(!panel) return;

  var now=Date.now();
  var gameStatesArr=Object.values(state.gameStates);
  var liveCount=gameStatesArr.filter(function(g){return g.status==='Live';}).length;
  var finalCount=gameStatesArr.filter(function(g){return g.status==='Final';}).length;
  var previewCount=gameStatesArr.filter(function(g){return g.status==='Preview'||g.status==='Scheduled';}).length;

  var tier1=state.storyPool.filter(function(s){return s.tier===1;}).length;
  var tier2=state.storyPool.filter(function(s){return s.tier===2;}).length;
  var tier3=state.storyPool.filter(function(s){return s.tier===3;}).length;
  var tier4=state.storyPool.filter(function(s){return s.tier===4;}).length;

  var nextPollIn=Math.round((1042-Date.now())%15000/1000); if(nextPollIn<0)nextPollIn+=15;
  var nextRotateIn=state.storyRotateTimer?Math.round((state.devTuning.rotateMs-(now%(state.devTuning.rotateMs||20000)))/1000):'—';

  var html='<div style="padding:0;line-height:1.6">';
  html+='<div style="font-weight:600;margin-bottom:6px;color:var(--accent)">📊 Service Health</div>';
  html+='<div>Polls active: '+Object.keys(state.gameStates).length+'</div>';
  html+='<div>Live/Final/Preview: '+liveCount+' / '+finalCount+' / '+previewCount+'</div>';
  html+='<div>Feed items: '+state.feedItems.length+'</div>';
  html+='<div>Next poll in: '+nextPollIn+'s</div>';
  html+='<div style="margin-top:8px;font-weight:600;color:var(--accent)">💾 Caches</div>';
  html+='<div>On This Day: '+(state.onThisDayCache?state.onThisDayCache.length+' stories':'loading…')+'</div>';
  html+='<div>Yesterday: '+(state.yesterdayCache?state.yesterdayCache.length+' stories':'loading…')+'</div>';
  html+='<div>Daily Leaders: '+(state.dailyLeadersCache?'loaded':'loading…')+'</div>';
  html+='<div style="margin-top:8px;font-weight:600;color:var(--accent)">🎯 Story Pool ('+state.storyPool.length+')</div>';
  html+='<div>Tier 1/2/3/4: '+tier1+' / '+tier2+' / '+tier3+' / '+tier4+'</div>';
  html+='<div>Rotation active: '+(state.storyRotateTimer?'yes':'no')+'</div>';
  html+='<div>Next rotate in: '+nextRotateIn+'s</div>';
  html+='<div style="margin-top:8px;font-weight:600;color:var(--accent);margin-bottom:4px">All Stories ('+state.storyPool.length+')</div>';
  if(state.storyPool.length){
    state.storyPool.forEach(function(s,idx){
      var cooldownRemain=s.lastShown?Math.max(0,Math.round((s.cooldownMs-(now-s.lastShown.getTime()))/1000)):'—';
      var age=Math.round((now-s.ts.getTime())/1000);
      var ageStr=age<60?age+'s':Math.floor(age/60)+'m';
      var decay=Math.pow(Math.max(0,1-s.decayRate),age/60000/30);
      var score=s.priority*decay;
      var shownStr=s.lastShown?'shown '+Math.floor((now-s.lastShown.getTime())/1000)+'s ago':'never';
      var isCurrent=s.id===state.storyShownId?' ★':'';
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


// DEBUG: Replay an HR card from live feed (call replayHRCard() from console, or press Shift+H)
function replayHRCard(itemIndex) {
  var hrs = state.feedItems.filter(function(item) { return item.data && item.data.event === 'Home Run'; });
  if (!hrs.length) { alert('No home runs in feed yet'); return; }

  var idx = itemIndex !== undefined ? itemIndex : 0;
  if (idx < 0 || idx >= hrs.length) { alert('Index out of range'); return; }

  var item = hrs[idx];
  var play = item.data;
  var gs = state.gameStates[item.gamePk];
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

// DEBUG: Replay most recent RBI card from live feed (press Shift+B)
function replayRBICard(itemIndex) {
  var rbis = state.feedItems.filter(function(item) { return item.data && item.data.scoring && item.data.event !== 'Home Run' && item.data.batterId; });
  if (!rbis.length) { alert('No RBI plays in feed yet'); return; }
  var idx = itemIndex !== undefined ? itemIndex : 0;
  if (idx < 0 || idx >= rbis.length) { alert('Index out of range'); return; }
  var item = rbis[idx];
  var play = item.data;
  var gs = state.gameStates[item.gamePk];
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
  devTrace('collect',(playerName||'?')+' · '+eventType+' · tier='+tier+(rbi?' · rbi='+rbi:'')+(force?' [forced]':''));

  if (state.demoMode && !force) {
    // Simulate the collection outcome so the rail flash message works during demo playback
    var demoCol = loadCollection();
    var demoEx = demoCol[key];
    if (!demoEx) {
      state.lastCollectionResult = { type:'new', playerName:playerName, eventType:eventType, tier:tier };
    } else {
      var dRank = tierRank(tier), dExRank = tierRank(demoEx.tier);
      state.lastCollectionResult = {
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
    state.lastCollectionResult = { type:'new', playerName:playerName, eventType:eventType, tier:tier };
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
      state.lastCollectionResult = { type:'upgrade', playerName:playerName, eventType:eventType, tier:tier };
      showCollectedToast('upgrade', playerName, eventType, tier);
    } else if (newRank === existRank) {
      if (existing.events.length < 10) existing.events.push(eventCtx);
      state.lastCollectionResult = { type:'dup', playerName:playerName, eventType:eventType, tier:tier };
      showCollectedToast('dup', playerName, eventType, tier);
    }
    // lower tier → silent no-op
  }
  saveCollection(col);
  updateCollectionUI();
  if(state.mlbSessionToken)syncCollection();
  else showSignInCTA();
}

async function fetchCareerStats(playerId, position) {
  if (state.collectionCareerStatsCache[playerId]) return state.collectionCareerStatsCache[playerId];
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
    state.collectionCareerStatsCache[playerId] = result;
    return result;
  } catch(e) { return null; }
}

function openCollection() {
  var el = document.getElementById('collectionOverlay');
  if (!el) return;
  state.collectionPage = 0;
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
  state.yesterdayOverlayOpen=true;
  // reset to yesterday on every open so the date picker starts fresh
  state.ydDateOffset=-1;
  state.ydDisplayCache=null;
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
  var newOffset=state.ydDateOffset+dir;
  if(newOffset>=0) return; // block today and future
  if(newOffset<-365) return; // reasonable floor
  state.ydDateOffset=newOffset;
  // update label and button states
  var lbl=document.getElementById('ydDateLabel');
  if(lbl) lbl.textContent=getYesterdayDisplayStr();
  var nextBtn=document.getElementById('ydNextDateBtn');
  if(nextBtn) nextBtn.disabled=(state.ydDateOffset>=-1);
  // show loading state while fetching
  var card=document.getElementById('yesterdayCard');
  if(card) card.innerHTML='<div style="padding:48px;text-align:center;color:var(--muted);font-size:.88rem">Loading…</div>';
  // clear any existing hero player to avoid stale video showing
  var heroRegion=document.getElementById('ydHeroRegion');
  if(heroRegion){heroRegion.dataset.mounted='';heroRegion.innerHTML='';}
  // load data for the selected date (or reuse state.yesterdayCache for -1)
  if(state.ydDateOffset===-1){
    state.ydDisplayCache=null;
  }else{
    state.ydDisplayCache=await loadYdForDate(getYesterdayDateStr());
  }
  renderYesterdayRecap();
  window.scrollTo(0,0);
}

function closeYesterdayRecap() {
  state.yesterdayOverlayOpen=false;
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
  var d=new Date(); d.setDate(d.getDate()+state.ydDateOffset);
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}

function getYesterdayDisplayStr() {
  var d=new Date(); d.setDate(d.getDate()+state.ydDateOffset);
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
  if(state.yesterdayContentCache[gamePk]) return state.yesterdayContentCache[gamePk];
  try {
    var r=await fetch(MLB_BASE+'/game/'+gamePk+'/content');
    var d=await r.json();
    state.yesterdayContentCache[gamePk]=d;
    return d;
  } catch(e){ state.yesterdayContentCache[gamePk]=null; return null; }
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
  if(state.lastVideoClip&&pickPlayback(state.lastVideoClip.playbacks)){
    openVideoOverlay(pickPlayback(state.lastVideoClip.playbacks),state.lastVideoClip.headline||state.lastVideoClip.blurb||'Highlight');
    return;
  }
  // 2. Use any cached yesterday content
  var keys=Object.keys(state.yesterdayContentCache);
  for(var i=0;i<keys.length;i++){
    var c=state.yesterdayContentCache[keys[i]];
    if(!c) continue;
    var items=(c.highlights&&c.highlights.highlights&&c.highlights.highlights.items)||[];
    var playable=items.filter(function(it){return it.type==='video'&&pickPlayback(it.playbacks);});
    if(playable.length){
      var clip=playable[2]||playable[0];
      state.lastVideoClip=clip;
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
    state.lastVideoClip=playable2[0];
    openVideoOverlay(pickPlayback(playable2[0].playbacks),playable2[0].headline||playable2[0].blurb||'Highlight');
  }catch(e){alert('Could not load clip: '+(e&&e.message||e));}
}

async function pollPendingVideoClips() {
  // Scan state.feedItems for HR and scoring plays whose feed element hasn't been patched with a clip yet.
  var cutoff=Date.now()-2*60*60*1000;
  var feed=document.getElementById('feed');
  if(!feed) return;
  var pending=state.feedItems.filter(function(item){
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
    var cached=state.liveContentCache[gpk];
    if(!cached||(Date.now()-cached.fetchedAt)>5*60*1000){
      try{
        var r=await fetch(MLB_BASE+'/game/'+gpk+'/content');
        if(!r.ok) continue;
        var d=await r.json();
        var all=(d.highlights&&d.highlights.highlights&&d.highlights.highlights.items)||[];
        // Keep only playable video clips; exclude data-visualization (darkroom, bat-track, etc.)
        state.liveContentCache[gpk]={items:all.filter(function(it){
          if(it.type!=='video'||!pickPlayback(it.playbacks)) return false;
          return !(it.keywordsAll||[]).some(function(kw){
            var v=(kw.value||kw.slug||'').toLowerCase();
            return v==='data-visualization'||v==='data_visualization';
          });
        }),fetchedAt:Date.now()};
      }catch(e){continue;}
    }
    var clips=(state.liveContentCache[gpk]&&state.liveContentCache[gpk].items)||[];
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
    // Exclude ABS challenge clips — they carry the batter's player_id but are pitch-review
    // overlays, not batting highlight replays. Their timestamps fall before the actual hit
    // clip, causing nearest-timestamp matching to pick them over the correct clip.
    function isABSChallenge(clip){
      var tax=(clip.keywordsAll||[]).filter(function(kw){return kw.type==='taxonomy';});
      var hasAbs=tax.some(function(kw){return (kw.value||kw.slug||'').toLowerCase()==='abs';});
      var hasChallenge=tax.some(function(kw){return (kw.value||kw.slug||'').toLowerCase()==='challenge';});
      return hasAbs&&hasChallenge;
    }
    var broadcastClips=clips.filter(function(c){return !isStatcast(c)&&!isABSChallenge(c);});
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
      // Only match when the clip carries the batter's player_id.
      // Timestamp fallback was removed: it confidently patched the wrong play's clip
      // (e.g. a sac fly clip onto a HR feed item) whenever the real clip wasn't
      // published yet. No clip is better than the wrong clip — unpatched items retry
      // on the next 30s poll.
      var playerFromScoring=scoringClips.filter(hasPlayer);
      var playerFromBroadcast=broadcastClips.filter(hasPlayer);
      var pool=playerFromScoring.length?playerFromScoring:playerFromBroadcast;
      var best=null,bestDiff=Infinity;
      pool.forEach(function(clip){
        var clipTs=clip.date?new Date(clip.date).getTime():null;
        if(!clipTs) return;
        var diff=Math.abs(clipTs-playTs);
        if(diff<bestDiff){bestDiff=diff;best=clip;}
      });
      if(best){
        state.lastVideoClip=best;
        patchFeedItemWithClip(playTs,gpk,best);
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
  var hrItems=state.feedItems.filter(function(item){
    if(!item.data||!item.data.batterId) return false;
    if(item.data.event!=='Home Run'&&!item.data.scoring) return false;
    return item.ts&&item.ts.getTime()>=cutoff;
  });
  html+='<div style="margin-bottom:16px;border:1px solid var(--border);border-radius:8px;overflow:hidden">';
  html+='<div style="background:var(--card2);padding:8px 12px;font-weight:700;color:var(--text)">🎯 HR / scoring plays in last 2h — '+hrItems.length+' found</div>';
  if(!hrItems.length){
    html+='<div style="padding:8px 12px;color:var(--muted)">No qualifying plays in state.feedItems yet.</div>';
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

  // ── Section 2: state.liveContentCache per game ───────────────────────────────────
  var pks=Object.keys(state.liveContentCache);
  html+='<div style="margin-bottom:8px;font-weight:700;color:var(--text);font-size:.8rem">📦 state.liveContentCache — '+pks.length+' game'+(pks.length===1?'':'s')+'</div>';
  if(!pks.length){
    html+='<div style="color:var(--muted);padding:8px 0 4px">No content fetched yet. Click "↻ Fetch Now" above after HR plays appear in the feed.</div>';
  }
  pks.forEach(function(pk){
    var entry=state.liveContentCache[pk];
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
  var pendingItems=state.feedItems.filter(function(item){
    return item.data&&item.data.batterId&&(item.data.event==='Home Run'||item.data.scoring)&&item.ts&&item.ts.getTime()>=cutoff;
  }).map(function(item){
    var domEl=feed&&feed.querySelector('[data-ts="'+item.ts.getTime()+'"][data-gamepk="'+item.gamePk+'"]');
    return {gamePk:item.gamePk,batterName:item.data.batterName,batterId:item.data.batterId,event:item.data.event,ts:item.ts.toISOString(),clipPatched:!!(domEl&&domEl.dataset.clipPatched==='1')};
  });
  var cacheOut={};
  Object.keys(state.liveContentCache).forEach(function(pk){
    var entry=state.liveContentCache[pk];
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
    var noGamesMsg=state.ydDateOffset===-1?'No games yesterday.':'No games played on '+getYesterdayDisplayStr()+'.';
    card.innerHTML='<div class="empty-state" style="padding:48px 24px">'+noGamesMsg+'</div>';
    return;
  }

  var ydCards=getYesterdayCollectedCards();
  var cardsHtml='';
  if(ydCards.length&&window.CollectionCard){
    // Pre-fetch career stats for all cards (same pattern as renderCollectionBook)
    await Promise.all(ydCards.map(function(s){
      return state.collectionCareerStatsCache[s.playerId]
        ? Promise.resolve()
        : fetchCareerStats(s.playerId, s.position).then(function(cs){ if(cs) state.collectionCareerStatsCache[s.playerId]=cs; });
    }));
    var miniCards=ydCards.map(function(s){
      var key=s.playerId+'_'+s.eventType;
      var displayEvent=s.events&&s.events[0]||null;
      var careerStats=state.collectionCareerStatsCache[s.playerId]||null;
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
    var g=state.gameStates[item.gamePk];
    // Parse teams from headline: "Yesterday: WIN beat LOS W-L · ..."
    var awayId=null,homeId=null;
    // Try to get team IDs from state.scheduleData
    var sched=(state.scheduleData||[]).find(function(s){return s.gamePk===item.gamePk||s.gamePk===+item.gamePk;});
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
    var contentItems=(state.yesterdayContentCache[item.gamePk]&&state.yesterdayContentCache[item.gamePk].highlights&&state.yesterdayContentCache[item.gamePk].highlights.highlights&&state.yesterdayContentCache[item.gamePk].highlights.highlights.items)||[];
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
  state.ydHighlightClips=[];
  ordered.forEach(function(game){
    var content=state.yesterdayContentCache[game.gamePk];
    if(!content) return;
    var items=(content.highlights&&content.highlights.highlights&&content.highlights.highlights.items)||[];
    var playable=items.filter(function(item){return !!pickPlayback(item.playbacks);});
    // Take indices 2, 3, 4 — actual play highlights (skip 0=recap, 1=condensed)
    playable.slice(2,5).forEach(function(clip){ state.ydHighlightClips.push(clip); });
  });
  if(!state.ydHighlightClips.length) return;
  mountSharedPlayer(heroRegion);
  var existing=document.getElementById('ydClipCarousel');
  if(existing) existing.parentNode.removeChild(existing);
  var chips=state.ydHighlightClips.map(function(clip,i){
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
    pickPlayback(state.ydHighlightClips[0].playbacks),
    pickHeroImage(state.ydHighlightClips[0])||'',
    state.ydHighlightClips[0].headline||state.ydHighlightClips[0].blurb||'Top Highlight',
    state.ydHighlightClips[0].blurb||'',
    'TOP HIGHLIGHT'
  );
}

function selectYdClip(idx) {
  var carousel=document.getElementById('ydClipCarousel');
  if(carousel) carousel.querySelectorAll('.yd-clip-chip').forEach(function(c,i){ c.classList.toggle('active',i===idx); });
  var clip=state.ydHighlightClips[idx];
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
  // Returns array of hero objects derived purely from state.yesterdayContentCache — no new fetches
  var heroes=[];
  var seenPlayers={};
  var ydCache=getYdActiveCache();
  if(!ydCache.length) return heroes;
  ydCache.forEach(function(cacheItem){
    var content=state.yesterdayContentCache[cacheItem.gamePk];
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
  var heroesLabel=state.ydDateOffset===-1?'YESTERDAY\'S HEROES':'HEROES · '+getYesterdayDisplayStr().toUpperCase();
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
  var content=state.yesterdayContentCache[gamePk];
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

function filterCollection(f) { state.collectionFilter = f; state.collectionPage = 0; renderCollectionBook(); }
function sortCollection(s)   { state.collectionSort = s;   state.collectionPage = 0; renderCollectionBook(); }
function goCollectionPage(dir) {
  var col = loadCollection();
  var slots = Object.values(col);
  if (state.collectionFilter !== 'all') slots = slots.filter(function(s) { return s.eventType === state.collectionFilter; });
  if (state.collectionSort === 'team') {
    var abbrs = [];
    slots.forEach(function(s) { if (abbrs.indexOf(s.teamAbbr) === -1) abbrs.push(s.teamAbbr); });
    abbrs.sort();
    state.collectionPage = Math.max(0, Math.min(abbrs.length - 1, state.collectionPage + dir));
  } else {
    var totalPages = Math.max(1, Math.ceil(slots.length / 9));
    state.collectionPage = Math.max(0, Math.min(totalPages - 1, state.collectionPage + dir));
  }
  renderCollectionBook();
}

async function renderCollectionBook() {
  var book = document.getElementById('collectionBook');
  if (!book) return;
  var col = loadCollection();
  var slots = Object.values(col);
  if (state.collectionFilter !== 'all') slots = slots.filter(function(s) { return s.eventType === state.collectionFilter; });
  var teamContext = null;
  if (state.collectionSort === 'rarity') {
    slots.sort(function(a,b) { return tierRank(b.tier) - tierRank(a.tier) || b.collectedAt - a.collectedAt; });
  } else if (state.collectionSort === 'team') {
    // Build sorted unique team list, then isolate the current team as a single page
    var teamAbbrs = [];
    slots.forEach(function(s) { if (teamAbbrs.indexOf(s.teamAbbr) === -1) teamAbbrs.push(s.teamAbbr); });
    teamAbbrs.sort();
    var teamCount = teamAbbrs.length;
    state.collectionPage = Math.max(0, Math.min(Math.max(0, teamCount - 1), state.collectionPage));
    var currentAbbr = teamAbbrs[state.collectionPage] || '';
    slots = slots.filter(function(s) { return s.teamAbbr === currentAbbr; });
    slots.sort(function(a,b) { return tierRank(b.tier) - tierRank(a.tier); });
    var td = TEAMS.find(function(t) { return t.short === currentAbbr; });
    teamContext = {
      abbr: currentAbbr,
      primary:   (td && td.primary)   || '#444444',
      secondary: (td && td.secondary) || '#888888',
      teamId:    td ? td.id : null,
      teamIdx:   state.collectionPage,
      teamCount: teamCount,
    };
  } else {
    slots.sort(function(a,b) { return b.collectedAt - a.collectedAt; });
  }

  if (state.collectionSort !== 'team') {
    var totalPages = Math.max(1, Math.ceil(slots.length / 9));
    state.collectionPage = Math.min(state.collectionPage, totalPages - 1);
  }

  // Fetch career stats for visible slots (all slots in team view; current page for others)
  var pageSlots = (state.collectionSort === 'team')
    ? slots
    : slots.slice(state.collectionPage * 9, (state.collectionPage + 1) * 9);
  var careerStatsMap = Object.assign({}, state.collectionCareerStatsCache);
  await Promise.all(pageSlots.map(async function(slot) {
    if (!careerStatsMap[slot.playerId]) {
      var cs = await fetchCareerStats(slot.playerId, slot.position);
      if (cs) careerStatsMap[slot.playerId] = cs;
    }
  }));

  state.collectionSlotsDisplay = slots.slice(); // snapshot for openCardFromCollection index lookup
  book.innerHTML = window.CollectionCard.renderBook({
    slots: slots,
    filter: state.collectionFilter,
    sort: state.collectionSort,
    page: state.collectionPage,
    careerStatsMap: careerStatsMap,
    teamContext: teamContext,
  });
}

function openCardFromCollection(idx) {
  var slot = state.collectionSlotsDisplay[idx];
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
    var careerStats = state.collectionCareerStatsCache[slot.playerId];
    var overrideStats = null;
    if (careerStats && careerStats.careerHR !== undefined) {
      overrideStats = {
        avg:       careerStats.careerAVG,
        ops:       careerStats.careerOPS,
        homeRuns:  careerStats.careerHR,
        rbi:       careerStats.careerRBI,
        _position: slot.position,  // fallback for state.rosterData miss
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
  // where state.collectionSlotsDisplay may not be populated yet
  var col=loadCollection();
  var slot=col[key];
  if(!slot||!slot.events||!slot.events.length) return;
  // Sync state.collectionSlotsDisplay so openCardFromCollection(idx) works if called later
  var sorted=Object.values(col).sort(function(a,b){return (b.collectedAt||0)-(a.collectedAt||0);});
  state.collectionSlotsDisplay=sorted;
  var idx=sorted.indexOf(slot);
  if(idx===-1){ state.collectionSlotsDisplay.push(slot); idx=state.collectionSlotsDisplay.length-1; }
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
  if (!state.lastCollectionResult) return;
  var el = document.getElementById('collectionRailModule');
  if (!el) return;
  var r = state.lastCollectionResult;
  state.lastCollectionResult = null;
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
  var rosterEntries = (state.rosterData.hitting || []).map(function(p) {
    return {
      personId:   p.person.id,
      personName: p.person.fullName,
      teamData:   state.activeTeam,
      position:   (p.position && p.position.abbreviation) || 'OF'
    };
  });

  // League leaders pool — hitting categories from leagueLeadersCache and state.dailyLeadersCache
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
  if (state.dailyLeadersCache) {
    var hitCats = { homeRuns:1, battingAverage:1, runsBattedIn:1, stolenBases:1 };
    var hitOnly = {};
    Object.keys(state.dailyLeadersCache).forEach(function(k){ if(hitCats[k]) hitOnly[k]=state.dailyLeadersCache[k]; });
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
  }, true);  // force=true bypasses state.demoMode guard
}

function resetCollection() {
  if (!confirm('Reset collection? This cannot be undone.')) return;
  localStorage.removeItem('mlb_card_collection');
  updateCollectionUI();
  if (state.mlbSessionToken) {
    fetch((window.API_BASE||'')+'/api/collection/reset',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+state.mlbSessionToken}
    }).catch(()=>{});
  }
  alert('Collection reset');
}

function localDateStr(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}

function scrollToGame(gamePk){var el=document.querySelector('[data-gamepk="'+gamePk+'"]');if(el)el.scrollIntoView({behavior:'smooth',block:'center'});}

function toggleGame(gamePk) {
  gamePk=+gamePk;
  if (state.enabledGames.has(gamePk)){
    state.enabledGames.delete(gamePk);
    document.querySelectorAll('[data-gamepk="'+gamePk+'"]').forEach(function(el){el.classList.add('feed-hidden');});
  } else {
    state.enabledGames.add(gamePk);
    document.querySelectorAll('[data-gamepk="'+gamePk+'"]').forEach(function(el){el.classList.remove('feed-hidden');});
  }
  updateFeedEmpty(); renderTicker();
}

function myTeamGamePks() {
  var out=new Set();
  Object.values(state.gameStates).forEach(function(g){
    if (g.awayId===state.activeTeam.id||g.homeId===state.activeTeam.id) out.add(g.gamePk);
  });
  return out;
}
function applyMyTeamLens(on) {
  state.myTeamLens=!!on;
  localStorage.setItem('mlb_my_team_lens', state.myTeamLens?'1':'0');
  var btn=document.getElementById('myTeamLensBtn'),knob=document.getElementById('myTeamLensKnob');
  if (btn) btn.classList.toggle('on', state.myTeamLens);
  if (knob) knob.style.left=state.myTeamLens?'21px':'2px';
  if (state.myTeamLens) {
    var keep=myTeamGamePks();
    state.enabledGames=new Set();
    keep.forEach(function(pk){ state.enabledGames.add(pk); });
    document.querySelectorAll('[data-gamepk]').forEach(function(el){
      var pk=+el.getAttribute('data-gamepk');
      el.classList.toggle('feed-hidden', !keep.has(pk));
    });
  } else {
    Object.keys(state.gameStates).forEach(function(pk){ state.enabledGames.add(+pk); });
    document.querySelectorAll('[data-gamepk]').forEach(function(el){ el.classList.remove('feed-hidden'); });
  }
  if (typeof renderTicker==='function') renderTicker();
  updateFeedEmpty();
}
function toggleMyTeamLens(){ applyMyTeamLens(!state.myTeamLens); }

function pruneStaleGames(beforeDateStr) {
  Object.keys(state.gameStates).forEach(function(pk) {
    var g=state.gameStates[pk];
    if (g.status!=='Final'||!g.gameDateMs) return;
    var gDate=localDateStr(new Date(g.gameDateMs));
    if (gDate<beforeDateStr) {
      delete state.gameStates[pk];
      state.enabledGames.delete(+pk);
    }
  });
  state.feedItems=state.feedItems.filter(function(fi){return state.gameStates[fi.gamePk]!==undefined;});
  renderFeed();
}


async function resolvePlayerCardData(batterId, batterName, awayTeamId, homeTeamId, halfInning, overrideStats, descHint, gamePk) {
  var battingTeamId = halfInning === 'top' ? awayTeamId : homeTeamId;
  var teamData = TEAMS.find(function(t) { return t.id === battingTeamId; }) || {};
  var stat = null, jerseyNumber = null, position = null;
  if (overrideStats) {
    stat = overrideStats;
  } else {
    var cached = (state.statsCache.hitting || []).find(function(e) { return e.player && e.player.id === batterId; });
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
  if (stat && batterId) state.hrBatterStatsCache[batterId] = stat;
  var rEntry = (state.rosterData.hitting || []).find(function(p) { return p.person && p.person.id === batterId; });
  if (!rEntry) rEntry = (state.rosterData.pitching || []).find(function(p) { return p.person && p.person.id === batterId; });
  if (rEntry && rEntry.jerseyNumber) jerseyNumber = rEntry.jerseyNumber;
  position = (rEntry && rEntry.position && rEntry.position.abbreviation) || null;
  // Caller-supplied hints (e.g. from collection slot) fill gaps when state.rosterData doesn't have this player
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
  if (!state.demoMode) {
    var gs = state.gameStates[gamePk] || {};
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
  var cached = (state.statsCache.hitting || []).find(function(e) { return e.player && e.player.id === batterId; });
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
  var rEntry = (state.rosterData.hitting || []).find(function(p) { return p.person && p.person.id === batterId; });
  if (!rEntry) rEntry = (state.rosterData.pitching || []).find(function(p) { return p.person && p.person.id === batterId; });
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
  if (!state.demoMode) {
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
// toggleSoundPanel imported from ./ui/sound.js
// MLB Stats API teamId → primary flagship radio broadcast (extracted from radio.net)
// `format`: 'hls' uses Hls.js (or native Safari); 'direct' is plain <audio> AAC/MP3
// Radio engine imported from src/radio/engine.js

// ── 🔍 Radio Check (v3.39.26) ─── EXTRACTED to radio/check.js
// Functions imported: openRadioCheck, closeRadioCheck, radioCheckPlay,
// radioCheckTryCustom, radioCheckStop, radioCheckSet, radioCheckSetNote,
// radioCheckReset, radioCheckCopy

// ── 📺 YouTube Debug (v3.39.27) ─── EXTRACTED to dev/youtube-debug.js
// Functions imported: openYoutubeDebug, closeYoutubeDebug, ytDebugFetchCustom,
// ytDebugApplyToTeam, runYoutubeDebugAll, runYoutubeDebugOne, ytDebugReset,
// ytDebugCopy

function fallbackCopy(text){
  var ta=document.createElement('textarea');
  ta.value=text;ta.style.position='fixed';ta.style.opacity='0';
  document.body.appendChild(ta);ta.select();
  try{document.execCommand('copy');}catch(e){}
  document.body.removeChild(ta);
}

// ── 🔍 Log Capture (Dev Tools) ───────────────────────────────────────────────
// Renders/filters/copies the in-memory devLog buffer populated at the top of app.js.
function _logLevelRank(lvl){return lvl==='error'?3:lvl==='warn'?2:1;}
function _fmtLogTs(ts){
  var d=new Date(ts);
  var pad=function(n){return n<10?'0'+n:''+n;};
  return pad(d.getHours())+':'+pad(d.getMinutes())+':'+pad(d.getSeconds())+'.'+String(d.getMilliseconds()).padStart(3,'0');
}
function _filteredDevLog(){
  var levelSel=(document.getElementById('logCaptureLevel')||{}).value||'all';
  var filter=((document.getElementById('logCaptureFilter')||{}).value||'').trim().toLowerCase();
  var minRank=levelSel==='all'?0:_logLevelRank(levelSel);
  return devLog.filter(function(e){
    if(minRank&&_logLevelRank(e.level)<minRank)return false;
    if(filter){
      var hay=(e.msg+' '+e.src+' '+e.level).toLowerCase();
      if(hay.indexOf(filter)===-1)return false;
    }
    return true;
  });
}
function renderLogCapture(){
  var list=document.getElementById('logCaptureList');
  var count=document.getElementById('logCaptureCount');
  if(!list)return;
  if(count) count.textContent='('+devLog.length+')';
  var rows=_filteredDevLog().slice(-200); // newest 200 of filtered
  if(!rows.length){
    list.innerHTML='<div class="dt-label-muted" style="padding:4px 0">No log entries match.</div>';
    return;
  }
  // Render newest at top for easier scanning
  list.innerHTML=rows.slice().reverse().map(function(e){
    var cls='dt-log-row'+(e.level==='error'?' lv-error':e.level==='warn'?' lv-warn':'');
    var tag=e.src?'<span class="lv-tag">['+escapeHtml(e.src)+']</span>':'';
    return '<div class="'+cls+'"><span class="lv-ts">'+_fmtLogTs(e.ts)+'</span>'+tag+escapeHtml(e.msg)+'</div>';
  }).join('');
}
function copyLogAsMarkdown(){
  var rows=_filteredDevLog();
  var lines=['# MLB Pulse — Log Capture','Captured: '+new Date().toISOString(),'Total entries: '+devLog.length+' (showing '+rows.length+' after filter)',''];
  if(!rows.length){lines.push('_(empty)_');}
  else{
    lines.push('| time | level | src | message |');
    lines.push('|---|---|---|---|');
    rows.forEach(function(e){
      var msg=e.msg.replace(/\|/g,'\\|').replace(/\n/g,' ↵ ');
      lines.push('| '+_fmtLogTs(e.ts)+' | '+e.level+' | '+(e.src||'-')+' | '+msg+' |');
    });
  }
  var text=lines.join('\n');
  var btn=document.getElementById('logCaptureCopyBtn');
  function flash(msg){if(!btn)return;var orig=btn.textContent;btn.textContent=msg;btn.style.background='#1f7a3a';setTimeout(function(){btn.textContent=orig;btn.style.background='';},1500);}
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(function(){flash('✓ Copied!');},function(){fallbackCopy(text);flash('✓ Copied (fallback)');});
  }else{
    fallbackCopy(text);flash('✓ Copied (fallback)');
  }
}
function clearDevLog(){
  devLog.length=0;
  renderLogCapture();
}

// ── 📊 App State Inspector (Dev Tools) ──────────────────────────────────────
// Read-only views over the major in-memory state globals: state.gameStates, state.feedItems,
// state.focusState, state.storyPool, plus a flat "context" row. Each subsection has its own
// 📋 button; the parent has a "Copy All State" that bundles everything as
// Markdown for pasting to Claude.
function _stateGameRow(g){
  if(!g)return '—';
  var matchup=(g.awayAbbr||'?')+' '+g.awayScore+' @ '+(g.homeAbbr||'?')+' '+g.homeScore;
  var inn=g.status==='Live' ? ' · '+(g.halfInning||'')+' '+(g.inning||'?')+' ('+g.outs+'o)' : '';
  var bases=(g.onFirst||g.onSecond||g.onThird) ? ' · 🏃'+(g.onFirst?'1':'·')+(g.onSecond?'2':'·')+(g.onThird?'3':'·') : '';
  return matchup+' · '+g.status+(g.detailedState&&g.detailedState!==g.status?' ('+g.detailedState+')':'')+inn+bases;
}
function _stateContext(){
  var t=(typeof state.activeTeam!=='undefined'&&state.activeTeam)||{};
  var section='?';
  try{var s=document.querySelector('.section.active');if(s) section=s.id;}catch(e){}
  return {
    version: (function(){try{return (document.title.match(/v[\d.]+/)||['?'])[0];}catch(e){return '?';}})(),
    timestamp: new Date().toISOString(),
    activeTeam: t.id ? (t.short+' (id:'+t.id+')') : '?',
    section: section,
    demoMode: typeof state.demoMode!=='undefined' ? !!state.demoMode : '?',
    pulseInitialized: typeof state.pulseInitialized!=='undefined' ? !!state.pulseInitialized : '?',
    pulseColorScheme: typeof pulseColorScheme!=='undefined' ? pulseColorScheme : '?',
    themeScope: typeof state.themeScope!=='undefined' ? state.themeScope : '?',
    themeOverride: typeof state.themeOverride!=='undefined' && state.themeOverride ? (state.themeOverride.short||'set') : null,
    themeInvert: typeof state.themeInvert!=='undefined' ? !!state.themeInvert : '?',
    devColorLocked: typeof state.devColorLocked!=='undefined' ? !!state.devColorLocked : '?',
    radioCurrentTeamId: getCurrentTeamId(),
    focusGamePk: typeof state.focusGamePk!=='undefined' ? state.focusGamePk : null,
    focusIsManual: typeof state.focusIsManual!=='undefined' ? !!state.focusIsManual : '?',
    counts: {
      gameStates: typeof state.gameStates!=='undefined' ? Object.keys(state.gameStates).length : 0,
      feedItems: typeof state.feedItems!=='undefined' ? state.feedItems.length : 0,
      storyPool: typeof state.storyPool!=='undefined' ? state.storyPool.length : 0,
      enabledGames: typeof state.enabledGames!=='undefined' ? state.enabledGames.size : 0,
      devLog: devLog.length,
    },
    viewport: window.innerWidth+'×'+window.innerHeight,
    userAgent: navigator.userAgent,
  };
}
function _stateGameStatesArr(){
  if(typeof state.gameStates==='undefined') return [];
  return Object.keys(state.gameStates).map(function(pk){
    var g=state.gameStates[pk];
    return {
      gamePk:+pk, status:g.status, detailedState:g.detailedState,
      matchup:(g.awayAbbr||'?')+'@'+(g.homeAbbr||'?'),
      score:(g.awayScore||0)+'-'+(g.homeScore||0),
      inning:(g.halfInning||'')+(g.inning||''), outs:g.outs,
      bases:(g.onFirst?'1':'')+(g.onSecond?'2':'')+(g.onThird?'3':''),
      hits:(g.awayHits||0)+'-'+(g.homeHits||0),
      enabled: typeof state.enabledGames!=='undefined' ? state.enabledGames.has(+pk) : null,
    };
  }).sort(function(a,b){
    var rank=function(s){return s==='Live'?0:s==='Preview'||s==='Scheduled'?1:2;};
    return rank(a.status)-rank(b.status);
  });
}
function _stateFeedItemsArr(limit){
  if(typeof state.feedItems==='undefined') return [];
  return state.feedItems.slice(0, limit||50).map(function(fi){
    var d=fi.data||{};
    return {
      ts: fi.ts ? fi.ts.toISOString() : null,
      gamePk: fi.gamePk,
      type: d.type,
      label: d.label || d.event || '',
      desc: (d.desc||d.sub||'').slice(0, 200),
      scoring: !!d.scoring,
      score: (d.awayScore!=null?d.awayScore:'')+(d.homeScore!=null?'-'+d.homeScore:''),
      inning: d.halfInning ? (d.halfInning+' '+(d.inning||'')) : null,
    };
  });
}
function _stateStoryPoolArr(){
  if(typeof state.storyPool==='undefined') return [];
  return state.storyPool.map(function(s){
    var cdRem=null;
    if(s.lastShown && s.cooldownMs){
      var rem=s.cooldownMs-(Date.now()-s.lastShown);
      cdRem=rem>0?Math.round(rem/1000)+'s':'ready';
    }
    return {
      id:s.id, type:s.type, tier:s.tier, priority:s.priority,
      headline:s.headline, gamePk:s.gamePk, cooldownRem:cdRem,
      lastShownAgo: s.lastShown ? Math.round((Date.now()-s.lastShown)/1000)+'s' : null,
      isShown: s.id===state.storyShownId,
    };
  }).sort(function(a,b){return (b.priority||0)-(a.priority||0);});
}
function _stateFocusObj(){
  return {
    focusGamePk: typeof state.focusGamePk!=='undefined' ? state.focusGamePk : null,
    focusIsManual: typeof state.focusIsManual!=='undefined' ? !!state.focusIsManual : '?',
    focusedGame: (typeof state.focusGamePk!=='undefined' && state.focusGamePk && typeof state.gameStates!=='undefined' && state.gameStates[state.focusGamePk])
      ? _stateGameRow(state.gameStates[state.focusGamePk]) : null,
  };
}
function _kvList(obj){
  return Object.keys(obj).map(function(k){
    var v=obj[k];
    var disp=(v==null)?'—':(typeof v==='object')?JSON.stringify(v):String(v);
    if(disp.length>200) disp=disp.slice(0,200)+'…';
    return '<div style="display:flex;gap:8px;padding:1px 0"><span style="color:var(--muted);min-width:120px">'+escapeHtml(k)+'</span><span>'+escapeHtml(disp)+'</span></div>';
  }).join('');
}
function _miniCopyBtn(action){
  return '<button data-dt-action="'+action+'" style="background:var(--card);border:1px solid var(--border);color:var(--text);font-size:.6rem;padding:2px 6px;border-radius:4px;cursor:pointer;font-weight:600">📋</button>';
}
function _section(title, action, body){
  return '<div class="dt-box"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><span class="dt-label">'+title+'</span>'+_miniCopyBtn(action)+'</div>'+body+'</div>';
}
function renderAppState(){
  var body=document.getElementById('appStateBody');
  if(!body) return;
  var ctx=_stateContext();
  var c=document.getElementById('appStateCounts');
  if(c) c.textContent='('+ctx.counts.state.gameStates+'g · '+ctx.counts.state.feedItems+'f · '+ctx.counts.state.storyPool+'s)';

  var gs=_stateGameStatesArr();
  var gsBody=gs.length
    ? '<div class="dt-mono" style="max-height:160px;overflow-y:auto">'+gs.map(function(g){
        return '<div class="dt-log-row">'+escapeHtml(g.matchup)+' · '+escapeHtml(g.status)+' · '+escapeHtml(g.score)+(g.inning?' · '+escapeHtml(g.inning)+' ('+g.outs+'o)':'')+(g.bases?' · 🏃'+escapeHtml(g.bases):'')+(g.enabled===false?' <span class="lv-tag">[hidden]</span>':'')+'</div>';
      }).join('')+'</div>'
    : '<div class="dt-label-muted">No games loaded.</div>';

  var fi=_stateFeedItemsArr(30);
  var fiBody=fi.length
    ? '<div class="dt-mono" style="max-height:160px;overflow-y:auto">'+fi.map(function(f){
        var ts=f.ts?f.ts.slice(11,19):'';
        return '<div class="dt-log-row"><span class="lv-ts">'+escapeHtml(ts)+'</span><span class="lv-tag">['+escapeHtml(String(f.type||'?'))+']</span>'+escapeHtml(f.label||f.desc||'')+(f.scoring?' ⭐':'')+'</div>';
      }).join('')+'</div>'
    : '<div class="dt-label-muted">Feed empty.</div>';

  var sp=_stateStoryPoolArr();
  var spBody=sp.length
    ? '<div class="dt-mono" style="max-height:160px;overflow-y:auto">'+sp.map(function(s){
        return '<div class="dt-log-row'+(s.isShown?' lv-warn':'')+'"><span class="lv-tag">p'+(s.priority||0)+'</span><span class="lv-tag">['+escapeHtml(String(s.type||'?'))+']</span>'+escapeHtml(s.headline||'')+(s.cooldownRem?' <span class="lv-ts">('+escapeHtml(s.cooldownRem)+')</span>':'')+(s.isShown?' ◀ shown':'')+'</div>';
      }).join('')+'</div>'
    : '<div class="dt-label-muted">Story pool empty.</div>';

  var ctxBody='<div style="font-size:.65rem">'+_kvList({
    version: ctx.version, section: ctx.section, activeTeam: ctx.activeTeam,
    demoMode: ctx.demoMode, pulseInitialized: ctx.pulseInitialized,
    pulseColorScheme: ctx.pulseColorScheme, themeScope: ctx.themeScope,
    themeOverride: ctx.themeOverride, themeInvert: ctx.themeInvert,
    devColorLocked: ctx.devColorLocked, radioCurrentTeamId: ctx.radioCurrentTeamId,
    focusGamePk: ctx.focusGamePk, focusIsManual: ctx.focusIsManual,
    viewport: ctx.viewport,
  })+'</div>';

  var focusBody='<div style="font-size:.65rem">'+_kvList(_stateFocusObj())+'</div>';

  var now=new Date();
  var greeting=pulseGreeting();
  var upcoming=Object.values(state.gameStates).filter(function(g){
    if(!(g.status==='Preview'||g.status==='Scheduled'||(g.status==='Live'&&g.detailedState!=='In Progress'))) return false;
    var rawG=state.storyCarouselRawGameData&&state.storyCarouselRawGameData[g.gamePk];
    if(rawG&&rawG.doubleHeader==='Y'&&rawG.gameNumber==2){
      if(Object.values(state.gameStates).some(function(s){return s.status==='Live'&&s.awayId===g.awayId&&s.homeId===g.homeId;})) return false;
    }
    return true;
  });
  var liveGames=Object.values(state.gameStates).filter(function(g){return g.status==='Live'&&g.detailedState==='In Progress';});
  var pulseInfo={
    now: now.toISOString().split('T')[1].split('.')[0],
    greeting: greeting.kicker+': '+greeting.headline,
    liveGames: liveGames.length,
    upcomingGames: upcoming.length,
    enabledGames: state.enabledGames.size,
    totalGames: Object.keys(state.gameStates).length,
  };
  var pulseBody='<div style="font-size:.65rem">'+_kvList(pulseInfo)+'</div>';

  body.innerHTML =
    _section('Context','copyStateContext', ctxBody) +
    _section('⚡ Pulse Diagnostics','copyStatePulse', pulseBody) +
    _section('🎯 Focus','copyStateFocus', focusBody) +
    _section('🎮 state.gameStates ('+gs.length+')','copyStateGames', gsBody) +
    _section('📰 state.feedItems (showing '+fi.length+' of '+ctx.counts.state.feedItems+')','copyStateFeed', fiBody) +
    _section('📖 state.storyPool ('+sp.length+')','copyStateStories', spBody);
}
function _copyToClipboard(text, btnId){
  var btn=btnId?document.getElementById(btnId):null;
  function flash(msg){if(!btn)return;var orig=btn.textContent;btn.textContent=msg;btn.style.background='#1f7a3a';setTimeout(function(){btn.textContent=orig;btn.style.background='';},1500);}
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(function(){flash('✓ Copied!');},function(){fallbackCopy(text);flash('✓ Copied (fb)');});
  }else{
    fallbackCopy(text);flash('✓ Copied (fb)');
  }
}
function _stateAsMarkdownContext(){
  var c=_stateContext();
  return '## Context\n\n```json\n'+JSON.stringify(c,null,2)+'\n```\n';
}
function _stateAsMarkdownGames(){
  var gs=_stateGameStatesArr();
  if(!gs.length) return '## state.gameStates\n\n_(empty)_\n';
  var lines=['## state.gameStates ('+gs.length+')','','| gamePk | matchup | status | score | inning | bases | hits | enabled |','|---|---|---|---|---|---|---|---|'];
  gs.forEach(function(g){
    lines.push('| '+g.gamePk+' | '+g.matchup+' | '+g.status+(g.detailedState&&g.detailedState!==g.status?' ('+g.detailedState+')':'')+' | '+g.score+' | '+(g.inning||'-')+(g.outs!=null?' '+g.outs+'o':'')+' | '+(g.bases||'-')+' | '+g.hits+' | '+(g.enabled==null?'-':g.enabled?'y':'n')+' |');
  });
  return lines.join('\n')+'\n';
}
function _stateAsMarkdownFeed(limit){
  var fi=_stateFeedItemsArr(limit||50);
  if(!fi.length) return '## state.feedItems\n\n_(empty)_\n';
  var lines=['## state.feedItems ('+fi.length+(typeof state.feedItems!=='undefined'&&state.feedItems.length>fi.length?' of '+state.feedItems.length:'')+')','','| time | gamePk | type | label/desc | scoring |','|---|---|---|---|---|'];
  fi.forEach(function(f){
    var ts=f.ts?f.ts.slice(11,19):'-';
    var msg=(f.label||f.desc||'').replace(/\|/g,'\\|').replace(/\n/g,' ↵ ');
    lines.push('| '+ts+' | '+f.gamePk+' | '+(f.type||'-')+' | '+msg+' | '+(f.scoring?'y':'')+' |');
  });
  return lines.join('\n')+'\n';
}
function _stateAsMarkdownStories(){
  var sp=_stateStoryPoolArr();
  if(!sp.length) return '## state.storyPool\n\n_(empty)_\n';
  var lines=['## state.storyPool ('+sp.length+')','','| priority | type | tier | headline | cooldown | shown |','|---|---|---|---|---|---|'];
  sp.forEach(function(s){
    lines.push('| '+(s.priority||0)+' | '+(s.type||'-')+' | '+(s.tier||'-')+' | '+(s.headline||'').replace(/\|/g,'\\|')+' | '+(s.cooldownRem||'-')+' | '+(s.isShown?'◀':'')+' |');
  });
  return lines.join('\n')+'\n';
}
function _stateAsMarkdownFocus(){
  return '## Focus\n\n```json\n'+JSON.stringify(_stateFocusObj(),null,2)+'\n```\n';
}
function _stateAsMarkdownPulse(){
  var now=new Date();
  var hour=now.getHours();
  var greeting=pulseGreeting();
  var upcoming=Object.values(state.gameStates).filter(function(g){
    if(!(g.status==='Preview'||g.status==='Scheduled'||(g.status==='Live'&&g.detailedState!=='In Progress'))) return false;
    var rawG=state.storyCarouselRawGameData&&state.storyCarouselRawGameData[g.gamePk];
    if(rawG&&rawG.doubleHeader==='Y'&&rawG.gameNumber==2){
      if(Object.values(state.gameStates).some(function(s){return s.status==='Live'&&s.awayId===g.awayId&&s.homeId===g.homeId;})) return false;
    }
    return true;
  });
  var liveGames=Object.values(state.gameStates).filter(function(g){return g.status==='Live'&&g.detailedState==='In Progress';});
  var finalGames=Object.values(state.gameStates).filter(function(g){return g.status==='Final';});
  var lines=['## Pulse Empty State Diagnostics','','### Current Time & Greeting','| Field | Value |','|---|---|',
    '| Now | '+now.toISOString()+' |',
    '| Hour | '+hour+' ('+greeting.kicker+') |',
    '| Greeting | '+greeting.headline+' |',
    '','### Game Counts','| State | Count |','|---|---|',
    '| Total state.gameStates | '+Object.keys(state.gameStates).length+' |',
    '| Enabled Games | '+state.enabledGames.size+' |',
    '| Live (In Progress) | '+liveGames.length+' |',
    '| Preview/Scheduled (Upcoming) | '+upcoming.length+' |',
    '| Final | '+finalGames.length+' |',
    '','### Why Empty State Shows',
    '| Reason | Active |','|---|---|',
    '| No upcoming games found | '+(upcoming.length===0?'**YES** — will show "Slate complete"':'no')+' |',
    '| Has intermission flag | '+(typeof intermission!=='undefined'&&intermission?'**YES** — will hide hype block':'no')+' |',
    '| Has live games | '+(liveGames.length>0?'**YES** — empty state should not show':'no')+' |',
    '','### All Games in state.gameStates'];
  var gameRows=['| gamePk | matchup | status | detailed | enabled | inning |','|---|---|---|---|---|---|'];
  Object.values(state.gameStates).sort(function(a,b){return (a.gameDateMs||0)-(b.gameDateMs||0);}).forEach(function(g){
    var enabled=state.enabledGames.has(g.gamePk)?'✓':'✗';
    var inning=g.status==='Live'?' '+g.inning+'i ('+g.halfInning.charAt(0)+')':'-';
    gameRows.push('| '+g.gamePk+' | '+g.awayAbbr+' @ '+g.homeAbbr+' | '+g.status+' | '+g.detailedState+' | '+enabled+' | '+inning+' |');
  });
  return lines.join('\n')+'\n'+gameRows.join('\n')+'\n';
}
function copyAppStateAsMarkdown(){
  var parts=[
    '# MLB Pulse — App State Snapshot',
    'Captured: '+new Date().toISOString(),
    '',
    _stateAsMarkdownPulse(),
    _stateAsMarkdownContext(),
    _stateAsMarkdownFocus(),
    _stateAsMarkdownGames(),
    _stateAsMarkdownFeed(50),
    _stateAsMarkdownStories(),
  ];
  _copyToClipboard(parts.join('\n'),'appStateCopyBtn');
}

// ── 🌐 Network Trace (Dev Tools) ────────────────────────────────────────────
function _shortUrl(u){
  if(!u) return '?';
  try{
    var parsed=new URL(u, window.location.href);
    var host=parsed.host || '';
    // Trim known noisy bases for readability — full URL still visible on hover/copy
    var path=parsed.pathname.replace(/^\/api\/v1(\.1)?/, '/v1$1');
    var q=parsed.search ? (parsed.search.length>40?parsed.search.slice(0,40)+'…':parsed.search) : '';
    return (host?host+' ':'')+path+q;
  }catch(e){
    return u.length>120 ? u.slice(0,120)+'…' : u;
  }
}
function _fmtBytes(n){
  if(n==null) return '-';
  if(n<1024) return n+'b';
  if(n<1048576) return (n/1024).toFixed(1)+'k';
  return (n/1048576).toFixed(2)+'M';
}
function renderNetTrace(){
  var list=document.getElementById('netTraceList');
  var count=document.getElementById('netTraceCount');
  if(!list) return;
  if(count) count.textContent='('+devNetLog.length+')';
  if(!devNetLog.length){
    list.innerHTML='<div class="dt-label-muted" style="padding:4px 0">No fetches captured yet.</div>';
    return;
  }
  // Newest first
  list.innerHTML = devNetLog.slice().reverse().map(function(e){
    var ts=_fmtLogTs(e.ts);
    var st=(e.status==null)?(e.ok===false?'ERR':'…'):e.status;
    var cls='dt-log-row';
    if(e.ok===false) cls+=' lv-error';
    else if(e.status>=400) cls+=' lv-error';
    else if(e.status>=300) cls+=' lv-warn';
    var ms=e.ms!=null?e.ms+'ms':'-';
    var size=_fmtBytes(e.sizeBytes);
    var err=e.errorMsg?'<div style="margin-left:24px;color:#ff6b6b">'+escapeHtml(e.errorMsg)+'</div>':'';
    return '<div class="'+cls+'" title="'+escapeHtml(e.url||'')+'"><span class="lv-ts">'+ts+'</span><span class="lv-tag">'+escapeHtml(e.method)+' '+st+'</span><span class="lv-ts">'+ms+' · '+size+'</span> '+escapeHtml(_shortUrl(e.url))+err+'</div>';
  }).join('');
}
function copyNetTraceAsMarkdown(){
  var lines=['# MLB Pulse — Network Trace','Captured: '+new Date().toISOString(),'Total entries: '+devNetLog.length+' (cap '+DEV_NET_CAP+')',''];
  if(!devNetLog.length){lines.push('_(empty)_');}
  else{
    lines.push('| time | method | status | ms | size | url |');
    lines.push('|---|---|---|---|---|---|');
    devNetLog.forEach(function(e){
      var url=(e.url||'').replace(/\|/g,'\\|');
      var status=(e.status==null)?(e.ok===false?'ERR':'-'):e.status;
      var ms=e.ms!=null?e.ms:'-';
      var size=_fmtBytes(e.sizeBytes);
      lines.push('| '+_fmtLogTs(e.ts)+' | '+e.method+' | '+status+' | '+ms+' | '+size+' | '+url+' |');
    });
    var failed=devNetLog.filter(function(e){return e.ok===false;});
    if(failed.length){
      lines.push('','## Failed requests ('+failed.length+')','');
      failed.forEach(function(e){lines.push('- `'+e.method+' '+(e.status||'ERR')+'` '+e.url+(e.errorMsg?' — '+e.errorMsg:''));});
    }
  }
  _copyToClipboard(lines.join('\n'),'netTraceCopyBtn');
}
function clearNetTrace(){
  devNetLog.length=0;
  renderNetTrace();
}

// ── 💾 localStorage Inspector (Dev Tools) ───────────────────────────────────
function _lsKeys(){
  var keys=[];
  try{ for(var i=0;i<localStorage.length;i++){ var k=localStorage.key(i); if(k && k.indexOf('mlb_')===0) keys.push(k); } }catch(e){}
  keys.sort();
  return keys;
}
function _lsEntry(k){
  var raw=null, parsed=null, isJson=false, bytes=0;
  try{ raw=localStorage.getItem(k); }catch(e){ raw=null; }
  if(raw!=null){
    bytes=raw.length;
    try{ parsed=JSON.parse(raw); isJson=(parsed!==null && typeof parsed==='object'); }catch(e){}
  }
  return {key:k, raw:raw, parsed:parsed, isJson:isJson, bytes:bytes};
}
function renderStorageInspector(){
  var list=document.getElementById('storageList');
  var count=document.getElementById('storageCount');
  if(!list) return;
  var keys=_lsKeys();
  if(count) count.textContent='('+keys.length+')';
  if(!keys.length){ list.innerHTML='<div class="dt-label-muted">No mlb_* keys present.</div>'; return; }
  list.innerHTML=keys.map(function(k){
    var e=_lsEntry(k);
    var preview;
    if(e.isJson){ preview='<details style="margin-top:4px"><summary style="cursor:pointer;color:var(--muted);font-size:.6rem">view JSON</summary><pre style="margin:4px 0 0;padding:6px 8px;background:var(--card);border:1px solid var(--border);border-radius:4px;font-size:.6rem;color:var(--text);white-space:pre-wrap;word-break:break-all;max-height:160px;overflow-y:auto">'+escapeHtml(JSON.stringify(e.parsed,null,2))+'</pre></details>'; }
    else if(e.raw!=null){ var disp=e.raw.length>140?e.raw.slice(0,140)+'…':e.raw; preview='<div style="margin-top:2px;color:var(--muted);font-size:.6rem">'+escapeHtml(disp)+'</div>'; }
    else preview='<div style="margin-top:2px;color:var(--muted);font-size:.6rem">(null)</div>';
    return '<div class="dt-box"><div style="display:flex;justify-content:space-between;align-items:center;gap:6px"><span style="font-weight:600;color:var(--text);font-family:ui-monospace,monospace">'+escapeHtml(k)+'</span><span class="dt-label-muted">'+_fmtBytes(e.bytes)+'</span><button data-dt-action="clearLsKey" data-ls-key="'+escapeHtml(k)+'" style="background:var(--card);border:1px solid var(--hr-border);color:var(--text);font-size:.6rem;padding:2px 6px;border-radius:4px;cursor:pointer">🗑</button></div>'+preview+'</div>';
  }).join('');
}
function clearLsKey(key){
  if(!key) return;
  if(!confirm('Remove localStorage key "'+key+'"? This may log you out / reset settings depending on the key.')) return;
  try{ localStorage.removeItem(key); pushDevLog('warn','storage',['removed key: '+key]); }catch(e){}
  renderStorageInspector();
}
function copyStorageAsMarkdown(){
  var keys=_lsKeys();
  var lines=['# MLB Pulse — localStorage Snapshot','Captured: '+new Date().toISOString(),'Keys: '+keys.length,''];
  if(!keys.length) lines.push('_(no mlb_* keys)_');
  else{
    lines.push('| key | bytes | json | preview |');
    lines.push('|---|---|---|---|');
    keys.forEach(function(k){
      var e=_lsEntry(k);
      var prev=(e.raw||'').replace(/\|/g,'\\|').replace(/\n/g,' ↵ ');
      if(prev.length>120) prev=prev.slice(0,120)+'…';
      lines.push('| `'+k+'` | '+_fmtBytes(e.bytes)+' | '+(e.isJson?'y':'')+' | '+prev+' |');
    });
    lines.push('','## Full values','');
    keys.forEach(function(k){
      var e=_lsEntry(k);
      lines.push('### `'+k+'` ('+_fmtBytes(e.bytes)+')');
      if(e.isJson) lines.push('```json',JSON.stringify(e.parsed,null,2),'```','');
      else lines.push('```',(e.raw==null?'(null)':e.raw),'```','');
    });
  }
  _copyToClipboard(lines.join('\n'),'storageCopyBtn');
}

// ── ⚙️ Service Worker Inspector (Dev Tools) ─────────────────────────────────
var _swState = {scope:null, scriptURL:null, controller:null, hasUpdate:false, lastUpdated:null, error:null};
function _refreshSWState(){
  if(!('serviceWorker' in navigator)){ _swState.error='Service Worker API not supported.'; return Promise.resolve(); }
  return navigator.serviceWorker.getRegistration().then(function(reg){
    if(!reg){ _swState.error='No registration found.'; return; }
    _swState.scope=reg.scope;
    _swState.scriptURL=(reg.active && reg.active.scriptURL) || (reg.installing && reg.installing.scriptURL) || (reg.waiting && reg.waiting.scriptURL) || null;
    _swState.controller=navigator.serviceWorker.controller ? navigator.serviceWorker.controller.scriptURL : null;
    _swState.hasUpdate=!!reg.waiting;
    _swState.error=null;
  }, function(err){ _swState.error=(err&&err.message)||String(err); });
}
function renderSWInspector(){
  var info=document.getElementById('swInfo');
  if(!info) return;
  info.innerHTML='<div class="dt-label-muted">Loading…</div>';
  _refreshSWState().then(function(){
    var rows={
      'Supported': ('serviceWorker' in navigator),
      'Scope': _swState.scope || '—',
      'Active script': _swState.scriptURL || '—',
      'Controller': _swState.controller || '(uncontrolled)',
      'Update waiting': _swState.hasUpdate ? 'YES — reload to activate' : 'no',
      'Error': _swState.error || '—',
    };
    info.innerHTML=_kvList(rows);
  });
}
function copySWStateAsMarkdown(){
  _refreshSWState().then(function(){
    var lines=['# MLB Pulse — Service Worker','Captured: '+new Date().toISOString(),''];
    lines.push('- Supported: '+('serviceWorker' in navigator));
    lines.push('- Scope: '+(_swState.scope||'-'));
    lines.push('- Active script: '+(_swState.scriptURL||'-'));
    lines.push('- Controller: '+(_swState.controller||'(uncontrolled)'));
    lines.push('- Update waiting: '+(_swState.hasUpdate?'YES':'no'));
    if(_swState.error) lines.push('- Error: '+_swState.error);
    _copyToClipboard(lines.join('\n'),'swCopyBtn');
  });
}
function swForceUpdate(){
  if(!('serviceWorker' in navigator)){ alert('Service Worker not supported.'); return; }
  navigator.serviceWorker.getRegistration().then(function(reg){
    if(!reg){ alert('No SW registration found.'); return; }
    pushDevLog('log','sw',['Force update requested']);
    reg.update().then(function(){
      pushDevLog('log','sw',['update() resolved · waiting='+!!reg.waiting]);
      if(reg.waiting){
        try{ reg.waiting.postMessage({type:'SKIP_WAITING'}); }catch(e){}
        alert('Update found. Reload the page to activate the new version.');
      }else{
        alert('No new update available — already on latest.');
      }
      renderSWInspector();
    }, function(err){
      pushDevLog('error','sw',['update() failed: '+(err&&err.message||err)]);
      alert('Update failed: '+(err&&err.message||err));
    });
  });
}
function swUnregisterAndReload(){
  if(!confirm('Unregister the service worker and reload? This forces a fresh load (clears cached app shell).')) return;
  if(!('serviceWorker' in navigator)){ location.reload(); return; }
  navigator.serviceWorker.getRegistration().then(function(reg){
    var done=function(){ try{ if(window.caches){ caches.keys().then(function(keys){ keys.forEach(function(k){ caches.delete(k); }); location.reload(true); }); } else location.reload(true); }catch(e){ location.reload(true); } };
    if(reg){ reg.unregister().then(done, done); } else done();
  });
}

// ── 🔔 Test Notification (local) ─────────────────────────────────────────────
// Calls registration.showNotification() directly — proves the on-device notification
// path works (permission, SW active, OS-level surfaces), bypassing the Vercel +
// Upstash + VAPID pipeline. End-to-end server push tests still live in
// .github/workflows/test-push.yml since /api/test-push.js requires a server secret.
function testLocalNotification(){
  if(!('Notification' in window)){ alert('Notifications not supported on this device.'); return; }
  function show(){
    if(!('serviceWorker' in navigator)){ alert('Service Worker not supported.'); return; }
    navigator.serviceWorker.getRegistration().then(function(reg){
      if(!reg){ alert('No SW registered yet — reload and try again.'); return; }
      reg.showNotification('MLB Pulse · Dev test', {
        body: 'Local test fired '+new Date().toLocaleTimeString()+' · server pipeline NOT exercised',
        icon: './icons/icon-192.png',
        badge: './icons/icon-192.png',
        tag: 'mlb-dev-test',
        renotify: true,
      }).then(
        function(){ pushDevLog('log','notif',['local test notification fired']); },
        function(err){ pushDevLog('error','notif',['showNotification failed: '+(err&&err.message||err)]); alert('showNotification failed: '+(err&&err.message||err)); }
      );
    });
  }
  if(Notification.permission==='granted') show();
  else if(Notification.permission==='denied') alert('Notifications are blocked. Re-enable in browser/site settings.');
  else Notification.requestPermission().then(function(p){ if(p==='granted') show(); else alert('Permission not granted ('+p+').'); });
}

// ── 🎯 Live Controls: Force Focus + Force Recap ─────────────────────────────
function _liveGamesForControls(){
  if(typeof state.gameStates==='undefined') return [];
  return Object.keys(state.gameStates).map(function(pk){return {pk:+pk, g:state.gameStates[pk]};})
    .filter(function(x){return x.g.status==='Live';})
    .sort(function(a,b){return (b.g.inning||0)-(a.g.inning||0);});
}
function renderLiveControls(){
  var body=document.getElementById('liveControlsBody');
  if(!body) return;
  var live=_liveGamesForControls();
  if(!live.length){
    body.innerHTML='<div class="dt-label-muted">No live games right now. Try Demo Mode (Shift+M) to populate state.gameStates with sample data.</div>';
    return;
  }
  var opts=live.map(function(x){return '<option value="'+x.pk+'">'+escapeHtml(x.g.awayAbbr+' @ '+x.g.homeAbbr+' · '+(x.g.halfInning||'')+' '+(x.g.inning||'?')+' · '+x.g.awayScore+'-'+x.g.homeScore)+'</option>';}).join('');
  var curFocus = (typeof state.focusGamePk!=='undefined'&&state.focusGamePk) ? state.focusGamePk : '';
  body.innerHTML =
    '<div class="dt-box">'+
      '<div class="dt-label" style="margin-bottom:6px">🎯 Force Focus</div>'+
      '<div class="dt-label-muted" style="margin-bottom:6px">Override auto-scoring and pin Focus Mode to a specific live game. Resets via the ↩ AUTO pill in the focus card.</div>'+
      '<div style="display:flex;gap:6px;align-items:center">'+
        '<select id="forceFocusSel" class="dt-input" style="flex:1">'+opts+'</select>'+
        '<button data-dt-action="forceFocusGo" style="background:var(--card);border:1px solid var(--border);color:var(--text);font-size:.65rem;padding:5px 10px;border-radius:4px;cursor:pointer;font-weight:600">Apply</button>'+
      '</div>'+
      (curFocus?'<div class="dt-label-muted" style="margin-top:4px">Current focus: gamePk '+curFocus+'</div>':'')+
    '</div>'+
    '<div class="dt-box">'+
      '<div class="dt-label" style="margin-bottom:6px">📖 Force Inning Recap</div>'+
      '<div class="dt-label-muted" style="margin-bottom:6px">Queues an inning_recap story so it surfaces in the next pool build. Replaces the manual <code>state.inningRecapsPending[…]</code> + <code>buildStoryPool()</code> console workflow.</div>'+
      '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">'+
        '<select id="forceRecapGame" class="dt-input" style="flex:2;min-width:140px">'+opts+'</select>'+
        '<select id="forceRecapHalf" class="dt-input" style="flex:1;min-width:60px"><option value="top">Top</option><option value="bottom">Bottom</option></select>'+
        '<input id="forceRecapInning" type="number" min="1" max="20" placeholder="Inn" class="dt-input" style="flex:0 0 60px">'+
        '<button data-dt-action="forceRecapGo" style="background:var(--card);border:1px solid var(--border);color:var(--text);font-size:.65rem;padding:5px 10px;border-radius:4px;cursor:pointer;font-weight:600">Queue</button>'+
      '</div>'+
    '</div>';
  // Pre-fill recap inning from the selected game's current inning when game changes
  var sel=document.getElementById('forceRecapGame'), inn=document.getElementById('forceRecapInning'), half=document.getElementById('forceRecapHalf');
  function sync(){
    if(!sel||!inn||!half) return;
    var g=state.gameStates[+sel.value];
    if(g){ inn.value=g.inning||1; half.value=(g.halfInning||'top').toLowerCase().indexOf('bot')===0?'bottom':'top'; }
  }
  if(sel) sel.addEventListener('change',sync);
  sync();
}
function forceFocusGo(){
  var sel=document.getElementById('forceFocusSel');
  if(!sel||!sel.value) return;
  var pk=+sel.value;
  setFocusGameManual(pk);
  pushDevLog('log','focus',['Force Focus applied · gamePk='+pk]);
  renderLiveControls();
}
// ── 📋 Diagnostic Snapshot ──────────────────────────────────────────────────
// One-tap bundle of every inspector's output as a single Markdown report — the
// paste-to-Claude workhorse. Bundles: context · focus · state.gameStates · state.feedItems(50)
// · state.storyPool · last 50 logs · last 50 network calls · localStorage sizes.
function copyDiagnosticSnapshot(){
  var ctx=_stateContext();
  var lsKeys=_lsKeys();
  var lsSizes=lsKeys.map(function(k){var e=_lsEntry(k);return '- `'+k+'`: '+_fmtBytes(e.bytes)+(e.isJson?' (json)':'');}).join('\n')||'_(none)_';
  var swSummary='_not yet fetched_';
  if(_swState && (_swState.scope||_swState.error)){
    swSummary=[
      '- Scope: '+(_swState.scope||'-'),
      '- Active: '+(_swState.scriptURL||'-'),
      '- Controller: '+(_swState.controller||'(uncontrolled)'),
      '- Update waiting: '+(_swState.hasUpdate?'YES':'no'),
      _swState.error?'- Error: '+_swState.error:null
    ].filter(Boolean).join('\n');
  }
  var counts=ctx.counts;
  var logSummary=devLog.length
    ? (function(){
        var rows=devLog.slice(-50);
        var lines=['| time | level | src | message |','|---|---|---|---|'];
        rows.forEach(function(e){
          var msg=e.msg.replace(/\|/g,'\\|').replace(/\n/g,' ↵ ');
          if(msg.length>200) msg=msg.slice(0,200)+'…';
          lines.push('| '+_fmtLogTs(e.ts)+' | '+e.level+' | '+(e.src||'-')+' | '+msg+' |');
        });
        return lines.join('\n');
      })()
    : '_(empty)_';
  var netSummary=devNetLog.length
    ? (function(){
        var lines=['| time | method | status | ms | size | url |','|---|---|---|---|---|---|'];
        devNetLog.forEach(function(e){
          var url=(e.url||'').replace(/\|/g,'\\|');
          var status=(e.status==null)?(e.ok===false?'ERR':'-'):e.status;
          lines.push('| '+_fmtLogTs(e.ts)+' | '+e.method+' | '+status+' | '+(e.ms||'-')+' | '+_fmtBytes(e.sizeBytes)+' | '+url+' |');
        });
        var failed=devNetLog.filter(function(e){return e.ok===false;});
        if(failed.length){
          lines.push('','**Failed:** '+failed.length);
          failed.forEach(function(e){lines.push('- `'+e.method+' '+(e.status||'ERR')+'` '+e.url+(e.errorMsg?' — '+e.errorMsg:''));});
        }
        return lines.join('\n');
      })()
    : '_(empty)_';

  var parts=[
    '# MLB Pulse — Diagnostic Snapshot',
    'Generated: '+new Date().toISOString(),
    'Version: '+ctx.version+' · Section: '+ctx.section+' · Active team: '+ctx.state.activeTeam,
    'state.demoMode: '+ctx.state.demoMode+' · state.pulseInitialized: '+ctx.state.pulseInitialized+' · pulseColorScheme: '+ctx.pulseColorScheme+' · state.themeScope: '+ctx.state.themeScope,
    'Focus: gamePk='+(ctx.state.focusGamePk||'(auto)')+' · manual='+ctx.state.focusIsManual+' · radioCurrentTeamId='+(ctx.radioCurrentTeamId||'-'),
    'Viewport: '+ctx.viewport,
    'UA: '+ctx.userAgent,
    '',
    '## Counts',
    '- state.gameStates: '+counts.state.gameStates,
    '- state.feedItems: '+counts.state.feedItems,
    '- state.storyPool: '+counts.state.storyPool,
    '- state.enabledGames: '+counts.state.enabledGames,
    '- devLog: '+counts.devLog,
    '- devNetLog: '+devNetLog.length,
    '',
    _stateAsMarkdownContext(),
    _stateAsMarkdownFocus(),
    _stateAsMarkdownGames(),
    _stateAsMarkdownFeed(50),
    _stateAsMarkdownStories(),
    '## Service Worker',
    '',
    swSummary,
    '',
    '## localStorage sizes',
    '',
    lsSizes,
    '',
    '## Last 50 logs',
    '',
    logSummary,
    '',
    '## Last '+devNetLog.length+' network calls',
    '',
    netSummary,
  ];
  // Refresh SW state asynchronously so the next snapshot has fresh data
  _refreshSWState().catch(function(){});
  _copyToClipboard(parts.join('\n'),'diagSnapshotBtn');
}

function forceRecapGo(){
  var sel=document.getElementById('forceRecapGame'),
      half=document.getElementById('forceRecapHalf'),
      inn=document.getElementById('forceRecapInning');
  if(!sel||!half||!inn||!sel.value){ alert('Pick a game first.'); return; }
  var pk=+sel.value, inning=parseInt(inn.value,10), halfInning=(half.value||'top').toLowerCase();
  if(!inning||inning<1){ alert('Enter a valid inning number.'); return; }
  var key=pk+'_'+inning+'_'+halfInning;
  if(typeof state.inningRecapsFired!=='undefined') state.inningRecapsFired.delete && state.inningRecapsFired.delete(key);
  if(typeof state.inningRecapsPending!=='undefined'){
    state.inningRecapsPending[key]={gamePk:pk, inning:inning, halfInning:halfInning};
    pushDevLog('log','recap',['Queued recap · '+key]);
  }
  if(typeof buildStoryPool==='function') buildStoryPool();
  alert('Recap queued for '+key+'. Wait for the next carousel rotation (or open Pulse to see it sooner).');
}
// Lazy: render only when the details element is opened, then live-refresh on filter input.
document.addEventListener('DOMContentLoaded',function(){
  var stateDet=document.getElementById('appStateDetails');
  if(stateDet) stateDet.addEventListener('toggle',function(){if(stateDet.open)renderAppState();});
  var netDet=document.getElementById('netTraceDetails');
  if(netDet) netDet.addEventListener('toggle',function(){if(netDet.open)renderNetTrace();});
  var stoDet=document.getElementById('storageDetails');
  if(stoDet) stoDet.addEventListener('toggle',function(){if(stoDet.open)renderStorageInspector();});
  var swDet=document.getElementById('swDetails');
  if(swDet) swDet.addEventListener('toggle',function(){if(swDet.open)renderSWInspector();});
  var lcDet=document.getElementById('liveControlsDetails');
  if(lcDet) lcDet.addEventListener('toggle',function(){if(lcDet.open)renderLiveControls();});
  var det=document.getElementById('logCaptureDetails');
  if(!det)return;
  det.addEventListener('toggle',function(){if(det.open)renderLogCapture();});
  var lvl=document.getElementById('logCaptureLevel');
  if(lvl) lvl.addEventListener('change',renderLogCapture);
  var f=document.getElementById('logCaptureFilter');
  if(f) f.addEventListener('input',renderLogCapture);
});

// ── 🔬 News Source Test (TEMP — remove after News tab QA) ────────────────
// ── News Source Test (v3.39.27) ─── EXTRACTED to dev/news-test.js
// Functions imported: openNewsSourceTest, closeNewsSourceTest, runNewsSourceTest,
// copyNewsSourceTest

function toggleDevTools(){var p=document.getElementById('devToolsPanel');var opening=p.style.display!=='block';p.style.display=opening?'block':'none';if(opening){document.getElementById('tuneRotateMs').value=state.devTuning.rotateMs;document.getElementById('tuneRbiThreshold').value=state.devTuning.rbiThreshold;document.getElementById('tuneRbiCooldown').value=state.devTuning.rbiCooldown;document.getElementById('tuneHRPriority').value=state.devTuning.hr_priority;document.getElementById('tuneHRCooldown').value=state.devTuning.hr_cooldown;document.getElementById('tuneBigInningPriority').value=state.devTuning.biginning_priority;document.getElementById('tuneBigInningThreshold').value=state.devTuning.biginning_threshold;document.getElementById('tuneWalkoffPriority').value=state.devTuning.walkoff_priority;document.getElementById('tuneNohitterFloor').value=state.devTuning.nohitter_inning_floor;document.getElementById('tuneBasesLoadedEnable').checked=state.devTuning.basesloaded_enable;document.getElementById('tuneBasesLoadedPriority').value=state.devTuning.basesloaded_priority;var tHF=document.getElementById('tuneHitstreakFloor');if(tHF)tHF.value=state.devTuning.hitstreak_floor||10;var tHP=document.getElementById('tuneHitstreakPriority');if(tHP)tHP.value=state.devTuning.hitstreak_priority||65;var tRI=document.getElementById('tuneRosterPriorityIL');if(tRI)tRI.value=state.devTuning.roster_priority_il||40;var tRT=document.getElementById('tuneRosterPriorityTrade');if(tRT)tRT.value=state.devTuning.roster_priority_trade||55;var tWL=document.getElementById('tuneWPLeverageFloor');if(tWL)tWL.value=state.devTuning.wp_leverage_floor||2;var tWE=document.getElementById('tuneWPExtremeFloor');if(tWE)tWE.value=state.devTuning.wp_extreme_floor||85;var tLP=document.getElementById('tuneLiveWPPriority');if(tLP)tLP.value=state.devTuning.livewp_priority||30;var tLR=document.getElementById('tuneLiveWPRefresh');if(tLR)tLR.value=state.devTuning.livewp_refresh_ms||90000;document.getElementById('tuneFocusCritical').value=state.devTuning.focus_critical;document.getElementById('tuneFocusHigh').value=state.devTuning.focus_high;document.getElementById('tuneFocusSwitchMargin').value=state.devTuning.focus_switch_margin;document.getElementById('tuneFocusAlertCooldown').value=state.devTuning.focus_alert_cooldown;document.getElementById('lockThemeToggle').checked=state.devColorLocked;}}

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
    else if(action==='youtubeDebug'){openYoutubeDebug();toggleDevTools();}
    else if(action==='videoDebug'){openVideoDebugPanel();toggleDevTools();}
    else if(action==='resetTuning'){resetTuning();}
    else if(action==='captureApp'){captureCurrentTheme('app');}
    else if(action==='capturePulse'){captureCurrentTheme('pulse');}
    else if(action==='refreshDebug'){refreshDebugPanel();}
    else if(action==='copyLog'){copyLogAsMarkdown();}
    else if(action==='clearLog'){clearDevLog();}
    else if(action==='refreshLog'){renderLogCapture();}
    else if(action==='copyState'){copyAppStateAsMarkdown();}
    else if(action==='refreshState'){renderAppState();}
    else if(action==='copyStateContext'){_copyToClipboard(_stateAsMarkdownContext());}
    else if(action==='copyStatePulse'){_copyToClipboard(_stateAsMarkdownPulse());}
    else if(action==='copyStateFocus'){_copyToClipboard(_stateAsMarkdownFocus());}
    else if(action==='copyStateGames'){_copyToClipboard(_stateAsMarkdownGames());}
    else if(action==='copyStateFeed'){_copyToClipboard(_stateAsMarkdownFeed(50));}
    else if(action==='copyStateStories'){_copyToClipboard(_stateAsMarkdownStories());}
    else if(action==='copyNet'){copyNetTraceAsMarkdown();}
    else if(action==='clearNet'){clearNetTrace();}
    else if(action==='refreshNet'){renderNetTrace();}
    else if(action==='copyStorage'){copyStorageAsMarkdown();}
    else if(action==='refreshStorage'){renderStorageInspector();}
    else if(action==='clearLsKey'){clearLsKey(btn.dataset.lsKey);}
    else if(action==='copySW'){copySWStateAsMarkdown();}
    else if(action==='swUpdate'){swForceUpdate();}
    else if(action==='swUnregister'){swUnregisterAndReload();}
    else if(action==='testNotif'){testLocalNotification();}
    else if(action==='forceFocusGo'){forceFocusGo();}
    else if(action==='forceRecapGo'){forceRecapGo();}
    else if(action==='copySnapshot'){copyDiagnosticSnapshot();}
    else if(action==='confirm'){confirmDevToolsChanges();}
  });
});

function updateTuning(param,val){
  if(param==='basesloaded_enable'){
    state.devTuning[param]=val==='true';
    if(DEBUG) console.log('✓ Bases Loaded '+(state.devTuning[param]?'enabled':'disabled'));
    return;
  }
  var parsed=parseInt(val,10);
  if(isNaN(parsed)||parsed<1)return;
  state.devTuning[param]=parsed;
  if(param==='rotateMs'){
    if(state.storyRotateTimer){clearInterval(state.storyRotateTimer);state.storyRotateTimer=null;}
    if(state.pulseInitialized&&!state.demoMode)state.storyRotateTimer=setInterval(rotateStory,state.devTuning.rotateMs);
    if(DEBUG) console.log('✓ Carousel rotation updated to '+parsed+'ms');
  }else{
    if(DEBUG) console.log('✓ '+param+' updated to '+parsed);
  }
}

function resetTuning(){
  state.devTuning=Object.assign({},devTuningDefaults);
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
  if(state.storyRotateTimer){clearInterval(state.storyRotateTimer);state.storyRotateTimer=null;}
  if(state.pulseInitialized&&!state.demoMode)state.storyRotateTimer=setInterval(rotateStory,state.devTuning.rotateMs);
  if(DEBUG) console.log('✓ Dev tuning reset to defaults');
}

function updateColorOverride(context,colorVar,value){
  state.devColorOverrides[context][colorVar]=value;
  if(state.devColorLocked){
    if(context==='app') applyTeamTheme(state.activeTeam);
    else applyPulseMLBTheme();
  }
  if(DEBUG) console.log('✓ '+context+' theme.'+colorVar+' → '+value);
}

function captureCurrentTheme(context){
  var cssVarMap={dark:'--dark',card:'--card',card2:'--card2',border:'--border',primary:'--primary',secondary:'--secondary',accent:'--accent',accentText:'--accent-text',headerText:'--header-text'};
  var root=document.documentElement;
  Object.keys(cssVarMap).forEach(function(v){
    var cssVal=getComputedStyle(root).getPropertyValue(cssVarMap[v]).trim();
    state.devColorOverrides[context][v]=cssVal;
    var elId='color'+context.charAt(0).toUpperCase()+context.slice(1)+v.charAt(0).toUpperCase()+v.slice(1);
    var el=document.getElementById(elId);
    if(el) el.value=cssVal;
  });
  if(DEBUG) console.log('✓ Captured current '+context+' theme colors');
}

function toggleColorLock(enable){
  state.devColorLocked=enable;
  if(enable){
    if(!state.devColorOverrides.app.primary) captureCurrentTheme('app');
    if(!state.devColorOverrides.pulse.primary) captureCurrentTheme('pulse');
    applyTeamTheme(state.activeTeam);
    if(DEBUG) console.log('✓ Theme lock enabled — auto-switching disabled');
  }else{
    applyTeamTheme(state.activeTeam);
    applyPulseMLBTheme();
    if(DEBUG) console.log('✓ Theme lock disabled — auto-switching restored');
  }
  document.getElementById('lockThemeToggle').checked=state.devColorLocked;
}

// Sound system (setSoundPref, playSound, audio primitives, per-event sounds)
// imported from ./ui/sound.js

// fmt, fmtRate, fmtDateTime imported from ./utils/format.js
function capImgError(el,primary,secondary,letter){el.onerror=null;var p=(primary||'#333').replace(/#/g,'%23'),s=(secondary||'#fff').replace(/#/g,'%23');el.src='data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="'+p+'"/><text x="32" y="41" text-anchor="middle" font-family="system-ui,sans-serif" font-size="28" font-weight="800" fill="'+s+'">'+letter+'</text></svg>';}
function teamCapImg(teamId,name,primary,secondary,cls){var letter=(name||'?')[0].toUpperCase();var p=encodeURIComponent(primary||'#333'),s=encodeURIComponent(secondary||'#fff');return'<img src="https://www.mlbstatic.com/team-logos/'+teamId+'.svg" class="'+(cls||'card-cap')+'" onerror="capImgError(this,\''+primary+'\',\''+secondary+'\',\''+letter+'\')">';}

// ── Theme/UI (v3.39.21) ─── EXTRACTED to ui/theme.js
// Functions imported: applyTeamTheme, applyPulseMLBTheme, setPulseColorScheme, updatePulseToggle,
// toggleSettings, setupSettingsClickOutside, toggleInvert, buildThemeSelect, buildTeamSelect,
// switchTheme, switchThemeScope, switchTeam

// ── Session & Sync Functions ──────────────────────────────────────────────────
// signInWithGitHub + signInWithEmail imported from ./auth/oauth.js
function signOut(){
  if(!confirm('Sign out and disconnect sync?'))return;
  state.mlbSessionToken=null;state.mlbAuthUser=null;
  localStorage.removeItem('mlb_session_token');localStorage.removeItem('mlb_auth_user');
  clearInterval(state.mlbSyncInterval);state.mlbSyncInterval=null;
  updateSyncUI();
}
function updateSyncUI(){
  var panel=document.getElementById('syncStatus');
  if(!panel)return;
  if(state.mlbSessionToken&&state.mlbAuthUser){
    panel.innerHTML='<div style="font-size:.72rem;color:var(--text)">✓ Synced · '+state.mlbAuthUser+'</div><button onclick="signOut()" style="background:var(--card2);border:1px solid var(--border);color:var(--text);font-size:.72rem;padding:5px 10px;border-radius:8px;cursor:pointer">Sign Out</button>';
  }else{
    panel.innerHTML='<button onclick="signInWithGitHub()" style="background:var(--card2);border:1px solid var(--border);color:var(--text);font-size:.72rem;padding:6px 12px;border-radius:8px;cursor:pointer;width:100%;text-align:left">🔐 Sign in with GitHub</button><button onclick="signInWithEmail()" style="background:var(--card2);border:1px solid var(--border);color:var(--text);font-size:.72rem;padding:6px 12px;border-radius:8px;cursor:pointer;width:100%;margin-top:6px;text-align:left">✉️ Sign in with Email</button>';
  }
}
// ── Collection Sync (v3.39.20) ─── EXTRACTED to collection/sync.js
// Functions imported: syncCollection, mergeCollectionOnSignIn, mergeCollectionSlots, startSyncInterval
function showSignInCTA(){
  if(state.mlbSessionToken||state.shownSignInCTA)return;
  state.signInCTACardCount++;
  if(state.signInCTACardCount<3)return;
  state.shownSignInCTA=true;
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
  state.signInCTATimer=setTimeout(closeSignInCTA,TIMING.SIGNIN_CTA_MS);
}
function closeSignInCTA(){
  if(state.signInCTATimer){clearTimeout(state.signInCTATimer);state.signInCTATimer=null;}
  var el=document.getElementById('signInCTA');
  el.style.opacity='0';
  el.style.transform='translateX(-50%) translateY(16px)';
  el.style.pointerEvents='none';
  setTimeout(function(){el.style.display='none';},260);
}

// requestScreenWakeLock + releaseScreenWakeLock imported from ./ui/wakelock.js

// onSoundPanelClickOutside imported from ./ui/sound.js

function showSection(id,btn){
  devTrace('nav','showSection · '+id);
  if(state.demoMode)exitDemo();
  if(document.getElementById('liveView').classList.contains('active'))closeLiveView();
  if(id!=='league')clearLeagueTimer();
  if(id!=='home')clearHomeTimer();
  document.querySelectorAll('.section').forEach(function(s){s.classList.remove('active');});
  document.querySelectorAll('nav button').forEach(function(b){b.classList.remove('active');});
  document.getElementById(id).classList.add('active');btn.classList.add('active');
  if(id==='pulse'){
    state.savedThemeForPulse=state.themeOverride;
    applyPulseMLBTheme();
    requestScreenWakeLock();
  }else{
    releaseScreenWakeLock();
    if(state.savedThemeForPulse!==undefined){applyTeamTheme(state.activeTeam);}
  }
  if(id==='schedule'&&!state.scheduleLoaded)loadSchedule();
  if(id==='standings')loadStandings();
  if(id==='stats'&&!state.rosterData.hitting.length){loadRoster();loadLeaders();}else if(id==='stats')loadLeaders();
  if(id==='league')loadLeagueView();
  if(id==='news')loadNews();
}

// --- NEXT GAME CARD ---
// Returns the opp color most distinct from myPrimary. Falls back to oppSecondary
// when oppPrimary is too close (RGB Euclidean distance < 60), or to oppPrimary
// unchanged when both opp colors are too similar (e.g., Yankees navy/navy vs Mets blue).
// pickOppColor imported from ./utils/format.js
function getSeriesInfo(g){
  var sn=g.seriesGameNumber||(g.seriesSummary&&g.seriesSummary.seriesGameNumber);
  var total=g.gamesInSeries||(g.seriesSummary&&g.seriesSummary.gamesInSeries);
  var desc=g.seriesSummary&&g.seriesSummary.seriesStatus?g.seriesSummary.seriesStatus:null;
  if(sn&&total&&desc)return'Game '+sn+' of '+total+' · '+desc;
  if(!state.scheduleData.length)return sn&&total?'Game '+sn+' of '+total:null;
  var oppId=g.teams.home.team.id===state.activeTeam.id?g.teams.away.team.id:g.teams.home.team.id;
  var venueId=g.venue&&g.venue.id,gameDateStr=g.gameDate.split('T')[0];
  var series=state.scheduleData.filter(function(s){
    var sOpp=s.teams.home.team.id===state.activeTeam.id?s.teams.away.team.id:s.teams.home.team.id;
    var sVenue=s.venue&&s.venue.id,daysDiff=Math.abs((new Date(s.gameDate.split('T')[0])-new Date(gameDateStr))/86400000);
    return sOpp===oppId&&sVenue===venueId&&daysDiff<=4;
  }).sort(function(a,b){return new Date(a.gameDate)-new Date(b.gameDate);});
  if(!sn&&series.length<2)return null;
  var gameNum=sn||(series.findIndex(function(s){return s.gamePk===g.gamePk;})+1);
  var gameTotal=total||series.length,myW=0,oppW=0;
  series.forEach(function(s){if(s.status.abstractGameState!=='Final')return;var myT=s.teams.home.team.id===state.activeTeam.id?s.teams.home:s.teams.away;if(myT.isWinner)myW++;else oppW++;});
  var recStr='';
  if(myW>oppW)recStr=' · '+state.activeTeam.short+' lead '+myW+'-'+oppW;
  else if(oppW>myW){var oN=g.teams.home.team.id===state.activeTeam.id?g.teams.away.team.teamName:g.teams.home.team.teamName;recStr=' · '+oN+' lead '+oppW+'-'+myW;}
  else if(myW>0)recStr=' · Tied '+myW+'-'+myW;
  return'Game '+gameNum+' of '+gameTotal+recStr;
}

function renderNextGame(g,label){
  var home=g.teams.home,away=g.teams.away,teamHome=home.team.id===state.activeTeam.id;
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
  var themeTeamMy=state.themeOverride||myD;
  var myPrimaryForClash=state.themeInvert?(themeTeamMy.secondary||state.activeTeam.primary):(themeTeamMy.primary||state.activeTeam.primary);
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

// ── Boot IIFE ────────────────────────────────────────────────────────────────
(async function(){
  var sv=function(k){return localStorage.getItem(k);};
  // soundSettings is hydrated from localStorage inside ./ui/sound.js on import.
  // Restore session token
  state.mlbSessionToken=sv('mlb_session_token');state.mlbAuthUser=sv('mlb_auth_user');
  // Handle auth from OAuth redirect
  const params=new URLSearchParams(window.location.search);
  const authToken=params.get('auth_token'),authMethod=params.get('auth_method');
  if(authToken&&authMethod){
    state.mlbSessionToken=authToken;
    localStorage.setItem('mlb_session_token',authToken);
    if(authMethod==='github'){state.mlbAuthUser=params.get('github_login')||'GitHub User';}
    else if(authMethod==='email'){state.mlbAuthUser=params.get('email')||'Email User';}
    localStorage.setItem('mlb_auth_user',state.mlbAuthUser);
    // Clean up URL
    window.history.replaceState({},'',window.location.pathname);
    await mergeCollectionOnSignIn();
    startSyncInterval();
  }else if(state.mlbSessionToken){
    startSyncInterval();
  }
  if(sv('mlb_team'))state.activeTeam=TEAMS.find(t=>t.id===parseInt(sv('mlb_team')))||state.activeTeam;
  var storedTheme=sv('mlb_theme');
  if(!storedTheme||storedTheme==='-1'){state.themeOverride=MLB_THEME;}
  else if(storedTheme==='0'){state.themeOverride=null;}
  else{state.themeOverride=TEAMS.find(t=>t.id===parseInt(storedTheme))||null;}
  if(sv('mlb_invert')==='true')state.themeInvert=true;
  if(sv('mlb_theme_scope')==='nav')state.themeScope='nav';
  buildTeamSelect();buildThemeSelect();updatePulseToggle();
  document.getElementById('themeSelect').value=storedTheme||'-1';
  if(sv('mlb_theme_scope'))document.getElementById('themeScopeSelect').value=sv('mlb_theme_scope');
  if(state.themeInvert){var it=document.getElementById('invertToggle'),ik=document.getElementById('invertToggleKnob');it.style.background='var(--primary)';ik.style.left='21px';}
  if(sv('mlb_push')==='1'){var pt=document.getElementById('pushToggle'),pk=document.getElementById('pushToggleKnob');if(pt){pt.style.background='var(--secondary)';pk.style.left='21px';}document.getElementById('pushStatusText').textContent='On';}
  applyTeamTheme(state.activeTeam);loadTodayGame();loadNextGame();loadNews();loadStandings();loadRoster();loadHomeYoutubeWidget();
  updateCollectionUI();
  updateSyncUI();
  // Wire up demo mode callbacks so the module can call core render/feed functions
  setDemoCallbacks({
    addFeedItem: addFeedItem,
    renderTicker: renderTicker,
    renderSideRailGames: renderSideRailGames,
    buildStoryPool: buildStoryPool,
    updateFeedEmpty: updateFeedEmpty,
    showAlert: showAlert,
    playSound: playSound,
    showPlayerCard: showPlayerCard,
    rotateStory: rotateStory,
    localDateStr: localDateStr,
  });
  state.pulseInitialized=true;initLeaguePulse();
  // Pulse-first cold-open: mirror showSection('pulse') side-effects so theme + wake-lock match the active landing section
  state.savedThemeForPulse=state.themeOverride;
  applyPulseMLBTheme();
  requestScreenWakeLock();
  applyMyTeamLens(state.myTeamLens);
})();

document.addEventListener('visibilitychange',function(){
  if(document.hidden){
    state.tabHiddenAt=Date.now();
    releaseScreenWakeLock();
    // Pause data polling while tab is hidden
    if(state.pulseTimer){clearInterval(state.pulseTimer);state.pulseTimer=null;}
    if(state.storyPoolTimer){clearInterval(state.storyPoolTimer);state.storyPoolTimer=null;}
    if(state.focusFastTimer){clearInterval(state.focusFastTimer);state.focusFastTimer=null;}
    clearHomeTimer();
    clearLeagueTimer();
  } else {
    if(state.pulseInitialized&&!state.demoMode){
      // Keep state.tabHiddenAt set during catch-up so pollGamePlays treats missed plays as history
      // (suppresses HR/RBI cards and sounds for plays that fired while tab was hidden).
      // Clear it only after the catch-up poll completes.
      pollLeaguePulse().finally(function(){state.tabHiddenAt=null;});
      state.pulseTimer=setInterval(pollLeaguePulse,TIMING.PULSE_POLL_MS);
      state.storyPoolTimer=setInterval(buildStoryPool,TIMING.STORY_POOL_MS);
      if(state.focusGamePk) state.focusFastTimer=setInterval(pollFocusLinescore,TIMING.FOCUS_POLL_MS);
    } else {
      state.tabHiddenAt=null;
    }
  }
});

document.addEventListener('keydown',function(e){
  if(e.key==='Escape'&&state.focusOverlayOpen) { closeFocusOverlay(); return; }
  // Mnemonics: M=deMo, H=Home run, B=rBi, V=Variants, D=Dev tools, F=Focus,
  // G=Generate test card, C=Collection demo, P=Play clip, N=News, L=Log,
  // S=State, I=Info dump (snapshot)
  if(e.shiftKey && e.key === 'M') { toggleDemoMode(); }
  if(e.shiftKey && e.key === 'H') { replayHRCard(); }
  if(e.shiftKey && e.key === 'B') { replayRBICard(); }
  if(e.shiftKey && e.key === 'V') { window.PulseCard.demo(); }
  if(e.shiftKey && e.key === 'D') { toggleDevTools(); }
  if(e.shiftKey && e.key === 'F') { window.FocusCard && window.FocusCard.demo(); }
  if(e.shiftKey && e.key === 'G') { generateTestCard(); }
  if(e.shiftKey && e.key === 'C') { window.CollectionCard && window.CollectionCard.demo(); }
  if(e.shiftKey && e.key === 'P') { devTestVideoClip(); }
  if(e.shiftKey && e.key === 'N') { openNewsSourceTest(); } // TEMP — News tab QA
  if(e.shiftKey && e.key === 'L') {
    var p=document.getElementById('devToolsPanel');
    if(p && p.style.display!=='block') toggleDevTools();
    var det=document.getElementById('logCaptureDetails');
    if(det){det.open=true;renderLogCapture();det.scrollIntoView({block:'nearest'});}
  }
  if(e.shiftKey && e.key === 'S') {
    var p=document.getElementById('devToolsPanel');
    if(p && p.style.display!=='block') toggleDevTools();
    var det=document.getElementById('appStateDetails');
    if(det){det.open=true;renderAppState();det.scrollIntoView({block:'nearest'});}
  }
  if(e.shiftKey && e.key === 'I') { copyDiagnosticSnapshot(); }
});

document.addEventListener('click',onSoundPanelClickOutside);

setupSettingsClickOutside();

if('serviceWorker' in navigator){
  navigator.serviceWorker.register('sw.js').then(
    function(reg){devTrace('sw','registered · scope='+reg.scope);},
    function(err){devTrace('sw','registration FAILED · '+(err&&err.message||err));}
  );
}

// ── window-global bridge ─────────────────────────────────────────────────────
// esbuild bundles this file as an IIFE, which hides top-level function
// declarations from HTML inline handlers (onclick=, onchange=, etc.) and from
// keyboard-shortcut targets. The bridge below re-exposes them on `window` so
// the existing HTML markup keeps working without modification. Add a name here
// whenever a new function gets called from inline HTML or a hotkey.
Object.assign(window, {
  // Navigation + section dispatch
  showSection,
  // Settings + theme + team
  switchTeam, switchTheme, switchThemeScope, toggleSettings, toggleInvert,
  togglePush, toggleRadio, toggleDevTools, toggleMyTeamLens, toggleSoundPanel,
  setPulseColorScheme, setSoundPref,
  // Collection + Yesterday Recap + Radio Check overlays
  openCollection, closeCollection, openRadioCheck, closeRadioCheck,
  openYesterdayRecap, closeYesterdayRecap,
  // Section loaders (refresh buttons, day toggles)
  loadSchedule, loadNews, loadLeaders, loadLeagueMatchups, changeMonth,
  switchLeaderTab, selectLeaderPill, switchRosterTab, switchNewsFeed,
  switchLeagueLeaderTab, switchMatchupDay, selectNewsSource,
  // Live game view + matchup grid
  showLiveGame, closeLiveView, fetchLiveGame, switchBoxTab, selectCalGame,
  // Carousel nav (story carousel only — prevNewsCard/nextNewsCard are
  // referenced from index.html but never implemented; intentionally omitted
  // so the no-op stays a clean ReferenceError on click rather than
  // crashing the bridge at script load time)
  prevStory, nextStory,
  // Demo Mode controls
  setDemoSpeed, demoNextHR, toggleDemoPause, forwardDemoPlay, toggleDemoMode,
  exitDemo,
  // Auth
  signInWithGitHub, signInWithEmail, signOut,
  // Dev Tools + diagnostics
  openNewsSourceTest, runNewsSourceTest, copyNewsSourceTest, closeNewsSourceTest,
  openYoutubeDebug, ytDebugFetchCustom, runYoutubeDebugAll, runYoutubeDebugOne,
  ytDebugCopy, ytDebugReset, closeYoutubeDebug, ytDebugApplyToTeam,
  radioCheckTryCustom, radioCheckStop, radioCheckReset, radioCheckCopy,
  radioCheckPlay, radioCheckSet, radioCheckSetNote,
  copyVideoDebug, refreshVideoDebugPanel, closeVideoDebugPanel,
  copyDiagnosticSnapshot,
  toggleColorLock, updateColorOverride, updateTuning,
  replayHRCard, replayRBICard, generateTestCard, devTestVideoClip,
  renderLogCapture, renderAppState,
  // Card overlays + dismissals
  dismissPlayerCard, closeSignInCTA, closeVideoOverlay,
  openCardFromKey, playHighlightVideo, playYesterdayClip, scrollToYdTile,
  selectYdClip, selectMediaVideo, selectPlayer, ydChangeDate,
  // Focus Mode
  openFocusOverlay, closeFocusOverlay, dismissFocusAlert,
  setFocusGame, setFocusGameManual, resetFocusAuto, toggleGame,
});
