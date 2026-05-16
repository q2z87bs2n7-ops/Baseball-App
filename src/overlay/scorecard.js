// Old-school scorecard overlay — renders a baseball scoring-book view of a
// game (live or completed) from the MLB feed/live payload: a line-score
// header, a diamond per plate appearance with traced base paths, fielder
// notation (6-3, F8, K/ꓘ), in-cell ball-strike/pitch count, inning-ending
// diagonals, advancement reason codes (WP/PB/BK/SB/E), runner-out markers
// (CS/PO), batting-around stacking, Manfred runner (MR) handling,
// substitution markers (PH/PR), and a full pitcher table with W/L/S.
//
// Runner tracking is BASE-keyed (which batter's run currently occupies 1B/
// 2B/3B), not runner-id-keyed — so pinch-runners inherit the base correctly
// and a run is always credited to the batter who started it.
import { state } from '../state.js';
import { MLB_BASE_V1_1, TIMING } from '../config/constants.js';

var refreshTimer = null;

function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// MLB defensive position code → traditional scorebook number.
var POS = { '1':'1','2':'2','3':'3','4':'4','5':'5','6':'6','7':'7','8':'8','9':'9','10':'DH' };

// Non-plate-appearance event types: never produce a cell (they happen
// mid-AB or between batters) but still drive runner advancement.
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

// Why a runner moved (annotated on the base path), keyed by event type.
function advReason(et){
  if(!et) return '';
  if(et.indexOf('stolen_base')===0) return 'SB';
  if(et==='wild_pitch') return 'WP';
  if(et==='passed_ball') return 'PB';
  if(et==='balk') return 'BK';
  if(et==='defensive_indiff') return 'DI';
  if(et==='field_error' || et==='error') return 'E';
  return '';
}

// Per-runner movement reason — read from the runner's own details, which
// is reliable even when the steal/WP/etc. happens mid-at-bat (the play's
// result.eventType is the at-bat's, not the action's).
function runnerTags(r){
  var d = r.details || {};
  return ((d.movementReason||'') + ' ' + (d.eventType||'') + ' ' + (d.event||'')).toLowerCase();
}
function runnerAdvReason(r){
  var s = runnerTags(r);
  if(s.indexOf('stolen')>=0) return 'SB';
  if(s.indexOf('wild_pitch')>=0 || s.indexOf('wild pitch')>=0) return 'WP';
  if(s.indexOf('passed_ball')>=0 || s.indexOf('passed ball')>=0) return 'PB';
  if(s.indexOf('balk')>=0) return 'BK';
  if(s.indexOf('indiff')>=0) return 'DI';
  if(s.indexOf('error')>=0) return 'E';
  return '';
}
function runnerOutCode(r){
  var s = runnerTags(r);
  if(s.indexOf('caught_stealing')>=0 || s.indexOf('caught stealing')>=0) return 'CS';
  if(s.indexOf('pickoff')>=0 || s.indexOf('pick-off')>=0 || s.indexOf('picked off')>=0) return 'PO';
  return '';
}

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

// How a baserunner was retired (not at the plate).
function runnerOutReason(et, play){
  if(et.indexOf('caught_stealing')===0 || et.indexOf('pickoff_caught_stealing')===0) return 'CS';
  if(et.indexOf('pickoff')===0) return 'PO';
  return fielderChain(play).join('-') || 'OUT';
}

// Batted-ball trajectory from the last pitch's hitData — authoritative,
// replaces fragile prose regex on result.description.
function hitTrajectory(play){
  var ev = play.playEvents || [];
  for(var i=ev.length-1;i>=0;i--){
    if(ev[i].hitData && ev[i].hitData.trajectory) return ev[i].hitData.trajectory;
  }
  return '';
}
// Gameday batted-ball landing coordinates (home plate ≈ 125.42, 198.27).
function hitCoords(play){
  var ev = play.playEvents || [];
  for(var i=ev.length-1;i>=0;i--){
    var hd = ev[i].hitData;
    if(hd && hd.coordinates && hd.coordinates.coordX!=null && hd.coordinates.coordY!=null)
      return { x:hd.coordinates.coordX, y:hd.coordinates.coordY };
  }
  return null;
}

