// ── Dev Tools Panels ────────────────────────────────────────────────────────
// All Dev Tools inspector/copy panels:
//  - Log Capture (devLog ring buffer view + filter + copy)
//  - App State Inspector (gameStates / feedItems / focus / storyPool / context / pulse)
//  - Network Trace (devNetLog ring buffer view + copy)
//  - localStorage Inspector
//  - Service Worker Inspector (+ force update + unregister)
//  - Test Notification (local SW.showNotification path)
//  - Live Controls (Force Focus + Force Inning Recap)
//  - Diagnostic Snapshot (one-tap full-app markdown bundle)

import { state } from '../state.js';
import { devLog, pushDevLog } from '../devtools-feed/devLog.js';
import { devNetLog, DEV_NET_CAP } from '../devtools-feed/devNet.js';
import { hypeHeadline } from '../feed/render.js';
import { getCurrentTeamId } from '../radio/engine.js';
import { setFocusGameManual } from '../focus/mode.js';
import { playClassicRandom, playArchiveUrl } from '../radio/classic.js';

let _buildStoryPool = null;
let _fallbackCopy = null;

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, function(c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

export function setPanelsCallbacks(cbs) {
  if (cbs.buildStoryPool) _buildStoryPool = cbs.buildStoryPool;
  if (cbs.fallbackCopy) _fallbackCopy = cbs.fallbackCopy;
}

function fallbackCopy(text) {
  if (_fallbackCopy) return _fallbackCopy(text);
  var ta = document.createElement('textarea');
  ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); } catch (e) { }
  document.body.removeChild(ta);
}

// ── 🔍 Log Capture (Dev Tools) ───────────────────────────────────────────────
function _logLevelRank(lvl){return lvl==='error'?3:lvl==='warn'?2:1;}
function _fmtLogTs(ts){
  var d=new Date(ts);
  var pad=function(n){return n<10?'0'+n:''+n;};
  return pad(d.getHours())+':'+pad(d.getMinutes())+':'+pad(d.getSeconds())+'.'+String(d.getMilliseconds()).padStart(3,'0');
}
function _filteredDevLog(){
  var levelSel=(document.getElementById('logCaptureLevel')||{}).value||'all';
  var filter=((document.getElementById('logCaptureFilter')||{}).value||'').trim().toLowerCase();
  var minRank=levelSel==='all'?0:_logLevelRank(levelSel);
  return devLog.filter(function(e){
    if(minRank&&_logLevelRank(e.level)<minRank)return false;
    if(filter){
      var hay=(e.msg+' '+e.src+' '+e.level).toLowerCase();
      if(hay.indexOf(filter)===-1)return false;
    }
    return true;
  });
}
export function renderLogCapture(){
  var list=document.getElementById('logCaptureList');
  var count=document.getElementById('logCaptureCount');
  if(!list)return;
  if(count) count.textContent='('+devLog.length+')';
  var rows=_filteredDevLog().slice(-200);
  if(!rows.length){
    list.innerHTML='<div class="dt-label-muted" style="padding:4px 0">No log entries match.</div>';
    return;
  }
  list.innerHTML=rows.slice().reverse().map(function(e){
    var cls='dt-log-row'+(e.level==='error'?' lv-error':e.level==='warn'?' lv-warn':'');
    var tag=e.src?'<span class="lv-tag">['+escapeHtml(e.src)+']</span>':'';
    return '<div class="'+cls+'"><span class="lv-ts">'+_fmtLogTs(e.ts)+'</span>'+tag+escapeHtml(e.msg)+'</div>';
  }).join('');
}
export function copyLogAsMarkdown(){
  var rows=_filteredDevLog();
  var lines=['# MLB Pulse — Log Capture','Captured: '+new Date().toISOString(),'Total entries: '+devLog.length+' (showing '+rows.length+' after filter)',''];
  if(!rows.length){lines.push('_(empty)_');}
  else{
    lines.push('| time | level | src | message |');
    lines.push('|---|---|---|---|');
    rows.forEach(function(e){
      var msg=e.msg.replace(/\|/g,'\\|').replace(/\n/g,' ↵ ');
      lines.push('| '+_fmtLogTs(e.ts)+' | '+e.level+' | '+(e.src||'-')+' | '+msg+' |');
    });
  }
  var text=lines.join('\n');
  var btn=document.getElementById('logCaptureCopyBtn');
  function flash(msg){if(!btn)return;var orig=btn.textContent;btn.textContent=msg;btn.style.background='#1f7a3a';setTimeout(function(){btn.textContent=orig;btn.style.background='';},1500);}
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(function(){flash('✓ Copied!');},function(){fallbackCopy(text);flash('✓ Copied (fallback)');});
  }else{
    fallbackCopy(text);flash('✓ Copied (fallback)');
  }
}
export function clearDevLog(){
  devLog.length=0;
  renderLogCapture();
}

