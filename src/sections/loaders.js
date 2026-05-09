// Section Loaders — Schedule, Standings, Stats, Roster, News, League Views
import { state } from '../state.js';
import {
  SEASON, WC_SPOTS, MLB_BASE, API_BASE, TEAMS, TIMING,
  LEADER_CATS_FOR_PERCENTILE,
} from '../config/constants.js';
import {
  tcLookup, fmt, fmtRate, fmtDateTime, fmtNewsDate, pickOppColor,
  etDateStr, etDatePlus,
} from '../utils/format.js';
import { computePercentile, tierFromPercentile, pctBar, rankCaption, avgChip, leagueAverage, teamAverage, leaderEntry } from '../utils/stats-math.js';
import { NEWS_IMAGE_HOSTS, isSafeNewsImage } from '../utils/news.js';

// ── Callbacks (injected by main.js) ──────────────────────────────────────────
let sectionCallbacks={
  renderNextGame: null,
  getSeriesInfo: null,
  localDateStr: null,
  teamCapImg: null,
  capImgError: null,
};
export function setSectionCallbacks(cb) {
  Object.assign(sectionCallbacks, cb);
}

export function clearHomeTimer(){
  if(homeLiveTimer){clearInterval(homeLiveTimer);homeLiveTimer=null;}
}

export function clearLeagueTimer(){
  if(leagueRefreshTimer){clearInterval(leagueRefreshTimer);leagueRefreshTimer=null;}
}

// ── Module state variables ──────────────────────────────────────────────────
var calMonth=new Date().getMonth(),calYear=new Date().getFullYear(),selectedGamePk=null;
var liveGamePk=null,liveInterval=null;
var leagueLeaderTab='hitting',leagueLeadersCache={hitting:{},pitching:{}},leagueStandingsMap={},leagueMatchupOffset=0;
export let homeLiveTimer=null;
export let leagueRefreshTimer=null;
var selectedVideoId=null,mediaVideos=[];
const MLB_FALLBACK_UC='UCoLrcjPV5PbUrUyXq5mjc_A';

const LEAGUE_HIT_STATS=[{label:'HR',cats:'homeRuns',decimals:0},{label:'AVG',cats:'battingAverage',decimals:3,noLeadZero:true},{label:'OPS',cats:'onBasePlusSlugging',decimals:3,noLeadZero:true},{label:'RBI',cats:'runsBattedIn',decimals:0},{label:'SB',cats:'stolenBases',decimals:0},{label:'BB',cats:'walks',decimals:0}];
const LEAGUE_PIT_STATS=[{label:'SO',cats:'strikeouts',decimals:0},{label:'WHIP',cats:'walksAndHitsPerInningPitched',decimals:2},{label:'ERA',cats:'earnedRunAverage',decimals:2},{label:'W',cats:'wins',decimals:0},{label:'SV',cats:'saves',decimals:0},{label:'IP',cats:'inningsPitched',decimals:1}];

// ── HOME SECTION ────────────────────────────────────────────────────────────
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
    if(liveGame){document.getElementById('todayGame').innerHTML=sectionCallbacks.renderNextGame(liveGame,'TODAY');homeLiveTimer=setInterval(loadTodayGame,TIMING.HOME_LIVE_MS);return;}
    if(upcomingToday){document.getElementById('todayGame').innerHTML=sectionCallbacks.renderNextGame(upcomingToday,'TODAY');return;}
    var endStr=etDatePlus(today,14);
    var r2=await fetch(MLB_BASE+'/schedule?sportId=1&startDate='+today+'&endDate='+endStr+'&teamId='+state.activeTeam.id+'&hydrate=linescore,team,seriesStatus,gameInfo');
    var d2=await r2.json(),nextGame=null;
    for(var i=0;i<(d2.dates||[]).length;i++){var u=(d2.dates[i].games||[]).find(function(g){return g.status.abstractGameState==='Preview'||g.status.abstractGameState==='Scheduled';});if(u){nextGame=u;break;}}
    if(!nextGame){document.getElementById('todayGame').innerHTML='<div class="game-big surface-hero"><div class="card-title">NEXT GAME</div><div class="empty-state">No upcoming games found</div></div>';return;}
    var gd=new Date(nextGame.gameDate),label=gd.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}).toUpperCase();
    document.getElementById('todayGame').innerHTML=sectionCallbacks.renderNextGame(nextGame,label);
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
    html+=sectionCallbacks.teamCapImg(oppTeam.id,oppTeam.teamName,oppSecondary,oppPrimary,'series-ghost');
    html+='<div class="hero-content">';
    html+='<div class="hero-top-row">';
    html+='<div class="eyebrow eyebrow--accent">NEXT SERIES</div>';
    html+='<div class="hero-meta-right">'+dateRange+'</div></div>';
    html+='<div class="hero-opp-row">';
    html+=sectionCallbacks.teamCapImg(oppTeam.id,oppTeam.teamName,oppPrimary,oppSecondary);
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

// ── SCHEDULE SECTION ────────────────────────────────────────────────────────
export async function loadSchedule(){
  document.getElementById('calGrid').innerHTML='<div class="loading">Loading schedule...</div>';
  document.getElementById('scheduleTitle').innerHTML=SEASON+' '+state.activeTeam.short+' Schedule <button class="refresh-btn" onclick="loadSchedule()">↻ Refresh</button>';
  try{
    var r=await fetch(MLB_BASE+'/schedule?sportId=1&season='+SEASON+'&teamId='+state.activeTeam.id+'&hydrate=team,linescore,game,probablePitcher');
    var d=await r.json();state.scheduleData=[];
    (d.dates||[]).forEach(function(dt){dt.games.forEach(function(g){state.scheduleData.push(g);});});
    state.scheduleLoaded=true;calMonth=new Date().getMonth();calYear=new Date().getFullYear();renderCalendar();
  }catch(e){document.getElementById('calGrid').innerHTML='<div class="error">Could not load schedule</div>';}
}

export function changeMonth(dir){calMonth+=dir;if(calMonth>11){calMonth=0;calYear++;}if(calMonth<0){calMonth=11;calYear--;}selectedGamePk=null;document.getElementById('gameDetail').innerHTML='';renderCalendar();}

function renderCalendar(){
  var months=['January','February','March','April','May','June','July','August','September','October','November','December'];
  document.getElementById('calMonthLabel').textContent=months[calMonth]+' '+calYear;
  var days=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],today=new Date(),firstDay=new Date(calYear,calMonth,1).getDay(),daysInMonth=new Date(calYear,calMonth+1,0).getDate();
  var gamesByDate={};state.scheduleData.forEach(function(g){var _d=new Date(g.gameDate),ds=_d.getFullYear()+'-'+String(_d.getMonth()+1).padStart(2,'0')+'-'+String(_d.getDate()).padStart(2,'0');if(!gamesByDate[ds])gamesByDate[ds]=[];gamesByDate[ds].push(g);});
  Object.keys(gamesByDate).forEach(function(ds){gamesByDate[ds].sort(function(a,b){return a.gamePk-b.gamePk;});});
  var html='<div class="cal-grid">';
  days.forEach(function(d){html+='<div class="cal-header">'+d+'</div>';});
  for(var i=0;i<firstDay;i++)html+='<div class="cal-day empty"></div>';
  for(var day=1;day<=daysInMonth;day++){
    var ds=calYear+'-'+String(calMonth+1).padStart(2,'0')+'-'+String(day).padStart(2,'0'),dayGames=gamesByDate[ds]||[];
    var isToday=today.getFullYear()===calYear&&today.getMonth()===calMonth&&today.getDate()===day;
    var isSelected=dayGames.some(function(gm){return gm.gamePk===selectedGamePk;});
    var isDH=dayGames.length>1;
    var classes='cal-day'+(dayGames.length?' has-game':'')+(isToday?' today':'')+(isSelected?' selected':'');
    var onclick=dayGames.length?'onclick="selectCalGame('+dayGames[0].gamePk+',event)"':'';
    var inner='<div class="cal-day-num">'+day+'</div>';
    if(dayGames.length){
      var g0=dayGames[0],home0=g0.teams.home,away0=g0.teams.away,teamHome=home0.team.id===state.activeTeam.id,opp0=teamHome?away0:home0;
      inner+='<div class="cal-game-info"><div class="cal-opp" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><span class="cal-ha">'+(teamHome?'vs ':'@ ')+'</span>'+opp0.team.teamName+(isDH?' <span style="font-size:.55rem;font-weight:700;color:var(--accent);letter-spacing:.04em">DH</span>':'')+'</div>';
      var dotW=false,dotL=false,dotLive=false,dotPPD=false;
      dayGames.forEach(function(gm,idx){
        var myT=gm.teams.home.team.id===state.activeTeam.id?gm.teams.home:gm.teams.away;
        var opT=gm.teams.home.team.id===state.activeTeam.id?gm.teams.away:gm.teams.home;
        var st=gm.status.abstractGameState,dtl=gm.status.detailedState||'';
        var ppd=dtl==='Postponed'||dtl==='Cancelled'||dtl==='Suspended';
        var calLive=st==='Live'&&dtl!=='Warmup'&&dtl!=='Pre-Game';
        var wrap=isDH?'<div onclick="event.stopPropagation();selectCalGame('+gm.gamePk+',event)" style="cursor:pointer;display:flex;align-items:center;gap:3px;margin-top:2px"><span style="font-size:.6rem;color:var(--muted);flex-shrink:0">G'+(idx+1)+':</span>':'';
        var wrapEnd=isDH?'</div>':'';
        if(ppd){
          dotPPD=true;
          inner+=wrap+'<span class="cal-result" style="background:rgba(150,150,150,.15);color:var(--muted);border:1px solid rgba(150,150,150,.4)'+(isDH?';font-size:.6rem;padding:1px 5px':'')+'">PPD</span>'+wrapEnd;
        } else if(st==='Final'){
          var mW=myT.isWinner,sc=(myT.score!=null&&opT.score!=null)?myT.score+'-'+opT.score:'?-?';
          inner+=wrap+'<span class="cal-result '+(mW?'cal-w':'cal-l')+'"'+(isDH?' style="font-size:.6rem;padding:1px 5px"':'')+'>'+(mW?'W':'L')+' '+sc+'</span>'+wrapEnd;
          if(mW)dotW=true;else dotL=true;
        } else if(calLive){
          var sc=(myT.score!=null&&opT.score!=null)?myT.score+'-'+opT.score:'?-?';
          inner+=wrap+'<span class="cal-result" style="background:rgba(100,100,120,.12);color:rgba(255,255,255,.6);border:1px solid rgba(255,255,255,.2)'+(isDH?';font-size:.6rem;padding:1px 5px':'')+'">LIVE '+sc+'</span>'+wrapEnd;
          dotLive=true;
        } else {
          var t=new Date(gm.gameDate),ts=t.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
          inner+=wrap+(isDH?'<span style="font-size:.65rem;color:var(--accent)">'+ts+'</span>':'<div class="cal-upcoming">'+ts+'</div>')+wrapEnd;
        }
      });
      inner+='</div>';
      var dotCls='cal-dot '+(dotLive?'cal-dot-live':(dotW&&!dotL)?'cal-dot-w':(!dotW&&dotL)?'cal-dot-l':(dotPPD&&!dotW&&!dotL)?'cal-dot-ppd':'cal-dot-up');
      inner+='<span class="'+dotCls+'"></span>';
    }
    html+='<div class="'+classes+'" '+onclick+'>'+inner+'</div>';
  }
  html+='</div>';document.getElementById('calGrid').innerHTML=html;
}

export async function selectCalGame(gamePk,evt){
  var cellRect=evt?evt.currentTarget.getBoundingClientRect():null;
  selectedGamePk=gamePk;renderCalendar();
  var g=state.scheduleData.find(function(x){return x.gamePk===gamePk;});if(!g)return;
  // Local-time bucket — must match renderCalendar's inline keying so doubleheader detection lines up on the same calendar cell.
  var localFmt=function(_d){return _d.getFullYear()+'-'+String(_d.getMonth()+1).padStart(2,'0')+'-'+String(_d.getDate()).padStart(2,'0');};
  var ds=localFmt(new Date(g.gameDate));
  var dayGames=state.scheduleData.filter(function(x){return localFmt(new Date(x.gameDate))===ds;}).sort(function(a,b){return a.gamePk-b.gamePk;});
  var isDH=dayGames.length>1;
  if(cellRect&&window.innerWidth<=480){
    var home=g.teams.home,away=g.teams.away,teamHome=home.team.id===state.activeTeam.id;
    var opp=teamHome?away:home,myT=teamHome?home:away,status=g.status.abstractGameState;
    var isPostponed=g.status.detailedState==='Postponed'||g.status.detailedState==='Cancelled'||g.status.detailedState==='Suspended';
    var gameDate=new Date(g.gameDate);
    var dateStr=gameDate.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})+(isDH?' · DH':'');
    var badgeHtml='';
    if(isPostponed)badgeHtml='<span class="cal-result" style="background:rgba(150,150,150,.15);color:var(--muted);border:1px solid rgba(150,150,150,.4)">PPD</span>';
    else if(status==='Final'){var mW=myT.isWinner,sc=(myT.score!=null&&opp.score!=null)?myT.score+'-'+opp.score:'?-?';badgeHtml='<span class="cal-result '+(mW?'cal-w':'cal-l')+'">'+(mW?'W':'L')+' '+sc+'</span>';}
    else if(status==='Live'){var sc=(myT.score!=null&&opp.score!=null)?myT.score+'-'+opp.score:'?-?';badgeHtml='<span class="cal-result" style="background:rgba(100,100,120,.12);color:rgba(255,255,255,.6);border:1px solid rgba(255,255,255,.2)">● LIVE '+sc+'</span>';}
    else badgeHtml='<span style="font-size:.8rem;color:var(--accent)">'+gameDate.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})+'</span>';
    var tt=document.getElementById('calTooltip');
    tt.innerHTML='<div class="cal-tt-opp">'+(teamHome?'vs ':'@ ')+opp.team.teamName+'</div><div class="cal-tt-date">'+dateStr+'</div>'+badgeHtml;
    var ttW=190,left=cellRect.left+cellRect.width/2-ttW/2;
    left=Math.max(8,Math.min(left,window.innerWidth-ttW-8));
    tt.style.cssText='left:'+left+'px;top:'+(cellRect.top-8)+'px;transform:translateY(-100%);min-width:'+ttW+'px';
    tt.classList.add('open');
  }
  var detail=document.getElementById('gameDetail');
  detail.innerHTML='<div class="loading">Loading game details...</div>';
  try{
    var panels=await Promise.all(dayGames.map(function(gm,idx){return buildGameDetailPanel(gm,isDH?idx+1:null);}));
    detail.innerHTML=panels.join('');
    detail.scrollIntoView({behavior:'smooth',block:'nearest'});
  }catch(e){detail.innerHTML='<div class="error">Could not load game details</div>';}
}

