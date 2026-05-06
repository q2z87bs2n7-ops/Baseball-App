# MLB Tracker — Card Collection System

Auto-collects a player card every time an HR or key RBI event fires in Pulse (added v3.0). Cards are stored per-player per-event-type (one HR slot + one RBI slot per player). Slots upgrade on higher-tier events; same-tier duplicates stored and randomly shown for variety. Users browse in a binder-style overlay.

## Tier System

**HR tiers** (derived from badge text at collection time):

| Tier | Badge matches | Glow |
|---|---|---|
| `legendary` | "WALK-OFF GRAND SLAM" | `#e03030` red |
| `epic` | "GRAND SLAM" OR "WALK-OFF" | `#f59e0b` amber |
| `rare` | "GO-AHEAD" | `#3b82f6` blue |
| `common` | everything else (solo HR) | `var(--muted)` subtle |

**RBI tiers** (badge + explicit rbi count — count passed explicitly since badge doesn't embed it for walk-offs):

| Tier | Condition | Glow |
|---|---|---|
| `legendary` | "WALK-OFF" in badge AND rbi ≥ 2 | `#e03030` red |
| `epic` | "WALK-OFF" in badge (1 RBI) OR rbi ≥ 3 | `#f59e0b` amber |
| `rare` | "GO-AHEAD" OR "TIES IT" in badge | `#3b82f6` blue |
| `common` | everything else | `var(--muted)` subtle |

**Why not 4 RBI for legendary RBI tier:** 4-RBI walk-off = walk-off grand slam = fired as an HR event, never as an RBI event. Max achievable RBI on a single RBI-card event is 3.

**Tier rank:** legendary(4) > epic(3) > rare(2) > common(1)

## Data Model

**localStorage key:** `mlb_card_collection`  
**Format:** plain object keyed by `{playerId}_{HR|RBI}`

```javascript
slot = {
  playerId:      number,
  playerName:    string,
  teamAbbr:      string,
  teamPrimary:   string,   // hex — for card background tint
  teamSecondary: string,   // hex — for accent
  position:      string,   // e.g. "RF", "SP", "RP" — determines hitting vs pitching career stats
  eventType:     'HR' | 'RBI',
  tier:          'common' | 'rare' | 'epic' | 'legendary',
  collectedAt:   number,   // ms — of first collection at this tier (for sort)
  events: [                // all collected events at current tier (1+, capped at 10)
    {
      badge:       string,  // "GRAND SLAM!", "GO-AHEAD HOME RUN!", etc.
      date:        string,  // "2026-05-01" (en-CA format)
      inning:      number,
      halfInning:  string,
      awayAbbr:    string,
      homeAbbr:    string,
      awayScore:   number,
      homeScore:   number,
    }
  ]
}
```

**Upgrade rule:** new tier rank > existing → replace slot tier + events[], update `collectedAt`. Same rank → append event to `events[]` (cap 10). Lower rank → silent no-op.

**Player headshot URL** derived at render time:  
`https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/{playerId}/headshot/67/current`  
Never stored (avoids stale URLs).

**Career stats** fetched at render time from `/people/{id}/stats?stats=career&group=hitting` (or `pitching` for SP/RP/CP). Cached in `collectionCareerStatsCache` (session-only). Hitters: `{ careerHR, careerAVG, careerRBI, careerOPS }`. Pitchers: `{ careerERA, careerWHIP, careerW, careerK }`.

**Team logo URL** for binder watermark: `https://www.mlbstatic.com/team-logos/{teamId}.svg` — derived from `teamId` in `teamContext` at render time, never stored.

## Collection Lifecycle

1. **HR fires** in `showPlayerCard()` → `collectCard({...eventType:'HR', badge:badgeText, ...})` (not in demo mode)
2. **RBI fires** in `showRBICard()` → `collectCard({...eventType:'RBI', badge, rbi, ...})` (not in demo mode)
3. `collectCard()` sets `lastCollectionResult` before any guard, runs tier + upgrade logic, calls `showCollectedToast()` + `updateCollectionUI()`
4. **Player card dismisses** → `dismissPlayerCard()` calls `flashCollectionRailMessage()` → reads `lastCollectionResult`, renders tier-colored pill in `#collectionRailModule`, auto-reverts after 4s
5. **Demo mode simulation:** `collectCard()` in demo mode (without `force=true`) sets `lastCollectionResult` for rail flash, then returns without persisting

## HTML Elements

**`#collectionOverlay`** — full-screen modal (top-level sibling of `#focusOverlay`, z-index 500):
```html
<div id="collectionOverlay" style="display:none;position:fixed;inset:0;z-index:500;
     background:rgba(0,0,0,.85);align-items:center;justify-content:center;overflow-y:auto"
     onclick="if(event.target===this)closeCollection()">
  <div id="collectionBook" style="width:100%;max-width:960px;max-height:90vh;
       overflow-y:auto;border-radius:12px"></div>
</div>
```

**`#cardCollectedToast`** — brief fixed pill (top-level, z-index 450).

**`#collectionRailModule`** — inside `#sideRail`, above news carousel. Renders count chip + "Open →" CTA; replaced temporarily by `flashCollectionRailMessage()` after player card dismissal.

**Settings panel row** — "📚 Cards Collected: N [Open]" — **first item** in the settings panel (above Select Team). Count via `<span id="collectionCountLabel">` updated by `updateCollectionUI()`. "Open" button calls `openCollection();toggleSettings()`.

## window.CollectionCard API (`collectionCard.js`)

Standalone IIFE (no imports, no build). CSS injected once via `<style id="cc-styles">`. All classes prefixed `.cc-*`.

**`renderBook({ slots, filter, sort, page, careerStatsMap, teamContext })`** — full binder interior. `slots` is the already-filtered/sorted array from `app.js`. `careerStatsMap` is `playerId → careerStats`. `teamContext` is `{ abbr, primary, secondary, teamId, teamIdx, teamCount }` or null for non-team sorts.
- Standard 3×3 pocket grid (9 cards per page)
- Team sort: page background tinted with team primary at ~5% opacity + 2px primary border-top; 200×200px team logo watermark at 5% opacity centered on page
- Filter bar: "All | HR | RBI" pills + "Newest / Rarity / Team" sort toggle
- Empty state: ghost pockets with 🔒 icon
- Page nav: "◀ Page N / M ▶" or team nav footer with logo + ABBR + "(N of M)" in team sort

**`renderMiniCard(slot, displayEvent, careerStats, idx)`** — single card inside a pocket sleeve (~140×200px). Shows: headshot, player name, team abbr, tier badge with rarity glow border, event type label, career stat grid (4 stats), date + badge as flavor text. `onclick="openCardFromCollection(N)"`.

**`renderRailModule(totalCount)`** — compact Pulse side rail module: "🎴 N cards" count chip + "Open Collection →" button. Injected into `#collectionRailModule`.

**`demo()`** — mounts binder overlay with 9 sample slots across all tiers.

## Hook Points

**HR hook** — inside `showPlayerCard()`:
```javascript
if (!demoMode) {
  collectCard({
    playerId: d.batterId, playerName: d.batterName, teamAbbr: d.teamAbbr,
    teamPrimary: d.teamData.primary, teamSecondary: d.teamData.secondary,
    position: d.position || '', eventType: 'HR',
    badge: badgeText || '💥 HOME RUN!',
    inning: (gameStates[gamePk]||{}).inning || 0,
    halfInning, awayAbbr, homeAbbr, awayScore, homeScore,
  });
}
```

**RBI hook** — inside `showRBICard()`:
```javascript
if (!demoMode) {
  collectCard({
    playerId: batterId, playerName: batterName, teamAbbr, teamPrimary, teamSecondary,
    position: position || '', eventType: 'RBI', badge, rbi,
    inning, halfInning, awayAbbr, homeAbbr, awayScore: aScore, homeScore: hScore,
  });
}
```

## Critical DOM Placement Rule

**`#playerCardOverlay` must remain at top-level DOM** (sibling of `#focusOverlay`, `#collectionOverlay`, `#devToolsPanel`, `#soundPanel`) — never nested inside `#pulse` or any section. Sections create stacking contexts and can be `display:none`, trapping z-index or hiding the overlay entirely. Current z-index: 600 (above binder's 500, below focusOverlay's 700, below videoOverlay's 800).

## Cross-device sync

Sign-in required. `GET/PUT/POST /api/collection-sync` against Upstash Redis key `collection:{userId}`. Merge strategy: highest tier wins; same tier keeps newer `collectedAt` + merged events (deduped, capped 10). Background sync every 30s via `startSyncInterval()`. See `docs/auth-architecture.md` for full auth setup.
