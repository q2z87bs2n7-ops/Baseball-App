# Pulse HR/RBI Card Revamp — Handoff

## What's happening
We're replacing the styling of the HR and RBI popup cards in `index.html` with four new visual variants. The app picks one of the four **at random** on every popup. **No user setting.** Variety is the feature.

A previous attempt (branch `claude/revamp-card-ui-0SR3b`) tried to retrofit the new designs onto the existing `.pc-*` CSS by overriding rules. That fights the design — every variant has a different DOM structure, z-stack, and element count. **This handoff does not ask you to override CSS. It asks you to swap the innerHTML wholesale, using a pre-built template module.**

## Branch
Start from `main`, name the branch `claude/pulse-cards-v2`. **Do not branch from the previous attempt.**

## The three files in this handoff
1. **`pulse-card-templates.js`** — drop-in module. Four `renderV1..V4()` functions returning HTML strings, plus a public `window.PulseCard` API (`render`, `renderForce`, `demo`). All styling is inline. Do not modify this file.
2. **`pulse-card-test.html`** — open this in a browser to see the four cards. This is your visual ground truth. Match it exactly when you're done.
3. **`HANDOFF.md`** — this file.

Copy all three to the repo root.

## Steps (do them in order, one at a time, show diffs)

### Step 1 — Add the script
At the bottom of `index.html`, before `</body>`, add:
```html
<script src="pulse-card-templates.js"></script>
```
Show the diff. Wait for approval.

### Step 2 — Wire the demo trigger (do this before anything else so you can verify visually)
Find the existing keyboard listener for things like `Shift+P` (Pulse mock mode). Add:
```js
if (e.shiftKey && e.key === 'H') { window.PulseCard.demo(); }
```
Reload, press `Shift+H`, confirm a card appears matching one of the four variants in `pulse-card-test.html`. Press it 5-10 times; you should see all four variants come up.

### Step 3 — Swap `showPlayerCard()` (the HR popup, ~line 2970)
Find the block:
```js
card.innerHTML = ''
  + '<div class="pc-photo-bg" ...
  ...
  + '</div>';
```
Replace the entire `card.innerHTML = ...` assignment with:
```js
card.innerHTML = window.PulseCard.render({
  batterId: batterId,
  name: batterName,
  team: { short: teamAbbr, primary: teamData.primary, secondary: teamData.secondary },
  position: position,
  jersey: jerseyNumber,
  badge: (badgeText || 'HOME RUN'),
  stats: { avg: avg, ops: ops, hr: hrPrev, rbi: rbi },
  highlight: 'hr',
});
```
Leave everything else in `showPlayerCard()` alone — the stat fetch, the timer, the count-up animation, all of it stays. The count-up still works because the templates emit `class="pc-hr-val"` on the HR value cell.

Test with a real-feeling scenario via mock mode (or `Shift+H`). Show the diff. Wait for approval.

### Step 4 — Swap `showRBICard()` (the RBI popup, ~line 3139)
Same pattern. Replace its `card.innerHTML = ...` block with:
```js
card.innerHTML = window.PulseCard.render({
  batterId: batterId,
  name: batterName,
  team: { short: teamAbbr, primary: teamData.primary, secondary: teamData.secondary },
  position: position,
  jersey: jerseyNumber,
  badge: badge,
  stats: { avg: avg, ops: ops, h: hits, rbi: rbiPrev },
  highlight: 'rbi',
});
```
The `.pc-rbi-val` class is preserved on the RBI cell so the count-up animation works. Show diff, wait for approval.

### Step 5 — Remove the old `.pc-*` styles (cleanup, last)
The new templates use inline styles. The old `.pc-*` CSS is no longer reachable from inside these popups. **Cleanup only — do not do this until steps 1-4 are approved and visually verified.**

In the `<style>` block in `index.html`, find the block roughly:
```css
.pc-photo-bg { ... }
.pc-photo-bg::after { ... }
.pc-jersey { ... }
.pc-name { ... }
.pc-team-pos { ... }
.pc-event-badge { ... }
.pc-event-badge.pc-rbi-badge { ... }
.pc-stat / .pc-stat-val / .pc-stat-lbl / .pc-hr-highlight / .pc-rbi-highlight
@media (max-width:480px) { ... pc-* overrides ... }
```
**Keep:**
- `#playerCardOverlay` (the overlay positioning + open/closing animation)
- `#playerCard` (the card sizing + entry animation)
- `.pc-loading` (used while stats are fetched)
- The keyframes `@keyframes hr-count-up` and `@keyframes rbi-count-up` and `@keyframes pc-card-in` etc.
- The `.counting` class targeting `.pc-hr-val` / `.pc-rbi-val` if it exists separately

**Delete:**
- `.pc-photo-bg`, `.pc-photo-bg::after`, `.pc-jersey`, `.pc-header`, `.pc-identity`, `.pc-name`, `.pc-team-pos`, `.pc-event-badge`, `.pc-stats`, `.pc-stat`, `.pc-stat-val`, `.pc-stat-lbl`, `.pc-hr-highlight`, `.pc-rbi-highlight`, `.pc-context`, `.pc-context-pill`
- The `@media (max-width:480px)` block that targets `.pc-*` classes — the new templates don't need it

Show the diff. Wait for approval.

### Step 6 — Bump version
Bump the version string. New version: `v1.18-pulse-cards`. Update wherever the existing version is displayed.

### Step 7 — Spot-check teams
Open the app with mock mode and verify these four scenarios render OK on all four variants (use `Shift+H` repeatedly until each variant has shown for each scenario):
- Mets (orange secondary)
- Yankees (red secondary on navy)
- Orioles (black on orange — dark secondary)
- A's (yellow on green — bright secondary)

If anything looks wrong, **don't fix it by editing `pulse-card-templates.js`** — flag it and we'll discuss. The templates are the spec; integration is your job.

## Hard rules
- **Do not modify `pulse-card-templates.js`.** It's the spec. If you think it's wrong, stop and ask.
- **Do not refactor existing code outside of `showPlayerCard` and `showRBICard`.** Don't touch the badge functions, the alert system, the stat cache, the mock mode, the sound system. Anything outside the two `card.innerHTML` blocks is out of scope.
- **One step at a time.** Show me a diff after each step. Wait for approval before the next.
- **No "improvements."** No new features, no extra icons, no animations beyond what's in the templates. If you have an idea, write it down for after.
- **If you can't match the test harness exactly, stop and tell me which part doesn't match and why** — don't approximate.

## Verification checklist (you tell me when each passes)
- [ ] `pulse-card-test.html` opens in browser and shows four cards
- [ ] `Shift+H` in the app fires a card, cycles all four variants over multiple presses
- [ ] HR popup in mock mode shows a randomly-picked variant matching the test harness
- [ ] RBI popup in mock mode shows a randomly-picked variant matching the test harness
- [ ] HR count-up animation still triggers (`.pc-hr-val` increments after 500ms)
- [ ] RBI count-up animation still triggers (`.pc-rbi-val` increments after 500ms)
- [ ] Long badges ("WALK-OFF GRAND SLAM") fit on all four variants
- [ ] All four sample teams (NYM/NYY/BAL/OAK) render OK on all four variants
- [ ] Version bumped
- [ ] Old `.pc-*` styles deleted, no orphan references
