# MLB Tracker — API Reference

External APIs the app talks to, what each is used for, and the rough-edge cases worth remembering. CLAUDE.md keeps a one-line pointer here; the table below is the authoritative status register.

## MLB Stats API (`https://statsapi.mlb.com/api/v1` — `MLB_BASE`; `v1.1` mirror = `MLB_BASE_V1_1`)

| Endpoint | Status | Notes |
|---|---|---|
| `/schedule` | ✅ | Primary source for all game data. `?teamId={id}&hydrate=team,linescore,game` is the common Stats-tab query; the Pulse poller also uses `?sportId=1&date={d}`. |
| `/game/{pk}/linescore` | ✅ | Live and completed games. R/H/E null guards needed for partial-data games. |
| `/game/{pk}/boxscore` | ✅ | Player stats for live and completed games. |
| `/standings` | ✅ | `?leagueId=103,104` covers AL+NL. No season param needed. Returns `runDifferential` as season-aggregate (do not read as last-10). |
| `/teams/{id}/stats` | ✅ | Team-level season totals; `?stats=lastXGames&limitGames=10` for L10 splits. |
| `/teams/{id}/roster` | ✅ | `?rosterType=40Man` includes IL players. **Pass `&date={today}` for current statuses** — without it the API returns season-opening "Active" for everyone (Home Injury Report relies on this). Stats v2 splits roster as `hitting = position.abbreviation !== 'P'` (TWP players are in BOTH lists), `pitching = 'P' || 'TWP'`. |
| `/transactions` | ✅ | `?teamId={id}&startDate=&endDate=` returns roster moves (signings, options, recalls, DFA, IL placements, rehab assignments, trades) with human-readable `description`. Used by Home "Roster Moves" card. Undocumented MLB endpoint — monitor for breakage. |
| `/people/{id}/stats` | ✅ | Individual player stats. Stats v2 caches per-`?stats=` variant: `season`, `seasonAdvanced`, `sabermetrics`, `gameLog`, `lastXGames`, `statSplits&sitCodes=…`, `pitchArsenal`, `hotColdZones`, `yearByYear`. The pitchArsenal payload nests `stat.type.code` and returns `stat.percentage` as a [0,1] fraction (normalize ×100 at fetch time). |
| `/stats/leaders` | ✅ | Requires `statGroup=hitting|pitching` — omitting it mixes hitting/pitching data. `&leaderCategories=…&limit=300` is the percentile-cache query. Canonical category names are `runsBattedIn` / `onBasePlusSlugging` / `walksAndHitsPerInningPitched` / `earnedRunAverage`, NOT `rbi` / `ops` / `whip` / `era`. |
| `/people/{id}/awards` | ⚠️ | Currently unused (Awards module dropped pre-prod in v4.6.21). May 404 for minor leaguers. |
| `/game/{pk}/playByPlay` | ✅ | Completed at-bat log. Returns `allPlays[]`, `scoringPlays[]`, `playsByInning[]`. |
| `/game/{pk}/feed/live` | ⚠️ | **v1 path 404s.** Use `v1.1` (`MLB_BASE_V1_1`). Large payload (~500KB). |
| `/api/v1.1/game/{pk}/feed/live/timestamps` | ✅ | **Pulse only.** Last element = most recent change. Must use `MLB_BASE_V1_1`. |
| `/game/{pk}/content` | ✅ | `highlights.highlights.items[]` with headline, blurb, playbacks[], image.cuts[]. |
| `/game/{pk}/feed/color` | ❌ | Returns 404 for all 2026 games — do not use. |

## External APIs

| Endpoint | Status | Notes |
|---|---|---|
| ESPN News API | ⚠️ | Unofficial, may be CORS-blocked. No fallback source today. |
| YouTube RSS via allorigins.win | ⚠️ | Public proxy, no SLA. 3-attempt retry in place. |
| Baseball Savant (Statcast) | ❌ | Not proxied. Means the Advanced tab (hitters) cannot show xBA / xwOBA / exit velo / barrel rate / sprint speed; the strike-zone heat map (`?stats=hotColdZones`) is what we have via MLB Stats API. |

## Game-state strings

`abstractGameState`: `"Live"`, `"Final"`, `"Preview"`, `"Scheduled"` — both Preview and Scheduled mean upcoming.

`abstractGameState` becomes `"Live"` ~20–30 min before first pitch (warmup) — code excludes `detailedState === 'Warmup'` and `'Pre-Game'` so warmup doesn't render as live.

A `detailedState` of `'Postponed'`, `'Cancelled'`, or `'Suspended'` on a Final game = PPD — shown as grey badge, no score.
