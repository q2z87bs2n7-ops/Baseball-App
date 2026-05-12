# Actor Link Game — Project Plan

## 1. What we're building

A two-player iOS PWA where one player picks two random actors and the other
player has to link them via a chain of co-stars (Six Degrees of Kevin Bacon).
The app validates each hop against TMDB (The Movie Database), tracks scores
across sessions, and supports a watchlist as a stretch feature.

**Players:** two (rotating setter/solver). Designed simple — no auth, just two
named profiles on first launch.

## 2. Gameplay (locked-in rules)

| Decision | Choice |
|---|---|
| Round format | Player A picks two actors → Player B solves solo → swap |
| Link rule | **Movies only.** Filter TMDB credits to `media_type === 'movie'`. Likely exclude documentary self-appearances (`character` is empty or includes "Himself"/"Herself"). |
| Scoring | Track **both** hop count and time per round |
| Hop limit | Soft cap at 6 (configurable in settings); a round above 6 hops can still complete but flags as "over par" |
| Solver UX | Type-ahead autocomplete only (no co-star hint list). Pure typing puzzle. |
| Identity | Two named profiles selected at launch; stored in localStorage. No real auth. |
| Scoreboard | Shared via Upstash Redis under a single key `scoreboard:shared` |
| TMDB key | Server-side only — accessed via `/api/tmdb` Vercel proxy |

### Round flow

1. **Setup screen**
   - Profile picker on first launch (sets `profileId = 'player_a' | 'player_b'`)
   - "Who's setting this round?" toggle each round
2. **Setter picks**
   - Manual: TMDB person search (debounced type-ahead) for Actor A and Actor B
   - Random: `/person/popular` filtered to acting dept + has profile image
   - App runs BFS in background to confirm puzzle is solvable in ≤ N hops; if not (random pair), silently re-roll
3. **Hand-off screen**
   - Big photos of A and B, "Pass to [solver name]"
4. **Solve view**
   - Top-left: Actor A photo (anchor). Top-right: Actor B (target).
   - Center: current chain (horizontal scroll of actor photos with movie posters between them).
   - Bottom: search input + autocomplete dropdown.
   - Each submitted actor → validate shared movie with previous link → on success, animate in the actor + shared movie poster + advance.
   - On failure: shake + reason ("No shared movies between X and Y").
5. **Win**
   - Confetti / animation reveal the full chain.
   - Record `{ setter, solver, actorA, actorB, hops, timeMs, chain, completedAt }` → POST `/api/scoreboard`.
6. **Give up / "Show solution"**
   - Always available. Reveals BFS shortest chain. Round logged as `solved: false`.

## 3. Architecture

### File layout
```
actor-link-game/
├── index.html                      # Skeleton, splash screen, section divs
├── styles.css                      # All styles → dist/styles.min.css
├── sw.js                           # PWA service worker (CACHE rewritten by build)
├── manifest.json                   # PWA manifest
├── build.mjs                       # esbuild driver (bundle + version rewrite)
├── package.json
├── vercel.json
├── api/
│   ├── tmdb.js                     # Server-side TMDB proxy (env: TMDB_READ_TOKEN)
│   └── scoreboard.js               # GET/POST/PUT shared scoreboard (Upstash)
├── src/
│   ├── main.js                     # Boot, section nav, app orchestration
│   ├── state.js                    # Single mutable state container
│   ├── config/
│   │   └── constants.js            # TMDB URLs, image base, hop limit, etc.
│   ├── api/
│   │   └── tmdb.js                 # Client wrapper around /api/tmdb
│   ├── game/
│   │   ├── puzzle.js               # Generate/validate puzzles (random pair logic)
│   │   ├── chain.js                # Active-round chain state + step validation
│   │   └── solver.js               # BFS shortest-chain finder (used for hint + verify)
│   ├── ui/
│   │   ├── nav.js                  # showSection() pattern
│   │   ├── picker.js               # Actor search/autocomplete UI
│   │   ├── play.js                 # Active game view
│   │   ├── scoreboard.js           # Scoreboard + history view
│   │   └── overlays.js             # Actor/movie detail overlays
│   ├── sync/
│   │   └── scoreboard.js           # Redis-backed scoreboard client
│   └── utils/
│       ├── format.js               # Time/date helpers
│       └── debounce.js             # Used heavily by autocomplete
├── icons/                          # PWA icons (placeholders for now)
└── assets/                         # Static images, fonts, etc.
```

### Patterns lifted from baseball-app
- **`build.mjs`** — same esbuild driver pattern (`__APP_VERSION__` define, sw.js + index.html cache-bust rewrite on every build)
- **`src/state.js` single container** — single exported `state` object; importers mutate `state.X`, never reassign their own locals
- **`src/config/constants.js`** — central constants
- **`api/*.js` Vercel pattern** — `export default async function handler(req, res)` with CORS preflight
- **Upstash Redis read/merge/write** — same pattern as `collection-sync.js`; differs in that we only have one shared key, no per-user partition
- **CSS variable theming** — `--primary`, `--card`, `--accent` etc., persisted to localStorage and re-applied inline pre-render to prevent flash
- **Section nav** — `showSection(id, btn)` toggling `.active` class
- **Overlay z-index discipline** — actor and movie detail overlays must live as top-level DOM siblings, never nested in sections (sections create stacking contexts that trap z-index)
- **Allowlist for external image hosts** — TMDB serves images from `image.tmdb.org`; baseball app's `NEWS_IMAGE_HOSTS` pattern works here

### What we deliberately drop from baseball-app
- Auth (no OAuth, no magic link — just two named profiles)
- Push notifications (no use case for v1)
- Demo mode infrastructure (no game-replay scenario)
- Radio system
- All sport-specific modules
- Multi-theme runtime switching (one dark theme is fine; could re-introduce later)

