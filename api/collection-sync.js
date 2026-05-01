import { Redis } from '@upstash/redis';
const kv = new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });

function tierRank(tier) {
  const ranks = { legendary: 4, epic: 3, rare: 2, common: 1 };
  return ranks[tier] || 0;
}

function mergeCollectionSlots(local, remote) {
  if (!local) local = {};
  if (!remote) remote = {};

  const merged = { ...local, ...remote };

  Object.keys(local).forEach(key => {
    if (remote[key]) {
      const lRank = tierRank(local[key].tier);
      const rRank = tierRank(remote[key].tier);

      if (lRank > rRank) {
        merged[key] = local[key]; // local tier higher
      } else if (rRank > lRank) {
        merged[key] = remote[key]; // remote tier higher
      } else {
        // Same tier — use whichever is newer, merge events
        const newer = local[key].collectedAt >= remote[key].collectedAt
          ? local[key]
          : remote[key];

        // Deduplicate events by date + badge
        const eventMap = new Map();
        (local[key].events || []).forEach(e => {
          const key = `${e.date}:${e.badge}`;
          eventMap.set(key, e);
        });
        (remote[key].events || []).forEach(e => {
          const key = `${e.date}:${e.badge}`;
          eventMap.set(key, e);
        });

        const events = Array.from(eventMap.values())
          .sort((a, b) => new Date(b.date) - new Date(a.date))
          .slice(0, 10); // cap 10

        merged[key] = { ...newer, events };
      }
    }
  });

  return merged;
}

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
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
    const collectionKey = `collection:${userId}`;

    if (req.method === 'GET') {
      // Fetch remote collection
      const remoteRaw = await kv.get(collectionKey);
      const remote = remoteRaw ? (typeof remoteRaw === 'string' ? JSON.parse(remoteRaw) : remoteRaw) : {};
      return res.status(200).json({ collection: remote });
    }

    if (req.method === 'POST') {
      // Push a new card to collection
      const { slot, card } = req.body;

      if (!slot || !card) {
        return res.status(400).json({ error: 'Missing slot or card data' });
      }

      const remoteRaw = await kv.get(collectionKey);
      const remote = remoteRaw ? (typeof remoteRaw === 'string' ? JSON.parse(remoteRaw) : remoteRaw) : {};

      // Check if slot exists and if card tier is higher
      if (remote[slot]) {
        const existingRank = tierRank(remote[slot].tier);
        const newRank = tierRank(card.tier);

        if (newRank < existingRank) {
          // Card is lower tier, don't update but still return merged state
          return res.status(200).json({ collection: remote, merged: false });
        }

        if (newRank === existingRank) {
          // Same tier — append event if not duplicate
          const eventKey = `${card.events[0].date}:${card.events[0].badge}`;
          const existingKeys = new Set(
            remote[slot].events.map(e => `${e.date}:${e.badge}`)
          );

          if (!existingKeys.has(eventKey)) {
            remote[slot].events.unshift(card.events[0]);
            remote[slot].events = remote[slot].events.slice(0, 10); // cap 10
          }

          return res.status(200).json({ collection: remote, merged: false });
        }
      }

      // Card is higher tier or new slot — update it
      remote[slot] = card;
      await kv.set(collectionKey, JSON.stringify(remote));

      return res.status(200).json({ collection: remote, merged: true });
    }

    if (req.method === 'PUT') {
      // Full sync with merge logic
      const { localCollection } = req.body;

      if (!localCollection || typeof localCollection !== 'object') {
        return res.status(400).json({ error: 'Invalid collection data' });
      }

      const remoteRaw = await kv.get(collectionKey);
      const remote = remoteRaw ? (typeof remoteRaw === 'string' ? JSON.parse(remoteRaw) : remoteRaw) : {};

      // Merge: highest tier wins
      const merged = mergeCollectionSlots(localCollection, remote);

      // Store merged result
      await kv.set(collectionKey, JSON.stringify(merged));

      return res.status(200).json({ collection: merged });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Collection sync error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
