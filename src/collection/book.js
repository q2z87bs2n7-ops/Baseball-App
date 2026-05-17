// ── Card Collection (book + storage + UI) ──────────────────────────────────
// Auto-collected card system: each HR / key RBI awards a tiered card per
// (playerId, eventType) slot. Higher tier replaces; same tier appends to
// events[] (capped 10); lower tier silently no-ops.
//   - tier system (tierRank, getCardTier)
//   - localStorage persistence (loadCollection, saveCollection)
//   - collectCard() — main entry called from showPlayerCard / showRBICard
//   - collected toast + rail flash
//   - book overlay (renderCollectionBook + filter/sort/page controls)
//   - card open from collection / from key (Yesterday Recap strip)
//   - generateTestCard / resetCollection (Dev Tools)

import { state } from '../state.js';
import { TEAMS, MLB_BASE } from '../config/constants.js';
import { fmt, fmtRate } from '../utils/format.js';
import { devTrace } from '../devtools-feed/devLog.js';
import { syncCollection } from './sync.js';

// Callback injection — these stay in main.js (or come from cards/playerCard.js)
let _showSignInCTA = null;
let _showPlayerCard = null;
let _showRBICard = null;
let _getLeagueLeadersCache = null;

export function setBookCallbacks(cbs) {
  if (cbs.showSignInCTA) _showSignInCTA = cbs.showSignInCTA;
  if (cbs.showPlayerCard) _showPlayerCard = cbs.showPlayerCard;
  if (cbs.showRBICard) _showRBICard = cbs.showRBICard;
  if (cbs.getLeagueLeadersCache) _getLeagueLeadersCache = cbs.getLeagueLeadersCache;
}

export function tierRank(t) { return { legendary: 4, epic: 3, rare: 2, common: 1 }[t] || 0; }

function getCardTier(badge, eventType, rbi) {
  if (eventType === 'HR') {
    if (badge.includes('WALK-OFF GRAND SLAM')) return 'legendary';
    if (badge.includes('WALK-OFF') || badge.includes('GRAND SLAM')) return 'epic';
    if (badge.includes('GO-AHEAD')) return 'rare';
    return 'common';
  } else {
    if (badge.includes('WALK-OFF') && (rbi || 0) >= 2) return 'legendary';
    if (badge.includes('WALK-OFF') || (rbi || 0) >= 3) return 'epic';
    if (badge.includes('GO-AHEAD') || badge.includes('TIES IT')) return 'rare';
    return 'common';
  }
}

export function loadCollection() {
  try { return JSON.parse(localStorage.getItem('mlb_card_collection') || '{}'); } catch (e) { return {}; }
}

export function saveCollection(obj) {
  try { localStorage.setItem('mlb_card_collection', JSON.stringify(obj)); } catch (e) {}
}

function showCollectedToast(type, playerName, eventType, tier) {
  const el = document.getElementById('cardCollectedToast');
  if (!el) return;
  const tierColor = { legendary: '#e03030', epic: '#f59e0b', rare: '#3b82f6', common: '#9aa0a8' }[tier] || '#9aa0a8';
  const lastName = playerName.split(' ').pop();
  let prefix, msg;
  if (type === 'new') {
    if (tier === 'legendary') { prefix = '🔴'; msg = 'LEGENDARY PULL! ' + lastName + ' ' + eventType; }
    else if (tier === 'epic') { prefix = '🟠'; msg = 'EPIC CARD! ' + lastName + ' ' + eventType; }
    else if (tier === 'rare') { prefix = '💎'; msg = 'Rare find — ' + lastName + ' ' + eventType; }
    else                      { prefix = '🎴'; msg = 'Card collected — ' + lastName + ' ' + eventType; }
  } else if (type === 'upgrade') {
    if (tier === 'legendary') { prefix = '🔴'; msg = 'UPGRADED TO LEGENDARY! ' + lastName; }
    else if (tier === 'epic') { prefix = '⚡'; msg = 'Upgraded to Epic! ' + lastName + ' ' + eventType; }
    else if (tier === 'rare') { prefix = '💎'; msg = 'Upgraded to Rare — ' + lastName + ' ' + eventType; }
    else                      { prefix = '⬆'; msg = 'Upgraded — ' + lastName + ' ' + eventType; }
  } else {
    if (tier === 'legendary') { prefix = '👑'; msg = 'Another legendary ' + lastName + ' moment!'; }
    else if (tier === 'epic') { prefix = '🔥'; msg = 'Epic variant added — ' + lastName; }
    else if (tier === 'rare') { prefix = '💎'; msg = 'Rare event added — ' + lastName + ' ' + eventType; }
    else                      { prefix = '✓'; msg = lastName + "'s " + eventType + ' card updated'; }
  }
  el.style.borderColor = tierColor + '99';
  el.style.boxShadow = (tier === 'legendary' || tier === 'epic') ? '0 0 14px ' + tierColor + '55' : '';
  el.innerHTML = '<span style="color:' + tierColor + ';font-weight:800;">' + prefix + '</span> ' + msg;
  const duration = (tier === 'legendary' || tier === 'epic') ? 2800 : 2100;
  el.style.animationDuration = duration + 'ms';
  el.style.display = 'block';
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
  setTimeout(function() { el.style.display = 'none'; el.classList.remove('show'); }, duration);
}

