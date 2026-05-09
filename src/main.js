// ── Module imports ───────────────────────────────────────────────────────────
// Diag (devLog + devNet) is imported FIRST — the modules wrap console.log
// and window.fetch as side-effects of import, so any code below that logs
// or fetches is captured.
import { DEV_LOG_CAP, devLog, pushDevLog, devTrace } from './devtools-feed/devLog.js';
import { DEV_NET_CAP, devNetLog } from './devtools-feed/devNet.js';
import {
  SEASON, WC_SPOTS, MLB_BASE, MLB_BASE_V1_1, API_BASE,
  TEAMS, MLB_THEME,
  NEWS_SOURCE_LABELS, NEWS_SOURCE_ICONS,
  TIMING,
} from './config/constants.js';
import {
  tcLookup, fmt, fmtRate, fmtDateTime, fmtNewsDate, pickOppColor,
  etDateStr, etHour, etDatePlus,
} from './utils/format.js';
import { NEWS_IMAGE_HOSTS, isSafeNewsImage } from './utils/news.js';
import { requestScreenWakeLock, releaseScreenWakeLock } from './ui/wakelock.js';
import {
  soundSettings, playSound, setSoundPref,
  toggleSoundPanel, onSoundPanelClickOutside,
} from './ui/sound.js';
import {
  setThemeCallbacks, applyTeamTheme, applyPulseMLBTheme, setPulseColorScheme, togglePulseColorScheme, updatePulseToggle,
  toggleSettings, setupSettingsClickOutside, toggleInvert, buildThemeSelect, buildTeamSelect,
  switchTheme, switchThemeScope, switchTeam,
} from './ui/theme.js';
import {
  setFeedCallbacks, baseDiamondSvg, startCountdown, isPostSlate, isIntermission,
  fetchTomorrowPreview, pulseGreeting, updateFeedEmpty, renderEmptyState,
  addFeedItem, buildFeedEl, renderFeed, renderTicker, renderSideRailGames,
  showAlert, dismissAlert,
} from './feed/render.js';
// Radio station constants (MLB_TEAM_RADIO, FALLBACK_RADIO, APPROVED_RADIO_TEAM_IDS,
// RADIO_CHECK_DEFAULT_NOTES) are imported directly by radio/engine.js and radio/check.js.
import {
  pickRadioForFocus, stopAllMedia, toggleRadio, startRadio, loadRadioStream,
  stopRadio, updateRadioForFocus, getCurrentTeamId,
} from './radio/engine.js';
import {
  setRadioCheckCallbacks, openRadioCheck, closeRadioCheck,
  radioCheckPlay, radioCheckTryCustom, radioCheckStop,
  radioCheckSet, radioCheckSetNote, radioCheckReset, radioCheckCopy,
} from './radio/check.js';
import {
  setYoutubeDebugCallbacks, openYoutubeDebug, closeYoutubeDebug,
  ytDebugFetchCustom, ytDebugApplyToTeam, runYoutubeDebugAll, runYoutubeDebugOne,
  ytDebugReset, ytDebugCopy,
} from './dev/youtube-debug.js';
import {
  openNewsSourceTest, closeNewsSourceTest, runNewsSourceTest, copyNewsSourceTest,
} from './dev/news-test.js';
import {
  openVideoDebugPanel, closeVideoDebugPanel,
  refreshVideoDebugPanel, copyVideoDebug,
} from './dev/video-debug.js';
// Demo Recorder — registers window.Recorder as a side-effect of import so the
// observer hooks in poll.js / feed/render.js / clips.js / focus/mode.js can
// guard on `window.Recorder?.active` without each module taking a dependency.
import { Recorder } from './dev/recorder.js';
import {
  setPanelsCallbacks,
  renderLogCapture, copyLogAsMarkdown, clearDevLog,
  renderAppState, copyAppStateAsMarkdown, _copyToClipboard,
  _stateAsMarkdownContext, _stateAsMarkdownGames, _stateAsMarkdownFeed,
  _stateAsMarkdownStories, _stateAsMarkdownFocus, _stateAsMarkdownPulse,
  renderNetTrace, copyNetTraceAsMarkdown, clearNetTrace,
  renderStorageInspector, clearLsKey, copyStorageAsMarkdown,
  renderSWInspector, copySWStateAsMarkdown, swForceUpdate, swUnregisterAndReload,
  testLocalNotification,
  renderLiveControls, forceFocusGo, forceRecapGo,
  copyDiagnosticSnapshot,
  initPanelsLazyRendering,
} from './dev/panels.js';
import {
  openYesterdayRecap, closeYesterdayRecap, ydChangeDate,
  selectYdClip, scrollToYdTile, playYesterdayClip,
} from './sections/yesterday.js';
import {
  setOverlayCallbacks,
  openVideoOverlay, closeVideoOverlay, dismissPlayerCard, closeSignInCTA,
} from './ui/overlays.js';
import {
  pickPlayback, pickHeroImage, fetchGameContent,
  patchFeedItemWithClip, pollPendingVideoClips, devTestVideoClip,
} from './data/clips.js';
import {
  setBookCallbacks,
  tierRank, loadCollection, saveCollection, collectCard, fetchCareerStats,
  openCollection, closeCollection, filterCollection, sortCollection, goCollectionPage,
  renderCollectionBook, openCardFromCollection, openCardFromKey,
  updateCollectionUI, flashCollectionRailMessage,
  generateTestCard, resetCollection,
} from './collection/book.js';
import {
  setPlayerCardCallbacks,
  showPlayerCard, showRBICard, getHRBadge, getRBIBadge, calcRBICardScore,
  replayHRCard, replayRBICard,
} from './cards/playerCard.js';
import {
  setPollCallbacks, getEffectiveDate, pollLeaguePulse, pollGamePlays,
} from './pulse/poll.js';
import {
  loadPulseNews, nextNewsCard, prevNewsCard,
} from './pulse/news-carousel.js';
import {
  setTuningCallbacks, toggleDevTools, updateTuning, resetTuning,
  updateColorOverride, captureCurrentTheme, toggleColorLock,
  confirmDevToolsChanges, initDevToolsClickDelegator,
} from './dev/tuning.js';
import { signOut, updateSyncUI, showSignInCTA } from './auth/session.js';
import {
  myTeamGamePks, applyMyTeamLens, toggleMyTeamLens, toggleGame,
} from './ui/lens.js';
import {
  toggleDemoMode, setDemoSpeed, toggleDemoPause, backDemoPlay, forwardDemoPlay,
  demoNextHR, exitDemo, loadDemoGames, buildDemoPlayQueue, setDemoCallbacks,
} from './demo/mode.js';
import {
  calcFocusScore, selectFocusGame, setFocusGame, setFocusGameManual, resetFocusAuto,
  pollFocusLinescore, renderFocusCard, renderFocusMiniBar,
  openFocusOverlay, closeFocusOverlay, renderFocusOverlay, dismissFocusAlert,
} from './focus/mode.js';
import {
  setRotationCallbacks, buildStoryPool, rotateStory, showStoryCard, renderStoryCard, updateStoryDots,
  prevStory, nextStory, onStoryVisibilityChange,
} from './carousel/rotation.js';
import {
  setSectionCallbacks, clearHomeTimer, clearLeagueTimer,
  loadTodayGame, loadNextGame, loadHomeYoutubeWidget, selectMediaVideo,
  loadSchedule, changeMonth, selectCalGame, switchBoxTab, playHighlightVideo,
  loadStandings,
  selectLeaderPill, switchLeaderTab, loadLeaders, loadRoster, switchRosterTab, selectPlayer, loadTeamStats, switchVsBasis, toggleQualifiedOnly, toggleLeaderMore, switchPlayerStatsTab, dismissCareerSwipeHint, loadTodaysLeaders, switchTodaysLeadersTab, toggleTodaysLeadersExpanded, installStatsQuickNav, openCompareOverlay, closeCompareOverlay, setCompareSlot, setCompareGroup,
  selectNewsSource, loadNews, switchNewsFeed, toggleNewsTeamLens,
  loadLeagueView, loadLeagueMatchups, switchMatchupDay, switchLeagueLeaderTab,
  showLiveGame, closeLiveView, fetchLiveGame,
} from './sections/loaders.js';
import {
  setSyncCallbacks, syncCollection, mergeCollectionOnSignIn, mergeCollectionSlots, startSyncInterval,
} from './collection/sync.js';
import {
  setCarouselCallbacks, loadOnThisDayCache, loadYesterdayCache, loadTransactionsCache, loadHighLowCache,
} from './carousel/generators.js';
import { signInWithGitHub, signInWithEmail } from './auth/oauth.js';
import { openMoreSheet, closeMoreSheet, toggleMoreSheet, openPulseOverflow, closePulseOverflow, togglePulseOverflow, openPulseShortcuts, closePulseShortcuts, updateHeaderCrumb, installMoreSheetEscClose } from './nav/sheet.js';
import { installHideOnScroll, captureScroll, restoreScroll, installHashRouter, syncHash, installNavDotsRefresh, installNavLongPress } from './nav/behavior.js';
import {
  VAPID_PUBLIC_KEY, urlBase64ToUint8Array,
  subscribeToPush, unsubscribeFromPush, togglePush,
} from './push/push.js';
import { state } from './state.js';

