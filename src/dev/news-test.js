// ── News Source Test (Dev Tools) ────────────────────────────────────────────
// Test each configured news source endpoint via /api/proxy-test,
// showing response status, item count, sample data, and error diagnostics.

import { API_BASE } from '../config/constants.js';
import { isSafeNewsImage, NEWS_IMAGE_HOSTS } from '../utils/news.js';

const NEWS_TEST_SOURCES = ['fangraphs', 'mlbtraderumors', 'cbssports', 'yahoo', 'sbnation_mets', 'baseballamerica', 'mlb_direct', 'reddit_baseball', 'espn_news'];
let newsTestResults = {};
let carouselDiagnostics = null;

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
  var testsDone = Object.keys(newsTestResults).length > 0;
  var carouselDone = carouselDiagnostics !== null;
  if (!testsDone && !carouselDone) {
    list.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted)">Click "▶ Run All" to test each source and carousel.</div>';
    return;
  }
  var html = '';
  html += '<div style="padding:10px;border-bottom:2px solid var(--border);background:var(--card2)"><b style="color:var(--text)">News Sources</b></div>';
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
    var line5 = r.firstItemSample ? '<details style="margin-top:4px"><summary style="cursor:pointer;font-size:.65rem;color:#8ad">first item / article (full)</summary><pre style="margin:4px 0 0;padding:6px 8px;background:var(--card2);border:1px solid var(--border);border-radius:6px;font-size:.62rem;color:var(--text);white-space:pre-wrap;word-break:break-all;max-height:240px;overflow-y:auto">' + escapeHtml(r.firstItemSample) + '</pre></details>' : '';
    return '<div style="padding:10px;border-bottom:1px solid var(--border)">' + line1 + line2 + line3 + line4 + line5 + '</div>';
  }).join('');
  html += rows;
  if (carouselDone) {
    html += '<div style="padding:10px;border-bottom:2px solid var(--border);background:var(--card2);margin-top:10px"><b style="color:var(--text)">News Pool (proxy-news → News tab + Home card)</b></div>';
    if (carouselDiagnostics.pending) {
      html += '<div style="padding:10px;border-bottom:1px solid var(--border);color:var(--muted)">⏳ Loading…</div>';
    } else if (carouselDiagnostics.error) {
      html += '<div style="padding:10px;border-bottom:1px solid var(--border);color:#e03030"><b>Error:</b> ' + escapeHtml(carouselDiagnostics.error) + '</div>';
    } else if (!carouselDiagnostics.articles || !carouselDiagnostics.articles.length) {
      html += '<div style="padding:10px;border-bottom:1px solid var(--border);color:var(--muted)">No articles returned</div>';
    } else {
      // Per-source image extraction summary
      if (carouselDiagnostics.bySource) {
        var summaryRows = Object.keys(carouselDiagnostics.bySource).sort().map(function(src) {
          var s = carouselDiagnostics.bySource[src];
          var pct = s.total ? Math.round(100 * s.withImage / s.total) : 0;
          var color = pct >= 80 ? '#22c55e' : pct >= 40 ? '#e0a040' : '#ff6b6b';
          return '<tr><td style="padding:3px 8px"><b>' + escapeHtml(src) + '</b></td>'
            + '<td style="padding:3px 8px">' + s.total + ' items</td>'
            + '<td style="padding:3px 8px;color:' + color + '">' + s.withImage + ' w/ image (' + pct + '%)</td>'
            + '<td style="padding:3px 8px;color:var(--muted)">' + s.withSafeImage + ' pass safe-list</td></tr>';
        }).join('');
        html += '<div style="padding:10px;border-bottom:1px solid var(--border);font-size:.7rem">'
          + '<div style="margin-bottom:6px"><b>Pool: ' + carouselDiagnostics.totalCount + ' articles</b> · per-source image extraction:</div>'
          + '<table style="width:100%;border-collapse:collapse;font-size:.68rem">' + summaryRows + '</table>'
          + '</div>';
      }
      html += '<div style="padding:10px;border-bottom:1px solid var(--border);background:var(--card2);font-size:.7rem;color:var(--muted)">First 10 articles (newest by pubDate):</div>';
      carouselDiagnostics.articles.forEach(function(a, i) {
        var headline = escapeHtml(a.headline || a.title || '(no headline)');
        var srcTag = a.source ? '<span style="display:inline-block;background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:0 6px;font-size:.6rem;color:var(--muted);margin-right:6px">' + escapeHtml(a.source) + '</span>' : '';
        var imageLine = '';
        if (a.image) {
          var safe = a.imageSafe ? '✅' : '❌';
          var original = escapeHtml(a.image);
          var afterHttps = escapeHtml(a.imageAfterHttps || a.image);
          var domain = escapeHtml(a.imageDomain || '?');
          imageLine = '<div style="margin-top:4px;font-size:.7rem;color:var(--muted)"><b>Image:</b> [' + safe + '] domain: ' + domain + '</div>'
            + '<div style="margin-top:2px;font-size:.65rem;color:var(--muted);word-break:break-all">URL: ' + original + '</div>'
            + (a.image !== (a.imageAfterHttps || a.image) ? '<div style="margin-top:2px;font-size:.65rem;color:#b0a0ff">forceHttps: ' + original + ' → ' + afterHttps + '</div>' : '')
            + (a.safeReason ? '<div style="margin-top:2px;font-size:.65rem;color:#ff8888">Reason: ' + escapeHtml(a.safeReason) + '</div>' : '');
        } else {
          imageLine = '<div style="margin-top:4px;font-size:.7rem;color:var(--muted)"><b>Image:</b> (none)</div>';
        }
        html += '<div style="padding:10px;border-bottom:1px solid var(--border)">'
          + '<div style="font-size:.8rem;color:var(--text);margin-bottom:2px">' + (i+1) + '. ' + srcTag + headline.slice(0, 100) + '</div>'
          + imageLine
          + '</div>';
      });
      if (carouselDiagnostics.allowlistSource) {
        html += '<div style="padding:10px;border-bottom:1px solid var(--border);font-size:.65rem;color:var(--muted)"><b>Allowlist regex:</b> <code style="word-break:break-all">' + escapeHtml(carouselDiagnostics.allowlistSource) + '</code></div>';
      }
    }
  }
  list.innerHTML = html;
}

