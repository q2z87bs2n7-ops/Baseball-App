// Home (My Team) section — today/next-game hero card, next-series card,
// Division Snapshot, Latest News widget, and the team's official YouTube
// channel embed.
//
// renderNextGame and teamCapImg are injected from main.js via
// setHomeCallbacks. The home-live polling timer (homeLiveTimer) is exported
// so theme-switch / team-switch flows in main.js can clear it on team change.

import { state } from '../state.js';
import { MLB_BASE, API_BASE, TEAMS, TIMING } from '../config/constants.js';
import { etDateStr, etDatePlus } from '../utils/format.js';
import { forceHttps, escapeNewsHtml } from '../utils/news.js';

let homeCallbacks = { renderNextGame: null, teamCapImg: null };
export function setHomeCallbacks(cb) { Object.assign(homeCallbacks, cb); }

export let homeLiveTimer = null;
export function clearHomeTimer(){ if(homeLiveTimer){clearInterval(homeLiveTimer);homeLiveTimer=null;} }

var selectedVideoId=null,mediaVideos=[];
const MLB_FALLBACK_UC='UCoLrcjPV5PbUrUyXq5mjc_A';

export async function loadTodayGame(){
  if(homeLiveTimer){clearInterval(homeLiveTimer);homeLiveTimer=null;}
  var today=etDateStr();
  document.getElementById('todayGame').innerHTML='<div class="loading">Loading next game...</div>';
  try{
    var r=await fetch(MLB_BASE+'/schedule?sportId=1&date='+today+'&teamId='+state.activeTeam.id+'&hydrate=linescore,team,seriesStatus,gameInfo');
    var d=await r.json(),todayGames=(d.dates&&d.dates[0]&&d.dates[0].games)?d.dates[0].games:[];
    var liveGame=todayGames.find(function(g){return g.status.abstractGameState==='Live'&&g.status.detailedState!=='Warmup'&&g.status.detailedState!=='Pre-Game';});
    var upcomingToday=todayGames.find(function(g){return g.status.abstractGameState==='Preview'||g.status.abstractGameState==='Scheduled'||(g.status.abstractGameState==='Live'&&(g.status.detailedState==='Warmup'||g.status.detailedState==='Pre-Game'));});
    var gameToRender=liveGame||upcomingToday;
    if(gameToRender&&!state.scheduleData.length){try{var gdEt=etDateStr(new Date(gameToRender.gameDate));var sr=await fetch(MLB_BASE+'/schedule?sportId=1&startDate='+etDatePlus(gdEt,-7)+'&endDate='+etDatePlus(gdEt,7)+'&teamId='+state.activeTeam.id+'&hydrate=team,linescore');var srd=await sr.json();(srd.dates||[]).forEach(function(dt){dt.games.forEach(function(g){state.scheduleData.push(g);});});}catch(e){}}
    if(liveGame){document.getElementById('todayGame').innerHTML=homeCallbacks.renderNextGame(liveGame,'TODAY');homeLiveTimer=setInterval(loadTodayGame,TIMING.HOME_LIVE_MS);return;}
    if(upcomingToday){document.getElementById('todayGame').innerHTML=homeCallbacks.renderNextGame(upcomingToday,'TODAY');return;}
    var endStr=etDatePlus(today,14);
    var r2=await fetch(MLB_BASE+'/schedule?sportId=1&startDate='+today+'&endDate='+endStr+'&teamId='+state.activeTeam.id+'&hydrate=linescore,team,seriesStatus,gameInfo');
    var d2=await r2.json(),nextGame=null;
    for(var i=0;i<(d2.dates||[]).length;i++){var u=(d2.dates[i].games||[]).find(function(g){return g.status.abstractGameState==='Preview'||g.status.abstractGameState==='Scheduled';});if(u){nextGame=u;break;}}
    if(!nextGame){document.getElementById('todayGame').innerHTML='<div class="game-big surface-hero"><div class="card-title">NEXT GAME</div><div class="empty-state">No upcoming games found</div></div>';return;}
    var gd=new Date(nextGame.gameDate),label=gd.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}).toUpperCase();
    document.getElementById('todayGame').innerHTML=homeCallbacks.renderNextGame(nextGame,label);
  }catch(e){document.getElementById('todayGame').innerHTML='<div class="error">Could not load next game</div>';}
}