export function switchBoxTab(bsId,side){
  var other=side==='away'?'home':'away';
  document.getElementById(bsId+'_'+side).style.display='block';document.getElementById(bsId+'_'+other).style.display='none';
  document.getElementById(bsId+'_'+side+'_btn').classList.add('is-active');
  document.getElementById(bsId+'_'+other+'_btn').classList.remove('is-active');
}

function buildBoxscore(players){
  var hitters=[],pitchers=[];
  Object.values(players).forEach(function(p){var bat=p.stats&&p.stats.batting,pit=p.stats&&p.stats.pitching;if(bat&&bat.atBats>0)hitters.push({name:p.person.fullName,order:p.battingOrder||999,ab:bat.atBats,h:bat.hits,r:bat.runs,rbi:bat.rbi,bb:bat.baseOnBalls,k:bat.strikeOuts,hr:bat.homeRuns});if(pit&&(parseFloat(pit.inningsPitched||0)>0||pit.outs>0))pitchers.push({name:p.person.fullName,ip:pit.inningsPitched||'0.0',h:pit.hits,r:pit.runs,er:pit.earnedRuns,bb:pit.baseOnBalls,k:pit.strikeOuts,hr:pit.homeRuns,pc:pit.numberOfPitches||'—'});});
  hitters.sort(function(a,b){return a.order-b.order;});
  var t='<div style="margin-bottom:12px"><div style="font-size:.68rem;font-weight:700;text-transform:uppercase;color:var(--accent);margin-bottom:6px">Batting</div>';
  t+='<div style="overflow-x:auto"><table class="linescore-table"><thead><tr><th style="text-align:left;min-width:130px">Player</th><th>AB</th><th>H</th><th>R</th><th>RBI</th><th>BB</th><th>K</th><th>HR</th></tr></thead><tbody>';
  if(!hitters.length)t+='<tr><td colspan="8" style="color:var(--muted)">No data</td></tr>';
  hitters.forEach(function(p){t+='<tr><td style="text-align:left">'+p.name+'</td><td>'+p.ab+'</td><td>'+p.h+'</td><td>'+p.r+'</td><td>'+p.rbi+'</td><td>'+p.bb+'</td><td>'+p.k+'</td><td>'+p.hr+'</td></tr>';});
  t+='</tbody></table></div><div style="font-size:.68rem;font-weight:700;text-transform:uppercase;color:var(--accent);margin:10px 0 6px">Pitching</div>';
  t+='<div style="overflow-x:auto"><table class="linescore-table"><thead><tr><th style="text-align:left;min-width:130px">Player</th><th>IP</th><th>H</th><th>R</th><th>ER</th><th>BB</th><th>K</th><th>HR</th><th>PC</th></tr></thead><tbody>';
  if(!pitchers.length)t+='<tr><td colspan="9" style="color:var(--muted)">No data</td></tr>';
  pitchers.forEach(function(p){t+='<tr><td style="text-align:left">'+p.name+'</td><td>'+p.ip+'</td><td>'+p.h+'</td><td>'+p.r+'</td><td>'+p.er+'</td><td>'+p.bb+'</td><td>'+p.k+'</td><td>'+p.hr+'</td><td>'+p.pc+'</td></tr>';});
  return t+'</tbody></table></div></div>';
}

function pickPlayback(playbacks){return playbacks&&playbacks.length?playbacks.find(function(p){return p.name==='mp4'})||playbacks[0]:null;}

export function playHighlightVideo(el,url){
  var stopAllMedia=window.stopAllMedia;
  if(stopAllMedia)stopAllMedia('highlight');
  var video=document.createElement('video');
  video.controls=true;video.style.cssText='width:100%;display:block;background:#000';
  video.addEventListener('error',function(e){
    console.error('Video load error:',e,video.error);
    video.innerHTML='<div style="color:#e03030;padding:20px;text-align:center">Video failed to load. Please try refreshing.</div>';
  });
  video.addEventListener('canplay',function(){
    if(false) console.log('Video ready to play');
    video.play().catch(function(err){console.error('Autoplay blocked:',err);});
  },{once:true});
  var src=document.createElement('source');src.src=url;src.type='video/mp4';video.appendChild(src);
  el.replaceWith(video);
}

async function buildGameDetailPanel(g,gameNum){
  var home=g.teams.home,away=g.teams.away,gameDate=new Date(g.gameDate);
  var status=g.status.abstractGameState,detailed=g.status.detailedState||'';
  var isPostponed=detailed==='Postponed'||detailed==='Cancelled'||detailed==='Suspended';
  var sep=gameNum>1?'<div class="detail-separator"></div>':'';
  var label=gameNum?'<div class="detail-game-label">Game '+gameNum+'</div>':'';
  var title=away.team.teamName+' @ '+home.team.teamName;
  if(isPostponed){
    var html=sep+'<div class="boxscore-wrap">'+label+'<div class="boxscore-title">'+title+' &nbsp;·&nbsp; '+gameDate.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'})+'</div>';
    html+='<div class="game-notes-grid"><div class="game-note-box"><div class="game-note-label">Status</div><div class="game-note-val is-muted">'+detailed+'</div></div>';
    html+='<div class="game-note-box"><div class="game-note-label">Venue</div><div class="game-note-val">'+(g.venue&&g.venue.name?g.venue.name:'TBD')+'</div></div></div></div>';
    return html;
  }
  if(status!=='Final'&&status!=='Live'){
    var html=sep+'<div class="boxscore-wrap">'+label+'<div class="boxscore-title">'+title+' &nbsp;·&nbsp; '+gameDate.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})+' '+gameDate.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})+'</div>';
    html+='<div class="game-notes-grid"><div class="game-note-box"><div class="game-note-label">Location</div><div class="game-note-val">'+(g.venue&&g.venue.name?g.venue.name:'TBD')+'</div></div>';
    var awayPP=(away.probablePitcher&&away.probablePitcher.fullName)?away.probablePitcher.fullName:'TBD',homePP=(home.probablePitcher&&home.probablePitcher.fullName)?home.probablePitcher.fullName:'TBD';
    html+='<div class="game-note-box"><div class="game-note-label">Probable Pitchers</div><div class="game-note-val">'+away.team.teamName+': '+awayPP+'</div><div class="game-note-val">'+home.team.teamName+': '+homePP+'</div></div></div></div>';
    return html;
  }
  if(status==='Live'){
    var ls=g.linescore||{},half=ls.inningHalf||'Top',inn=ls.currentInning||'?';
    var aScore=away.score!=null?away.score:0,hScore=home.score!=null?home.score:0;
    var html=sep+'<div class="boxscore-wrap">'+label+'<div class="boxscore-title">'+title+' &nbsp;·&nbsp; '+gameDate.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})+'</div>';
    html+='<div class="game-notes-grid"><div class="game-note-box"><div class="game-note-label">Score</div><div class="game-note-val">'+away.team.teamName+' '+aScore+', '+home.team.teamName+' '+hScore+'</div></div>';
    html+='<div class="game-note-box"><div class="game-note-label">Status</div><div class="game-note-val"><span class="live-indicator">● LIVE</span> · '+half+' '+inn+'</div></div></div>';
    html+='<button onclick="showLiveGame('+g.gamePk+')" class="watch-live-btn">▶ Watch Live</button></div>';
    return html;
  }
  var ls={},bs={},content={};
  try{
    var responses=await Promise.all([fetch(MLB_BASE+'/game/'+g.gamePk+'/linescore'),fetch(MLB_BASE+'/game/'+g.gamePk+'/boxscore'),fetch(MLB_BASE+'/game/'+g.gamePk+'/content')]);
    try{ls=await responses[0].json();}catch(e){}
    try{bs=await responses[1].json();}catch(e){}
    try{if(responses[2].ok)content=await responses[2].json();}catch(e){}
  }catch(e){}
  var highlight=content.highlights&&content.highlights.highlights&&content.highlights.highlights.items&&content.highlights.highlights.items[0]?content.highlights.highlights.items[0]:null;
  var highlightPb=highlight?pickPlayback(highlight.playbacks):null;
  var highlightUrl=highlightPb?highlightPb.url:null;
  var thumbCuts=highlight&&highlight.image&&highlight.image.cuts?highlight.image.cuts:[];
  var thumbCut=thumbCuts.find(function(c){return c.width>=640&&c.width<=960;})||thumbCuts[thumbCuts.length-1]||null;
  var thumbUrl=thumbCut?thumbCut.src:null;
  var html=sep+'<div class="final-game-grid">';
  html+='<div class="boxscore-wrap"><div class="boxscore-title">'+title+' &nbsp;·&nbsp; '+gameDate.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'})+'</div>';
  var innings=ls.innings||[];
  html+='<div class="linescore-scroll"><table class="linescore-table"><thead><tr><th></th>';
  innings.forEach(function(inn){html+='<th>'+inn.num+'</th>';});
  html+='<th class="rhe-start">R</th><th>H</th><th>E</th></tr></thead><tbody>';
  html+='<tr><td>'+away.team.teamName+'</td>';innings.forEach(function(inn){html+='<td>'+(inn.away&&inn.away.runs!=null?inn.away.runs:'—')+'</td>';});
  html+='<td class="rhe rhe-start">'+(ls.teams&&ls.teams.away&&ls.teams.away.runs!=null?ls.teams.away.runs:'—')+'</td><td class="rhe">'+(ls.teams&&ls.teams.away&&ls.teams.away.hits!=null?ls.teams.away.hits:'—')+'</td><td class="rhe">'+(ls.teams&&ls.teams.away&&ls.teams.away.errors!=null?ls.teams.away.errors:'—')+'</td></tr>';
  html+='<tr><td>'+home.team.teamName+'</td>';innings.forEach(function(inn){html+='<td>'+(inn.home&&inn.home.runs!=null?inn.home.runs:'—')+'</td>';});
  html+='<td class="rhe rhe-start">'+(ls.teams&&ls.teams.home&&ls.teams.home.runs!=null?ls.teams.home.runs:'—')+'</td><td class="rhe">'+(ls.teams&&ls.teams.home&&ls.teams.home.hits!=null?ls.teams.home.hits:'—')+'</td><td class="rhe">'+(ls.teams&&ls.teams.home&&ls.teams.home.errors!=null?ls.teams.home.errors:'—')+'</td></tr>';
  html+='</tbody></table></div>';
  if(highlightUrl){
    var highlightHeadline=highlight.headline||'Full Game Highlight';
    var safeUrl=highlightUrl.replace(/'/g,"\\'");
    html+='<div class="detail-highlight">';
    if(thumbUrl){
      html+='<div onclick="playHighlightVideo(this,\''+safeUrl+'\')" class="detail-highlight-thumb">';
      html+='<img src="'+forceHttps(thumbUrl)+'" loading="lazy" onerror="this.style.display=\'none\'">';
      html+='<div class="detail-highlight-overlay">';
      html+='<div class="detail-highlight-play">';
      html+='<span class="detail-highlight-arrow">▶</span></div></div></div>';
    }else{
      html+='<div class="detail-highlight-video"><video controls preload="none"><source src="'+highlightUrl+'" type="video/mp4"></video></div>';
    }
    html+='<div class="detail-highlight-meta"><div class="detail-highlight-kicker">Highlights</div><div class="detail-highlight-title">'+highlightHeadline+'</div></div>';
    html+='</div>';
  }
  html+='</div>';
  var awayAbbr=away.team.abbreviation||away.team.teamName,homeAbbr=home.team.abbreviation||home.team.teamName;
  var isHomeActive=state.activeTeam.id===home.team.id,activeAbbr=isHomeActive?homeAbbr:awayAbbr,activeTeamName=isHomeActive?home.team.teamName:away.team.teamName;
  var activePlayers=isHomeActive?(bs.teams&&bs.teams.home&&bs.teams.home.players?bs.teams.home.players:{}):(bs.teams&&bs.teams.away&&bs.teams.away.players?bs.teams.away.players:{});
  var activeBox=buildBoxscore(activePlayers);
  html+='<div class="boxscore-wrap"><div class="detail-team-header">'+activeTeamName+'</div>';
  html+=activeBox+'</div>';
  if(bs.info&&bs.info.length){
    html+='<div class="boxscore-wrap"><div class="game-note-label">Game Summary</div>';
    bs.info.forEach(function(item){if(!item.value)return;var val=item.value.replace(/\.$/,'').trim();if(!item.label)html+='<div class="detail-summary-note">'+val+'</div>';else html+='<div class="detail-summary-row"><span class="detail-summary-label">'+item.label+'</span><span>'+val+'</span></div>';});
    html+='</div>';
  }
  var oppPlayers=isHomeActive?(bs.teams&&bs.teams.away&&bs.teams.away.players?bs.teams.away.players:{}):(bs.teams&&bs.teams.home&&bs.teams.home.players?bs.teams.home.players:{});
  var oppBox=buildBoxscore(oppPlayers),oppTeamName=isHomeActive?away.team.teamName:home.team.teamName;
  html+='<div class="boxscore-wrap"><div class="detail-team-header">'+oppTeamName+'</div>';
  html+=oppBox+'</div>';
  html+='</div>';
  return html;
}

