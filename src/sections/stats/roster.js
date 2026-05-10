// Stats — Roster (40-man player list with HOT/COLD badges + click-to-select).
// Loads /teams/{id}/roster, classifies each player into hitting/pitching/
// fielding buckets, fires fetchAllPlayerStats to warm state.statsCache, and
// renders the click-to-select list. Background fetchLastNForRoster populates
// state.lastNCache for HOT/COLD signal.

import { state } from '../../state.js';
import { SEASON, MLB_BASE } from '../../config/constants.js';
import { fmt, fmtRate } from '../../utils/format.js';
import { scrollTabIntoView, hotColdBadge, HOT_COLD_TTL_MS } from './_shared.js';
import { loadLeaders } from './leaders.js';
import { selectPlayer } from './player.js';

async function fetchAllPlayerStats(){
  var groups=['hitting','pitching'];
  for(var gi=0;gi<groups.length;gi++){
    var group=groups[gi],players=group==='hitting'?state.rosterData.hitting:state.rosterData.pitching;if(!players.length)continue;
    var results=await Promise.all(players.map(async function(p){try{var r=await fetch(MLB_BASE+'/people/'+p.person.id+'/stats?stats=season&season='+SEASON+'&group='+group);var d=await r.json();var stat=d.stats&&d.stats[0]&&d.stats[0].splits&&d.stats[0].splits[0]&&d.stats[0].splits[0].stat;if(!stat)return null;return{player:p.person,position:p.position,stat:stat};}catch(e){return null;}}));
    state.statsCache[group]=results.filter(function(x){return x!==null;});
  }
  loadLeaders();
  // Kick off last-15 fetches for HOT/COLD badges. Don't await — re-renders
  // happen as data lands.
  fetchLastNForRoster();
}

// Pulls last-15-games hitting stats for a single player. 12h TTL on
// state.lastNCache so we don't re-fetch within a session. Pitchers are
// excluded — HOT/COLD is an offensive concept tied to OPS.
async function fetchLastN(playerId, n){
  n = n || 15;
  var existing = state.lastNCache[playerId];
  if(existing && Date.now() - existing.ts < HOT_COLD_TTL_MS) return existing;
  try{
    var r = await fetch(MLB_BASE+'/people/'+playerId+'/stats?stats=lastXGames&group=hitting&season='+SEASON+'&gameNumber='+n);
    var d = await r.json();
    var stat = d.stats && d.stats[0] && d.stats[0].splits && d.stats[0].splits[0] && d.stats[0].splits[0].stat;
    if(stat){ state.lastNCache[playerId] = { last15: stat, ts: Date.now() }; return state.lastNCache[playerId]; }
  }catch(e){}
  return null;
}

// Batched fetch for every hitter in the active roster. After resolution, kick
// off a re-render so the badges appear without user interaction.
async function fetchLastNForRoster(){
  var hitters = state.rosterData.hitting || [];
  if(!hitters.length) return;
  await Promise.all(hitters.map(function(p){ return fetchLastN(p.person.id, 15); }));
  if(state.currentLeaderTab === 'hitting') loadLeaders();
  if(state.currentRosterTab === 'hitting') renderPlayerList();
}

export async function loadRoster(){
  document.getElementById('playerList').innerHTML='<div class="loading">Loading players...</div>';
  document.getElementById('rosterTitle').textContent=SEASON+' '+state.activeTeam.short+' Players';
  try{
    var r=await fetch(MLB_BASE+'/teams/'+state.activeTeam.id+'/roster?rosterType=40Man&season='+SEASON+'&hydrate=person');
    var d=await r.json(),roster=d.roster||[];
    // Two-way players (TWP) like Ohtani belong in BOTH lists — they qualify
    // as both hitters and pitchers, so they should appear in both Leaders
    // boards + Roster groups + Today's Leaders. Pure pitchers ('P') are
    // hitting-excluded only; pure position players ('1B','OF',etc.) are
    // pitching-excluded.
    state.rosterData.hitting=roster.filter(function(p){return p.position&&p.position.abbreviation!=='P';});
    state.rosterData.pitching=roster.filter(function(p){return p.position&&(p.position.abbreviation==='P'||p.position.abbreviation==='TWP');});
    state.rosterData.fielding=state.rosterData.hitting.slice();renderPlayerList();fetchAllPlayerStats();
    if(state.rosterData.hitting.length)selectPlayer(state.rosterData.hitting[0].person.id,'hitting');
  }catch(e){document.getElementById('playerList').innerHTML='<div class="error">Could not load players</div>';}
}

// Position bucketing for Roster grouping. Catchers / Infielders / Outfielders
// / DH for hitters and fielders; Starters vs Relievers for pitchers (split by
// games-started ratio in statsCache when available, falls back to a single
// "Pitchers" bucket otherwise).
function rosterBucketKey(player, tab){
  if(tab==='pitching'){
    var entry=(state.statsCache.pitching||[]).find(function(p){return p.player&&p.player.id===player.person.id;});
    if(entry&&entry.stat){
      var gs=parseInt(entry.stat.gamesStarted,10)||0;
      var gp=parseInt(entry.stat.gamesPlayed,10)||0;
      if(gs>=3 || (gp>0 && gs/gp >= 0.5)) return 'SP';
      return 'RP';
    }
    return 'P';
  }
  var abbr=player.position&&player.position.abbreviation||'';
  if(abbr==='C') return 'C';
  if(abbr==='1B'||abbr==='2B'||abbr==='3B'||abbr==='SS'||abbr==='IF') return 'IF';
  if(abbr==='LF'||abbr==='CF'||abbr==='RF'||abbr==='OF') return 'OF';
  if(abbr==='DH') return 'DH';
  return 'OTH';
}

