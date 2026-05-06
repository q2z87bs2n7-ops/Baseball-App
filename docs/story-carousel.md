# MLB Tracker — Story Carousel

A rotating single-card digest layer surfacing high-level game narratives alongside the play-by-play feed in the ⚡ Pulse section. Not filtered by user's active team — league-wide stories only. Auto-rotates every 4.5s (configurable via `devTuning.rotateMs`) with manual prev/next controls.

## HTML structure

- `#storyCarousel` — Container below `#gameTicker`, above `#mockBar`
- `#storyCard` — Single story card with badge, icon, headline, sub
- `.story-controls` — Manual prev/next buttons and progress dots

**Pool sort order (v2.59):** `storyPool` is sorted by `priority` descending after each `buildStoryPool()` call. Manual ‹ › navigation and dots reflect this ranked order. Auto-rotation still uses the `priority × decay` scoring algorithm independently.

**Nav buttons (v2.59):** Edge-mounted `position:absolute` ghost buttons on `.story-card-wrap` — borderless, 45% opacity muted chevrons that fade to full on hover.

## Story object shape

```javascript
{
  id: string,           // Unique per story type: "hr_gamePk_playCount", "nohit_gamePk", etc.
  type: string,         // Category: 'realtime', 'game_status', 'daily_stat', 'historical', 'contextual', 'yesterday'
  tier: 1|2|3|4,        // Priority tier — determines display color and lifecycle
  priority: number,     // Base priority 1–100; combined with decay for final score
  icon: string,         // Emoji icon (💥, 🔥, 🏆, etc.)
  headline: string,     // Main text: "Ohtani homers (8) — LAD lead 3-1"
  sub: string,          // Context: "LAD @ SF · ▼5th"
  badge: string,        // 'LIVE', 'TODAY', 'YESTERDAY', 'ON THIS DAY', 'UPCOMING'
  gamePk: number|null,  // Associated game or null for league-wide stories
  ts: Date,             // When story occurred (for age calculation and sorting)
  lastShown: Date|null, // Last display time; null = never shown
  cooldownMs: number,   // Min milliseconds before re-display (1–60 min)
  decayRate: number,    // Fraction lost per 30-minute window (0.05–0.90)
}
```

## Story tiers and lifecycle

| Tier | Type | Examples | Cooldown | Decay/30m | Notes |
|---|---|---|---|---|---|
| 1 | `realtime` | Home run | 5 min | 50% | New story per HR; playCount dedup |
| 1 | `realtime` | No-hitter watch (inning ≥6, 0 hits) | 2 min | 20% | One per game; removed when hit occurs |
| 1 | `realtime` | Walk-off threat (9th+, winning run at bat: deficit ≤ runners+1) | 5 min | 90% | One per inning; fires when winning run is at the plate |
| 1 | `realtime` | Big inning (3+ scoring plays in sequence) | 10 min | 40% | One per inning-half |
| 1 | `realtime` | Steal of home | 5 min | 70% | Tier-1 elevated; one per play (stable atBatIndex key) |
| 2 | `realtime` | Stolen base (2B or 3B) | 5 min | 70% | One per steal; `isHistory` guard — live events only |
| 2 | `game_status` | Final score + comeback label | 15 min | 30% | One per game (stable ID) |
| 2 | `game_status` | Win/loss streak ≥3 games | 20 min | 10% | Checks all 30 teams in scheduleData |
| 3 | `daily_stat` | Multi-hit day (≥3 hits or ≥2 hits+1 HR) | 15 min | 10% | One per batter per day; tracks `dailyHitsTracker` |
| 3 | `daily_stat` | Daily leaders — top 3 per stat | 30 min | — | HR/RBI/H (hitting); K/SV (pitching); weighted priority [1.0, 0.7, 0.45] |
| 3 | `daily_stat` | Pitcher gem (≥8 Ks in-progress) | 10 min | 20% | One per pitcher per game |
| 4 | `historical` | On This Day (same date, last 3 seasons) | 60 min | 50% | Loaded once at Pulse init |
| 4 | `contextual` | Yesterday's game highlights | 30 min | 30% | Loaded once at Pulse init; naturally deprioritised when live games exist |
| 4 | `contextual` | Probable pitchers for today (all teams) | 60 min | 5% | Format: "PitcherName [ABR] vs PitcherName [ABR]" |

## Story generators (15 total, called each poll)

1. **`genHRStories()`** — Source: `feedItems`. Groups HR plays by `batterId` so multi-homer games collapse. **Single HR:** ID `hr_{gamePk}_{ts}`, past-tense headline "Player hit a [Xft] homer off Pitcher in the Nth inning (HR #N this season)"; distance from `item.data.distance`. **Multi-homer:** ID `hr_multi_{batterId}_{gamePk}_{count}`, priority +15 per additional HR; original single-HR story auto-drops. Sub-line: stats from `hrBatterStatsCache` → `statsCache` fallback. Priority: 100 (single), 115+ (multi). Cooldown: 5 min.

