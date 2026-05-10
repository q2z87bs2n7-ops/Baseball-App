// Stats — Player detail card with 6 tabs:
//   Overview · Splits · Game Log · Arsenal (pitchers) · Advanced · Career
// Plus the sparkline SVG, hot-zone heat map, and switchVsBasis (MLB vs team
// roster avg toggle). Selected by clicking a player from Roster, Leaders, or
// search. Tab switches re-render from cached fetches; per-tab fetchers are
// memoized in state.* caches with 24h TTL.

import { state } from '../../state.js';
import { SEASON, MLB_BASE } from '../../config/constants.js';
import { fmt, fmtRate } from '../../utils/format.js';
import { computePercentile, tierFromPercentile, pctBar, rankCaption, avgChip, leagueAverage, teamAverage, leaderEntry } from '../../utils/stats-math.js';
import { scrollTabIntoView } from './_shared.js';
import { fetchLeagueLeaders } from '../../data/leaders.js';
import { renderPlayerList } from './roster.js';

export async function selectPlayer(id,type){
  var playerObj=(state.rosterData[type]||[]).find(function(p){return p.person.id===id;})||{person:{id:id}};
  state.selectedPlayer=playerObj;renderPlayerList();
  document.getElementById('playerStatsTitle').textContent=playerObj.person&&playerObj.person.fullName?playerObj.person.fullName:'Player Stats';
  document.getElementById('playerStats').innerHTML='<div class="loading">Loading stats...</div>';
  try{
    var group=type==='pitching'?'pitching':type==='fielding'?'fielding':'hitting';
    // Fire player-stats fetch + league-leaders fetch in parallel. League leaders
    // are TTL-cached per group and feed percentile bars in renderPlayerStats.
    // Game log is also kicked off (Sprint 2) for the sparkline + Game Log tab —
    // not awaited; onGameLogResolved repaints when it lands.
    var [r]=await Promise.all([
      fetch(MLB_BASE+'/people/'+id+'/stats?stats=season&season='+SEASON+'&group='+group),
      group==='fielding'?Promise.resolve():fetchLeagueLeaders(group)
    ]);
    if(group!=='fielding'){
      fetchGameLog(id, group).then(function(){ onGameLogResolved(id, group); });
    }
    var d=await r.json();
    var stats=d.stats&&d.stats[0]&&d.stats[0].splits&&d.stats[0].splits[0]&&d.stats[0].splits[0].stat;
    if(!stats){
      document.getElementById('playerStats').innerHTML='<div class="empty-state">No '+SEASON+' stats available yet</div>';
      if(window.innerWidth<=767||(window.innerWidth<=1024&&window.matchMedia('(orientation:portrait)').matches)){document.getElementById('playerStats').scrollIntoView({behavior:'smooth',block:'end'});}
      return;
    }
    renderPlayerStats(stats,group);
    if(window.innerWidth<=767||(window.innerWidth<=1024&&window.matchMedia('(orientation:portrait)').matches)){document.getElementById('playerStats').scrollIntoView({behavior:'smooth',block:'end'});}
  }catch(e){
    document.getElementById('playerStats').innerHTML='<div class="error">Could not load stats</div>';
  }
}

// Player Stats card now hosts a 4-tab layout (Overview / Splits / Game Log /
// Advanced). renderPlayerStats is the orchestrator: it caches the current
// player's season stat, syncs the tab buttons, and emits all four panels with
// only the active one visible. Tab switches are cheap class-flip operations
// (see switchPlayerStatsTab) — no re-fetch required between Overview and the
// placeholders, and per-tab fetchers (gameLog, splits, arsenal) are wired in
// later Sprint-2 steps.
function renderPlayerStats(s,group){
  state.selectedPlayerStat={ stat: s, group: group };
  var activeTab=state.activeStatsTab||'overview';
  // Fielding only has Overview content; hide the other tab buttons.
  var fieldingMode=group==='fielding';
  if(fieldingMode)activeTab='overview';
  document.querySelectorAll('#playerTabs .player-tab').forEach(function(b){
    var t=b.dataset.tab;
    b.style.display=fieldingMode&&t!=='overview'?'none':'';
    b.classList.toggle('active', t===activeTab);
  });
  var html='<div class="player-tab-panels">'+
    '<div class="player-tab-panel" data-tab="overview"'+(activeTab!=='overview'?' hidden':'')+'>'+renderOverviewTab(s,group)+'</div>'+
    '<div class="player-tab-panel" data-tab="splits"'+(activeTab!=='splits'?' hidden':'')+'>'+renderSplitsPlaceholder()+'</div>'+
    '<div class="player-tab-panel" data-tab="gamelog"'+(activeTab!=='gamelog'?' hidden':'')+'>'+renderGameLogPlaceholder()+'</div>'+
    '<div class="player-tab-panel" data-tab="advanced"'+(activeTab!=='advanced'?' hidden':'')+'>'+renderAdvancedPlaceholder(group)+'</div>'+
    '<div class="player-tab-panel" data-tab="career"'+(activeTab!=='career'?' hidden':'')+'>'+renderCareerPlaceholder()+'</div>'+
    '</div>';
  document.getElementById('playerStats').innerHTML=html;
  // If the active tab is a lazy-loaded one, kick off its fetch immediately so
  // selecting a new player while sitting on Splits / Game Log / Advanced
  // doesn't leave a stale "Loading..." in the panel.
  if(activeTab!=='overview'){
    var pid = state.selectedPlayer && state.selectedPlayer.person && state.selectedPlayer.person.id;
    if(pid){
      if(activeTab==='gamelog'){
        var glk = pid + ':' + (group==='fielding'?'hitting':group);
        if(state.gameLogCache[glk]) renderGameLogTab(pid, group);
        else fetchGameLog(pid, group).then(function(){ onGameLogResolved(pid, group); });
      } else if(activeTab==='splits'){
        var slk = pid + ':' + (group==='fielding'?'hitting':group);
        if(state.statSplitsCache[slk]) renderSplitsTab(pid, group);
        else fetchStatSplits(pid, group).then(function(){
          if(state.selectedPlayer && state.selectedPlayer.person && state.selectedPlayer.person.id===pid && state.activeStatsTab==='splits') renderSplitsTab(pid, group);
        });
      } else if(activeTab==='advanced' && group==='pitching'){
        if(state.pitchArsenalCache[pid]) renderArsenalTab(pid);
        else fetchPitchArsenal(pid).then(function(){
          if(state.selectedPlayer && state.selectedPlayer.person && state.selectedPlayer.person.id===pid && state.activeStatsTab==='advanced') renderArsenalTab(pid);
        });
      } else if(activeTab==='advanced' && group==='hitting'){
        if(state.advancedHittingCache[pid] && state.hotColdCache[pid]) renderAdvancedHittingTab(pid);
        else loadAdvancedHittingForTab(pid);
      } else if(activeTab==='career'){
        ensureCareerLoaded(pid, group);
      }
    }
  }
}

// Switch the active Player Stats tab. Persisted to localStorage. Re-uses the
// cached stat from state.selectedPlayerStat — no /people refetch. Per-tab
// lazy renderers (Game Log / Splits / Arsenal) fire the first time their tab
// is shown.
export function switchPlayerStatsTab(tab,btn){
  if(['overview','splits','gamelog','advanced','career'].indexOf(tab)<0)return;
  state.activeStatsTab=tab;
  if(typeof localStorage!=='undefined')localStorage.setItem('mlb_stats_tab',tab);
  document.querySelectorAll('#playerTabs .player-tab').forEach(function(b){b.classList.toggle('active', b.dataset.tab===tab);});
  document.querySelectorAll('.player-tab-panel').forEach(function(p){
    if(p.dataset.tab===tab)p.removeAttribute('hidden');
    else p.setAttribute('hidden','');
  });
  // Mobile: keep the freshly-activated tab in view within its scrollable
  // container (scrollTabIntoView only scrolls the parent, never the document).
  if(btn) scrollTabIntoView(btn);
  // Lazy renderers
  var sel = state.selectedPlayer;
  var pid = sel && sel.person && sel.person.id;
  var group = state.selectedPlayerStat ? state.selectedPlayerStat.group : (state.currentRosterTab||'hitting');
  if(!pid) return;
  if(tab==='gamelog'){
    var cacheKey = pid + ':' + (group==='fielding'?'hitting':group);
    if(!state.gameLogCache[cacheKey]){
      fetchGameLog(pid, group).then(function(){ onGameLogResolved(pid, group); });
    } else {
      renderGameLogTab(pid, group);
    }
  } else if(tab==='splits'){
    var splitKey = pid + ':' + (group==='fielding'?'hitting':group);
    if(!state.statSplitsCache[splitKey]){
      fetchStatSplits(pid, group).then(function(){
        if(state.selectedPlayer && state.selectedPlayer.person && state.selectedPlayer.person.id===pid && state.activeStatsTab==='splits'){
          renderSplitsTab(pid, group);
        }
      });
    } else {
      renderSplitsTab(pid, group);
    }
  } else if(tab==='advanced'){
    if(group==='pitching'){
      if(!state.pitchArsenalCache[pid]){
        fetchPitchArsenal(pid).then(function(){
          if(state.selectedPlayer && state.selectedPlayer.person && state.selectedPlayer.person.id===pid && state.activeStatsTab==='advanced'){
            renderArsenalTab(pid);
          }
        });
      } else {
        renderArsenalTab(pid);
      }
    } else if(group==='hitting'){
      if(!state.advancedHittingCache[pid] || !state.hotColdCache[pid]){
        loadAdvancedHittingForTab(pid);
      } else {
        renderAdvancedHittingTab(pid);
      }
    }
  } else if(tab==='career'){
    ensureCareerLoaded(pid, group);
  }
}