const DEBUG=false; // Set true locally to enable verbose console logging
devTrace('boot','bundle loaded · '+new Date().toISOString());

// ── Naming conventions ────────────────────────────────────────────────────────
// load*()    — fetch + cache + render a full section (loadTodayGame, loadSchedule)
// fetch*()   — async data fetch with session cache, returns data or null (fetchBoxscore, fetchCareerStats)
// render*()  — pure DOM write from already-loaded data (renderCalendar, renderFeed)
// poll*()    — recurring background fetch called on a timer (pollLeaguePulse, pollFocusLinescore)
// gen*()     — story carousel generator, returns array of story objects (genHRStories, genStreakStories)
// show*()    — opens an overlay or card into view (showPlayerCard, showLiveGame)
// open/close*() — paired overlay lifecycle (openCollection/closeCollection, openYesterdayRecap/closeYesterdayRecap)
// update*()  — partial DOM refresh without full re-render (updateFeedEmpty, updateCollectionUI)
// toggle*()  — binary on/off for settings/UI (toggleRadio, toggleGame, toggleDevTools)
// set*()     — sets a specific state value + triggers side-effects (setFocusGame, setRadioUI)
// tcLookup(id) — canonical team lookup; prefer over inline TEAMS.find() at call sites
// ─────────────────────────────────────────────────────────────────────────────

// Constants (SEASON, WC_SPOTS, MLB_BASE, TEAMS, MLB_THEME, NEWS_SOURCE_*, TIMING)
// imported from ./config/constants.js at top of file.
// Hot-state globals are now imported from ./state.js

// ── Timer registry — single audit point for all active timer handles ─────────
const TIMERS={
  _h:{},
  set:function(key,handle){if(this._h[key])clearInterval(this._h[key]);this._h[key]=handle;},
  clear:function(key){if(this._h[key]){clearInterval(this._h[key]);this._h[key]=null;}},
  clearAll:function(){Object.keys(this._h).forEach(function(k){if(TIMERS._h[k]){clearInterval(TIMERS._h[k]);TIMERS._h[k]=null;}});}
};

// ── Hot state globals ────────────────────────────────────────────────────────
// All mutable state is now imported from ./state.js
// soundSettings imported from ./ui/sound.js (hydrated from localStorage on import)
// screenWakeLock state encapsulated inside ./ui/wakelock.js
const devTuningDefaults={
  rotateMs:4500,rbiThreshold:10,rbiCooldown:90000,
  hr_priority:100,hr_cooldown:300000,
  biginning_priority:75,biginning_threshold:3,
  walkoff_priority:90,walkoff_cooldown:300000,
  nohitter_inning_floor:6,nohitter_priority:95,
  basesloaded_enable:true,basesloaded_priority:88,
  focus_critical:120,focus_high:70,focus_switch_margin:25,focus_alert_cooldown:90000,
  hitstreak_floor:10,hitstreak_priority:65,roster_priority_il:40,roster_priority_trade:55,
  wp_leverage_floor:2,wp_extreme_floor:85,award_priority:55,highlow_priority:25,
  livewp_priority:30,livewp_refresh_ms:90000
};

const NEWS_ROTATE_MS=30000;

