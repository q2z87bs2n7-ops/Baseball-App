// ── HR / RBI Player Card Display ────────────────────────────────────────────
// Pulse-card overlay shown when a HR or key RBI fires (live or via replay/collection).
//   - resolvePlayerCardData() — gather batter stats, jersey, position
//   - showPlayerCard()  — HR card path; calls collectCard on success
//   - showRBICard()     — RBI card path; calls collectCard on success
//   - badge helpers (getHRBadge, getRBIBadge) + RBI score calc
//   - replayHRCard / replayRBICard — Dev Tools (Shift+H / Shift+B)

import { state } from '../state.js';
import { TEAMS, MLB_BASE, SEASON, TIMING } from '../config/constants.js';
import { fmtRate } from '../utils/format.js';
import { dismissPlayerCard } from '../ui/overlays.js';

let _fetchBoxscore = null;
let _collectCard = null;

export function setPlayerCardCallbacks(cbs) {
  if (cbs.fetchBoxscore) _fetchBoxscore = cbs.fetchBoxscore;
  if (cbs.collectCard) _collectCard = cbs.collectCard;
}

// HR badge text — escalates by walk-off / grand slam / go-ahead context.
export function getHRBadge(rbi, halfInning, inning, aScore, hScore) {
  var battingAfter = halfInning === 'bottom' ? hScore : aScore;
  var fieldingScore = halfInning === 'bottom' ? aScore : hScore;
  var battingBefore = battingAfter - rbi;
  var deficitBefore = fieldingScore - battingBefore;
  var marginAfter = battingAfter - fieldingScore;
  var isWalkoff = halfInning === 'bottom' && inning >= 9 && deficitBefore >= 0 && marginAfter > 0;
  var isGoAhead = deficitBefore >= 0 && marginAfter > 0;
  var isGrandSlam = rbi === 4;
  if (isWalkoff && isGrandSlam) return 'WALK-OFF GRAND SLAM!';
  if (isWalkoff) return 'WALK-OFF HOME RUN!';
  if (isGrandSlam) return 'GRAND SLAM!';
  if (isGoAhead) return 'GO-AHEAD HOME RUN!';
  return '💥 HOME RUN!';
}

// Composite priority score for RBI cards. Inputs: rbi count, hit type,
// pre-/post-play scoreboard, inning, half. Higher = more dramatic.
export function calcRBICardScore(rbi, event, aScore, hScore, inning, halfInning) {
  if (!rbi || rbi < 1) return 0;
  var base = rbi === 1 ? 10 : rbi === 2 ? 25 : rbi === 3 ? 40 : 55;
  var hitMult = event === 'Double' ? 1.5 : event === 'Triple' ? 2.0 :
    (['Sac Fly','Sac Bunt','Walk','Hit By Pitch','Grounded Into DP','Field\'s Choice'].indexOf(event) !== -1 ? 0.7 : 1.0);
  var battingAfter = halfInning === 'top' ? aScore : hScore;
  var fieldingScore = halfInning === 'top' ? hScore : aScore;
  var battingBefore = battingAfter - rbi;
  var deficitBefore = fieldingScore - battingBefore; // positive = batting team was behind
  var marginAfter = battingAfter - fieldingScore;    // positive = batting team now leads
  var ctx = 0;
  if (deficitBefore >= 0 && marginAfter > 0) ctx += 30;       // go-ahead
  else if (deficitBefore > 0 && marginAfter === 0) ctx += 25; // equalizer
  if (deficitBefore >= 3 && marginAfter >= -1) ctx += 20;     // comeback component
  if (marginAfter - rbi >= 5) ctx -= 15;                      // was already leading by 5+
  var innMult = inning <= 3 ? 0.4 : inning <= 6 ? 0.75 : inning <= 8 ? 1.0 : inning === 9 ? 1.4 : 1.6;
  var score = (base * hitMult + ctx) * innMult;
  return score;
}

export function getRBIBadge(rbi, event, halfInning, inning, deficitBefore, marginAfter) {
  var lm = {'Single':'SINGLE','Double':'DOUBLE','Triple':'TRIPLE','Sac Fly':'SAC FLY','Walk':'WALK','Hit By Pitch':'HBP'};
  var label = lm[event] || null;
  var goAhead = deficitBefore >= 0 && marginAfter > 0;
  var equalizer = deficitBefore > 0 && marginAfter === 0;
  if (goAhead && halfInning === 'bottom' && inning >= 9 && label) return 'WALK-OFF ' + label + '!';
  if (goAhead && label) return 'GO-AHEAD ' + label + '!';
  if (equalizer && label) return label + ' TIES IT!';
  if (rbi >= 2 && label) return rbi + '-RUN ' + label;
  if (label) return 'RBI ' + label + '!';
  return 'RBI!';
}