// Empty-state placeholders. Replaced by real renderers in subsequent sprint steps.
function renderSplitsPlaceholder(){
  return '<div class="tab-empty-state"><div class="tab-empty-icon">📊</div><h4>Splits panel</h4><p>Loading splits...</p></div>';
}

// ── Sprint 2 / Step 4: Splits panel ──────────────────────────────────────
const STATSPLITS_TTL_MS = 24 * 60 * 60 * 1000;
const SPLIT_LABELS = {
  vl: 'vs LHP', vr: 'vs RHP',
  h:  'Home',   a:  'Away',
  risp: 'RISP', e: 'Bases Empty', r: 'Runners On', lc: 'Late & Close'
};

async function fetchStatSplits(playerId, group){
  if(!playerId) return null;
  if(group==='fielding') group='hitting';
  var key = playerId+':'+group;
  var cached = state.statSplitsCache[key];
  if(cached && Date.now()-cached.ts < STATSPLITS_TTL_MS) return cached.splits;
  try{
    var codes = 'vl,vr,h,a,risp,e,r,lc';
    var r = await fetch(MLB_BASE+'/people/'+playerId+'/stats?stats=statSplits&sitCodes='+codes+'&season='+SEASON+'&group='+group);
    var d = await r.json();
    var splits = (d.stats && d.stats[0] && d.stats[0].splits) ? d.stats[0].splits : [];
    state.statSplitsCache[key] = { splits: splits, ts: Date.now() };
    return splits;
  }catch(e){
    return null;
  }
}

function renderSplitsTab(playerId, group){
  if(group==='fielding') group='hitting';
  var key = playerId+':'+group;
  var cached = state.statSplitsCache[key];
  var panelEl = document.querySelector('.player-tab-panel[data-tab="splits"]');
  if(!panelEl) return;
  if(!cached){
    panelEl.innerHTML = renderSplitsPlaceholder();
    return;
  }
  var splits = cached.splits;
  if(!splits.length){
    panelEl.innerHTML = '<div class="tab-empty-state"><div class="tab-empty-icon">📊</div><h4>No split data</h4><p>This player has no '+SEASON+' splits recorded yet.</p></div>';
    return;
  }
  var byCode = {};
  splits.forEach(function(s){ if(s.split && s.split.code) byCode[s.split.code]=s; });
  // Mini-bar denominator: relative position of OPS within this player's
  // splits range, so the longest bar = best split, shortest = worst. For
  // pitchers, OPS-against still works — longer = higher OPS allowed.
  var opsValues = splits.map(function(s){ return parseFloat(s.stat && s.stat.ops); }).filter(function(v){ return !isNaN(v); });
  var opsMin = opsValues.length ? Math.min.apply(null, opsValues) : 0;
  var opsMax = opsValues.length ? Math.max.apply(null, opsValues) : 1;
  if(opsMax === opsMin) opsMax = opsMin + 0.001;
  function fmtR(n){ var s = n.toFixed(3); return s.charAt(0)==='0' ? s.slice(1) : s; }
  function row(code){
    var s = byCode[code];
    if(!s || !s.stat) return '';
    var st = s.stat;
    var avg = parseFloat(st.avg)||0;
    var obp = parseFloat(st.obp)||0;
    var slg = parseFloat(st.slg)||0;
    var ops = parseFloat(st.ops)||0;
    var pct = (ops - opsMin)/(opsMax - opsMin);
    var w = Math.max(8, Math.min(100, pct*100));
    var label = SPLIT_LABELS[code] || code;
    var pa = parseInt(st.plateAppearances,10) || parseInt(st.atBats,10) || 0;
    return '<div class="split-row">'+
      '<div class="split-row-head">'+
        '<span class="split-row-label">'+label+'</span>'+
        '<span class="split-row-line">'+fmtR(avg)+' / '+fmtR(obp)+' / '+fmtR(slg)+'</span>'+
      '</div>'+
      '<div class="split-row-bar"><i style="width:'+w.toFixed(1)+'%"></i></div>'+
      '<div class="split-row-meta"><span>OPS '+fmtR(ops)+'</span>'+(pa?'<span>'+pa+' PA</span>':'')+'</div>'+
    '</div>';
  }
  function section(label, codes){
    var rows = codes.map(row).filter(Boolean).join('');
    if(!rows) return '';
    return '<div class="splits-section"><div class="splits-section-head">'+label+'</div>'+rows+'</div>';
  }
  var groupHint = group==='pitching' ? '<div class="splits-hint">Slash lines reflect <strong>opponents’</strong> AVG / OBP / SLG against this pitcher.</div>' : '';
  var html = groupHint + '<div class="splits-grid">'+
    '<div class="splits-col">'+
      section('vs Handedness', ['vl','vr'])+
      section('Home / Away', ['h','a'])+
    '</div>'+
    '<div class="splits-col">'+
      section('Situations', ['risp','e','r','lc'])+
    '</div>'+
  '</div>';
  panelEl.innerHTML = html;
}

// ── Sprint 2 / Step 5: Pitch arsenal donut ───────────────────────────────
const PITCH_ARSENAL_TTL_MS = 24 * 60 * 60 * 1000;
const PITCH_COLORS = {
  FF:'#E04848', FA:'#E04848',
  SI:'#F08C3C', FT:'#F08C3C',
  FC:'#FF6FB5',
  SL:'#F0D03C', ST:'#D9B83C',
  CU:'#7060FF', KC:'#9078FF', CS:'#9078FF',
  CH:'#3CBE64',
  FS:'#3CB4B0', SC:'#3CB4B0',
  KN:'#888888', EP:'#777777', PO:'#666666',
  SV:'#9F7CFF'
};
const PITCH_LABELS = {
  FF:'4-Seam', FA:'Fastball',
  SI:'Sinker', FT:'2-Seam',
  FC:'Cutter',
  SL:'Slider', ST:'Sweeper',
  CU:'Curveball', KC:'Knuckle-Curve', CS:'Slow Curve',
  CH:'Changeup',
  FS:'Splitter', SC:'Screwball',
  KN:'Knuckleball', EP:'Eephus', PO:'Pitchout',
  SV:'Slurve'
};

async function fetchPitchArsenal(playerId){
  if(!playerId) return null;
  var cached = state.pitchArsenalCache[playerId];
  if(cached && Date.now()-cached.ts < PITCH_ARSENAL_TTL_MS) return cached.data;
  try{
    var r = await fetch(MLB_BASE+'/people/'+playerId+'/stats?stats=pitchArsenal&season='+SEASON);
    var d = await r.json();
    var splits = (d.stats && d.stats[0] && d.stats[0].splits) ? d.stats[0].splits : [];
    var arsenal = splits.map(function(s){
      var st = s.stat || {};
      // The pitchArsenal endpoint nests pitch identity under stat.type:
      //   stat.type.code        e.g. "FF"
      //   stat.type.description e.g. "Four-Seam Fastball"
      // Older docs / mirrors sometimes used flat keys, so we fall through.
      var t = st.type || {};
      return {
        code: t.code || st.pitchTypeCode || (s.split && s.split.code) || '',
        type: t.description || st.pitchType || st.description || (s.split && s.split.description) || '',
        count: parseInt(st.count, 10) || parseInt(st.numP, 10) || 0,
        pct: parseFloat(st.percentage) || parseFloat(st.pitchTypePercentage) || 0,
        velo: parseFloat(st.averageSpeed) || parseFloat(st.averageVelocity) || 0
      };
    }).filter(function(p){ return p.pct > 0 || p.count > 0; });
    // The API returns percentage as a fraction in [0,1]. Normalize to a 0–100
    // scale so the renderer can format with a single .toFixed(1)+'%' regardless
    // of which payload variant the backend is on.
    var maxPct = arsenal.reduce(function(m,p){ return Math.max(m, p.pct); }, 0);
    if(maxPct > 0 && maxPct <= 1.5){
      arsenal.forEach(function(p){ p.pct = p.pct * 100; });
    }
    state.pitchArsenalCache[playerId] = { data: arsenal, ts: Date.now() };
    return arsenal;
  }catch(e){
    return null;
  }
}

