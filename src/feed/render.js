import { state } from '../state.js';
import { MLB_BASE, MLB_THEME } from '../config/constants.js';
import { ordinal } from '../carousel/generators.js';
import { devTrace } from '../devtools-feed/devLog.js';
import { etDateStr, etDatePlus } from '../utils/format.js';
import { calcFocusScore } from '../focus/mode.js';

const DEBUG = false;

let feedCallbacks = { localDateStr: null };
function setFeedCallbacks(callbacks) {
  Object.assign(feedCallbacks, callbacks);
}

function baseDiamondSvg(on1,on2,on3) {
  const litStyle='fill:#ffd000;filter:drop-shadow(0 0 3px rgba(255,208,0,0.85))';
  const dimStyle='fill:var(--muted,#9aa0a8);opacity:0.4';
  return '<svg class="ticker-diamond" width="28" height="24" viewBox="0 0 28 24" aria-hidden="true">'
    +'<path d="M14,21 L24,12 L14,3 L4,12 Z" fill="none" style="stroke:var(--border,rgba(255,255,255,0.1))" stroke-width="1.2" opacity="0.45"/>'
    +'<circle cx="14" cy="21" r="2" style="'+dimStyle+'"/>'
    +'<circle cx="24" cy="12" r="3" style="'+(on1?litStyle:dimStyle)+'"/>'
    +'<circle cx="14" cy="3"  r="3" style="'+(on2?litStyle:dimStyle)+'"/>'
    +'<circle cx="4"  cy="12" r="3" style="'+(on3?litStyle:dimStyle)+'"/>'
    +'</svg>';
}

function tensionBand(score) {
  if (score<=0)   return 0;
  if (score<=15)  return 1;
  if (score<=30)  return 2;
  if (score<=44)  return 3;
  if (score<=59)  return 4;
  if (score<=76)  return 5;
  if (score<=93)  return 6;
  if (score<=109) return 7;
  if (score<=129) return 8;
  if (score<=179) return 9;
  return 10;
}

function startCountdown(targetMs) {
  if (state.countdownTimer){clearInterval(state.countdownTimer);state.countdownTimer=null;}
  function tick() {
    const el=document.getElementById('heroCountdown');
    if (!el){clearInterval(state.countdownTimer);state.countdownTimer=null;return;}
    const diff=targetMs-Date.now();
    if (diff<=0){el.textContent='Starting now';}
    else if (diff>=3600000){const hrs=Math.floor(diff/3600000),mins=Math.ceil((diff%3600000)/60000);el.textContent='First pitch in '+hrs+'h'+(mins>0?' '+mins+'m':'');}
    else{const mins=Math.ceil(diff/60000);el.textContent='First pitch in '+mins+'m';}
  }
  tick(); state.countdownTimer=setInterval(tick,30000);
}

function isPostSlate() {
  const games=Object.values(state.gameStates);
  if (!games.length) return false;
  if (!games.every(function(g){return g.status==='Final';})) return false;
  let lastTerminalMs=0;
  state.feedItems.forEach(function(fi){
    if (fi.data&&fi.data.type==='status'&&(fi.data.label==='Game Final'||fi.data.label==='Game Postponed')) {
      const ms=fi.ts.getTime(); if (ms>lastTerminalMs) lastTerminalMs=ms;
    }
  });
  if (!lastTerminalMs) return false;
  return (Date.now()-lastTerminalMs) > (state.devTuning.postSlateRevertMs||20*60*1000);
}

function isIntermission() {
  const games=Object.values(state.gameStates);
  if (!games.length) return false;
  if (!games.some(function(g){return g.status==='Final';})) return false;
  if (games.some(function(g){return g.status==='Live'&&g.detailedState!=='Warmup'&&g.detailedState!=='Pre-Game';})) return false;
  if (!games.some(function(g){return g.status!=='Final';})) return false;
  let lastTerminalMs=0;
  state.feedItems.forEach(function(fi){
    if (fi.data&&fi.data.type==='status'&&(fi.data.label==='Game Final'||fi.data.label==='Game Postponed')) {
      const ms=fi.ts.getTime(); if (ms>lastTerminalMs) lastTerminalMs=ms;
    }
  });
  if (!lastTerminalMs) return false;
  return (Date.now()-lastTerminalMs) > (state.devTuning.intermissionRevertMs||20*60*1000);
}

