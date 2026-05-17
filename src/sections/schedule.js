// Schedule section — calendar grid (month nav + per-day game cards) plus the
// game-detail panel (linescore + boxscore + game info + highlight clip).
// Inline onclick handlers reference window.showLiveGame / window.selectCalGame
// / window.playHighlightVideo / window.switchBoxTab — exposed by main.js.
//
// Note: this module's `pickPlayback` is intentionally distinct from the one
// exported by src/data/clips.js — that one returns the playback URL string,
// this one returns the playback object (Schedule reads .url off the result).

import { state } from '../state.js';
import { SEASON, MLB_BASE } from '../config/constants.js';
import { forceHttps } from '../utils/news.js';
import { buildBoxscore } from '../utils/boxscore.js';

let calMonth=new Date().getMonth(),calYear=new Date().getFullYear(),selectedGamePk=null;

export async function loadSchedule(){
  document.getElementById('calGrid').innerHTML='<div class="loading">Loading schedule...</div>';
  document.getElementById('scheduleTitle').innerHTML=SEASON+' '+state.activeTeam.short+' Schedule <button class="refresh-btn" onclick="loadSchedule()">↻ Refresh</button>';
  try{
    const r=await fetch(MLB_BASE+'/schedule?sportId=1&season='+SEASON+'&teamId='+state.activeTeam.id+'&hydrate=team,linescore,game,probablePitcher');
    const d=await r.json();state.scheduleData=[];
    (d.dates||[]).forEach(function(dt){dt.games.forEach(function(g){state.scheduleData.push(g);});});
    state.scheduleLoaded=true;calMonth=new Date().getMonth();calYear=new Date().getFullYear();renderCalendar();
  }catch(e){document.getElementById('calGrid').innerHTML='<div class="error">Could not load schedule</div>';}
}

export function changeMonth(dir){calMonth+=dir;if(calMonth>11){calMonth=0;calYear++;}if(calMonth<0){calMonth=11;calYear--;}selectedGamePk=null;document.getElementById('gameDetail').innerHTML='';renderCalendar();}

