// Section Loaders — Schedule, Standings, Stats, Roster, News, League Views
import { state } from '../state.js';
import {
  SEASON, WC_SPOTS, MLB_BASE, API_BASE, TEAMS, TIMING,
} from '../config/constants.js';
import {
  tcLookup, fmt, fmtRate, fmtDateTime, fmtNewsDate, pickOppColor,
  etDateStr, etDatePlus,
} from '../utils/format.js';
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
export function selectLeaderPill(group,stat,btn){var selId=group==='hitting'?'hitLeaderStat':'pitLeaderStat';var sel=document.getElementById(selId);if(sel)sel.value=stat;var pillsId=group==='hitting'?'hitLeaderPills':'pitLeaderPills';document.getElementById(pillsId).querySelectorAll('.leader-pill').forEach(function(b){b.classList.remove('active');});btn.classList.add('active');loadLeaders();}

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

export function switchLeaderTab(tab,btn){state.currentLeaderTab=tab;document.querySelectorAll('.stat-tabs button').forEach(function(b){b.classList.remove('active');});btn.classList.add('active');scrollTabIntoView(btn);document.getElementById('hitLeaderStat').style.display=tab==='hitting'?'block':'none';document.getElementById('pitLeaderStat').style.display=tab==='pitching'?'block':'none';document.getElementById('hitLeaderPills').style.display=tab==='hitting'?'flex':'none';document.getElementById('pitLeaderPills').style.display=tab==='pitching'?'flex':'none';loadLeaders();}

export function loadLeaders(){
  var group=state.currentLeaderTab,stat=group==='hitting'?document.getElementById('hitLeaderStat').value:document.getElementById('pitLeaderStat').value,data=state.statsCache[group];
  if(!data||!data.length){document.getElementById('leaderList').innerHTML='<div style="color:var(--muted);padding:12px;font-size:.85rem">Stats still loading...</div>';return;}
  var isAsc=['era','whip','walksAndHitsPerInningPitched'].indexOf(stat)>-1;
  var sorted=data.filter(function(s){return s.stat[stat]!=null&&s.stat[stat]!=='';}).slice().sort(function(a,b){return isAsc?parseFloat(a.stat[stat])-parseFloat(b.stat[stat]):parseFloat(b.stat[stat])-parseFloat(a.stat[stat]);}).slice(0,10);
  if(!sorted.length){document.getElementById('leaderList').innerHTML='<div style="color:var(--muted);padding:12px;font-size:.85rem">No data for this stat yet</div>';return;}
  var html='';
  sorted.forEach(function(s,i){var val=parseFloat(s.stat[stat]),display=val<1&&val>0?val.toFixed(3).slice(1):Number.isInteger(val)?val:val.toFixed(2);html+='<div class="player-item" onclick="selectPlayer('+s.player.id+',\''+group+'\')">'+'<div style="display:flex;align-items:center;gap:10px"><span style="color:var(--accent);font-weight:800;width:18px;font-size:.85rem">'+(i+1)+'</span><div><div class="player-name" style="font-size:.85rem">'+(s.player.fullName||'—')+'</div><div class="player-pos">'+(s.position&&s.position.abbreviation?s.position.abbreviation:'')+'</div></div></div><div style="font-size:1.1rem;font-weight:800;color:var(--accent)">'+display+'</div></div>';});
  document.getElementById('leaderList').innerHTML=html;
}

async function fetchAllPlayerStats(){
  var groups=['hitting','pitching'];
  for(var gi=0;gi<groups.length;gi++){
    var group=groups[gi],players=group==='hitting'?state.rosterData.hitting:state.rosterData.pitching;if(!players.length)continue;
    var results=await Promise.all(players.map(async function(p){try{var r=await fetch(MLB_BASE+'/people/'+p.person.id+'/stats?stats=season&season='+SEASON+'&group='+group);var d=await r.json();var stat=d.stats&&d.stats[0]&&d.stats[0].splits&&d.stats[0].splits[0]&&d.stats[0].splits[0].stat;if(!stat)return null;return{player:p.person,position:p.position,stat:stat};}catch(e){return null;}}));
    state.statsCache[group]=results.filter(function(x){return x!==null;});
  }
  loadLeaders();
}

export async function loadRoster(){
  document.getElementById('playerList').innerHTML='<div class="loading">Loading players...</div>';
  document.getElementById('rosterTitle').textContent=SEASON+' '+state.activeTeam.short+' Players';
  try{
    var r=await fetch(MLB_BASE+'/teams/'+state.activeTeam.id+'/roster?rosterType=40Man&season='+SEASON+'&hydrate=person');
    var d=await r.json(),roster=d.roster||[];
    state.rosterData.hitting=roster.filter(function(p){return p.position&&['P','TWP'].indexOf(p.position.abbreviation)===-1;});
    state.rosterData.pitching=roster.filter(function(p){return p.position&&(p.position.abbreviation==='P'||p.position.abbreviation==='TWP');});
    state.rosterData.fielding=state.rosterData.hitting.slice();renderPlayerList();fetchAllPlayerStats();
    if(state.rosterData.hitting.length)selectPlayer(state.rosterData.hitting[0].person.id,'hitting');
  }catch(e){document.getElementById('playerList').innerHTML='<div class="error">Could not load players</div>';}
}