async function fetchTomorrowPreview() {
  if (state.tomorrowPreview.inFlight) return;
  if (Date.now()-state.tomorrowPreview.fetchedAt < 10*60*1000) return;
  state.tomorrowPreview.inFlight=true;
  try {
    const ts=etDatePlus(state.pollDateStr||etDateStr(),1);
    const r=await fetch(MLB_BASE+'/schedule?sportId=1&date='+ts+'&hydrate=team');
    if(!r.ok) throw new Error(r.status);
    const d=await r.json();
    const games=(d.dates||[]).flatMap(function(dt){return dt.games||[];});
    state.tomorrowPreview.dateStr=ts;
    state.tomorrowPreview.gameCount=games.length;
    if (games.length) {
      games.sort(function(a,b){return new Date(a.gameDate).getTime()-new Date(b.gameDate).getTime();});
      const first=games[0], ms=new Date(first.gameDate).getTime();
      state.tomorrowPreview.firstPitchMs=ms;
      state.tomorrowPreview.gameTime=new Date(ms).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
    } else {
      state.tomorrowPreview.firstPitchMs=null;
      state.tomorrowPreview.gameTime=null;
    }
    state.tomorrowPreview.fetchedAt=Date.now();
    if (isPostSlate()) renderEmptyState(true);
  } catch(e){if(DEBUG)console.warn('fetchTomorrowPreview',e);}
  finally{state.tomorrowPreview.inFlight=false;}
}

function hypeHeadline(diffMs) {
  if (diffMs > 4*3600000) return 'Catch up on all the latest action.';
  if (diffMs > 3600000)   return 'Starters warming up.';
  return 'First pitch soon.';
}

function renderAllHiddenState() {
  const el=document.getElementById('feedEmpty');
  el.className='';
  el.innerHTML='<span class="empty-icon">👁</span><div class="empty-title">Feed hidden</div><div class="empty-sub">Tap a game chip above to follow its live feed.</div>';
}

function updateFeedEmpty() {
  const feed=document.getElementById('feed');
  const hasVisible=!!feed.querySelector('.feed-item:not(.feed-hidden)');
  const hasHiddenItems=!!feed.querySelector('.feed-item.feed-hidden');
  const hasAnyGames=Object.keys(state.gameStates).length>0;
  const hasLiveInProgress=Object.values(state.gameStates).some(function(g){return g.status==='Live'&&g.detailedState!=='Warmup'&&g.detailedState!=='Pre-Game';});
  const postSlate=isPostSlate();
  const intermission=!postSlate&&isIntermission();
  // User manually hid all games via ticker chips — distinct from "no games exist"
  const allUserHidden=!state.myTeamLens&&!postSlate&&!intermission&&hasHiddenItems&&!hasVisible;
  const showHype=(!hasVisible&&!allUserHidden&&!(state.myTeamLens&&hasLiveInProgress))||(!hasAnyGames)||postSlate||intermission;
  if (showHype) renderEmptyState(postSlate, intermission);
  else if (allUserHidden) renderAllHiddenState();
  document.getElementById('feedEmpty').style.display=(showHype||allUserHidden)?'':'none';
  const hideWhenEmpty=['gameTicker','sideRailNews','sideRailGames','myTeamLensBtn'];
  document.getElementById('pulse').classList.toggle('pulse-empty', !hasAnyGames || showHype);
  hideWhenEmpty.forEach(function(id){
    const el=document.getElementById(id);
    if(el) el.style.display=(showHype&&!allUserHidden)?'none':'';
  });
  const ybtn=document.getElementById('ptbYestBtn');
  if(ybtn) ybtn.style.display=(state.yesterdayCache&&state.yesterdayCache.length&&!showHype&&!allUserHidden)?'':'none';
}

