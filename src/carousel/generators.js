import { state } from '../state.js';
import { SEASON, MLB_BASE } from '../config/constants.js';
import { fmtRate, etDateStr, etDatePlus } from '../utils/format.js';

const DEBUG = false;

let carouselCallbacks = { updateFeedEmpty: null, fetchBoxscore: null, localDateStr: null, getEffectiveDate: null, tcLookup: null };
function setCarouselCallbacks(callbacks) {
  Object.assign(carouselCallbacks, callbacks);
}

function ordinal(n){ return n===1?'1st':n===2?'2nd':n===3?'3rd':n+'th'; }

function makeStory(id,type,tier,priority,icon,headline,sub,badge,gamePk,ts,cooldownMs,decayRate){
  var existing=state.storyPool.find(function(s){return s.id===id;});
  return {id:id,type:type,tier:tier,priority:priority,icon:icon,headline:headline,sub:sub,badge:badge,gamePk:gamePk||null,ts:ts||new Date(),lastShown:existing?existing.lastShown:null,cooldownMs:cooldownMs,decayRate:decayRate};
}

function liveOrHighlight(sbId,eventTs){
  var recent=eventTs&&(Date.now()-eventTs.getTime())<=60000;
  return (recent&&!state.displayedStoryIds.has(sbId))?'live':'highlight';
}

function genHRStories(){
  var out=[];
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
    var statObj=state.hrBatterStatsCache[bid]||(function(){var c=(state.statsCache.hitting||[]).find(function(e){return e.player&&e.player.id==bid;});return c?c.stat:null;})();
    var statStr='';
    if(statObj&&statObj.homeRuns!=null) statStr=statObj.homeRuns+' HR · '+statObj.rbi+' RBI · '+fmtRate(statObj.avg)+' AVG · '+fmtRate(statObj.ops)+' OPS';
    var sub=g.awayAbbr+' @ '+g.homeAbbr+(statStr?' · '+statStr:'');
    var id, headline, priority;
    if(count===1){
      id='hr_'+item.gamePk+'_'+item.ts.getTime();
      var pitcherStr=item.data.pitcherName?' off '+item.data.pitcherName:'';
      var distStr=item.data.distance?item.data.distance+'ft ':'';
      var speedStr=item.data.speed?' at '+item.data.speed+' mph':'';
      var innStr=item.data.inning?' in the '+ordinal(item.data.inning)+' inning':'';
      var hrNumMatch=(item.data.desc||'').match(/\((\d+)\)/);
      var hrTag=hrNumMatch?' (HR #'+hrNumMatch[1]+' this season)':'';
      headline=bname+' hit a '+distStr+'homer'+speedStr+pitcherStr+innStr+hrTag;
      priority=state.devTuning.hr_priority;
    } else {
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
    var deficit=g.awayScore-g.homeScore;
    if(deficit<0||deficit>runnersOn+1) return;
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
    var id='basesloaded_'+g.gamePk+'_'+g.inning+'_'+g.halfInning;
    var headline='Bases loaded — '+battingAbbr+' batting in the '+ordinal(g.inning);
    var sub=g.awayAbbr+' '+g.awayScore+', '+g.homeAbbr+' '+g.homeScore+' · '+ordinal(g.inning);
    out.push(makeStory(id,'realtime',1,state.devTuning.basesloaded_priority,'🔔',headline,sub,'live',g.gamePk,new Date(),3*60000,0.8));
  });
  return out;
}

