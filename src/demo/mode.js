// ── Demo Mode System
// Self-contained replay of April 27-28, 2026 from daily-events.json.
// No external API calls; speeds configurable (1x/10x/30x).
// Encapsulated state: demoPaused, demoSpeedMs

import { state } from '../state.js';
import { devTrace } from '../devtools-feed/devLog.js';
import { MLB_BASE } from '../config/constants.js';
import { calcRBICardScore } from '../cards/playerCard.js';
import { stopClassic } from '../radio/classic.js';
import { etDateStr, etDatePlus } from '../utils/format.js';

// Encapsulated demo-only state
let demoPaused = false;
let demoSpeedMs = 10000;
// Home Run seek: when active, demoSpeedMs is overridden to 500ms (20x)
// until advanceDemoPlay sees a Home Run, at which point we restore the
// prior speed and auto-pause so the user can take in the HR card.
let _hrSeekActive = false;
let _hrSeekPriorSpeed = 0;

// Forward declarations for functions in main.js that demo calls
// These will be set by main.js after demo module is imported
let _addFeedItem = null;
let _renderTicker = null;
let _renderSideRailGames = null;
let _buildStoryPool = null;
let _updateFeedEmpty = null;
let _showAlert = null;
let _playSound = null;
let _showPlayerCard = null;
let _showRBICard = null;
let _rotateStory = null;
let _localDateStr = null;
let _selectFocusGame = null;
let _pollFocusLinescore = null;
let _pollPendingVideoClips = null;
let _resumeLivePulse = null;

export function setDemoCallbacks(callbacks) {
  _addFeedItem = callbacks.addFeedItem;
  _renderTicker = callbacks.renderTicker;
  _renderSideRailGames = callbacks.renderSideRailGames;
  _buildStoryPool = callbacks.buildStoryPool;
  _updateFeedEmpty = callbacks.updateFeedEmpty;
  _showAlert = callbacks.showAlert;
  _playSound = callbacks.playSound;
  _showPlayerCard = callbacks.showPlayerCard;
  _showRBICard = callbacks.showRBICard;
  _rotateStory = callbacks.rotateStory;
  _localDateStr = callbacks.localDateStr;
  _selectFocusGame = callbacks.selectFocusGame;
  _pollFocusLinescore = callbacks.pollFocusLinescore;
  _pollPendingVideoClips = callbacks.pollPendingVideoClips;
  _resumeLivePulse = callbacks.resumeLivePulse;
}