function renderEmptyState(postSlate, intermission) {
  const el=document.getElementById('feedEmpty');
  const upcoming=Object.values(state.gameStates).filter(function(g){
    if(!(g.status==='Preview'||g.status==='Scheduled'||(g.status==='Live'&&(g.detailedState==='Warmup'||g.detailedState==='Pre-Game')))) return false;
    const rawG=state.storyCarouselRawGameData&&state.storyCarouselRawGameData[g.gamePk];
    if(rawG&&rawG.doubleHeader==='Y'&&rawG.gameNumber==2){
      if(Object.values(state.gameStates).some(function(s){return s.status==='Live'&&s.awayId===g.awayId&&s.homeId===g.homeId;})) return false;
    }
    return true;
  });
  upcoming.sort(function(a,b){const aMs=a.gameDateMs||0,bMs=b.gameDateMs||0;if(aMs!==bMs)return aMs-bMs;return a.awayAbbr.localeCompare(b.awayAbbr);});
  devTrace('empty','renderEmptyState · upcoming='+upcoming.length+' · postSlate='+postSlate+' · intermission='+intermission);
  if (!upcoming.length){
    el.className='';
    if (postSlate) {
      fetchTomorrowPreview();
      let subText='Live play-by-play returns when games begin.';
      let countdownHtml='';
      if (state.tomorrowPreview.firstPitchMs) {
        countdownHtml='<div id="heroCountdown" style="margin-top:14px;font-size:1rem;color:var(--accent);font-weight:700"></div>';
        const n=state.tomorrowPreview.gameCount;
        subText='Next slate · '+n+' '+(n===1?'game':'games')+' · first pitch '+(state.tomorrowPreview.gameTime||'TBD');
      } else if (state.tomorrowPreview.fetchedAt && state.tomorrowPreview.gameCount===0) {
        subText='No games scheduled in the next slate.';
      }
      const _etH=new Date(new Date().toLocaleString('en-US',{timeZone:'America/New_York'})).getHours();
      const _pastMidnight=_etH<6;
      const slateRecapCta=(Object.values(state.gameStates).length)?'<button onclick="openYesterdayRecap('+(_pastMidnight?'-1':'0')+')" style="margin-top:20px;display:inline-flex;align-items:center;gap:7px;background:none;border:1px solid var(--accent);color:var(--accent);font-size:.8rem;font-weight:700;letter-spacing:.06em;padding:9px 18px;border-radius:7px;cursor:pointer">📺 '+(_pastMidnight?"Yesterday's":"Today's")+' Highlights →</button>':'';
      el.innerHTML='<span class="empty-icon">🏁</span><div class="empty-title">Slate complete</div><div class="empty-sub">'+subText+'</div>'+countdownHtml+slateRecapCta;
      if (state.tomorrowPreview.firstPitchMs) startCountdown(state.tomorrowPreview.firstPitchMs);
    } else {
      el.innerHTML='<span class="empty-icon">⚾</span><div class="empty-title">Up next</div><div class="empty-sub">Check back for today\'s slate.</div>';
    }
    return;
  }
  el.className='has-upcoming';
  const hero=upcoming[0], rest=upcoming.slice(1), n=upcoming.length;
  const heroGrad=state.themeOverride===MLB_THEME?'linear-gradient(90deg,'+MLB_THEME.primary+' 0%,#111827 45%,'+MLB_THEME.primary+' 100%)':'linear-gradient(90deg,'+hero.awayPrimary+' 0%,#111827 45%,'+hero.homePrimary+' 100%)';
  const headline=hypeHeadline(hero.gameDateMs?hero.gameDateMs-Date.now():0);
  const labelText=intermission
    ? 'NEXT UP &middot; '+n+(n===1?' GAME REMAINING':' GAMES REMAINING')
    : n+(n===1?' UPCOMING GAME':' UPCOMING GAMES');
  const hypeRecapCta=(state.yesterdayCache&&state.yesterdayCache.length)?'<button onclick="openYesterdayRecap()" style="display:inline-flex;align-items:center;gap:7px;background:none;border:1px solid var(--accent);color:var(--accent);font-size:.78rem;font-weight:700;letter-spacing:.06em;padding:7px 16px;border-radius:7px;cursor:pointer">📺 Yesterday\'s Highlights →</button>':'';
  const hypeBlock=intermission
    ?'<div class="empty-hype-block"><div class="empty-hype-headline">'+headline+'</div></div>'
    :'<div class="empty-hype-block"><div class="empty-hype-headline">'+headline+'</div>'
    +'<div class="hype-cta-row">'
    +hypeRecapCta
    +'<button class="demo-cta" onclick="toggleDemoMode()">'+(state.demoMode?'⏹ Exit Demo':'▶ Try Demo')+'</button>'
    +'</div>'
    +'<div class="empty-hype-pills"><span class="hype-pill hr">💥 Home Runs</span><span class="hype-pill scoring">🟢 Scoring Plays</span><span class="hype-pill risp">⚡ RISP</span></div>'
    +'<div class="empty-hype-sub">Play-by-play from every MLB game surfaces here the moment a game starts.</div></div>';
  let html='<div class="empty-upcoming-label">'+labelText+'</div>'
    +hypeBlock
    +'<div class="upcoming-hero" style="background:'+heroGrad+'">'
    +'<div class="upcoming-hero-kicker">NEXT UP</div>'
    +'<div class="upcoming-matchup-row">'
    +'<div style="display:flex;align-items:center;gap:9px"><img class="upcoming-cap" src="https://www.mlbstatic.com/team-logos/'+hero.awayId+'.svg" onerror="this.style.display=\'none\'"><div class="upcoming-team-name">'+hero.awayAbbr+'</div></div>'
    +'<div class="upcoming-at">@</div>'
    +'<div style="display:flex;align-items:center;gap:9px;flex-direction:row-reverse"><img class="upcoming-cap" src="https://www.mlbstatic.com/team-logos/'+hero.homeId+'.svg" onerror="this.style.display=\'none\'"><div class="upcoming-team-name">'+hero.homeAbbr+'</div></div>'
    +'</div>'
    +'<div class="upcoming-foot"><div><div class="upcoming-foot-time">'+(hero.gameTime||'TBD')+'</div><div class="upcoming-foot-countdown" id="heroCountdown"></div></div>'
    +(hero.venueName?'<div class="upcoming-foot-venue">'+hero.venueName+'</div>':'')+'</div></div>';
  if (rest.length) {
    html+='<div class="upcoming-grid">';
    rest.forEach(function(g){
      html+='<div class="matchup-card"><div style="font-size:.65rem;color:var(--muted);margin-bottom:4px">'+(g.gameTime||'TBD')+'</div>'
        +'<div style="display:flex;align-items:center;justify-content:center;gap:6px">'
        +'<div style="text-align:center"><img class="matchup-cap" src="https://www.mlbstatic.com/team-logos/'+g.awayId+'.svg" onerror="this.style.display=\'none\'"><div style="font-size:.8rem;font-weight:700;color:var(--text)">'+g.awayAbbr+'</div><div style="font-size:.62rem;color:var(--muted)">'+(g.awayW!=null?'('+g.awayW+'-'+g.awayL+')':'')+'</div></div>'
        +'<span style="color:var(--muted);font-size:.8rem">vs</span>'
        +'<div style="text-align:center"><img class="matchup-cap" src="https://www.mlbstatic.com/team-logos/'+g.homeId+'.svg" onerror="this.style.display=\'none\'"><div style="font-size:.8rem;font-weight:700;color:var(--text)">'+g.homeAbbr+'</div><div style="font-size:.62rem;color:var(--muted)">'+(g.homeW!=null?'('+g.homeW+'-'+g.homeL+')':'')+'</div></div>'
        +'</div></div>';
    });
    html+='</div>';
  }
  el.innerHTML=html;
  if (hero.gameDateMs) startCountdown(hero.gameDateMs);
}

