// Home (My Team) section — today/next-game hero card, next-series card,
// Division Snapshot, Latest News widget, and the team's official YouTube
// channel embed.
//
// renderNextGame and teamCapImg are injected from main.js via
// setHomeCallbacks. The home-live polling timer (homeLiveTimer) is exported
// so theme-switch / team-switch flows in main.js can clear it on team change.

import { state } from '../state.js';
import { MLB_BASE, API_BASE, TEAMS, TIMING } from '../config/constants.js';
import { TEAM_PODCASTS, fallbackPodcastTerm } from '../config/podcasts.js';
import { etDateStr, etDatePlus } from '../utils/format.js';
import { forceHttps, escapeNewsHtml } from '../utils/news.js';

let homeCallbacks = { renderNextGame: null, teamCapImg: null };
export function setHomeCallbacks(cb) { Object.assign(homeCallbacks, cb); }

export let homeLiveTimer = null;
export function clearHomeTimer(){ if(homeLiveTimer){clearInterval(homeLiveTimer);homeLiveTimer=null;} }

let selectedVideoId=null,mediaVideos=[];
const MLB_FALLBACK_UC='UCoLrcjPV5PbUrUyXq5mjc_A';
let podcastShows=[],playingPodcastId=null;

export async function loadTodayGame(){
  if(homeLiveTimer){clearInterval(homeLiveTimer);homeLiveTimer=null;}
  const today=etDateStr();
  document.getElementById('todayGame').innerHTML='<div class="loading">Loading next game...</div>';
  try{
    const r=await fetch(MLB_BASE+'/schedule?sportId=1&date='+today+'&teamId='+state.activeTeam.id+'&hydrate=linescore,team,seriesStatus,gameInfo');
    const d=await r.json(),todayGames=(d.dates&&d.dates[0]&&d.dates[0].games)?d.dates[0].games:[];
    const liveGame=todayGames.find(function(g){return g.status.abstractGameState==='Live'&&g.status.detailedState!=='Warmup'&&g.status.detailedState!=='Pre-Game';});
    const upcomingToday=todayGames.find(function(g){return g.status.abstractGameState==='Preview'||g.status.abstractGameState==='Scheduled'||(g.status.abstractGameState==='Live'&&(g.status.detailedState==='Warmup'||g.status.detailedState==='Pre-Game'));});
    const gameToRender=liveGame||upcomingToday;
    if(gameToRender&&!state.scheduleData.length){try{const gdEt=etDateStr(new Date(gameToRender.gameDate));const sr=await fetch(MLB_BASE+'/schedule?sportId=1&startDate='+etDatePlus(gdEt,-7)+'&endDate='+etDatePlus(gdEt,7)+'&teamId='+state.activeTeam.id+'&hydrate=team,linescore');const srd=await sr.json();(srd.dates||[]).forEach(function(dt){dt.games.forEach(function(g){state.scheduleData.push(g);});});}catch(e){}}
    if(liveGame){document.getElementById('todayGame').innerHTML=homeCallbacks.renderNextGame(liveGame,'TODAY');homeLiveTimer=setInterval(loadTodayGame,TIMING.HOME_LIVE_MS);return;}
    if(upcomingToday){document.getElementById('todayGame').innerHTML=homeCallbacks.renderNextGame(upcomingToday,'TODAY');return;}
    const endStr=etDatePlus(today,14);
    const r2=await fetch(MLB_BASE+'/schedule?sportId=1&startDate='+today+'&endDate='+endStr+'&teamId='+state.activeTeam.id+'&hydrate=linescore,team,seriesStatus,gameInfo');
    let d2=await r2.json(),nextGame=null;
    for(let i=0;i<(d2.dates||[]).length;i++){const u=(d2.dates[i].games||[]).find(function(g){return g.status.abstractGameState==='Preview'||g.status.abstractGameState==='Scheduled';});if(u){nextGame=u;break;}}
    if(!nextGame){document.getElementById('todayGame').innerHTML='<div class="game-big surface-hero"><div class="card-title">NEXT GAME</div><div class="empty-state">No upcoming games found</div></div>';return;}
    const gd=new Date(nextGame.gameDate),label=gd.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}).toUpperCase();
    document.getElementById('todayGame').innerHTML=homeCallbacks.renderNextGame(nextGame,label);
  }catch(e){document.getElementById('todayGame').innerHTML='<div class="error">Could not load next game</div>';}
}

