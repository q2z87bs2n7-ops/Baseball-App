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

    // Extract title (try og:title first, then h1)
    let title = '';
    const ogTitleMatch = html.match(/<meta property="og:title" content="([^"]+)"/);
    if (ogTitleMatch) {
      title = ogTitleMatch[1];
    } else {
      const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
      if (h1Match) title = h1Match[1];
    }

    // Extract publish date (look for script tag with JSON-LD)
    let publishDate = '';
    const dateMatch = html.match(/"datePublished":"([^"]+)"/);
    if (dateMatch) {
      try {
        publishDate = new Date(dateMatch[1]).toLocaleDateString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
        });
      } catch (e) {}
    }

    // Extract author (byline)
    let author = '';
    const authorMatch = html.match(/<span[^>]*class="[^"]*byline[^"]*"[^>]*>([^<]+)<\/span>/);
    if (authorMatch) {
      author = authorMatch[1].trim();
    }

    // Extract article body (look for article or main content div)
    let body = '';
    const bodyMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/);
    if (bodyMatch) {
      body = bodyMatch[1];
    } else {
      // Fallback: look for div with article class
      const divMatch = html.match(/<div[^>]*class="[^"]*article[^"]*"[^>]*>([\s\S]*?)<\/div>/);
      if (divMatch) {
        body = divMatch[1];
      } else {
        // Last resort: get main content area
        const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/);
        if (mainMatch) {
          body = mainMatch[1];
        }
      }
    }

    // Sanitize HTML: remove only dangerous elements and attributes
    // Keep structure: paragraphs, divs, images, breaks, etc.
    body = body
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '')
      .replace(/<form[^>]*>[\s\S]*?<\/form>/gi, '')
      .replace(/on\w+="[^"]*"/gi, '')  // Remove event handlers
      .replace(/on\w+='[^']*'/gi, '')   // Remove single-quoted event handlers
      .trim();

    // Extract images that will be displayed inline
    const images = [];
    const imgRegex = /<img[^>]+src="([^"]+)"[^>]*>/g;
    let imgMatch;
    while ((imgMatch = imgRegex.exec(body)) !== null) {
      const src = imgMatch[1];
      if (src.startsWith('http') || src.startsWith('//')) {
        images.push(src.startsWith('//') ? 'https:' + src : src);
      }
    }

    return res.status(200).json({
      success: true,
      title: title || 'Article',
      author: author || '',
      publishDate: publishDate || '',
      body: body || 'No content found',
      images: images.slice(0, 10), // Limit to first 10 images
      url: url
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch article: ' + error.message
    });
  }
}