export function collectCard(data, force) {
  const playerId = data.playerId, playerName = data.playerName, teamAbbr = data.teamAbbr;
  const teamPrimary = data.teamPrimary, teamSecondary = data.teamSecondary, position = data.position || '';
  const eventType = data.eventType, badge = data.badge || '', rbi = data.rbi || 0;
  const key = playerId + '_' + eventType;
  const tier = getCardTier(badge, eventType, rbi);
  devTrace('collect', (playerName || '?') + ' · ' + eventType + ' · tier=' + tier + (rbi ? ' · rbi=' + rbi : '') + (force ? ' [forced]' : ''));

  if (state.demoMode && !force) {
    // Simulate the collection outcome so the rail flash + toast still
    // fire, but never persist to localStorage. Increment a session-only
    // counter so the rail count chip ticks up visibly during demo.
    const demoCol = loadCollection();
    const demoEx = demoCol[key];
    if (!demoEx) {
      state.lastCollectionResult = { type: 'new', playerName: playerName, eventType: eventType, tier: tier };
      state.demoCardCount = (state.demoCardCount || 0) + 1;
    } else {
      const dRank = tierRank(tier), dExRank = tierRank(demoEx.tier);
      state.lastCollectionResult = {
        type: dRank > dExRank ? 'upgrade' : 'dup',
        playerName: playerName, eventType: eventType, tier: tier
      };
    }
    updateCollectionUI();
    return;
  }

  const col = loadCollection();
  const eventCtx = {
    badge: badge,
    date: new Date().toLocaleDateString('en-CA'),
    inning: data.inning || 0,
    halfInning: data.halfInning || 'top',
    awayAbbr: data.awayAbbr || '',
    homeAbbr: data.homeAbbr || '',
    awayScore: data.awayScore || 0,
    homeScore: data.homeScore || 0,
  };
  if (!col[key]) {
    col[key] = {
      playerId: playerId, playerName: playerName, teamAbbr: teamAbbr,
      teamPrimary: teamPrimary, teamSecondary: teamSecondary, position: position,
      eventType: eventType, tier: tier, collectedAt: Date.now(), events: [eventCtx]
    };
    state.lastCollectionResult = { type: 'new', playerName: playerName, eventType: eventType, tier: tier };
    showCollectedToast('new', playerName, eventType, tier);
  } else {
    const existing = col[key];
    const newRank = tierRank(tier), existRank = tierRank(existing.tier);
    if (newRank > existRank) {
      existing.tier = tier;
      existing.events = [eventCtx];
      existing.collectedAt = Date.now();
      existing.teamPrimary = teamPrimary;
      existing.teamSecondary = teamSecondary;
      existing.position = position || existing.position;
      state.lastCollectionResult = { type: 'upgrade', playerName: playerName, eventType: eventType, tier: tier };
      showCollectedToast('upgrade', playerName, eventType, tier);
    } else if (newRank === existRank) {
      if (existing.events.length < 10) existing.events.push(eventCtx);
      state.lastCollectionResult = { type: 'dup', playerName: playerName, eventType: eventType, tier: tier };
      showCollectedToast('dup', playerName, eventType, tier);
    }
    // lower tier → silent no-op
  }
  saveCollection(col);
  updateCollectionUI();
  if (state.mlbSessionToken) syncCollection();
  else if (_showSignInCTA) _showSignInCTA();
}