export async function loadNextGame(){
  document.getElementById('nextGame').innerHTML='<div class="loading">Loading next series...</div>';
  try{
    const today=etDateStr();
    const endStr=etDatePlus(today,28);
    const r=await fetch(MLB_BASE+'/schedule?sportId=1&startDate='+today+'&endDate='+endStr+'&teamId='+state.activeTeam.id+'&hydrate=team,linescore,venue,probablePitcher');
    const d=await r.json(),allGames=[];
    (d.dates||[]).forEach(function(dt){dt.games.forEach(function(g){allGames.push(g);});});
    const seriesList=[],used=new Set();
    allGames.forEach(function(g){
      if(used.has(g.gamePk))return;
      const oppId=g.teams.home.team.id===state.activeTeam.id?g.teams.away.team.id:g.teams.home.team.id;
      const venueId=g.venue&&g.venue.id,gDate=new Date(g.gameDate);
      const group=allGames.filter(function(s){
        if(used.has(s.gamePk))return false;
        const sOpp=s.teams.home.team.id===state.activeTeam.id?s.teams.away.team.id:s.teams.home.team.id;
        const sVenue=s.venue&&s.venue.id,daysDiff=Math.abs((new Date(s.gameDate)-gDate)/86400000);
        return sOpp===oppId&&sVenue===venueId&&daysDiff<=4;
      }).sort(function(a,b){return new Date(a.gameDate)-new Date(b.gameDate);});
      group.forEach(function(s){used.add(s.gamePk);});seriesList.push(group);
    });
    let currentIdx=-1;
    for(let i=0;i<seriesList.length;i++){if(seriesList[i].some(function(g){return g.status.abstractGameState!=='Final';})){currentIdx=i;break;}}
    const nextSeries=currentIdx>=0&&currentIdx+1<seriesList.length?seriesList[currentIdx+1]:null;
    if(!nextSeries||!nextSeries.length){document.getElementById('nextGame').innerHTML='<div class="game-big surface-hero"><div class="card-title">NEXT SERIES</div><div class="empty-state">No upcoming series found</div></div>';return;}
    const first=nextSeries[0],teamHome=first.teams.home.team.id===state.activeTeam.id,oppTeam=teamHome?first.teams.away.team:first.teams.home.team;
    const oppD=TEAMS.find(function(t){return t.id===oppTeam.id;})||{};
    const oppPrimary=oppD.primary||'#333',oppSecondary=oppD.secondary||'#fff';
    const d1=new Date(nextSeries[0].gameDate),d2=new Date(nextSeries[nextSeries.length-1].gameDate);
    let dateRange=d1.toLocaleDateString('en-US',{month:'short',day:'numeric'}).toUpperCase();
    if(nextSeries.length>1)dateRange+=' — '+d2.toLocaleDateString('en-US',{month:'short',day:'numeric'}).toUpperCase();
    const venue=first.venue&&first.venue.name?first.venue.name:'';
    const numGames=nextSeries.length;
    let html='<div class="game-big surface-hero has-ghost">';
    html+=homeCallbacks.teamCapImg(oppTeam.id,oppTeam.teamName,oppSecondary,oppPrimary,'series-ghost');
    html+='<div class="hero-content">';
    html+='<div class="hero-top-row">';
    html+='<div class="eyebrow eyebrow--accent">NEXT SERIES</div>';
    html+='<div class="hero-meta-right">'+dateRange+'</div></div>';
    html+='<div class="hero-opp-row">';
    html+=homeCallbacks.teamCapImg(oppTeam.id,oppTeam.teamName,oppPrimary,oppSecondary);
    html+='<div><div class="eyebrow">'+(teamHome?'VS':'AT')+'</div>';
    html+='<div class="hero-opp-name">'+oppTeam.teamName.toUpperCase()+'</div>';
    html+='<div class="hero-opp-meta">'+(venue?venue+' · ':'')+numGames+' game'+(teamHome?' home series':' road series')+'</div>';
    html+='</div></div>';
    html+='<div class="hero-day-strip">';
    nextSeries.forEach(function(g){
      const status=g.status.abstractGameState,gDate=new Date(g.gameDate);
      const dayLabel=gDate.toLocaleDateString('en-US',{weekday:'short'}).toUpperCase();
      const myT=g.teams.home.team.id===state.activeTeam.id?g.teams.home:g.teams.away,oppT=g.teams.home.team.id===state.activeTeam.id?g.teams.away:g.teams.home;
      html+='<div class="hero-day-cell">';
      html+='<div class="hero-day-label">'+dayLabel+'</div>';
      if(status==='Final'){const w=myT.isWinner;html+='<span class="badge '+(w?'badge-w':'badge-l')+'" style="font-size:.62rem">'+(w?'W':'L')+' '+myT.score+'-'+oppT.score+'</span>';}
      else if(status==='Live'){html+='<div class="hero-day-live"><span class="matchup-live-dot"></span>LIVE</div><div class="hero-day-score">'+myT.score+'-'+oppT.score+'</div>';}
      else{html+='<div class="hero-day-time">'+gDate.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})+'</div>';}
      html+='</div>';
    });
    html+='</div></div></div>';
    document.getElementById('nextGame').innerHTML=html;
  }catch(e){document.getElementById('nextGame').innerHTML='<div class="error">Could not load next series</div>';}
}

