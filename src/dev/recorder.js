// ── 📼 Demo Recorder
// Browser-resident snapshot capture for Demo Mode v2. Hooks existing live
// polls (pollLeaguePulse, pollGamePlays, pollFocusRich, fetchGameContent,
// fetchBoxscore, addFeedItem) as passive observers — no extra API calls,
// no new poll loops. Exports Download/Copy of a JSON blob compatible with
// loadDailyEventsJSON's expected shape, with new keys for v2 (pitchTimeline,
// boxscoreSnapshots, contentCacheTimeline, focusStatsCache, focusTrack, etc.).
//
// Pattern:
//   if (window.Recorder && window.Recorder.active) window.Recorder._captureX(...)
// keeps observer hooks at one-line cost when the recorder is off.

import { state } from '../state.js';

const SOFT_CAP_BYTES = 5 * 1024 * 1024;   // 5 MB — yellow status warning
const HARD_CAP_BYTES = 10 * 1024 * 1024;  // 10 MB — auto-stop
const SNAPSHOT_INTERVAL_MS = 30000;
const STATUS_INTERVAL_MS = 5000;

// Per-game caps so a long run can't quietly balloon
const PITCH_CAP_PER_GAME = 5000;          // ~150 ABs × 30 pitches
const CONTENT_CAP_PER_GAME = 200;         // clip-cache delta entries
const BOXSCORE_CAP_PER_GAME = 10;         // fetchBoxscore is single-fetch-per-game; this is just a defensive ceiling
const FEED_BASELINE_CAP = 200;            // trim baseline feed to last 200 plays (live cap is 600)

function deepClone(x) {
  // Fast path for the kinds of plain-data objects the recorder captures.
  // Set/Date round-trip via JSON would lose information, so handle them.
  if (x === null || typeof x !== 'object') return x;
  if (x instanceof Date) return new Date(x.getTime());
  if (x instanceof Set) return Array.from(x);
  if (Array.isArray(x)) return x.map(deepClone);
  const out = {};
  for (const k in x) {
    if (Object.prototype.hasOwnProperty.call(x, k)) out[k] = deepClone(x[k]);
  }
  return out;
}

function tsNow() { return Date.now(); }

// Strip MLB clip metadata to demo essentials. A raw clip is ~5–10 KB
// (multi-bitrate playbacks, 12+ image cut variants); trimmed is ~1 KB.
// Demo replay needs: matching by player_id keyword, statcast/abs filtering
// by keyword/headline, and rendering one mp4Avc playback + one 16:9 thumb.
function trimClip(clip) {
  if (!clip) return clip;
  const trimmed = {
    id: clip.id,
    headline: clip.headline,
    blurb: clip.blurb,
    date: clip.date,
    type: clip.type,
    keywordsAll: clip.keywordsAll,  // full — needed for player_id match + filters
  };
  // Keep one playback URL (mp4Avc preferred, any .mp4 fallback — what
  // pickPlayback would select anyway)
  if (clip.playbacks && clip.playbacks.length) {
    const mp4 = clip.playbacks.find(function(p) { return p.name === 'mp4Avc'; });
    const any = mp4 || clip.playbacks.find(function(p) { return p.url && typeof p.url === 'string' && p.url.endsWith('.mp4'); });
    if (any) trimmed.playbacks = [{ name: any.name, url: any.url }];
  }
  // Keep one 16:9 ≥480w cut (smallest above the floor — what pickHeroImage prefers)
  if (clip.image) {
    const raw = clip.image.cuts;
    const cuts = Array.isArray(raw) ? raw : (raw ? Object.values(raw) : []);
    if (cuts.length) {
      const c16 = cuts.filter(function(c) { return c.aspectRatio === '16:9' && (c.width || 0) >= 480; });
      c16.sort(function(a, b) { return (a.width || 0) - (b.width || 0); });
      let best = c16[0];
      if (!best) {
        const sorted = cuts.slice().sort(function(a, b) { return (b.width || 0) - (a.width || 0); });
        best = sorted[0];
      }
      if (best) {
        trimmed.image = { cuts: [{ src: best.src || best.url, width: best.width, aspectRatio: best.aspectRatio }] };
      }
    }
  }
  return trimmed;
}

function pad2(n) { return n < 10 ? '0' + n : '' + n; }
function downloadFilename() {
  const d = new Date();
  return 'daily-events-' + d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate())
    + '-' + pad2(d.getHours()) + pad2(d.getMinutes()) + '.json';
}

