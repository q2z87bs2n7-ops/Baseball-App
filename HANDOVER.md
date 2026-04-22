# Design Feedback — Handover to Claude Code

**Target file:** `mets-app.html` (v1.38)
**Branch rule:** per CLAUDE.md — all changes to `claude/review-readme-cx0F3`, bump `<title>` + settings version string per commit (`v1.xx.y`).

---

## TL;DR

34 small, targeted polish tweaks across the app. **Do P0 first** — it introduces two theme-aware CSS variables (`--accent`, `--header-text`) that unblock almost every other tweak from being cross-team-safe across all 30 color schemes. Without P0, the tweaks will look good on ~14 teams and break on the rest.

Two companion files in the project:
- **`mets-app-redesigned.html`** — Mets-only visual reference showing the end state. **Do NOT merge.** It uses raw `--orange` for accents, which is the exact bug P0 exists to fix. Use it as a sketch, not a patch.
- **`Feedback Deck.html`** — 12-slide deck with annotated screenshots explaining *why* each tweak exists.

---

## P0 · Theme architecture (prerequisite — do first)

The app has 30 team themes. 16 of them have a secondary color with luminance < 0.15, meaning the current pattern of "use `--orange` (= team secondary) as the on-dark accent" fails: kickers disappear on `--card`, active-row left-borders are invisible, hero stat values wash out. Three teams (Marlins, Giants, Orioles) have a light-enough primary that white header text fails WCAG.

**These are existing v1.38 bugs, not things introduced by the tweaks below** — they just become more obvious as the tweaks lean harder on the accent role.

### Introduce two new CSS vars

```js
// applyTeamTheme(team):
//
// --accent:  contrast-safe "accent on dark surface" color
//            raw secondary if it passes (luminance ≥ 0.18 AND contrast ≥ 3.0 on --card)
//            else: lightened secondary (HSL: keep hue, push L→ 65–70%)
//            else (hue unrecoverable): neutral warm #FFB273
//
// --header-text: text color on header gradient
//                #0a0f1e if primary luminance > 0.5, else #ffffff

function pickAccent(secondaryHex, cardHex) {
  const sLum = relLuminance(secondaryHex);
  const cOnCard = contrast(secondaryHex, cardHex);
  if (sLum >= 0.18 && cOnCard >= 3.0) return secondaryHex;
  const lifted = hslLighten(secondaryHex, 0.65);
  if (contrast(lifted, cardHex) >= 3.0) return lifted;
  return '#FFB273';
}

function pickHeaderText(primaryHex) {
  return relLuminance(primaryHex) > 0.5 ? '#0a0f1e' : '#ffffff';
}
```

`--orange` stays in the theme — it remains the raw brand secondary for surfaces that want the exact team color (solid buttons on dark, brand strips, etc.). Split-brain rule: *on-dark accent text and borders use `--accent`; solid brand fills use `--orange`.*

### Mechanical conversions after the vars exist

- [ ] Replace all hardcoded `rgba(255, 89, 16, .NN)` with `color-mix(in srgb, var(--accent) NN%, transparent)` (fall back to `rgba` via `@supports not (color: color-mix(…))` if needed). There is at least one literal instance in current CSS — a selection tint that doesn't theme at all today.
- [ ] Search `color: var(--orange)` used as text-on-dark → `color: var(--accent)`. Keep `--orange` only on: solid button backgrounds, the live-view primary gradient, and anywhere the intent is "raw brand fill."
- [ ] Replace `color: #fff` on header elements (`.logo`, `.logo span`, `nav button`, `.settings-btn`) with `var(--header-text)`.
- [ ] Change header `border-bottom` from `--orange` to `rgba(255,255,255,.08)` — the orange border is invisible on 12 themes.

### QA gate

Write a dev helper that cycles through all 30 teams and logs any where `contrast(computed --accent, computed --card) < 3.0` or `contrast(--header-text, primary) < 4.5`. Expect 0 after P0. Keep this script around — it's the regression test for future theme work.

---

## P1 · Visual clarity (highest user impact)

