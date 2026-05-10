# MLB Tracker — Project Handoff

## What This Is
An MLB sports tracker, defaulting to the New York Mets. All data is pulled live from public APIs. Source lives under `src/` as ES6 modules, bundled with esbuild into `dist/app.bundle.js`; CSS in `styles.css`; HTML skeleton in `index.html`.

**Current version:** see `package.json` (full history in `CHANGELOG.md`)

**File:** `index.html` (renamed from `mets-app.html` at v1.40 for GitHub Pages)
**Default team:** New York Mets (id: 121)

---

## Workflow Rules

1. **Never assume** — always ask before proposing or touching any code
2. **Surgical edits only** — smallest possible change; do not reformat or reorganise surrounding code
3. **No changes without explicit user approval** — show old/new before applying
4. **Break changes into small steps** — confirm each works before proceeding
5. **Git branching** — all changes go to a `claude/` branch first; only merge to `main` when explicitly asked
6. **Debug code** — wrap temporary logging in `// DEBUG START` / `// DEBUG END` for easy removal
7. **Version every change** — bump `package.json` `"version"` only. The build (`npm run build`) propagates to settings panel, cache-bust query strings on `dist/*`, and `sw.js` `CACHE` constant via the esbuild `__APP_VERSION__` define in `build.mjs`. Use `X.Y.Z` format. On a `claude/` branch, increment the patch `Z` per commit (e.g. `4.13.3` → `4.13.4`). On merge to main, bump the minor `Y` and drop the patch in a separate commit (e.g. branch ships `4.13.4` → main becomes `4.14.0`); the next branch then starts adding patches against `4.14.0`. The `<title>` tag is intentionally version-free — do not add the version back.
8. **No rewrites** — never rewrite large sections. Targeted edits only.

---

## Architecture Overview

### Repo structure

Key files: `index.html` (HTML skeleton), `styles.css` (all CSS → built to `dist/styles.min.css`), `src/main.js` (~680 LOC boot + orchestration), `src/state.js` (single mutable state container), `src/config/constants.js` (SEASON, TEAMS, API bases), `dist/app.bundle.js` (built bundle — not committed), `build.mjs` (esbuild driver — `npm run build` → bundle + CSS; `npm run watch` for dev), `sw.js` (service worker), `api/` (Vercel serverless functions), `assets/vendor/` (runtime-dep IIFEs).

Full file map, layering rule, and runtime dependency table: `docs/module-graph.md`.

### Deployment
- **Public site + API (`/api/*`)**: Vercel — `https://baseball-app-sigma.vercel.app`. Runs `npm run build` on every push to main and serves the result. `dist/` is not committed.
- **Preview deploys**: GitHub Pages, via custom preview workflow that builds `claude/*` branches before publishing.
- **Cron**: GitHub Actions (free) pings `/api/notify` every 5 minutes

### Session Storage & Cross-Device Sync
Sign-in is **100% optional**. Signed-in users get card collection sync. Auth: GitHub OAuth + Email magic-link. Session: 40-char random token, 90-day TTL, `localStorage('mlb_session_token')`. Collection sync: `GET/PUT/POST /api/collection-sync` → Upstash Redis `collection:{userId}`. Merge: highest tier wins; same tier keeps newer `collectedAt` + merged events (deduped, capped 10). Vercel env vars required: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `EMAIL_API_KEY`, `EMAIL_FROM_ADDRESS`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`. Full setup: `docs/auth-architecture.md`.

**Rule:** before deleting any file in repo root or `icons/`, grep `index.html`, `src/`, `sw.js`, and `manifest.json` for references first. Full runtime dependency table: `docs/module-graph.md`.

### File responsibilities

| Change type | File |
|---|---|
| Add/move an HTML element, section, overlay, button | `index.html` |
| Change how something looks (colours, layout, spacing, animations) | `styles.css` |
| Add/fix a JS function, API call, game logic | `src/<subsystem>/*.js` (find module via `docs/module-graph.md`) |
| New cross-cutting state | `src/state.js` |
| New section loader / overlay | `src/sections/loaders.js` or new `src/sections/<name>.js` |
| New feature with HTML + CSS + JS aspects | `index.html` + `styles.css` + relevant `src/` modules |
| PWA caching behaviour or push notification handler | `sw.js` |
| Version bump | `index.html` (title + settings-version + bundle/CSS cache-bust `?v=`) |
| `CACHE` constant bump (forces PWA refresh) | `sw.js` |

**Script load chain:** `assets/vendor/pulse-card-templates.js` → `assets/vendor/focusCard.js` → `assets/vendor/collectionCard.js` → `dist/app.bundle.js` (all `<script defer>` in `<head>`, executed in order after the document parses). Theme-flash prevention snippet at `index.html:7` is the only inline-and-synchronous script — must stay inline. (Note: a previous dynamic script-insert pattern caused the bundle to execute **async**; the readyState guard in `src/dev/tuning.js` is no longer load-order-critical but is harmless.)

**Where to edit:** always edit `src/**/*.js` and rebuild the bundle (`npm run build`) before pushing.

### Key global state

All hot mutable state lives in `src/state.js` as properties of a single exported `state` object — every importer receives a live binding. Constants are in `src/config/constants.js`. Full declarations: `docs/global-state.md`.

**Mutation rule:** importers must mutate via `state.X` (e.g. `state.gameStates[pk] = newGame`). Never `let local = state.gameStates;` and reassign — that breaks the live binding for other modules. Reads via destructuring or `Object.values(state.gameStates)` are fine.

### Navigation
`showSection(id, btn)` — shows/hides sections by toggling `.active` class. Nav order: `pulse`, `home`, `schedule`, `league`, `news`, `standings`, `stats`. Live game view is a separate overlay (`#liveView`), not a section. `pulse` is lazy-initialised on first nav via `pulseInitialized` guard.

