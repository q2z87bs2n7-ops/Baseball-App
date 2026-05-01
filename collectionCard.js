/* ============================================================================
 * collectionCard.js
 * Visual rendering layer for the player card collection binder.
 *
 * Exports: window.CollectionCard = {
 *   renderBook(opts),
 *   renderMiniCard(slot, displayEvent, careerStats, idx),
 *   renderRailModule(totalCount),
 *   demo(),
 * }
 *
 * No build step, no imports, no external deps. All CSS lives in a single
 * injected <style id="cc-styles"> block, scoped under .cc-* class names.
 * ========================================================================== */

(function () {
  'use strict';

  // ── CSS injection ─────────────────────────────────────────────────────────
  var CSS_ID = 'cc-styles';

  function injectCSS() {
    if (document.getElementById(CSS_ID)) return;
    var s = document.createElement('style');
    s.id = CSS_ID;
    s.textContent = CSS_TEXT;
    document.head.appendChild(s);
  }

  var CSS_TEXT = [
    /* ── Binder shell ───────────────────────────────────────────────── */
    '.cc-binder{',
      'display:flex;flex-direction:column;width:100%;height:100%;',
      'background:#080c14;color:#e6ebf2;',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;',
      '-webkit-font-smoothing:antialiased;border-radius:14px;overflow:hidden;',
      'box-shadow:0 30px 80px rgba(0,0,0,.6),0 0 0 1px rgba(255,255,255,.04);',
    '}',

    /* ── Header ─────────────────────────────────────────────────────── */
    '.cc-head{',
      'display:flex;align-items:center;justify-content:space-between;',
      'padding:14px 18px;background:linear-gradient(180deg,#131c2e,#0d1520);',
      'border-bottom:1px solid rgba(255,255,255,.06);flex-shrink:0;',
    '}',
    '.cc-title{display:flex;align-items:baseline;gap:10px;}',
    '.cc-title-main{font-size:16px;font-weight:700;letter-spacing:.2px;}',
    '.cc-title-count{font-size:12px;color:#7d8694;font-variant-numeric:tabular-nums;}',
    '.cc-close{',
      'background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);',
      'color:#cfd6e0;font-size:12px;font-weight:600;letter-spacing:.3px;',
      'padding:7px 12px;border-radius:8px;cursor:pointer;transition:background .15s;',
    '}',
    '.cc-close:hover{background:rgba(255,255,255,.08);}',

    /* ── Toolbar (filters + sort) ───────────────────────────────────── */
    '.cc-toolbar{',
      'display:flex;align-items:center;justify-content:space-between;gap:12px;',
      'padding:10px 18px;background:#0a0f1a;border-bottom:1px solid rgba(255,255,255,.05);',
      'flex-shrink:0;',
    '}',
    '.cc-pills{display:flex;align-items:center;gap:6px;}',
    '.cc-pills-sep{width:1px;height:18px;background:rgba(255,255,255,.08);margin:0 4px;}',
    '.cc-pill{',
      'background:transparent;border:1px solid rgba(255,255,255,.08);',
      'color:#9aa4b1;font-size:11px;font-weight:600;letter-spacing:.4px;',
      'padding:6px 11px;border-radius:999px;cursor:pointer;text-transform:uppercase;',
      'transition:background .12s,color .12s,border-color .12s;',
    '}',
    '.cc-pill:hover{color:#e6ebf2;border-color:rgba(255,255,255,.18);}',
    '.cc-pill.is-active{background:#e6ebf2;color:#0a0f1a;border-color:#e6ebf2;}',
    '.cc-toolbar-right{display:flex;align-items:center;gap:6px;}',
    '.cc-toolbar-label{font-size:10px;color:#5a6371;letter-spacing:.5px;text-transform:uppercase;margin-right:4px;}',

    /* ── Body: spine + page ─────────────────────────────────────────── */
    '.cc-body{display:flex;flex:1;min-height:0;background:#080c14;}',

    /* Spine — left binder edge with rings */
    '.cc-spine{',
      'width:36px;flex-shrink:0;',
      'background:linear-gradient(90deg,#0a1322 0%,#142036 55%,#0c1424 100%);',
      'border-right:1px solid rgba(0,0,0,.6);',
      'box-shadow:inset -2px 0 4px rgba(0,0,0,.5),inset 2px 0 0 rgba(255,255,255,.03);',
      'display:flex;flex-direction:column;align-items:center;justify-content:space-around;',
      'padding:30px 0;position:relative;',
    '}',
    '.cc-spine::before{',
      'content:"";position:absolute;top:0;bottom:0;left:50%;width:1px;',
      'background:linear-gradient(180deg,transparent,rgba(255,255,255,.04) 20%,rgba(255,255,255,.04) 80%,transparent);',
    '}',
    '.cc-ring{',
      'width:18px;height:18px;border-radius:50%;',
      'background:radial-gradient(circle at 35% 30%,#e8edf3 0%,#9ba4b1 35%,#4a5161 70%,#1c222d 100%);',
      'border:1px solid rgba(255,255,255,.5);',
      'box-shadow:0 1px 2px rgba(0,0,0,.6),inset 0 -1px 1px rgba(0,0,0,.4),inset 0 1px 1px rgba(255,255,255,.4);',
      'position:relative;z-index:1;',
    '}',
    '.cc-ring::after{',
      'content:"";position:absolute;inset:4px;border-radius:50%;',
      'background:radial-gradient(circle at 50% 50%,#0a0e16 0%,#1a2030 100%);',
      'box-shadow:inset 0 1px 2px rgba(0,0,0,.8);',
    '}',

    /* Page area */
    '.cc-page{',
      'flex:1;background:#0a0e1a;',
      'background-image:radial-gradient(circle at 20% 0%,rgba(40,55,90,.18),transparent 60%),',
                       'radial-gradient(circle at 90% 100%,rgba(60,40,90,.12),transparent 60%);',
      'padding:22px;overflow-y:auto;position:relative;',
    '}',
    '.cc-grid{',
      'display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr);',
      'gap:14px;width:100%;height:100%;min-height:600px;',
    '}',
    /* Team-grouped grid — auto rows, no fixed height */
    '.cc-grid.cc-grid-team{',
      'grid-template-rows:auto;height:auto;min-height:0;align-content:start;',
    '}',
    '.cc-team-header{',
      'grid-column:1/-1;display:flex;align-items:center;gap:8px;',
      'padding:7px 10px;border-left:3px solid rgba(255,255,255,.15);',
      'background:rgba(255,255,255,.025);border-radius:0 6px 6px 0;',
      'margin-top:8px;',
    '}',
    '.cc-team-header:first-child{margin-top:0;}',
    '.cc-team-abbr{',
      'font-size:11px;font-weight:700;letter-spacing:.14em;',
      'color:#7d8694;text-transform:uppercase;flex:1;',
    '}',
    '.cc-team-count{font-size:10px;color:#4a5361;}',

    /* ── Pocket sleeve ──────────────────────────────────────────────── */
    '.cc-pocket{',
      'background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.06);',
      'border-radius:10px;padding:6px;display:flex;align-items:stretch;justify-content:stretch;',
      'min-height:0;',
    '}',
    '.cc-pocket.is-empty{',
      'border-style:dashed;border-color:rgba(255,255,255,.08);',
      'align-items:center;justify-content:center;background:rgba(255,255,255,.012);',
    '}',
    '.cc-pocket-empty-icon{font-size:18px;opacity:.18;}',

    /* ── Mini card ──────────────────────────────────────────────────── */
    '.cc-card{',
      'position:relative;width:100%;display:flex;flex-direction:column;',
      'background:#0d1117;border-radius:8px;overflow:hidden;cursor:pointer;',
      'transition:transform .18s ease,box-shadow .18s ease;',
      'border:1px solid rgba(255,255,255,.05);',
    '}',
    '.cc-card:hover{transform:translateY(-2px);}',
    '.cc-card-stripe{height:3px;width:100%;flex-shrink:0;}',
    '.cc-card-tint{',
      'position:absolute;top:3px;left:0;right:0;height:60%;',
      'pointer-events:none;opacity:.55;',
    '}',
    '.cc-card-body{',
      'position:relative;display:flex;flex-direction:column;gap:8px;',
      'padding:12px 11px 10px;flex:1;min-height:0;',
    '}',

    /* Event-type badge top-right */
    '.cc-evt-badge{',
      'position:absolute;top:9px;right:9px;z-index:2;',
      'font-size:9px;font-weight:800;letter-spacing:.6px;',
      'padding:3px 7px;border-radius:4px;color:#0a0f1a;',
      'box-shadow:0 1px 4px rgba(0,0,0,.4);',
    '}',

    /* Top row: headshot + identity */
    '.cc-card-top{display:flex;align-items:center;gap:10px;}',
    '.cc-shot-wrap{',
      'width:54px;height:54px;border-radius:50%;flex-shrink:0;',
      'background:#161c28;border:2px solid #2a3142;overflow:hidden;',
      'display:flex;align-items:center;justify-content:center;position:relative;',
    '}',
    '.cc-shot{width:100%;height:100%;object-fit:cover;display:block;}',
    '.cc-shot-fallback{',
      'width:60%;height:60%;opacity:.35;',
    '}',
    '.cc-card-id{display:flex;flex-direction:column;gap:1px;min-width:0;flex:1;}',
    '.cc-card-name{',
      'font-size:13px;font-weight:700;color:#f0f3f8;',
      'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:.1px;',
    '}',
    '.cc-card-meta{font-size:10px;color:#8c95a3;letter-spacing:.3px;}',
    '.cc-card-tier{',
      'font-size:9px;font-weight:800;letter-spacing:1px;margin-top:2px;',
    '}',

    /* Stats grid 2x2 */
    '.cc-stats{',
      'display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-top:2px;',
    '}',
    '.cc-stat{',
      'background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.04);',
      'border-radius:5px;padding:5px 7px;display:flex;flex-direction:column;gap:1px;',
    '}',
    '.cc-stat-val{',
      'font-size:13px;font-weight:700;color:#e6ebf2;',
      'font-variant-numeric:tabular-nums;letter-spacing:.2px;line-height:1;',
    '}',
    '.cc-stat-lbl{font-size:8px;color:#6b7280;letter-spacing:.7px;text-transform:uppercase;line-height:1;}',

    /* Flavor / event line */
    '.cc-flavor{',
      'margin-top:auto;padding-top:6px;border-top:1px solid rgba(255,255,255,.05);',
      'display:flex;flex-direction:column;gap:1px;',
    '}',
    '.cc-flavor-badge{',
      'font-size:10px;font-weight:700;color:#cfd6e0;letter-spacing:.2px;',
      'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;',
    '}',
    '.cc-flavor-meta{font-size:9px;color:#6b7280;letter-spacing:.3px;}',

    /* ── Footer / pagination ────────────────────────────────────────── */
    '.cc-foot{',
      'display:flex;align-items:center;justify-content:center;gap:14px;',
      'padding:12px 18px;background:#0a0f1a;border-top:1px solid rgba(255,255,255,.05);',
      'flex-shrink:0;',
    '}',
    '.cc-page-btn{',
      'background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);',
      'color:#cfd6e0;width:34px;height:30px;border-radius:7px;',
      'font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;',
      'transition:background .12s;',
    '}',
    '.cc-page-btn:hover:not(:disabled){background:rgba(255,255,255,.08);}',
    '.cc-page-btn:disabled{opacity:.25;cursor:not-allowed;}',
    '.cc-page-lbl{',
      'font-size:11px;color:#7d8694;letter-spacing:1px;font-weight:600;',
      'font-variant-numeric:tabular-nums;',
    '}',

    /* ── Empty state ────────────────────────────────────────────────── */
    '.cc-empty{',
      'position:absolute;inset:22px;display:flex;align-items:center;justify-content:center;',
      'pointer-events:none;',
    '}',
    '.cc-empty-inner{',
      'text-align:center;background:rgba(10,14,26,.85);backdrop-filter:blur(4px);',
      'padding:24px 32px;border-radius:14px;border:1px solid rgba(255,255,255,.06);',
      'pointer-events:auto;max-width:340px;',
    '}',
    '.cc-empty-icon{font-size:48px;margin-bottom:10px;opacity:.7;}',
    '.cc-empty-title{font-size:16px;font-weight:700;color:#e6ebf2;margin-bottom:6px;}',
    '.cc-empty-sub{font-size:12px;color:#7d8694;line-height:1.5;}',

    /* ── Rail module ────────────────────────────────────────────────── */
    '.cc-rail{',
      'display:flex;align-items:center;justify-content:space-between;',
      'background:linear-gradient(180deg,#101725,#0b111c);',
      'border:1px solid rgba(255,255,255,.06);border-radius:10px;',
      'padding:10px 12px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;',
      'cursor:pointer;transition:border-color .15s,background .15s;',
    '}',
    '.cc-rail:hover{border-color:rgba(255,255,255,.14);}',
    '.cc-rail-left{display:flex;align-items:center;gap:8px;color:#e6ebf2;font-size:12px;font-weight:600;}',
    '.cc-rail-icon{font-size:16px;}',
    '.cc-rail-count{color:#cfd6e0;font-variant-numeric:tabular-nums;}',
    '.cc-rail-cta{',
      'font-size:10px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;',
      'background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);',
      'color:#e6ebf2;padding:5px 9px;border-radius:999px;',
    '}',
  ].join('');

  // ── Tier helpers ──────────────────────────────────────────────────────────
  var TIERS = {
    legendary: { glow: '#e03030', label: 'LEGENDARY' },
    epic:      { glow: '#f59e0b', label: 'EPIC' },
    rare:      { glow: '#3b82f6', label: 'RARE' },
    common:    { glow: '#9aa0a8', label: 'COMMON' },
  };
  function tc(tier) { return TIERS[tier] || TIERS.common; }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function headshot(id) {
    return 'https://img.mlbstatic.com/mlb-photos/image/upload/' +
           'd_people:generic:headshot:67:current.png/w_213,q_auto:best/' +
           'v1/people/' + id + '/headshot/67/current';
  }

  function escHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function isPitcher(pos) {
    return pos === 'SP' || pos === 'RP' || pos === 'CP' || pos === 'P';
  }

  // Inline SVG silhouette used as <img onerror> fallback
  var SILHOUETTE_DATAURI =
    'data:image/svg+xml;utf8,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60">' +
        '<rect width="60" height="60" fill="#1a2030"/>' +
        '<circle cx="30" cy="23" r="9" fill="#3a4254"/>' +
        '<path d="M12 56c0-10 8-16 18-16s18 6 18 16z" fill="#3a4254"/>' +
      '</svg>'
    );

  // ── renderMiniCard ────────────────────────────────────────────────────────
  function renderMiniCard(slot, displayEvent, careerStats, idx) {
    var tier = tc(slot.tier);
    var isLegendaryGlow = slot.tier !== 'common';
    var primary = slot.teamPrimary || '#2a3142';

    // Tier-driven box shadow / border glow
    var glowShadow = isLegendaryGlow
      ? '0 0 0 1px ' + tier.glow + ',0 0 18px -4px ' + tier.glow + 'aa,0 4px 12px rgba(0,0,0,.5)'
      : '0 0 0 1px rgba(255,255,255,.06),0 4px 10px rgba(0,0,0,.45)';
    var ringBorder = isLegendaryGlow ? tier.glow : '#2a3142';

    // Career stats — 2x2 grid; placeholders while loading
    var pitcher = isPitcher(slot.position);
    var statCells;
    if (!careerStats) {
      // loading placeholders
      var lbls = pitcher ? ['ERA','WHIP','W','K'] : ['HR','AVG','RBI','OPS'];
      statCells = lbls.map(function (l) {
        return '<div class="cc-stat"><span class="cc-stat-val">—</span><span class="cc-stat-lbl">' + l + '</span></div>';
      }).join('');
    } else if (pitcher) {
      statCells =
        '<div class="cc-stat"><span class="cc-stat-val">' + escHtml(careerStats.careerERA)  + '</span><span class="cc-stat-lbl">ERA</span></div>' +
        '<div class="cc-stat"><span class="cc-stat-val">' + escHtml(careerStats.careerWHIP) + '</span><span class="cc-stat-lbl">WHIP</span></div>' +
        '<div class="cc-stat"><span class="cc-stat-val">' + escHtml(careerStats.careerW)    + '</span><span class="cc-stat-lbl">W</span></div>' +
        '<div class="cc-stat"><span class="cc-stat-val">' + escHtml(careerStats.careerK)    + '</span><span class="cc-stat-lbl">K</span></div>';
    } else {
      statCells =
        '<div class="cc-stat"><span class="cc-stat-val">' + escHtml(careerStats.careerHR)  + '</span><span class="cc-stat-lbl">HR</span></div>' +
        '<div class="cc-stat"><span class="cc-stat-val">' + escHtml(careerStats.careerAVG) + '</span><span class="cc-stat-lbl">AVG</span></div>' +
        '<div class="cc-stat"><span class="cc-stat-val">' + escHtml(careerStats.careerRBI) + '</span><span class="cc-stat-lbl">RBI</span></div>' +
        '<div class="cc-stat"><span class="cc-stat-val">' + escHtml(careerStats.careerOPS) + '</span><span class="cc-stat-lbl">OPS</span></div>';
    }

    // Flavor (event) text
    var flavorBadge = displayEvent && displayEvent.badge ? escHtml(displayEvent.badge) : '';
    var flavorMeta = '';
    if (displayEvent) {
      var d = displayEvent.date ? escHtml(displayEvent.date) : '';
      var inn = '';
      if (displayEvent.inning) {
        var arrow = displayEvent.halfInning === 'top' ? '▲' : '▼';
        inn = arrow + ' ' + displayEvent.inning;
      }
      var matchup = '';
      if (displayEvent.awayAbbr && displayEvent.homeAbbr) {
        matchup = escHtml(displayEvent.awayAbbr) + ' ' + (displayEvent.awayScore != null ? displayEvent.awayScore : '') +
                  ' @ ' + escHtml(displayEvent.homeAbbr) + ' ' + (displayEvent.homeScore != null ? displayEvent.homeScore : '');
      }
      flavorMeta = [d, inn, matchup].filter(Boolean).join(' · ');
    }

    var tintGradient =
      'background:linear-gradient(180deg,' + primary + '38 0%,' + primary + '12 35%,#0d1117 80%);';

    var stripeStyle = 'background:' + primary + ';';
    var cardStyle = 'box-shadow:' + glowShadow + ';';
    var ringStyle = 'border-color:' + ringBorder + ';';
    var badgeStyle = 'background:' + tier.glow + ';';
    var tierStyle = 'color:' + tier.glow + ';';

    var clickAttr = (idx != null)
      ? ' onclick="openCardFromCollection(' + idx + ')"'
      : '';

    return '' +
      '<article class="cc-card" style="' + cardStyle + '"' + clickAttr + '>' +
        '<div class="cc-card-stripe" style="' + stripeStyle + '"></div>' +
        '<div class="cc-card-tint" style="' + tintGradient + '"></div>' +
        '<span class="cc-evt-badge" style="' + badgeStyle + '">' + escHtml(slot.eventType || '') + '</span>' +
        '<div class="cc-card-body">' +
          '<div class="cc-card-top">' +
            '<div class="cc-shot-wrap" style="' + ringStyle + '">' +
              '<img class="cc-shot" alt="" src="' + headshot(slot.playerId) + '" ' +
                'onerror="this.onerror=null;this.src=\'' + SILHOUETTE_DATAURI + '\';this.style.opacity=.6;">' +
            '</div>' +
            '<div class="cc-card-id">' +
              '<span class="cc-card-name">' + escHtml(slot.playerName || '') + '</span>' +
              '<span class="cc-card-meta">' + escHtml(slot.teamAbbr || '') + ' · ' + escHtml(slot.position || '') + '</span>' +
              '<span class="cc-card-tier" style="' + tierStyle + '">' + tier.label + '</span>' +
            '</div>' +
          '</div>' +
          '<div class="cc-stats">' + statCells + '</div>' +
          (flavorBadge || flavorMeta
            ? '<div class="cc-flavor">' +
                (flavorBadge ? '<span class="cc-flavor-badge">' + flavorBadge + '</span>' : '') +
                (flavorMeta  ? '<span class="cc-flavor-meta">'  + flavorMeta  + '</span>' : '') +
              '</div>'
            : '') +
        '</div>' +
      '</article>';
  }

  // ── renderBook ────────────────────────────────────────────────────────────
  function renderBook(opts) {
    injectCSS();
    opts = opts || {};
    var slots = opts.slots || [];
    var filter = opts.filter || 'all';
    var sort = opts.sort || 'newest';
    var page = opts.page || 0;
    var statsMap = opts.careerStatsMap || {};

    var perPage = 9;
    var totalPages = Math.max(1, Math.ceil(slots.length / perPage));
    var startIdx = page * perPage;
    var pageSlots = slots.slice(startIdx, startIdx + perPage);

    // Build pocket grid content — normal 3×3 paged view or team-grouped view
    var pockets = '';
    var teamPageContent = '';

    if (isTeam && slots.length > 0) {
      // Group by teamAbbr (slots already sorted by teamAbbr → tier)
      var teamGroups = {};
      var teamOrder = [];
      for (var ti = 0; ti < slots.length; ti++) {
        var ts = slots[ti];
        if (!teamGroups[ts.teamAbbr]) {
          teamGroups[ts.teamAbbr] = { abbr: ts.teamAbbr, primary: ts.teamPrimary, teamId: ts._teamId, cards: [] };
          teamOrder.push(ts.teamAbbr);
        }
        teamGroups[ts.teamAbbr].cards.push(ts);
      }
      for (var tgi = 0; tgi < teamOrder.length; tgi++) {
        var abbr = teamOrder[tgi];
        var grp = teamGroups[abbr];
        var logoHtml = grp.teamId
          ? '<img src="https://www.mlbstatic.com/team-logos/' + grp.teamId + '.svg"' +
            ' style="width:26px;height:26px;opacity:.45;flex-shrink:0;"' +
            ' onerror="this.style.display=\'none\'">'
          : '';
        teamPageContent +=
          '<div class="cc-team-header" style="border-left-color:' + grp.primary + '">' +
            logoHtml +
            '<span class="cc-team-abbr">' + abbr + '</span>' +
            '<span class="cc-team-count">' + grp.cards.length + ' card' + (grp.cards.length !== 1 ? 's' : '') + '</span>' +
          '</div>';
        for (var ci = 0; ci < grp.cards.length; ci++) {
          var cs = grp.cards[ci];
          var gIdx = slots.indexOf(cs);
          var cev = cs.events && cs.events.length
            ? cs.events[Math.floor(Math.random() * cs.events.length)] : null;
          teamPageContent +=
            '<div class="cc-pocket">' + renderMiniCard(cs, cev, statsMap[cs.playerId] || null, gIdx) + '</div>';
        }
      }
    } else {
      for (var i = 0; i < perPage; i++) {
        var slot = pageSlots[i];
        if (slot) {
          var globalIdx = startIdx + i;
          var ev = slot.events && slot.events.length
            ? slot.events[Math.floor(Math.random() * slot.events.length)]
            : null;
          var stats = statsMap[slot.playerId] || null;
          pockets +=
            '<div class="cc-pocket">' +
              renderMiniCard(slot, ev, stats, globalIdx) +
            '</div>';
        } else {
          pockets +=
            '<div class="cc-pocket is-empty">' +
              '<span class="cc-pocket-empty-icon">🔒</span>' +
            '</div>';
        }
      }
    }

    // 5 binder rings
    var rings = '';
    for (var r = 0; r < 5; r++) rings += '<div class="cc-ring"></div>';

    var isAll = filter === 'all', isHR = filter === 'HR', isRBI = filter === 'RBI';
    var isNew = sort === 'newest', isRare = sort === 'rarity', isTeam = sort === 'team';

    var emptyOverlay = slots.length === 0
      ? '<div class="cc-empty"><div class="cc-empty-inner">' +
          '<div class="cc-empty-icon">🎴</div>' +
          '<div class="cc-empty-title">Your binder is empty</div>' +
          '<div class="cc-empty-sub">Collect HR &amp; RBI events in the Pulse feed to fill your collection.</div>' +
        '</div></div>'
      : '';

    return '' +
      '<div class="cc-binder">' +
        // Header
        '<header class="cc-head">' +
          '<div class="cc-title">' +
            '<span class="cc-title-main">📚 Card Collection</span>' +
            '<span class="cc-title-count">' + slots.length + ' card' + (slots.length === 1 ? '' : 's') + '</span>' +
          '</div>' +
          '<button class="cc-close" onclick="closeCollection()">✕ Close</button>' +
        '</header>' +
        // Toolbar
        '<div class="cc-toolbar">' +
          '<div class="cc-pills">' +
            '<span class="cc-toolbar-label">Filter</span>' +
            '<button class="cc-pill ' + (isAll ? 'is-active' : '') + '" onclick="filterCollection(\'all\')">All</button>' +
            '<button class="cc-pill ' + (isHR  ? 'is-active' : '') + '" onclick="filterCollection(\'HR\')">HR</button>' +
            '<button class="cc-pill ' + (isRBI ? 'is-active' : '') + '" onclick="filterCollection(\'RBI\')">RBI</button>' +
          '</div>' +
          '<div class="cc-toolbar-right">' +
            '<span class="cc-toolbar-label">Sort</span>' +
            '<button class="cc-pill ' + (isNew  ? 'is-active' : '') + '" onclick="sortCollection(\'newest\')">Newest</button>' +
            '<button class="cc-pill ' + (isRare ? 'is-active' : '') + '" onclick="sortCollection(\'rarity\')">By Rarity</button>' +
            '<button class="cc-pill ' + (isTeam ? 'is-active' : '') + '" onclick="sortCollection(\'team\')">By Team</button>' +
          '</div>' +
        '</div>' +
        // Body
        '<div class="cc-body">' +
          '<div class="cc-spine">' + rings + '</div>' +
          '<div class="cc-page">' +
            (isTeam
              ? '<div class="cc-grid cc-grid-team">' + teamPageContent + '</div>'
              : '<div class="cc-grid">' + pockets + '</div>') +
            emptyOverlay +
          '</div>' +
        '</div>' +
        // Footer — hidden in team view (all cards shown at once)
        (isTeam ? '' :
          '<footer class="cc-foot">' +
            '<button class="cc-page-btn" onclick="goCollectionPage(-1)" ' + (page <= 0 ? 'disabled' : '') + '>◀</button>' +
            '<span class="cc-page-lbl">PAGE ' + (page + 1) + ' / ' + totalPages + '</span>' +
            '<button class="cc-page-btn" onclick="goCollectionPage(1)" ' + (page >= totalPages - 1 ? 'disabled' : '') + '>▶</button>' +
          '</footer>') +
      '</div>';
  }

  // ── renderRailModule ──────────────────────────────────────────────────────
  function renderRailModule(totalCount) {
    injectCSS();
    var n = totalCount || 0;
    return '' +
      '<div class="cc-rail" onclick="openCollection()">' +
        '<div class="cc-rail-left">' +
          '<span class="cc-rail-icon">🎴</span>' +
          '<span class="cc-rail-count">' + n + ' card' + (n === 1 ? '' : 's') + '</span>' +
        '</div>' +
        '<span class="cc-rail-cta">Open →</span>' +
      '</div>';
  }

  // ── demo ──────────────────────────────────────────────────────────────────
  function demo() {
    injectCSS();

    var sampleSlots = [
      { playerId:592450, playerName:'Pete Alonso',       teamAbbr:'NYM', teamPrimary:'#002D72', teamSecondary:'#FF5910', position:'1B', eventType:'HR',  tier:'legendary', collectedAt:Date.now()-1*864e5,
        events:[{ badge:'GRAND SLAM!',         date:'2026-04-29', inning:7, halfInning:'bottom', awayAbbr:'ATL', homeAbbr:'NYM', awayScore:3, homeScore:8 }]},
      { playerId:660271, playerName:'Juan Soto',         teamAbbr:'NYM', teamPrimary:'#002D72', teamSecondary:'#FF5910', position:'RF', eventType:'HR',  tier:'epic',      collectedAt:Date.now()-2*864e5,
        events:[{ badge:'💥 HOME RUN!',        date:'2026-04-28', inning:4, halfInning:'top',    awayAbbr:'NYM', homeAbbr:'PHI', awayScore:5, homeScore:2 }]},
      { playerId:668731, playerName:'Francisco Lindor',  teamAbbr:'NYM', teamPrimary:'#002D72', teamSecondary:'#FF5910', position:'SS', eventType:'RBI', tier:'rare',      collectedAt:Date.now()-3*864e5,
        events:[{ badge:'GO-AHEAD SINGLE!',    date:'2026-04-27', inning:9, halfInning:'bottom', awayAbbr:'WSH', homeAbbr:'NYM', awayScore:4, homeScore:5 }]},
      { playerId:547180, playerName:'Aaron Judge',       teamAbbr:'NYY', teamPrimary:'#003087', teamSecondary:'#E4002C', position:'RF', eventType:'HR',  tier:'legendary', collectedAt:Date.now()-4*864e5,
        events:[{ badge:'WALK-OFF BLAST!',     date:'2026-04-26', inning:10,halfInning:'bottom', awayAbbr:'BOS', homeAbbr:'NYY', awayScore:6, homeScore:7 }]},
      { playerId:514888, playerName:'Mike Trout',        teamAbbr:'LAA', teamPrimary:'#BA0021', teamSecondary:'#003263', position:'CF', eventType:'HR',  tier:'epic',      collectedAt:Date.now()-5*864e5,
        events:[{ badge:'2-RUN SHOT',          date:'2026-04-25', inning:6, halfInning:'top',    awayAbbr:'LAA', homeAbbr:'SEA', awayScore:4, homeScore:1 }]},
      { playerId:605141, playerName:'Mookie Betts',      teamAbbr:'LAD', teamPrimary:'#005A9C', teamSecondary:'#EF3E42', position:'RF', eventType:'RBI', tier:'common',    collectedAt:Date.now()-6*864e5,
        events:[{ badge:'SAC FLY',             date:'2026-04-24', inning:3, halfInning:'bottom', awayAbbr:'SF',  homeAbbr:'LAD', awayScore:0, homeScore:1 }]},
      { playerId:596019, playerName:'Freddie Freeman',   teamAbbr:'LAD', teamPrimary:'#005A9C', teamSecondary:'#EF3E42', position:'1B', eventType:'RBI', tier:'rare',      collectedAt:Date.now()-7*864e5,
        events:[{ badge:'CLUTCH DOUBLE!',      date:'2026-04-23', inning:8, halfInning:'top',    awayAbbr:'LAD', homeAbbr:'COL', awayScore:5, homeScore:4 }]},
      { playerId:608369, playerName:'Ronald Acuña Jr.',  teamAbbr:'ATL', teamPrimary:'#CE1141', teamSecondary:'#13274F', position:'RF', eventType:'HR',  tier:'common',    collectedAt:Date.now()-8*864e5,
        events:[{ badge:'SOLO SHOT',           date:'2026-04-22', inning:1, halfInning:'top',    awayAbbr:'ATL', homeAbbr:'MIA', awayScore:1, homeScore:0 }]},
      { playerId:543685, playerName:'Max Scherzer',      teamAbbr:'NYM', teamPrimary:'#002D72', teamSecondary:'#FF5910', position:'SP', eventType:'RBI', tier:'epic',      collectedAt:Date.now()-9*864e5,
        events:[{ badge:'RBI SINGLE',          date:'2026-04-21', inning:5, halfInning:'top',    awayAbbr:'NYM', homeAbbr:'CHC', awayScore:3, homeScore:2 }]},
    ];

    var statsMap = {
      592450: { careerHR: 226, careerAVG: '.249', careerRBI: 586, careerOPS: '.852' },
      660271: { careerHR: 201, careerAVG: '.285', careerRBI: 592, careerOPS: '.953' },
      668731: { careerHR: 234, careerAVG: '.272', careerRBI: 825, careerOPS: '.811' },
      547180: { careerHR: 322, careerAVG: '.288', careerRBI: 690, careerOPS: '.999' },
      514888: { careerHR: 378, careerAVG: '.299', careerRBI: 952, careerOPS: '1.002' },
      605141: { careerHR: 257, careerAVG: '.295', careerRBI: 821, careerOPS: '.892' },
      596019: { careerHR: 343, careerAVG: '.301', careerRBI: 1248,careerOPS: '.901' },
      608369: { careerHR: 184, careerAVG: '.291', careerRBI: 470, careerOPS: '.913' },
      543685: { careerERA: '3.16', careerWHIP: '1.09', careerW: 216, careerK: 3412 },
    };

    var overlay = document.getElementById('collectionOverlay');
    var book    = document.getElementById('collectionBook');
    if (!overlay || !book) {
      // Self-mount fallback if host elements aren't present
      overlay = document.createElement('div');
      overlay.id = 'collectionOverlay';
      overlay.style.cssText =
        'position:fixed;inset:0;display:none;align-items:center;justify-content:center;' +
        'background:rgba(0,0,0,.7);backdrop-filter:blur(6px);z-index:9999;padding:40px;';
      book = document.createElement('div');
      book.id = 'collectionBook';
      book.style.cssText = 'width:min(1100px,100%);height:min(720px,100%);';
      overlay.appendChild(book);
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) overlay.style.display = 'none';
      });
      document.body.appendChild(overlay);
    }

    book.innerHTML = renderBook({
      slots: sampleSlots,
      filter: 'all',
      sort: 'newest',
      page: 0,
      careerStatsMap: statsMap,
    });
    overlay.style.display = 'flex';
  }

  // ── Export ────────────────────────────────────────────────────────────────
  window.CollectionCard = {
    renderBook: renderBook,
    renderMiniCard: renderMiniCard,
    renderRailModule: renderRailModule,
    demo: demo,
  };
})();
