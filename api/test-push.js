import webpush from 'web-push';
import { Redis } from '@upstash/redis';
const kv = new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

export default async function handler(req, res) {
  if (req.headers['x-notify-token'] !== process.env.NOTIFY_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const keys = await kv.keys('push:*');
  if (!keys.length) return res.json({ sent: 0, reason: 'no subscribers' });

  const rawSubs = await Promise.all(keys.map(k => kv.get(k)));
  const subs = rawSubs.filter(Boolean).map(s => (typeof s === 'string' ? JSON.parse(s) : s));

  const payload = JSON.stringify({
    title: '⚾ Test Notification',
    body: 'Push notifications are working!',
    tag: 'test-push'
  });

  const staleKeys = [];
  const results = await Promise.allSettled(
    subs.map((sub, i) =>
      webpush.sendNotification(sub, payload).catch(err => {
        if (err.statusCode === 410 || err.statusCode === 404) staleKeys.push(keys[i]);
        throw err;
      })
    )
  );

  if (staleKeys.length) {
    await Promise.allSettled(staleKeys.map(k => kv.del(k)));
  }

  const sent = results.filter(r => r.status === 'fulfilled').length;
  res.json({ sent, subscribers: subs.length, staleRemoved: staleKeys.length });
}
