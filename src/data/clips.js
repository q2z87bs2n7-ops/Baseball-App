// ── Video Clip Resolution + Pulse Polling ──────────────────────────────────
// Centralized helpers for video clip discovery, selection, and DOM patching.
// All clip-related modules (pulse feed, yesterday recap, video debug, dev test)
// import these directly so the helpers live in one place.

import { state } from '../state.js';
import { MLB_BASE } from '../config/constants.js';
import { openVideoOverlay } from '../ui/overlays.js';
import { etDateStr, etDatePlus } from '../utils/format.js';

function forceHttps(url) {
  return url ? url.replace(/^http:/, 'https:') : url;
}

// MLB API returns playbacks as a list of formats. Prefer mp4Avc (broadcast quality),
// fall back to any .mp4 URL. Returns null if no playable URL.
export function pickPlayback(playbacks) {
  if (!playbacks || !playbacks.length) return null;
  var mp4 = playbacks.find(function(p) { return p.name === 'mp4Avc'; });
  if (mp4) return mp4.url;
  var any = playbacks.find(function(p) { return p.url && p.url.endsWith('.mp4'); });
  return any ? any.url : null;
}

// Pick the smallest 16:9 cut at ≥480w for thumbnail use; fall back to widest cut.
// MLB API returns cuts either as array [{src,width,aspectRatio}] or object keyed by "WxH".
export function pickHeroImage(item) {
  if (!item || !item.image) return null;
  var raw = item.image.cuts;
  if (!raw) return null;
  var cuts = Array.isArray(raw) ? raw : Object.values(raw);
  if (!cuts.length) return null;
  var c16 = cuts.filter(function(c) { return c.aspectRatio === '16:9' && (c.width || 0) >= 480; });
  c16.sort(function(a, b) { return (a.width || 0) - (b.width || 0); });
  if (c16.length) return c16[0].src || c16[0].url || null;
  cuts.sort(function(a, b) { return (b.width || 0) - (a.width || 0); });
  return cuts.length ? (cuts[0].src || cuts[0].url || null) : null;
}

// Fetch /game/{pk}/content with one-shot caching in state.yesterdayContentCache.
// Yes the cache name says "yesterday" — it's been overloaded for live games too.
// Allowed to fetch in demo mode: callers (Yesterday Recap, devTestVideoClip)
// use this for real historical data. The Pulse demo replay path goes through
// pollPendingVideoClips's own demo branch (contentCacheTimeline), not here.
export async function fetchGameContent(gamePk) {
  if (state.yesterdayContentCache[gamePk]) return state.yesterdayContentCache[gamePk];
  try {
    var r = await fetch(MLB_BASE + '/game/' + gamePk + '/content');
    var d = await r.json();
    state.yesterdayContentCache[gamePk] = d;
    return d;
  } catch (e) {
    state.yesterdayContentCache[gamePk] = null;
    return null;
  }
}

// Inject a "▶" play tile into a feed row's DOM, wired to openVideoOverlay on click.
// Idempotent — sets `data-clip-patched=1` so a second call no-ops.
export function patchFeedItemWithClip(feedItemTs, gamePk, clip) {
  var url = pickPlayback(clip.playbacks);
  var thumb = pickHeroImage(clip);
  var title = clip.headline || clip.blurb || 'Watch Highlight';
  if (!url) return;
  var el = document.querySelector('#feed [data-ts="' + feedItemTs + '"][data-gamepk="' + gamePk + '"]');
  if (!el || el.dataset.clipPatched) return;
  el.dataset.clipPatched = '1';
  var wrap = document.createElement('div');
  wrap.style.cssText = 'margin-top:8px;cursor:pointer;position:relative;border-radius:6px;overflow:hidden;background:#000;line-height:0;width:80%;margin-left:auto;margin-right:auto';
  var thumbUrl = thumb ? forceHttps(thumb) : '';
  wrap.innerHTML = (thumbUrl ? '<img src="' + thumbUrl + '" style="width:100%;aspect-ratio:16/9;object-fit:cover;display:block" onerror="this.style.display=\'none\'">' : '<div style="width:100%;aspect-ratio:16/9;background:#111"></div>')
    + '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center">'
    + '<div style="width:38px;height:38px;border-radius:50%;background:rgba(0,0,0,.65);display:flex;align-items:center;justify-content:center;color:#fff;font-size:1rem;padding-left:3px">▶</div>'
    + '</div>';
  wrap.onclick = function(e) { e.stopPropagation(); openVideoOverlay(url, title); };
  el.appendChild(wrap);
}