function addFeedItem(gamePk,data) {
  const item={gamePk:gamePk,data:data,ts:data.playTime||new Date()};
  const idx=state.feedItems.findIndex(function(fi){return fi.ts<=item.ts;});
  if(idx===-1) state.feedItems.push(item); else state.feedItems.splice(idx,0,item);
  if(state.feedItems.length>600) state.feedItems.length=600;
  if (typeof window !== 'undefined' && window.Recorder && window.Recorder.active) {
    window.Recorder._captureFeedItem(item);
  }
  const el=buildFeedEl(item);
  el.dataset.ts=item.ts.getTime();
  if(!state.enabledGames.has(+gamePk)) el.classList.add('feed-hidden');
  const feed=document.getElementById('feed');
  const tsMs=item.ts.getTime();
  const sibling=Array.from(feed.children).find(function(c){return +c.dataset.ts<tsMs;});
  feed.insertBefore(el,sibling||null);
  updateFeedEmpty();
}

function buildFeedEl(item) {
  const el=document.createElement('div'), g=state.gameStates[item.gamePk], d=item.data;
  if (d.type==='status') {
    el.className='feed-item status-change'; el.setAttribute('data-gamepk',item.gamePk);
    el.innerHTML='<div class="status-row"><span class="status-icon">'+d.icon+'</span><span class="status-label">'+d.label+'</span><span class="status-sub">'+d.sub+'</span></div>';
    return el;
  }
  let cls='feed-item';
  if (d.playClass==='homerun') cls+=' homerun';
  else if (d.playClass==='scoring') cls+=' scoring';
  else if (d.playClass==='risp') cls+=' risp';
  el.className=cls; el.setAttribute('data-gamepk',item.gamePk);
  const half=d.halfInning==='top'?'▲':'▼';
  const innStr=half+ordinal(d.inning), outsStr=d.outs===1?'1 out':d.outs+' outs';
  const timeStr=item.ts.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
  const metaHtml='<div class="feed-meta">'
    +'<span class="feed-game-tag"><span class="feed-team-dot" style="background:'+g.awayPrimary+'"></span>'+g.awayAbbr+'&nbsp;<strong>'+d.awayScore+'</strong></span>'
    +'<span class="feed-sep">·</span>'
    +'<span class="feed-game-tag"><strong>'+d.homeScore+'</strong>&nbsp;'+g.homeAbbr+'<span class="feed-team-dot" style="background:'+g.homePrimary+'"></span></span>'
    +'<span class="feed-sep">·</span><span>'+innStr+'</span><span class="feed-sep">·</span><span>'+outsStr+'</span>'
    +'<span class="feed-time">'+timeStr+'</span></div>';
  const icon=d.event==='Home Run'?'💥 ':d.scoring?'🟢 ':'';
  let scoreBadge='';
  if (d.scoring) {
    const awayScores=(d.halfInning==='top');
    const awayHtml=awayScores?'<span class="feed-score-scorer">'+g.awayAbbr+'&thinsp;'+d.awayScore+'</span>':g.awayAbbr+'&thinsp;'+d.awayScore;
    const homeHtml=!awayScores?'<span class="feed-score-scorer">'+d.homeScore+'&thinsp;'+g.homeAbbr+'</span>':d.homeScore+'&thinsp;'+g.homeAbbr;
    scoreBadge='<span class="feed-score-badge">'+awayHtml+'<span class="feed-score-sep">·</span>'+homeHtml+'</span>';
  }
  const rispBadge=d.risp?'<span class="risp-tag">⚡ RISP</span>':'';
  let evt=d.event||'', playBadge='';
  if (evt==='Single') playBadge='<span class="play-tag hit-tag">1B</span>';
  else if (evt==='Double') playBadge='<span class="play-tag hit-tag">2B</span>';
  else if (evt==='Triple') playBadge='<span class="play-tag hit-tag">3B</span>';
  else if (evt==='Walk'||evt==='Intent Walk') playBadge='<span class="play-tag walk-tag">BB</span>';
  else if (evt==='Strikeout') playBadge='<span class="play-tag k-tag">K</span>';
  else if (evt.indexOf('Error')!==-1) playBadge='<span class="play-tag err-tag">E</span>';
  else if (evt.indexOf('Triple Play')!==-1) playBadge='<span class="play-tag tp-tag">TP</span>';
  else if (evt.indexOf('Double Play')!==-1||evt.indexOf('Grounded Into DP')!==-1) playBadge='<span class="play-tag dp-tag">DP</span>';
  el.innerHTML=metaHtml+'<div class="feed-play">'+icon+d.desc+rispBadge+playBadge+scoreBadge+'</div>';
  return el;
}