async function loadDailyEventsJSON(){
  try{
    var r=await fetch('./assets/daily-events.json');
    if(!r.ok) return null;
    var data=await r.json();
    // feedItems[].ts may be number (recorder v2) or string (legacy) or
    // missing (legacy with playTime instead). Normalise to Date.
    if(data.feedItems){
      data.feedItems.forEach(function(item){
        if(item.playTime&&typeof item.playTime==='string'){
          item.playTime=new Date(item.playTime);
        }
        if(typeof item.ts==='number') item.ts=new Date(item.ts);
        else if(typeof item.ts==='string') item.ts=new Date(item.ts);
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
    return data;
  }catch(e){
    console.error('Demo: Failed to load daily-events.json',e);
    return null;
  }
}

function updateDemoBtnLabel(){
  var lbl=document.getElementById('demoBtnLabel');
  if(lbl) lbl.textContent=state.demoMode?'⏹ Exit Demo':'▶ Try Demo';
}

export function toggleDemoMode() {
  devTrace('demo', state.demoMode ? 'exit' : 'init');
  if(state.demoMode) exitDemo();
  else initDemo();
  updateDemoBtnLabel();
}

async function initDemo() {
  if (state.pulseTimer) { clearInterval(state.pulseTimer); state.pulseTimer = null; }
  if (state.pulseAbortCtrl) { state.pulseAbortCtrl.abort(); state.pulseAbortCtrl = null; }
  if (state.storyRotateTimer) { clearInterval(state.storyRotateTimer); state.storyRotateTimer = null; }
  state.demoMode=true;
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
    mockBar.style.display='flex';
    var badge=document.getElementById('mockBarBadge');
    if(badge) badge.textContent='📽️ Demo';
    document.getElementById('demoSpeed1x').style.display='';
    document.getElementById('demoSpeed10x').style.display='';
    document.getElementById('demoSpeed30x').style.display='';
    document.getElementById('demoSpeed1x').classList.add('active');
    document.getElementById('demoNextHRBtn').style.display='';
    document.getElementById('demoPauseBtn').style.display='';
    document.getElementById('demoForwardBtn').style.display='';
    var _exitBtn=document.getElementById('demoExitBtn');
    if(_exitBtn) _exitBtn.style.display='';
    document.getElementById('demoPauseBtn').textContent='⏸ Pause';
  }
  state.gameStates={};
  state.feedItems=[];
  state.scheduleData=[];
  state.enabledGames=new Set();
  state.storyPool=[];
  state.storyShownId=null;
  state.demoPlayQueue=[];
  state.demoPlayIdx=0;
  state.demoCardCount=0;
  state.dailyLeadersCache=null;
  state.onThisDayCache=null;
  state.yesterdayCache=null;
  state.hrBatterStatsCache={};
  state.probablePitcherStatsCache={};
  state.dailyHitsTracker={};
  state.dailyPitcherKs={};
  state.storyCarouselRawGameData={};
  state.stolenBaseEvents=[];
  state.inningRecapsFired=new Set();state.inningRecapsPending={};state.lastInningState={};
  var jsonData=await loadDailyEventsJSON();
  if(!jsonData||!jsonData.gameStates){
    _showAlert({icon:'⚠️',event:'Demo Load Failed',desc:'Could not load daily-events.json',color:'#e85d4f',duration:3000});
    return;
  }
  state.gameStates=jsonData.gameStates;
  // Recorder v2 nests story-carousel caches under `caches.*`. Legacy
  // daily-events.json had them at the top level — keep both paths so
  // either shape loads cleanly.
  var c=jsonData.caches||{};
  state.dailyLeadersCache=c.dailyLeadersCache||jsonData.dailyLeadersCache||null;
  state.onThisDayCache=c.onThisDayCache||jsonData.onThisDayCache||[];
  state.yesterdayCache=c.yesterdayCache||jsonData.yesterdayCache||[];
  state.hrBatterStatsCache=c.hrBatterStatsCache||jsonData.hrBatterStatsCache||{};
  state.probablePitcherStatsCache=c.probablePitcherStatsCache||jsonData.probablePitcherStatsCache||{};
  state.dailyHitsTracker=c.dailyHitsTracker||jsonData.dailyHitsTracker||{};
  state.dailyPitcherKs=c.dailyPitcherKs||jsonData.dailyPitcherKs||{};
  state.storyCarouselRawGameData=c.storyCarouselRawGameData||jsonData.storyCarouselRawGameData||{};
  state.stolenBaseEvents=c.stolenBaseEvents||jsonData.stolenBaseEvents||[];
  state.transactionsCache=c.transactionsCache||jsonData.transactionsCache||[];
  state.liveWPCache=c.liveWPCache||jsonData.liveWPCache||{};
  state.perfectGameTracker=c.perfectGameTracker||jsonData.perfectGameTracker||{};
  state.highLowCache=c.highLowCache||jsonData.highLowCache||null;
  state.scheduleData=jsonData.scheduleData||[];
  // Recorder v2 keys consumed by Focus Mode / video clips / fetchBoxscore demo branches.
  state.pitchTimeline=jsonData.pitchTimeline||{};
  state.boxscoreSnapshots=jsonData.boxscoreSnapshots||{};
  state.contentCacheTimeline=jsonData.contentCacheTimeline||{};
  state.focusStatsCache=jsonData.focusStatsCache||{};
  state.focusTrack=jsonData.focusTrack||[];
  if(jsonData.lastVideoClip) state.lastVideoClip=jsonData.lastVideoClip;
  if(jsonData.gameStates){
    var earliestMs=Infinity;
    Object.values(jsonData.gameStates).forEach(function(g){
      if(g.gameDateMs&&g.gameDateMs<earliestMs) earliestMs=g.gameDateMs;
    });
    if(earliestMs!==Infinity) state.demoDate=new Date(earliestMs);
  }
  state.onThisDayCache.forEach(function(item){if(item.ts&&typeof item.ts==='string') item.ts=new Date(item.ts);});
  state.yesterdayCache.forEach(function(item){if(item.ts&&typeof item.ts==='string') item.ts=new Date(item.ts);});
  // Recording-start cutoff. Plays before this are "backlog" — pre-loaded
  // into the feed at demo open so the user feels like they're tuning into
  // Pulse mid-game. Plays at or after this are "queue" — animated into
  // the feed by demo timer, starting at the first new event from the
  // recording session. demoCurrentTime starts at the first queue play
  // so pitchTimeline/contentCacheTimeline/focusTrack lookups land cleanly
  // (their entries were captured during the recording window).
  var cutoff=(jsonData.metadata&&jsonData.metadata.startedAt)||0;
  // Normalise feedItems' ts → Date and split by cutoff
  var allItems=(jsonData.feedItems||[]).map(function(item){
    var ts=item.ts||item.playTime;
    if(typeof ts==='number') ts=new Date(ts);
    else if(typeof ts==='string') ts=new Date(ts);
    if(!(ts instanceof Date)) ts=new Date();
    return {gamePk:item.gamePk,data:item.data,ts:ts};
  });
  allItems.sort(function(a,b){ return a.ts.getTime()-b.ts.getTime(); });
  var backlogItems=[],queueItems=[];
  allItems.forEach(function(item){
    if(item.ts.getTime()<cutoff) backlogItems.push(item);
    else queueItems.push(item);
  });
  // Reset gameStates for games we'll touch (backlog walk + queue replay).
  // Games with NO plays at all keep their captured state (Final games whose
  // Game Final entry was pushed off the recorder cap, plus genuine Preview
  // games that hadn't started yet) — otherwise they appear in Upcoming
  // forever, since no play will flip their status.
  var touched=new Set();
  allItems.forEach(function(item){ if(item.gamePk) touched.add(+item.gamePk); });
  Object.values(state.gameStates).forEach(function(g){
    if(!touched.has(+g.gamePk)) return;
    g.status='Preview'; g.detailedState='Scheduled';
    g.inning=0; g.halfInning=null; g.outs=0;
    g.awayScore=0; g.homeScore=0;
    g.onFirst=false; g.onSecond=false; g.onThird=false;
  });
  // Enable touched games BEFORE the backlog walk so feed items aren't
  // hidden by addFeedItem's feed-hidden class on un-enabled games.
  Object.keys(state.gameStates).forEach(function(pk){
    if(touched.has(parseInt(pk))) state.enabledGames.add(parseInt(pk));
  });
  // Walk backlog: advance each game's status/inning/score per play, and
  // pre-render the item into the feed DOM via _addFeedItem (which also
  // appends to state.feedItems). After this, ticker + side-rail show the
  // mid-game snapshot the user would have seen if they'd opened Pulse at
  // recording-start time.
  state.feedItems=[];
  backlogItems.forEach(function(item){
    var g=state.gameStates[item.gamePk];
    var d=item.data||{};
    // _addFeedItem keys item.ts off data.playTime — ensure it's a Date
    // (loadDailyEventsJSON normalises top-level item.ts but not nested
    // data.playTime, so a string-typed playTime would propagate into a
    // broken state.feedItems entry).
    d.playTime=item.ts;
    if(g){
      if(d.type==='play'){
        if(g.status!=='Final'){ g.status='Live'; g.detailedState='In Progress'; }
        if(d.inning) g.inning=d.inning;
        if(d.halfInning) g.halfInning=d.halfInning;
        if(d.outs!=null) g.outs=d.outs;
        if(d.awayScore!=null) g.awayScore=d.awayScore;
        if(d.homeScore!=null) g.homeScore=d.homeScore;
        if(d.onFirst!=null) g.onFirst=!!d.onFirst;
        if(d.onSecond!=null) g.onSecond=!!d.onSecond;
        if(d.onThird!=null) g.onThird=!!d.onThird;
        if(d.awayHits!=null) g.awayHits=d.awayHits;
        if(d.homeHits!=null) g.homeHits=d.homeHits;
      }else if(d.type==='status'){
        if(d.label==='Game underway!'){ g.status='Live'; g.detailedState='In Progress'; }
        else if(d.label==='Game Final'){ g.status='Final'; }
        else if(d.label==='Game Postponed'){ g.status='Final'; g.detailedState='Postponed'; }
        else if(d.label==='Game Delayed'){ g.detailedState='Delayed'; }
      }
    }
    _addFeedItem(item.gamePk,d);
  });
  // Queue is recording-period plays only — first replayed event is the
  // first new play after the user clicked Record.
  state.demoPlayQueue=[];
  queueItems.forEach(function(item){
    var ts=item.ts.getTime();
    var d=item.data||{};
    state.demoPlayQueue.push({
      gamePk:item.gamePk,ts:ts,
      event:d.event,desc:d.desc,type:d.type||'play',inning:d.inning,halfInning:d.halfInning,outs:d.outs,
      awayScore:d.awayScore,homeScore:d.homeScore,scoring:d.scoring,risp:d.risp,playClass:d.playClass,
      playTime:new Date(ts),batterId:d.batterId,batterName:d.batterName,pitcherId:d.pitcherId,pitcherName:d.pitcherName,
      distance:d.distance,speed:d.speed,rbi:d.rbi,
      onFirst:d.onFirst,onSecond:d.onSecond,onThird:d.onThird,
      awayHits:d.awayHits,homeHits:d.homeHits,
      icon:d.icon,label:d.label,sub:d.sub
    });
  });
  state.demoPlayQueue.sort(function(a,b){return a.ts-b.ts;});
  state.demoPlayIdx=0;
  // Start the demo clock at the first queue play (or recording-start
  // cutoff if no queue plays). pitchTimeline / contentCacheTimeline /
  // focusTrack entries were captured at ts >= cutoff so lookups against
  // demoCurrentTime land in real data immediately.
  state.demoCurrentTime=state.demoPlayQueue.length>0?state.demoPlayQueue[0].ts:cutoff;
  // Feed already populated by backlog walk above — don't clear it.
  _renderTicker();
  _renderSideRailGames();
  await _buildStoryPool();
  _updateFeedEmpty();
  _showAlert({
    icon:'▶',
    event:'Demo Mode · '+state.enabledGames.size+' games · '+state.feedItems.length+' plays loaded',
    desc:'Heads up — this is a replay of a recorded session. Focus mode pitch data is limited to games that were captured live. Toggle 📻 for Classic Radio: random vintage broadcast (Vin Scully, Mantle’s final game, WS69, Seaver 19K) re-rolls on focus switch — atmosphere only, not synced to plays.',
    color:'#7dd89e',
    duration:12000
  });
  if(state.storyRotateTimer) clearInterval(state.storyRotateTimer);
  state.storyRotateTimer=setInterval(_rotateStory,state.devTuning.rotateMs);
  state.demoStartTime=Date.now();
  updateDemoBtnLabel();
  pollDemoFeeds();
}

async function loadDemoGames() {
  try{
    var todayEt=etDateStr();
    for(var dayOffset=1;dayOffset<=7;dayOffset++){
      var dateStr=etDatePlus(todayEt,-dayOffset);
      var r=await fetch(MLB_BASE+'/schedule?date='+dateStr+'&sportId=1');
      if(!r.ok) continue;
      var data=await r.json();
      var allGames=data.games||[];
      var games=allGames.filter(function(g){return g.status.abstractGameState==='Final';});
      if(games.length>0){
        state.demoGamesCache=games.map(function(g){
          return{gamePk:g.gamePk,gameDateTime:g.gameDateTime,awayTeam:{id:g.teams.away.team.id,name:g.teams.away.name,shortName:g.teams.away.shortName},homeTeam:{id:g.teams.home.team.id,name:g.teams.home.name,shortName:g.teams.home.shortName},venue:g.venue||'',gameDetails:g};
        });
        return state.demoGamesCache;
      }
    }
    return [];
  }catch(e){
    console.error('Demo: loadDemoGames error',e.message);
    return [];
  }
}

async function buildDemoPlayQueue(games) {
  state.demoPlayQueue=[];
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
              state.demoPlayQueue.push({gamePk:g.gamePk,event:evt,desc:desc,scoring:scorer,inn:p.about.inning,half:(p.about.halfInning||'top').toLowerCase(),outs:p.count?p.count.outs:0,awayScore:awayRuns,homeScore:homeRuns,ts:p.about&&p.about.endTime?new Date(p.about.endTime).getTime():Date.now(),type:playEvent});
            }
          }
        });
      }
    }catch(e){
      console.warn('Demo: playByPlay error for gamePk',g.gamePk,e.message);
    }
  }
  state.demoPlayQueue.sort(function(a,b){return a.ts-b.ts;});
  state.demoPlayIdx=0;
}