// Periodic sweep: scan state.feedItems for HR/scoring plays in the last 2h whose
// feed DOM hasn't been patched yet, fetch /game/{pk}/content per-game (5min cache),
// match clips by player_id only (no timestamp fallback — see comment below), patch on hit.
export async function pollPendingVideoClips() {
  // Anchor the 2h cutoff to demoCurrentTime when replaying — feed items
  // baseline-captured from a previous day have ts values far older than
  // real Date.now(), so a real-clock cutoff filters them all out.
  var anchorMs = state.demoMode ? (state.demoCurrentTime || 0) : Date.now();
  var cutoff = state.demoMode
    ? anchorMs - 2 * 60 * 60 * 1000
    : anchorMs - 16 * 60 * 60 * 1000;
  var feed = document.getElementById('feed');
  if (!feed) return;
  var pending = state.feedItems.filter(function(item) {
    if (!item.data || !item.data.batterId) return false;
    if (item.data.event !== 'Home Run' && !item.data.scoring) return false;
    if (!item.ts || item.ts.getTime() < cutoff) return false;
    var el = feed.querySelector('[data-ts="' + item.ts.getTime() + '"][data-gamepk="' + item.gamePk + '"]');
    return el && !el.dataset.clipPatched;
  });
  if (state.demoMode && window.__demoClipDebug) {
    console.log('[clipDebug] pollPendingVideoClips: demoCurrentTime='+anchorMs+' pending='+pending.length+' feedItems='+state.feedItems.length);
  }
  if (!pending.length) return;
  var byGame = {};
  pending.forEach(function(item) { (byGame[item.gamePk] = byGame[item.gamePk] || []).push(item); });
  for (var pk in byGame) {
    var gpk = +pk;
    if (state.demoMode) {
      // Demo replay: use the LATEST contentCacheTimeline snapshot — clips
      // are typically published 1-20+ min after the play they correspond
      // to, so a ts<=demoCurrentTime walk grabs a snapshot that doesn't
      // yet contain the play's clip. We're replaying, so we already know
      // the full set of clips for the game; player_id + closest-clip
      // matching below sorts out which clip belongs to which play.
      var timeline = state.contentCacheTimeline[gpk] || [];
      var snap = timeline.length ? timeline[timeline.length - 1] : null;
      if (snap && snap.items && snap.items.length) {
        state.liveContentCache[gpk] = { items: snap.items, fetchedAt: state.demoCurrentTime || 0 };
      }
    } else {
      var cached = state.liveContentCache[gpk];
      // Bust cache when any new feed item for this game arrived after the last
      // content snapshot — covers HRs, stolen bases, great catches, etc.
      var hasNewerEvent = cached && byGame[pk].some(function(item) {
        return item.ts.getTime() > cached.fetchedAt;
      });
      if (!cached || hasNewerEvent || (Date.now() - cached.fetchedAt) > 5 * 60 * 1000) {
        try {
          var r = await fetch(MLB_BASE + '/game/' + gpk + '/content');
          if (!r.ok) continue;
          var d = await r.json();
          var all = (d.highlights && d.highlights.highlights && d.highlights.highlights.items) || [];
          // Keep only playable video clips; exclude data-visualization (darkroom, bat-track, etc.)
          state.liveContentCache[gpk] = {
            items: all.filter(function(it) {
              if (it.type !== 'video' || !pickPlayback(it.playbacks)) return false;
              return !(it.keywordsAll || []).some(function(kw) {
                var v = (kw.value || kw.slug || '').toLowerCase();
                return v === 'data-visualization' || v === 'data_visualization';
              });
            }),
            fetchedAt: Date.now()
          };
          if (typeof window !== 'undefined' && window.Recorder && window.Recorder.active) {
            window.Recorder._captureContentDelta(gpk, state.liveContentCache[gpk].items);
          }
        } catch (e) { continue; }
      }
    }
    var clips = (state.liveContentCache[gpk] && state.liveContentCache[gpk].items) || [];
    if (!clips.length) continue;
    // Exclude Statcast/Savant clips — analysis overlays, not broadcast replays.
    function isStatcast(clip) {
      var title = (clip.headline || clip.blurb || '').toLowerCase();
      if (title.indexOf('statcast') !== -1 || title.indexOf('savant') !== -1) return true;
      return (clip.keywordsAll || []).some(function(kw) {
        var v = (kw.value || kw.slug || '').toLowerCase();
        return v === 'statcast' || v === 'savant';
      });
    }
    // Exclude ABS challenge clips — they carry the batter's player_id but are pitch-review
    // overlays, not batting highlight replays. Their timestamps fall before the actual hit
    // clip, causing nearest-timestamp matching to pick them over the correct clip.
    function isABSChallenge(clip) {
      var tax = (clip.keywordsAll || []).filter(function(kw) { return kw.type === 'taxonomy'; });
      var hasAbs = tax.some(function(kw) { return (kw.value || kw.slug || '').toLowerCase() === 'abs'; });
      var hasChallenge = tax.some(function(kw) { return (kw.value || kw.slug || '').toLowerCase() === 'challenge'; });
      return hasAbs && hasChallenge;
    }
    var broadcastClips = clips.filter(function(c) { return !isStatcast(c) && !isABSChallenge(c); });
    // Prefer clips tagged home-run / scoring-play / walk-off (API uses hyphens, not underscores).
    var scoringClips = broadcastClips.filter(function(clip) {
      return (clip.keywordsAll || []).some(function(kw) {
        var v = kw.value || kw.slug || '';
        return v === 'home-run' || v === 'scoring-play' || v === 'walk-off';
      });
    });
    byGame[pk].forEach(function(item) {
      var playTs = item.ts.getTime();
      var bid = String(item.data.batterId);
      function hasPlayer(clip) {
        return (clip.keywordsAll || []).some(function(kw) {
          if (kw.type === 'player_id') return String(kw.value || '') === bid;
          if (kw.slug && kw.slug.startsWith('player_id-')) return kw.slug.split('-')[1] === bid;
          return false;
        });
      }
      // Only match when the clip carries the batter's player_id.
      // Timestamp fallback was removed: it confidently patched the wrong play's clip
      // (e.g. a sac fly clip onto a HR feed item) whenever the real clip wasn't
      // published yet. No clip is better than the wrong clip — unpatched items retry
      // on the next 30s poll.
      var playerFromScoring = scoringClips.filter(hasPlayer);
      var playerFromBroadcast = broadcastClips.filter(hasPlayer);
      var pool = playerFromScoring.length ? playerFromScoring : playerFromBroadcast;
      var best = null, bestDiff = Infinity;
      pool.forEach(function(clip) {
        var clipTs = clip.date ? new Date(clip.date).getTime() : null;
        if (!clipTs) return;
        var diff = Math.abs(clipTs - playTs);
        if (diff < bestDiff) { bestDiff = diff; best = clip; }
      });
      // Only patch if the clip is within the time cap of the play — a stolen
      // base or catch clip from earlier in the game should never lock in on
      // an HR/RBI card. Live uses 20 min (next 30s poll retries when newer
      // clips publish); demo uses 60 min because we use the recording's final
      // snapshot which mixes early and late clips, and clip.date can drift
      // significantly from the play for early-inning events.
      var matchCapMs = state.demoMode ? 60 * 60 * 1000 : 20 * 60 * 1000;
      if (state.demoMode && window.__demoClipDebug) {
        console.log('[clipDebug] match attempt: gamePk='+gpk+' batterId='+bid+' poolSize='+pool.length+' bestDiff(min)='+(bestDiff/60000).toFixed(1)+' best='+(best&&best.id));
      }
      if (best && bestDiff <= matchCapMs) {
        state.lastVideoClip = best;
        var patched = patchFeedItemWithClip(playTs, gpk, best);
        if (state.demoMode && window.__demoClipDebug) {
          console.log('[clipDebug] patched? playTs='+playTs+' gpk='+gpk+' url='+pickPlayback(best.playbacks)+' DOMfound='+!!document.querySelector('#feed [data-ts="'+playTs+'"][data-gamepk="'+gpk+'"]'));
        }
      }
    });
  }
}

