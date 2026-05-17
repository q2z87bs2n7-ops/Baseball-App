// Old-school scorecard overlay — renders a baseball scoring-book view of a
// game (live or completed) from the MLB feed/live payload: a line-score
// header, a diamond per plate appearance with traced base paths, fielder
// notation (6-3, F8, K/ꓘ), ball-strike/pitch caption, inning-ending
// diagonals, advancement reason codes (WP/PB/BK/SB/E), runner-out markers
// (CS/PO), batting-around stacking, Manfred runner (MR) handling,
// substitution markers (PH/PR), per-inning left-on-base, and a full pitcher
// table with W/L/S. Final games are session-cached; live re-renders
// preserve scroll; dialog is focus-trapped and screen-reader labelled;
// a print stylesheet supports a clean landscape printout.
//
// Visual treatment is the "Paper" heritage variant: cream stock, navy
// ink for plays, faded red for outs/RBI/HR, serif type. The palette is
// fixed (not team-themed) — remapped via CSS custom properties scoped to
// #scorecardCard so the .sc-* rules recolour without a rewrite.
//
// Runner tracking is BASE-keyed (which batter's run currently occupies 1B/
// 2B/3B), not runner-id-keyed — so pinch-runners inherit the base correctly
// and a run is always credited to the batter who started it.
import { state } from '../state.js';
import { MLB_BASE_V1_1, TIMING } from '../config/constants.js';

let refreshTimer = null;

function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// MLB defensive position code → traditional scorebook number.
const POS = { '1':'1','2':'2','3':'3','4':'4','5':'5','6':'6','7':'7','8':'8','9':'9','10':'DH' };

// Non-plate-appearance event types: never produce a cell (they happen
// mid-AB or between batters) but still drive runner advancement.
const NON_PA = {
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
  const d = r.details || {};
  return ((d.movementReason||'') + ' ' + (d.eventType||'') + ' ' + (d.event||'')).toLowerCase();
}
function runnerAdvReason(r){
  const s = runnerTags(r);
  if(s.indexOf('stolen')>=0) return 'SB';
  if(s.indexOf('wild_pitch')>=0 || s.indexOf('wild pitch')>=0) return 'WP';
  if(s.indexOf('passed_ball')>=0 || s.indexOf('passed ball')>=0) return 'PB';
  if(s.indexOf('balk')>=0) return 'BK';
  if(s.indexOf('indiff')>=0) return 'DI';
  if(s.indexOf('error')>=0) return 'E';
  return '';
}
function runnerOutCode(r){
  const s = runnerTags(r);
  if(s.indexOf('caught_stealing')>=0 || s.indexOf('caught stealing')>=0) return 'CS';
  if(s.indexOf('pickoff')>=0 || s.indexOf('pick-off')>=0 || s.indexOf('picked off')>=0) return 'PO';
  return '';
}

function fielderChain(play){
  // Ordered fielder-number chain from credits, preserving fielding sequence
  // so rundowns like 1-3-6-3 keep their repeats. Only *consecutive*
  // duplicates collapse, so a 6-4-3 DP doesn't print the shared pivot twice.
  const seq = [];
  (play.runners||[]).forEach(function(r){
    (r.credits||[]).forEach(function(c){
      if(c.credit!=='f_putout' && c.credit!=='f_assist') return;
      const num = POS[c.position && c.position.code] || '';
      if(num && seq[seq.length-1]!==num) seq.push(num);
    });
  });
  return seq;
}

function errorPos(play){
  let p='';
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
  const ev = play.playEvents || [];
  for(let i=ev.length-1;i>=0;i--){
    if(ev[i].hitData && ev[i].hitData.trajectory) return ev[i].hitData.trajectory;
  }
  return '';
}
// Gameday batted-ball landing coordinates (home plate ≈ 125.42, 198.27).
function hitCoords(play){
  const ev = play.playEvents || [];
  for(let i=ev.length-1;i>=0;i--){
    const hd = ev[i].hitData;
    if(hd && hd.coordinates && hd.coordinates.coordX!=null && hd.coordinates.coordY!=null)
      return { x:hd.coordinates.coordX, y:hd.coordinates.coordY };
  }
  return null;
}