// ── STANDINGS SECTION ───────────────────────────────────────────────────────
export async function loadStandings(){
  document.getElementById('nlEast').innerHTML='<div class="loading">Loading...</div>';
  try{
    var r=await fetch(MLB_BASE+'/standings?leagueId=103,104&standingsTypes=regularSeason&hydrate=team,division,league');
    var d=await r.json(),divMap={};
    (d.records||[]).forEach(function(rec){divMap[rec.division.id]={name:rec.division.name,league:rec.league.name,teams:rec.teamRecords};});
    renderDivStandings(divMap);renderNLWC(divMap);renderOtherDivWC(divMap);renderFullStandings(divMap);renderHomeStandings(divMap);
    document.getElementById('divTitle').textContent='🔥 '+state.activeTeam.division;
    document.getElementById('wcTitle').textContent='🃏 '+state.activeTeam.league+' Wild Card Race';
    document.getElementById('otherDivWCTitle').textContent='🃏 '+(state.activeTeam.league==='NL'?'AL':'NL')+' Wild Card Race';
    document.getElementById('homeDivTitle').textContent=state.activeTeam.division+' Snapshot';
  }catch(e){['nlEast','nlWC','otherDivWC','fullStandings','homeStandings'].forEach(function(id){var el=document.getElementById(id);if(el)el.innerHTML='<div class="error">Could not load standings</div>';});}
}

function standingsTable(teams){
  var html='<table class="standings-table"><thead><tr><th>#</th><th>Team</th><th>W</th><th>L</th><th>PCT</th><th>GB</th></tr></thead><tbody>';
  teams.forEach(function(t,i){var isActive=t.team.id===state.activeTeam.id;html+='<tr class="'+(isActive?'active-row':'')+'"><td>'+(i+1)+'</td><td><strong>'+t.team.teamName+'</strong></td><td>'+t.wins+'</td><td>'+t.losses+'</td><td>'+t.winningPercentage+'</td><td>'+t.gamesBack+'</td></tr>';});
  return html+'</tbody></table>';
}

function renderDivStandings(divMap){var f=Object.values(divMap).find(function(d){return d.name===state.activeTeam.division;});document.getElementById('nlEast').innerHTML=f?standingsTable(f.teams):'<div class="error">Division not found</div>';}

function renderNLWC(divMap){
  var league=state.activeTeam.league==='NL'?'National League':'American League';
  var leagueDivs=Object.values(divMap).filter(function(d){return d.league===league;});
  var leaders=new Set(leagueDivs.map(function(d){return d.teams[0]&&d.teams[0].team.id;}));
  var allLeague=[];leagueDivs.forEach(function(d){allLeague=allLeague.concat(d.teams);});
  var wc=allLeague.filter(function(t){return!leaders.has(t.team.id);}).sort(function(a,b){return parseFloat(b.winningPercentage)-parseFloat(a.winningPercentage);}).slice(0,9);
  var top=wc[0],topW=top?top.wins:0,topL=top?top.losses:0;
  var html='<table class="standings-table"><thead><tr><th>#</th><th>Team</th><th>W</th><th>L</th><th>PCT</th><th>GB</th></tr></thead><tbody>';
  wc.forEach(function(t,i){var isActive=t.team.id===state.activeTeam.id,gb=i===0?'—':(((topW-t.wins)+(t.losses-topL))/2).toFixed(1),cls=(isActive?'active-row':'')+(i===WC_SPOTS-1?' wc-cutoff-row':'');html+='<tr class="'+cls.trim()+'"><td>'+(i+1)+'</td><td><strong>'+t.team.teamName+'</strong></td><td>'+t.wins+'</td><td>'+t.losses+'</td><td>'+t.winningPercentage+'</td><td>'+gb+'</td></tr>';});
  html+='</tbody></table><div class="wc-cutoff-label">Wild Card cutoff</div>';
  document.getElementById('nlWC').innerHTML=html;
}

function renderOtherDivWC(divMap){
  var otherLeague=state.activeTeam.league==='NL'?'American League':'National League';
  var leagueDivs=Object.values(divMap).filter(function(d){return d.league===otherLeague;});
  var leaders=new Set(leagueDivs.map(function(d){return d.teams[0]&&d.teams[0].team.id;}));
  var teams=[];leagueDivs.forEach(function(d){d.teams.forEach(function(t){if(!leaders.has(t.team.id))teams.push(t);});});
  teams.sort(function(a,b){return parseFloat(b.winningPercentage)-parseFloat(a.winningPercentage);});
  var top=teams[0],topW=top?top.wins:0,topL=top?top.losses:0;
  var html='<table class="standings-table"><thead><tr><th>#</th><th>Team</th><th>W</th><th>L</th><th>PCT</th><th>GB</th></tr></thead><tbody>';
  teams.slice(0,9).forEach(function(t,i){var gb=i===0?'—':(((topW-t.wins)+(t.losses-topL))/2).toFixed(1),cls=i===WC_SPOTS-1?'wc-cutoff-row':'';html+='<tr class="'+cls+'"><td>'+(i+1)+'</td><td><strong>'+t.team.teamName+'</strong></td><td>'+t.wins+'</td><td>'+t.losses+'</td><td>'+t.winningPercentage+'</td><td>'+gb+'</td></tr>';});
  html+='</tbody></table><div class="wc-cutoff-label">Wild Card cutoff</div>';
  document.getElementById('otherDivWC').innerHTML=html;
}

function renderFullStandings(divMap){
  var al=Object.values(divMap).filter(function(d){return d.league==='American League';}),nl=Object.values(divMap).filter(function(d){return d.league==='National League';});
  var isNL=state.activeTeam.league==='NL',primary=isNL?nl:al,secondary=isNL?al:nl;
  var primarySorted=primary.slice().sort(function(a,b){return a.name===state.activeTeam.division?-1:b.name===state.activeTeam.division?1:0;});
  var html='';
  primarySorted.concat(secondary).forEach(function(div){
    if(div.name===state.activeTeam.division)return;
    html+='<div class="div-header">'+div.name+'</div><table class="standings-table"><thead><tr><th>Team</th><th>W</th><th>L</th><th>PCT</th><th>GB</th></tr></thead><tbody>';
    div.teams.forEach(function(t){var isActive=t.team.id===state.activeTeam.id;html+='<tr class="'+(isActive?'active-row':'')+'"><td><strong>'+t.team.teamName+'</strong></td><td>'+t.wins+'</td><td>'+t.losses+'</td><td>'+t.winningPercentage+'</td><td>'+t.gamesBack+'</td></tr>';});
    html+='</tbody></table>';
  });
  document.getElementById('fullStandings').innerHTML=html;
}

function renderHomeStandings(divMap){
  var f=Object.values(divMap).find(function(d){return d.name===state.activeTeam.division;});
  if(!f){document.getElementById('homeStandings').innerHTML='<div class="error">No data</div>';return;}
  var html='<table class="standings-table"><thead><tr><th>Team</th><th>W</th><th>L</th><th>GB</th></tr></thead><tbody>';
  f.teams.forEach(function(t){var isActive=t.team.id===state.activeTeam.id;html+='<tr class="'+(isActive?'active-row':'')+'"><td><strong>'+t.team.teamName+'</strong></td><td>'+t.wins+'</td><td>'+t.losses+'</td><td>'+t.gamesBack+'</td></tr>';});
  document.getElementById('homeStandings').innerHTML=html+'</tbody></table>';
}

// ── STATS/ROSTER SECTION ────────────────────────────────────────────────────
export function selectLeaderPill(group,stat,btn){
  var ids=group==='hitting'?['hitLeaderPills','hitLeaderPillsExtras']:['pitLeaderPills','pitLeaderPillsExtras'];
  ids.forEach(function(id){var el=document.getElementById(id);if(el)el.querySelectorAll('.leader-pill').forEach(function(b){b.classList.remove('active');});});
  btn.classList.add('active');
  loadLeaders();
}

// Center an active tab inside its horizontally-scrolling container. Only scrolls
// when the container actually overflows, so it's a no-op on desktop where tabs
// fit on one row.
function scrollTabIntoView(btn){
  if(!btn||!btn.parentElement)return;
  var p=btn.parentElement;
  if(p.scrollWidth<=p.clientWidth)return;
  var tgt=btn.offsetLeft-(p.clientWidth-btn.offsetWidth)/2;
  p.scrollTo({left:Math.max(0,tgt),behavior:'smooth'});
}

export function switchLeaderTab(tab,btn){
  state.currentLeaderTab=tab;
  document.querySelectorAll('.stat-tabs button').forEach(function(b){b.classList.remove('active');});
  btn.classList.add('active');
  scrollTabIntoView(btn);
  document.getElementById('hitLeaderPills').style.display=tab==='hitting'?'flex':'none';
  document.getElementById('pitLeaderPills').style.display=tab==='pitching'?'flex':'none';
  // Collapse BOTH extras rows + reset "+ more" pills when switching tabs.
  ['hitLeaderPillsExtras','pitLeaderPillsExtras'].forEach(function(id){
    var el=document.getElementById(id);
    if(el)el.setAttribute('hidden','');
  });
  document.querySelectorAll('.leader-pill--more').forEach(function(b){
    b.classList.remove('open');
    b.setAttribute('aria-expanded','false');
    b.textContent='+ more';
  });
  loadLeaders();
}

// Qualified-leader thresholds (per Idea #05, Sprint 1):
//   Hitters: PA ≥ 3.1 × team games played
//   Pitchers: IP ≥ 1.0 × team games played
// Pulled from state.teamStats.{hitting,pitching}.gamesPlayed when available.
function teamGamesFor(group){
  var ts=state.teamStats||{};
  var src=group==='pitching'?ts.pitching:ts.hitting;
  if(!src)return 0;
  var g=parseInt(src.gamesPlayed,10);
  return isNaN(g)?0:g;
}

function isQualified(group, stat){
  var g=teamGamesFor(group);
  if(!g)return true; // unknown → don't filter
  if(group==='hitting'){
    var pa=parseFloat(stat.plateAppearances);
    return !isNaN(pa) && pa >= 3.1 * g;
  }
  if(group==='pitching'){
    var ip=parseFloat(stat.inningsPitched);
    return !isNaN(ip) && ip >= 1.0 * g;
  }
  return true;
}

export function loadLeaders(){
  var group=state.currentLeaderTab;
  var rowSel=group==='hitting'?'#hitLeaderPills, #hitLeaderPillsExtras':'#pitLeaderPills, #pitLeaderPillsExtras';
  var activePill=document.querySelector(rowSel.split(',').map(function(s){return s.trim()+' .leader-pill.active';}).join(','));
  var stat=activePill?activePill.dataset.stat:(group==='hitting'?'avg':'era');
  var data=state.statsCache[group];
  if(!data||!data.length){document.getElementById('leaderList').innerHTML='<div style="color:var(--muted);padding:12px;font-size:.85rem">Stats still loading...</div>';return;}
  var isAsc=['era','whip','walksAndHitsPerInningPitched','walksPer9Inn','losses'].indexOf(stat)>-1;
  // Pre-filter: stat must have a value at all
  var withStat=data.filter(function(s){return s.stat[stat]!=null&&s.stat[stat]!=='';});
  // Apply qualified filter (default ON per kickoff Q4)
  var qualified=state.qualifiedOnly?withStat.filter(function(s){return isQualified(group,s.stat);}):withStat;
  var hiddenCount=withStat.length-qualified.length;
  var sorted=qualified.slice().sort(function(a,b){return isAsc?parseFloat(a.stat[stat])-parseFloat(b.stat[stat]):parseFloat(b.stat[stat])-parseFloat(a.stat[stat]);}).slice(0,10);
  if(!sorted.length){
    var emptyMsg=hiddenCount>0
      ? hiddenCount+' player(s) hidden by qualified filter — toggle off to show'
      : 'No data for this stat yet';
    document.getElementById('leaderList').innerHTML='<div style="color:var(--muted);padding:12px;font-size:.85rem">'+emptyMsg+'</div>';
    return;
  }
  var html='';
  sorted.forEach(function(s,i){
    var val=parseFloat(s.stat[stat]),display=val<1&&val>0?val.toFixed(3).slice(1):Number.isInteger(val)?val:val.toFixed(2);
    var badge=group==='hitting'?hotColdBadge(s.player.id):'';
    html+='<div class="player-item" onclick="selectPlayer('+s.player.id+',\''+group+'\')">'+
      '<div style="display:flex;align-items:center;gap:10px">'+
        '<span style="color:var(--accent);font-weight:800;width:18px;font-size:.85rem">'+(i+1)+'</span>'+
        '<div>'+
          '<div class="player-name" style="font-size:.85rem">'+(s.player.fullName||'—')+badge+'</div>'+
        '</div>'+
      '</div>'+
      '<div style="font-size:1.1rem;font-weight:800;color:var(--accent)">'+display+'</div>'+
    '</div>';
  });
  if(state.qualifiedOnly && hiddenCount>0){
    html+='<div class="leader-qual-footer">⚠ '+hiddenCount+' player'+(hiddenCount===1?'':'s')+' hidden · toggle off to show small samples</div>';
  }
  document.getElementById('leaderList').innerHTML=html;
}

// Show / hide the "+ more" overflow pill row for a leader group. Adds an
// 'open' class to the trigger so CSS can flip the dashed border to solid.
export function toggleLeaderMore(group,btn){
  var extrasId=group==='hitting'?'hitLeaderPillsExtras':'pitLeaderPillsExtras';
  var el=document.getElementById(extrasId);
  if(!el)return;
  var isOpen=!el.hasAttribute('hidden');
  if(isOpen){el.setAttribute('hidden','');btn.classList.remove('open');btn.setAttribute('aria-expanded','false');btn.textContent='+ more';}
  else{el.removeAttribute('hidden');btn.classList.add('open');btn.setAttribute('aria-expanded','true');btn.textContent='− less';}
}

// Toggle the qualified-only filter. Persisted to localStorage.
export function toggleQualifiedOnly(){
  state.qualifiedOnly=!state.qualifiedOnly;
  if(typeof localStorage!=='undefined')localStorage.setItem('mlb_stats_qualified_only',state.qualifiedOnly?'1':'0');
  // Re-paint toggle UI + leaders
  var sw=document.getElementById('qualifiedToggle');
  if(sw)sw.setAttribute('aria-checked',state.qualifiedOnly?'true':'false');
  if(sw)sw.classList.toggle('on',state.qualifiedOnly);
  loadLeaders();
}

