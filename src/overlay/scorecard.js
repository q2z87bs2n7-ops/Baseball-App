// Old-school scorecard overlay — renders a baseball scoring-book view of a
// game (live or completed) from the MLB feed/live payload: a diamond per
// plate appearance, batting-order rows, inning columns, fielder notation
// (6-3, F8, K/ꓘ), traced base paths, and per-inning R/H/E.
import { state } from '../state.js';
import { MLB_BASE_V1_1, TIMING } from '../config/constants.js';

var refreshTimer = null;

function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// MLB defensive position code → traditional scorebook number.
var POS = { '1':'1','2':'2','3':'3','4':'4','5':'5','6':'6','7':'7','8':'8','9':'9','10':'DH' };

// Non-plate-appearance event types: these never produce a scorecard cell
// (they happen mid-AB or between batters), but still feed runner advancement.
var NON_PA = {
  stolen_base:1, stolen_base_2b:1, stolen_base_3b:1, stolen_base_home:1,
  caught_stealing:1, caught_stealing_2b:1, caught_stealing_3b:1, caught_stealing_home:1,
  pickoff_1b:1, pickoff_2b:1, pickoff_3b:1,
  pickoff_caught_stealing_2b:1, pickoff_caught_stealing_3b:1, pickoff_caught_stealing_home:1,
  pickoff_error_1b:1, pickoff_error_2b:1, pickoff_error_3b:1,
  wild_pitch:1, passed_ball:1, balk:1, defensive_indiff:1, other_advance:1,
  runner_placed:1, defensive_substitution:1, offensive_substitution:1,
  pitching_substitution:1, defensive_switch:1, injury:1, ejection:1, game_advisory:1
};

function fielderChain(play){
  // Ordered fielder-number chain from credits, preserving fielding sequence
  // so rundowns like 1-3-6-3 keep their repeats. Only *consecutive*
  // duplicates collapse, so a 6-4-3 DP doesn't print the shared pivot twice.
  var seq = [];
  (play.runners||[]).forEach(function(r){
    (r.credits||[]).forEach(function(c){
      if(c.credit!=='f_putout' && c.credit!=='f_assist') return;
      var num = POS[c.position && c.position.code] || '';
      if(num && seq[seq.length-1]!==num) seq.push(num);
    });
  });
  return seq;
}

function errorPos(play){
  var p='';
  (play.runners||[]).forEach(function(r){
    (r.credits||[]).forEach(function(c){
      if(c.credit==='f_error' && !p) p = POS[c.position && c.position.code]||'';
    });
  });
  return p;
}

// Translate a completed play into a scorecard cell descriptor.
function notatePlay(play){
  var et = (play.result && play.result.eventType) || '';
  var desc = (play.result && play.result.description) || '';
  var d = desc.toLowerCase();
  var chain = fielderChain(play);
  var out = { code:'', hit:false, out:false };

  if(et==='strikeout' || et==='strikeout_double_play'){
    out.code = /called/.test(d) ? 'ꓘ' : 'K';
    out.out = true;
  } else if(et==='walk'){ out.code='BB'; }
  else if(et==='intent_walk'){ out.code='IBB'; }
  else if(et==='hit_by_pitch'){ out.code='HBP'; }
  else if(et==='single'){ out.code='1B'; out.hit=true; }
  else if(et==='double'){ out.code='2B'; out.hit=true; }
  else if(et==='triple'){ out.code='3B'; out.hit=true; }
  else if(et==='home_run'){ out.code='HR'; out.hit=true; }
  else if(et==='field_error'){ out.code='E'+(errorPos(play)||''); }
  else if(et==='catcher_interf'){ out.code='CI'; }
  else if(et==='sac_fly' || et==='sac_fly_double_play'){ out.code='SF'+(chain[chain.length-1]||''); out.out=true; }
  else if(et==='sac_bunt' || et==='sac_bunt_double_play'){ out.code='SAC '+chain.join('-'); out.out=true; }
  else if(et==='fielders_choice' || et==='fielders_choice_out'){ out.code='FC'+(chain.length?' '+chain.join('-'):''); out.out=true; }
  else if(et==='field_out' || et==='force_out' || et==='grounded_into_double_play'
        || et==='double_play' || et==='triple_play' || et==='other_out'){
    out.out = true;
    var pre = /lines? out|lined out/.test(d) ? 'L'
            : /pop|popped/.test(d) ? 'P'
            : /fl(?:y|ies|ied)|flyball/.test(d) ? 'F'
            : '';
    if(pre==='L' || pre==='P' || pre==='F'){
      out.code = pre + (chain[chain.length-1]||'');
    } else {
      out.code = chain.join('-') || 'OUT';
    }
    if(et==='grounded_into_double_play' || et==='double_play') out.code += ' DP';
    if(et==='triple_play') out.code += ' TP';
  } else {
    out.code = (play.result && play.result.event) ? play.result.event : (et||'—');
  }
  return out;
}

