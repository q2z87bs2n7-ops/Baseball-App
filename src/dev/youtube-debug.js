// ── YouTube Channel Test (Dev Tools) ─────────────────────────────────────────
// Two modes in one overlay:
//  1. Try a custom channel — paste UC id or channel URL, fetch via /api/proxy-youtube,
//     preview videos, optionally apply to state.activeTeam.youtubeUC (session-only override
//     so the home YouTube widget reloads with the new channel for testing).
//  2. Sweep all 30 — bulk test every team's youtubeUC + the MLB fallback.
//     Ported from claude/debug-youtube-api-SYBtV branch (Anthropic, May 2026).

import { state } from '../state.js';
import { devTrace } from '../diag/devLog.js';
import { API_BASE, TEAMS } from '../config/constants.js';

let ytDebugResults = {};
let _loadHomeYoutubeWidget = null; // callback injection

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, function(c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function forceHttps(url) {
  return url ? url.replace(/^http:/, 'https:') : url;
}

export function setYoutubeDebugCallbacks(cbs) {
  if (cbs.loadHomeYoutubeWidget) _loadHomeYoutubeWidget = cbs.loadHomeYoutubeWidget;
}

export function openYoutubeDebug() {
  document.getElementById('ytDebugOverlay').style.display = 'flex';
  renderYoutubeDebugList();
  // Pre-fill custom input with active team's current UC for easy edit/replace
  var inp = document.getElementById('ytCustomInput');
  if (inp && !inp.value && state.activeTeam && state.activeTeam.youtubeUC) inp.value = state.activeTeam.youtubeUC;
}

export function closeYoutubeDebug() {
  document.getElementById('ytDebugOverlay').style.display = 'none';
}

function parseYTChannelInput(s) {
  s = (s || '').trim();
  if (!s) return { error: 'Empty.' };
  if (/^UC[A-Za-z0-9_-]{20,30}$/.test(s)) return { uc: s };
  var m = s.match(/youtube\.com\/channel\/(UC[A-Za-z0-9_-]{20,30})/);
  if (m) return { uc: m[1] };
  if (/youtube\.com\/(@|user\/|c\/)/i.test(s) || /^@/.test(s)) {
    return { error: "@handle / /user / /c can't be resolved client-side. Visit the channel → ⋯ → Share Channel → Copy Channel ID (UCxxx…)." };
  }
  return { error: 'Not recognised. Paste a UC channel id or a youtube.com/channel/UCxxx URL.' };
}

export function ytDebugFetchCustom() {
  var raw = (document.getElementById('ytCustomInput') || {}).value || '';
  var out = document.getElementById('ytCustomResult');
  var p = parseYTChannelInput(raw);
  if (p.error) {
    if (out) out.innerHTML = '<span style="color:#ff6b6b">' + escapeHtml(p.error) + '</span>';
    return;
  }
  var uc = p.uc;
  if (out) out.innerHTML = '<span style="color:var(--text)">⏳ Fetching ' + escapeHtml(uc) + '…</span>';
  var t0 = Date.now();
  fetch(API_BASE + '/api/proxy-youtube?channel=' + encodeURIComponent(uc))
    .then(function(r) {
      return r.json().then(function(j) {
        return { res: r, j: j };
      });
    })
    .then(function(o) {
      var ms = Date.now() - t0;
      if (!o.res.ok || !o.j.success || !o.j.videos || !o.j.videos.length) {
        var msg = 'HTTP ' + o.res.status + (o.j && o.j.error ? ' · ' + o.j.error : o.j && o.j.message ? ' · ' + o.j.message : '');
        if (out) out.innerHTML = '<span style="color:#ff6b6b">❌ ' + escapeHtml(msg) + ' · ' + ms + 'ms</span>';
        return;
      }
      var v = o.j.videos.slice(0, 5);
      var teamLbl = state.activeTeam ? state.activeTeam.short : 'team';
      var html = '<div style="color:#22c55e;font-weight:700">✅ HTTP ' + o.res.status + ' · ' + o.j.count + ' videos · ' + ms + 'ms</div>';
      html += '<div style="margin-top:6px;display:flex;flex-direction:column;gap:4px">';
      v.forEach(function(vid) {
        var thumbUrl = vid.thumb ? forceHttps(vid.thumb) : '';
        html += '<div style="display:flex;gap:8px;align-items:flex-start"><img src="' + escapeHtml(thumbUrl) + '" style="width:60px;height:34px;object-fit:cover;border-radius:3px;flex-shrink:0" loading="lazy" onerror="this.style.display=\'none\'"/><div style="flex:1;min-width:0"><div style="font-size:.65rem;color:var(--text);font-weight:600;line-height:1.2">' + escapeHtml(vid.title || '?') + '</div><div style="font-size:.6rem;color:var(--muted)">' + escapeHtml(vid.date || '') + '</div></div></div>';
      });
      html += '</div>';
      html += '<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap"><button onclick="ytDebugApplyToTeam(\'' + escapeHtml(uc) + '\')" style="background:var(--secondary);border:1px solid var(--border);color:var(--accent-text);font-size:.66rem;font-weight:700;padding:5px 10px;border-radius:6px;cursor:pointer">⚙ Apply to ' + escapeHtml(teamLbl) + '</button><a href="https://www.youtube.com/channel/' + escapeHtml(uc) + '" target="_blank" style="background:var(--card2);border:1px solid var(--border);color:var(--text);font-size:.66rem;padding:5px 10px;border-radius:6px;text-decoration:none">Open ↗</a></div>';
      if (out) out.innerHTML = html;
    })
    .catch(function(err) {
      var ms = Date.now() - t0;
      if (out) out.innerHTML = '<span style="color:#ff6b6b">❌ Network: ' + escapeHtml((err && err.message) || 'failed') + ' · ' + ms + 'ms</span>';
    });
}

export function ytDebugApplyToTeam(uc) {
  if (!state.activeTeam) {
    alert('No active team.');
    return;
  }
  var prev = state.activeTeam.youtubeUC;
  state.activeTeam.youtubeUC = uc;
  devTrace('yt', 'custom UC applied · ' + state.activeTeam.short + ' · was ' + prev + ' · now ' + uc);
  if (_loadHomeYoutubeWidget) _loadHomeYoutubeWidget();
  var out = document.getElementById('ytCustomResult');
  if (out) {
    var note = document.createElement('div');
    note.style.cssText = 'margin-top:6px;padding:6px 8px;background:var(--card2);border:1px solid #22c55e;border-radius:4px;color:var(--text);font-size:.62rem';
    note.textContent = '✅ Applied to ' + state.activeTeam.short + '. Open Home → YouTube widget to verify. Switching teams or reloading reverts to ' + (prev || '(none)') + '.';
    out.appendChild(note);
  }
}

function ytDebugEntries() {
  var entries = TEAMS.map(function(t) {
    return { key: t.id, teamId: t.id, teamName: t.name, abbr: t.short, channelId: t.youtubeUC || '' };
  });
  entries.sort(function(a, b) {
    return a.teamName.localeCompare(b.teamName);
  });
  if (typeof window !== 'undefined' && window.MLB_FALLBACK_UC) {
    entries.push({ key: 'mlb_fallback', teamId: null, teamName: 'MLB (Fallback)', abbr: 'MLB', channelId: window.MLB_FALLBACK_UC });
  }
  return entries;
}

function renderYoutubeDebugList() {
  var list = document.getElementById('ytDebugList');
  if (!list) return;
  var entries = ytDebugEntries();
  var anyTested = Object.keys(ytDebugResults).length > 0;
  if (!anyTested) {
    list.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted)">Click "▶ Run All" to sweep all ' + entries.length + ' channels.</div>';
    return;
  }
  var done = Object.values(ytDebugResults).filter(function(r) {
    return r && !r.pending;
  }).length;
  var summary = '<div style="padding:6px 10px;font-size:.7rem;color:var(--muted);text-align:center;border-bottom:1px solid var(--border)">' + done + ' of ' + entries.length + ' tested</div>';
  var html = entries
    .map(function(e) {
      var r = ytDebugResults[e.key];
      var icon, statusLine, extra = '';
      if (!r) {
        icon = '⬜';
        statusLine = '<span style="color:var(--muted)">untested</span>';
      } else if (r.pending) {
        icon = '⏳';
        statusLine = '<span style="color:var(--muted)">testing…</span>';
      } else if (r.ok) {
        icon = '✅';
        statusLine = '<span style="color:#22c55e;font-weight:700">HTTP ' + r.status + ' · ' + r.count + ' videos</span><span style="color:var(--muted);font-size:.66rem"> · ' + r.ms + 'ms</span>';
      } else {
        icon = '❌';
        statusLine = '<span style="color:#e03030;font-weight:700">HTTP ' + (r.status || 0) + '</span><span style="color:var(--muted);font-size:.66rem"> · ' + r.ms + 'ms</span>';
        if (r.error) extra = '<div style="margin-top:2px;font-size:.66rem;color:#e03030">' + escapeHtml(r.error) + '</div>';
      }
      return '<div style="padding:8px 10px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px"><span style="font-size:.95rem;flex-shrink:0;width:20px;text-align:center">' + icon + '</span><div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><span style="font-size:.78rem;font-weight:700;color:var(--text)">' + escapeHtml(e.teamName) + '</span><span style="font-size:.66rem;color:var(--muted)">' + escapeHtml(e.abbr) + '</span></div><div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin-top:2px"><span style="font-size:.63rem;color:var(--muted);font-family:monospace">' + escapeHtml(e.channelId) + '</span><span style="color:var(--muted)">·</span>' + statusLine + '</div>' + extra + '</div><button onclick="runYoutubeDebugOne(\'' + e.key + '\')" style="background:var(--card2);border:1px solid var(--border);color:var(--text);font-size:.68rem;padding:5px 8px;border-radius:6px;cursor:pointer;flex-shrink:0;font-weight:700">▶</button></div>';
    })
    .join('');
  list.innerHTML = summary + html;
}