// tcLookup imported from ./utils/format.js
async function fetchBoxscore(gamePk){
  if (state.demoMode) {
    // Demo replay reads boxscores from the hydrated boxscoreSnapshots
    // timeline. Returns the newest snapshot whose ts <= demoCurrentTime,
    // or null if no snapshot has landed yet for this game (HR/RBI cards
    // already gracefully handle a null boxscore by leaving jersey/position
    // blank — same as live behaviour for unknown players).
    var snaps = state.boxscoreSnapshots[gamePk] || [];
    var nowMs = state.demoCurrentTime || 0;
    for (var i = snaps.length - 1; i >= 0; i--) {
      if (snaps[i].ts <= nowMs) return snaps[i].data;
    }
    return null;
  }
  if(!state.boxscoreCache[gamePk]){
    try{var bsR=await fetch(MLB_BASE+'/game/'+gamePk+'/boxscore');if(!bsR.ok)throw new Error(bsR.status);state.boxscoreCache[gamePk]=await bsR.json();
      if (typeof window !== 'undefined' && window.Recorder && window.Recorder.active) {
        window.Recorder._captureBoxscore(gamePk, state.boxscoreCache[gamePk]);
      }
    }
    catch(e){return null;}
  }
  return state.boxscoreCache[gamePk];
}

function initLeaguePulse() {
  devTrace('pulse','initLeaguePulse · first nav to Pulse');
  initReal();
}
function initReal() {
  setCarouselCallbacks({ updateFeedEmpty: updateFeedEmpty, fetchBoxscore: fetchBoxscore, localDateStr: localDateStr, getEffectiveDate: getEffectiveDate, tcLookup: tcLookup });
  setRotationCallbacks({ refreshDebugPanel: refreshDebugPanel });
  setSyncCallbacks({ loadCollection: loadCollection, saveCollection: saveCollection, updateCollectionUI: updateCollectionUI });
  setThemeCallbacks({ loadTodayGame: loadTodayGame, loadNextGame: loadNextGame, loadNews: loadNews, loadStandings: loadStandings, loadRoster: loadRoster, loadTeamStats: loadTeamStats, loadHomeYoutubeWidget: loadHomeYoutubeWidget, applyMyTeamLens: applyMyTeamLens, clearHomeLiveTimer: clearHomeTimer });
  setFeedCallbacks({ localDateStr: localDateStr });
  setSectionCallbacks({ renderNextGame: renderNextGame, getSeriesInfo: getSeriesInfo, localDateStr: localDateStr, teamCapImg: teamCapImg, capImgError: capImgError });
  setRadioCheckCallbacks({ toggleSettings: toggleSettings });
  setYoutubeDebugCallbacks({ loadHomeYoutubeWidget: loadHomeYoutubeWidget });
  setPanelsCallbacks({ buildStoryPool: buildStoryPool });
  initPanelsLazyRendering();
  initDevToolsClickDelegator();
  setOverlayCallbacks({ flashCollectionRailMessage: flashCollectionRailMessage });
  setBookCallbacks({
    showSignInCTA: showSignInCTA,
    showPlayerCard: showPlayerCard,
    showRBICard: showRBICard,
    getLeagueLeadersCache: function() { return typeof leagueLeadersCache !== 'undefined' ? leagueLeadersCache : null; },
  });
  setPlayerCardCallbacks({
    fetchBoxscore: fetchBoxscore,
    collectCard: collectCard,
  });
  setPollCallbacks({
    pruneStaleGames: pruneStaleGames,
    refreshDebugPanel: refreshDebugPanel,
    updateInningStates: updateInningStates,
    localDateStr: localDateStr,
  });
  setTuningCallbacks({
    refreshDebugPanel: refreshDebugPanel,
    devTuningDefaults: devTuningDefaults,
  });
  var mockBar=document.getElementById('mockBar');
  if(mockBar){mockBar.style.display='none';mockBar.style.setProperty('display','none','important');}
  // Midnight window: at 0–5am ET, seed state.pollDateStr to yesterday so West Coast games are found
  if(!state.demoMode&&etHour()<6){state.pollDateStr=etDatePlus(etDateStr(),-1);}
  else{state.pollDateStr=localDateStr(getEffectiveDate());}
  loadRoster();
  loadOnThisDayCache(); loadYesterdayCache();
  loadTransactionsCache(); loadHighLowCache();
  loadPulseNews();
  document.removeEventListener('visibilitychange',onStoryVisibilityChange);
  document.addEventListener('visibilitychange',onStoryVisibilityChange);
  pollLeaguePulse().then(function(){buildStoryPool();setFocusGame(state.focusGamePk);if(typeof window!=='undefined'&&typeof window.dismissAppSplash==='function')window.dismissAppSplash();});
  state.pulseTimer=setInterval(pollLeaguePulse,TIMING.PULSE_POLL_MS);
  if(state.storyPoolTimer){clearInterval(state.storyPoolTimer);state.storyPoolTimer=null;}
  state.storyPoolTimer=setInterval(buildStoryPool,TIMING.STORY_POOL_MS);
  if(state.videoClipPollTimer){clearInterval(state.videoClipPollTimer);state.videoClipPollTimer=null;}
  state.videoClipPollTimer=setInterval(pollPendingVideoClips,30*1000);
  if(state.newsRefreshTimer){clearInterval(state.newsRefreshTimer);state.newsRefreshTimer=null;}
  state.newsRefreshTimer=setInterval(loadPulseNews,TIMING.NEWS_REFRESH_MS);
  if(state.yesterdayRefreshTimer){clearInterval(state.yesterdayRefreshTimer);state.yesterdayRefreshTimer=null;}
  state.yesterdayRefreshTimer=setInterval(function(){
    loadYesterdayCache().then(function(){
      var ydCard=document.getElementById('yesterdayCard');
      if(ydCard&&ydCard.offsetParent!==null) renderYesterdayRecap();
    });
  },TIMING.YESTERDAY_REFRESH_MS);
}


