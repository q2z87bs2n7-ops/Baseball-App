// ── Yesterday Recap Overlay ─────────────────────────────────────────────────
// Full-screen recap for yesterday's games (or any past date via ←/→ date picker):
//  - shared video player at top (loadYesterdayHero → buildTopHighlightsCarousel)
//  - "yesterday's heroes" strip (HR hitters + walk-off heroes)
//  - per-game tile grid with single recap thumbnail (lazy-loaded via IntersectionObserver)
//  - collected cards earned that day strip (uses window.CollectionCard.renderMiniCard)

import { state } from '../state.js';
import { TEAMS, MLB_BASE } from '../config/constants.js';
import { stopAllMedia } from '../radio/engine.js';
import { showLiveGame } from './live.js';
import { pickPlayback, pickHeroImage, fetchGameContent } from '../data/clips.js';
import { loadYdForDate } from '../carousel/generators.js';
import { loadCollection, tierRank, fetchCareerStats } from '../collection/book.js';
import { etDateStr, etDatePlus } from '../utils/format.js';

let ydPrevSection = null;

function forceHttps(url) {
  return url?url.replace(/^http:/,'https:'):url;
}

// Kept for backward compat; collection helpers now imported directly.
export function setYesterdayCallbacks(cbs) {}

function getYdActiveCache(){return state.ydDisplayCache!==null?state.ydDisplayCache:(state.yesterdayCache||[]);}

export function openYesterdayRecap(offset) {
  state.yesterdayOverlayOpen=true;
  state.ydDateOffset=(typeof offset==='number')?offset:-1;
  state.ydDisplayCache=null;
  const active=document.querySelector('.section.active');
  ydPrevSection=active?active.id:null;
  document.querySelectorAll('.section').forEach(function(s){s.classList.remove('active');});
  document.querySelectorAll('nav button').forEach(function(b){b.classList.remove('active');});
  document.getElementById('yesterday').classList.add('active');
  const lbl=document.getElementById('ydDateLabel');
  if(lbl) lbl.textContent=getYesterdayDisplayStr();
  const nextBtn=document.getElementById('ydNextDateBtn');
  if(nextBtn) nextBtn.disabled=(state.ydDateOffset>=0);
  // In demo, the cached state.yesterdayCache reflects the recording's
  // real wall-clock yesterday, which doesn't necessarily match the demo
  // anchor date (demoDate - 1). Always fetch fresh data via loadYdForDate
  // for the demo's anchor day so the page shows the right date's games.
  // Also fetch fresh when opening at today (offset 0) since there's no pre-loaded cache.
  if((state.demoMode||state.ydDateOffset===0)&&loadYdForDate){
    const card=document.getElementById('yesterdayCard');
    if(card) card.innerHTML='<div style="padding:48px;text-align:center;color:var(--muted);font-size:.88rem">Loading…</div>';
    loadYdForDate(getYesterdayDateStr()).then(function(data){
      state.ydDisplayCache=data||[];
      renderYesterdayRecap();
    }).catch(function(e){console.error('[yesterday] loadYdForDate error',e);});
  }else{
    renderYesterdayRecap();
  }
}

export async function ydChangeDate(dir){
  const newOffset=state.ydDateOffset+dir;
  // Cap forward navigation — in demo, "yesterday" is demoDate-1 and
  // there's no real future to navigate into. In live, same cap applies.
  if(newOffset>0) return;
  if(newOffset<-365) return;
  state.ydDateOffset=newOffset;
  const lbl=document.getElementById('ydDateLabel');
  if(lbl) lbl.textContent=getYesterdayDisplayStr();
  const nextBtn=document.getElementById('ydNextDateBtn');
  if(nextBtn) nextBtn.disabled=(state.ydDateOffset>=0);
  const card=document.getElementById('yesterdayCard');
  if(card) card.innerHTML='<div style="padding:48px;text-align:center;color:var(--muted);font-size:.88rem">Loading…</div>';
  const heroRegion=document.getElementById('ydHeroRegion');
  if(heroRegion){heroRegion.dataset.mounted='';heroRegion.innerHTML='';}
  if(state.ydDateOffset===-1&&!state.demoMode){
    // Live: offset=-1 is "yesterday relative to today" — state.yesterdayCache
    // was already loaded at app init via loadYdForDate, no extra fetch.
    state.ydDisplayCache=null;
  }else if(loadYdForDate){
    state.ydDisplayCache=await loadYdForDate(getYesterdayDateStr());
  }
  renderYesterdayRecap();
}

