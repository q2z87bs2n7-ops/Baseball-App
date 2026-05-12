// Active-round chain state and step validation.
//
// A chain is an ordered list of { actor, sharedMovie } entries. The first
// entry's `actor` is Actor A; subsequent entries record the actor most
// recently added plus the movie they shared with the previous actor.

import { getPersonMovieCredits } from '../api/tmdb.js';

// Returns { ok: true, sharedMovie } if `candidateId` shares any movie with
// `previousId`, otherwise { ok: false, reason }.
export async function validateHop(previousId, candidateId) {
  if (previousId === candidateId) {
    return { ok: false, reason: 'Same actor' };
  }
  const [prevMovies, candMovies] = await Promise.all([
    getPersonMovieCredits(previousId),
    getPersonMovieCredits(candidateId),
  ]);
  const prevIds = new Set(prevMovies.map((m) => m.id));
  // Pick the highest-rated shared movie to display (TMDB orders by recency by
  // default; we re-order by vote_count to favor recognizable films).
  const shared = candMovies
    .filter((m) => prevIds.has(m.id))
    .sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0));
  if (shared.length === 0) {
    return { ok: false, reason: 'No shared movies' };
  }
  return { ok: true, sharedMovie: shared[0] };
}

// Returns true if the chain reaches the target actor.
export function isComplete(chain, targetId) {
  if (chain.length === 0) return false;
  return chain[chain.length - 1].actor.id === targetId;
}
