import { load } from 'cheerio';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ success: false, error: 'Missing URL parameter' });
  }

  // Validate ESPN URL
  if (!url.includes('espn.com')) {
    return res.status(400).json({ success: false, error: 'Invalid URL (ESPN only)' });
  }

  try {
    const response = await fetch(decodeURIComponent(url), {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const html = await response.text();
    const $ = load(html);

    // Extract title (try og:title first, then h1)
    let title = $('meta[property="og:title"]').attr('content') || $('h1').first().text();

    // Extract publish date (JSON-LD datePublished)
    let publishDate = '';
    const scriptTag = $('script[type="application/ld+json"]').html();
    if (scriptTag) {
      try {
        const jsonData = JSON.parse(scriptTag);
        if (jsonData.datePublished) {
          publishDate = new Date(jsonData.datePublished).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
          });
        }
      } catch (e) {}
    }

    // Extract author (byline)
    let author = $('[class*="byline"]').first().text().trim();

    // Extract article body — try multiple selectors
    let $body = $('article').first();
    if (!$body.html()) {
      $body = $('[class*="article-body"], [class*="article-content"], [class*="story-body"], main').first();
    }
    if (!$body.html()) {
      $body = $('div[class*="content"]').first();
    }

    // Remove unwanted elements from the article body
    $body.find('script, style, iframe, form, nav, aside, [class*="ad"], [class*="advertisement"]').remove();
    $body.find('[class*="social"], [class*="share"], [class*="related"], [class*="more-stories"]').remove();

    // Strip hyperlinks but keep text content
    $body.find('a').each((i, el) => {
      $(el).replaceWith($(el).text());
    });

    // Size images to fit mobile
    $body.find('img').each((i, el) => {
      $(el).attr('style', 'max-width: 100%; height: auto; margin: 12px 0;');
    });

    // Extract images that will be displayed
    const images = [];
    $body.find('img').each((i, el) => {
      const src = $(el).attr('src');
      if (src && (src.startsWith('http') || src.startsWith('//'))) {
        images.push(src.startsWith('//') ? 'https:' + src : src);
      }
    });

    const body = $body.html() || 'No content found';

    return res.status(200).json({
      success: true,
      title: title || 'Article',
      author: author || '',
      publishDate: publishDate || '',
      body: body,
      images: images.slice(0, 10),
      url: url
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch article: ' + error.message
    });
  }
}
