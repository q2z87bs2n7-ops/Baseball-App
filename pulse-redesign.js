/* ─────────────────────────────────────────────────────────────────────────
 * pulse-redesign.js
 * Drop-in module. Loads AFTER app.js. IIFE — no globals leaked except a
 * single namespace `window.PulseRedesign` for debugging.
 *
 * Responsibilities:
 *   1. Build the #pulseHero wrapper on first Pulse view, move #focusCard
 *      and #storyCarousel into it.
 *   2. Maintain hero "empty" state — collapse when both children are hidden.
 *   3. Convert MY TEAM lens from hide → dim by stamping `lens-match` on
 *      feed items / ticker chips that belong to the active team's games and
 *      setting #pulse[data-lens="team"].
 *
 * Pattern matches existing IIFE modules (focusCard.js, collectionCard.js).
 * No CSS in this file — all visuals live in pulse-redesign.css.
 * ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var initialized = false;

  function $(id) { return document.getElementById(id); }

  function buildHero() {
    if (initialized) return;
    var pulseLeft = $('pulseLeft');
    var focusCard = $('focusCard');
    var storyCarousel = $('storyCarousel');
    var feedWrap = $('feedWrap');
    if (!pulseLeft || !feedWrap) return;

    // If app.js still has #focusCard inside #sideRail, lift it up. If not, fine.
    var hero = document.createElement('div');
    hero.id = 'pulseHero';

    if (focusCard) hero.appendChild(focusCard);
    if (storyCarousel) hero.appendChild(storyCarousel);

    // Insert hero immediately before #feedWrap inside #pulseLeft
    pulseLeft.insertBefore(hero, feedWrap);

    initialized = true;
    refreshHeroEmptyState();
  }

  function refreshHeroEmptyState() {
    var hero = $('pulseHero');
    if (!hero) return;
    var focus = $('focusCard');
    var story = $('storyCarousel');
    var focusVisible = focus && focus.style.display !== 'none' && focus.children.length > 0;
    var storyVisible = story && story.style.display !== 'none';
    hero.dataset.empty = (focusVisible || storyVisible) ? '0' : '1';
  }

  /* ── MY TEAM lens: dim instead of hide ──────────────────────────────── */
  function applyLensState() {
    var pulse = $('pulse');
    if (!pulse) return;
    // Read existing global set by app.js: window.myTeamLens (boolean)
    var on = !!window.myTeamLens;
    pulse.dataset.lens = on ? 'team' : 'all';
    if (!on) {
      // Clear any previously stamped match flags so feed renders normally
      var matches = pulse.querySelectorAll('.lens-match');
      for (var i = 0; i < matches.length; i++) matches[i].classList.remove('lens-match');
    } else {
      stampMatches();
    }
    // Reflect lens state on the YOUR GAME callout
    var yg = $('ptbYourGame');
    if (yg) yg.classList.toggle('lens-on', on);
    var ygState = $('ptbYourGameState');
    if (ygState) ygState.textContent = on ? '● LENS ON' : '○';
  }

  /* ── Top bar status counters + YOUR GAME callout ────────────────────── */
  function updateTopBarStats() {
    var states = window.gameStates || {};
    var live = 0, final = 0, preview = 0;
    var team = window.activeTeam;
    var myTeamId = team ? team.id : null;
    var myLiveGame = null;
    for (var pk in states) {
      if (!Object.prototype.hasOwnProperty.call(states, pk)) continue;
      var g = states[pk];
      if (g.status === 'Live' && g.detailedState === 'In Progress') {
        live++;
        if (myTeamId && (g.awayId === myTeamId || g.homeId === myTeamId)) myLiveGame = g;
      } else if (g.status === 'Final') {
        final++;
      } else if (g.status === 'Preview' || g.status === 'Scheduled') {
        preview++;
      }
    }
    var elLive = $('ptbCountLive'); if (elLive) elLive.textContent = live;
    var elFinal = $('ptbCountFinal'); if (elFinal) elFinal.textContent = final;
    var elPrev = $('ptbCountPreview'); if (elPrev) elPrev.textContent = preview;

    // YOUR GAME callout — visible only when active team has a live in-progress game
    var yg = $('ptbYourGame');
    if (!yg) return;
    if (myLiveGame) {
      var abbr = (myLiveGame.awayId === myTeamId) ? myLiveGame.awayAbbr : myLiveGame.homeAbbr;
      var half = myLiveGame.halfInning === 'top' ? 'T' : 'B';
      var meta = '· ' + (abbr || '') + ' ' + half + (myLiveGame.inning || '');
      var metaEl = $('ptbYourGameMeta');
      if (metaEl) metaEl.textContent = meta;
      yg.style.display = '';
    } else {
      yg.style.display = 'none';
      // Escape valve — if lens is on but no UI to turn it off, auto-clear it.
      if (window.myTeamLens && typeof window.applyMyTeamLens === 'function') {
        window.applyMyTeamLens(false);
      }
    }
  }

  function stampMatches() {
    var team = window.activeTeam;
    if (!team) return;
    var teamId = team.id;
    var states = window.gameStates || {};

    // Feed items carry data-game-pk (added by addFeedItem in app.js).
    // If they don't yet, fall back to className inspection of team abbrs.
    var feedItems = document.querySelectorAll('#feed .feed-item');
    for (var i = 0; i < feedItems.length; i++) {
      var pk = feedItems[i].dataset.gamepk;
      var gs = pk ? states[pk] : null;
      var match = gs && (gs.awayId === teamId || gs.homeId === teamId);
      feedItems[i].classList.toggle('lens-match', !!match);
    }
    // Ticker chips
    var chips = document.querySelectorAll('#gameTicker .ticker-chip');
    for (var j = 0; j < chips.length; j++) {
      var cpk = chips[j].dataset.gamepk;
      var cgs = cpk ? states[cpk] : null;
      var cmatch = cgs && (cgs.awayId === teamId || cgs.homeId === teamId);
      chips[j].classList.toggle('lens-match', !!cmatch);
    }
  }

  /* ── Hooks: re-apply on Pulse renders ───────────────────────────────── */
  // Lightweight observer on #feed and #gameTicker — re-stamp matches when
  // app.js re-renders. No polling; only fires on actual mutations.
  function observe() {
    var feed = $('feed');
    var ticker = $('gameTicker');
    if (feed) {
      new MutationObserver(function () {
        if (window.myTeamLens) stampMatches();
      }).observe(feed, { childList: true });
    }
    if (ticker) {
      new MutationObserver(function () {
        if (window.myTeamLens) stampMatches();
        updateTopBarStats();
      }).observe(ticker, { childList: true });
    }
    var focus = $('focusCard');
    var story = $('storyCarousel');
    var heroObserver = new MutationObserver(refreshHeroEmptyState);
    if (focus) heroObserver.observe(focus, { attributes: true, attributeFilter: ['style'], childList: true });
    if (story) heroObserver.observe(story, { attributes: true, attributeFilter: ['style'] });
  }

  /* ── Boot ───────────────────────────────────────────────────────────── */
  function init() {
    buildHero();
    observe();
    applyLensState();
    updateTopBarStats();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose for app.js to call when toggleMyTeamLens fires, and for debugging
  window.PulseRedesign = {
    applyLensState: applyLensState,
    refreshHeroEmptyState: refreshHeroEmptyState,
    rebuildHero: buildHero,
    updateTopBarStats: updateTopBarStats
  };
})();
