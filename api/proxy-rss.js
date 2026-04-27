// Vercel serverless function: Fetch and parse MLB RSS feeds, return as JSON
// Usage: /api/proxy-rss?feed=mlb (or feed=yankees, mets, etc.)

export default async function handler(req, res) {
  const { feed = 'mlb' } = req.query;

  // Map feed names to RSS URLs
  const feedMap = {
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

  const feedUrl = feedMap[feed];
  if (!feedUrl) {
    return res.status(400).json({ error: 'Invalid feed parameter' });
  }

  try {
    const response = await fetch(feedUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const xml = await response.text();

    // Parse RSS feed using string matching
    const articles = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;

    while ((match = itemRegex.exec(xml)) !== null) {
      const itemXml = match[1];

      // Extract title
      const titleMatch = /<title>([\s\S]*?)<\/title>/.exec(itemXml);
      let title = titleMatch ? titleMatch[1].trim() : '';
      // Remove CDATA tags if present
      title = title.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();

      // Extract link
      const linkMatch = /<link>([\s\S]*?)<\/link>/.exec(itemXml);
      const link = linkMatch ? linkMatch[1].trim() : '';

      // Extract description and look for image
      const descMatch = /<description>([\s\S]*?)<\/description>/.exec(itemXml);
      let description = descMatch ? descMatch[1] : '';
      description = description.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();

      // Extract image URL from description HTML or media:content tag
      let image = '';

      // Try media:content first
      const mediaMatch = /<media:content url="([^"]+)"/.exec(itemXml);
      if (mediaMatch) {
        image = mediaMatch[1];
      }

      // Fallback: extract img src from description
      if (!image) {
        const imgMatch = /<img[^>]+src="([^"]+)"/.exec(description);
        if (imgMatch) {
          image = imgMatch[1];
        }
      }

      if (title && link) {
        articles.push({
          title,
          link,
          image: image || null,
          description: description.replace(/<[^>]+>/g, '').substring(0, 150)
        });
      }
    }

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
