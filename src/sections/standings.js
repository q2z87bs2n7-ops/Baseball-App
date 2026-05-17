// Standings section — division standings, Wild Card race for both leagues,
// full MLB standings, and the Home page's Division Snapshot card.
// One MLB API call to /standings hydrates all 5 renderers.

import { state } from '../state.js';
import { WC_SPOTS, MLB_BASE } from '../config/constants.js';

export async function loadStandings(){
  document.getElementById('nlEast').innerHTML='<div class="loading">Loading...</div>';
  try{
    const r=await fetch(MLB_BASE+'/standings?leagueId=103,104&standingsTypes=regularSeason&hydrate=team,division,league');
    const d=await r.json(),divMap={};
    (d.records||[]).forEach(function(rec){divMap[rec.division.id]={name:rec.division.name,league:rec.league.name,teams:rec.teamRecords};});
    renderDivStandings(divMap);renderNLWC(divMap);renderOtherDivWC(divMap);renderFullStandings(divMap);renderHomeStandings(divMap);
    document.getElementById('divTitle').textContent='🔥 '+state.activeTeam.division;
    document.getElementById('wcTitle').textContent='🃏 '+state.activeTeam.league+' Wild Card Race';
    document.getElementById('otherDivWCTitle').textContent='🃏 '+(state.activeTeam.league==='NL'?'AL':'NL')+' Wild Card Race';
    document.getElementById('homeDivTitle').textContent=state.activeTeam.division+' Snapshot';
  }catch(e){['nlEast','nlWC','otherDivWC','fullStandings','homeStandings'].forEach(function(id){const el=document.getElementById(id);if(el)el.innerHTML='<div class="error">Could not load standings</div>';});}
}

function standingsTable(teams){
  let html='<table class="standings-table"><thead><tr><th>#</th><th>Team</th><th>W</th><th>L</th><th>PCT</th><th>GB</th></tr></thead><tbody>';
  teams.forEach(function(t,i){const isActive=t.team.id===state.activeTeam.id;html+='<tr class="'+(isActive?'active-row':'')+'"><td>'+(i+1)+'</td><td><strong>'+t.team.teamName+'</strong></td><td>'+t.wins+'</td><td>'+t.losses+'</td><td>'+t.winningPercentage+'</td><td>'+t.gamesBack+'</td></tr>';});
  return html+'</tbody></table>';
}

function renderDivStandings(divMap){const f=Object.values(divMap).find(function(d){return d.name===state.activeTeam.division;});document.getElementById('nlEast').innerHTML=f?standingsTable(f.teams):'<div class="error">Division not found</div>';}

function renderNLWC(divMap){
  const league=state.activeTeam.league==='NL'?'National League':'American League';
  const leagueDivs=Object.values(divMap).filter(function(d){return d.league===league;});
  const leaders=new Set(leagueDivs.map(function(d){return d.teams[0]&&d.teams[0].team.id;}));
  let allLeague=[];leagueDivs.forEach(function(d){allLeague=allLeague.concat(d.teams);});
  const wc=allLeague.filter(function(t){return!leaders.has(t.team.id);}).sort(function(a,b){return parseFloat(b.winningPercentage)-parseFloat(a.winningPercentage);}).slice(0,9);
  const top=wc[0],topW=top?top.wins:0,topL=top?top.losses:0;
  let html='<table class="standings-table"><thead><tr><th>#</th><th>Team</th><th>W</th><th>L</th><th>PCT</th><th>GB</th></tr></thead><tbody>';
  wc.forEach(function(t,i){const isActive=t.team.id===state.activeTeam.id,gb=i===0?'—':(((topW-t.wins)+(t.losses-topL))/2).toFixed(1),cls=(isActive?'active-row':'')+(i===WC_SPOTS-1?' wc-cutoff-row':'');html+='<tr class="'+cls.trim()+'"><td>'+(i+1)+'</td><td><strong>'+t.team.teamName+'</strong></td><td>'+t.wins+'</td><td>'+t.losses+'</td><td>'+t.winningPercentage+'</td><td>'+gb+'</td></tr>';});
  html+='</tbody></table><div class="wc-cutoff-label">Wild Card cutoff</div>';
  document.getElementById('nlWC').innerHTML=html;
}

