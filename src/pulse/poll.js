// ── League Pulse Polling ─────────────────────────────────────────────────────
// pollLeaguePulse() — every TIMING.PULSE_POLL_MS, fetch /schedule for the
// active date, diff into state.gameStates, fire status events, and trigger
// per-game pollGamePlays() for live games.
//
// pollGamePlays() — Tier-2 GUMBO timestamps + playByPlay diff. Emits feed
// items for every new completed play, fires HR/RBI cards, queues stolen
// bases for the carousel, tracks perfect-game candidates + daily hits/Ks.

import { state } from '../state.js';
import { MLB_BASE, MLB_BASE_V1_1 } from '../config/constants.js';
import { tcLookup, etHour } from '../utils/format.js';
import { devTrace } from '../diag/devLog.js';
import {
  addFeedItem, renderFeed, renderTicker, renderSideRailGames,
  updateFeedEmpty, isPostSlate, showAlert,
} from '../feed/render.js';
import { playSound } from '../ui/sound.js';
import { selectFocusGame } from '../focus/mode.js';
import { pollPendingVideoClips } from '../data/clips.js';
import { showPlayerCard, showRBICard, getHRBadge, calcRBICardScore } from '../cards/playerCard.js';

let _pruneStaleGames = null;
let _refreshDebugPanel = null;
let _updateInningStates = null;
let _localDateStr = null;

export function setPollCallbacks(cbs) {
  if (cbs.pruneStaleGames) _pruneStaleGames = cbs.pruneStaleGames;
  if (cbs.refreshDebugPanel) _refreshDebugPanel = cbs.refreshDebugPanel;
  if (cbs.updateInningStates) _updateInningStates = cbs.updateInningStates;
  if (cbs.localDateStr) _localDateStr = cbs.localDateStr;
}

export function getEffectiveDate() {
  return state.demoMode && state.demoDate ? state.demoDate : new Date();
}

