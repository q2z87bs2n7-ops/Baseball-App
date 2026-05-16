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
// feeds every time. v2: avatars, category tag pills, image embeds, filter
// chips (All / My team / Insiders), "via Bluesky" footer.

import { state } from '../state.js';
import { BASEBALL_BUZZ_ACCOUNTS } from '../config/buzz.js';
import { escapeNewsHtml, isSafeNewsImage, forceHttps } from '../utils/news.js';

const BSKY_API = 'https://public.api.bsky.app/xrpc';
const FRESH_MS = 31 * 24 * 60 * 60 * 1000;   // "last month"
const MAX_POSTS = 10;
const PER_ACCOUNT = 6;
const CACHE_KEY = 'mlb_buzz_cache_v2';        // bumped: shape gained avatar/category/embedImage
const CACHE_TTL_MS = 120000;                  // 2 min — reopen/reload guard only; the
                                              // scheduled timer force-fetches (see loadBaseballBuzz)

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

function initialsOf(name) {
  var parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  var first = parts[0].charAt(0);
  var last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
  return (first + last).toUpperCase();
}

// First image-embed thumb URL, or null. Only app.bsky.embed.images#view —
// link previews (external#view) and quote posts (record#view) are ignored.
function extractEmbedImage(embed) {
  if (!embed) return null;
  if (embed.$type === 'app.bsky.embed.images#view' && embed.images && embed.images[0]) {
    return embed.images[0].thumb || null;
  }
  return null;
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
        category: acct.category || 'team',
        avatar: (p.author && p.author.avatar) || null,
        embedImage: extractEmbedImage(p.embed),
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

// force=true (the scheduled 2-min timer) always hits the network so the
// timer is the true refresh cadence. force=false (first Pulse nav / reopen)
// uses the localStorage cache so a reload within CACHE_TTL_MS is free.
export async function loadBaseballBuzz(force) {
  var el = document.getElementById('sideRailBuzz');
  if (!el) return;

  if (!force) {
    var cached = readCache();
    if (cached && cached.length) {
      state.baseballBuzzPosts = cached;
      renderBaseballBuzz();
      return;
    }
  }

  if (!state.baseballBuzzPosts || !state.baseballBuzzPosts.length) {
    el.classList.remove('buzz-has-footer');
    el.innerHTML = buzzHeader() + '<div class="buzz-empty">Loading…</div>';
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
      el.classList.remove('buzz-has-footer');
      el.innerHTML = buzzHeader() + '<div class="buzz-empty">Buzz feed unavailable</div>';
    }
  }
}

function buzzHeader() {
  return '<div class="side-rail-section-header">'
    + '<span class="side-rail-section-title">Baseball Buzz</span>'
    + '</div>';
}

function avatarHtml(p) {
  var ini = escapeNewsHtml(initialsOf(p.name));
  var img = '';
  if (p.avatar && isSafeNewsImage(p.avatar)) {
    img = '<img src="' + escapeNewsHtml(forceHttps(p.avatar)) + '" alt="" loading="lazy"'
      + ' onerror="this.remove()">';
  }
  return '<span class="buzz-avatar"><span class="buzz-avatar-fallback">' + ini + '</span>' + img + '</span>';
}

function cardHtml(p) {
  var head = avatarHtml(p)
    + '<span class="buzz-meta-name">' + escapeNewsHtml(p.name) + '</span>'
    + (p.tag ? '<span class="buzz-tag" data-cat="' + escapeNewsHtml(p.category || '') + '">'
        + escapeNewsHtml(p.tag) + '</span>' : '')
    + '<span class="buzz-time">' + relTime(p.ts) + '</span>';

  var embed = '';
  var hasEmbed = false;
  if (p.embedImage && isSafeNewsImage(p.embedImage)) {
    hasEmbed = true;
    embed = '<div class="buzz-embed"><img src="' + escapeNewsHtml(forceHttps(p.embedImage))
      + '" alt="" loading="lazy"></div>';
  }

  return '<a class="buzz-card' + (hasEmbed ? ' buzz-has-embed' : '') + '" href="'
    + escapeNewsHtml(p.url) + '" target="_blank" rel="noopener noreferrer">'
    + '<div class="buzz-head">' + head + '</div>'
    + '<div class="buzz-text">' + escapeNewsHtml(p.text) + '</div>'
    + embed
    + '</a>';
}

function renderBaseballBuzz() {
  var el = document.getElementById('sideRailBuzz');
  if (!el) return;
  var all = state.baseballBuzzPosts || [];

  if (!all.length) {
    el.classList.remove('buzz-has-footer');
    el.innerHTML = buzzHeader() + '<div class="buzz-empty">No recent posts</div>';
    return;
  }

  el.classList.add('buzz-has-footer');
  var html = buzzHeader() + '<div class="buzz-list">';
  all.forEach(function (p) { html += cardHtml(p); });
  html += '</div><div class="buzz-footer">via <span>Bluesky</span></div>';
  el.innerHTML = html;
}
