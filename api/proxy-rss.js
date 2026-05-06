// Vercel serverless function: Fetch and parse MLB RSS feeds, return as JSON
// Usage: /api/proxy-rss?feed=mlb (or feed=yankees, mets, etc.)

// Map feed names to RSS URLs (also used by other endpoints — exported)
export const MLB_RSS_FEEDS = {
  mlb: 'https://www.mlb.com/feeds/rss.xml',
  yankees: 'https://www.mlb.com/yankees/feeds/rss.xml',
  mets: 'https://www.mlb.com/mets/feeds/rss.xml',
  redsox: 'https://www.mlb.com/redsox/feeds/rss.xml',
  orioles: 'https://www.mlb.com/orioles/feeds/rss.xml',
  blueJays: 'https://www.mlb.com/bluejays/feeds/rss.xml',
  rays: 'https://www.mlb.com/rays/feeds/rss.xml',
  whiteSox: 'https://www.mlb.com/whitesox/feeds/rss.xml',
  indians: 'https://www.mlb.com/guardians/feeds/rss.xml',
  tigers: 'https://www.mlb.com/tigers/feeds/rss.xml',
  royals: 'https://www.mlb.com/royals/feeds/rss.xml',
  twins: 'https://www.mlb.com/twins/feeds/rss.xml',
  athletics: 'https://www.mlb.com/athletics/feeds/rss.xml',
  mariners: 'https://www.mlb.com/mariners/feeds/rss.xml',
  rangers: 'https://www.mlb.com/rangers/feeds/rss.xml',
  astros: 'https://www.mlb.com/astros/feeds/rss.xml',
  angels: 'https://www.mlb.com/angels/feeds/rss.xml',
  dodgers: 'https://www.mlb.com/dodgers/feeds/rss.xml',
  padres: 'https://www.mlb.com/padres/feeds/rss.xml',
  giants: 'https://www.mlb.com/giants/feeds/rss.xml',
  rockies: 'https://www.mlb.com/rockies/feeds/rss.xml',
  dbacks: 'https://www.mlb.com/dbacks/feeds/rss.xml',
  braves: 'https://www.mlb.com/braves/feeds/rss.xml',
  marlins: 'https://www.mlb.com/marlins/feeds/rss.xml',
  nationals: 'https://www.mlb.com/nationals/feeds/rss.xml',
  phillies: 'https://www.mlb.com/phillies/feeds/rss.xml',
  cardinals: 'https://www.mlb.com/cardinals/feeds/rss.xml',
  pirates: 'https://www.mlb.com/pirates/feeds/rss.xml',
  cubs: 'https://www.mlb.com/cubs/feeds/rss.xml',
  reds: 'https://www.mlb.com/reds/feeds/rss.xml',
  brewers: 'https://www.mlb.com/brewers/feeds/rss.xml'
};