export async function fetchCareerStats(playerId, position) {
  if (state.collectionCareerStatsCache[playerId]) return state.collectionCareerStatsCache[playerId];
  const isPitcher = ['SP', 'RP', 'CP', 'P'].indexOf((position || '').toUpperCase()) !== -1;
  const group = isPitcher ? 'pitching' : 'hitting';
  try {
    const r = await fetch(MLB_BASE + '/people/' + playerId + '/stats?stats=career&group=' + group);
    if (!r.ok) throw new Error(r.status);
    const d = await r.json();
    const stat = d.stats && d.stats[0] && d.stats[0].splits && d.stats[0].splits[0] && d.stats[0].splits[0].stat;
    if (!stat) return null;
    const result = isPitcher
      ? { careerERA: fmt(stat.era, 2), careerWHIP: fmt(stat.whip, 2), careerW: stat.wins || 0, careerK: stat.strikeOuts || 0 }
      : { careerHR: stat.homeRuns || 0, careerAVG: fmtRate(stat.avg), careerRBI: stat.rbi || 0, careerOPS: fmtRate(stat.ops) };
    state.collectionCareerStatsCache[playerId] = result;
    return result;
  } catch (e) { return null; }
}

export function openCollection() {
  const el = document.getElementById('collectionOverlay');
  if (!el) return;
  state.collectionPage = 0;
  el.style.display = 'flex';
  if (state.demoMode) {
    // Demo doesn't persist cards — show a sign-in nudge instead of an
    // empty/fake binder. Real cards only collect when signed in + live.
    const book = document.getElementById('collectionBook');
    if (book) {
      book.innerHTML =
        '<div style="display:flex;align-items:center;justify-content:center;min-height:50vh;padding:40px 20px">' +
          '<div style="max-width:340px;text-align:center;color:var(--text)">' +
            '<div style="font-size:48px;margin-bottom:12px">🎴</div>' +
            '<div style="font-size:1.05rem;font-weight:700;margin-bottom:6px">Demo cards aren’t saved</div>' +
            '<div style="font-size:.85rem;line-height:1.5;color:var(--muted);margin-bottom:18px">Sign in to start your real collection. Every HR or key RBI you watch live becomes a card you can keep.</div>' +
            '<button onclick="closeCollection()" style="background:var(--secondary);color:var(--accent-text);border:none;padding:9px 20px;border-radius:8px;cursor:pointer;font-weight:700;font-size:.85rem">Back to Demo</button>' +
          '</div>' +
        '</div>';
    }
    return;
  }
  renderCollectionBook();
}

export function closeCollection() {
  const el = document.getElementById('collectionOverlay');
  if (el) el.style.display = 'none';
}

export function filterCollection(f) { state.collectionFilter = f; state.collectionPage = 0; renderCollectionBook(); }
export function sortCollection(s) { state.collectionSort = s; state.collectionPage = 0; renderCollectionBook(); }

export function goCollectionPage(dir) {
  const col = loadCollection();
  let slots = Object.values(col);
  if (state.collectionFilter !== 'all') slots = slots.filter(function(s) { return s.eventType === state.collectionFilter; });
  if (state.collectionSort === 'team') {
    const abbrs = [];
    slots.forEach(function(s) { if (abbrs.indexOf(s.teamAbbr) === -1) abbrs.push(s.teamAbbr); });
    abbrs.sort();
    state.collectionPage = Math.max(0, Math.min(abbrs.length - 1, state.collectionPage + dir));
  } else {
    const totalPages = Math.max(1, Math.ceil(slots.length / 9));
    state.collectionPage = Math.max(0, Math.min(totalPages - 1, state.collectionPage + dir));
  }
  renderCollectionBook();
}

