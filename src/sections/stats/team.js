// Team Stats card (Stats tab v2 — Sprint 1 #06)
// Loads team-level totals + L10 form line for the Team Stats card above the
// .grid3. Cached for 5 min per team; in-flight dedupe protects against double-
// fetch on rapid nav. Honors kickoff Q2: L10 stat aggregates use the
// /teams/{id}/stats?stats=lastXGames endpoint. The W-L · streak · run-diff
// form line uses /standings (already fetched elsewhere; cheap and canonical).

import { state } from '../../state.js';
import { SEASON, MLB_BASE } from '../../config/constants.js';
import { fmt, fmtRate, etDateStr, etDatePlus } from '../../utils/format.js';

export async function loadTeamStats(){
  var stripEl=document.getElementById('teamStatsStrip');
  var formEl=document.getElementById('teamFormLine');
  var titleEl=document.getElementById('teamStatsTitle');
  if(!stripEl)return;
  titleEl.textContent=SEASON+' '+state.activeTeam.short+' · Team Stats';
  var FRESH_MS=300000;
  var teamId=state.activeTeam.id;
  if(state.teamStats.teamId===teamId&&Date.now()-state.teamStatsFetchedAt<FRESH_MS){renderTeamStats();return;}
  if(state.teamStatsInflight)return state.teamStatsInflight;
  stripEl.innerHTML='<div class="loading">Loading team stats...</div>';
  if(formEl)formEl.innerHTML='';
  state.teamStatsInflight=(async function(){
    try{
      // Last-25-day window for the L10-run-diff calc (v4.6.23 — the standings
      // endpoint only returns season-aggregate runDifferential, which was being
      // rendered next to "Last 10:" and read as a last-10 figure).
      var todayStr=etDateStr();
      var fromStr=etDatePlus(todayStr,-25);
      var schedReq=fetch(MLB_BASE+'/schedule?teamId='+teamId+'&startDate='+fromStr+'&endDate='+todayStr+'&hydrate=linescore&sportId=1');
      var seasonReq=fetch(MLB_BASE+'/teams/'+teamId+'/stats?group=hitting,pitching,fielding&stats=season&season='+SEASON);
      var l10Req=fetch(MLB_BASE+'/teams/'+teamId+'/stats?group=hitting,pitching&stats=lastXGames&limitGames=10&season='+SEASON);
      var standingsReq=fetch(MLB_BASE+'/standings?leagueId=103,104&season='+SEASON);
      var [seasonRes,l10Res,standingsRes,schedRes]=await Promise.all([seasonReq,l10Req,standingsReq,schedReq]);
      var seasonData=seasonRes&&seasonRes.ok?await seasonRes.json():null;
      var l10Data=l10Res&&l10Res.ok?await l10Res.json():null;
      var standingsData=standingsRes&&standingsRes.ok?await standingsRes.json():null;
      var schedData=schedRes&&schedRes.ok?await schedRes.json():null;
      state.teamStats.hitting=extractTeamStat(seasonData,'hitting');
      state.teamStats.pitching=extractTeamStat(seasonData,'pitching');
      state.teamStats.fielding=extractTeamStat(seasonData,'fielding');
      state.teamStats.l10Hitting=extractTeamStat(l10Data,'hitting');
      state.teamStats.l10Pitching=extractTeamStat(l10Data,'pitching');
      state.teamStats.standingsRecord=extractTeamRecord(standingsData,teamId);
      state.teamStats.last10RunDiff=computeLast10RunDiff(schedData,teamId);
      state.teamStats.teamId=teamId;
      state.teamStatsFetchedAt=Date.now();
      renderTeamStats();
    }catch(e){
      if(stripEl)stripEl.innerHTML='<div class="error">Could not load team stats</div>';
    }finally{
      state.teamStatsInflight=null;
    }
  })();
  return state.teamStatsInflight;
}

function extractTeamStat(payload,group){
  if(!payload||!payload.stats)return null;
  var blk=payload.stats.find(function(s){return s.group&&s.group.displayName&&s.group.displayName.toLowerCase()===group;});
  if(!blk||!blk.splits||!blk.splits.length)return null;
  return blk.splits[0].stat;
}

// Aggregates run differential from the last 10 Final games for the active
// team. Pulled from the schedule+linescore window fetched in loadTeamStats.
// Returns null when there aren't enough completed games (e.g. early season,
// April rainouts) — the form-line renderer omits the chip in that case rather
// than misleading with a partial sum.
function computeLast10RunDiff(schedPayload,teamId){
  if(!schedPayload||!schedPayload.dates)return null;
  var games=[];
  schedPayload.dates.forEach(function(d){(d.games||[]).forEach(function(g){games.push(g);});});
  // Final only, newest first
  var finals=games.filter(function(g){
    return g.status&&g.status.abstractGameState==='Final'
      &&g.linescore&&g.linescore.teams
      &&g.linescore.teams.home&&g.linescore.teams.away;
  }).sort(function(a,b){return new Date(b.gameDate)-new Date(a.gameDate);});
  if(!finals.length)return null;
  var slice=finals.slice(0,10);
  var diff=0,counted=0;
  slice.forEach(function(g){
    var home=g.teams&&g.teams.home,away=g.teams&&g.teams.away;
    var ls=g.linescore.teams;
    var homeR=parseInt(ls.home.runs,10),awayR=parseInt(ls.away.runs,10);
    if(isNaN(homeR)||isNaN(awayR))return;
    if(home&&home.team&&home.team.id===teamId){diff+=(homeR-awayR);counted++;}
    else if(away&&away.team&&away.team.id===teamId){diff+=(awayR-homeR);counted++;}
  });
  return counted>0?diff:null;
}