2. **`genNoHitterWatch()`** — Source: `gameStates`. Detects: `status === 'Live'` AND `away.hits === 0 || home.hits === 0` AND `inning >= 6`. ID: `nohit_{gamePk}`. Priority: 95. Cooldown: 2 min. Removed when a hit occurs.

3. **`genWalkOffThreat()`** — Source: `gameStates`. Detects: `halfInning === 'bottom'` AND `inning >= 9` AND deficit ≤ runnersOn + 1. Does NOT fire when home leading or trailing more than runners+1 can cover. ID: `walkoff_{gamePk}_{inning}` (per-inning). Priority: 90. Cooldown: 5 min, 90% decay.

4. **`genBasesLoaded()`** — Source: `gameStates`. Detects: `status === 'Live'` AND `onFirst && onSecond && onThird`. Any inning, any half. ID: `basesloaded_{gamePk}_{inning}_{halfInning}`. Headline: "Bases loaded — [batting team] batting in the Nth". Priority: 88. Cooldown: 3 min. Decay: 80%.

5. **`genStolenBaseStories()`** — Source: `stolenBaseEvents[]` (populated by `pollGamePlays` for live steals only — `isHistory` guard). Runner extracted from `play.runners[].details` (`eventType: 'stolen_base_*'`). **Regular steal:** tier-2, priority 55, icon 💨. **Steal of home:** tier-1, priority 85, icon 🏃. ID: `sb_{gamePk}_{atBatIndex}`. Cooldown: 5 min. Decay: 70%.

6. **`genBigInning()`** — Source: `feedItems` (3+ consecutive scoring plays in same inning/half). ID: `biginning_{gamePk}_{inning}_{half}`. Priority: 75. Cooldown: 10 min. Card gets `.story-biginning` CSS class (crimson background).

7. **`genFinalScoreStories()`** — Source: `gameStates` where `status === 'Final'`. Adds "comeback" label if trailing by 3+ after 5th. ID: `final_{gamePk}` (stable). Priority: 80. Cooldown: 15 min.

8. **`genStreakStories()`** — Source: `scheduleData` (all teams). Fires when streak ≥3. ID: `streak_{teamId}_{streakLength}`. Priority: 60. Cooldown: 20 min.

9. **`genMultiHitDay()`** — Source: `feedItems`. Threshold: ≥3 hits OR ≥2 hits + 1 HR. Uses `dailyHitsTracker`. ID: `multihit_{batterId}_{date}`. Priority: 55. Cooldown: 15 min per player.

10. **`genDailyLeaders()`** — Source: `/stats/leaders` (fresh fetch every 5 min, cached in `dailyLeadersCache`). Covers: HR, AVG, RBI, SB (hitting); Wins, SV (pitching). Top 5 per category. ID: `leader_{stat}_{date}`. Cooldown: 30 min.

11. **`genPitcherGem()`** — Source: `feedItems` + linescore. Detects ≥8 Ks in progress. Uses `dailyPitcherKs`. ID: `kgem_{gamePk}_{pitcherId}`. Priority: 58. Cooldown: 10 min.

12. **`genOnThisDay()`** — Source: `/schedule?date={MM/DD, 3-year lookback}&season={year}&hydrate=linescore,boxscore,playByPlay` (once at Pulse init). Extracts top batter, starting pitcher, multi-HR hitters, walk-offs, grand slams, no-hitters. ID: `otd_{year}_{gamePk}`. Priority: 20. Cooldown: 60 min.

13. **`genYesterdayHighlights()`** — Source: `/schedule?date={yesterday}&hydrate=linescore,boxscore` (once at Pulse init). Filters Final games (excludes PPD/Cancelled/Suspended). **Headline:** uses MLB video title from `/game/{pk}/content` `items[0].headline` when available; falls back to generated "Yesterday: NYM 5, PHI 2 · W: deGrom…". Priority: 45. Cooldown: 30 min. Shown prominently when <2 live games.

14. **`genProbablePitchers()`** — Source: `scheduleData` (today) OR `gameStates` fallback. Filters: `abstractGameState !== 'Final'` AND `localDate === today`. ID: `probable_{gamePk}`. Headline: "Scherzer [NYM] vs Kershaw [LAD] · 7:05 PM". Priority: 40. Cooldown: 60 min.

15. **`genInningRecapStories()`** — One-shot end-of-inning narrative summaries. Fires exactly once per half-inning. **Primary path (v2.59):** processes `inningRecapsPending{}` keys queued by `pollGamePlays()` at `outs===3`. **Fallback path:** `lastInningState` linescore transition detection. `inningRecapsFired` Set deduplicates across both paths. 19 templates with priorities 0–100. Tier-2, no cooldown/decay. **Run calculation (v3.38):** uses actual run differential (final score minus starting score) instead of counting scoring plays — a grand slam counts as 4 runs, not 1.

