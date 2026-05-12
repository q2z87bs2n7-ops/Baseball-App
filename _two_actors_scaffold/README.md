# Actor Link Game

A two-player PWA for the actor-linking game (Six-Degrees-of-Kevin-Bacon style).
One player picks two actors; the other has to chain them together using shared
movie credits. Built for two players — me and my wife — but architected to
scale to more.

**Status:** scaffold only — see `HANDOVER.md` for the next implementation phase.

## Stack
- Vanilla JS + esbuild → `dist/app.bundle.js`
- CSS bundled to `dist/styles.min.css`
- PWA via `manifest.json` + `sw.js`
- Vercel serverless functions in `api/` (TMDB proxy + Upstash Redis scoreboard)

## Local dev
```
npm install
npm run build      # one-shot build
npm run watch      # rebuild on save
```
Open `index.html` via any local static server.

## Required Vercel env vars
- `TMDB_READ_TOKEN` — TMDB v4 read-access token (get one at themoviedb.org)
- `KV_REST_API_URL` — Upstash Redis REST URL
- `KV_REST_API_TOKEN` — Upstash Redis REST token

## Docs
- `PROJECT_PLAN.md` — full scoping doc, architecture, build order
- `HANDOVER.md` — brief for the next Claude chat
- `CLAUDE.md` — project rules and conventions