// ── 📊 App State Inspector ───────────────────────────────────────────────────
function _stateGameRow(g){
  if(!g)return '—';
  var matchup=(g.awayAbbr||'?')+' '+g.awayScore+' @ '+(g.homeAbbr||'?')+' '+g.homeScore;
  var inn=g.status==='Live' ? ' · '+(g.halfInning||'')+' '+(g.inning||'?')+' ('+g.outs+'o)' : '';
  var bases=(g.onFirst||g.onSecond||g.onThird) ? ' · 🏃'+(g.onFirst?'1':'·')+(g.onSecond?'2':'·')+(g.onThird?'3':'·') : '';
  return matchup+' · '+g.status+(g.detailedState&&g.detailedState!==g.status?' ('+g.detailedState+')':'')+inn+bases;
}
function _stateContext(){
  var t=(typeof state.activeTeam!=='undefined'&&state.activeTeam)||{};
  var section='?';
  try{var s=document.querySelector('.section.active');if(s) section=s.id;}catch(e){}
  return {
    version: (typeof __APP_VERSION__ !== 'undefined' ? 'v' + __APP_VERSION__ : '?'),
    timestamp: new Date().toISOString(),
    activeTeam: t.id ? (t.short+' (id:'+t.id+')') : '?',
    section: section,
    demoMode: typeof state.demoMode!=='undefined' ? !!state.demoMode : '?',
    pulseInitialized: typeof state.pulseInitialized!=='undefined' ? !!state.pulseInitialized : '?',
    pulseColorScheme: '?',
    themeScope: typeof state.themeScope!=='undefined' ? state.themeScope : '?',
    themeOverride: typeof state.themeOverride!=='undefined' && state.themeOverride ? (state.themeOverride.short||'set') : null,
    themeInvert: typeof state.themeInvert!=='undefined' ? !!state.themeInvert : '?',
    devColorLocked: typeof state.devColorLocked!=='undefined' ? !!state.devColorLocked : '?',
    radioCurrentTeamId: getCurrentTeamId(),
    focusGamePk: typeof state.focusGamePk!=='undefined' ? state.focusGamePk : null,
    focusIsManual: typeof state.focusIsManual!=='undefined' ? !!state.focusIsManual : '?',
    counts: {
      gameStates: typeof state.gameStates!=='undefined' ? Object.keys(state.gameStates).length : 0,
      feedItems: typeof state.feedItems!=='undefined' ? state.feedItems.length : 0,
      storyPool: typeof state.storyPool!=='undefined' ? state.storyPool.length : 0,
      enabledGames: typeof state.enabledGames!=='undefined' ? state.enabledGames.size : 0,
      devLog: devLog.length,
    },
    viewport: window.innerWidth+'×'+window.innerHeight,
    userAgent: navigator.userAgent,
  };
}
function _stateGameStatesArr(){
  if(typeof state.gameStates==='undefined') return [];
  return Object.keys(state.gameStates).map(function(pk){
    var g=state.gameStates[pk];
    return {
      gamePk:+pk, status:g.status, detailedState:g.detailedState,
      matchup:(g.awayAbbr||'?')+'@'+(g.homeAbbr||'?'),
      score:(g.awayScore||0)+'-'+(g.homeScore||0),
      inning:(g.halfInning||'')+(g.inning||''), outs:g.outs,
      bases:(g.onFirst?'1':'')+(g.onSecond?'2':'')+(g.onThird?'3':''),
      hits:(g.awayHits||0)+'-'+(g.homeHits||0),
      enabled: typeof state.enabledGames!=='undefined' ? state.enabledGames.has(+pk) : null,
    };
  }).sort(function(a,b){
    var rank=function(s){return s==='Live'?0:s==='Preview'||s==='Scheduled'?1:2;};
    return rank(a.status)-rank(b.status);
  });
}
function _stateFeedItemsArr(limit){
  if(typeof state.feedItems==='undefined') return [];
  return state.feedItems.slice(0, limit||50).map(function(fi){
    var d=fi.data||{};
    return {
      ts: fi.ts ? fi.ts.toISOString() : null,
      gamePk: fi.gamePk,
      type: d.type,
      label: d.label || d.event || '',
      desc: (d.desc||d.sub||'').slice(0, 200),
      scoring: !!d.scoring,
      score: (d.awayScore!=null?d.awayScore:'')+(d.homeScore!=null?'-'+d.homeScore:''),
      inning: d.halfInning ? (d.halfInning+' '+(d.inning||'')) : null,
    };
  });
}
function _stateStoryPoolArr(){
  if(typeof state.storyPool==='undefined') return [];
  return state.storyPool.map(function(s){
    var cdRem=null;
    if(s.lastShown && s.cooldownMs){
      var rem=s.cooldownMs-(Date.now()-s.lastShown);
      cdRem=rem>0?Math.round(rem/1000)+'s':'ready';
    }
    return {
      id:s.id, type:s.type, tier:s.tier, priority:s.priority,
      headline:s.headline, gamePk:s.gamePk, cooldownRem:cdRem,
      lastShownAgo: s.lastShown ? Math.round((Date.now()-s.lastShown)/1000)+'s' : null,
      isShown: s.id===state.storyShownId,
    };
  }).sort(function(a,b){return (b.priority||0)-(a.priority||0);});
}
function _stateFocusObj(){
  return {
    focusGamePk: typeof state.focusGamePk!=='undefined' ? state.focusGamePk : null,
    focusIsManual: typeof state.focusIsManual!=='undefined' ? !!state.focusIsManual : '?',
    focusedGame: (typeof state.focusGamePk!=='undefined' && state.focusGamePk && typeof state.gameStates!=='undefined' && state.gameStates[state.focusGamePk])
      ? _stateGameRow(state.gameStates[state.focusGamePk]) : null,
  };
}
function _kvList(obj){
  return Object.keys(obj).map(function(k){
    var v=obj[k];
    var disp=(v==null)?'—':(typeof v==='object')?JSON.stringify(v):String(v);
    if(disp.length>200) disp=disp.slice(0,200)+'…';
    return '<div style="display:flex;gap:8px;padding:1px 0"><span style="color:var(--muted);min-width:120px">'+escapeHtml(k)+'</span><span>'+escapeHtml(disp)+'</span></div>';
  }).join('');
}
function _miniCopyBtn(action){
  return '<button data-dt-action="'+action+'" style="background:var(--card);border:1px solid var(--border);color:var(--text);font-size:.6rem;padding:2px 6px;border-radius:4px;cursor:pointer;font-weight:600">📋</button>';
}
function _section(title, action, body){
  return '<div class="dt-box"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><span class="dt-label">'+title+'</span>'+_miniCopyBtn(action)+'</div>'+body+'</div>';
}
export function renderAppState(){
  var body=document.getElementById('appStateBody');
  if(!body) return;
  var ctx=_stateContext();
  var c=document.getElementById('appStateCounts');
  if(c) c.textContent='('+ctx.counts.gameStates+'g · '+ctx.counts.feedItems+'f · '+ctx.counts.storyPool+'s)';

  var gs=_stateGameStatesArr();
  var gsBody=gs.length
    ? '<div class="dt-mono" style="max-height:160px;overflow-y:auto">'+gs.map(function(g){
        return '<div class="dt-log-row">'+escapeHtml(g.matchup)+' · '+escapeHtml(g.status)+' · '+escapeHtml(g.score)+(g.inning?' · '+escapeHtml(g.inning)+' ('+g.outs+'o)':'')+(g.bases?' · 🏃'+escapeHtml(g.bases):'')+(g.enabled===false?' <span class="lv-tag">[hidden]</span>':'')+'</div>';
      }).join('')+'</div>'
    : '<div class="dt-label-muted">No games loaded.</div>';

  var fi=_stateFeedItemsArr(30);
  var fiBody=fi.length
    ? '<div class="dt-mono" style="max-height:160px;overflow-y:auto">'+fi.map(function(f){
        var ts=f.ts?f.ts.slice(11,19):'';
        return '<div class="dt-log-row"><span class="lv-ts">'+escapeHtml(ts)+'</span><span class="lv-tag">['+escapeHtml(String(f.type||'?'))+']</span>'+escapeHtml(f.label||f.desc||'')+(f.scoring?' ⭐':'')+'</div>';
      }).join('')+'</div>'
    : '<div class="dt-label-muted">Feed empty.</div>';

  var sp=_stateStoryPoolArr();
  var spBody=sp.length
    ? '<div class="dt-mono" style="max-height:160px;overflow-y:auto">'+sp.map(function(s){
        return '<div class="dt-log-row'+(s.isShown?' lv-warn':'')+'"><span class="lv-tag">p'+(s.priority||0)+'</span><span class="lv-tag">['+escapeHtml(String(s.type||'?'))+']</span>'+escapeHtml(s.headline||'')+(s.cooldownRem?' <span class="lv-ts">('+escapeHtml(s.cooldownRem)+')</span>':'')+(s.isShown?' ◀ shown':'')+'</div>';
      }).join('')+'</div>'
    : '<div class="dt-label-muted">Story pool empty.</div>';

  var ctxBody='<div style="font-size:.65rem">'+_kvList({
    version: ctx.version, section: ctx.section, activeTeam: ctx.activeTeam,
    demoMode: ctx.demoMode, pulseInitialized: ctx.pulseInitialized,
    pulseColorScheme: ctx.pulseColorScheme, themeScope: ctx.themeScope,
    themeOverride: ctx.themeOverride, themeInvert: ctx.themeInvert,
    devColorLocked: ctx.devColorLocked, radioCurrentTeamId: ctx.radioCurrentTeamId,
    focusGamePk: ctx.focusGamePk, focusIsManual: ctx.focusIsManual,
    viewport: ctx.viewport,
  })+'</div>';

  var focusBody='<div style="font-size:.65rem">'+_kvList(_stateFocusObj())+'</div>';

  var now=new Date();
  var upcoming=Object.values(state.gameStates).filter(function(g){
    if(!(g.status==='Preview'||g.status==='Scheduled'||(g.status==='Live'&&g.detailedState!=='In Progress'))) return false;
    var rawG=state.storyCarouselRawGameData&&state.storyCarouselRawGameData[g.gamePk];
    if(rawG&&rawG.doubleHeader==='Y'&&rawG.gameNumber==2){
      if(Object.values(state.gameStates).some(function(s){return s.status==='Live'&&s.awayId===g.awayId&&s.homeId===g.homeId;})) return false;
    }
    return true;
  });
  upcoming.sort(function(a,b){return (a.gameDateMs||0)-(b.gameDateMs||0);});
  var liveGames=Object.values(state.gameStates).filter(function(g){return g.status==='Live'&&g.detailedState==='In Progress';});
  var nextDiffMs=upcoming.length&&upcoming[0].gameDateMs?upcoming[0].gameDateMs-Date.now():0;
  var pulseInfo={
    now: now.toISOString().split('T')[1].split('.')[0],
    headline: hypeHeadline(nextDiffMs),
    liveGames: liveGames.length,
    upcomingGames: upcoming.length,
    enabledGames: state.enabledGames.size,
    totalGames: Object.keys(state.gameStates).length,
  };
  var pulseBody='<div style="font-size:.65rem">'+_kvList(pulseInfo)+'</div>';

  body.innerHTML =
    _section('Context','copyStateContext', ctxBody) +
    _section('⚡ Pulse Diagnostics','copyStatePulse', pulseBody) +
    _section('🎯 Focus','copyStateFocus', focusBody) +
    _section('🎮 state.gameStates ('+gs.length+')','copyStateGames', gsBody) +
    _section('📰 state.feedItems (showing '+fi.length+' of '+ctx.counts.feedItems+')','copyStateFeed', fiBody) +
    _section('📖 state.storyPool ('+sp.length+')','copyStateStories', spBody);
}
export function _copyToClipboard(text, btnId){
  var btn=btnId?document.getElementById(btnId):null;
  function flash(msg){if(!btn)return;var orig=btn.textContent;btn.textContent=msg;btn.style.background='#1f7a3a';setTimeout(function(){btn.textContent=orig;btn.style.background='';},1500);}
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(function(){flash('✓ Copied!');},function(){fallbackCopy(text);flash('✓ Copied (fb)');});
  }else{
    fallbackCopy(text);flash('✓ Copied (fb)');
  }
}
export function _stateAsMarkdownContext(){
  var c=_stateContext();
  return '## Context\n\n```json\n'+JSON.stringify(c,null,2)+'\n```\n';
}
export function _stateAsMarkdownGames(){
  var gs=_stateGameStatesArr();
  if(!gs.length) return '## state.gameStates\n\n_(empty)_\n';
  var lines=['## state.gameStates ('+gs.length+')','','| gamePk | matchup | status | score | inning | bases | hits | enabled |','|---|---|---|---|---|---|---|---|'];
  gs.forEach(function(g){
    lines.push('| '+g.gamePk+' | '+g.matchup+' | '+g.status+(g.detailedState&&g.detailedState!==g.status?' ('+g.detailedState+')':'')+' | '+g.score+' | '+(g.inning||'-')+(g.outs!=null?' '+g.outs+'o':'')+' | '+(g.bases||'-')+' | '+g.hits+' | '+(g.enabled==null?'-':g.enabled?'y':'n')+' |');
  });
  return lines.join('\n')+'\n';
}
export function _stateAsMarkdownFeed(limit){
  var fi=_stateFeedItemsArr(limit||50);
  if(!fi.length) return '## state.feedItems\n\n_(empty)_\n';
  var lines=['## state.feedItems ('+fi.length+(typeof state.feedItems!=='undefined'&&state.feedItems.length>fi.length?' of '+state.feedItems.length:'')+')','','| time | gamePk | type | label/desc | scoring |','|---|---|---|---|---|'];
  fi.forEach(function(f){
    var ts=f.ts?f.ts.slice(11,19):'-';
    var msg=(f.label||f.desc||'').replace(/\|/g,'\\|').replace(/\n/g,' ↵ ');
    lines.push('| '+ts+' | '+f.gamePk+' | '+(f.type||'-')+' | '+msg+' | '+(f.scoring?'y':'')+' |');
  });
  return lines.join('\n')+'\n';
}
export function _stateAsMarkdownStories(){
  var sp=_stateStoryPoolArr();
  if(!sp.length) return '## state.storyPool\n\n_(empty)_\n';
  var lines=['## state.storyPool ('+sp.length+')','','| priority | type | tier | headline | cooldown | shown |','|---|---|---|---|---|---|'];
  sp.forEach(function(s){
    lines.push('| '+(s.priority||0)+' | '+(s.type||'-')+' | '+(s.tier||'-')+' | '+(s.headline||'').replace(/\|/g,'\\|')+' | '+(s.cooldownRem||'-')+' | '+(s.isShown?'◀':'')+' |');
  });
  return lines.join('\n')+'\n';
}
export function _stateAsMarkdownFocus(){
  return '## Focus\n\n```json\n'+JSON.stringify(_stateFocusObj(),null,2)+'\n```\n';
}
export function _stateAsMarkdownPulse(){
  var now=new Date();
  var hour=now.getHours();
  var upcoming=Object.values(state.gameStates).filter(function(g){
    if(!(g.status==='Preview'||g.status==='Scheduled'||(g.status==='Live'&&g.detailedState!=='In Progress'))) return false;
    var rawG=state.storyCarouselRawGameData&&state.storyCarouselRawGameData[g.gamePk];
    if(rawG&&rawG.doubleHeader==='Y'&&rawG.gameNumber==2){
      if(Object.values(state.gameStates).some(function(s){return s.status==='Live'&&s.awayId===g.awayId&&s.homeId===g.homeId;})) return false;
    }
    return true;
  });
  upcoming.sort(function(a,b){return (a.gameDateMs||0)-(b.gameDateMs||0);});
  var liveGames=Object.values(state.gameStates).filter(function(g){return g.status==='Live'&&g.detailedState==='In Progress';});
  var finalGames=Object.values(state.gameStates).filter(function(g){return g.status==='Final';});
  var nextDiffMs=upcoming.length&&upcoming[0].gameDateMs?upcoming[0].gameDateMs-Date.now():0;
  var lines=['## Pulse Empty State Diagnostics','','### Current Time & Headline','| Field | Value |','|---|---|',
    '| Now | '+now.toISOString()+' |',
    '| Hour | '+hour+' |',
    '| Headline | '+hypeHeadline(nextDiffMs)+' |',
    '','### Game Counts','| State | Count |','|---|---|',
    '| Total state.gameStates | '+Object.keys(state.gameStates).length+' |',
    '| Enabled Games | '+state.enabledGames.size+' |',
    '| Live (In Progress) | '+liveGames.length+' |',
    '| Preview/Scheduled (Upcoming) | '+upcoming.length+' |',
    '| Final | '+finalGames.length+' |',
    '','### Why Empty State Shows',
    '| Reason | Active |','|---|---|',
    '| No upcoming games found | '+(upcoming.length===0?'**YES** — will show "Slate complete"':'no')+' |',
    '| Has intermission flag | no |',
    '| Has live games | '+(liveGames.length>0?'**YES** — empty state should not show':'no')+' |',
    '','### All Games in state.gameStates'];
  var gameRows=['| gamePk | matchup | status | detailed | enabled | inning |','|---|---|---|---|---|---|'];
  Object.values(state.gameStates).sort(function(a,b){return (a.gameDateMs||0)-(b.gameDateMs||0);}).forEach(function(g){
    var enabled=state.enabledGames.has(g.gamePk)?'✓':'✗';
    var inning=g.status==='Live'?' '+g.inning+'i ('+g.halfInning.charAt(0)+')':'-';
    gameRows.push('| '+g.gamePk+' | '+g.awayAbbr+' @ '+g.homeAbbr+' | '+g.status+' | '+g.detailedState+' | '+enabled+' | '+inning+' |');
  });
  return lines.join('\n')+'\n'+gameRows.join('\n')+'\n';
}
export function copyAppStateAsMarkdown(){
  var parts=[
    '# MLB Pulse — App State Snapshot',
    'Captured: '+new Date().toISOString(),
    '',
    _stateAsMarkdownPulse(),
    _stateAsMarkdownContext(),
    _stateAsMarkdownFocus(),
    _stateAsMarkdownGames(),
    _stateAsMarkdownFeed(50),
    _stateAsMarkdownStories(),
  ];
  _copyToClipboard(parts.join('\n'),'appStateCopyBtn');
}

