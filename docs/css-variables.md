# MLB Tracker — CSS Variables & Design System

All CSS variables are **runtime-computed** — set dynamically by `applyTeamTheme()` and `applyPulseMLBTheme()` in `src/ui/theme.js`. They are **not** declared in `styles.css`.

## Team-theme variables (set by `applyTeamTheme`)

```css
--primary       /* team primary — header, active nav */
--secondary     /* team accent — highlights, badges, card titles */
--accent        /* contrast-safe accent for text/borders on dark — computed per-team */
--header-text   /* text on header gradient — #0a0f1e or #ffffff based on primary luminance */
--accent-text   /* text ON --secondary surfaces */
--dark          /* page background */
--card          /* card background */
--card2         /* secondary card / input background */
--border        /* borders */
--text          /* #e8eaf0 — body text (fixed) */
--muted         /* #9aa0a8 — secondary text (fixed) */
```

### Computation algorithm (`applyTeamTheme`)

| Variable | Value |
|---|---|
| `--primary` | Team primary colour — header, active nav |
| `--secondary` | Team accent — secondary if contrast ≥ 3:1 AND luminance ≥ 0.05, else `#ffffff` |
| `--accent-text` | Text ON `--secondary` surfaces — black or white based on luminance |
| `--dark` | Page background — hsl(teamHue, 50%, 18%) |
| `--card` | Card background — hsl(teamHue, 45%, 22%) |
| `--card2` | Secondary card / input — hsl(teamHue, 40%, 26%) |
| `--border` | Borders — hsl(teamHue, 35%, 30%) |
| `--accent` | Contrast-safe accent for text/borders on dark surfaces — raw secondary if lum≥0.18 && contrast≥3.0 on --card, else HSL-lightened to L=65%, else #FFB273 |
| `--header-text` | Text colour on header gradient — #0a0f1e if primary luminance > 0.5, else #ffffff |

**Accent luminance floor:** if the computed accent has luminance < 0.05 (near-black, e.g. Giants/Orioles secondary `#27251F`), it is forced to `#ffffff`.

**Split-brain rule:** on-dark accent text and borders use `--accent`; solid brand fills use `--secondary`.

**Theme persistence (T32):** `applyTeamTheme` writes all 9 vars to `localStorage.mlb_theme_vars`. An inline `<script>` in `<head>` reads and applies these vars before `<style>` renders, preventing flash-of-wrong-theme on reload.

## Pulse-specific variables (set by `applyPulseMLBTheme`)

```css
/* Dimension constants */
--header-h      /* 60px — used by Pulse ticker sticky offset and soundPanel top position */
--ticker-h      /* 50px — min-height of #gameTicker */
--mockbar-h     /* 48px — height of #mockBar */

/* Feed tint layers */
--scoring-bg / --scoring-border   /* green tint for scoring play feed items */
--hr-bg / --hr-border             /* amber tint for home run feed items */
--risp-accent                     /* yellow — defined but no longer used as border stripe; RISP items rely on ⚡ badge only */
--status-bg / --status-border     /* blue tint for status-change feed items */

/* Pulse theme indirection tokens (v3.22.9) */
/* Set globally by applyPulseMLBTheme(). Re-mapped inside #pulse and #yesterday via
   --dark: var(--p-dark) etc., so Pulse sections get theme colors while the rest of
   the app (settings panel, header) continues to read the team-color --dark/--card vars. */
--p-dark / --p-card / --p-card2 / --p-border   /* background layers */
--p-accent / --p-accent-soft / --p-accent-strong /* accent shades */
--p-text / --p-muted                            /* text layers */
--p-scoring-bg / --p-scoring-border             /* feed scoring tint */
--p-hr-bg / --p-hr-border                       /* feed HR tint */
--p-status-bg / --p-status-border               /* feed status-change tint */
```

## V3 design tokens (added v3.31)

