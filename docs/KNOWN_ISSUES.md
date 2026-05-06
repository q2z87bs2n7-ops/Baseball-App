# Known Issues

Project-management issues tracked here. For AI editing gotchas (bugs that could be silently re-introduced), see the "⚠️ Critical Gotchas" section in `CLAUDE.md`.

---

1. **News fallback** — if ESPN API is CORS-blocked, no fallback source. MLB RSS was considered but not yet implemented.

2. **Around the League leaders index mapping** — empirically derived, fragile. The API does not guarantee response order matches requested `leaderCategories` order; app uses index-based mapping. Re-test each position empirically if results look wrong after an API change.

3. **allorigins.win proxy** — no SLA, free service. Retry logic (3 attempts, 1s gap) mitigates failures but a paid or self-hosted proxy would be more reliable.

4. **YouTube channel IDs** — 27 of 30 `youtubeUC` values unverified. QC needed each offseason; teams may rebrand or change channels.

5. **Hls.js CDN dependency** — `hls.light.min.js@1.5.18` loaded from `cdn.jsdelivr.net` (not stored in repo, not in `sw.js` SHELL cache). If the CDN goes down, all `format:'hls'` radio streams break in non-Safari browsers; Safari users keep working via native HLS. Worth bundling locally if the CDN ever becomes unreliable.

6. **News image allowlist (`NEWS_IMAGE_HOSTS`)** — added v3.34.17 to prevent browser requests to unexpected RSS thumbnail domains (e.g. `jotcast.com` podcast avatars) triggering corporate firewalls (Check Point UserCheck). Side effect: if a legitimate news source (CBS, FanGraphs, MLB Trade Rumors) serves images from a CDN domain not in the allowlist, those thumbnails silently show the source icon placeholder instead. Allowlist is in `app.js` alongside `isSafeNewsImage()`. If thumbnails go missing after a source changes CDN, add the new hostname to `NEWS_IMAGE_HOSTS`.

7. **Card binder scroll on desktop** — `#collectionBook` uses `max-height:90vh` (not an explicit `height`), so `.cc-binder{height:100%}` resolves against content height and the flex chain has no definite reference; `.cc-page` overflows when `.cc-grid{min-height:600px}` + 44px padding exceeds available space. Proposed fix: change `#collectionBook` to `height:min(96vh,920px)` + widen `max-width:960px` → `1200px` + drop `min-height:600px` from `.cc-grid`. Needs visual QA — a previous attempt was reverted due to look/feel concerns.

8. **"Game underway!" feed ordering** — status items for games transitioning to In Progress appear near the top of the newest-first feed instead of being anchored to the game's scheduled start time. Root cause likely `gameDateMs` null/stale or else-branch `playTime` missing. Deferred — data usage too high to investigate further.

9. **Switch cron trigger** — GitHub Actions scheduled workflows are unreliable on free tier (fires ~once per hour in practice vs every 5 min as configured), making game-start alerts miss most windows. Vercel Cron (`vercel.json`) would be more reliable as it runs on the same infra as the notify function.
