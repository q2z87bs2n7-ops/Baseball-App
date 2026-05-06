// Vercel serverless function: Aggregate MLB news from multiple RSS sources
// Usage: /api/proxy-news
// Returns: { success, count, sourceCounts, errors?, articles[] }
//   - articles: { title, link, image, source, pubDate }
//   - sources fetched in parallel with 6s per-upstream timeout via AbortController
//   - rejected/timed-out sources are silently dropped (don't 500 whole call)
//   - merged, sorted newest-first by pubDate, capped at 80 items
//   - edge-cached 5 min fresh, 10 min stale-while-revalidate
//
// Source URLs are aligned with /api/proxy-test ALLOWLIST so any URL that
// passed the diagnostic (Settings → Dev Tools → 🔬 News Source Test) maps
// directly here. Update both files together when adding/changing a source.

import { parseRssItems } from './proxy-rss.js';

const SOURCES = {
  mlb:       { url: 'https://www.mlb.com/feeds/news/rss.xml',                                    format: 'rss'  },
  espn:      { url: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/news?limit=20', format: 'json' },
  mlbtr:     { url: 'https://www.mlbtraderumors.com/feed',                                       format: 'rss'  },
  fangraphs: { url: 'https://blogs.fangraphs.com/feed/',                                         format: 'rss'  },
  cbs:       { url: 'https://www.cbssports.com/rss/headlines/mlb/',                              format: 'rss'  }
};

const PER_SOURCE_TIMEOUT_MS = 6000;
const PER_SOURCE_CAP = 25;
const TOTAL_CAP = 80;
const UA = 'Mozilla/5.0 (compatible; BaseballAppNews/1.0; +https://baseball-app-sigma.vercel.app)';

function parseEspnJson(body, key) {
  try {
    const data = JSON.parse(body);
    const articles = Array.isArray(data.articles) ? data.articles : [];
    return articles
      .filter(a => a && a.headline)
      .map(a => ({
        title: a.headline,
        link: (a.links && a.links.web && a.links.web.href) || '',
        image: (a.images && a.images[0] && a.images[0].url) || null,
        source: key,
        pubDate: a.published ? (() => {
          const d = new Date(a.published);
          return isNaN(d.getTime()) ? '' : d.toISOString();
        })() : ''
      }))
      .filter(a => a.link);
  } catch (e) {
    return [];
  }
}

async function fetchSource(key, cfg) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), PER_SOURCE_TIMEOUT_MS);
  try {
    const r = await fetch(cfg.url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, 'Accept': '*/*' },
      redirect: 'follow'
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const body = await r.text();

    let items;
    if (cfg.format === 'json') {
      items = parseEspnJson(body, key);
    } else {
      items = parseRssItems(body, key)
        .map(({ title, link, image, source, pubDate }) => ({
          title, link, image, source, pubDate
        }));
    }
    return items.slice(0, PER_SOURCE_CAP);
  } finally {
    clearTimeout(t);
  }
}

export default async function handler(req, res) {
  const settled = await Promise.allSettled(
    Object.entries(SOURCES).map(([key, cfg]) => fetchSource(key, cfg))
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