export function runYoutubeDebugAll() {
  var btn = document.getElementById('ytDebugRunBtn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Running…';
  }
  var entries = ytDebugEntries();
  ytDebugResults = {};
  entries.forEach(function(e) {
    ytDebugResults[e.key] = { pending: true };
  });
  renderYoutubeDebugList();
  var promises = entries.map(function(e) {
    return runYoutubeDebugOne(e.key);
  });
  Promise.all(promises).then(function() {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '▶ Run All';
    }
  });
}

export function runYoutubeDebugOne(key) {
  var entries = ytDebugEntries();
  var e = entries.find(function(x) {
    return String(x.key) === String(key);
  });
  if (!e) return Promise.resolve();
  ytDebugResults[e.key] = { pending: true };
  renderYoutubeDebugList();
  var t0 = Date.now();
  return fetch(API_BASE + '/api/proxy-youtube?channel=' + encodeURIComponent(e.channelId))
    .then(function(res) {
      var ms = Date.now() - t0;
      return res.json().then(
        function(j) {
          ytDebugResults[e.key] = { ok: res.ok && !!j.success, status: res.status, count: j.count || 0, ms: ms, error: j.error || null };
          renderYoutubeDebugList();
        },
        function() {
          ytDebugResults[e.key] = { ok: false, status: res.status, count: 0, ms: ms, error: 'JSON parse error' };
          renderYoutubeDebugList();
        }
      );
    })
    .catch(function(err) {
      var ms = Date.now() - t0;
      ytDebugResults[e.key] = { ok: false, status: 0, count: 0, ms: ms, error: 'Network: ' + (err && err.message || 'failed') };
      renderYoutubeDebugList();
    });
}