// ── 🌐 Network Trace ─────────────────────────────────────────────────────────
function _shortUrl(u){
  if(!u) return '?';
  try{
    var parsed=new URL(u, window.location.href);
    var host=parsed.host || '';
    var path=parsed.pathname.replace(/^\/api\/v1(\.1)?/, '/v1$1');
    var q=parsed.search ? (parsed.search.length>40?parsed.search.slice(0,40)+'…':parsed.search) : '';
    return (host?host+' ':'')+path+q;
  }catch(e){
    return u.length>120 ? u.slice(0,120)+'…' : u;
  }
}
function _fmtBytes(n){
  if(n==null) return '-';
  if(n<1024) return n+'b';
  if(n<1048576) return (n/1024).toFixed(1)+'k';
  return (n/1048576).toFixed(2)+'M';
}
export function renderNetTrace(){
  var list=document.getElementById('netTraceList');
  var count=document.getElementById('netTraceCount');
  if(!list) return;
  if(count) count.textContent='('+devNetLog.length+')';
  if(!devNetLog.length){
    list.innerHTML='<div class="dt-label-muted" style="padding:4px 0">No fetches captured yet.</div>';
    return;
  }
  list.innerHTML = devNetLog.slice().reverse().map(function(e){
    var ts=_fmtLogTs(e.ts);
    var st=(e.status==null)?(e.ok===false?'ERR':'…'):e.status;
    var cls='dt-log-row';
    if(e.ok===false) cls+=' lv-error';
    else if(e.status>=400) cls+=' lv-error';
    else if(e.status>=300) cls+=' lv-warn';
    var ms=e.ms!=null?e.ms+'ms':'-';
    var size=_fmtBytes(e.sizeBytes);
    var err=e.errorMsg?'<div style="margin-left:24px;color:#ff6b6b">'+escapeHtml(e.errorMsg)+'</div>':'';
    return '<div class="'+cls+'" title="'+escapeHtml(e.url||'')+'"><span class="lv-ts">'+ts+'</span><span class="lv-tag">'+escapeHtml(e.method)+' '+st+'</span><span class="lv-ts">'+ms+' · '+size+'</span> '+escapeHtml(_shortUrl(e.url))+err+'</div>';
  }).join('');
}
export function copyNetTraceAsMarkdown(){
  var lines=['# MLB Pulse — Network Trace','Captured: '+new Date().toISOString(),'Total entries: '+devNetLog.length+' (cap '+DEV_NET_CAP+')',''];
  if(!devNetLog.length){lines.push('_(empty)_');}
  else{
    lines.push('| time | method | status | ms | size | url |');
    lines.push('|---|---|---|---|---|---|');
    devNetLog.forEach(function(e){
      var url=(e.url||'').replace(/\|/g,'\\|');
      var status=(e.status==null)?(e.ok===false?'ERR':'-'):e.status;
      var ms=e.ms!=null?e.ms:'-';
      var size=_fmtBytes(e.sizeBytes);
      lines.push('| '+_fmtLogTs(e.ts)+' | '+e.method+' | '+status+' | '+ms+' | '+size+' | '+url+' |');
    });
    var failed=devNetLog.filter(function(e){return e.ok===false;});
    if(failed.length){
      lines.push('','## Failed requests ('+failed.length+')','');
      failed.forEach(function(e){lines.push('- `'+e.method+' '+(e.status||'ERR')+'` '+e.url+(e.errorMsg?' — '+e.errorMsg:''));});
    }
  }
  _copyToClipboard(lines.join('\n'),'netTraceCopyBtn');
}
export function clearNetTrace(){
  devNetLog.length=0;
  renderNetTrace();
}