- [ ] **T2/T3 Nav active state.** Replace solid `--orange` pill with `rgba(accent, .12)` bg + `var(--accent)` text + `box-shadow: inset 0 -2px 0 var(--accent)`. Softer bottom-border feel, reads clearly on every theme. Also bump `nav { gap: 2px }` → `4px`, add `white-space: nowrap` to `nav button` so "Standings" stops wrapping mid-viewport.
- [ ] **T5 Matchup gradient.** In `gameGradient()` drop the 5-stop rainbow (away-primary → away-secondary → dark → home-secondary → home-primary). Use a clean 3-stop: `away-primary 0% → #111827 50% → home-primary 100%`. Border `1px solid rgba(255,255,255,.1)` (was `2px solid rgba(255,255,255,.15)`). Less carnival, more broadcast.
- [ ] **T11 W/L badges — outlined neutral pills.** W/L is semantic, not team-aware. Add `.badge-w { bg: rgba(34,197,94,.15); color: #7dd89e; border: 1px solid rgba(34,197,94,.55) }` and the red analogue for L. Apply in: home card, matchup grid, calendar cells, standings.
- [ ] **T14 Standings active row.** Drop the `● ` text prefix inside the team name (remove `(isActive?'● ':'')` in all four standings renderers). Replace with `box-shadow: inset 3px 0 0 var(--accent)` on the first cell + `background: color-mix(in srgb, var(--accent) 15%, transparent)` on the row. Cleaner, more scannable.
- [ ] **T15 Division header chip.** `.div-header` today is a solid blue pill. Make it a kicker: uppercase, `.08em` letter-spacing, `var(--accent)` text, `border-bottom: 1px solid var(--border)`, transparent bg. Feels lighter; matches the rest of the section-title treatment.
- [ ] **T24 Lead news item.** First `.news-item` in the Home news list gets more padding, bigger title (`1.05rem`, weight 600), and no dot — establishes a visual lead and rhythm vs the rest of the stack.
- [ ] **T29 Kicker unification.** Every `background: var(--blue)` on table headers, linescore headers, and info chips → kicker style (transparent, uppercase, letter-spaced, `var(--accent)` text, bottom-border `--border`). One consistent "section label" motif across the whole app.

## P2 · Info hierarchy

- [ ] **T6 Remove redundant UPCOMING pill.** In `renderGameBig` upcoming branch, if `label` matches `/TODAY/i` skip the UPCOMING pill (the kicker already says "Today"). In `renderNextGame`, drop the UPCOMING pill entirely — the card title "NEXT SERIES" is context enough.
- [ ] **T7 vs/@ gets weight.** Where "vs" / "@" is rendered above the opponent name on game cards, bump it: `font-size: 1.05rem`, `font-weight: 700`, `letter-spacing: .04em`, `opacity: .82`. Currently `1rem / 400 / .6` and disappears.
- [ ] **T8 Series-info line.** Drop italic, bump size to `.8rem`, color `rgba(255,255,255,.85)`, weight 500. Today it reads like a disclaimer; should read like a fact.
- [ ] **T9 Next Series row legibility.** The per-game rows sit on a gradient. Bump bg to `rgba(0,0,0,.4)` + add `1px solid rgba(255,255,255,.06)` so time/status text is readable regardless of which gradient stop it lands on.
- [ ] **T13 Calendar cell — single line.** Today each cell stacks `vs` / `@` on one line and the opponent name below. Combine into one line: `<span class="cal-ha">vs</span>Opp Name` with `white-space: nowrap; text-overflow: ellipsis`. More room for the result pill below, less cramped.
- [ ] **T16 WC cutoff note.** Drop italic on `.wc-note`. Matches T8 rationale.
- [ ] **T17 Wider main.** `max-width: 1200px` → `1360px`. The 3-col Stats section feels crunched at 1200; 1360 gives the Leaders / Roster / Player Stats columns room to breathe without losing center-of-screen feel.
- [ ] **T20 Hero stat box.** In `renderPlayerStats`, first stat per group (AVG for hitters, ERA for pitchers, FPCT for fielders) gets `.hero` class: spans 2 columns, `.stat-val` at `2.2rem` instead of `1.15rem`. Anchors the eye; the other 11 stats read as supporting.
- [ ] **T21 Jersey # on headshot.** Bottom-right of the headshot box, add a `.72rem / weight 800` pill: `var(--accent)` bg, `var(--accent-text)` fg, `#jerseyNumber`. Helps when the silhouette fallback renders for lesser-known players — at least the number differentiates.
- [ ] **T22 Matchup grid at 3 cols.** `.matchup-grid` base should be `repeat(3, 1fr)`, not 4. Keep the existing 1024px→2-col and 480px→1-col breakpoints. At 4 cols the cards are too squeezed for the score + record + status to breathe.