// ── Demo State Export ────────────────────────────────────────────────────────────
function exportPulseStateAsSnapshot(){
  var snapshot={
    metadata:{exportedAt:new Date().toISOString(),season:SEASON},
    gameStates:state.gameStates,
    feedItems:state.feedItems.map(function(item){return{gamePk:item.gamePk,playTime:item.playTime.toISOString(),type:item.type,event:item.event,desc:item.desc,badge:item.badge,scoring:item.scoring,inning:item.inning,halfInning:item.halfInning,outs:item.outs,awayScore:item.awayScore,homeScore:item.homeScore,data:item.data};}),
    dailyLeadersCache:state.dailyLeadersCache||{},
    onThisDayCache:state.onThisDayCache||[],
    yesterdayCache:state.yesterdayCache||[],
    hrBatterStatsCache:state.hrBatterStatsCache,
    probablePitcherStatsCache:state.probablePitcherStatsCache,
    dailyHitsTracker:state.dailyHitsTracker,
    dailyPitcherKs:state.dailyPitcherKs,
    storyCarouselRawGameData:state.storyCarouselRawGameData,
    stolenBaseEvents:state.stolenBaseEvents,
    scheduleData:state.scheduleData
  };
  localStorage.setItem('mlb_demo_snapshot',JSON.stringify(snapshot));
  var json=JSON.stringify(snapshot,null,2);
  var modal=document.createElement('div');
  modal.style.cssText='position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.8);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px';
  modal.innerHTML='<div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:20px;max-width:600px;width:100%;max-height:80vh;display:flex;flex-direction:column">'
    +'<div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:12px">📸 Pulse State Exported</div>'
    +'<textarea id="exportJson" style="flex:1;background:var(--card2);border:1px solid var(--border);color:var(--muted);padding:12px;border-radius:8px;font-family:monospace;font-size:11px;resize:none;margin-bottom:12px">'+json+'</textarea>'
    +'<div style="display:flex;gap:10px">'
    +'<button onclick="var el=document.getElementById(\'exportJson\');navigator.clipboard.writeText(el.value).then(function(){alert(\'Copied!\');},function(){try{el.select();document.execCommand(\'copy\');alert(\'Copied!\');}catch(e){alert(\'Copy failed — please copy manually.\');}});this.parentElement.parentElement.parentElement.remove();" style="flex:1;background:var(--secondary);color:var(--accent-text);border:none;padding:10px;border-radius:6px;cursor:pointer;font-weight:600">📋 Copy</button>'
    +'<button onclick="this.parentElement.parentElement.parentElement.remove()" style="flex:1;background:var(--card2);color:var(--text);border:1px solid var(--border);padding:10px;border-radius:6px;cursor:pointer;font-weight:600">Close</button>'
    +'</div>'
    +'</div>';
  document.body.appendChild(modal);
  modal.onclick=function(e){if(e.target===modal)modal.remove();};
}


// ── Feed Render (v3.39.22) ─── EXTRACTED to feed/render.js
// Functions imported: renderTicker, renderSideRailGames, addFeedItem, buildFeedEl,
// renderFeed, renderEmptyState, updateFeedEmpty, isPostSlate, isIntermission,
// fetchTomorrowPreview, pulseGreeting, baseDiamondSvg, startCountdown, showAlert, dismissAlert


// ── Story Carousel (v3.39.14) ─── EXTRACTED to carousel/rotation.js + carousel/generators.js
// Functions now imported: buildStoryPool, rotateStory, showStoryCard, renderStoryCard,
// updateStoryDots, prevStory, nextStory, onStoryVisibilityChange

function updateInningStates(){
  // Called after gameStates are updated; actual state mutations happen in genInningRecapStories
}

// ── Debug Panel (v2.7.1) ──────────────────────────────────────────────────────
function refreshDebugPanel(){
  var panel=document.getElementById('debugPanel');
  if(!panel) return;

  var now=Date.now();
  var gameStatesArr=Object.values(state.gameStates);
  var liveCount=gameStatesArr.filter(function(g){return g.status==='Live';}).length;
  var finalCount=gameStatesArr.filter(function(g){return g.status==='Final';}).length;
  var previewCount=gameStatesArr.filter(function(g){return g.status==='Preview'||g.status==='Scheduled';}).length;

  var tier1=state.storyPool.filter(function(s){return s.tier===1;}).length;
  var tier2=state.storyPool.filter(function(s){return s.tier===2;}).length;
  var tier3=state.storyPool.filter(function(s){return s.tier===3;}).length;
  var tier4=state.storyPool.filter(function(s){return s.tier===4;}).length;

  var nextPollIn=Math.round((1042-Date.now())%15000/1000); if(nextPollIn<0)nextPollIn+=15;
  var nextRotateIn=state.storyRotateTimer?Math.round((state.devTuning.rotateMs-(now%(state.devTuning.rotateMs||20000)))/1000):'—';

  var html='<div style="padding:0;line-height:1.6">';
  html+='<div style="font-weight:600;margin-bottom:6px;color:var(--accent)">📊 Service Health</div>';
  html+='<div>Polls active: '+Object.keys(state.gameStates).length+'</div>';
  html+='<div>Live/Final/Preview: '+liveCount+' / '+finalCount+' / '+previewCount+'</div>';
  html+='<div>Feed items: '+state.feedItems.length+'</div>';
  html+='<div>Next poll in: '+nextPollIn+'s</div>';
  html+='<div style="margin-top:8px;font-weight:600;color:var(--accent)">💾 Caches</div>';
  html+='<div>On This Day: '+(state.onThisDayCache?state.onThisDayCache.length+' stories':'loading…')+'</div>';
  html+='<div>Yesterday: '+(state.yesterdayCache?state.yesterdayCache.length+' stories':'loading…')+'</div>';
  html+='<div>Daily Leaders: '+(state.dailyLeadersCache?'loaded':'loading…')+'</div>';
  html+='<div style="margin-top:8px;font-weight:600;color:var(--accent)">🎯 Story Pool ('+state.storyPool.length+')</div>';
  html+='<div>Tier 1/2/3/4: '+tier1+' / '+tier2+' / '+tier3+' / '+tier4+'</div>';
  html+='<div>Rotation active: '+(state.storyRotateTimer?'yes':'no')+'</div>';
  html+='<div>Next rotate in: '+nextRotateIn+'s</div>';
  html+='<div style="margin-top:8px;font-weight:600;color:var(--accent);margin-bottom:4px">All Stories ('+state.storyPool.length+')</div>';
  if(state.storyPool.length){
    state.storyPool.forEach(function(s,idx){
      var cooldownRemain=s.lastShown?Math.max(0,Math.round((s.cooldownMs-(now-s.lastShown.getTime()))/1000)):'—';
      var age=Math.round((now-s.ts.getTime())/1000);
      var ageStr=age<60?age+'s':Math.floor(age/60)+'m';
      var decay=Math.pow(Math.max(0,1-s.decayRate),age/60000/30);
      var score=s.priority*decay;
      var shownStr=s.lastShown?'shown '+Math.floor((now-s.lastShown.getTime())/1000)+'s ago':'never';
      var isCurrent=s.id===state.storyShownId?' ★':'';
      html+='<div style="margin-top:4px;padding:4px;background:rgba(255,255,255,0.04);border-radius:4px;border-left:2px solid var(--border)"><span style="color:var(--accent)">['+(idx+1)+'] T'+s.tier+isCurrent+'</span> '+s.headline.substring(0,50)+'<br/>'
        +'<span style="color:var(--muted);font-size:0.9em">'+s.type+' · pri '+Math.round(score)+' · '+ageStr+' old · cooldown '+cooldownRemain+'s · '+shownStr+'</span></div>';
    });
  } else {
    html+='<div style="color:var(--muted)">No stories yet</div>';
  }
  html+='</div>';
  panel.innerHTML=html;
}