// Pitch count + resolved ball-strike count for the plate appearance.
function pitchInfo(play){
  let ev = play.playEvents || [], p = 0;
  for(let i=0;i<ev.length;i++){ if(ev[i].isPitch) p++; }
  const c = play.count || {};
  return { p:p, b:(c.balls!=null?c.balls:0), s:(c.strikes!=null?c.strikes:0) };
}

// Translate a completed play into a scorecard cell descriptor.
function notatePlay(play){
  const et = (play.result && play.result.eventType) || '';
  const desc = (play.result && play.result.description) || '';
  const d = desc.toLowerCase();
  const chain = fielderChain(play);
  const out = { code:'', hit:false, out:false };

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
    const tj = hitTrajectory(play);
    let pre = tj==='line_drive' ? 'L'
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
  const gd = feed.gameData||{}, ld = feed.liveData||{};
  const ls = ld.linescore||{};
  const box = ld.boxscore && ld.boxscore.teams ? ld.boxscore.teams : {};
  const plays = (ld.plays && ld.plays.allPlays) ? ld.plays.allPlays : [];
  const regInn = ls.scheduledInnings || 9;
  const innCount = Math.max(regInn, (ls.innings||[]).length, ls.currentInning||0);

  const dec = ld.decisions || {};
  const decById = {};
  if(dec.winner && dec.winner.id) decById[dec.winner.id] = 'W';
  if(dec.loser && dec.loser.id) decById[dec.loser.id] = 'L';
  if(dec.save && dec.save.id) decById[dec.save.id] = 'S';

  // PH/PR roles keyed by the entering player's id (resolved from the
  // batting team's boxscore by name) so two same-named players in one
  // game can't collide; falls back to a name key if unresolved.
  const subRoles = {};
  plays.forEach(function(p){
    if((p.result && p.result.eventType) !== 'offensive_substitution') return;
    const dsc = (p.result && p.result.description) || '';
    const role = /Pinch-hitter/i.test(dsc) ? 'PH' : /Pinch-runner/i.test(dsc) ? 'PR' : '';
    if(!role) return;
    const m = dsc.match(/(?:Pinch-hitter|Pinch-runner)\s+(.+?)\s+replaces/i);
    if(!m) return;
    const nm = m[1].trim();
    const side = (p.about && p.about.halfInning==='top') ? 'away' : 'home';
    const players = (box[side] && box[side].players) || {};
    let id = null;
    Object.keys(players).forEach(function(k){
      const pl = players[k];
      if(pl && pl.person && pl.person.fullName===nm) id = pl.person.id;
    });
    subRoles[id!=null ? id : ('name:'+nm)] = role;
  });

  function teamModel(sideKey){
    const t = box[sideKey]||{}, players = t.players||{};
    const slots = {};
    Object.keys(players).forEach(function(pid){
      const p = players[pid];
      if(p.battingOrder==null) return;
      const ord = parseInt(p.battingOrder,10);
      const slot = Math.floor(ord/100);
      (slots[slot]=slots[slot]||[]).push({
        id: p.person.id,
        name: p.person.fullName,
        pos: (p.position && p.position.abbreviation) || '',
        order: ord,
        cells: {} // inning → [cell, …]  (array supports batting around)
      });
    });
    Object.keys(slots).forEach(function(s){ slots[s].sort(function(a,b){return a.order-b.order;}); });
    const pitchers = (t.pitchers||[]).map(function(pid){
      const p = players['ID'+pid]||{}, st = (p.stats && p.stats.pitching)||{};
      return { name:(p.person&&p.person.fullName)||'', dec:decById[pid]||'', line:st };
    });
    return { slots:slots, pitchers:pitchers };
  }

  const away = teamModel('away'), home = teamModel('home');
  function rowFor(model,pid){
    let found=null;
    Object.keys(model.slots).forEach(function(s){
      model.slots[s].forEach(function(r){ if(r.id===pid) found=r; });
    });
    return found;
  }
  function pushCell(row,inn,cell){ (row.cells[inn]=row.cells[inn]||[]).push(cell); }

  let onBase = {}; // base number (1/2/3) → cell currently occupying it
  let prevHalf = null, prevSide = null, prevInn = null;
  const lobA = {}, lobH = {}; // per-inning runners left on base

  plays.forEach(function(play){
    if(!(play.about && play.about.isComplete)) return;
    const inn = play.about.inning, half = play.about.halfInning;
    const hk = inn + '-' + half;
    if(hk !== prevHalf){
      // half-inning rolled over: whatever's still on base was stranded
      if(prevHalf!=null) (prevSide==='away'?lobA:lobH)[prevInn] = Object.keys(onBase).length;
      onBase = {}; prevHalf = hk;
      prevSide = half==='top' ? 'away' : 'home'; prevInn = inn;
    }
    const model = half==='top' ? away : home;
    const et = (play.result && play.result.eventType) || '';
    const isPA = !NON_PA[et];
    const reason = advReason(et);
    const batterId = play.matchup && play.matchup.batter && play.matchup.batter.id;
    const nOuts = play.count && play.count.outs;

    // Snapshot pre-play occupancy; mutate a working copy so concurrent
    // runner movements all resolve against the same starting state.
    const pre = {}, next = {};
    for(const k in onBase){ pre[k]=onBase[k]; next[k]=onBase[k]; }

    (play.runners||[]).forEach(function(r){
      const rid = r.details && r.details.runner && r.details.runner.id;
      if(rid===batterId) return; // batter handled below
      const mv = r.movement || {};
      const sN = baseToNum(mv.originBase || mv.start);
      if(sN<1 || sN>3) return;
      let cell = pre[sN];
      if(!cell){
        // Manfred runner: extra-inning runner pre-placed on 2B with no PA.
        if(inn>regInn && sN===2){
          cell = { code:'MR', hit:false, out:false, rbi:0, reached:2, scored:false,
                   outNum:0, inningEnd:false, p:0, b:0, s:0, adv:'', ghost:true };
          const grow = rowFor(model, rid);
          if(grow) pushCell(grow, inn, cell);
          pre[sN]=cell; next[sN]=cell;
        } else return;
      }
      const rReason = runnerAdvReason(r) || reason;
      if(mv.isOut){
        cell.outOnBase = true;
        cell.outReason = runnerOutCode(r) || runnerOutReason(et, play);
        if(nOuts===3) cell.inningEnd = true;
        cell.outNum = nOuts || cell.outNum || 0;
        if(next[sN]===cell) delete next[sN];
        return;
      }
      const endN = baseToNum(mv.end);
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
      const row = rowFor(model, batterId);
      const n = notatePlay(play);
      const pi = pitchInfo(play);
      const br = (play.runners||[]).filter(function(r){
        return r.details && r.details.runner && r.details.runner.id===batterId
            && (r.movement.start==null || r.movement.originBase==null);
      })[0];
      const reached = br ? baseToNum(br.movement.end) : 0;
      const batterOut = br ? !!br.movement.isOut : n.out;
      const cell = {
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
        const dd = ((play.result && play.result.description)||'').toLowerCase();
        cell.adv = /wild pitch/.test(dd) ? 'WP'
                 : /passed ball/.test(dd) ? 'PB'
                 : /error/.test(dd) ? 'E' : 'safe';
      }
      if(row) pushCell(row, inn, cell);
      if(!batterOut && !cell.scored && reached>=1 && reached<=3) next[reached] = cell;
    }

    onBase = next;
  });
  if(prevHalf!=null) (prevSide==='away'?lobA:lobH)[prevInn] = Object.keys(onBase).length;

  function lobByInn(map){
    const out=[];
    for(let i=1;i<=innCount;i++) out.push(map[i]!=null ? map[i] : '');
    return out;
  }

  function lineTotals(side){
    const tt = (ls.teams && ls.teams[side]) || {};
    return { r:tt.runs!=null?tt.runs:'—', h:tt.hits!=null?tt.hits:'—',
             e:tt.errors!=null?tt.errors:'—', lob:tt.leftOnBase!=null?tt.leftOnBase:'—' };
  }
  function inningRuns(side){
    const out=[];
    for(let i=0;i<innCount;i++){
      const ii=(ls.innings||[])[i];
      out.push(ii && ii[side] && ii[side].runs!=null ? ii[side].runs : (ii?0:''));
    }
    return out;
  }

  const at = gd.teams && gd.teams.away ? gd.teams.away : {};
  const ht = gd.teams && gd.teams.home ? gd.teams.home : {};
  const w = gd.weather||{}, gi = gd.gameInfo||{}, dt = gd.datetime||{};
  const metaBits = [];
  if(gd.venue && gd.venue.name) metaBits.push(gd.venue.name);
  if(dt.officialDate) metaBits.push(dt.officialDate);
  if(gi.attendance) metaBits.push('Att ' + Number(gi.attendance).toLocaleString());
  if(w.temp && w.condition) metaBits.push(w.condition + ' ' + w.temp + '°');
  if(w.wind) metaBits.push('Wind ' + w.wind);

  return {
    innCount: innCount,
    status: (gd.status && gd.status.detailedState) || '',
    isLive: gd.status && gd.status.abstractGameState==='Live',
    isFinal: gd.status && gd.status.abstractGameState==='Final',
    dateStr: dt.officialDate || '',
    meta: metaBits.join(' · '),
    subRoles: subRoles,
    away: { name:(at.teamName||at.name||'Away'), model:away, totals:lineTotals('away'), inn:inningRuns('away'), lobInn:lobByInn(lobA) },
    home: { name:(ht.teamName||ht.name||'Home'), model:home, totals:lineTotals('home'), inn:inningRuns('home'), lobInn:lobByInn(lobH) }
  };
}

// ── Rendering ──────────────────────────────────────────────────────────────

// Paper (heritage) palette — fixed; intentionally independent of team theme.
const INK_NAVY = '#1a3a6e', INK_RED = '#a8243a', INK_FAINT = '#b8a890', INK_EMPTY = '#d4c5a8';
const CODE_FONT = 'Georgia, &quot;Times New Roman&quot;, serif';

function diamondSVG(cell, size){
  size = size || 76;
  const H='30,58', B1='58,30', B2='30,2', B3='2,30';
  const path = ['M30,58 L58,30','M58,30 L30,2','M30,2 L2,30','M2,30 L30,58'];
  const isHR = cell.code === 'HR';
  const isK  = cell.code === 'K' || cell.code === 'ꓘ';
  const ink = cell.out ? INK_RED : INK_NAVY;
  const pathStroke = (cell.scored || cell.hit) ? INK_NAVY : INK_FAINT;

  let s = '<svg viewBox="0 0 60 60" width="'+size+'" height="'+size+'" aria-hidden="true" focusable="false" style="display:block">';
  s += '<polygon points="'+B2+' '+B1+' '+H+' '+B3+'" fill="none" stroke="'+INK_FAINT+'" stroke-width="0.8"/>';

  // Batted-ball spray vector — same geometry as before; demoted to a thin
  // pencil stroke and suppressed on strikeouts (no batted ball).
  if(cell.hc && !cell.ghost && !isK){
    const dx = cell.hc.x - 125.42, dy = 198.27 - cell.hc.y;
    let th = Math.atan2(dx, dy);
    if(th>1.05) th=1.05; else if(th<-1.05) th=-1.05;
    let rN = Math.sqrt(dx*dx+dy*dy)/210;
    if(rN>1) rN=1; else if(rN<0.12) rN=0.12;
    const L = 8 + rN*46;
    const ex = Math.max(4, Math.min(56, 30 + L*Math.sin(th)));
    const ey = Math.max(4, Math.min(56, 58 - L*Math.cos(th)));
    const vx = ex-30, vy = ey-57, vl = Math.sqrt(vx*vx+vy*vy)||1;
    const k = cell.traj==='fly_ball' ? 7 : cell.traj==='popup' ? 9 : cell.traj==='line_drive' ? 2 : 0;
    const d = k>0
      ? 'M30,57 Q'+(((30+ex)/2)+(-vy/vl)*k).toFixed(1)+','+(((57+ey)/2)+(vx/vl)*k).toFixed(1)+' '+ex.toFixed(1)+','+ey.toFixed(1)
      : 'M30,57 L'+ex.toFixed(1)+','+ey.toFixed(1);
    s += '<path d="'+d+'" stroke="'+INK_FAINT+'" stroke-width="0.9" fill="none" opacity="0.7"/>';
  }

  // HR — filled red polygon with red perimeter.
  if(isHR){
    s += '<polygon points="'+B2+' '+B1+' '+H+' '+B3+'" fill="'+INK_RED+'" fill-opacity="0.18" stroke="'+INK_RED+'" stroke-width="1.2"/>';
  }

  const seg = cell.scored ? 4 : (cell.reached||0);
  for(let i=0;i<seg;i++){
    s += '<path d="'+path[i]+'" stroke="'+pathStroke+'" stroke-width="2.4" stroke-linecap="round" fill="none"/>';
  }
  [B1,B2,B3].forEach(function(p,idx){
    const on = (idx+1) <= (cell.scored?3:cell.reached);
    s += '<circle cx="'+p.split(',')[0]+'" cy="'+p.split(',')[1]+'" r="2.1" fill="'+(on?pathStroke:INK_EMPTY)+'"/>';
  });

  // Inning-ending out — single red slash (traditional scorebook convention).
  if(cell.inningEnd) s += '<line x1="3" y1="3" x2="57" y2="57" stroke="'+INK_RED+'" stroke-width="1.6" opacity="0.85"/>';

  // Out number — circled red chip (traditional scorebook convention).
  if(cell.outNum){
    s += '<circle cx="50" cy="10" r="5.5" fill="none" stroke="'+INK_RED+'" stroke-width="0.9"/>';
    s += '<text x="50" y="13" font-size="8.5" font-weight="700" font-family="'+CODE_FONT+'" fill="'+INK_RED+'" text-anchor="middle">'+cell.outNum+'</text>';
  }
  // RBI — one red dot per run batted in, top-left.
  for(let ri=0; ri<(cell.rbi||0); ri++){
    s += '<circle cx="'+(7+ri*4.5)+'" cy="9" r="1.6" fill="'+INK_RED+'"/>';
  }

  // Code — serif, with HR/K outcome hierarchy.
  const codeSize = isK ? 22 : (isHR ? 13 : 11);
  const codeY    = isK ? 38 : (isHR ? 32 : 31);
  s += '<text x="30" y="'+codeY+'" font-size="'+codeSize+'" font-weight="700" font-family="'+CODE_FONT+'" fill="'+ink+'" text-anchor="middle">'+esc(cell.code)+'</text>';

  // Advancement / runner-out marker (functional — preserved from prod).
  if(!isK){
    const mid = cell.outOnBase ? (cell.outReason||'OUT') : cell.adv;
    if(mid) s += '<text x="30" y="47" font-size="7.5" font-family="'+CODE_FONT+'" fill="'+(cell.outOnBase?INK_RED:INK_FAINT)+'" text-anchor="middle">'+esc(mid)+'</text>';
  }
  s += '</svg>';
  return s;
}

// Ball-strike + pitch count, rendered just below the diamond (clearer
// than cramming it inside the SVG).
function footHtml(cell){
  if(cell.ghost) return '';
  const t = (cell.b!=null && cell.s!=null ? cell.b+'-'+cell.s : '') + (cell.p ? ' · '+cell.p+'p' : '');
  return t ? '<div class="sc-foot">'+esc(t)+'</div>' : '';
}

function emptyCell(){
  return '<svg viewBox="0 0 60 60" width="76" height="76" aria-hidden="true" focusable="false" style="display:block;opacity:.4">'
       + '<polygon points="30,2 58,30 30,58 2,30" fill="none" stroke="'+INK_FAINT+'" stroke-width="0.8"/></svg>';
}

// Screen-reader summary of a plate appearance for the cell's aria-label.
function cellLabel(c){
  if(!c) return '';
  const p = [c.ghost ? 'Manfred runner on 2nd' : c.code];
  if(c.scored) p.push('scored');
  else if(c.outOnBase) p.push('out on the bases ('+(c.outReason||'')+')');
  else if(c.out) p.push('out'+(c.outNum?' number '+c.outNum:''));
  else if(c.reached) p.push('reached '+(['','1st','2nd','3rd'][c.reached]||'base'));
  if(c.rbi) p.push(c.rbi+' RBI');
  if(c.adv && !c.outOnBase && c.adv!=='safe') p.push('advanced '+c.adv);
  return p.join(', ');
}

function renderCellStack(arr){
  if(!arr || !arr.length) return emptyCell();
  if(arr.length===1) return diamondSVG(arr[0]) + footHtml(arr[0]);
  // batting around: this batter came up twice+ in one inning
  return '<div class="sc-stack" title="batted around">'
       + arr.map(function(c){ return '<div>'+diamondSVG(c, 54)+footHtml(c)+'</div>'; }).join('') + '</div>';
}

function renderLineScore(model){
  const n = model.innCount;
  let h = '<div class="sc-scroll"><table class="sc-table sc-ls"><thead><tr><th class="sc-name"></th>';
  for(let i=1;i<=n;i++) h += '<th>'+i+'</th>';
  h += '<th class="sc-rhe">R</th><th class="sc-rhe">H</th><th class="sc-rhe">E</th><th class="sc-rhe">LOB</th></tr></thead><tbody>';
  [model.away, model.home].forEach(function(t){
    h += '<tr><td class="sc-name"><span class="sc-pn">'+esc(t.name)+'</span></td>';
    for(let k=0;k<n;k++) h += '<td>'+(t.inn[k]!=null?t.inn[k]:'')+'</td>';
    h += '<td class="sc-rhe">'+t.totals.r+'</td><td class="sc-rhe">'+t.totals.h+'</td>'
       + '<td class="sc-rhe">'+t.totals.e+'</td><td class="sc-rhe">'+t.totals.lob+'</td></tr>';
  });
  return h + '</tbody></table></div>';
}

function renderTeamTable(team, innCount){
  const slots = team.model.slots;
  const slotNums = Object.keys(slots).map(Number).sort(function(a,b){return a-b;});
  let th = '<th class="sc-name">'+esc(team.name)+'</th>';
  for(let i=1;i<=innCount;i++) th += '<th>'+i+'</th>';

  const sr = team.subRoles || {};
  let body = '';
  slotNums.forEach(function(sn){
    slots[sn].forEach(function(row, subIdx){
      const role = sr[row.id] || sr['name:'+row.name];
      const roleTag = subIdx>0 ? '<span class="sc-subtag">'+esc(role||'SUB')+'</span>' : '';
      body += '<tr'+(subIdx>0?' class="sc-subrow"':'')+'>';
      body += '<td class="sc-name"><span class="sc-ord">'+(subIdx===0?sn:'')+'</span>'
            + roleTag
            + '<span class="sc-pn">'+esc(row.name)+'</span>'
            + '<span class="sc-pos">'+esc(row.pos)+'</span></td>';
      for(let inn=1;inn<=innCount;inn++){
        const arr = row.cells[inn];
        const lbl = (arr && arr.length)
          ? ' aria-label="'+esc(row.name+', inning '+inn+': '+arr.map(cellLabel).join('; '))+'"'
          : '';
        body += '<td class="sc-cell"'+lbl+'>'+renderCellStack(arr)+'</td>';
      }
      body += '</tr>';
    });
  });

  let lobRow = '<tr class="sc-lob"><td class="sc-name">Left on base</td>';
  for(let li=0; li<innCount; li++) lobRow += '<td>'+(team.lobInn && team.lobInn[li]!=='' && team.lobInn[li]!=null ? team.lobInn[li] : '')+'</td>';
  lobRow += '</tr>';

  return '<div class="sc-team"><div class="sc-team-h">'+esc(team.name)+' — Batting</div>'
       + '<div class="sc-scroll"><table class="sc-table sc-bat"><thead><tr>'
       + th + '</tr></thead><tbody>' + body + '</tbody><tfoot>' + lobRow + '</tfoot></table></div></div>';
}

function renderPitchers(team){
  if(!team.model.pitchers.length) return '';
  const rows = team.model.pitchers.map(function(p){
    const L = p.line||{};
    const pc = (L.numberOfPitches!=null?L.numberOfPitches:'') + (L.strikes!=null?'-'+L.strikes:'');
    const dec = p.dec ? ' <span class="sc-dec">('+p.dec+')</span>' : '';
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
  const card = document.getElementById('scorecardCard');
  if(!card) return;
  model.away.subRoles = model.subRoles; model.home.subRoles = model.subRoles;
  // Preserve scroll position + horizontal pans across the live re-render.
  const ov = document.getElementById('scorecardOverlay');
  const sy = ov ? ov.scrollTop : 0;
  const prevScroll = [];
  const scs = card.querySelectorAll('.sc-scroll');
  for(let z=0;z<scs.length;z++) prevScroll.push(scs[z].scrollLeft);
  const live = model.isLive ? '<span class="sc-live">● LIVE</span> ' : '';
  card.innerHTML =
    '<div class="sc-head">'
    + '<div><div class="sc-title" id="scorecardTitle">'+esc(model.away.name)+' @ '+esc(model.home.name)+'</div>'
    + '<div class="sc-sub">'+live+esc(model.status)+(model.meta?' · '+esc(model.meta):'')+'</div></div>'
    + '<div class="sc-actions">'
    + '<button class="sc-print" onclick="window.print()" aria-label="Print scorecard">🖨</button>'
    + '<button class="sc-close" onclick="closeScorecardOverlay()" aria-label="Close scorecard">✕</button></div></div>'
    + renderLineScore(model)
    + renderTeamTable(model.away, model.innCount)
    + renderTeamTable(model.home, model.innCount)
    + renderPitchers(model.away)
    + renderPitchers(model.home);
  if(ov) ov.scrollTop = sy;
  const ns = card.querySelectorAll('.sc-scroll');
  for(let z2=0;z2<ns.length && z2<prevScroll.length;z2++) ns[z2].scrollLeft = prevScroll[z2];
}

function setMsg(msg){
  const card = document.getElementById('scorecardCard');
  if(card) card.innerHTML = '<div class="sc-head"><div class="sc-title" id="scorecardTitle">Scorecard</div>'
    + '<button class="sc-close" onclick="closeScorecardOverlay()" aria-label="Close scorecard">✕</button></div>'
    + '<div class="sc-msg">'+esc(msg)+'</div>';
}

async function loadScorecard(){
  const gamePk = state.scorecardGamePk;
  if(!gamePk) return;
  // Final games are immutable for the day — serve the built model instantly.
  const cached = state.scorecardCache[gamePk];
  if(cached && cached.isFinal){
    state.scorecardModel = cached;
    renderInto(cached);
    return;
  }
  try{
    const res = await fetch(MLB_BASE_V1_1+'/game/'+gamePk+'/feed/live');
    if(!res.ok) throw new Error('HTTP '+res.status);
    const feed = await res.json();
    if(state.scorecardGamePk!==gamePk || !state.scorecardOverlayOpen) return;
    const model = buildModel(feed);
    state.scorecardModel = model;
    if(model.isFinal) state.scorecardCache[gamePk] = model;
    renderInto(model);
  }catch(e){
    // Only clobber the view on the first load; let refresh failures pass
    // silently so a flaky poll doesn't wipe a good scorecard mid-game.
    if(state.scorecardOverlayOpen && !state.scorecardModel) setMsg('Could not load scorecard data.');
  }
}

// Keep Tab focus inside the open overlay.
function trapFocus(e){
  if(e.key!=='Tab') return;
  const el = document.getElementById('scorecardOverlay');
  if(!el || !state.scorecardOverlayOpen) return;
  const f = [].slice.call(el.querySelectorAll('button, [href], [tabindex]:not([tabindex="-1"])'))
            .filter(function(n){ return n.offsetParent !== null; });
  if(!f.length) return;
  const first = f[0], last = f[f.length-1];
  if(e.shiftKey && document.activeElement===first){ e.preventDefault(); last.focus(); }
  else if(!e.shiftKey && document.activeElement===last){ e.preventDefault(); first.focus(); }
}

export function openScorecardOverlay(gamePk){
  const el = document.getElementById('scorecardOverlay');
  if(!el) return;
  state.scorecardOverlayOpen = true;
  state.scorecardGamePk = gamePk;
  el.style.display = 'flex';
  setMsg('Loading scorecard…');
  document.addEventListener('keydown', trapFocus, true);
  const cb = el.querySelector('.sc-close');
  if(cb) cb.focus();
  loadScorecard();
  if(refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(function(){
    if(state.scorecardOverlayOpen && state.scorecardModel && state.scorecardModel.isLive) loadScorecard();
  }, TIMING.LIVE_REFRESH_MS);
}

export function closeScorecardOverlay(){
  const el = document.getElementById('scorecardOverlay');
  state.scorecardOverlayOpen = false;
  state.scorecardGamePk = null;
  state.scorecardModel = null;
  document.removeEventListener('keydown', trapFocus, true);
  if(refreshTimer){ clearInterval(refreshTimer); refreshTimer = null; }
  if(el) el.style.display = 'none';
}