```css
--radius-sm   /* 6px  — chips, inset elements, ghost buttons */
--radius      /* 10px — default card / surface radius */
--radius-lg   /* 14px — hero cards (Next Game, Next Series, Live header) */
--radius-pill /* 999px — pill toggles, primary CTAs */
--eyebrow-sz  /* .68rem — uppercase kicker labels */
--eyebrow-ls  /* .1em   — eyebrow letter-spacing */
--eyebrow-fw  /* 700    — eyebrow font-weight */
--score-hero  /* 38px   — hero scoreboard digits */
--score-md    /* 1.4rem — secondary scoreboard digits */
--score-sm    /* 1.1rem — matchup-grid scoreboard digits */
--name-hero   /* 26px   — hero team name */
--name-md     /* .95rem — secondary team name */
--tint-primary        /* color-mix(--primary 10%, transparent) — subtle team-color overlay */
--tint-primary-strong /* color-mix(--primary 14%, transparent) — top-of-hero tint */
--accent-line         /* 2px solid var(--primary) — accent stripe (active rows, hero top, WC cutoff) */
--opp-primary         /* set inline on .surface-hero.has-opp-tint via style="--opp-primary:#XXX";
                         consumed by .has-opp-tint horizontal gradient. Computed by pickOppColor()
                         to avoid clash with user's primary. */
```

## V3 utility classes

| Class | Purpose |
|---|---|
| `.eyebrow` / `.eyebrow--accent` | Uppercase kicker label (.68rem, .1em tracking, 700 weight). Accent variant for card titles. |
| `.surface` | Default neutral chrome — `var(--card)` + 1px `var(--border)` + `var(--radius)`. |
| `.surface-hero` | Toned-down hero card — `var(--card)` + `--tint-primary-strong` top fade + `var(--accent-line)` top stripe + `var(--radius-lg)`. |
| `.surface-hero.has-opp-tint` | Adds horizontal opp-color tint from the left, fed by `--opp-primary` CSS var. |
| `.surface-hero.has-ghost` | Modifier for hero cards with absolute-positioned `.series-ghost` opp-logo (Next Series). Applies `position:relative; overflow:hidden`. |
| `.surface-tinted` | Subtle primary-tint variant of `.surface`. |
| `.pill` / `.pill.is-active` | Pill toggle primitive — pill radius, transparent until active. Active state solid `var(--secondary)`. Used by `.stat-tab` (inheriting), live-view boxscore tabs, and any tab toggle. |
| `.btn-ghost` | Transparent button with border — `var(--radius-sm)`, accent border + color on hover. Refresh / back / cal-nav buttons. |
| `.btn-primary` | Solid primary CTA — `var(--secondary)` bg, `--accent-text` color, `var(--radius-sm)`. |
| `.score-hero/-md/-sm`, `.name-hero/-md` | Typography primitives consuming the score/name scale tokens. |
| `.empty-state` | Generic muted/centered "no data" pill (`color:var(--muted); padding:16px; text-align:center; font-size:.85rem`). |
| `.live-indicator` | Bold green LIVE label (`color:#22c55e; font-weight:700`). |
| `.linescore-scroll` | Horizontal-scroll wrapper for `.linescore-table` on narrow viewports. |
| `.linescore-table .rhe-start` | 2px left-border separator before the R column (header + RHE row cells). |
| `.settings-row` (+ `--block`) | Unified settings panel row pattern — flex row with consistent padding/border-top. Block variant stacks label above content. |
| `.settings-row__label`, `.settings-section-label`, `.settings-select`, `.settings-action`, `.settings-toggle(/-knob)`, `.settings-version` | Settings panel primitives (added v3.30.11). |
| `.matchup-status(.is-live)`, `.matchup-live-dot`, `.matchup-score-row`, `.matchup-team`, `.matchup-abbr`, `.matchup-record`, `.matchup-score(.is-dim)`, `.matchup-divider`, `.matchup-vs` | Around the League matchup grid card chrome (added v3.30.5). |
| `.leader-stat-card`, `.leader-stat-label`, `.leader-row(/-row-left)`, `.leader-rank`, `.leader-name`, `.leader-val` | League / team stat-leader card chrome (added v3.30.5). |
| `.detail-separator`, `.detail-game-label`, `.detail-team-header`, `.detail-highlight-*` (thumb/overlay/play/arrow/video/meta/kicker/title), `.detail-summary-note/-row/-label` | Schedule game-detail panel chrome (added v3.30.6). |
| `.headshot-frame` (+ `img` selector), `.headshot-jersey-pill`, `.player-chevron`, `.stat-grid.--cols-3/-4` | Stats panel chrome (added v3.30.7). |
| `.live-status`, `.live-score-divider`, `.live-stack-card`, `.boxscore-tabs`, `.matchup-stats.is-strong` | Live view chrome (added v3.30.8). |
| `.hero-kicker-row`, `.hero-divider`, `.hero-bottom-row`, `.hero-meta(-strong)`, `.hero-live-meta`, `.hero-live-dot`, `.hero-content`, `.hero-top-row`, `.hero-meta-right`, `.hero-opp-row`, `.hero-opp-name`, `.hero-opp-meta`, `.hero-day-strip`, `.hero-day-cell`, `.hero-day-label`, `.hero-day-time`, `.hero-day-live`, `.hero-day-score`, `.ng-team-left`, `.ng-team-right`, `.watch-live-btn`, `.cal-nav-btn`, `.wc-cutoff-row`, `.wc-cutoff-label` | Hero card + supporting chrome (added v3.30.9–v3.30.10). |