async function pollDemoFeeds(){
  if(!state.demoMode) return;
  if(demoPaused){
    clearTimeout(state.demoTimer);
    state.demoTimer=setTimeout(pollDemoFeeds,demoSpeedMs);
    return;
  }
  if(state.demoPlayIdx>=state.demoPlayQueue.length){
    renderDemoEndScreen();
    return;
  }
  var play=state.demoPlayQueue[state.demoPlayIdx];
  var tickStart=Date.now();
  await advanceDemoPlay(play);
  state.demoPlayIdx++;
  // Subtract elapsed (mostly pitch sub-ticks) so each cycle still totals
  // ~demoSpeedMs regardless of how long the at-bat's pitches took to animate.
  var nextDelay=Math.max(40,demoSpeedMs-(Date.now()-tickStart));
  clearTimeout(state.demoTimer);
  state.demoTimer=setTimeout(pollDemoFeeds,nextDelay);
}

export function setDemoSpeed(ms,btn){
  demoSpeedMs=ms;
  if(btn){
    document.querySelectorAll('#demoSpeed1x,#demoSpeed10x,#demoSpeed30x').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
  }
  if(state.demoMode&&!demoPaused&&state.demoTimer){
    clearTimeout(state.demoTimer);
    state.demoTimer=setTimeout(pollDemoFeeds,demoSpeedMs);
  }
}