// Resolve all data needed to render an HR card: batter stats (cached → API),
// jersey + position (state.rosterData → boxscore fallback), and HR count.
async function resolvePlayerCardData(batterId, batterName, awayTeamId, homeTeamId, halfInning, overrideStats, descHint, gamePk) {
  var battingTeamId = halfInning === 'top' ? awayTeamId : homeTeamId;
  var teamData = TEAMS.find(function(t) { return t.id === battingTeamId; }) || {};
  var stat = null, jerseyNumber = null, position = null;
  if (overrideStats) {
    stat = overrideStats;
  } else {
    var cached = (state.statsCache.hitting || []).find(function(e) { return e.player && e.player.id === batterId; });
    if (cached) { stat = cached.stat; }
    if (!stat) {
      try {
        var r = await fetch(MLB_BASE + '/people/' + batterId + '/stats?stats=season&season=' + SEASON + '&group=hitting');
        if (!r.ok) throw new Error(r.status);
        var d = await r.json();
        stat = d.stats && d.stats[0] && d.stats[0].splits && d.stats[0].splits[0] && d.stats[0].splits[0].stat;
      } catch (e) { stat = null; }
    }
  }
  if (stat && batterId) state.hrBatterStatsCache[batterId] = stat;
  var rEntry = (state.rosterData.hitting || []).find(function(p) { return p.person && p.person.id === batterId; });
  if (!rEntry) rEntry = (state.rosterData.pitching || []).find(function(p) { return p.person && p.person.id === batterId; });
  if (rEntry && rEntry.jerseyNumber) jerseyNumber = rEntry.jerseyNumber;
  position = (rEntry && rEntry.position && rEntry.position.abbreviation) || null;
  if (!position && overrideStats && overrideStats._position) position = overrideStats._position;
  if (!jerseyNumber && overrideStats && overrideStats._jersey) jerseyNumber = overrideStats._jersey;
  if ((!position || !jerseyNumber) && gamePk && _fetchBoxscore) {
    try {
      var bs = await _fetchBoxscore(gamePk);
      var allPlayers = Object.values(bs.teams.away.players).concat(Object.values(bs.teams.home.players));
      var playerData = allPlayers.find(function(p) { return p.person && p.person.id === batterId; });
      if (playerData) {
        if (!jerseyNumber && playerData.jerseyNumber) jerseyNumber = playerData.jerseyNumber;
        if (!position && playerData.position && playerData.position.code) {
          var posCode = playerData.position.code;
          var posMap = {'1':'P','2':'C','3':'1B','4':'2B','5':'3B','6':'SS','7':'LF','8':'CF','9':'RF','10':'DH'};
          position = posMap[posCode] || playerData.position.code;
        }
      }
    } catch (e) {}
  }
  var hrCount = stat ? (stat.homeRuns != null ? stat.homeRuns : '—') : '—';
  if (descHint) { var _m = descHint.match(/\((\d+)\)/); if (_m) { var _n = parseInt(_m[1], 10); if (typeof hrCount !== 'number' || hrCount < _n) hrCount = _n; } }
  return {
    batterId: batterId,
    batterName: batterName,
    teamData: teamData,
    teamAbbr: teamData.short || '???',
    jerseyNumber: jerseyNumber,
    position: position || '—',
    hrCount: hrCount,
    hrPrev: (typeof hrCount === 'number' && hrCount >= 1) ? hrCount - 1 : hrCount,
    avg: stat ? fmtRate(stat.avg) : '—',
    ops: stat ? fmtRate(stat.ops) : '—',
    rbi: stat ? (stat.rbi != null ? stat.rbi : '—') : '—',
  };
}