function renderArsenalTab(playerId){
  var cached = state.pitchArsenalCache[playerId];
  var panelEl = document.querySelector('.player-tab-panel[data-tab="advanced"]');
  if(!panelEl) return;
  if(!cached){
    panelEl.innerHTML = '<div class="tab-empty-state"><div class="tab-empty-icon">🎯</div><h4>Pitch arsenal</h4><p>Loading pitch arsenal...</p></div>';
    return;
  }
  var arsenal = cached.data.slice();
  if(!arsenal.length){
    panelEl.innerHTML = '<div class="tab-empty-state"><div class="tab-empty-icon">🎯</div><h4>No pitch data</h4><p>No '+SEASON+' pitch arsenal recorded yet.</p></div>';
    return;
  }
  arsenal.sort(function(a,b){ return b.pct - a.pct; });
  var total = arsenal.reduce(function(s,p){ return s + p.pct; }, 0) || 100;
  var size = 140, stroke = 22, r = (size - stroke)/2, circ = 2 * Math.PI * r;
  var offset = 0;
  var segments = arsenal.map(function(p){
    var portion = (p.pct / total) * circ;
    var color = PITCH_COLORS[p.code] || '#888';
    var seg = '<circle cx="'+(size/2)+'" cy="'+(size/2)+'" r="'+r+'" fill="none" stroke="'+color+'" stroke-width="'+stroke+'"'+
      ' stroke-dasharray="'+portion.toFixed(2)+' '+circ.toFixed(2)+'"'+
      ' stroke-dashoffset="-'+offset.toFixed(2)+'"'+
      ' transform="rotate(-90 '+(size/2)+' '+(size/2)+')"/>';
    offset += portion;
    return seg;
  }).join('');
  var top = arsenal[0];
  var topLbl = top ? (PITCH_LABELS[top.code] || top.type || top.code || '—') : '—';
  var donut = '<div class="arsenal-donut">'+
    '<svg viewBox="0 0 '+size+' '+size+'" width="'+size+'" height="'+size+'">'+segments+'</svg>'+
    '<div class="arsenal-donut-center">'+
      '<div class="arsenal-donut-pct">'+(top?top.pct.toFixed(0):'—')+'%</div>'+
      '<div class="arsenal-donut-lbl">'+topLbl+'</div>'+
    '</div>'+
  '</div>';
  var list = '<div class="arsenal-list">'+arsenal.map(function(p){
    var color = PITCH_COLORS[p.code] || '#888';
    var label = PITCH_LABELS[p.code] || p.type || p.code || '?';
    var velo = p.velo ? p.velo.toFixed(1)+' mph' : '';
    return '<div class="arsenal-row">'+
      '<span class="arsenal-dot" style="background:'+color+'"></span>'+
      '<span class="arsenal-row-label">'+label+'</span>'+
      '<span class="arsenal-row-pct">'+p.pct.toFixed(1)+'%</span>'+
      '<span class="arsenal-row-velo">'+velo+'</span>'+
    '</div>';
  }).join('')+'</div>';
  panelEl.innerHTML = '<div class="arsenal-grid">'+donut+list+'</div>';
}

// ── Sprint 3 / Step 1: Statcast Advanced for hitters ─────────────────────
const ADV_HITTING_TTL_MS = 24 * 60 * 60 * 1000;

// Fetches sabermetrics + seasonAdvanced in parallel and merges them into a
// single stat blob keyed in state.advancedHittingCache. Both endpoints are
// part of the public MLB Stats API and reliably populated for qualified
// hitters. (Earlier v4.6.18 attempt also pulled `expectedStatistics`, but
// that endpoint is inconsistently exposed and Statcast-flavored xBA / xSLG /
// xwOBA / exit velo / barrel rate are sourced from Baseball Savant — a
// separate Statcast service we don't proxy. The advanced view focuses on
// what MLB Stats API actually returns.)
//
// sabermetrics  → woba, wRaa, wRc, wRcPlus, babip (hitting)
// seasonAdvanced → babip, iso, groundOutsToAirouts, walks/strikeouts per PA,
//                  pitches per PA, etc.
async function fetchAdvancedHitting(playerId){
  if(!playerId) return null;
  var cached = state.advancedHittingCache[playerId];
  if(cached && Date.now()-cached.ts < ADV_HITTING_TTL_MS) return cached.stat;
  try{
    var urls = [
      MLB_BASE+'/people/'+playerId+'/stats?stats=sabermetrics&season='+SEASON+'&group=hitting',
      MLB_BASE+'/people/'+playerId+'/stats?stats=seasonAdvanced&season='+SEASON+'&group=hitting'
    ];
    var responses = await Promise.all(urls.map(function(u){
      return fetch(u).then(function(r){ return r.ok ? r.json() : null; }).catch(function(){ return null; });
    }));
    var merged = {};
    responses.forEach(function(d){
      if(!d || !d.stats) return;
      d.stats.forEach(function(block){
        var split = block.splits && block.splits[0];
        if(split && split.stat) Object.assign(merged, split.stat);
      });
    });
    state.advancedHittingCache[playerId] = { stat: merged, ts: Date.now() };
    return merged;
  }catch(e){
    return null;
  }
}

// Driver for the Advanced (hitter) tab — fires the metrics fetch and the
// hot-zone fetch in parallel so the section paints when each lands. Lazy:
// only triggered from the switchPlayerStatsTab dispatch.
async function loadAdvancedHittingForTab(playerId){
  await Promise.all([
    fetchAdvancedHitting(playerId),
    fetchHotColdZones(playerId)
  ]);
  if(state.selectedPlayer && state.selectedPlayer.person && state.selectedPlayer.person.id === playerId && state.activeStatsTab === 'advanced'){
    renderAdvancedHittingTab(playerId);
  }
}

// Renders the advanced hitting view into the Advanced panel. Reads each
// metric across the case-variants the MLB API actually uses (sabermetrics
// returns mixed-case keys like wRaa / wRc / wRcPlus; seasonAdvanced lowercases
// most). Every field is independently optional so the row count adapts.
function renderAdvancedHittingTab(playerId){
  var cached = state.advancedHittingCache[playerId];
  var panelEl = document.querySelector('.player-tab-panel[data-tab="advanced"]');
  if(!panelEl) return;
  if(!cached){
    panelEl.innerHTML = '<div class="tab-empty-state"><div class="tab-empty-icon">📈</div><h4>Advanced Metrics</h4><p>Loading advanced metrics…</p></div>';
    return;
  }
  var s = cached.stat || {};
  function num(v){ var n = parseFloat(v); return isNaN(n) ? null : n; }
  function pick(){ for(var i=0;i<arguments.length;i++){ var v = num(arguments[i]); if(v != null) return v; } return null; }
  function fmtR(n){ var v = n.toFixed(3); return v.charAt(0)==='0' ? v.slice(1) : v; }
  function fmtPct(n){ return (n>1.5 ? n.toFixed(1) : (n*100).toFixed(1))+'%'; }

  // Real MLB Stats API field names (sabermetrics + seasonAdvanced for hitters):
  var woba    = pick(s.woba, s.wOba);
  var babip   = pick(s.babip);
  var iso     = pick(s.iso);
  var wRcPlus = pick(s.wRcPlus, s.wrcPlus);
  var wRaa    = pick(s.wRaa, s.wraa);
  var wRc     = pick(s.wRc, s.wrc);
  var go_ao   = pick(s.groundOutsToAirouts, s.groundOutsToAirOuts);
  var walksPerPa = pick(s.walksPerPlateAppearance);
  var ksPerPa    = pick(s.strikeoutsPerPlateAppearance);
  var pitchesPerPa = pick(s.pitchesPerPlateAppearance);
  var atBatsPerHr  = pick(s.atBatsPerHomeRun);
  var totalBases   = pick(s.totalBases);
  var extraBaseHits= pick(s.extraBaseHits);

  // Hero trio — wOBA · BABIP · wRC+ if available, else ISO.
  var heroParts = [];
  if(woba != null)    heroParts.push({ v:fmtR(woba), l:'wOBA' });
  if(babip != null)   heroParts.push({ v:fmtR(babip), l:'BABIP' });
  if(wRcPlus != null) heroParts.push({ v:Math.round(wRcPlus), l:'wRC+' });
  else if(iso != null)heroParts.push({ v:fmtR(iso), l:'ISO' });
  var hero = heroParts.length
    ? '<div class="adv-hero-row">'+heroParts.map(function(p){return '<div class="stat-box"><div class="stat-val">'+p.v+'</div><div class="stat-lbl">'+p.l+'</div></div>';}).join('')+'</div>'
    : '';

  // Supporting grid
  var rows = [];
  if(wRcPlus != null && iso != null) rows.push({l:'ISO', v: fmtR(iso)});
  if(wRaa != null) rows.push({l:'wRAA', v: wRaa.toFixed(1)});
  if(wRc != null)  rows.push({l:'wRC',  v: wRc.toFixed(1)});
  if(walksPerPa != null) rows.push({l:'BB rate', v: fmtPct(walksPerPa)});
  if(ksPerPa != null)    rows.push({l:'K rate',  v: fmtPct(ksPerPa)});
  if(pitchesPerPa != null) rows.push({l:'P / PA', v: pitchesPerPa.toFixed(2)});
  if(atBatsPerHr != null && atBatsPerHr > 0) rows.push({l:'AB / HR', v: atBatsPerHr.toFixed(1)});
  if(go_ao != null) rows.push({l:'GO / AO', v: go_ao.toFixed(2)});
  if(extraBaseHits != null) rows.push({l:'XBH', v: Math.round(extraBaseHits)});
  if(totalBases != null) rows.push({l:'Total Bases', v: Math.round(totalBases)});

  var grid = rows.length
    ? '<div class="adv-stat-grid">'+rows.map(function(r){return '<div class="stat-box"><div class="stat-val">'+r.v+'</div><div class="stat-lbl">'+r.l+'</div></div>';}).join('')+'</div>'
    : '';

  if(!hero && !grid){
    panelEl.innerHTML = '<div class="tab-empty-state"><div class="tab-empty-icon">📈</div><h4>No advanced metrics</h4><p>This player has no '+SEASON+' advanced data yet.</p></div>';
    return;
  }
  var note = '<div class="adv-source-note">Advanced metrics from MLB Stats API · sabermetrics + seasonAdvanced. Statcast (xBA / xwOBA / exit velo / barrel rate) lives on Baseball Savant and is not proxied here.</div>';
  var heatmap = renderHotZoneSection(playerId);
  // Source note sits with the metrics it describes — it disclaims the
  // sabermetrics + seasonAdvanced data, not the hot/cold heat map below.
  panelEl.innerHTML = hero + grid + note + heatmap;
}