export function toggleDemoPause(){
  demoPaused=!demoPaused;
  var btn=document.getElementById('demoPauseBtn');
  if(btn) btn.textContent=demoPaused?'▶ Resume':'⏸ Pause';
  if(!demoPaused&&state.demoMode) pollDemoFeeds();
}

export function backDemoPlay(){
  if(state.demoPlayIdx>0) state.demoPlayIdx--;
  clearTimeout(state.demoTimer);
  if(!demoPaused) pollDemoFeeds();
}

export function forwardDemoPlay(){
  if(state.demoPlayIdx<state.demoPlayQueue.length) state.demoPlayIdx++;
  clearTimeout(state.demoTimer);
  if(!demoPaused) pollDemoFeeds();
}

export function demoNextHR(){
  if(_hrSeekActive) return; // already seeking
  // Confirm there's an HR ahead so we don't fast-forward to the end
  var found=false;
  for(var i=state.demoPlayIdx;i<state.demoPlayQueue.length;i++){
    if(state.demoPlayQueue[i].event==='Home Run'){found=true;break;}
  }
  if(!found){_showAlert({icon:'⚠️',event:'No more HRs',desc:'Reached end of demo',duration:2000});return;}
  // Engage seek mode: 20x cadence until an HR fires. Plays still animate
  // through the feed/ticker/focus card so the user sees the buildup
  // instead of a hard jump.
  _hrSeekActive=true;
  _hrSeekPriorSpeed=demoSpeedMs;
  demoSpeedMs=500;
  if(demoPaused){
    demoPaused=false;
    var btn=document.getElementById('demoPauseBtn');
    if(btn) btn.textContent='⏸ Pause';
  }
  clearTimeout(state.demoTimer);
  state.demoTimer=setTimeout(pollDemoFeeds,demoSpeedMs);
}

