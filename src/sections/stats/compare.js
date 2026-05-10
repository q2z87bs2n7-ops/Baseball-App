// Stats — Compare overlay (head-to-head player view).
// Same-team comparison v1: pick another player from the active team's roster
// in the same group (hitting/pitching). Re-uses state.statsCache season stats
// — no extra fetches when both players are already in cache (the common case
// since fetchAllPlayerStats warms the entire roster on Stats first-load).
//
// Stat catalog mirrors the player overview tab so users see consistent
// comparison rows. Polarity-aware winner detection respects ERA/WHIP/etc.
// being lower-better.

import { state } from '../../state.js';
import { SEASON } from '../../config/constants.js';

// ── Sprint 3 / Step 6: Compare overlay (head-to-head player view) ────────
// Same-team comparison v1: pick another player from the active team's roster
// in the same group (hitting/pitching). Re-uses state.statsCache season stats
// — no extra fetches when both players are already in cache (the common case
// since fetchAllPlayerStats warms the entire roster on Stats first-load).
//
// Stat catalog: same boxes as renderOverviewTab so users see consistent
// comparison rows. Polarity-aware winner detection respects ERA/WHIP/etc.
// being lower-better.

function compareBoxesFor(group){
  // Subset of the Player Stats grid stats — winner-shown rows.
  if(group==='hitting') return [
    {l:'AVG', k:'avg',          fmt:'rate'},
    {l:'OBP', k:'obp',          fmt:'rate'},
    {l:'SLG', k:'slg',          fmt:'rate'},
    {l:'OPS', k:'ops',          fmt:'rate'},
    {l:'HR',  k:'homeRuns',     fmt:'int'},
    {l:'RBI', k:'rbi',          fmt:'int'},
    {l:'H',   k:'hits',         fmt:'int'},
    {l:'2B',  k:'doubles',      fmt:'int'},
    {l:'3B',  k:'triples',      fmt:'int'},
    {l:'R',   k:'runs',         fmt:'int'},
    {l:'BB',  k:'baseOnBalls',  fmt:'int'},
    {l:'K',   k:'strikeOuts',   fmt:'int',  lowerBetter:true},
    {l:'SB',  k:'stolenBases',  fmt:'int'},
    {l:'PA',  k:'plateAppearances', fmt:'int', neutral:true}
  ];
  return [
    {l:'ERA',  k:'era',                fmt:'two', lowerBetter:true},
    {l:'WHIP', k:'whip',               fmt:'two', lowerBetter:true},
    {l:'K',    k:'strikeOuts',         fmt:'int'},
    {l:'W',    k:'wins',               fmt:'int'},
    {l:'L',    k:'losses',             fmt:'int', lowerBetter:true},
    {l:'SV',   k:'saves',              fmt:'int'},
    {l:'IP',   k:'inningsPitched',     fmt:'ip',  neutral:true},
    {l:'K/9',  k:'strikeoutsPer9Inn',  fmt:'two'},
    {l:'BB/9', k:'walksPer9Inn',       fmt:'two', lowerBetter:true},
    {l:'K/BB', k:'strikeoutWalkRatio', fmt:'two'},
    {l:'H',    k:'hits',               fmt:'int', lowerBetter:true},
    {l:'BB',   k:'baseOnBalls',        fmt:'int', lowerBetter:true},
    {l:'HR',   k:'homeRuns',           fmt:'int', lowerBetter:true}
  ];
}

function compareFmt(box, val){
  if(val==null||val==='')return '—';
  if(box.fmt==='rate'){
    var n=parseFloat(val); if(isNaN(n))return String(val); var s=n.toFixed(3); return s.charAt(0)==='0'?s.slice(1):s;
  }
  if(box.fmt==='two'){
    var n=parseFloat(val); if(isNaN(n))return String(val); return n.toFixed(2);
  }
  if(box.fmt==='ip'){ return String(val); }
  var n=parseInt(val,10); return isNaN(n)?String(val):String(n);
}

// Pulls a player's season stat from state.statsCache (same-team only — v1
// scope). Returns null when the active team's cache hasn't filled yet or the
// player isn't on this team.
function compareStatFor(playerId, group){
  var pool=state.statsCache[group]||[];
  var entry=pool.find(function(p){return p.player&&p.player.id===playerId;});
  return entry&&entry.stat?entry.stat:null;
}

export function openCompareOverlay(){
  if(!state.selectedPlayer)return;
  // Determine group from active roster tab (hitting / pitching). Fielding
  // collapses to hitting for compare since the stat catalog is the same.
  var group=state.currentRosterTab==='pitching'?'pitching':'hitting';
  state.compareGroup=group;
  state.compareA=state.selectedPlayer;
  // Default slot B = next player in the same group's roster (skip A)
  var pool=state.rosterData[group]||[];
  var aId=state.selectedPlayer.person&&state.selectedPlayer.person.id;
  var b=pool.find(function(p){return p.person&&p.person.id!==aId;});
  state.compareB=b||null;
  state.compareOpen=true;
  var ov=document.getElementById('compareOverlay');
  if(ov)ov.removeAttribute('hidden');
  document.body.style.overflow='hidden';
  renderCompare();
}

export function closeCompareOverlay(){
  state.compareOpen=false;
  var ov=document.getElementById('compareOverlay');
  if(ov)ov.setAttribute('hidden','');
  document.body.style.overflow='';
}

