// ── Focus Mode
// Manages at-bat pitch-by-pitch tracker. Auto-selects most exciting live game
// via calcFocusScore() algorithm (closeness, runners, inning, count).
// Encapsulates: focusGamePk, focusState, focusPitchSequence, focusStatsCache.
// Polls linescore every 5s (Tier 1) and live feed delta every 5s (Tier 2).

import { state } from '../state.js';
import { SEASON, TIMING, MLB_BASE, MLB_BASE_V1_1 } from '../config/constants.js';
import { devTrace } from '../diag/devLog.js';
import { updateRadioForFocus } from '../radio/engine.js';

export function calcFocusScore(g) {
  if(g.status!=='Live'||g.detailedState!=='In Progress') return 0;
  var diff=Math.abs(g.awayScore-g.homeScore);
  var closeness=diff===0?60:diff===1?45:diff===2?25:5;
  var runners=(g.onFirst?1:0)+(g.onSecond?1:0)+(g.onThird?1:0);
  var isRISP=g.onSecond||g.onThird;
  var isBL=g.onFirst&&g.onSecond&&g.onThird;
  var isWalkoff=g.halfInning==='bottom'&&g.inning>=9&&(g.awayScore-g.homeScore)<=runners+1&&g.awayScore>=g.homeScore;
  var isNoHit=g.inning>=6&&(g.awayHits===0||g.homeHits===0);
  var situation=isBL?40:isRISP?25:runners>0?15:0;
  if(isWalkoff) situation+=50;
  if(isNoHit) situation+=30;
  var countBonus=0;
  if(g.gamePk===state.focusGamePk){
    if(state.focusState.balls===3&&state.focusState.strikes===2) countBonus=20;
    else if(state.focusState.strikes===2) countBonus=12;
    if(state.focusState.outs===2) countBonus+=8;
  }
  var innMult=g.inning<=5?0.6:g.inning<=8?1.0:g.inning===9?1.5:2.0;
  return (closeness+situation+countBonus)*innMult;
}

function getTensionInfo(score) {
  if(score>=state.devTuning.focus_critical) return {label:'CRITICAL',color:'#e03030'};
  if(score>=state.devTuning.focus_high)     return {label:'HIGH',color:'#f59e0b'};
  return {label:'NORMAL',color:'#9aa0a8'};
}

export function selectFocusGame() {
  var liveGames=Object.values(state.gameStates).filter(function(g){return g.status==='Live'&&g.detailedState==='In Progress';});
  if(!liveGames.length) return;
  var scored=liveGames.map(function(g){return {g:g,score:calcFocusScore(g)};});
  scored.sort(function(a,b){return b.score-a.score;});
  var best=scored[0];
  // Auto-select on first run or if current game is no longer live
  if(!state.focusGamePk||!state.gameStates[state.focusGamePk]||state.gameStates[state.focusGamePk].status!=='Live') {
    state.focusIsManual=false;
    setFocusGame(best.g.gamePk); return;
  }
  // Soft alert if a different game scores ≥25 higher (with 90s cooldown)
  if(best.g.gamePk!==state.focusGamePk&&best.score-calcFocusScore(state.gameStates[state.focusGamePk])>=state.devTuning.focus_switch_margin) {
    var now=Date.now();
    if(!state.focusAlertShown[best.g.gamePk]||(now-state.focusAlertShown[best.g.gamePk])>state.devTuning.focus_alert_cooldown) {
      state.focusAlertShown[best.g.gamePk]=now;
      var tension=getTensionInfo(best.score);
      showFocusAlert(best.g.gamePk,tension.label+' · '+best.g.awayAbbr+' @ '+best.g.homeAbbr);
    }
  }
}

export function setFocusGame(pk) {
  if(!pk) return;
  state.focusGamePk=pk;
  state.focusPitchSequence=[];
  state.focusCurrentAbIdx=null;
  state.focusLastTimecode=null;
  state.focusState.batterStats=null;
  state.focusState.pitcherStats=null;
  dismissFocusAlert();
  if(state.focusFastTimer){clearInterval(state.focusFastTimer);state.focusFastTimer=null;}
  if(state.focusAbortCtrl){state.focusAbortCtrl.abort();state.focusAbortCtrl=null;}
  if(state.focusOverlayOpen) renderFocusOverlay();
  updateRadioForFocus();
  pollFocusLinescore();
  state.focusFastTimer=setInterval(pollFocusLinescore,TIMING.FOCUS_POLL_MS);
}

export function setFocusGameManual(pk) {
  devTrace('focus','manual pick · gamePk='+pk);
  state.focusIsManual=true;
  setFocusGame(pk);
}