function renderGameLogPlaceholder(){
  return '<div class="tab-empty-state"><div class="tab-empty-icon">📅</div><h4>Last-10 game log</h4><p>Loading game log...</p></div>';
}

// ── Sprint 3 / Step 5: Strike-zone heat map (hitters) ───────────────────
// Pulls the 13-zone hot/cold matrix from /people/{id}/stats?stats=hotColdZones
// and renders it as a 3x3 SVG strike zone (zones 1-9, "in zone") under the
// Statcast Advanced metrics. Pure batter-AVG flavor for v1; the API also
// returns slugging / exit-velo zone matrices we could surface later. Statcast
// hit coordinates (the field-map dot spray chart) live on Baseball Savant
// and aren't proxied here.
const HOTCOLD_TTL_MS = 24 * 60 * 60 * 1000;

async function fetchHotColdZones(playerId){
  if(!playerId) return null;
  var cached = state.hotColdCache[playerId];
  if(cached && Date.now()-cached.ts < HOTCOLD_TTL_MS) return cached.data;
  try{
    var r = await fetch(MLB_BASE+'/people/'+playerId+'/stats?stats=hotColdZones&season='+SEASON+'&group=hitting');
    if(!r.ok){ state.hotColdCache[playerId] = { data: [], ts: Date.now() }; return []; }
    var d = await r.json();
    var splits = (d.stats && d.stats[0] && d.stats[0].splits) || [];
    state.hotColdCache[playerId] = { data: splits, ts: Date.now() };
    return splits;
  }catch(e){
    state.hotColdCache[playerId] = { data: [], ts: Date.now() };
    return [];
  }
}

// Picks the "Batting Avg" (or closest match) zone matrix from the hotColdZones
// payload. Each split.stat carries a `name` ("Batting Avg" / "Slugging Pct" /
// "Exit Velocity") and a `zones` array. Zones 1-9 = inside the strike zone in
// row-major order (top→bottom, left→right from catcher's view).
function pickAvgZoneMatrix(splits){
  if(!splits || !splits.length) return null;
  var preferred = null;
  for(var i=0;i<splits.length;i++){
    var s = splits[i].stat;
    if(!s || !s.zones) continue;
    var name = (s.name||'').toLowerCase();
    if(name.indexOf('batting') >= 0 || name.indexOf('avg') >= 0){
      preferred = s;
      break;
    }
    if(!preferred) preferred = s; // fallback to first available
  }
  return preferred;
}

// Returns CSS background-color for a zone cell based on its AVG. Hand-rolled
// 3-stop heat scale: deep red ≤.180, yellow ~.250, deep green ≥.330. Falls
// back to the API-provided color when present.
function avgHeatColor(value){
  var n = parseFloat(value);
  if(isNaN(n)) return 'rgba(255,255,255,.05)';
  // Normalize to 0-1 across .150 → .380
  var t = Math.max(0, Math.min(1, (n - 0.150) / (0.380 - 0.150)));
  // Two-segment lerp: red→yellow (0→0.5), yellow→green (0.5→1)
  var r,g,b;
  if(t < 0.5){
    var u = t / 0.5;
    r = Math.round(224 + (240-224)*u);
    g = Math.round( 72 + (208- 72)*u);
    b = Math.round( 72 + ( 60- 72)*u);
  } else {
    var u2 = (t - 0.5) / 0.5;
    r = Math.round(240 + ( 60-240)*u2);
    g = Math.round(208 + (190-208)*u2);
    b = Math.round( 60 + (100- 60)*u2);
  }
  return 'rgba('+r+','+g+','+b+',.55)';
}

// Builds the 3x3 strike-zone heat map HTML. Returns '' when the data is
// missing — caller decides whether to render a section header.
function renderHotZoneSection(playerId){
  var cached = state.hotColdCache[playerId];
  if(!cached || !cached.data || !cached.data.length) return '';
  var matrix = pickAvgZoneMatrix(cached.data);
  if(!matrix || !matrix.zones) return '';
  // Map zones by id for predictable order.
  var byZone = {};
  matrix.zones.forEach(function(z){ if(z && z.zone) byZone[String(z.zone).replace(/^0/,'')] = z; });
  function fmtR(v){ var n = parseFloat(v); if(isNaN(n)) return '—'; var s = n.toFixed(3); return s.charAt(0)==='0'?s.slice(1):s; }
  // Build the 3x3 inner zone grid (zones 1-9).
  var cells = '';
  for(var i=1;i<=9;i++){
    var z = byZone[String(i)];
    var v = z && (z.value != null ? z.value : null);
    var bg = z ? avgHeatColor(v) : 'rgba(255,255,255,.04)';
    cells += '<div class="hotzone-cell" style="background:'+bg+'">'+
      '<div class="hotzone-val">'+(z ? fmtR(v) : '—')+'</div>'+
    '</div>';
  }
  var label = matrix.name || 'Batting Avg';
  return '<div class="hotzone-section">'+
    '<div class="hotzone-section-head">🎯 Strike Zone Heat Map · '+label+'</div>'+
    '<div class="hotzone-frame">'+
      '<div class="hotzone-axis-top">High</div>'+
      '<div class="hotzone-axis-left">Inside</div>'+
      '<div class="hotzone-grid">'+cells+'</div>'+
      '<div class="hotzone-axis-right">Outside</div>'+
      '<div class="hotzone-axis-bot">Low</div>'+
    '</div>'+
    '<div class="hotzone-legend">'+
      '<span class="hotzone-legend-bar"></span>'+
      '<span class="hotzone-legend-label">cold .150</span>'+
      '<span class="hotzone-legend-spacer"></span>'+
      '<span class="hotzone-legend-label">.380 hot</span>'+
    '</div>'+
    '<div class="hotzone-foot">View from catcher · inside / outside relative to RHB. Statcast spray-chart coordinates require Baseball Savant and aren’t proxied here.</div>'+
  '</div>';
}


// ── Sprint 3 / Step 3: Career history (year-by-year) ─────────────────────
// Awards are out of scope for the prod release; the dedicated Awards module
// (/people/{id}/awards integration, AWARD_ICONS catalog, chip strip) was
// dropped in v4.6.21. state.awardsCache stays unset.
const CAREER_TTL_MS = 24 * 60 * 60 * 1000;

async function ensureCareerLoaded(playerId, group){
  if(!playerId) return;
  var cached = state.careerCache[playerId];
  if(cached && Date.now()-cached.ts < CAREER_TTL_MS){
    renderCareerTab(playerId, group);
    return;
  }
  var careerUrl = MLB_BASE+'/people/'+playerId+'/stats?stats=yearByYear&group=hitting,pitching';
  try{
    var cR = await fetch(careerUrl).then(function(r){ return r.ok ? r.json() : null; }).catch(function(){ return null; });
    var hitting = [], pitching = [];
    if(cR && cR.stats){
      cR.stats.forEach(function(block){
        var g = block.group && block.group.displayName;
        (block.splits || []).forEach(function(sp){
          var row = {
            season: sp.season,
            teamId: sp.team && sp.team.id,
            teamAbbr: sp.team && (sp.team.abbreviation || sp.team.name),
            stat: sp.stat || {}
          };
          if(g === 'hitting') hitting.push(row);
          else if(g === 'pitching') pitching.push(row);
        });
      });
    }
    state.careerCache[playerId] = { hitting: hitting, pitching: pitching, ts: Date.now() };
  }catch(e){
    state.careerCache[playerId] = { hitting: [], pitching: [], ts: Date.now() };
  }
  // Re-render only if the user is still on this player + tab
  if(state.selectedPlayer && state.selectedPlayer.person && state.selectedPlayer.person.id === playerId && state.activeStatsTab === 'career'){
    renderCareerTab(playerId, group);
  }
}