export function setCompareSlot(slot, playerId){
  var pool=state.rosterData[state.compareGroup]||[];
  var pid=parseInt(playerId,10);
  var p=pool.find(function(pl){return pl.person&&pl.person.id===pid;});
  if(!p)return;
  if(slot==='a')state.compareA=p;
  else state.compareB=p;
  renderCompare();
}

export function setCompareGroup(group){
  if(group!=='hitting'&&group!=='pitching')return;
  if(state.compareGroup===group)return;
  state.compareGroup=group;
  // Re-pick defaults from the new group when current slots are not in the new pool
  var pool=state.rosterData[group]||[];
  function inPool(pl){ return pl && pl.person && pool.some(function(p){return p.person&&p.person.id===pl.person.id;}); }
  if(!inPool(state.compareA)) state.compareA = pool[0] || null;
  if(!inPool(state.compareB)){
    var aId=state.compareA&&state.compareA.person&&state.compareA.person.id;
    state.compareB = pool.find(function(p){return p.person&&p.person.id!==aId;}) || null;
  }
  renderCompare();
}

function renderCompare(){
  var bodyEl=document.getElementById('compareBody');
  if(!bodyEl)return;
  var group=state.compareGroup;
  var a=state.compareA, b=state.compareB;
  // Group toggle (only available when the other group has roster entries)
  var hasHitters=(state.rosterData.hitting||[]).length>0;
  var hasPitchers=(state.rosterData.pitching||[]).length>0;
  var groupBar=(hasHitters&&hasPitchers)?
    '<div class="compare-group-bar">'+
      ['hitting','pitching'].map(function(g){
        return '<button type="button" class="compare-group-btn'+(group===g?' active':'')+'" onclick="setCompareGroup(\''+g+'\')">'+(g==='hitting'?'⚾ Hitting':'🥎 Pitching')+'</button>';
      }).join('')+
    '</div>' : '';

  // Player picker option list — exclude the "other" slot's player to avoid
  // selecting the same player on both sides.
  function pickerOptions(otherId, selectedId){
    var pool=state.rosterData[group]||[];
    return pool.filter(function(p){return p.person&&p.person.id!==otherId;}).map(function(p){
      var sel = p.person.id === selectedId ? ' selected' : '';
      return '<option value="'+p.person.id+'"'+sel+'>'+(p.person.fullName||'#'+p.person.id)+'</option>';
    }).join('');
  }
  function slotHeader(slot, player, otherPlayer){
    var pid=player&&player.person&&player.person.id;
    var pname=player&&player.person&&player.person.fullName||'—';
    var pos=player&&player.position&&player.position.abbreviation||'';
    var jersey=player&&player.jerseyNumber?'#'+player.jerseyNumber:'';
    var headshot=pid?'<img class="compare-headshot" src="https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/'+pid+'/headshot/67/current" alt="">' : '<div class="compare-headshot compare-headshot-empty">?</div>';
    var otherId=otherPlayer&&otherPlayer.person&&otherPlayer.person.id;
    return '<div class="compare-slot">'+
      headshot+
      '<div class="compare-slot-name">'+pname+'</div>'+
      '<div class="compare-slot-meta">'+(jersey?jersey+' · ':'')+pos+'</div>'+
      '<select class="compare-picker" onchange="setCompareSlot(\''+slot+'\', this.value)">'+
        pickerOptions(otherId, pid)+
      '</select>'+
    '</div>';
  }

  var aStat=a?compareStatFor(a.person.id, group):null;
  var bStat=b?compareStatFor(b.person.id, group):null;

  var head =
    '<div class="compare-pickers">'+
      slotHeader('a', a, b)+
      '<div class="compare-vs">vs</div>'+
      slotHeader('b', b, a)+
    '</div>';

  if(!a || !b){
    bodyEl.innerHTML = groupBar + head + '<div class="compare-empty">Pick a second player to compare.</div>';
    return;
  }
  if(!aStat || !bStat){
    bodyEl.innerHTML = groupBar + head + '<div class="compare-empty">'+
      (!aStat ? (a.person.fullName||'Player A') : '')+
      (!aStat && !bStat ? ' and ' : '')+
      (!bStat ? (b.person.fullName||'Player B') : '')+
      ' have no '+SEASON+' '+group+' stats yet.</div>';
    return;
  }

  var boxes=compareBoxesFor(group);
  var rows=boxes.map(function(box){
    var av=aStat[box.k], bv=bStat[box.k];
    var aDisp=compareFmt(box, av);
    var bDisp=compareFmt(box, bv);
    var aN=parseFloat(av), bN=parseFloat(bv);
    var aClass='', bClass='';
    if(!box.neutral && !isNaN(aN) && !isNaN(bN) && aN !== bN){
      var aWins = box.lowerBetter ? aN < bN : aN > bN;
      aClass = aWins ? ' compare-win' : ' compare-lose';
      bClass = aWins ? ' compare-lose' : ' compare-win';
    }
    return '<div class="compare-row">'+
      '<div class="compare-cell'+aClass+'">'+aDisp+'</div>'+
      '<div class="compare-label">'+box.l+'</div>'+
      '<div class="compare-cell'+bClass+'">'+bDisp+'</div>'+
    '</div>';
  }).join('');

  bodyEl.innerHTML = groupBar + head +
    '<div class="compare-grid">'+rows+'</div>'+
    '<div class="compare-foot">Same-team comparison · season totals · winner highlighted per row (lower is better for ERA / WHIP / BB-9 / counting losses).</div>';
}