function renderCalendar(){
  const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
  document.getElementById('calMonthLabel').textContent=months[calMonth]+' '+calYear;
  const days=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],today=new Date(),firstDay=new Date(calYear,calMonth,1).getDay(),daysInMonth=new Date(calYear,calMonth+1,0).getDate();
  const gamesByDate={};state.scheduleData.forEach(function(g){const _d=new Date(g.gameDate),ds=_d.getFullYear()+'-'+String(_d.getMonth()+1).padStart(2,'0')+'-'+String(_d.getDate()).padStart(2,'0');if(!gamesByDate[ds])gamesByDate[ds]=[];gamesByDate[ds].push(g);});
  Object.keys(gamesByDate).forEach(function(ds){gamesByDate[ds].sort(function(a,b){return a.gamePk-b.gamePk;});});
  let html='<div class="cal-grid">';
  days.forEach(function(d){html+='<div class="cal-header">'+d+'</div>';});
  for(let i=0;i<firstDay;i++)html+='<div class="cal-day empty"></div>';
  for(let day=1;day<=daysInMonth;day++){
    const ds=calYear+'-'+String(calMonth+1).padStart(2,'0')+'-'+String(day).padStart(2,'0'),dayGames=gamesByDate[ds]||[];
    const isToday=today.getFullYear()===calYear&&today.getMonth()===calMonth&&today.getDate()===day;
    const isSelected=dayGames.some(function(gm){return gm.gamePk===selectedGamePk;});
    const isDH=dayGames.length>1;
    const classes='cal-day'+(dayGames.length?' has-game':'')+(isToday?' today':'')+(isSelected?' selected':'');
    const onclick=dayGames.length?'onclick="selectCalGame('+dayGames[0].gamePk+',event)"':'';
    let inner='<div class="cal-day-num">'+day+'</div>';
    if(dayGames.length){
      const g0=dayGames[0],home0=g0.teams.home,away0=g0.teams.away,teamHome=home0.team.id===state.activeTeam.id,opp0=teamHome?away0:home0;
      inner+='<div class="cal-game-info"><div class="cal-opp" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><span class="cal-ha">'+(teamHome?'vs ':'@ ')+'</span>'+opp0.team.teamName+(isDH?' <span style="font-size:.55rem;font-weight:700;color:var(--accent);letter-spacing:.04em">DH</span>':'')+'</div>';
      let dotW=false,dotL=false,dotLive=false,dotPPD=false;
      dayGames.forEach(function(gm,idx){
        const myT=gm.teams.home.team.id===state.activeTeam.id?gm.teams.home:gm.teams.away;
        const opT=gm.teams.home.team.id===state.activeTeam.id?gm.teams.away:gm.teams.home;
        const st=gm.status.abstractGameState,dtl=gm.status.detailedState||'';
        const ppd=dtl==='Postponed'||dtl==='Cancelled'||dtl==='Suspended';
        const calLive=st==='Live'&&dtl!=='Warmup'&&dtl!=='Pre-Game';
        const wrap=isDH?'<div onclick="event.stopPropagation();selectCalGame('+gm.gamePk+',event)" style="cursor:pointer;display:flex;align-items:center;gap:3px;margin-top:2px"><span style="font-size:.6rem;color:var(--muted);flex-shrink:0">G'+(idx+1)+':</span>':'';
        const wrapEnd=isDH?'</div>':'';
        if(ppd){
          dotPPD=true;
          inner+=wrap+'<span class="cal-result" style="background:rgba(150,150,150,.15);color:var(--muted);border:1px solid rgba(150,150,150,.4)'+(isDH?';font-size:.6rem;padding:1px 5px':'')+'">PPD</span>'+wrapEnd;
        } else if(st==='Final'){
          const mW=myT.isWinner,sc=(myT.score!=null&&opT.score!=null)?myT.score+'-'+opT.score:'?-?';
          inner+=wrap+'<span class="cal-result '+(mW?'cal-w':'cal-l')+'"'+(isDH?' style="font-size:.6rem;padding:1px 5px"':'')+'>'+(mW?'W':'L')+' '+sc+'</span>'+wrapEnd;
          if(mW)dotW=true;else dotL=true;
        } else if(calLive){
          const sc=(myT.score!=null&&opT.score!=null)?myT.score+'-'+opT.score:'?-?';
          inner+=wrap+'<span class="cal-result" style="background:rgba(100,100,120,.12);color:rgba(255,255,255,.6);border:1px solid rgba(255,255,255,.2)'+(isDH?';font-size:.6rem;padding:1px 5px':'')+'">LIVE '+sc+'</span>'+wrapEnd;
          dotLive=true;
        } else {
          const t=new Date(gm.gameDate),ts=t.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
          inner+=wrap+(isDH?'<span style="font-size:.65rem;color:var(--accent)">'+ts+'</span>':'<div class="cal-upcoming">'+ts+'</div>')+wrapEnd;
        }
      });
      inner+='</div>';
      const dotCls='cal-dot '+(dotLive?'cal-dot-live':(dotW&&!dotL)?'cal-dot-w':(!dotW&&dotL)?'cal-dot-l':(dotPPD&&!dotW&&!dotL)?'cal-dot-ppd':'cal-dot-up');
      inner+='<span class="'+dotCls+'"></span>';
    }
    html+='<div class="'+classes+'" '+onclick+'>'+inner+'</div>';
  }
  html+='</div>';document.getElementById('calGrid').innerHTML=html;
}