const ROSTER_BUCKET_ORDER = {
  hitting:  ['C','IF','OF','DH','OTH'],
  fielding: ['C','IF','OF','DH','OTH'],
  pitching: ['SP','RP','P']
};
const ROSTER_BUCKET_LABEL = {
  C:  '🧤 Catchers',
  IF: '⚾ Infielders',
  OF: '🏃 Outfielders',
  DH: '🦾 DH',
  SP: '🎯 Starters',
  RP: '🔥 Relievers',
  P:  '🥎 Pitchers',
  OTH:'➖ Other'
};

// Returns { display, raw } for the inline-stat preview under each roster name,
// keyed off the active leader pill so the Roster column reflects the current
// stat focus. Falls back to OPS/ERA when no pill is active.
function rosterInlineStatFor(player, tab){
  var group=tab==='fielding'?'hitting':tab; // fielding tab still surfaces hitting line
  var pool=state.statsCache[group]||[];
  var entry=pool.find(function(p){return p.player&&p.player.id===player.person.id;});
  if(!entry||!entry.stat)return null;
  var s=entry.stat;
  if(group==='hitting'){
    return{
      display:fmtRate(s.avg)+' / '+(s.homeRuns||0)+' HR / '+fmtRate(s.ops)+' OPS',
      raw:parseFloat(s.ops)
    };
  }
  return{
    display:fmt(s.era,2)+' ERA · '+(s.strikeOuts||0)+' K · '+fmt(s.whip,2)+' WHIP',
    raw:parseFloat(s.era)
  };
}

// Team-best raw value for the inline mini-bar denominator. OPS for hitting
// (higher = better), ERA for pitching (lower = better — bar widths are
// inverted in the renderer).
function rosterTeamBest(group){
  var pool=state.statsCache[group]||[];
  if(!pool.length)return null;
  var key=group==='pitching'?'era':'ops';
  var values=pool.map(function(p){return p.stat?parseFloat(p.stat[key]):NaN;}).filter(function(v){return !isNaN(v);});
  if(!values.length)return null;
  return group==='pitching'?Math.min.apply(null,values):Math.max.apply(null,values);
}

export function renderPlayerList(){
  var tab=state.currentRosterTab;
  var players=state.rosterData[tab]||[];
  if(!players.length){document.getElementById('playerList').innerHTML='<div class="loading">No players found</div>';return;}
  var showBadges=tab==='hitting';
  var statGroup=tab==='fielding'?'hitting':tab;
  var teamBest=rosterTeamBest(statGroup);
  // Bucket players by position
  var buckets={};
  players.forEach(function(p){
    var k=rosterBucketKey(p,tab);
    (buckets[k]=buckets[k]||[]).push(p);
  });
  var order=ROSTER_BUCKET_ORDER[tab]||['OTH'];
  var html='';
  order.forEach(function(key){
    var list=buckets[key];
    if(!list||!list.length)return;
    html+='<div class="roster-section-header">'+(ROSTER_BUCKET_LABEL[key]||key)+' <span class="roster-section-count">'+list.length+'</span></div>';
    list.forEach(function(p){
      var sel=state.selectedPlayer&&state.selectedPlayer.person&&state.selectedPlayer.person.id===p.person.id;
      var badge=showBadges?hotColdBadge(p.person.id):'';
      var inline=rosterInlineStatFor(p,tab);
      var barW=0;
      if(inline && teamBest){
        if(statGroup==='pitching') barW = isFinite(teamBest/inline.raw) ? Math.min(100,Math.max(8,(teamBest/inline.raw)*100)) : 0;
        else barW = isFinite(inline.raw/teamBest) ? Math.min(100,Math.max(8,(inline.raw/teamBest)*100)) : 0;
      }
      html+='<div class="player-item'+(sel?' selected':'')+'" onclick="selectPlayer('+p.person.id+',\''+tab+'\')">'+
        '<div class="roster-row-main">'+
          '<div class="player-name">'+p.person.fullName+badge+'</div>'+
          '<div class="player-pos">#'+(p.jerseyNumber||'—')+' · '+(p.position&&p.position.name?p.position.name:'—')+
            (inline?' · <span class="roster-inline-stat">'+inline.display+'</span>':'')+
          '</div>'+
          (barW?'<div class="roster-mini-bar"><i style="width:'+barW.toFixed(0)+'%"></i></div>':'')+
        '</div>'+
        '<span class="player-chevron">›</span>'+
      '</div>';
    });
  });
  document.getElementById('playerList').innerHTML=html;
}

export function switchRosterTab(tab,btn){state.currentRosterTab=tab;state.selectedPlayer=null;document.querySelectorAll('.stat-tab').forEach(function(b){b.classList.remove('active');});btn.classList.add('active');scrollTabIntoView(btn);var players=state.rosterData[tab]||[];if(players.length)selectPlayer(players[0].person.id,tab);else{renderPlayerList();document.getElementById('playerStatsTitle').textContent='Player Stats';document.getElementById('playerStats').innerHTML='<div class="empty-state">No players available</div>';}}
