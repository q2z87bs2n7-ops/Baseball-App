// Client-side TMDB wrapper. All requests go through the Vercel proxy at
// /api/tmdb — the server attaches the read token.

import { TMDB_PROXY } from '../config/constants.js';
import { state } from '../state.js';

async function tmdb(path, params = {}) {
  const qs = new URLSearchParams({ path, ...params }).toString();
  const res = await fetch(`${TMDB_PROXY}?${qs}`);
  if (!res.ok) throw new Error(`TMDB ${path} → ${res.status}`);
  return res.json();
}

export async function searchPeople(query) {
  const q = query.trim();
  if (!q) return [];
  if (state.cache.personSearch.has(q)) return state.cache.personSearch.get(q);
  const data = await tmdb('/search/person', { query: q, include_adult: 'false' });
  const results = (data.results || []).filter((p) => p.known_for_department === 'Acting');
  state.cache.personSearch.set(q, results);
  return results;
}

export async function getPersonMovieCredits(personId) {
  const cached = state.cache.personCredits.get(personId);
  if (cached) return cached.movies;
  const data = await tmdb(`/person/${personId}/movie_credits`);
  // Filter to acting credits in movies; drop self-as-self appearances.
  const movies = (data.cast || []).filter((m) => {
    if (!m.id) return false;
    const ch = (m.character || '').toLowerCase();
    if (ch.includes('himself') || ch.includes('herself')) return false;
    return true;
  });
  state.cache.personCredits.set(personId, { movies, fetchedAt: Date.now() });
  return movies;
}

export async function getMovieCredits(movieId) {
  const cached = state.cache.movieCast.get(movieId);
  if (cached) return cached.cast;
  const data = await tmdb(`/movie/${movieId}/credits`);
  const cast = data.cast || [];
  state.cache.movieCast.set(movieId, { cast, fetchedAt: Date.now() });
  return cast;
}

export async function getPopularPeople(page = 1) {
  const data = await tmdb('/person/popular', { page: String(page) });
  return (data.results || []).filter(
    (p) => p.known_for_department === 'Acting' && p.profile_path
  );
}

export async function getPerson(personId) {
  return tmdb(`/person/${personId}`);
}

export async function getMovie(movieId) {
  return tmdb(`/movie/${movieId}`);
}
