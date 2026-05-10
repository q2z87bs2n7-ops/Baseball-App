// Leaders card on the Stats tab — top-10 by selected stat for hitting/pitching,
// with qualified-only filter and "+ more" overflow pills.
//
// Reads state.statsCache (populated by roster.js#fetchAllPlayerStats) and
// state.teamStats (populated by team.js#loadTeamStats).

import { state } from '../../state.js';
import { scrollTabIntoView, hotColdBadge } from './_shared.js';

export function selectLeaderPill(group,stat,btn){
  var ids=group==='hitting'?['hitLeaderPills','hitLeaderPillsExtras']:['pitLeaderPills','pitLeaderPillsExtras'];
  ids.forEach(function(id){var el=document.getElementById(id);if(el)el.querySelectorAll('.leader-pill').forEach(function(b){b.classList.remove('active');});});
  btn.classList.add('active');
  loadLeaders();
}

export function switchLeaderTab(tab,btn){
  state.currentLeaderTab=tab;
  document.querySelectorAll('.stat-tabs button').forEach(function(b){b.classList.remove('active');});
  btn.classList.add('active');
  scrollTabIntoView(btn);
  document.getElementById('hitLeaderPills').style.display=tab==='hitting'?'flex':'none';
  document.getElementById('pitLeaderPills').style.display=tab==='pitching'?'flex':'none';
  // Collapse BOTH extras rows + reset "+ more" pills when switching tabs.
  ['hitLeaderPillsExtras','pitLeaderPillsExtras'].forEach(function(id){
    var el=document.getElementById(id);
    if(el)el.setAttribute('hidden','');
  });
  document.querySelectorAll('.leader-pill--more').forEach(function(b){
    b.classList.remove('open');
    b.setAttribute('aria-expanded','false');
    b.textContent='+ more';
  });
  loadLeaders();
}

// Qualified-leader thresholds (per Idea #05, Sprint 1):
//   Hitters: PA ≥ 3.1 × team games played
//   Pitchers: IP ≥ 1.0 × team games played
// Pulled from state.teamStats.{hitting,pitching}.gamesPlayed when available.
function teamGamesFor(group){
  var ts=state.teamStats||{};
  var src=group==='pitching'?ts.pitching:ts.hitting;
  if(!src)return 0;
  var g=parseInt(src.gamesPlayed,10);
  return isNaN(g)?0:g;
}

function isQualified(group, stat){
  var g=teamGamesFor(group);
  if(!g)return true; // unknown → don't filter
  if(group==='hitting'){
    var pa=parseFloat(stat.plateAppearances);
    return !isNaN(pa) && pa >= 3.1 * g;
  }
  if(group==='pitching'){
    var ip=parseFloat(stat.inningsPitched);
    return !isNaN(ip) && ip >= 1.0 * g;
  }
  return true;
}

export function loadLeaders(){
  var group=state.currentLeaderTab;
  var rowSel=group==='hitting'?'#hitLeaderPills, #hitLeaderPillsExtras':'#pitLeaderPills, #pitLeaderPillsExtras';
  var activePill=document.querySelector(rowSel.split(',').map(function(s){return s.trim()+' .leader-pill.active';}).join(','));
  var stat=activePill?activePill.dataset.stat:(group==='hitting'?'avg':'era');
  var data=state.statsCache[group];
  if(!data||!data.length){document.getElementById('leaderList').innerHTML='<div style="color:var(--muted);padding:12px;font-size:.85rem">Stats still loading...</div>';return;}
  var isAsc=['era','whip','walksAndHitsPerInningPitched','walksPer9Inn','losses'].indexOf(stat)>-1;
  // Pre-filter: stat must have a value at all
  var withStat=data.filter(function(s){return s.stat[stat]!=null&&s.stat[stat]!=='';});
  // Apply qualified filter (default ON per kickoff Q4)
  var qualified=state.qualifiedOnly?withStat.filter(function(s){return isQualified(group,s.stat);}):withStat;
  var hiddenCount=withStat.length-qualified.length;
  var sorted=qualified.slice().sort(function(a,b){return isAsc?parseFloat(a.stat[stat])-parseFloat(b.stat[stat]):parseFloat(b.stat[stat])-parseFloat(a.stat[stat]);}).slice(0,10);
  if(!sorted.length){
    var emptyMsg=hiddenCount>0
      ? hiddenCount+' player(s) hidden by qualified filter — toggle off to show'
      : 'No data for this stat yet';
    document.getElementById('leaderList').innerHTML='<div style="color:var(--muted);padding:12px;font-size:.85rem">'+emptyMsg+'</div>';
    return;
  }
  var html='';
  sorted.forEach(function(s,i){
    var val=parseFloat(s.stat[stat]),display=val<1&&val>0?val.toFixed(3).slice(1):Number.isInteger(val)?val:val.toFixed(2);
    var badge=group==='hitting'?hotColdBadge(s.player.id):'';
    html+='<div class="player-item" onclick="selectPlayer('+s.player.id+',\''+group+'\')">'+
      '<div style="display:flex;align-items:center;gap:10px">'+
        '<span style="color:var(--accent);font-weight:800;width:18px;font-size:.85rem">'+(i+1)+'</span>'+
        '<div>'+
          '<div class="player-name" style="font-size:.85rem">'+(s.player.fullName||'—')+badge+'</div>'+
        '</div>'+
      '</div>'+
      '<div style="font-size:1.1rem;font-weight:800;color:var(--accent)">'+display+'</div>'+
    '</div>';
  });
  if(state.qualifiedOnly && hiddenCount>0){
    html+='<div class="leader-qual-footer">⚠ '+hiddenCount+' player'+(hiddenCount===1?'':'s')+' hidden · toggle off to show small samples</div>';
  }
  document.getElementById('leaderList').innerHTML=html;
}

// Show / hide the "+ more" overflow pill row for a leader group. Adds an
// 'open' class to the trigger so CSS can flip the dashed border to solid.
export function toggleLeaderMore(group,btn){
  var extrasId=group==='hitting'?'hitLeaderPillsExtras':'pitLeaderPillsExtras';
  var el=document.getElementById(extrasId);
  if(!el)return;
  var isOpen=!el.hasAttribute('hidden');
  if(isOpen){el.setAttribute('hidden','');btn.classList.remove('open');btn.setAttribute('aria-expanded','false');btn.textContent='+ more';}
  else{el.removeAttribute('hidden');btn.classList.add('open');btn.setAttribute('aria-expanded','true');btn.textContent='− less';}
}

// Toggle the qualified-only filter. Persisted to localStorage.
export function toggleQualifiedOnly(){
  state.qualifiedOnly=!state.qualifiedOnly;
  if(typeof localStorage!=='undefined')localStorage.setItem('mlb_stats_qualified_only',state.qualifiedOnly?'1':'0');
  // Re-paint toggle UI + leaders
  var sw=document.getElementById('qualifiedToggle');
  if(sw)sw.setAttribute('aria-checked',state.qualifiedOnly?'true':'false');
  if(sw)sw.classList.toggle('on',state.qualifiedOnly);
  loadLeaders();
}
