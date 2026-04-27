// Vercel serverless function: Fetch and parse MLB RSS feeds, return as JSON
// Usage: /api/proxy-rss?feed=mlb or /api/proxy-rss?feed=yankees

export default async function handler(req, res) {
  const { feed = 'mlb' } = req.query;

  // Map feed param to MLB RSS URL
  const feedUrls = {
    mlb: 'https://www.mlb.com/feeds/news/rss.xml',
    yankees: 'https://www.mlb.com/yankees/feeds/news/rss.xml',
    mets: 'https://www.mlb.com/mets/feeds/news/rss.xml',
    braves: 'https://www.mlb.com/braves/feeds/news/rss.xml',
    phillies: 'https://www.mlb.com/phillies/feeds/news/rss.xml',
    nationals: 'https://www.mlb.com/nationals/feeds/news/rss.xml',
    astros: 'https://www.mlb.com/astros/feeds/news/rss.xml',
    dodgers: 'https://www.mlb.com/dodgers/feeds/news/rss.xml',
    padres: 'https://www.mlb.com/padres/feeds/news/rss.xml',
    giants: 'https://www.mlb.com/giants/feeds/news/rss.xml',
  };

  const feedUrl = feedUrls[feed];
  if (!feedUrl) {
    return res.status(400).json({ error: 'Invalid feed parameter' });
  }

  try {
    // Fetch the RSS feed server-side (no CORS issues)
    const response = await fetch(feedUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const xml = await response.text();

    // Parse XML using simple string matching (Node.js has no native DOMParser)
    const articles = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;

    while ((match = itemRegex.exec(xml)) !== null) {
      const itemXml = match[1];

      // Extract title
      const titleMatch = /<title>([\s\S]*?)<\/title>/.exec(itemXml);
      const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : '';

      // Extract link
      const linkMatch = /<link>([\s\S]*?)<\/link>/.exec(itemXml);
      const link = linkMatch ? linkMatch[1].trim() : 'https://mlb.com';

      // Extract description (try to find image URL in CDATA)
      const descMatch = /<description>([\s\S]*?)<\/description>/.exec(itemXml);
      let imageUrl = '';
      if (descMatch) {
        const desc = descMatch[1];
        const imgMatch = /src=['"]([^'"]+)['"]/i.exec(desc);
        if (imgMatch) {
          imageUrl = imgMatch[1];
        }
      }

      // Extract pubDate for sorting (optional, but useful)
      const pubDateMatch = /<pubDate>([\s\S]*?)<\/pubDate>/.exec(itemXml);
      const pubDate = pubDateMatch ? new Date(pubDateMatch[1]).getTime() : 0;

      if (title.length > 5) {
        articles.push({
          title,
          link,
          image: imageUrl,
          pubDate,
        });
      }
    }

    // Sort by date (newest first) and return top 6
    articles.sort((a, b) => b.pubDate - a.pubDate);
    const result = articles.slice(0, 6).map(({ pubDate, ...a }) => a);

    if (result.length === 0) {
      return res.status(200).json({
        success: false,
        message: 'No articles found in feed',
        articles: [],
      });
    }

    res.status(200).json({
      success: true,
      feed,
      count: result.length,
      articles: result,
    });
  } catch (error) {
    console.error(`[proxy-rss] Error fetching ${feed}:`, error);
    res.status(500).json({
      success: false,
      error: error.message,
      feed,
    });
  }
}