export async function loadHomeInjuries(){
  const el=document.getElementById('homeInjuries');if(!el)return;
  el.innerHTML='<div class="loading">Loading injuries...</div>';
  try{
    const r=await fetch(MLB_BASE+'/teams/'+state.activeTeam.id+'/roster?rosterType=40Man&date='+etDateStr());
    const d=await r.json(),roster=d.roster||[];
    const il=roster.filter(function(p){
      if(!p.status)return false;
      const code=p.status.code||'',desc=p.status.description||'';
      return /^D\d/i.test(code)||/injured list|disabled list|\bil\b/i.test(desc);
    });
    if(!il.length){el.innerHTML='<div class="empty-state">No players on the IL</div>';return;}
    function ilDays(p){const s=(p.status&&p.status.code||'')+' '+(p.status&&p.status.description||'');const m=s.match(/\d+/);return m?parseInt(m[0],10):999;}
    il.sort(function(a,b){return ilDays(a)-ilDays(b)||((a.person&&a.person.fullName)||'').localeCompare((b.person&&b.person.fullName)||'');});
    let html='<div class="home-roster-list">';
    il.forEach(function(p){
      const name=escapeNewsHtml((p.person&&p.person.fullName)||'—');
      const pos=escapeNewsHtml((p.position&&p.position.abbreviation)||'');
      const desc=escapeNewsHtml((p.status&&p.status.description)||'Injured List');
      html+='<div class="home-roster-row"><div class="home-roster-main">'+name+(pos?'<span class="home-roster-pos">'+pos+'</span>':'')+'</div><div class="home-roster-sub">'+desc+'</div></div>';
    });
    el.innerHTML=html+'</div>';
  }catch(e){el.innerHTML='<div class="error">Could not load injuries</div>';}
}

