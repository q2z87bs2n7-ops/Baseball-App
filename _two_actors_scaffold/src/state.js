// Single mutable state container. Importers receive a live binding to `state`
// — mutate via `state.X = ...`. Never `let local = state.X; local = ...` —
// that breaks the live binding for other modules.

export const state = {
  // Identity — set on first launch.
  profile: null,                              // 'player_a' | 'player_b' | null
  profileNames: {
    player_a: 'Player A',
    player_b: 'Player B',
  },

  // Active round (null when not playing).
  currentRound: null,                         // see shape in PROJECT_PLAN.md §4

  // Shared scoreboard mirror (synced from Redis).
  scoreboard: {
    rounds: [],
    updatedAt: null,
  },

  // TMDB response caches — keyed by id / query.
  cache: {
    personCredits: new Map(),                 // personId -> { movies, fetchedAt }
    movieCast: new Map(),                     // movieId -> { cast, fetchedAt }
    personSearch: new Map(),                  // query -> results
  },

  // UI state.
  currentScreen: 'home',
};
