# Pulse Neutral Sweep — Implementation Handover

This document contains **8 byte-exact CSS-only changes** to `index.html`. Each change is a self-contained find/replace block. Apply them in order. Do not modify `:root`, `pulse-card-templates.js`, or any JavaScript.

**Reference:** see `Pulse Review.html` for visual rationale and before/after mocks.

**Branch:** create a new branch `pulse-neutral-sweep` before starting.
**Version bump after step 8:** `v1.18.1-pulse-neutral` (if there's a version string).

---

## How to apply each change

Each step has:
1. **FIND** — the exact text currently in `index.html`. It is unique in the file; you can match it as a single string with the Edit tool.
2. **REPLACE** — the exact text to put in its place.
3. **VERIFY** — what to look at in the browser before moving to the next step.

After every step:
- Reload the app
- Switch the team in settings (Mets → Athletics → at least one more)
- Confirm the VERIFY check passes
- **Stop and report.** Wait for human approval before the next step.

If a FIND block does not match exactly (whitespace, line wrap, etc), **stop and report**. Do not improvise.

---

## STEP 1 — Pulse-scoped neutral accent token

The keystone change. Adds a CSS scope override so `var(--accent)` resolves to neutral grey only inside `#pulse`. Most other steps depend on this being in.

**FIND** (exists once at line 396):

```
.pulse-feed-label .pulse-bolt { color: var(--accent); }
```

**REPLACE WITH:**

```
.pulse-feed-label .pulse-bolt { color: var(--accent); }
/* Pulse is team-neutral. Re-point --accent only inside the Pulse view. */
#pulse {
  --accent: #cfd3dc;
  --accent-soft: rgba(255,255,255,0.08);
  --accent-strong: #ffffff;
}
```

**VERIFY:**
- Open Pulse view
- Look at the side rail's "Upcoming Today" count number (e.g. "12")
- It should be **neutral grey**, not Mets orange
- Look at the time prefix on each upcoming game row (e.g. "7:10pm")
- Also neutral grey, not orange
- Switch team to Athletics in settings → reload Pulse → still neutral grey (not green)
- **Other tabs** (Home, League, Schedule, Standings) must look unchanged — accent there is still team color

---

## STEP 2 — Story badge color reduction (9 → 2)

Collapses 8 of the 9 story-badge color treatments into a single neutral chrome. `live` stays red (the only state where color signal is meaningful).

**FIND** (lines 519–526, exact 8 consecutive lines):

```
  .story-badge.today { background: rgba(60,190,100,0.2); color: #4caf7d; }
  .story-badge.final { background: rgba(80,140,255,0.15); color: #7aa8ff; }
  .story-badge.yesterday { background: rgba(155,160,168,0.15); color: var(--muted); }
  .story-badge.onthisday { background: rgba(155,100,255,0.15); color: #b07aff; }
  .story-badge.upcoming { background: rgba(255,190,60,0.15); color: #ffbe3c; }
  .story-badge.season { background: rgba(255,215,0,0.15); color: #ffd700; }
  .story-badge.probables { background: rgba(100,180,255,0.15); color: #64b4ff; }
  .story-badge.highlight { background: rgba(255,160,50,0.2); color: #ffa032; }
```

**REPLACE WITH:**

```
  /* Neutral chrome for all non-live story badges. The label text carries the meaning. */
  .story-badge.today,
  .story-badge.final,
  .story-badge.yesterday,
  .story-badge.onthisday,
  .story-badge.upcoming,
  .story-badge.season,
  .story-badge.probables,
  .story-badge.highlight {
    background: rgba(255,255,255,0.06);
    color: #cfd3dc;
    border: 1px solid rgba(255,255,255,0.10);
  }
```

**Do NOT touch line 518** (`.story-badge.live { background: rgba(255,60,60,0.2); color: #ff6b6b; }`). It must remain unchanged.

**Do NOT touch any JS.** The badge-key map in `renderStoryCard()` stays as-is.

**VERIFY:**
- Open story carousel in Pulse
- Cycle through stories
- Only `LIVE` badges show red. All other badges (`TODAY`, `FINAL`, `ON THIS DAY`, `UPCOMING`, `SEASON LEADER`, etc) appear as identical light-grey chrome
- The label text still differentiates them — color no longer does

---

## STEP 3 — Story tier 2/3/4 — drop tinted backgrounds

Removes the green/blue/grey wash on tier 2–4 story cards. The left border-color stays as the priority cue.

**FIND** (lines 514–516, three consecutive lines):

```
  .story-card.tier2 { border-left: 3px solid rgba(60,190,100,0.6); background: var(--scoring-bg); }
  .story-card.tier3 { border-left: 3px solid rgba(80,140,255,0.6); background: var(--status-bg); }
  .story-card.tier4 { border-left: 3px solid var(--border); }
```

**REPLACE WITH:**

```
  /* Mute tier 2–4 backgrounds — keep the left rail as the priority cue. */
  .story-card.tier2 { border-left: 3px solid rgba(155,165,180,0.55); }
  .story-card.tier3 { border-left: 3px solid rgba(155,165,180,0.30); }
  .story-card.tier4 { border-left: 3px solid var(--border); }
```

**Do NOT touch:**
- Line 512 (`.story-card.tier1` — keeps its teal tint, it's the lead story)
- Line 513 (`.story-card.story-biginning` — keeps its red tint, it's a real alert state)

**VERIFY:**
- Open Pulse, find a stack of tier2 or tier3 stories
- They should now have the same dark `var(--card)` background as a generic card, with only a subtle grey left rail
- Tier1 (lead) cards still show teal background — confirm one is visible
- A `story-biginning` card (if one is live) still shows red tint

---

## STEP 4 — Hype pills: unified chrome, dot accent

Replaces three separately colored pills (orange / green / yellow) with one neutral chrome plus a small colored dot.

**FIND** (lines 407–410, four consecutive lines):

```
.hype-pill { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; letter-spacing: 0.04em; border: 1px solid; }
.hype-pill.hr      { background: rgba(255,155,30,0.12); border-color: rgba(255,155,30,0.35); color: #ffaa30; }
.hype-pill.scoring { background: rgba(60,190,100,0.10); border-color: rgba(60,190,100,0.30); color: #3dba5a; }
.hype-pill.risp    { background: rgba(255,200,0,0.10);  border-color: rgba(255,200,0,0.30);  color: #ffd000; }
```

**REPLACE WITH:**

```
.hype-pill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; letter-spacing: 0.04em; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.10); color: #cfd3dc; }
.hype-pill::before { content: ""; width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.hype-pill.hr::before      { background: #ffaa30; }
.hype-pill.scoring::before { background: #3dba5a; }
.hype-pill.risp::before    { background: #ffd000; }
```

**Do NOT** strip the emoji from the pill labels in JS. Leave them in. They're harmless next to the dot — the user will decide later if they want them removed.

**VERIFY:**
- Open Pulse before any game starts (or in an empty-state preview if available)
- The "Home Runs / Scoring Plays / RISP" pills are all the same shape and chrome
- Each has a small colored dot on the left (orange / green / yellow respectively)
- The pill text is light grey, not the previous saturated color

---

## STEP 5 — Verification only (no code change)

Step 1's `#pulse { --accent: ... }` override should already have fixed:
- `.game-count` (line 468) — the count next to "Upcoming Today"
- `.side-rail-game-time-badge` (line 474) — the time prefix on each upcoming row

**No edit needed.** Just verify:

- Side rail's count number is neutral grey
- Side rail's time prefix is neutral grey
- Both stay neutral when team is switched

If either still shows team color, Step 1's override didn't apply correctly. Stop and report.

**(Optional) If you also want the time prefix to look more like a chip:** flag it for human review — don't apply unprompted.

---

## STEP 6 — Settings panel inline kicker color → muted

Three inline `style="..."` blocks in the settings panel use `color:var(--accent)` for kicker labels. Swap to `var(--muted)` to match the rest of the app's section-header pattern.

### 6a — "Select Team" kicker (line 633)

**FIND:**

```
        <div style="font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--accent);margin-bottom:10px">Select Team</div>
```

**REPLACE WITH:**

```
        <div style="font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:10px">Select Team</div>
```

### 6b — "Color Theme" kicker (line 636)

**FIND:**

```
          <div style="font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--accent);margin-bottom:10px">Color Theme</div>
```

**REPLACE WITH:**

```
          <div style="font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:10px">Color Theme</div>
```

### 6c — Check for "Pulse: Sound Alerts" kicker

Look at line 673:

```
            <div style="font-size:.75rem;font-weight:700;color:var(--text)">⚡ Pulse: Sound Alerts</div>
```

This one already uses `var(--text)`, **not `var(--accent)`**. **No change needed at line 673.** Skip.

If you find any other inline kicker in the settings panel using `color:var(--accent)`, apply the same swap to `var(--muted)`. Otherwise stop.

**VERIFY:**
- Open settings panel (gear icon)
- "Select Team" and "Color Theme" labels are now muted grey, not team accent
- Switch team — kickers stay grey

---

## STEP 7 — Pulse feed header rhythm

Aligns the `⚡ MLB Pulse` header to match the existing side-rail kicker rhythm (11px / 0.18em tracking / muted color).

**FIND** (lines 395–396, two consecutive lines):

```
.pulse-feed-label { font-size: .68rem; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); white-space: nowrap; }
.pulse-feed-label .pulse-bolt { color: var(--accent); }
```

**REPLACE WITH:**

```
.pulse-feed-label { font-size: 11px; font-weight: 700; letter-spacing: .18em; text-transform: uppercase; color: var(--muted); white-space: nowrap; }
.pulse-feed-label .pulse-bolt { color: var(--muted); font-size: 14px; }
```

**Note on Step 1 interaction:** Step 1 inserted a `#pulse { --accent: ... }` override block immediately after line 396. The line above (`.pulse-feed-label .pulse-bolt`) will still exist; you're replacing it in place. Just be careful the FIND block matches the two original lines and not the inserted block from Step 1.

If your editor's match logic is tripped up by the Step 1 insertion, do this instead:

**FIND** (more specific — anchors to the line above):

```
.pulse-feed-label { font-size: .68rem; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); white-space: nowrap; }
.pulse-feed-label .pulse-bolt { color: var(--accent); }
/* Pulse is team-neutral. Re-point --accent only inside the Pulse view. */
```

**REPLACE WITH:**

```
.pulse-feed-label { font-size: 11px; font-weight: 700; letter-spacing: .18em; text-transform: uppercase; color: var(--muted); white-space: nowrap; }
.pulse-feed-label .pulse-bolt { color: var(--muted); font-size: 14px; }
/* Pulse is team-neutral. Re-point --accent only inside the Pulse view. */
```

**VERIFY:**
- Open Pulse
- The `⚡ MLB Pulse` header above the feed: bolt is roughly the same height as the label cap-height (no longer towering over it)
- Tracking on "MLB PULSE" looks looser/more open than before
- Header rhythm matches the side-rail "UPCOMING TODAY" / "COMPLETED" titles

---

## STEP 8 — Border-radius alignment in side rail (optional)

Pick one container radius for Pulse and apply consistently. **Skip this step** if you've already verified the side rail looks acceptable after step 7. Otherwise:

**FIRST — read the current value of `--radius`.** Look at line 17 in `index.html` (`:root` block) and find `--radius:`. If `--radius` is `10px`, no change is needed (the side rail already matches). If `--radius` is something else (e.g. 12px), proceed.

### 8a — Section header (line 466)

**FIND:**

```
.side-rail-section-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; background: var(--card); border: 1px solid var(--border); border-radius: 10px 10px 0 0;
```

**REPLACE WITH** (the whole rule starts the same; only `border-radius` changes — match the full existing line in the file and replace just that segment):

```
.side-rail-section-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; background: var(--card); border: 1px solid var(--border); border-radius: var(--radius) var(--radius) 0 0;
```

### 8b — Games container (line 469)

**FIND:**

```
.side-rail-games-container { background: var(--card); border: 1px solid var(--border); border-radius: 0 0 10px 10px; overflow: hidden; margin-bottom: 12px; }
```

**REPLACE WITH:**

```
.side-rail-games-container { background: var(--card); border: 1px solid var(--border); border-radius: 0 0 var(--radius) var(--radius); overflow: hidden; margin-bottom: 12px; }
```

**VERIFY:**
- Open Pulse, side rail visible
- Side rail container corners are now the same radius as `#feedWrap` (the main feed wrap, line 397)
- No visible regression — corners look intentional, not too sharp/round

If anything looks worse, revert this step. The other 7 steps stand on their own.

---

## After all 8 steps — final verification matrix

Run all five checks. If any fails, identify which step regressed and revert just that one.

1. **Team-color leak check.** Open Pulse with team = Mets. Switch to Athletics. The Pulse view chrome should be visually identical between the two states (only per-game team dots and team logos differ).
2. **LIVE-state check.** With at least one live game, the LIVE story badge and any in-ticker LIVE indicators are still red.
3. **Empty-state check.** Visit Pulse before any game starts. Hype pills, "TODAY · N UPCOMING GAMES" kicker, and the demo CTA are all neutral grey. The "NEXT UP" hero card keeps its team-color gradient.
4. **Other-section check.** Visit Home, League, Schedule, Standings, Stats. None should look different from before. `--accent` there still resolves to team primary at `:root`.
5. **Popup card check.** Trigger an HR or RBI popup (or use the demo trigger). The popup card visuals are unchanged — they're rendered by `pulse-card-templates.js` with inline styles and don't read `--accent`.

If all 5 pass: bump the version string (look for it near the top of `index.html` or in a footer/meta tag) to `v1.18.1-pulse-neutral`, commit, push.

---

## Commit message template

```
Pulse: neutral chrome sweep (v1.18.1-pulse-neutral)

CSS-only sweep to remove team-color bleed from Pulse view.
- Scope --accent override to #pulse (was leaking from :root)
- Collapse 8 story-badge colors to neutral chrome (LIVE keeps red)
- Drop tier2/3/4 background tints (left rail still encodes priority)
- Unify hype pills with dot accent
- Match Pulse feed header rhythm to side-rail kicker scale
- Align side-rail container radius to var(--radius)
- Settings panel kicker labels now var(--muted) not var(--accent)

No JS changes, no template changes. pulse-card-templates.js untouched.
```

---

## Hard rules (re-stated)

1. **No `:root` changes.** Don't touch the global `--accent` definition at line 17.
2. **No JS changes.** No edits to any function, no edits to `pulse-card-templates.js`.
3. **One step at a time.** Apply, reload, verify, report, wait for approval, repeat.
4. **If a FIND doesn't match, stop.** Do not improvise alternative selectors or rewrite blocks. Report the mismatch and wait.
5. **Do not bulk-apply** all 8 steps in one commit on the assumption they're independent. They're independent in terms of correctness but the verification value is in catching regressions per step.
