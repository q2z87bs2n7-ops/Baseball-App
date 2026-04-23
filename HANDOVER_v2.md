# MLB Tracker — Design Review v2 Handover

**Audience:** Claude Code (next agent to implement these changes on the `index.html` single-file app).
**Companion file:** `Mobile & iPad Mocks.html` — open this in a browser to see the visual targets for every change in this doc. It renders across 4 teams (Mets / Pirates / Marlins / Cardinals) to verify contrast across edge cases.

---

## Context

- **App:** single-file HTML PWA at `index.html` (see `CLAUDE.md` for full architecture).
- **Current version to bump from:** `v1.40` → `v1.41`. Also bump `CACHE` in `sw.js` (`mlb-v4` → `mlb-v5`).
- **Theme system:** 30 teams, `applyTeamTheme(team)` sets 9 CSS vars (`--blue`, `--orange`, `--accent`, `--accent-text`, `--header-text`, `--dark`, `--card`, `--card2`, `--border`). All fixes below must respect this — never hardcode team colors. Use `var(--*)` throughout.
- **Workflow rules to follow:** surgical edits only, small commits, bump title + in-app version string on every change, use `claude/` branch, wrap temp logging in `// DEBUG START/END`.

---

## P0 — Mobile bottom nav refresh

**File:** `index.html`, `@media (max-width:480px)` block + `<nav>` markup.

**Goal:** readable labels, safe-area padding, themed active state, proper tap targets. 6 items: Home / Sched / Stand / Stats / News / League. (Media stays hidden for now — leave `#mediaNavBtn` with `display:none` default.)

### Changes

1. **Shorten nav labels globally** in the `.nav-label` spans of each `<nav>` button so they fit on a 375px phone without collapsing to icon-only:
   - "Schedule" → "Sched"
   - "Standings" → "Stand"
   - "Around the League" → "League"
   - (Home, Stats, News keep as-is)

2. **Update the `@media (max-width:480px)` nav rules** (currently hides labels entirely):

   ```css
   @media(max-width:480px){
     header{position:static;justify-content:space-between}
     nav{
       position:fixed; bottom:0; left:0; right:0; z-index:100;
       background: color-mix(in srgb, var(--blue) 94%, transparent);
       backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
       border-top: 1px solid rgba(255,255,255,.08);
       display:flex; gap:0; flex-wrap:nowrap;
       padding: 8px 0 calc(8px + env(safe-area-inset-bottom));
     }
     nav button{
       flex:1; min-width:0;
       padding: 8px 2px; min-height: 56px;
       display:flex; flex-direction:column; align-items:center; justify-content:center;
       gap: 3px;
       background: transparent !important;   /* override desktop active bg */
       border-radius: 0 !important;
       color: color-mix(in srgb, var(--header-text) 65%, transparent);
       font-size: 1.15rem;
     }
     nav button.active{
       background: transparent !important;
       color: var(--accent);
       box-shadow: inset 0 2px 0 var(--accent);
     }
     nav button .nav-label{
       display: inline !important;  /* override "hide labels" rule */
       font-size: 9.5px; font-weight: 600; letter-spacing: .01em;
       white-space: nowrap;
     }
     .main{ padding-bottom: calc(72px + env(safe-area-inset-bottom)) }
     .live-view{ padding-bottom: calc(72px + env(safe-area-inset-bottom)) }
     /* …rest of existing rules unchanged… */
   }
   ```

3. **Remove the old `2px solid var(--orange)` border-top and orange pill bg** — the new rules above replace it with a soft 1px border + accent underline for active.

**Why it's themed correctly:** active state now uses `var(--accent)` (the contrast-safe derivative), not `var(--orange)` directly. `--header-text` is already computed per-team based on primary luminance, so inactive label color works on light-primary teams (Marlins, Athletics, etc).

**Verification:** at 375px width, test on Mets, Pirates, Marlins, Cardinals. All 6 labels should be visible, active state should have an accent underline, home indicator should not crowd the bar.

---

## P0 — iPad portrait header (prevent wrap)

**File:** `index.html`, header markup + new media query.

**Goal:** at ≤1024px (iPad portrait), nav stays on one line, settings cog stays visible, labels collapse to icons.