// Dev Tools: play a video clip without waiting for a live HR.
// Tries: (1) most recent matched live clip, (2) any cached yesterday content,
// (3) fetches yesterday's first game as fallback.
export async function devTestVideoClip() {
  if (state.lastVideoClip && pickPlayback(state.lastVideoClip.playbacks)) {
    openVideoOverlay(pickPlayback(state.lastVideoClip.playbacks), state.lastVideoClip.headline || state.lastVideoClip.blurb || 'Highlight');
    return;
  }
  var keys = Object.keys(state.yesterdayContentCache);
  for (var i = 0; i < keys.length; i++) {
    var c = state.yesterdayContentCache[keys[i]];
    if (!c) continue;
    var items = (c.highlights && c.highlights.highlights && c.highlights.highlights.items) || [];
    var playable = items.filter(function(it) { return it.type === 'video' && pickPlayback(it.playbacks); });
    if (playable.length) {
      var clip = playable[2] || playable[0];
      state.lastVideoClip = clip;
      openVideoOverlay(pickPlayback(clip.playbacks), clip.headline || clip.blurb || 'Highlight');
      return;
    }
  }
  try {
    var ds = etDatePlus(etDateStr(), -1);
    var r = await fetch(MLB_BASE + '/schedule?date=' + ds + '&sportId=1&hydrate=team');
    if (!r.ok) throw new Error(r.status);
    var d = await r.json();
    var games = (d.dates || []).flatMap(function(dt) { return dt.games || []; });
    if (!games.length) { alert('No clip available — open Yesterday Recap first'); return; }
    var content = await fetchGameContent(games[0].gamePk);
    if (!content) throw new Error('no content');
    var items2 = (content.highlights && content.highlights.highlights && content.highlights.highlights.items) || [];
    var playable2 = items2.filter(function(it) { return it.type === 'video' && pickPlayback(it.playbacks); });
    if (!playable2.length) { alert('No playable clip found for yesterday'); return; }
    state.lastVideoClip = playable2[0];
    openVideoOverlay(pickPlayback(playable2[0].playbacks), playable2[0].headline || playable2[0].blurb || 'Highlight');
  } catch (e) {
    alert('Could not load clip: ' + (e && e.message || e));
  }
}