export function closeYesterdayRecap() {
  state.yesterdayOverlayOpen=false;
  document.querySelectorAll('.section').forEach(function(s){s.classList.remove('active');});
  const returnId=ydPrevSection||'pulse';
  const returnEl=document.getElementById(returnId);
  if(returnEl) returnEl.classList.add('active');
  document.querySelectorAll('nav button').forEach(function(b){
    const onclick=b.getAttribute('onclick')||'';
    if(onclick.indexOf("'"+returnId+"'")!==-1) b.classList.add('active');
  });
}

// In demo mode, anchor "today" to state.demoDate (set by initDemo from the
// earliest captured gameDateMs) so "yesterday" maps to the day before the
// recording instead of today's real-clock date. ET-anchored so non-US users
// see the same MLB schedule day as everyone else.
function _ydAnchorDate() {
  return state.demoMode && state.demoDate ? new Date(state.demoDate) : new Date();
}

function getYesterdayDateStr() {
  return etDatePlus(etDateStr(_ydAnchorDate()), state.ydDateOffset);
}

function getYesterdayDisplayStr() {
  const s=getYesterdayDateStr().split('-');
  const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return months[+s[1]-1]+' '+(+s[2])+', '+s[0];
}

function getYesterdayCollectedCards() {
  const ydStr=getYesterdayDateStr();
  try {
    const col=loadCollection();
    const slots=Object.values(col).filter(function(s){
      return s.events&&s.events.some(function(ev){return ev.date===ydStr;});
    });
    slots.sort(function(a,b){return tierRank(b.tier)-tierRank(a.tier);});
    return slots.slice(0,5);
  } catch(e){ return []; }
}

