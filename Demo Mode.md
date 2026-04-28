# Demo Mode — Implementation Status & Next Steps

## Current Architecture (v2.27.8–v2.27.9)

### How It Currently Works

**Data Flow Chain:**
1. **localStorage Snapshot Path** (Primary if available)
   - `initDemo()` checks `localStorage.getItem('mlb_demo_snapshot')`
   - If found, loads all state directly (gameStates, feedItems, caches, scheduleData)
   - Reconstructs `demoPlayQueue` from `feedItems` array
   - **Source:** User-exported live Pulse state via `exportPulseStateAsSnapshot()` button in Settings

2. **Live API Path** (Fallback if no snapshot)
   - `loadDemoGames()` fetches `/schedule` from past 7 days looking for Final games
   - `buildDemoPlayQueue(games)` then fetches `/game/{pk}/playByPlay` for **each game individually**
   - Extracts plays and builds queue with API playByPlay data
   - **Risk:** 7+ sequential HTTP requests; if any fail, partial data

3. **Hardcoded Backup Path** (Currently unused)
   - `DEMO_BACKUP_GAMES` constant at line 993 (empty array)
   - Would be used if both above paths fail

### Playback Mechanism
- `pollDemoFeeds()` iterates through `demoPlayQueue` at 10-second intervals
- `advanceDemoPlay(play)` updates gameState and adds item to `feedItems`
- Feed renders in real-time as plays advance

### What Gets Captured in Snapshot
Function `exportPulseStateAsSnapshot()` (line 1394) captures:
```javascript
{
  metadata: { exportedAt, season },
  gameStates: {},           // All game state objects
  feedItems: [],            // All feed items with timestamps
  dailyLeadersCache: {},    // Top stat leaders
  onThisDayCache: [],       // Historical "On This Day" stories
  yesterdayCache: [],       // Yesterday's game highlights
  hrBatterStatsCache: {},   // Home run batter stats
  probablePitcherStatsCache: {},
  dailyHitsTracker: {},
  dailyPitcherKs: {},
  storyCarouselRawGameData: {},
  stolenBaseEvents: [],
  scheduleData: []
}
```

---

## Proposed Change: Static Daily Events JSON

**User Direction:** Replace live API fetch with static JSON snapshot of a real day's events.

### Architecture Needed

**New Data Source Path:**
1. User provides `daily-events.json` (or similar) — complete capture of all games + plays from a single MLB day
2. `initDemo()` loads this static JSON instead of calling `loadDemoGames()`
3. No individual playByPlay API calls needed — all plays pre-loaded in one file

### Expected JSON Structure

**Option A: Full Snapshot Format** (simplest — reuse captured snapshot)
```json
{
  "metadata": { "date": "2026-04-27", "season": 2026 },
  "gameStates": { ... },
  "feedItems": [ ... ],
  "scheduleData": [ ... ],
  ...
}
```

**Option B: Minimal Games + Plays Format** (most compact)
```json
{
  "games": [
    {
      "gamePk": 824203,
      "gameDateTime": "2026-04-27T19:10:00Z",
      "status": "Final",
      "awayTeam": { "id": 121, "name": "New York Mets", "shortName": "NYM" },
      "homeTeam": { "id": 144, "name": "Atlanta Braves", "shortName": "ATL" },
      "venue": "Truist Park",
      "plays": [
        {
          "inning": 1,
          "halfInning": "top",
          "batter": { "id": 547989, "fullName": "Pete Alonso" },
          "event": "Home Run",
          "description": "Pete Alonso homers (5) on a fly ball...",
          "outs": 0,
          "awayScore": 1,
          "homeScore": 0,
          "timestamp": "2026-04-27T19:15:00Z",
          "endTime": "2026-04-27T19:15:45Z"
        },
        ...
      ]
    },
    ...
  ]
}
```

---

## Code Changes Required

### 1. New Function: Load Static Events JSON
```javascript
async function loadDailyEventsJSON() {
  try {
    var r = await fetch('./data/daily-events.json');  // or API endpoint
    if (!r.ok) return null;
    return await r.json();
  } catch(e) {
    console.error('Demo: Failed to load daily events JSON', e);
    return null;
  }
}
```

### 2. New Function: Parse JSON into gameStates + demoPlayQueue
- Transform games + plays → gameStates object
- Build demoPlayQueue from plays array
- Match structure expected by `advanceDemoPlay()` and `addFeedItem()`

**Inputs:**
- JSON object with `games[]` and `plays[]` per game

**Outputs:**
- Populated `gameStates`
- Populated `demoPlayQueue` (sorted by timestamp)
- `feedItems` reconstructed from plays on first playback

### 3. Update initDemo() Flow
```javascript
async function initDemo() {
  // ... setup ...
  var snapshot = localStorage check;
  if (snapshot) {
    // existing path
  } else {
    var dailyEvents = await loadDailyEventsJSON();
    if (dailyEvents) {
      parseDailyEventsIntoGameStates(dailyEvents);
    } else {
      // fallback to DEMO_BACKUP_GAMES or API
    }
  }
}
```

### 4. File Structure
- **Location of JSON:** TBD by user
  - Option 1: `./data/daily-events.json` (static file in repo)
  - Option 2: API endpoint (e.g., `/api/demo-events?date=2026-04-27`)
  - Option 3: Embedded in `index.html` as constant

---

## Key Questions to Answer

1. **JSON Format:** Option A (full snapshot) or Option B (compact games+plays)?
2. **Data Source:** Static file, API endpoint, or embedded constant?
3. **Date Selection:** Which real MLB day to capture (memorable games, good variety, recent)?
4. **Play Granularity:** Include all plays, or only scoring/notable ones?
5. **Caches:** Include cached data (leaders, "On This Day", etc.) or compute them from plays?

---

## Files Involved

| File | Line(s) | Current Role | Changes Needed |
|---|---|---|---|
| `index.html` | 992–993 | Demo globals & DEMO_BACKUP_GAMES | Replace API calls with JSON load; add parser |
| `index.html` | 1394–1424 | exportPulseStateAsSnapshot() | Unchanged; good template for JSON structure |
| `index.html` | 1427–1506 | initDemo() | Add branch for loadDailyEventsJSON() path |
| `index.html` | 1508–1534 | loadDemoGames() | Deprecated (keep for fallback or remove) |
| `index.html` | 1536–1569 | buildDemoPlayQueue() | Deprecated (replace with JSON parser) |
| `./data/daily-events.json` | NEW | Static daily events | Create with real MLB day snapshot |

---

## Success Criteria

✅ Demo mode loads from static JSON without API calls  
✅ Full day of games (~12–15 games) displayed in ticker  
✅ ~200–300 plays rendered chronologically in feed  
✅ Story Carousel populates correctly (HR, walk-off, etc.)  
✅ No network dependency (works offline)  
✅ Falls back gracefully if JSON unavailable  
✅ Snapshot/export still works for capturing live state  

---

## Status

**Current:** v2.27.9 — Live API + localStorage snapshot paths working  
**Next:** Implement static JSON path (awaiting user direction on format/location/data)