export function resetFocusAuto() {
  state.focusIsManual=false;
  var live=Object.values(state.gameStates).filter(function(g){return g.status==='Live'&&g.detailedState==='In Progress';});
  if(!live.length) return;
  var scored=live.map(function(g){return {g:g,score:calcFocusScore(g)};});
  scored.sort(function(a,b){return b.score-a.score;});
  setFocusGame(scored[0].g.gamePk);
}

export async function pollFocusLinescore() {
  if(!state.focusGamePk) return;
  if(state.demoMode) { renderFocusCard(); renderFocusMiniBar(); return; }
  if(state.focusAbortCtrl){state.focusAbortCtrl.abort();}
  state.focusAbortCtrl=new AbortController();
  var focusSig=state.focusAbortCtrl.signal;
  try {
    var r=await fetch(MLB_BASE+'/game/'+state.focusGamePk+'/linescore',{signal:focusSig});
    if(!r.ok) throw new Error(r.status);
    var ls=await r.json();
    var g=state.gameStates[state.focusGamePk]||{};
    var tension=getTensionInfo(calcFocusScore(g));
    state.focusState={
      balls:ls.balls||0, strikes:ls.strikes||0, outs:ls.outs||0,
      inning:ls.currentInning||g.inning||1,
      halfInning:ls.isTopInning===false?'bottom':'top',
      currentBatterId:(ls.offense&&ls.offense.batter&&ls.offense.batter.id)||null,
      currentBatterName:(ls.offense&&ls.offense.batter&&ls.offense.batter.fullName)||state.focusState.currentBatterName||'',
      currentPitcherId:(ls.defense&&ls.defense.pitcher&&ls.defense.pitcher.id)||null,
      currentPitcherName:(ls.defense&&ls.defense.pitcher&&ls.defense.pitcher.fullName)||state.focusState.currentPitcherName||'',
      onFirst:!!(ls.offense&&ls.offense.first),
      onSecond:!!(ls.offense&&ls.offense.second),
      onThird:!!(ls.offense&&ls.offense.third),
      awayAbbr:g.awayAbbr||'', homeAbbr:g.homeAbbr||'',
      awayScore:g.awayScore||0, homeScore:g.homeScore||0,
      awayPrimary:g.awayPrimary||'#444', homePrimary:g.homePrimary||'#444',
      tensionLabel:tension.label, tensionColor:tension.color,
      lastPitch:state.focusPitchSequence.length?state.focusPitchSequence[state.focusPitchSequence.length-1]:null,
      batterStats:state.focusStatsCache[(ls.offense&&ls.offense.batter&&ls.offense.batter.id)]||null,
      pitcherStats:state.focusStatsCache[(ls.defense&&ls.defense.pitcher&&ls.defense.pitcher.id)]||null
    };
    fetchFocusPlayerStats(state.focusState.currentBatterId, state.focusState.currentPitcherId);
    renderFocusCard(); renderFocusMiniBar();
    if(state.focusOverlayOpen) renderFocusOverlay();
    pollFocusRich(focusSig);
  } catch(e) {if(e.name!=='AbortError')console.error('pollFocusLinescore error',e);}
}

async function fetchFocusPlayerStats(batterId, pitcherId) {
  if(state.demoMode) return;
  var changed=false;
  if(batterId&&!state.focusStatsCache[batterId]) {
    try {
      var r=await fetch(MLB_BASE+'/people/'+batterId+'/stats?stats=season&group=hitting&season='+SEASON);
      if(!r.ok) throw new Error(r.status);
      var d=await r.json();
      var s=(d.stats&&d.stats[0]&&d.stats[0].splits&&d.stats[0].splits[0]&&d.stats[0].splits[0].stat)||{};
      state.focusStatsCache[batterId]={avg:s.avg||'—',obp:s.obp||'—',ops:s.ops||'—',hr:s.homeRuns!=null?s.homeRuns:'—',rbi:s.rbi!=null?s.rbi:'—'};
      changed=true;
    } catch(e){}
  }
  if(pitcherId&&!state.focusStatsCache[pitcherId]) {
    try {
      var r2=await fetch(MLB_BASE+'/people/'+pitcherId+'/stats?stats=season&group=pitching&season='+SEASON);
      if(!r2.ok) throw new Error(r2.status);
      var d2=await r2.json();
      var s2=(d2.stats&&d2.stats[0]&&d2.stats[0].splits&&d2.stats[0].splits[0]&&d2.stats[0].splits[0].stat)||{};
      state.focusStatsCache[pitcherId]={era:s2.era||'—',whip:s2.whip||'—',wins:s2.wins!=null?s2.wins:'—',losses:s2.losses!=null?s2.losses:'—'};
      changed=true;
    } catch(e){}
  }
  if(!changed) return;
  if(batterId&&state.focusStatsCache[batterId]) state.focusState.batterStats=state.focusStatsCache[batterId];
  if(pitcherId&&state.focusStatsCache[pitcherId]) state.focusState.pitcherStats=state.focusStatsCache[pitcherId];
  if(state.focusOverlayOpen) renderFocusOverlay();
}