// ── Team Stats card (Stats tab v2 — Sprint 1 #06) ──────────────────────────
// Loads team-level totals + L10 form line for the Team Stats card above the
// .grid3. Cached for 5 min per team; in-flight dedupe protects against double-
// fetch on rapid nav. Honors kickoff Q2: L10 stat aggregates use the
// /teams/{id}/stats?stats=lastXGames endpoint. The W-L · streak · run-diff
// form line uses /standings (already fetched elsewhere; cheap and canonical).
export async function loadTeamStats(){
  var stripEl=document.getElementById('teamStatsStrip');
  var formEl=document.getElementById('teamFormLine');
  var titleEl=document.getElementById('teamStatsTitle');
  if(!stripEl)return;
  titleEl.textContent=SEASON+' '+state.activeTeam.short+' · Team Stats';
  var FRESH_MS=300000;
  var teamId=state.activeTeam.id;
  if(state.teamStats.teamId===teamId&&Date.now()-state.teamStatsFetchedAt<FRESH_MS){renderTeamStats();return;}
  if(state.teamStatsInflight)return state.teamStatsInflight;
  stripEl.innerHTML='<div class="loading">Loading team stats...</div>';
  if(formEl)formEl.innerHTML='';
  state.teamStatsInflight=(async function(){
    try{
      // Last-25-day window for the L10-run-diff calc (v4.6.23 — the standings
      // endpoint only returns season-aggregate runDifferential, which was being
      // rendered next to "Last 10:" and read as a last-10 figure).
      var todayStr=etDateStr();
      var fromStr=etDatePlus(todayStr,-25);
      var schedReq=fetch(MLB_BASE+'/schedule?teamId='+teamId+'&startDate='+fromStr+'&endDate='+todayStr+'&hydrate=linescore&sportId=1');
      var seasonReq=fetch(MLB_BASE+'/teams/'+teamId+'/stats?group=hitting,pitching,fielding&stats=season&season='+SEASON);
      var l10Req=fetch(MLB_BASE+'/teams/'+teamId+'/stats?group=hitting,pitching&stats=lastXGames&limitGames=10&season='+SEASON);
      var standingsReq=fetch(MLB_BASE+'/standings?leagueId=103,104&season='+SEASON);
      var rankReq=fetchTeamRanks();
      var [seasonRes,l10Res,standingsRes,schedRes]=await Promise.all([seasonReq,l10Req,standingsReq,schedReq]);
      await rankReq;
      var seasonData=seasonRes&&seasonRes.ok?await seasonRes.json():null;
      var l10Data=l10Res&&l10Res.ok?await l10Res.json():null;
      var standingsData=standingsRes&&standingsRes.ok?await standingsRes.json():null;
      var schedData=schedRes&&schedRes.ok?await schedRes.json():null;
      state.teamStats.hitting=extractTeamStat(seasonData,'hitting');
      state.teamStats.pitching=extractTeamStat(seasonData,'pitching');
      state.teamStats.fielding=extractTeamStat(seasonData,'fielding');
      state.teamStats.l10Hitting=extractTeamStat(l10Data,'hitting');
      state.teamStats.l10Pitching=extractTeamStat(l10Data,'pitching');
      state.teamStats.standingsRecord=extractTeamRecord(standingsData,teamId);
      state.teamStats.last10RunDiff=computeLast10RunDiff(schedData,teamId);
      state.teamStats.teamId=teamId;
      state.teamStatsFetchedAt=Date.now();
      renderTeamStats();
    }catch(e){
      if(stripEl)stripEl.innerHTML='<div class="error">Could not load team stats</div>';
    }finally{
      state.teamStatsInflight=null;
    }
  })();
  return state.teamStatsInflight;
}

function extractTeamStat(payload,group){
  if(!payload||!payload.stats)return null;
  var blk=payload.stats.find(function(s){return s.group&&s.group.displayName&&s.group.displayName.toLowerCase()===group;});
  if(!blk||!blk.splits||!blk.splits.length)return null;
  return blk.splits[0].stat;
}

// Aggregates run differential from the last 10 Final games for the active
// team. Pulled from the schedule+linescore window fetched in loadTeamStats.
// Returns null when there aren't enough completed games (e.g. early season,
// April rainouts) — the form-line renderer omits the chip in that case rather
// than misleading with a partial sum.
function computeLast10RunDiff(schedPayload,teamId){
  if(!schedPayload||!schedPayload.dates)return null;
  var games=[];
  schedPayload.dates.forEach(function(d){(d.games||[]).forEach(function(g){games.push(g);});});
  // Final only, newest first
  var finals=games.filter(function(g){
    return g.status&&g.status.abstractGameState==='Final'
      &&g.linescore&&g.linescore.teams
      &&g.linescore.teams.home&&g.linescore.teams.away;
  }).sort(function(a,b){return new Date(b.gameDate)-new Date(a.gameDate);});
  if(!finals.length)return null;
  var slice=finals.slice(0,10);
  var diff=0,counted=0;
  slice.forEach(function(g){
    var home=g.teams&&g.teams.home,away=g.teams&&g.teams.away;
    var ls=g.linescore.teams;
    var homeR=parseInt(ls.home.runs,10),awayR=parseInt(ls.away.runs,10);
    if(isNaN(homeR)||isNaN(awayR))return;
    if(home&&home.team&&home.team.id===teamId){diff+=(homeR-awayR);counted++;}
    else if(away&&away.team&&away.team.id===teamId){diff+=(awayR-homeR);counted++;}
  });
  return counted>0?diff:null;
}

function extractTeamRecord(standingsData,teamId){
  if(!standingsData||!standingsData.records)return null;
  for(var i=0;i<standingsData.records.length;i++){
    var teams=standingsData.records[i].teamRecords||[];
    for(var j=0;j<teams.length;j++){
      if(teams[j].team&&teams[j].team.id===teamId){
        var split=(teams[j].records&&teams[j].records.splitRecords||[]).find(function(s){return s.type==='lastTen';});
        return{
          lastTen:split?(split.wins+'-'+split.losses):'',
          lastTenWins:split?split.wins:0,
          lastTenLosses:split?split.losses:0,
          streak:teams[j].streak?teams[j].streak.streakCode:'',
          runDiff:typeof teams[j].runDifferential!=='undefined'?teams[j].runDifferential:null
        };
      }
    }
  }
  return null;
}

// Fetch byTeam league ranks for the headline categories shown in the Team Stats
// tiles. Stores in state.teamStats.ranks keyed `${group}:${leaderCategory}`.
async function fetchTeamRanks(){
  var groups=[
    {group:'hitting', cats:['battingAverage','homeRuns','onBasePlusSlugging','runs']},
    {group:'pitching',cats:['earnedRunAverage','walksAndHitsPerInningPitched','strikeouts','saves']},
    {group:'fielding',cats:['fieldingPercentage','errors']}
  ];
  var teamId=state.activeTeam.id;
  state.teamStats.ranks={};
  await Promise.all(groups.map(async function(g){
    try{
      var url=MLB_BASE+'/stats/leaders?leaderCategories='+g.cats.join(',')+'&statGroup='+g.group+'&statsType=byTeam&season='+SEASON+'&limit=30';
      var r=await fetch(url);
      if(!r.ok)return;
      var d=await r.json();
      (d.leagueLeaders||[]).forEach(function(blk){
        var leaders=blk.leaders||[];
        var idx=leaders.findIndex(function(l){return l.team&&l.team.id===teamId;});
        state.teamStats.ranks[g.group+':'+blk.leaderCategory]={
          rank:idx>=0?(idx+1):null,
          total:leaders.length||30
        };
      });
    }catch(e){/* silent — tile renders without rank */}
  }));
}

function renderTeamStats(){
  var stripEl=document.getElementById('teamStatsStrip');
  var formEl=document.getElementById('teamFormLine');
  if(!stripEl)return;
  var ts=state.teamStats;
  var ranks=ts.ranks||{};
  function rk(group,cat){var r=ranks[group+':'+cat];return (r&&r.rank)?' <span class="rk">#'+r.rank+'</span>':'';}
  function headRk(group,cat){var r=ranks[group+':'+cat];return (r&&r.rank)?'<span class="team-stat-tile-rank">#'+r.rank+' MLB</span>':'';}
  var html='';
  if(ts.hitting){
    var h=ts.hitting;
    html+='<div class="team-stat-tile"><div class="team-stat-tile-head"><span>⚾ Hitting</span>'+headRk('hitting','onBasePlusSlugging')+'</div>'+
      '<div class="team-stat-tile-grid">'+
      '<div class="team-stat-tile-stat"><div class="v">'+fmtRate(h.avg)+'</div><div class="l">AVG'+rk('hitting','battingAverage')+'</div></div>'+
      '<div class="team-stat-tile-stat"><div class="v">'+(h.homeRuns||0)+'</div><div class="l">HR'+rk('hitting','homeRuns')+'</div></div>'+
      '<div class="team-stat-tile-stat"><div class="v">'+fmtRate(h.ops)+'</div><div class="l">OPS'+rk('hitting','onBasePlusSlugging')+'</div></div>'+
      '<div class="team-stat-tile-stat"><div class="v">'+(h.runs||0)+'</div><div class="l">R'+rk('hitting','runs')+'</div></div>'+
      '</div></div>';
  }
  if(ts.pitching){
    var p=ts.pitching;
    html+='<div class="team-stat-tile"><div class="team-stat-tile-head"><span>🥎 Pitching</span>'+headRk('pitching','earnedRunAverage')+'</div>'+
      '<div class="team-stat-tile-grid">'+
      '<div class="team-stat-tile-stat"><div class="v">'+fmt(p.era,2)+'</div><div class="l">ERA'+rk('pitching','earnedRunAverage')+'</div></div>'+
      '<div class="team-stat-tile-stat"><div class="v">'+fmt(p.whip,2)+'</div><div class="l">WHIP'+rk('pitching','walksAndHitsPerInningPitched')+'</div></div>'+
      '<div class="team-stat-tile-stat"><div class="v">'+(p.strikeOuts||0)+'</div><div class="l">K'+rk('pitching','strikeouts')+'</div></div>'+
      '<div class="team-stat-tile-stat"><div class="v">'+(p.saves||0)+'</div><div class="l">SV'+rk('pitching','saves')+'</div></div>'+
      '</div></div>';
  }
  if(ts.fielding){
    var f=ts.fielding;
    html+='<div class="team-stat-tile"><div class="team-stat-tile-head"><span>🧤 Fielding</span>'+headRk('fielding','fieldingPercentage')+'</div>'+
      '<div class="team-stat-tile-grid">'+
      '<div class="team-stat-tile-stat"><div class="v">'+fmtRate(f.fielding)+'</div><div class="l">FPCT'+rk('fielding','fieldingPercentage')+'</div></div>'+
      '<div class="team-stat-tile-stat"><div class="v">'+(f.errors||0)+'</div><div class="l">E'+rk('fielding','errors')+'</div></div>'+
      '<div class="team-stat-tile-stat"><div class="v">'+(f.doublePlays||0)+'</div><div class="l">DP</div></div>'+
      '<div class="team-stat-tile-stat"><div class="v">'+(f.assists||0)+'</div><div class="l">A</div></div>'+
      '</div></div>';
  }
  if(!html)html='<div class="empty-state" style="grid-column:1/-1">No team stats available</div>';
  stripEl.innerHTML=html;
  if(!formEl)return;
  var rec=ts.standingsRecord;
  if(rec&&rec.lastTen){
    var streakUp=rec.streak&&rec.streak.charAt(0)==='W';
    // Use last-10 run diff (computed from schedule+linescore) — the standings
    // endpoint's runDifferential is season-aggregate and was misread next to
    // "Last 10:". Fall back to omitting the chip when L10 diff isn't computable
    // rather than mixing scopes.
    var rd=ts.last10RunDiff;
    var rdStr=rd==null?'':' · run diff '+(rd>=0?'+':'')+rd;
    // v4.6.24: color the form line by L10 wins, not the current streak. A 9-1
    // team that lost last night should still read green; a 1-9 team that won
    // last night shouldn't suddenly look hot. Threshold: >5 warm, =5 neutral,
    // <5 cold.
    var l10w=rec.lastTenWins||0;
    var formClass=l10w>5?'':(l10w===5?' neutral':' cold');
    formEl.className='team-form-line'+formClass;
    formEl.innerHTML='<div><b style="color:#fff;">Last 10:</b> '+rec.lastTen+(rec.streak?' · '+(streakUp?'▲ ':'▼ ')+rec.streak:'')+rdStr+'</div><div class="form-meta">Form</div>';
  }else{
    formEl.className='team-form-line empty';
    formEl.innerHTML='<div>L10 form not yet available</div><div class="form-meta">Form</div>';
  }
}

// Fetch and cache league-wide leader rankings for one stat group (hitting or
// pitching). All categories registered for that group in
// LEADER_CATS_FOR_PERCENTILE are pulled in a single MLB API call. Result is
// stored sorted (best→worst polarity-aware) in state.leagueLeaders, then read
// by computePercentile() in src/utils/stats-math.js. 5-minute TTL per group;
// in-flight Promise dedupe protects against double-fetch on rapid nav.
export async function fetchLeagueLeaders(group){
  if(!group)return;
  var FRESH_MS=300000;
  if(state.leagueLeadersInflight[group])return state.leagueLeadersInflight[group];
  if(state.leagueLeadersFetchedAt[group]&&Date.now()-state.leagueLeadersFetchedAt[group]<FRESH_MS)return;
  var entries=LEADER_CATS_FOR_PERCENTILE.filter(function(e){return e.group===group;});
  if(!entries.length)return;
  // v4.8.4: switched from /stats/leaders to /stats. The leader-board endpoint
  // server-caps the per-category pool at ~100 entries even with limit=300, so
  // the percentile denominator (`#X of 100 MLB`) misrepresented the true
  // qualified cohort and any qualified-but-bottom-of-the-pack hitter showed up
  // as rank "100 of 100". /stats?stats=season&playerPool=Qualifier returns the
  // entire qualified pool in one shot — typically 150-250 mid-to-late season —
  // and we sort + slice top-300 per category client-side.
  var url=MLB_BASE+'/stats?stats=season&group='+group+'&season='+SEASON+'&gameType=R&playerPool=Qualifier&sportId=1&limit=2000';
  var p=(async function(){
    try{
      var r=await fetch(url);
      var d=await r.json();
      var splits=(d.stats&&d.stats[0]&&d.stats[0].splits)||[];
      // Build a per-category leader array by sorting the qualified pool
      // client-side. Multiple entries can share a leaderCategory across the
      // hitting/pitching split (e.g. 'walks'); within a single group call the
      // entries list is already group-scoped, so each leaderCategory key is
      // assigned exactly once.
      entries.forEach(function(entry){
        var rows=splits.map(function(sp){
          var raw=sp.stat?sp.stat[entry.key]:null;
          var v=raw==null||raw===''?NaN:parseFloat(raw);
          if(isNaN(v))return null;
          return{
            playerId:sp.player&&sp.player.id,
            playerName:sp.player&&sp.player.fullName,
            teamId:sp.team&&sp.team.id,
            teamAbbr:sp.team&&(sp.team.abbreviation||sp.team.name),
            value:v,
            rank:null
          };
        }).filter(function(x){return x!==null;});
        rows.sort(function(a,b){return entry.lowerIsBetter?a.value-b.value:b.value-a.value;});
        if(rows.length>300)rows=rows.slice(0,300);
        rows.forEach(function(l,i){l.rank=i+1;});
        state.leagueLeaders[group+':'+entry.leaderCategory]=rows;
      });
      state.leagueLeadersFetchedAt[group]=Date.now();
    }catch(e){/* silent: percentile UI will simply not render */}
    finally{delete state.leagueLeadersInflight[group];}
  })();
  state.leagueLeadersInflight[group]=p;
  return p;
}