export async function renderCollectionBook() {
  const book = document.getElementById('collectionBook');
  if (!book) return;
  const col = loadCollection();
  let slots = Object.values(col);
  if (state.collectionFilter !== 'all') slots = slots.filter(function(s) { return s.eventType === state.collectionFilter; });
  let teamContext = null;
  if (state.collectionSort === 'rarity') {
    slots.sort(function(a, b) { return tierRank(b.tier) - tierRank(a.tier) || b.collectedAt - a.collectedAt; });
  } else if (state.collectionSort === 'team') {
    const teamAbbrs = [];
    slots.forEach(function(s) { if (teamAbbrs.indexOf(s.teamAbbr) === -1) teamAbbrs.push(s.teamAbbr); });
    teamAbbrs.sort();
    const teamCount = teamAbbrs.length;
    state.collectionPage = Math.max(0, Math.min(Math.max(0, teamCount - 1), state.collectionPage));
    const currentAbbr = teamAbbrs[state.collectionPage] || '';
    slots = slots.filter(function(s) { return s.teamAbbr === currentAbbr; });
    slots.sort(function(a, b) { return tierRank(b.tier) - tierRank(a.tier); });
    const td = TEAMS.find(function(t) { return t.short === currentAbbr; });
    teamContext = {
      abbr: currentAbbr,
      primary: (td && td.primary) || '#444444',
      secondary: (td && td.secondary) || '#888888',
      teamId: td ? td.id : null,
      teamIdx: state.collectionPage,
      teamCount: teamCount,
    };
  } else {
    slots.sort(function(a, b) { return b.collectedAt - a.collectedAt; });
  }

  if (state.collectionSort !== 'team') {
    const totalPages = Math.max(1, Math.ceil(slots.length / 9));
    state.collectionPage = Math.min(state.collectionPage, totalPages - 1);
  }

  const pageSlots = (state.collectionSort === 'team')
    ? slots
    : slots.slice(state.collectionPage * 9, (state.collectionPage + 1) * 9);
  const careerStatsMap = Object.assign({}, state.collectionCareerStatsCache);
  await Promise.all(pageSlots.map(async function(slot) {
    if (!careerStatsMap[slot.playerId]) {
      const cs = await fetchCareerStats(slot.playerId, slot.position);
      if (cs) careerStatsMap[slot.playerId] = cs;
    }
  }));

  state.collectionSlotsDisplay = slots.slice();
  book.innerHTML = window.CollectionCard.renderBook({
    slots: slots,
    filter: state.collectionFilter,
    sort: state.collectionSort,
    page: state.collectionPage,
    careerStatsMap: careerStatsMap,
    teamContext: teamContext,
  });
}

export function openCardFromCollection(idx) {
  const slot = state.collectionSlotsDisplay[idx];
  if (!slot || !slot.events || !slot.events.length) return;

  const ev = slot.events[Math.floor(Math.random() * slot.events.length)];

  const awayTeam = TEAMS.find(function(t) { return t.short === ev.awayAbbr; });
  const homeTeam = TEAMS.find(function(t) { return t.short === ev.homeAbbr; });
  const awayTeamId = awayTeam ? awayTeam.id : 0;
  const homeTeamId = homeTeam ? homeTeam.id : 0;

  if (slot.eventType === 'HR') {
    const careerStats = state.collectionCareerStatsCache[slot.playerId];
    let overrideStats = null;
    if (careerStats && careerStats.careerHR !== undefined) {
      overrideStats = {
        avg: careerStats.careerAVG,
        ops: careerStats.careerOPS,
        homeRuns: careerStats.careerHR,
        rbi: careerStats.careerRBI,
        _position: slot.position,
      };
    } else if (slot.position) {
      overrideStats = { _position: slot.position };
    }
    if (_showPlayerCard) _showPlayerCard(slot.playerId, slot.playerName, awayTeamId, homeTeamId, ev.halfInning, overrideStats, null, ev.badge, null);
  } else {
    const badgeUp = (ev.badge || '').toUpperCase();
    let eventType = '';
    if      (badgeUp.indexOf('SINGLE')  !== -1) eventType = 'Single';
    else if (badgeUp.indexOf('DOUBLE')  !== -1) eventType = 'Double';
    else if (badgeUp.indexOf('TRIPLE')  !== -1) eventType = 'Triple';
    else if (badgeUp.indexOf('SAC FLY') !== -1) eventType = 'Sac Fly';
    else if (badgeUp.indexOf('WALK')    !== -1) eventType = 'Walk';
    else if (badgeUp.indexOf('HBP')     !== -1) eventType = 'HBP';
    const rbiMatch = badgeUp.match(/^(\d+)-RUN/);
    const rbi = rbiMatch ? parseInt(rbiMatch[1]) : 1;
    if (_showRBICard) _showRBICard(slot.playerId, slot.playerName, awayTeamId, homeTeamId, ev.halfInning, rbi, eventType, ev.awayScore, ev.homeScore, ev.inning, null);
  }
}

