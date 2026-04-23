import { kv } from '@vercel/kv';

function subKey(endpoint) {
  const b64 = Buffer.from(endpoint).toString('base64');
  return 'push:' + b64.slice(0, 64);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method === 'POST') {
    const sub = req.body;
    if (!sub || !sub.endpoint) return res.status(400).json({ error: 'Invalid subscription' });
    await kv.set(subKey(sub.endpoint), JSON.stringify(sub));
    return res.status(201).json({ ok: true });
  }

  if (req.method === 'DELETE') {
    const { endpoint } = req.body || {};
    if (!endpoint) return res.status(400).json({ error: 'Missing endpoint' });
    await kv.del(subKey(endpoint));
    return res.status(200).json({ ok: true });
  }

  res.status(405).end();
}
