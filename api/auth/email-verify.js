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
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }

    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { token, redirect } = req.query;

    if (!token) {
      return res.status(400).json({ error: 'Missing magic link token' });
    }

    // Retrieve and validate token
    const tokenKey = `email_token:${token}`;
    const tokenDataRaw = await kv.get(tokenKey);

    if (!tokenDataRaw) {
      return res.status(400).json({ error: 'Invalid or expired magic link' });
    }

    const tokenData = typeof tokenDataRaw === 'string' ? JSON.parse(tokenDataRaw) : tokenDataRaw;

    if (tokenData.expiresAt < Date.now()) {
      await kv.del(tokenKey);
      return res.status(400).json({ error: 'Magic link has expired' });
    }

    const email = tokenData.email;

    // Delete the used token
    await kv.del(tokenKey);

    // Check if this email is already linked to a user
    const emailMapKey = `email_map:${email}`;
    let userId = await kv.get(emailMapKey);

    if (!userId) {
      // Not linked yet — generate new user ID
      userId = generateUserId();
      // Store the email mapping
      await kv.set(emailMapKey, userId);
    } else {
      userId = userId.toString();
    }

    // Generate session token
    const sessionToken = generateToken();
    const sessionKey = `session:${sessionToken}`;
    const sessionData = {
      userId: userId,
      email: email,
      authMethod: 'email',
      createdAt: Date.now(),
      expiresAt: Date.now() + 90 * 24 * 60 * 60 * 1000, // 90 days
    };

    // Store session in Redis (90 day TTL)
    await kv.set(sessionKey, JSON.stringify(sessionData), { ex: 90 * 24 * 60 * 60 });

    // Redirect back to app with token
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const appUrl = redirect || `${protocol}://${host}/`;
    const redirectUrl = `${appUrl}?auth_token=${sessionToken}&auth_method=email`;

    res.status(302).setHeader('Location', redirectUrl).end();
  } catch (err) {
    console.error('Email verify error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
