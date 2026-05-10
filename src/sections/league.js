// League view section — daily matchups grid (yesterday/today/tomorrow toggle)
// + League News pane + League Stat Leaders pane (reads shared
// state.leagueLeaders cache populated by fetchLeagueLeaders).
//
// teamCapImg is injected from main.js via setLeagueCallbacks (used in the
// matchup grid for both teams).

import { state } from '../state.js';
import { MLB_BASE, TIMING, TEAMS } from '../config/constants.js';
import { etDateStr, etDatePlus } from '../utils/format.js';
import { escapeNewsHtml, decodeNewsHtml } from '../utils/news.js';
import { fetchLeagueLeaders } from '../data/leaders.js';

let leagueCallbacks = { teamCapImg: null };
export function setLeagueCallbacks(cb) { Object.assign(leagueCallbacks, cb); }

export let leagueRefreshTimer = null;
export function clearLeagueTimer(){ if(leagueRefreshTimer){clearInterval(leagueRefreshTimer);leagueRefreshTimer=null;} }

var leagueLeaderTab='hitting',leagueStandingsMap={},leagueMatchupOffset=0;

const LEAGUE_HIT_STATS=[{label:'HR',cats:'homeRuns',decimals:0},{label:'AVG',cats:'battingAverage',decimals:3,noLeadZero:true},{label:'OPS',cats:'onBasePlusSlugging',decimals:3,noLeadZero:true},{label:'RBI',cats:'runsBattedIn',decimals:0},{label:'SB',cats:'stolenBases',decimals:0},{label:'BB',cats:'walks',decimals:0}];
const LEAGUE_PIT_STATS=[{label:'SO',cats:'strikeouts',decimals:0},{label:'WHIP',cats:'walksAndHitsPerInningPitched',decimals:2},{label:'ERA',cats:'earnedRunAverage',decimals:2},{label:'W',cats:'wins',decimals:0},{label:'SV',cats:'saves',decimals:0},{label:'IP',cats:'inningsPitched',decimals:1}];

export async function loadLeagueView(){if(leagueRefreshTimer){clearInterval(leagueRefreshTimer);leagueRefreshTimer=null;}leagueMatchupOffset=0;['matchupYest','matchupToday','matchupTomor'].forEach(function(id,i){var el=document.getElementById(id);if(el)el.classList.toggle('active',i===1);});var lbl=document.getElementById('matchupDayLabel');if(lbl)lbl.textContent="Today's";await loadLeagueStandings();loadLeagueMatchups();loadLeagueNews();loadLeagueLeaders();leagueRefreshTimer=setInterval(loadLeagueMatchups,TIMING.LEAGUE_REFRESH_MS);}

async function loadLeagueStandings(){try{var r=await fetch(MLB_BASE+'/standings?leagueId=103,104&standingsTypes=regularSeason&hydrate=team');var d=await r.json();leagueStandingsMap={};(d.records||[]).forEach(function(rec){(rec.teamRecords||[]).forEach(function(t){leagueStandingsMap[t.team.id]={w:t.wins,l:t.losses};});});}catch(e){}}