// Parse RSS XML into normalized item objects.
// Returns: [{ title, link, image, pubDate, source, description }]
//   - image precedence: <media:content> > <media:thumbnail> > <itunes:image> > <image><url>
//     > <img src> in desc > <img src> in content:encoded > <enclosure type=image/*>
//     > <thumbnail> > scan for any image URL (fallback)
//   - pubDate normalised to ISO 8601; falls back to '' on parse failure (caller can decide ranking)
//   - description has HTML stripped + truncated to 150 chars (matches legacy proxy-rss shape)
export function parseRssItems(xml, sourceKey) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];

    // Title (CDATA-stripped)
    const titleMatch = /<title>([\s\S]*?)<\/title>/.exec(itemXml);
    let title = titleMatch ? titleMatch[1].trim() : '';
    title = title.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();

    // Link
    const linkMatch = /<link>([\s\S]*?)<\/link>/.exec(itemXml);
    const link = linkMatch ? linkMatch[1].trim() : '';

    // Description (CDATA-stripped, kept raw for image scraping)
    const descMatch = /<description>([\s\S]*?)<\/description>/.exec(itemXml);
    let description = descMatch ? descMatch[1] : '';
    description = description.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();

    // Some WordPress feeds (MLBTradeRumors, FanGraphs) put richer HTML in <content:encoded>.
    // Use it as a secondary source for image scraping when description has none.
    const contentMatch = /<content:encoded>([\s\S]*?)<\/content:encoded>/.exec(itemXml);
    let contentEncoded = contentMatch ? contentMatch[1] : '';
    contentEncoded = contentEncoded.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();

    // Image precedence — try increasingly permissive patterns. Quoted attrs
    // can be double or single quotes (some WordPress themes emit single).
    let image = '';
    const ATTR = `(?:"([^"]+)"|'([^']+)')`;
    const pickAttr = (m) => m && (m[1] || m[2] || '');

    // 1. <media:content url="...">
    let m = new RegExp(`<media:content\\b[^>]+url=${ATTR}`).exec(itemXml);
    if (m) image = pickAttr(m);

    // 2. <media:thumbnail url="...">
    if (!image) {
      m = new RegExp(`<media:thumbnail\\b[^>]+url=${ATTR}`).exec(itemXml);
      if (m) image = pickAttr(m);
    }

    // 3. <itunes:image href="..."> — MLB.com news feeds use this
    if (!image) {
      m = new RegExp(`<itunes:image\\b[^>]+href=${ATTR}`).exec(itemXml);
      if (m) image = pickAttr(m);
    }

    // 4. <image><url>...</url></image> — native RSS image element
    if (!image) {
      m = /<image>\s*<url>([\s\S]*?)<\/url>\s*<\/image>/.exec(itemXml);
      if (m) image = m[1].trim();
    }

    // 5. <img src="..."> in description
    if (!image && description) {
      m = new RegExp(`<img\\b[^>]+src=${ATTR}`).exec(description);
      if (m) image = pickAttr(m);
    }

    // 6. <img src="..."> in content:encoded — WordPress (FanGraphs, MLBTR)
    if (!image && contentEncoded) {
      m = new RegExp(`<img\\b[^>]+src=${ATTR}`).exec(contentEncoded);
      if (m) image = pickAttr(m);
    }

    // 7. <enclosure url="..." type="image/...">
    if (!image) {
      m = new RegExp(`<enclosure\\b[^>]+url=${ATTR}[^>]+type=["']image/`).exec(itemXml);
      if (m) image = pickAttr(m);
    }

    // 8. <thumbnail>...</thumbnail> without namespace
    if (!image) {
      m = /<thumbnail>([\s\S]*?)<\/thumbnail>/.exec(itemXml);
      if (m) image = m[1].trim();
    }

    // 9. Last resort: scan the full item for any image-extension URL
    if (!image) {
      m = /https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp|gif)(?:\?[^\s"'<>]*)?/i.exec(itemXml);
      if (m) image = m[0];
    }


    // pubDate (RFC 2822 → ISO 8601)
    const pubMatch = /<pubDate>([\s\S]*?)<\/pubDate>/.exec(itemXml);
    let pubDate = '';
    if (pubMatch) {
      const raw = pubMatch[1].trim();
      const parsed = new Date(raw);
      if (!isNaN(parsed.getTime())) pubDate = parsed.toISOString();
    }

    if (title && link) {
      items.push({
        title,
        link,
        image: image || null,
        pubDate,
        source: sourceKey || '',
        description: description.replace(/<[^>]+>/g, '').substring(0, 150)
      });
    }
  }

  return items;
}

export default async function handler(req, res) {
  const { feed = 'mlb', debug } = req.query;

  // Debug endpoint: test all feeds from server
  if (debug === 'all') {
    const results = { ok: [], errors: [] };
    for (const [key, url] of Object.entries(MLB_RSS_FEEDS)) {
      const start = Date.now();
      try {
        const response = await fetch(url, { timeout: 8000 });
        const elapsed = Date.now() - start;
        if (!response.ok) {
          results.errors.push({ feed: key, url, status: response.status, elapsed });
        } else {
          const xml = await response.text();
          const itemCount = (xml.match(/<item>/g) || []).length;
          results.ok.push({ feed: key, url, status: response.status, itemCount, elapsed, size: xml.length });
        }
      } catch (e) {
        const elapsed = Date.now() - start;
        results.errors.push({ feed: key, url, error: e.message, elapsed });
      }
    }
    return res.status(200).json(results);
  }

  const feedUrl = MLB_RSS_FEEDS[feed];
  if (!feedUrl) {
    return res.status(400).json({ error: 'Invalid feed parameter' });
  }

  try {
    const response = await fetch(feedUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const xml = await response.text();

    const parsed = parseRssItems(xml, feed);
    // Legacy response shape — only expose fields the existing frontend reads.
    const articles = parsed.map(({ title, link, image, description }) => ({
      title, link, image, description
    }));

    if (articles.length === 0) {
      return res.status(200).json({
        success: false,
        message: 'No articles found in feed',
        articles: []
      });
    }

    res.status(200).json({
      success: true,
      feed,
      count: articles.length,
      articles: articles.slice(0, 10) // Return top 10
    });
  } catch (error) {
    console.error(`[proxy-rss] Error fetching feed ${feed}:`, error);
    res.status(500).json({
      success: false,
      error: error.message,
      feed
    });
  }
}