export async function pollLeaguePulse() {
  if (state.pulseAbortCtrl) { state.pulseAbortCtrl.abort(); }
  state.pulseAbortCtrl = new AbortController();
  var sig = state.pulseAbortCtrl.signal;
  var hasLive = Object.values(state.gameStates).some(function(g) { return g.status === 'Live'; });
  devTrace('poll', 'pollLeaguePulse start · hasLive=' + hasLive + ' · pollDate=' + state.pollDateStr + ' · games=' + Object.keys(state.gameStates).length + ' · enabled=' + state.enabledGames.size);
  var isMidnightWindow = !state.demoMode && etHour() < 6;
  if (!hasLive) {
    var hasGamesFromCurrentDate = state.pollDateStr && Object.values(state.gameStates).some(function(g) {
      return g.gameDateMs && _localDateStr(new Date(g.gameDateMs)) === state.pollDateStr;
    });
    if (!hasGamesFromCurrentDate && !isMidnightWindow) {
      state.pollDateStr = _localDateStr(getEffectiveDate());
    }
    else if (!isMidnightWindow && isPostSlate()) {
      var todayStr = _localDateStr(getEffectiveDate());
      if (state.pollDateStr < todayStr) {
        if (_pruneStaleGames) _pruneStaleGames(todayStr);
        state.pollDateStr = todayStr;
      }
    }
  }
  var dateStr = state.pollDateStr;
  try {
    var r = await fetch(MLB_BASE + '/schedule?sportId=1&date=' + dateStr + '&hydrate=linescore,team,probablePitcher', { signal: sig });
    if (!r.ok) throw new Error(r.status);
    var d = await r.json();
    var games = (d.dates || []).flatMap(function(dt) { return dt.games || []; });
    devTrace('poll', 'schedule fetch · date=' + dateStr + ' · games=' + games.length);

    var hasLiveInFetch = games.some(function(g) { return g.status.abstractGameState === 'Live'; });
    if ((!games.length || (isMidnightWindow && !hasLiveInFetch)) && !hasLive) {
      var yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      var yDateStr = _localDateStr(yesterday);
      var yr = await fetch(MLB_BASE + '/schedule?sportId=1&date=' + yDateStr + '&hydrate=linescore,team,probablePitcher', { signal: sig });
      if (!yr.ok) throw new Error(yr.status);
      var yd = await yr.json();
      var yGames = (yd.dates || []).flatMap(function(dt) { return dt.games || []; });
      if (yGames.length) {
        games = yGames;
        dateStr = yDateStr;
        state.pollDateStr = dateStr;
      }
    }
    state.storyCarouselRawGameData = {};
    games.forEach(function(g) { state.storyCarouselRawGameData[g.gamePk] = g; });
    var pendingFinalItems = {};
    games.forEach(function(g) {
      var pk = g.gamePk, newStatus = g.status.abstractGameState, detailed = g.status.detailedState || '';
      var away = g.teams.away, home = g.teams.home;
      var awayTc = tcLookup(away.team.id), homeTc = tcLookup(home.team.id);
      var ls = g.linescore || {}, gameTime = null, gameDateMs = null;
      if (g.gameDate) {
        try { var gd = new Date(g.gameDate); gameTime = gd.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); gameDateMs = gd.getTime(); } catch (e) {}
      }
      if (!state.gameStates[pk]) {
        state.gameStates[pk] = {
          gamePk: pk, awayId: away.team.id, homeId: home.team.id,
          awayAbbr: away.team.abbreviation, homeAbbr: home.team.abbreviation,
          awayName: away.team.name, homeName: home.team.name,
          awayPrimary: awayTc.primary, homePrimary: homeTc.primary,
          awayScore: away.score || 0, homeScore: home.score || 0,
          awayW: away.leagueRecord ? away.leagueRecord.wins : null, awayL: away.leagueRecord ? away.leagueRecord.losses : null,
          homeW: home.leagueRecord ? home.leagueRecord.wins : null, homeL: home.leagueRecord ? home.leagueRecord.losses : null,
          status: newStatus, detailedState: detailed,
          inning: ls.currentInning || 1, halfInning: (ls.inningHalf || 'Top').toLowerCase(), outs: ls.outs || 0,
          awayHits: ls.teams && ls.teams.away ? ls.teams.away.hits || 0 : 0, homeHits: ls.teams && ls.teams.home ? ls.teams.home.hits || 0 : 0,
          playCount: 0, lastTimestamp: null, gameTime: gameTime, gameDateMs: gameDateMs,
          venueName: g.venue ? g.venue.name : null,
          onFirst: !!(ls.offense && ls.offense.first), onSecond: !!(ls.offense && ls.offense.second), onThird: !!(ls.offense && ls.offense.third),
        };
        if (!state.myTeamLens || state.gameStates[pk].awayId === state.activeTeam.id || state.gameStates[pk].homeId === state.activeTeam.id) state.enabledGames.add(pk);
        var g0 = state.gameStates[pk], ts0 = gameDateMs ? new Date(gameDateMs) : new Date();
        if (newStatus === 'Final') {
          var isHistPpd = detailed === 'Postponed' || detailed === 'Cancelled' || detailed === 'Suspended';
          if (isHistPpd) {
            if (!gameDateMs || Date.now() >= gameDateMs) addFeedItem(pk, { type: 'status', icon: '🌧️', label: 'Game Postponed', sub: g0.awayAbbr + ' @ ' + g0.homeAbbr, playTime: ts0 });
          } else {
            var durLabel = ls.gameDurationMinutes ? '  ·  ' + Math.floor(ls.gameDurationMinutes / 60) + 'h ' + String(ls.gameDurationMinutes % 60).padStart(2, '0') + 'm' : '';
            pendingFinalItems[pk] = { sub: g0.awayAbbr + ' ' + (away.score || 0) + ', ' + g0.homeAbbr + ' ' + (home.score || 0) + durLabel };
          }
        } else if (newStatus === 'Live' && detailed === 'In Progress') {
          addFeedItem(pk, { type: 'status', icon: '⚾', label: 'Game underway!', sub: g0.awayAbbr + ' @ ' + g0.homeAbbr, playTime: ts0 });
        } else if (detailed.toLowerCase().indexOf('delay') !== -1) {
          addFeedItem(pk, { type: 'status', icon: '🌧️', label: 'Game Delayed', sub: g0.awayAbbr + ' @ ' + g0.homeAbbr + ' · ' + detailed, playTime: ts0 });
        }
      } else {
        var prev = state.gameStates[pk];
        if (gameTime) prev.gameTime = gameTime; if (gameDateMs) prev.gameDateMs = gameDateMs;
        if (prev.detailedState !== 'In Progress' && detailed === 'In Progress') {
          var ts1 = gameDateMs ? new Date(gameDateMs) : new Date();
          addFeedItem(pk, { type: 'status', icon: '⚾', label: 'Game underway!', sub: prev.awayAbbr + ' @ ' + prev.homeAbbr, playTime: ts1 });
          playSound('gameStart');
        }
        if (prev.status !== 'Final' && newStatus === 'Final') {
          devTrace('poll', 'game final · ' + prev.awayAbbr + ' @ ' + prev.homeAbbr + ' · ' + prev.awayScore + '-' + prev.homeScore);
          var isGamePostponed = detailed === 'Postponed' || detailed === 'Cancelled' || detailed === 'Suspended';
          var tsFinal = gameDateMs ? new Date(gameDateMs + (ls.gameDurationMinutes || 180) * 60000) : new Date();
          if (isGamePostponed) { addFeedItem(pk, { type: 'status', icon: '🌧️', label: 'Game Postponed', sub: prev.awayAbbr + ' @ ' + prev.homeAbbr, playTime: tsFinal }); }
          else { addFeedItem(pk, { type: 'status', icon: '🏁', label: 'Game Final', sub: prev.awayAbbr + ' ' + (away.score || 0) + ', ' + prev.homeAbbr + ' ' + (home.score || 0), playTime: tsFinal }); playSound('gameEnd'); }
          delete state.perfectGameTracker[pk];
        }
        if (detailed.toLowerCase().indexOf('delay') !== -1 && prev.detailedState.toLowerCase().indexOf('delay') === -1) {
          var tsDelay = gameDateMs ? new Date(gameDateMs) : new Date();
          addFeedItem(pk, { type: 'status', icon: '🌧️', label: 'Game Delayed', sub: prev.awayAbbr + ' @ ' + prev.homeAbbr + ' · ' + detailed, playTime: tsDelay });
        }
        prev.detailedState = detailed; prev.status = newStatus;
        prev.awayScore = away.score || 0; prev.homeScore = home.score || 0;
        prev.inning = ls.currentInning || prev.inning; prev.halfInning = (ls.inningHalf || 'Top').toLowerCase();
        prev.outs = ls.outs || 0;
        if (ls.teams && ls.teams.away) prev.awayHits = ls.teams.away.hits || 0;
        if (ls.teams && ls.teams.home) prev.homeHits = ls.teams.home.hits || 0;
        prev.onFirst = !!(ls.offense && ls.offense.first); prev.onSecond = !!(ls.offense && ls.offense.second); prev.onThird = !!(ls.offense && ls.offense.third);
      }
    });
    var liveGames = games.filter(function(g) { return g.status.abstractGameState === 'Live' || pendingFinalItems[g.gamePk]; });
    await Promise.all(liveGames.map(function(g) { return pollGamePlays(g.gamePk); }));
    Object.keys(pendingFinalItems).forEach(function(pk) {
      var pf = pendingFinalItems[pk];
      var gamePlays = state.feedItems.filter(function(fi) { return fi.gamePk == pk && fi.data && fi.data.type === 'play'; });
      if (gamePlays.length > 0) addFeedItem(+pk, { type: 'status', icon: '🏁', label: 'Game Final', sub: pf.sub, playTime: new Date(gamePlays[0].ts.getTime() + 60000) });
    });
    if (state.isFirstPoll && state.feedItems.length > 0) { state.feedItems.sort(function(a, b) { return b.ts - a.ts; }); renderFeed(); }
    state.isFirstPoll = false;
    if (_updateInningStates) _updateInningStates();
    renderTicker(); updateFeedEmpty();
    renderSideRailGames();
    pollPendingVideoClips();
    selectFocusGame();
    if (typeof window !== 'undefined' && window.Recorder && window.Recorder.active) {
      window.Recorder._captureGameStates();
      window.Recorder._captureFocusTrack();
    }
    if (_refreshDebugPanel) _refreshDebugPanel();
    var live = Object.values(state.gameStates).filter(function(g) { return g.status === 'Live' && g.detailedState === 'In Progress'; }).length;
    var final = Object.values(state.gameStates).filter(function(g) { return g.status === 'Final'; }).length;
    devTrace('poll', 'pollLeaguePulse end · live=' + live + ' · final=' + final + ' · games=' + Object.keys(state.gameStates).length + ' · enabled=' + state.enabledGames.size + ' · state.feedItems=' + state.feedItems.length);
  } catch (e) { if (e.name !== 'AbortError') console.error('poll error', e); }
}

