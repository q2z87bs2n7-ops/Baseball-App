// TEMP — News source diagnostic. Remove after News tab QA.
// Server-side fetcher restricted to a hardcoded allowlist of candidate
// MLB news feeds. Returns status code, content type, byte length,
// the first 600 chars of the body, and a naive parsed item count
// for RSS/Atom (regex) and Reddit-style JSON.

const ALLOWLIST = {
  fangraphs:        'https://blogs.fangraphs.com/feed/',
  mlbtraderumors:   'https://www.mlbtraderumors.com/feed',
  cbssports:        'https://www.cbssports.com/rss/headlines/mlb/',
  yahoo:            'https://sports.yahoo.com/mlb/rss.xml',
  sbnation_mets:    'https://www.amazinavenue.com/rss/index.xml',
  baseballamerica:  'https://www.baseballamerica.com/feed/',
  mlb_direct:       'https://www.mlb.com/feeds/news/rss.xml',
  reddit_baseball:  'https://www.reddit.com/r/baseball/.json?limit=10',
  espn_news:        'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/news?limit=20'
};

const UA = 'Mozilla/5.0 (compatible; BaseballAppNewsCheck/1.0; +https://baseball-app-sigma.vercel.app)';

export default async function handler(req, res) {
  const { source } = req.query;
  if (!source || !ALLOWLIST[source]) {
    return res.status(400).json({
      ok: false,
      error: 'Unknown source. Pass ?source=<key> where key is one of: ' + Object.keys(ALLOWLIST).join(', '),
      sources: Object.keys(ALLOWLIST)
    });
  }
  const url = ALLOWLIST[source];
  const t0 = Date.now();
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept': '*/*' },
      redirect: 'follow'
    });
    const elapsed = Date.now() - t0;
    const contentType = r.headers.get('content-type') || '';
    const body = await r.text();
    const sample = body.slice(0, 600);

    let itemCount = 0;
    let firstTitle = '';
    let firstItemSample = '';
    let kind = 'unknown';
    if (/json/i.test(contentType) || body.trim().startsWith('{')) {
      kind = 'json';
      try {
        const j = JSON.parse(body);
        if (j && j.data && Array.isArray(j.data.children)) {
          itemCount = j.data.children.length;
          if (itemCount > 0 && j.data.children[0].data) {
            firstTitle = j.data.children[0].data.title || '';
            firstItemSample = JSON.stringify(j.data.children[0].data, null, 2).slice(0, 1500);
          }
        } else if (Array.isArray(j.articles)) {
          itemCount = j.articles.length;
          if (itemCount > 0) {
            firstTitle = j.articles[0].headline || j.articles[0].title || '';
            firstItemSample = JSON.stringify(j.articles[0], null, 2).slice(0, 1500);
          }
        }
      } catch (e) {}
    } else {
      kind = 'xml';
      const itemMatches = body.match(/<item[\s>]/gi);
      const entryMatches = body.match(/<entry[\s>]/gi);
      itemCount = (itemMatches ? itemMatches.length : 0) + (entryMatches ? entryMatches.length : 0);
      const titleMatch = /<item[^>]*>[\s\S]*?<title[^>]*>([\s\S]*?)<\/title>/i.exec(body)
        || /<entry[^>]*>[\s\S]*?<title[^>]*>([\s\S]*?)<\/title>/i.exec(body);
      if (titleMatch) {
        firstTitle = titleMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
      }
      // Capture the first complete <item> or <entry> block so we can see which image tags the feed uses.
      const itemBlock = /<item\b[^>]*>([\s\S]*?)<\/item>/i.exec(body)
        || /<entry\b[^>]*>([\s\S]*?)<\/entry>/i.exec(body);
      if (itemBlock) firstItemSample = itemBlock[0].slice(0, 1500);
    }

    res.status(200).json({
      ok: r.ok,
      source,
      url,
      status: r.status,
      contentType,
      kind,
      byteLength: body.length,
      elapsedMs: elapsed,
      itemCount,
      firstTitle,
      sample,
      firstItemSample
    });
  } catch (err) {
    res.status(200).json({
      ok: false,
      source,
      url,
      error: err && err.message ? err.message : String(err),
      elapsedMs: Date.now() - t0
    });
  }
}

export const ALLOWLIST_KEYS = Object.keys(ALLOWLIST);