async function renderYesterdayRecap() {
  const card=document.getElementById('yesterdayCard');
  if(!card) return;
  const activeCache=getYdActiveCache();
  if(!activeCache||!activeCache.length){
    const noGamesMsg=state.ydDateOffset===-1?'No games yesterday.':'No games played on '+getYesterdayDisplayStr()+'.';
    card.innerHTML='<div class="empty-state" style="padding:48px 24px">'+noGamesMsg+'</div>';
    return;
  }

  const ydCards=getYesterdayCollectedCards();
  let cardsHtml='';
  if(ydCards.length&&window.CollectionCard){
    await Promise.all(ydCards.map(function(s){
      return state.collectionCareerStatsCache[s.playerId]
        ? Promise.resolve()
        : fetchCareerStats(s.playerId, s.position).then(function(cs){ if(cs) state.collectionCareerStatsCache[s.playerId]=cs; });
    }));
    const miniCards=ydCards.map(function(s){
      const key=s.playerId+'_'+s.eventType;
      const displayEvent=s.events&&s.events[0]||null;
      const careerStats=state.collectionCareerStatsCache[s.playerId]||null;
      const cardHtml=window.CollectionCard.renderMiniCard(s,displayEvent,careerStats,null);
      return cardHtml.replace('<article ','<article onclick="openCardFromKey(\''+key+'\')" style="cursor:pointer" ');
    }).join('');
    const cardsLabel='🎴 CARDS — '+getYesterdayDisplayStr().toUpperCase();
    cardsHtml='<div style="max-width:1100px;margin:0 auto;padding:16px 1.25rem;border-top:1px solid var(--border)">'
      +'<div style="font-size:.7rem;font-weight:700;color:var(--muted);letter-spacing:.1em;margin-bottom:12px">'+cardsLabel+'</div>'
      +'<div class="yd-clip-strip" style="display:flex;gap:0.75rem;overflow-x:auto;padding-bottom:8px">'+miniCards+'</div>'
      +'</div>';
  }

  const tilesHtml=activeCache.map(function(item){
    let awayId=null,homeId=null;
    const sched=(state.scheduleData||[]).find(function(s){return s.gamePk===item.gamePk||s.gamePk===+item.gamePk;});
    if(sched){awayId=sched.teams&&sched.teams.away&&sched.teams.away.team&&sched.teams.away.team.id;homeId=sched.teams&&sched.teams.home&&sched.teams.home.team&&sched.teams.home.team.id;}
    const awayTeam=awayId&&TEAMS.find(function(t){return t.id===awayId;});
    const homeTeam=homeId&&TEAMS.find(function(t){return t.id===homeId;});
    let capRow='';
    if(awayTeam&&homeTeam){
      capRow='<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">'
        +'<img src="https://www.mlbstatic.com/team-logos/'+awayId+'.svg" style="width:28px;height:28px;object-fit:contain" onerror="this.style.display=\'none\'">'
        +'<span style="font-size:.75rem;font-weight:700;color:var(--muted)">'+awayTeam.short+'</span>'
        +'<span style="font-size:.72rem;color:var(--muted)">@</span>'
        +'<img src="https://www.mlbstatic.com/team-logos/'+homeId+'.svg" style="width:28px;height:28px;object-fit:contain" onerror="this.style.display=\'none\'">'
        +'<span style="font-size:.75rem;font-weight:700;color:var(--muted)">'+homeTeam.short+'</span>'
        +'</div>';
    }
    const contentItems=(state.yesterdayContentCache[item.gamePk]&&state.yesterdayContentCache[item.gamePk].highlights&&state.yesterdayContentCache[item.gamePk].highlights.highlights&&state.yesterdayContentCache[item.gamePk].highlights.highlights.items)||[];
    const videoTitle=contentItems[0]&&(contentItems[0].headline||contentItems[0].blurb);
    const headlineText=videoTitle||(item.headline.replace(/^Yesterday:\s*/,''));
    const videoRegion='<div id="ydvideo_'+item.gamePk+'" style="margin-top:10px"></div>';
    return '<div id="ydtile_'+item.gamePk+'" class="card" style="padding:16px 18px">'
      +capRow
      +'<div class="yd-tile-headline" style="font-size:.88rem;color:var(--text);font-weight:600;line-height:1.45">'+headlineText+'</div>'
      +(item.sub?'<div style="font-size:.72rem;color:var(--muted);margin-top:4px">'+item.sub+'</div>':'')
      +videoRegion
      +'<div style="margin-top:12px"><button onclick="showLiveGame('+item.gamePk+')" style="background:none;border:1px solid var(--border);border-radius:16px;color:var(--accent);font-size:.72rem;font-weight:600;padding:5px 12px;cursor:pointer">Box Score →</button></div>'
      +'</div>';
  }).join('');
  const tilesGrid='<div class="yd-tiles-grid">'+tilesHtml+'</div>';

  card.innerHTML=''
    +'<div id="ydHeroRegion"></div>'
    +'<div id="ydVideoMeta" style="max-width:1100px;margin:0 auto;padding:8px 4px 0"></div>'
    +'<div id="ydHeroesStrip"></div>'
    +tilesGrid
    +cardsHtml;

  if('IntersectionObserver' in window) {
    const obs=new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(!entry.isIntersecting) return;
        const tile=entry.target;
        const pk=tile.dataset.gamepk;
        if(pk) { loadYesterdayVideoStrip(+pk); obs.unobserve(tile); }
      });
    },{root:null,rootMargin:'200px'});
    activeCache.forEach(function(item){
      const tile=document.getElementById('ydtile_'+item.gamePk);
      if(tile){ tile.dataset.gamepk=item.gamePk; obs.observe(tile); }
    });
  } else {
    activeCache.forEach(function(item){ loadYesterdayVideoStrip(item.gamePk); });
  }
  loadYesterdayHero();
  prefetchAllYesterdayContent();
}

function pickMarqueeGame() {
  const cache=getYdActiveCache();
  if(!cache||!cache.length) return null;
  const walkoff=cache.find(function(item){return item.headline&&(item.headline.indexOf('Walk-off')!==-1||item.headline.indexOf('walk-off')!==-1);});
  if(walkoff) return walkoff;
  const nohit=cache.find(function(item){return item.headline&&item.headline.indexOf('No-hitter')!==-1;});
  if(nohit) return nohit;
  return cache[0];
}

function mountSharedPlayer(heroRegion) {
  if(!heroRegion||heroRegion.dataset.mounted) return;
  heroRegion.dataset.mounted='1';
  heroRegion.className='yd-hero-grid';
  heroRegion.innerHTML=
    '<div class="yd-player-col">'
    +'<div class="yd-video-wrap"><video id="ydSharedVideo" controls playsinline></video></div>'
    +'</div>';
}

