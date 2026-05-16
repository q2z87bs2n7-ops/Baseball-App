// Vercel serverless function: resolve team podcasts via the public iTunes
// API (no key required) and return each show's artwork + latest episode's
// direct audio URL, as JSON. Runs server-side so there are no CORS issues
// and iTunes rate limits are shared/cached rather than per-client.
//
// Usage:
//   /api/proxy-podcast?ids=258864037,1457146683   (curated collectionIds)
//   /api/proxy-podcast?term=Seattle%20Mariners%20podcast   (fallback search)
//
// Response: { success, count, shows:[{collectionId,name,artwork,episodeTitle,audioUrl,date}] }

const UA = 'Mozilla/5.0 (compatible; BaseballAppPodcasts/1.0; +https://baseball-app-sigma.vercel.app)';
const MAX_SHOWS = 5;

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

    const date = ep.releaseDate
      ? new Date(ep.releaseDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : '';

    return {
      collectionId: show.collectionId || Number(id),
      name: show.collectionName || ep.collectionName || 'Podcast',
      artwork: show.artworkUrl600 || show.artworkUrl160 || ep.artworkUrl600 || ep.artworkUrl160 || '',
      episodeTitle: ep.trackName || '',
      audioUrl: ep.episodeUrl,
      date,
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
    let candidateIds = [];

    if (ids) {
      candidateIds = String(ids)
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
    } else {
      const search = await itunes(
        `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=podcast&entity=podcast&limit=12&country=US`
      );
      const seen = new Set();
      (search.results || []).forEach(r => {
        if (r.collectionId && !seen.has(r.collectionId)) {
          seen.add(r.collectionId);
          candidateIds.push(r.collectionId);
        }
      });
    }

    // Resolve more than MAX_SHOWS so dead shows can be skipped, then cap.
    const resolved = await Promise.all(
      candidateIds.slice(0, MAX_SHOWS + 3).map(resolveShow)
    );
    const shows = resolved.filter(Boolean).slice(0, MAX_SHOWS);

    if (!shows.length) {
      return res.status(200).json({
        success: false,
        message: 'No playable podcasts found',
        shows: [],
      });
    }

    // Cache hard at the edge: iTunes is rate-limited (~20 req/min) and this
    // data changes at most a few times per day.
    res.setHeader('Cache-Control', 's-maxage=604800, stale-while-revalidate=86400');
    res.status(200).json({
      success: true,
      count: shows.length,
      shows,
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