async function fetchAllPlayerStats(){
  var groups=['hitting','pitching'];
  for(var gi=0;gi<groups.length;gi++){
    var group=groups[gi],players=group==='hitting'?state.rosterData.hitting:state.rosterData.pitching;if(!players.length)continue;
    var results=await Promise.all(players.map(async function(p){try{var r=await fetch(MLB_BASE+'/people/'+p.person.id+'/stats?stats=season&season='+SEASON+'&group='+group);var d=await r.json();var stat=d.stats&&d.stats[0]&&d.stats[0].splits&&d.stats[0].splits[0]&&d.stats[0].splits[0].stat;if(!stat)return null;return{player:p.person,position:p.position,stat:stat};}catch(e){return null;}}));
    state.statsCache[group]=results.filter(function(x){return x!==null;});
  }
  loadLeaders();
  // Kick off last-15 fetches for HOT/COLD badges. Don't await — re-renders
  // happen as data lands.
  fetchLastNForRoster();
}

// HOT / COLD threshold: last-15 OPS Δ vs season OPS. ±0.080 per Idea #03.
const HOT_COLD_THRESHOLD = 0.080;
const HOT_COLD_TTL_MS = 12 * 60 * 60 * 1000;

// Pulls last-15-games hitting stats for a single player. 12h TTL on
// state.lastNCache so we don't re-fetch within a session. Pitchers are
// excluded — HOT/COLD is an offensive concept tied to OPS.
async function fetchLastN(playerId, n){
  n = n || 15;
  var existing = state.lastNCache[playerId];
  if(existing && Date.now() - existing.ts < HOT_COLD_TTL_MS) return existing;
  try{
    var r = await fetch(MLB_BASE+'/people/'+playerId+'/stats?stats=lastXGames&group=hitting&season='+SEASON+'&gameNumber='+n);
    var d = await r.json();
    var stat = d.stats && d.stats[0] && d.stats[0].splits && d.stats[0].splits[0] && d.stats[0].splits[0].stat;
    if(stat){ state.lastNCache[playerId] = { last15: stat, ts: Date.now() }; return state.lastNCache[playerId]; }
  }catch(e){}
  return null;
}

// Batched fetch for every hitter in the active roster. After resolution, kick
// off a re-render so the badges appear without user interaction.
async function fetchLastNForRoster(){
  var hitters = state.rosterData.hitting || [];
  if(!hitters.length) return;
  await Promise.all(hitters.map(function(p){ return fetchLastN(p.person.id, 15); }));
  if(state.currentLeaderTab === 'hitting') loadLeaders();
  if(state.currentRosterTab === 'hitting') renderPlayerList();
}

// Returns inline HOT/COLD badge HTML for a player, or '' if no signal.
function hotColdBadge(playerId){
  var cached = state.lastNCache[playerId];
  if(!cached || !cached.last15) return '';
  var seasonEntry = (state.statsCache.hitting || []).find(function(p){ return p.player && p.player.id === playerId; });
  if(!seasonEntry || !seasonEntry.stat) return '';
  var l15 = parseFloat(cached.last15.ops);
  var sea = parseFloat(seasonEntry.stat.ops);
  if(isNaN(l15) || isNaN(sea)) return '';
  var delta = l15 - sea;
  var fmtO = function(n){ var s = n.toFixed(3); return s.charAt(0)==='0'?s.slice(1):s; };
  var tip = 'Last 15 OPS '+fmtO(l15)+' vs season '+fmtO(sea);
  if(delta >= HOT_COLD_THRESHOLD) return ' <span class="story-badge hot stats-hot-cold" title="'+tip+'">🔥 HOT</span>';
  if(delta <= -HOT_COLD_THRESHOLD) return ' <span class="story-badge cold stats-hot-cold" title="'+tip+'">❄ COLD</span>';
  return '';
}

export async function loadRoster(){
  document.getElementById('playerList').innerHTML='<div class="loading">Loading players...</div>';
  document.getElementById('rosterTitle').textContent=SEASON+' '+state.activeTeam.short+' Players';
  try{
    var r=await fetch(MLB_BASE+'/teams/'+state.activeTeam.id+'/roster?rosterType=40Man&season='+SEASON+'&hydrate=person');
    var d=await r.json(),roster=d.roster||[];
    // Two-way players (TWP) like Ohtani belong in BOTH lists — they qualify
    // as both hitters and pitchers, so they should appear in both Leaders
    // boards + Roster groups + Today's Leaders. Pure pitchers ('P') are
    // hitting-excluded only; pure position players ('1B','OF',etc.) are
    // pitching-excluded.
    state.rosterData.hitting=roster.filter(function(p){return p.position&&p.position.abbreviation!=='P';});
    state.rosterData.pitching=roster.filter(function(p){return p.position&&(p.position.abbreviation==='P'||p.position.abbreviation==='TWP');});
    state.rosterData.fielding=state.rosterData.hitting.slice();renderPlayerList();fetchAllPlayerStats();
    if(state.rosterData.hitting.length)selectPlayer(state.rosterData.hitting[0].person.id,'hitting');
  }catch(e){document.getElementById('playerList').innerHTML='<div class="error">Could not load players</div>';}
}

// Position bucketing for Roster grouping. Catchers / Infielders / Outfielders
// / DH for hitters and fielders; Starters vs Relievers for pitchers (split by
// games-started ratio in statsCache when available, falls back to a single
// "Pitchers" bucket otherwise).
function rosterBucketKey(player, tab){
  if(tab==='pitching'){
    var entry=(state.statsCache.pitching||[]).find(function(p){return p.player&&p.player.id===player.person.id;});
    if(entry&&entry.stat){
      var gs=parseInt(entry.stat.gamesStarted,10)||0;
      var gp=parseInt(entry.stat.gamesPlayed,10)||0;
      if(gs>=3 || (gp>0 && gs/gp >= 0.5)) return 'SP';
      return 'RP';
    }
    return 'P';
  }
  var abbr=player.position&&player.position.abbreviation||'';
  if(abbr==='C') return 'C';
  if(abbr==='1B'||abbr==='2B'||abbr==='3B'||abbr==='SS'||abbr==='IF') return 'IF';
  if(abbr==='LF'||abbr==='CF'||abbr==='RF'||abbr==='OF') return 'OF';
  if(abbr==='DH') return 'DH';
  return 'OTH';
}

const ROSTER_BUCKET_ORDER = {
  hitting:  ['C','IF','OF','DH','OTH'],
  fielding: ['C','IF','OF','DH','OTH'],
  pitching: ['SP','RP','P']
};
const ROSTER_BUCKET_LABEL = {
  C:  '🧤 Catchers',
  IF: '⚾ Infielders',
  OF: '🏃 Outfielders',
  DH: '🦾 DH',
  SP: '🎯 Starters',
  RP: '🔥 Relievers',
  P:  '🥎 Pitchers',
  OTH:'➖ Other'
};

// Returns { display, raw } for the inline-stat preview under each roster name,
// keyed off the active leader pill so the Roster column reflects the current
// stat focus. Falls back to OPS/ERA when no pill is active.
function rosterInlineStatFor(player, tab){
  var group=tab==='fielding'?'hitting':tab; // fielding tab still surfaces hitting line
  var pool=state.statsCache[group]||[];
  var entry=pool.find(function(p){return p.player&&p.player.id===player.person.id;});
  if(!entry||!entry.stat)return null;
  var s=entry.stat;
  if(group==='hitting'){
    return{
      display:fmtRate(s.avg)+' / '+(s.homeRuns||0)+' HR / '+fmtRate(s.ops)+' OPS',
      raw:parseFloat(s.ops)
    };
  }
  return{
    display:fmt(s.era,2)+' ERA · '+(s.strikeOuts||0)+' K · '+fmt(s.whip,2)+' WHIP',
    raw:parseFloat(s.era)
  };
}

// Team-best raw value for the inline mini-bar denominator. OPS for hitting
// (higher = better), ERA for pitching (lower = better — bar widths are
// inverted in the renderer).
function rosterTeamBest(group){
  var pool=state.statsCache[group]||[];
  if(!pool.length)return null;
  var key=group==='pitching'?'era':'ops';
  var values=pool.map(function(p){return p.stat?parseFloat(p.stat[key]):NaN;}).filter(function(v){return !isNaN(v);});
  if(!values.length)return null;
  return group==='pitching'?Math.min.apply(null,values):Math.max.apply(null,values);
}

function renderPlayerList(){
  var tab=state.currentRosterTab;
  var players=state.rosterData[tab]||[];
  if(!players.length){document.getElementById('playerList').innerHTML='<div class="loading">No players found</div>';return;}
  var showBadges=tab==='hitting';
  var statGroup=tab==='fielding'?'hitting':tab;
  var teamBest=rosterTeamBest(statGroup);
  // Bucket players by position
  var buckets={};
  players.forEach(function(p){
    var k=rosterBucketKey(p,tab);
    (buckets[k]=buckets[k]||[]).push(p);
  });
  var order=ROSTER_BUCKET_ORDER[tab]||['OTH'];
  var html='';
  order.forEach(function(key){
    var list=buckets[key];
    if(!list||!list.length)return;
    html+='<div class="roster-section-header">'+(ROSTER_BUCKET_LABEL[key]||key)+' <span class="roster-section-count">'+list.length+'</span></div>';
    list.forEach(function(p){
      var sel=state.selectedPlayer&&state.selectedPlayer.person&&state.selectedPlayer.person.id===p.person.id;
      var badge=showBadges?hotColdBadge(p.person.id):'';
      var inline=rosterInlineStatFor(p,tab);
      var barW=0;
      if(inline && teamBest){
        if(statGroup==='pitching') barW = isFinite(teamBest/inline.raw) ? Math.min(100,Math.max(8,(teamBest/inline.raw)*100)) : 0;
        else barW = isFinite(inline.raw/teamBest) ? Math.min(100,Math.max(8,(inline.raw/teamBest)*100)) : 0;
      }
      html+='<div class="player-item'+(sel?' selected':'')+'" onclick="selectPlayer('+p.person.id+',\''+tab+'\')">'+
        '<div class="roster-row-main">'+
          '<div class="player-name">'+p.person.fullName+badge+'</div>'+
          '<div class="player-pos">#'+(p.jerseyNumber||'—')+' · '+(p.position&&p.position.name?p.position.name:'—')+
            (inline?' · <span class="roster-inline-stat">'+inline.display+'</span>':'')+
          '</div>'+
          (barW?'<div class="roster-mini-bar"><i style="width:'+barW.toFixed(0)+'%"></i></div>':'')+
        '</div>'+
        '<span class="player-chevron">›</span>'+
      '</div>';
    });
  });
  document.getElementById('playerList').innerHTML=html;
}

export function switchRosterTab(tab,btn){state.currentRosterTab=tab;state.selectedPlayer=null;document.querySelectorAll('.stat-tab').forEach(function(b){b.classList.remove('active');});btn.classList.add('active');scrollTabIntoView(btn);var players=state.rosterData[tab]||[];if(players.length)selectPlayer(players[0].person.id,tab);else{renderPlayerList();document.getElementById('playerStatsTitle').textContent='Player Stats';document.getElementById('playerStats').innerHTML='<div class="empty-state">No players available</div>';}}

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

// ── Sprint 3 / Step 6: Compare overlay (head-to-head player view) ────────
// Same-team comparison v1: pick another player from the active team's roster
// in the same group (hitting/pitching). Re-uses state.statsCache season stats
// — no extra fetches when both players are already in cache (the common case
// since fetchAllPlayerStats warms the entire roster on Stats first-load).
//
// Stat catalog: same boxes as renderOverviewTab so users see consistent
// comparison rows. Polarity-aware winner detection respects ERA/WHIP/etc.
// being lower-better.

function compareBoxesFor(group){
  // Subset of the Player Stats grid stats — winner-shown rows.
  if(group==='hitting') return [
    {l:'AVG', k:'avg',          fmt:'rate'},
    {l:'OBP', k:'obp',          fmt:'rate'},
    {l:'SLG', k:'slg',          fmt:'rate'},
    {l:'OPS', k:'ops',          fmt:'rate'},
    {l:'HR',  k:'homeRuns',     fmt:'int'},
    {l:'RBI', k:'rbi',          fmt:'int'},
    {l:'H',   k:'hits',         fmt:'int'},
    {l:'2B',  k:'doubles',      fmt:'int'},
    {l:'3B',  k:'triples',      fmt:'int'},
    {l:'R',   k:'runs',         fmt:'int'},
    {l:'BB',  k:'baseOnBalls',  fmt:'int'},
    {l:'K',   k:'strikeOuts',   fmt:'int',  lowerBetter:true},
    {l:'SB',  k:'stolenBases',  fmt:'int'},
    {l:'PA',  k:'plateAppearances', fmt:'int', neutral:true}
  ];
  return [
    {l:'ERA',  k:'era',                fmt:'two', lowerBetter:true},
    {l:'WHIP', k:'whip',               fmt:'two', lowerBetter:true},
    {l:'K',    k:'strikeOuts',         fmt:'int'},
    {l:'W',    k:'wins',               fmt:'int'},
    {l:'L',    k:'losses',             fmt:'int', lowerBetter:true},
    {l:'SV',   k:'saves',              fmt:'int'},
    {l:'IP',   k:'inningsPitched',     fmt:'ip',  neutral:true},
    {l:'K/9',  k:'strikeoutsPer9Inn',  fmt:'two'},
    {l:'BB/9', k:'walksPer9Inn',       fmt:'two', lowerBetter:true},
    {l:'K/BB', k:'strikeoutWalkRatio', fmt:'two'},
    {l:'H',    k:'hits',               fmt:'int', lowerBetter:true},
    {l:'BB',   k:'baseOnBalls',        fmt:'int', lowerBetter:true},
    {l:'HR',   k:'homeRuns',           fmt:'int', lowerBetter:true}
  ];
}