// ── 💾 localStorage Inspector ────────────────────────────────────────────────
function _lsKeys(){
  var keys=[];
  try{ for(var i=0;i<localStorage.length;i++){ var k=localStorage.key(i); if(k && k.indexOf('mlb_')===0) keys.push(k); } }catch(e){}
  keys.sort();
  return keys;
}
function _lsEntry(k){
  var raw=null, parsed=null, isJson=false, bytes=0;
  try{ raw=localStorage.getItem(k); }catch(e){ raw=null; }
  if(raw!=null){
    bytes=raw.length;
    try{ parsed=JSON.parse(raw); isJson=(parsed!==null && typeof parsed==='object'); }catch(e){}
  }
  return {key:k, raw:raw, parsed:parsed, isJson:isJson, bytes:bytes};
}
export function renderStorageInspector(){
  var list=document.getElementById('storageList');
  var count=document.getElementById('storageCount');
  if(!list) return;
  var keys=_lsKeys();
  if(count) count.textContent='('+keys.length+')';
  if(!keys.length){ list.innerHTML='<div class="dt-label-muted">No mlb_* keys present.</div>'; return; }
  list.innerHTML=keys.map(function(k){
    var e=_lsEntry(k);
    var preview;
    if(e.isJson){ preview='<details style="margin-top:4px"><summary style="cursor:pointer;color:var(--muted);font-size:.6rem">view JSON</summary><pre style="margin:4px 0 0;padding:6px 8px;background:var(--card);border:1px solid var(--border);border-radius:4px;font-size:.6rem;color:var(--text);white-space:pre-wrap;word-break:break-all;max-height:160px;overflow-y:auto">'+escapeHtml(JSON.stringify(e.parsed,null,2))+'</pre></details>'; }
    else if(e.raw!=null){ var disp=e.raw.length>140?e.raw.slice(0,140)+'…':e.raw; preview='<div style="margin-top:2px;color:var(--muted);font-size:.6rem">'+escapeHtml(disp)+'</div>'; }
    else preview='<div style="margin-top:2px;color:var(--muted);font-size:.6rem">(null)</div>';
    return '<div class="dt-box"><div style="display:flex;justify-content:space-between;align-items:center;gap:6px"><span style="font-weight:600;color:var(--text);font-family:ui-monospace,monospace">'+escapeHtml(k)+'</span><span class="dt-label-muted">'+_fmtBytes(e.bytes)+'</span><button data-dt-action="clearLsKey" data-ls-key="'+escapeHtml(k)+'" style="background:var(--card);border:1px solid var(--hr-border);color:var(--text);font-size:.6rem;padding:2px 6px;border-radius:4px;cursor:pointer">🗑</button></div>'+preview+'</div>';
  }).join('');
}
export function clearLsKey(key){
  if(!key) return;
  if(!confirm('Remove localStorage key "'+key+'"? This may log you out / reset settings depending on the key.')) return;
  try{ localStorage.removeItem(key); pushDevLog('warn','storage',['removed key: '+key]); }catch(e){}
  renderStorageInspector();
}
export function copyStorageAsMarkdown(){
  var keys=_lsKeys();
  var lines=['# MLB Pulse — localStorage Snapshot','Captured: '+new Date().toISOString(),'Keys: '+keys.length,''];
  if(!keys.length) lines.push('_(no mlb_* keys)_');
  else{
    lines.push('| key | bytes | json | preview |');
    lines.push('|---|---|---|---|');
    keys.forEach(function(k){
      var e=_lsEntry(k);
      var prev=(e.raw||'').replace(/\|/g,'\\|').replace(/\n/g,' ↵ ');
      if(prev.length>120) prev=prev.slice(0,120)+'…';
      lines.push('| `'+k+'` | '+_fmtBytes(e.bytes)+' | '+(e.isJson?'y':'')+' | '+prev+' |');
    });
    lines.push('','## Full values','');
    keys.forEach(function(k){
      var e=_lsEntry(k);
      lines.push('### `'+k+'` ('+_fmtBytes(e.bytes)+')');
      if(e.isJson) lines.push('```json',JSON.stringify(e.parsed,null,2),'```','');
      else lines.push('```',(e.raw==null?'(null)':e.raw),'```','');
    });
  }
  _copyToClipboard(lines.join('\n'),'storageCopyBtn');
}