function baseToNum(b){ return b==='1B'?1 : b==='2B'?2 : b==='3B'?3 : b==='score'?4 : 0; }

// Build the full scorecard model from a feed/live payload.
function buildModel(feed){
  var gd = feed.gameData||{}, ld = feed.liveData||{};
  var ls = ld.linescore||{};
  var box = ld.boxscore && ld.boxscore.teams ? ld.boxscore.teams : {};
  var plays = (ld.plays && ld.plays.allPlays) ? ld.plays.allPlays : [];
  var innCount = Math.max(ls.scheduledInnings || 9, (ls.innings||[]).length, ls.currentInning||0);

  function teamModel(sideKey){
    var t = box[sideKey]||{}, players = t.players||{};
    var slots = {}; // slot number → [player rows]
    Object.keys(players).forEach(function(pid){
      var p = players[pid];
      if(p.battingOrder==null) return;
      var ord = parseInt(p.battingOrder,10);
      var slot = Math.floor(ord/100);
      (slots[slot]=slots[slot]||[]).push({
        id: p.person.id,
        name: p.person.fullName,
        pos: (p.position && p.position.abbreviation) || '',
        order: ord,
        cells: {} // inning → cell
      });
    });
    Object.keys(slots).forEach(function(s){ slots[s].sort(function(a,b){return a.order-b.order;}); });
    var pitchers = (t.pitchers||[]).map(function(pid){
      var p = players['ID'+pid]||{}, st = (p.stats && p.stats.pitching)||{};
      return { name:(p.person&&p.person.fullName)||'', line:st };
    });
    return { slots:slots, pitchers:pitchers, info:{} };
  }

  var away = teamModel('away'), home = teamModel('home');
  function rowFor(model,batterId){
    var found=null;
    Object.keys(model.slots).forEach(function(s){
      model.slots[s].forEach(function(r){ if(r.id===batterId) found=r; });
    });
    return found;
  }

  var activePA = {}; // runnerId → cell still live on the bases

  plays.forEach(function(play){
    if(!(play.about && play.about.isComplete)) return;
    var et = (play.result && play.result.eventType) || '';
    var isPA = !NON_PA[et];
    var half = play.about.halfInning; // 'top' | 'bottom'
    var inn = play.about.inning;
    var model = half==='top' ? away : home;
    var batterId = play.matchup && play.matchup.batter && play.matchup.batter.id;

    if(isPA){
      var row = rowFor(model, batterId);
      var n = notatePlay(play);
      var br = (play.runners||[]).filter(function(r){
        return r.details && r.details.runner && r.details.runner.id===batterId
            && (r.movement.start==null || r.movement.originBase==null);
      })[0];
      var reached = br ? baseToNum(br.movement.end) : 0;
      var batterOut = br ? !!br.movement.isOut : n.out;
      var cell = {
        code: n.code, hit:n.hit, out:batterOut,
        rbi: (play.result && play.result.rbi) || 0,
        reached: reached>=4 ? 3 : reached, // base path drawn up to 3B; scored handled by flag
        scored: reached===4,
        // Authoritative post-play out total (the batter's out is the
        // trailing out on virtually every PA), not a hand-rolled tally.
        outNum: batterOut ? ((play.count && play.count.outs) || 0) : 0
      };
      if(row) row.cells[inn] = cell;
      // Close any prior PA for this batter (can't be on base twice), then
      // mark this one live if the batter reached base and is still running.
      delete activePA[batterId];
      if(reached>=1 && reached<4 && !batterOut && !cell.scored) activePA[batterId] = cell;
    }

    // Runner advancement applies on every play — PA and non-PA (SB, WP,
    // PB, balk, etc.) alike — so live runners' base paths stay correct.
    (play.runners||[]).forEach(function(r){
      var rid = r.details && r.details.runner && r.details.runner.id;
      if(rid===batterId) return;
      var pa = activePA[rid];
      if(!pa) return;
      if(r.movement && r.movement.isOut){ delete activePA[rid]; return; }
      var endN = baseToNum(r.movement && r.movement.end);
      if(endN===4){ pa.scored=true; pa.reached=3; delete activePA[rid]; }
      else if(endN>=1 && endN>pa.reached){ pa.reached=Math.min(3,endN); }
    });
  });

  function lineTotals(side){
    var tt = (ls.teams && ls.teams[side]) || {};
    return { r:tt.runs!=null?tt.runs:'—', h:tt.hits!=null?tt.hits:'—', e:tt.errors!=null?tt.errors:'—' };
  }
  function inningRuns(side){
    return (ls.innings||[]).map(function(i){ return (i[side]&&i[side].runs!=null)?i[side].runs:''; });
  }

  var at = gd.teams && gd.teams.away ? gd.teams.away : {};
  var ht = gd.teams && gd.teams.home ? gd.teams.home : {};
  return {
    innCount: innCount,
    status: (gd.status && gd.status.detailedState) || '',
    isLive: gd.status && gd.status.abstractGameState==='Live',
    dateStr: gd.datetime && gd.datetime.officialDate || '',
    away: { name:(at.teamName||at.name||'Away'), model:away, totals:lineTotals('away'), inn:inningRuns('away') },
    home: { name:(ht.teamName||ht.name||'Home'), model:home, totals:lineTotals('home'), inn:inningRuns('home') }
  };
}

