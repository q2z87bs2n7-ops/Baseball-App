// ── Video Debug Panel (Dev Tools) ───────────────────────────────────────────
// Inspector for the HR/scoring play feed → /game/{pk}/content video clip pipeline.
// Section 1: lists feed items in last 2h with their clip-attachment status
// Section 2: dumps state.liveContentCache contents per game with per-clip diagnostics
// (statcast filter, scoring keyword presence, playback URL availability, taxonomy)

import { state } from '../state.js';
import { pickPlayback, pollPendingVideoClips } from '../data/clips.js';

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Kept for backward compatibility; no longer needed since clips.js is imported directly.
export function setVideoDebugCallbacks(cbs) {}

export function openVideoDebugPanel() {
  const p = document.getElementById('videoDebugPanel');
  if (!p) return;
  p.style.display = 'flex';
  renderVideoDebugPanel();
}

export function closeVideoDebugPanel() {
  const p = document.getElementById('videoDebugPanel');
  if (p) p.style.display = 'none';
}

export async function refreshVideoDebugPanel() {
  const btn = document.getElementById('videoDebugRefreshBtn');
  if (btn) {
    btn.textContent = '⏳ Fetching...';
    btn.disabled = true;
  }
  await pollPendingVideoClips();
  renderVideoDebugPanel();
  if (btn) {
    btn.textContent = '↻ Fetch Now';
    btn.disabled = false;
  }
}

function renderVideoDebugPanel() {
  const el = document.getElementById('videoDebugList');
  if (!el) return;
  let html = '';

  // ── Section 1: HR / scoring play feed items and their clip-patch state ──────
  const feed = document.getElementById('feed');
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  const hrItems = state.feedItems.filter(function(item) {
    if (!item.data || !item.data.batterId) return false;
    if (item.data.event !== 'Home Run' && !item.data.scoring) return false;
    return item.ts && item.ts.getTime() >= cutoff;
  });
  html += '<div style="margin-bottom:16px;border:1px solid var(--border);border-radius:8px;overflow:hidden">';
  html += '<div style="background:var(--card2);padding:8px 12px;font-weight:700;color:var(--text)">🎯 HR / scoring plays in last 2h — ' + hrItems.length + ' found</div>';
  if (!hrItems.length) {
    html += '<div style="padding:8px 12px;color:var(--muted)">No qualifying plays in state.feedItems yet.</div>';
  } else {
    hrItems.slice().reverse().forEach(function(item) {
      const domEl = feed && feed.querySelector('[data-ts="' + item.ts.getTime() + '"][data-gamepk="' + item.gamePk + '"]');
      const patched = domEl && domEl.dataset.clipPatched === '1';
      const patchBadge = patched ? '<span style="background:rgba(34,197,94,.2);color:#4ade80;padding:1px 6px;border-radius:4px">✓ clip attached</span>' : '<span style="background:rgba(245,158,11,.18);color:#fbbf24;padding:1px 6px;border-radius:4px">⏳ pending</span>';
      const domBadge = domEl ? '<span style="color:var(--muted)">in DOM</span>' : '<span style="color:#f87171">not in DOM</span>';
      html += '<div style="padding:7px 12px;border-top:1px solid var(--border);display:flex;gap:8px;flex-wrap:wrap;align-items:center">';
      html += patchBadge + ' ' + domBadge;
      html += '<span style="color:var(--text)">' + escHtml(item.data.batterName || '?') + '</span>';
      html += '<span style="color:var(--muted)">' + escHtml(item.data.event || '') + '</span>';
      html += '<span style="color:var(--muted);font-size:.65rem">pk:' + item.gamePk + ' ts:' + new Date(item.ts).toLocaleTimeString() + '</span>';
      html += '</div>';
    });
  }
  html += '</div>';

  // ── Section 2: state.liveContentCache per game ───────────────────────────────────
  const pks = Object.keys(state.liveContentCache);
  html += '<div style="margin-bottom:8px;font-weight:700;color:var(--text);font-size:.8rem">📦 state.liveContentCache — ' + pks.length + ' game' + (pks.length === 1 ? '' : 's') + '</div>';
  if (!pks.length) {
    html += '<div style="color:var(--muted);padding:8px 0 4px">No content fetched yet. Click "↻ Fetch Now" above after HR plays appear in the feed.</div>';
  }
  pks.forEach(function(pk) {
    const entry = state.liveContentCache[pk];
    const clips = entry.items || [];
    const age = Math.round((Date.now() - entry.fetchedAt) / 1000);
    html += '<div style="margin-bottom:16px;border:1px solid var(--border);border-radius:8px;overflow:hidden">';
    html += '<div style="background:var(--card2);padding:8px 12px;font-weight:700;color:var(--text);display:flex;justify-content:space-between;align-items:center">';
    html += '<span>Game ' + pk + ' &nbsp;<span style="color:var(--muted);font-weight:400">(' + clips.length + ' video clips)</span></span>';
    html += '<span style="color:var(--muted);font-size:.65rem;font-weight:400">fetched ' + age + 's ago</span>';
    html += '</div>';
    if (!clips.length) {
      html += '<div style="padding:8px 12px;color:var(--muted)">No playable video clips returned from API.</div>';
    } else {
      clips.forEach(function(clip, i) {
        const title = (clip.headline || clip.blurb || '').toLowerCase();
        const isStatcast2 = (title.indexOf('statcast') !== -1 || title.indexOf('savant') !== -1) ||
          (clip.keywordsAll || []).some(function(kw) { const v = (kw.value || kw.slug || '').toLowerCase(); return v === 'statcast' || v === 'savant'; });
        const hasScoringKw = (clip.keywordsAll || []).some(function(kw) { const v = kw.value || kw.slug || ''; return v === 'home-run' || v === 'scoring-play' || v === 'walk-off'; });
        const playerIds = (clip.keywordsAll || []).filter(function(kw) { return kw.type === 'player_id' || (kw.slug && kw.slug.startsWith('player_id-')); }).map(function(kw) { return kw.type === 'player_id' ? kw.value : kw.slug.split('-')[1]; });
        const hasPlayback = !!pickPlayback(clip.playbacks);
        const clipTs = clip.date ? new Date(clip.date).getTime() : null;
        const clipAge = clipTs ? Math.round((Date.now() - clipTs) / 60000) + 'm ago' : 'no date';
        const statcastBadge = isStatcast2 ? '<span style="background:rgba(220,60,60,.25);color:#f87171;padding:1px 5px;border-radius:4px">🚫SC</span>' : '<span style="background:rgba(34,197,94,.15);color:#4ade80;padding:1px 5px;border-radius:4px">✓bc</span>';
        const scoringBadge = hasScoringKw ? '<span style="background:rgba(245,158,11,.2);color:#fbbf24;padding:1px 5px;border-radius:4px">✓kw</span>' : '<span style="color:var(--muted);padding:1px 5px">—kw</span>';
        const playbackBadge = hasPlayback ? '<span style="color:#4ade80">✓mp4</span>' : '<span style="color:#f87171">✗mp4</span>';
        html += '<div style="padding:6px 12px;border-top:1px solid var(--border);' + (isStatcast2 ? 'opacity:.4' : '') + '">';
        html += '<div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center;margin-bottom:3px">';
        html += '<span style="color:var(--muted);min-width:16px">' + i + '.</span>';
        html += statcastBadge + ' ' + scoringBadge + ' ' + playbackBadge;
        html += '<span style="color:var(--muted);font-size:.62rem">' + clipAge + '</span>';
        html += '</div>';
        html += '<div style="color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px" title="' + escHtml(clip.headline || '') + '">' + escHtml(clip.headline || clip.blurb || '(no title)') + '</div>';
        if (playerIds.length) html += '<div style="color:var(--muted);font-size:.62rem">player_ids: ' + escHtml(playerIds.join(', ')) + '</div>';
        const kwTax = (clip.keywordsAll || []).filter(function(kw) { return kw.type === 'taxonomy'; }).map(function(kw) { return kw.value || kw.slug; }).join(', ');
        if (kwTax) html += '<div style="color:var(--muted);font-size:.62rem">taxonomy: ' + escHtml(kwTax) + '</div>';
        html += '</div>';
      });
    }
    html += '</div>';
  });

  el.innerHTML = html;
}

