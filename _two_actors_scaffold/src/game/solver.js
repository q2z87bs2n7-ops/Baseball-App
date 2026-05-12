// BFS shortest-chain finder. Used to:
//   1. Pre-validate that a random puzzle is solvable in <= hopLimit
//   2. Reveal the solution when a player gives up
//
// Node: actor id. Edge: any shared movie.
//
// Performance notes:
//   - Each actor's movie list is one TMDB call (cached in state.cache.personCredits)
//   - Each candidate movie's full cast is one TMDB call (cached in state.cache.movieCast)
//   - Cap candidate cast at SOLVER_MAX_FRONTIER (sorted by `order` field) so a
//     huge blockbuster doesn't explode the frontier.

import { getPersonMovieCredits, getMovieCredits } from '../api/tmdb.js';
import { SOLVER_MAX_FRONTIER } from '../config/constants.js';

// Returns an array of { actorId, movieId } hops from sourceId to targetId
// (excluding the source), or null if no path within `maxHops`.
//
// STUB — implementation deferred to Phase 4. See PROJECT_PLAN.md §6.
// The contract is fixed so the rest of the app can be wired against it.
export async function findShortestChain(sourceId, targetId, maxHops = 6) {
  // TODO: implement BFS
  //   - frontier = Map<actorId, parentLink>  (parentLink = { fromActorId, viaMovieId } | null)
  //   - for depth = 1..maxHops:
  //       - for each actor in current frontier:
  //           - load their movies
  //           - for each movie:
  //               - load cast (capped at SOLVER_MAX_FRONTIER)
  //               - for each cast member not visited:
  //                   - record parentLink and add to next frontier
  //                   - if hits targetId, reconstruct and return chain
  //   - return null
  void sourceId; void targetId; void maxHops;
  void getPersonMovieCredits; void getMovieCredits; void SOLVER_MAX_FRONTIER;
  return null;
}