async function advanceDemoPlay(play) {
  var g=state.gameStates[play.gamePk];
  if(!g){ state.demoCurrentTime=play.ts; return; }
  // Pitch sub-tick: when the focused game is the one this play belongs to,
  // reveal the at-bat's pitches one-by-one *before* the outcome lands so the
  // focus card animates B/S/O like live mode (5s linescore polls).
  // Non-focused games skip this and snap straight to the play outcome.
  if(play.type==='play'&&state.focusGamePk===play.gamePk){
    await _animateFocusPitches(play);
  }
  state.demoCurrentTime=play.ts;
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
    }else if(play.label==='Game Postponed'){
      g.status='Final'; g.detailedState='Postponed';
    }else if(play.label==='Game Delayed'){
      g.detailedState='Delayed';
    }
  }else{
    // Infer Game underway! status when a play arrives for a still-Preview
    // game. The recorder baseline only carries the most recent ~200 feed
    // items, so for games that started before the recording window the
    // explicit "Game underway!" status entry can be missing — without
    // this, g.status stayed Preview forever and the ticker (which filters
    // to Live) showed the game as absent.
    if(g.status!=='Live'&&g.status!=='Final'){
      g.status='Live';
      g.detailedState='In Progress';
    }
    // Capture pre-update score so we can infer RBI count from the delta —
    // fallback path for legacy recordings that don't carry play.rbi.
    var prevAway=g.awayScore||0, prevHome=g.homeScore||0;
    g.inning=play.inning;
    g.halfInning=play.halfInning;
    g.outs=play.outs;
    g.awayScore=play.awayScore;
    g.homeScore=play.homeScore;
    if(play.onFirst!=null) g.onFirst=!!play.onFirst;
    if(play.onSecond!=null) g.onSecond=!!play.onSecond;
    if(play.onThird!=null) g.onThird=!!play.onThird;
    if(play.awayHits!=null) g.awayHits=play.awayHits;
    if(play.homeHits!=null) g.homeHits=play.homeHits;
    // Live trackers — mirror pollGamePlays bookkeeping so demo's story
    // carousel + perfect-game tracker stay live with the play stream.
    var isHitEvt=['Single','Double','Triple','Home Run'].indexOf(play.event)!==-1;
    if(state.perfectGameTracker[play.gamePk]===undefined) state.perfectGameTracker[play.gamePk]=true;
    if(['Walk','Hit By Pitch','Intentional Walk','Error','Fielders Choice','Catcher Interference'].indexOf(play.event)!==-1) state.perfectGameTracker[play.gamePk]=false;
    if(isHitEvt) state.perfectGameTracker[play.gamePk]=false;
    if(isHitEvt&&play.batterId){
      var dh=state.dailyHitsTracker[play.batterId]||{name:play.batterName,hits:0,hrs:0,gamePk:play.gamePk};
      dh.hits++; if(play.event==='Home Run') dh.hrs++; dh.name=play.batterName||dh.name; dh.gamePk=play.gamePk;
      state.dailyHitsTracker[play.batterId]=dh;
    }
    if(play.event==='Strikeout'&&play.pitcherId){
      var kkey=play.gamePk+'_'+play.pitcherId;
      var ke=state.dailyPitcherKs[kkey]||{name:play.pitcherName,ks:0,gamePk:play.gamePk};
      ke.ks++; ke.name=play.pitcherName||ke.name; state.dailyPitcherKs[kkey]=ke;
    }
    // Inning recap firing — mirror src/pulse/poll.js:238
    if(play.outs===3){
      var _rk=play.gamePk+'_'+play.inning+'_'+(play.halfInning||'top').toLowerCase();
      if(!state.inningRecapsFired.has(_rk)) state.inningRecapsPending[_rk]={gamePk:play.gamePk,inning:play.inning,halfInning:(play.halfInning||'top').toLowerCase()};
    }
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
    if(play.distance!=null) feedData.distance=play.distance;
    if(play.speed!=null) feedData.speed=play.speed;
    if(play.onFirst!=null) feedData.onFirst=play.onFirst;
    if(play.onSecond!=null) feedData.onSecond=play.onSecond;
    if(play.onThird!=null) feedData.onThird=play.onThird;
    if(play.awayHits!=null) feedData.awayHits=play.awayHits;
    if(play.homeHits!=null) feedData.homeHits=play.homeHits;
    if(play.event==='Home Run'){
      _playSound('hr');
      if(play.batterId) _showPlayerCard(play.batterId,play.batterName||'',g.awayId,g.homeId,play.halfInning,null,play.desc,null,play.gamePk);
      // HR seek complete: restore prior speed, pause so the user can take
      // in the HR card overlay before resuming.
      if(_hrSeekActive){
        _hrSeekActive=false;
        demoSpeedMs=_hrSeekPriorSpeed||10000;
        demoPaused=true;
        var pauseBtn=document.getElementById('demoPauseBtn');
        if(pauseBtn) pauseBtn.textContent='▶ Resume';
      }
    }else if(play.scoring){
      // Prefer the captured RBI; fall back to score-delta inference for
      // legacy recordings whose feedItems predate play.rbi capture.
      var rbi=(play.rbi!=null)?play.rbi:Math.max(0,(play.awayScore-prevAway)+(play.homeScore-prevHome));
      if(!rbi) rbi=1;
      var rbiOk=(Date.now()-(state.rbiCardCooldowns[play.gamePk]||0))>=state.devTuning.rbiCooldown;
      var rbiScore=calcRBICardScore(rbi,play.event,play.awayScore,play.homeScore,play.inning,play.halfInning);
      if(_showRBICard&&rbiScore>=state.devTuning.rbiThreshold&&play.batterId&&rbiOk){
        state.rbiCardCooldowns[play.gamePk]=Date.now();
        _showRBICard(play.batterId,play.batterName||'',g.awayId,g.homeId,play.halfInning,rbi,play.event,play.awayScore,play.homeScore,play.inning,play.gamePk);
      }
      _playSound('run');
    }
  }
  _addFeedItem(play.gamePk,feedData);
  _renderTicker();
  _renderSideRailGames();
  // Drive Focus Mode: walk focusTrack[] to pick the focused game per the
  // recorded session, then re-hydrate focusState from pitchTimeline at the
  // new demoCurrentTime. Independent of the 5s pollFocusLinescore interval
  // so high speeds (10x/30x) stay in sync with the play stream.
  if(_selectFocusGame) _selectFocusGame();
  if(_pollFocusLinescore&&state.focusGamePk) _pollFocusLinescore();
  // Match captured video clips to feed items as their arrival time crosses
  // demoCurrentTime; existing match-by-batterId + DOM patch logic runs unchanged.
  if(_pollPendingVideoClips) _pollPendingVideoClips();
  await _buildStoryPool();
}