async function pollFocusRich(sig) {
  if(!state.focusGamePk||state.demoMode) return;
  try {
    var data;
    if(!state.focusLastTimecode) {
      // First call: full feed to seed state and get initial timecode
      var r=await fetch(MLB_BASE_V1_1+'/game/'+state.focusGamePk+'/feed/live',sig?{signal:sig}:{});
      if(!r.ok) throw new Error(r.status);
      data=await r.json();
      var tsList=data&&data.metaData&&data.metaData.timeStamp;
      if(tsList) state.focusLastTimecode=tsList;
    } else {
      // Subsequent calls: delta only (~1-5KB vs ~500KB)
      var tsResp=await fetch(MLB_BASE_V1_1+'/game/'+state.focusGamePk+'/feed/live/timestamps',sig?{signal:sig}:{});
      if(!tsResp.ok) throw new Error(tsResp.status);
      var tsArr=await tsResp.json();
      var latest=Array.isArray(tsArr)&&tsArr.length?tsArr[tsArr.length-1]:null;
      if(!latest||latest===state.focusLastTimecode) return; // nothing new
      var dResp=await fetch(MLB_BASE_V1_1+'/game/'+state.focusGamePk+'/feed/live/diffPatch?startTimecode='+encodeURIComponent(state.focusLastTimecode)+'&endTimecode='+encodeURIComponent(latest),sig?{signal:sig}:{});
      if(!dResp.ok) throw new Error(dResp.status);
      var patch=await dResp.json();
      state.focusLastTimecode=latest;
      // diffPatch wraps currentPlay under liveData.plays.currentPlay same as full feed
      data=patch;
    }
    var cp=data&&data.liveData&&data.liveData.plays&&data.liveData.plays.currentPlay;
    if(!cp) return;
    var abIdx=cp.about&&cp.about.atBatIndex;
    if(state.focusCurrentAbIdx!==null&&state.focusCurrentAbIdx!==abIdx) state.focusPitchSequence=[];
    state.focusCurrentAbIdx=abIdx;
    var pitchEvents=(cp.playEvents||[]).filter(function(e){return e.isPitch||e.type==='pitch';});
    state.focusPitchSequence=pitchEvents.map(function(e){
      return {
        typeCode:(e.details&&e.details.type&&e.details.type.code)||'??',
        typeName:(e.details&&e.details.type&&e.details.type.description)||'',
        speed:(e.pitchData&&e.pitchData.startSpeed)||null,
        resultCode:(e.details&&e.details.code)||'',
        resultDesc:(e.details&&e.details.description)||'',
        sequenceIndex:e.pitchNumber||0
      };
    });
    if(state.focusPitchSequence.length) state.focusState.lastPitch=state.focusPitchSequence[state.focusPitchSequence.length-1];
    renderFocusCard();
    if(state.focusOverlayOpen) renderFocusOverlay();
  } catch(e) { if(e.name!=='AbortError') console.error('pollFocusRich error',e); }
}

export function renderFocusCard() {
  var el=document.getElementById('focusCard'); if(!el) return;
  if(!state.focusGamePk||(!state.focusState.awayAbbr&&!state.demoMode)){el.style.display='none';return;}
  el.style.display='';
  var liveGames=Object.values(state.gameStates).filter(function(g){return g.status==='Live'&&g.detailedState==='In Progress';});
  var cardData=Object.assign({},state.focusState,{
    isManual: state.focusIsManual,
    allLiveGames: liveGames.map(function(g){
      return {gamePk:g.gamePk,awayAbbr:g.awayAbbr,homeAbbr:g.homeAbbr,
              awayPrimary:g.awayPrimary,homePrimary:g.homePrimary,
              inning:g.inning,isFocused:g.gamePk===state.focusGamePk};
    })
  });
  el.innerHTML=window.FocusCard.renderCard(cardData);
}