// Pitch count + resolved ball-strike count for the plate appearance.
function pitchInfo(play){
  var ev = play.playEvents || [], p = 0;
  for(var i=0;i<ev.length;i++){ if(ev[i].isPitch) p++; }
  var c = play.count || {};
  return { p:p, b:(c.balls!=null?c.balls:0), s:(c.strikes!=null?c.strikes:0) };
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
    var tj = hitTrajectory(play);
    var pre = tj==='line_drive' ? 'L'
            : tj==='popup' ? 'P'
            : (tj==='fly_ball'||tj==='flyball') ? 'F'
            : '';
    if(!pre){ // ground_ball/bunt or no hitData → use description as a hint
      pre = /lines? out|lined out/.test(d) ? 'L'
          : /pop|popped/.test(d) ? 'P'
          : /fl(?:y|ies|ied)|flyball/.test(d) ? 'F'
          : '';
    }
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
  var regInn = ls.scheduledInnings || 9;
  var innCount = Math.max(regInn, (ls.innings||[]).length, ls.currentInning||0);

  var dec = ld.decisions || {};
  var decById = {};
  if(dec.winner && dec.winner.id) decById[dec.winner.id] = 'W';
  if(dec.loser && dec.loser.id) decById[dec.loser.id] = 'L';
  if(dec.save && dec.save.id) decById[dec.save.id] = 'S';

  var subRoles = {};
  plays.forEach(function(p){
    var ev = p.result && p.result.eventType;
    if(ev!=='offensive_substitution' && ev!=='defensive_substitution') return;
    var dsc = (p.result && p.result.description) || '';
    var role = /Pinch-hitter/i.test(dsc) ? 'PH' : /Pinch-runner/i.test(dsc) ? 'PR' : '';
    if(!role) return;
    var m = dsc.match(/(?:Pinch-hitter|Pinch-runner)\s+(.+?)\s+replaces/i);
    if(m) subRoles[m[1].trim()] = role;
  });

  function teamModel(sideKey){
    var t = box[sideKey]||{}, players = t.players||{};
    var slots = {};
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
        cells: {} // inning → [cell, …]  (array supports batting around)
      });
    });
    Object.keys(slots).forEach(function(s){ slots[s].sort(function(a,b){return a.order-b.order;}); });
    var pitchers = (t.pitchers||[]).map(function(pid){
      var p = players['ID'+pid]||{}, st = (p.stats && p.stats.pitching)||{};
      return { name:(p.person&&p.person.fullName)||'', dec:decById[pid]||'', line:st };
    });
    return { slots:slots, pitchers:pitchers };
  }

  var away = teamModel('away'), home = teamModel('home');
  function rowFor(model,pid){
    var found=null;
    Object.keys(model.slots).forEach(function(s){
      model.slots[s].forEach(function(r){ if(r.id===pid) found=r; });
    });
    return found;
  }
  function pushCell(row,inn,cell){ (row.cells[inn]=row.cells[inn]||[]).push(cell); }

  var onBase = {}; // base number (1/2/3) → cell currently occupying it
  var prevHalf = null;

  plays.forEach(function(play){
    if(!(play.about && play.about.isComplete)) return;
    var inn = play.about.inning, half = play.about.halfInning;
    var hk = inn + half;
    if(hk !== prevHalf){ onBase = {}; prevHalf = hk; } // runners don't carry across half-innings
    var model = half==='top' ? away : home;
    var et = (play.result && play.result.eventType) || '';
    var isPA = !NON_PA[et];
    var reason = advReason(et);
    var batterId = play.matchup && play.matchup.batter && play.matchup.batter.id;
    var nOuts = play.count && play.count.outs;

    // Snapshot pre-play occupancy; mutate a working copy so concurrent
    // runner movements all resolve against the same starting state.
    var pre = {}, next = {};
    for(var k in onBase){ pre[k]=onBase[k]; next[k]=onBase[k]; }

    (play.runners||[]).forEach(function(r){
      var rid = r.details && r.details.runner && r.details.runner.id;
      if(rid===batterId) return; // batter handled below
      var mv = r.movement || {};
      var sN = baseToNum(mv.originBase || mv.start);
      if(sN<1 || sN>3) return;
      var cell = pre[sN];
      if(!cell){
        // Manfred runner: extra-inning runner pre-placed on 2B with no PA.
        if(inn>regInn && sN===2){
          cell = { code:'MR', hit:false, out:false, rbi:0, reached:2, scored:false,
                   outNum:0, inningEnd:false, p:0, b:0, s:0, adv:'', ghost:true };
          var grow = rowFor(model, rid);
          if(grow) pushCell(grow, inn, cell);
          pre[sN]=cell; next[sN]=cell;
        } else return;
      }
      var rReason = runnerAdvReason(r) || reason;
      if(mv.isOut){
        cell.outOnBase = true;
        cell.outReason = runnerOutCode(r) || runnerOutReason(et, play);
        if(nOuts===3) cell.inningEnd = true;
        cell.outNum = nOuts || cell.outNum || 0;
        if(next[sN]===cell) delete next[sN];
        return;
      }
      var endN = baseToNum(mv.end);
      if(endN===4){
        cell.scored = true; cell.reached = 3; if(rReason) cell.adv = rReason;
        if(next[sN]===cell) delete next[sN];
      } else if(endN>=1 && endN!==sN){
        if(next[sN]===cell) delete next[sN];
        next[endN] = cell;
        cell.reached = Math.max(cell.reached||0, Math.min(3,endN));
        if(rReason) cell.adv = rReason;
      }
    });

    if(isPA){
      var row = rowFor(model, batterId);
      var n = notatePlay(play);
      var pi = pitchInfo(play);
      var br = (play.runners||[]).filter(function(r){
        return r.details && r.details.runner && r.details.runner.id===batterId
            && (r.movement.start==null || r.movement.originBase==null);
      })[0];
      var reached = br ? baseToNum(br.movement.end) : 0;
      var batterOut = br ? !!br.movement.isOut : n.out;
      var cell = {
        code: n.code, hit:n.hit, out:batterOut,
        rbi: (play.result && play.result.rbi) || 0,
        reached: reached>=4 ? 3 : reached,
        scored: reached===4,
        outNum: batterOut ? (nOuts||0) : 0,
        inningEnd: batterOut && nOuts===3,
        p: pi.p, b: pi.b, s: pi.s, adv:'', hc: hitCoords(play), traj: hitTrajectory(play)
      };
      // Uncaught third strike: batter reached on a K — keep K/ꓘ, note why.
      if((et==='strikeout'||et==='strikeout_double_play') && !batterOut && reached>=1){
        var dd = ((play.result && play.result.description)||'').toLowerCase();
        cell.adv = /wild pitch/.test(dd) ? 'WP'
                 : /passed ball/.test(dd) ? 'PB'
                 : /error/.test(dd) ? 'E' : 'safe';
      }
      if(row) pushCell(row, inn, cell);
      if(!batterOut && !cell.scored && reached>=1 && reached<=3) next[reached] = cell;
    }

    onBase = next;
  });

  function lineTotals(side){
    var tt = (ls.teams && ls.teams[side]) || {};
    return { r:tt.runs!=null?tt.runs:'—', h:tt.hits!=null?tt.hits:'—',
             e:tt.errors!=null?tt.errors:'—', lob:tt.leftOnBase!=null?tt.leftOnBase:'—' };
  }
  function inningRuns(side){
    var out=[];
    for(var i=0;i<innCount;i++){
      var ii=(ls.innings||[])[i];
      out.push(ii && ii[side] && ii[side].runs!=null ? ii[side].runs : (ii?0:''));
    }
    return out;
  }

  var at = gd.teams && gd.teams.away ? gd.teams.away : {};
  var ht = gd.teams && gd.teams.home ? gd.teams.home : {};
  var w = gd.weather||{}, gi = gd.gameInfo||{}, dt = gd.datetime||{};
  var metaBits = [];
  if(gd.venue && gd.venue.name) metaBits.push(gd.venue.name);
  if(dt.officialDate) metaBits.push(dt.officialDate);
  if(gi.attendance) metaBits.push('Att ' + Number(gi.attendance).toLocaleString());
  if(w.temp && w.condition) metaBits.push(w.condition + ' ' + w.temp + '°');
  if(w.wind) metaBits.push('Wind ' + w.wind);

  return {
    innCount: innCount,
    status: (gd.status && gd.status.detailedState) || '',
    isLive: gd.status && gd.status.abstractGameState==='Live',
    dateStr: dt.officialDate || '',
    meta: metaBits.join(' · '),
    subRoles: subRoles,
    away: { name:(at.teamName||at.name||'Away'), model:away, totals:lineTotals('away'), inn:inningRuns('away') },
    home: { name:(ht.teamName||ht.name||'Home'), model:home, totals:lineTotals('home'), inn:inningRuns('home') }
  };
}

