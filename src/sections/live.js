// Live Game View — full-screen overlay with linescore, count + base diamond,
// pitcher/batter matchup, boxscore tabs, game info, and play log.
// Polls /linescore + /boxscore + /schedule every TIMING.LIVE_REFRESH_MS;
// also fetches /playByPlay separately.
//
// Triggered from: schedule game-detail panel, league matchups grid,
// pulse side-rail games, yesterday recap "Box Score →" buttons, feed cards.

import { state } from '../state.js';
import { SEASON, MLB_BASE, TIMING } from '../config/constants.js';
import { fmt, fmtRate } from '../utils/format.js';
import { buildBoxscore } from '../utils/boxscore.js';

var liveGamePk=null,liveInterval=null;

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