// ── Rendering ──────────────────────────────────────────────────────────────

function diamondSVG(cell){
  // viewBox 0..60; home(30,58) 1B(58,30) 2B(30,2) 3B(2,30)
  var H='30,58', B1='58,30', B2='30,2', B3='2,30';
  var path = ['M30,58 L58,30','M58,30 L30,2','M30,2 L2,30','M2,30 L30,58'];
  var s = '<svg viewBox="0 0 60 60" width="56" height="56" style="display:block">';
  s += '<polygon points="'+B2+' '+B1+' '+H+' '+B3+'" fill="none" stroke="var(--border)" stroke-width="1.5"/>';
  if(cell.scored) s += '<polygon points="'+B2+' '+B1+' '+H+' '+B3+'" fill="var(--accent)" fill-opacity="0.28"/>';
  var seg = cell.scored ? 4 : (cell.reached||0);
  for(var i=0;i<seg;i++){
    s += '<path d="'+path[i]+'" stroke="var(--accent)" stroke-width="3" stroke-linecap="round" fill="none"/>';
  }
  // bases as small marks
  [B1,B2,B3].forEach(function(pt,idx){
    var on = (idx+1) <= (cell.scored?3:cell.reached);
    s += '<circle cx="'+pt.split(',')[0]+'" cy="'+pt.split(',')[1]+'" r="2.6" fill="'+(on?'var(--accent)':'var(--border)')+'"/>';
  });
  if(cell.outNum) s += '<text x="49" y="13" font-size="9" fill="var(--muted)" text-anchor="middle">'+cell.outNum+'</text>';
  if(cell.rbi) s += '<text x="11" y="13" font-size="8" fill="var(--accent)" text-anchor="middle">'+cell.rbi+(cell.rbi>1?'R':'·')+'</text>';
  var col = cell.hit ? 'var(--accent)' : (cell.out ? 'var(--muted)' : 'var(--text)');
  s += '<text x="30" y="38" font-size="11" font-weight="700" fill="'+col+'" text-anchor="middle">'+esc(cell.code)+'</text>';
  s += '</svg>';
  return s;
}

function emptyCell(){
  return '<svg viewBox="0 0 60 60" width="56" height="56" style="display:block;opacity:.25">'
       + '<polygon points="30,2 58,30 30,58 2,30" fill="none" stroke="var(--border)" stroke-width="1"/></svg>';
}

