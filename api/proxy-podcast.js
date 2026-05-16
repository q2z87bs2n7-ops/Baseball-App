// Vercel serverless function: resolve team podcasts via the public iTunes
// API (no key required) and return each show's artwork + latest episode's
// direct audio URL, as JSON. Runs server-side so there are no CORS issues
// and iTunes rate limits are shared/cached rather than per-client.
//
// Usage:
//   /api/proxy-podcast?term=Seattle%20Mariners%20podcast            (search only)
//   /api/proxy-podcast?ids=258864037,1457146683&term=NY%20Mets...   (curated + API fill)
//
// Only shows whose latest episode is within the last month are returned,
// sorted newest-episode-first, up to 8. Curated ids that are stale are
// dropped and the iTunes search (term) backfills toward 8; if fewer than 8
// shows meet the freshness bar, fewer are returned (criteria never relaxed).
//
// Response: { success, count, shows:[{collectionId,name,artwork,episodeTitle,audioUrl,date}] }

const UA = 'Mozilla/5.0 (compatible; BaseballAppPodcasts/1.0; +https://baseball-app-sigma.vercel.app)';
const MAX_SHOWS = 8;
const FRESH_MS = 31 * 24 * 60 * 60 * 1000; // "last month"

async function itunes(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 6000);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: ctrl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

// Resolve one collectionId → { collectionId, name, artwork, episodeTitle, audioUrl, date }
// or null if it has no playable episode.
async function resolveShow(id) {
  try {
    const data = await itunes(
      `https://itunes.apple.com/lookup?id=${encodeURIComponent(id)}&media=podcast&entity=podcastEpisode&limit=6&country=US`
    );
    const results = (data && data.results) || [];
    if (!results.length) return null;

    const show = results.find(r => r.kind === 'podcast' || r.collectionType === 'Podcast') || results[0];
    const episodes = results
      .filter(r => r.kind === 'podcast-episode' && r.episodeUrl)
      .sort((a, b) => new Date(b.releaseDate || 0) - new Date(a.releaseDate || 0));
    const ep = episodes[0];
    if (!ep) return null;

    const ts = ep.releaseDate ? Date.parse(ep.releaseDate) : 0;
    const date = ts
      ? new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : '';

    return {
      collectionId: show.collectionId || Number(id),
      name: show.collectionName || ep.collectionName || 'Podcast',
      artwork: show.artworkUrl600 || show.artworkUrl160 || ep.artworkUrl600 || ep.artworkUrl160 || '',
      episodeTitle: ep.trackName || '',
      audioUrl: ep.episodeUrl,
      date,
      ts: ts || 0,
    };
  } catch (e) {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const { ids, term } = req.query;

  if (!ids && !term) {
    return res.status(400).json({ error: 'Missing ids or term parameter' });
  }

  try {
    const now = Date.now();
    const haveIds = new Set();
    const shows = [];

    // Keep only fresh (last-month), non-duplicate shows; stop at MAX_SHOWS.
    const take = list => {
      for (const s of list) {
        if (shows.length >= MAX_SHOWS) break;
        if (!s || haveIds.has(s.collectionId)) continue;
        if (!(s.ts > 0 && now - s.ts <= FRESH_MS)) continue;
        haveIds.add(s.collectionId);
        shows.push(s);
      }
    };

    // 1. Curated collectionIds first (stale ones get filtered out by take()).
    const curatedIds = ids
      ? String(ids).split(',').map(s => s.trim()).filter(Boolean)
      : [];
    if (curatedIds.length) {
      take(await Promise.all(curatedIds.map(resolveShow)));
    }

    // 2. Backfill toward MAX_SHOWS from the iTunes search (also the sole
    //    source for uncurated teams). Never relax the freshness criteria.
    if (shows.length < MAX_SHOWS && term) {
      const search = await itunes(
        `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=podcast&entity=podcast&limit=24&country=US`
      );
      const seen = new Set();
      const searchIds = [];
      (search.results || []).forEach(r => {
        if (r.collectionId && !seen.has(r.collectionId)) {
          seen.add(r.collectionId);
          if (!haveIds.has(r.collectionId)) searchIds.push(r.collectionId);
        }
      });
      take(await Promise.all(searchIds.slice(0, 16).map(resolveShow)));
    }

    // 3. Sort by latest episode, newest first.
    shows.sort((a, b) => b.ts - a.ts);
    const out = shows.map(({ ts, ...rest }) => rest);

    if (!out.length) {
      return res.status(200).json({
        success: false,
        message: 'No podcasts updated in the last month',
        shows: [],
      });
    }

    // Shorter edge cache than a static feed: the "last month" window and
    // newest-first sort are time-relative, so results must not go stale by
    // days. 6h still shields iTunes' ~20 req/min limit well.
    res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');
    res.status(200).json({
      success: true,
      count: out.length,
      shows: out,
    });
  } catch (error) {
    console.error('[proxy-podcast] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      shows: [],
    });
  }
}
