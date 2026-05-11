# Bobblehead Baseball — Sandbox

Standalone arcade mini-game prototype. Lives outside the main app bundle so it can iterate freely without bumping `package.json`, busting the service-worker cache, or risking the live PWA. Once gameplay feels right, it ports into `src/sections/minigame/`.

## Run it

ES modules require a server (browsers block module loads from `file://`). From this directory:

```bash
python3 -m http.server 8765
# then open http://localhost:8765/
```

Or from the repo root:

```bash
python3 -m http.server 8765
# then open http://localhost:8765/minigames/bobblehead/
```

## Controls

- **Spacebar** or **SWING button** — start a pitch, then press again to swing
- **Timing**: cursor sweeps left→right while the ball travels. Center (green zone) = perfect straight hit. Early = pulls left. Late = pushes right. Extremes = foul.

## What works (v0)

- Pitch → swing → ball trajectory → fence hit detection
- Cards shuffle each pitch with weighted values: OUT / 1B / 2B / 3B / HR
- One ramp placed on a random card each pitch → guaranteed HR if you land on it
- Bases & runs: standard advancement, all runners score on HR
- 9 outs → game over, local leaderboard (top 5 in localStorage)
- Strikes accumulate, 3 strikes = strikeout out

## Layout

```
minigames/bobblehead/
  index.html
  styles.css
  src/
    main.js              # boot, rAF loop, glue
    state.js             # mutable state container
    cards.js             # fence slot defs + shuffle
    physics.js           # timing→landingX, slot lookup, ramp test, bezier
    bases.js             # runner advancement
    input.js             # space/click → swing events
    render.field.js      # Canvas 2D field + ball + ramp + runners
    render.dom.js        # DOM fence cards, HUD, banner, timing cursor
    leaderboard.js       # localStorage top-5
```

## Known gaps (v0)

- No audio yet
- Fence cards use placeholder portraits — will swap for real `CollectionCard` art on port
- No "contact window" — every in-time swing connects (timing only affects direction)
- Game length is fixed at 9 outs; no innings yet
- No mobile-specific tuning (works, but timing meter is tight on small screens)

## Porting to the main app (later)

1. Move `src/` modules under `src/sections/minigame/` in the main repo
2. Add `<section id="minigame">` to `index.html`; route via `showSection`
3. Replace `render.dom.js` fence with `window.CollectionCard` components for theme parity
4. Swap `leaderboard.js` for an `/api/minigame-scores` endpoint mirroring `collection-sync` (Upstash Redis)
5. Bump `package.json` version; bump `sw.js` `CACHE`
