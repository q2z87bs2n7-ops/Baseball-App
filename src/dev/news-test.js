// ── News Source Test (Dev Tools) ────────────────────────────────────────────
// Test each configured news source endpoint via /api/proxy-test,
// showing response status, item count, sample data, and error diagnostics.

import { API_BASE } from '../config/constants.js';

const NEWS_TEST_SOURCES = ['fangraphs', 'mlbtraderumors', 'cbssports', 'yahoo', 'sbnation_mets', 'baseballamerica', 'mlb_direct', 'reddit_baseball', 'espn_news'];
let newsTestResults = {};

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, function(c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

export function openNewsSourceTest() {
  document.getElementById('newsSourceTestOverlay').style.display = 'flex';
  renderNewsSourceTest();
}

export function closeNewsSourceTest() {
  document.getElementById('newsSourceTestOverlay').style.display = 'none';
}

function renderNewsSourceTest() {
  var list = document.getElementById('newsSourceTestList');
  if (!list) return;
  if (!Object.keys(newsTestResults).length) {
    list.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted)">Click "▶ Run All" to test each source.</div>';
    return;
  }
  var rows = NEWS_TEST_SOURCES.map(function(k) {
    var r = newsTestResults[k];
    if (!r) return '<div style="padding:8px 10px;border-bottom:1px solid var(--border);color:var(--muted)"><b>' + k + '</b> · pending</div>';
    if (r.pending) return '<div style="padding:8px 10px;border-bottom:1px solid var(--border);color:var(--muted)"><b>' + k + '</b> · ⏳ testing…</div>';
    var ok = r.ok && r.status >= 200 && r.status < 300 && (r.itemCount > 0);
    var icon = ok ? '✅' : '❌';
    var line1 = '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span style="font-size:1rem">' + icon + '</span><b style="color:var(--text)">' + k + '</b><span style="color:var(--muted);font-size:.7rem">HTTP ' + (r.status || '?') + ' · ' + (r.kind || '?') + ' · ' + (r.byteLength || 0) + 'b · ' + (r.elapsedMs || 0) + 'ms · ' + (r.itemCount || 0) + ' items</span></div>';
    var line2 = r.firstTitle ? '<div style="margin-top:4px;font-size:.7rem;color:var(--muted)">First: ' + escapeHtml(r.firstTitle).slice(0, 140) + '</div>' : '';
    var line3 = r.error ? '<div style="margin-top:4px;font-size:.7rem;color:#e03030">Error: ' + escapeHtml(r.error) + '</div>' : '';
    var line4 = r.sample ? '<details style="margin-top:4px"><summary style="cursor:pointer;font-size:.65rem;color:var(--muted)">sample (first 600 chars)</summary><pre style="margin:4px 0 0;padding:6px 8px;background:var(--card2);border:1px solid var(--border);border-radius:6px;font-size:.62rem;color:var(--text);white-space:pre-wrap;word-break:break-all;max-height:160px;overflow-y:auto">' + escapeHtml(r.sample) + '</pre></details>' : '';
    return '<div style="padding:10px;border-bottom:1px solid var(--border)">' + line1 + line2 + line3 + line4 + '</div>';
  }).join('');
  list.innerHTML = rows;
}

export function runNewsSourceTest() {
  var btn = document.getElementById('newsTestRunBtn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Running…';
  }
  newsTestResults = {};
  NEWS_TEST_SOURCES.forEach(function(k) {
    newsTestResults[k] = { pending: true };
  });
  renderNewsSourceTest();
  var promises = NEWS_TEST_SOURCES.map(function(k) {
    return fetch(API_BASE + '/api/proxy-test?source=' + encodeURIComponent(k))
      .then(function(r) {
        return r.json();
      })
      .then(function(j) {
        newsTestResults[k] = j;
        renderNewsSourceTest();
      })
      .catch(function(e) {
        newsTestResults[k] = { ok: false, error: 'fetch failed: ' + (e && e.message || e) };
        renderNewsSourceTest();
      });
  });
  Promise.all(promises).then(function() {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '▶ Run All';
    }
  });
}

export function copyNewsSourceTest() {
  var lines = ['MLB News Source Test', 'Date: ' + new Date().toISOString(), 'Proxy: ' + API_BASE + '/api/proxy-test', ''];
  NEWS_TEST_SOURCES.forEach(function(k) {
    var r = newsTestResults[k];
    lines.push('── ' + k + ' ──');
    if (!r || r.pending) {
      lines.push('  (not tested)');
      lines.push('');
      return;
    }
    lines.push('  url:        ' + (r.url || '?'));
    lines.push('  status:     ' + (r.status || '?') + ' · ok=' + !!r.ok);
    lines.push('  kind:       ' + (r.kind || '?'));
    lines.push('  contentType:' + (r.contentType || '?'));
    lines.push('  bytes:      ' + (r.byteLength || 0));
    lines.push('  elapsedMs:  ' + (r.elapsedMs || 0));
    lines.push('  itemCount:  ' + (r.itemCount || 0));
    lines.push('  firstTitle: ' + (r.firstTitle || ''));
    if (r.error) lines.push('  error:      ' + r.error);
    if (r.sample) {
      lines.push('  sample (first 600 chars):');
      r.sample.split('\n').forEach(function(ln) {
        lines.push('    ' + ln);
      });
    }
    lines.push('');
  });
  var text = lines.join('\n');
  var btn = document.getElementById('newsTestCopyBtn');
  function flash(msg) {
    if (!btn) return;
    var orig = btn.textContent;
    btn.textContent = msg;
    setTimeout(function() {
      btn.textContent = orig;
    }, 1800);
  }
  if (typeof window !== 'undefined' && window._copyToClipboard) {
    window._copyToClipboard(text);
    flash('✓ Copied!');
  } else if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function() {
      flash('✓ Copied!');
    }, function() {
      if (typeof window !== 'undefined' && window.fallbackCopy) {
        window.fallbackCopy(text);
        flash('✓ Copied (fallback)');
      }
    });
  }
}