## Responsive breakpoints

Single `@media` block at end of `styles.css`.

| Breakpoint | Behaviour |
|---|---|
| `≤1024px` (iPad landscape + portrait) | `.grid3` and `.live-grid` collapse to 1 col; `.matchup-grid` goes 3→2 cols; header wraps; `.main` padding reduced to 12px |
| `≤1024px and ≥481px` (tablet band) | header `flex-wrap:nowrap`; `.logo span` hidden; nav icon-only (`.nav-label` hidden); header `z-index:100` **must stay 100** — sticky header stacking context; `.settings-panel` (z-index:200) would render under `#gameTicker` (z-index:90) if header drops below 100 |
| `≤767px` (portrait / phone) | `.grid2` collapses to 1 col; `.card-cap` shrinks to 40px; `.series-ghost` shrinks to 220px |
| `≤480px` (iPhone) | `html,body{overflow-x:hidden}` (both required — iOS Safari independent scroll contexts); nav becomes fixed bottom bar with short labels (`.nav-label` shown at 9.5px); `.team-chip` hidden; header scrolls away; `.game-big{padding:16px}`; `.live-view` side padding zeroed; `.ng-grid{gap:8px}`, `.ng-name{font-size:18px}`, `.ng-score{font-size:26px}` (long team names overflow on 375–390px phones); `.stat-grid` → 2-col; `.game-notes-grid`, `.media-layout`, `.league-leaders-grid` → 1-col; `.cal-day` min-height 44px; `padding-bottom:calc(72px + env(safe-area-inset-bottom))` |

## Layout utility classes

| Class | Grid | Collapses at |
|---|---|---|
| `.grid2` | 2-col, 1fr 1fr, 16px gap | 767px |
| `.grid3` | 3-col, 1fr 1fr 1fr, 16px gap | 1024px |
| `.matchup-grid` | 3-col, repeat(3,1fr), 8px gap | 1024px→2col, 480px→1col |
| `.live-grid` | 3-col unequal (1fr 1.2fr 1.4fr) | 1024px |
| `.live-card` | card inside `.live-grid`; `min-width:0` required (grid items default to `auto`, lets table content overflow) | — |
| `.media-layout` | 25%/75% grid for Home YouTube widget | 480px |
| `.league-leaders-grid` | 2-col for league leader panels | 480px |
| `.ng-grid` / `.ng-name` / `.ng-score` | 5-col Next Game card row; font sizing classes used only by ≤480px media query | — |

**Rule:** All layout grids must use CSS classes, not inline `style=` grid definitions — so the `@media` block can override them without touching HTML.