async function loadYesterdayHero() {
  const heroRegion=document.getElementById('ydHeroRegion');
  if(!heroRegion) return;
  const marquee=pickMarqueeGame();
  if(!marquee) return;
  const content=await fetchGameContent(marquee.gamePk);
  if(!content) return;
  const items=(content.highlights&&content.highlights.highlights&&content.highlights.highlights.items)||[];
  const playable=items.filter(function(item){return !!pickPlayback(item.playbacks);});
  if(!playable.length) return;
  const first=playable[2]||playable[0];
  mountSharedPlayer(heroRegion);
  loadClipIntoSharedPlayer(
    pickPlayback(first.playbacks),
    pickHeroImage(first)||'',
    first.headline||first.blurb||'Top Highlight',
    first.blurb||'',
    'TOP HIGHLIGHT'
  );
}

function buildTopHighlightsCarousel() {
  const heroRegion=document.getElementById('ydHeroRegion');
  const ydCache=getYdActiveCache();
  if(!heroRegion||!ydCache||!ydCache.length) return;
  const marquee=pickMarqueeGame();
  const ordered=ydCache.slice().sort(function(a,b){
    if(marquee){
      if(a.gamePk===marquee.gamePk) return -1;
      if(b.gamePk===marquee.gamePk) return 1;
    }
    return 0;
  });
  state.ydHighlightClips=[];
  ordered.forEach(function(game){
    const content=state.yesterdayContentCache[game.gamePk];
    if(!content) return;
    const items=(content.highlights&&content.highlights.highlights&&content.highlights.highlights.items)||[];
    const playable=items.filter(function(item){return !!pickPlayback(item.playbacks);});
    playable.slice(2,5).forEach(function(clip){ state.ydHighlightClips.push(clip); });
  });
  if(!state.ydHighlightClips.length) return;
  mountSharedPlayer(heroRegion);
  const existing=document.getElementById('ydClipCarousel');
  if(existing) existing.parentNode.removeChild(existing);
  const chips=state.ydHighlightClips.map(function(clip,i){
    const thumb=pickHeroImage(clip)||'';
    const title=(clip.headline||clip.blurb||'Highlight').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    return '<div class="yd-clip-chip'+(i===0?' active':'')+'" onclick="selectYdClip('+i+')">'
      +'<div class="yd-chip-thumb"><span style="font-size:1.1rem;color:var(--muted)">▶</span>'
      +(thumb?'<img src="'+thumb+'" onerror="this.style.display=\'none\'" alt="">':'')
      +'</div>'
      +'<div class="yd-chip-text">'+title+'</div>'
      +'</div>';
  }).join('');
  heroRegion.insertAdjacentHTML('beforeend',
    '<div id="ydClipCarousel" class="yd-playlist yd-clip-strip">'
    +'<div class="yd-playlist-kicker">TOP PLAYS</div>'
    +chips+'</div>'
  );
  loadClipIntoSharedPlayer(
    pickPlayback(state.ydHighlightClips[0].playbacks),
    pickHeroImage(state.ydHighlightClips[0])||'',
    state.ydHighlightClips[0].headline||state.ydHighlightClips[0].blurb||'Top Highlight',
    state.ydHighlightClips[0].blurb||'',
    'TOP HIGHLIGHT'
  );
}

export function selectYdClip(idx) {
  const carousel=document.getElementById('ydClipCarousel');
  if(carousel) carousel.querySelectorAll('.yd-clip-chip').forEach(function(c,i){ c.classList.toggle('active',i===idx); });
  const clip=state.ydHighlightClips[idx];
  if(!clip) return;
  loadClipIntoSharedPlayer(
    pickPlayback(clip.playbacks),
    pickHeroImage(clip)||'',
    clip.headline||clip.blurb||'Highlight',
    clip.blurb||'',
    'NOW PLAYING'
  );
}

function loadClipIntoSharedPlayer(url, poster, title, blurb, kicker) {
  const video=document.getElementById('ydSharedVideo');
  if(!video) return;
  stopAllMedia('highlight');
  video.pause();
  video.removeAttribute('src');
  video.load();
  if(poster) video.poster=poster; else video.removeAttribute('poster');
  video.src=url;
  const meta=document.getElementById('ydVideoMeta');
  if(meta){
    const k=kicker||'NOW PLAYING';
    const b=(blurb&&blurb!==title)?'<div style="font-size:.72rem;color:var(--muted);margin-top:2px">'+blurb+'</div>':'';
    meta.innerHTML='<div style="font-size:.62rem;font-weight:700;color:var(--muted);letter-spacing:.1em;margin-bottom:3px">'+k+'</div>'
      +'<div style="font-size:.92rem;font-weight:700;color:var(--text);line-height:1.35">'+(title||'')+'</div>'+b;
  }
  const heroRegion=document.getElementById('ydHeroRegion');
  if(heroRegion) heroRegion.scrollIntoView({behavior:'smooth',block:'start'});
}

