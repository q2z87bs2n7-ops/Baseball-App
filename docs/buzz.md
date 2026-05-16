# MLB Tracker — Baseball Buzz (Pulse social rail)

A Pulse-wide social feed in the side rail: recent posts from a curated set
of baseball Bluesky accounts. Added v4.28.1; redesigned through v4.28.6.
All data is pulled live from the **keyless public Bluesky AT-Protocol
API** — no account, no auth, no API key, CORS-enabled — fetched
**client-side** (the same direct-public-API pattern Pulse already uses for
ESPN/statsapi). **No Vercel serverless function** (keeps us under the
Hobby 12-fn cap; this also dodged the function-slot problem entirely).

Lives below the games module in the Pulse side rail (order: MLB News →
Games → Baseball Buzz). Hidden ≤767px with the rest of the side rail.

## ⚙️ Curated accounts — source of truth (READ FIRST)

`src/config/buzz.js` → `BASEBALL_BUZZ_ACCOUNTS`: an array of
`{ handle, name, tag, category }`.

- `handle` — Bluesky handle (e.g. `mlb.com`, `jayjaffe.bsky.social`).
- `name` — display fallback if the live profile has no displayName.
- `tag` — short context label shown as a pill (team short name for beat
  writers, e.g. "Yankees"; or "Insider", "Analytics", …).
- `category` — drives the pill's coloured dot only: `league` / `rumors` /
  `analytics` / `insider` / `team` / `scouting`.

~15 core accounts (MLB, FanGraphs + writers, Baseball Prospectus, Baseball
America, Rosenthal/Passan/Stark/Law, Sarah Langs, Codify) + one beat
writer per all 30 clubs.

**HARDCODING RISK:** handles were hand-curated and **NOT live-verified**
at authoring (no network in the build env). A wrong/renamed handle simply
yields no posts — the feed degrades gracefully, never throws. Prefer
domain handles (impersonation-proof). Re-verify each offseason (Nov–Feb)
against `https://public.api.bsky.app`, mirroring the ESPN-ID / radio /
podcast re-verify convention. Tracked in CLAUDE.md "Hardcoding Risks".

## Data flow

```
initReal()                                  src/main.js
  ├─ loadBaseballBuzz()           (first nav — cache allowed)
  └─ setInterval(() => loadBaseballBuzz(true), TIMING.BUZZ_REFRESH_MS)
loadBaseballBuzz(force)                      src/pulse/baseball-buzz.js
  ├─ !force: fresh localStorage cache (≤2 min)? → render, return
  ├─ Promise.allSettled( fetchAccount × ~45 )
  │     GET public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed
  │         ?actor=<handle>&limit=6&filter=posts_no_replies
  │     drop reposts (item.reason) + replies (record.reply)
  │     keep posts with createdAt within ~31 days
  ├─ merge → sort newest-first → cap 10 → cache (mlb_buzz_cache_v2)
  └─ renderBaseballBuzz()  → #sideRailBuzz
```

Per post captured: `name, handle, tag, category, avatar`
(`post.author.avatar`), `embedImage` (first `app.bsky.embed.images#view`
thumb only — link previews / quote posts ignored), `text`, `ts`, and a
`bsky.app/profile/<handle>/post/<rkey>` permalink.

## Refresh cadence

- `TIMING.BUZZ_REFRESH_MS = 120000` → **fresh pull every 2 min** while
  Pulse is open (timer set once in `initReal`, never paused).
- The scheduled tick passes `force=true` and **bypasses the cache**, so
  the timer is the true cadence. `CACHE_TTL_MS = 120000` only makes the
  *first* open / a reload within 2 min free (localStorage, cross-tab).
  (Earlier the TTL equalled the interval and the cache was written a few
  seconds late, so every other tick was a no-op → effective ~20 min;
  force-fetch fixed that.)
- Cost: each pull = ~45 keyless `getAuthorFeed` requests from the browser
  (~45 req / 2 min) — well within Bluesky's per-IP budget. No multi-author
  endpoint exists without a Bluesky List (which needs an account), so the
  fan-out is inherent.

## Rendering

Header-row card (one line: avatar → name → category pill → relative time),
then **full-width post text** below (reclaims the space under the 28px
avatar; text clamps 8 lines, 5 with an embed), then optional 16:9 image
embed. Whole card is an `<a target="_blank" rel="noopener noreferrer">` to
the post. Section header + bordered list + "via Bluesky" footer match the
side-rail "games" module (`.side-rail-section-title`, `var(--p-border)`
row dividers). Loading / empty / error states render `.buzz-empty` (no
footer). All text escaped via `escapeNewsHtml`.

**Images:** avatars + embeds are gated through `isSafeNewsImage()`;
`bsky.app` was added to `NEWS_IMAGE_HOSTS` so `cdn.bsky.app` is allowed.
This preserves the firewall-safety invariant (the Check Point UserCheck
gotcha) — a blocked avatar just falls back to initials. Avatar fallback is
a layered span+img (img self-removes on error), not inline-JS `onerror`.

## Gotchas

- **Curated handles unverified.** Real behaviour (which accounts resolve,
  payload field names) can only be confirmed on a deployed/preview build —
  the build/CI env can't reach `public.api.bsky.app` (same block that hit
  iTunes for podcasts). Feed degrades gracefully if handles are wrong.
- **No Bluesky List / Starter Pack.** Creating a List needs a Bluesky
  account; consuming a third-party Starter Pack's list drifts in
  membership. We fan out per-handle instead and own the curation.
- **Pulse-wide, not per-team.** No team-lens filter (the All/My-team/
  Insiders chips from the v2 handoff were removed at v4.28.5 as unneeded).
- **Client-side only.** Unlike the podcast/news proxies there is no
  `/api/*` function — changing this feature does not need a `main` deploy
  of a serverless function; a static build (incl. GitHub Pages preview)
  fully exercises it.
