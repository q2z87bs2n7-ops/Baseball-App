// Vercel serverless function: Fetch and parse YouTube RSS feeds, return as JSON
// Usage: /api/proxy-youtube?channel=UCxxxxxx

export default async function handler(req, res) {
  const { channel } = req.query;

  if (!channel) {
    return res.status(400).json({ error: 'Missing channel parameter' });
  }

  try {
    // Fetch YouTube channel feed server-side (no CORS issues)
    const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channel}`;
    const response = await fetch(feedUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const xml = await response.text();

    // Parse Atom feed using simple string matching (Node.js has no native DOMParser)
    const videos = [];
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    let match;

    while ((match = entryRegex.exec(xml)) !== null) {
      const entryXml = match[1];

      // Extract title
      const titleMatch = /<title>([\s\S]*?)<\/title>/.exec(entryXml);
      const title = titleMatch ? titleMatch[1].trim() : '';

      // Extract video ID from namespaced element: <yt:videoId>
      // The yt: namespace is declared on the root <feed> element, not inline on each entry element,
      // so within the <entry> block it appears as plain <yt:videoId> without the xmlns attribute.
      let videoId = '';
      const videoIdMatch = /<yt:videoId>([\s\S]*?)<\/yt:videoId>/.exec(entryXml);
      if (videoIdMatch) {
        videoId = videoIdMatch[1].trim();
      }

      // Extract published date
      const publishedMatch = /<published>([\s\S]*?)<\/published>/.exec(entryXml);
      const published = publishedMatch ? publishedMatch[1] : '';

      // Generate thumbnail URL from video ID
      const thumb = videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : '';

      // Format date
      const date = published ? new Date(published).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

      if (videoId && title) {
        videos.push({
          videoId,
          title,
          thumb,
          date,
        });
      }
    }

    if (videos.length === 0) {
      return res.status(200).json({
        success: false,
        message: 'No videos found in channel',
        videos: [],
      });
    }

    res.status(200).json({
      success: true,
      channel,
      count: videos.length,
      videos,
    });
  } catch (error) {
    console.error(`[proxy-youtube] Error fetching channel ${channel}:`, error);
    res.status(500).json({
      success: false,
      error: error.message,
      channel,
    });
  }
}