// ── Rendering ──────────────────────────────────────────────────────────────

function diamondSVG(cell, size){
  size = size || 56;
  var H='30,58', B1='58,30', B2='30,2', B3='2,30';
  var path = ['M30,58 L58,30','M58,30 L30,2','M30,2 L2,30','M2,30 L30,58'];
  var s = '<svg viewBox="0 0 60 60" width="'+size+'" height="'+size+'" style="display:block">';
  s += '<polygon points="'+B2+' '+B1+' '+H+' '+B3+'" fill="none" stroke="var(--border)" stroke-width="1.5"/>';
  // Batted-ball spray vector from Gameday landing coords: real direction
  // (pull/center/oppo within the ±45° fair wedge) and depth; grounders
  // straight, fly balls arced. Thin/muted so it reads under the run path.
  if(cell.hc && !cell.ghost){
    var dx = cell.hc.x - 125.42, dy = 198.27 - cell.hc.y;
    var th = Math.atan2(dx, dy);
    if(th>1.05) th=1.05; else if(th<-1.05) th=-1.05;
    var rN = Math.sqrt(dx*dx+dy*dy)/210;
    if(rN>1) rN=1; else if(rN<0.12) rN=0.12;
    var L = 8 + rN*46;
    var ex = Math.max(4, Math.min(56, 30 + L*Math.sin(th)));
    var ey = Math.max(4, Math.min(56, 58 - L*Math.cos(th)));
    var vx = ex-30, vy = ey-57, vl = Math.sqrt(vx*vx+vy*vy)||1;
    var k = cell.traj==='fly_ball' ? 7 : cell.traj==='popup' ? 9 : cell.traj==='line_drive' ? 2 : 0;
    var d = k>0
      ? 'M30,57 Q'+(((30+ex)/2)+(-vy/vl)*k).toFixed(1)+','+(((57+ey)/2)+(vx/vl)*k).toFixed(1)+' '+ex.toFixed(1)+','+ey.toFixed(1)
      : 'M30,57 L'+ex.toFixed(1)+','+ey.toFixed(1);
    s += '<path d="'+d+'" stroke="var(--muted)" stroke-width="1.2" fill="none" opacity="0.55"/>';
    s += '<circle cx="'+ex.toFixed(1)+'" cy="'+ey.toFixed(1)+'" r="1.5" fill="var(--muted)" opacity="0.7"/>';
  }
  if(cell.scored) s += '<polygon points="'+B2+' '+B1+' '+H+' '+B3+'" fill="var(--accent)" fill-opacity="0.28"/>';
  var seg = cell.scored ? 4 : (cell.reached||0);
  for(var i=0;i<seg;i++){
    s += '<path d="'+path[i]+'" stroke="var(--accent)" stroke-width="3" stroke-linecap="round" fill="none"/>';
  }
  [B1,B2,B3].forEach(function(p,idx){
    var on = (idx+1) <= (cell.scored?3:cell.reached);
    s += '<circle cx="'+p.split(',')[0]+'" cy="'+p.split(',')[1]+'" r="2.6" fill="'+(on?'var(--accent)':'var(--border)')+'"/>';
  });
  if(cell.inningEnd) s += '<line x1="4" y1="4" x2="56" y2="56" stroke="var(--muted)" stroke-width="1.5" opacity="0.5"/>';
  if(cell.outNum) s += '<text x="51" y="13" font-size="9" fill="var(--muted)" text-anchor="middle">'+cell.outNum+'</text>';
  // RBI — classic convention: one dot per run batted in.
  for(var ri=0; ri<(cell.rbi||0); ri++){
    s += '<circle cx="'+(6+ri*4)+'" cy="10" r="1.6" fill="var(--accent)"/>';
  }
  var col = cell.hit ? 'var(--accent)' : ((cell.out||cell.outOnBase) ? 'var(--muted)' : 'var(--text)');
  s += '<text x="30" y="31" font-size="11" font-weight="700" fill="'+col+'" text-anchor="middle">'+esc(cell.code)+'</text>';
  var mid = cell.outOnBase ? (cell.outReason||'OUT') : cell.adv;
  if(mid) s += '<text x="30" y="43" font-size="7.5" fill="'+(cell.outOnBase?'var(--muted)':'var(--accent)')+'" text-anchor="middle">'+esc(mid)+'</text>';
  s += '</svg>';
  return s;
}