export async function selectCalGame(gamePk,evt){
  const cellRect=evt?evt.currentTarget.getBoundingClientRect():null;
  selectedGamePk=gamePk;renderCalendar();
  const g=state.scheduleData.find(function(x){return x.gamePk===gamePk;});if(!g)return;
  // Local-time bucket — must match renderCalendar's inline keying so doubleheader detection lines up on the same calendar cell.
  const localFmt=function(_d){return _d.getFullYear()+'-'+String(_d.getMonth()+1).padStart(2,'0')+'-'+String(_d.getDate()).padStart(2,'0');};
  const ds=localFmt(new Date(g.gameDate));
  const dayGames=state.scheduleData.filter(function(x){return localFmt(new Date(x.gameDate))===ds;}).sort(function(a,b){return a.gamePk-b.gamePk;});
  const isDH=dayGames.length>1;
  if(cellRect&&window.innerWidth<=480){
    const home=g.teams.home,away=g.teams.away,teamHome=home.team.id===state.activeTeam.id;
    const opp=teamHome?away:home,myT=teamHome?home:away,status=g.status.abstractGameState;
    const isPostponed=g.status.detailedState==='Postponed'||g.status.detailedState==='Cancelled'||g.status.detailedState==='Suspended';
    const gameDate=new Date(g.gameDate);
    const dateStr=gameDate.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})+(isDH?' · DH':'');
    let badgeHtml='';
    if(isPostponed)badgeHtml='<span class="cal-result" style="background:rgba(150,150,150,.15);color:var(--muted);border:1px solid rgba(150,150,150,.4)">PPD</span>';
    else if(status==='Final'){const mW=myT.isWinner,sc=(myT.score!=null&&opp.score!=null)?myT.score+'-'+opp.score:'?-?';badgeHtml='<span class="cal-result '+(mW?'cal-w':'cal-l')+'">'+(mW?'W':'L')+' '+sc+'</span>';}
    else if(status==='Live'){const sc=(myT.score!=null&&opp.score!=null)?myT.score+'-'+opp.score:'?-?';badgeHtml='<span class="cal-result" style="background:rgba(100,100,120,.12);color:rgba(255,255,255,.6);border:1px solid rgba(255,255,255,.2)">● LIVE '+sc+'</span>';}
    else badgeHtml='<span style="font-size:.8rem;color:var(--accent)">'+gameDate.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})+'</span>';
    const tt=document.getElementById('calTooltip');
    tt.innerHTML='<div class="cal-tt-opp">'+(teamHome?'vs ':'@ ')+opp.team.teamName+'</div><div class="cal-tt-date">'+dateStr+'</div>'+badgeHtml;
    let ttW=190,left=cellRect.left+cellRect.width/2-ttW/2;
    left=Math.max(8,Math.min(left,window.innerWidth-ttW-8));
    tt.style.cssText='left:'+left+'px;top:'+(cellRect.top-8)+'px;transform:translateY(-100%);min-width:'+ttW+'px';
    tt.classList.add('open');
  }
  const detail=document.getElementById('gameDetail');
  detail.innerHTML='<div class="loading">Loading game details...</div>';
  try{
    const panels=await Promise.all(dayGames.map(function(gm,idx){return buildGameDetailPanel(gm,isDH?idx+1:null);}));
    detail.innerHTML=panels.join('');
    detail.scrollIntoView({behavior:'smooth',block:'nearest'});
  }catch(e){detail.innerHTML='<div class="error">Could not load game details</div>';}
}

export function switchBoxTab(bsId,side){
  const other=side==='away'?'home':'away';
  document.getElementById(bsId+'_'+side).style.display='block';document.getElementById(bsId+'_'+other).style.display='none';
  document.getElementById(bsId+'_'+side+'_btn').classList.add('is-active');
  document.getElementById(bsId+'_'+other+'_btn').classList.remove('is-active');
}

// NOTE: distinct from src/data/clips.js#pickPlayback — that one returns the
// URL string; this one returns the full playback object (we read `.url` off it).
function pickPlayback(playbacks){return playbacks&&playbacks.length?playbacks.find(function(p){return p.name==='mp4'})||playbacks[0]:null;}

export function playHighlightVideo(el,url){
  const stopAllMedia=window.stopAllMedia;
  if(stopAllMedia)stopAllMedia('highlight');
  const video=document.createElement('video');
  video.controls=true;video.style.cssText='width:100%;display:block;background:#000';
  video.addEventListener('error',function(e){
    console.error('Video load error:',e,video.error);
    video.innerHTML='<div style="color:#e03030;padding:20px;text-align:center">Video failed to load. Please try refreshing.</div>';
  });
  video.addEventListener('canplay',function(){
    if(false) console.log('Video ready to play');
    video.play().catch(function(err){console.error('Autoplay blocked:',err);});
  },{once:true});
  const src=document.createElement('source');src.src=url;src.type='video/mp4';video.appendChild(src);
  el.replaceWith(video);
}