function renderOtherDivWC(divMap){
  const otherLeague=state.activeTeam.league==='NL'?'American League':'National League';
  const leagueDivs=Object.values(divMap).filter(function(d){return d.league===otherLeague;});
  const leaders=new Set(leagueDivs.map(function(d){return d.teams[0]&&d.teams[0].team.id;}));
  const teams=[];leagueDivs.forEach(function(d){d.teams.forEach(function(t){if(!leaders.has(t.team.id))teams.push(t);});});
  teams.sort(function(a,b){return parseFloat(b.winningPercentage)-parseFloat(a.winningPercentage);});
  const top=teams[0],topW=top?top.wins:0,topL=top?top.losses:0;
  let html='<table class="standings-table"><thead><tr><th>#</th><th>Team</th><th>W</th><th>L</th><th>PCT</th><th>GB</th></tr></thead><tbody>';
  teams.slice(0,9).forEach(function(t,i){const gb=i===0?'—':(((topW-t.wins)+(t.losses-topL))/2).toFixed(1),cls=i===WC_SPOTS-1?'wc-cutoff-row':'';html+='<tr class="'+cls+'"><td>'+(i+1)+'</td><td><strong>'+t.team.teamName+'</strong></td><td>'+t.wins+'</td><td>'+t.losses+'</td><td>'+t.winningPercentage+'</td><td>'+gb+'</td></tr>';});
  html+='</tbody></table><div class="wc-cutoff-label">Wild Card cutoff</div>';
  document.getElementById('otherDivWC').innerHTML=html;
}

function renderFullStandings(divMap){
  const al=Object.values(divMap).filter(function(d){return d.league==='American League';}),nl=Object.values(divMap).filter(function(d){return d.league==='National League';});
  const isNL=state.activeTeam.league==='NL',primary=isNL?nl:al,secondary=isNL?al:nl;
  const primarySorted=primary.slice().sort(function(a,b){return a.name===state.activeTeam.division?-1:b.name===state.activeTeam.division?1:0;});
  let html='';
  primarySorted.concat(secondary).forEach(function(div){
    if(div.name===state.activeTeam.division)return;
    html+='<div class="div-header">'+div.name+'</div><table class="standings-table"><thead><tr><th>Team</th><th>W</th><th>L</th><th>PCT</th><th>GB</th></tr></thead><tbody>';
    div.teams.forEach(function(t){const isActive=t.team.id===state.activeTeam.id;html+='<tr class="'+(isActive?'active-row':'')+'"><td><strong>'+t.team.teamName+'</strong></td><td>'+t.wins+'</td><td>'+t.losses+'</td><td>'+t.winningPercentage+'</td><td>'+t.gamesBack+'</td></tr>';});
    html+='</tbody></table>';
  });
  document.getElementById('fullStandings').innerHTML=html;
}

function renderHomeStandings(divMap){
  const f=Object.values(divMap).find(function(d){return d.name===state.activeTeam.division;});
  if(!f){document.getElementById('homeStandings').innerHTML='<div class="error">No data</div>';return;}
  let html='<table class="standings-table"><thead><tr><th>Team</th><th>W</th><th>L</th><th>GB</th></tr></thead><tbody>';
  f.teams.forEach(function(t){const isActive=t.team.id===state.activeTeam.id;html+='<tr class="'+(isActive?'active-row':'')+'"><td><strong>'+t.team.teamName+'</strong></td><td>'+t.wins+'</td><td>'+t.losses+'</td><td>'+t.gamesBack+'</td></tr>';});
  document.getElementById('homeStandings').innerHTML=html+'</tbody></table>';
}