## 4. Data model

### Client state (`src/state.js`)
```js
state.profile = 'player_a' | 'player_b' | null;
state.profileNames = { player_a: '...', player_b: '...' };
state.currentRound = {
  setter: 'player_a',
  solver: 'player_b',
  actorA: { id, name, profile_path },
  actorB: { id, name, profile_path },
  chain: [ { actor, sharedMovie } ],  // ordered, last entry = actor most recently linked
  startedAt: ms,
  hopLimit: 6,
} | null;
state.scoreboard = { rounds: [ ... ], updatedAt };
state.cache = {
  personCredits: Map<personId, { movies: [...], fetchedAt }>,
  movieCast: Map<movieId, { cast: [...], fetchedAt }>,
  personSearch: Map<query, results>,
};
```

### Redis state (`scoreboard:shared`)
```json
{
  "rounds": [
    {
      "id": "uuid",
      "setter": "player_a",
      "solver": "player_b",
      "actorA": { "id": 287, "name": "Brad Pitt" },
      "actorB": { "id": 1245, "name": "Scarlett Johansson" },
      "hops": 2,
      "timeMs": 47000,
      "chain": [ { "actorId": ..., "movieId": ... } ],
      "solved": true,
      "completedAt": "ISO timestamp"
    }
  ],
  "updatedAt": "ISO timestamp"
}
```

Single shared blob (no per-user partition). Read-merge-write pattern.

## 5. TMDB endpoints used

All proxied via `GET /api/tmdb?path=<encoded TMDB path>&...params`.

| TMDB path | Use |
|---|---|
| `/search/person?query=...` | Type-ahead actor search |
| `/person/popular` | Random pair source |
| `/person/{id}/movie_credits` | All movies for an actor (used for chain validation + BFS) |
| `/person/{id}` | Detail overlay |
| `/movie/{id}` | Movie poster + year for chain display |
| `/movie/{id}/credits` | (BFS helper — get cast of a candidate movie) |

**Image base:** `https://image.tmdb.org/t/p/w500` (configurable in `constants.js`).

**Rate limits:** TMDB allows ~50 req/sec. Client-side debounce on search (300ms) and aggressive in-memory caching of `personCredits` keeps us well under.

## 6. BFS solver (`src/game/solver.js`)

Used for:
1. **Pre-validating** that a random puzzle is solvable in ≤ hopLimit
2. **"Show solution"** when the player gives up
3. (Optional) Difficulty hint when generating a random puzzle

**Algorithm:** standard BFS over actor→movie→actor graph.
- Node: actor id
- Edge: shared movie (any single movie they both appeared in)
- Visit order: frontier-by-frontier (depth = number of hops)

**Performance:**
- Each actor's movie list is one TMDB call (`/person/{id}/movie_credits`)
- Each movie's cast is one TMDB call (`/movie/{id}/credits`)
- Cap frontier size (e.g. top 50 cast members per movie ordered by `order` field) to prevent explosion
- Cache aggressively — first-time generation may take 3-5 sec; subsequent puzzles instant

## 7. Build order (recommended phases for next chat)

### Phase 1 — Skeleton boots locally (no API yet)
- `npm install` succeeds, `npm run build` produces `dist/app.bundle.js`
- index.html opens, shows "Hello Actor Link" + section nav working
- Service worker registers, no errors in console

### Phase 2 — TMDB plumbing
- `/api/tmdb` proxy deployed to Vercel with `TMDB_READ_TOKEN` set
- `src/api/tmdb.js` client wraps fetch
- Manually search for "Brad Pitt" and render his face

### Phase 3 — Manual puzzle solve (single-player loop)
- Actor picker UI (search + select for A and B)
- Solve view with one hop validation
- Chain rendering with movie posters between actors
- Win detection

### Phase 4 — BFS + random puzzle
- `solver.js` BFS implementation
- "🎲 Random Pair" button
- Pre-validate puzzle is solvable

### Phase 5 — Multi-player + scoring
- Profile picker
- Round handoff screen with timer
- Hop count + time recording

### Phase 6 — Shared scoreboard
- `/api/scoreboard` Vercel function
- `src/sync/scoreboard.js` client
- Scoreboard + history sections

### Phase 7 — PWA polish
- Real icons (192/512/maskable)
- Splash screen
- iOS install instructions
- Test on actual iPhone

### Phase 8 — Stretch
- Watchlist integration (per-profile, "movies I want to see from puzzles we've played")
- Hint system (reveal one middle actor for time penalty)
- Daily shared puzzle
- Animations / transitions

## 8. Open questions for next chat

These don't block scaffolding but should be settled before each phase:

1. **Phase 3:** When solver enters an actor name, should the autocomplete pre-filter to actors who actually share a movie with the previous link? Could speed up gameplay but might feel like cheating.
2. **Phase 4:** When pre-validating random puzzles, what's the minimum interesting hop distance? Probably 2-3 — a one-hop puzzle is too easy.
3. **Phase 5:** Should the round timer pause during animations / movie reveal? Lean yes.
4. **Phase 6:** Should we keep round history forever, or trim to last N rounds in Redis? Suggest cap at 200.
5. **Phase 7:** App icon design — both actor silhouettes interleaved? Open to ideas.

## 9. Version & branch convention

Mirror baseball-app:
- Bump `package.json` `version` only — build propagates to `sw.js` CACHE + index.html cache-bust
- Use `X.Y.Z`. Develop on `claude/*` branches, increment patch per commit, merge to main bumps minor.
- v1.0.0 ships when Phase 5 is complete; stretch features can ship as 1.1.x, 1.2.x.
