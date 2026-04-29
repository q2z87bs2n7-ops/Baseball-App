/* ────────────────────────────────────────────────────────────────────────────
   Pulse HR/RBI Card Templates — drop-in module
   ────────────────────────────────────────────────────────────────────────────
   USAGE (do not modify this file):

   1. Include in index.html:
        <script src="pulse-card-templates.js"></script>

   2. In showPlayerCard()  — replace the entire `card.innerHTML = '<div class="pc-photo-bg"...'` block with:

        card.innerHTML = window.PulseCard.render({
          batterId: batterId,
          name: batterName,
          team: teamData,            // {short, primary, secondary}
          position: position,
          jersey: jerseyNumber,
          badge: (badgeText || 'HOME RUN'),
          stats: { avg: avg, ops: ops, hr: hrPrev, rbi: rbi },
          highlight: 'hr',           // which stat cell glows
        });

   3. In showRBICard() — same swap, with:
        badge: badge,
        stats: { avg: avg, ops: ops, h: hits, rbi: rbiPrev },
        highlight: 'rbi',

   4. The HR-count animation (`.pc-hr-val` / `.pc-rbi-val` count-up) still works —
      this module emits matching class names on the value cells.

   5. Demo trigger — see PulseCard.demo() at bottom. Wire to Shift+H if desired.
   ──────────────────────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  // ── Shared helpers ────────────────────────────────────────────────────────
  var PHOTO = function (id) {
    return 'https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_640,q_auto:best/v1/people/' + id + '/headshot/67/current';
  };
  var ESC = function (s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };
  var lastName = function (full) {
    if (!full) return '';
    var parts = String(full).trim().split(/\s+/);
    return parts[parts.length - 1].toUpperCase();
  };
  var pickHighlight = function (cells, key) {
    return cells.map(function (c) { return Object.assign({}, c, { hi: c.k === key }); });
  };

  // Stat cell array per card variant
  var hrCells = function (s) {
    return [
      { k: 'avg', l: 'AVG', v: s.avg, valClass: '' },
      { k: 'ops', l: 'OPS', v: s.ops, valClass: '' },
      { k: 'hr',  l: 'HR',  v: s.hr,  valClass: 'pc-hr-val' },
      { k: 'rbi', l: 'RBI', v: s.rbi, valClass: '' },
    ];
  };
  var rbiCells = function (s) {
    return [
      { k: 'avg', l: 'AVG', v: s.avg, valClass: '' },
      { k: 'ops', l: 'OPS', v: s.ops, valClass: '' },
      { k: 'h',   l: 'H',   v: s.h,   valClass: '' },
      { k: 'rbi', l: 'RBI', v: s.rbi, valClass: 'pc-rbi-val' },
    ];
  };

  // ── V1 — STYLIZED GRAPHIC ─────────────────────────────────────────────────
  function renderV1(ctx) {
    var p = ctx.team, badge = ESC(ctx.badge);
    var ln = lastName(ctx.name);
    var cells = ctx.cells;
    var stats = cells.map(function (s) {
      return ''
        + '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;'
        + (s.hi ? 'background:' + p.secondary + ';' : '')
        + '">'
        +   '<div class="pc-stat-val ' + s.valClass + '" style="font-weight:900;font-size:26px;color:#fff;font-variant-numeric:tabular-nums;line-height:1;">' + ESC(s.v) + '</div>'
        +   '<div style="font-size:9px;font-weight:900;letter-spacing:.2em;color:' + (s.hi ? '#fff' : 'rgba(255,255,255,0.6)') + ';">' + s.l + '</div>'
        + '</div>';
    }).join('');
    return ''
      + '<div style="position:absolute;inset:0;background:' + p.primary + ';border-radius:10px;overflow:hidden;font-family:Helvetica,Arial,sans-serif;color:#fff;">'
      +   '<div style="position:absolute;inset:0;background:' + p.secondary + ';clip-path:polygon(0 0,100% 0,100% 38%,0 78%);"></div>'
      +   '<div style="position:absolute;inset:0;background-image:radial-gradient(circle,rgba(0,0,0,0.18) 1.5px,transparent 1.5px);background-size:8px 8px;clip-path:polygon(0 0,100% 0,100% 38%,0 78%);"></div>'
      +   '<div style="position:absolute;top:16px;left:14px;right:14px;font-weight:900;font-size:14px;letter-spacing:.25em;color:#fff;text-transform:uppercase;border-bottom:2px solid rgba(255,255,255,0.5);padding-bottom:8px;z-index:4;">' + badge + '</div>'
      +   '<div style="position:absolute;top:50px;left:14px;right:14px;font-weight:900;font-size:48px;letter-spacing:-0.04em;color:#fff;line-height:.9;text-transform:uppercase;z-index:2;">' + ESC(ln) + '</div>'
      +   '<div style="position:absolute;top:140px;right:18px;width:165px;height:165px;border-radius:50%;background-image:url(\'' + PHOTO(ctx.batterId) + '\');background-size:85% auto;background-position:center 25%;background-color:' + p.secondary + ';background-repeat:no-repeat;border:4px solid #fff;box-shadow:0 8px 20px rgba(0,0,0,0.3);z-index:3;"></div>'
      +   '<div style="position:absolute;top:145px;left:16px;font-weight:900;font-size:130px;letter-spacing:-0.05em;color:rgba(255,255,255,0.92);line-height:.8;z-index:2;text-shadow:4px 4px 0 ' + p.primary + ';">' + ESC(ctx.jersey || '') + '</div>'
      +   '<div style="position:absolute;top:110px;left:14px;background:#fff;color:' + p.primary + ';font-weight:900;font-size:11px;letter-spacing:.15em;padding:4px 10px;z-index:4;">' + ESC(ctx.position) + ' · ' + ESC(p.short) + '</div>'
      +   '<div style="position:absolute;bottom:0;left:0;right:0;height:86px;background:#000;display:grid;grid-template-columns:repeat(4,1fr);z-index:4;">' + stats + '</div>'
      + '</div>';
  }

  // ── V2 — STADIUM JUMBOTRON ────────────────────────────────────────────────
  function renderV2(ctx) {
    var p = ctx.team, badge = ESC(ctx.badge);
    var ln = lastName(ctx.name);
    var cells = ctx.cells;
    var stats = cells.map(function (s) {
      var glow = s.hi;
      return ''
        + '<div style="background:#0a0a0a;border:1px solid ' + (glow ? '#ffcc44' : 'rgba(255,255,255,0.15)') + ';padding:10px 4px;text-align:center;border-radius:3px;' + (glow ? 'box-shadow:0 0 12px rgba(255,204,68,0.4);' : '') + '">'
        +   '<div class="pc-stat-val ' + s.valClass + '" style="font-family:\'Courier New\',monospace;font-weight:900;font-size:18px;color:' + (glow ? '#ffcc44' : '#fff') + ';' + (glow ? 'text-shadow:0 0 8px #ffcc44;' : '') + 'font-variant-numeric:tabular-nums;line-height:1;">' + ESC(s.v) + '</div>'
        +   '<div style="font-size:8px;font-weight:700;letter-spacing:.18em;color:rgba(255,255,255,0.5);margin-top:4px;">' + s.l + '</div>'
        + '</div>';
    }).join('');
    return ''
      + '<div style="position:absolute;inset:0;background:#000;border-radius:10px;overflow:hidden;font-family:Helvetica,Arial,sans-serif;color:#fff;background-image:radial-gradient(ellipse at 50% 40%,' + p.primary + '33 0%,transparent 70%),radial-gradient(circle at center,#0a0e18 0%,#000 100%);">'
      +   '<div style="position:absolute;inset:0;background-image:radial-gradient(circle,rgba(255,255,255,0.04) 1px,transparent 1.2px);background-size:5px 5px;"></div>'
      +   '<div style="position:absolute;top:0;left:0;right:0;height:44px;background:#0a0a0a;border-bottom:2px solid ' + p.secondary + ';display:flex;align-items:center;justify-content:center;padding:0 14px;gap:14px;font-family:\'Courier New\',monospace;">'
      +     '<span style="font-size:11px;font-weight:900;letter-spacing:.15em;color:' + p.secondary + ';text-shadow:0 0 8px ' + p.secondary + ';">● LIVE</span>'
      +     '<span style="font-size:13px;font-weight:900;letter-spacing:.18em;color:#ffcc44;text-shadow:0 0 10px #ffcc44;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + badge + '</span>'
      +   '</div>'
      +   '<div style="position:absolute;top:64px;left:22px;right:22px;height:200px;background-image:url(\'' + PHOTO(ctx.batterId) + '\');background-size:auto 100%;background-position:center top;background-repeat:no-repeat;background-color:' + p.primary + ';border-radius:4px;filter:contrast(1.2) saturate(1.4);box-shadow:0 0 0 2px ' + p.primary + ',0 0 30px ' + p.primary + '88;">'
      +     '<div style="position:absolute;inset:0;border-radius:4px;background:repeating-linear-gradient(0deg,rgba(0,0,0,0.18) 0 2px,transparent 2px 4px);"></div>'
      +   '</div>'
      +   '<div style="position:absolute;top:274px;left:0;right:0;text-align:center;font-family:\'Courier New\',monospace;font-weight:900;font-size:28px;letter-spacing:.08em;color:#ffcc44;text-shadow:0 0 12px #ffcc44,0 0 24px #ffaa00;line-height:1;">' + ESC(ln) + '</div>'
      +   '<div style="position:absolute;top:308px;left:0;right:0;text-align:center;font-family:\'Courier New\',monospace;font-size:11px;font-weight:700;letter-spacing:.4em;color:rgba(255,255,255,0.5);">#' + ESC(ctx.jersey || '--') + ' · ' + ESC(ctx.position) + ' · ' + ESC(p.short) + '</div>'
      +   '<div style="position:absolute;bottom:16px;left:16px;right:16px;display:grid;grid-template-columns:repeat(4,1fr);gap:6px;">' + stats + '</div>'
      + '</div>';
  }

  // ── V3 — COMIC ────────────────────────────────────────────────────────────
  function renderV3(ctx) {
    var p = ctx.team, badge = ESC(ctx.badge);
    var ln = lastName(ctx.name);
    var burst = 'polygon(50% 0%,60% 12%,75% 4%,78% 18%,92% 14%,88% 30%,100% 36%,90% 48%,100% 62%,88% 70%,95% 86%,78% 82%,80% 96%,62% 88%,50% 100%,38% 88%,20% 96%,22% 82%,5% 86%,12% 70%,0% 62%,10% 48%,0% 36%,12% 30%,8% 14%,22% 18%,25% 4%,40% 12%)';
    var stats = ctx.cells.map(function (s, i) {
      return ''
        + '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;background:' + (s.hi ? '#ffd84a' : 'transparent') + ';' + (i < 3 ? 'border-right:2px solid #000;' : '') + '">'
        +   '<div class="pc-stat-val ' + s.valClass + '" style="font-weight:900;font-size:18px;color:' + (s.hi ? '#000' : '#fff') + ';font-variant-numeric:tabular-nums;line-height:1;">' + ESC(s.v) + '</div>'
        +   '<div style="font-size:8px;font-weight:900;letter-spacing:.15em;color:' + (s.hi ? '#000' : 'rgba(255,255,255,0.7)') + ';margin-top:3px;">' + s.l + '</div>'
        + '</div>';
    }).join('');
    var badgeFontSize = badge.length > 14 ? 13 : 16;
    return ''
      + '<div style="position:absolute;inset:0;background:#fff7e0;border-radius:10px;border:3px solid #000;overflow:hidden;font-family:Helvetica,Arial,sans-serif;color:#000;">'
      +   '<div style="position:absolute;inset:0;background-image:radial-gradient(circle,#ff4444 2px,transparent 2.2px);background-size:10px 10px;opacity:.5;"></div>'
      +   '<div style="position:absolute;top:70px;left:-20px;right:-20px;height:270px;background:#ffd84a;clip-path:' + burst + ';"></div>'
      +   '<div style="position:absolute;top:70px;left:-20px;right:-20px;height:270px;background-image:radial-gradient(circle,rgba(0,0,0,0.18) 1.5px,transparent 1.7px);background-size:7px 7px;clip-path:' + burst + ';"></div>'
      +   '<div style="position:absolute;top:110px;left:70px;width:180px;height:180px;border-radius:50%;background-image:url(\'' + PHOTO(ctx.batterId) + '\');background-size:82% auto;background-position:center 22%;background-repeat:no-repeat;background-color:' + p.primary + ';border:4px solid #000;filter:contrast(1.3) saturate(1.5);box-shadow:5px 5px 0 #000;z-index:3;"></div>'
      +   '<div style="position:absolute;top:18px;left:14px;background:#ff3344;color:#fff;border:3px solid #000;font-weight:900;font-size:' + badgeFontSize + 'px;letter-spacing:.04em;padding:6px 12px;transform:rotate(-6deg);box-shadow:4px 4px 0 #000;font-style:italic;max-width:220px;z-index:5;">' + badge + '</div>'
      +   '<div style="position:absolute;top:296px;left:0;right:0;text-align:center;font-weight:900;font-size:36px;letter-spacing:-0.02em;color:#000;line-height:.9;text-transform:uppercase;font-style:italic;-webkit-text-stroke:1px #000;z-index:4;">' + ESC(ln) + '</div>'
      +   '<div style="position:absolute;top:332px;left:0;right:0;text-align:center;font-weight:800;font-size:11px;letter-spacing:.2em;color:#000;z-index:4;">' + ESC(ctx.position) + ' · #' + ESC(ctx.jersey || '--') + ' · ' + ESC(p.short) + '</div>'
      +   '<div style="position:absolute;bottom:14px;left:14px;right:14px;height:64px;background:' + p.primary + ';border:3px solid #000;box-shadow:4px 4px 0 #000;display:grid;grid-template-columns:repeat(4,1fr);z-index:4;">' + stats + '</div>'
      + '</div>';
  }

  // ── V4 — BROADCAST ────────────────────────────────────────────────────────
  function renderV4(ctx) {
    var p = ctx.team, badge = ESC(ctx.badge);
    var ln = lastName(ctx.name);
    var stats = ctx.cells.map(function (s, i) {
      return ''
        + '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;background:' + (s.hi ? p.secondary : 'transparent') + ';' + (i < 3 ? 'border-right:1px solid rgba(255,255,255,0.1);' : '') + 'gap:4px;">'
        +   '<div class="pc-stat-val ' + s.valClass + '" style="font-weight:900;font-size:26px;font-style:italic;letter-spacing:-0.02em;color:#fff;font-variant-numeric:tabular-nums;line-height:1;">' + ESC(s.v) + '</div>'
        +   '<div style="font-size:8px;font-weight:800;letter-spacing:.22em;color:' + (s.hi ? '#fff' : 'rgba(255,255,255,0.5)') + ';">' + s.l + '</div>'
        + '</div>';
    }).join('');
    var badgeFontSize = badge.length > 16 ? 13 : 16;
    return ''
      + '<div style="position:absolute;inset:0;background:#0a0e18;border-radius:6px;overflow:hidden;font-family:Helvetica,Arial,sans-serif;color:#fff;">'
      +   '<div style="position:absolute;inset:0;background:linear-gradient(180deg,#0a0e18 0%,#0d1428 60%,#0a0e18 100%);"></div>'
      +   '<div style="position:absolute;top:0;left:0;width:100%;height:100%;background:' + p.primary + ';clip-path:polygon(0 0,100% 0,100% 22%,65% 28%,70% 35%,0 42%);"></div>'
      +   '<div style="position:absolute;top:0;left:0;width:100%;height:100%;background:' + p.secondary + ';clip-path:polygon(0 38%,70% 30%,65% 36%,100% 30%,100% 34%,0 42%);"></div>'
      +   '<div style="position:absolute;top:14px;right:14px;display:flex;align-items:center;gap:8px;z-index:5;">'
      +     '<div style="background:' + p.secondary + ';width:8px;height:8px;border-radius:50%;box-shadow:0 0 10px ' + p.secondary + ';"></div>'
      +     '<div style="font-size:9px;font-weight:900;letter-spacing:.25em;color:#fff;">LIVE</div>'
      +   '</div>'
      +   '<div style="position:absolute;top:70px;left:0;right:0;height:230px;background-image:url(\'' + PHOTO(ctx.batterId) + '\');background-size:auto 105%;background-position:center 18%;background-repeat:no-repeat;filter:contrast(1.1);-webkit-mask-image:linear-gradient(180deg,transparent 0%,black 12%,black 80%,transparent 100%);mask-image:linear-gradient(180deg,transparent 0%,black 12%,black 80%,transparent 100%);"></div>'
      +   '<div style="position:absolute;top:70px;left:0;right:0;height:230px;background:linear-gradient(180deg,transparent 30%,' + p.primary + '66 100%);"></div>'
      +   '<div style="position:absolute;top:240px;left:-8px;max-width:92%;transform:skewX(-12deg);background:' + p.secondary + ';padding:6px 18px 6px 14px;box-shadow:0 4px 0 ' + p.primary + ',0 8px 20px rgba(0,0,0,0.5);z-index:6;">'
      +     '<div style="transform:skewX(12deg);font-weight:900;font-size:' + badgeFontSize + 'px;letter-spacing:.05em;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,0.4);font-style:italic;white-space:nowrap;">' + badge + '</div>'
      +   '</div>'
      +   '<div style="position:absolute;bottom:96px;left:0;right:0;height:64px;background:#000;border-top:3px solid ' + p.secondary + ';border-bottom:1px solid ' + p.primary + ';padding:8px 18px;display:flex;align-items:center;gap:12px;z-index:5;">'
      +     '<div style="background:' + p.primary + ';color:#fff;font-weight:900;font-size:28px;width:50px;height:50px;min-width:50px;display:flex;align-items:center;justify-content:center;font-style:italic;letter-spacing:-0.05em;clip-path:polygon(8% 0,100% 0,92% 100%,0 100%);">' + ESC(ctx.jersey || '--') + '</div>'
      +     '<div style="flex:1;min-width:0;">'
      +       '<div style="font-weight:900;font-size:22px;letter-spacing:-0.01em;color:#fff;line-height:1;text-transform:uppercase;">' + ESC(ln) + '</div>'
      +       '<div style="font-size:9px;font-weight:700;letter-spacing:.2em;color:' + p.secondary + ';margin-top:4px;">' + ESC(ctx.position) + ' · ' + ESC(p.short) + '</div>'
      +     '</div>'
      +   '</div>'
      +   '<div style="position:absolute;bottom:0;left:0;right:0;height:90px;background:#000;display:grid;grid-template-columns:repeat(4,1fr);border-top:1px solid ' + p.primary + ';z-index:5;">' + stats + '</div>'
      + '</div>';
  }

  // ── Public API ────────────────────────────────────────────────────────────
  var VARIANTS = [renderV1, renderV2, renderV3, renderV4];
  var LABELS   = ['v1', 'v2', 'v3', 'v4'];
  var lastIdx  = -1;

  function pickRandomIdx() {
    if (VARIANTS.length === 1) return 0;
    var idx;
    do { idx = Math.floor(Math.random() * VARIANTS.length); }
    while (idx === lastIdx);
    lastIdx = idx;
    return idx;
  }

  function render(ctx) {
    // ctx must have: batterId, name, team{short,primary,secondary}, position, jersey,
    // badge, stats{...}, highlight ('hr'|'rbi')
    var cells = ctx.highlight === 'rbi' ? rbiCells(ctx.stats) : hrCells(ctx.stats);
    var fullCtx = Object.assign({}, ctx, { cells: pickHighlight(cells, ctx.highlight) });
    var idx = pickRandomIdx();
    var html = VARIANTS[idx](fullCtx);
    // wrap in a labelled root so we can target per-variant tweaks if needed
    return '<div class="pc-variant pc-' + LABELS[idx] + '" data-pulse-card="' + LABELS[idx] + '">' + html + '</div>';
  }

  // Force a specific variant (useful for the demo trigger)
  function renderForce(variant, ctx) {
    var i = LABELS.indexOf(variant);
    if (i < 0) i = 0;
    var cells = ctx.highlight === 'rbi' ? rbiCells(ctx.stats) : hrCells(ctx.stats);
    var fullCtx = Object.assign({}, ctx, { cells: pickHighlight(cells, ctx.highlight) });
    return '<div class="pc-variant pc-' + LABELS[i] + '" data-pulse-card="' + LABELS[i] + '">' + VARIANTS[i](fullCtx) + '</div>';
  }

  // Demo: fire a sample card. Wire to Shift+H during dev.
  function demo(opts) {
    opts = opts || {};
    var samples = [
      { id: 596019, name: 'Francisco Lindor',  jersey: '12', position: 'SS', team: { short: 'NYM', primary: '#002D72', secondary: '#FF5910' } },
      { id: 592450, name: 'Aaron Judge',       jersey: '99', position: 'RF', team: { short: 'NYY', primary: '#003087', secondary: '#E4002C' } },
      { id: 660271, name: 'Shohei Ohtani',     jersey: '17', position: 'DH', team: { short: 'LAD', primary: '#005A9C', secondary: '#EF3E42' } },
    ];
    var badges = ['HOME RUN', 'GO-AHEAD HOME RUN', 'GRAND SLAM', 'WALK-OFF HOME RUN', 'WALK-OFF GRAND SLAM'];
    var s = samples[Math.floor(Math.random() * samples.length)];
    var b = badges[Math.floor(Math.random() * badges.length)];
    var card = document.getElementById('playerCard');
    var overlay = document.getElementById('playerCardOverlay');
    if (!card || !overlay) { console.warn('PulseCard.demo: #playerCard / #playerCardOverlay not found'); return; }
    var ctx = {
      batterId: s.id, name: s.name, team: s.team,
      position: s.position, jersey: s.jersey,
      badge: b,
      stats: { avg: '.284', ops: '.891', hr: 18, rbi: 47 },
      highlight: 'hr',
    };
    card.innerHTML = opts.variant ? renderForce(opts.variant, ctx) : render(ctx);
    overlay.classList.remove('closing');
    overlay.classList.add('open');
    if (window._playerCardTimer) clearTimeout(window._playerCardTimer);
    window._playerCardTimer = setTimeout(function () {
      overlay.classList.add('closing');
      setTimeout(function () { overlay.classList.remove('open', 'closing'); }, 280);
    }, 5500);
  }

  window.PulseCard = { render: render, renderForce: renderForce, demo: demo, VARIANTS: LABELS };
})();
