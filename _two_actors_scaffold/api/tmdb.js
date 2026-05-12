// Vercel serverless: TMDB proxy.
// Client calls /api/tmdb?path=/search/person&query=brad+pitt&...
// We forward to https://api.themoviedb.org/3<path>?<params> with the
// Authorization: Bearer ${TMDB_READ_TOKEN} header (v4 read-access token).
//
// Required Vercel env var:
//   TMDB_READ_TOKEN — TMDB v4 "API Read Access Token" (Bearer-style)

const TMDB_BASE = 'https://api.themoviedb.org/3';

// Allowlist TMDB paths so the proxy can't be used to hit arbitrary URLs.
const ALLOWED_PATTERNS = [
  /^\/search\/person$/,
  /^\/person\/popular$/,
  /^\/person\/\d+$/,
  /^\/person\/\d+\/movie_credits$/,
  /^\/movie\/\d+$/,
  /^\/movie\/\d+\/credits$/,
];

function isAllowed(path) {
  return ALLOWED_PATTERNS.some((re) => re.test(path));
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const token = process.env.TMDB_READ_TOKEN;
  if (!token) return res.status(500).json({ error: 'TMDB_READ_TOKEN not configured' });

  const { path, ...rest } = req.query;
  if (!path || typeof path !== 'string') {
    return res.status(400).json({ error: 'Missing path param' });
  }
  if (!isAllowed(path)) {
    return res.status(400).json({ error: `Path not allowed: ${path}` });
  }

  const qs = new URLSearchParams(rest).toString();
  const url = `${TMDB_BASE}${path}${qs ? `?${qs}` : ''}`;

  try {
    const upstream = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });
    const body = await upstream.text();
    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.send(body);
  } catch (err) {
    return res.status(502).json({ error: 'TMDB fetch failed', detail: String(err) });
  }
}