function renderCareerPlaceholder(){
  return '<div class="tab-empty-state"><div class="tab-empty-icon">🗂️</div><h4>Career history</h4><p>Loading year-by-year stats…</p></div>';
}

function renderCareerTab(playerId, group){
  var panelEl = document.querySelector('.player-tab-panel[data-tab="career"]');
  if(!panelEl) return;
  var career = state.careerCache[playerId];
  if(!career){
    panelEl.innerHTML = renderCareerPlaceholder();
    return;
  }
  var hittingRows = (career.hitting || []).slice();
  var pitchingRows = (career.pitching || []).slice();
  // Year-asc display: oldest at top, most-recent at bottom (matches Baseball
  // Reference convention).
  hittingRows.sort(function(a,b){ return parseInt(a.season,10)-parseInt(b.season,10); });
  pitchingRows.sort(function(a,b){ return parseInt(a.season,10)-parseInt(b.season,10); });
  if(!hittingRows.length && !pitchingRows.length){
    panelEl.innerHTML = '<div class="tab-empty-state"><div class="tab-empty-icon">🗂️</div><h4>No career data</h4><p>This player has no recorded MLB seasons yet.</p></div>';
    return;
  }
  function fmtR(v){ if(v==null||v==='') return '—'; var n=parseFloat(v); if(isNaN(n)) return String(v); var s=n.toFixed(3); return s.charAt(0)==='0'?s.slice(1):s; }
  function fmtN(v, d){ if(v==null||v==='') return '—'; var n=parseFloat(v); if(isNaN(n)) return String(v); return n.toFixed(d==null?0:d); }
  function fmtIp(v){ if(v==null||v==='') return '—'; return String(v); }
  function intOr(v){ if(v==null||v==='') return '—'; var n=parseInt(v,10); return isNaN(n)?String(v):String(n); }

  // Year-by-year tables
  function tableFor(rows, kind){
    if(!rows.length) return '';
    var cols, headerHtml;
    if(kind === 'hitting'){
      cols = [
        ['season','Year', function(r){ return r.season; }],
        ['team','Team',  function(r){ return r.teamAbbr || ''; }],
        ['g',  'G',  function(r){ return intOr(r.stat.gamesPlayed); }],
        ['pa', 'PA', function(r){ return intOr(r.stat.plateAppearances); }],
        ['avg','AVG',function(r){ return fmtR(r.stat.avg); }],
        ['hr', 'HR', function(r){ return intOr(r.stat.homeRuns); }],
        ['rbi','RBI',function(r){ return intOr(r.stat.rbi); }],
        ['sb', 'SB', function(r){ return intOr(r.stat.stolenBases); }],
        ['obp','OBP',function(r){ return fmtR(r.stat.obp); }],
        ['slg','SLG',function(r){ return fmtR(r.stat.slg); }],
        ['ops','OPS',function(r){ return fmtR(r.stat.ops); }]
      ];
    } else {
      cols = [
        ['season','Year', function(r){ return r.season; }],
        ['team','Team', function(r){ return r.teamAbbr || ''; }],
        ['g',  'G',   function(r){ return intOr(r.stat.gamesPlayed); }],
        ['ip', 'IP',  function(r){ return fmtIp(r.stat.inningsPitched); }],
        ['w',  'W',   function(r){ return intOr(r.stat.wins); }],
        ['l',  'L',   function(r){ return intOr(r.stat.losses); }],
        ['era','ERA', function(r){ return fmtN(r.stat.era,2); }],
        ['whip','WHIP',function(r){ return fmtN(r.stat.whip,2); }],
        ['k',  'K',   function(r){ return intOr(r.stat.strikeOuts); }],
        ['bb', 'BB',  function(r){ return intOr(r.stat.baseOnBalls); }],
        ['sv', 'SV',  function(r){ return intOr(r.stat.saves); }]
      ];
    }
    headerHtml = '<tr>'+cols.map(function(c){return '<th>'+c[1]+'</th>';}).join('')+'</tr>';
    var bodyHtml = rows.map(function(r){
      return '<tr>'+cols.map(function(c){return '<td class="career-col-'+c[0]+'">'+c[2](r)+'</td>';}).join('')+'</tr>';
    }).join('');
    var titleEm = kind === 'hitting' ? '⚾ Hitting' : '🥎 Pitching';
    return '<div class="career-section">'+
      '<div class="career-section-head">'+titleEm+' · '+rows.length+' season'+(rows.length===1?'':'s')+'</div>'+
      '<div class="career-table-wrap"><table class="career-table">'+
        '<thead>'+headerHtml+'</thead><tbody>'+bodyHtml+'</tbody>'+
      '</table></div>'+
    '</div>';
  }
  // Order: lead with the player's primary group based on the active roster tab
  // when both groups have data (two-way players).
  var primary = group === 'pitching' ? 'pitching' : 'hitting';
  var secondary = primary === 'hitching' ? 'pitching' : (primary === 'pitching' ? 'hitting' : 'pitching');
  var tablesHtml = '';
  if(primary === 'pitching'){
    tablesHtml = tableFor(pitchingRows,'pitching') + tableFor(hittingRows,'hitting');
  } else {
    tablesHtml = tableFor(hittingRows,'hitting') + tableFor(pitchingRows,'pitching');
  }
  var isMobile = (typeof window!=='undefined') && window.matchMedia && window.matchMedia('(max-width: 480px)').matches;
  var hintHtml = (isMobile && !state.careerSwipeHintShown)
    ? '<div class="career-swipe-hint" id="careerSwipeHint">'+
        '<span>← Swipe to see more →</span>'+
        '<button type="button" aria-label="Dismiss" onclick="dismissCareerSwipeHint()">✕</button>'+
      '</div>'
    : '';
  panelEl.innerHTML = hintHtml + tablesHtml;
  // Toggle the right-edge fade off once the user has scrolled the table fully.
  Array.prototype.forEach.call(panelEl.querySelectorAll('.career-table-wrap'), function(w){
    var update = function(){
      var atEnd = (w.scrollLeft + w.clientWidth) >= (w.scrollWidth - 2);
      w.classList.toggle('scrolled-end', atEnd);
    };
    w.addEventListener('scroll', update, { passive: true });
    update();
  });
}

export function dismissCareerSwipeHint(){
  state.careerSwipeHintShown = true;
  try { if(typeof localStorage!=='undefined') localStorage.setItem('mlb_stats_career_hint_shown','1'); } catch(_){}
  var el = document.getElementById('careerSwipeHint');
  if(el && el.parentNode) el.parentNode.removeChild(el);
}

// Mobile-only sticky chip-row at the top of the Stats section. Tap a chip to
// scroll the matching card into view; an IntersectionObserver highlights the
// active chip as the user scrolls. Idempotent — safe to call on every Stats
// section entry.
let _statsQuickNavInstalled = false;
export function installStatsQuickNav(){
  if(_statsQuickNavInstalled) return;
  var nav = document.getElementById('statsQuickNav');
  if(!nav) return;
  _statsQuickNavInstalled = true;
  // Click delegation: scroll the matching card into view, accounting for the
  // sticky page header (≈42px) + the quicknav itself (≈44px).
  nav.addEventListener('click', function(e){
    var btn = e.target && e.target.closest && e.target.closest('button[data-target]');
    if(!btn) return;
    var tgt = document.getElementById(btn.dataset.target);
    if(!tgt) return;
    var headerH = nav.getBoundingClientRect().bottom; // bottom of quicknav = top of content
    var top = tgt.getBoundingClientRect().top + window.pageYOffset - headerH - 8;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  });
  // Active-chip highlighting via IntersectionObserver. Fires when a card
  // crosses the viewport center, marking its chip .active.
  if(typeof IntersectionObserver === 'undefined') return;
  var ids = Array.prototype.map.call(nav.querySelectorAll('button[data-target]'), function(b){ return b.dataset.target; });
  var targets = ids.map(function(id){ return document.getElementById(id); }).filter(Boolean);
  if(!targets.length) return;
  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(en){
      if(!en.isIntersecting) return;
      var id = en.target.id;
      Array.prototype.forEach.call(nav.querySelectorAll('button[data-target]'), function(b){
        b.classList.toggle('active', b.dataset.target === id);
      });
    });
  }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });
  targets.forEach(function(t){ io.observe(t); });
}