// ── Focus Mode functions (v2.61) ──────────────────────────────────────────────


// DEBUG: Replay an HR card from live feed (call replayHRCard() from console, or press Shift+H)

// Returns YYYY-MM-DD in America/New_York. Despite the name, this is the MLB
// schedule day — not the user's local clock — so non-US users align with the
// MLB API instead of their own calendar (see src/utils/format.js).
function localDateStr(d){return etDateStr(d);}

function scrollToGame(gamePk){var el=document.querySelector('[data-gamepk="'+gamePk+'"]');if(el)el.scrollIntoView({behavior:'smooth',block:'center'});}


function pruneStaleGames(beforeDateStr) {
  Object.keys(state.gameStates).forEach(function(pk) {
    var g=state.gameStates[pk];
    if (g.status!=='Final'||!g.gameDateMs) return;
    var gDate=localDateStr(new Date(g.gameDateMs));
    if (gDate<beforeDateStr) {
      delete state.gameStates[pk];
      state.enabledGames.delete(+pk);
    }
  });
  state.feedItems=state.feedItems.filter(function(fi){return state.gameStates[fi.gamePk]!==undefined;});
  renderFeed();
}




// Sound system (setSoundPref, playSound, audio primitives, per-event sounds)
// imported from ./ui/sound.js

