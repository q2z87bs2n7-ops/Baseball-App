/* collectionCard.js — Card Collection binder UI
 * Exports window.CollectionCard with renderBook / renderMiniCard / renderRailModule / demo
 * No imports, no build step. All styling inline or scoped via <style> injection.
 */
(function () {
  'use strict';

  // ── Tier system ────────────────────────────────────────────────────────────
  var TIERS = {
    legendary: { glow: '#e03030', glowAlpha: 'rgba(224,48,48,0.18)', label: 'LEGENDARY', ring: '#e03030' },
    epic:      { glow: '#f59e0b', glowAlpha: 'rgba(245,158,11,0.15)', label: 'EPIC',      ring: '#f59e0b' },
    rare:      { glow: '#3b82f6', glowAlpha: 'rgba(59,130,246,0.15)', label: 'RARE',      ring: '#3b82f6' },
    common:    { glow: null,      glowAlpha: 'rgba(255,255,255,0.03)', label: 'COMMON',    ring: 'rgba(255,255,255,0.15)' },
  };
  function tc(tier) { return TIERS[tier] || TIERS.common; }

  function headshot(id) {
    return 'https://img.mlbstatic.com/mlb-photos/image/upload/'
      + 'd_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/' + id + '/headshot/67/current';
  }

  // Silhouette fallback SVG (data URI, safe for onerror)
  var FALLBACK_IMG = "this.onerror=null;this.src=\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Ccircle cx='30' cy='30' r='30' fill='%23222'/%3E%3Ccircle cx='30' cy='22' r='10' fill='%23444'/%3E%3Cellipse cx='30' cy='48' rx='16' ry='12' fill='%23444'/%3E%3C/svg%3E\"";

  // ── Global CSS (injected once) ─────────────────────────────────────────────
  var CSS_ID = 'cc-styles';
  function injectCSS() {
    if (document.getElementById(CSS_ID)) return;
    var s = document.createElement('style');
    s.id = CSS_ID;
    s.textContent = [
      /* Binder shell */
      '.cc-binder{font-family:system-ui,-apple-system,BlinkMacSystemFont,sans-serif;background:#080c14;border-radius:12px;overflow:hidden;display:flex;flex-direction:column}',
      /* Header */
      '.cc-hdr{display:flex;align-items:center;justify-content:space-between;padding:14px 20px;background:linear-gradient(135deg,#131c2e 0%,#0d1520 100%);border-bottom:1px solid rgba(255,255,255,.07)}',
      '.cc-hdr-title{font-size:.95rem;font-weight:800;color:#e8eaf0;letter-spacing:.03em}',
      '.cc-hdr-count{font-size:.65rem;color:#9aa0a8;margin-left:10px;font-weight:600}',
      '.cc-close-btn{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:#9aa0a8;border-radius:7px;padding:5px 12px;cursor:pointer;font-size:.68rem;font-weight:600;transition:all .15s}',
      '.cc-close-btn:hover{background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.25);color:#e8eaf0}',
      /* Toolbar */
      '.cc-toolbar{display:flex;align-items:center;gap:6px;padding:10px 20px;background:#0a0e1a;border-bottom:1px solid rgba(255,255,255,.05);flex-wrap:wrap}',
      '.cc-pill{padding:4px 12px;border-radius:20px;border:1px solid rgba(255,255,255,.1);font-size:.62rem;font-weight:700;cursor:pointer;letter-spacing:.05em;text-transform:uppercase;transition:all .15s;background:rgba(255,255,255,.04);color:#9aa0a8}',
      '.cc-pill:hover{border-color:rgba(255,255,255,.25);color:#e8eaf0}',
      '.cc-pill.cc-active{background:#e8eaf0;color:#080c14;border-color:#e8eaf0}',
      '.cc-sep{flex:1;min-width:8px}',
      /* Body — spine + page */
      '.cc-body{display:flex;flex:1;min-height:440px}',
      /* Spine */
      '.cc-spine{width:36px;background:linear-gradient(180deg,#192030 0%,#111827 40%,#192030 100%);border-right:2px solid rgba(255,255,255,.05);display:flex;flex-direction:column;align-items:center;padding:24px 0;gap:20px;flex-shrink:0}',
      '.cc-ring{width:20px;height:20px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#3a4a6a 0%,#1a2535 60%,#0d1520 100%);border:2px solid rgba(255,255,255,.18);box-shadow:inset 0 1px 2px rgba(255,255,255,.12),0 1px 3px rgba(0,0,0,.5)}',
      /* Page area */
      '.cc-page{flex:1;padding:18px 18px 18px 16px;background:#0a0e1a;overflow-y:auto}',
      /* 3-col card grid */
      '.cc-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}',
      /* Pocket sleeve (outer container) */
      '.cc-pocket{border-radius:10px;padding:6px;background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.06);position:relative}',
      /* Mini card */
      '.cc-card{border-radius:8px;overflow:hidden;cursor:pointer;display:flex;flex-direction:column;align-items:center;padding:10px 8px 8px;position:relative;min-height:200px;transition:transform .15s,box-shadow .15s}',
      '.cc-card:hover{transform:translateY(-2px)}',
      '.cc-card-stripe{position:absolute;top:0;left:0;right:0;height:3px}',
      '.cc-card-badge{position:absolute;top:8px;right:6px;font-size:.5rem;font-weight:800;padding:2px 6px;border-radius:10px;letter-spacing:.06em;text-transform:uppercase}',
      '.cc-card-photo{width:58px;height:58px;border-radius:50%;object-fit:cover;margin-top:4px;flex-shrink:0;border:2px solid transparent}',
      '.cc-card-name{font-size:.6rem;font-weight:800;color:#e8eaf0;text-align:center;margin-top:6px;letter-spacing:.02em;line-height:1.2;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 4px}',
      '.cc-card-meta{font-size:.48rem;color:#9aa0a8;margin-top:1px;letter-spacing:.04em}',
      '.cc-card-tier{font-size:.48rem;font-weight:800;letter-spacing:.12em;margin-top:5px;text-transform:uppercase}',
      /* 2×2 career stat grid */
      '.cc-stats{display:grid;grid-template-columns:1fr 1fr;gap:4px 8px;width:100%;margin-top:7px;padding:0 2px}',
      '.cc-stat{text-align:center;background:rgba(255,255,255,.04);border-radius:4px;padding:3px 2px}',
      '.cc-stat-val{font-size:.58rem;font-weight:700;color:#e8eaf0;line-height:1.1}',
      '.cc-stat-lbl{font-size:.4rem;color:#9aa0a8;text-transform:uppercase;letter-spacing:.06em;line-height:1}',
      '.cc-card-flavor{font-size:.46rem;color:rgba(154,160,168,.7);margin-top:auto;padding-top:6px;text-align:center;line-height:1.3}',
      /* Empty pocket */
      '.cc-empty-pocket{min-height:200px;border-radius:8px;border:1px dashed rgba(255,255,255,.07);background:rgba(255,255,255,.015);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px}',
      /* Footer */
      '.cc-footer{display:flex;align-items:center;justify-content:center;gap:20px;padding:12px 20px;background:#080c14;border-top:1px solid rgba(255,255,255,.05)}',
      '.cc-page-btn{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:#9aa0a8;border-radius:6px;padding:5px 14px;cursor:pointer;font-size:.68rem;font-weight:600;transition:all .15s}',
      '.cc-page-btn:hover:not(:disabled){background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.22);color:#e8eaf0}',
      '.cc-page-btn:disabled{opacity:.25;cursor:default}',
      '.cc-page-label{font-size:.62rem;color:#9aa0a8;letter-spacing:.08em;font-weight:600}',
    ].join('');
    document.head.appendChild(s);
  }

  // ── Mini card ──────────────────────────────────────────────────────────────
  function renderMiniCard(slot, displayEvent, careerStats, idx) {
    var t = tc(slot.tier);
    var isPitcher = ['SP', 'RP', 'CP', 'P'].indexOf((slot.position || '').toUpperCase()) !== -1;

    // Background: subtle team tint
    var cardBg = 'linear-gradient(170deg,' + slot.teamPrimary + '28 0%,#0d1117 55%)';
    var borderColor = t.glow || 'rgba(255,255,255,0.1)';
    var glowCss = t.glow ? 'box-shadow:0 0 14px ' + t.glow + '50,0 0 2px ' + t.glow + '80;' : '';

    // Event type badge bg: use tier glow if available, else team secondary
    var badgeBg  = t.glow || slot.teamPrimary || '#334';
    var badgeTxt = (slot.tier === 'common') ? 'rgba(255,255,255,.6)' : '#fff';

    // Career stats — 2×2 grid
    var s1v, s1l, s2v, s2l, s3v, s3l, s4v, s4l;
    if (careerStats) {
      if (isPitcher) {
        s1v = careerStats.careerERA;  s1l = 'ERA';
        s2v = careerStats.careerWHIP; s2l = 'WHIP';
        s3v = careerStats.careerW;    s3l = 'W';
        s4v = careerStats.careerK;    s4l = 'K';
      } else {
        s1v = careerStats.careerHR;   s1l = 'HR';
        s2v = careerStats.careerAVG;  s2l = 'AVG';
        s3v = careerStats.careerRBI;  s3l = 'RBI';
        s4v = careerStats.careerOPS;  s4l = 'OPS';
      }
    } else {
      s1v = s2v = s3v = s4v = '—'; s1l = 'HR'; s2l = 'AVG'; s3l = 'RBI'; s4l = 'OPS';
    }

    var flavorBadge = displayEvent ? displayEvent.badge : '';
    var flavorDate  = displayEvent ? displayEvent.date  : '';

    return '<div class="cc-card" onclick="openCardFromCollection(' + idx + ')"'
      + ' style="background:' + cardBg + ';border:1px solid ' + borderColor + ';' + glowCss + '">'
      + '<div class="cc-card-stripe" style="background:' + slot.teamPrimary + '"></div>'
      + '<div class="cc-card-badge" style="background:' + badgeBg + 'cc;color:' + badgeTxt + '">' + slot.eventType + '</div>'
      + '<img class="cc-card-photo" src="' + headshot(slot.playerId) + '" onerror="' + FALLBACK_IMG + '"'
        + ' style="border-color:' + (t.glow || 'rgba(255,255,255,.2)') + '">'
      + '<div class="cc-card-name">' + escHtml(slot.playerName) + '</div>'
      + '<div class="cc-card-meta">' + escHtml(slot.teamAbbr) + (slot.position ? ' · ' + slot.position : '') + '</div>'
      + '<div class="cc-card-tier" style="color:' + (t.glow || '#9aa0a8') + '">' + t.label + '</div>'
      + '<div class="cc-stats">'
        + '<div class="cc-stat"><div class="cc-stat-val">' + s1v + '</div><div class="cc-stat-lbl">' + s1l + '</div></div>'
        + '<div class="cc-stat"><div class="cc-stat-val">' + s2v + '</div><div class="cc-stat-lbl">' + s2l + '</div></div>'
        + '<div class="cc-stat"><div class="cc-stat-val">' + s3v + '</div><div class="cc-stat-lbl">' + s3l + '</div></div>'
        + '<div class="cc-stat"><div class="cc-stat-val">' + s4v + '</div><div class="cc-stat-lbl">' + s4l + '</div></div>'
      + '</div>'
      + '<div class="cc-card-flavor">' + escHtml(flavorBadge) + (flavorDate ? '<br>' + flavorDate : '') + '</div>'
      + '</div>';
  }

  // ── Full binder ────────────────────────────────────────────────────────────
  function renderBook(opts) {
    injectCSS();
    var slots       = opts.slots       || [];
    var filter      = opts.filter      || 'all';
    var sort        = opts.sort        || 'newest';
    var page        = opts.page        || 0;
    var csMap       = opts.careerStatsMap || {};
    var totalPages  = Math.max(1, Math.ceil(slots.length / 9));
    var pageSlots   = slots.slice(page * 9, (page + 1) * 9);
    var totalSlots  = slots.length;

    // Filter pills
    var filterPills = ['all', 'HR', 'RBI'].map(function (f) {
      var active = filter === f;
      return '<button class="cc-pill' + (active ? ' cc-active' : '') + '" onclick="filterCollection(\'' + f + '\')">'
        + (f === 'all' ? 'All' : f) + '</button>';
    }).join('');

    // Sort pills
    var sortPills = [['newest', 'Newest'], ['rarity', 'By Rarity']].map(function (p) {
      var active = sort === p[0];
      return '<button class="cc-pill' + (active ? ' cc-active' : '') + '" onclick="sortCollection(\'' + p[0] + '\')">'
        + p[1] + '</button>';
    }).join('');

    // Binder rings (5 decorative)
    var rings = '';
    for (var r = 0; r < 5; r++) rings += '<div class="cc-ring"></div>';

    // Card grid — always fill 9 pockets
    var gridHtml = '';
    if (!totalSlots) {
      // Full empty state
      gridHtml = '<div style="grid-column:1/-1;text-align:center;padding:60px 20px">'
        + '<div style="font-size:36px;margin-bottom:14px;opacity:.35">🎴</div>'
        + '<div style="font-size:.78rem;font-weight:700;color:#e8eaf0;margin-bottom:6px">Your binder is empty</div>'
        + '<div style="font-size:.65rem;color:#9aa0a8;line-height:1.5">Collect HR &amp; RBI events in the Pulse feed<br>to fill your collection</div>'
        + '</div>';
    } else {
      for (var i = 0; i < 9; i++) {
        var slot = pageSlots[i];
        gridHtml += '<div class="cc-pocket">';
        if (slot) {
          var ev = slot.events[Math.floor(Math.random() * slot.events.length)];
          gridHtml += renderMiniCard(slot, ev, csMap[slot.playerId] || null, page * 9 + i);
        } else {
          gridHtml += '<div class="cc-empty-pocket">'
            + '<div style="font-size:22px;opacity:.25">🔒</div>'
            + '<div style="font-size:.48rem;color:rgba(255,255,255,.15);letter-spacing:.08em;text-transform:uppercase">Empty</div>'
            + '</div>';
        }
        gridHtml += '</div>';
      }
    }

    var countLabel = totalSlots + ' card' + (totalSlots !== 1 ? 's' : '');

    return '<div class="cc-binder">'
      // Header
      + '<div class="cc-hdr">'
        + '<div style="display:flex;align-items:baseline;gap:0">'
          + '<span class="cc-hdr-title">📚 Card Collection</span>'
          + '<span class="cc-hdr-count">' + countLabel + '</span>'
        + '</div>'
        + '<button class="cc-close-btn" onclick="closeCollection()">✕ Close</button>'
      + '</div>'
      // Toolbar
      + '<div class="cc-toolbar">' + filterPills + '<div class="cc-sep"></div>' + sortPills + '</div>'
      // Body
      + '<div class="cc-body">'
        + '<div class="cc-spine">' + rings + '</div>'
        + '<div class="cc-page"><div class="cc-grid">' + gridHtml + '</div></div>'
      + '</div>'
      // Footer pagination
      + '<div class="cc-footer">'
        + '<button class="cc-page-btn" onclick="goCollectionPage(-1)"' + (page <= 0 ? ' disabled' : '') + '>◀</button>'
        + '<span class="cc-page-label">PAGE ' + (page + 1) + ' / ' + totalPages + '</span>'
        + '<button class="cc-page-btn" onclick="goCollectionPage(1)"' + (page >= totalPages - 1 ? ' disabled' : '') + '>▶</button>'
      + '</div>'
    + '</div>';
  }

  // ── Rail module (compact Pulse side chip) ──────────────────────────────────
  function renderRailModule(totalCount) {
    if (!totalCount) return '';
    return '<div style="background:linear-gradient(135deg,rgba(255,255,255,.05),rgba(255,255,255,.02));'
      + 'border:1px solid rgba(255,255,255,.09);border-radius:10px;padding:10px 12px;'
      + 'display:flex;align-items:center;justify-content:space-between;gap:8px">'
      + '<div style="display:flex;align-items:center;gap:10px">'
        + '<span style="font-size:18px;line-height:1">🎴</span>'
        + '<div>'
          + '<div style="font-size:.72rem;font-weight:700;color:#e8eaf0;line-height:1.2">'
            + totalCount + ' card' + (totalCount === 1 ? '' : 's')
          + '</div>'
          + '<div style="font-size:.52rem;color:#9aa0a8;letter-spacing:.06em;text-transform:uppercase">Collection</div>'
        + '</div>'
      + '</div>'
      + '<button onclick="openCollection()" style="font-size:.6rem;font-weight:700;padding:5px 12px;'
        + 'background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.13);color:#e8eaf0;'
        + 'border-radius:16px;cursor:pointer;letter-spacing:.05em;white-space:nowrap;'
        + 'transition:background .15s" onmouseover="this.style.background=\'rgba(255,255,255,.13)\'" '
        + 'onmouseout="this.style.background=\'rgba(255,255,255,.07)\'">Open →</button>'
    + '</div>';
  }

  // ── Demo ───────────────────────────────────────────────────────────────────
  function demo() {
    var now = Date.now();
    var sampleSlots = [
      { playerId:592450, playerName:'Pete Alonso',      teamAbbr:'NYM', teamPrimary:'#002D72', teamSecondary:'#FF5910', position:'1B', eventType:'HR',  tier:'epic',      collectedAt:now-3600000,  events:[{badge:'GRAND SLAM!',          date:'2026-05-01',inning:7,halfInning:'bottom',awayAbbr:'PHI',homeAbbr:'NYM',awayScore:3,homeScore:7}] },
      { playerId:660271, playerName:'Juan Soto',         teamAbbr:'NYM', teamPrimary:'#002D72', teamSecondary:'#FF5910', position:'RF', eventType:'HR',  tier:'legendary', collectedAt:now-7200000,  events:[{badge:'WALK-OFF HOME RUN!',   date:'2026-04-28',inning:9,halfInning:'bottom',awayAbbr:'ATL',homeAbbr:'NYM',awayScore:4,homeScore:5}] },
      { playerId:668731, playerName:'Francisco Lindor',  teamAbbr:'NYM', teamPrimary:'#002D72', teamSecondary:'#FF5910', position:'SS', eventType:'RBI', tier:'rare',      collectedAt:now-10800000, events:[{badge:'GO-AHEAD SINGLE!',     date:'2026-04-27',inning:8,halfInning:'top',  awayAbbr:'NYM',homeAbbr:'WSH',awayScore:3,homeScore:2}] },
      { playerId:543685, playerName:'Max Scherzer',      teamAbbr:'NYM', teamPrimary:'#002D72', teamSecondary:'#FF5910', position:'SP', eventType:'RBI', tier:'common',    collectedAt:now-14400000, events:[{badge:'RBI SINGLE!',          date:'2026-04-25',inning:3,halfInning:'top',  awayAbbr:'NYM',homeAbbr:'MIA',awayScore:2,homeScore:1}] },
      { playerId:547180, playerName:'Aaron Judge',       teamAbbr:'NYY', teamPrimary:'#003087', teamSecondary:'#C4CED4', position:'RF', eventType:'HR',  tier:'legendary', collectedAt:now-18000000, events:[{badge:'WALK-OFF GRAND SLAM!', date:'2026-04-20',inning:9,halfInning:'bottom',awayAbbr:'BOS',homeAbbr:'NYY',awayScore:3,homeScore:7}] },
      { playerId:514888, playerName:'Mike Trout',        teamAbbr:'LAA', teamPrimary:'#BA0021', teamSecondary:'#003263', position:'CF', eventType:'HR',  tier:'rare',      collectedAt:now-21600000, events:[{badge:'GO-AHEAD HOME RUN!',   date:'2026-04-18',inning:6,halfInning:'top',  awayAbbr:'LAA',homeAbbr:'HOU',awayScore:3,homeScore:2}] },
      { playerId:605141, playerName:'Mookie Betts',      teamAbbr:'LAD', teamPrimary:'#005A9C', teamSecondary:'#EF3E42', position:'RF', eventType:'RBI', tier:'epic',      collectedAt:now-25200000, events:[{badge:'WALK-OFF DOUBLE!',      date:'2026-04-15',inning:10,halfInning:'bottom',awayAbbr:'SF',homeAbbr:'LAD',awayScore:2,homeScore:4}] },
      { playerId:596019, playerName:'Freddie Freeman',   teamAbbr:'LAD', teamPrimary:'#005A9C', teamSecondary:'#EF3E42', position:'1B', eventType:'HR',  tier:'common',    collectedAt:now-28800000, events:[{badge:'💥 HOME RUN!',          date:'2026-04-12',inning:4,halfInning:'top',  awayAbbr:'LAD',homeAbbr:'SD', awayScore:1,homeScore:0}] },
      { playerId:608369, playerName:'Ronald Acuña Jr.',  teamAbbr:'ATL', teamPrimary:'#CE1141', teamSecondary:'#13274F', position:'RF', eventType:'RBI', tier:'rare',      collectedAt:now-32400000, events:[{badge:'GO-AHEAD SINGLE!',     date:'2026-04-10',inning:7,halfInning:'top',  awayAbbr:'ATL',homeAbbr:'PHI',awayScore:4,homeScore:3}] },
    ];
    var sampleStats = {
      592450: { careerHR:226, careerAVG:'.262', careerRBI:659,  careerOPS:'.893' },
      660271: { careerHR:187, careerAVG:'.288', careerRBI:589,  careerOPS:'.926' },
      668731: { careerHR:168, careerAVG:'.271', careerRBI:543,  careerOPS:'.818' },
      543685: { careerERA:'3.15', careerWHIP:'1.04', careerW:214, careerK:3316   },
      547180: { careerHR:370, careerAVG:'.289', careerRBI:978,  careerOPS:'1.012'},
      514888: { careerHR:368, careerAVG:'.303', careerRBI:973,  careerOPS:'.994' },
      605141: { careerHR:227, careerAVG:'.296', careerRBI:672,  careerOPS:'.876' },
      596019: { careerHR:282, careerAVG:'.304', careerRBI:1007, careerOPS:'.902' },
      608369: { careerHR:177, careerAVG:'.283', careerRBI:508,  careerOPS:'.905' },
    };
    var overlay = document.getElementById('collectionOverlay');
    var book    = document.getElementById('collectionBook');
    if (!overlay || !book) { console.warn('CollectionCard.demo(): #collectionOverlay not found'); return; }
    book.innerHTML = renderBook({ slots: sampleSlots, filter: 'all', sort: 'newest', page: 0, careerStatsMap: sampleStats });
    overlay.style.display = 'flex';
  }

  // ── Util ───────────────────────────────────────────────────────────────────
  function escHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── Export ─────────────────────────────────────────────────────────────────
  window.CollectionCard = {
    renderBook:       renderBook,
    renderMiniCard:   renderMiniCard,
    renderRailModule: renderRailModule,
    demo:             demo,
  };
})();