// 24h TTL on the gameLog cache — game log only changes once per game-day per
// player, so cheap to re-use across tab toggles.
const GAMELOG_TTL_MS = 24 * 60 * 60 * 1000;

// Fetch and cache the per-game log for a player. Used by the Game Log tab and
// by the sparkline rendered inside the Overview hero panel. Returns the array
// of game splits or null on failure.
async function fetchGameLog(playerId, group){
  if(!playerId) return null;
  if(group==='fielding') group='hitting';
  var cacheKey = playerId + ':' + group;
  var existing = state.gameLogCache[cacheKey];
  if(existing && Date.now() - existing.ts < GAMELOG_TTL_MS) return existing.games;
  try {
    var r = await fetch(MLB_BASE+'/people/'+playerId+'/stats?stats=gameLog&season='+SEASON+'&group='+group);
    var d = await r.json();
    var games = (d.stats && d.stats[0] && d.stats[0].splits) ? d.stats[0].splits : [];
    state.gameLogCache[cacheKey] = { games: games, ts: Date.now() };
    return games;
  } catch(e) {
    return null;
  }
}

// Renders the Game Log tab from cached data. Tap a card → opens live view.
// Cards are color-bordered W/L; HR-game cards get a purple accent bar.
function renderGameLogTab(playerId, group){
  if(group==='fielding') group='hitting';
  var cacheKey = playerId + ':' + group;
  var cached = state.gameLogCache[cacheKey];
  var panelEl = document.querySelector('.player-tab-panel[data-tab="gamelog"]');
  if(!panelEl) return;
  if(!cached || !cached.games){
    panelEl.innerHTML = renderGameLogPlaceholder();
    return;
  }
  var games = cached.games.slice().reverse().slice(0, 10); // last 10 most recent first
  if(!games.length){
    panelEl.innerHTML = '<div class="tab-empty-state"><div class="tab-empty-icon">📅</div><h4>No games yet</h4><p>This player has no '+SEASON+' game log entries.</p></div>';
    return;
  }
  // Aggregate L10 summary (re-derived client-side; matches the deck's pattern)
  var sum = { ab:0, h:0, hr:0, rbi:0, bb:0, hbp:0, sf:0, tb:0, ip:0, er:0, k:0, bbA:0, hA:0 };
  games.forEach(function(g){
    var st = g.stat || {};
    if(group==='hitting'){
      sum.ab += parseInt(st.atBats,10)||0;
      sum.h += parseInt(st.hits,10)||0;
      sum.hr += parseInt(st.homeRuns,10)||0;
      sum.rbi += parseInt(st.rbi,10)||0;
      sum.bb += parseInt(st.baseOnBalls,10)||0;
      sum.hbp += parseInt(st.hitByPitch,10)||0;
      sum.sf += parseInt(st.sacFlies,10)||0;
      sum.tb += parseInt(st.totalBases,10)||0;
    } else {
      sum.ip += parseFloat(st.inningsPitched)||0;
      sum.er += parseInt(st.earnedRuns,10)||0;
      sum.k += parseInt(st.strikeOuts,10)||0;
      sum.bbA += parseInt(st.baseOnBalls,10)||0;
      sum.hA += parseInt(st.hits,10)||0;
    }
  });
  var summaryHtml='';
  if(group==='hitting'){
    var avg = sum.ab>0 ? sum.h/sum.ab : 0;
    var pa = sum.ab + sum.bb + sum.hbp + sum.sf;
    var obp = pa>0 ? (sum.h+sum.bb+sum.hbp)/pa : 0;
    var slg = sum.ab>0 ? sum.tb/sum.ab : 0;
    var fmtR = function(n){ var s=n.toFixed(3); return s.charAt(0)==='0'?s.slice(1):s; };
    summaryHtml = '<div class="gamelog-summary">'+
      '<div class="stat-box"><div class="stat-val">'+fmtR(avg)+'</div><div class="stat-lbl">L10 AVG</div></div>'+
      '<div class="stat-box"><div class="stat-val">'+sum.hr+'</div><div class="stat-lbl">L10 HR</div></div>'+
      '<div class="stat-box"><div class="stat-val">'+sum.rbi+'</div><div class="stat-lbl">L10 RBI</div></div>'+
      '<div class="stat-box"><div class="stat-val">'+fmtR(obp+slg)+'</div><div class="stat-lbl">L10 OPS</div></div>'+
      '</div>';
  } else {
    var era = sum.ip>0 ? (sum.er*9)/sum.ip : 0;
    var whip = sum.ip>0 ? (sum.bbA+sum.hA)/sum.ip : 0;
    summaryHtml = '<div class="gamelog-summary">'+
      '<div class="stat-box"><div class="stat-val">'+era.toFixed(2)+'</div><div class="stat-lbl">L10 ERA</div></div>'+
      '<div class="stat-box"><div class="stat-val">'+sum.k+'</div><div class="stat-lbl">L10 K</div></div>'+
      '<div class="stat-box"><div class="stat-val">'+whip.toFixed(2)+'</div><div class="stat-lbl">L10 WHIP</div></div>'+
      '<div class="stat-box"><div class="stat-val">'+sum.ip.toFixed(1)+'</div><div class="stat-lbl">L10 IP</div></div>'+
      '</div>';
  }
  // Mini-cards
  var html = '<div class="gamelog-strip">';
  games.forEach(function(g){
    var st = g.stat || {};
    var d = g.date ? new Date(g.date+'T12:00:00Z') : null;
    var dateLabel = d ? d.toLocaleDateString('en-US',{month:'short',day:'numeric'}) : '';
    var oppId = g.opponent && g.opponent.id;
    var oppD = oppId ? tcLookup(oppId) : { abbr:'?', primary:'#444' };
    var atVs = g.isHome===true ? 'vs' : (g.isHome===false ? '@' : '');
    var oppLabel = atVs + ' ' + (oppD.abbr||'?');
    var resultCls = '';
    if(typeof g.gameResult === 'string'){
      if(g.gameResult.charAt(0)==='W') resultCls = ' win';
      else if(g.gameResult.charAt(0)==='L') resultCls = ' loss';
    }
    var hr = parseInt(st.homeRuns,10)||0;
    var hrCls = hr>0 ? ' hr' : '';
    var lineLabel='';
    if(group==='hitting'){
      var ab = parseInt(st.atBats,10)||0;
      var h = parseInt(st.hits,10)||0;
      lineLabel = h+'/'+ab + (hr>0 ? ' · '+(hr>1?hr+'HR':'HR') : '');
    } else {
      var ip = parseFloat(st.inningsPitched)||0;
      var k = parseInt(st.strikeOuts,10)||0;
      var er = parseInt(st.earnedRuns,10)||0;
      lineLabel = ip.toFixed(1)+'IP · '+k+'K · '+er+'ER';
    }
    var clickAttr = g.game && g.game.gamePk ? ' onclick="showLiveGame('+g.game.gamePk+')"' : '';
    html += '<div class="glog-item'+resultCls+hrCls+'"'+clickAttr+'>'+
      '<div class="glog-d">'+dateLabel+'</div>'+
      '<div class="glog-o">'+oppLabel+'</div>'+
      '<div class="glog-s">'+lineLabel+'</div>'+
      '</div>';
  });
  html += '</div>';
  panelEl.innerHTML = html + summaryHtml;
}

// Compute a rolling-window aggregate for the hero stat from cached gameLog.
// For hitting: rolling AVG (or OPS if heroKey === 'ops'). For pitching:
// rolling ERA. Returns array of {x, y} objects oldest-first; null if no data.
function computeRollingSeries(games, group, heroKey, windowSize){
  if(!games || !games.length) return null;
  windowSize = windowSize || 7;
  var ordered = games.slice().reverse(); // oldest → newest
  var out = [];
  if(group==='hitting'){
    var window = [];
    var sumAB=0, sumH=0, sumPA=0, sumOBP_n=0, sumTB=0;
    for(var i=0;i<ordered.length;i++){
      var st = ordered[i].stat || {};
      var ab = parseInt(st.atBats,10)||0;
      var h = parseInt(st.hits,10)||0;
      var pa = parseInt(st.plateAppearances,10)||(ab + (parseInt(st.baseOnBalls,10)||0) + (parseInt(st.hitByPitch,10)||0) + (parseInt(st.sacFlies,10)||0));
      var bbHbp = (parseInt(st.baseOnBalls,10)||0) + (parseInt(st.hitByPitch,10)||0);
      var tb = parseInt(st.totalBases,10)||0;
      window.push({ ab:ab, h:h, pa:pa, bbHbp:bbHbp, tb:tb });
      sumAB+=ab; sumH+=h; sumPA+=pa; sumOBP_n+=h+bbHbp; sumTB+=tb;
      if(window.length>windowSize){
        var drop = window.shift();
        sumAB-=drop.ab; sumH-=drop.h; sumPA-=drop.pa; sumOBP_n-=drop.h+drop.bbHbp; sumTB-=drop.tb;
      }
      // Emit a point every iteration once we have at least 2 games' worth of
      // data — early-season players still get a meaningful line.
      if(window.length>=2){
        var avg = sumAB>0 ? sumH/sumAB : 0;
        var obp = sumPA>0 ? sumOBP_n/sumPA : 0;
        var slg = sumAB>0 ? sumTB/sumAB : 0;
        var y = heroKey==='ops' ? (obp+slg) : avg;
        out.push({ x: i, y: y });
      }
    }
  } else {
    // pitching: rolling ERA
    var w = [];
    var sumIP=0, sumER=0;
    for(var j=0;j<ordered.length;j++){
      var ps = ordered[j].stat || {};
      var ip = parseFloat(ps.inningsPitched)||0;
      var er = parseInt(ps.earnedRuns,10)||0;
      w.push({ ip:ip, er:er });
      sumIP+=ip; sumER+=er;
      if(w.length>windowSize){
        var dr = w.shift();
        sumIP-=dr.ip; sumER-=dr.er;
      }
      if(w.length>=2){
        var era = sumIP>0 ? (sumER*9)/sumIP : 0;
        out.push({ x: j, y: era });
      }
    }
  }
  return out.length ? out : null;
}