export async function loadNextGame(){
  document.getElementById('nextGame').innerHTML='<div class="loading">Loading next series...</div>';
  try{
    var today=etDateStr();
    var endStr=etDatePlus(today,28);
    var r=await fetch(MLB_BASE+'/schedule?sportId=1&startDate='+today+'&endDate='+endStr+'&teamId='+state.activeTeam.id+'&hydrate=team,linescore,venue,probablePitcher');
    var d=await r.json(),allGames=[];
    (d.dates||[]).forEach(function(dt){dt.games.forEach(function(g){allGames.push(g);});});
    var seriesList=[],used=new Set();
    allGames.forEach(function(g){
      if(used.has(g.gamePk))return;
      var oppId=g.teams.home.team.id===state.activeTeam.id?g.teams.away.team.id:g.teams.home.team.id;
      var venueId=g.venue&&g.venue.id,gDate=new Date(g.gameDate);
      var group=allGames.filter(function(s){
        if(used.has(s.gamePk))return false;
        var sOpp=s.teams.home.team.id===state.activeTeam.id?s.teams.away.team.id:s.teams.home.team.id;
        var sVenue=s.venue&&s.venue.id,daysDiff=Math.abs((new Date(s.gameDate)-gDate)/86400000);
        return sOpp===oppId&&sVenue===venueId&&daysDiff<=4;
      }).sort(function(a,b){return new Date(a.gameDate)-new Date(b.gameDate);});
      group.forEach(function(s){used.add(s.gamePk);});seriesList.push(group);
    });
    var currentIdx=-1;
    for(var i=0;i<seriesList.length;i++){if(seriesList[i].some(function(g){return g.status.abstractGameState!=='Final';})){currentIdx=i;break;}}
    var nextSeries=currentIdx>=0&&currentIdx+1<seriesList.length?seriesList[currentIdx+1]:null;
    if(!nextSeries||!nextSeries.length){document.getElementById('nextGame').innerHTML='<div class="game-big surface-hero"><div class="card-title">NEXT SERIES</div><div class="empty-state">No upcoming series found</div></div>';return;}
    var first=nextSeries[0],teamHome=first.teams.home.team.id===state.activeTeam.id,oppTeam=teamHome?first.teams.away.team:first.teams.home.team;
    var oppD=TEAMS.find(function(t){return t.id===oppTeam.id;})||{};
    var oppPrimary=oppD.primary||'#333',oppSecondary=oppD.secondary||'#fff';
    var d1=new Date(nextSeries[0].gameDate),d2=new Date(nextSeries[nextSeries.length-1].gameDate);
    var dateRange=d1.toLocaleDateString('en-US',{month:'short',day:'numeric'}).toUpperCase();
    if(nextSeries.length>1)dateRange+=' — '+d2.toLocaleDateString('en-US',{month:'short',day:'numeric'}).toUpperCase();
    var venue=first.venue&&first.venue.name?first.venue.name:'';
    var numGames=nextSeries.length;
    var html='<div class="game-big surface-hero has-ghost">';
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
      var status=g.status.abstractGameState,gDate=new Date(g.gameDate);
      var dayLabel=gDate.toLocaleDateString('en-US',{weekday:'short'}).toUpperCase();
      var myT=g.teams.home.team.id===state.activeTeam.id?g.teams.home:g.teams.away,oppT=g.teams.home.team.id===state.activeTeam.id?g.teams.away:g.teams.home;
      html+='<div class="hero-day-cell">';
      html+='<div class="hero-day-label">'+dayLabel+'</div>';
      if(status==='Final'){var w=myT.isWinner;html+='<span class="badge '+(w?'badge-w':'badge-l')+'" style="font-size:.62rem">'+(w?'W':'L')+' '+myT.score+'-'+oppT.score+'</span>';}
      else if(status==='Live'){html+='<div class="hero-day-live"><span class="matchup-live-dot"></span>LIVE</div><div class="hero-day-score">'+myT.score+'-'+oppT.score+'</div>';}
      else{html+='<div class="hero-day-time">'+gDate.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})+'</div>';}
      html+='</div>';
    });
    html+='</div></div></div>';
    document.getElementById('nextGame').innerHTML=html;
  }catch(e){document.getElementById('nextGame').innerHTML='<div class="error">Could not load next series</div>';}
}

export async function loadHomeInjuries(){
  var el=document.getElementById('homeInjuries');if(!el)return;
  el.innerHTML='<div class="loading">Loading injuries...</div>';
  try{
    var r=await fetch(MLB_BASE+'/teams/'+state.activeTeam.id+'/roster?rosterType=40Man');
    var d=await r.json(),roster=d.roster||[];
    var il=roster.filter(function(p){return p.status&&/injured list|disabled list/i.test(p.status.description||'');});
    if(!il.length){el.innerHTML='<div class="empty-state">No players on the IL</div>';return;}
    il.sort(function(a,b){return ((a.person&&a.person.fullName)||'').localeCompare((b.person&&b.person.fullName)||'');});
    var html='<div class="home-roster-list">';
    il.forEach(function(p){
      var name=escapeNewsHtml((p.person&&p.person.fullName)||'—');
      var pos=escapeNewsHtml((p.position&&p.position.abbreviation)||'');
      var desc=escapeNewsHtml((p.status&&p.status.description)||'Injured List');
      html+='<div class="home-roster-row"><div class="home-roster-main">'+name+(pos?'<span class="home-roster-pos">'+pos+'</span>':'')+'</div><div class="home-roster-sub">'+desc+'</div></div>';
    });
    el.innerHTML=html+'</div>';
  }catch(e){el.innerHTML='<div class="error">Could not load injuries</div>';}
}