// Ball-strike + pitch count, rendered just below the diamond (clearer
// than cramming it inside the SVG).
function footHtml(cell){
  if(cell.ghost) return '';
  var t = (cell.b!=null && cell.s!=null ? cell.b+'-'+cell.s : '') + (cell.p ? ' · '+cell.p+'p' : '');
  return t ? '<div class="sc-foot">'+esc(t)+'</div>' : '';
}

function emptyCell(){
  return '<svg viewBox="0 0 60 60" width="56" height="56" style="display:block;opacity:.25">'
       + '<polygon points="30,2 58,30 30,58 2,30" fill="none" stroke="var(--border)" stroke-width="1"/></svg>';
}

function renderCellStack(arr){
  if(!arr || !arr.length) return emptyCell();
  if(arr.length===1) return diamondSVG(arr[0]) + footHtml(arr[0]);
  // batting around: this batter came up twice+ in one inning
  return '<div class="sc-stack" title="batted around">'
       + arr.map(function(c){ return '<div>'+diamondSVG(c, 38)+footHtml(c)+'</div>'; }).join('') + '</div>';
}

function renderLineScore(model){
  var n = model.innCount;
  var h = '<div class="sc-scroll"><table class="sc-table sc-ls"><thead><tr><th class="sc-name"></th>';
  for(var i=1;i<=n;i++) h += '<th>'+i+'</th>';
  h += '<th class="sc-rhe">R</th><th class="sc-rhe">H</th><th class="sc-rhe">E</th><th class="sc-rhe">LOB</th></tr></thead><tbody>';
  [model.away, model.home].forEach(function(t){
    h += '<tr><td class="sc-name"><span class="sc-pn">'+esc(t.name)+'</span></td>';
    for(var k=0;k<n;k++) h += '<td>'+(t.inn[k]!=null?t.inn[k]:'')+'</td>';
    h += '<td class="sc-rhe">'+t.totals.r+'</td><td class="sc-rhe">'+t.totals.h+'</td>'
       + '<td class="sc-rhe">'+t.totals.e+'</td><td class="sc-rhe">'+t.totals.lob+'</td></tr>';
  });
  return h + '</tbody></table></div>';
}

