// Puzzle generation. A "puzzle" is just a pair { actorA, actorB } selected
// either manually (by Player A) or randomly. For random pairs, we use
// /person/popular and verify the puzzle is solvable in <= hopLimit before
// handing off — silently re-rolling if not.

import { getPopularPeople } from '../api/tmdb.js';
import { findShortestChain } from './solver.js';
import { DEFAULT_HOP_LIMIT } from '../config/constants.js';

// Returns { actorA, actorB, solvable, optimalHops } or throws after maxTries.
//
// STUB — implementation deferred to Phase 4.
export async function generateRandomPuzzle({
  hopLimit = DEFAULT_HOP_LIMIT,
  minHops = 2,
  maxTries = 6,
} = {}) {
  // TODO:
  //   - Fetch top ~40 popular people (page 1+2 from /person/popular)
  //   - Pick two distinct actors at random
  //   - Run findShortestChain(); if chain length in [minHops, hopLimit], accept
  //   - Otherwise re-roll; bail after maxTries with current best pair
  void hopLimit; void minHops; void maxTries;
  void getPopularPeople; void findShortestChain;
  return null;
}

// Returns a fresh round object from a chosen pair.
export function buildRound({ setter, solver, actorA, actorB, hopLimit = DEFAULT_HOP_LIMIT }) {
  return {
    setter,
    solver,
    actorA,
    actorB,
    chain: [{ actor: actorA, sharedMovie: null }],
    startedAt: Date.now(),
    hopLimit,
  };
}