### Changes

1. **Add a new media query block** for the tablet band (between the existing 1024px and 480px rules). Paste BEFORE the `@media(max-width:480px)` block:

   ```css
   @media (max-width: 1024px) and (min-width: 481px) {
     header {
       flex-wrap: nowrap;
       position: sticky; top: 0; z-index: 50;
       padding: 10px 16px;
     }
     .logo span { display: none; }      /* hide "METS" wordmark, keep logo SVG */
     nav {
       flex-wrap: nowrap;
       gap: 2px;
     }
     nav button {
       padding: 8px 10px;
       font-size: 1.1rem;
     }
     nav button .nav-label { display: none; }  /* icons only on tablet */
     .settings-wrap { flex-shrink: 0; }
   }
   ```

2. **Add a static team-name chip** to the header, right after the logo, visible at all sizes.
   In the header markup:

   ```html
   <div class="logo">
     <img id="logoImg" src="..." style="height:32px;width:32px">
     <span id="logoWordmark">METS</span>
   </div>
   <div class="team-chip" id="teamChip">METS</div>   <!-- NEW -->
   <nav>...</nav>
   ```

   **Important (per user):** the team chip is a **static label only — not a dropdown or menu trigger.** Team switching stays in the Settings panel. Do not add a chevron, click handler, or hover affordance.

   CSS:

   ```css
   .team-chip {
     background: rgba(0,0,0,.2);
     border: 1px solid rgba(255,255,255,.1);
     padding: 6px 12px;
     border-radius: 20px;
     color: var(--header-text);
     font-size: 12px;
     font-weight: 600;
     letter-spacing: .04em;
     white-space: nowrap;
   }
   @media (max-width: 480px) { .team-chip { display: none; } }  /* hide on phone, wordmark already small */
   ```

   Update `applyTeamTheme(team)` to also set the chip text:
   ```js
   document.getElementById('teamChip').textContent = team.name.toUpperCase();
   ```

3. **Optional cleanup:** on desktop (>1024px), when the nav active state uses `var(--orange)` as background, some teams (Cardinals, Giants) render active text unreadably. Switch the active style to:
   ```css
   nav button.active {
     background: color-mix(in srgb, var(--accent) 14%, transparent);
     color: var(--accent);
     box-shadow: inset 0 -2px 0 var(--accent);
   }
   ```
   This matches the redesign in the mocks and is theme-safe across all 30 teams.

**Verification:** resize to 820px wide — nav should stay horizontal, settings cog stays right-aligned, team chip and logo both visible. Test on Cardinals (dark secondary) to confirm active state is readable.

---

## P1 — PWA icon (direction 1: Diamond)

**Goal:** replace the existing Mets-themed stitching-circle icon with a team-neutral top-down baseball diamond on deep navy.

### Design spec

- **Background:** `#0F1B33` (deep navy — neutral, not Mets-blue `#002D72`).
- **Canvas:** 512×512 for main icon, 192×192 for smaller.
- **Safe zone:** center 80% (20% padding on all sides) — maskable-safe.
- **Accent color:** `#E85D1F` (neutral warm — between orange and red, not Mets orange).

### SVG source (to be rasterized)

```svg
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" fill="#0F1B33"/>
  <g transform="translate(256 256) rotate(45)">
    <!-- outfield arc -->
    <path d="M -195 -195 A 276 276 0 0 1 195 -195 L 195 195 L -195 195 Z"
          fill="none" stroke="#F5F1E8" stroke-width="10" opacity=".35"/>
    <!-- infield -->
    <rect x="-128" y="-128" width="256" height="256" fill="none" stroke="#F5F1E8" stroke-width="13" rx="13"/>
    <!-- bases -->
    <rect x="-27" y="-155" width="54" height="54" fill="#E85D1F" rx="7"/>
    <rect x="-155" y="-27" width="54" height="54" fill="#F5F1E8" rx="7"/>
    <rect x="101" y="-27" width="54" height="54" fill="#F5F1E8" rx="7"/>
    <rect x="-27" y="101" width="54" height="54" fill="#F5F1E8" rx="7"/>
    <!-- pitcher mound -->
    <circle cx="0" cy="0" r="17" fill="#E85D1F"/>
  </g>
</svg>
```

