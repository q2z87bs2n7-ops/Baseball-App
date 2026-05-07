// ── Demo Mode System
// Self-contained replay of April 27-28, 2026 from daily-events.json.
// No external API calls; speeds configurable (1x/10x/100x).
// Encapsulated state: demoPaused, demoSpeedMs

import { state } from '../state.js';
import { devTrace } from '../diag/devLog.js';
import { MLB_BASE } from '../config/constants.js';

// Encapsulated demo-only state
let demoPaused = false;
let demoSpeedMs = 10000;

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
let _rotateStory = null;
let _localDateStr = null;

export function setDemoCallbacks(callbacks) {
  _addFeedItem = callbacks.addFeedItem;
  _renderTicker = callbacks.renderTicker;
  _renderSideRailGames = callbacks.renderSideRailGames;
  _buildStoryPool = callbacks.buildStoryPool;
  _updateFeedEmpty = callbacks.updateFeedEmpty;
  _showAlert = callbacks.showAlert;
  _playSound = callbacks.playSound;
  _showPlayerCard = callbacks.showPlayerCard;
  _rotateStory = callbacks.rotateStory;
  _localDateStr = callbacks.localDateStr;
}

async function loadDailyEventsJSON(){
  try{
    var r=await fetch('./daily-events.json');
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
  state.gameStates={};
  state.feedItems=[];
  state.scheduleData=[];
  state.enabledGames=new Set();
  state.storyPool=[];
  state.storyShownId=null;
  state.demoPlayQueue=[];
  state.demoPlayIdx=0;
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
  Object.values(state.gameStates).forEach(function(g){
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
  state.feedItems=(jsonData.feedItems||[]).map(function(item){
    var ts=item.ts||item.playTime;
    if(typeof ts==='number') ts=new Date(ts);
    else if(typeof ts==='string') ts=new Date(ts);
    if(!(ts instanceof Date)) ts=new Date();
    return {gamePk:item.gamePk,data:item.data,ts:ts};
  });
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
  // Recorder v2 keys — consumed by PR-3 demo branches in Focus Mode,
  // pollPendingVideoClips, fetchBoxscore, etc. Hydrating now is harmless
  // when consumers haven't been wired yet (data sits in state, unused).
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
  state.feedItems.forEach(function(item){
    if(item.playTime&&typeof item.playTime==='string') item.playTime=new Date(item.playTime);
  });
  state.onThisDayCache.forEach(function(item){if(item.ts&&typeof item.ts==='string') item.ts=new Date(item.ts);});
  state.yesterdayCache.forEach(function(item){if(item.ts&&typeof item.ts==='string') item.ts=new Date(item.ts);});
  var gamesWithPlays=new Set();
  state.feedItems.forEach(function(item){if(item.gamePk) gamesWithPlays.add(item.gamePk);});
  Object.keys(state.gameStates).forEach(function(pk){
    if(state.demoMode){
      if(gamesWithPlays.has(parseInt(pk))) state.enabledGames.add(parseInt(pk));
    }else{
      state.enabledGames.add(parseInt(pk));
    }
  });
  state.demoPlayQueue=[];
  state.feedItems.forEach(function(item){
    var ts=item.playTime&&item.playTime.getTime?item.playTime.getTime():(new Date(item.ts)).getTime();
    var d=item.data||{};
    state.demoPlayQueue.push({
      gamePk:item.gamePk,ts:ts,
      event:d.event,desc:d.desc,type:d.type||'play',inning:d.inning,halfInning:d.halfInning,outs:d.outs,
      awayScore:d.awayScore,homeScore:d.homeScore,scoring:d.scoring,risp:d.risp,playClass:d.playClass,
      playTime:new Date(ts),batterId:d.batterId,batterName:d.batterName,pitcherName:d.pitcherName,distance:d.distance,
      icon:d.icon,label:d.label,sub:d.sub
    });
  });
  state.demoPlayQueue.sort(function(a,b){return a.ts-b.ts;});
  state.demoPlayIdx=0;
  state.demoCurrentTime=state.demoPlayQueue.length>0?state.demoPlayQueue[0].ts:0;
  var feed=document.getElementById('feed');
  if(feed) feed.innerHTML='';
  _renderTicker();
  _renderSideRailGames();
  await _buildStoryPool();
  _updateFeedEmpty();
  _showAlert({icon:'▶',event:'Demo Mode',desc:state.enabledGames.size+' games · '+state.feedItems.length+' plays',color:'#7dd89e',duration:3000});
  if(state.storyRotateTimer) clearInterval(state.storyRotateTimer);
  state.storyRotateTimer=setInterval(_rotateStory,state.devTuning.rotateMs);
  state.demoStartTime=Date.now();
  updateDemoBtnLabel();
  pollDemoFeeds();
}

async function loadDemoGames() {
  try{
    for(var dayOffset=1;dayOffset<=7;dayOffset++){
      var d=new Date();d.setDate(d.getDate()-dayOffset);
      var dateStr=d.getFullYear()+'-'+(d.getMonth()+1).toString().padStart(2,'0')+'-'+d.getDate().toString().padStart(2,'0');
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
  await advanceDemoPlay(play);
  state.demoPlayIdx++;
  clearTimeout(state.demoTimer);
  state.demoTimer=setTimeout(pollDemoFeeds,demoSpeedMs);
}

export function setDemoSpeed(ms,btn){
  demoSpeedMs=ms;
  if(btn){
    document.querySelectorAll('#demoSpeed1x,#demoSpeed10x,#demoSpeed100x').forEach(b=>b.classList.remove('active'));
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
  var nextHRIdx=-1;
  for(var i=state.demoPlayIdx;i<state.demoPlayQueue.length;i++){
    if(state.demoPlayQueue[i].event==='Home Run'){nextHRIdx=i;break;}
  }
  if(nextHRIdx===-1){_showAlert({icon:'⚠️',event:'No more HRs',desc:'Reached end of demo',duration:2000});return;}
  state.demoPlayIdx=nextHRIdx-1;
  clearTimeout(state.demoTimer);
  if(state.demoPlayIdx<state.demoPlayQueue.length) state.demoPlayIdx++;
  var play=state.demoPlayQueue[state.demoPlayIdx];
  if(play){
    state.demoCurrentTime=play.ts;
    advanceDemoPlay(play).then(function(){
      state.demoPlayIdx++;
      demoPaused=true;
      var btn=document.getElementById('demoPauseBtn');
      if(btn) btn.textContent='▶ Resume';
    });
  }
}

async function advanceDemoPlay(play) {
  state.demoCurrentTime=play.ts;
  var g=state.gameStates[play.gamePk];
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
    if(play.event==='Home Run'){
      _playSound('hr');
      if(play.batterId) _showPlayerCard(play.batterId,play.batterName||'',g.awayId,g.homeId,play.halfInning,null,play.desc,null,play.gamePk);
    }else if(play.scoring){
      _showAlert({icon:'🟢',event:'RUN SCORES · '+g.awayAbbr+' '+play.awayScore+', '+g.homeAbbr+' '+play.homeScore,desc:play.desc,color:g.homePrimary,duration:4000});
      _playSound('run');
    }
  }
  _addFeedItem(play.gamePk,feedData);
  _renderTicker();
  _renderSideRailGames();
  await _buildStoryPool();
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
  updateDemoBtnLabel();
}

export { loadDemoGames, buildDemoPlayQueue };