async function prefetchAllYesterdayContent() {
  const cache=getYdActiveCache();
  if(!cache||!cache.length) return;
  await Promise.all(cache.map(function(item){return fetchGameContent(item.gamePk);}));
  buildAndRenderYesterdayHeroes();
  buildTopHighlightsCarousel();
}

function buildYesterdayHeroes() {
  const heroes=[];
  const seenPlayers={};
  const ydCache=getYdActiveCache();
  if(!ydCache.length) return heroes;
  ydCache.forEach(function(cacheItem){
    const content=state.yesterdayContentCache[cacheItem.gamePk];
    if(!content) return;
    const allItems=(content.highlights&&content.highlights.highlights&&content.highlights.highlights.items)||[];
    const items=allItems.filter(function(clip){
      return !(clip.keywordsAll||[]).some(function(kw){
        const v=(kw.value||kw.slug||'').toLowerCase();
        return v==='data-visualization'||v==='data_visualization';
      });
    });
    const playerClips={};
    items.forEach(function(clip){
      if(!clip.keywordsAll) return;
      const pidKw=clip.keywordsAll.find(function(kw){return kw.type==='player_id'||kw.slug&&kw.slug.startsWith('player_id-');});
      if(!pidKw) return;
      const pid=pidKw.value||pidKw.displayName||pidKw.slug;
      if(!pid) return;
      if(!playerClips[pid]) playerClips[pid]={clips:[],name:'',isHR:false,isWalkoff:false,teamAbbr:''};
      playerClips[pid].clips.push(clip);
      const isHRClip=clip.keywordsAll.some(function(kw){return (kw.type==='taxonomy'&&kw.value==='home-run')||kw.slug==='home-run';});
      if(isHRClip) playerClips[pid].isHR=true;
      const isWO=(clip.headline||'').toLowerCase().indexOf('walk-off')!==-1||
               (clip.blurb||'').toLowerCase().indexOf('walk-off')!==-1||
               clip.keywordsAll.some(function(kw){return kw.value==='walk-off'||kw.slug==='walk-off';});
      if(isWO) playerClips[pid].isWalkoff=true;
      if(!playerClips[pid].name&&clip.headline) playerClips[pid].name=clip.headline.split("'")[0].split(' ').slice(0,2).join(' ');
    });
    Object.keys(playerClips).forEach(function(pid){
      if(seenPlayers[pid]) return;
      seenPlayers[pid]=true;
      const pc=playerClips[pid];
      if(!pc.isHR&&!pc.isWalkoff) return;
      const hrCount=pc.clips.filter(function(c){return c.keywordsAll&&c.keywordsAll.some(function(kw){return kw.value==='home-run'||kw.slug==='home-run';});}).length;
      const role=pc.isWalkoff?'walkoff':hrCount>=2?'multi-HR':'HR';
      let clip=pc.clips.find(function(c){return pc.isWalkoff&&((c.headline||'').toLowerCase().indexOf('walk-off')!==-1);});
      if(!clip) clip=pc.clips.find(function(c){return c.keywordsAll&&c.keywordsAll.some(function(kw){return kw.value==='home-run'||kw.slug==='home-run';});});
      if(!clip) clip=pc.clips[0];
      const imgUrl=pickHeroImage(clip)||'';
      if(!imgUrl) return;
      heroes.push({pid:pid,playerName:pc.name,role:role,hrCount:hrCount,imageUrl:imgUrl,blurb:clip.headline||clip.blurb||'',gamePk:cacheItem.gamePk,isWalkoff:pc.isWalkoff});
    });
  });
  const roleOrder={walkoff:0,'multi-HR':1,HR:2};
  heroes.sort(function(a,b){return (roleOrder[a.role]||9)-(roleOrder[b.role]||9);});
  return heroes;
}