export function ytDebugReset() {
  ytDebugResults = {};
  renderYoutubeDebugList();
}

export function ytDebugCopy() {
  var entries = ytDebugEntries();
  var works = [], broken = [], untested = [];
  entries.forEach(function(e) {
    var r = ytDebugResults[e.key];
    if (!r || r.pending) {
      untested.push('• ' + e.teamName + ' (' + e.abbr + ') — ' + e.channelId);
    } else if (r.ok) {
      works.push('• ' + e.teamName + ' (' + e.abbr + ') — ' + e.channelId + ' — ' + r.count + ' videos · ' + r.ms + 'ms');
    } else {
      var detail = 'HTTP ' + (r.status || 0) + (r.error ? ' · ' + r.error : '');
      broken.push('• ' + e.teamName + ' (' + e.abbr + ') — ' + e.channelId + ' — ' + detail + ' · ' + r.ms + 'ms');
    }
  });
  var lines = ['YouTube Channel Test', 'Date: ' + new Date().toISOString().slice(0, 10), 'Proxy: ' + API_BASE + '/api/proxy-youtube', ''];
  lines.push('✅ WORKS (' + works.length + '):');
  lines.push.apply(lines, works.length ? works : ['  (none)']);
  lines.push('');
  lines.push('❌ BROKEN/ERROR (' + broken.length + '):');
  lines.push.apply(lines, broken.length ? broken : ['  (none)']);
  lines.push('');
  if (untested.length) {
    lines.push('⏳ UNTESTED (' + untested.length + '):');
    lines.push.apply(lines, untested);
  }
  if (typeof window !== 'undefined' && window._copyToClipboard) {
    window._copyToClipboard(lines.join('\n'), 'ytDebugCopyBtn');
  }
}