// Find the pitch envelope corresponding to this play (batterId + ts proximity),
// then advance demoCurrentTime to each pitch's eventTs and re-hydrate the focus
// card. Budgets ~50% of demoSpeedMs across pitches so the cycle still feels 1x.
async function _animateFocusPitches(play){
  var timeline=(state.pitchTimeline&&state.pitchTimeline[play.gamePk])||[];
  if(!timeline.length||!play.batterId) return;
  var envelope=null;
  for(var ei=timeline.length-1;ei>=0;ei--){
    var ev=timeline[ei];
    if(ev.batterId===play.batterId&&Math.abs((ev.ts||0)-play.ts)<60000){ envelope=ev; break; }
  }
  if(!envelope) return;
  var pitches=(envelope.pitches||[]).filter(function(p){ return p.eventTs!=null; });
  if(!pitches.length) return;
  // Total pitch-animation budget — capped at half a play tick so the
  // outer pollDemoFeeds rhythm survives.
  var budget=Math.max(100,Math.min(demoSpeedMs*0.5,4000));
  var perPitchMs=Math.max(40,Math.floor(budget/pitches.length));
  for(var i=0;i<pitches.length;i++){
    if(!state.demoMode) return;
    var p=pitches[i];
    state.demoCurrentTime=p.eventTs;
    if(_pollFocusLinescore&&state.focusGamePk===play.gamePk) _pollFocusLinescore();
    await new Promise(function(res){ setTimeout(res,perPitchMs); });
  }
}