Mobile nav (≤480px), hashchange routing, per-section scroll memory, live-state nav dots, long-press shortcuts, and overflow sheets: `src/nav/behavior.js` + `src/nav/sheet.js`. Full implementation details: `docs/module-graph.md`.

### Team theming
`applyTeamTheme(team)` runtime-computes nine CSS variables (`--primary`, `--secondary`, `--accent`, `--accent-text`, `--header-text`, `--dark`, `--card`, `--card2`, `--border`) per active team. Persisted to `localStorage.mlb_theme_vars` and reapplied inline before `<style>` renders to prevent flash-of-wrong-theme. Full per-variable derivation rules + Pulse `--p-*` variants + utility classes: `docs/css-variables.md`.

---

## APIs

Full endpoint table (status, gotchas, query patterns) + external services + game-state string conventions: `docs/api-reference.md`.

**Most-used:** `/schedule`, `/standings`, `/people/{id}/stats?stats=…` (many variants — see api-reference). `MLB_BASE` = `https://statsapi.mlb.com/api/v1`; `MLB_BASE_V1_1` = `…/v1.1` (Pulse only — `v1` `feed/live` 404s).

---

## App Pages & Sections

Full per-section architecture, API sources, and layout details: `docs/sections.md`.

**Critical traps:**
- `gameGradient(g)` is away→home order — only used by `renderGameBig` (schedule/history cards). `renderNextGame` builds its own gradient so opponent is always left; using `gameGradient` there would be wrong for away games.
- `#playerCardOverlay` must stay top-level DOM (sibling of `#focusOverlay`, `#collectionOverlay`, `#devToolsPanel`) — never nested inside `#pulse`. Sections create stacking contexts that trap z-index. Current z-index: 600.

---

## Key Functions Reference

All bundle functions organised by subsystem: `docs/functions.md`. Key subsystem docs:
- Pulse feed, HR/RBI cards, video clips: `docs/pulse-feed.md`
- Story carousel generators and rotation: `docs/story-carousel.md`
- At-Bat Focus Mode: `docs/focus-mode.md`
- Card Collection: `docs/card-collection.md`
- Radio system: `docs/radio-system.md`
- Demo Mode: `docs/demo-mode.md`

---

## 🎯 At-Bat Focus Mode

Live pitch-by-pitch tracker. Auto-selects via `calcFocusScore()`; `focusIsManual=true` when user picks a game. Views: `#focusCard` (desktop rail), `#focusMiniBar` (mobile), `#focusOverlay` (full overlay, z-index 1100). Disabled in Demo Mode.

Full data flow, formula, pitch codes, `window.FocusCard` API: `docs/focus-mode.md`.

---

## 📖 Card Collection System

Auto-collects HR/RBI player cards on live events (not demo). 4 tiers: common < rare < epic < legendary — higher replaces slot. `#collectionOverlay` (z-index 500); synced to Redis when signed in.

Full tier definitions, data model, lifecycle, `window.CollectionCard` API: `docs/card-collection.md`.

---

## 📻 Live Game Radio System

Background sports-radio auto-paired to the focused game. Controlled by `APPROVED_RADIO_TEAM_IDS` in `src/radio/stations.js`; falls through to Fox Sports Radio. To enable/disable a team: edit that Set, bump comment date, bump version + `sw.js` CACHE.

Enabled teams, disabled teams, Radio Check tool, Hls.js routing: `docs/radio-system.md`.

---

## 📽️ Demo Mode

Self-contained replay of April 27-28, 2026 from `assets/daily-events.json` (562KB, 619 plays, 23 games). No API calls. Speeds: 1x (10s/play), 10x (1s/play), 100x (100ms/play). Toggle via `Shift+M` or "▶ Try Demo" button.