export async function loadHomeMoves(){
  var el=document.getElementById('homeMoves');if(!el)return;
  el.innerHTML='<div class="loading">Loading roster moves...</div>';
  try{
    var end=etDateStr(),start=etDatePlus(end,-30);
    var r=await fetch(MLB_BASE+'/transactions?teamId='+state.activeTeam.id+'&startDate='+start+'&endDate='+end);
    var d=await r.json(),tx=(d.transactions||[]).slice();
    if(!tx.length){el.innerHTML='<div class="empty-state">No roster moves in the last 30 days</div>';return;}
    tx.sort(function(a,b){return new Date(b.date||b.effectiveDate||0)-new Date(a.date||a.effectiveDate||0);});
    tx=tx.slice(0,15);
    var html='<div class="home-roster-list">';
    tx.forEach(function(x){
      var dt=x.date||x.effectiveDate;
      var dlabel=dt?new Date(dt+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'}):'';
      var desc=escapeNewsHtml(x.description||x.typeDesc||'Transaction');
      html+='<div class="home-roster-row"><div class="home-roster-main">'+desc+'</div><div class="home-roster-sub">'+escapeNewsHtml(dlabel)+'</div></div>';
    });
    el.innerHTML=html+'</div>';
  }catch(e){el.innerHTML='<div class="error">Could not load roster moves</div>';}
}

export async function loadHomeYoutubeWidget(){
  var uc=state.activeTeam.youtubeUC||MLB_FALLBACK_UC,teamName=state.activeTeam.youtubeUC?state.activeTeam.name:'MLB',channelUrl='https://www.youtube.com/channel/'+uc;
  var themeTeam=state.themeOverride||state.activeTeam,bannerColor=state.themeInvert?themeTeam.secondary:themeTeam.primary;
  var grad='background:linear-gradient(135deg,'+bannerColor+' 0%,var(--dark) 100%)';
  document.getElementById('homeYoutubeHeader').innerHTML='<div style="'+grad+';border-radius:12px 12px 0 0;padding:16px 20px;display:flex;align-items:center;justify-content:space-between"><div><div style="font-size:.7rem;font-weight:700;text-transform:uppercase;color:rgba(255,255,255,.6);margin-bottom:2px">📺 Official Channel</div><div style="font-size:1.1rem;font-weight:800;color:#fff">'+teamName+'</div></div><a href="'+channelUrl+'" target="_blank" style="font-size:.78rem;color:rgba(255,255,255,.7);text-decoration:none;border:1px solid rgba(255,255,255,.3);padding:5px 12px;border-radius:6px">Open in YouTube ↗</a></div>';
  await loadMediaFeed(uc);
}

async function loadMediaFeed(uc){
  var listEl=document.getElementById('homeYoutubeList');
  try{
    var r=await fetch(API_BASE+'/api/proxy-youtube?channel='+encodeURIComponent(uc));
    if(!r.ok)throw new Error('HTTP '+r.status);
    var json=await r.json();
    if(!json.success||!json.videos||!json.videos.length)throw new Error(json.message||'No videos');
    mediaVideos=json.videos;
    renderMediaList();selectMediaVideo(mediaVideos[0].videoId);
  }catch(e){if(listEl)listEl.innerHTML='<div class="error" style="padding:12px;color:var(--muted);font-size:.9rem">Could not load videos: '+e.message+'</div>';}
}

function renderMediaList(){var listEl=document.getElementById('homeYoutubeList');if(!listEl)return;var html='';mediaVideos.forEach(function(v){var sel=v.videoId===selectedVideoId;var thumbUrl=v.thumb?forceHttps(v.thumb):'';html+='<div onclick="selectMediaVideo(\''+v.videoId+'\')" style="cursor:pointer;padding:10px;border-bottom:1px solid var(--border);background:'+(sel?'color-mix(in srgb,var(--accent) 12%,transparent)':'transparent')+';'+(sel?'border-left:3px solid var(--accent)':'border-left:3px solid transparent')+'"><img src="'+thumbUrl+'" style="width:100%;border-radius:4px;margin-bottom:6px;display:block" loading="lazy" onerror="this.style.display=\'none\'"/><div style="font-size:.72rem;font-weight:600;color:'+(sel?'var(--accent)':'var(--text)')+';line-height:1.3;margin-bottom:3px">'+v.title+'</div><div style="font-size:.65rem;color:var(--muted)">'+v.date+'</div></div>';});listEl.innerHTML=html;}

export function selectMediaVideo(videoId){var stopAllMedia=window.stopAllMedia;if(stopAllMedia)stopAllMedia('youtube');selectedVideoId=videoId;var player=document.getElementById('homeYoutubePlayer');if(player)player.src='https://www.youtube-nocookie.com/embed/'+videoId+'?rel=0&enablejsapi=1';renderMediaList();}
