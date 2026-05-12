// Vercel serverless: shared scoreboard.
// Single key in Upstash Redis: scoreboard:shared
//
// GET  /api/scoreboard           → { rounds: [...], updatedAt }
// POST /api/scoreboard { round } → appends, returns merged state
// PUT  /api/scoreboard { rounds } → full replace (dev tool; not used in normal play)
//
// Required Vercel env vars:
//   KV_REST_API_URL, KV_REST_API_TOKEN — Upstash Redis REST credentials

import { Redis } from '@upstash/redis';

const kv = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const KEY = 'scoreboard:shared';
const MAX_ROUNDS = 200;

async function readBoard() {
  const raw = await kv.get(KEY);
  if (!raw) return { rounds: [], updatedAt: null };
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

async function writeBoard(board) {
  await kv.set(KEY, board);
}

function validateRound(r) {
  if (!r || typeof r !== 'object') return 'round must be an object';
  if (!r.setter || !r.solver) return 'setter and solver required';
  if (!r.actorA || !r.actorB) return 'actorA and actorB required';
  if (typeof r.hops !== 'number' || r.hops < 0) return 'hops must be a non-negative number';
  if (typeof r.timeMs !== 'number' || r.timeMs < 0) return 'timeMs must be a non-negative number';
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const board = await readBoard();
      return res.status(200).json(board);
    }

    if (req.method === 'POST') {
      const { round } = req.body || {};
      const err = validateRound(round);
      if (err) return res.status(400).json({ error: err });

      const board = await readBoard();
      const id = round.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const completedAt = round.completedAt || new Date().toISOString();
      board.rounds = [...board.rounds, { ...round, id, completedAt }].slice(-MAX_ROUNDS);
      board.updatedAt = new Date().toISOString();
      await writeBoard(board);
      return res.status(200).json(board);
    }

    if (req.method === 'PUT') {
      const { rounds } = req.body || {};
      if (!Array.isArray(rounds)) return res.status(400).json({ error: 'rounds must be an array' });
      const board = { rounds: rounds.slice(-MAX_ROUNDS), updatedAt: new Date().toISOString() };
      await writeBoard(board);
      return res.status(200).json(board);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: 'Scoreboard handler failed', detail: String(err) });
  }
}
