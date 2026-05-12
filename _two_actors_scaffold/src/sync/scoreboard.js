// Scoreboard sync. Single shared blob at scoreboard:shared in Upstash Redis.
// Read-merge-write on every game completion.

import { SCOREBOARD_API } from '../config/constants.js';
import { state } from '../state.js';

export async function fetchScoreboard() {
  const res = await fetch(SCOREBOARD_API);
  if (!res.ok) throw new Error(`Scoreboard GET ${res.status}`);
  const data = await res.json();
  state.scoreboard = data || { rounds: [], updatedAt: null };
  return state.scoreboard;
}

export async function recordRound(round) {
  const res = await fetch(SCOREBOARD_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ round }),
  });
  if (!res.ok) throw new Error(`Scoreboard POST ${res.status}`);
  const data = await res.json();
  state.scoreboard = data || state.scoreboard;
  return state.scoreboard;
}