// fmt, fmtRate, fmtDateTime imported from ./utils/format.js
function capImgError(el,primary,secondary,letter){el.onerror=null;var p=(primary||'#333').replace(/#/g,'%23'),s=(secondary||'#fff').replace(/#/g,'%23');el.src='data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="'+p+'"/><text x="32" y="41" text-anchor="middle" font-family="system-ui,sans-serif" font-size="28" font-weight="800" fill="'+s+'">'+letter+'</text></svg>';}
function teamCapImg(teamId,name,primary,secondary,cls){var letter=(name||'?')[0].toUpperCase();var p=encodeURIComponent(primary||'#333'),s=encodeURIComponent(secondary||'#fff');return'<img src="https://www.mlbstatic.com/team-logos/'+teamId+'.svg" class="'+(cls||'card-cap')+'" onerror="capImgError(this,\''+primary+'\',\''+secondary+'\',\''+letter+'\')">';}

// ── Theme/UI (v3.39.21) ─── EXTRACTED to ui/theme.js
// Functions imported: applyTeamTheme, applyPulseMLBTheme, setPulseColorScheme, updatePulseToggle,
// toggleSettings, setupSettingsClickOutside, toggleInvert, buildThemeSelect, buildTeamSelect,
// switchTheme, switchThemeScope, switchTeam

// ── Session & Sync Functions ──────────────────────────────────────────────────
// signInWithGitHub + signInWithEmail imported from ./auth/oauth.js
// closeSignInCTA moved to ui/overlays.js

// requestScreenWakeLock + releaseScreenWakeLock imported from ./ui/wakelock.js

// onSoundPanelClickOutside imported from ./ui/sound.js

function showSection(id,btn){
  devTrace('nav','showSection · '+id);
  if(state.demoMode)exitDemo();
  if(document.getElementById('liveView').classList.contains('active'))closeLiveView();
  if(id!=='league')clearLeagueTimer();
  if(id!=='home')clearHomeTimer();
  // Capture scroll for the outgoing section before swapping
  var prev=document.querySelector('.section.active');
  if(prev)captureScroll(prev.id);
  document.querySelectorAll('.section').forEach(function(s){s.classList.remove('active');});
  document.querySelectorAll('nav button').forEach(function(b){b.classList.remove('active');});
  document.getElementById(id).classList.add('active');
  // When called from the More sheet (no btn), light up the corresponding nav button
  // (which is hidden on mobile but still the canonical "active" tab) and the More
  // button so the user has a visible mobile-bar anchor.
  if(!btn){
    btn=document.querySelector('nav button[data-section="'+id+'"]');
    var moreBtn=document.querySelector('nav button[data-section="more"]');
    if(moreBtn&&(id==='news'||id==='standings'||id==='stats'))moreBtn.classList.add('active');
  }
  if(btn)btn.classList.add('active');
  updateHeaderCrumb(id);
  if(id==='pulse'){
    state.savedThemeForPulse=state.themeOverride;
    applyPulseMLBTheme();
    requestScreenWakeLock();
  }else{
    releaseScreenWakeLock();
    if(state.savedThemeForPulse!==undefined){applyTeamTheme(state.activeTeam);}
  }
  if(id==='schedule'&&!state.scheduleLoaded)loadSchedule();
  if(id==='standings')loadStandings();
  if(id==='stats'){loadTeamStats();loadTodaysLeaders();installStatsQuickNav();if(!state.rosterData.hitting.length){loadRoster();loadLeaders();}else loadLeaders();}
  if(id==='league')loadLeagueView();
  if(id==='news')loadNews();
  // Restore scroll position for incoming section + sync URL hash for deep linking
  restoreScroll(id);
  syncHash(id);
}

// --- NEXT GAME CARD ---
// Returns the opp color most distinct from myPrimary. Falls back to oppSecondary
// when oppPrimary is too close (RGB Euclidean distance < 60), or to oppPrimary
// unchanged when both opp colors are too similar (e.g., Yankees navy/navy vs Mets blue).
// pickOppColor imported from ./utils/format.js
function getSeriesInfo(g){
  var sn=g.seriesGameNumber||(g.seriesSummary&&g.seriesSummary.seriesGameNumber);
  var total=g.gamesInSeries||(g.seriesSummary&&g.seriesSummary.gamesInSeries);
  var desc=g.seriesSummary&&g.seriesSummary.seriesStatus?g.seriesSummary.seriesStatus:null;
  if(sn&&total&&desc)return'Game '+sn+' of '+total+' · '+desc;
  if(!state.scheduleData.length)return sn&&total?'Game '+sn+' of '+total:null;
  var oppId=g.teams.home.team.id===state.activeTeam.id?g.teams.away.team.id:g.teams.home.team.id;
  var venueId=g.venue&&g.venue.id,gameDateStr=g.gameDate.split('T')[0];
  var series=state.scheduleData.filter(function(s){
    var sOpp=s.teams.home.team.id===state.activeTeam.id?s.teams.away.team.id:s.teams.home.team.id;
    var sVenue=s.venue&&s.venue.id,daysDiff=Math.abs((new Date(s.gameDate.split('T')[0])-new Date(gameDateStr))/86400000);
    return sOpp===oppId&&sVenue===venueId&&daysDiff<=4;
  }).sort(function(a,b){return new Date(a.gameDate)-new Date(b.gameDate);});
  if(!sn&&series.length<2)return null;
  var gameNum=sn||(series.findIndex(function(s){return s.gamePk===g.gamePk;})+1);
  var gameTotal=total||series.length,myW=0,oppW=0;
  series.forEach(function(s){if(s.status.abstractGameState!=='Final')return;var myT=s.teams.home.team.id===state.activeTeam.id?s.teams.home:s.teams.away;if(myT.isWinner)myW++;else oppW++;});
  var recStr='';
  if(myW>oppW)recStr=' · '+state.activeTeam.short+' lead '+myW+'-'+oppW;
  else if(oppW>myW){var oN=g.teams.home.team.id===state.activeTeam.id?g.teams.away.team.teamName:g.teams.home.team.teamName;recStr=' · '+oN+' lead '+oppW+'-'+myW;}
  else if(myW>0)recStr=' · Tied '+myW+'-'+myW;
  return'Game '+gameNum+' of '+gameTotal+recStr;
}

function renderNextGame(g,label){
  var home=g.teams.home,away=g.teams.away,teamHome=home.team.id===state.activeTeam.id;
  var opp=teamHome?away:home,my=teamHome?home:away;
  var status=g.status.abstractGameState,seriesInfo=getSeriesInfo(g);
  var oppD=TEAMS.find(function(t){return t.id===opp.team.id;})||{};
  var myD=TEAMS.find(function(t){return t.id===my.team.id;})||{};
  var showScores=status==='Live'||status==='Final';
  var oppScore=showScores?(opp.score!=null?opp.score:0):'';
  var myScore=showScores?(my.score!=null?my.score:0):'';
  var oppKicker=teamHome?'VS':'AT';
  var myKicker=teamHome?'HOME':'AWAY';
  var topBadge='';
  if(status==='Live'){var inn=g.linescore&&g.linescore.currentInning?(g.linescore.inningHalf==='Bottom'?'▼ ':'▲ ')+g.linescore.currentInning+' · ':'';topBadge='<span class="hero-live-meta">'+inn+'<span class="hero-live-dot"></span>LIVE</span>';}
  else if(status==='Final'){var mW=my.isWinner;topBadge='<span class="badge badge-final">FINAL</span> <span class="badge '+(mW?'badge-w':'badge-l')+'">'+(mW?'W':'L')+'</span>';}
  var bottomRight='';
  if(status==='Live'){bottomRight='<button onclick="showLiveGame('+g.gamePk+')" class="btn-primary">▶ Watch Live</button>';}
  else if(status!=='Final'){bottomRight='<div class="hero-meta-strong">'+(teamHome?'🏟️ Home':'✈️ Away')+' · '+fmtDateTime(g.gameDate)+'</div>';}
  var themeTeamMy=state.themeOverride||myD;
  var myPrimaryForClash=state.themeInvert?(themeTeamMy.secondary||state.activeTeam.primary):(themeTeamMy.primary||state.activeTeam.primary);
  var oppPrimary=pickOppColor(oppD.primary||'#333',oppD.secondary,myPrimaryForClash);
  var html='<div class="game-big surface-hero has-opp-tint" style="--opp-primary:'+oppPrimary+'">';
  html+='<div class="hero-kicker-row"><span class="eyebrow eyebrow--accent">'+label+'</span>';
  if(topBadge)html+=' '+topBadge;
  html+='</div>';
  html+='<div class="ng-grid">';
  html+=teamCapImg(opp.team.id,opp.team.teamName,oppPrimary,oppD.secondary||'#fff');
  html+='<div class="ng-team-left"><div class="eyebrow">'+oppKicker+'</div><div class="ng-name">'+opp.team.teamName+'</div>'+(showScores?'<div class="ng-score">'+oppScore+'</div>':'')+'</div>';
  html+='<div class="hero-divider">—</div>';
  html+='<div class="ng-team-right"><div class="eyebrow">'+myKicker+'</div><div class="ng-name">'+my.team.teamName+'</div>'+(showScores?'<div class="ng-score">'+myScore+'</div>':'')+'</div>';
  html+=teamCapImg(my.team.id,my.team.teamName,myD.primary||'#333',myD.secondary||'#fff');
  html+='</div>';
  html+='<div class="hero-bottom-row">';
  html+='<div class="hero-meta">'+(seriesInfo||'')+'</div>';
  html+=bottomRight;
  html+='</div></div>';
  return html;
}

// ── Boot IIFE ────────────────────────────────────────────────────────────────
(async function(){
  var sv=function(k){return localStorage.getItem(k);};
  // soundSettings is hydrated from localStorage inside ./ui/sound.js on import.
  // Restore session token
  state.mlbSessionToken=sv('mlb_session_token');state.mlbAuthUser=sv('mlb_auth_user');
  // Handle auth from OAuth redirect
  const params=new URLSearchParams(window.location.search);
  const authToken=params.get('auth_token'),authMethod=params.get('auth_method');
  if(authToken&&authMethod){
    state.mlbSessionToken=authToken;
    localStorage.setItem('mlb_session_token',authToken);
    if(authMethod==='github'){state.mlbAuthUser=params.get('github_login')||'GitHub User';}
    else if(authMethod==='email'){state.mlbAuthUser=params.get('email')||'Email User';}
    localStorage.setItem('mlb_auth_user',state.mlbAuthUser);
    // Clean up URL
    window.history.replaceState({},'',window.location.pathname);
    await mergeCollectionOnSignIn();
    startSyncInterval();
  }else if(state.mlbSessionToken){
    startSyncInterval();
  }
  if(sv('mlb_team'))state.activeTeam=TEAMS.find(t=>t.id===parseInt(sv('mlb_team')))||state.activeTeam;
  var storedTheme=sv('mlb_theme');
  if(!storedTheme||storedTheme==='-1'){state.themeOverride=MLB_THEME;}
  else if(storedTheme==='0'){state.themeOverride=null;}
  else{state.themeOverride=TEAMS.find(t=>t.id===parseInt(storedTheme))||null;}
  if(sv('mlb_invert')==='true')state.themeInvert=true;
  if(sv('mlb_theme_scope')==='nav')state.themeScope='nav';
  buildTeamSelect();buildThemeSelect();updatePulseToggle();
  document.getElementById('themeSelect').value=storedTheme||'-1';
  if(sv('mlb_theme_scope'))document.getElementById('themeScopeSelect').value=sv('mlb_theme_scope');
  if(state.themeInvert){var it=document.getElementById('invertToggle'),ik=document.getElementById('invertToggleKnob');it.style.background='var(--primary)';ik.style.left='21px';it.setAttribute('aria-checked','true');}
  if(sv('mlb_push')==='1'){var pt=document.getElementById('pushToggle'),pk=document.getElementById('pushToggleKnob');if(pt){pt.style.background='var(--secondary)';pk.style.left='21px';pt.setAttribute('aria-checked','true');}document.getElementById('pushStatusText').textContent='On';}
  // Sync Qualified toggle UI to persisted state (HTML default is ON)
  if(!state.qualifiedOnly){var qt=document.getElementById('qualifiedToggle');if(qt){qt.classList.remove('on');qt.setAttribute('aria-checked','false');}}
  applyTeamTheme(state.activeTeam);loadTodayGame();loadNextGame();loadNews();loadStandings();loadRoster();loadHomeYoutubeWidget();
  updateCollectionUI();
  updateSyncUI();
  // Wire up demo mode callbacks so the module can call core render/feed functions
  setDemoCallbacks({
    addFeedItem: addFeedItem,
    renderTicker: renderTicker,
    renderSideRailGames: renderSideRailGames,
    buildStoryPool: buildStoryPool,
    updateFeedEmpty: updateFeedEmpty,
    showAlert: showAlert,
    playSound: playSound,
    showPlayerCard: showPlayerCard,
    showRBICard: showRBICard,
    rotateStory: rotateStory,
    localDateStr: localDateStr,
    selectFocusGame: selectFocusGame,
    pollFocusLinescore: pollFocusLinescore,
    pollPendingVideoClips: pollPendingVideoClips,
    // Called by exitDemo to restart live polling. Mirrors the live-init
    // section of initReal so Pulse fully resumes — fresh poll, story
    // pool rebuild, focus selection, and all the recurring timers. The
    // immediate updateFeedEmpty paints the hype/empty card so there's no
    // flash of empty Pulse while the first poll is in flight.
    resumeLivePulse: function() {
      if (state.pulseTimer) { clearInterval(state.pulseTimer); state.pulseTimer = null; }
      if (state.storyPoolTimer) { clearInterval(state.storyPoolTimer); state.storyPoolTimer = null; }
      if (state.videoClipPollTimer) { clearInterval(state.videoClipPollTimer); state.videoClipPollTimer = null; }
      state.pollDateStr = localDateStr(new Date());
      updateFeedEmpty();
      renderTicker();
      renderSideRailGames();
      // Refire the once-at-init carousel loaders so the day/yesterday
      // caches refresh from real APIs instead of staying empty until
      // their individual refresh windows expire.
      loadOnThisDayCache();
      loadYesterdayCache();
      loadTransactionsCache();
      loadHighLowCache();
      pollLeaguePulse().then(function(){
        buildStoryPool();
        if (state.focusGamePk) setFocusGame(state.focusGamePk);
      });
      state.pulseTimer = setInterval(pollLeaguePulse, TIMING.PULSE_POLL_MS);
      state.storyPoolTimer = setInterval(buildStoryPool, TIMING.STORY_POOL_MS);
      state.videoClipPollTimer = setInterval(pollPendingVideoClips, 30 * 1000);
    },
  });
  state.pulseInitialized=true;initLeaguePulse();
  // Pulse-first cold-open: mirror showSection('pulse') side-effects so theme + wake-lock match the active landing section
  state.savedThemeForPulse=state.themeOverride;
  applyPulseMLBTheme();
  requestScreenWakeLock();
  applyMyTeamLens(state.myTeamLens);
})();

document.addEventListener('visibilitychange',function(){
  if(document.hidden){
    state.tabHiddenAt=Date.now();
    releaseScreenWakeLock();
    // Pause data polling while tab is hidden
    if(state.pulseTimer){clearInterval(state.pulseTimer);state.pulseTimer=null;}
    if(state.storyPoolTimer){clearInterval(state.storyPoolTimer);state.storyPoolTimer=null;}
    if(state.focusFastTimer){clearInterval(state.focusFastTimer);state.focusFastTimer=null;}
    clearHomeTimer();
    clearLeagueTimer();
  } else {
    if(state.pulseInitialized&&!state.demoMode){
      // Keep state.tabHiddenAt set during catch-up so pollGamePlays treats missed plays as history
      // (suppresses HR/RBI cards and sounds for plays that fired while tab was hidden).
      // Clear it only after the catch-up poll completes.
      pollLeaguePulse().finally(function(){state.tabHiddenAt=null;});
      state.pulseTimer=setInterval(pollLeaguePulse,TIMING.PULSE_POLL_MS);
      state.storyPoolTimer=setInterval(buildStoryPool,TIMING.STORY_POOL_MS);
      if(state.focusGamePk) state.focusFastTimer=setInterval(pollFocusLinescore,TIMING.FOCUS_POLL_MS);
    } else {
      state.tabHiddenAt=null;
    }
  }
});

installMoreSheetEscClose();
installHideOnScroll();
installHashRouter(showSection);
installNavDotsRefresh(30000);
installNavLongPress({
  pulse: function(){ openPulseShortcuts(); }
});

document.addEventListener('keydown',function(e){
  if(e.key==='Escape'&&state.focusOverlayOpen) { closeFocusOverlay(); return; }
  // Mnemonics: M=deMo, H=Home run, B=rBi, V=Variants, D=Dev tools, F=Focus,
  // G=Generate test card, C=Collection demo, P=Play clip, N=News, L=Log,
  // S=State, I=Info dump (snapshot)
  if(e.shiftKey && e.key === 'M') { toggleDemoMode(); }
  if(e.shiftKey && e.key === 'H') { replayHRCard(); }
  if(e.shiftKey && e.key === 'B') { replayRBICard(); }
  if(e.shiftKey && e.key === 'V') { window.PulseCard.demo(); }
  if(e.shiftKey && e.key === 'D') { toggleDevTools(); }
  if(e.shiftKey && e.key === 'F') { window.FocusCard && window.FocusCard.demo(); }
  if(e.shiftKey && e.key === 'G') { generateTestCard(); }
  if(e.shiftKey && e.key === 'C') { window.CollectionCard && window.CollectionCard.demo(); }
  if(e.shiftKey && e.key === 'P') { devTestVideoClip(); }
  if(e.shiftKey && e.key === 'N') { openNewsSourceTest(); } // TEMP — News tab QA
  if(e.shiftKey && e.key === 'L') {
    var p=document.getElementById('devToolsPanel');
    if(p && p.style.display!=='block') toggleDevTools();
    var det=document.getElementById('logCaptureDetails');
    if(det){det.open=true;renderLogCapture();det.scrollIntoView({block:'nearest'});}
  }
  if(e.shiftKey && e.key === 'S') {
    var p=document.getElementById('devToolsPanel');
    if(p && p.style.display!=='block') toggleDevTools();
    var det=document.getElementById('appStateDetails');
    if(det){det.open=true;renderAppState();det.scrollIntoView({block:'nearest'});}
  }
  if(e.shiftKey && e.key === 'I') { copyDiagnosticSnapshot(); }
});

document.addEventListener('click',onSoundPanelClickOutside);

setupSettingsClickOutside();

if('serviceWorker' in navigator){
  navigator.serviceWorker.register('sw.js').then(
    function(reg){devTrace('sw','registered · scope='+reg.scope);},
    function(err){devTrace('sw','registration FAILED · '+(err&&err.message||err));}
  );
}

// ── window-global bridge ─────────────────────────────────────────────────────
// esbuild bundles this file as an IIFE, which hides top-level function
// declarations from HTML inline handlers (onclick=, onchange=, etc.) and from
// keyboard-shortcut targets. The bridge below re-exposes them on `window` so
// the existing HTML markup keeps working without modification. Add a name here
// whenever a new function gets called from inline HTML or a hotkey.
Object.assign(window, {
  // Navigation + section dispatch
  showSection,
  openMoreSheet, closeMoreSheet, toggleMoreSheet,
  openPulseOverflow, closePulseOverflow, togglePulseOverflow,
  openPulseShortcuts, closePulseShortcuts,
  // Settings + theme + team
  switchTeam, switchTheme, switchThemeScope, toggleSettings, toggleInvert,
  togglePush, toggleRadio, toggleDevTools, toggleMyTeamLens, toggleSoundPanel,
  setPulseColorScheme, togglePulseColorScheme, setSoundPref,
  // Collection + Yesterday Recap + Radio Check overlays
  openCollection, closeCollection, openRadioCheck, closeRadioCheck,
  openYesterdayRecap, closeYesterdayRecap,
  // Section loaders (refresh buttons, day toggles)
  loadSchedule, loadNews, loadLeaders, loadLeagueMatchups, changeMonth,
  switchLeaderTab, selectLeaderPill, switchRosterTab, switchVsBasis, toggleQualifiedOnly, toggleLeaderMore, switchPlayerStatsTab, dismissCareerSwipeHint, switchTodaysLeadersTab, toggleTodaysLeadersExpanded, openCompareOverlay, closeCompareOverlay, setCompareSlot, setCompareGroup, switchNewsFeed, toggleNewsTeamLens,
  switchLeagueLeaderTab, switchMatchupDay, selectNewsSource,
  // Live game view + matchup grid
  showLiveGame, closeLiveView, fetchLiveGame, switchBoxTab, selectCalGame,
  // Carousel nav
  prevStory, nextStory, nextNewsCard, prevNewsCard,
  // Demo Mode controls
  setDemoSpeed, demoNextHR, toggleDemoPause, forwardDemoPlay, toggleDemoMode,
  exitDemo,
  // Auth
  signInWithGitHub, signInWithEmail, signOut,
  // Dev Tools + diagnostics
  openNewsSourceTest, runNewsSourceTest, copyNewsSourceTest, closeNewsSourceTest,
  openYoutubeDebug, ytDebugFetchCustom, runYoutubeDebugAll, runYoutubeDebugOne,
  ytDebugCopy, ytDebugReset, closeYoutubeDebug, ytDebugApplyToTeam,
  radioCheckTryCustom, radioCheckStop, radioCheckReset, radioCheckCopy,
  radioCheckPlay, radioCheckSet, radioCheckSetNote,
  copyVideoDebug, refreshVideoDebugPanel, closeVideoDebugPanel,
  copyDiagnosticSnapshot,
  _copyToClipboard,
  toggleColorLock, updateColorOverride, updateTuning,
  replayHRCard, replayRBICard, generateTestCard, devTestVideoClip,
  renderLogCapture, renderAppState,
  // Card overlays + dismissals
  dismissPlayerCard, closeSignInCTA, closeVideoOverlay,
  openCardFromKey, playHighlightVideo, playYesterdayClip, scrollToYdTile,
  selectYdClip, selectMediaVideo, selectPlayer, ydChangeDate,
  // Focus Mode
  openFocusOverlay, closeFocusOverlay, dismissFocusAlert,
  setFocusGame, setFocusGameManual, resetFocusAuto, toggleGame,
});
