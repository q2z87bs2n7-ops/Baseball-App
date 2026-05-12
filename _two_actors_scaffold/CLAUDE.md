# Actor Link Game — Project Rules

## What This Is
A two-player PWA for the actor-linking game (Six Degrees of Kevin Bacon).
Built for two players (rotating setter/solver). All actor/movie data comes
from TMDB; scoreboard sync via Upstash Redis. Stack: vanilla JS + esbuild +
Vercel. See `PROJECT_PLAN.md` for full scope. See `HANDOVER.md` for the next
implementation phase.

**Current version:** see `package.json`.

## Workflow Rules

1. **Never assume** — always ask before proposing or touching code
2. **Surgical edits only** — smallest possible change; do not reformat or reorganize surrounding code
3. **No changes without explicit user approval** — show old/new before applying
4. **Break changes into small steps** — confirm each works before proceeding
5. **Git branching** — all changes go to a `claude/*` branch first; only merge to `main` when explicitly asked
6. **Version every change** — bump `package.json` `"version"` only. The build (`npm run build`) propagates the version into the bundle (`__APP_VERSION__` define), `sw.js` `CACHE` constant, and `index.html` cache-bust query strings. Use `X.Y.Z`. On a `claude/*` branch, increment the patch `Z` per commit. On merge to main, bump the minor `Y` in a separate commit.
7. **No rewrites** — targeted edits only.
8. **No framework** — vanilla JS is a hard requirement.

## Architecture Overview

### File layout
See `PROJECT_PLAN.md` §3 for the full tree and per-folder responsibility.

### File responsibilities

| Change type | File |
|---|---|
| Add/move an HTML element, section, overlay, button | `index.html` |
| Change how something looks | `styles.css` |
| Game/chain/BFS logic | `src/game/*.js` |
| TMDB API call shape | `src/api/tmdb.js` (client) + `api/tmdb.js` (Vercel proxy) |
| New cross-cutting state | `src/state.js` |
| New screen | new file in `src/ui/` + a section div in `index.html` |
| PWA caching behaviour | `sw.js` |
| Version bump | `package.json` only (build does the rest) |

### Build & deploy
- `npm run build` → `dist/app.bundle.js` + `dist/styles.min.css`. **`dist/` is gitignored** and built by Vercel on every push to main.
- `npm run watch` → rebuild on save during dev.
- Service worker `CACHE` constant is rewritten in place by `build.mjs` on every build (regex replace from `package.json` version). Same pattern for index.html cache-bust query strings.

### Key global state
All hot mutable state lives in `src/state.js` as properties of a single exported `state` object. Importers receive a live binding.

**Mutation rule:** importers must mutate via `state.X = ...`. Never `let local = state.X; local = newVal` — that breaks the live binding for other modules. Reads via destructuring or property access are fine.

### Navigation
`showSection(id, btn)` in `src/ui/nav.js` toggles `.active` on `<section>` elements. Section ids: `home`, `play`, `scoreboard`, `history`, `settings`. Overlays (actor detail, movie detail, end-of-round reveal) live as top-level `<div>` siblings of the sections, not nested.

### Theming
Theme is dark by default with a single CSS variable palette. The app is not multi-themed in v1; if multi-theme is added later, follow baseball-app's `applyTeamTheme` pattern: nine variables, persisted to localStorage, re-applied inline before `<style>` renders to prevent flash.

## APIs

### TMDB (via proxy)
- Client always hits `/api/tmdb?path=<encoded TMDB path>&...params`
- Server attaches `Authorization: Bearer ${TMDB_READ_TOKEN}` and forwards
- Image base URL is `https://image.tmdb.org/t/p/w500` (see `src/config/constants.js`)
- Endpoints in active use: see `PROJECT_PLAN.md` §5

### Scoreboard (Upstash Redis)
- One shared key: `scoreboard:shared`
- `GET /api/scoreboard` → entire blob
- `POST /api/scoreboard` → append a round (server merges + dedupes)
- `PUT /api/scoreboard` → full replace (dev tool only, not used in normal play)

## Critical Gotchas

(To be populated as bugs are discovered.)

## Hardcoding Risks

| Item | Risk | Fix |
|---|---|---|
| TMDB API shape | Unofficial in spirit, but stable | Watch TMDB changelogs |
| Image base URL `w500` | TMDB may add larger sizes | Update `IMAGE_BASE` in `src/config/constants.js` |
| Hop limit default `6` | Arbitrary | Configurable in settings |
| `/person/popular` for random pair | TMDB's definition of "popular" may shift | Re-test if random pairs feel stale |

## Stretch / Backlog
- Watchlist (per-profile)
- Hint system
- Daily shared puzzle
- Theme switching
- iOS push notifications for "your turn"