// Build an SVG sparkline from a series of {x,y} points. Inverts y for pitching
// (lower-is-better → lower line position is "better" visually). Adds a today-
// marker dot at the rightmost point and renders a faint area fill below.
function renderSparklineSVG(series, opts){
  if(!series || series.length<2) return '';
  opts = opts || {};
  var w = opts.width || 320;
  var h = opts.height || 56;
  var lowerIsBetter = !!opts.lowerIsBetter;
  var ys = series.map(function(p){ return p.y; });
  var ymin = Math.min.apply(null, ys);
  var ymax = Math.max.apply(null, ys);
  if(ymax === ymin){ ymax = ymin + 0.001; }
  var pad = 4;
  var step = (w - pad*2) / Math.max(1, series.length-1);
  function plotY(y){
    var t = (y - ymin) / (ymax - ymin);
    return lowerIsBetter ? (pad + t*(h - pad*2)) : (h - pad - t*(h - pad*2));
  }
  var pts = series.map(function(p, idx){ return [pad + idx*step, plotY(p.y)]; });
  var d = pts.map(function(pt, i){ return (i===0?'M':'L') + pt[0].toFixed(1) + ',' + pt[1].toFixed(1); }).join(' ');
  var area = d + ' L' + pts[pts.length-1][0].toFixed(1) + ',' + h + ' L' + pts[0][0].toFixed(1) + ',' + h + ' Z';
  var last = pts[pts.length-1];
  var first = ys[0];
  var lastY = ys[ys.length-1];
  var diff = lowerIsBetter ? (first - lastY) : (lastY - first);
  var trendCls = diff > 0 ? 'up' : (diff < 0 ? 'down' : 'flat');
  var trendArrow = trendCls==='up' ? '▲' : trendCls==='down' ? '▼' : '▬';
  var dec = opts.decimals == null ? 3 : opts.decimals;
  var absStr = Math.abs(diff).toFixed(dec);
  if(dec >= 3 && absStr.charAt(0) === '0') absStr = absStr.slice(1);
  var sign = diff > 0 ? '+' : (diff < 0 ? '−' : '');
  var diffStr = sign + absStr;
  return ''+
    '<svg class="hero-spark" viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="none" width="100%" height="'+h+'">'+
      '<defs><linearGradient id="spk-grad" x1="0" y1="0" x2="0" y2="1">'+
        '<stop offset="0%" stop-color="currentColor" stop-opacity=".4"/>'+
        '<stop offset="100%" stop-color="currentColor" stop-opacity="0"/>'+
      '</linearGradient></defs>'+
      '<path class="hero-spark-area" d="'+area+'" fill="url(#spk-grad)"/>'+
      '<path class="hero-spark-line" d="'+d+'" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'+
      '<circle cx="'+last[0].toFixed(1)+'" cy="'+last[1].toFixed(1)+'" r="3.5" fill="#fff" stroke="currentColor" stroke-width="2"/>'+
    '</svg>'+
    '<div class="hero-spark-meta"><span>'+series.length+'g rolling</span><span class="hero-spark-trend '+trendCls+'">'+trendArrow+' '+diffStr+'</span></div>';
}

// After the gameLog fetch lands, re-render Game Log + Overview (sparkline) for
// the active player when the panels are still displayed.
function onGameLogResolved(playerId, group){
  if(!state.selectedPlayer || !state.selectedPlayer.person) return;
  if(state.selectedPlayer.person.id !== playerId) return;
  if(group==='fielding') group='hitting';
  var stat = state.selectedPlayerStat && state.selectedPlayerStat.stat;
  if(stat && state.selectedPlayerStat.group !== 'fielding'){
    // Refresh Overview's sparkline
    var ovEl = document.querySelector('.player-tab-panel[data-tab="overview"]');
    if(ovEl) ovEl.innerHTML = renderOverviewTab(stat, state.selectedPlayerStat.group);
  }
  // Refresh Game Log panel content
  renderGameLogTab(playerId, group);
}
function renderAdvancedPlaceholder(group){
  if(group==='hitting'){
    return '<div class="tab-empty-state"><div class="tab-empty-icon">📈</div><h4>Statcast / Advanced</h4><p>Loading advanced metrics…</p></div>';
  }
  if(group==='pitching'){
    return '<div class="tab-empty-state"><div class="tab-empty-icon">🎯</div><h4>Pitch arsenal</h4><p>Loading pitch arsenal...</p></div>';
  }
  return '<div class="tab-empty-state"><div class="tab-empty-icon">⚾</div><h4>Advanced</h4><p>Not available for fielding view.</p></div>';
}