// ── ⚙️ Service Worker Inspector ──────────────────────────────────────────────
var _swState = {scope:null, scriptURL:null, controller:null, hasUpdate:false, lastUpdated:null, error:null};
function _refreshSWState(){
  if(!('serviceWorker' in navigator)){ _swState.error='Service Worker API not supported.'; return Promise.resolve(); }
  return navigator.serviceWorker.getRegistration().then(function(reg){
    if(!reg){ _swState.error='No registration found.'; return; }
    _swState.scope=reg.scope;
    _swState.scriptURL=(reg.active && reg.active.scriptURL) || (reg.installing && reg.installing.scriptURL) || (reg.waiting && reg.waiting.scriptURL) || null;
    _swState.controller=navigator.serviceWorker.controller ? navigator.serviceWorker.controller.scriptURL : null;
    _swState.hasUpdate=!!reg.waiting;
    _swState.error=null;
  }, function(err){ _swState.error=(err&&err.message)||String(err); });
}
export function renderSWInspector(){
  var info=document.getElementById('swInfo');
  if(!info) return;
  info.innerHTML='<div class="dt-label-muted">Loading…</div>';
  _refreshSWState().then(function(){
    var rows={
      'Supported': ('serviceWorker' in navigator),
      'Scope': _swState.scope || '—',
      'Active script': _swState.scriptURL || '—',
      'Controller': _swState.controller || '(uncontrolled)',
      'Update waiting': _swState.hasUpdate ? 'YES — reload to activate' : 'no',
      'Error': _swState.error || '—',
    };
    info.innerHTML=_kvList(rows);
  });
}
export function copySWStateAsMarkdown(){
  _refreshSWState().then(function(){
    var lines=['# MLB Pulse — Service Worker','Captured: '+new Date().toISOString(),''];
    lines.push('- Supported: '+('serviceWorker' in navigator));
    lines.push('- Scope: '+(_swState.scope||'-'));
    lines.push('- Active script: '+(_swState.scriptURL||'-'));
    lines.push('- Controller: '+(_swState.controller||'(uncontrolled)'));
    lines.push('- Update waiting: '+(_swState.hasUpdate?'YES':'no'));
    if(_swState.error) lines.push('- Error: '+_swState.error);
    _copyToClipboard(lines.join('\n'),'swCopyBtn');
  });
}
export function swForceUpdate(){
  if(!('serviceWorker' in navigator)){ alert('Service Worker not supported.'); return; }
  navigator.serviceWorker.getRegistration().then(function(reg){
    if(!reg){ alert('No SW registration found.'); return; }
    pushDevLog('log','sw',['Force update requested']);
    reg.update().then(function(){
      pushDevLog('log','sw',['update() resolved · waiting='+!!reg.waiting]);
      if(reg.waiting){
        try{ reg.waiting.postMessage({type:'SKIP_WAITING'}); }catch(e){}
        alert('Update found. Reload the page to activate the new version.');
      }else{
        alert('No new update available — already on latest.');
      }
      renderSWInspector();
    }, function(err){
      pushDevLog('error','sw',['update() failed: '+(err&&err.message||err)]);
      alert('Update failed: '+(err&&err.message||err));
    });
  });
}
export function swUnregisterAndReload(){
  if(!confirm('Unregister the service worker and reload? This forces a fresh load (clears cached app shell).')) return;
  if(!('serviceWorker' in navigator)){ location.reload(); return; }
  navigator.serviceWorker.getRegistration().then(function(reg){
    var done=function(){ try{ if(window.caches){ caches.keys().then(function(keys){ keys.forEach(function(k){ caches.delete(k); }); location.reload(true); }); } else location.reload(true); }catch(e){ location.reload(true); } };
    if(reg){ reg.unregister().then(done, done); } else done();
  });
}

