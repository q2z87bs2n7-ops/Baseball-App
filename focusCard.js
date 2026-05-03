// focusCard.js
// Runtime dependency — loaded via <script src="focusCard.js"> in index.html.
// No imports, no framework, no build step.
//
// Exposes window.FocusCard with:
//   renderCard(data)        -> compact side-rail HTML string
//   renderOverlay(data)     -> full-screen overlay inner HTML string
//   renderPitchPill(pitch)  -> single pitch pill HTML string
//   demo()                  -> mounts overlay with sample data (Shift+F)

(function () {
  'use strict';

  // ---------- helpers ----------

  function esc(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Result code -> { color, label-short, dot character }
  // Codes per brief: B, C, S, F, X, T (+ defensive default)
  function resultStyle(code) {
    switch ((code || '').toUpperCase()) {
      case 'B': return { color: '#7a8597', label: 'BALL',  glyph: '·' };
      case 'C': return { color: '#f59e0b', label: 'CALLED',glyph: '╳' };
      case 'S': return { color: '#e03030', label: 'SWING', glyph: '╳' };
      case 'F': return { color: '#f97316', label: 'FOUL',  glyph: '◢' };
      case 'T': return { color: '#ef4444', label: 'TIP',   glyph: '◢' };
      case 'X': return { color: '#22c55e', label: 'PLAY',  glyph: '●' };
      default:  return { color: '#7a8597', label: '—',     glyph: '·' };
    }
  }

  // tension -> small accent set
  function tensionBg(color) {
    // translucent pill background derived from passed tension color
    return 'color-mix(in srgb, ' + color + ' 18%, transparent)';
  }

  // Renders three rows of pips for B/S/O.
  // filled = solid pip in tension/accent color; empty = ring.
  function pipRow(label, filled, total, accent) {
    var pips = '';
    for (var i = 0; i < total; i++) {
      var on = i < filled;
      pips +=
        '<span class="fc-pip" style="' +
          'width:10px;height:10px;border-radius:50%;display:inline-block;' +
          'box-sizing:border-box;border:1.5px solid ' +
          (on ? accent : 'rgba(154,160,168,0.45)') + ';' +
          'background:' + (on ? accent : 'transparent') + ';' +
          (on ? 'box-shadow:0 0 8px ' + accent + '66;' : '') +
        '"></span>';
    }
    return (
      '<div class="fc-pip-row" style="display:flex;align-items:center;gap:8px;">' +
        '<span style="font:600 10px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:0.14em;color:var(--p-muted,#9aa0a8);width:14px;">' + label + '</span>' +
        '<span style="display:inline-flex;gap:6px;">' + pips + '</span>' +
      '</div>'
    );
  }

  // Big-pip variant for the overlay hero count
  function bigPipRow(label, filled, total, accent, size) {
    var s = size || 18;
    var pips = '';
    for (var i = 0; i < total; i++) {
      var on = i < filled;
      pips +=
        '<span style="' +
          'width:' + s + 'px;height:' + s + 'px;border-radius:50%;display:inline-block;' +
          'box-sizing:border-box;border:2px solid ' +
          (on ? accent : 'rgba(154,160,168,0.35)') + ';' +
          'background:' + (on ? accent : 'transparent') + ';' +
          (on ? 'box-shadow:0 0 14px ' + accent + '88;' : '') +
        '"></span>';
    }
    return (
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:14px;padding:10px 0;border-bottom:1px solid var(--p-border,#1e2d4a);">' +
        '<span style="font:600 12px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:0.18em;color:var(--p-muted,#9aa0a8);">' + label + '</span>' +
        '<span style="display:inline-flex;gap:10px;">' + pips + '</span>' +
      '</div>'
    );
  }

  // Default base diamond (used by demo if data.diamondSvg not provided)
  function defaultDiamondSvg(d) {
    var on1 = d.onFirst, on2 = d.onSecond, on3 = d.onThird;
    var fill = function (occ) { return occ ? '#e8eaf0' : 'transparent'; };
    var stroke = '#3a4d75';
    return (
      '<svg viewBox="0 0 56 56" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
        '<g transform="translate(28 30) rotate(45)">' +
          // 2nd (top)
          '<rect x="-16" y="-16" width="9" height="9" fill="' + fill(on2) + '" stroke="' + stroke + '" stroke-width="1.5"/>' +
          // 3rd (left)
          '<rect x="-16" y="7"  width="9" height="9" fill="' + fill(on3) + '" stroke="' + stroke + '" stroke-width="1.5"/>' +
          // 1st (right)
          '<rect x="7"   y="-16" width="9" height="9" fill="' + fill(on1) + '" stroke="' + stroke + '" stroke-width="1.5"/>' +
          // home (bottom)
          '<rect x="7"   y="7"  width="9" height="9" fill="transparent" stroke="' + stroke + '" stroke-width="1.5"/>' +
        '</g>' +
      '</svg>'
    );
  }

  // Team initials chip with team primary color as a thin underline
  function teamChip(abbr, color, score, isBatting) {
    return (
      '<div style="display:flex;align-items:center;gap:8px;min-width:0;">' +
        '<span style="' +
          'display:inline-flex;align-items:center;justify-content:center;' +
          'width:30px;height:24px;border-radius:5px;' +
          'background:var(--p-dark,#0a0f1e);border:1px solid var(--p-border,#1e2d4a);' +
          'box-shadow: inset 0 -2px 0 ' + color + ';' +
          'font:700 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace;' +
          'letter-spacing:0.06em;color:var(--p-text,#e8eaf0);' +
        '">' + esc(abbr) + '</span>' +
        '<span style="font:600 18px/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--p-text,#e8eaf0);' +
          (isBatting ? '' : 'opacity:0.78;') + '">' + esc(score) + '</span>' +
        (isBatting ? '<span title="batting" style="width:5px;height:5px;border-radius:50%;background:#22c55e;box-shadow:0 0 6px #22c55e;"></span>' : '') +
      '</div>'
    );
  }

  // ---------- pitch pill ----------

  function renderPitchPill(pitch) {
    if (!pitch) return '';
    var rs = resultStyle(pitch.resultCode);
    var idx = (pitch.sequenceIndex !== undefined && pitch.sequenceIndex !== null) ? pitch.sequenceIndex : '';
    var titleAttr = esc(
      (pitch.typeName || '') +
      (pitch.speed ? ' · ' + pitch.speed.toFixed(1) + ' mph' : '') +
      (pitch.resultDesc ? ' · ' + pitch.resultDesc : '')
    );
    return (
      '<span class="fc-pitch-pill" title="' + titleAttr + '" style="' +
          'display:inline-flex;align-items:stretch;height:36px;border-radius:8px;' +
          'background:var(--p-dark,#0a0f1e);border:1px solid var(--p-border,#1e2d4a);overflow:hidden;flex:0 0 auto;' +
        '">' +
        // left index column
        '<span style="' +
            'display:inline-flex;align-items:center;justify-content:center;' +
            'width:22px;background:var(--p-card,#111827);color:var(--p-muted,#9aa0a8);' +
            'font:700 10px/1 ui-monospace,SFMono-Regular,Menlo,monospace;' +
            'border-right:1px solid var(--p-border,#1e2d4a);' +
          '">' + esc(idx) + '</span>' +
        // result color stripe
        '<span style="width:3px;background:' + rs.color + ';"></span>' +
        // body
        '<span style="display:inline-flex;flex-direction:column;justify-content:center;padding:0 10px 0 8px;gap:2px;">' +
          '<span style="font:700 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--p-text,#e8eaf0);letter-spacing:0.04em;">' +
            esc(pitch.typeName || pitch.typeCode || '??') +
            '<span style="color:var(--p-muted,#9aa0a8);font-weight:500;margin-left:6px;">' +
              (pitch.speed ? esc(pitch.speed.toFixed(1)) + '<span style="font-size:9px;opacity:0.7;"> MPH</span>' : '') +
            '</span>' +
          '</span>' +
          '<span style="font:600 9px/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:' + rs.color + ';letter-spacing:0.12em;">' +
            esc(rs.label) +
          '</span>' +
        '</span>' +
      '</span>'
    );
  }

  // ---------- compact card ----------

  function renderCard(data) {
    var d = data || {};
    var diamond = d.diamondSvg || defaultDiamondSvg(d);
    var half = (d.halfInning === 'top') ? '▲' : '▼';
    var halfWord = (d.halfInning === 'top') ? 'TOP' : 'BOT';
    var awayBatting = d.halfInning === 'top';

    var tension = d.tensionColor || '#9aa0a8';
    var tensionLabel = d.tensionLabel || 'NORMAL';

    var lastPitchHtml = '';
    if (d.lastPitch) {
      var rs = resultStyle(d.lastPitch.resultCode);
      lastPitchHtml =
        '<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;border-top:1px solid var(--p-border,#1e2d4a);background:var(--p-dark,#0a0f1e);">' +
          '<span style="width:6px;height:6px;border-radius:50%;background:' + rs.color + ';box-shadow:0 0 6px ' + rs.color + ';flex:0 0 auto;"></span>' +
          '<span style="font:700 10px/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--p-text,#e8eaf0);letter-spacing:0.06em;">' +
            esc(d.lastPitch.typeName || d.lastPitch.typeCode || '') +
            '<span style="color:var(--p-muted,#9aa0a8);font-weight:500;margin-left:6px;">' +
              (d.lastPitch.speed ? esc(d.lastPitch.speed.toFixed(1)) + ' mph' : '') +
            '</span>' +
          '</span>' +
          '<span style="margin-left:auto;font:600 9px/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:' + rs.color + ';letter-spacing:0.12em;">' +
            esc((d.lastPitch.resultDesc || rs.label).toUpperCase()) +
          '</span>' +
        '</div>';
    } else {
      lastPitchHtml =
        '<div style="padding:8px 12px;border-top:1px solid var(--p-border,#1e2d4a);background:var(--p-dark,#0a0f1e);font:600 10px/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--p-muted,#9aa0a8);letter-spacing:0.1em;">' +
          'AT-BAT START — 0 PITCHES' +
        '</div>';
    }

    return (
      '<div class="fc-card" style="' +
          'width:100%;background:var(--p-card,#111827);' +
          'border:1px solid var(--p-border,#1e2d4a);border-radius:var(--radius,10px);' +
          'overflow:hidden;color:var(--p-text,#e8eaf0);' +
          'font-family: ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;' +
          'box-shadow:0 1px 0 rgba(255,255,255,0.02) inset, 0 8px 24px rgba(0,0,0,0.35);' +
        '">' +

        // team color seam
        '<div style="height:2px;background:linear-gradient(90deg,' +
          esc(d.awayPrimary || '#1e2d4a') + ' 0%,' +
          esc(d.awayPrimary || '#1e2d4a') + ' 50%,' +
          esc(d.homePrimary || '#1e2d4a') + ' 50%,' +
          esc(d.homePrimary || '#1e2d4a') + ' 100%);"></div>' +

        // Header: LIVE + tension + inning
        '<div style="display:flex;align-items:center;gap:8px;padding:8px 12px 6px 12px;">' +
          '<span style="display:inline-flex;align-items:center;gap:5px;font:700 9px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:0.18em;color:#e03030;">' +
            '<span style="width:6px;height:6px;border-radius:50%;background:#e03030;box-shadow:0 0 8px #e03030;animation:fcPulse 1.6s ease-in-out infinite;"></span>' +
            'LIVE' +
          '</span>' +
          '<span style="font:600 9px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:0.14em;color:var(--p-muted,#9aa0a8);">' +
            halfWord + ' ' + esc(d.inning || '–') +
          '</span>' +
          '<span style="margin-left:auto;display:inline-flex;align-items:center;gap:5px;padding:3px 7px;border-radius:999px;' +
            'background:' + tensionBg(tension) + ';' +
            'font:700 9px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:0.14em;color:' + tension + ';">' +
            '<span style="width:5px;height:5px;border-radius:50%;background:' + tension + ';"></span>' +
            esc(tensionLabel) +
          '</span>' +
        '</div>' +

        // Score row
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:0 12px 8px 12px;">' +
          teamChip(d.awayAbbr, d.awayPrimary || '#1e2d4a', d.awayScore, awayBatting) +
          '<span style="font:500 9px/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--p-border,#3a4d75);letter-spacing:0.2em;">' + half + '</span>' +
          teamChip(d.homeAbbr, d.homePrimary || '#1e2d4a', d.homeScore, !awayBatting) +
        '</div>' +

        // Body grid: count pips + diamond
        '<div style="display:grid;grid-template-columns:1fr 56px;gap:10px;padding:8px 12px 10px 12px;border-top:1px solid var(--p-border,#1e2d4a);background:var(--p-dark,#0c1426);">' +
          '<div style="display:flex;flex-direction:column;gap:6px;justify-content:center;">' +
            pipRow('B', Math.min(d.balls || 0, 4), 4, '#e8eaf0') +
            pipRow('S', Math.min(d.strikes || 0, 3), 3, tension) +
            pipRow('O', Math.min(d.outs || 0, 3), 3, '#f59e0b') +
          '</div>' +
          '<div style="width:56px;height:56px;align-self:center;justify-self:end;">' + diamond + '</div>' +
        '</div>' +

        // Matchup row
        '<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;border-top:1px solid var(--p-border,#1e2d4a);">' +
          '<div style="display:flex;flex-direction:column;gap:2px;min-width:0;flex:1;">' +
            '<span style="font:600 8px/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--p-muted,#9aa0a8);letter-spacing:0.16em;">AB</span>' +
            '<span style="font:600 12px/1.1 ui-sans-serif,system-ui,sans-serif;color:var(--p-text,#e8eaf0);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' +
              esc(d.currentBatterName || '—') +
            '</span>' +
          '</div>' +
          '<span style="font:500 10px/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--p-border,#3a4d75);">vs</span>' +
          '<div style="display:flex;flex-direction:column;gap:2px;min-width:0;flex:1;align-items:flex-end;">' +
            '<span style="font:600 8px/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--p-muted,#9aa0a8);letter-spacing:0.16em;">PIT</span>' +
            '<span style="font:600 12px/1.1 ui-sans-serif,system-ui,sans-serif;color:var(--p-text,#e8eaf0);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:right;">' +
              esc(d.currentPitcherName || '—') +
            '</span>' +
          '</div>' +
        '</div>' +

        lastPitchHtml +

        // Compact game switcher strip (abbr-only chips, no scores) + ↩ AUTO when manual
        (function() {
          var games = d.allLiveGames || [];
          var showStrip = games.length > 1 || (d.isManual && games.length >= 1);
          if (!showStrip) return '';
          var autoBtn = d.isManual
            ? '<button type="button" onclick="resetFocusAuto && resetFocusAuto()" style="' +
                'flex:0 0 auto;padding:3px 8px;border-radius:4px;' +
                'border:1px solid rgba(125,211,252,0.30);background:rgba(125,211,252,0.07);' +
                'font:700 9px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:0.10em;color:#7dd3fc;cursor:pointer;"' +
                ' onmouseover="this.style.background=\'rgba(125,211,252,0.14)\'"' +
                ' onmouseout="this.style.background=\'rgba(125,211,252,0.07)\'">' +
                '↩ AUTO' +
              '</button>'
            : '';
          return (
            '<div class="fc-chip-strip" style="display:flex;align-items:center;gap:5px;padding:6px 12px;border-top:1px solid var(--p-border,#1e2d4a);background:var(--p-dark,#080e1c);overflow-x:auto;-webkit-overflow-scrolling:touch;">' +
              autoBtn +
              games.map(gameSwitchChipCompact).join('') +
            '</div>'
          );
        })() +

        // Footer: Open Focus + Box Score in one row
        '<div style="display:flex;border-top:1px solid var(--p-border,#1e2d4a);background:var(--p-dark,#0a0f1e);">' +
          '<button type="button" class="fc-open-btn" onclick="openFocusOverlay && openFocusOverlay()" style="' +
              'display:flex;flex:1;align-items:center;justify-content:space-between;gap:8px;' +
              'padding:9px 12px;border:0;border-right:1px solid var(--p-border,#1e2d4a);cursor:pointer;' +
              'background:transparent;color:var(--p-text,#e8eaf0);text-align:left;' +
              'font:700 10px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:0.14em;' +
            '" onmouseover="this.style.background=\'var(--p-card2,#0f172d)\'" onmouseout="this.style.background=\'transparent\'">' +
            '<span>OPEN FOCUS</span>' +
            '<span style="color:var(--p-muted,#9aa0a8);">→</span>' +
          '</button>' +
          '<a href="javascript:void(0)" onclick="showLiveGame&&showLiveGame(focusGamePk)" style="' +
              'display:flex;align-items:center;justify-content:center;gap:6px;' +
              'padding:9px 12px;text-decoration:none;cursor:pointer;background:transparent;' +
              'color:var(--p-muted,#9aa0a8);font:600 10px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:0.12em;' +
            '" onmouseover="this.style.background=\'var(--p-card2,#0f172d)\'" onmouseout="this.style.background=\'transparent\'">' +
            'Box Score →' +
          '</a>' +
        '</div>' +

        // keyframes (scoped via @media noop wrapper would be cleaner, but inline <style> is fine)
        '<style>@keyframes fcPulse{0%,100%{opacity:1}50%{opacity:0.35}}</style>' +
      '</div>'
    );
  }

  // ---------- overlay ----------

  function statBlock(label, value) {
    return (
      '<div style="display:flex;flex-direction:column;gap:4px;align-items:flex-start;">' +
        '<span style="font:600 9px/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--p-muted,#9aa0a8);letter-spacing:0.16em;">' + esc(label) + '</span>' +
        '<span style="font:600 15px/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--p-text,#e8eaf0);">' + esc(value) + '</span>' +
      '</div>'
    );
  }

  // Compact chip for the small card switcher — abbr only, no scores
  function gameSwitchChipCompact(g) {
    var focused = !!g.isFocused;
    return (
      '<button type="button"' +
        (focused ? '' : ' onclick="setFocusGameManual && setFocusGameManual(' + (g.gamePk || 0) + ')"') +
        ' style="flex:0 0 auto;display:inline-flex;align-items:center;gap:4px;padding:3px 7px;' +
          'border-radius:4px;border:1px solid ' + (focused ? 'var(--p-border,#3a4d75)' : 'var(--p-border,#1e2d4a)') + ';' +
          'background:' + (focused ? 'var(--p-card,#162039)' : 'transparent') + ';' +
          'cursor:' + (focused ? 'default' : 'pointer') + ';">' +
        '<span style="width:4px;height:4px;border-radius:50%;background:' + esc(g.awayPrimary || '#3a4d75') + ';flex:0 0 auto;"></span>' +
        '<span style="font:700 9px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:0.04em;color:' + (focused ? 'var(--p-text,#e8eaf0)' : 'var(--p-muted,#9aa0a8)') + ';">' +
          esc(g.awayAbbr) + '<span style="color:var(--p-border,#3a4d75);margin:0 3px;">@</span>' + esc(g.homeAbbr) +
        '</span>' +
        '<span style="width:4px;height:4px;border-radius:50%;background:' + esc(g.homePrimary || '#3a4d75') + ';flex:0 0 auto;"></span>' +
      '</button>'
    );
  }

  function gameSwitchChip(g) {
    var focused = !!g.isFocused;
    return (
      '<button type="button" onclick="setFocusGame && setFocusGame(' + (g.gamePk || 0) + ')" style="' +
          'flex:0 0 auto;display:inline-flex;align-items:center;gap:8px;padding:8px 11px;' +
          'border-radius:8px;border:1px solid ' + (focused ? 'var(--p-border,#3a4d75)' : 'var(--p-border,#1e2d4a)') + ';' +
          'background:' + (focused ? 'var(--p-card,#162039)' : 'var(--p-dark,#0a0f1e)') + ';cursor:pointer;color:var(--p-text,#e8eaf0);' +
          (focused ? 'box-shadow:0 0 0 1px var(--p-border,#3a4d75) inset;' : '') +
        '">' +
        '<span style="font:700 10px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:0.06em;color:var(--p-muted,#9aa0a8);">' +
          esc(g.awayAbbr) + ' <span style="color:var(--p-text,#e8eaf0);">' + esc(g.awayScore) + '</span>' +
          ' <span style="color:var(--p-border,#3a4d75);">@</span> ' +
          esc(g.homeAbbr) + ' <span style="color:var(--p-text,#e8eaf0);">' + esc(g.homeScore) + '</span>' +
        '</span>' +
        '<span style="font:600 9px/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:' + (focused ? '#22c55e' : 'var(--p-muted,#9aa0a8)') + ';letter-spacing:0.12em;">' +
          (focused ? '● FOCUS' : 'INN ' + esc(g.inning)) +
        '</span>' +
      '</button>'
    );
  }

  function renderOverlay(data) {
    var d = data || {};
    var diamond = d.diamondSvg || defaultDiamondSvg(d);
    var halfWord = (d.halfInning === 'top') ? 'TOP' : 'BOT';
    var awayBatting = d.halfInning === 'top';
    var tension = d.tensionColor || '#9aa0a8';
    var tensionLabel = d.tensionLabel || 'NORMAL';

    var bs = d.batterStats || {};
    var ps = d.pitcherStats || {};
    var seq = Array.isArray(d.pitchSequence) ? d.pitchSequence : [];
    var games = Array.isArray(d.allLiveGames) ? d.allLiveGames : [];

    var pillsHtml = seq.length
      ? seq.map(function (p, i) {
          var withIdx = Object.assign ? Object.assign({}, p, { sequenceIndex: p.sequenceIndex || (i + 1) })
                                      : (function(){ var o = {}; for (var k in p) o[k]=p[k]; o.sequenceIndex = p.sequenceIndex || (i+1); return o; })();
          return renderPitchPill(withIdx);
        }).join('')
      : '<span style="font:600 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--p-muted,#9aa0a8);letter-spacing:0.14em;padding:10px 0;">NO PITCHES YET</span>';

    var switcherHtml = games.length
      ? games.map(gameSwitchChip).join('')
      : '';

    return (
      '<div class="fc-overlay-card" style="' +
          'width:100%;max-width:520px;background:var(--p-card,#111827);' +
          'border:1px solid var(--p-border,#1e2d4a);border-radius:14px;overflow:hidden;' +
          'color:var(--p-text,#e8eaf0);' +
          'font-family: ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;' +
          'box-shadow: 0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.02) inset;' +
        '">' +

        // team seam
        '<div style="height:3px;background:linear-gradient(90deg,' +
          esc(d.awayPrimary || '#1e2d4a') + ' 0%,' +
          esc(d.awayPrimary || '#1e2d4a') + ' 50%,' +
          esc(d.homePrimary || '#1e2d4a') + ' 50%,' +
          esc(d.homePrimary || '#1e2d4a') + ' 100%);"></div>' +

        // Topbar: LIVE / inning / tension / close
        '<div style="display:flex;align-items:center;gap:10px;padding:14px 18px 10px 18px;">' +
          '<span style="display:inline-flex;align-items:center;gap:6px;font:700 10px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:0.2em;color:#e03030;">' +
            '<span style="width:7px;height:7px;border-radius:50%;background:#e03030;box-shadow:0 0 10px #e03030;animation:fcPulse 1.6s ease-in-out infinite;"></span>' +
            'LIVE' +
          '</span>' +
          '<span style="font:600 10px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:0.16em;color:var(--p-muted,#9aa0a8);">' +
            halfWord + ' ' + esc(d.inning || '–') +
          '</span>' +
          '<span style="display:inline-flex;align-items:center;gap:6px;padding:4px 9px;border-radius:999px;' +
            'background:' + tensionBg(tension) + ';' +
            'font:700 10px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:0.16em;color:' + tension + ';">' +
            '<span style="width:6px;height:6px;border-radius:50%;background:' + tension + ';box-shadow:0 0 8px ' + tension + ';"></span>' +
            esc(tensionLabel) +
          '</span>' +
          '<button type="button" aria-label="Close" onclick="closeFocusOverlay && closeFocusOverlay()" style="' +
              'margin-left:auto;width:30px;height:30px;border-radius:8px;border:1px solid var(--p-border,#1e2d4a);' +
              'background:var(--p-dark,#0a0f1e);color:var(--p-muted,#9aa0a8);cursor:pointer;font:600 14px/1 ui-monospace,SFMono-Regular,Menlo,monospace;' +
              'display:inline-flex;align-items:center;justify-content:center;' +
            '" onmouseover="this.style.color=\'var(--p-text,#e8eaf0)\';this.style.borderColor=\'var(--p-border,#3a4d75)\'"' +
            ' onmouseout="this.style.color=\'var(--p-muted,#9aa0a8)\';this.style.borderColor=\'var(--p-border,#1e2d4a)\'">✕</button>' +
        '</div>' +

        // Scoreboard row
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:14px;padding:0 18px 14px 18px;">' +
          '<div style="display:flex;align-items:center;gap:12px;">' +
            '<span style="display:inline-flex;align-items:center;justify-content:center;width:46px;height:36px;border-radius:7px;' +
              'background:var(--p-dark,#0a0f1e);border:1px solid var(--p-border,#1e2d4a);' +
              'box-shadow:inset 0 -3px 0 ' + esc(d.awayPrimary || '#1e2d4a') + ';' +
              'font:700 13px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:0.06em;color:var(--p-text,#e8eaf0);">' +
              esc(d.awayAbbr) +
            '</span>' +
            '<span style="font:600 28px/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--p-text,#e8eaf0);' +
              (awayBatting ? '' : 'opacity:0.7;') + '">' + esc(d.awayScore) + '</span>' +
            (awayBatting ? '<span title="batting" style="width:7px;height:7px;border-radius:50%;background:#22c55e;box-shadow:0 0 8px #22c55e;"></span>' : '') +
          '</div>' +
          '<span style="font:500 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--p-border,#3a4d75);letter-spacing:0.2em;">@</span>' +
          '<div style="display:flex;align-items:center;gap:12px;">' +
            (!awayBatting ? '<span title="batting" style="width:7px;height:7px;border-radius:50%;background:#22c55e;box-shadow:0 0 8px #22c55e;"></span>' : '') +
            '<span style="font:600 28px/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--p-text,#e8eaf0);' +
              (!awayBatting ? '' : 'opacity:0.7;') + '">' + esc(d.homeScore) + '</span>' +
            '<span style="display:inline-flex;align-items:center;justify-content:center;width:46px;height:36px;border-radius:7px;' +
              'background:var(--p-dark,#0a0f1e);border:1px solid var(--p-border,#1e2d4a);' +
              'box-shadow:inset 0 -3px 0 ' + esc(d.homePrimary || '#1e2d4a') + ';' +
              'font:700 13px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:0.06em;color:var(--p-text,#e8eaf0);">' +
              esc(d.homeAbbr) +
            '</span>' +
          '</div>' +
        '</div>' +

        // HERO: big count + diamond
        '<div style="display:grid;grid-template-columns:1fr 120px;gap:18px;padding:18px;background:var(--p-dark,#0c1426);border-top:1px solid var(--p-border,#1e2d4a);border-bottom:1px solid var(--p-border,#1e2d4a);">' +
          '<div style="display:flex;flex-direction:column;">' +
            bigPipRow('BALLS',   Math.min(d.balls || 0, 4),   4, '#e8eaf0') +
            bigPipRow('STRIKES', Math.min(d.strikes || 0, 3), 3, tension) +
            bigPipRow('OUTS',    Math.min(d.outs || 0, 3),    3, '#f59e0b') +
          '</div>' +
          '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;">' +
            '<div style="width:108px;height:108px;">' + diamond + '</div>' +
            '<span style="font:700 9px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:0.18em;color:var(--p-muted,#9aa0a8);">RUNNERS</span>' +
          '</div>' +
        '</div>' +

        // Matchup
        '<div style="display:grid;grid-template-columns:1fr auto 1fr;gap:14px;align-items:center;padding:16px 18px;">' +
          // Batter
          '<div style="display:flex;flex-direction:column;gap:8px;min-width:0;">' +
            '<span style="font:700 9px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:0.18em;color:var(--p-muted,#9aa0a8);">AT BAT</span>' +
            '<span style="font:600 17px/1.15 ui-sans-serif,system-ui,sans-serif;color:var(--p-text,#e8eaf0);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' +
              esc(d.currentBatterName || '—') +
            '</span>' +
            '<div style="display:flex;gap:14px;flex-wrap:wrap;">' +
              statBlock('AVG', bs.avg || '—') +
              statBlock('OPS', bs.ops || '—') +
              statBlock('HR',  (bs.hr  !== undefined ? bs.hr  : '—')) +
              statBlock('RBI', (bs.rbi !== undefined ? bs.rbi : '—')) +
            '</div>' +
          '</div>' +

          '<div style="display:flex;flex-direction:column;align-items:center;gap:6px;padding:0 4px;">' +
            '<span style="width:1px;height:18px;background:var(--p-border,#1e2d4a);"></span>' +
            '<span style="font:700 9px/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--p-border,#3a4d75);letter-spacing:0.2em;">VS</span>' +
            '<span style="width:1px;height:18px;background:var(--p-border,#1e2d4a);"></span>' +
          '</div>' +

          // Pitcher
          '<div style="display:flex;flex-direction:column;gap:8px;min-width:0;align-items:flex-end;">' +
            '<span style="font:700 9px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:0.18em;color:var(--p-muted,#9aa0a8);">PITCHING</span>' +
            '<span style="font:600 17px/1.15 ui-sans-serif,system-ui,sans-serif;color:var(--p-text,#e8eaf0);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:right;">' +
              esc(d.currentPitcherName || '—') +
            '</span>' +
            '<div style="display:flex;gap:14px;flex-wrap:wrap;justify-content:flex-end;">' +
              statBlock('ERA',  ps.era  || '—') +
              statBlock('WHIP', ps.whip || '—') +
              statBlock('W',    (ps.wins   !== undefined ? ps.wins   : '—')) +
              statBlock('L',    (ps.losses !== undefined ? ps.losses : '—')) +
            '</div>' +
          '</div>' +
        '</div>' +

        // Last pitch / at-bat status strip
        (function() {
          var lp = d.lastPitch;
          if (lp) {
            var rs = resultStyle(lp.resultCode);
            return '<div style="display:flex;align-items:center;gap:10px;padding:10px 18px;border-top:1px solid var(--p-border,#1e2d4a);background:var(--p-dark,#0a0f1e);">' +
              '<span style="width:7px;height:7px;border-radius:50%;background:' + rs.color + ';box-shadow:0 0 7px ' + rs.color + ';flex:0 0 auto;"></span>' +
              '<span style="font:700 12px/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--p-text,#e8eaf0);letter-spacing:0.04em;">' +
                esc(lp.typeName || lp.typeCode || '') +
                '<span style="color:var(--p-muted,#9aa0a8);font-weight:500;margin-left:8px;">' + (lp.speed ? esc(lp.speed.toFixed(1)) + ' mph' : '') + '</span>' +
              '</span>' +
              '<span style="margin-left:auto;font:700 10px/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:' + rs.color + ';letter-spacing:0.14em;">' +
                esc((lp.resultDesc || rs.label).toUpperCase()) +
              '</span>' +
            '</div>';
          }
          return '<div style="padding:10px 18px;border-top:1px solid var(--p-border,#1e2d4a);background:var(--p-dark,#0a0f1e);font:600 10px/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--p-muted,#9aa0a8);letter-spacing:0.14em;">AT-BAT START — 0 PITCHES</div>';
        })() +

        // Pitch sequence
        '<div style="padding:14px 18px 18px 18px;border-top:1px solid var(--p-border,#1e2d4a);background:var(--p-dark,#0a0f1e);">' +
          '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">' +
            '<span style="font:700 10px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:0.18em;color:var(--p-muted,#9aa0a8);">PITCH SEQUENCE</span>' +
            '<span style="height:1px;flex:1;background:var(--p-border,#1e2d4a);"></span>' +
            '<span style="font:700 10px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:0.16em;color:var(--p-muted,#9aa0a8);">' +
              esc(seq.length) + (seq.length === 1 ? ' PITCH' : ' PITCHES') +
            '</span>' +
          '</div>' +
          '<div class="fc-pitch-row" style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">' +
            pillsHtml +
          '</div>' +
        '</div>' +

        // Game switcher
        (switcherHtml ?
          '<div style="display:flex;flex-direction:column;gap:8px;padding:14px 18px 18px 18px;border-top:1px solid var(--p-border,#1e2d4a);">' +
            '<span style="font:700 10px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:0.18em;color:var(--p-muted,#9aa0a8);">OTHER LIVE GAMES</span>' +
            '<div class="fc-chip-strip" style="display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;">' +
              switcherHtml +
            '</div>' +
          '</div>'
        : '') +

        // Box Score shortcut link
        '<div style="padding:12px 18px;border-top:1px solid var(--p-border,#1e2d4a);text-align:center;">' +
          '<a href="javascript:void(0)" onclick="closeFocusOverlay&&closeFocusOverlay();showLiveGame&&showLiveGame(focusGamePk)" style="' +
              'color:var(--p-muted,#9aa0a8);text-decoration:none;' +
              'font:600 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:0.12em;' +
            '">Box Score →</a>' +
        '</div>' +

        '<style>@keyframes fcPulse{0%,100%{opacity:1}50%{opacity:0.35}}</style>' +
      '</div>'
    );
  }

  // ---------- demo ----------

  function sampleData() {
    return {
      awayAbbr: 'NYM', homeAbbr: 'PHI',
      awayScore: 3, homeScore: 2,
      awayPrimary: '#002D72', homePrimary: '#E81828',
      inning: 8, halfInning: 'bottom',
      balls: 3, strikes: 2, outs: 2,
      onFirst: true, onSecond: false, onThird: true,
      currentBatterName: 'Pete Alonso',
      currentPitcherName: 'Zack Wheeler',
      tensionLabel: 'CRITICAL', tensionColor: '#e03030',
      lastPitch: { typeCode: 'SL', typeName: 'Slider', speed: 84.2, resultCode: 'F', resultDesc: 'Foul' },
      pitchSequence: [
        { typeCode: 'FF', typeName: 'Four-Seam Fastball', speed: 96.1, resultCode: 'C', resultDesc: 'Called Strike' },
        { typeCode: 'SL', typeName: 'Slider',            speed: 84.2, resultCode: 'B', resultDesc: 'Ball' },
        { typeCode: 'FF', typeName: 'Four-Seam Fastball', speed: 95.8, resultCode: 'S', resultDesc: 'Swinging Strike' },
        { typeCode: 'SL', typeName: 'Slider',            speed: 83.9, resultCode: 'F', resultDesc: 'Foul' },
        { typeCode: 'CH', typeName: 'Changeup',          speed: 88.1, resultCode: 'F', resultDesc: 'Foul' },
        { typeCode: 'SI', typeName: 'Sinker',            speed: 94.4, resultCode: 'B', resultDesc: 'Ball' },
        { typeCode: 'SL', typeName: 'Slider',            speed: 84.2, resultCode: 'F', resultDesc: 'Foul' }
      ],
      batterStats:  { avg: '.287', obp: '.361', ops: '.912', hr: 14, rbi: 38 },
      pitcherStats: { era: '2.84', whip: '1.02', wins: 6, losses: 2 },
      allLiveGames: [
        { gamePk: 824203, awayAbbr: 'NYM', homeAbbr: 'PHI', awayScore: 3, homeScore: 2, inning: 8, isFocused: true  },
        { gamePk: 824204, awayAbbr: 'LAD', homeAbbr: 'SF',  awayScore: 1, homeScore: 1, inning: 6, isFocused: false },
        { gamePk: 824205, awayAbbr: 'BOS', homeAbbr: 'NYY', awayScore: 4, homeScore: 5, inning: 7, isFocused: false },
        { gamePk: 824206, awayAbbr: 'HOU', homeAbbr: 'SEA', awayScore: 0, homeScore: 2, inning: 4, isFocused: false }
      ]
    };
  }

  function demo() {
    var data = sampleData();
    // remove any prior demo mount
    var prior = document.getElementById('fc-demo-overlay');
    if (prior) prior.remove();

    var wrap = document.createElement('div');
    wrap.id = 'fc-demo-overlay';
    wrap.style.cssText = [
      'position:fixed','inset:0','z-index:9999',
      'background:rgba(5,8,18,0.78)','backdrop-filter:blur(6px)',
      '-webkit-backdrop-filter:blur(6px)',
      'display:flex','align-items:center','justify-content:center','padding:24px',
      'animation:fcFadeIn 180ms ease-out'
    ].join(';') + ';';

    wrap.innerHTML =
      '<style>@keyframes fcFadeIn{from{opacity:0}to{opacity:1}}</style>' +
      renderOverlay(data);

    // dismiss on backdrop click
    wrap.addEventListener('click', function (ev) {
      if (ev.target === wrap) wrap.remove();
    });
    // expose close hook for the overlay's X button
    window.closeFocusOverlay = function () { wrap.remove(); };

    document.body.appendChild(wrap);
  }

  // Bind Shift+F if not already bound
  if (!window.__fcShiftFBound) {
    window.__fcShiftFBound = true;
    document.addEventListener('keydown', function (e) {
      if (e.shiftKey && (e.key === 'F' || e.key === 'f') && !e.metaKey && !e.ctrlKey && !e.altKey) {
        // ignore if typing in an input
        var t = e.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
        e.preventDefault();
        demo();
      }
    });
  }

  window.FocusCard = {
    renderCard: renderCard,
    renderOverlay: renderOverlay,
    renderPitchPill: renderPitchPill,
    demo: demo
  };
})();