function renderTeamTable(team, innCount){
  var slots = team.model.slots;
  var slotNums = Object.keys(slots).map(Number).sort(function(a,b){return a-b;});
  var th = '<th class="sc-name">'+esc(team.name)+'</th>';
  for(var i=1;i<=innCount;i++) th += '<th>'+i+'</th>';

  var body = '';
  slotNums.forEach(function(sn){
    slots[sn].forEach(function(row, subIdx){
      var roleTag = subIdx>0 ? '<span class="sc-subtag">'+esc(team.subRoles && team.subRoles[row.name] || 'SUB')+'</span>' : '';
      body += '<tr'+(subIdx>0?' class="sc-subrow"':'')+'>';
      body += '<td class="sc-name"><span class="sc-ord">'+(subIdx===0?sn:'')+'</span>'
            + roleTag
            + '<span class="sc-pn">'+esc(row.name)+'</span>'
            + '<span class="sc-pos">'+esc(row.pos)+'</span></td>';
      for(var inn=1;inn<=innCount;inn++){
        body += '<td class="sc-cell">'+renderCellStack(row.cells[inn])+'</td>';
      }
      body += '</tr>';
    });
  });

  return '<div class="sc-team"><div class="sc-team-h">'+esc(team.name)+' — Batting</div>'
       + '<div class="sc-scroll"><table class="sc-table"><thead><tr>'
       + th + '</tr></thead><tbody>' + body + '</tbody></table></div></div>';
}

