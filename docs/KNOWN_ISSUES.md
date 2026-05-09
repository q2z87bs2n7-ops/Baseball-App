# Known Issues

Project-management issues tracked here. **Critical Gotchas** (subtle bugs that could be silently re-introduced — referenced from CLAUDE.md) are listed at the bottom of this file.

---

1. **News fallback** — if ESPN API is CORS-blocked, no fallback source. MLB RSS was considered but not yet implemented.

2. **`/stats/leaders` ~100-cap on qualified pool** — the leader-board endpoint server-caps the per-category response at ~100 entries even with `limit=300`. v4.8.4 attempted to bypass via `/stats?stats=season&playerPool=Qualifier` but the new query returned empty splits in production (param-naming mismatch suspected — `group` vs `statGroup`, `Qualifier` vs `Qualified`) — reverted in v4.8.8. Mitigation in v4.8.11: when a player's value never beats nor ties any leader (`computePercentile` returns `outsideTop=true`), the renderer skips the rank caption + bar entirely so the dead-last fallback (`#100 of 100`) doesn't render misleadingly. Open: probe the correct `/stats?` parameter shape on a live API call before re-attempting a bigger pool.

3. **allorigins.win proxy** — no SLA, free service. Retry logic (3 attempts, 1s gap) mitigates failures but a paid or self-hosted proxy would be more reliable.

4. **YouTube channel IDs** — All 30 teams + MLB fallback verified as of v3.38.11 (May 2026). Re-verify each offseason if teams rebrand or change channels. Root cause of prior failures: 13 teams were using YouTube TV IDs (no RSS) instead of official team channels. Fixed by scraping official team pages.

5. **Hls.js CDN dependency** — `hls.light.min.js@1.5.18` loaded from `cdn.jsdelivr.net` (not stored in repo, not in `sw.js` SHELL cache). If the CDN goes down, all `format:'hls'` radio streams break in non-Safari browsers; Safari users keep working via native HLS. Worth bundling locally if the CDN ever becomes unreliable.

6. **News image allowlist (`NEWS_IMAGE_HOSTS`)** — added v3.34.17 to prevent browser requests to unexpected RSS thumbnail domains (e.g. `jotcast.com` podcast avatars) triggering corporate firewalls (Check Point UserCheck). Side effect: if a legitimate news source (CBS, FanGraphs, MLB Trade Rumors) serves images from a CDN domain not in the allowlist, those thumbnails silently show the source icon placeholder instead. Allowlist is in `src/utils/news.js` alongside `isSafeNewsImage()`. If thumbnails go missing after a source changes CDN, add the new hostname to `NEWS_IMAGE_HOSTS`.

7. **Card binder scroll on desktop** — `#collectionBook` uses `max-height:90vh` (not an explicit `height`), so `.cc-binder{height:100%}` resolves against content height and the flex chain has no definite reference; `.cc-page` overflows when `.cc-grid{min-height:600px}` + 44px padding exceeds available space. Proposed fix: change `#collectionBook` to `height:min(96vh,920px)` + widen `max-width:960px` → `1200px` + drop `min-height:600px` from `.cc-grid`. Needs visual QA — a previous attempt was reverted due to look/feel concerns.

8. **Switch cron trigger** — GitHub Actions scheduled workflows are unreliable on free tier (fires ~once per hour in practice vs every 5 min as configured), making game-start alerts miss most windows. Vercel Cron (`vercel.json`) would be more reliable as it runs on the same infra as the notify function.

---

## ⚠️ Critical Gotchas (referenced from CLAUDE.md)

These are bugs the AI editor could silently re-introduce. CLAUDE.md keeps a 1-line summary; full descriptions live here.

### 1. Date strings use local time
All `startDate` / `endDate` query params are built from `getFullYear` / `getMonth` / `getDate` (local). Avoid `toISOString().split('T')[0]` for date params — it returns UTC and will be one day ahead after ~8 PM ET, causing games to be skipped (fixed v1.45.5). `api/notify.js` intentionally uses UTC since it runs on Vercel servers.

The Calendar `gameByDate` key also uses local timezone (fixed v1.61) — previously used `gameDate.split('T')[0]` (UTC), placing evening US games on the wrong calendar cell.

Use the helpers in `src/utils/format.js`: `etDateStr(d?)` returns the ET-local YYYY-MM-DD; `etDatePlus(dateStr, days)` shifts by N days. Used by Stats v3's last-10 run-diff fetch (v4.6.23) and many other places.

### 2. Audacy radio rights gap
~14 MLB market flagships hosted by Audacy (`live.amperwave.net/manifest/audacy-*`) play alternate content during games (talk shows / ads), not OTA simulcast. Adding an Audacy-hosted team to `APPROVED_RADIO_TEAM_IDS` will silently stream ads.

Fix requires sourcing replacement URLs from iHeart / StreamTheWorld / Bonneville. See `docs/radio-system.md` → Audacy rights gap.