// ── 🔔 Test Notification (local) ─────────────────────────────────────────────
export function testLocalNotification(){
  if(!('Notification' in window)){ alert('Notifications not supported on this device.'); return; }
  function show(){
    if(!('serviceWorker' in navigator)){ alert('Service Worker not supported.'); return; }
    navigator.serviceWorker.getRegistration().then(function(reg){
      if(!reg){ alert('No SW registered yet — reload and try again.'); return; }
      reg.showNotification('MLB Pulse · Dev test', {
        body: 'Local test fired '+new Date().toLocaleTimeString()+' · server pipeline NOT exercised',
        icon: './icons/icon-192.png',
        badge: './icons/icon-192.png',
        tag: 'mlb-dev-test',
        renotify: true,
      }).then(
        function(){ pushDevLog('log','notif',['local test notification fired']); },
        function(err){ pushDevLog('error','notif',['showNotification failed: '+(err&&err.message||err)]); alert('showNotification failed: '+(err&&err.message||err)); }
      );
    });
  }
  if(Notification.permission==='granted') show();
  else if(Notification.permission==='denied') alert('Notifications are blocked. Re-enable in browser/site settings.');
  else Notification.requestPermission().then(function(p){ if(p==='granted') show(); else alert('Permission not granted ('+p+').'); });
}

