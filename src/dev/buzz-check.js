// DEBUG START: buzz handle health check (temporary dev tool — do not merge to main)
import { BASEBALL_BUZZ_ACCOUNTS } from '../config/buzz.js';

const BSKY_API = 'https://public.api.bsky.app/xrpc';

function relAge(ts) {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return s + 's ago';
  const m = Math.floor(s / 60);
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  return Math.floor(h / 24) + 'd ago';
}

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, function(c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

async function checkAccount(acct) {
  const url = BSKY_API + '/app.bsky.feed.getAuthorFeed?actor='
    + encodeURIComponent(acct.handle) + '&limit=1&filter=posts_no_replies';
  try {
    const r = await fetch(url);
    if (!r.ok) return { handle: acct.handle, ok: false, status: r.status, age: null, text: null };
    const d = await r.json();
    const item = d && d.feed && d.feed[0];
    if (!item || !item.post || !item.post.record) {
      return { handle: acct.handle, ok: true, status: 200, age: null, text: '(no posts)' };
    }
    const ts = Date.parse(item.post.record.createdAt || '');
    const snippet = (item.post.record.text || '').replace(/\n/g, ' ').slice(0, 80);
    return { handle: acct.handle, ok: true, status: 200, age: ts ? relAge(ts) : '?', text: snippet };
  } catch (e) {
    return { handle: acct.handle, ok: false, status: 'err', age: null, text: String(e) };
  }
}

export async function runBuzzCheck() {
  const el = document.getElementById('buzzCheckResults');
  if (!el) return;
  el.innerHTML = '<div style="color:var(--muted);font-size:.7rem;padding:8px 0">Checking ' + BASEBALL_BUZZ_ACCOUNTS.length + ' accounts…</div>';

  const results = await Promise.allSettled(BASEBALL_BUZZ_ACCOUNTS.map(checkAccount));
  const rows = results.map(function(r) { return r.status === 'fulfilled' ? r.value : { handle: '?', ok: false, status: 'err', age: null, text: null }; });

  const ok = rows.filter(function(r) { return r.ok; }).length;
  const fail = rows.length - ok;

  let html = '<div style="font-size:.65rem;color:var(--muted);padding:4px 0 6px">'
    + ok + ' OK · <span style="color:#e05">' + fail + ' failed</span></div>'
    + '<div style="display:grid;grid-template-columns:1fr auto auto;gap:2px 8px;align-items:baseline">';

  rows.forEach(function(r) {
    const dot = r.ok
      ? '<span style="color:#3c3">✓</span>'
      : '<span style="color:#e05">✗ ' + r.status + '</span>';
    const age = r.age ? '<span style="color:var(--muted)">' + esc(r.age) + '</span>' : '<span style="color:var(--muted)">—</span>';
    const snippet = r.text
      ? '<span style="color:var(--muted);grid-column:1/-1;padding-left:12px;margin-top:-2px;margin-bottom:4px">' + esc(r.text) + '</span>'
      : '';
    html += '<span style="font-family:monospace;font-size:.65rem">' + esc(r.handle) + '</span>'
      + dot + age + snippet;
  });

  html += '</div>';
  el.innerHTML = html;
}
// DEBUG END: buzz handle health check