export function copyVideoDebug() {
  const btn = document.getElementById('videoDebugCopyBtn');
  function flash(t) { if (btn) { const o = btn.textContent; btn.textContent = t; setTimeout(function() { btn.textContent = o; }, 1800); } }
  const feed = document.getElementById('feed');
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  const pendingItems = state.feedItems.filter(function(item) {
    return item.data && item.data.batterId && (item.data.event === 'Home Run' || item.data.scoring) && item.ts && item.ts.getTime() >= cutoff;
  }).map(function(item) {
    const domEl = feed && feed.querySelector('[data-ts="' + item.ts.getTime() + '"][data-gamepk="' + item.gamePk + '"]');
    return { gamePk: item.gamePk, batterName: item.data.batterName, batterId: item.data.batterId, event: item.data.event, ts: item.ts.toISOString(), clipPatched: !!(domEl && domEl.dataset.clipPatched === '1') };
  });
  const cacheOut = {};
  Object.keys(state.liveContentCache).forEach(function(pk) {
    const entry = state.liveContentCache[pk];
    cacheOut[pk] = {
      fetchedAt: new Date(entry.fetchedAt).toISOString(),
      clipCount: (entry.items || []).length,
      clips: (entry.items || []).map(function(clip) {
        const playerIds = (clip.keywordsAll || []).filter(function(kw) { return kw.type === 'player_id' || (kw.slug && kw.slug.startsWith('player_id-')); }).map(function(kw) { return kw.type === 'player_id' ? kw.value : kw.slug.split('-')[1]; });
        const taxonomy = (clip.keywordsAll || []).filter(function(kw) { return kw.type === 'taxonomy'; }).map(function(kw) { return kw.value || kw.slug; });
        const isStatcast = (clip.headline || clip.blurb || '').toLowerCase().indexOf('statcast') !== -1 || taxonomy.some(function(v) { return v === 'statcast' || v === 'savant'; });
        return { id: clip.id, headline: clip.headline || clip.blurb, date: clip.date, isStatcast: isStatcast, hasScoringKw: taxonomy.some(function(v) { return v === 'home-run' || v === 'scoring-play' || v === 'walk-off'; }), playerIds: playerIds, taxonomy: taxonomy, hasPlayback: !!pickPlayback(clip.playbacks) };
      })
    };
  });
  const text = JSON.stringify({ pendingFeedItems: pendingItems, liveContentCache: cacheOut }, null, 2);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function() { flash('✓ Copied!'); }).catch(function() {
      if (typeof window !== 'undefined' && window.fallbackCopy) window.fallbackCopy(text);
      flash('✓ Copied (fallback)');
    });
  } else {
    if (typeof window !== 'undefined' && window.fallbackCopy) window.fallbackCopy(text);
    flash('✓ Copied (fallback)');
  }
}
