# MLB Tracker — Team Podcasts Strip

Home-screen horizontal strip of team-podcast show icons with an inline
audio player, sitting directly **above** the YouTube widget. Added v4.22.1.
All data is pulled live from the public **iTunes / Apple Podcasts API**
(no key required) via a server-side proxy. Audio-only — podcast episode
enclosures are plain public MP3 URLs, played in a native `<audio>` element.

## ⚙️ Curated shows — source of truth (READ FIRST)

Curated, vetted shows live in one place: `src/config/podcasts.js`.

```javascript
// src/config/podcasts.js — keyed by MLB team id; numeric id = iTunes collectionId
export const TEAM_PODCASTS = {
  121: [ { name: 'The Mets Pod', id: 258864037 }, /* … up to 5 */ ],
  /* … 9 more priority teams … */
};
export function fallbackPodcastTerm(teamName) { return teamName + ' podcast'; }
```

- The numeric `id` is the Apple Podcasts **`collectionId`** (the digits in a
  `podcasts.apple.com/.../id<NUMBER>` URL). It is the stable join key — it
  survives feed/CDN rotation, unlike a hardcoded RSS `feedUrl` (which is why
  we never hardcode feed URLs).
- Teams **not** in `TEAM_PODCASTS` have no curated list; they rely entirely
  on the iTunes search-by-term path (`fallbackPodcastTerm`).
- Curated teams **also** use the search term, as a backfill source (see
  Freshness & fill below).

**To curate/maintain (offseason, Nov–Feb):** find shows on Apple Podcasts,
take the `id<NUMBER>` from the URL, add `{ name, id }` (max 5 per team),
bump the comment date, bump app version + `sw.js` CACHE. Drop shows with no
episode in the trailing month — but note stale shows are *also* auto-hidden
at runtime, so curation rot degrades gracefully rather than showing dead
shows. Tracked in CLAUDE.md "Hardcoding Risks".

## Data flow

```
loadHomePodcastWidget()                       src/sections/home.js
  └─ GET {API_BASE}/api/proxy-podcast
        ?term=<Full Team Name> podcast         (always)
        [&ids=<curated collectionIds>]         (curated teams only)
  └─ api/proxy-podcast.js  (Vercel serverless)
        1. resolveShow(id) for each curated id  ── iTunes lookup
        2. if < 8 fresh and term: iTunes search ── resolveShow() each hit
        3. filter to last-month, sort newest-first, cap 8
  └─ renderPodcastStrip()  → icon strip
  └─ playPodcast(id)       → inline <audio> (latest episode)
```

`resolveShow(collectionId)` calls
`itunes.apple.com/lookup?id=<id>&entity=podcastEpisode` — one call returns
the show (artwork via `artworkUrl600`) **and** its recent episodes; the
newest episode with an `episodeUrl` supplies the playable audio + release
timestamp. Uncurated teams use
`itunes.apple.com/search?term=<term>&media=podcast&entity=podcast`.

## Freshness & fill rules (server-side, `api/proxy-podcast.js`)

- **Last-month only:** a show is kept only if its latest episode's release
  date is within `FRESH_MS` (~31 days). Applied to curated and search hits.
- **Newest first:** final list sorted by latest-episode timestamp desc.
- **Up to 8:** `MAX_SHOWS = 8`.
- **Stale curated → API fill:** curated ids resolve first; stale ones are
  silently dropped; the iTunes search then backfills toward 8, deduped by
  `collectionId`.
- **Never relax the bar:** if fewer than 8 shows have a fresh episode, fewer
  are returned (0 → `{success:false, message:"No podcasts updated in the
  last month"}`). The freshness filter is never loosened to pad the count.

## Caching

Edge cache `s-maxage=21600` (6h) + `stale-while-revalidate=86400` (1d).
Deliberately shorter than a static feed: the last-month window and
newest-first sort are **time-relative**, so a multi-day cache would serve
results that have drifted out of the window or out of order. 6h still
comfortably shields the iTunes ~20 req/min unauthenticated rate limit
(shared across all clients via the edge).

## Functions (`src/sections/home.js`)

| Function | Role |
|---|---|
| `loadHomePodcastWidget()` | Builds team-colored header, computes `?term`/`&ids`, fetches `/api/proxy-podcast`, fills `podcastShows[]`, renders strip. Reloads on team switch via `themeCallbacks.loadHomePodcastWidget`. |
| `renderPodcastStrip()` | Renders the horizontal icon row; marks the playing show. |
| `playPodcast(collectionId)` | `stopAllMedia('podcast')`, then plays that show's latest episode in `#homePodcastAudio`; re-renders strip. Exposed on `window`. |
| `stopPodcast()` | Pauses the inline `<audio>`. Called by `stopAllMedia` (radio/engine.js) when radio/YouTube/highlight start. Exposed on `window`. |

DOM: `#homePodcastWidget` → `#homePodcastHeader` + `.podcast-body`
(`#homePodcastStrip` + `#homePodcastPlayer`). Styles: `.podcast-*` in
`styles.css` (icon strip is horizontal-scroll; stacks under YouTube on
mobile). Wired in `src/main.js` (import, `setThemeCallbacks`, boot
sequence before `loadHomeYoutubeWidget()`, `window` exports) and
`src/ui/theme.js` (`switchTeam` reload).

## Gotchas

- **Needs the proxy deployed to the API host.** The frontend always calls
  `API_BASE` (production Vercel = `main`). A new/changed `api/proxy-podcast.js`
  only on a `claude/` branch is unreachable until merged to `main` — the
  strip shows "Could not load podcasts: Load failed" until then.
- **Vercel Hobby = 12 serverless functions max.** Adding this proxy hit the
  cap; `api/collection/reset.js` was consolidated into `collection-sync.js`
  (DELETE) at v4.23.1 to free a slot. Keep this in mind before adding more
  `api/*` functions.
- **iTunes is unreachable from some sandboxes** (host allowlist). The proxy
  works from Vercel; local/CI may not be able to integration-test it.
- **Audio vs. video.** Podcasts are audio-only — the player is `<audio>`,
  not the YouTube iframe. `stopAllMedia` treats `'podcast'` as its own
  channel so radio/YouTube/podcast never overlap.