function extractTeamRecord(standingsData,teamId){
  if(!standingsData||!standingsData.records)return null;
  for(var i=0;i<standingsData.records.length;i++){
    var teams=standingsData.records[i].teamRecords||[];
    for(var j=0;j<teams.length;j++){
      if(teams[j].team&&teams[j].team.id===teamId){
        var split=(teams[j].records&&teams[j].records.splitRecords||[]).find(function(s){return s.type==='lastTen';});
        return{
          lastTen:split?(split.wins+'-'+split.losses):'',
          lastTenWins:split?split.wins:0,
          lastTenLosses:split?split.losses:0,
          streak:teams[j].streak?teams[j].streak.streakCode:'',
          runDiff:typeof teams[j].runDifferential!=='undefined'?teams[j].runDifferential:null
        };
      }
    }
  }
  return null;
}


function renderTeamStats(){
  var stripEl=document.getElementById('teamStatsStrip');
  var formEl=document.getElementById('teamFormLine');
  if(!stripEl)return;
  var ts=state.teamStats;
  var html='';
  if(ts.hitting){
    var h=ts.hitting;
    html+='<div class="team-stat-tile"><div class="team-stat-tile-head"><span>⚾ Hitting</span></div>'+
      '<div class="team-stat-tile-grid">'+
      '<div class="team-stat-tile-stat"><div class="v">'+fmtRate(h.avg)+'</div><div class="l">AVG</div></div>'+
      '<div class="team-stat-tile-stat"><div class="v">'+(h.homeRuns||0)+'</div><div class="l">HR</div></div>'+
      '<div class="team-stat-tile-stat"><div class="v">'+fmtRate(h.ops)+'</div><div class="l">OPS</div></div>'+
      '<div class="team-stat-tile-stat"><div class="v">'+(h.runs||0)+'</div><div class="l">R</div></div>'+
      '</div></div>';
  }
  if(ts.pitching){
    var p=ts.pitching;
    html+='<div class="team-stat-tile"><div class="team-stat-tile-head"><span>🥎 Pitching</span></div>'+
      '<div class="team-stat-tile-grid">'+
      '<div class="team-stat-tile-stat"><div class="v">'+fmt(p.era,2)+'</div><div class="l">ERA</div></div>'+
      '<div class="team-stat-tile-stat"><div class="v">'+fmt(p.whip,2)+'</div><div class="l">WHIP</div></div>'+
      '<div class="team-stat-tile-stat"><div class="v">'+(p.strikeOuts||0)+'</div><div class="l">K</div></div>'+
      '<div class="team-stat-tile-stat"><div class="v">'+(p.saves||0)+'</div><div class="l">SV</div></div>'+
      '</div></div>';
  }
  if(ts.fielding){
    var f=ts.fielding;
    html+='<div class="team-stat-tile"><div class="team-stat-tile-head"><span>🧤 Fielding</span></div>'+
      '<div class="team-stat-tile-grid">'+
      '<div class="team-stat-tile-stat"><div class="v">'+fmtRate(f.fielding)+'</div><div class="l">FPCT</div></div>'+
      '<div class="team-stat-tile-stat"><div class="v">'+(f.errors||0)+'</div><div class="l">E</div></div>'+
      '<div class="team-stat-tile-stat"><div class="v">'+(f.doublePlays||0)+'</div><div class="l">DP</div></div>'+
      '<div class="team-stat-tile-stat"><div class="v">'+(f.assists||0)+'</div><div class="l">A</div></div>'+
      '</div></div>';
  }
  if(!html)html='<div class="empty-state" style="grid-column:1/-1">No team stats available</div>';
  stripEl.innerHTML=html;
  if(!formEl)return;
  var rec=ts.standingsRecord;
  if(rec&&rec.lastTen){
    var streakUp=rec.streak&&rec.streak.charAt(0)==='W';
    // Use last-10 run diff (computed from schedule+linescore) — the standings
    // endpoint's runDifferential is season-aggregate and was misread next to
    // "Last 10:". Fall back to omitting the chip when L10 diff isn't computable
    // rather than mixing scopes.
    var rd=ts.last10RunDiff;
    var rdStr=rd==null?'':' · run diff '+(rd>=0?'+':'')+rd;
    // v4.6.24: color the form line by L10 wins, not the current streak. A 9-1
    // team that lost last night should still read green; a 1-9 team that won
    // last night shouldn't suddenly look hot. Threshold: >5 warm, =5 neutral,
    // <5 cold.
    var l10w=rec.lastTenWins||0;
    var formClass=l10w>5?'':(l10w===5?' neutral':' cold');
    formEl.className='team-form-line'+formClass;
    formEl.innerHTML='<div><b style="color:#fff;">Last 10:</b> '+rec.lastTen+(rec.streak?' · '+(streakUp?'▲ ':'▼ ')+rec.streak:'')+rdStr+'</div><div class="form-meta">Form</div>';
  }else{
    formEl.className='team-form-line empty';
    formEl.innerHTML='<div>L10 form not yet available</div><div class="form-meta">Form</div>';
  }
}