### Inning recap templates (priority order)
HR+runs (100) > perfect K (95) > multi-run (90) > clawback (85) > stranded runners (80) > shutout+Ks (75) > DP escape (70) > walk-heavy (65) > error-led (55) > single run (45) > 1-2-3+Ks (40) > 1-2-3 (25) > fallback (0)

**Clawback (priority 85, v3.38):** fires when: (1) team scored ≥1 run with RISP (runners in scoring position), AND (2) team is trailing or tied before the run(s) score. Prevents "claw back" messages from appearing when a team already leading adds to their advantage.

### Inning Recap console debugging (v2.46+)
```javascript
// Check current state
Object.entries(gameStates).filter(([pk,g])=>g.status==='Live').forEach(([pk,g])=>console.log(`${g.awayAbbr} @ ${g.homeAbbr} · ${ordinal(g.inning)} ${g.halfInning} (${g.outs} outs)`));
console.log('lastInningState:', lastInningState);
console.log('inningRecapsFired:', Array.from(inningRecapsFired));

// Manually advance inning (first live game)
var pk=Object.keys(gameStates).find(k=>gameStates[k].status==='Live');
var g=gameStates[pk];
g.halfInning==='top'?g.halfInning='bottom':({g.inning++, g.halfInning='top'}); g.outs=0;
await buildStoryPool();

// Check recaps in pool
storyPool.filter(s=>s.type==='inning_recap').forEach(s=>console.log(`${s.priority}: ${s.headline}`));

// Reset & retry
inningRecapsFired.clear(); await buildStoryPool();
```

## Rotation engine

```javascript
// Rotation interval read from devTuning.rotateMs (default 4500ms)
function rotateStory() {
  const now = Date.now();
  // Cap effective cooldown relative to pool size so pre-game thin pools
  // don't lock cards out for their full nominal cooldown. Floor: 2 minutes.
  const maxCooldown = Math.max(storyPool.length * devTuning.rotateMs * 1.5, 2 * 60_000);

  // Eligible = effective cooldown expired OR never shown
  let eligible = storyPool.filter(s =>
    !s.lastShown || (now - s.lastShown.getTime()) > Math.min(s.cooldownMs, maxCooldown)
  );
  // Fallback: if nothing eligible, pick least-recently-shown
  if (!eligible.length) {
    eligible = [...storyPool].sort((a,b) => (a.lastShown?.getTime()||0) - (b.lastShown?.getTime()||0));
  }
  if (!eligible.length) return;

  // Score: priority × decay^(ageMinutes / 30)
  const scored = eligible.map(s => {
    const ageMin = (now - s.ts.getTime()) / 60_000;
    const decay = Math.pow(1 - s.decayRate, ageMin / 30);
    return { s, score: s.priority * decay };
  });
  scored.sort((a,b) => b.score - a.score);
  showStoryCard(scored[0].s);
}
```

## Pool builder (`buildStoryPool`)

Called at end of every `pollLeaguePulse()` (every 15s). Generates fresh stories from all 15 generators, merges with existing pool (preserving `lastShown` timestamps), drops stale ones (e.g. walk-offs that resolved). Inning recaps are one-shot per inning and tracked separately via `inningRecapsFired` Set.

## Data refresh schedule

| Data | Interval | Method | Cache key |
|---|---|---|---|
| Story pool rebuild | Every 15s (Pulse poll) | `buildStoryPool()` at end of `pollLeaguePulse()` | `storyPool` array |
| Daily leaders | Every 5 min | Separate timer in `initReal()` | `dailyLeadersCache` |
| Yesterday cache | Once at Pulse init | `loadYesterdayCache()` | `yesterdayCache` array |
| On This Day cache | Once at Pulse init | `loadOnThisDayCache()` (3 API calls) | `onThisDayCache` array |
| Story rotation | Every 4.5s | `storyRotateTimer` interval | `storyShownId` |
| Daily hit tracker | Reset daily (implicit) | Incremented in `pollGamePlays()` | `dailyHitsTracker` |
| Daily pitcher K tracker | Reset daily (implicit) | Incremented in `pollGamePlays()` | `dailyPitcherKs` |
| Stolen base events | Reset on mode switch | Populated in `pollGamePlays()` for live steals only | `stolenBaseEvents` |

## Page Visibility API integration

```javascript
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    clearInterval(storyRotateTimer);
    storyRotateTimer = null;
  } else if (pulseInitialized) {
    rotateStory();  // Immediately refresh on tab return
    storyRotateTimer = setInterval(rotateStory, devTuning.rotateMs);
  }
});
```

## Early-day / sole-game handling

Pool composition adapts naturally:
- **Pre-game:** Probable Pitchers + Yesterday + On This Day dominate
- **Mid-day:** HR, no-hitter, walk-off, big inning dominate
- **Late day:** Final scores, multi-hit, streaks dominate

No explicit "mode" needed — the priority + decay math handles adaptation automatically.