const Recorder = {
  active: false,
  data: null,
  snapshotTimer: null,
  statusTimer: null,
  startedAt: 0,
  capWarned: false,

  start: function() {
    if (Recorder.active) return;
    const startTs = tsNow();
    // Step 1 — baseline snapshot of current in-memory state (before observers).
    // Captures everything that's already happened in the session.
    let baselineFeed = (state.feedItems || []);
    if (baselineFeed.length > FEED_BASELINE_CAP) {
      // Keep most-recent N (feedItems are stored newest-first by addFeedItem)
      baselineFeed = baselineFeed.slice(0, FEED_BASELINE_CAP);
    }
    Recorder.data = {
      metadata: {
        recorderVersion: 2,
        startedAt: startTs,
        season: (typeof window !== 'undefined' && window.SEASON) || null,
      },
      // Live game state + feed (overwritten/appended over time)
      gameStates: deepClone(state.gameStates || {}),
      feedItems: baselineFeed.map(function(it) {
        return { gamePk: it.gamePk, data: deepClone(it.data), ts: it.ts ? it.ts.getTime() : tsNow() };
      }),
      scheduleData: deepClone(state.scheduleData || []),
      // Pitch + boxscore — start empty, fill from observers (raw playByPlay
      // not retained between polls so backfill isn't possible)
      pitchTimeline: {},
      boxscoreSnapshots: {},
      // Video clip cache — unified timeline. Pre-existing liveContentCache
      // entries fold in as a single t=startTs entry (trimmed to demo essentials).
      // No separate baseline field. yesterdayContentCache dropped — out of demo
      // replay scope (Yesterday Recap is its own UI surface, not part of demo).
      contentCacheTimeline: {},
      lastVideoClip: state.lastVideoClip ? trimClip(state.lastVideoClip) : null,
      // Story-cache snapshots — overwritten on each 30s tick (latest only,
      // constant size — these are derived caches, not append-only)
      caches: {},
      // Focus mode tracking
      focusStatsCache: deepClone(state.focusStatsCache || {}),
      focusTrack: [{
        ts: startTs,
        focusGamePk: state.focusGamePk || null,
        isManual: !!state.focusIsManual,
        tensionLabel: (state.focusState && state.focusState.tensionLabel) || null,
      }],
    };
    // Fold pre-existing liveContentCache entries into contentCacheTimeline
    // as a single trimmed entry per game at t=startTs.
    const existingContent = state.liveContentCache || {};
    Object.keys(existingContent).forEach(function(pk) {
      const entry = existingContent[pk];
      const items = (entry && entry.items) || [];
      if (!items.length) return;
      Recorder.data.contentCacheTimeline[pk] = [{
        ts: startTs,
        items: items.map(trimClip),
      }];
    });
    // Initial cache snapshot
    Recorder._snapshotCaches();
    Recorder.startedAt = startTs;
    Recorder.capWarned = false;
    Recorder.active = true;
    // Periodic cache snapshot (overwrites latest, doesn't append)
    Recorder.snapshotTimer = setInterval(Recorder._snapshotCaches, SNAPSHOT_INTERVAL_MS);
    Recorder.statusTimer = setInterval(Recorder._updateStatus, STATUS_INTERVAL_MS);
    Recorder._updateStatus();
    Recorder._updateButtonState();
  },

  stop: function() {
    if (!Recorder.active) return;
    Recorder.active = false;
    if (Recorder.snapshotTimer) { clearInterval(Recorder.snapshotTimer); Recorder.snapshotTimer = null; }
    if (Recorder.statusTimer) { clearInterval(Recorder.statusTimer); Recorder.statusTimer = null; }
    if (Recorder.data) {
      // Final scheduleData refresh + metadata
      Recorder.data.scheduleData = deepClone(state.scheduleData || []);
      Recorder.data.lastVideoClip = state.lastVideoClip ? trimClip(state.lastVideoClip) : Recorder.data.lastVideoClip;
      Recorder.data.metadata.exportedAt = tsNow();
      Recorder.data.metadata.durationMs = Recorder.data.metadata.exportedAt - Recorder.startedAt;
    }
    Recorder._updateStatus();
    Recorder._updateButtonState();
  },

  // Stamp metadata.exportedAt + durationMs at export time so mid-run
  // downloads carry an accurate "snapshot taken at" timestamp without
  // disturbing the running recording.
  _stampExportMetadata: function() {
    if (!Recorder.data) return;
    const now = tsNow();
    Recorder.data.metadata.exportedAt = now;
    Recorder.data.metadata.durationMs = now - Recorder.startedAt;
    Recorder.data.metadata.midRun = Recorder.active;
  },

  reset: function() {
    if (Recorder.active) return; // can't reset while running
    Recorder.data = null;
    Recorder.startedAt = 0;
    Recorder.capWarned = false;
    Recorder._updateStatus();
    Recorder._updateButtonState();
  },

  download: function() {
    if (!Recorder.data) return;
    Recorder._stampExportMetadata();
    const blob = new Blob([JSON.stringify(Recorder.data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = downloadFilename();
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
  },

  copy: function() {
    if (!Recorder.data) return;
    Recorder._stampExportMetadata();
    const text = JSON.stringify(Recorder.data);
    function flash(msg) {
      const btn = document.getElementById('recorderCopyBtn');
      if (!btn) return;
      const orig = btn.textContent;
      btn.textContent = msg;
      setTimeout(function() { btn.textContent = orig; }, 1500);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function() { flash('✓ Copied!'); },
        function() { Recorder._fallbackCopy(text); flash('✓ Copied (fallback)'); }
      );
    } else {
      Recorder._fallbackCopy(text);
      flash('✓ Copied (fallback)');
    }
  },

  _fallbackCopy: function(text) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
  },

  // ── Observer hooks (called from existing live functions) ─────────────────
  // Each hook is guarded by `if (window.Recorder && window.Recorder.active)`
  // at the call site so this is zero-cost when disabled.

  _captureGameStates: function() {
    if (!Recorder.data) return;
    Recorder.data.gameStates = deepClone(state.gameStates || {});
  },

  _captureFeedItem: function(item) {
    if (!Recorder.data) return;
    const entry = {
      gamePk: item.gamePk,
      data: deepClone(item.data),
      ts: item.ts ? item.ts.getTime() : tsNow(),
    };
    // Dedup against last few entries by gamePk + ts + type
    const arr = Recorder.data.feedItems;
    for (let i = arr.length - 1; i >= Math.max(0, arr.length - 20); i--) {
      const e = arr[i];
      if (e.gamePk === entry.gamePk && e.ts === entry.ts
          && (e.data && entry.data && e.data.type === entry.data.type
              && (e.data.event || '') === (entry.data.event || ''))) {
        return; // duplicate
      }
    }
    arr.push(entry);
    if (arr.length > 800) arr.shift();
  },

  _capturePlayPitches: function(play, gamePk, gameCtx) {
    if (!Recorder.data || !play || !play.about) return;
    const abIdx = play.about.atBatIndex;
    if (abIdx == null) return;
    const pitchEvents = (play.playEvents || []).filter(function(e) {
      return e.isPitch || e.type === 'pitch';
    });
    if (!pitchEvents.length) return;
    const envelope = {
      atBatIndex: abIdx,
      ts: play.about.endTime ? new Date(play.about.endTime).getTime() : tsNow(),
      batterId: (play.matchup && play.matchup.batter && play.matchup.batter.id) || null,
      batterName: (play.matchup && play.matchup.batter && play.matchup.batter.fullName) || '',
      pitcherId: (play.matchup && play.matchup.pitcher && play.matchup.pitcher.id) || null,
      pitcherName: (play.matchup && play.matchup.pitcher && play.matchup.pitcher.fullName) || '',
      balls: (play.count && play.count.balls) || 0,
      strikes: (play.count && play.count.strikes) || 0,
      outs: (play.count && play.count.outs) || 0,
      inning: (play.about && play.about.inning) || (gameCtx && gameCtx.inning) || 0,
      halfInning: (play.about && play.about.halfInning) || (gameCtx && gameCtx.halfInning) || 'top',
      onFirst: !!(gameCtx && gameCtx.onFirst),
      onSecond: !!(gameCtx && gameCtx.onSecond),
      onThird: !!(gameCtx && gameCtx.onThird),
      awayScore: (play.result && play.result.awayScore != null) ? play.result.awayScore : (gameCtx && gameCtx.awayScore) || 0,
      homeScore: (play.result && play.result.homeScore != null) ? play.result.homeScore : (gameCtx && gameCtx.homeScore) || 0,
      pitches: pitchEvents.map(function(e) {
        return {
          typeCode: (e.details && e.details.type && e.details.type.code) || '??',
          typeName: (e.details && e.details.type && e.details.type.description) || '',
          speed: (e.pitchData && e.pitchData.startSpeed) || null,
          resultCode: (e.details && e.details.code) || '',
          resultDesc: (e.details && e.details.description) || '',
          sequenceIndex: e.pitchNumber || 0,
          eventTs: e.startTime ? new Date(e.startTime).getTime() : null,
          // Per-pitch count from MLB's playEvents[i].count. Demo's pitch
          // sub-tick uses these to animate balls/strikes mid-AB instead of
          // re-deriving from resultCode (which gets hairy for fouls on 2 strikes).
          ballsAfter: (e.count && e.count.balls != null) ? e.count.balls : null,
          strikesAfter: (e.count && e.count.strikes != null) ? e.count.strikes : null,
          outsAfter: (e.count && e.count.outs != null) ? e.count.outs : null,
        };
      }),
    };
    Recorder._mergePitchEnvelope(gamePk, envelope);
  },

  // High-fidelity pitch capture from pollFocusRich (5s GUMBO). Same
  // pitchTimeline target — merge by atBatIndex; 5s data wins over 15s.
  _captureFocusPitches: function(currentPlay, gamePk) {
    if (!Recorder.data || !currentPlay) return;
    const g = state.gameStates[gamePk] || {};
    Recorder._capturePlayPitches(currentPlay, gamePk, g);
  },

  _mergePitchEnvelope: function(gamePk, envelope) {
    if (!Recorder.data.pitchTimeline[gamePk]) Recorder.data.pitchTimeline[gamePk] = [];
    const arr = Recorder.data.pitchTimeline[gamePk];
    const existing = arr.findIndex(function(e) { return e.atBatIndex === envelope.atBatIndex; });
    if (existing === -1) {
      arr.push(envelope);
    } else if ((envelope.pitches || []).length >= (arr[existing].pitches || []).length) {
      // Higher-fidelity capture wins (5s GUMBO has more pitches than 15s playByPlay)
      arr[existing] = envelope;
    }
    // Cap per game
    if (arr.length > PITCH_CAP_PER_GAME) {
      const dropped = arr.splice(0, arr.length - PITCH_CAP_PER_GAME);
      Recorder._note('⚠ pitch cap hit · gamePk=' + gamePk + ' dropped=' + dropped.length);
    }
  },

  _captureContentDelta: function(gamePk, items) {
    if (!Recorder.data) return;
    if (!Recorder.data.contentCacheTimeline[gamePk]) Recorder.data.contentCacheTimeline[gamePk] = [];
    const arr = Recorder.data.contentCacheTimeline[gamePk];
    arr.push({ ts: tsNow(), items: (items || []).map(trimClip) });
    if (arr.length > CONTENT_CAP_PER_GAME) arr.shift();
  },

  _captureBoxscore: function(gamePk, bs) {
    if (!Recorder.data || !bs) return;
    if (!Recorder.data.boxscoreSnapshots[gamePk]) Recorder.data.boxscoreSnapshots[gamePk] = [];
    const arr = Recorder.data.boxscoreSnapshots[gamePk];
    arr.push({ ts: tsNow(), data: deepClone(bs) });
    if (arr.length > BOXSCORE_CAP_PER_GAME) arr.shift();
  },

  _captureFocusStat: function(playerId, group, stats) {
    if (!Recorder.data || !playerId) return;
    Recorder.data.focusStatsCache[playerId] = deepClone(stats);
  },

  _captureFocusTrack: function() {
    if (!Recorder.data) return;
    const entry = {
      ts: tsNow(),
      focusGamePk: state.focusGamePk || null,
      isManual: !!state.focusIsManual,
      tensionLabel: (state.focusState && state.focusState.tensionLabel) || null,
    };
    const arr = Recorder.data.focusTrack;
    const last = arr[arr.length - 1];
    // Dedup contiguous identical samples
    if (last && last.focusGamePk === entry.focusGamePk
        && last.isManual === entry.isManual
        && last.tensionLabel === entry.tensionLabel) {
      return;
    }
    arr.push(entry);
    if (arr.length > 4000) arr.shift();
  },

  _snapshotCaches: function() {
    if (!Recorder.data) return;
    Recorder.data.caches = {
      dailyLeadersCache: deepClone(state.dailyLeadersCache),
      onThisDayCache: deepClone(state.onThisDayCache),
      yesterdayCache: deepClone(state.yesterdayCache),
      hrBatterStatsCache: deepClone(state.hrBatterStatsCache),
      probablePitcherStatsCache: deepClone(state.probablePitcherStatsCache),
      storyCarouselRawGameData: deepClone(state.storyCarouselRawGameData),
      dailyHitsTracker: deepClone(state.dailyHitsTracker),
      dailyPitcherKs: deepClone(state.dailyPitcherKs),
      stolenBaseEvents: deepClone(state.stolenBaseEvents || []),
      transactionsCache: deepClone(state.transactionsCache || []),
      liveWPCache: deepClone(state.liveWPCache || {}),
      perfectGameTracker: deepClone(state.perfectGameTracker || {}),
      highLowCache: deepClone(state.highLowCache),
    };
  },

  // ── UI ───────────────────────────────────────────────────────────────────

  _updateStatus: function() {
    const el = document.getElementById('recorderStatus');
    if (!el) return;
    if (!Recorder.data) {
      el.textContent = 'Idle. Click Start to begin capture.';
      el.style.color = 'var(--muted)';
      return;
    }
    let bytes = 0;
    try { bytes = JSON.stringify(Recorder.data).length; } catch (e) { bytes = -1; }
    const games = Object.keys(Recorder.data.gameStates || {}).length;
    const feedCount = (Recorder.data.feedItems || []).length;
    let pitchTotal = 0, clipTotal = 0;
    for (const pk in Recorder.data.pitchTimeline) {
      pitchTotal += (Recorder.data.pitchTimeline[pk] || []).reduce(function(s, ab) {
        return s + ((ab.pitches || []).length);
      }, 0);
    }
    for (const ck in Recorder.data.contentCacheTimeline) {
      clipTotal += (Recorder.data.contentCacheTimeline[ck] || []).length;
    }
    const elapsedMs = Recorder.active
      ? (tsNow() - Recorder.startedAt)
      : ((Recorder.data.metadata && Recorder.data.metadata.durationMs) || 0);
    const mins = Math.floor(elapsedMs / 60000);
    const secs = Math.floor((elapsedMs % 60000) / 1000);
    const mb = (bytes / (1024 * 1024)).toFixed(2);
    let pitchHint = '';
    if (Recorder.active && pitchTotal === 0) pitchHint = ' · Pitch data: starts on next poll';
    const stateLabel = Recorder.active ? 'Recording' : 'Stopped';
    el.textContent = stateLabel + ' · ' + mins + 'm ' + pad2(secs) + 's · ' + games + ' games · '
      + feedCount + ' plays · ' + pitchTotal + ' pitches · ' + clipTotal + ' clips · ' + mb + ' MB' + pitchHint;
    if (bytes >= HARD_CAP_BYTES) {
      el.style.color = '#ff6464';
      if (Recorder.active) {
        Recorder.stop();
        try { alert('Recorder hit 10 MB hard cap — auto-stopped to protect tab. Download to keep, or Reset to discard.'); } catch (e) {}
      }
    } else if (bytes >= SOFT_CAP_BYTES) {
      el.style.color = '#f59e0b';
      if (!Recorder.capWarned) {
        Recorder.capWarned = true;
        Recorder._note('⚠ over 5 MB — consider stopping soon (10 MB hard cap)');
      }
    } else {
      el.style.color = Recorder.active ? '#22c55e' : 'var(--text)';
    }
  },

  _updateButtonState: function() {
    const toggleBtn = document.getElementById('recorderToggleBtn');
    const copyBtn = document.getElementById('recorderCopyBtn');
    const dlBtn = document.getElementById('recorderDownloadBtn');
    const resetBtn = document.getElementById('recorderResetBtn');
    if (toggleBtn) toggleBtn.textContent = Recorder.active ? '⏹ Stop Recording' : '⏺ Start Recording';
    // Download/Copy work both during and after recording (mid-run snapshots
    // are non-destructive — recording continues). Reset stays gated on !active.
    const hasData = !!Recorder.data;
    if (copyBtn) copyBtn.disabled = !hasData;
    if (dlBtn) dlBtn.disabled = !hasData;
    if (resetBtn) resetBtn.disabled = Recorder.active;
  },

  _note: function(msg) {
    const el = document.getElementById('recorderStatusNote');
    if (!el) return;
    el.textContent = msg;
    el.style.color = '#f59e0b';
    setTimeout(function() { if (el.textContent === msg) el.textContent = ''; }, 6000);
  },

  toggle: function() {
    if (Recorder.active) Recorder.stop();
    else Recorder.start();
  },
};

// Expose to window for one-line guarded hook calls in observer sites.
if (typeof window !== 'undefined') window.Recorder = Recorder;

export { Recorder };
