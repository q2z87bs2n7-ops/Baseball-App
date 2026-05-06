// ── Yesterday Recap Overlay ─────────────────────────────────────────────────
// Full-screen recap for yesterday's games (or any past date via ←/→ date picker):
//  - shared video player at top (loadYesterdayHero → buildTopHighlightsCarousel)
//  - "yesterday's heroes" strip (HR hitters + walk-off heroes)
//  - per-game tile grid with single recap thumbnail (lazy-loaded via IntersectionObserver)
//  - collected cards earned that day strip (uses window.CollectionCard.renderMiniCard)

import { state } from '../state.js';
import { TEAMS, MLB_BASE } from '../config/constants.js';
import { stopAllMedia } from '../radio/engine.js';
import { showLiveGame } from '../sections/loaders.js';
import { pickPlayback, pickHeroImage, fetchGameContent } from '../data/clips.js';
import { loadYdForDate } from '../carousel/generators.js';
import { loadCollection, tierRank, fetchCareerStats } from '../collection/book.js';

let ydPrevSection = null;

// Kept for backward compat; collection helpers now imported directly.
export function setYesterdayCallbacks(cbs) {}

function getYdActiveCache(){return state.ydDisplayCache!==null?state.ydDisplayCache:(state.yesterdayCache||[]);}

export function openYesterdayRecap() {
  state.yesterdayOverlayOpen=true;
  state.ydDateOffset=-1;
  state.ydDisplayCache=null;
  var active=document.querySelector('.section.active');
  ydPrevSection=active?active.id:null;
  document.querySelectorAll('.section').forEach(function(s){s.classList.remove('active');});
  document.querySelectorAll('nav button').forEach(function(b){b.classList.remove('active');});
  document.getElementById('yesterday').classList.add('active');
  window.scrollTo(0,0);
  var lbl=document.getElementById('ydDateLabel');
  if(lbl) lbl.textContent=getYesterdayDisplayStr();
  var nextBtn=document.getElementById('ydNextDateBtn');
  if(nextBtn) nextBtn.disabled=true;
  renderYesterdayRecap();
  requestAnimationFrame(function(){ window.scrollTo(0,0); });
}

export async function ydChangeDate(dir){
  var newOffset=state.ydDateOffset+dir;
  if(newOffset>=0) return;
  if(newOffset<-365) return;
  state.ydDateOffset=newOffset;
  var lbl=document.getElementById('ydDateLabel');
  if(lbl) lbl.textContent=getYesterdayDisplayStr();
  var nextBtn=document.getElementById('ydNextDateBtn');
  if(nextBtn) nextBtn.disabled=(state.ydDateOffset>=-1);
  var card=document.getElementById('yesterdayCard');
  if(card) card.innerHTML='<div style="padding:48px;text-align:center;color:var(--muted);font-size:.88rem">Loading…</div>';
  var heroRegion=document.getElementById('ydHeroRegion');
  if(heroRegion){heroRegion.dataset.mounted='';heroRegion.innerHTML='';}
  if(state.ydDateOffset===-1){
    state.ydDisplayCache=null;
  }else if(loadYdForDate){
    state.ydDisplayCache=await loadYdForDate(getYesterdayDateStr());
  }
  renderYesterdayRecap();
  window.scrollTo(0,0);
}

export function closeYesterdayRecap() {
  state.yesterdayOverlayOpen=false;
  document.querySelectorAll('.section').forEach(function(s){s.classList.remove('active');});
  var returnId=ydPrevSection||'pulse';
  var returnEl=document.getElementById(returnId);
  if(returnEl) returnEl.classList.add('active');
  document.querySelectorAll('nav button').forEach(function(b){
    var onclick=b.getAttribute('onclick')||'';
    if(onclick.indexOf("'"+returnId+"'")!==-1) b.classList.add('active');
  });
}

function getYesterdayDateStr() {
  var d=new Date(); d.setDate(d.getDate()+state.ydDateOffset);
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}

function getYesterdayDisplayStr() {
  var d=new Date(); d.setDate(d.getDate()+state.ydDateOffset);
  var months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return months[d.getMonth()]+' '+d.getDate()+', '+d.getFullYear();
}

function getYesterdayCollectedCards() {
  var ydStr=getYesterdayDateStr();
  try {
    var col=loadCollection();
    var slots=Object.values(col).filter(function(s){
      return s.events&&s.events.some(function(ev){return ev.date===ydStr;});
    });
    slots.sort(function(a,b){return tierRank(b.tier)-tierRank(a.tier);});
    return slots.slice(0,5);
  } catch(e){ return []; }
}

