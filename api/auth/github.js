import { Redis } from '@upstash/redis';
const kv = new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });

function generateToken() {
  return Buffer.from(Math.random().toString() + Date.now().toString()).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 40);
}

function generateUserId() {
  return 'user_' + Math.random().toString(36).slice(2, 9);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }

    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { code, state, redirect } = req.query;

    // Validate required params
    if (!code) {
      return res.status(400).json({ error: 'Missing authorization code' });
    }

    // Exchange code for GitHub access token
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code: code,
        state: state,
      }),
    });

    if (!tokenRes.ok) {
      console.error('GitHub token exchange failed:', tokenRes.status, tokenRes.statusText);
      return res.status(400).json({ error: 'Failed to exchange code for token' });
    }

    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      console.error('GitHub OAuth error:', tokenData.error_description);
      return res.status(400).json({ error: tokenData.error_description || 'GitHub OAuth failed' });
    }

    const accessToken = tokenData.access_token;

    // Fetch user info from GitHub
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!userRes.ok) {
      console.error('GitHub user fetch failed:', userRes.status);
      return res.status(400).json({ error: 'Failed to fetch GitHub user' });
    }

    const userData = await userRes.json();
    const githubId = userData.id;
    const githubLogin = userData.login;

    // Check if this GitHub account is already linked to a user
    const githubMapKey = `github_map:${githubId}`;
    let userId = await kv.get(githubMapKey);

    if (!userId) {
      // Not linked yet — generate new user ID
      userId = generateUserId();
      // Store both the GitHub mapping and the user ID
      await kv.set(githubMapKey, userId);
    } else {
      userId = userId.toString();
    }

    // Generate session token
    const sessionToken = generateToken();
    const sessionKey = `session:${sessionToken}`;
    const sessionData = {
      userId: userId,
      githubId: githubId,
      githubLogin: githubLogin,
      authMethod: 'github',
      createdAt: Date.now(),
      expiresAt: Date.now() + 90 * 24 * 60 * 60 * 1000, // 90 days
    };

    // Store session in Redis (90 day TTL)
    await kv.set(sessionKey, JSON.stringify(sessionData), { ex: 90 * 24 * 60 * 60 });

    // Redirect back to app with token
    const appUrl = redirect || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    const redirectUrl = `${appUrl}/?auth_token=${sessionToken}&auth_method=github&github_login=${encodeURIComponent(githubLogin)}`;

    res.status(302).setHeader('Location', redirectUrl).end();
  } catch (err) {
    console.error('GitHub auth error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

