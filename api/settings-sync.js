import { Redis } from '@upstash/redis';
const kv = new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });

async function verifySession(token) {
  if (!token) return null;
  const sessionKey = `session:${token}`;
  const sessionRaw = await kv.get(sessionKey);
  if (!sessionRaw) return null;
  const session = JSON.parse(sessionRaw.toString());
  if (session.expiresAt < Date.now()) {
    await kv.del(sessionKey);
    return null;
  }
  return session;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    // Extract token from Authorization header or query string
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
    const settingsKey = `settings:${userId}`;

    if (req.method === 'GET') {
      // Fetch remote settings
      const remoteRaw = await kv.get(settingsKey);
      const remote = remoteRaw ? JSON.parse(remoteRaw.toString()) : {};
      return res.status(200).json({ settings: remote });
    }

    if (req.method === 'POST') {
      // Sync settings: last-write-wins
      const { sound, theme, invert, timestamp } = req.body;

      if (typeof timestamp !== 'number') {
        return res.status(400).json({ error: 'Missing timestamp' });
      }

      const remoteRaw = await kv.get(settingsKey);
      const remote = remoteRaw ? JSON.parse(remoteRaw.toString()) : {};

      // Only update if new data is newer
      if (!remote.timestamp || timestamp >= remote.timestamp) {
        const merged = {
          timestamp: timestamp,
        };

        if (sound !== undefined) merged.sound = sound;
        if (theme !== undefined) merged.theme = theme;
        if (invert !== undefined) merged.invert = invert;

        // Preserve existing values if not provided in update
        Object.assign(merged, remote, merged);

        await kv.set(settingsKey, JSON.stringify(merged));
        return res.status(200).json({ settings: merged });
      }

      // Remote is newer, return it
      return res.status(200).json({ settings: remote });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Settings sync error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