export async function showPlayerCard(batterId, batterName, awayTeamId, homeTeamId, halfInning, overrideStats, descHint, badgeText, gamePk) {
  var overlay = document.getElementById('playerCardOverlay');
  var card = document.getElementById('playerCard');
  if (!overlay || !card) return;
  card.innerHTML = '<div class="pc-loading">Loading player card…</div>';
  overlay.classList.remove('closing');
  overlay.classList.add('open');
  var d = await resolvePlayerCardData(batterId, batterName, awayTeamId, homeTeamId, halfInning, overrideStats, descHint, gamePk);
  card.innerHTML = window.PulseCard.render({
    batterId: d.batterId,
    name: d.batterName,
    team: { short: d.teamAbbr, primary: d.teamData.primary, secondary: d.teamData.secondary },
    position: d.position,
    jersey: d.jerseyNumber,
    badge: (badgeText || 'HOME RUN'),
    stats: { avg: d.avg, ops: d.ops, hr: d.hrPrev, rbi: d.rbi },
    highlight: 'hr',
  });
  if (typeof d.hrCount === 'number' && d.hrCount >= 1) {
    setTimeout(function() {
      var el = card.querySelector('.pc-hr-val');
      if (el) { el.textContent = d.hrCount; el.classList.add('counting'); }
    }, 500);
  }
  if (window._playerCardTimer) clearTimeout(window._playerCardTimer);
  window._playerCardTimer = setTimeout(dismissPlayerCard, TIMING.CARD_DISMISS_MS);
  if (_collectCard) {
    var gs = state.gameStates[gamePk] || {};
    _collectCard({
      playerId: d.batterId, playerName: d.batterName,
      teamAbbr: d.teamAbbr, teamPrimary: d.teamData.primary, teamSecondary: d.teamData.secondary,
      position: d.position || '',
      eventType: 'HR', badge: badgeText || '💥 HOME RUN!',
      inning: gs.inning || 0, halfInning: halfInning,
      awayAbbr: gs.awayAbbr || '', homeAbbr: gs.homeAbbr || '',
      awayScore: gs.awayScore || 0, homeScore: gs.homeScore || 0,
    });
  }
}

export async function showRBICard(batterId, batterName, awayTeamId, homeTeamId, halfInning, rbi, event, aScore, hScore, inning, gamePk) {
  var overlay = document.getElementById('playerCardOverlay');
  var card = document.getElementById('playerCard');
  if (!overlay || !card) return;
  var battingTeamId = halfInning === 'top' ? awayTeamId : homeTeamId;
  var teamData = TEAMS.find(function(t) { return t.id === battingTeamId; }) || {};
  var awayData = TEAMS.find(function(t) { return t.id === awayTeamId; }) || {};
  var homeData = TEAMS.find(function(t) { return t.id === homeTeamId; }) || {};
  var teamAbbr = teamData.short || '???';
  var awayAbbr = awayData.short || 'AWY';
  var homeAbbr = homeData.short || 'HME';
  card.innerHTML = '<div class="pc-loading">Loading player card…</div>';
  overlay.classList.remove('closing');
  overlay.classList.add('open');
  var stat = null;
  var cached = (state.statsCache.hitting || []).find(function(e) { return e.player && e.player.id === batterId; });
  if (cached) stat = cached.stat;
  if (!stat) {
    try {
      var r = await fetch(MLB_BASE + '/people/' + batterId + '/stats?stats=season&season=' + SEASON + '&group=hitting');
      if (!r.ok) throw new Error(r.status);
      var d = await r.json();
      stat = d.stats && d.stats[0] && d.stats[0].splits && d.stats[0].splits[0] && d.stats[0].splits[0].stat;
    } catch (e) { stat = null; }
  }
  var rbiSeason = stat ? (stat.rbi != null ? stat.rbi : '—') : '—';
  var hits = stat ? (stat.hits != null ? stat.hits : '—') : '—';
  var avg = stat ? fmtRate(stat.avg) : '—';
  var ops = stat ? fmtRate(stat.ops) : '—';
  var rbiPrev = (typeof rbiSeason === 'number' && rbiSeason >= rbi) ? rbiSeason - rbi : rbiSeason;
  var battingAfter = halfInning === 'top' ? aScore : hScore;
  var fieldingScore = halfInning === 'top' ? hScore : aScore;
  var deficitBefore = fieldingScore - (battingAfter - rbi);
  var marginAfter = battingAfter - fieldingScore;
  var badge = getRBIBadge(rbi, event, halfInning, inning, deficitBefore, marginAfter);
  var rEntry = (state.rosterData.hitting || []).find(function(p) { return p.person && p.person.id === batterId; });
  if (!rEntry) rEntry = (state.rosterData.pitching || []).find(function(p) { return p.person && p.person.id === batterId; });
  var jerseyNumber = rEntry && rEntry.jerseyNumber ? rEntry.jerseyNumber : null;
  var position = (rEntry && rEntry.position && rEntry.position.abbreviation) || null;
  if ((!position || !jerseyNumber) && gamePk && _fetchBoxscore) {
    try {
      var bs = await _fetchBoxscore(gamePk);
      var allPlayers = Object.values(bs.teams.away.players).concat(Object.values(bs.teams.home.players));
      var playerData = allPlayers.find(function(p) { return p.person && p.person.id === batterId; });
      if (playerData) {
        if (!jerseyNumber && playerData.jerseyNumber) jerseyNumber = playerData.jerseyNumber;
        if (!position && playerData.position && playerData.position.code) {
          var posCode = playerData.position.code;
          var posMap = {'1':'P','2':'C','3':'1B','4':'2B','5':'3B','6':'SS','7':'LF','8':'CF','9':'RF','10':'DH'};
          position = posMap[posCode] || playerData.position.code;
        }
      }
    } catch (e) {}
  }
  position = position || '—';
  card.innerHTML = window.PulseCard.render({
    batterId: batterId,
    name: batterName,
    team: { short: teamAbbr, primary: teamData.primary, secondary: teamData.secondary },
    position: position,
    jersey: jerseyNumber,
    badge: badge,
    stats: { avg: avg, ops: ops, h: hits, rbi: rbiPrev },
    highlight: 'rbi',
  });
  if (typeof rbiSeason === 'number' && rbiSeason >= 1) {
    setTimeout(function() {
      var el = card.querySelector('.pc-rbi-val');
      if (el) { el.textContent = rbiSeason; el.classList.add('counting'); }
    }, 500);
  }
  if (window._playerCardTimer) clearTimeout(window._playerCardTimer);
  window._playerCardTimer = setTimeout(dismissPlayerCard, TIMING.CARD_DISMISS_MS);
  if (_collectCard) {
    _collectCard({
      playerId: batterId, playerName: batterName,
      teamAbbr: teamAbbr, teamPrimary: teamData.primary, teamSecondary: teamData.secondary,
      position: position || '',
      eventType: 'RBI', badge: badge, rbi: rbi,
      inning: inning, halfInning: halfInning,
      awayAbbr: awayAbbr, homeAbbr: homeAbbr,
      awayScore: aScore, homeScore: hScore,
    });
  }
}