export async function loadHomeMoves(){
  const el=document.getElementById('homeMoves');if(!el)return;
  el.innerHTML='<div class="loading">Loading roster moves...</div>';
  try{
    const end=etDateStr(),start=etDatePlus(end,-30);
    const r=await fetch(MLB_BASE+'/transactions?teamId='+state.activeTeam.id+'&startDate='+start+'&endDate='+end);
    let d=await r.json(),tx=(d.transactions||[]).slice();
    if(!tx.length){el.innerHTML='<div class="empty-state">No roster moves in the last 30 days</div>';return;}
    tx.sort(function(a,b){return new Date(b.date||b.effectiveDate||0)-new Date(a.date||a.effectiveDate||0);});
    tx=tx.slice(0,15);
    let html='<div class="home-roster-list">';
    tx.forEach(function(x){
      const dt=x.date||x.effectiveDate;
      const dlabel=dt?new Date(dt+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'}):'';
      const desc=escapeNewsHtml(x.description||x.typeDesc||'Transaction');
      html+='<div class="home-roster-row"><div class="home-roster-main">'+desc+'</div><div class="home-roster-sub">'+escapeNewsHtml(dlabel)+'</div></div>';
    });
    el.innerHTML=html+'</div>';
  }catch(e){el.innerHTML='<div class="error">Could not load roster moves</div>';}
}

export async function loadHomeYoutubeWidget(){
  const uc=state.activeTeam.youtubeUC||MLB_FALLBACK_UC,teamName=state.activeTeam.youtubeUC?state.activeTeam.name:'MLB',channelUrl='https://www.youtube.com/channel/'+uc;
  const themeTeam=state.themeOverride||state.activeTeam,bannerColor=state.themeInvert?themeTeam.secondary:themeTeam.primary;
  const grad='background:linear-gradient(135deg,'+bannerColor+' 0%,var(--dark) 100%)';
  document.getElementById('homeYoutubeHeader').innerHTML='<div style="'+grad+';border-radius:12px 12px 0 0;padding:16px 20px;display:flex;align-items:center;justify-content:space-between"><div><div style="font-size:.7rem;font-weight:700;text-transform:uppercase;color:rgba(255,255,255,.6);margin-bottom:2px">📺 Official Channel</div><div style="font-size:1.1rem;font-weight:800;color:#fff">'+teamName+'</div></div><a href="'+channelUrl+'" target="_blank" style="font-size:.78rem;color:rgba(255,255,255,.7);text-decoration:none;border:1px solid rgba(255,255,255,.3);padding:5px 12px;border-radius:6px">Open in YouTube ↗</a></div>';
  await loadMediaFeed(uc);
}

async function loadMediaFeed(uc){
  const listEl=document.getElementById('homeYoutubeList');
  try{
    const r=await fetch(API_BASE+'/api/proxy-youtube?channel='+encodeURIComponent(uc));
    if(!r.ok)throw new Error('HTTP '+r.status);
    const json=await r.json();
    if(!json.success||!json.videos||!json.videos.length)throw new Error(json.message||'No videos');
    mediaVideos=json.videos;
    renderMediaList();selectMediaVideo(mediaVideos[0].videoId);
  }catch(e){if(listEl)listEl.innerHTML='<div class="error" style="padding:12px;color:var(--muted);font-size:.9rem">Could not load videos: '+e.message+'</div>';}
}

function renderMediaList(){const listEl=document.getElementById('homeYoutubeList');if(!listEl)return;let html='';mediaVideos.forEach(function(v){const sel=v.videoId===selectedVideoId;const thumbUrl=v.thumb?forceHttps(v.thumb):'';html+='<div onclick="selectMediaVideo(\''+v.videoId+'\')" style="cursor:pointer;padding:10px;border-bottom:1px solid var(--border);background:'+(sel?'color-mix(in srgb,var(--accent) 12%,transparent)':'transparent')+';'+(sel?'border-left:3px solid var(--accent)':'border-left:3px solid transparent')+'"><img src="'+thumbUrl+'" style="width:100%;border-radius:4px;margin-bottom:6px;display:block" loading="lazy" onerror="this.style.display=\'none\'"/><div style="font-size:.72rem;font-weight:600;color:'+(sel?'var(--accent)':'var(--text)')+';line-height:1.3;margin-bottom:3px">'+v.title+'</div><div style="font-size:.65rem;color:var(--muted)">'+v.date+'</div></div>';});listEl.innerHTML=html;}

export function selectMediaVideo(videoId){const stopAllMedia=window.stopAllMedia;if(stopAllMedia)stopAllMedia('youtube');selectedVideoId=videoId;const player=document.getElementById('homeYoutubePlayer');if(player)player.src='https://www.youtube-nocookie.com/embed/'+videoId+'?rel=0&enablejsapi=1';renderMediaList();}

export async function loadHomePodcastWidget(){
  const team=state.activeTeam,curated=TEAM_PODCASTS[team.id];
  const themeTeam=state.themeOverride||state.activeTeam,bannerColor=state.themeInvert?themeTeam.secondary:themeTeam.primary;
  const grad='background:linear-gradient(135deg,'+bannerColor+' 0%,var(--dark) 100%)';
  const hdr=document.getElementById('homePodcastHeader');
  if(hdr)hdr.innerHTML='<div style="'+grad+';border-radius:12px 12px 0 0;padding:16px 20px"><div style="font-size:.7rem;font-weight:700;text-transform:uppercase;color:rgba(255,255,255,.6);margin-bottom:2px">🎙️ Team Podcasts</div><div style="font-size:1.1rem;font-weight:800;color:#fff">'+escapeNewsHtml(team.name)+'</div></div>';
  const stripEl=document.getElementById('homePodcastStrip');
  if(stripEl)stripEl.innerHTML='<div class="loading" style="padding:16px">Loading podcasts...</div>';
  const pl=document.getElementById('homePodcastPlayer');if(pl)pl.innerHTML='';
  podcastShows=[];playingPodcastId=null;
  try{
    const term=encodeURIComponent(fallbackPodcastTerm(team.name));
    const url=API_BASE+'/api/proxy-podcast?term='+term+(curated?'&ids='+curated.map(function(p){return p.id;}).join(','):'');
    const r=await fetch(url);
    if(!r.ok)throw new Error('HTTP '+r.status);
    const json=await r.json();
    if(!json.success||!json.shows||!json.shows.length)throw new Error(json.message||'No podcasts');
    podcastShows=json.shows;
    renderPodcastStrip();
  }catch(e){if(stripEl)stripEl.innerHTML='<div class="error" style="padding:12px;color:var(--muted);font-size:.9rem">Could not load podcasts: '+e.message+'</div>';}
}

function renderPodcastStrip(){
  const stripEl=document.getElementById('homePodcastStrip');if(!stripEl)return;
  let html='';
  podcastShows.forEach(function(s){
    const on=s.collectionId===playingPodcastId;
    const art=s.artwork?forceHttps(s.artwork):'';
    html+='<div class="podcast-icon'+(on?' playing':'')+'" onclick="playPodcast('+s.collectionId+')" title="'+escapeNewsHtml(s.name)+'">'
      +'<div class="podcast-icon-art"><img src="'+art+'" loading="lazy" onerror="this.style.visibility=\'hidden\'"/>'+(on?'<span class="podcast-icon-eq">▮▮▮</span>':'<span class="podcast-icon-play">▶</span>')+'</div>'
      +'<div class="podcast-icon-name">'+escapeNewsHtml(s.name)+'</div></div>';
  });
  stripEl.innerHTML=html;
}

export function playPodcast(collectionId){
  const show=podcastShows.find(function(s){return s.collectionId===collectionId;});
  if(!show||!show.audioUrl)return;
  const stopAllMedia=window.stopAllMedia;if(stopAllMedia)stopAllMedia('podcast');
  playingPodcastId=collectionId;
  const pl=document.getElementById('homePodcastPlayer');
  if(pl){
    const art=show.artwork?forceHttps(show.artwork):'';
    pl.innerHTML='<div class="podcast-now"><img class="podcast-now-art" src="'+art+'" onerror="this.style.visibility=\'hidden\'"/>'
      +'<div class="podcast-now-meta"><div class="podcast-now-show">'+escapeNewsHtml(show.name)+'</div>'
      +'<div class="podcast-now-ep">'+escapeNewsHtml(show.episodeTitle||'Latest episode')+(show.date?' · '+escapeNewsHtml(show.date):'')+'</div>'
      +'<audio id="homePodcastAudio" controls autoplay preload="none" style="width:100%;margin-top:8px"></audio></div></div>';
    const a=document.getElementById('homePodcastAudio');
    if(a){a.src=show.audioUrl;const p=a.play();if(p&&p.catch)p.catch(function(){});}
  }
  renderPodcastStrip();
}

export function stopPodcast(){const a=document.getElementById('homePodcastAudio');if(a&&!a.paused)a.pause();}