function renderFeed() {
  const feed=document.getElementById('feed');
  if(!feed) return;
  feed.innerHTML='';
  state.feedItems.forEach(function(item){
    if(state.demoMode&&item.ts.getTime()>state.demoCurrentTime) return;
    const el=buildFeedEl(item);el.dataset.ts=item.ts.getTime();if(!state.enabledGames.has(+item.gamePk))el.classList.add('feed-hidden');feed.appendChild(el);
  });
  updateFeedEmpty();
}

function renderTicker() {
  let ticker=document.getElementById('gameTicker'), states=Object.values(state.gameStates);
  states=states.filter(function(g){return g.status==='Live';});
  if (!states.length){
    ticker.innerHTML='<div style="flex:1;display:flex;align-items:center;justify-content:center;padding:20px 12px;min-height:50px;">'
      +'<div style="text-align:center">'
      +'<div style="font-size:24px;margin-bottom:6px">⚾</div>'
      +'<div style="font-size:.81rem;font-weight:600;color:var(--text);margin-bottom:2px">No Live Games</div>'
      +'</div>'
      +'</div>';
    return;
  }
  // POC: sort by focus score descending so hottest game is leftmost
  states.sort(function(a,b){ return calcFocusScore(b)-calcFocusScore(a); });

  // Clear placeholder content (e.g. "No Live Games" div) — it has no data-gamepk
  Array.from(ticker.children).forEach(function(child){
    if(!child.dataset||!child.dataset.gamepk) ticker.removeChild(child);
  });

  // FLIP phase 1 — snapshot left offsets before any DOM change
  const oldLeft={};
  ticker.querySelectorAll('.ticker-game[data-gamepk]').forEach(function(el){
    oldLeft[el.dataset.gamepk]=el.offsetLeft;
  });

  // Update or create each chip in-place (preserves elements for FLIP)
  states.forEach(function(g){
    const isLive=g.status==='Live', isFinal=g.status==='Final';
    const sc=isLive?'status-live':isFinal?'status-final':'status-preview';
    const half=g.halfInning==='top'?'▲':'▼';
    const isPostponed=isFinal&&(g.detailedState==='Postponed'||g.detailedState==='Cancelled'||g.detailedState==='Suspended');
    const innStr=isLive?(half+g.inning):isPostponed?'PPD':isFinal?'FINAL':g.gameTime?g.gameTime:'PRE';
    let warmupClass='';
    if(isLive&&(g.detailedState==='Warmup'||g.detailedState==='Pre-Game')){warmupClass=' warmup-state';}
    const dot=isLive?'<div class="ticker-live-dot'+warmupClass+'"></div>':'';
    const hasRunners=isLive&&(g.onFirst||g.onSecond||g.onThird);
    const fc=state.enabledGames.has(g.gamePk)?' feed-enabled':' feed-disabled';
    const rc=hasRunners?' has-risp':'';
    const band=tensionBand(calcFocusScore(g));
    const tc=band?' tb-'+band:'';
    let outsHtml='';
    if(isLive){outsHtml='<span class="ticker-outs">'+[0,1,2].map(function(i){return '<span class="out-dot'+(i<g.outs?' out-on':'')+'"></span>';}).join('')+'</span>';}
    let inner;
    if(hasRunners){
      inner='<div class="ticker-top">'+dot
        +'<span class="ticker-score">'+g.awayAbbr+'&nbsp;<strong>'+g.awayScore+'</strong></span>'
        +'<span class="ticker-divider">·</span>'
        +'<span class="ticker-score"><strong>'+g.homeScore+'</strong>&nbsp;'+g.homeAbbr+'</span>'
        +'</div><div class="ticker-bottom">'+baseDiamondSvg(g.onFirst,g.onSecond,g.onThird)
        +'<span class="ticker-inning">'+innStr+'</span>'+outsHtml+'</div>';
    } else {
      const spacer=isLive?'<div class="ticker-dot-spacer"></div>':'';
      inner='<div class="ticker-row">'+dot+'<span class="ticker-score">'+g.awayAbbr+'&nbsp;<strong>'+g.awayScore+'</strong></span></div>'
        +'<div class="ticker-row">'+spacer+'<span class="ticker-score">'+g.homeAbbr+'&nbsp;<strong>'+g.homeScore+'</strong></span></div>'
        +'<div class="ticker-row"><span class="ticker-inning">'+innStr+'</span>'+outsHtml+'</div>';
    }
    let el=ticker.querySelector('.ticker-game[data-gamepk="'+g.gamePk+'"]');
    if(el){
      el.className='ticker-game '+sc+fc+rc+tc;
      el.innerHTML=inner;
    } else {
      el=document.createElement('div');
      el.className='ticker-game '+sc+fc+rc+tc;
      el.dataset.gamepk=g.gamePk;
      el.setAttribute('onclick','toggleGame('+g.gamePk+')');
      el.innerHTML=inner;
      ticker.appendChild(el);
    }
  });

  // Remove chips for games no longer live
  ticker.querySelectorAll('.ticker-game[data-gamepk]').forEach(function(el){
    const pk=+el.dataset.gamepk;
    if(!states.some(function(g){return g.gamePk===pk;})) ticker.removeChild(el);
  });

  // Reorder: appendChild moves existing elements to the end in score order
  states.forEach(function(g){
    const el=ticker.querySelector('.ticker-game[data-gamepk="'+g.gamePk+'"]');
    if(el) ticker.appendChild(el);
  });

  // FLIP phase 2 — animate chips that moved from their old position
  states.forEach(function(g){
    const el=ticker.querySelector('.ticker-game[data-gamepk="'+g.gamePk+'"]');
    if(!el||oldLeft[g.gamePk]==null) return;
    const delta=oldLeft[g.gamePk]-el.offsetLeft;
    if(Math.abs(delta)<1) return;
    el.style.transition='none';
    el.style.transform='translateX('+delta+'px)';
    requestAnimationFrame(function(){
      requestAnimationFrame(function(){
        el.style.transition='transform 0.35s cubic-bezier(0.4,0,0.2,1)';
        el.style.transform='';
      });
    });
  });
}