function renderTeamTable(team, innCount){
  var slots = team.model.slots;
  var slotNums = Object.keys(slots).map(Number).sort(function(a,b){return a-b;});
  var th = '<th class="sc-name">'+esc(team.name)+'</th>';
  for(var i=1;i<=innCount;i++) th += '<th>'+i+'</th>';
  th += '<th class="sc-rhe">R</th><th class="sc-rhe">H</th><th class="sc-rhe">E</th>';

  var body = '';
  slotNums.forEach(function(sn){
    slots[sn].forEach(function(row, subIdx){
      body += '<tr>';
      body += '<td class="sc-name"><span class="sc-ord">'+(subIdx===0?sn:'')+'</span>'
            + '<span class="sc-pn">'+esc(row.name)+'</span>'
            + '<span class="sc-pos">'+esc(row.pos)+'</span></td>';
      for(var inn=1;inn<=innCount;inn++){
        var c = row.cells[inn];
        body += '<td class="sc-cell">'+(c?diamondSVG(c):emptyCell())+'</td>';
      }
      if(subIdx===0){
        var tot = team.totals;
        body += '<td class="sc-rhe">'+tot.r+'</td><td class="sc-rhe">'+tot.h+'</td><td class="sc-rhe">'+tot.e+'</td>';
      } else {
        body += '<td class="sc-rhe"></td><td class="sc-rhe"></td><td class="sc-rhe"></td>';
      }
      body += '</tr>';
    });
  });

  // per-inning runs strip
  var runsRow = '<tr class="sc-runs"><td class="sc-name">Runs</td>';
  for(var k=0;k<innCount;k++) runsRow += '<td>'+(team.inn[k]!=null?team.inn[k]:'')+'</td>';
  runsRow += '<td class="sc-rhe"></td><td class="sc-rhe"></td><td class="sc-rhe"></td></tr>';

  var pit = '';
  if(team.model.pitchers.length){
    pit = '<div class="sc-pitchers"><b>Pitchers:</b> ' + team.model.pitchers.map(function(p){
      var L = p.line||{};
      return esc(p.name)+' ('+(L.inningsPitched||'0.0')+' IP, '+(L.hits!=null?L.hits:0)+'H, '
           + (L.runs!=null?L.runs:0)+'R, '+(L.earnedRuns!=null?L.earnedRuns:0)+'ER, '
           + (L.baseOnBalls!=null?L.baseOnBalls:0)+'BB, '+(L.strikeOuts!=null?L.strikeOuts:0)+'K)';
    }).join(' · ') + '</div>';
  }

  return '<div class="sc-team"><div class="sc-scroll"><table class="sc-table"><thead><tr>'
       + th + '</tr></thead><tbody>' + body + runsRow + '</tbody></table></div>' + pit + '</div>';
}

function renderInto(model){
  var card = document.getElementById('scorecardCard');
  if(!card) return;
  var live = model.isLive ? '<span class="sc-live">● LIVE</span> ' : '';
  card.innerHTML =
    '<div class="sc-head">'
    + '<div><div class="sc-title">'+esc(model.away.name)+' @ '+esc(model.home.name)+'</div>'
    + '<div class="sc-sub">'+live+esc(model.status)+(model.dateStr?' · '+esc(model.dateStr):'')+'</div></div>'
    + '<button class="sc-close" onclick="closeScorecardOverlay()" aria-label="Close">✕</button></div>'
    + '<div class="sc-legend">⚾ Old-school scorecard · diamond = plate appearance · filled = run scored · '
    + '6-3 / F8 = fielder out · K swinging · ꓘ called</div>'
    + renderTeamTable(model.away, model.innCount)
    + renderTeamTable(model.home, model.innCount);
}

function setMsg(msg){
  var card = document.getElementById('scorecardCard');
  if(card) card.innerHTML = '<div class="sc-head"><div class="sc-title">Scorecard</div>'
    + '<button class="sc-close" onclick="closeScorecardOverlay()" aria-label="Close">✕</button></div>'
    + '<div class="sc-msg">'+esc(msg)+'</div>';
}

async function loadScorecard(){
  var gamePk = state.scorecardGamePk;
  if(!gamePk) return;
  try{
    var res = await fetch(MLB_BASE_V1_1+'/game/'+gamePk+'/feed/live');
    if(!res.ok) throw new Error('HTTP '+res.status);
    var feed = await res.json();
    if(state.scorecardGamePk!==gamePk || !state.scorecardOverlayOpen) return;
    state.scorecardModel = buildModel(feed);
    renderInto(state.scorecardModel);
  }catch(e){
    if(state.scorecardOverlayOpen) setMsg('Could not load scorecard data.');
  }
}

export function openScorecardOverlay(gamePk){
  var el = document.getElementById('scorecardOverlay');
  if(!el) return;
  state.scorecardOverlayOpen = true;
  state.scorecardGamePk = gamePk;
  el.style.display = 'flex';
  setMsg('Loading scorecard…');
  loadScorecard();
  if(refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(function(){
    if(state.scorecardOverlayOpen && state.scorecardModel && state.scorecardModel.isLive) loadScorecard();
  }, TIMING.LIVE_REFRESH_MS);
}

export function closeScorecardOverlay(){
  var el = document.getElementById('scorecardOverlay');
  state.scorecardOverlayOpen = false;
  state.scorecardGamePk = null;
  state.scorecardModel = null;
  if(refreshTimer){ clearInterval(refreshTimer); refreshTimer = null; }
  if(el) el.style.display = 'none';
}
