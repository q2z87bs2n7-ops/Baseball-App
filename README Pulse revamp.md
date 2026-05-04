# Pulse redesign — handoff package

Drop-in implementation of the Pulse hero zone + MY TEAM lens dim mode + rail/feed polish.

## What's in this folder

| File | Purpose |
|---|---|
| `pulse-redesign.css` | All visual changes. Scoped under `#pulse` — leaks nothing into Home/League/Schedule. Layers on top of `styles.css`. |
| `pulse-redesign.js` | IIFE module. Builds `#pulseHero` wrapper at boot, manages MY TEAM lens dim state, observes feed/ticker for re-stamping. Matches the IIFE pattern of `focusCard.js` / `collectionCard.js`. |
| `CLAUDE_CODE_PROMPT.md` | Step-by-step implementation prompt. Hand directly to Claude Code. Six steps; only Step 3 + Step 4 require any change inside `app.js`, and both are surgical (one line each). |
| `README.md` | This file. |

## What this delivers

1. **Pulse Hero zone** — `#focusCard` + `#storyCarousel` get promoted into a single grid row above the feed. The rail no longer carries the Focus card.
2. **Right rail polish** — consistent group titles, no team-color bleed, news carousel re-grouped under `MLB News` heading.
3. **MY TEAM lens, redesigned** — instead of hiding non-team rows, fades them to ~35% opacity and adds a left accent bar to team rows. Keeps peripheral awareness while still focusing.
4. **Feed density + emphasis** — homerun rows get a thicker left rail, scoring rows get an inset accent, hover state subtly elevates.
5. **Top bar grouping** — sound/radio/scheme icons share a transparent treatment, MY TEAM + Yesterday Recap remain primary chips.
6. **Mobile** — hero collapses to single column at ≤860px; rail folds under feed.

## Reversibility

Removing `pulse-redesign.css` and `pulse-redesign.js` from `index.html` reverts Steps 1, 2, 5, 6 entirely.

The two `app.js` changes (Step 3 dataset stamp + Step 4 lens behavior change) are independent — each can stay or be reverted on its own.

## Token usage

Every color, radius, spacing rule reads from existing `--p-*` and `--radius` tokens. Light/dark mode already works — nothing in this redesign defeats `setPulseColorScheme()`.