function renderSideRailGames() {
  let upcomingHtml='', completedHtml='';
  let upcomingGames=[], completedGames=[], liveCount=0;
  const localDateStr=feedCallbacks.localDateStr;
  const filterDate=state.demoMode&&localDateStr?localDateStr(state.demoDate):localDateStr?localDateStr(new Date()):null;
  if(state.demoMode&&DEBUG) console.log('Demo: renderSideRailGames filtering to date',filterDate,'from',Object.keys(state.gameStates).length,'total games');
  Object.values(state.gameStates).forEach(function(g) {
    if(state.demoMode&&localDateStr&&localDateStr(new Date(g.gameDateMs))!==filterDate) return;
    if (g.status==='Live') { liveCount++; return; }
    if (g.status==='Final') completedGames.push(g);
    else upcomingGames.push(g);
  });
  upcomingGames.sort(function(a,b){return (a.gameDateMs||0)-(b.gameDateMs||0);});
  completedGames.sort(function(a,b){return (b.gameDateMs||0)-(a.gameDateMs||0);});
  if (upcomingGames.length) {
    upcomingHtml+='<div class="side-rail-section-header"><span class="side-rail-section-title">Upcoming Today</span><span class="game-count">'+upcomingGames.length+'</span></div>';
    upcomingHtml+='<div class="side-rail-games-container">';
    upcomingGames.forEach(function(g) {
      const time=g.gameTime||'TBD';
      upcomingHtml+='<div class="side-rail-game" onclick="showLiveGame('+g.gamePk+')">'
        +'<span class="side-rail-game-time-badge">'+time+'</span>'
        +'<span class="side-rail-game-dot" style="background:'+g.awayPrimary+'"></span>'
        +'<span class="side-rail-game-abbr">'+g.awayAbbr+'</span>'
        +'<span class="side-rail-game-vs">@</span>'
        +'<span class="side-rail-game-dot" style="background:'+g.homePrimary+'"></span>'
        +'<span class="side-rail-game-abbr">'+g.homeAbbr+'</span>'
        +'</div>';
    });
    upcomingHtml+='</div>';
  }
  if (completedGames.length) {
    completedHtml+='<div class="side-rail-section-header"><span class="side-rail-section-title">Completed</span><span class="game-count">'+completedGames.length+'</span></div>';
    completedHtml+='<div class="side-rail-games-container">';
    completedGames.forEach(function(g) {
      const isPostponed=g.detailedState==='Postponed'||g.detailedState==='Cancelled'||g.detailedState==='Suspended';
      const scoreStr=isPostponed?'PPD':g.awayScore+'-'+g.homeScore;
      completedHtml+='<div class="side-rail-game" onclick="showLiveGame('+g.gamePk+')">'
        +'<span class="side-rail-game-score-badge">'+scoreStr+'</span>'
        +'<span class="side-rail-game-dot" style="background:'+g.awayPrimary+'"></span>'
        +'<span class="side-rail-game-abbr">'+g.awayAbbr+'</span>'
        +'<span class="side-rail-game-vs">@</span>'
        +'<span class="side-rail-game-dot" style="background:'+g.homePrimary+'"></span>'
        +'<span class="side-rail-game-abbr">'+g.homeAbbr+'</span>'
        +'</div>';
    });
    completedHtml+='</div>';
  }
  let gamesHtml=upcomingHtml+completedHtml;
  if (!gamesHtml) gamesHtml='<div style="color:var(--muted);font-size:.75rem;padding:12px;text-align:center;">'+(liveCount?('All '+liveCount+' game'+(liveCount>1?'s':'')+' in progress — see ticker above'):'No games today')+'</div>';
  document.getElementById('sideRailGames').innerHTML=gamesHtml;
}

