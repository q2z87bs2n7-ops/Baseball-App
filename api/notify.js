import webpush from 'web-push';
import { kv } from '@vercel/kv';

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

export default async function handler(req, res) {
  if (req.headers['x-notify-token'] !== process.env.NOTIFY_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const today = new Date().toISOString().slice(0, 10);
  let games = [];
  try {
    const r = await fetch(
      `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${today}&hydrate=team`
    );
    const d = await r.json();
    games = d.dates?.[0]?.games ?? [];
  } catch (e) {
    return res.status(502).json({ error: 'MLB API unavailable' });
  }

  const now = Date.now();
  const WINDOW_MS = 10 * 60 * 1000; // notify for games starting within 10 minutes

  const upcoming = games.filter(g => {
    const state = g.status?.abstractGameState;
    if (state !== 'Preview' && state !== 'Scheduled') return false;
    const diff = new Date(g.gameDate).getTime() - now;
    return diff >= 0 && diff <= WINDOW_MS;
  });

  if (!upcoming.length) return res.json({ sent: 0, reason: 'no games starting soon' });

  // Skip games already notified
  const sentFlags = await Promise.all(upcoming.map(g => kv.get(`notified:${g.gamePk}`)));
  const unsent = upcoming.filter((_, i) => !sentFlags[i]);

  if (!unsent.length) return res.json({ sent: 0, reason: 'already notified' });

  // Fetch all push subscriptions
  const keys = await kv.keys('push:*');
  if (!keys.length) return res.json({ sent: 0, reason: 'no subscribers' });

  const rawSubs = await Promise.all(keys.map(k => kv.get(k)));
  const subs = rawSubs.filter(Boolean).map(s => (typeof s === 'string' ? JSON.parse(s) : s));

  let sent = 0;
  const staleKeys = [];

  for (const game of unsent) {
    const away = game.teams.away.team.teamName;
    const home = game.teams.home.team.teamName;
    const payload = JSON.stringify({
      title: '⚾ Game Starting',
      body: `${away} @ ${home} — first pitch now`,
      tag: `game-${game.gamePk}`
    });

    const results = await Promise.allSettled(
      subs.map((sub, i) =>
        webpush.sendNotification(sub, payload).catch(err => {
          if (err.statusCode === 410 || err.statusCode === 404) staleKeys.push(keys[i]);
          throw err;
        })
      )
    );

    const ok = results.filter(r => r.status === 'fulfilled').length;
    if (ok > 0) {
      await kv.set(`notified:${game.gamePk}`, '1', { ex: 86400 });
      sent++;
    }
  }

  // Clean up expired subscriptions
  if (staleKeys.length) {
    await Promise.allSettled(staleKeys.map(k => kv.del(k)));
  }

  res.json({ sent, staleRemoved: staleKeys.length });
}