// ── Demo Archive Feeds Tester (QC Panel) ───────────────────────────────────────
export function renderDemoFeedsTester() {
  var body = document.getElementById('demoFeedsBody');
  if (!body) return;
  // Archive broadcasts available for testing
  var feeds = [
    { url: 'https://archive.org/download/classicmlbbaseballradio/1969%2010%2016%20New%20York%20Mets%20vs%20Baltimore%20Orioles%20World%20Series%20Game%205.mp3', title: '1969 Mets vs Orioles WS Game 5' },
    { url: 'https://archive.org/download/classicmlbbaseballradio/1970%2004%2022%20Padres%20vs%20New%20York%20Mets%20Seaver%2019ks%20Complete%20Broadcast%20Bob%20Murphy.mp3', title: '1970 Padres vs Mets · Seaver 19Ks' },
    { url: 'https://archive.org/download/classicmlbbaseballradio/19570805GiantsAtDodgersvinScullyRadioBroadcast.mp3', title: '1957 Giants vs Dodgers · Vin Scully' },
    { url: 'https://archive.org/download/classicmlbbaseballradio/1968%2009%2028%20Yankees%20vs%20Red%20Sox%20Mantles%20FINAL%20Game%20Messer%20Coleman%20Rizzuto%20Radio%20Broadcast.mp3', title: '1968 Yankees vs Red Sox · Mantle Final' }
  ];
  body.innerHTML = feeds.map(function(feed, idx) {
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px;background:var(--card2);border:1px solid var(--border);border-radius:4px;margin-bottom:6px;font-size:.7rem">'
      + '<div style="flex:1">'
        + '<div style="font-weight:600;color:var(--text)">📻 ' + feed.title + '</div>'
        + '<div style="color:var(--muted);margin-top:2px;font-size:.6rem;font-family:ui-monospace,monospace;word-break:break-all">' + feed.url.split('/').pop().substring(0, 40) + '…</div>'
      + '</div>'
      + '<button data-dt-action="demoFeedPlay" data-demo-feed-url="' + feed.url + '" style="background:var(--secondary);color:var(--accent-text);border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-weight:600;font-size:.65rem;flex-shrink:0;margin-left:8px">▶ Play</button>'
      + '</div>';
  }).join('');
}

export function testDemoFeedUrl(url) {
  if (!url) return;
  try {
    playArchiveUrl(url);
  } catch (e) {
    console.error('archive feed test failed:', e);
  }
}

// ── 🎯 Live Controls: Force Focus + Force Recap ─────────────────────────────
function _liveGamesForControls(){
  if(typeof state.gameStates==='undefined') return [];
  return Object.keys(state.gameStates).map(function(pk){return {pk:+pk, g:state.gameStates[pk]};})
    .filter(function(x){return x.g.status==='Live';})
    .sort(function(a,b){return (b.g.inning||0)-(a.g.inning||0);});
}
export function renderLiveControls(){
  var body=document.getElementById('liveControlsBody');
  if(!body) return;
  var live=_liveGamesForControls();
  if(!live.length){
    body.innerHTML='<div class="dt-label-muted">No live games right now. Try Demo Mode (Shift+M) to populate state.gameStates with sample data.</div>';
    return;
  }
  var opts=live.map(function(x){return '<option value="'+x.pk+'">'+escapeHtml(x.g.awayAbbr+' @ '+x.g.homeAbbr+' · '+(x.g.halfInning||'')+' '+(x.g.inning||'?')+' · '+x.g.awayScore+'-'+x.g.homeScore)+'</option>';}).join('');
  var curFocus = (typeof state.focusGamePk!=='undefined'&&state.focusGamePk) ? state.focusGamePk : '';
  body.innerHTML =
    '<div class="dt-box">'+
      '<div class="dt-label" style="margin-bottom:6px">🎯 Force Focus</div>'+
      '<div class="dt-label-muted" style="margin-bottom:6px">Override auto-scoring and pin Focus Mode to a specific live game. Resets via the ↩ AUTO pill in the focus card.</div>'+
      '<div style="display:flex;gap:6px;align-items:center">'+
        '<select id="forceFocusSel" class="dt-input" style="flex:1">'+opts+'</select>'+
        '<button data-dt-action="forceFocusGo" style="background:var(--card);border:1px solid var(--border);color:var(--text);font-size:.65rem;padding:5px 10px;border-radius:4px;cursor:pointer;font-weight:600">Apply</button>'+
      '</div>'+
      (curFocus?'<div class="dt-label-muted" style="margin-top:4px">Current focus: gamePk '+curFocus+'</div>':'')+
    '</div>'+
    '<div class="dt-box">'+
      '<div class="dt-label" style="margin-bottom:6px">📖 Force Inning Recap</div>'+
      '<div class="dt-label-muted" style="margin-bottom:6px">Queues an inning_recap story so it surfaces in the next pool build. Replaces the manual <code>state.inningRecapsPending[…]</code> + <code>buildStoryPool()</code> console workflow.</div>'+
      '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">'+
        '<select id="forceRecapGame" class="dt-input" style="flex:2;min-width:140px">'+opts+'</select>'+
        '<select id="forceRecapHalf" class="dt-input" style="flex:1;min-width:60px"><option value="top">Top</option><option value="bottom">Bottom</option></select>'+
        '<input id="forceRecapInning" type="number" min="1" max="20" placeholder="Inn" class="dt-input" style="flex:0 0 60px">'+
        '<button data-dt-action="forceRecapGo" style="background:var(--card);border:1px solid var(--border);color:var(--text);font-size:.65rem;padding:5px 10px;border-radius:4px;cursor:pointer;font-weight:600">Queue</button>'+
      '</div>'+
    '</div>';
  var sel=document.getElementById('forceRecapGame'), inn=document.getElementById('forceRecapInning'), half=document.getElementById('forceRecapHalf');
  function sync(){
    if(!sel||!inn||!half) return;
    var g=state.gameStates[+sel.value];
    if(g){ inn.value=g.inning||1; half.value=(g.halfInning||'top').toLowerCase().indexOf('bot')===0?'bottom':'top'; }
  }
  if(sel) sel.addEventListener('change',sync);
  sync();
}
export function forceFocusGo(){
  var sel=document.getElementById('forceFocusSel');
  if(!sel||!sel.value) return;
  var pk=+sel.value;
  setFocusGameManual(pk);
  pushDevLog('log','focus',['Force Focus applied · gamePk='+pk]);
  renderLiveControls();
}
export function forceRecapGo(){
  var sel=document.getElementById('forceRecapGame'),
      half=document.getElementById('forceRecapHalf'),
      inn=document.getElementById('forceRecapInning');
  if(!sel||!half||!inn||!sel.value){ alert('Pick a game first.'); return; }
  var pk=+sel.value, inning=parseInt(inn.value,10), halfInning=(half.value||'top').toLowerCase();
  if(!inning||inning<1){ alert('Enter a valid inning number.'); return; }
  var key=pk+'_'+inning+'_'+halfInning;
  if(typeof state.inningRecapsFired!=='undefined') state.inningRecapsFired.delete && state.inningRecapsFired.delete(key);
  if(typeof state.inningRecapsPending!=='undefined'){
    state.inningRecapsPending[key]={gamePk:pk, inning:inning, halfInning:halfInning};
    pushDevLog('log','recap',['Queued recap · '+key]);
  }
  if(_buildStoryPool) _buildStoryPool();
  alert('Recap queued for '+key+'. Wait for the next carousel rotation (or open Pulse to see it sooner).');
}