export function openCardFromKey(key) {
  const col = loadCollection();
  const slot = col[key];
  if (!slot || !slot.events || !slot.events.length) return;
  const sorted = Object.values(col).sort(function(a, b) { return (b.collectedAt || 0) - (a.collectedAt || 0); });
  state.collectionSlotsDisplay = sorted;
  let idx = sorted.indexOf(slot);
  if (idx === -1) { state.collectionSlotsDisplay.push(slot); idx = state.collectionSlotsDisplay.length - 1; }
  openCardFromCollection(idx);
}

export function updateCollectionUI() {
  // In demo, the count reflects session-only demo collections so the rail
  // chip ticks up visibly. Real localStorage stays untouched.
  const count = state.demoMode
    ? (state.demoCardCount || 0)
    : Object.keys(loadCollection()).length;
  const countEl = document.getElementById('collectionCountLabel');
  if (countEl) countEl.textContent = count;
  renderCollectionRailModule();
}

function renderCollectionRailModule() {
  const el = document.getElementById('collectionRailModule');
  if (!el || !window.CollectionCard) return;
  const count = state.demoMode
    ? (state.demoCardCount || 0)
    : Object.keys(loadCollection()).length;
  el.innerHTML = window.CollectionCard.renderRailModule(count);
}

export function flashCollectionRailMessage() {
  if (!state.lastCollectionResult) return;
  const el = document.getElementById('collectionRailModule');
  if (!el) return;
  const r = state.lastCollectionResult;
  state.lastCollectionResult = null;
  const tierColor = { legendary: '#e03030', epic: '#f59e0b', rare: '#3b82f6', common: '#9aa0a8' }[r.tier] || '#9aa0a8';
  const name = r.playerName.split(' ').pop();
  let label, sublabel;
  if (r.type === 'new') {
    if (r.tier === 'legendary')   { label = '🔴 LEGENDARY PULL!';     sublabel = name + ' ' + r.eventType; }
    else if (r.tier === 'epic')   { label = '⚡ EPIC CARD!';           sublabel = name + ' ' + r.eventType; }
    else if (r.tier === 'rare')   { label = '💎 Rare Find!';           sublabel = name + ' ' + r.eventType; }
    else                          { label = '🎴 Card Collected';       sublabel = name + ' ' + r.eventType; }
  } else if (r.type === 'upgrade') {
    if (r.tier === 'legendary')   { label = '🔴 LEGENDARY UPGRADE!';   sublabel = name + ' ' + r.eventType; }
    else if (r.tier === 'epic')   { label = '⚡ Upgraded to Epic!';    sublabel = name + ' ' + r.eventType; }
    else if (r.tier === 'rare')   { label = '💎 Upgraded to Rare';     sublabel = name + ' ' + r.eventType; }
    else                          { label = '⬆ Upgraded';             sublabel = name + ' ' + r.eventType; }
  } else {
    if (r.tier === 'legendary')   { label = '👑 Legendary';            sublabel = 'Another ' + name + ' moment!'; }
    else if (r.tier === 'epic')   { label = '🔥 Epic Variant';         sublabel = 'Added to collection'; }
    else if (r.tier === 'rare')   { label = '💎 Rare Variant';         sublabel = name + ' ' + r.eventType; }
    else                          { label = '✓ Already Have';          sublabel = name + ' ' + r.eventType; }
  }
  const dotGlow = (r.tier === 'legendary' || r.tier === 'epic') ? ';box-shadow:0 0 6px ' + tierColor : '';
  el.innerHTML =
    '<div onclick="openCollection()" style="' +
      'display:flex;align-items:center;gap:8px;padding:8px 12px;cursor:pointer;' +
      'border-radius:8px;border:1px solid ' + tierColor + '55;' +
      'background:linear-gradient(90deg,' + tierColor + '22,transparent);' +
      'font-size:.75rem;color:var(--text);white-space:nowrap;overflow:hidden;">' +
      '<span style="width:8px;height:8px;border-radius:50%;background:' + tierColor + ';flex-shrink:0' + dotGlow + '"></span>' +
      '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;">' +
        '<span style="font-weight:700;color:' + tierColor + ';">' + label + '</span>' +
        ' <span style="color:var(--muted);">' + sublabel + '</span>' +
      '</span>' +
      '<span style="color:var(--muted);font-size:11px;flex-shrink:0;">Open →</span>' +
    '</div>';
  setTimeout(function() { renderCollectionRailModule(); }, 4000);
}