function compareFmt(box, val){
  if(val==null||val==='')return '—';
  if(box.fmt==='rate'){
    var n=parseFloat(val); if(isNaN(n))return String(val); var s=n.toFixed(3); return s.charAt(0)==='0'?s.slice(1):s;
  }
  if(box.fmt==='two'){
    var n=parseFloat(val); if(isNaN(n))return String(val); return n.toFixed(2);
  }
  if(box.fmt==='ip'){ return String(val); }
  var n=parseInt(val,10); return isNaN(n)?String(val):String(n);
}

// Pulls a player's season stat from state.statsCache (same-team only — v1
// scope). Returns null when the active team's cache hasn't filled yet or the
// player isn't on this team.
function compareStatFor(playerId, group){
  var pool=state.statsCache[group]||[];
  var entry=pool.find(function(p){return p.player&&p.player.id===playerId;});
  return entry&&entry.stat?entry.stat:null;
}

export function openCompareOverlay(){
  if(!state.selectedPlayer)return;
  // Determine group from active roster tab (hitting / pitching). Fielding
  // collapses to hitting for compare since the stat catalog is the same.
  var group=state.currentRosterTab==='pitching'?'pitching':'hitting';
  state.compareGroup=group;
  state.compareA=state.selectedPlayer;
  // Default slot B = next player in the same group's roster (skip A)
  var pool=state.rosterData[group]||[];
  var aId=state.selectedPlayer.person&&state.selectedPlayer.person.id;
  var b=pool.find(function(p){return p.person&&p.person.id!==aId;});
  state.compareB=b||null;
  state.compareOpen=true;
  var ov=document.getElementById('compareOverlay');
  if(ov)ov.removeAttribute('hidden');
  document.body.style.overflow='hidden';
  renderCompare();
}

export function closeCompareOverlay(){
  state.compareOpen=false;
  var ov=document.getElementById('compareOverlay');
  if(ov)ov.setAttribute('hidden','');
  document.body.style.overflow='';
}

export function setCompareSlot(slot, playerId){
  var pool=state.rosterData[state.compareGroup]||[];
  var pid=parseInt(playerId,10);
  var p=pool.find(function(pl){return pl.person&&pl.person.id===pid;});
  if(!p)return;
  if(slot==='a')state.compareA=p;
  else state.compareB=p;
  renderCompare();
}

export function setCompareGroup(group){
  if(group!=='hitting'&&group!=='pitching')return;
  if(state.compareGroup===group)return;
  state.compareGroup=group;
  // Re-pick defaults from the new group when current slots are not in the new pool
  var pool=state.rosterData[group]||[];
  function inPool(pl){ return pl && pl.person && pool.some(function(p){return p.person&&p.person.id===pl.person.id;}); }
  if(!inPool(state.compareA)) state.compareA = pool[0] || null;
  if(!inPool(state.compareB)){
    var aId=state.compareA&&state.compareA.person&&state.compareA.person.id;
    state.compareB = pool.find(function(p){return p.person&&p.person.id!==aId;}) || null;
  }
  renderCompare();
}

