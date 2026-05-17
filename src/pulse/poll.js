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
import { tcLookup, etHour, etDateStr, etDatePlus } from '../utils/format.js';
import { devTrace } from '../devtools-feed/devLog.js';
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
  const sig = state.pulseAbortCtrl.signal;
  const hasLive = Object.values(state.gameStates).some(function(g) { return g.status === 'Live'; });
  devTrace('poll', 'pollLeaguePulse start · hasLive=' + hasLive + ' · pollDate=' + state.pollDateStr + ' · games=' + Object.keys(state.gameStates).length + ' · enabled=' + state.enabledGames.size);
  const isMidnightWindow = !state.demoMode && etHour() < 6;
  if (!hasLive) {
    const hasGamesFromCurrentDate = state.pollDateStr && Object.values(state.gameStates).some(function(g) {
      return g.gameDateMs && _localDateStr(new Date(g.gameDateMs)) === state.pollDateStr;
    });
    if (!hasGamesFromCurrentDate && !isMidnightWindow) {
      state.pollDateStr = _localDateStr(getEffectiveDate());
    }
    else if (!isMidnightWindow && isPostSlate()) {
      const todayStr = _localDateStr(getEffectiveDate());
      if (state.pollDateStr < todayStr) {
        if (_pruneStaleGames) _pruneStaleGames(todayStr);
        state.pollDateStr = todayStr;
      }
    }
  }
  let dateStr = state.pollDateStr;
  try {
    const r = await fetch(MLB_BASE + '/schedule?sportId=1&date=' + dateStr + '&hydrate=linescore,team,probablePitcher', { signal: sig });
    if (!r.ok) throw new Error(r.status);
    const d = await r.json();
    let games = (d.dates || []).flatMap(function(dt) { return dt.games || []; });
    devTrace('poll', 'schedule fetch · date=' + dateStr + ' · games=' + games.length);

    const hasLiveInFetch = games.some(function(g) { return g.status.abstractGameState === 'Live'; });
    if ((!games.length || (isMidnightWindow && !hasLiveInFetch)) && !hasLive) {
      const yDateStr = etDatePlus(etDateStr(), -1);
      const yr = await fetch(MLB_BASE + '/schedule?sportId=1&date=' + yDateStr + '&hydrate=linescore,team,probablePitcher', { signal: sig });
      if (!yr.ok) throw new Error(yr.status);
      const yd = await yr.json();
      const yGames = (yd.dates || []).flatMap(function(dt) { return dt.games || []; });
      if (yGames.length) {
        games = yGames;
        dateStr = yDateStr;
        state.pollDateStr = dateStr;
      }
    }
    state.storyCarouselRawGameData = {};
    games.forEach(function(g) { state.storyCarouselRawGameData[g.gamePk] = g; });
    const pendingFinalItems = {};
    games.forEach(function(g) {
      const pk = g.gamePk, newStatus = g.status.abstractGameState, detailed = g.status.detailedState || '';
      const away = g.teams.away, home = g.teams.home;
      const awayTc = tcLookup(away.team.id), homeTc = tcLookup(home.team.id);
      let ls = g.linescore || {}, gameTime = null, gameDateMs = null;
      if (g.gameDate) {
        try { const gd = new Date(g.gameDate); gameTime = gd.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); gameDateMs = gd.getTime(); } catch (e) {}
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
        const g0 = state.gameStates[pk], ts0 = gameDateMs ? new Date(gameDateMs) : new Date();
        if (newStatus === 'Final') {
          const isHistPpd = detailed === 'Postponed' || detailed === 'Cancelled' || detailed === 'Suspended';
          if (isHistPpd) {
            if (!gameDateMs || Date.now() >= gameDateMs) addFeedItem(pk, { type: 'status', icon: '🌧️', label: 'Game Postponed', sub: g0.awayAbbr + ' @ ' + g0.homeAbbr, playTime: ts0 });
          } else {
            const durLabel = ls.gameDurationMinutes ? '  ·  ' + Math.floor(ls.gameDurationMinutes / 60) + 'h ' + String(ls.gameDurationMinutes % 60).padStart(2, '0') + 'm' : '';
            pendingFinalItems[pk] = { sub: g0.awayAbbr + ' ' + (away.score || 0) + ', ' + g0.homeAbbr + ' ' + (home.score || 0) + durLabel };
          }
        } else if (newStatus === 'Live' && detailed === 'In Progress') {
          addFeedItem(pk, { type: 'status', icon: '⚾', label: 'Game underway!', sub: g0.awayAbbr + ' @ ' + g0.homeAbbr, playTime: ts0 });
        } else if (detailed.toLowerCase().indexOf('delay') !== -1) {
          addFeedItem(pk, { type: 'status', icon: '🌧️', label: 'Game Delayed', sub: g0.awayAbbr + ' @ ' + g0.homeAbbr + ' · ' + detailed, playTime: ts0 });
        }
      } else {
        const prev = state.gameStates[pk];
        if (gameTime) prev.gameTime = gameTime; if (gameDateMs) prev.gameDateMs = gameDateMs;
        if (prev.detailedState !== 'In Progress' && detailed === 'In Progress') {
          const ts1 = gameDateMs ? new Date(gameDateMs) : new Date();
          addFeedItem(pk, { type: 'status', icon: '⚾', label: 'Game underway!', sub: prev.awayAbbr + ' @ ' + prev.homeAbbr, playTime: ts1 });
          playSound('gameStart');
        }
        if (prev.status !== 'Final' && newStatus === 'Final') {
          devTrace('poll', 'game final · ' + prev.awayAbbr + ' @ ' + prev.homeAbbr + ' · ' + prev.awayScore + '-' + prev.homeScore);
          const isGamePostponed = detailed === 'Postponed' || detailed === 'Cancelled' || detailed === 'Suspended';
          const tsFinal = gameDateMs ? new Date(gameDateMs + (ls.gameDurationMinutes || 180) * 60000) : new Date();
          if (isGamePostponed) { addFeedItem(pk, { type: 'status', icon: '🌧️', label: 'Game Postponed', sub: prev.awayAbbr + ' @ ' + prev.homeAbbr, playTime: tsFinal }); }
          else { addFeedItem(pk, { type: 'status', icon: '🏁', label: 'Game Final', sub: prev.awayAbbr + ' ' + (away.score || 0) + ', ' + prev.homeAbbr + ' ' + (home.score || 0), playTime: tsFinal }); playSound('gameEnd'); }
          delete state.perfectGameTracker[pk];
        }
        if (detailed.toLowerCase().indexOf('delay') !== -1 && prev.detailedState.toLowerCase().indexOf('delay') === -1) {
          const tsDelay = gameDateMs ? new Date(gameDateMs) : new Date();
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
    const liveGames = games.filter(function(g) { return g.status.abstractGameState === 'Live' || pendingFinalItems[g.gamePk]; });
    await Promise.all(liveGames.map(function(g) { return pollGamePlays(g.gamePk); }));
    Object.keys(pendingFinalItems).forEach(function(pk) {
      const pf = pendingFinalItems[pk];
      const gamePlays = state.feedItems.filter(function(fi) { return fi.gamePk == pk && fi.data && fi.data.type === 'play'; });
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
    const live = Object.values(state.gameStates).filter(function(g) { return g.status === 'Live' && g.detailedState === 'In Progress'; }).length;
    const final = Object.values(state.gameStates).filter(function(g) { return g.status === 'Final'; }).length;
    devTrace('poll', 'pollLeaguePulse end · live=' + live + ' · final=' + final + ' · games=' + Object.keys(state.gameStates).length + ' · enabled=' + state.enabledGames.size + ' · state.feedItems=' + state.feedItems.length);
  } catch (e) { if (e.name !== 'AbortError') console.error('poll error', e); }
}

export async function pollGamePlays(gamePk) {
  try {
    const g = state.gameStates[gamePk]; if (!g) return;
    const tsResp = await fetch(MLB_BASE_V1_1 + '/game/' + gamePk + '/feed/live/timestamps');
    if (!tsResp.ok) throw new Error(tsResp.status);
    const tsData = await tsResp.json();
    const latestTs = Array.isArray(tsData) ? tsData[tsData.length - 1] : null;
    if (latestTs && latestTs === g.lastTimestamp) return;
    if (latestTs) g.lastTimestamp = latestTs;
    const r = await fetch(MLB_BASE + '/game/' + gamePk + '/playByPlay');
    if (!r.ok) throw new Error(r.status);
    const data = await r.json();
    const plays = (data.allPlays || []).filter(function(p) { return p.about && p.about.isComplete; });
    const lastCount = g.playCount || 0, isHistory = (lastCount === 0 && plays.length > 0) || state.tabHiddenAt !== null;
    plays.slice(lastCount).forEach(function(play) {
      const event = (play.result && play.result.event) || '';
      const isScoringP = (play.about && play.about.isScoringPlay) || false;
      const aScore = (play.result && play.result.awayScore != null) ? play.result.awayScore : g.awayScore;
      const hScore = (play.result && play.result.homeScore != null) ? play.result.homeScore : g.homeScore;
      const inning = (play.about && play.about.inning) || g.inning;
      const halfInning = (play.about && play.about.halfInning) || g.halfInning;
      const outs = (play.count && play.count.outs) || 0;
      const desc = (play.result && play.result.description) || '—';
      const batterId = (play.matchup && play.matchup.batter && play.matchup.batter.id) || null;
      const batterName = (play.matchup && play.matchup.batter && play.matchup.batter.fullName) || '';
      const runners = play.runners || [];
      const hasRISP = outs < 3 && runners.some(function(r) { return r.movement && !r.movement.isOut && (r.movement.end === '2B' || r.movement.end === '3B'); });
      // Post-play base occupancy — derived from runner movement endings so demo
      // mode can populate g.onFirst/onSecond/onThird per play (drives ticker
      // chip RISP expansion + focus card diamond without an extra linescore call).
      let postOnFirst = false, postOnSecond = false, postOnThird = false;
      runners.forEach(function(rn) {
        const m = rn.movement || {};
        if (!m.end || m.isOut) return;
        if (m.end === '1B') postOnFirst = true;
        else if (m.end === '2B') postOnSecond = true;
        else if (m.end === '3B') postOnThird = true;
      });
      const playClass = event === 'Home Run' ? 'homerun' : isScoringP ? 'scoring' : hasRISP ? 'risp' : 'normal';
      let playTime = null; if (play.about && play.about.startTime) { try { playTime = new Date(play.about.startTime); } catch (e) {} }
      const pitcherId = (play.matchup && play.matchup.pitcher && play.matchup.pitcher.id) || null;
      const pitcherName = (play.matchup && play.matchup.pitcher && play.matchup.pitcher.fullName) || '';
      const hrDistance = (event === 'Home Run' && play.hitData && play.hitData.totalDistance > 0) ? Math.round(play.hitData.totalDistance) : null;
      const hrSpeed = (event === 'Home Run' && play.hitData && play.hitData.launchSpeed > 0) ? Math.round(play.hitData.launchSpeed) : null;
      const playRbi = (play.result && play.result.rbi != null) ? play.result.rbi : null;
      addFeedItem(gamePk, { type: 'play', event: event, desc: desc, scoring: isScoringP, awayScore: aScore, homeScore: hScore, inning: inning, halfInning: halfInning, outs: outs, risp: hasRISP, playClass: playClass, playTime: playTime, batterId: batterId, batterName: batterName, pitcherId: pitcherId, pitcherName: pitcherName, distance: hrDistance, speed: hrSpeed, rbi: playRbi, onFirst: postOnFirst, onSecond: postOnSecond, onThird: postOnThird, awayHits: g.awayHits, homeHits: g.homeHits });
      if (typeof window !== 'undefined' && window.Recorder && window.Recorder.active) {
        window.Recorder._capturePlayPitches(play, gamePk, g);
      }
      const isHitEvt = ['Single', 'Double', 'Triple', 'Home Run'].indexOf(event) !== -1;
      if (state.perfectGameTracker[gamePk] === undefined) state.perfectGameTracker[gamePk] = true;
      if (['Walk', 'Hit By Pitch', 'Intentional Walk', 'Error', 'Fielders Choice', 'Catcher Interference'].indexOf(event) !== -1) state.perfectGameTracker[gamePk] = false;
      if (isHitEvt) state.perfectGameTracker[gamePk] = false;
      if (isHitEvt && batterId) { const dh = state.dailyHitsTracker[batterId] || { name: batterName, hits: 0, hrs: 0, gamePk: gamePk }; dh.hits++; if (event === 'Home Run') dh.hrs++; dh.name = batterName || dh.name; dh.gamePk = gamePk; state.dailyHitsTracker[batterId] = dh; }
      if (event === 'Strikeout' && pitcherId) { const kkey = gamePk + '_' + pitcherId; const ke = state.dailyPitcherKs[kkey] || { name: pitcherName, ks: 0, gamePk: gamePk }; ke.ks++; ke.name = pitcherName || ke.name; state.dailyPitcherKs[kkey] = ke; }
      if (!isHistory) {
        const gameVisible = state.enabledGames.has(gamePk);
        if (event === 'Home Run') { playSound('hr'); if (batterId && gameVisible) { const _hrRbi = (play.result && play.result.rbi != null) ? play.result.rbi : 1; const _badge = getHRBadge(_hrRbi, halfInning, inning, aScore, hScore); showPlayerCard(batterId, batterName, g.awayId, g.homeId, halfInning, null, desc, _badge, gamePk); } }
        else if (isScoringP) {
          const _rbi = (play.result && play.result.rbi != null) ? play.result.rbi : 0;
          const _rs = calcRBICardScore(_rbi, event, aScore, hScore, inning, halfInning);
          const _rbiOk = (Date.now() - (state.rbiCardCooldowns[gamePk] || 0)) >= state.devTuning.rbiCooldown;
          if (_rbi > 0 && _rs >= state.devTuning.rbiThreshold && gameVisible && batterId && _rbiOk) {
            state.rbiCardCooldowns[gamePk] = Date.now();
            showRBICard(batterId, batterName, g.awayId, g.homeId, halfInning, _rbi, event, aScore, hScore, inning, gamePk);
          }
          playSound('run');
        }
        else if (event.indexOf('Triple Play') !== -1) { if (gameVisible) showAlert({ icon: '🔀', event: 'TRIPLE PLAY · ' + g.awayAbbr + ' @ ' + g.homeAbbr, desc: desc, color: '#9b59b6', duration: 5000 }); playSound('tp'); }
        else if (event.indexOf('Double Play') !== -1 || event.indexOf('Grounded Into DP') !== -1) { playSound('dp'); }
        else if (event.indexOf('Error') !== -1) { playSound('error'); }
        else if (hasRISP) { playSound('risp'); }
        if (outs === 3) { const _rk = gamePk + '_' + inning + '_' + halfInning.toLowerCase(); if (!state.inningRecapsFired.has(_rk)) state.inningRecapsPending[_rk] = { gamePk: gamePk, inning: inning, halfInning: halfInning.toLowerCase() }; }
      }
    });
    if (!isHistory) {
      const allPlaysForActions = data.allPlays || [];
      allPlaysForActions.forEach(function(play) {
        const pe = play.playEvents || [];
        const about = play.about || {};
        pe.forEach(function(ev) {
          if (ev.type !== 'action' && ev.type !== 'pickoff') return;
          const det = ev.details || {};
          const evId = ev.playId || (gamePk + '_' + about.atBatIndex + '_' + (ev.index != null ? ev.index : 'na'));
          if (state.seenActionEventIds.has(evId)) return;
          const evType = (det.eventType || '').toLowerCase();
          const desc = det.description || '';
          const ts = ev.startTime ? new Date(ev.startTime) : new Date();
          const ctx = { key: evId, gamePk: gamePk, awayAbbr: g.awayAbbr, homeAbbr: g.homeAbbr,
            inning: about.inning || g.inning, halfInning: about.halfInning || g.halfInning, ts: ts, desc: desc };
          const actionRunners = play.runners || [];
          const findRunner = function(et) { const rr = actionRunners.find(function(r) { return r.details && r.details.eventType === et; }); return (rr && rr.details) || {}; };
          if (evType.indexOf('stolen_base') === 0) {
            const sbBase = evType === 'stolen_base_home' ? 'home' : evType === 'stolen_base_3b' ? '3B' : '2B';
            const sbR = findRunner(evType);
            state.stolenBaseEvents.push(Object.assign({}, ctx, { runnerId: sbR.runner ? sbR.runner.id : null, runnerName: sbR.runner ? sbR.runner.fullName : '', base: sbBase, caught: false }));
          } else if (evType.indexOf('caught_stealing') === 0) {
            const csBase = evType === 'caught_stealing_home' ? 'home' : evType === 'caught_stealing_3b' ? '3B' : '2B';
            const csR = findRunner(evType);
            state.stolenBaseEvents.push(Object.assign({}, ctx, { runnerId: csR.runner ? csR.runner.id : null, runnerName: csR.runner ? csR.runner.fullName : '', base: csBase, caught: true }));
          } else if (evType.indexOf('pickoff_caught_stealing') === 0) {
            const poBase = evType.indexOf('home') !== -1 ? 'home' : evType.indexOf('3b') !== -1 ? '3B' : evType.indexOf('2b') !== -1 ? '2B' : '1B';
            const poR = findRunner(evType);
            state.actionEvents.push(Object.assign({}, ctx, { kind: 'pickoff_out', base: poBase, runnerId: poR.runner ? poR.runner.id : null, runnerName: poR.runner ? poR.runner.fullName : '' }));
          } else if (evType === 'pitching_substitution') {
            const newP = (play.matchup && play.matchup.pitcher) || {};
            state.actionEvents.push(Object.assign({}, ctx, { kind: 'pitching_change', pitcherId: newP.id || null, pitcherName: newP.fullName || '' }));
          } else if (evType === 'offensive_substitution') {
            const isPH = desc.indexOf('Pinch-hitter') !== -1;
            const isPR = desc.indexOf('Pinch-runner') !== -1;
            if (!isPH && !isPR) return;
            state.actionEvents.push(Object.assign({}, ctx, { kind: isPH ? 'pinch_hitter' : 'pinch_runner' }));
          } else if (evType === 'game_advisory') {
            const isReview = desc.indexOf('Manager challenged') !== -1 || desc.indexOf('Crew chief review') !== -1 || desc.indexOf('Replay Review') !== -1;
            if (!isReview) return;
            state.actionEvents.push(Object.assign({}, ctx, { kind: 'replay_review' }));
          } else { return; }
          state.seenActionEventIds.add(evId);
        });
      });
    }
    plays.forEach(function(play) {
      if (play.result && play.result.event === 'Home Run') {
        const newDesc = (play.result.description) || '';
        let pt = null; try { if (play.about && play.about.startTime) pt = new Date(play.about.startTime); } catch (e) {}
        const found = state.feedItems.find(function(i) { return i.gamePk === gamePk && i.data && i.data.event === 'Home Run' && pt && i.ts && Math.abs(i.ts.getTime() - pt.getTime()) < 5000; });
        if (found) {
          if (!found.data.distance && play.hitData && play.hitData.totalDistance > 0) found.data.distance = Math.round(play.hitData.totalDistance);
          if (!found.data.speed && play.hitData && play.hitData.launchSpeed > 0) found.data.speed = Math.round(play.hitData.launchSpeed);
          if (newDesc.match(/\(\d+\)/) && !(found.data.desc || '').match(/\(\d+\)/)) found.data.desc = newDesc;
        }
      }
    });
    g.playCount = plays.length;
  } catch (e) {}
}