// Dev Tools: replay most recent HR feed item
export function replayHRCard(itemIndex) {
  var hrs = state.feedItems.filter(function(item) { return item.data && item.data.event === 'Home Run'; });
  if (!hrs.length) { alert('No home runs in feed yet'); return; }
  var idx = itemIndex !== undefined ? itemIndex : 0;
  if (idx < 0 || idx >= hrs.length) { alert('Index out of range'); return; }
  var item = hrs[idx];
  var play = item.data;
  var gs = state.gameStates[item.gamePk];
  if (!gs) { alert('Game state not found'); return; }
  var batterId = play.batterId;
  var batterName = play.batterName;
  var awayTeamId = gs.awayId;
  var homeTeamId = gs.homeId;
  var halfInning = play.halfInning || gs.halfInning;
  var badgeText = play.desc.includes('walk-off') ? 'WALK-OFF HOME RUN!' : '💥 HOME RUN!';
  showPlayerCard(batterId, batterName, awayTeamId, homeTeamId, halfInning, null, null, badgeText, item.gamePk);
}

// Dev Tools: replay most recent RBI feed item
export function replayRBICard(itemIndex) {
  var rbis = state.feedItems.filter(function(item) { return item.data && item.data.scoring && item.data.event !== 'Home Run' && item.data.batterId; });
  if (!rbis.length) { alert('No RBI plays in feed yet'); return; }
  var idx = itemIndex !== undefined ? itemIndex : 0;
  if (idx < 0 || idx >= rbis.length) { alert('Index out of range'); return; }
  var item = rbis[idx];
  var play = item.data;
  var gs = state.gameStates[item.gamePk];
  if (!gs) { alert('Game state not found'); return; }
  showRBICard(play.batterId, play.batterName, gs.awayId, gs.homeId, play.halfInning, 1, play.event, play.awayScore, play.homeScore, play.inning, item.gamePk);
}