function showAlert(opts) {
  const icon=opts.icon||'🔔', evtLabel=opts.event||'', desc=opts.desc||'', color=opts.color||'#e03030', duration=opts.duration||5000, persistent=!!opts.persistent;
  const stack=document.getElementById('alertStack'), el=document.createElement('div');
  el.className='alert-toast'; el.style.borderLeftColor=color;
  if(!persistent) el.style.setProperty('--toast-duration',duration+'ms');
  const closeBtn=persistent?'<button class="alert-dismiss" onclick="event.stopPropagation()" aria-label="Dismiss">✕</button>':'';
  const progressBar=persistent?'':'<div class="alert-progress"></div>';
  el.innerHTML='<span class="alert-icon">'+icon+'</span><div class="alert-body"><div class="alert-event">'+evtLabel+'</div><div class="alert-desc">'+desc+'</div></div>'+closeBtn+progressBar;
  el.addEventListener('click',function(){dismissAlert(el);});
  if(persistent){const btn=el.querySelector('.alert-dismiss');if(btn)btn.addEventListener('click',function(){dismissAlert(el);});}
  stack.appendChild(el);
  if(!persistent) setTimeout(function(){dismissAlert(el);},duration);
}

function dismissAlert(el){if(!el.parentNode)return;el.classList.add('dismissing');setTimeout(function(){el.remove();},300);}

export {
  setFeedCallbacks, baseDiamondSvg, startCountdown, isPostSlate, isIntermission,
  fetchTomorrowPreview, hypeHeadline, updateFeedEmpty, renderEmptyState,
  addFeedItem, buildFeedEl, renderFeed, renderTicker, renderSideRailGames,
  showAlert, dismissAlert,
};