export function renderFocusMiniBar() {
  var el=document.getElementById('focusMiniBar'); if(!el) return;
  if(!state.focusGamePk||!state.focusState.awayAbbr){el.style.display='none';return;}
  var half=state.focusState.halfInning==='bottom'?'▼':'▲';
  var liveGames=Object.values(state.gameStates).filter(function(g){return g.status==='Live'&&g.detailedState==='In Progress';});
  var showStrip=liveGames.length>1||state.focusIsManual;
  var stripHtml='';
  if(showStrip){
    stripHtml='<div style="display:flex;align-items:center;gap:5px;padding:3px 10px 4px;background:var(--p-dark,#080e1c);border-bottom:1px solid var(--p-border,#1e2d4a);overflow-x:auto;-webkit-overflow-scrolling:touch;">';
    if(state.focusIsManual){
      stripHtml+='<button onclick="resetFocusAuto()" style="flex:0 0 auto;padding:2px 7px;border-radius:4px;border:1px solid rgba(34,197,94,.35);background:rgba(34,197,94,.08);font:700 9px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.1em;color:#22c55e;cursor:pointer">↩ AUTO</button>';
    }
    liveGames.forEach(function(g){
      var focused=g.gamePk===state.focusGamePk;
      stripHtml+='<button'+(focused?'':' onclick="setFocusGameManual('+g.gamePk+')"')+' style="flex:0 0 auto;display:inline-flex;align-items:center;gap:3px;padding:2px 6px;border-radius:4px;border:'+(focused?'1.5px solid var(--p-accent,#3a4d75)':'1px solid var(--p-border,#1e2d4a)')+';background:transparent;cursor:'+(focused?'default':'pointer')+'">'
        +'<span style="width:4px;height:4px;border-radius:50%;background:'+(g.awayPrimary||'#3a4d75')+';flex:0 0 auto"></span>'
        +'<span style="font:700 9px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.04em;color:'+(focused?'var(--p-text,#e8eaf0)':'var(--p-muted,#9aa0a8)')+'">'+g.awayAbbr+'<span style="color:var(--p-border,#3a4d75);margin:0 2px">@</span>'+g.homeAbbr+'</span>'
        +'<span style="width:4px;height:4px;border-radius:50%;background:'+(g.homePrimary||'#3a4d75')+';flex:0 0 auto"></span>'
        +'</button>';
    });
    stripHtml+='</div>';
  }
  el.style.display='';
  el.innerHTML='<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 12px;background:var(--p-dark,#0c1426);border-bottom:1px solid var(--p-border,#1e2d4a);font-size:.75rem">'
    +'<span style="font:700 10px/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--p-text,#e8eaf0);letter-spacing:.06em">'+state.focusState.awayAbbr+' <strong>'+state.focusState.awayScore+'</strong> – <strong>'+state.focusState.homeScore+'</strong> '+state.focusState.homeAbbr+'</span>'
    +'<span style="font:600 10px/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--p-muted,#9aa0a8)">'+half+state.focusState.inning+' · '+state.focusState.balls+'-'+state.focusState.strikes+' · '+state.focusState.outs+' out</span>'
    +'<button onclick="openFocusOverlay()" style="padding:3px 8px;background:var(--p-dark,#0a0f1e);border:1px solid var(--p-border,#1e2d4a);border-radius:4px;color:var(--p-text,#e8eaf0);font:700 10px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.1em;cursor:pointer">FOCUS →</button>'
    +'</div>'
    +stripHtml;
}

export function openFocusOverlay() {
  var el=document.getElementById('focusOverlay'); if(!el||!state.focusGamePk) return;
  state.focusOverlayOpen=true;
  el.style.display='flex';
  renderFocusOverlay();
}

export function closeFocusOverlay() {
  var el=document.getElementById('focusOverlay'); if(!el) return;
  state.focusOverlayOpen=false;
  el.style.display='none';
}

export function renderFocusOverlay() {
  var card=document.getElementById('focusOverlayCard'); if(!card) return;
  var liveGames=Object.values(state.gameStates).filter(function(g){return g.status==='Live'&&g.detailedState==='In Progress';});
  var data=Object.assign({},state.focusState,{
    pitchSequence: state.focusPitchSequence,
    allLiveGames: liveGames.map(function(g){
      return {gamePk:g.gamePk,awayAbbr:g.awayAbbr,homeAbbr:g.homeAbbr,
              awayScore:g.awayScore,homeScore:g.homeScore,inning:g.inning,
              halfInning:g.halfInning,isFocused:g.gamePk===state.focusGamePk};
    })
  });
  card.innerHTML=window.FocusCard.renderOverlay(data);
}

function showFocusAlert(pk, reason) {
  var el=document.getElementById('focusAlertBanner'); if(!el) return;
  el.style.display='';
  el.innerHTML='<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.35);border-radius:6px;margin:6px 0;font-size:.75rem">'
    +'<span>⚡ <strong style="color:var(--text)">'+reason+'</strong></span>'
    +'<div style="display:flex;gap:6px;flex-shrink:0">'
    +'<button onclick="setFocusGame('+pk+');dismissFocusAlert()" style="padding:3px 10px;background:#f59e0b;border:none;border-radius:4px;color:#000;font-weight:700;font-size:11px;cursor:pointer">Switch</button>'
    +'<button onclick="dismissFocusAlert()" style="padding:3px 8px;background:none;border:1px solid var(--border);border-radius:4px;color:var(--muted);font-size:11px;cursor:pointer">✕</button>'
    +'</div></div>';
}

function dismissFocusAlert() {
  var el=document.getElementById('focusAlertBanner'); if(el) el.style.display='none';
}
