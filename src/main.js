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
  MLB_TEAM_RADIO, FALLBACK_RADIO, APPROVED_RADIO_TEAM_IDS,
  RADIO_CHECK_DEFAULT_NOTES,
} from './radio/stations.js';
import {
  pickRadioForFocus, stopAllMedia, toggleRadio, startRadio, loadRadioStream,
  stopRadio, updateRadioForFocus, getCurrentTeamId,
} from './radio/engine.js';
import {
  toggleDemoMode, setDemoSpeed, toggleDemoPause, backDemoPlay, forwardDemoPlay,
  demoNextHR, exitDemo, loadDemoGames, buildDemoPlayQueue, setDemoCallbacks,
} from './demo/mode.js';
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


function renderTicker() {
  var ticker=document.getElementById('gameTicker'), states=Object.values(state.gameStates);
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
    var fc=state.enabledGames.has(g.gamePk)?' feed-enabled':' feed-disabled';
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
  var filterDate=state.demoMode?localDateStr(state.demoDate):localDateStr(new Date());
  if(state.demoMode&&DEBUG) console.log('Demo: renderSideRailGames filtering to date',filterDate,'from',Object.keys(state.gameStates).length,'total games');
  Object.values(state.gameStates).forEach(function(g) {
    if(state.demoMode&&localDateStr(new Date(g.gameDateMs))!==filterDate) return;
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

function showNewsUnavailable() {
  var container=document.getElementById('newsCard');
  if(container) {
    container.innerHTML='<div style="color:var(--muted);font-size:.75rem;padding:20px;text-align:center;">News feed unavailable</div>';
  }
}

// ── Story Carousel (v2.7.1) ───────────────────────────────────────────────────

function liveOrHighlight(id,eventTs){
  var recent=eventTs&&(Date.now()-eventTs.getTime())<=60000;
  return (recent&&!state.displayedStoryIds.has(id))?'live':'highlight';
}
function makeStory(id,type,tier,priority,icon,headline,sub,badge,gamePk,ts,cooldownMs,decayRate){
  var existing=state.storyPool.find(function(s){return s.id===id;});
  return {id:id,type:type,tier:tier,priority:priority,icon:icon,headline:headline,sub:sub,badge:badge,gamePk:gamePk||null,ts:ts||new Date(),lastShown:existing?existing.lastShown:null,cooldownMs:cooldownMs,decayRate:decayRate};
}

function genHRStories(){
  var out=[];
  // Group HR feed items by batterId so multi-homer games collapse into one story
  var hrsByBatter={};
  state.feedItems.forEach(function(item){
    if(!item.data||item.data.event!=='Home Run') return;
    if(state.demoMode&&item.ts.getTime()>state.demoCurrentTime) return;
    var g=state.gameStates[item.gamePk]; if(!g) return;
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
    // Stats: state.hrBatterStatsCache (populated by showPlayerCard) → state.statsCache fallback
    var statObj=state.hrBatterStatsCache[bid]||(function(){var c=(state.statsCache.hitting||[]).find(function(e){return e.player&&e.player.id==bid;});return c?c.stat:null;})();
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
      priority=state.devTuning.hr_priority;
    } else {
      // Multi-homer — replace original story; boost priority
      id='hr_multi_'+bid+'_'+entries[0].item.gamePk+'_'+count;
      var ordWord=multiWords[count]||(count+'th');
      var innStr2=item.data.inning?' in the '+ordinal(item.data.inning)+' inning':'';
      headline=bname+' hits his '+ordWord+' homer of the game'+innStr2+'!';
      priority=state.devTuning.hr_priority+(count-1)*15;
    }
    out.push(makeStory(id,'realtime',1,priority,'💥',headline,sub,'highlight',item.gamePk,item.ts,state.devTuning.hr_cooldown,0.5));
  });
  return out;
}

function genNoHitterWatch(){
  var out=[];
  Object.values(state.gameStates).forEach(function(g){
    if(g.status!=='Live'||g.detailedState!=='In Progress') return;
    if(g.inning<state.devTuning.nohitter_inning_floor) return;
    var nohitAway=g.awayHits===0, nohitHome=g.homeHits===0;
    if(!nohitAway&&!nohitHome) return;
    var id='nohit_'+g.gamePk;
    var pitchingTeam=nohitAway?g.homeAbbr:g.awayAbbr;
    var hittingTeam=nohitAway?g.awayAbbr:g.homeAbbr;
    var isPerfect=state.perfectGameTracker[g.gamePk]===true;
    var priority,headline;
    if(isPerfect){
      priority=99;
      headline=pitchingTeam+' working a perfect game through the '+ordinal(g.inning);
    } else {
      priority=state.devTuning.nohitter_priority;
      headline=pitchingTeam+' working a no-hitter through the '+ordinal(g.inning);
    }
    var sub=hittingTeam+' have 0 hits · '+g.awayAbbr+' '+g.awayScore+', '+g.homeAbbr+' '+g.homeScore;
    out.push(makeStory(id,'nohit',1,priority,'🚫',headline,sub,'live',g.gamePk,new Date(),2*60000,0.2));
  });
  return out;
}

function genWalkOffThreat(){
  var out=[];
  Object.values(state.gameStates).forEach(function(g){
    if(g.status!=='Live'||g.halfInning!=='bottom'||g.inning<9) return;
    var runnersOn=(g.onFirst?1:0)+(g.onSecond?1:0)+(g.onThird?1:0);
    var deficit=g.awayScore-g.homeScore; // positive = home trailing
    if(deficit<0||deficit>runnersOn+1) return; // home leading, or winning run not at bat
    var id='walkoff_'+g.gamePk+'_'+g.inning;
    var headline='Walk-off situation — '+g.homeAbbr+' in the bottom '+ordinal(g.inning);
    var sub=g.awayAbbr+' '+g.awayScore+', '+g.homeAbbr+' '+g.homeScore+' · '+ordinal(g.inning)+' inning';
    out.push(makeStory(id,'walkoff',1,state.devTuning.walkoff_priority,'🔔',headline,sub,'live',g.gamePk,new Date(),state.devTuning.walkoff_cooldown,0.9));
  });
  return out;
}

function genBasesLoaded(){
  if(!state.devTuning.basesloaded_enable) return [];
  var out=[];
  Object.values(state.gameStates).forEach(function(g){
    if(g.status!=='Live'||!g.onFirst||!g.onSecond||!g.onThird) return;
    var battingAbbr=g.halfInning==='top'?g.awayAbbr:g.homeAbbr;
    var half=g.halfInning==='top'?'Top':'Bot';
    var id='basesloaded_'+g.gamePk+'_'+g.inning+'_'+g.halfInning;
    var headline='Bases loaded — '+battingAbbr+' batting in the '+ordinal(g.inning);
    var sub=g.awayAbbr+' '+g.awayScore+', '+g.homeAbbr+' '+g.homeScore+' · '+half+' '+ordinal(g.inning);
    out.push(makeStory(id,'realtime',1,state.devTuning.basesloaded_priority,'🔔',headline,sub,'live',g.gamePk,new Date(),3*60000,0.8));
  });
  return out;
}

function genStolenBaseStories(){
  var out=[];
  state.stolenBaseEvents.forEach(function(sb){
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
  state.feedItems.forEach(function(item){
    if(!item.data||item.data.type!=='play'||!item.data.scoring) return;
    if(state.demoMode&&item.ts.getTime()>state.demoCurrentTime) return;
    var key=item.gamePk+'_'+item.data.inning+'_'+item.data.halfInning;
    if(!groups[key]) groups[key]={gamePk:item.gamePk,inning:item.data.inning,half:item.data.halfInning,runs:0,lastItem:item};
    groups[key].runs++;
    groups[key].lastItem=item;
  });
  Object.values(groups).forEach(function(grp){
    if(grp.runs<state.devTuning.biginning_threshold) return;
    var g=state.gameStates[grp.gamePk]; if(!g) return;
    var id='biginning_'+grp.gamePk+'_'+grp.inning+'_'+grp.half;
    var battingTeam=grp.half==='top'?g.awayAbbr:g.homeAbbr;
    var headline=battingTeam+' scored '+grp.runs+' runs in the '+ordinal(grp.inning);
    var sub=g.awayAbbr+' @ '+g.homeAbbr;
    out.push(makeStory(id,'realtime',1,state.devTuning.biginning_priority,'🔥',headline,sub,'highlight',grp.gamePk,grp.lastItem.ts,10*60000,0.4));
  });
  return out;
}

function genFinalScoreStories(){
  var out=[];
  Object.values(state.gameStates).forEach(function(g){
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
  if(!state.scheduleData||!state.scheduleData.length) return out;
  var streaksByTeam={};
  state.scheduleData.filter(function(g){return g.status.abstractGameState==='Final';}).forEach(function(g){
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
  var playerIds=Object.keys(state.dailyHitsTracker);
  for(var i=0;i<playerIds.length;i++){
    var batterId=playerIds[i];
    var entry=state.dailyHitsTracker[batterId];
    if(entry.hits<3&&!(entry.hits>=2&&entry.hrs>=1)) continue;
    var id='multihit_'+batterId+'_'+dateStr;
    var h=entry.hits, ab=entry.hits;
    if(!state.demoMode&&entry.gamePk){
      var bs=await fetchBoxscore(entry.gamePk);
      if(bs){
        var team=bs.teams&&bs.teams.away;
        var found=false;
        if(team&&team.players){Object.keys(team.players).forEach(function(pk){var p=team.players[pk];if(p.person&&p.person.id===parseInt(batterId)){h=p.stats.batting.hits;ab=p.stats.batting.atBats;found=true;}});}
        if(!found){team=bs.teams&&bs.teams.home;if(team&&team.players){Object.keys(team.players).forEach(function(pk){var p=team.players[pk];if(p.person&&p.person.id===parseInt(batterId)){h=p.stats.batting.hits;ab=p.stats.batting.atBats;}});}}
      }
    }
    var hrStr=entry.hrs?' with '+entry.hrs+' HR'+(entry.hrs>1?'s':''):'';
    var headline=state.demoMode?(entry.name+' goes '+h+'-for-today'+hrStr):(entry.name+' goes '+h+' for '+ab+hrStr);
    var g=state.gameStates[entry.gamePk]||{};
    var sub=g.awayAbbr&&g.homeAbbr?g.awayAbbr+' @ '+g.homeAbbr:'';
    out.push(makeStory(id,'daily_stat',2,55,'🏏',headline,sub,g.status==='Live'?'live':'today',entry.gamePk,new Date(),15*60000,0.1));
  }
  return out;
}

function genDailyLeaders(){
  var out=[];
  if(!state.dailyLeadersCache) return out;
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
    var list=state.dailyLeadersCache[cat.key];
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
  Object.keys(state.dailyPitcherKs).forEach(function(key){
    var entry=state.dailyPitcherKs[key];
    if(entry.ks<8) return;
    var g=state.gameStates[entry.gamePk]||{};
    var id='kgem_'+key;
    var headline=entry.name+' has '+entry.ks+' strikeouts today';
    var sub=g.awayAbbr&&g.homeAbbr?g.awayAbbr+' @ '+g.homeAbbr+(g.status==='Live'?' · '+ordinal(g.inning):''):'';
    out.push(makeStory(id,'daily_stat',2,58,'⚡',headline,sub,g.status==='Live'?'live':'today',entry.gamePk,new Date(),10*60000,0.2));
  });
  return out;
}

function genOnThisDay(){
  if(!state.onThisDayCache||!state.onThisDayCache.length) return [];
  return state.onThisDayCache.map(function(item){
    return makeStory(item.id,'historical',4,20,item.icon,item.headline,item.sub,'onthisday',item.gamePk,item.ts,60*60000,0.5);
  });
}

function genYesterdayHighlights(){
  if(!state.yesterdayCache||!state.yesterdayCache.length) return [];
  return state.yesterdayCache.map(function(item){
    return makeStory(item.id,'yesterday',4,45,item.icon,item.headline,item.sub,'yesterday',item.gamePk,item.ts,30*60000,0.3);
  });
}

async function fetchMissingHRBatterStats(){
  if(state.demoMode){if(DEBUG) console.log('Demo: Skipping fetchMissingHRBatterStats API call');return;}
  var ids=[];
  state.feedItems.forEach(function(item){
    if(!item.data||item.data.event!=='Home Run') return;
    var bid=item.data.batterId;
    if(bid&&!state.hrBatterStatsCache[bid]) ids.push(bid);
  });
  var unique=[...new Set(ids)];
  if(!unique.length) return;
  await Promise.all(unique.map(async function(id){
    try{
      var r=await fetch(MLB_BASE+'/people/'+id+'/stats?stats=season&season='+SEASON+'&group=hitting');
      if(!r.ok) throw new Error(r.status);
      var d=await r.json();
      var stat=d.stats&&d.stats[0]&&d.stats[0].splits&&d.stats[0].splits[0]&&d.stats[0].splits[0].stat;
      if(stat) state.hrBatterStatsCache[id]=stat;
    }catch(e){}
  }));
}

async function loadProbablePitcherStats(){
  if(state.demoMode){if(DEBUG) console.log('Demo: Skipping loadProbablePitcherStats API call');return;}
  var ids=[];
  Object.values(state.storyCarouselRawGameData).forEach(function(raw){
    var awayPP=raw.teams&&raw.teams.away&&raw.teams.away.probablePitcher;
    var homePP=raw.teams&&raw.teams.home&&raw.teams.home.probablePitcher;
    if(awayPP&&awayPP.id&&!state.probablePitcherStatsCache[awayPP.id]) ids.push(awayPP.id);
    if(homePP&&homePP.id&&!state.probablePitcherStatsCache[homePP.id]) ids.push(homePP.id);
  });
  if(!ids.length) return;
  await Promise.all(ids.map(async function(id){
    try{
      var r=await fetch(MLB_BASE+'/people/'+id+'/stats?stats=season&season='+SEASON+'&group=pitching');
      if(!r.ok) throw new Error(r.status);
      var d=await r.json();
      var stat=d.stats&&d.stats[0]&&d.stats[0].splits&&d.stats[0].splits[0]&&d.stats[0].splits[0].stat;
      state.probablePitcherStatsCache[id]={wins:stat?stat.wins:0,losses:stat?stat.losses:0};
    }catch(e){state.probablePitcherStatsCache[id]={wins:0,losses:0};}
  }));
}

function genProbablePitchers(){
  var out=[], today=localDateStr(getEffectiveDate());
  var games=[];
  if(state.demoMode&&DEBUG) console.log('Demo: genProbablePitchers filtering to date',today,'found',Object.values(state.gameStates).filter(g=>localDateStr(new Date(g.gameDateMs))===today).length,'matching games');

  // Try to find today's games from state.gameStates (already fetched with probablePitcher by pollLeaguePulse)
  Object.values(state.gameStates).forEach(function(g){
    if(localDateStr(new Date(g.gameDateMs))===today&&g.awayAbbr&&g.homeAbbr&&g.status!=='Live'&&g.status!=='Final') {
      // Skip DH game 2 while game 1 for the same matchup is already live
      var rawG=state.storyCarouselRawGameData&&state.storyCarouselRawGameData[g.gamePk];
      if(rawG&&rawG.doubleHeader==='Y'&&rawG.gameNumber===2){
        var game1Live=Object.values(state.gameStates).some(function(s){
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

    // Pitcher data might come from state.scheduleData during the poll — look in raw games if available
    if(state.storyCarouselRawGameData&&state.storyCarouselRawGameData[g.gamePk]){
      var raw=state.storyCarouselRawGameData[g.gamePk];
      if(raw.teams&&raw.teams.away&&raw.teams.away.probablePitcher&&raw.teams.away.probablePitcher.fullName){
        awayPP=raw.teams.away.probablePitcher.fullName;
        awayPPId=raw.teams.away.probablePitcher.id;
      }
      if(raw.teams&&raw.teams.home&&raw.teams.home.probablePitcher&&raw.teams.home.probablePitcher.fullName){
        homePP=raw.teams.home.probablePitcher.fullName;
        homePPId=raw.teams.home.probablePitcher.id;
      }
    }

    var awayWL=awayPPId&&state.probablePitcherStatsCache[awayPPId]?(state.probablePitcherStatsCache[awayPPId].wins+'-'+state.probablePitcherStatsCache[awayPPId].losses):'0-0';
    var homeWL=homePPId&&state.probablePitcherStatsCache[homePPId]?(state.probablePitcherStatsCache[homePPId].wins+'-'+state.probablePitcherStatsCache[homePPId].losses):'0-0';
    var headline=awayPP+' ('+awayWL+') ['+awayAbbr+'] vs '+homePP+' ('+homeWL+') ['+homeAbbr+']';
    var rawG2=state.storyCarouselRawGameData&&state.storyCarouselRawGameData[g.gamePk];
    var timeTBD=rawG2&&rawG2.status&&rawG2.status.startTimeTBD;
    var timeStr=timeTBD?'TBD':(g.gameTime||'TBD');
    out.push(makeStory('probable_'+g.gamePk,'contextual',4,40,'⚾',headline,'Today · '+timeStr,'probables',g.gamePk,new Date(g.gameDateMs),60*60000,0.05));
  });
  return out;
}

function updateInningStates(){
  // This function is called after state.gameStates are updated
  // It doesn't modify state - that happens in genInningRecapStories after recaps are generated
}

function genInningRecapStories(){
  var out=[];
  // Shared generation logic — called from both primary (3rd-out) and fallback (linescore) paths
  function genRecap(g,recapInning,recapHalf,recapKey){
    if(state.inningRecapsFired.has(recapKey)) return;
    var inningPlays=state.feedItems.filter(function(item){
      return item.gamePk===g.gamePk&&item.data&&item.data.inning===recapInning&&item.data.halfInning===recapHalf&&item.data.type==='play';
    });
    if(!inningPlays.length) return;
    var lastPlayInInning=inningPlays[inningPlays.length-1];
    var finalAwayScore=lastPlayInInning.data.awayScore;
    var finalHomeScore=lastPlayInInning.data.homeScore;
    var startAwayScore=0,startHomeScore=0;
    for(var i=state.feedItems.length-1;i>=0;i--){
      if(state.feedItems[i].data&&state.feedItems[i].data.type==='play'&&state.feedItems[i].gamePk===g.gamePk){
        if(state.feedItems[i].data.inning<recapInning||(state.feedItems[i].data.inning===recapInning&&state.feedItems[i].data.halfInning!==recapHalf)){
          startAwayScore=state.feedItems[i].data.awayScore;
          startHomeScore=state.feedItems[i].data.homeScore;
          break;
        }
      }
    }
    var runs=recapHalf==='top'?(finalAwayScore-startAwayScore):(finalHomeScore-startHomeScore);
    var strikeouts=0,walks=0,hrs=0,dps=0,errors=0,playerHRs=[],pitcherNames=new Set(),hadRisp=false,dpBatter=null;
    var isClean123=inningPlays.length===3&&!inningPlays.some(function(p){return p.data.scoring;});
    var runnersLeftOn=false;
    inningPlays.forEach(function(play){
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
    else if(runs>0&&hadRisp){var battingScore=recapHalf==='top'?g.awayScore:g.homeScore;var pitchingScore=recapHalf==='top'?g.homeScore:g.awayScore;if(battingScore<=pitchingScore){priority=85;headline=battingTeam+' claw back in the '+innStr;}}
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
    state.inningRecapsFired.add(recapKey);
    var sub=battingTeam+' · '+ordinal(recapInning)+' inning';
    out.push(makeStory('inning_recap_'+recapKey,'inning_recap',2,priority,'📊',headline,sub,'inning_recap',g.gamePk,new Date(),0,0));
  }
  // Primary path: triggered at 3rd out in pollGamePlays — fires immediately when inning ends
  Object.keys(state.inningRecapsPending).forEach(function(recapKey){
    var p=state.inningRecapsPending[recapKey];
    var g=state.gameStates[p.gamePk];
    if(!g){delete state.inningRecapsPending[recapKey];return;}
    genRecap(g,p.inning,p.halfInning,recapKey);
    delete state.inningRecapsPending[recapKey];
    state.lastInningState[p.gamePk]={inning:p.inning,halfInning:p.halfInning};
  });
  // Fallback path: linescore transition detection (catches edge cases, e.g. zero-play innings)
  Object.values(state.gameStates).forEach(function(g){
    if(g.status!=='Live') return;
    var lastState=state.lastInningState[g.gamePk];
    if(!lastState){state.lastInningState[g.gamePk]={inning:g.inning,halfInning:g.halfInning};return;}
    if(lastState.inning===g.inning&&lastState.halfInning===g.halfInning) return;
    var recapKey=g.gamePk+'_'+lastState.inning+'_'+lastState.halfInning;
    if(state.inningRecapsFired.has(recapKey)){state.lastInningState[g.gamePk]={inning:g.inning,halfInning:g.halfInning};return;}
    genRecap(g,lastState.inning,lastState.halfInning,recapKey);
    state.lastInningState[g.gamePk]={inning:g.inning,halfInning:g.halfInning};
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
    state.transactionsCache=(d.transactions||[]).filter(function(t){return notable.some(function(kw){return (t.typeDesc||'').indexOf(kw)!==-1;});});
    state.transactionsLastFetch=Date.now();
  }catch(e){state.transactionsCache=state.transactionsCache||[];}
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
    state.highLowCache=allResults;
    state.highLowLastFetch=Date.now();
  }catch(e){state.highLowCache=state.highLowCache||{};}
}

function genRosterMoveStories(){
  var out=[];
  if(!state.transactionsCache||!state.transactionsCache.length) return out;
  var cutoff=Date.now()-48*60*60*1000;
  state.transactionsCache.forEach(function(t){
    if(!t.person||!t.person.fullName) return;
    var txDate=t.date?new Date(t.date).getTime():0;
    if(txDate&&txDate<cutoff) return;
    var fullName=t.person.fullName;
    var desc=t.typeDesc||'';
    var icon,priority,headline;
    var toAbbr=t.toTeam&&t.toTeam.id?tcLookup(t.toTeam.id).abbr:'the majors';
    if(desc.indexOf('Activated')!==-1){
      icon='✅';priority=state.devTuning.roster_priority_il||40;
      headline=fullName+' ('+toAbbr+') activated';
    }else if(desc.indexOf('Injured List')!==-1){
      icon='🏥';priority=state.devTuning.roster_priority_il||40;
      var ilMatch=desc.match(/(\d+)-Day/);var ilDays=ilMatch?ilMatch[1]:'';
      headline=fullName+' ('+toAbbr+') placed on the '+(ilDays?ilDays+'-Day ':'')+'IL';
    }else if(desc.indexOf('Designated')!==-1){
      icon='⬇️';priority=state.devTuning.roster_priority_il||40;
      headline=fullName+' ('+toAbbr+') designated for assignment';
    }else if(desc.indexOf('Selected')!==-1||desc.indexOf('Called Up')!==-1){
      icon='⬆️';priority=state.devTuning.roster_priority_trade||55;
      headline=fullName+' called up by '+toAbbr;
    }else if(desc.indexOf('Trade')!==-1){
      icon='🔄';priority=state.devTuning.roster_priority_trade||55;
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
  if(!state.focusGamePk) return out;
  var g=state.gameStates[state.focusGamePk];
  if(!g||g.status!=='Live'||g.detailedState!=='In Progress') return out;
  try{
    var r=await fetch(MLB_BASE+'/game/'+state.focusGamePk+'/contextMetrics');
    if(!r.ok) throw new Error(r.status);
    var d=await r.json();
    var homeWP=d.homeWinProbability||50;
    var leverageIndex=d.leverageIndex||1;
    var wpAdded=Math.abs(d.homeWinProbabilityAdded||0);
    var isExtreme=homeWP>=(state.devTuning.wp_extreme_floor||85)||homeWP<=(100-(state.devTuning.wp_extreme_floor||85));
    var isHighLev=leverageIndex>=(state.devTuning.wp_leverage_floor||2);
    var isBigSwing=wpAdded>=20;
    if(!isExtreme&&!isHighLev&&!isBigSwing) return out;
    var favAbbr=homeWP>50?g.homeAbbr:g.awayAbbr;
    var favWP=homeWP>50?homeWP:(100-homeWP);
    var id='wp_'+state.focusGamePk+'_'+Math.round(homeWP/5)*5;
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
    state.storyPool=state.storyPool.filter(function(s){return s.id.indexOf('wp_'+state.focusGamePk+'_')!==0;});
    out.push(makeStory(id,'realtime',tier,priority,icon,headline,sub,badge,state.focusGamePk,new Date(),3*60000,0.60));
  }catch(e){}
  return out;
}

function genSeasonHighStories(){
  var out=[];
  if(!state.highLowCache) return out;
  var SEASON_STR=String(SEASON);
  var configs=[
    {stat:'homeRuns',icon:'💥',label:'HR in a game',threshold:3},
    {stat:'strikeOuts',icon:'🔥',label:'strikeouts in a game',threshold:13},
    {stat:'hits',icon:'🏏',label:'hits in a game',threshold:4}
  ];
  configs.forEach(function(cfg){
    var results=state.highLowCache[cfg.stat]||[];
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
    out.push(makeStory(id,'contextual',4,state.devTuning.highlow_priority||25,'🎖️',headline,sub,'record',null,dateStr?new Date(dateStr):new Date(),24*60*60000,0.1));
  });
  return out;
}

async function loadLiveWPCache(){
  var livePks=Object.keys(state.gameStates).filter(function(pk){
    var g=state.gameStates[pk];return g&&g.status==='Live'&&g.detailedState==='In Progress';
  });
  if(!livePks.length){state.liveWPCache={};state.liveWPLastFetch=Date.now();return;}
  await Promise.all(livePks.map(function(pk){
    return fetch(MLB_BASE+'/game/'+pk+'/contextMetrics').then(function(r){if(!r.ok)throw new Error(r.status);return r.json();}).then(function(d){
      state.liveWPCache[pk]={homeWP:d.homeWinProbability||50,leverageIndex:d.leverageIndex||1,ts:Date.now()};
    }).catch(function(){});
  }));
  Object.keys(state.liveWPCache).forEach(function(pk){if(!state.gameStates[pk]||state.gameStates[pk].status!=='Live')delete state.liveWPCache[pk];});
  state.liveWPLastFetch=Date.now();
}

function genLiveWinProbStories(){
  var out=[];
  Object.keys(state.liveWPCache).forEach(function(pk){
    var g=state.gameStates[pk];
    if(!g||g.status!=='Live'||g.detailedState!=='In Progress') return;
    var c=state.liveWPCache[pk];
    var homeWP=c.homeWP;
    var favAbbr=homeWP>=50?g.homeAbbr:g.awayAbbr;
    var dogAbbr=homeWP>=50?g.awayAbbr:g.homeAbbr;
    var favWP=homeWP>=50?homeWP:(100-homeWP);
    var bucket=Math.round(homeWP/10)*10;
    var id='livewp_'+pk+'_'+bucket;
    var halfArrow=g.halfInning==='top'?'▲':'▼';
    var headline=favAbbr+' '+Math.round(favWP)+'% to win vs '+dogAbbr;
    var sub=g.awayAbbr+' @ '+g.homeAbbr+' · '+halfArrow+ordinal(g.inning)+' · '+g.awayScore+'–'+g.homeScore;
    out.push(makeStory(id,'contextual',4,state.devTuning.livewp_priority||30,'📈',headline,sub,'live',+pk,new Date(),15*60000,0.10));
  });
  return out;
}

function genDailyIntro(){
  var todayStr=localDateStr(getEffectiveDate());
  var todayGames=Object.values(state.gameStates).filter(function(g){
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
    var raw=state.storyCarouselRawGameData&&state.storyCarouselRawGameData[g.gamePk];
    if(!raw||!raw.teams) return;
    var aPP=raw.teams.away&&raw.teams.away.probablePitcher;
    var hPP=raw.teams.home&&raw.teams.home.probablePitcher;
    if(!aPP||!hPP) return;
    var aS=state.probablePitcherStatsCache[aPP.id]||{}, hS=state.probablePitcherStatsCache[hPP.id]||{};
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
  if(now-state.dailyLeadersLastFetch>5*60000){loadDailyLeaders();state.dailyLeadersLastFetch=now;}
  if(now-state.transactionsLastFetch>120*60000){loadTransactionsCache();}
  if(now-state.highLowLastFetch>6*60*60000){loadHighLowCache();}
  if(now-state.liveWPLastFetch>(state.devTuning.livewp_refresh_ms||90000)){loadLiveWPCache();}
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
  state.storyPool=fresh.slice().sort(function(a,b){return b.priority-a.priority;});
  var carousel=document.getElementById('storyCarousel');
  if(!carousel) return;
  if(state.storyPool.length){
    if(carousel.style.display==='none'){
      carousel.style.display='';
      rotateStory();
      if(!state.storyRotateTimer) state.storyRotateTimer=setInterval(rotateStory,state.devTuning.rotateMs);
    }
  } else {
    carousel.style.display='none';
    if(state.storyRotateTimer){clearInterval(state.storyRotateTimer);state.storyRotateTimer=null;}
  }
}

function rotateStory(){
  if(!state.storyPool.length) return;
  var now=Date.now();
  var maxCooldown=Math.max(state.storyPool.length*state.devTuning.rotateMs*1.5,2*60000);
  var eligible=state.storyPool.filter(function(s){return !s.lastShown||(now-s.lastShown.getTime())>Math.min(s.cooldownMs,maxCooldown);});
  if(!eligible.length){eligible=state.storyPool.slice().sort(function(a,b){return (a.lastShown?a.lastShown.getTime():0)-(b.lastShown?b.lastShown.getTime():0);});}
  var scored=eligible.map(function(s){
    var ageMin=(now-s.ts.getTime())/60000;
    var decay=Math.pow(Math.max(0,1-s.decayRate),ageMin/30);
    return {s:s,score:s.priority*decay};
  });
  scored.sort(function(a,b){return b.score-a.score;});
  showStoryCard(scored[0].s);
}

function showStoryCard(story){
  story.lastShown=new Date(); state.storyShownId=story.id;
  state.displayedStoryIds.add(story.id);
  renderStoryCard(story); updateStoryDots();
  refreshDebugPanel();
}

function renderStoryCard(story){
  var el=document.getElementById('storyCard'); if(!el) return;
  var badgeMap={live:'live',final:'final',today:'today',yesterday:'yesterday',onthisday:'onthisday',upcoming:'upcoming',leaders:'leaders',probables:'probables',highlight:'highlight',inning_recap:'inning_recap',hot:'hot',cold:'cold',streak:'streak',roster:'roster',award:'award',record:'award'};
  var labelMap={live:'LIVE',final:'FINAL',today:'TODAY',yesterday:'YESTERDAY',onthisday:'ON THIS DAY',upcoming:'UPCOMING',leaders:'LEADERS',probables:"TODAY'S PROBABLE PITCHERS",highlight:'HIGHLIGHT',inning_recap:'INNING RECAP',hot:'HOT',cold:'COLD',streak:'HITTING STREAK',roster:'ROSTER MOVE',award:'AWARD',record:'SEASON HIGH'};
  var bc=badgeMap[story.badge]||'today', bl=labelMap[story.badge]||'TODAY';
  el.className='story-card tier'+story.tier+(story.id.indexOf('biginning')===0?' story-biginning':'')+(story.id.indexOf('leader_')===0?' story-leaders':'');
  el.innerHTML='<div><span class="story-badge '+bc+'">'+bl+'</span></div>'
    +'<div style="display:flex;align-items:flex-start;gap:6px;margin-top:2px">'
    +'<span class="story-icon">'+story.icon+'</span>'
    +'<div><div class="story-headline">'+story.headline+'</div>'
    +(story.sub?'<div class="story-sub">'+story.sub+'</div>':'')
    +'</div></div>';
}

function updateStoryDots(){
  var el=document.getElementById('storyDots'); if(!el) return;
  var max=Math.min(state.storyPool.length,8);
  var curIdx=state.storyPool.findIndex(function(s){return s.id===state.storyShownId;});
  var html='';
  for(var i=0;i<max;i++) html+='<div class="story-dot'+(i===curIdx?' active':'')+'"></div>';
  el.innerHTML=html;
}

function prevStory(){
  if(!state.storyPool.length) return;
  var idx=state.storyPool.findIndex(function(s){return s.id===state.storyShownId;});
  showStoryCard(state.storyPool[idx<=0?state.storyPool.length-1:idx-1]);
}

function nextStory(){
  if(!state.storyPool.length) return;
  var idx=state.storyPool.findIndex(function(s){return s.id===state.storyShownId;});
  showStoryCard(state.storyPool[idx>=state.storyPool.length-1?0:idx+1]);
}

function onStoryVisibilityChange(){
  if(document.hidden){clearInterval(state.storyRotateTimer);state.storyRotateTimer=null;}
  else if(state.pulseInitialized&&state.storyPool.length){rotateStory();state.storyRotateTimer=setInterval(rotateStory,state.devTuning.rotateMs);}
}

async function loadOnThisDayCache(){
  state.onThisDayCache=[];
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
        state.onThisDayCache.push({id:'otd_'+yr+'_'+g.gamePk,icon:'📅',headline:headline,sub:(g.venue?g.venue.name:''),gamePk:g.gamePk,ts:new Date(g.gameDate||Date.now())});
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
  state.yesterdayCache=[];
  var yd=new Date(); yd.setDate(yd.getDate()-1);
  var dateStr=yd.getFullYear()+'-'+String(yd.getMonth()+1).padStart(2,'0')+'-'+String(yd.getDate()).padStart(2,'0');
  state.yesterdayCache=await loadYdForDate(dateStr);
  // Prepend "Yesterday: " prefix so genYesterdayHighlights() story carousel reads it correctly
  state.yesterdayCache.forEach(function(item){item.headline='Yesterday: '+item.headline;});
  updateFeedEmpty();
}

async function loadDailyLeaders(){
  if(state.demoMode){if(DEBUG) console.log('Demo: Skipping loadDailyLeaders API call');return;}
  try{
    var rH=await fetch(MLB_BASE+'/stats/leaders?leaderCategories=homeRuns,battingAverage,rbi,stolenBases&season='+SEASON+'&statGroup=hitting&limit=5');
    if(!rH.ok) throw new Error(rH.status);
    var dH=await rH.json();
    var rP=await fetch(MLB_BASE+'/stats/leaders?leaderCategories=wins,saves&season='+SEASON+'&statGroup=pitching&limit=5');
    if(!rP.ok) throw new Error(rP.status);
    var dP=await rP.json();
    state.dailyLeadersCache={};
    [(dH.leagueLeaders||[]),(dP.leagueLeaders||[])].forEach(function(list){
      list.forEach(function(cat){if(cat.leaderCategory&&cat.leaders) state.dailyLeadersCache[cat.leaderCategory]=cat.leaders;});
    });
  }catch(e){}
}

function ordinal(n){return n===1?'1st':n===2?'2nd':n===3?'3rd':n+'th';}

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
  if(g.gamePk===state.focusGamePk){
    if(state.focusState.balls===3&&state.focusState.strikes===2) countBonus=20;
    else if(state.focusState.strikes===2) countBonus=12;
    if(state.focusState.outs===2) countBonus+=8;
  }
  var innMult=g.inning<=5?0.6:g.inning<=8?1.0:g.inning===9?1.5:2.0;
  return (closeness+situation+countBonus)*innMult;
}

function getTensionInfo(score) {
  if(score>=state.devTuning.focus_critical) return {label:'CRITICAL',color:'#e03030'};
  if(score>=state.devTuning.focus_high)     return {label:'HIGH',color:'#f59e0b'};
  return {label:'NORMAL',color:'#9aa0a8'};
}

function selectFocusGame() {
  var liveGames=Object.values(state.gameStates).filter(function(g){return g.status==='Live'&&g.detailedState==='In Progress';});
  if(!liveGames.length) return;
  var scored=liveGames.map(function(g){return {g:g,score:calcFocusScore(g)};});
  scored.sort(function(a,b){return b.score-a.score;});
  var best=scored[0];
  // Auto-select on first run or if current game is no longer live
  if(!state.focusGamePk||!state.gameStates[state.focusGamePk]||state.gameStates[state.focusGamePk].status!=='Live') {
    state.focusIsManual=false;
    setFocusGame(best.g.gamePk); return;
  }
  // Soft alert if a different game scores ≥25 higher (with 90s cooldown)
  if(best.g.gamePk!==state.focusGamePk&&best.score-calcFocusScore(state.gameStates[state.focusGamePk])>=state.devTuning.focus_switch_margin) {
    var now=Date.now();
    if(!state.focusAlertShown[best.g.gamePk]||(now-state.focusAlertShown[best.g.gamePk])>state.devTuning.focus_alert_cooldown) {
      state.focusAlertShown[best.g.gamePk]=now;
      var tension=getTensionInfo(best.score);
      showFocusAlert(best.g.gamePk,tension.label+' · '+best.g.awayAbbr+' @ '+best.g.homeAbbr);
    }
  }
}

function setFocusGame(pk) {
  if(!pk) return;
  state.focusGamePk=pk;
  state.focusPitchSequence=[];
  state.focusCurrentAbIdx=null;
  state.focusLastTimecode=null;
  state.focusState.batterStats=null;
  state.focusState.pitcherStats=null;
  dismissFocusAlert();
  if(state.focusFastTimer){clearInterval(state.focusFastTimer);state.focusFastTimer=null;}
  if(state.focusAbortCtrl){state.focusAbortCtrl.abort();state.focusAbortCtrl=null;}
  if(state.focusOverlayOpen) renderFocusOverlay();
  updateRadioForFocus();
  pollFocusLinescore();
  state.focusFastTimer=setInterval(pollFocusLinescore,TIMING.FOCUS_POLL_MS);
}
function setFocusGameManual(pk) {
  devTrace('focus','manual pick · gamePk='+pk);
  state.focusIsManual=true;
  setFocusGame(pk);
}
function resetFocusAuto() {
  state.focusIsManual=false;
  var live=Object.values(state.gameStates).filter(function(g){return g.status==='Live'&&g.detailedState==='In Progress';});
  if(!live.length) return;
  var scored=live.map(function(g){return {g:g,score:calcFocusScore(g)};});
  scored.sort(function(a,b){return b.score-a.score;});
  setFocusGame(scored[0].g.gamePk);
}

async function pollFocusLinescore() {
  if(!state.focusGamePk) return;
  if(state.demoMode) { renderFocusCard(); renderFocusMiniBar(); return; }
  if(state.focusAbortCtrl){state.focusAbortCtrl.abort();}
  state.focusAbortCtrl=new AbortController();
  var focusSig=state.focusAbortCtrl.signal;
  try {
    var r=await fetch(MLB_BASE+'/game/'+state.focusGamePk+'/linescore',{signal:focusSig});
    if(!r.ok) throw new Error(r.status);
    var ls=await r.json();
    var g=state.gameStates[state.focusGamePk]||{};
    var tension=getTensionInfo(calcFocusScore(g));
    state.focusState={
      balls:ls.balls||0, strikes:ls.strikes||0, outs:ls.outs||0,
      inning:ls.currentInning||g.inning||1,
      halfInning:ls.isTopInning===false?'bottom':'top',
      currentBatterId:(ls.offense&&ls.offense.batter&&ls.offense.batter.id)||null,
      currentBatterName:(ls.offense&&ls.offense.batter&&ls.offense.batter.fullName)||state.focusState.currentBatterName||'',
      currentPitcherId:(ls.defense&&ls.defense.pitcher&&ls.defense.pitcher.id)||null,
      currentPitcherName:(ls.defense&&ls.defense.pitcher&&ls.defense.pitcher.fullName)||state.focusState.currentPitcherName||'',
      onFirst:!!(ls.offense&&ls.offense.first),
      onSecond:!!(ls.offense&&ls.offense.second),
      onThird:!!(ls.offense&&ls.offense.third),
      awayAbbr:g.awayAbbr||'', homeAbbr:g.homeAbbr||'',
      awayScore:g.awayScore||0, homeScore:g.homeScore||0,
      awayPrimary:g.awayPrimary||'#444', homePrimary:g.homePrimary||'#444',
      tensionLabel:tension.label, tensionColor:tension.color,
      lastPitch:state.focusPitchSequence.length?state.focusPitchSequence[state.focusPitchSequence.length-1]:null,
      batterStats:state.focusStatsCache[(ls.offense&&ls.offense.batter&&ls.offense.batter.id)]||null,
      pitcherStats:state.focusStatsCache[(ls.defense&&ls.defense.pitcher&&ls.defense.pitcher.id)]||null
    };
    fetchFocusPlayerStats(state.focusState.currentBatterId, state.focusState.currentPitcherId);
    renderFocusCard(); renderFocusMiniBar();
    if(state.focusOverlayOpen) renderFocusOverlay();
    pollFocusRich(focusSig);
  } catch(e) {if(e.name!=='AbortError')console.error('pollFocusLinescore error',e);}
}

async function fetchFocusPlayerStats(batterId, pitcherId) {
  if(state.demoMode) return;
  var changed=false;
  if(batterId&&!state.focusStatsCache[batterId]) {
    try {
      var r=await fetch(MLB_BASE+'/people/'+batterId+'/stats?stats=season&group=hitting&season='+SEASON);
      if(!r.ok) throw new Error(r.status);
      var d=await r.json();
      var s=(d.stats&&d.stats[0]&&d.stats[0].splits&&d.stats[0].splits[0]&&d.stats[0].splits[0].stat)||{};
      state.focusStatsCache[batterId]={avg:s.avg||'—',obp:s.obp||'—',ops:s.ops||'—',hr:s.homeRuns!=null?s.homeRuns:'—',rbi:s.rbi!=null?s.rbi:'—'};
      changed=true;
    } catch(e){}
  }
  if(pitcherId&&!state.focusStatsCache[pitcherId]) {
    try {
      var r2=await fetch(MLB_BASE+'/people/'+pitcherId+'/stats?stats=season&group=pitching&season='+SEASON);
      if(!r2.ok) throw new Error(r2.status);
      var d2=await r2.json();
      var s2=(d2.stats&&d2.stats[0]&&d2.stats[0].splits&&d2.stats[0].splits[0]&&d2.stats[0].splits[0].stat)||{};
      state.focusStatsCache[pitcherId]={era:s2.era||'—',whip:s2.whip||'—',wins:s2.wins!=null?s2.wins:'—',losses:s2.losses!=null?s2.losses:'—'};
      changed=true;
    } catch(e){}
  }
  if(!changed) return;
  if(batterId&&state.focusStatsCache[batterId]) state.focusState.batterStats=state.focusStatsCache[batterId];
  if(pitcherId&&state.focusStatsCache[pitcherId]) state.focusState.pitcherStats=state.focusStatsCache[pitcherId];
  if(state.focusOverlayOpen) renderFocusOverlay();
}

async function pollFocusRich(sig) {
  if(!state.focusGamePk||state.demoMode) return;
  try {
    var data;
    if(!state.focusLastTimecode) {
      // First call: full feed to seed state and get initial timecode
      var r=await fetch(MLB_BASE_V1_1+'/game/'+state.focusGamePk+'/feed/live',sig?{signal:sig}:{});
      if(!r.ok) throw new Error(r.status);
      data=await r.json();
      var tsList=data&&data.metaData&&data.metaData.timeStamp;
      if(tsList) state.focusLastTimecode=tsList;
    } else {
      // Subsequent calls: delta only (~1-5KB vs ~500KB)
      var tsResp=await fetch(MLB_BASE_V1_1+'/game/'+state.focusGamePk+'/feed/live/timestamps',sig?{signal:sig}:{});
      if(!tsResp.ok) throw new Error(tsResp.status);
      var tsArr=await tsResp.json();
      var latest=Array.isArray(tsArr)&&tsArr.length?tsArr[tsArr.length-1]:null;
      if(!latest||latest===state.focusLastTimecode) return; // nothing new
      var dResp=await fetch(MLB_BASE_V1_1+'/game/'+state.focusGamePk+'/feed/live/diffPatch?startTimecode='+encodeURIComponent(state.focusLastTimecode)+'&endTimecode='+encodeURIComponent(latest),sig?{signal:sig}:{});
      if(!dResp.ok) throw new Error(dResp.status);
      var patch=await dResp.json();
      state.focusLastTimecode=latest;
      // diffPatch wraps currentPlay under liveData.plays.currentPlay same as full feed
      data=patch;
    }
    var cp=data&&data.liveData&&data.liveData.plays&&data.liveData.plays.currentPlay;
    if(!cp) return;
    var abIdx=cp.about&&cp.about.atBatIndex;
    if(state.focusCurrentAbIdx!==null&&state.focusCurrentAbIdx!==abIdx) state.focusPitchSequence=[];
    state.focusCurrentAbIdx=abIdx;
    var pitchEvents=(cp.playEvents||[]).filter(function(e){return e.isPitch||e.type==='pitch';});
    state.focusPitchSequence=pitchEvents.map(function(e){
      return {
        typeCode:(e.details&&e.details.type&&e.details.type.code)||'??',
        typeName:(e.details&&e.details.type&&e.details.type.description)||'',
        speed:(e.pitchData&&e.pitchData.startSpeed)||null,
        resultCode:(e.details&&e.details.code)||'',
        resultDesc:(e.details&&e.details.description)||'',
        sequenceIndex:e.pitchNumber||0
      };
    });
    if(state.focusPitchSequence.length) state.focusState.lastPitch=state.focusPitchSequence[state.focusPitchSequence.length-1];
    renderFocusCard();
    if(state.focusOverlayOpen) renderFocusOverlay();
  } catch(e) { if(e.name!=='AbortError') console.error('pollFocusRich error',e); }
}

function renderFocusCard() {
  var el=document.getElementById('focusCard'); if(!el) return;
  if(!state.focusGamePk||(!state.focusState.awayAbbr&&!state.demoMode)){el.style.display='none';return;}
  el.style.display='';
  var liveGames=Object.values(state.gameStates).filter(function(g){return g.status==='Live'&&g.detailedState==='In Progress';});
  var cardData=Object.assign({},state.focusState,{
    isManual: state.focusIsManual,
    allLiveGames: liveGames.map(function(g){
      return {gamePk:g.gamePk,awayAbbr:g.awayAbbr,homeAbbr:g.homeAbbr,
              awayPrimary:g.awayPrimary,homePrimary:g.homePrimary,
              inning:g.inning,isFocused:g.gamePk===state.focusGamePk};
    })
  });
  el.innerHTML=window.FocusCard.renderCard(cardData);
}

function renderFocusMiniBar() {
  var el=document.getElementById('focusMiniBar'); if(!el) return;
  if(!state.focusGamePk||!state.focusState.awayAbbr){el.style.display='none';return;}
  var half=state.focusState.halfInning==='bottom'?'▼':'▲';
  var liveGames=Object.values(state.gameStates).filter(function(g){return g.status==='Live'&&g.detailedState==='In Progress';});
  var showStrip=liveGames.length>1||state.focusIsManual;
  var stripHtml='';
  if(showStrip){
    stripHtml='<div style="display:flex;align-items:center;gap:5px;padding:3px 10px 4px;background:var(--p-dark,#080e1c);border-bottom:1px solid var(--p-border,#1e2d4a);overflow-x:auto;-webkit-overflow-scrolling:touch;">';
    if(state.focusIsManual){
      stripHtml+='<button onclick="resetFocusAuto()" style="flex:0 0 auto;padding:2px 7px;border-radius:4px;border:1px solid rgba(34,197,94,.35);background:rgba(34,197,94,.08);font:700 9px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.1em;color:#22c55e;cursor:pointer">↩ AUTO</button>';
    }
    liveGames.forEach(function(g){
      var focused=g.gamePk===state.focusGamePk;
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
    +'<span style="font:700 10px/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--p-text,#e8eaf0);letter-spacing:.06em">'+state.focusState.awayAbbr+' <strong>'+state.focusState.awayScore+'</strong> – <strong>'+state.focusState.homeScore+'</strong> '+state.focusState.homeAbbr+'</span>'
    +'<span style="font:600 10px/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--p-muted,#9aa0a8)">'+half+state.focusState.inning+' · '+state.focusState.balls+'-'+state.focusState.strikes+' · '+state.focusState.outs+' out</span>'
    +'<button onclick="openFocusOverlay()" style="padding:3px 8px;background:var(--p-dark,#0a0f1e);border:1px solid var(--p-border,#1e2d4a);border-radius:4px;color:var(--p-text,#e8eaf0);font:700 10px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.1em;cursor:pointer">FOCUS →</button>'
    +'</div>'
    +stripHtml;
}

function openFocusOverlay() {
  var el=document.getElementById('focusOverlay'); if(!el||!state.focusGamePk) return;
  state.focusOverlayOpen=true;
  el.style.display='flex';
  renderFocusOverlay();
}

function closeFocusOverlay() {
  var el=document.getElementById('focusOverlay'); if(!el) return;
  state.focusOverlayOpen=false;
  el.style.display='none';
}

function renderFocusOverlay() {
  var card=document.getElementById('focusOverlayCard'); if(!card) return;
  var liveGames=Object.values(state.gameStates).filter(function(g){return g.status==='Live'&&g.detailedState==='In Progress';});
  var data=Object.assign({},state.focusState,{
    pitchSequence: state.focusPitchSequence,
    allLiveGames: liveGames.map(function(g){
      return {gamePk:g.gamePk,awayAbbr:g.awayAbbr,homeAbbr:g.homeAbbr,
              awayScore:g.awayScore,homeScore:g.homeScore,inning:g.inning,
              halfInning:g.halfInning,isFocused:g.gamePk===state.focusGamePk};
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
  if (state.countdownTimer){clearInterval(state.countdownTimer);state.countdownTimer=null;}
  function tick() {
    var el=document.getElementById('heroCountdown');
    if (!el){clearInterval(state.countdownTimer);state.countdownTimer=null;return;}
    var diff=targetMs-Date.now();
    if (diff<=0){el.textContent='Starting now';}
    else if (diff>=3600000){var hrs=Math.floor(diff/3600000),mins=Math.ceil((diff%3600000)/60000);el.textContent='First pitch in '+hrs+'h'+(mins>0?' '+mins+'m':'');}
    else{var mins=Math.ceil(diff/60000);el.textContent='First pitch in '+mins+'m';}
  }
  tick(); state.countdownTimer=setInterval(tick,30000);
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

function updateFeedEmpty() {
  var feed=document.getElementById('feed');
  var hasVisible=!!feed.querySelector('.feed-item:not(.feed-hidden)');
  var hasAnyGames=Object.keys(state.gameStates).length>0;
  var hasLiveInProgress=Object.values(state.gameStates).some(function(g){return g.status==='Live'&&g.detailedState==='In Progress';});
  var postSlate=isPostSlate();
  var intermission=!postSlate&&isIntermission();
  var showHype=(!hasVisible&&!(state.myTeamLens&&hasLiveInProgress))||(!hasAnyGames)||postSlate||intermission;
  if (showHype) renderEmptyState(postSlate, intermission);
  document.getElementById('feedEmpty').style.display=showHype?'':'none';
  var hideWhenEmpty=['gameTicker','sideRailNews','sideRailGames','myTeamLensBtn'];
  document.getElementById('pulse').classList.toggle('pulse-empty', !hasAnyGames || showHype);
  hideWhenEmpty.forEach(function(id){
    var el=document.getElementById(id);
    if(el) el.style.display=showHype?'none':'';
  });
  var ybtn=document.getElementById('ptbYestBtn');
  if(ybtn) ybtn.style.display=(state.yesterdayCache&&state.yesterdayCache.length&&!showHype)?'':'none';
}

function isPostSlate() {
  var games=Object.values(state.gameStates);
  if (!games.length) return false;
  if (!games.every(function(g){return g.status==='Final';})) return false;
  var lastTerminalMs=0;
  state.feedItems.forEach(function(fi){
    if (fi.data&&fi.data.type==='status'&&(fi.data.label==='Game Final'||fi.data.label==='Game Postponed')) {
      var ms=fi.ts.getTime(); if (ms>lastTerminalMs) lastTerminalMs=ms;
    }
  });
  if (!lastTerminalMs) return false;
  return (Date.now()-lastTerminalMs) > (state.devTuning.postSlateRevertMs||20*60*1000);
}

function isIntermission() {
  var games=Object.values(state.gameStates);
  if (!games.length) return false;
  if (!games.some(function(g){return g.status==='Final';})) return false;
  if (games.some(function(g){return g.status==='Live'&&g.detailedState==='In Progress';})) return false;
  if (!games.some(function(g){return g.status!=='Final';})) return false;
  var lastTerminalMs=0;
  state.feedItems.forEach(function(fi){
    if (fi.data&&fi.data.type==='status'&&(fi.data.label==='Game Final'||fi.data.label==='Game Postponed')) {
      var ms=fi.ts.getTime(); if (ms>lastTerminalMs) lastTerminalMs=ms;
    }
  });
  if (!lastTerminalMs) return false;
  return (Date.now()-lastTerminalMs) > (state.devTuning.intermissionRevertMs||20*60*1000);
}

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

async function fetchTomorrowPreview() {
  if (state.tomorrowPreview.inFlight) return;
  if (Date.now()-state.tomorrowPreview.fetchedAt < 10*60*1000) return;
  state.tomorrowPreview.inFlight=true;
  try {
    var seed=state.pollDateStr?state.pollDateStr.split('-').map(Number):null;
    var nextDate=seed?new Date(seed[0],seed[1]-1,seed[2]):new Date();
    nextDate.setDate(nextDate.getDate()+1);
    var ts=localDateStr(nextDate);
    var r=await fetch(MLB_BASE+'/schedule?sportId=1&date='+ts+'&hydrate=team');
    if(!r.ok) throw new Error(r.status);
    var d=await r.json();
    var games=(d.dates||[]).flatMap(function(dt){return dt.games||[];});
    state.tomorrowPreview.dateStr=ts;
    state.tomorrowPreview.gameCount=games.length;
    if (games.length) {
      games.sort(function(a,b){return new Date(a.gameDate).getTime()-new Date(b.gameDate).getTime();});
      var first=games[0], ms=new Date(first.gameDate).getTime();
      state.tomorrowPreview.firstPitchMs=ms;
      state.tomorrowPreview.gameTime=new Date(ms).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
    } else {
      state.tomorrowPreview.firstPitchMs=null;
      state.tomorrowPreview.gameTime=null;
    }
    state.tomorrowPreview.fetchedAt=Date.now();
    if (isPostSlate()) renderEmptyState(true);
  } catch(e){if(DEBUG)console.warn('fetchTomorrowPreview',e);}
  finally{state.tomorrowPreview.inFlight=false;}
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
  var upcoming=Object.values(state.gameStates).filter(function(g){
    if(!(g.status==='Preview'||g.status==='Scheduled'||(g.status==='Live'&&g.detailedState!=='In Progress'))) return false;
    // Exclude DH game 2 while its game 1 partner is live
    var rawG=state.storyCarouselRawGameData&&state.storyCarouselRawGameData[g.gamePk];
    if(rawG&&rawG.doubleHeader==='Y'&&rawG.gameNumber==2){
      if(Object.values(state.gameStates).some(function(s){return s.status==='Live'&&s.awayId===g.awayId&&s.homeId===g.homeId;})) return false;
    }
    return true;
  });
  upcoming.sort(function(a,b){var aMs=a.gameDateMs||0,bMs=b.gameDateMs||0;if(aMs!==bMs)return aMs-bMs;return a.awayAbbr.localeCompare(b.awayAbbr);});
  devTrace('empty','renderEmptyState · upcoming='+upcoming.length+' · postSlate='+postSlate+' · intermission='+intermission);
  if (!upcoming.length){
    el.className='';
    if (postSlate) {
      fetchTomorrowPreview();
      var subText='Live play-by-play returns when games begin.';
      var countdownHtml='';
      if (state.tomorrowPreview.firstPitchMs) {
        countdownHtml='<div id="heroCountdown" style="margin-top:14px;font-size:1rem;color:var(--accent);font-weight:700"></div>';
        var n=state.tomorrowPreview.gameCount;
        subText='Next slate · '+n+' '+(n===1?'game':'games')+' · first pitch '+(state.tomorrowPreview.gameTime||'TBD');
      } else if (state.tomorrowPreview.fetchedAt && state.tomorrowPreview.gameCount===0) {
        subText='No games scheduled in the next slate.';
      }
      var slateRecapCta=(state.yesterdayCache&&state.yesterdayCache.length)?'<button onclick="openYesterdayRecap()" style="margin-top:20px;display:inline-flex;align-items:center;gap:7px;background:none;border:1px solid var(--accent);color:var(--accent);font-size:.8rem;font-weight:700;letter-spacing:.06em;padding:9px 18px;border-radius:7px;cursor:pointer">📺 Yesterday\'s Highlights →</button>':'';
      el.innerHTML='<span class="empty-icon">🏁</span><div class="empty-title">Slate complete</div><div class="empty-sub">'+subText+'</div>'+countdownHtml+slateRecapCta;
      if (state.tomorrowPreview.firstPitchMs) startCountdown(state.tomorrowPreview.firstPitchMs);
    } else {
      var g0=pulseGreeting();
      el.innerHTML='<span class="empty-icon">⚾</span><div class="empty-title">'+g0.kicker+'</div><div class="empty-sub">'+g0.headline+'</div>';
    }
    return;
  }
  el.className='has-upcoming';
  var hero=upcoming[0], rest=upcoming.slice(1), n=upcoming.length;
  var heroGrad=state.themeOverride===MLB_THEME?'linear-gradient(90deg,'+MLB_THEME.primary+' 0%,#111827 45%,'+MLB_THEME.primary+' 100%)':'linear-gradient(90deg,'+hero.awayPrimary+' 0%,#111827 45%,'+hero.homePrimary+' 100%)';
  var greeting=pulseGreeting();
  var labelText=intermission
    ? 'NEXT UP &middot; '+n+(n===1?' GAME REMAINING':' GAMES REMAINING')
    : n+(n===1?' UPCOMING GAME':' UPCOMING GAMES');
  var hypeRecapCta=(state.yesterdayCache&&state.yesterdayCache.length)?'<button onclick="openYesterdayRecap()" style="display:inline-flex;align-items:center;gap:7px;margin:8px 0 14px;background:none;border:1px solid var(--accent);color:var(--accent);font-size:.78rem;font-weight:700;letter-spacing:.06em;padding:7px 16px;border-radius:7px;cursor:pointer">📺 Yesterday\'s Highlights →</button>':'';
  var hypeBlock=intermission?'':
    '<div class="empty-hype-block"><button class="demo-cta" onclick="toggleDemoMode()">'+(state.demoMode?'⏹ Exit Demo':'▶ Try Demo')+'</button><div class="empty-hype-headline">'+greeting.headline+'</div>'
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
  var idx=state.feedItems.findIndex(function(fi){return fi.ts<=item.ts;});
  if(idx===-1) state.feedItems.push(item); else state.feedItems.splice(idx,0,item);
  if(state.feedItems.length>600) state.feedItems.length=600;
  var el=buildFeedEl(item);
  el.dataset.ts=item.ts.getTime();
  if(!state.enabledGames.has(+gamePk)) el.classList.add('feed-hidden');
  var feed=document.getElementById('feed');
  var tsMs=item.ts.getTime();
  var sibling=Array.from(feed.children).find(function(c){return +c.dataset.ts<tsMs;});
  feed.insertBefore(el,sibling||null);
  updateFeedEmpty();
}

function buildFeedEl(item) {
  var el=document.createElement('div'), g=state.gameStates[item.gamePk], d=item.data;
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
  state.feedItems.forEach(function(item){
    if(state.demoMode&&item.ts.getTime()>state.demoCurrentTime) return;
    var el=buildFeedEl(item);el.dataset.ts=item.ts.getTime();if(!state.enabledGames.has(+item.gamePk))el.classList.add('feed-hidden');feed.appendChild(el);
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

// ── 🔍 Radio Check ────────────────────────────────────────────────────────
var radioCheckResults={}; // key: teamId or 'fallback' → 'yes'|'no' (absent = untested)
var radioCheckNotes={};   // key: teamId or 'fallback' → free-text note
var radioCheckPlayingKey=null;
// Default notes seeded once (preserves user edits via mlb_radio_check_notes_seeded_v2 flag).
// Approved/working stations verified 2026-05-02 sweep.
// Untested per CLAUDE.md: 112 CHC, 137 SF.
// URL updated in v3.34.1 (not yet confirmed): 109, 110, 113, 115, 118, 119, 121, 133, 139, 145, 158.
// RADIO_CHECK_DEFAULT_NOTES imported from ./radio/stations.js
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
  return Object.values(state.gameStates).some(function(g){
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
// 🧪 Custom URL — paste any stream URL and play through the existing radio engine.
// Overrides whatever's currently playing. Format auto-detected from extension if 'auto'.
function radioCheckTryCustom(){
  var url=(document.getElementById('radioCustomUrl')||{}).value||'';
  url=url.trim();
  var status=document.getElementById('radioCustomStatus');
  if(!url){if(status)status.textContent='Paste a URL first.';return;}
  if(!/^https?:\/\//i.test(url)){if(status)status.textContent='URL must start with http:// or https://';return;}
  var fmtSel=(document.getElementById('radioCustomFmt')||{}).value||'auto';
  var fmt=fmtSel;
  if(fmt==='auto') fmt=/\.m3u8(\?|$)/i.test(url)?'hls':'mp3';
  if(status)status.innerHTML='<span style="color:var(--text)">Loading · format='+fmt+'…</span>';
  var pick={teamId:null,abbr:'TEST',name:'Custom · '+(fmt==='hls'?'HLS':'MP3'),url:url,format:fmt};
  radioCheckPlayingKey=null; // not a known entry
  devTrace('radio','custom URL · fmt='+fmt+' · '+url);
  // Briefly hook into the audio element to surface play/error to the dev panel
  try{
    var audio=radioAudio||new Audio();
    var onPlay=function(){if(status)status.innerHTML='<span style="color:#22c55e">✅ Playing · '+fmt.toUpperCase()+' · '+escapeHtml(url.length>80?url.slice(0,80)+'…':url)+'</span>';audio.removeEventListener('playing',onPlay);};
    var onErr=function(e){if(status)status.innerHTML='<span style="color:#ff6b6b">❌ Failed · '+(e&&e.message||'audio error')+'</span>';audio.removeEventListener('error',onErr);};
    audio.addEventListener('playing',onPlay,{once:true});
    audio.addEventListener('error',onErr,{once:true});
  }catch(e){}
  loadRadioStream(pick);
  renderRadioCheckList();
}
function radioCheckStop(){
  radioCheckPlayingKey=null;
  if(radioAudio&&!radioAudio.paused)stopRadio();
  if(document.getElementById('radioCheckOverlay').style.display!=='none')renderRadioCheckList();
  var st=document.getElementById('radioCustomStatus');
  if(st) st.textContent='Stopped.';
}

// ── 📺 YouTube Channel Test ──────────────────────────────────────────────────
// Two modes in one overlay:
//  1. Try a custom channel — paste UC id or channel URL, fetch via /api/proxy-youtube,
//     preview videos, optionally apply to state.activeTeam.youtubeUC (session-only override
//     so the home YouTube widget reloads with the new channel for testing).
//  2. Sweep all 30 — bulk test every team's youtubeUC + the MLB fallback.
//     Ported from claude/debug-youtube-api-SYBtV branch (Anthropic, May 2026).
var ytDebugResults={};
function openYoutubeDebug(){
  document.getElementById('ytDebugOverlay').style.display='flex';
  renderYoutubeDebugList();
  // Pre-fill custom input with active team's current UC for easy edit/replace
  var inp=document.getElementById('ytCustomInput');
  if(inp && !inp.value && state.activeTeam && state.activeTeam.youtubeUC) inp.value=state.activeTeam.youtubeUC;
}
function closeYoutubeDebug(){
  document.getElementById('ytDebugOverlay').style.display='none';
}
function parseYTChannelInput(s){
  s=(s||'').trim();
  if(!s) return {error:'Empty.'};
  if(/^UC[A-Za-z0-9_-]{20,30}$/.test(s)) return {uc:s};
  var m=s.match(/youtube\.com\/channel\/(UC[A-Za-z0-9_-]{20,30})/);
  if(m) return {uc:m[1]};
  if(/youtube\.com\/(@|user\/|c\/)/i.test(s) || /^@/.test(s)){
    return {error:"@handle / /user / /c can't be resolved client-side. Visit the channel → ⋯ → Share Channel → Copy Channel ID (UCxxx…)."};
  }
  return {error:'Not recognised. Paste a UC channel id or a youtube.com/channel/UCxxx URL.'};
}
function ytDebugFetchCustom(){
  var raw=(document.getElementById('ytCustomInput')||{}).value||'';
  var out=document.getElementById('ytCustomResult');
  var p=parseYTChannelInput(raw);
  if(p.error){if(out)out.innerHTML='<span style="color:#ff6b6b">'+escapeHtml(p.error)+'</span>';return;}
  var uc=p.uc;
  if(out) out.innerHTML='<span style="color:var(--text)">⏳ Fetching '+escapeHtml(uc)+'…</span>';
  var t0=Date.now();
  fetch(API_BASE+'/api/proxy-youtube?channel='+encodeURIComponent(uc))
    .then(function(r){return r.json().then(function(j){return {res:r,j:j};});})
    .then(function(o){
      var ms=Date.now()-t0;
      if(!o.res.ok || !o.j.success || !o.j.videos || !o.j.videos.length){
        var msg='HTTP '+o.res.status+(o.j&&o.j.error?' · '+o.j.error:o.j&&o.j.message?' · '+o.j.message:'');
        if(out) out.innerHTML='<span style="color:#ff6b6b">❌ '+escapeHtml(msg)+' · '+ms+'ms</span>';
        return;
      }
      var v=o.j.videos.slice(0,5);
      var teamLbl=state.activeTeam?state.activeTeam.short:'team';
      var html='<div style="color:#22c55e;font-weight:700">✅ HTTP '+o.res.status+' · '+o.j.count+' videos · '+ms+'ms</div>';
      html+='<div style="margin-top:6px;display:flex;flex-direction:column;gap:4px">';
      v.forEach(function(vid){
        html+='<div style="display:flex;gap:8px;align-items:flex-start"><img src="'+escapeHtml(vid.thumb||'')+'" style="width:60px;height:34px;object-fit:cover;border-radius:3px;flex-shrink:0" loading="lazy"/><div style="flex:1;min-width:0"><div style="font-size:.65rem;color:var(--text);font-weight:600;line-height:1.2">'+escapeHtml(vid.title||'?')+'</div><div style="font-size:.6rem;color:var(--muted)">'+escapeHtml(vid.date||'')+'</div></div></div>';
      });
      html+='</div>';
      html+='<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap"><button onclick="ytDebugApplyToTeam(\''+escapeHtml(uc)+'\')" style="background:var(--secondary);border:1px solid var(--border);color:var(--accent-text);font-size:.66rem;font-weight:700;padding:5px 10px;border-radius:6px;cursor:pointer">⚙ Apply to '+escapeHtml(teamLbl)+'</button><a href="https://www.youtube.com/channel/'+escapeHtml(uc)+'" target="_blank" style="background:var(--card2);border:1px solid var(--border);color:var(--text);font-size:.66rem;padding:5px 10px;border-radius:6px;text-decoration:none">Open ↗</a></div>';
      if(out) out.innerHTML=html;
    })
    .catch(function(err){
      var ms=Date.now()-t0;
      if(out) out.innerHTML='<span style="color:#ff6b6b">❌ Network: '+escapeHtml((err&&err.message)||'failed')+' · '+ms+'ms</span>';
    });
}
function ytDebugApplyToTeam(uc){
  if(!state.activeTeam){alert('No active team.');return;}
  var prev=state.activeTeam.youtubeUC;
  state.activeTeam.youtubeUC=uc;
  devTrace('yt','custom UC applied · '+state.activeTeam.short+' · was '+prev+' · now '+uc);
  if(typeof loadHomeYoutubeWidget==='function') loadHomeYoutubeWidget();
  var out=document.getElementById('ytCustomResult');
  if(out){
    var note=document.createElement('div');
    note.style.cssText='margin-top:6px;padding:6px 8px;background:var(--card2);border:1px solid #22c55e;border-radius:4px;color:var(--text);font-size:.62rem';
    note.textContent='✅ Applied to '+state.activeTeam.short+'. Open Home → YouTube widget to verify. Switching teams or reloading reverts to '+(prev||'(none)')+'.';
    out.appendChild(note);
  }
}
function ytDebugEntries(){
  var entries=TEAMS.map(function(t){
    return {key:t.id,teamId:t.id,teamName:t.name,abbr:t.short,channelId:t.youtubeUC||''};
  });
  entries.sort(function(a,b){return a.teamName.localeCompare(b.teamName);});
  if(typeof MLB_FALLBACK_UC!=='undefined' && MLB_FALLBACK_UC) entries.push({key:'mlb_fallback',teamId:null,teamName:'MLB (Fallback)',abbr:'MLB',channelId:MLB_FALLBACK_UC});
  return entries;
}
function renderYoutubeDebugList(){
  var list=document.getElementById('ytDebugList');
  if(!list)return;
  var entries=ytDebugEntries();
  var anyTested=Object.keys(ytDebugResults).length>0;
  if(!anyTested){
    list.innerHTML='<div style="padding:20px;text-align:center;color:var(--muted)">Click "▶ Run All" to sweep all '+entries.length+' channels.</div>';
    return;
  }
  var done=Object.values(ytDebugResults).filter(function(r){return r&&!r.pending;}).length;
  var summary='<div style="padding:6px 10px;font-size:.7rem;color:var(--muted);text-align:center;border-bottom:1px solid var(--border)">'+done+' of '+entries.length+' tested</div>';
  var html=entries.map(function(e){
    var r=ytDebugResults[e.key];
    var icon,statusLine,extra='';
    if(!r){icon='⬜';statusLine='<span style="color:var(--muted)">untested</span>';}
    else if(r.pending){icon='⏳';statusLine='<span style="color:var(--muted)">testing…</span>';}
    else if(r.ok){icon='✅';statusLine='<span style="color:#22c55e;font-weight:700">HTTP '+r.status+' · '+r.count+' videos</span><span style="color:var(--muted);font-size:.66rem"> · '+r.ms+'ms</span>';}
    else{
      icon='❌';
      statusLine='<span style="color:#e03030;font-weight:700">HTTP '+(r.status||0)+'</span><span style="color:var(--muted);font-size:.66rem"> · '+r.ms+'ms</span>';
      if(r.error) extra='<div style="margin-top:2px;font-size:.66rem;color:#e03030">'+escapeHtml(r.error)+'</div>';
    }
    return '<div style="padding:8px 10px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px"><span style="font-size:.95rem;flex-shrink:0;width:20px;text-align:center">'+icon+'</span><div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><span style="font-size:.78rem;font-weight:700;color:var(--text)">'+escapeHtml(e.teamName)+'</span><span style="font-size:.66rem;color:var(--muted)">'+escapeHtml(e.abbr)+'</span></div><div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin-top:2px"><span style="font-size:.63rem;color:var(--muted);font-family:monospace">'+escapeHtml(e.channelId)+'</span><span style="color:var(--muted)">·</span>'+statusLine+'</div>'+extra+'</div><button onclick="runYoutubeDebugOne(\''+e.key+'\')" style="background:var(--card2);border:1px solid var(--border);color:var(--text);font-size:.68rem;padding:5px 8px;border-radius:6px;cursor:pointer;flex-shrink:0;font-weight:700">▶</button></div>';
  }).join('');
  list.innerHTML=summary+html;
}
function runYoutubeDebugAll(){
  var btn=document.getElementById('ytDebugRunBtn');
  if(btn){btn.disabled=true;btn.textContent='⏳ Running…';}
  var entries=ytDebugEntries();
  ytDebugResults={};
  entries.forEach(function(e){ytDebugResults[e.key]={pending:true};});
  renderYoutubeDebugList();
  var promises=entries.map(function(e){return runYoutubeDebugOne(e.key);});
  Promise.all(promises).then(function(){
    if(btn){btn.disabled=false;btn.textContent='▶ Run All';}
  });
}
function runYoutubeDebugOne(key){
  var entries=ytDebugEntries();
  var e=entries.find(function(x){return String(x.key)===String(key);});
  if(!e)return Promise.resolve();
  ytDebugResults[e.key]={pending:true};
  renderYoutubeDebugList();
  var t0=Date.now();
  return fetch(API_BASE+'/api/proxy-youtube?channel='+encodeURIComponent(e.channelId))
    .then(function(res){
      var ms=Date.now()-t0;
      return res.json().then(function(j){
        ytDebugResults[e.key]={ok:res.ok&&!!j.success,status:res.status,count:j.count||0,ms:ms,error:j.error||null};
        renderYoutubeDebugList();
      },function(){
        ytDebugResults[e.key]={ok:false,status:res.status,count:0,ms:ms,error:'JSON parse error'};
        renderYoutubeDebugList();
      });
    })
    .catch(function(err){
      var ms=Date.now()-t0;
      ytDebugResults[e.key]={ok:false,status:0,count:0,ms:ms,error:'Network: '+(err&&err.message||'failed')};
      renderYoutubeDebugList();
    });
}
function ytDebugReset(){
  ytDebugResults={};
  renderYoutubeDebugList();
}
function ytDebugCopy(){
  var entries=ytDebugEntries();
  var works=[],broken=[],untested=[];
  entries.forEach(function(e){
    var r=ytDebugResults[e.key];
    if(!r||r.pending){untested.push('• '+e.teamName+' ('+e.abbr+') — '+e.channelId);}
    else if(r.ok){works.push('• '+e.teamName+' ('+e.abbr+') — '+e.channelId+' — '+r.count+' videos · '+r.ms+'ms');}
    else{var detail='HTTP '+(r.status||0)+(r.error?' · '+r.error:'');broken.push('• '+e.teamName+' ('+e.abbr+') — '+e.channelId+' — '+detail+' · '+r.ms+'ms');}
  });
  var lines=['YouTube Channel Test','Date: '+new Date().toISOString().slice(0,10),'Proxy: '+API_BASE+'/api/proxy-youtube',''];
  lines.push('✅ WORKS ('+works.length+'):');lines.push.apply(lines,works.length?works:['  (none)']);lines.push('');
  lines.push('❌ BROKEN/ERROR ('+broken.length+'):');lines.push.apply(lines,broken.length?broken:['  (none)']);lines.push('');
  if(untested.length){lines.push('⏳ UNTESTED ('+untested.length+'):');lines.push.apply(lines,untested);}
  _copyToClipboard(lines.join('\n'),'ytDebugCopyBtn');
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

function relLuminance(hex){hex=hex.replace('#','');var n=parseInt(hex,16),r=((n>>16)&255)/255,g=((n>>8)&255)/255,b=(n&255)/255;r=r<=0.03928?r/12.92:Math.pow((r+0.055)/1.055,2.4);g=g<=0.03928?g/12.92:Math.pow((g+0.055)/1.055,2.4);b=b<=0.03928?b/12.92:Math.pow((b+0.055)/1.055,2.4);return 0.2126*r+0.7152*g+0.0722*b;}
function contrastRatio(hexA,hexB){var lA=relLuminance(hexA),lB=relLuminance(hexB);return(Math.max(lA,lB)+0.05)/(Math.min(lA,lB)+0.05);}
function hslHex(h,s,l){s/=100;l/=100;var a=s*Math.min(l,1-l),f=function(n){var k=(n+h/30)%12,c=l-a*Math.max(Math.min(k-3,9-k,1),-1);return Math.round(255*c).toString(16).padStart(2,'0');};return'#'+f(0)+f(8)+f(4);}
function hslLighten(hex,targetL){hex=hex.replace('#','');var n=parseInt(hex,16),r=((n>>16)&255)/255,g=((n>>8)&255)/255,b=(n&255)/255,max=Math.max(r,g,b),min=Math.min(r,g,b),h=0,s=0,l=(max+min)/2;if(max!==min){var d=max-min;s=l>0.5?d/(2-max-min):d/(max+min);if(max===r)h=((g-b)/d+(g<b?6:0))/6;else if(max===g)h=((b-r)/d+2)/6;else h=((r-g)/d+4)/6;}return hslHex(Math.round(h*360),Math.round(s*100),Math.round(targetL*100));}
function pickAccent(secondaryHex,cardHex){var sLum=relLuminance(secondaryHex),cCon=contrastRatio(secondaryHex,cardHex);if(sLum>=0.18&&cCon>=3.0)return secondaryHex;var lifted=hslLighten(secondaryHex,0.65);if(contrastRatio(lifted,cardHex)>=3.0)return lifted;return'#FFB273';}
function pickHeaderText(primaryHex){return relLuminance(primaryHex)>0.5?'#0a0f1e':'#ffffff';}
function applyTeamTheme(team){
  if(team) devTrace('theme','applyTeamTheme · '+team.name+' (id:'+team.id+')'+(state.devColorLocked?' [locked]':''));
  if(state.devColorLocked&&state.devColorOverrides.app.primary){
    document.documentElement.style.setProperty('--dark',state.devColorOverrides.app.dark);
    document.documentElement.style.setProperty('--card',state.devColorOverrides.app.card);
    document.documentElement.style.setProperty('--card2',state.devColorOverrides.app.card2);
    document.documentElement.style.setProperty('--border',state.devColorOverrides.app.border);
    document.documentElement.style.setProperty('--primary',state.devColorOverrides.app.primary);
    document.documentElement.style.setProperty('--secondary',state.devColorOverrides.app.secondary);
    document.documentElement.style.setProperty('--accent',state.devColorOverrides.app.accent);
    document.documentElement.style.setProperty('--accent-text',state.devColorOverrides.app.accentText);
    document.documentElement.style.setProperty('--header-text',state.devColorOverrides.app.headerText);
    return;
  }
  // Clear any previously header-scoped vars so switching nav→full doesn't leave stale overrides
  var hdr=document.querySelector('header');
  if(hdr){['--primary','--secondary','--accent','--accent-text','--header-text'].forEach(function(v){hdr.style.removeProperty(v);});}
  var ct=state.themeOverride||team;
  var cp=state.themeInvert?ct.secondary:ct.primary,cs=state.themeInvert?ct.primary:ct.secondary;
  var l1=relLuminance(cp),l2=relLuminance(cs),ratio=(Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05),accent=ratio>=3?cs:'#ffffff',accentLum=relLuminance(accent);
  if(accentLum<0.05){accent='#ffffff';accentLum=1;}
  var accentText=accentLum>0.4?'#111827':'#ffffff';
  var hueOf=function(hex){hex=hex.replace('#','');var r=parseInt(hex.substr(0,2),16)/255,g=parseInt(hex.substr(2,2),16)/255,b=parseInt(hex.substr(4,2),16)/255,max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min,h=0;if(d){if(max===r)h=((g-b)/d+(g<b?6:0))/6;else if(max===g)h=((b-r)/d+2)/6;else h=((r-g)/d+4)/6;}return Math.round(h*360);};
  var h=hueOf(cp),cardHex=hslHex(h,45,22);
  var safeAccent=pickAccent(accent,cardHex),headerText=pickHeaderText(cp);
  if(state.themeScope==='nav'){
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
  if(state.devColorLocked&&state.devColorOverrides.pulse.primary){
    document.documentElement.style.setProperty('--dark',state.devColorOverrides.pulse.dark);
    document.documentElement.style.setProperty('--p-dark',state.devColorOverrides.pulse.dark);
    document.documentElement.style.setProperty('--p-card',state.devColorOverrides.pulse.card);
    document.documentElement.style.setProperty('--p-card2',state.devColorOverrides.pulse.card2);
    document.documentElement.style.setProperty('--p-border',state.devColorOverrides.pulse.border);
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
  if(val==='0'){state.themeOverride=null;}
  else if(val==='-1'){state.themeOverride=MLB_THEME;}
  else{state.themeOverride=TEAMS.find(t=>t.id===parseInt(val));}
  localStorage.setItem('mlb_theme',val);
  applyTeamTheme(state.activeTeam);
}

function switchThemeScope(val){
  state.themeScope=val;
  try{localStorage.setItem('mlb_theme_scope',val);}catch(e){}
  applyTeamTheme(state.activeTeam);
}

function toggleInvert(){
  state.themeInvert=!state.themeInvert;
  localStorage.setItem('mlb_invert',state.themeInvert);
  var t=document.getElementById('invertToggle'),k=document.getElementById('invertToggleKnob');
  t.style.background=state.themeInvert?'var(--primary)':'var(--border)';
  k.style.left=state.themeInvert?'21px':'3px';
  applyTeamTheme(state.activeTeam);
  loadTodayGame();loadNextGame();
}

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
async function syncCollection(){
  if(!state.mlbSessionToken)return;
  try{
    const local=loadCollection();
    const r=await fetch((window.API_BASE||'')+'/api/collection-sync',{method:'PUT',headers:{'Content-Type':'application/json','Authorization':'Bearer '+state.mlbSessionToken},body:JSON.stringify({localCollection:local})});
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
  if(!state.mlbSessionToken)return;
  try{
    const r=await fetch((window.API_BASE||'')+'/api/collection/sync?token='+state.mlbSessionToken);
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
  if(state.mlbSyncInterval)return;
  state.mlbSyncInterval=setInterval(async()=>{
    syncCollection();
  },TIMING.SYNC_INTERVAL_MS);
}
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

function buildTeamSelect(){
  var sel=document.getElementById('teamSelect');sel.innerHTML='';var lastDiv='';
  TEAMS.forEach(function(t){
    if(t.division!==lastDiv){var og=document.createElement('optgroup');og.label=t.division;sel.appendChild(og);lastDiv=t.division;}
    var opt=document.createElement('option');opt.value=t.id;opt.textContent=t.name;if(t.id===state.activeTeam.id)opt.selected=true;sel.lastChild.appendChild(opt);
  });
}

function switchTeam(teamId){
  if(homeLiveTimer){clearInterval(homeLiveTimer);homeLiveTimer=null;}
  state.activeTeam=TEAMS.find(t=>t.id===parseInt(teamId));localStorage.setItem('mlb_team',teamId);applyTeamTheme(state.activeTeam);
  document.getElementById('settingsPanel').classList.remove('open');
  state.scheduleData=[];state.scheduleLoaded=false;state.rosterData={hitting:[],pitching:[],fielding:[]};state.statsCache={hitting:[],pitching:[]};state.selectedPlayer=null;
  document.getElementById('playerStats').innerHTML='<div style="color:var(--muted);font-size:.9rem;padding:20px 0;text-align:center">Select a player to view stats</div>';
  loadTodayGame();loadNextGame();loadNews();loadStandings();loadRoster();loadHomeYoutubeWidget();
  if(document.getElementById('schedule').classList.contains('active'))loadSchedule();
  if(state.myTeamLens) applyMyTeamLens(true);
}

// requestScreenWakeLock + releaseScreenWakeLock imported from ./ui/wakelock.js

// onSoundPanelClickOutside imported from ./ui/sound.js

function showSection(id,btn){
  devTrace('nav','showSection · '+id);
  if(state.demoMode)exitDemo();
  if(document.getElementById('liveView').classList.contains('active'))closeLiveView();
  if(id!=='league'&&leagueRefreshTimer){clearInterval(leagueRefreshTimer);leagueRefreshTimer=null;}
  if(id!=='home'&&homeLiveTimer){clearInterval(homeLiveTimer);homeLiveTimer=null;}
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

async function loadTodayGame(){
  if(homeLiveTimer){clearInterval(homeLiveTimer);homeLiveTimer=null;}
  var now=new Date(),today=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');
  document.getElementById('todayGame').innerHTML='<div class="loading">Loading next game...</div>';
  try{
    var r=await fetch(MLB_BASE+'/schedule?sportId=1&date='+today+'&teamId='+state.activeTeam.id+'&hydrate=linescore,team,seriesStatus,gameInfo');
    var d=await r.json(),todayGames=(d.dates&&d.dates[0]&&d.dates[0].games)?d.dates[0].games:[];
    var liveGame=todayGames.find(function(g){return g.status.abstractGameState==='Live'&&g.status.detailedState!=='Warmup'&&g.status.detailedState!=='Pre-Game';});
    var upcomingToday=todayGames.find(function(g){return g.status.abstractGameState==='Preview'||g.status.abstractGameState==='Scheduled'||(g.status.abstractGameState==='Live'&&(g.status.detailedState==='Warmup'||g.status.detailedState==='Pre-Game'));});
    var gameToRender=liveGame||upcomingToday;
    if(gameToRender&&!state.scheduleData.length){try{var gd=new Date(gameToRender.gameDate),s7=new Date(gd);s7.setDate(gd.getDate()-7);var e7=new Date(gd);e7.setDate(gd.getDate()+7);var fmtD=function(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};var sr=await fetch(MLB_BASE+'/schedule?sportId=1&startDate='+fmtD(s7)+'&endDate='+fmtD(e7)+'&teamId='+state.activeTeam.id+'&hydrate=team,linescore');var srd=await sr.json();(srd.dates||[]).forEach(function(dt){dt.games.forEach(function(g){state.scheduleData.push(g);});});}catch(e){}}
    if(liveGame){document.getElementById('todayGame').innerHTML=renderNextGame(liveGame,'TODAY');homeLiveTimer=setInterval(loadTodayGame,TIMING.HOME_LIVE_MS);return;}
    if(upcomingToday){document.getElementById('todayGame').innerHTML=renderNextGame(upcomingToday,'TODAY');return;}
    var end=new Date();end.setDate(end.getDate()+14);
    var endStr=end.getFullYear()+'-'+String(end.getMonth()+1).padStart(2,'0')+'-'+String(end.getDate()).padStart(2,'0');
    var r2=await fetch(MLB_BASE+'/schedule?sportId=1&startDate='+today+'&endDate='+endStr+'&teamId='+state.activeTeam.id+'&hydrate=linescore,team,seriesStatus,gameInfo');
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
    var r=await fetch(MLB_BASE+'/schedule?sportId=1&startDate='+today+'&endDate='+endStr+'&teamId='+state.activeTeam.id+'&hydrate=team,linescore,venue,probablePitcher');
    var d=await r.json(),allGames=[];
    (d.dates||[]).forEach(function(dt){dt.games.forEach(function(g){allGames.push(g);});});
    var seriesList=[],used=new Set();
    allGames.forEach(function(g){
      if(used.has(g.gamePk))return;
      var oppId=g.teams.home.team.id===state.activeTeam.id?g.teams.away.team.id:g.teams.home.team.id;
      var venueId=g.venue&&g.venue.id,gDate=new Date(g.gameDate);
      var group=allGames.filter(function(s){
        if(used.has(s.gamePk))return false;
        var sOpp=s.teams.home.team.id===state.activeTeam.id?s.teams.away.team.id:s.teams.home.team.id;
        var sVenue=s.venue&&s.venue.id,daysDiff=Math.abs((new Date(s.gameDate)-gDate)/86400000);
        return sOpp===oppId&&sVenue===venueId&&daysDiff<=4;
      }).sort(function(a,b){return new Date(a.gameDate)-new Date(b.gameDate);});
      group.forEach(function(s){used.add(s.gamePk);});seriesList.push(group);
    });
    var currentIdx=-1;
    for(var i=0;i<seriesList.length;i++){if(seriesList[i].some(function(g){return g.status.abstractGameState!=='Final';})){currentIdx=i;break;}}
    var nextSeries=currentIdx>=0&&currentIdx+1<seriesList.length?seriesList[currentIdx+1]:null;
    if(!nextSeries||!nextSeries.length){document.getElementById('nextGame').innerHTML='<div class="game-big surface-hero"><div class="card-title">NEXT SERIES</div><div class="empty-state">No upcoming series found</div></div>';return;}
    var first=nextSeries[0],teamHome=first.teams.home.team.id===state.activeTeam.id,oppTeam=teamHome?first.teams.away.team:first.teams.home.team;
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
      var myT=g.teams.home.team.id===state.activeTeam.id?g.teams.home:g.teams.away,oppT=g.teams.home.team.id===state.activeTeam.id?g.teams.away:g.teams.home;
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
  document.getElementById('scheduleTitle').innerHTML=SEASON+' '+state.activeTeam.short+' Schedule <button class="refresh-btn" onclick="loadSchedule()">↻ Refresh</button>';
  try{
    var r=await fetch(MLB_BASE+'/schedule?sportId=1&season='+SEASON+'&teamId='+state.activeTeam.id+'&hydrate=team,linescore,game,probablePitcher');
    var d=await r.json();state.scheduleData=[];
    (d.dates||[]).forEach(function(dt){dt.games.forEach(function(g){state.scheduleData.push(g);});});
    state.scheduleLoaded=true;calMonth=new Date().getMonth();calYear=new Date().getFullYear();renderCalendar();
  }catch(e){document.getElementById('calGrid').innerHTML='<div class="error">Could not load schedule</div>';}
}

function changeMonth(dir){calMonth+=dir;if(calMonth>11){calMonth=0;calYear++;}if(calMonth<0){calMonth=11;calYear--;}selectedGamePk=null;document.getElementById('gameDetail').innerHTML='';renderCalendar();}

function renderCalendar(){
  var months=['January','February','March','April','May','June','July','August','September','October','November','December'];
  document.getElementById('calMonthLabel').textContent=months[calMonth]+' '+calYear;
  var days=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],today=new Date(),firstDay=new Date(calYear,calMonth,1).getDay(),daysInMonth=new Date(calYear,calMonth+1,0).getDate();
  var gamesByDate={};state.scheduleData.forEach(function(g){var _d=new Date(g.gameDate),ds=_d.getFullYear()+'-'+String(_d.getMonth()+1).padStart(2,'0')+'-'+String(_d.getDate()).padStart(2,'0');if(!gamesByDate[ds])gamesByDate[ds]=[];gamesByDate[ds].push(g);});
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
      var g0=dayGames[0],home0=g0.teams.home,away0=g0.teams.away,teamHome=home0.team.id===state.activeTeam.id,opp0=teamHome?away0:home0;
      inner+='<div class="cal-game-info"><div class="cal-opp" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><span class="cal-ha">'+(teamHome?'vs ':'@ ')+'</span>'+opp0.team.teamName+(isDH?' <span style="font-size:.55rem;font-weight:700;color:var(--accent);letter-spacing:.04em">DH</span>':'')+'</div>';
      var dotW=false,dotL=false,dotLive=false,dotPPD=false;
      dayGames.forEach(function(gm,idx){
        var myT=gm.teams.home.team.id===state.activeTeam.id?gm.teams.home:gm.teams.away;
        var opT=gm.teams.home.team.id===state.activeTeam.id?gm.teams.away:gm.teams.home;
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
  var g=state.scheduleData.find(function(x){return x.gamePk===gamePk;});if(!g)return;
  // Find all games on same local date (DH support)
  var ds=localDateStr(new Date(g.gameDate));
  var dayGames=state.scheduleData.filter(function(x){return localDateStr(new Date(x.gameDate))===ds;}).sort(function(a,b){return a.gamePk-b.gamePk;});
  var isDH=dayGames.length>1;
  if(cellRect&&window.innerWidth<=480){
    var home=g.teams.home,away=g.teams.away,teamHome=home.team.id===state.activeTeam.id;
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
  var isHomeActive=state.activeTeam.id===home.team.id,activeAbbr=isHomeActive?homeAbbr:awayAbbr,activeTeamName=isHomeActive?home.team.teamName:away.team.teamName;
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
    document.getElementById('divTitle').textContent='🔥 '+state.activeTeam.division;
    document.getElementById('wcTitle').textContent='🃏 '+state.activeTeam.league+' Wild Card Race';
    document.getElementById('otherDivWCTitle').textContent='🃏 '+(state.activeTeam.league==='NL'?'AL':'NL')+' Wild Card Race';
    document.getElementById('homeDivTitle').textContent=state.activeTeam.division+' Snapshot';
  }catch(e){['nlEast','nlWC','otherDivWC','fullStandings','homeStandings'].forEach(function(id){var el=document.getElementById(id);if(el)el.innerHTML='<div class="error">Could not load standings</div>';});}
}

function standingsTable(teams){
  var html='<table class="standings-table"><thead><tr><th>#</th><th>Team</th><th>W</th><th>L</th><th>PCT</th><th>GB</th></tr></thead><tbody>';
  teams.forEach(function(t,i){var isActive=t.team.id===state.activeTeam.id;html+='<tr class="'+(isActive?'active-row':'')+'"><td>'+(i+1)+'</td><td><strong>'+t.team.teamName+'</strong></td><td>'+t.wins+'</td><td>'+t.losses+'</td><td>'+t.winningPercentage+'</td><td>'+t.gamesBack+'</td></tr>';});
  return html+'</tbody></table>';
}
function renderDivStandings(divMap){var f=Object.values(divMap).find(function(d){return d.name===state.activeTeam.division;});document.getElementById('nlEast').innerHTML=f?standingsTable(f.teams):'<div class="error">Division not found</div>';}
function renderNLWC(divMap){
  var league=state.activeTeam.league==='NL'?'National League':'American League';
  var leagueDivs=Object.values(divMap).filter(function(d){return d.league===league;});
  var leaders=new Set(leagueDivs.map(function(d){return d.teams[0]&&d.teams[0].team.id;}));
  var allLeague=[];leagueDivs.forEach(function(d){allLeague=allLeague.concat(d.teams);});
  var wc=allLeague.filter(function(t){return!leaders.has(t.team.id);}).sort(function(a,b){return parseFloat(b.winningPercentage)-parseFloat(a.winningPercentage);}).slice(0,9);
  var top=wc[0],topW=top?top.wins:0,topL=top?top.losses:0;
  var html='<table class="standings-table"><thead><tr><th>#</th><th>Team</th><th>W</th><th>L</th><th>PCT</th><th>GB</th></tr></thead><tbody>';
  wc.forEach(function(t,i){var isActive=t.team.id===state.activeTeam.id,gb=i===0?'—':(((topW-t.wins)+(t.losses-topL))/2).toFixed(1),cls=(isActive?'active-row':'')+(i===WC_SPOTS-1?' wc-cutoff-row':'');html+='<tr class="'+cls.trim()+'"><td>'+(i+1)+'</td><td><strong>'+t.team.teamName+'</strong></td><td>'+t.wins+'</td><td>'+t.losses+'</td><td>'+t.winningPercentage+'</td><td>'+gb+'</td></tr>';});
  html+='</tbody></table><div class="wc-cutoff-label">Wild Card cutoff</div>';
  document.getElementById('nlWC').innerHTML=html;
}
function renderOtherDivWC(divMap){
  var otherLeague=state.activeTeam.league==='NL'?'American League':'National League';
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
  var isNL=state.activeTeam.league==='NL',primary=isNL?nl:al,secondary=isNL?al:nl;
  var primarySorted=primary.slice().sort(function(a,b){return a.name===state.activeTeam.division?-1:b.name===state.activeTeam.division?1:0;});
  var html='';
  primarySorted.concat(secondary).forEach(function(div){
    if(div.name===state.activeTeam.division)return;
    html+='<div class="div-header">'+div.name+'</div><table class="standings-table"><thead><tr><th>Team</th><th>W</th><th>L</th><th>PCT</th><th>GB</th></tr></thead><tbody>';
    div.teams.forEach(function(t){var isActive=t.team.id===state.activeTeam.id;html+='<tr class="'+(isActive?'active-row':'')+'"><td><strong>'+t.team.teamName+'</strong></td><td>'+t.wins+'</td><td>'+t.losses+'</td><td>'+t.winningPercentage+'</td><td>'+t.gamesBack+'</td></tr>';});
    html+='</tbody></table>';
  });
  document.getElementById('fullStandings').innerHTML=html;
}
function renderHomeStandings(divMap){
  var f=Object.values(divMap).find(function(d){return d.name===state.activeTeam.division;});
  if(!f){document.getElementById('homeStandings').innerHTML='<div class="error">No data</div>';return;}
  var html='<table class="standings-table"><thead><tr><th>Team</th><th>W</th><th>L</th><th>GB</th></tr></thead><tbody>';
  f.teams.forEach(function(t){var isActive=t.team.id===state.activeTeam.id;html+='<tr class="'+(isActive?'active-row':'')+'"><td><strong>'+t.team.teamName+'</strong></td><td>'+t.wins+'</td><td>'+t.losses+'</td><td>'+t.gamesBack+'</td></tr>';});
  document.getElementById('homeStandings').innerHTML=html+'</tbody></table>';
}

function selectLeaderPill(group,stat,btn){var selId=group==='hitting'?'hitLeaderStat':'pitLeaderStat';var sel=document.getElementById(selId);if(sel)sel.value=stat;var pillsId=group==='hitting'?'hitLeaderPills':'pitLeaderPills';document.getElementById(pillsId).querySelectorAll('.leader-pill').forEach(function(b){b.classList.remove('active');});btn.classList.add('active');loadLeaders();}
function switchLeaderTab(tab,btn){state.currentLeaderTab=tab;document.querySelectorAll('.stat-tabs button').forEach(function(b){b.classList.remove('active');});btn.classList.add('active');document.getElementById('hitLeaderStat').style.display=tab==='hitting'?'block':'none';document.getElementById('pitLeaderStat').style.display=tab==='pitching'?'block':'none';document.getElementById('hitLeaderPills').style.display=tab==='hitting'?'flex':'none';document.getElementById('pitLeaderPills').style.display=tab==='pitching'?'flex':'none';loadLeaders();}
function loadLeaders(){
  var group=state.currentLeaderTab,stat=group==='hitting'?document.getElementById('hitLeaderStat').value:document.getElementById('pitLeaderStat').value,data=state.statsCache[group];
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
    var group=groups[gi],players=group==='hitting'?state.rosterData.hitting:state.rosterData.pitching;if(!players.length)continue;
    var results=await Promise.all(players.map(async function(p){try{var r=await fetch(MLB_BASE+'/people/'+p.person.id+'/stats?stats=season&season='+SEASON+'&group='+group);var d=await r.json();var stat=d.stats&&d.stats[0]&&d.stats[0].splits&&d.stats[0].splits[0]&&d.stats[0].splits[0].stat;if(!stat)return null;return{player:p.person,position:p.position,stat:stat};}catch(e){return null;}}));
    state.statsCache[group]=results.filter(function(x){return x!==null;});
  }
  loadLeaders();
}
async function loadRoster(){
  document.getElementById('playerList').innerHTML='<div class="loading">Loading players...</div>';
  document.getElementById('rosterTitle').textContent=SEASON+' '+state.activeTeam.short+' Players';
  try{
    var r=await fetch(MLB_BASE+'/teams/'+state.activeTeam.id+'/roster?rosterType=40Man&season='+SEASON+'&hydrate=person');
    var d=await r.json(),roster=d.roster||[];
    state.rosterData.hitting=roster.filter(function(p){return p.position&&['P','TWP'].indexOf(p.position.abbreviation)===-1;});
    state.rosterData.pitching=roster.filter(function(p){return p.position&&(p.position.abbreviation==='P'||p.position.abbreviation==='TWP');});
    state.rosterData.fielding=state.rosterData.hitting.slice();renderPlayerList();fetchAllPlayerStats();
    if(state.rosterData.hitting.length)selectPlayer(state.rosterData.hitting[0].person.id,'hitting');
  }catch(e){document.getElementById('playerList').innerHTML='<div class="error">Could not load players</div>';}
}
function renderPlayerList(){
  var players=state.rosterData[state.currentRosterTab]||[];if(!players.length){document.getElementById('playerList').innerHTML='<div class="loading">No players found</div>';return;}
  var html='';
  players.forEach(function(p){var sel=state.selectedPlayer&&state.selectedPlayer.person&&state.selectedPlayer.person.id===p.person.id;html+='<div class="player-item'+(sel?' selected':'')+'" onclick="selectPlayer('+p.person.id+',\''+state.currentRosterTab+'\')">'+'<div><div class="player-name">'+p.person.fullName+'</div><div class="player-pos">#'+(p.jerseyNumber||'—')+' · '+(p.position&&p.position.name?p.position.name:'—')+'</div></div><span class="player-chevron">›</span></div>';});
  document.getElementById('playerList').innerHTML=html;
}
function switchRosterTab(tab,btn){state.currentRosterTab=tab;state.selectedPlayer=null;document.querySelectorAll('.stat-tab').forEach(function(b){b.classList.remove('active');});btn.classList.add('active');var players=state.rosterData[tab]||[];if(players.length)selectPlayer(players[0].person.id,tab);else{renderPlayerList();document.getElementById('playerStatsTitle').textContent='Player Stats';document.getElementById('playerStats').innerHTML='<div class="empty-state">No players available</div>';}}
async function selectPlayer(id,type){
  var playerObj=(state.rosterData[type]||[]).find(function(p){return p.person.id===id;})||{person:{id:id}};
  state.selectedPlayer=playerObj;renderPlayerList();
  document.getElementById('playerStatsTitle').textContent=playerObj.person&&playerObj.person.fullName?playerObj.person.fullName:'Player Stats';
  document.getElementById('playerStats').innerHTML='<div class="loading">Loading stats...</div>';
  try{var group=type==='pitching'?'pitching':type==='fielding'?'fielding':'hitting';var r=await fetch(MLB_BASE+'/people/'+id+'/stats?stats=season&season='+SEASON+'&group='+group);var d=await r.json();var stats=d.stats&&d.stats[0]&&d.stats[0].splits&&d.stats[0].splits[0]&&d.stats[0].splits[0].stat;if(!stats){document.getElementById('playerStats').innerHTML='<div class="empty-state">No '+SEASON+' stats available yet</div>';if(window.innerWidth<=767||(window.innerWidth<=1024&&window.matchMedia('(orientation:portrait)').matches)){document.getElementById('playerStats').scrollIntoView({behavior:'smooth',block:'end'});}return;}renderPlayerStats(stats,group);if(window.innerWidth<=767||(window.innerWidth<=1024&&window.matchMedia('(orientation:portrait)').matches)){document.getElementById('playerStats').scrollIntoView({behavior:'smooth',block:'end'});}}catch(e){document.getElementById('playerStats').innerHTML='<div class="error">Could not load stats</div>';}
}
function renderPlayerStats(s,group){
  var pid=state.selectedPlayer&&state.selectedPlayer.person&&state.selectedPlayer.person.id;
  var jerseyOverlay=(state.selectedPlayer&&state.selectedPlayer.jerseyNumber)?'<div class="headshot-jersey-pill">#'+state.selectedPlayer.jerseyNumber+'</div>':'';
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
// NEWS_IMAGE_HOSTS + isSafeNewsImage imported from ./utils/news.js
function decodeNewsHtml(s){var map={'&quot;':'"','&amp;':'&','&lt;':'<','&gt;':'>','&#39;':"'",'&apos;':"'"};return String(s||'').replace(/&(?:#\d+|#x[0-9a-f]+|quot|amp|lt|gt|apos?);/gi,function(e){return map[e.toLowerCase()]||e;}).replace(/&#(\d+);/g,function(m,code){return String.fromCharCode(parseInt(code,10));}).replace(/&#x([0-9a-f]+);/gi,function(m,code){return String.fromCharCode(parseInt(code,16));}); }
// fmtNewsDate imported from ./utils/format.js
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
  var items=state.newsSourceFilter==='all'?state.newsArticlesCache:state.newsArticlesCache.filter(function(a){return a.source===state.newsSourceFilter;});
  if(!items.length){el.innerHTML='<div class="loading">No articles for this source.</div>';return;}
  el.innerHTML=items.map(mkProxyNewsRow).join('');
}
function selectNewsSource(key,btn){
  state.newsSourceFilter=key;
  var pills=document.querySelectorAll('#newsSourcePills .stat-tab');
  pills.forEach(function(p){p.classList.remove('active');});
  if(btn)btn.classList.add('active');
  else{var match=document.querySelector('#newsSourcePills .stat-tab[data-source="'+key+'"]');if(match)match.classList.add('active');}
  renderNewsList();
}
async function loadNews(){
  var fullEl=document.getElementById('newsFull'),homeEl=document.getElementById('homeNews');
  var teamBtn=document.getElementById('newsTeamBtn');if(teamBtn)teamBtn.textContent=state.activeTeam.short;
  if(fullEl)fullEl.innerHTML='<div class="loading">Loading news...</div>';if(homeEl)homeEl.innerHTML='<div class="loading">Loading news...</div>';
  var teamUrl='https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/news?team='+state.activeTeam.espnId+'&limit=20';
  if(state.newsFeedMode==='team'){
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
    state.newsArticlesCache=Array.isArray(d.articles)?d.articles:[];
    if(!state.newsArticlesCache.length)throw new Error('No articles');
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
  state.newsFeedMode=mode;
  ['newsMlbBtn','newsTeamBtn'].forEach(function(id){var el=document.getElementById(id);if(el)el.classList.remove('active');});
  if(btn)btn.classList.add('active');
  var pills=document.getElementById('newsSourcePills');if(pills)pills.style.display=(mode==='mlb')?'flex':'none';
  loadNews();
}

var liveGamePk=null,liveInterval=null;
function showLiveGame(gamePk){liveGamePk=gamePk;document.querySelector('.main').style.display='none';document.getElementById('liveView').classList.add('active');fetchLiveGame();liveInterval=setInterval(fetchLiveGame,TIMING.LIVE_REFRESH_MS);}
function closeLiveView(){clearInterval(liveInterval);liveInterval=null;if(state.liveAbortCtrl){state.liveAbortCtrl.abort();state.liveAbortCtrl=null;}liveGamePk=null;document.getElementById('liveView').classList.remove('active');document.querySelector('.main').style.display='block';}
async function fetchLiveGame(){
  if(state.liveAbortCtrl){state.liveAbortCtrl.abort();}
  state.liveAbortCtrl=new AbortController();
  var liveSig=state.liveAbortCtrl.signal;
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

const MLB_FALLBACK_UC='UCoLrcjPV5PbUrUyXq5mjc_A';
var selectedVideoId=null,mediaVideos=[];

function loadHomeYoutubeWidget(){
  var uc=state.activeTeam.youtubeUC||MLB_FALLBACK_UC,teamName=state.activeTeam.youtubeUC?state.activeTeam.name:'MLB',channelUrl='https://www.youtube.com/channel/'+uc;
  var themeTeam=state.themeOverride||state.activeTeam,bannerColor=state.themeInvert?themeTeam.secondary:themeTeam.primary;
  var grad='background:linear-gradient(135deg,'+bannerColor+' 0%,var(--dark) 100%)';
  document.getElementById('homeYoutubeHeader').innerHTML='<div style="'+grad+';border-radius:12px 12px 0 0;padding:16px 20px;display:flex;align-items:center;justify-content:space-between"><div><div style="font-size:.7rem;font-weight:700;text-transform:uppercase;color:rgba(255,255,255,.6);margin-bottom:2px">📺 Official Channel</div><div style="font-size:1.1rem;font-weight:800;color:#fff">'+teamName+'</div></div><a href="'+channelUrl+'" target="_blank" style="font-size:.78rem;color:rgba(255,255,255,.7);text-decoration:none;border:1px solid rgba(255,255,255,.3);padding:5px 12px;border-radius:6px">Open in YouTube ↗</a></div>';
  loadMediaFeed(uc);
}

function isDesktop(){return window.matchMedia('(min-width:1025px)').matches&&!('ontouchstart' in window);}
function updatePushRowVisibility(){var row=document.getElementById('pushRow');if(!row)return;row.style.display=(!isDesktop()||state.devShowPushOnDesktop)?'flex':'none';}
function togglePushOnDesktop(){state.devShowPushOnDesktop=!state.devShowPushOnDesktop;var toggle=document.getElementById('pushDesktopToggle'),knob=document.getElementById('pushDesktopToggleKnob');toggle.style.background=state.devShowPushOnDesktop?'var(--secondary)':'var(--border)';knob.style.left=state.devShowPushOnDesktop?'18px':'2px';updatePushRowVisibility();}
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

// Push notification module (VAPID_PUBLIC_KEY, urlBase64ToUint8Array,
// subscribeToPush, unsubscribeFromPush, togglePush) imported from
// ./push/push.js. API_BASE moved to ./config/constants.js.

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
    if(homeLiveTimer){clearInterval(homeLiveTimer);homeLiveTimer=null;}
    if(leagueRefreshTimer){clearInterval(leagueRefreshTimer);leagueRefreshTimer=null;}
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