export async function pollGamePlays(gamePk) {
  try {
    var g = state.gameStates[gamePk]; if (!g) return;
    var tsResp = await fetch(MLB_BASE_V1_1 + '/game/' + gamePk + '/feed/live/timestamps');
    if (!tsResp.ok) throw new Error(tsResp.status);
    var tsData = await tsResp.json();
    var latestTs = Array.isArray(tsData) ? tsData[tsData.length - 1] : null;
    if (latestTs && latestTs === g.lastTimestamp) return;
    if (latestTs) g.lastTimestamp = latestTs;
    var r = await fetch(MLB_BASE + '/game/' + gamePk + '/playByPlay');
    if (!r.ok) throw new Error(r.status);
    var data = await r.json();
    var plays = (data.allPlays || []).filter(function(p) { return p.about && p.about.isComplete; });
    var lastCount = g.playCount || 0, isHistory = (lastCount === 0 && plays.length > 0) || state.tabHiddenAt !== null;
    plays.slice(lastCount).forEach(function(play) {
      var event = (play.result && play.result.event) || '';
      var isScoringP = (play.about && play.about.isScoringPlay) || false;
      var aScore = (play.result && play.result.awayScore != null) ? play.result.awayScore : g.awayScore;
      var hScore = (play.result && play.result.homeScore != null) ? play.result.homeScore : g.homeScore;
      var inning = (play.about && play.about.inning) || g.inning;
      var halfInning = (play.about && play.about.halfInning) || g.halfInning;
      var outs = (play.count && play.count.outs) || 0;
      var desc = (play.result && play.result.description) || '—';
      var batterId = (play.matchup && play.matchup.batter && play.matchup.batter.id) || null;
      var batterName = (play.matchup && play.matchup.batter && play.matchup.batter.fullName) || '';
      var runners = play.runners || [];
      if (event.indexOf('Stolen Base') !== -1) {
        if (!isHistory) {
          var sbRunner = runners.find(function(r) { return r.details && r.details.eventType && r.details.eventType.indexOf('stolen_base') !== -1; });
          var sbRunnerId = (sbRunner && sbRunner.details && sbRunner.details.runner && sbRunner.details.runner.id) || batterId;
          var sbRunnerName = (sbRunner && sbRunner.details && sbRunner.details.runner && sbRunner.details.runner.fullName) || batterName;
          var sbBase = event.indexOf('Home') !== -1 ? 'home' : event.indexOf('3B') !== -1 ? '3B' : '2B';
          var sbKey = gamePk + '_' + (play.about && play.about.atBatIndex != null ? play.about.atBatIndex : g.playCount + plays.indexOf(play));
          if (!state.stolenBaseEvents.some(function(e) { return e.key === sbKey; })) {
            state.stolenBaseEvents.push({ key: sbKey, gamePk: gamePk, runnerId: sbRunnerId, runnerName: sbRunnerName, base: sbBase, inning: inning, halfInning: halfInning, awayAbbr: g.awayAbbr, homeAbbr: g.homeAbbr, ts: playTime || new Date() });
          }
        }
        return;
      }
      var hasRISP = outs < 3 && runners.some(function(r) { return r.movement && !r.movement.isOut && (r.movement.end === '2B' || r.movement.end === '3B'); });
      var playClass = event === 'Home Run' ? 'homerun' : isScoringP ? 'scoring' : hasRISP ? 'risp' : 'normal';
      var playTime = null; if (play.about && play.about.startTime) { try { playTime = new Date(play.about.startTime); } catch (e) {} }
      var pitcherId = (play.matchup && play.matchup.pitcher && play.matchup.pitcher.id) || null;
      var pitcherName = (play.matchup && play.matchup.pitcher && play.matchup.pitcher.fullName) || '';
      var hrDistance = (event === 'Home Run' && play.hitData && play.hitData.totalDistance > 0) ? Math.round(play.hitData.totalDistance) : null;
      addFeedItem(gamePk, { type: 'play', event: event, desc: desc, scoring: isScoringP, awayScore: aScore, homeScore: hScore, inning: inning, halfInning: halfInning, outs: outs, risp: hasRISP, playClass: playClass, playTime: playTime, batterId: batterId, batterName: batterName, pitcherName: pitcherName, distance: hrDistance });
      if (typeof window !== 'undefined' && window.Recorder && window.Recorder.active) {
        window.Recorder._capturePlayPitches(play, gamePk, g);
      }
      var isHitEvt = ['Single', 'Double', 'Triple', 'Home Run'].indexOf(event) !== -1;
      if (state.perfectGameTracker[gamePk] === undefined) state.perfectGameTracker[gamePk] = true;
      if (['Walk', 'Hit By Pitch', 'Intentional Walk', 'Error', 'Fielders Choice', 'Catcher Interference'].indexOf(event) !== -1) state.perfectGameTracker[gamePk] = false;
      if (isHitEvt) state.perfectGameTracker[gamePk] = false;
      if (isHitEvt && batterId) { var dh = state.dailyHitsTracker[batterId] || { name: batterName, hits: 0, hrs: 0, gamePk: gamePk }; dh.hits++; if (event === 'Home Run') dh.hrs++; dh.name = batterName || dh.name; dh.gamePk = gamePk; state.dailyHitsTracker[batterId] = dh; }
      if (event === 'Strikeout' && pitcherId) { var kkey = gamePk + '_' + pitcherId; var ke = state.dailyPitcherKs[kkey] || { name: pitcherName, ks: 0, gamePk: gamePk }; ke.ks++; ke.name = pitcherName || ke.name; state.dailyPitcherKs[kkey] = ke; }
      if (!isHistory) {
        var teamColor = halfInning === 'top' ? g.awayPrimary : g.homePrimary;
        var gameVisible = state.enabledGames.has(gamePk);
        if (event === 'Home Run') { playSound('hr'); if (batterId && gameVisible) { var _hrRbi = (play.result && play.result.rbi != null) ? play.result.rbi : 1; var _badge = getHRBadge(_hrRbi, halfInning, inning, aScore, hScore); showPlayerCard(batterId, batterName, g.awayId, g.homeId, halfInning, null, desc, _badge, gamePk); } }
        else if (isScoringP) {
          var _rbi = (play.result && play.result.rbi != null) ? play.result.rbi : 0;
          var _rs = calcRBICardScore(_rbi, event, aScore, hScore, inning, halfInning);
          var _rbiOk = (Date.now() - (state.rbiCardCooldowns[gamePk] || 0)) >= state.devTuning.rbiCooldown;
          if (_rbi > 0 && _rs >= state.devTuning.rbiThreshold && gameVisible && batterId && _rbiOk) {
            state.rbiCardCooldowns[gamePk] = Date.now();
            showRBICard(batterId, batterName, g.awayId, g.homeId, halfInning, _rbi, event, aScore, hScore, inning, gamePk);
          } else {
            if (gameVisible) showAlert({ icon: '🟢', event: 'RUN SCORES · ' + g.awayAbbr + ' ' + aScore + ', ' + g.homeAbbr + ' ' + hScore, desc: desc, color: teamColor, duration: 4000 });
          }
          playSound('run');
        }
        else if (event.indexOf('Triple Play') !== -1) { if (gameVisible) showAlert({ icon: '🔀', event: 'TRIPLE PLAY · ' + g.awayAbbr + ' @ ' + g.homeAbbr, desc: desc, color: '#9b59b6', duration: 5000 }); playSound('tp'); }
        else if (event.indexOf('Double Play') !== -1 || event.indexOf('Grounded Into DP') !== -1) { playSound('dp'); }
        else if (event.indexOf('Error') !== -1) { playSound('error'); }
        else if (hasRISP) { playSound('risp'); }
        if (outs === 3) { var _rk = gamePk + '_' + inning + '_' + halfInning.toLowerCase(); if (!state.inningRecapsFired.has(_rk)) state.inningRecapsPending[_rk] = { gamePk: gamePk, inning: inning, halfInning: halfInning.toLowerCase() }; }
      }
    });
    plays.forEach(function(play) {
      if (play.result && play.result.event === 'Home Run') {
        var newDesc = (play.result.description) || '';
        var pt = null; try { if (play.about && play.about.startTime) pt = new Date(play.about.startTime); } catch (e) {}
        var found = state.feedItems.find(function(i) { return i.gamePk === gamePk && i.data && i.data.event === 'Home Run' && pt && i.ts && Math.abs(i.ts.getTime() - pt.getTime()) < 5000; });
        if (found) {
          if (!found.data.distance && play.hitData && play.hitData.totalDistance > 0) found.data.distance = Math.round(play.hitData.totalDistance);
          if (newDesc.match(/\(\d+\)/) && !(found.data.desc || '').match(/\(\d+\)/)) found.data.desc = newDesc;
        }
      }
    });
    g.playCount = plays.length;
  } catch (e) {}
}