function renderCompare(){
  var bodyEl=document.getElementById('compareBody');
  if(!bodyEl)return;
  var group=state.compareGroup;
  var a=state.compareA, b=state.compareB;
  // Group toggle (only available when the other group has roster entries)
  var hasHitters=(state.rosterData.hitting||[]).length>0;
  var hasPitchers=(state.rosterData.pitching||[]).length>0;
  var groupBar=(hasHitters&&hasPitchers)?
    '<div class="compare-group-bar">'+
      ['hitting','pitching'].map(function(g){
        return '<button type="button" class="compare-group-btn'+(group===g?' active':'')+'" onclick="setCompareGroup(\''+g+'\')">'+(g==='hitting'?'⚾ Hitting':'🥎 Pitching')+'</button>';
      }).join('')+
    '</div>' : '';

  // Player picker option list — exclude the "other" slot's player to avoid
  // selecting the same player on both sides.
  function pickerOptions(otherId, selectedId){
    var pool=state.rosterData[group]||[];
    return pool.filter(function(p){return p.person&&p.person.id!==otherId;}).map(function(p){
      var sel = p.person.id === selectedId ? ' selected' : '';
      return '<option value="'+p.person.id+'"'+sel+'>'+(p.person.fullName||'#'+p.person.id)+'</option>';
    }).join('');
  }
  function slotHeader(slot, player, otherPlayer){
    var pid=player&&player.person&&player.person.id;
    var pname=player&&player.person&&player.person.fullName||'—';
    var pos=player&&player.position&&player.position.abbreviation||'';
    var jersey=player&&player.jerseyNumber?'#'+player.jerseyNumber:'';
    var headshot=pid?'<img class="compare-headshot" src="https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/'+pid+'/headshot/67/current" alt="">' : '<div class="compare-headshot compare-headshot-empty">?</div>';
    var otherId=otherPlayer&&otherPlayer.person&&otherPlayer.person.id;
    return '<div class="compare-slot">'+
      headshot+
      '<div class="compare-slot-name">'+pname+'</div>'+
      '<div class="compare-slot-meta">'+(jersey?jersey+' · ':'')+pos+'</div>'+
      '<select class="compare-picker" onchange="setCompareSlot(\''+slot+'\', this.value)">'+
        pickerOptions(otherId, pid)+
      '</select>'+
    '</div>';
  }

  var aStat=a?compareStatFor(a.person.id, group):null;
  var bStat=b?compareStatFor(b.person.id, group):null;

  var head =
    '<div class="compare-pickers">'+
      slotHeader('a', a, b)+
      '<div class="compare-vs">vs</div>'+
      slotHeader('b', b, a)+
    '</div>';

  if(!a || !b){
    bodyEl.innerHTML = groupBar + head + '<div class="compare-empty">Pick a second player to compare.</div>';
    return;
  }
  if(!aStat || !bStat){
    bodyEl.innerHTML = groupBar + head + '<div class="compare-empty">'+
      (!aStat ? (a.person.fullName||'Player A') : '')+
      (!aStat && !bStat ? ' and ' : '')+
      (!bStat ? (b.person.fullName||'Player B') : '')+
      ' have no '+SEASON+' '+group+' stats yet.</div>';
    return;
  }

  var boxes=compareBoxesFor(group);
  var rows=boxes.map(function(box){
    var av=aStat[box.k], bv=bStat[box.k];
    var aDisp=compareFmt(box, av);
    var bDisp=compareFmt(box, bv);
    var aN=parseFloat(av), bN=parseFloat(bv);
    var aClass='', bClass='';
    if(!box.neutral && !isNaN(aN) && !isNaN(bN) && aN !== bN){
      var aWins = box.lowerBetter ? aN < bN : aN > bN;
      aClass = aWins ? ' compare-win' : ' compare-lose';
      bClass = aWins ? ' compare-lose' : ' compare-win';
    }
    return '<div class="compare-row">'+
      '<div class="compare-cell'+aClass+'">'+aDisp+'</div>'+
      '<div class="compare-label">'+box.l+'</div>'+
      '<div class="compare-cell'+bClass+'">'+bDisp+'</div>'+
    '</div>';
  }).join('');

  bodyEl.innerHTML = groupBar + head +
    '<div class="compare-grid">'+rows+'</div>'+
    '<div class="compare-foot">Same-team comparison · season totals · winner highlighted per row (lower is better for ERA / WHIP / BB-9 / counting losses).</div>';
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

// ── Sprint 3 / Step 2: Today's Leaders (MLB-wide) ────────────────────────
// Categories surfaced per group. leaderCategory strings MUST match the canonical
// names accepted by /stats/leaders (and used in LEADER_CATS_FOR_PERCENTILE) —
// "runsBattedIn" not "rbi", "onBasePlusSlugging" not "ops" (v4.6.19 fix).
const TODAYS_LEADERS_CATS = {
  hitting:  [
    { stat:'homeRuns',         leaderCategory:'homeRuns',                 label:'HR',  decimals:0 },
    { stat:'avg',              leaderCategory:'battingAverage',           label:'AVG', decimals:3 },
    { stat:'rbi',              leaderCategory:'runsBattedIn',             label:'RBI', decimals:0 },
    { stat:'ops',              leaderCategory:'onBasePlusSlugging',       label:'OPS', decimals:3 },
    { stat:'obp',              leaderCategory:'onBasePercentage',         label:'OBP', decimals:3 },
    { stat:'stolenBases',      leaderCategory:'stolenBases',              label:'SB',  decimals:0 }
  ],
  pitching: [
    { stat:'era',              leaderCategory:'earnedRunAverage',         label:'ERA',  decimals:2 },
    { stat:'strikeOuts',       leaderCategory:'strikeouts',               label:'K',    decimals:0 },
    { stat:'wins',             leaderCategory:'wins',                     label:'W',    decimals:0 },
    { stat:'saves',            leaderCategory:'saves',                    label:'SV',   decimals:0 },
    { stat:'whip',             leaderCategory:'walksAndHitsPerInningPitched', label:'WHIP', decimals:2 },
    { stat:'inningsPitched',   leaderCategory:'inningsPitched',           label:'IP',   decimals:1 }
  ]
};

// Mobile (≤480px) collapsed view shows only these 3 categories per group;
// keyed by leaderCategory so the lookup survives any reorder of the parent
// catalog. Desktop / iPad always render the full TODAYS_LEADERS_CATS list.
const TODAYS_LEADERS_MOBILE_TOP = {
  hitting:  ['homeRuns', 'battingAverage', 'onBasePlusSlugging'],
  pitching: ['earnedRunAverage', 'strikeouts', 'wins']
};

// Switch active tab on the Today's Leaders card. Persisted via state.
export function switchTodaysLeadersTab(tab, btn){
  if(tab !== 'hitting' && tab !== 'pitching') return;
  state.todaysLeadersTab = tab;
  document.querySelectorAll('#todaysLeadersTabs .stat-tab').forEach(function(b){ b.classList.toggle('active', b.dataset.tab===tab); });
  renderTodaysLeaders();
}

// Renders the four-category leader-board block from cached state.leagueLeaders.
// Triggers fetchLeagueLeaders for the active group when the cache is empty —
// the percentile system already calls this on selectPlayer, so the cache is
// usually warm by the time the user looks. First-paint warming is handled by
// loadTodaysLeaders().
export function renderTodaysLeaders(){
  var el = document.getElementById('todaysLeadersContent');
  if(!el) return;
  var group = state.todaysLeadersTab || 'hitting';
  var allCats = TODAYS_LEADERS_CATS[group] || [];
  var isMobile = (typeof window!=='undefined') && window.matchMedia && window.matchMedia('(max-width: 480px)').matches;
  var collapsedOnMobile = isMobile && !state.todaysLeadersExpanded;
  var mobileSet = TODAYS_LEADERS_MOBILE_TOP[group] || [];
  var cats = collapsedOnMobile
    ? allCats.filter(function(c){ return mobileSet.indexOf(c.leaderCategory) >= 0; })
    : allCats;
  function fmtVal(v, decimals){
    if(decimals >= 3){
      var s = v.toFixed(3);
      return s.charAt(0)==='0' ? s.slice(1) : s;
    }
    if(decimals === 1) return v.toFixed(1);
    if(decimals === 2) return v.toFixed(2);
    return Math.round(v).toString();
  }
  function lastName(full){
    if(!full) return '';
    var parts = full.split(' ');
    return parts.length > 1 ? parts.slice(1).join(' ') : full;
  }
  var html = '<div class="todays-leaders-grid">';
  cats.forEach(function(c){
    var arr = state.leagueLeaders[group+':'+c.leaderCategory];
    var top5 = arr ? arr.slice(0,5) : [];
    html += '<div class="tl-cat">'+
      '<div class="tl-cat-head"><span class="tl-cat-label">'+c.label+'</span></div>';
    if(top5.length){
      html += '<ol class="tl-cat-list">'+ top5.map(function(p, i){
        var name = p.playerName ? lastName(p.playerName) : '#'+p.playerId;
        var teamAbbr = p.teamAbbr || '';
        return '<li>'+
          '<span class="tl-rank">'+(i+1)+'</span>'+
          '<span class="tl-name" title="'+(p.playerName||'')+(teamAbbr?' · '+teamAbbr:'')+'">'+name+'</span>'+
          (teamAbbr ? '<span class="tl-team">'+teamAbbr+'</span>' : '')+
          '<span class="tl-val">'+fmtVal(p.value, c.decimals)+'</span>'+
        '</li>';
      }).join('') +'</ol>';
    } else {
      html += '<div class="tl-cat-empty">—</div>';
    }
    html += '</div>';
  });
  html += '</div>';
  // Mobile-only expand/collapse pill below the grid.
  if(isMobile && allCats.length > cats.length){
    html += '<button type="button" class="tl-expand-toggle" onclick="toggleTodaysLeadersExpanded()">View all '+allCats.length+' categories ▾</button>';
  } else if(isMobile && state.todaysLeadersExpanded && allCats.length > mobileSet.length){
    html += '<button type="button" class="tl-expand-toggle" onclick="toggleTodaysLeadersExpanded()">Show top '+mobileSet.length+' ▴</button>';
  }
  el.innerHTML = html;
}

export function toggleTodaysLeadersExpanded(){
  state.todaysLeadersExpanded = !state.todaysLeadersExpanded;
  renderTodaysLeaders();
}

// Warms the league-leaders cache for both groups (idempotent — fetchLeagueLeaders
// is TTL-cached at 5min) then renders. Called from loadRoster's section-init
// path so the card is populated when the user first opens the Stats tab.
export async function loadTodaysLeaders(){
  await Promise.all([
    fetchLeagueLeaders('hitting'),
    fetchLeagueLeaders('pitching')
  ]);
  renderTodaysLeaders();
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
    html+='<div class="hero-panel'+(hTier?' hero-panel--'+hTier:'')+'">'+
      '<div class="hero-panel-stat">'+
        '<div class="hero-panel-meta">'+heroMeta+'</div>'+
        '<div class="hero-panel-val">'+(hb.v!=null?hb.v:'—')+'</div>'+
        '<div class="hero-panel-lbl">'+heroLabel+'</div>'+
        ((hChip||tierPill)?'<div class="hero-panel-deltas">'+hChip+tierPill+'</div>':'')+
      '</div>'+
      '<div class="hero-panel-context">'+
        (hPInfo?'<div class="hero-panel-rank">#'+hPInfo.rank+' of '+hPInfo.total+' MLB</div>':'')+
        (hPInfo?'<div class="hero-panel-bar">'+pctBar(hPInfo.percentile)+'</div>':'')+
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
    html+='<div class="stat-box'+tierCls+'">'+
          '<div class="stat-val">'+(b.v!=null?b.v:'—')+'</div>'+
          '<div class="stat-lbl">'+b.l+'</div>'+
          (pInfo?pctBar(pInfo.percentile)+rankCaption(pInfo.rank,pInfo.total):'')+
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

// ── NEWS SECTION ────────────────────────────────────────────────────────────
function escapeNewsHtml(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function forceHttps(url){return url?url.replace(/^http:/,'https:'):url;}
function decodeNewsHtml(s){var map={'&quot;':'"','&amp;':'&','&lt;':'<','&gt;':'>','&#39;':"'",'&apos;':"'"};return String(s||'').replace(/&(?:#\d+|#x[0-9a-f]+|quot|amp|lt|gt|apos?);/gi,function(e){return map[e.toLowerCase()]||e;}).replace(/&#(\d+);/g,function(m,code){return String.fromCharCode(parseInt(code,10));}).replace(/&#x([0-9a-f]+);/gi,function(m,code){return String.fromCharCode(parseInt(code,16));}); }
function mkEspnRow(a){var pub=a.published?new Date(a.published).toLocaleDateString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'';var link=(a.links&&a.links.web&&a.links.web.href)?a.links.web.href:'#';var headline=escapeNewsHtml(decodeNewsHtml(a.headline||''));return '<div class="news-item"><div class="news-dot"></div><div class="news-body"><div class="news-title"><a href="'+link+'" target="_blank">'+headline+'</a></div><div class="news-meta">'+pub+(a.byline?' · '+a.byline:'')+'</div></div></div>';}

function mkProxyNewsRow(item){
  var icon=window.NEWS_SOURCE_ICONS?window.NEWS_SOURCE_ICONS[item.source]||'📰':'📰';
  var sourceClass=item.source?' news-thumb--'+item.source:'';
  var thumb=isSafeNewsImage(item.image)
    ? '<div class="news-thumb'+sourceClass+'"><img src="'+escapeNewsHtml(forceHttps(item.image))+'" alt="" onerror="this.parentNode.innerHTML=\'<span class=&quot;news-thumb-placeholder&quot;>'+icon+'</span>\'"></div>'
    : '<div class="news-thumb'+sourceClass+'"><span class="news-thumb-placeholder">'+icon+'</span></div>';
  var NEWS_SOURCE_LABELS=window.NEWS_SOURCE_LABELS||{};
  var src=NEWS_SOURCE_LABELS[item.source]||item.source||'';
  var kicker=src?'<div class="news-source-kicker">VIA '+escapeNewsHtml(src)+'</div>':'';
  var date=fmtNewsDate(item.pubDate);
  var link=item.link||'#';
  var title=escapeNewsHtml(decodeNewsHtml(item.title||''));
  return '<div class="news-item">'+thumb+'<div class="news-body">'+kicker+'<div class="news-title"><a href="'+escapeNewsHtml(link)+'" target="_blank" rel="noopener">'+title+'</a></div>'+(date?'<div class="news-meta">'+date+'</div>':'')+'</div></div>';
}

function renderNewsList(){
  var el=document.getElementById('newsFull');if(!el)return;
  var items=state.newsSourceFilter==='all'?state.newsArticlesCache:state.newsArticlesCache.filter(function(a){return a.source===state.newsSourceFilter;});
  if(!items.length){el.innerHTML='<div class="loading">No articles for this source.</div>';return;}
  el.innerHTML=items.map(mkProxyNewsRow).join('');
}

export function selectNewsSource(key,btn){
  state.newsSourceFilter=key;
  var pills=document.querySelectorAll('#newsSourcePills .stat-tab');
  pills.forEach(function(p){p.classList.remove('active');});
  if(btn)btn.classList.add('active');
  else{var match=document.querySelector('#newsSourcePills .stat-tab[data-source="'+key+'"]');if(match)match.classList.add('active');}
  renderNewsList();
}

export async function loadNews(){
  var fullEl=document.getElementById('newsFull'),homeEl=document.getElementById('homeNews');
  var teamLensBtn=document.getElementById('newsTeamBtn'),teamLensKnob=document.getElementById('newsTeamLensKnob');if(teamLensBtn){teamLensBtn.classList.toggle('on',state.newsFeedMode==='team');if(teamLensKnob)teamLensKnob.style.left=state.newsFeedMode==='team'?'21px':'2px';}
  if(fullEl)fullEl.innerHTML='<div class="loading">Loading news...</div>';if(homeEl)homeEl.innerHTML='<div class="loading">Loading news...</div>';
  var teamUrl='https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/news?team='+state.activeTeam.espnId+'&limit=20';
  if(state.newsFeedMode==='team'){
    try{
      var resp=await fetch(teamUrl);
      var d=await resp.json();
      var arts=(d.articles||[]).filter(function(a){return a.headline;});
      if(!arts.length)throw new Error('No articles');
      if(fullEl)fullEl.innerHTML=arts.map(mkEspnRow).join('');
      if(homeEl)homeEl.innerHTML=arts.slice(0,5).map(mkEspnRow).join('');
    }catch(e){var msg='<div class="error">News unavailable (ESPN API may be blocked by browser).</div>';if(fullEl)fullEl.innerHTML=msg;if(homeEl)homeEl.innerHTML=msg;}
    return;
  }
  try{
    var responses=await Promise.all([fetch(API_BASE+'/api/proxy-news'),fetch(teamUrl)]);
    var d=await responses[0].json();
    state.newsArticlesCache=Array.isArray(d.articles)?d.articles:[];
    if(!state.newsArticlesCache.length)throw new Error('No articles');
    renderNewsList();
    if(homeEl){var hD=await responses[1].json();var hArts=(hD.articles||[]).filter(function(a){return a.headline;});homeEl.innerHTML=hArts.slice(0,5).map(mkEspnRow).join('')||'<div class="loading">No news available</div>';}
  }catch(e){
    try{
      var fb=await fetch('https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/news?limit=20');
      var fbD=await fb.json();var fbArts=(fbD.articles||[]).filter(function(a){return a.headline;});
      if(fullEl)fullEl.innerHTML=fbArts.map(mkEspnRow).join('');
      if(homeEl){var hResp=await fetch(teamUrl);var hJ=await hResp.json();homeEl.innerHTML=(hJ.articles||[]).filter(function(a){return a.headline;}).slice(0,5).map(mkEspnRow).join('')||'<div class="loading">No news available</div>';}
    }catch(e2){var msg='<div class="error">News unavailable (proxy and ESPN both failed).</div>';if(fullEl)fullEl.innerHTML=msg;if(homeEl)homeEl.innerHTML=msg;}
  }
}

export function switchNewsFeed(mode){
  state.newsFeedMode=mode;
  var lensBtn=document.getElementById('newsTeamBtn'),lensKnob=document.getElementById('newsTeamLensKnob');
  if(lensBtn){lensBtn.classList.toggle('on',mode==='team');if(lensKnob)lensKnob.style.left=mode==='team'?'21px':'2px';}
  var pills=document.getElementById('newsSourcePills');if(pills)pills.style.display=(mode==='mlb')?'flex':'none';
  loadNews();
}
export function toggleNewsTeamLens(){switchNewsFeed(state.newsFeedMode==='team'?'mlb':'team');}

// ── LEAGUE VIEW SECTION ─────────────────────────────────────────────────────
export async function loadLeagueView(){if(leagueRefreshTimer){clearInterval(leagueRefreshTimer);leagueRefreshTimer=null;}leagueMatchupOffset=0;['matchupYest','matchupToday','matchupTomor'].forEach(function(id,i){var el=document.getElementById(id);if(el)el.classList.toggle('active',i===1);});var lbl=document.getElementById('matchupDayLabel');if(lbl)lbl.textContent="Today's";await loadLeagueStandings();loadLeagueMatchups();loadLeagueNews();loadLeagueLeaders();leagueRefreshTimer=setInterval(loadLeagueMatchups,TIMING.LEAGUE_REFRESH_MS);}

async function loadLeagueStandings(){try{var r=await fetch(MLB_BASE+'/standings?leagueId=103,104&standingsTypes=regularSeason&hydrate=team');var d=await r.json();leagueStandingsMap={};(d.records||[]).forEach(function(rec){(rec.teamRecords||[]).forEach(function(t){leagueStandingsMap[t.team.id]={w:t.wins,l:t.losses};});});}catch(e){}}

export async function loadLeagueMatchups(){
  var el=document.getElementById('leagueMatchups');
  var dayLabels=["Yesterday's","Today's","Tomorrow's"],dayLabel=dayLabels[leagueMatchupOffset+1];
  el.style.transition='opacity 0.18s ease';el.style.opacity='0.3';
  var dateStr=etDatePlus(etDateStr(),leagueMatchupOffset);
  try{
    var r=await fetch(MLB_BASE+'/schedule?sportId=1&date='+dateStr+'&hydrate=linescore,team');var d=await r.json(),games=[];
    (d.dates||[]).forEach(function(dt){games=games.concat(dt.games||[]);});
    games.sort(function(a,b){return new Date(a.gameDate).getTime()-new Date(b.gameDate).getTime();});
    if(!games.length){el.innerHTML='<div class="empty-state">No games scheduled '+dayLabel.replace("'s","")+'</div>';requestAnimationFrame(function(){el.style.opacity='1';});return;}
    var html='<div class="matchup-grid">';
    games.forEach(function(g){
      var home=g.teams.home,away=g.teams.away,status=g.status.abstractGameState,detailed=g.status.detailedState;
      var actuallyLive=status==='Live'&&detailed!=='Warmup'&&detailed!=='Pre-Game';
      var clickable=(actuallyLive||status==='Final');
      var statusHtml='';
      if(actuallyLive){var inn=g.linescore&&g.linescore.currentInning?(g.linescore.inningHalf==='Bottom'?'Bot ':'Top ')+g.linescore.currentInning:'In Progress';statusHtml='<div class="matchup-status is-live"><span class="matchup-live-dot"></span>LIVE · '+inn+'</div>';}
      else if(status==='Final')statusHtml='<div class="matchup-status">FINAL</div>';
      else{var t=new Date(g.gameDate);statusHtml='<div class="matchup-status">'+t.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})+'</div>';}
      var scoreOrVs;if(actuallyLive){scoreOrVs='<span class="matchup-score">'+(away.score!=null?away.score:0)+'</span><span class="matchup-divider">—</span><span class="matchup-score">'+(home.score!=null?home.score:0)+'</span>';}else if(status==='Final'){var awayWon=away.score>home.score;scoreOrVs='<span class="matchup-score'+(awayWon?'':' is-dim')+'">'+(away.score!=null?away.score:0)+'</span><span class="matchup-divider">—</span><span class="matchup-score'+(awayWon?' is-dim':'')+'">'+(home.score!=null?home.score:0)+'</span>';}else{scoreOrVs='<span class="matchup-vs">vs</span>';}
      var awayRec=leagueStandingsMap[away.team.id],homeRec=leagueStandingsMap[home.team.id];
      var awayD=TEAMS.find(function(t){return t.id===away.team.id;})||{},homeD=TEAMS.find(function(t){return t.id===home.team.id;})||{};
      html+='<div class="matchup-card"'+(clickable?' onclick="showLiveGame('+g.gamePk+')"':'')+'>'+statusHtml+'<div class="matchup-score-row"><div class="matchup-team">'+sectionCallbacks.teamCapImg(away.team.id,away.team.teamName,awayD.primary||'#333',awayD.secondary||'#fff','matchup-cap')+'<div class="matchup-abbr">'+(away.team.abbreviation||away.team.teamName)+'</div><div class="matchup-record">'+(awayRec?'('+awayRec.w+'-'+awayRec.l+')':'')+'</div></div>'+scoreOrVs+'<div class="matchup-team">'+sectionCallbacks.teamCapImg(home.team.id,home.team.teamName,homeD.primary||'#333',homeD.secondary||'#fff','matchup-cap')+'<div class="matchup-abbr">'+(home.team.abbreviation||home.team.teamName)+'</div><div class="matchup-record">'+(homeRec?'('+homeRec.w+'-'+homeRec.l+')':'')+'</div></div></div></div>';
    });
    el.innerHTML=html+'</div>';
  }catch(e){el.innerHTML='<div class="error">Could not load games</div>';}
  requestAnimationFrame(function(){el.style.opacity='1';});
}

export function switchMatchupDay(offset,btn){
  leagueMatchupOffset=offset;
  ['matchupYest','matchupToday','matchupTomor'].forEach(function(id){var el=document.getElementById(id);if(el)el.classList.remove('active');});
  if(btn)btn.classList.add('active');
  var labels=["Yesterday's","Today's","Tomorrow's"],lbl=document.getElementById('matchupDayLabel');
  if(lbl)lbl.textContent=labels[offset+1];
  loadLeagueMatchups();
}

async function loadLeagueNews(){var el=document.getElementById('leagueNews');el.innerHTML='<div class="loading">Loading...</div>';try{var r=await fetch('https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/news?limit=15');var d=await r.json(),articles=(d.articles||[]).filter(function(a){return a.headline;}).slice(0,10);if(!articles.length)throw new Error('none');var html='';articles.forEach(function(a){var pub=a.published?new Date(a.published).toLocaleDateString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'';var link=(a.links&&a.links.web&&a.links.web.href)?a.links.web.href:'#';var headline=escapeNewsHtml(decodeNewsHtml(a.headline||''));html+='<div class="news-item"><div class="news-dot"></div><div><div class="news-title"><a href="'+link+'" target="_blank">'+headline+'</a></div><div class="news-meta">'+pub+(a.byline?' · '+a.byline:'')+'</div></div></div>';});el.innerHTML=html;}catch(e){el.innerHTML='<div class="error">News unavailable (ESPN API may be blocked by browser).</div>';}}

async function loadLeagueLeaders(){var el=document.getElementById('leagueLeaders');el.innerHTML='<div class="loading">Loading leaders...</div>';var stats=leagueLeaderTab==='hitting'?LEAGUE_HIT_STATS:LEAGUE_PIT_STATS,group=leagueLeaderTab;try{var cats=stats.map(function(s){return s.cats;}).join(',');var r=await fetch(MLB_BASE+'/stats/leaders?leaderCategories='+cats+'&season='+SEASON+'&leaderGameTypes=R&limit=10&statGroup='+group+'&hydrate=person');var d=await r.json(),leaderMap={};(d.leagueLeaders||[]).forEach(function(cat){var key=cat.leaderCategory;if(key)leaderMap[key]=cat.leaders||[];});leagueLeadersCache[leagueLeaderTab]=leaderMap;renderLeagueLeaders(leaderMap,stats);}catch(e){el.innerHTML='<div class="error">Could not load leaders</div>';}}

function renderLeagueLeaders(leaderMap,stats){var el=document.getElementById('leagueLeaders'),html='<div class="league-leaders-grid">';stats.forEach(function(s){var leaders=leaderMap[s.cats]||[];html+='<div class="leader-stat-card"><div class="leader-stat-label">'+s.label+'</div>';if(!leaders.length)html+='<div class="empty-state" style="padding:6px;font-size:.8rem">No data</div>';leaders.slice(0,10).forEach(function(l,i){var val=l.value;if(val!=null){var n=parseFloat(val);if(!isNaN(n))val=s.noLeadZero&&n>0&&n<1?n.toFixed(s.decimals).slice(1):n.toFixed(s.decimals);}html+='<div class="leader-row"><div class="leader-row-left"><span class="leader-rank">'+(i+1)+'</span><span class="leader-name">'+((l.person&&l.person.fullName)||'—')+'</span></div><span class="leader-val">'+val+'</span></div>';});html+='</div>';});el.innerHTML=html+'</div>';}

export function switchLeagueLeaderTab(tab,btn){leagueLeaderTab=tab;document.getElementById('leagueHitTab').classList.toggle('active',tab==='hitting');document.getElementById('leaguePitTab').classList.toggle('active',tab==='pitching');var cached=leagueLeadersCache[tab],stats=tab==='hitting'?LEAGUE_HIT_STATS:LEAGUE_PIT_STATS;if(cached&&Object.keys(cached).length)renderLeagueLeaders(cached,stats);else loadLeagueLeaders();}

// ── LIVE GAME VIEW ──────────────────────────────────────────────────────────
export function showLiveGame(gamePk){liveGamePk=gamePk;document.querySelector('.main').style.display='none';document.getElementById('liveView').classList.add('active');fetchLiveGame();liveInterval=setInterval(fetchLiveGame,TIMING.LIVE_REFRESH_MS);}

export function closeLiveView(){clearInterval(liveInterval);liveInterval=null;if(state.liveAbortCtrl){state.liveAbortCtrl.abort();state.liveAbortCtrl=null;}liveGamePk=null;document.getElementById('liveView').classList.remove('active');document.querySelector('.main').style.display='block';}

export async function fetchLiveGame(){
  if(state.liveAbortCtrl){state.liveAbortCtrl.abort();}
  state.liveAbortCtrl=new AbortController();
  var liveSig=state.liveAbortCtrl.signal;
  try{
    var responses=await Promise.all([fetch(MLB_BASE+'/game/'+liveGamePk+'/linescore',{signal:liveSig}),fetch(MLB_BASE+'/game/'+liveGamePk+'/boxscore',{signal:liveSig}),fetch(MLB_BASE+'/schedule?gamePk='+liveGamePk,{signal:liveSig})]);
    var ls=await responses[0].json(),bs=await responses[1].json(),sd=await responses[2].json();
    var gameState=(sd.dates&&sd.dates[0]&&sd.dates[0].games&&sd.dates[0].games[0])?sd.dates[0].games[0].status.abstractGameState:'Live';
    var isFinal=gameState==='Final';
    var homeTeam=bs.teams&&bs.teams.home&&bs.teams.home.team?bs.teams.home.team:{},awayTeam=bs.teams&&bs.teams.away&&bs.teams.away.team?bs.teams.away.team:{};
    var inningHalf=ls.isTopInning?'▲':'▼',inning=ls.currentInning||'—';
    var headerHtml=isFinal
      ?'<div class="live-status">FINAL</div>'
      :'<div class="live-status">'+inningHalf+' '+inning+' &nbsp;·&nbsp; <span class="live-indicator">● LIVE</span></div>';
    headerHtml+='<div class="live-score"><div class="live-team"><div class="live-team-name">'+(awayTeam.abbreviation||awayTeam.name||'Away')+'</div><div class="live-team-score">'+(ls.teams&&ls.teams.away?ls.teams.away.runs:0)+'</div></div><div class="live-score-divider">—</div><div class="live-team"><div class="live-team-name">'+(homeTeam.abbreviation||homeTeam.name||'Home')+'</div><div class="live-team-score">'+(ls.teams&&ls.teams.home?ls.teams.home.runs:0)+'</div></div></div>';
    document.getElementById('liveHeader').innerHTML=headerHtml;
    var balls=ls.balls||0,strikes=ls.strikes||0,outs=ls.outs||0,bHtml='',sHtml='',oHtml='';
    for(var i=0;i<4;i++)bHtml+='<div class="count-dot ball'+(i<balls?' on':'')+'"></div>';
    for(var i=0;i<3;i++)sHtml+='<div class="count-dot strike'+(i<strikes?' on':'')+'"></div>';
    for(var i=0;i<3;i++)oHtml+='<div class="count-dot out'+(i<outs?' on':'')+'"></div>';
    document.getElementById('liveBalls').innerHTML=bHtml;document.getElementById('liveStrikes').innerHTML=sHtml;document.getElementById('liveOuts').innerHTML=oHtml;
    var offense=ls.offense||{},on='var(--accent)',off='none',offStroke='var(--muted)';
    document.getElementById('base1').setAttribute('fill',offense.first?on:off);document.getElementById('base1').setAttribute('stroke',offense.first?on:offStroke);
    document.getElementById('base2').setAttribute('fill',offense.second?on:off);document.getElementById('base2').setAttribute('stroke',offense.second?on:offStroke);
    document.getElementById('base3').setAttribute('fill',offense.third?on:off);document.getElementById('base3').setAttribute('stroke',offense.third?on:offStroke);
    var batter=offense.batter||{},pitcher=ls.defense&&ls.defense.pitcher?ls.defense.pitcher:{},batterStats='',pitcherStats='';
    if(batter.id){try{var br=await fetch(MLB_BASE+'/people/'+batter.id+'/stats?stats=season&season='+SEASON+'&group=hitting');if(!br.ok)throw new Error(br.status);var bd=await br.json();var bst=bd.stats&&bd.stats[0]&&bd.stats[0].splits&&bd.stats[0].splits[0]&&bd.stats[0].splits[0].stat;if(bst)batterStats='AVG '+fmtRate(bst.avg)+' · OBP '+fmtRate(bst.obp)+' · OPS '+fmtRate(bst.ops);}catch(e){}}
    if(pitcher.id){try{var pr=await fetch(MLB_BASE+'/people/'+pitcher.id+'/stats?stats=season&season='+SEASON+'&group=pitching');if(!pr.ok)throw new Error(pr.status);var pd=await pr.json();var pst=pd.stats&&pd.stats[0]&&pd.stats[0].splits&&pd.stats[0].splits[0]&&pd.stats[0].splits[0].stat;if(pst)pitcherStats='ERA '+fmt(pst.era,2)+' · WHIP '+fmt(pst.whip,2);}catch(e){}}
    var pitcherGameLine='';
    if(pitcher.id){var allPl=Object.assign({},bs.teams&&bs.teams.home&&bs.teams.home.players||{},bs.teams&&bs.teams.away&&bs.teams.away.players||{});var pitEntry=Object.values(allPl).find(function(p){return p.person&&p.person.id===pitcher.id;});if(pitEntry&&pitEntry.stats&&pitEntry.stats.pitching){var ps=pitEntry.stats.pitching;pitcherGameLine='Today: '+(ps.inningsPitched||'0.0')+' IP · '+(ps.hits||0)+' H · '+(ps.earnedRuns||0)+' ER · '+(ps.strikeOuts||0)+' K'+(ps.numberOfPitches?' · '+ps.numberOfPitches+' PC':'');}}
    document.getElementById('liveMatchup').innerHTML='<div class="matchup-player"><div class="matchup-role">🏏 Batting</div><div class="matchup-name">'+(batter.fullName||'—')+'</div><div class="matchup-stats">'+batterStats+'</div></div><div class="matchup-player"><div class="matchup-role">⚾ Pitching</div><div class="matchup-name">'+(pitcher.fullName||'—')+'</div><div class="matchup-stats">'+pitcherStats+'</div>'+(pitcherGameLine?'<div class="matchup-stats is-strong">'+pitcherGameLine+'</div>':'')+'</div>';
    var innings=ls.innings||[],lsHtml='<div class="linescore-scroll"><table class="linescore-table"><thead><tr><th></th>';
    innings.forEach(function(inn){lsHtml+='<th>'+inn.num+'</th>';});
    lsHtml+='<th class="rhe-start">R</th><th>H</th><th>E</th></tr></thead><tbody>';
    ['away','home'].forEach(function(side){var name=side==='away'?(awayTeam.abbreviation||'Away'):(homeTeam.abbreviation||'Home');lsHtml+='<tr><td>'+name+'</td>';innings.forEach(function(inn){lsHtml+='<td>'+(inn[side]&&inn[side].runs!=null?inn[side].runs:'—')+'</td>';});var tot=ls.teams&&ls.teams[side]?ls.teams[side]:{};lsHtml+='<td class="rhe rhe-start">'+(tot.runs!=null?tot.runs:'—')+'</td><td class="rhe">'+(tot.hits!=null?tot.hits:'—')+'</td><td class="rhe">'+(tot.errors!=null?tot.errors:'—')+'</td></tr>';});
    lsHtml+='</tbody></table></div>';document.getElementById('liveLinescore').innerHTML=lsHtml;
    var awayPlayers=bs.teams&&bs.teams.away&&bs.teams.away.players?bs.teams.away.players:{},homePlayers=bs.teams&&bs.teams.home&&bs.teams.home.players?bs.teams.home.players:{};
    var awayAbbr=awayTeam.abbreviation||awayTeam.name||'Away',homeAbbr=homeTeam.abbreviation||homeTeam.name||'Home';
    document.getElementById('liveBoxscore').innerHTML='<div class="boxscore-wrap live-stack-card"><div class="live-card-title">Box Score</div><div class="boxscore-tabs"><button onclick="switchBoxTab(\'live_bs\',\'away\')" id="live_bs_away_btn" class="pill is-active">'+awayAbbr+'</button><button onclick="switchBoxTab(\'live_bs\',\'home\')" id="live_bs_home_btn" class="pill">'+homeAbbr+'</button></div><div id="live_bs_away">'+buildBoxscore(awayPlayers)+'</div><div id="live_bs_home" style="display:none">'+buildBoxscore(homePlayers)+'</div></div>';
    var giHtml='';
    if(bs.info&&bs.info.length){giHtml='<div class="boxscore-wrap live-stack-card"><div class="live-card-title">Game Info</div><div class="game-note-box">';bs.info.forEach(function(item){if(!item.value)return;var val=item.value.replace(/\.$/,'').trim();if(!item.label)giHtml+='<div class="detail-summary-note">'+val+'</div>';else giHtml+='<div class="detail-summary-row"><span class="detail-summary-label">'+item.label+'</span><span>'+val+'</span></div>';});giHtml+='</div></div>';}
    document.getElementById('liveGameInfo').innerHTML=giHtml;
    if(isFinal){if(liveInterval){clearInterval(liveInterval);liveInterval=null;}document.getElementById('liveRefreshTime').textContent='Game Final';}
  }catch(e){if(e.name!=='AbortError')document.getElementById('liveHeader').innerHTML='<div class="error">Could not load live game data</div>';}
  fetchPlayByPlay();
}

async function fetchPlayByPlay(){
  try{
    var r=await fetch(MLB_BASE+'/game/'+liveGamePk+'/playByPlay');
    var data=await r.json();
    var plays=(data.allPlays||[]).filter(function(p){return p.about&&p.about.isComplete;});
    if(!plays.length){document.getElementById('livePlayByPlay').innerHTML='';return;}
    var html='<div class="boxscore-wrap live-stack-card"><div class="live-card-title">Play Log</div>';
    var reversed=plays.slice().reverse();
    var lastKey=null;
    reversed.forEach(function(play){
      var inn=play.about.inning,half=play.about.halfInning==='top'?'▲':'▼';
      var key=half+inn;
      var ord=inn===1?'1st':inn===2?'2nd':inn===3?'3rd':inn+'th';
      if(key!==lastKey){
        if(lastKey!==null)html+='</div>';
        html+='<div class="play-log-inning">'+half+' '+ord+'</div><div class="play-log-group">';
        lastKey=key;
      }
      var isScore=play.about.isScoringPlay;
      var desc=(play.result.description||'—').replace(/\.$/,'');
      var score=isScore?'<span class="play-log-score">'+play.result.awayScore+'-'+play.result.homeScore+'</span>':'';
      html+='<div class="play-log-entry'+(isScore?' play-log-scoring':'')+'">'+(isScore?'🟢 ':'')+desc+(score?' · '+score:'')+'</div>';
    });
    if(lastKey!==null)html+='</div>';
    html+='</div>';
    document.getElementById('livePlayByPlay').innerHTML=html;
  }catch(e){}
}