function renderPlayerList(){
  var players=state.rosterData[state.currentRosterTab]||[];if(!players.length){document.getElementById('playerList').innerHTML='<div class="loading">No players found</div>';return;}
  var html='';
  players.forEach(function(p){var sel=state.selectedPlayer&&state.selectedPlayer.person&&state.selectedPlayer.person.id===p.person.id;html+='<div class="player-item'+(sel?' selected':'')+'" onclick="selectPlayer('+p.person.id+',\''+state.currentRosterTab+'\')">'+'<div><div class="player-name">'+p.person.fullName+'</div><div class="player-pos">#'+(p.jerseyNumber||'—')+' · '+(p.position&&p.position.name?p.position.name:'—')+'</div></div><span class="player-chevron">›</span></div>';});
  document.getElementById('playerList').innerHTML=html;
}

export function switchRosterTab(tab,btn){state.currentRosterTab=tab;state.selectedPlayer=null;document.querySelectorAll('.stat-tab').forEach(function(b){b.classList.remove('active');});btn.classList.add('active');scrollTabIntoView(btn);var players=state.rosterData[tab]||[];if(players.length)selectPlayer(players[0].person.id,tab);else{renderPlayerList();document.getElementById('playerStatsTitle').textContent='Player Stats';document.getElementById('playerStats').innerHTML='<div class="empty-state">No players available</div>';}}

export async function selectPlayer(id,type){
  var playerObj=(state.rosterData[type]||[]).find(function(p){return p.person.id===id;})||{person:{id:id}};
  state.selectedPlayer=playerObj;renderPlayerList();
  document.getElementById('playerStatsTitle').textContent=playerObj.person&&playerObj.person.fullName?playerObj.person.fullName:'Player Stats';
  document.getElementById('playerStats').innerHTML='<div class="loading">Loading stats...</div>';
  try{var group=type==='pitching'?'pitching':type==='fielding'?'fielding':'hitting';var r=await fetch(MLB_BASE+'/people/'+id+'/stats?stats=season&season='+SEASON+'&group='+group);var d=await r.json();var stats=d.stats&&d.stats[0]&&d.stats[0].splits&&d.stats[0].splits[0]&&d.stats[0].splits[0].stat;if(!stats){document.getElementById('playerStats').innerHTML='<div class="empty-state">No '+SEASON+' stats available yet</div>';if(window.innerWidth<=767||(window.innerWidth<=1024&&window.matchMedia('(orientation:portrait)').matches)){document.getElementById('playerStats').scrollIntoView({behavior:'smooth',block:'end'});}return;}renderPlayerStats(stats,group);if(window.innerWidth<=767||(window.innerWidth<=1024&&window.matchMedia('(orientation:portrait)').matches)){document.getElementById('playerStats').scrollIntoView({behavior:'smooth',block:'end'});}}catch(e){document.getElementById('playerStats').innerHTML='<div class="error">Could not load stats</div>';}
}

function renderPlayerStats(s,group){
  var pid=state.selectedPlayer&&state.selectedPlayer.person&&state.selectedPlayer.person.id;
  var jerseyOverlay=(state.selectedPlayer&&state.selectedPlayer.jerseyNumber)?'<div class="headshot-jersey-pill">#'+state.selectedPlayer.jerseyNumber+'</div>':'';
  var html=pid?'<div class="headshot-frame"><img src="https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/'+pid+'/headshot/67/current">'+jerseyOverlay+'</div>':'';
  var boxes=[];
  if(group==='hitting')boxes=[{v:fmtRate(s.avg),l:'AVG'},{v:s.homeRuns,l:'HR'},{v:s.rbi,l:'RBI'},{v:fmtRate(s.ops),l:'OPS'},{v:s.hits,l:'H'},{v:s.doubles,l:'2B'},{v:s.triples,l:'3B'},{v:s.strikeOuts,l:'K'},{v:s.baseOnBalls,l:'BB'},{v:s.runs,l:'R'},{v:s.stolenBases,l:'SB'},{v:s.plateAppearances,l:'PA'}];
  else if(group==='pitching')boxes=[{v:fmt(s.era,2),l:'ERA'},{v:fmt(s.whip,2),l:'WHIP'},{v:s.strikeOuts,l:'K'},{v:s.wins+'-'+s.losses,l:'W-L'},{v:fmt(s.inningsPitched,1),l:'IP'},{v:s.hits,l:'H'},{v:s.baseOnBalls,l:'BB'},{v:s.homeRuns,l:'HR'},{v:fmt(s.strikeoutWalkRatio,2),l:'K/BB'},{v:fmt(s.strikeoutsPer9Inn,2),l:'K/9'},{v:fmt(s.walksPer9Inn,2),l:'BB/9'},{v:s.saves,l:'SV'}];
  else boxes=[{v:fmtRate(s.fielding),l:'FPCT'},{v:s.putOuts,l:'PO'},{v:s.assists,l:'A'},{v:s.errors,l:'E'},{v:s.chances,l:'TC'},{v:s.doublePlays,l:'DP'}];
  var cols=group==='fielding'?3:4;
  html+='<div class="stat-grid stat-grid--cols-'+cols+'">';
  boxes.forEach(function(b,i){html+='<div class="stat-box'+(i===0?' hero':'')+'"><div class="stat-val">'+(b.v!=null?b.v:'—')+'</div><div class="stat-lbl">'+b.l+'</div></div>';});
  document.getElementById('playerStats').innerHTML=html+'</div>';
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
  var teamBtn=document.getElementById('newsTeamBtn');if(teamBtn)teamBtn.textContent=state.activeTeam.short;
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

export function switchNewsFeed(mode,btn){
  state.newsFeedMode=mode;
  ['newsMlbBtn','newsTeamBtn'].forEach(function(id){var el=document.getElementById(id);if(el)el.classList.remove('active');});
  if(btn)btn.classList.add('active');
  var pills=document.getElementById('newsSourcePills');if(pills)pills.style.display=(mode==='mlb')?'flex':'none';
  loadNews();
}

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