function buildAndRenderYesterdayHeroes() {
  const stripEl=document.getElementById('ydHeroesStrip');
  if(!stripEl) return;
  const heroes=buildYesterdayHeroes();
  if(!heroes.length) return;
  const roleLabel={walkoff:'WALK-OFF','multi-HR':function(h){return h.hrCount+' HR';},'HR':'HR'};
  const tiles=heroes.map(function(h){
    const lbl=typeof roleLabel[h.role]==='function'?roleLabel[h.role](h):roleLabel[h.role];
    const lastName=h.playerName?h.playerName.split(' ').pop():h.playerName;
    const heroUrl=h.imageUrl?forceHttps(h.imageUrl):'';
    return '<div onclick="scrollToYdTile('+h.gamePk+')" style="cursor:pointer;flex-shrink:0;width:110px;position:relative;border-radius:8px;overflow:hidden;border:1px solid var(--border)">'
      +'<img src="'+heroUrl+'" style="width:110px;height:74px;object-fit:cover;display:block" loading="lazy" onerror="this.style.display=\'none\'">'
      +'<div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,.82));padding:4px 6px">'
      +'<div style="font-size:.58rem;font-weight:700;color:#f59e0b;letter-spacing:.06em">'+lbl+'</div>'
      +'<div style="font-size:.68rem;font-weight:700;color:#fff">'+lastName+'</div>'
      +'</div>'
      +'</div>';
  }).join('');
  const heroesLabel=state.ydDateOffset===-1?'YESTERDAY\'S HEROES':'HEROES · '+getYesterdayDisplayStr().toUpperCase();
  stripEl.innerHTML='<div style="max-width:1100px;margin:0 auto;padding:10px 1.25rem 0;border-top:1px solid var(--border)">'
    +'<div style="font-size:.65rem;font-weight:700;color:var(--muted);letter-spacing:.1em;margin-bottom:8px">'+heroesLabel+'</div>'
    +'<div class="yd-clip-strip" style="display:flex;gap:8px;overflow-x:auto;padding-bottom:8px">'+tiles+'</div>'
    +'</div>';
}

export function scrollToYdTile(gamePk) {
  const tile=document.getElementById('ydtile_'+gamePk);
  if(tile) tile.scrollIntoView({behavior:'smooth',block:'start'});
}

async function loadYesterdayVideoStrip(gamePk) {
  const region=document.getElementById('ydvideo_'+gamePk);
  if(!region||region.dataset.loaded) return;
  region.dataset.loaded='1';
  const content=await fetchGameContent(gamePk);
  if(!content) return;
  const items=(content.highlights&&content.highlights.highlights&&content.highlights.highlights.items)||[];
  if(!items.length) return;
  const playable=items.filter(function(item){return !!pickPlayback(item.playbacks);});
  if(!playable.length) return;
  region.innerHTML=renderHighlightStrip(playable, gamePk);
  const tile=document.getElementById('ydtile_'+gamePk);
  if(tile&&playable[0]){
    const vTitle=playable[0].headline||playable[0].blurb;
    if(vTitle){
      const headlineEl=tile.querySelector('.yd-tile-headline');
      if(headlineEl) headlineEl.textContent=vTitle;
    }
  }
}

function renderHighlightStrip(items, gamePk) {
  const item=items[0];
  if(!item) return '';
  const imgUrl=pickHeroImage(item)||'';
  const safeUrl=imgUrl?forceHttps(imgUrl):'';
  const title=(item.headline||item.blurb||'Game Highlight').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  return '<div class="yd-game-thumb" onclick="playYesterdayClip('+JSON.stringify(gamePk)+',0)">'
    +(safeUrl
      ?'<img src="'+safeUrl+'" loading="lazy" alt="" onerror="this.style.display=\'none\'">'
      :'<div style="width:100%;height:140px;background:var(--card);display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:2rem">▶</div>')
    +'<div class="yd-game-thumb-play"><span>▶</span></div>'
    +'<div class="yd-game-thumb-label">'+title+'</div>'
    +'</div>';
}

export function playYesterdayClip(gamePk, itemIndex) {
  const content=state.yesterdayContentCache[gamePk];
  if(!content) return;
  const items=(content.highlights&&content.highlights.highlights&&content.highlights.highlights.items)||[];
  const playable=items.filter(function(item){return !!pickPlayback(item.playbacks);});
  const item=playable[itemIndex];
  if(!item) return;
  const carousel=document.getElementById('ydClipCarousel');
  if(carousel) carousel.querySelectorAll('.yd-clip-chip').forEach(function(c){c.classList.remove('active');});
  loadClipIntoSharedPlayer(
    pickPlayback(item.playbacks),
    pickHeroImage(item)||'',
    item.headline||item.blurb||'Game Highlight',
    item.blurb||'',
    'GAME HIGHLIGHT'
  );
}
