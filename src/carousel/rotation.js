import { state } from '../state.js';
import {
  genHRStories, genNoHitterWatch, genWalkOffThreat, genBasesLoaded, genStolenBaseStories, genBigInning,
  genFinalScoreStories, genStreakStories, genMultiHitDay, genDailyLeaders,
  genPitcherGem, genOnThisDay, genYesterdayHighlights, genProbablePitchers, genInningRecapStories,
  genRosterMoveStories, genWinProbabilityStories, genSeasonHighStories,
  genLiveWinProbStories, genDailyIntro, ordinal,
  loadProbablePitcherStats, fetchMissingHRBatterStats, loadTransactionsCache, loadHighLowCache, loadDailyLeaders, loadLiveWPCache
} from './generators.js';

let rotationCallbacks = { refreshDebugPanel: null };
function setRotationCallbacks(callbacks) {
  Object.assign(rotationCallbacks, callbacks);
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
  if(rotationCallbacks.refreshDebugPanel) rotationCallbacks.refreshDebugPanel();
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

export { setRotationCallbacks, buildStoryPool, rotateStory, showStoryCard, renderStoryCard, updateStoryDots, prevStory, nextStory, onStoryVisibilityChange };