export async function loadLeagueMatchups(){
  var el=document.getElementById('leagueMatchups');
  var dayLabels=["Yesterday's","Today's","Tomorrow's"],dayLabel=dayLabels[leagueMatchupOffset+1];
  el.style.transition='opacity 0.18s ease';el.style.opacity='0.3';
  var dateStr=etDatePlus(etDateStr(),leagueMatchupOffset);
  try{
    var r=await fetch(MLB_BASE+'/schedule?sportId=1&date='+dateStr+'&hydrate=linescore,team,probablePitcher');
    var d=await r.json(),games=[];
    (d.dates||[]).forEach(function(dt){games=games.concat(dt.games||[]);});
    games.sort(function(a,b){return new Date(a.gameDate).getTime()-new Date(b.gameDate).getTime();});
    if(!games.length){el.innerHTML='<div class="empty-state">No games scheduled '+dayLabel.replace("'s","")+'</div>';requestAnimationFrame(function(){el.style.opacity='1';});return;}
    function lastName(full){if(!full)return '';var parts=full.split(' ');return parts.length>1?parts.slice(1).join(' '):full;}
    function pitcherChip(side){
      var p=side&&side.probablePitcher;
      if(!p||!p.fullName)return '<div class="matchup-pitcher matchup-pitcher--tbd">TBD</div>';
      return '<div class="matchup-pitcher" title="'+p.fullName+'">'+lastName(p.fullName)+'</div>';
    }
    var html='<div class="matchup-grid">';
    games.forEach(function(g){
      var home=g.teams.home,away=g.teams.away,status=g.status.abstractGameState,detailed=g.status.detailedState;
      var actuallyLive=status==='Live'&&detailed!=='Warmup'&&detailed!=='Pre-Game';
      var clickable=(actuallyLive||status==='Final');
      var preGame=!actuallyLive&&status!=='Final';
      var statusHtml='';
      if(actuallyLive){var inn=g.linescore&&g.linescore.currentInning?(g.linescore.inningHalf==='Bottom'?'Bot ':'Top ')+g.linescore.currentInning:'In Progress';statusHtml='<div class="matchup-status is-live"><span class="matchup-live-dot"></span>LIVE · '+inn+'</div>';}
      else if(status==='Final')statusHtml='<div class="matchup-status">FINAL</div>';
      else{var t=new Date(g.gameDate);statusHtml='<div class="matchup-status">'+t.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})+'</div>';}
      // Series eyebrow — only for multi-game series and only when both fields present.
      var seriesHtml='';
      if(g.gamesInSeries>1&&g.seriesGameNumber){
        seriesHtml='<div class="matchup-series">Game '+g.seriesGameNumber+' of '+g.gamesInSeries+'</div>';
      }
      var scoreOrVs;
      if(actuallyLive){scoreOrVs='<span class="matchup-score">'+(away.score!=null?away.score:0)+'</span><span class="matchup-divider">—</span><span class="matchup-score">'+(home.score!=null?home.score:0)+'</span>';}
      else if(status==='Final'){var awayWon=away.score>home.score;scoreOrVs='<span class="matchup-score'+(awayWon?'':' is-dim')+'">'+(away.score!=null?away.score:0)+'</span><span class="matchup-divider">—</span><span class="matchup-score'+(awayWon?' is-dim':'')+'">'+(home.score!=null?home.score:0)+'</span>';}
      else{scoreOrVs='<span class="matchup-vs">vs</span>';}
      var awayRec=leagueStandingsMap[away.team.id],homeRec=leagueStandingsMap[home.team.id];
      var awayD=TEAMS.find(function(t){return t.id===away.team.id;})||{},homeD=TEAMS.find(function(t){return t.id===home.team.id;})||{};
      // Probable pitchers — only render the row pre-game; live and final cards
      // suppress to avoid mixing prediction with actual outcome.
      var pitcherRow=preGame
        ? '<div class="matchup-pitcher-row"><div class="matchup-pitcher-col">'+pitcherChip(away)+'</div><div class="matchup-pitcher-sep">vs</div><div class="matchup-pitcher-col">'+pitcherChip(home)+'</div></div>'
        : '';
      html+='<div class="matchup-card"'+(clickable?' onclick="showLiveGame('+g.gamePk+')"':'')+'>'+
        seriesHtml+
        statusHtml+
        '<div class="matchup-score-row">'+
          '<div class="matchup-team">'+leagueCallbacks.teamCapImg(away.team.id,away.team.teamName,awayD.primary||'#333',awayD.secondary||'#fff','matchup-cap')+'<div class="matchup-abbr">'+(away.team.abbreviation||away.team.teamName)+'</div><div class="matchup-record">'+(awayRec?'('+awayRec.w+'-'+awayRec.l+')':'')+'</div></div>'+
          scoreOrVs+
          '<div class="matchup-team">'+leagueCallbacks.teamCapImg(home.team.id,home.team.teamName,homeD.primary||'#333',homeD.secondary||'#fff','matchup-cap')+'<div class="matchup-abbr">'+(home.team.abbreviation||home.team.teamName)+'</div><div class="matchup-record">'+(homeRec?'('+homeRec.w+'-'+homeRec.l+')':'')+'</div></div>'+
        '</div>'+
        pitcherRow+
      '</div>';
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

// v4.8.7: read from the shared state.leagueLeaders cache (populated by
// fetchLeagueLeaders, used by Stats percentile system + Today's Leaders prior
// to v4.8.6) instead of doing a parallel /stats/leaders fetch. Same data, one
// fewer request per League visit, and category lists stay aligned with the
// percentile system.
async function loadLeagueLeaders(){
  var el=document.getElementById('leagueLeaders');
  el.innerHTML='<div class="loading">Loading leaders...</div>';
  var group=leagueLeaderTab;
  try{
    await fetchLeagueLeaders(group);
    renderLeagueLeaders(group);
  }catch(e){
    el.innerHTML='<div class="error">Could not load leaders</div>';
  }
}

function renderLeagueLeaders(group){
  var el=document.getElementById('leagueLeaders');
  if(!el)return;
  var stats=group==='hitting'?LEAGUE_HIT_STATS:LEAGUE_PIT_STATS;
  var html='<div class="league-leaders-grid">';
  stats.forEach(function(s){
    var leaders=state.leagueLeaders[group+':'+s.cats]||[];
    html+='<div class="leader-stat-card"><div class="leader-stat-label">'+s.label+'</div>';
    if(!leaders.length){
      html+='<div class="empty-state" style="padding:6px;font-size:.8rem">No data</div>';
    }
    leaders.slice(0,10).forEach(function(l,i){
      var val=l.value;
      if(val!=null){
        var n=parseFloat(val);
        if(!isNaN(n))val=s.noLeadZero&&n>0&&n<1?n.toFixed(s.decimals).slice(1):n.toFixed(s.decimals);
      }
      html+='<div class="leader-row"><div class="leader-row-left"><span class="leader-rank">'+(i+1)+'</span><span class="leader-name">'+(l.playerName||'—')+'</span></div><span class="leader-val">'+val+'</span></div>';
    });
    html+='</div>';
  });
  el.innerHTML=html+'</div>';
}

export function switchLeagueLeaderTab(tab,btn){
  leagueLeaderTab=tab;
  document.getElementById('leagueHitTab').classList.toggle('active',tab==='hitting');
  document.getElementById('leaguePitTab').classList.toggle('active',tab==='pitching');
  // Render immediately if the shared cache is warm; otherwise show loading +
  // warm via loadLeagueLeaders.
  var key=tab+':'+(tab==='hitting'?'homeRuns':'earnedRunAverage');
  if(state.leagueLeaders[key]&&state.leagueLeaders[key].length)renderLeagueLeaders(tab);
  else loadLeagueLeaders();
}