## P3 · Interaction

- [ ] **T18 Leader stat pill filter.** Above the `<select id="hitLeaderStat">` / `<select id="pitLeaderStat">` add a horizontal row of filter pills for the common cases (AVG/HR/RBI/OPS/H/SB for hitting; ERA/WHIP/K/W/SV for pitching). Clicking a pill sets the `<select>.value` and calls `loadLeaders()`. Keep `<select>` as the "more stats" fallback for the long tail. Same UX as the roster tab row — one click vs three.
- [ ] **T19 Selection-tint alpha.** Bump `.player-item.selected` and `.standings-table tr.active-row` background alpha from `.08` to `.15`. At `.08`, selection is too subtle when the accent is a lifted-fallback color; `.15` holds up.

## P4 · Polish

- [ ] **T10 Today cell.** `.cal-day.today` — keep the circular accent day-number, but also add `box-shadow: inset 0 0 0 1px var(--accent)` + `border-color: var(--accent)` so the whole cell is ringed. Makes "today" findable at a glance.
- [ ] **T12 Empty calendar cells.** Instead of `border-color: transparent`, use `border: 1px dashed rgba(30,45,74,.35)` so the grid still reads as a grid. Rhythm matters.
- [ ] **T23 LIVE dot alignment.** The `●` glyph inline-block-renders at baseline, floats above text. Replace with an SVG or a `display:inline-flex; align-items:center; gap:5px` wrapper + a `6x6` span dot. Small fix, big polish.
- [ ] **T25 Live header.** Drop the `2px solid var(--orange)` frame — gradient OR border, not both. Add `1px solid rgba(255,255,255,.08)` to keep the card defined.
- [ ] **T26 Live score gap.** `.live-score { gap: 48px }` (was 24). Three-digit scores bump into the `—` separator today.
- [ ] **T27 Count dot shape language.** Balls = circle outline (current), strikes = rounded-square (`border-radius: 2px`), outs = filled circle slightly larger (`16x16`). Color-code: balls `var(--accent)`, strikes `#ffb636`, outs `#ff4444`. Scannable at a glance without reading the label.
- [ ] **T28 Live team score color.** `color: var(--accent-text, #ffffff)` with fallback — on-brand primary surfaces, readable.
- [ ] **T31 Sub-kicker utility.** Add `.sub-kicker` class (`font-size: .68rem; weight 700; letter-spacing: .1em; color: var(--muted)`) for secondary labels inside cards, so the primary `.card-title` (`var(--accent)`) and the sub-kicker (`var(--muted)`) establish hierarchy instead of competing.
- [ ] **T32 First-paint theme flash.** In `applyTeamTheme`, persist `{--dark, --card, --card2, --border, --blue, --accent, --orange, --accent-text, --header-text}` to `localStorage.mlb_theme_vars`. Add an inline `<script>` in `<head>` *before* `<style>` that reads the key and sets the vars on `document.documentElement` pre-render. Kills the Mets-blue flash when a non-Mets theme is loaded.
- [ ] **T33 System font first.** `body { font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif }`. Currently Segoe UI first — Mac/iOS users fall back to sans-serif and lose a half-point of polish.
- [ ] **T34 Neutral muted.** `--muted: #9aa0a8` (neutral grey) instead of `#8892a4` (cool-blue). The current muted fights with blue-primary themes (Dodgers, Yankees, Rays) — text reads slightly purple. Neutral grey holds up across all 30.

---

## Mobile / responsive (v1.38 context)

v1.38 added a fixed bottom icon nav bar at ≤480px with `.nav-label` hidden. **All the tweaks above respect this** — none touch mobile nav positioning. T1's "nowrap nav" fix applies to desktop/tablet only (at ≤480px nav is already fixed-bottom). Don't regress the bottom-bar behavior.

---

## Out of scope (intentionally)

- MLB branding, logos, team marks — keep as-is
- The Live Game view section-level layout — the card grid works; only polish items inside (T23/T25–T28)
- Data source changes — MLB Stats API + ESPN proxy stays
- Media tab — YouTube proxy unchanged
