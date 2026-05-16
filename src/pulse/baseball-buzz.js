// Pulse "Baseball Buzz" side-rail feed.
//
// Reads recent posts from a curated set of baseball Bluesky accounts via
// the KEYLESS public AT-Protocol API (no account, no auth, CORS-enabled —
// same direct-client-fetch pattern Pulse already uses for ESPN/statsapi).
// No Vercel serverless function (keeps us under the Hobby 12-fn cap).
//
// Per account: app.bsky.feed.getAuthorFeed (posts, no replies). Reposts are
// dropped (original posts only). Results are merged, freshness-filtered to
// the last ~30 days, sorted newest-first, capped, and cached in
// localStorage for NEWS_REFRESH_MS so a Pulse re-init doesn't refetch ~45
// feeds every time.

import { state } from '../state.js';
import { BASEBALL_BUZZ_ACCOUNTS } from '../config/buzz.js';
import { escapeNewsHtml } from '../utils/news.js';

const BSKY_API = 'https://public.api.bsky.app/xrpc';
const FRESH_MS = 31 * 24 * 60 * 60 * 1000;   // "last month"
const MAX_POSTS = 10;
const PER_ACCOUNT = 6;
const CACHE_KEY = 'mlb_buzz_cache_v1';
const CACHE_TTL_MS = 600000;                 // 10 min (== TIMING.NEWS_REFRESH_MS)

function rkeyOf(uri) {
  return (uri || '').split('/').pop() || '';
}

function relTime(ts) {
  var s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return 'now';
  var m = Math.floor(s / 60);
  if (m < 60) return m + 'm';
  var h = Math.floor(m / 60);
  if (h < 24) return h + 'h';
  var d = Math.floor(h / 24);
  return d + 'd';
}

async function fetchAccount(acct) {
  try {
    var url = BSKY_API + '/app.bsky.feed.getAuthorFeed?actor='
      + encodeURIComponent(acct.handle)
      + '&limit=' + PER_ACCOUNT + '&filter=posts_no_replies';
    var r = await fetch(url);
    if (!r.ok) return [];
    var d = await r.json();
    var feed = (d && d.feed) || [];
    var out = [];
    feed.forEach(function (item) {
      if (item.reason) return;                       // skip reposts
      var p = item.post;
      if (!p || !p.record || !p.record.text) return; // skip empties
      if (p.record.reply) return;                    // belt-and-braces: no replies
      var ts = Date.parse(p.record.createdAt || '');
      if (!ts || Date.now() - ts > FRESH_MS) return; // last-month only
      var handle = (p.author && p.author.handle) || acct.handle;
      out.push({
        name: acct.name || (p.author && p.author.displayName) || handle,
        handle: handle,
        tag: acct.tag || '',
        text: p.record.text,
        ts: ts,
        url: 'https://bsky.app/profile/' + handle + '/post/' + rkeyOf(p.uri),
      });
    });
    return out;
  } catch (e) {
    return [];
  }
}

function readCache() {
  try {
    var raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    var c = JSON.parse(raw);
    if (!c || !Array.isArray(c.posts)) return null;
    if (Date.now() - c.ts > CACHE_TTL_MS) return null;
    return c.posts;
  } catch (e) { return null; }
}

function writeCache(posts) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), posts: posts }));
  } catch (e) { /* quota / private mode — non-fatal */ }
}

export async function loadBaseballBuzz() {
  var el = document.getElementById('sideRailBuzz');
  if (!el) return;

  var cached = readCache();
  if (cached && cached.length) {
    state.baseballBuzzPosts = cached;
    renderBaseballBuzz();
    return;
  }

  if (!state.baseballBuzzPosts || !state.baseballBuzzPosts.length) {
    el.innerHTML = buzzHeader('') + '<div class="buzz-empty">Loading…</div>';
  }

  try {
    var results = await Promise.allSettled(BASEBALL_BUZZ_ACCOUNTS.map(fetchAccount));
    var posts = [];
    results.forEach(function (res) {
      if (res.status === 'fulfilled' && res.value) posts = posts.concat(res.value);
    });
    posts.sort(function (a, b) { return b.ts - a.ts; });
    posts = posts.slice(0, MAX_POSTS);
    state.baseballBuzzPosts = posts;
    if (posts.length) writeCache(posts);
    renderBaseballBuzz();
  } catch (e) {
    if (!state.baseballBuzzPosts || !state.baseballBuzzPosts.length) {
      el.innerHTML = buzzHeader('') + '<div class="buzz-empty">Buzz feed unavailable</div>';
    }
  }
}

function buzzHeader(count) {
  return '<div class="side-rail-section-header">'
    + '<span class="side-rail-section-title">Baseball Buzz</span>'
    + (count ? '<span class="game-count">' + count + '</span>' : '')
    + '</div>';
}

function renderBaseballBuzz() {
  var el = document.getElementById('sideRailBuzz');
  if (!el) return;
  var posts = state.baseballBuzzPosts || [];
  if (!posts.length) {
    el.innerHTML = buzzHeader('') + '<div class="buzz-empty">No recent posts</div>';
    return;
  }
  var html = buzzHeader(posts.length);
  html += '<div class="buzz-list">';
  posts.forEach(function (p) {
    var meta = '<span class="buzz-meta-name">' + escapeNewsHtml(p.name) + '</span>'
      + (p.tag ? '<span class="buzz-tag">' + escapeNewsHtml(p.tag) + '</span>' : '')
      + '<span class="buzz-time">' + relTime(p.ts) + '</span>';
    html += '<a class="buzz-card" href="' + p.url + '" target="_blank" rel="noopener noreferrer">'
      + '<div class="buzz-meta">' + meta + '</div>'
      + '<div class="buzz-text">' + escapeNewsHtml(p.text) + '</div>'
      + '</a>';
  });
  html += '</div>';
  el.innerHTML = html;
}