function forceHttps(url) {
  return url ? url.replace(/^http:/, 'https:') : url;
}

export function runNewsSourceTest() {
  var btn = document.getElementById('newsTestRunBtn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Running…';
  }
  newsTestResults = {};
  carouselDiagnostics = { pending: true };
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
  promises.push(fetchCarouselDiagnostics());
  Promise.all(promises).then(function() {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '▶ Run All';
    }
  });
}

function fetchCarouselDiagnostics() {
  return fetch(API_BASE + '/api/proxy-news')
    .then(function(r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function(d) {
      var allArticles = Array.isArray(d.articles) ? d.articles : [];
      // Per-source image stats over the FULL pool (proxy-news returns up to 80)
      var bySource = {};
      allArticles.forEach(function(a) {
        var src = a.source || '(unknown)';
        if (!bySource[src]) bySource[src] = { total: 0, withImage: 0, withSafeImage: 0, exampleNoImage: null };
        bySource[src].total += 1;
        if (a.image) {
          bySource[src].withImage += 1;
          if (isSafeNewsImage(a.image)) bySource[src].withSafeImage += 1;
        } else if (!bySource[src].exampleNoImage) {
          bySource[src].exampleNoImage = { title: a.title || a.headline || '', link: a.link || '' };
        }
      });
      var articles = allArticles.slice(0, 10);
      carouselDiagnostics = {
        totalCount: allArticles.length,
        bySource: bySource,
        articles: articles.map(function(a) {
          var img = a.image || null;
          var imgDomain = null;
          var imgSafe = false;
          var imgAfterHttps = null;
          var safeReason = null;
          var suggestedEntry = null;
          if (!img) {
            safeReason = 'no image URL';
          } else {
            try {
              var url = new URL(img);
              imgDomain = url.hostname;
              imgSafe = isSafeNewsImage(img);
              imgAfterHttps = forceHttps(img);
              if (!imgSafe) {
                // Compute likely parent registrable domain (last two labels) — e.g. sportshub.cbsistatic.com → cbsistatic.com
                var parts = imgDomain.split('.');
                suggestedEntry = parts.length >= 2 ? parts.slice(-2).join('.') : imgDomain;
                safeReason = 'hostname "' + imgDomain + '" not in NEWS_IMAGE_HOSTS allowlist (add "' + suggestedEntry + '" to fix)';
              }
            } catch (e) {
              imgDomain = '(invalid URL)';
              imgAfterHttps = img;
              safeReason = 'malformed URL: ' + (e && e.message || e);
            }
          }
          return {
            source: a.source || '(unknown)',
            headline: a.headline || a.title || null,
            image: img,
            imageDomain: imgDomain,
            imageSafe: imgSafe,
            imageAfterHttps: imgAfterHttps,
            safeReason: safeReason,
            suggestedEntry: suggestedEntry
          };
        }),
        allowlistSource: NEWS_IMAGE_HOSTS.source
      };
      renderNewsSourceTest();
    })
    .catch(function(e) {
      carouselDiagnostics = { error: 'fetch failed: ' + (e && e.message || e) };
      renderNewsSourceTest();
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
    if (r.firstItemSample) {
      lines.push('  first item / article (full):');
      r.firstItemSample.split('\n').forEach(function(ln) {
        lines.push('    ' + ln);
      });
    }
    lines.push('');
  });
  lines.push('');
  lines.push('─── News Pool (proxy-news → News tab + Home card) ───');
  if (carouselDiagnostics) {
    if (carouselDiagnostics.error) {
      lines.push('Error: ' + carouselDiagnostics.error);
    } else if (carouselDiagnostics.articles && carouselDiagnostics.articles.length) {
      lines.push('Total articles: ' + (carouselDiagnostics.totalCount || carouselDiagnostics.articles.length));
      if (carouselDiagnostics.bySource) {
        lines.push('');
        lines.push('Per-source image extraction:');
        Object.keys(carouselDiagnostics.bySource).sort().forEach(function(src) {
          var s = carouselDiagnostics.bySource[src];
          var pct = s.total ? Math.round(100 * s.withImage / s.total) : 0;
          lines.push('  ' + src.padEnd(12) + ' total=' + s.total + '  withImage=' + s.withImage + ' (' + pct + '%)  passSafe=' + s.withSafeImage);
          if (s.exampleNoImage && s.exampleNoImage.title) {
            lines.push('    example with no image: ' + s.exampleNoImage.title);
            if (s.exampleNoImage.link) lines.push('      ' + s.exampleNoImage.link);
          }
        });
      }
      lines.push('');
      lines.push('First 10 articles:');
      carouselDiagnostics.articles.forEach(function(a, i) {
        lines.push('');
        lines.push('[' + (i+1) + '] [' + (a.source || '?') + '] ' + (a.headline || '(no headline)'));
        if (a.image) {
          lines.push('  image: ' + a.image);
          lines.push('  domain: ' + (a.imageDomain || '?'));
          lines.push('  safe (passes isSafeNewsImage): ' + (a.imageSafe ? 'YES' : 'NO'));
          if (a.safeReason) lines.push('  reason: ' + a.safeReason);
          if (a.image !== (a.imageAfterHttps || a.image)) {
            lines.push('  forceHttps: ' + a.image + ' → ' + a.imageAfterHttps);
          }
        } else {
          lines.push('  image: (none)');
        }
      });
    } else {
      lines.push('(not tested)');
    }
  } else {
    lines.push('(not tested)');
  }
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