function renderPitchers(team){
  if(!team.model.pitchers.length) return '';
  var rows = team.model.pitchers.map(function(p){
    var L = p.line||{};
    var pc = (L.numberOfPitches!=null?L.numberOfPitches:'') + (L.strikes!=null?'-'+L.strikes:'');
    var dec = p.dec ? ' <span class="sc-dec">('+p.dec+')</span>' : '';
    return '<tr><td class="sc-name"><span class="sc-pn">'+esc(p.name)+'</span>'+dec+'</td>'
         + '<td>'+(L.inningsPitched||'0.0')+'</td>'
         + '<td>'+(L.battersFaced!=null?L.battersFaced:'')+'</td>'
         + '<td>'+(L.hits!=null?L.hits:0)+'</td>'
         + '<td>'+(L.runs!=null?L.runs:0)+'</td>'
         + '<td>'+(L.earnedRuns!=null?L.earnedRuns:0)+'</td>'
         + '<td>'+(L.baseOnBalls!=null?L.baseOnBalls:0)+'</td>'
         + '<td>'+(L.strikeOuts!=null?L.strikeOuts:0)+'</td>'
         + '<td>'+(L.homeRuns!=null?L.homeRuns:0)+'</td>'
         + '<td>'+pc+'</td></tr>';
  }).join('');
  return '<div class="sc-team"><div class="sc-team-h">'+esc(team.name)+' — Pitching</div>'
       + '<div class="sc-scroll"><table class="sc-table sc-pit"><thead><tr>'
       + '<th class="sc-name">Pitcher</th><th>IP</th><th>BF</th><th>H</th><th>R</th>'
       + '<th>ER</th><th>BB</th><th>K</th><th>HR</th><th>P-S</th></tr></thead><tbody>'
       + rows + '</tbody></table></div></div>';
}

function renderInto(model){
  var card = document.getElementById('scorecardCard');
  if(!card) return;
  model.away.subRoles = model.subRoles; model.home.subRoles = model.subRoles;
  var live = model.isLive ? '<span class="sc-live">● LIVE</span> ' : '';
  card.innerHTML =
    '<div class="sc-head">'
    + '<div><div class="sc-title">'+esc(model.away.name)+' @ '+esc(model.home.name)+'</div>'
    + '<div class="sc-sub">'+live+esc(model.status)+(model.meta?' · '+esc(model.meta):'')+'</div></div>'
    + '<button class="sc-close" onclick="closeScorecardOverlay()" aria-label="Close">✕</button></div>'
    + renderLineScore(model)
    + renderTeamTable(model.away, model.innCount)
    + renderTeamTable(model.home, model.innCount)
    + renderPitchers(model.away)
    + renderPitchers(model.home);
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