export function generateTestCard() {
  const rosterEntries = (state.rosterData.hitting || []).map(function(p) {
    return {
      personId: p.person.id,
      personName: p.person.fullName,
      teamData: state.activeTeam,
      position: (p.position && p.position.abbreviation) || 'OF'
    };
  });

  const seenIds = {};
  rosterEntries.forEach(function(e) { seenIds[e.personId] = true; });
  const leaderEntries = [];
  function addLeadersFromMap(map) {
    Object.keys(map).forEach(function(cat) {
      (map[cat] || []).forEach(function(l) {
        if (!l.person || !l.person.id || seenIds[l.person.id]) return;
        const td = (l.team && l.team.id) ? TEAMS.find(function(t) { return t.id === l.team.id; }) : null;
        if (!td) return;
        seenIds[l.person.id] = true;
        leaderEntries.push({
          personId: l.person.id,
          personName: l.person.fullName,
          teamData: td,
          position: 'OF'
        });
      });
    });
  }
  const leagueLeadersCache = _getLeagueLeadersCache ? _getLeagueLeadersCache() : null;
  if (leagueLeadersCache && leagueLeadersCache.hitting) addLeadersFromMap(leagueLeadersCache.hitting);
  if (state.dailyLeadersCache) {
    const hitCats = { homeRuns: 1, battingAverage: 1, runsBattedIn: 1, stolenBases: 1 };
    const hitOnly = {};
    Object.keys(state.dailyLeadersCache).forEach(function(k) { if (hitCats[k]) hitOnly[k] = state.dailyLeadersCache[k]; });
    addLeadersFromMap(hitOnly);
  }

  const fullPool = rosterEntries.concat(leaderEntries);
  if (!fullPool.length) { showCollectedToast('new', 'No roster loaded', '', 'common'); return; }

  const p = fullPool[Math.floor(Math.random() * fullPool.length)];
  const eventType = Math.random() > 0.5 ? 'HR' : 'RBI';
  const tiers = ['common', 'common', 'rare', 'epic', 'legendary'];
  const tier = tiers[Math.floor(Math.random() * tiers.length)];
  const badgeMap = {
    HR: { legendary: 'WALK-OFF GRAND SLAM!', epic: 'GRAND SLAM!', rare: 'GO-AHEAD HOME RUN!', common: '💥 HOME RUN!' },
    RBI: { legendary: 'WALK-OFF DOUBLE!', epic: 'WALK-OFF SINGLE!', rare: 'GO-AHEAD SINGLE!', common: 'RBI SINGLE!' }
  };
  const rbiByTier = { legendary: 2, epic: 1, rare: 1, common: 1 };
  const innings = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const halves = ['top', 'bottom'];
  const scores = [0, 1, 2, 3, 4, 5];
  collectCard({
    playerId: p.personId,
    playerName: p.personName,
    teamAbbr: p.teamData.short,
    teamPrimary: p.teamData.primary,
    teamSecondary: p.teamData.secondary,
    position: p.position,
    eventType: eventType,
    badge: badgeMap[eventType][tier],
    rbi: rbiByTier[tier],
    inning: innings[Math.floor(Math.random() * innings.length)],
    halfInning: halves[Math.floor(Math.random() * halves.length)],
    awayAbbr: 'NYM',
    homeAbbr: p.teamData.short,
    awayScore: scores[Math.floor(Math.random() * scores.length)],
    homeScore: scores[Math.floor(Math.random() * scores.length)],
  }, true);
}

export function resetCollection() {
  if (!confirm('Reset collection? This cannot be undone.')) return;
  localStorage.removeItem('mlb_card_collection');
  updateCollectionUI();
  if (state.mlbSessionToken) {
    fetch((window.API_BASE || '') + '/api/collection-sync', {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + state.mlbSessionToken }
    }).catch(function() {});
  }
  alert('Collection reset');
}