`devTuning` object, all demo globals, key functions: `docs/demo-mode.md`.

---

## PWA & Push Notifications

Manifest uses relative paths (required for GitHub Pages subdirectory). Splash screen (`#appSplash`) is inline in `index.html` — edit it there directly. Push via `api/notify.js`; deduplicates via Redis. On every content commit bump: `<title>`, settings-panel version, `CACHE` in `sw.js`.

Icons, splash lifecycle, VAPID key storage, cron setup: `docs/pwa-push.md`.

---

## Dev Tools

`Shift+D` opens the Dev Tools panel. `Shift+M` toggles Demo Mode. `Shift+I` copies a full diagnostic snapshot to clipboard.

Full keyboard shortcut table (13 chords), panel contents, tuning fields + defaults, `replayHRCard()` details, inspector + snapshot details: `docs/dev-tools.md`.

---

## ⚠️ Critical Gotchas

Subtle bugs that could be silently re-introduced. Full descriptions + reproductions: `docs/KNOWN_ISSUES.md`.

1. **Date params use local time** — never `toISOString().split('T')[0]` for `startDate` / `endDate` (off-by-one after ~8pm ET). Use `etDateStr()` / `etDatePlus()` from `src/utils/format.js`.
2. **Audacy radio rights gap** — `live.amperwave.net/manifest/audacy-*` URLs play alternate content during games, not the broadcast. Never add Audacy URLs to `APPROVED_RADIO_TEAM_IDS`.

---

## Hardcoding Risks

| Item | Risk | Fix |
|---|---|---|
| `SEASON = 2026` | Must update each season | Derive from system date or MLB API |
| Team colours in TEAMS array | Teams rebrand | Verify each offseason |
| ESPN team IDs | Different system from MLB IDs | Verified Apr 2026 — re-verify each offseason |
| `WC_SPOTS = 3` | Rule change risk | Already a named const |
| ESPN API endpoint | Unofficial, undocumented | Monitor for breakage |
| MLB Stats API base URL | Unofficial | Watch for deprecation |
| Leaders `cats` array order | Index-based mapping — order matters | Re-test empirically if results look wrong |
| allorigins.win proxy URL | Free public proxy, no SLA | Swap URL if it goes down; retry logic in place |
| YouTube channel IDs (`youtubeUC`) | Teams may rebrand/change channels | Verify each offseason |
| Game state strings | MLB uses both `"Preview"` and `"Scheduled"` | Both checked — verify if new states appear |
| `MLB_TEAM_RADIO` URLs | radio.net-sourced; stations may change CDNs | Re-run 🔍 Radio Check sweep periodically |
| `APPROVED_RADIO_TEAM_IDS` Set | Hand-curated — last updated 2026-05-06 | Update Set when sweep results change |
| Hls.js CDN URL | `cdn.jsdelivr.net/npm/hls.js@1.5.18` — pinned, free CDN | Bundle locally if CDN unreliable |
| `NEWS_IMAGE_HOSTS` allowlist | Hand-curated CDN domain list — thumbnails silently fall back to placeholder if CDN changes | Add new hostname to `NEWS_IMAGE_HOSTS` regex in `src/utils/news.js` |

---

## Stat Display Conventions

| Category | Stats | Format | Rule |
|---|---|---|---|
| Rate (no leading zero) | AVG, OBP, SLG, OPS, FPCT | `.xxx` | `fmtRate(v)` — strips leading zero when 0 < val < 1 |
| Traditional pitching | ERA | `z.xx` | `fmt(v, 2)` |
| Traditional pitching | WHIP | `z.xx` | `fmt(v, 2)` |
| Per-9 / ratio | K/9, BB/9, K/BB | `z.xx` | `fmt(v, 2)` |
| Innings pitched | IP | `x.x` | Pass-through string — tenths = outs, not fractions. Never parse/round. |
| Counting | HR, RBI, H, K, BB, R, SB, PA, AB, W, L, SV, GS, ER, PC, E, PO, A, TC, DP | integer | Raw value, no `toFixed` |

---

## Feature Backlog

Full backlog in `docs/BACKLOG.md`. Active blocker: card binder scroll on desktop (see `docs/KNOWN_ISSUES.md` #7).

---

## Technical Debt Management

Say *"Start tech debt sprint"* to trigger a sprint. Claude executes: Audit → Remediation → QA → UAT → Finalization, with explicit user checkpoints between each stage.

- **Process guide:** `docs/technical-debt/WORKFLOW.md`
- **Quick reference:** `docs/technical-debt/README.md`
- **Completed sprints:** `docs/technical-debt/HISTORY.md`
- **All audits:** `docs/technical-debt/audits/`, `remediation/`, `qa/`, `sprints/`