async function renderYesterdayRecap() {
  var card=document.getElementById('yesterdayCard');
  if(!card) return;
  var activeCache=getYdActiveCache();
  if(!activeCache||!activeCache.length){
    var noGamesMsg=state.ydDateOffset===-1?'No games yesterday.':'No games played on '+getYesterdayDisplayStr()+'.';
    card.innerHTML='<div class="empty-state" style="padding:48px 24px">'+noGamesMsg+'</div>';
    return;
  }

  var ydCards=getYesterdayCollectedCards();
  var cardsHtml='';
  if(ydCards.length&&window.CollectionCard){
    await Promise.all(ydCards.map(function(s){
      return state.collectionCareerStatsCache[s.playerId]
        ? Promise.resolve()
        : fetchCareerStats(s.playerId, s.position).then(function(cs){ if(cs) state.collectionCareerStatsCache[s.playerId]=cs; });
    }));
    var miniCards=ydCards.map(function(s){
      var key=s.playerId+'_'+s.eventType;
      var displayEvent=s.events&&s.events[0]||null;
      var careerStats=state.collectionCareerStatsCache[s.playerId]||null;
      var cardHtml=window.CollectionCard.renderMiniCard(s,displayEvent,careerStats,null);
      return cardHtml.replace('<article ','<article onclick="openCardFromKey(\''+key+'\')" style="cursor:pointer" ');
    }).join('');
    var cardsLabel='🎴 CARDS — '+getYesterdayDisplayStr().toUpperCase();
    cardsHtml='<div style="padding:16px 20px;border-top:1px solid var(--border)">'
      +'<div style="font-size:.7rem;font-weight:700;color:var(--muted);letter-spacing:.1em;margin-bottom:12px">'+cardsLabel+'</div>'
      +'<div class="yd-clip-strip" style="display:flex;gap:0.75rem;overflow-x:auto;padding-bottom:8px">'+miniCards+'</div>'
      +'</div>';
  }

  var tilesHtml=activeCache.map(function(item){
    var awayId=null,homeId=null;
    var sched=(state.scheduleData||[]).find(function(s){return s.gamePk===item.gamePk||s.gamePk===+item.gamePk;});
    if(sched){awayId=sched.teams&&sched.teams.away&&sched.teams.away.team&&sched.teams.away.team.id;homeId=sched.teams&&sched.teams.home&&sched.teams.home.team&&sched.teams.home.team.id;}
    var awayTeam=awayId&&TEAMS.find(function(t){return t.id===awayId;});
    var homeTeam=homeId&&TEAMS.find(function(t){return t.id===homeId;});
    var capRow='';
    if(awayTeam&&homeTeam){
      capRow='<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">'
        +'<img src="https://www.mlbstatic.com/team-logos/'+awayId+'.svg" style="width:28px;height:28px;object-fit:contain" onerror="this.style.display=\'none\'">'
        +'<span style="font-size:.75rem;font-weight:700;color:var(--muted)">'+awayTeam.short+'</span>'
        +'<span style="font-size:.72rem;color:var(--muted)">@</span>'
        +'<img src="https://www.mlbstatic.com/team-logos/'+homeId+'.svg" style="width:28px;height:28px;object-fit:contain" onerror="this.style.display=\'none\'">'
        +'<span style="font-size:.75rem;font-weight:700;color:var(--muted)">'+homeTeam.short+'</span>'
        +'</div>';
    }
    var contentItems=(state.yesterdayContentCache[item.gamePk]&&state.yesterdayContentCache[item.gamePk].highlights&&state.yesterdayContentCache[item.gamePk].highlights.highlights&&state.yesterdayContentCache[item.gamePk].highlights.highlights.items)||[];
    var videoTitle=contentItems[0]&&(contentItems[0].headline||contentItems[0].blurb);
    var headlineText=videoTitle||(item.headline.replace(/^Yesterday:\s*/,''));
    var videoRegion='<div id="ydvideo_'+item.gamePk+'" style="margin-top:10px"></div>';
    return '<div id="ydtile_'+item.gamePk+'" class="card" style="padding:16px 18px">'
      +capRow
      +'<div class="yd-tile-headline" style="font-size:.88rem;color:var(--text);font-weight:600;line-height:1.45">'+headlineText+'</div>'
      +(item.sub?'<div style="font-size:.72rem;color:var(--muted);margin-top:4px">'+item.sub+'</div>':'')
      +videoRegion
      +'<div style="margin-top:12px"><button onclick="showLiveGame('+item.gamePk+')" style="background:none;border:1px solid var(--border);border-radius:16px;color:var(--accent);font-size:.72rem;font-weight:600;padding:5px 12px;cursor:pointer">Box Score →</button></div>'
      +'</div>';
  }).join('');
  var tilesGrid='<div class="yd-tiles-grid">'+tilesHtml+'</div>';

  card.innerHTML=''
    +'<div id="ydHeroRegion"></div>'
    +'<div id="ydVideoMeta" style="max-width:1100px;margin:0 auto;padding:8px 4px 0"></div>'
    +'<div id="ydHeroesStrip"></div>'
    +tilesGrid
    +cardsHtml;

  if('IntersectionObserver' in window) {
    var obs=new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(!entry.isIntersecting) return;
        var tile=entry.target;
        var pk=tile.dataset.gamepk;
        if(pk) { loadYesterdayVideoStrip(+pk); obs.unobserve(tile); }
      });
    },{root:null,rootMargin:'200px'});
    activeCache.forEach(function(item){
      var tile=document.getElementById('ydtile_'+item.gamePk);
      if(tile){ tile.dataset.gamepk=item.gamePk; obs.observe(tile); }
    });
  } else {
    activeCache.forEach(function(item){ loadYesterdayVideoStrip(item.gamePk); });
  }
  loadYesterdayHero();
  prefetchAllYesterdayContent();
}