// Renders the Overview panel — the existing hero + grid layout pulled out of
// the old monolithic renderPlayerStats so the 4-tab orchestrator can compose
// each panel independently. Returns an HTML string.
function renderOverviewTab(s,group){
  var pid=state.selectedPlayer&&state.selectedPlayer.person&&state.selectedPlayer.person.id;
  var jerseyOverlay=(state.selectedPlayer&&state.selectedPlayer.jerseyNumber)?'<div class="headshot-jersey-pill">#'+state.selectedPlayer.jerseyNumber+'</div>':'';
  var html=pid?'<div class="headshot-frame"><img src="https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/'+pid+'/headshot/67/current">'+jerseyOverlay+'</div>':'';
  // v4.6.23: gate rank/percentile UI on qualification for rate stats. Counting
  // stats (HR/RBI/K/SB) always show rank — Aaron Judge with 30 HR is genuinely
  // #1 regardless of PA. Rate stats (AVG/OBP/SLG/OPS/ERA/WHIP) get the gate
  // because the leaders cache pulls qualified-only entries from MLB API; an
  // unqualified player with 1-for-2 .500 AVG would otherwise spuriously
  // outrank everyone.
  var playerQualified = group==='fielding' ? true : isQualified(group, s);
  function shouldShowRank(entry){ return !entry || entry.decimals < 2 || playerQualified; }
  var boxes=[];
  if(group==='hitting')boxes=[
    {v:fmtRate(s.avg),         l:'AVG', k:'avg',          raw:s.avg},
    {v:s.homeRuns,             l:'HR',  k:'homeRuns',     raw:s.homeRuns},
    {v:s.rbi,                  l:'RBI', k:'rbi',          raw:s.rbi},
    {v:fmtRate(s.ops),         l:'OPS', k:'ops',          raw:s.ops},
    {v:s.hits,                 l:'H',   k:'hits',         raw:s.hits},
    {v:s.doubles,              l:'2B',  k:'doubles',      raw:s.doubles},
    {v:s.triples,              l:'3B',  k:'triples',      raw:s.triples},
    {v:s.strikeOuts,           l:'K',   k:'strikeOuts',   raw:s.strikeOuts},
    {v:s.baseOnBalls,          l:'BB',  k:'baseOnBalls',  raw:s.baseOnBalls},
    {v:s.runs,                 l:'R',   k:'runs',         raw:s.runs},
    {v:s.stolenBases,          l:'SB',  k:'stolenBases',  raw:s.stolenBases},
    {v:s.plateAppearances,     l:'PA',  k:null,           raw:null}
  ];
  else if(group==='pitching')boxes=[
    {v:fmt(s.era,2),                  l:'ERA',  k:'era',                 raw:s.era},
    {v:fmt(s.whip,2),                 l:'WHIP', k:'whip',                raw:s.whip},
    {v:s.strikeOuts,                  l:'K',    k:'strikeOuts',          raw:s.strikeOuts},
    {v:s.wins+'-'+s.losses,           l:'W-L',  k:null,                  raw:null},
    {v:fmt(s.inningsPitched,1),       l:'IP',   k:null,                  raw:null},
    {v:s.hits,                        l:'H',    k:'hits',                raw:s.hits},
    {v:s.baseOnBalls,                 l:'BB',   k:'baseOnBalls',         raw:s.baseOnBalls},
    {v:s.homeRuns,                    l:'HR',   k:'homeRuns',            raw:s.homeRuns},
    {v:fmt(s.strikeoutWalkRatio,2),   l:'K/BB', k:'strikeoutWalkRatio',  raw:s.strikeoutWalkRatio},
    {v:fmt(s.strikeoutsPer9Inn,2),    l:'K/9',  k:'strikeoutsPer9Inn',   raw:s.strikeoutsPer9Inn},
    {v:fmt(s.walksPer9Inn,2),         l:'BB/9', k:'walksPer9Inn',        raw:s.walksPer9Inn},
    {v:s.saves,                       l:'SV',   k:'saves',               raw:s.saves}
  ];
  else boxes=[
    {v:fmtRate(s.fielding), l:'FPCT', k:null, raw:null},
    {v:s.putOuts,           l:'PO',   k:null, raw:null},
    {v:s.assists,           l:'A',    k:null, raw:null},
    {v:s.errors,            l:'E',    k:null, raw:null},
    {v:s.chances,           l:'TC',   k:null, raw:null},
    {v:s.doublePlays,       l:'DP',   k:null, raw:null}
  ];
  var cols=group==='fielding'?3:4;
  var basis=state.vsLeagueBasis||'mlb';
  // vs-league basis toggle (hitting/pitching only — fielding has no league
  // averages cache). Pills wired to switchVsBasis() exposed via main.js bridge.
  if(group!=='fielding'){
    html+='<div class="vs-basis-row"><span class="vs-basis-label">Compare</span>'+
      ['mlb','team'].map(function(bv){
        return '<button type="button" class="vs-basis-pill'+(basis===bv?' active':'')+'" onclick="switchVsBasis(\''+bv+'\')">VS '+(bv==='mlb'?'MLB':'TEAM')+'</button>';
      }).join('')+'</div>';
  }

  // Hero panel — promotes the headline stat (boxes[0]) to a full-width banner
  // with rank, tier, delta, and a sparkline slot reserved for Sprint 2's
  // gameLog-fed trend line. Fielding skips the panel; the 3-col grid is enough.
  if(group!=='fielding' && boxes.length){
    var hb=boxes[0];
    var hEntry=hb.k?leaderEntry(group,hb.k):null;
    var hShowRank=shouldShowRank(hEntry);
    var hPInfo=(hb.k && hShowRank)?computePercentile(group,hb.k,hb.raw):null;
    var hTier=hPInfo?tierFromPercentile(hPInfo.percentile):null;
    var hDir=hEntry&&hEntry.lowerIsBetter?'lower-better':'higher-better';
    var hDec=hEntry?hEntry.decimals:0;
    var hBasisVal=hb.k?(basis==='mlb'?leagueAverage(group,hb.k):teamAverage(group,hb.k)):null;
    var hChip=hb.k?avgChip(hb.raw,hBasisVal,hDec,hEntry&&hEntry.lowerIsBetter):'';
    var heroLabelMap={AVG:'Batting Average',OPS:'On-Base + Slugging',ERA:'Earned Run Average',WHIP:'Walks + Hits / IP'};
    var heroLabel=heroLabelMap[hb.l]||hb.l;
    var heroMeta=SEASON+' '+(group.charAt(0).toUpperCase()+group.slice(1));
    var tierPill='';
    if(hTier==='elite' && hPInfo){
      var topPct=Math.max(1,Math.round(hPInfo.rank/hPInfo.total*100));
      tierPill='<span class="hero-tier-pill">★ Elite · Top '+topPct+'%</span>';
    }
    // Sparkline — pulled from gameLog cache populated in selectPlayer. Falls
    // back to a "still loading" hint when the fetch hasn't resolved yet;
    // onGameLogResolved repaints once data lands.
    var heroSparkHtml='';
    var glogKey = (state.selectedPlayer && state.selectedPlayer.person && state.selectedPlayer.person.id) + ':' + group;
    var glogCached = state.gameLogCache[glogKey];
    if(glogCached && glogCached.games && glogCached.games.length){
      var rollingKey = group==='hitting' ? (hb.l==='OPS'?'ops':'avg') : 'era';
      var series = computeRollingSeries(glogCached.games, group, rollingKey, 7);
      if(series && series.length>=2){
        var sparkClass = hTier ? 'hero-spark-wrap hero-spark-wrap--'+hTier : 'hero-spark-wrap';
        heroSparkHtml = '<div class="'+sparkClass+'">'+
          renderSparklineSVG(series,{ lowerIsBetter: !!(hEntry&&hEntry.lowerIsBetter), decimals: hDec })+
          '</div>';
      }
    }
    if(!heroSparkHtml){
      heroSparkHtml = '<div class="hero-panel-trend"><span class="hero-trend-pending">trend loading…</span></div>';
    }
    // When the player is outside the leader pool, skip the rank caption +
    // percentile bar entirely — the tier shading on the panel is enough signal,
    // and the verbose "Outside MLB top 100" message in every box was noise.
    var hRankHtml='';
    var hBarHtml='';
    if(hPInfo && !hPInfo.outsideTop){
      hRankHtml='<div class="hero-panel-rank">#'+hPInfo.rank+' of '+hPInfo.total+' MLB</div>';
      hBarHtml='<div class="hero-panel-bar">'+pctBar(hPInfo.percentile)+'</div>';
    }
    html+='<div class="hero-panel'+(hTier?' hero-panel--'+hTier:'')+'">'+
      '<div class="hero-panel-stat">'+
        '<div class="hero-panel-meta">'+heroMeta+'</div>'+
        '<div class="hero-panel-val">'+(hb.v!=null?hb.v:'—')+'</div>'+
        '<div class="hero-panel-lbl">'+heroLabel+'</div>'+
        ((hChip||tierPill)?'<div class="hero-panel-deltas">'+hChip+tierPill+'</div>':'')+
      '</div>'+
      '<div class="hero-panel-context">'+
        hRankHtml+
        hBarHtml+
        (!hPInfo && hEntry && !hShowRank ? '<div class="hero-panel-unq" title="Below MLB qualification threshold (PA ≥ 3.1×G hitters, IP ≥ 1×G pitchers). Rank suppressed for rate stats.">Below qualification · rank not shown</div>' : '')+
        heroSparkHtml+
      '</div>'+
    '</div>';
    boxes=boxes.slice(1);
  }

  html+='<div class="stat-grid stat-grid--cols-'+cols+'">';
  boxes.forEach(function(b){
    var bEntry=b.k?leaderEntry(group,b.k):null;
    var bShowRank=shouldShowRank(bEntry);
    var pInfo=(b.k&&group!=='fielding'&&bShowRank)?computePercentile(group,b.k,b.raw):null;
    var tier=pInfo?tierFromPercentile(pInfo.percentile):null;
    // Hero panel above is the dominant stat now; supporting boxes are uniform
    // and only get a tier background at the extremes.
    var tierCls=tier&&(pInfo.percentile>=90||pInfo.percentile<=10)?' stat-box--'+tier:'';
    var chip='';
    if(b.k&&group!=='fielding'){
      var entry=leaderEntry(group,b.k);
      var dec=entry?entry.decimals:0;
      var basisVal=basis==='mlb'?leagueAverage(group,b.k):teamAverage(group,b.k);
      chip=avgChip(b.raw,basisVal,dec,entry&&entry.lowerIsBetter);
    }
    // Outside-top players: skip the rank caption + bar entirely. Tier
    // shading carries the "below average" signal on its own.
    var boxRankHtml='';
    if(pInfo && !pInfo.outsideTop){
      boxRankHtml=pctBar(pInfo.percentile)+rankCaption(pInfo.rank,pInfo.total);
    }
    html+='<div class="stat-box'+tierCls+'">'+
          '<div class="stat-val">'+(b.v!=null?b.v:'—')+'</div>'+
          '<div class="stat-lbl">'+b.l+'</div>'+
          boxRankHtml+
          chip+
          '</div>';
  });
  return html+'</div>';
}

// Toggle the vs-league basis between MLB-wide avg and active team's roster avg.
// Persists choice. Re-renders the current player's stat grid using the cached
// stat from state.statsCache so we don't re-fetch /people/{id}.
export function switchVsBasis(basis){
  if(basis!=='mlb'&&basis!=='team')return;
  state.vsLeagueBasis=basis;
  if(typeof localStorage!=='undefined')localStorage.setItem('mlb_stats_vs_basis',basis);
  var sel=state.selectedPlayer;
  if(!sel||!sel.person)return;
  var group=state.currentRosterTab==='fielding'?'fielding':state.currentRosterTab;
  if(group==='fielding')return;
  var pool=state.statsCache[group]||[];
  var entry=pool.find(function(p){return p.player&&p.player.id===sel.person.id;});
  if(entry&&entry.stat)renderPlayerStats(entry.stat,group);
}