function renderDemoEndScreen() {
  state.demoMode=false;
  clearTimeout(state.demoTimer);
  if(state.storyRotateTimer) clearInterval(state.storyRotateTimer);
  var overlay=document.createElement('div');
  overlay.className='demo-end-screen';
  overlay.innerHTML='<div class="demo-end-card"><div class="demo-end-headline">Demo Complete</div>'
    +'<div class="demo-end-summary">'+state.demoGamesCache.length+' games &middot; '+state.demoPlayQueue.length+' plays</div>'
    +'<div class="demo-end-tagline">Ready for live games? Enable Game Start Alerts in Settings.</div>'
    +'<button onclick="exitDemo()" style="margin-top:12px;background:var(--secondary);color:var(--accent-text);border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-weight:600">Exit Demo</button>'
    +'</div>';
  overlay.onclick=function(e){if(e.target===overlay) exitDemo();};
  document.body.appendChild(overlay);
  setTimeout(function(){
    if(document.body.contains(overlay)) exitDemo();
  },4000);
}

export function exitDemo() {
  state.demoMode=false;
  demoPaused=false;
  _hrSeekActive=false;
  stopClassic();
  clearTimeout(state.demoTimer);
  if(state.storyRotateTimer) clearInterval(state.storyRotateTimer);
  if(state.pulseAbortCtrl){state.pulseAbortCtrl.abort();state.pulseAbortCtrl=null;}
  if(state.focusAbortCtrl){state.focusAbortCtrl.abort();state.focusAbortCtrl=null;}
  var overlay=document.querySelector('.demo-end-screen');
  if(overlay) overlay.remove();
  document.body.classList.remove('demo-active');

  state.demoMode=false;
  state.gameStates={};
  state.feedItems=[];
  state.enabledGames=new Set();
  state.storyPool=[];
  state.demoPlayQueue=[];
  state.demoPlayIdx=0;
  state.storyShownId=null;
  state.demoCurrentTime=0;
  state.inningRecapsFired=new Set();state.inningRecapsPending={};state.lastInningState={};
  // Reset Demo Mode v2 hydrated fields so a re-entry starts clean.
  state.pitchTimeline={};
  state.boxscoreSnapshots={};
  state.contentCacheTimeline={};
  state.focusTrack=[];
  state.demoCardCount=0;
  // Reset all the carousel + content caches that initDemo hydrated from
  // the JSON. Without this, post-exit Pulse shows stale demo carousel
  // entries (e.g. yesterday's HR leaders) until each cache's individual
  // refresh timer fires. resumeLivePulse triggers fresh loaders below.
  state.dailyLeadersCache=null; state.dailyLeadersLastFetch=0;
  state.onThisDayCache=null;
  state.yesterdayCache=null;
  state.hrBatterStatsCache={};
  state.probablePitcherStatsCache={};
  state.dailyHitsTracker={};
  state.dailyPitcherKs={};
  state.storyCarouselRawGameData={};
  state.stolenBaseEvents=[];
  state.transactionsCache=[]; state.transactionsLastFetch=0;
  state.liveWPCache={}; state.liveWPLastFetch=0;
  state.perfectGameTracker={};
  state.highLowCache=null; state.highLowLastFetch=0;
  state.focusStatsCache={};
  state.lastVideoClip=null;
  state.liveContentCache={};
  state.yesterdayContentCache={};
  state.boxscoreCache={};

  var feed=document.getElementById('feed');
  if(feed) feed.innerHTML='';
  var ticker=document.getElementById('gameTicker');
  if(ticker) ticker.innerHTML='';

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
    var demoSpeed30x=document.getElementById('demoSpeed30x');
    if(demoSpeed30x) demoSpeed30x.style.display='none';
    var demoNextHRBtn=document.getElementById('demoNextHRBtn');
    if(demoNextHRBtn) demoNextHRBtn.style.display='none';
    var demoPauseBtn=document.getElementById('demoPauseBtn');
    if(demoPauseBtn) demoPauseBtn.style.display='none';
    var demoForwardBtn=document.getElementById('demoForwardBtn');
    if(demoForwardBtn) demoForwardBtn.style.display='none';
    var demoExitBtn=document.getElementById('demoExitBtn');
    if(demoExitBtn) demoExitBtn.style.display='none';
    var badge=document.getElementById('mockBarBadge');
    if(badge) badge.textContent='⚡ Mock';
  }
  updateDemoBtnLabel();
  // Restart live polling so Pulse repopulates with real data (or shows
  // the hype/empty card if no live games). Without this, exit leaves
  // Pulse staring at empty state arrays.
  if(_resumeLivePulse) _resumeLivePulse();
}

export { loadDemoGames, buildDemoPlayQueue };