// ── 📋 Diagnostic Snapshot ──────────────────────────────────────────────────
export function copyDiagnosticSnapshot(){
  var ctx=_stateContext();
  var lsKeys=_lsKeys();
  var lsSizes=lsKeys.map(function(k){var e=_lsEntry(k);return '- `'+k+'`: '+_fmtBytes(e.bytes)+(e.isJson?' (json)':'');}).join('\n')||'_(none)_';
  var swSummary='_not yet fetched_';
  if(_swState && (_swState.scope||_swState.error)){
    swSummary=[
      '- Scope: '+(_swState.scope||'-'),
      '- Active: '+(_swState.scriptURL||'-'),
      '- Controller: '+(_swState.controller||'(uncontrolled)'),
      '- Update waiting: '+(_swState.hasUpdate?'YES':'no'),
      _swState.error?'- Error: '+_swState.error:null
    ].filter(Boolean).join('\n');
  }
  var counts=ctx.counts;
  var logSummary=devLog.length
    ? (function(){
        var rows=devLog.slice(-50);
        var lines=['| time | level | src | message |','|---|---|---|---|'];
        rows.forEach(function(e){
          var msg=e.msg.replace(/\|/g,'\\|').replace(/\n/g,' ↵ ');
          if(msg.length>200) msg=msg.slice(0,200)+'…';
          lines.push('| '+_fmtLogTs(e.ts)+' | '+e.level+' | '+(e.src||'-')+' | '+msg+' |');
        });
        return lines.join('\n');
      })()
    : '_(empty)_';
  var netSummary=devNetLog.length
    ? (function(){
        var lines=['| time | method | status | ms | size | url |','|---|---|---|---|---|---|'];
        devNetLog.forEach(function(e){
          var url=(e.url||'').replace(/\|/g,'\\|');
          var status=(e.status==null)?(e.ok===false?'ERR':'-'):e.status;
          lines.push('| '+_fmtLogTs(e.ts)+' | '+e.method+' | '+status+' | '+(e.ms||'-')+' | '+_fmtBytes(e.sizeBytes)+' | '+url+' |');
        });
        var failed=devNetLog.filter(function(e){return e.ok===false;});
        if(failed.length){
          lines.push('','**Failed:** '+failed.length);
          failed.forEach(function(e){lines.push('- `'+e.method+' '+(e.status||'ERR')+'` '+e.url+(e.errorMsg?' — '+e.errorMsg:''));});
        }
        return lines.join('\n');
      })()
    : '_(empty)_';

  var parts=[
    '# MLB Pulse — Diagnostic Snapshot',
    'Generated: '+new Date().toISOString(),
    'Version: '+ctx.version+' · Section: '+ctx.section+' · Active team: '+ctx.activeTeam,
    'state.demoMode: '+ctx.demoMode+' · state.pulseInitialized: '+ctx.pulseInitialized+' · pulseColorScheme: '+ctx.pulseColorScheme+' · state.themeScope: '+ctx.themeScope,
    'Focus: gamePk='+(ctx.focusGamePk||'(auto)')+' · manual='+ctx.focusIsManual+' · radioCurrentTeamId='+(ctx.radioCurrentTeamId||'-'),
    'Viewport: '+ctx.viewport,
    'UA: '+ctx.userAgent,
    '',
    '## Counts',
    '- state.gameStates: '+counts.gameStates,
    '- state.feedItems: '+counts.feedItems,
    '- state.storyPool: '+counts.storyPool,
    '- state.enabledGames: '+counts.enabledGames,
    '- devLog: '+counts.devLog,
    '- devNetLog: '+devNetLog.length,
    '',
    _stateAsMarkdownContext(),
    _stateAsMarkdownFocus(),
    _stateAsMarkdownGames(),
    _stateAsMarkdownFeed(50),
    _stateAsMarkdownStories(),
    '## Service Worker',
    '',
    swSummary,
    '',
    '## localStorage sizes',
    '',
    lsSizes,
    '',
    '## Last 50 logs',
    '',
    logSummary,
    '',
    '## Last '+devNetLog.length+' network calls',
    '',
    netSummary,
  ];
  _refreshSWState().catch(function(){});
  _copyToClipboard(parts.join('\n'),'diagSnapshotBtn');
}

// Wires <details>-toggle and filter-input listeners for each lazy-rendered panel.
// Bundle is loaded via dynamic <script> append (index.html), so DOMContentLoaded
// may have already fired by the time this runs — guard with readyState.
export function initPanelsLazyRendering(){
  function attach(){
    var stateDet=document.getElementById('appStateDetails');
    if(stateDet) stateDet.addEventListener('toggle',function(){if(stateDet.open)renderAppState();});
    var demoFeedsDet=document.getElementById('demoFeedsDetails');
    if(demoFeedsDet) demoFeedsDet.addEventListener('toggle',function(){if(demoFeedsDet.open)renderDemoFeedsTester();});
    var netDet=document.getElementById('netTraceDetails');
    if(netDet) netDet.addEventListener('toggle',function(){if(netDet.open)renderNetTrace();});
    var stoDet=document.getElementById('storageDetails');
    if(stoDet) stoDet.addEventListener('toggle',function(){if(stoDet.open)renderStorageInspector();});
    var swDet=document.getElementById('swDetails');
    if(swDet) swDet.addEventListener('toggle',function(){if(swDet.open)renderSWInspector();});
    var lcDet=document.getElementById('liveControlsDetails');
    if(lcDet) lcDet.addEventListener('toggle',function(){if(lcDet.open)renderLiveControls();});
    var det=document.getElementById('logCaptureDetails');
    if(!det)return;
    det.addEventListener('toggle',function(){if(det.open)renderLogCapture();});
    var lvl=document.getElementById('logCaptureLevel');
    if(lvl) lvl.addEventListener('change',renderLogCapture);
    var f=document.getElementById('logCaptureFilter');
    if(f) f.addEventListener('input',renderLogCapture);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach);
  else attach();
}
