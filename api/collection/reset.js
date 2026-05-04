import { Redis } from '@upstash/redis';
const kv = new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });

async function verifySession(token) {
  if (!token) return null;
  const sessionKey = `session:${token}`;
  const sessionRaw = await kv.get(sessionKey);
  if (!sessionRaw) return null;
  const session = typeof sessionRaw === 'string' ? JSON.parse(sessionRaw) : sessionRaw;
  if (session.expiresAt < Date.now()) {
    await kv.del(sessionKey);
    return null;
  }
  return session;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '') || req.query.token;

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized: Missing token' });
    }

    const session = await verifySession(token);
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
    }

    const userId = session.userId;
    const collectionKey = `collection:${userId}`;

    await kv.del(collectionKey);

    return res.status(200).json({ ok: true, message: 'Collection reset' });
  } catch (err) {
    console.error('Collection reset error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
