# Hardcoding Risks

> Extracted from CLAUDE.md. See CLAUDE.md "Hardcoding Risks" for the summary.

Hand-curated constants and unofficial endpoints that need periodic re-verification. Treat the offseason as the default re-verify checkpoint unless a row says otherwise.

| Item | Risk | Fix |
|---|---|---|
| `SEASON = 2026` | Must update each season | Derive from system date or MLB API |
| Team colours in TEAMS array | Teams rebrand | Verify each offseason |
| ESPN team IDs | Different system from MLB IDs | Verified Apr 2026 — re-verify each offseason |
| `WC_SPOTS = 3` | Rule change risk | Already a named const |
| ESPN API endpoint | Unofficial, undocumented | Monitor for breakage |
| MLB Stats API base URL | Unofficial | Watch for deprecation |
| Leaders `cats` array order | Index-based mapping — order matters | Re-test empirically if results look wrong |
| allorigins.win proxy URL | Free public proxy, no SLA | Swap URL if it goes down; retry logic in place |
| YouTube channel IDs (`youtubeUC`) | Teams may rebrand/change channels | Verify each offseason |
| Game state strings | MLB uses both `"Preview"` and `"Scheduled"` | Both checked — verify if new states appear |
| `MLB_TEAM_RADIO` URLs | radio.net-sourced; stations may change CDNs | Re-run 🔍 Radio Check sweep periodically |
| `APPROVED_RADIO_TEAM_IDS` Set | Hand-curated — last updated 2026-05-06 | Update Set when sweep results change |
| `TEAM_PODCASTS` collectionIds (`src/config/podcasts.js`) | Hand-curated Apple Podcasts ids — last curated 2026-05-16; shows go inactive / rebrand | Re-verify each offseason: drop shows inactive >1 month, refresh ids. Stale curated shows are auto-hidden at runtime (last-month filter) and backfilled from iTunes search |
| Hls.js CDN URL | `cdn.jsdelivr.net/npm/hls.js@1.5.18` — pinned, free CDN | Bundle locally if CDN unreliable |
| `NEWS_IMAGE_HOSTS` allowlist | Hand-curated CDN domain list — thumbnails silently fall back to placeholder if CDN changes (now incl. `bsky.app` for Buzz avatars/embeds) | Add new hostname to `NEWS_IMAGE_HOSTS` regex in `src/utils/news.js` |
| `BASEBALL_BUZZ_ACCOUNTS` handles (`src/config/buzz.js`) | Hand-curated Bluesky handles — last live-verified 2026-05-17 via buzz-check dev tool; 9 teams have no active beat writer (Yankees, Rays, Tigers, Braves, Marlins, Cardinals, Pirates, Rockies, Diamondbacks); accounts churn/rename | Re-verify each offseason vs `public.api.bsky.app`. A wrong handle silently yields no posts (feed degrades gracefully); prefer domain handles; replace stale entries when writers move outlets |