function genStolenBaseStories(){
  var out=[];
  var now=Date.now();
  state.stolenBaseEvents.forEach(function(sb){
    var isHome=sb.base==='home';
    var baseLabel=isHome?'home plate':sb.base;
    var halfInd=sb.halfInning==='top'?'▲':'▼';
    var sub=sb.awayAbbr+' @ '+sb.homeAbbr+' · '+halfInd+sb.inning;
    if(sb.caught){
      if(now - sb.ts.getTime() > 90000) return;
      var csId='cs_'+sb.key;
      out.push(makeStory(csId,'realtime',1,92,'🚫',
        (sb.runnerName||'Runner')+' caught stealing '+baseLabel,sub,liveOrHighlight(csId,sb.ts),sb.gamePk,sb.ts,90000,0.9));
    } else {
      var sbId='sb_'+sb.key;
      out.push(makeStory(sbId,'realtime',isHome?1:2,isHome?85:55,'🏃',
        (sb.runnerName||'Runner')+' steals '+baseLabel,sub,liveOrHighlight(sbId,sb.ts),sb.gamePk,sb.ts,5*60000,0.7));
    }
  });
  return out;
}

function genActionEventStories(){
  var out=[];
  var now=Date.now();
  state.actionEvents.forEach(function(ae){
    var ageMs=now - ae.ts.getTime();
    var halfInd=ae.halfInning==='top'?'▲':'▼';
    var sub=ae.awayAbbr+' @ '+ae.homeAbbr+' · '+halfInd+ae.inning;
    var id, headline, icon, priority, ttl;
    if(ae.kind==='pickoff_out'){
      ttl=90000; if(ageMs>ttl) return;
      id='po_'+ae.key;
      headline=(ae.runnerName||'Runner')+' picked off at '+(ae.base==='home'?'home':ae.base);
      icon='🎯'; priority=95;
    } else if(ae.kind==='pitching_change'){
      ttl=90000; if(ageMs>ttl) return;
      id='pc_'+ae.key;
      headline=(ae.pitcherName||'New pitcher')+' takes the mound';
      icon='🔄'; priority=92;
    } else if(ae.kind==='pinch_hitter'){
      ttl=90000; if(ageMs>ttl) return;
      id='ph_'+ae.key;
      var phMatch=(ae.desc||'').match(/Pinch-hitter\s+([^.]+?)\s+replaces\s+([^.]+?)\.?$/);
      headline=phMatch?(phMatch[1]+' pinch-hits for '+phMatch[2]):'Pinch hitter announced';
      icon='🪄'; priority=92;
    } else if(ae.kind==='pinch_runner'){
      ttl=90000; if(ageMs>ttl) return;
      id='pr_'+ae.key;
      var prMatch=(ae.desc||'').match(/Pinch-runner\s+([^.]+?)\s+replaces\s+([^.]+?)\.?$/);
      headline=prMatch?(prMatch[1]+' pinch-runs for '+prMatch[2]):'Pinch runner announced';
      icon='👟'; priority=92;
    } else if(ae.kind==='replay_review'){
      ttl=60000; if(ageMs>ttl) return;
      id='rr_'+ae.key;
      headline='Replay review under way';
      icon='📺'; priority=95;
    } else { return; }
    out.push(makeStory(id,'realtime',1,priority,icon,headline,sub,liveOrHighlight(id,ae.ts),ae.gamePk,ae.ts,ttl,0.9));
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
  var out=[], dateStr=carouselCallbacks.localDateStr(carouselCallbacks.getEffectiveDate());
  var playerIds=Object.keys(state.dailyHitsTracker);
  for(var i=0;i<playerIds.length;i++){
    var batterId=playerIds[i];
    var entry=state.dailyHitsTracker[batterId];
    if(entry.hits<3&&!(entry.hits>=2&&entry.hrs>=1)) continue;
    var id='multihit_'+batterId+'_'+dateStr;
    var h=entry.hits, ab=entry.hits;
    if(!state.demoMode&&entry.gamePk){
      var bs=await (carouselCallbacks.fetchBoxscore ? carouselCallbacks.fetchBoxscore(entry.gamePk) : null);
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
  var today=carouselCallbacks.localDateStr(carouselCallbacks.getEffectiveDate());
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
  var out=[], today=carouselCallbacks.localDateStr(carouselCallbacks.getEffectiveDate());
  var games=[];
  if(state.demoMode&&DEBUG) console.log('Demo: genProbablePitchers filtering to date',today,'found',Object.values(state.gameStates).filter(g=>carouselCallbacks.localDateStr(new Date(g.gameDateMs))===today).length,'matching games');
  Object.values(state.gameStates).forEach(function(g){
    if(carouselCallbacks.localDateStr(new Date(g.gameDateMs))===today&&g.awayAbbr&&g.homeAbbr&&g.status!=='Live'&&g.status!=='Final') {
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

function genInningRecapStories(){
  var out=[];
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
  Object.keys(state.inningRecapsPending).forEach(function(recapKey){
    var p=state.inningRecapsPending[recapKey];
    var g=state.gameStates[p.gamePk];
    if(!g){delete state.inningRecapsPending[recapKey];return;}
    genRecap(g,p.inning,p.halfInning,recapKey);
    delete state.inningRecapsPending[recapKey];
    state.lastInningState[p.gamePk]={inning:p.inning,halfInning:p.halfInning};
  });
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
    var today=etDateStr(),start=etDatePlus(today,-2);
    var r=await fetch(MLB_BASE+'/transactions?sportId=1&startDate='+start+'&endDate='+today);
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
    var toAbbr=t.toTeam&&t.toTeam.id?carouselCallbacks.tcLookup(t.toTeam.id).abbr:'the majors';
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
      var fromAbbr=t.fromTeam&&t.fromTeam.id?carouselCallbacks.tcLookup(t.fromTeam.id).abbr:'the majors';
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
  // Demo: skip the /contextMetrics API call. It returns final-game metrics
  // for the completed games we're replaying (homeWinProbability=100 for the
  // winning team), producing nonsense "100% favorites" cards. genLiveWinProbStories
  // below reads from state.liveWPCache (hydrated from the recording) instead.
  if(state.demoMode) return out;
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

async function loadOnThisDayCache(){
  state.onThisDayCache=[];
  var todayParts=etDateStr().split('-');
  var mm=todayParts[1];
  var dd=todayParts[2];
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
          var bs=await (carouselCallbacks.fetchBoxscore ? carouselCallbacks.fetchBoxscore(g.gamePk) : null);
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
        var bs=await (carouselCallbacks.fetchBoxscore ? carouselCallbacks.fetchBoxscore(g.gamePk) : null);
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
  var dateStr=etDatePlus(etDateStr(),-1);
  state.yesterdayCache=await loadYdForDate(dateStr);
  state.yesterdayCache.forEach(function(item){item.headline='Yesterday: '+item.headline;});
  if(carouselCallbacks.updateFeedEmpty) carouselCallbacks.updateFeedEmpty();
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
  var todayStr=carouselCallbacks.localDateStr(carouselCallbacks.getEffectiveDate());
  var todayGames=Object.values(state.gameStates).filter(function(g){
    return g.gameDateMs && carouselCallbacks.localDateStr(new Date(g.gameDateMs))===todayStr;
  });
  if(!todayGames.length) return [];
  var liveCount =todayGames.filter(function(g){return g.status==='Live'&&g.detailedState==='In Progress';}).length;
  var finalCount=todayGames.filter(function(g){return g.status==='Final';}).length;
  if(liveCount>=2 || finalCount>=Math.ceil(todayGames.length/2)) return [];
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

export { setCarouselCallbacks, ordinal, makeStory, genHRStories, genNoHitterWatch, genWalkOffThreat, genBasesLoaded, genStolenBaseStories, genActionEventStories, genBigInning, genFinalScoreStories, genStreakStories, genMultiHitDay, genDailyLeaders, genPitcherGem, genOnThisDay, genYesterdayHighlights, fetchMissingHRBatterStats, loadProbablePitcherStats, genProbablePitchers, genInningRecapStories, loadTransactionsCache, loadHighLowCache, loadDailyLeaders, genRosterMoveStories, genWinProbabilityStories, genSeasonHighStories, loadLiveWPCache, genLiveWinProbStories, genDailyIntro, loadOnThisDayCache, loadYesterdayCache, loadYdForDate };
