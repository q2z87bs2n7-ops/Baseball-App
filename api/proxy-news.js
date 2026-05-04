// Vercel serverless function: Aggregate MLB news from multiple RSS sources
// Usage: /api/proxy-news
// Returns: { success, count, articles: [{ title, link, image, source, pubDate }] }
//   - sources fetched in parallel with 6s per-upstream timeout via AbortController
//   - rejected/timed-out sources are silently dropped (don't 500 whole call)
//   - merged, sorted newest-first by pubDate, capped at 80 items
//   - edge-cached 5 min fresh, 10 min stale-while-revalidate

import { parseRssItems, MLB_RSS_FEEDS } from './proxy-rss.js';

const SOURCES = {
  mlb: { url: MLB_RSS_FEEDS.mlb },
  espn: { url: 'https://www.espn.com/espn/rss/mlb/news' },
  mlbtr: { url: 'https://www.mlbtraderumors.com/feed' },
  fangraphs: { url: 'https://blogs.fangraphs.com/feed/' },
  cbs: { url: 'https://www.cbssports.com/rss/headlines/mlb/' }
};

const PER_SOURCE_TIMEOUT_MS = 6000;
const PER_SOURCE_CAP = 25;
const TOTAL_CAP = 80;

async function fetchSource(key, url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), PER_SOURCE_TIMEOUT_MS);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const xml = await r.text();
    const items = parseRssItems(xml, key).slice(0, PER_SOURCE_CAP);
    return items.map(({ title, link, image, source, pubDate }) => ({
      title, link, image, source, pubDate
    }));
  } finally {
    clearTimeout(t);
  }
}

export default async function handler(req, res) {
  const settled = await Promise.allSettled(
    Object.entries(SOURCES).map(([key, cfg]) => fetchSource(key, cfg.url))
  );

  const merged = [];
  const sourceCounts = {};
  const errors = {};

  settled.forEach((result, i) => {
    const key = Object.keys(SOURCES)[i];
    if (result.status === 'fulfilled') {
      merged.push(...result.value);
      sourceCounts[key] = result.value.length;
    } else {
      sourceCounts[key] = 0;
      errors[key] = result.reason && result.reason.message
        ? result.reason.message
        : String(result.reason);
      console.error(`[proxy-news] ${key} fetch failed:`, errors[key]);
    }
  });

  // Sort newest-first; items with empty pubDate sink to the bottom
  merged.sort((a, b) => {
    if (!a.pubDate && !b.pubDate) return 0;
    if (!a.pubDate) return 1;
    if (!b.pubDate) return -1;
    return b.pubDate.localeCompare(a.pubDate);
  });

  const articles = merged.slice(0, TOTAL_CAP);

  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  res.status(200).json({
    success: articles.length > 0,
    count: articles.length,
    sourceCounts,
    errors: Object.keys(errors).length ? errors : undefined,
    articles
  });
}
