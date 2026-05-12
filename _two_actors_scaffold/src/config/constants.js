// Central constants. Bump APP_VERSION via package.json — build.mjs's
// `__APP_VERSION__` define replaces this at build time.

export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';

// TMDB — all requests go through /api/tmdb proxy.
export const TMDB_PROXY = '/api/tmdb';
export const IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';
export const IMAGE_BASE_ORIGINAL = 'https://image.tmdb.org/t/p/original';

// Allowlist for image hosts (mirrors baseball-app's NEWS_IMAGE_HOSTS pattern).
export const ALLOWED_IMAGE_HOSTS = /^(image\.themoviedb\.org|image\.tmdb\.org)$/;

// Gameplay defaults.
export const DEFAULT_HOP_LIMIT = 6;
export const SEARCH_DEBOUNCE_MS = 300;
export const SOLVER_MAX_FRONTIER = 50;  // cap cast-per-movie when running BFS

// Scoreboard.
export const SCOREBOARD_API = '/api/scoreboard';
export const MAX_HISTORY_ROUNDS = 200;

// localStorage keys.
export const LS_PROFILE = 'alg.profile';
export const LS_PROFILE_NAMES = 'alg.profileNames';