### Files to generate

Put all of these in `/icons/`:

| File | Size | Purpose |
|---|---|---|
| `icon-512.png` | 512×512 | Main PWA icon (maskable + any) |
| `icon-192.png` | 192×192 | Legacy Android |
| `icon-180.png` | 180×180 | iOS apple-touch-icon |
| `icon-maskable-512.png` | 512×512 | Maskable-only variant (same art, verify 20% safe-zone not cropped) |
| `icon-mono.svg` | vector | Monochrome tinted homescreen (iOS 16.4+) — white diamond on transparent |
| `favicon.svg` | vector | Browser tab |

### `manifest.json` updates

```json
{
  "name": "MLB Tracker",
  "short_name": "MLB",
  "orientation": "any",
  "theme_color": "#002D72",
  "background_color": "#0F1B33",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" },
    { "src": "icons/icon-mono.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "monochrome" }
  ]
}
```

- `orientation` was `"portrait-primary"` — change to `"any"` so iPad landscape works.
- `theme_color` stays Mets (`#002D72`) as the default team baseline.

### `index.html` `<head>` additions

```html
<link rel="icon" type="image/svg+xml" href="icons/favicon.svg">
<link rel="apple-touch-icon" href="icons/icon-180.png">
<meta name="theme-color" content="#002D72" id="themeColorMeta">
```

Then in `applyTeamTheme(team)`, dynamically update the status-bar color:
```js
document.getElementById('themeColorMeta').setAttribute('content', team.primary);
```

**Note:** user indicated they may revisit icon direction later. This is direction 1 of 14 reviewed. The other 13 live in `Mobile & iPad Mocks.html` section 4 if re-exploration is needed.

---

## P2 — Theme consistency: mobile nav + iPad header border softening

The current heavy `2px solid var(--orange)` border-top on mobile nav and header-bottom on desktop reads loud and fails on dark-secondary teams. Already covered in P0 changes above — noting here as a deliberate system-wide shift: **replace hard `var(--orange)` borders with `1px solid rgba(255,255,255,.08)`** anywhere they're used as decorative dividers on dark backgrounds. Exception: keep `var(--orange)` for functional UI (badges, buttons, chart accents).

Grep for `border-top:2px solid var(--orange)` and `border-bottom:2px solid var(--orange)` in `index.html`. Evaluate each on a case-by-case basis — most should soften.

---

## Out of scope for this pass

These were reviewed and deferred (noted so they don't get lost):

- **Mobile calendar list view** (current 7-col grid at 375px is cramped but functional — user approved current pattern for now; redesign in mocks is available for future work).
- **Install prompt / `beforeinstallprompt` / pull-to-refresh / offline fallback.**
- **Consolidating nav to 4–5 items with overflow "More"** — user confirmed they want all 6 in the bar despite it being unconventional at 375px.
- **Further icon directions (2–14)** — revisit later if Diamond doesn't feel right after deployment.

---

## Verification checklist

Before merging to `main`:

1. ✅ Version bumped in `<title>` and settings panel string (v1.40 → v1.41).
2. ✅ `CACHE` bumped in `sw.js` (mlb-v4 → mlb-v5).
3. ✅ At 375px wide: all 6 nav labels visible, safe-area padding respected (test on iPhone with home indicator), active state uses accent underline.
4. ✅ At 820px wide: header stays on one line, settings cog visible, team chip shows (no dropdown chevron).
5. ✅ Install PWA on iOS — new Diamond icon appears correctly, not cropped after mask.
6. ✅ Switch team to Cardinals / Pirates / Marlins — confirm mobile nav active state, header team chip, and status bar color all theme correctly.
7. ✅ No new console errors, no layout shift on theme swap.

---

## Files changed (expected)

- `index.html` — header markup, CSS media queries, `applyTeamTheme` additions, version strings, `<head>` links.
- `manifest.json` — icon entries, orientation, background color.
- `sw.js` — CACHE version bump.
- `icons/` — 6 new files (see icon table above).

No JS logic changes beyond `applyTeamTheme` additions and `teamChip.textContent` set. No API changes. No data-model changes.