async function buildGameDetailPanel(g,gameNum){
  const home=g.teams.home,away=g.teams.away,gameDate=new Date(g.gameDate);
  const status=g.status.abstractGameState,detailed=g.status.detailedState||'';
  const isPostponed=detailed==='Postponed'||detailed==='Cancelled'||detailed==='Suspended';
  const sep=gameNum>1?'<div class="detail-separator"></div>':'';
  const label=gameNum?'<div class="detail-game-label">Game '+gameNum+'</div>':'';
  const title=away.team.teamName+' @ '+home.team.teamName;
  if(isPostponed){
    let html=sep+'<div class="boxscore-wrap">'+label+'<div class="boxscore-title">'+title+' &nbsp;·&nbsp; '+gameDate.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'})+'</div>';
    html+='<div class="game-notes-grid"><div class="game-note-box"><div class="game-note-label">Status</div><div class="game-note-val is-muted">'+detailed+'</div></div>';
    html+='<div class="game-note-box"><div class="game-note-label">Venue</div><div class="game-note-val">'+(g.venue&&g.venue.name?g.venue.name:'TBD')+'</div></div></div></div>';
    return html;
  }
  if(status!=='Final'&&status!=='Live'){
    let html=sep+'<div class="boxscore-wrap">'+label+'<div class="boxscore-title">'+title+' &nbsp;·&nbsp; '+gameDate.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})+' '+gameDate.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})+'</div>';
    html+='<div class="game-notes-grid"><div class="game-note-box"><div class="game-note-label">Location</div><div class="game-note-val">'+(g.venue&&g.venue.name?g.venue.name:'TBD')+'</div></div>';
    const awayPP=(away.probablePitcher&&away.probablePitcher.fullName)?away.probablePitcher.fullName:'TBD',homePP=(home.probablePitcher&&home.probablePitcher.fullName)?home.probablePitcher.fullName:'TBD';
    html+='<div class="game-note-box"><div class="game-note-label">Probable Pitchers</div><div class="game-note-val">'+away.team.teamName+': '+awayPP+'</div><div class="game-note-val">'+home.team.teamName+': '+homePP+'</div></div></div></div>';
    return html;
  }
  if(status==='Live'){
    const ls=g.linescore||{},half=ls.inningHalf||'Top',inn=ls.currentInning||'?';
    const aScore=away.score!=null?away.score:0,hScore=home.score!=null?home.score:0;
    let html=sep+'<div class="boxscore-wrap">'+label+'<div class="boxscore-title">'+title+' &nbsp;·&nbsp; '+gameDate.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})+'</div>';
    html+='<div class="game-notes-grid"><div class="game-note-box"><div class="game-note-label">Score</div><div class="game-note-val">'+away.team.teamName+' '+aScore+', '+home.team.teamName+' '+hScore+'</div></div>';
    html+='<div class="game-note-box"><div class="game-note-label">Status</div><div class="game-note-val"><span class="live-indicator">● LIVE</span> · '+half+' '+inn+'</div></div></div>';
    html+='<button onclick="showLiveGame('+g.gamePk+')" class="watch-live-btn">▶ Watch Live</button>';
    html+='<button onclick="openScorecardOverlay('+g.gamePk+')" class="watch-live-btn sc-btn">📋 Scorecard</button></div>';
    return html;
  }
  let ls={},bs={},content={};
  try{
    const responses=await Promise.all([fetch(MLB_BASE+'/game/'+g.gamePk+'/linescore'),fetch(MLB_BASE+'/game/'+g.gamePk+'/boxscore'),fetch(MLB_BASE+'/game/'+g.gamePk+'/content')]);
    try{ls=await responses[0].json();}catch(e){}
    try{bs=await responses[1].json();}catch(e){}
    try{if(responses[2].ok)content=await responses[2].json();}catch(e){}
  }catch(e){}
  const highlight=content.highlights&&content.highlights.highlights&&content.highlights.highlights.items&&content.highlights.highlights.items[0]?content.highlights.highlights.items[0]:null;
  const highlightPb=highlight?pickPlayback(highlight.playbacks):null;
  const highlightUrl=highlightPb?highlightPb.url:null;
  const thumbCuts=highlight&&highlight.image&&highlight.image.cuts?highlight.image.cuts:[];
  const thumbCut=thumbCuts.find(function(c){return c.width>=640&&c.width<=960;})||thumbCuts[thumbCuts.length-1]||null;
  const thumbUrl=thumbCut?thumbCut.src:null;
  let html=sep+'<div class="final-game-grid">';
  html+='<div class="boxscore-wrap"><div class="boxscore-title">'+title+' &nbsp;·&nbsp; '+gameDate.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'})+'</div>';
  const innings=ls.innings||[];
  html+='<div class="linescore-scroll"><table class="linescore-table"><thead><tr><th></th>';
  innings.forEach(function(inn){html+='<th>'+inn.num+'</th>';});
  html+='<th class="rhe-start">R</th><th>H</th><th>E</th></tr></thead><tbody>';
  html+='<tr><td>'+away.team.teamName+'</td>';innings.forEach(function(inn){html+='<td>'+(inn.away&&inn.away.runs!=null?inn.away.runs:'—')+'</td>';});
  html+='<td class="rhe rhe-start">'+(ls.teams&&ls.teams.away&&ls.teams.away.runs!=null?ls.teams.away.runs:'—')+'</td><td class="rhe">'+(ls.teams&&ls.teams.away&&ls.teams.away.hits!=null?ls.teams.away.hits:'—')+'</td><td class="rhe">'+(ls.teams&&ls.teams.away&&ls.teams.away.errors!=null?ls.teams.away.errors:'—')+'</td></tr>';
  html+='<tr><td>'+home.team.teamName+'</td>';innings.forEach(function(inn){html+='<td>'+(inn.home&&inn.home.runs!=null?inn.home.runs:'—')+'</td>';});
  html+='<td class="rhe rhe-start">'+(ls.teams&&ls.teams.home&&ls.teams.home.runs!=null?ls.teams.home.runs:'—')+'</td><td class="rhe">'+(ls.teams&&ls.teams.home&&ls.teams.home.hits!=null?ls.teams.home.hits:'—')+'</td><td class="rhe">'+(ls.teams&&ls.teams.home&&ls.teams.home.errors!=null?ls.teams.home.errors:'—')+'</td></tr>';
  html+='</tbody></table></div>';
  html+='<button onclick="openScorecardOverlay('+g.gamePk+')" class="watch-live-btn sc-btn">📋 View Scorecard</button>';
  if(highlightUrl){
    const highlightHeadline=highlight.headline||'Full Game Highlight';
    const safeUrl=highlightUrl.replace(/'/g,"\\'");
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
  const awayAbbr=away.team.abbreviation||away.team.teamName,homeAbbr=home.team.abbreviation||home.team.teamName;
  const isHomeActive=state.activeTeam.id===home.team.id,activeAbbr=isHomeActive?homeAbbr:awayAbbr,activeTeamName=isHomeActive?home.team.teamName:away.team.teamName;
  const activePlayers=isHomeActive?(bs.teams&&bs.teams.home&&bs.teams.home.players?bs.teams.home.players:{}):(bs.teams&&bs.teams.away&&bs.teams.away.players?bs.teams.away.players:{});
  const activeBox=buildBoxscore(activePlayers);
  html+='<div class="boxscore-wrap"><div class="detail-team-header">'+activeTeamName+'</div>';
  html+=activeBox+'</div>';
  if(bs.info&&bs.info.length){
    html+='<div class="boxscore-wrap"><div class="game-note-label">Game Summary</div>';
    bs.info.forEach(function(item){if(!item.value)return;const val=item.value.replace(/\.$/,'').trim();if(!item.label)html+='<div class="detail-summary-note">'+val+'</div>';else html+='<div class="detail-summary-row"><span class="detail-summary-label">'+item.label+'</span><span>'+val+'</span></div>';});
    html+='</div>';
  }
  const oppPlayers=isHomeActive?(bs.teams&&bs.teams.away&&bs.teams.away.players?bs.teams.away.players:{}):(bs.teams&&bs.teams.home&&bs.teams.home.players?bs.teams.home.players:{});
  const oppBox=buildBoxscore(oppPlayers),oppTeamName=isHomeActive?away.team.teamName:home.team.teamName;
  html+='<div class="boxscore-wrap"><div class="detail-team-header">'+oppTeamName+'</div>';
  html+=oppBox+'</div>';
  html+='</div>';
  return html;
}