function pickMarqueeGame() {
  var cache=getYdActiveCache();
  if(!cache||!cache.length) return null;
  var walkoff=cache.find(function(item){return item.headline&&(item.headline.indexOf('Walk-off')!==-1||item.headline.indexOf('walk-off')!==-1);});
  if(walkoff) return walkoff;
  var nohit=cache.find(function(item){return item.headline&&item.headline.indexOf('No-hitter')!==-1;});
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
  var heroRegion=document.getElementById('ydHeroRegion');
  if(!heroRegion) return;
  var marquee=pickMarqueeGame();
  if(!marquee) return;
  var content=await fetchGameContent(marquee.gamePk);
  if(!content) return;
  var items=(content.highlights&&content.highlights.highlights&&content.highlights.highlights.items)||[];
  var playable=items.filter(function(item){return !!pickPlayback(item.playbacks);});
  if(!playable.length) return;
  var first=playable[2]||playable[0];
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
  var heroRegion=document.getElementById('ydHeroRegion');
  var ydCache=getYdActiveCache();
  if(!heroRegion||!ydCache||!ydCache.length) return;
  var marquee=pickMarqueeGame();
  var ordered=ydCache.slice().sort(function(a,b){
    if(marquee){
      if(a.gamePk===marquee.gamePk) return -1;
      if(b.gamePk===marquee.gamePk) return 1;
    }
    return 0;
  });
  state.ydHighlightClips=[];
  ordered.forEach(function(game){
    var content=state.yesterdayContentCache[game.gamePk];
    if(!content) return;
    var items=(content.highlights&&content.highlights.highlights&&content.highlights.highlights.items)||[];
    var playable=items.filter(function(item){return !!pickPlayback(item.playbacks);});
    playable.slice(2,5).forEach(function(clip){ state.ydHighlightClips.push(clip); });
  });
  if(!state.ydHighlightClips.length) return;
  mountSharedPlayer(heroRegion);
  var existing=document.getElementById('ydClipCarousel');
  if(existing) existing.parentNode.removeChild(existing);
  var chips=state.ydHighlightClips.map(function(clip,i){
    var thumb=pickHeroImage(clip)||'';
    var title=(clip.headline||clip.blurb||'Highlight').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
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
  var carousel=document.getElementById('ydClipCarousel');
  if(carousel) carousel.querySelectorAll('.yd-clip-chip').forEach(function(c,i){ c.classList.toggle('active',i===idx); });
  var clip=state.ydHighlightClips[idx];
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
  var video=document.getElementById('ydSharedVideo');
  if(!video) return;
  stopAllMedia('highlight');
  video.pause();
  video.removeAttribute('src');
  video.load();
  if(poster) video.poster=poster; else video.removeAttribute('poster');
  video.src=url;
  var meta=document.getElementById('ydVideoMeta');
  if(meta){
    var k=kicker||'NOW PLAYING';
    var b=(blurb&&blurb!==title)?'<div style="font-size:.72rem;color:var(--muted);margin-top:2px">'+blurb+'</div>':'';
    meta.innerHTML='<div style="font-size:.62rem;font-weight:700;color:var(--muted);letter-spacing:.1em;margin-bottom:3px">'+k+'</div>'
      +'<div style="font-size:.92rem;font-weight:700;color:var(--text);line-height:1.35">'+(title||'')+'</div>'+b;
  }
  var heroRegion=document.getElementById('ydHeroRegion');
  if(heroRegion) heroRegion.scrollIntoView({behavior:'smooth',block:'start'});
}

async function prefetchAllYesterdayContent() {
  var cache=getYdActiveCache();
  if(!cache||!cache.length) return;
  await Promise.all(cache.map(function(item){return fetchGameContent(item.gamePk);}));
  buildAndRenderYesterdayHeroes();
  buildTopHighlightsCarousel();
}

function buildYesterdayHeroes() {
  var heroes=[];
  var seenPlayers={};
  var ydCache=getYdActiveCache();
  if(!ydCache.length) return heroes;
  ydCache.forEach(function(cacheItem){
    var content=state.yesterdayContentCache[cacheItem.gamePk];
    if(!content) return;
    var allItems=(content.highlights&&content.highlights.highlights&&content.highlights.highlights.items)||[];
    var items=allItems.filter(function(clip){
      return !(clip.keywordsAll||[]).some(function(kw){
        var v=(kw.value||kw.slug||'').toLowerCase();
        return v==='data-visualization'||v==='data_visualization';
      });
    });
    var playerClips={};
    items.forEach(function(clip){
      if(!clip.keywordsAll) return;
      var pidKw=clip.keywordsAll.find(function(kw){return kw.type==='player_id'||kw.slug&&kw.slug.startsWith('player_id-');});
      if(!pidKw) return;
      var pid=pidKw.value||pidKw.displayName||pidKw.slug;
      if(!pid) return;
      if(!playerClips[pid]) playerClips[pid]={clips:[],name:'',isHR:false,isWalkoff:false,teamAbbr:''};
      playerClips[pid].clips.push(clip);
      var isHRClip=clip.keywordsAll.some(function(kw){return (kw.type==='taxonomy'&&kw.value==='home-run')||kw.slug==='home-run';});
      if(isHRClip) playerClips[pid].isHR=true;
      var isWO=(clip.headline||'').toLowerCase().indexOf('walk-off')!==-1||
               (clip.blurb||'').toLowerCase().indexOf('walk-off')!==-1||
               clip.keywordsAll.some(function(kw){return kw.value==='walk-off'||kw.slug==='walk-off';});
      if(isWO) playerClips[pid].isWalkoff=true;
      if(!playerClips[pid].name&&clip.headline) playerClips[pid].name=clip.headline.split("'")[0].split(' ').slice(0,2).join(' ');
    });
    Object.keys(playerClips).forEach(function(pid){
      if(seenPlayers[pid]) return;
      seenPlayers[pid]=true;
      var pc=playerClips[pid];
      if(!pc.isHR&&!pc.isWalkoff) return;
      var hrCount=pc.clips.filter(function(c){return c.keywordsAll&&c.keywordsAll.some(function(kw){return kw.value==='home-run'||kw.slug==='home-run';});}).length;
      var role=pc.isWalkoff?'walkoff':hrCount>=2?'multi-HR':'HR';
      var clip=pc.clips.find(function(c){return pc.isWalkoff&&((c.headline||'').toLowerCase().indexOf('walk-off')!==-1);});
      if(!clip) clip=pc.clips.find(function(c){return c.keywordsAll&&c.keywordsAll.some(function(kw){return kw.value==='home-run'||kw.slug==='home-run';});});
      if(!clip) clip=pc.clips[0];
      var imgUrl=pickHeroImage(clip)||'';
      if(!imgUrl) return;
      heroes.push({pid:pid,playerName:pc.name,role:role,hrCount:hrCount,imageUrl:imgUrl,blurb:clip.headline||clip.blurb||'',gamePk:cacheItem.gamePk,isWalkoff:pc.isWalkoff});
    });
  });
  var roleOrder={walkoff:0,'multi-HR':1,HR:2};
  heroes.sort(function(a,b){return (roleOrder[a.role]||9)-(roleOrder[b.role]||9);});
  return heroes;
}

function buildAndRenderYesterdayHeroes() {
  var stripEl=document.getElementById('ydHeroesStrip');
  if(!stripEl) return;
  var heroes=buildYesterdayHeroes();
  if(!heroes.length) return;
  var roleLabel={walkoff:'WALK-OFF','multi-HR':function(h){return h.hrCount+' HR';},'HR':'HR'};
  var tiles=heroes.map(function(h){
    var lbl=typeof roleLabel[h.role]==='function'?roleLabel[h.role](h):roleLabel[h.role];
    var lastName=h.playerName?h.playerName.split(' ').pop():h.playerName;
    return '<div onclick="scrollToYdTile('+h.gamePk+')" style="cursor:pointer;flex-shrink:0;width:110px;position:relative;border-radius:8px;overflow:hidden;border:1px solid var(--border)">'
      +'<img src="'+h.imageUrl+'" style="width:110px;height:74px;object-fit:cover;display:block" loading="lazy">'
      +'<div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,.82));padding:4px 6px">'
      +'<div style="font-size:.58rem;font-weight:700;color:#f59e0b;letter-spacing:.06em">'+lbl+'</div>'
      +'<div style="font-size:.68rem;font-weight:700;color:#fff">'+lastName+'</div>'
      +'</div>'
      +'</div>';
  }).join('');
  var heroesLabel=state.ydDateOffset===-1?'YESTERDAY\'S HEROES':'HEROES · '+getYesterdayDisplayStr().toUpperCase();
  stripEl.innerHTML='<div style="padding:10px 16px 0;border-top:1px solid var(--border)">'
    +'<div style="font-size:.65rem;font-weight:700;color:var(--muted);letter-spacing:.1em;margin-bottom:8px">'+heroesLabel+'</div>'
    +'<div class="yd-clip-strip" style="display:flex;gap:8px;overflow-x:auto;padding-bottom:8px">'+tiles+'</div>'
    +'</div>';
}

export function scrollToYdTile(gamePk) {
  var tile=document.getElementById('ydtile_'+gamePk);
  if(tile) tile.scrollIntoView({behavior:'smooth',block:'start'});
}

async function loadYesterdayVideoStrip(gamePk) {
  var region=document.getElementById('ydvideo_'+gamePk);
  if(!region||region.dataset.loaded) return;
  region.dataset.loaded='1';
  var content=await fetchGameContent(gamePk);
  if(!content) return;
  var items=(content.highlights&&content.highlights.highlights&&content.highlights.highlights.items)||[];
  if(!items.length) return;
  var playable=items.filter(function(item){return !!pickPlayback(item.playbacks);});
  if(!playable.length) return;
  region.innerHTML=renderHighlightStrip(playable, gamePk);
  var tile=document.getElementById('ydtile_'+gamePk);
  if(tile&&playable[0]){
    var vTitle=playable[0].headline||playable[0].blurb;
    if(vTitle){
      var headlineEl=tile.querySelector('.yd-tile-headline');
      if(headlineEl) headlineEl.textContent=vTitle;
    }
  }
}

function renderHighlightStrip(items, gamePk) {
  var item=items[0];
  if(!item) return '';
  var imgUrl=pickHeroImage(item)||'';
  var title=(item.headline||item.blurb||'Game Highlight').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  return '<div class="yd-game-thumb" onclick="playYesterdayClip('+JSON.stringify(gamePk)+',0)">'
    +(imgUrl
      ?'<img src="'+imgUrl+'" loading="lazy" alt="">'
      :'<div style="width:100%;height:140px;background:var(--card);display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:2rem">▶</div>')
    +'<div class="yd-game-thumb-play"><span>▶</span></div>'
    +'<div class="yd-game-thumb-label">'+title+'</div>'
    +'</div>';
}

export function playYesterdayClip(gamePk, itemIndex) {
  var content=state.yesterdayContentCache[gamePk];
  if(!content) return;
  var items=(content.highlights&&content.highlights.highlights&&content.highlights.highlights.items)||[];
  var playable=items.filter(function(item){return !!pickPlayback(item.playbacks);});
  var item=playable[itemIndex];
  if(!item) return;
  var carousel=document.getElementById('ydClipCarousel');
  if(carousel) carousel.querySelectorAll('.yd-clip-chip').forEach(function(c){c.classList.remove('active');});
  loadClipIntoSharedPlayer(
    pickPlayback(item.playbacks),
    pickHeroImage(item)||'',
    item.headline||item.blurb||'Game Highlight',
    item.blurb||'',
    'GAME HIGHLIGHT'
  );
}
