# Feature Backlog

Extracted from `CLAUDE.md` — tracks completed and pending features. Active blocker is marked at the top.

**Active blocker:** Card binder scroll on desktop — see item below marked `[ ]` under "Card Collection".

---

### 📊 Stats Tab — Team Rank (pending)

- [ ] **Team Stats tile MLB rank chips** — `fetchTeamRanks()` removed in v4.16.9 pending investigation. The `/stats/leaders?statsType=byTeam` endpoint behaviour is unverified: if `statsType=byTeam` is silently ignored the API returns player leaders, making `findIndex(l.team.id === teamId)` find the first player from that team rather than a true team rank. Needs: (1) confirm correct endpoint/params for team-vs-team ranks, (2) verify response shape has `l.team.id`, (3) confirm API sort direction matches polarity (ERA lower = better → rank 1 = best), (4) re-implement with `sportId=1` to restrict pool to 30 MLB teams.

---

### 📊 Stats Tab Revamp — Sprints 1 + 2 (v4.7)

- [x] Stats v2 — Team Stats card with team-wide hitting+pitching tiles + record/last-10/run-diff form line; rank chip uses `--accent` (Sprint 1 / Step 2, v4.6.9)
- [x] Stats v2 — `src/utils/stats-math.js` foundation: `LEADER_CATS_FOR_PERCENTILE` catalog, `fetchLeagueLeaders`, `computePercentile`, `tierFromPercentile`, `pctBar`, `rankCaption` (Sprint 1 / Step 1, v4.6.9)
- [x] Stats v2 — Percentile bars + `MLB · #N` rank caption + tier coloring on every percentile-eligible stat box (Sprint 1 / Step 3, v4.6.9)
- [x] Stats v2 — vs-MLB / vs-team comparison: `[VS MLB]` / `[VS TEAM]` basis pills + `Avg: X` chip per box, polarity-aware coloring (Sprint 1 / Step 4 + v4.6.12 fix)
- [x] Stats v2 — HOT/COLD inline badges next to hitter names where last-15 OPS Δ vs season OPS ≥ ±0.080 (Sprint 1 / Step 5, v4.6.10)
- [x] Stats v2 — Hero panel in Player Stats: 4rem display number + rank + percentile bar + Avg chip + `★ Elite · Top X%` pill, tier-colored (Sprint 1 / Step 6, v4.6.10)
- [x] Stats v2 — Qualified-leader toggle on the Leaders card (PA ≥ 3.1×G hitters, IP ≥ 1×G pitchers, default ON, persisted) (Sprint 1 / Step 7, v4.6.11)
- [x] Stats v2 — Roster grouping by position (C / IF / OF / DH / SP / RP) with sticky section headers + inline stat under each name + mini-bar vs team-best (Sprint 1 / Step 8, v4.6.11)
- [x] Stats v2 — Expanded leader pill set + `+ more` overflow with extras row (Sprint 1 / Step 9, v4.6.11)
- [x] Stats v2 — Tabbed Player Stats card (Overview / Splits / Game Log / Advanced) with persistent active tab + class-flip switching (Sprint 2 / Step 1, v4.6.13)
- [x] Stats v2 — Last-10 Game Log strip with W/L + HR borders, tap → `showLiveGame`, L10 summary (Sprint 2 / Step 2, v4.6.13)
- [x] Stats v2 — 7-day rolling sparkline in the hero panel (AVG/OPS for hitters, ERA for pitchers; pitching y-inverted) (Sprint 2 / Step 3, v4.6.13)
- [x] Stats v2 — Splits panel (vs Handedness / Home-Away / RISP / Bases Empty / Runners On / Late & Close) with mini-bars (Sprint 2 / Step 4, v4.6.14)
- [x] Stats v2 — Pitch arsenal donut on Advanced tab for pitchers with deterministic pitch-type colors + ranked list (Sprint 2 / Step 5, v4.6.14)
### 📊 Stats Tab Revamp — Sprint 3 (v4.7)

- [x] Stats v3 — Statcast / Advanced for hitters (#13). Sabermetrics + seasonAdvanced metric grid (wOBA · BABIP · wRC+ hero, ISO / wRAA / wRC / BB rate / K rate / P/PA / AB/HR / GO/AO / XBH / TB grid). Note that Baseball Savant Statcast (xBA / xwOBA / exit velo / barrel rate / sprint speed) is NOT proxied — would require a separate Savant proxy effort. (Sprint 3 Batch A, v4.6.18 + v4.6.19 fix)
- [x] Stats v3 — Today's Leaders (#12). MLB-wide top-5 leaderboards card with hitting/pitching tab toggle; reuses `state.leagueLeaders` cache. (Sprint 3 Batch A, v4.6.18 + v4.6.19 fix)
- [x] Stats v3 — Career history (#15). Year-by-year tables (hitting + pitching) inside a new "Career" tab on the Player Stats card. Two-way players get both. (Sprint 3 Batch B, v4.6.20 + v4.6.21)
- [x] Stats v3 — Strike-zone heat map (#14). 3x3 inner-zone batting AVG grid from `?stats=hotColdZones` rendered inside the Advanced tab. Statcast spray-chart coords require Baseball Savant — out of scope. (Sprint 3 Batch C, v4.6.22)
- [x] Stats v3 — Compare overlay (#11). Same-team head-to-head with player picker + side-by-side stat grid (winner highlighted, polarity-aware). Cross-team compare deferred. (Sprint 3 Batch D, v4.6.24)
- [x] Stats v3 — Two-way player (TWP) fix: Ohtani-class players now appear in BOTH hitting and pitching Leaders / Roster / Today's Leaders. (v4.6.21)
- [x] Stats v3 — Last-10 run diff fix: form line was showing season-aggregate runDifferential; now computed client-side from the last 10 finals. (v4.6.23)
- [x] Stats v3 — Qualification gate on rank/percentile: rate stats (AVG/OBP/SLG/OPS/ERA/WHIP) suppress rank caption + percentile bar for unqualified players. (v4.6.23)
- [x] Stats v3 — L10 form-line color: drives off `lastTenWins` (>5 warm / =5 neutral / <5 cold) instead of streak direction. (v4.6.24)
- [x] Stats v3 — Typography normalization across the Stats section + Compare overlay (canonical scale: card-title eyebrow .68rem/.1em, section-head .65rem/.12em, tabs/pills .72rem, body row label .82rem, footers .62rem italic). (v4.6.25)
- [ ] Stats v3 — **Awards (#16)** intentionally dropped pre-prod in v4.6.21. Re-enable in a follow-up sprint if desired (`/people/{id}/awards` endpoint, AWARD_ICONS catalog, chip strip on Career tab).
- [ ] Stats v4 — **Statcast spray data via Baseball Savant proxy** (deferred). Would unlock xBA / xwOBA / exit velo / max EV / barrel rate / hard-hit % / sprint speed (advanced hitter metrics) + dot-on-field spray chart. Requires a separate proxy because Savant doesn't have permissive CORS.
- [ ] Stats v4 — **Cross-team Compare** (deferred). Current overlay is same-team only; cross-team compare would need a name-search picker + per-player season-stat fetches (currently we only warm `state.statsCache` for the active team).

### 📊 Stats Mobile Polish + League Polish (v4.9)

- [x] Stats — mobile player tabs shrink to fit 360px (`.62rem` font, `6×8px` padding) (Batch A, v4.8.1)
- [x] Stats — hero panel value 3.2rem → 2.6rem at ≤480px to keep 4-char rate stats from truncating (Batch A, v4.8.1)
- [x] Stats — Game Log strip drops to 1-col at ≤480px (uneven 2+2+1 grid) (Batch A, v4.8.1)
- [x] Stats — Career table right-edge gradient fade + dismissable `← Swipe to see more →` mobile hint banner (`careerSwipeHintShown` localStorage) (Batch A, v4.8.1)
- [x] Stats — `switchPlayerStatsTab` calls `scrollTabIntoView(btn)` so the active tab centers within its container (Batch A, v4.8.1)
- [x] Stats — sticky 4-chip mobile quick-nav at top of `#stats` (Team / Leaders / Roster / Player) with smooth-scroll + IntersectionObserver active-state (Batch C, v4.8.3)
- [x] Stats — Team Stats tile values 1.35rem → 1.05rem at ≤480px (matched the Leaders row tier instead of dominating) (v4.8.5)
- [x] Stats — Leaders card position abbreviation row removed (redundant with stat-category context) (v4.8.5)
- [x] Stats — Today's Leaders module removed entirely (~95% redundant with League → Stat Leaders, ~600px mobile scroll savings) (v4.8.6)
- [x] Stats — `Outside MLB top 100` rank caption + 0%-width bar **suppressed** entirely when player is below leader pool. `computePercentile` returns `outsideTop` flag; renderer skips the row. (v4.8.9 → v4.8.11)
- [x] League — `loadLeagueLeaders` reads from shared `state.leagueLeaders` (one fewer request per visit, categories aligned with the Stats percentile system) (v4.8.7)
- [x] League — probable pitchers under each pre-game matchup card; suppressed for Live + Final (v4.8.7)
- [x] League — `Game N of M` series eyebrow above status row when `gamesInSeries > 1` (v4.8.7)
- [ ] **National TV "marquee game" badge** (deferred). MLB's `/schedule?hydrate=broadcasts` returns `broadcasts[]` per game; presence of `isNational: true` (ESPN / FOX / FS1 / MLB Network / Apple TV+ / Peacock) is the de-facto "game of the day" signal. External source, no logic invention. Render as a badge / colored border on matchup cards.
- [ ] **Mobile League quick-nav** (deferred). Same sticky chip-row pattern as Stats Batch C if League's mobile scroll grows.
- [ ] **Mobile League Stat Leaders top-5 toggle** (deferred). Currently top-10, ~1100px scroll on mobile. A `Show 6-10` toggle would mirror the v4.9 mobile-polish pattern.
- [ ] **MLB News card consolidation** (deferred). Single-source ESPN news on the League tab partially duplicates the multi-source News tab. Either match the source picker here or replace with a link to `#news`.
- [ ] **Open: bigger qualified pool than `/stats/leaders` ~100 cap.** v4.8.4 attempted `/stats?stats=season&group=<g>&playerPool=Qualifier&limit=2000` to bypass the cap, but the response was empty — likely param-naming mismatch (`group` vs `statGroup`, `Qualifier` vs `Qualified`, or `playerPool` not accepted by `/stats`). Reverted in v4.8.8. Future investigation: probe the exact accepted param shape on a live API call before re-attempting; fall back to v4.8.11's renderer-suppression if the cap is unavoidable.

### ⚡ Pulse — Rain delay handling (deferred)

- [ ] **Rain delay: focus strip shows frozen count** — After the v4.19.2 fix that treats any `Live` game not in Warmup/Pre-Game as active, the focus mini-bar and game strip remain visible during a rain delay (correct) but the balls/strikes/outs count is frozen at whatever the linescore returned when play stopped. Improvement: detect `detailedState` containing `"Delay"` and suppress the count display (or replace with a "DELAYED" label) while keeping the score/inning visible.

---

### 🛠️ Tech debt

- [ ] **Inline styles in `index.html`** — 253 `style="…"` attributes pre-existing across the markup (calendar, news, schedule, settings sections). Some I added in Sprint 3 are already cleaned up (Today's Leaders card head, v4.6.26). A broader cleanup sprint could move all layout-only inline styles to CSS classes for maintainability + smaller HTML payload.

---

- [x] 🎯 Focus Mode — `calcFocusScore()` auto-selects most exciting live game; `selectFocusGame()` hooked into `pollLeaguePulse()` (v2.61)
- [x] 🎯 Focus Mode — Tier 1 linescore poll every 5s: balls/strikes/outs/runners/matchup names/score/team colors (v2.61)
- [x] 🎯 Focus Mode — Tier 2 GUMBO fetch every 5s: full `focusPitchSequence` for current at-bat; new-AB detection resets sequence (v2.61)
- [x] 🎯 Focus Mode — `#focusCard` compact card in right side rail (desktop/iPad landscape); full-width within 320px rail (v2.61)
- [x] 🎯 Focus Mode — `#focusMiniBar` slim strip below ticker; visible on phone and iPad portrait, hidden on desktop/iPad landscape via CSS (v2.61)
- [x] 🎯 Focus Mode — `#focusOverlay` full modal with hero count pips, diamond, matchup stats, pitch sequence, game switcher; custom 4px scrollbar (v2.61)
- [x] 🎯 Focus Mode — Soft alert `#focusAlertStack` for game-switch suggestions; 90s per-game cooldown (v2.61)
- [x] 🎯 Focus Mode — `focusCard.js` visual templates: `window.FocusCard.renderCard/renderOverlay/renderPitchPill/demo()`; `Shift+F` shortcut (v2.61)
- [x] 🎯 Focus Mode — Session-cached player stats (`focusStatsCache`); batter AVG/OPS/HR/RBI + pitcher ERA/WHIP/W/L in overlay (v2.61)
- [x] 🎯 Focus Mode — Pitch types shown as full name (`typeName`: "Sinker", "Sweeper") not abbreviated code; `typeCode` fallback if absent (v2.61)
- [x] 🎯 Focus Mode — Last-pitch strip in both compact card and overlay: pitch name + speed + result with color-coded dot (v2.61)
- [x] 🎯 Focus Mode — Demo Mode guard: all focus polls return early when `demoMode=true`; focus card hidden during demo (v2.61)
- [x] ⚡ Pulse — League-wide live play-by-play feed merged into index.html as lazy-loaded nav section (v2.1)
- [x] ⚡ Pulse — Mock mode toggle and Sound Alerts trigger moved to Settings panel (v2.1)
- [x] ⚡ Pulse — Mock bar inline (not fixed-position); no conflict with mobile nav (v2.1)
- [x] ⚡ Pulse — Game-start fires on `detailedState === 'In Progress'` only, not warmup (v2.1)
- [x] ⚡ Pulse — Timestamps stale check skips playByPlay fetch when game state unchanged (v2.1)
- [x] ⚡ Pulse — Historical plays load on first poll without alerts/sounds; sorted chronologically across all games (v2.1)
- [x] Calendar — Postponed/Cancelled/Suspended games show grey `PPD` badge instead of crashing to "L undefined-undefined"; `selectCalGame` renders info card, skips linescore fetch (v2.2)
- [x] Calendar — Doubleheader support: `gamesByDate` array per date; DH cells show `DH` badge + stacked G1/G2 rows each independently clickable; dot reflects combined result (v2.2)
- [x] Calendar — DH cell mobile fix: outer onclick restored (defaults to G1); inner rows hidden on mobile so outer was the only target — tapping did nothing and left two cells highlighted (v2.5)
- [x] Calendar — DH detail panel shows both games: `buildGameDetailPanel` extracted, called for all games on date in parallel; each state (PPD, Upcoming, Live, Final) handled independently with Game 1/2 labels (v2.6)
- [x] Calendar — PPD mobile dot: `cal-dot-ppd` (grey `--muted`) added; shown when all games on a date are PPD and no result recorded; W+PPD and L+PPD still show result dot (v2.6)
- [x] News — MLB/Team toggle pills added to News Feed section; defaults to MLB stream; team pill label updates on team switch; home card always shows team news (v2.6.1)
- [x] Calendar — Linescore R/H/E null guards tightened (`!=null` per field) to prevent `undefined` display on partial-data games (v2.2)
- [x] ⚡ Pulse — Ticker shows `PPD` instead of `FINAL` for postponed/cancelled/suspended games (v2.2)
- [x] ⚡ Pulse — 🌧️ "Game Postponed" feed item fired instead of 🏁 "Game Final" + gameEnd sound for PPD transitions (v2.2)
- [x] ⚡ Pulse — Historical status items synthesised on first load: Game Final (with `linescore.gameDurationMinutes` duration label + accurate end-time sort), Game Postponed, Game Underway, Game Delayed (v2.2)
- [x] ⚡ Pulse — Game Final feed item anchored after last play timestamp (`pendingFinalItems` deferred insert); omitted if no plays found; PPD item suppressed before scheduled game time (v2.3)
- [x] ⚡ Pulse — Feed items inserted at correct timestamp position on every poll; late-arriving plays no longer float to top (v2.3)
- [x] ⚡ Pulse — Player card flash on HR: baseball-card overlay with headshot, AVG/OPS/HR count-up animation/RBI, milestone + team-leader context pill; auto-dismisses 5.5s; mock plays have embedded stats to bypass API (v2.7)
- [x] ⚡ Pulse — HR toast suppressed — player card replaces it; run/TP toasts unaffected (v2.7)
- [x] ⚡ Pulse — HR feed items: stronger amber background + 3px amber left border stripe; visually outranks green scoring plays (v2.7)
- [x] ⚡ Pulse — RISP left accent stripe removed; ⚡ badge + base diamond chip on ticker are sufficient (v2.7)
- [x] ⚡ Pulse — Game Delayed feed items now show team abbreviations ("SD @ AZ · Delayed Start") in both initial-load and live-update paths (v2.7)
- [x] ⚡ Pulse — Real poll interval leak into mock mode fixed: `pulseTimer` global stores `setInterval` handle; `switchMode()` clears it (v2.7)
- [x] 📖 Story Carousel — Event stream with priority-weighted rotation, cooldowns, and decay (v2.7.1+). 13 story generators covering realtime (HR, no-hitter, walk-off, bases loaded, big inning), game status (final, streak), daily stats (multi-hit, leaders, pitcher gem), and historical (yesterday, on this day, probable pitchers)
- [x] 📖 Story Carousel — Auto-rotate every 20s with manual prev/next; Display winning/losing/save pitcher with IP/K/ER stats in yesterday/on-this-day stories
- [x] 📖 Story Carousel — HR card redesign: past-tense headline, YTD stats sub-line (HR/RBI/AVG/OPS), HIGHLIGHT badge, multi-homer collapse with priority boost (v2.9)
- [x] 📖 Story Carousel — Probable pitcher W-L record shown in matchup headline (fetched via `loadProbablePitcherStats`); defaults to 0-0 (v2.9)
- [x] 📖 Story Carousel — Streak/leader sub-lines cleaned up; Season Leader badge replaces TODAY badge on leader cards (v2.9)
- [x] 📖 Story Carousel — Auto-rotate reduced to 10s (was 20s) (v2.9)
- [x] 📖 Story Carousel — Probable Pitchers badge changed from UPCOMING to TODAY'S PROBABLE PITCHERS (v2.9)
- [x] ⚡ Pulse — DH game 2 excluded from NEXT UP empty-state hero card while game 1 is live (v2.9)
- [x] 📖 Story Carousel — Lazy Statcast distance: `pollGamePlays` patches `item.data.distance` on subsequent fetches once `hitData.totalDistance` populates; HR headline shows "Xft" when available (v2.9)
- [x] 📖 Story Carousel — Big-inning card: HIGHLIGHT badge + crimson background (`rgba(220,60,60,0.13)`) via `.story-biginning` CSS class, distinct from HR amber (v2.9.1)
- [x] 📖 Story Carousel — Big-inning card sub-line simplified to "AWAY @ HOME" — score removed (v2.12.2)
- [x] 📖 Story Carousel — Cooldowns dynamically capped to `pool.length × devTuning.rotateMs × 1.5` (floor 2 min) so thin pre-game pools recycle cards in seconds rather than hitting 60-min nominal cooldowns (v2.12.3)
- [x] ⚡ Pulse — Ticker chips stacked vertically: away-team row / home-team row / inning+outs row; reduces chip width significantly vs prior horizontal layout (v2.13)
- [x] ⚡ Pulse — Out-dot indicators on ticker chips: 3 small circles (red hollow outline → filled `#e03030`) showing current out count; displayed on both normal and RISP chips' inning row; only visible for live games (v2.13)
- [x] ⚡ Pulse — Live dot changed from red to green (`#22c55e`, pulse-ring animation updated to match) to avoid visual clash with red out-dot indicators (v2.13)
- [x] ⚡ Pulse — Dot-spacer on home-team row of normal chips so both team abbreviations share the same left edge regardless of live-dot presence (v2.13)
- [x] ⚡ Pulse — RISP chip bottom row left-aligns diamond + inning + outs with `gap: 6px`; removed `justify-content: space-between` that previously pushed inning to the far right (v2.13)
- [x] 📖 Story Carousel — Stolen base story card: 💨 tier-2/priority-55 for 2B/3B steals, 🏃 tier-1/priority-85 for steal of home; carousel-only (stolen base plays intercepted before feed via `stolenBaseEvents[]` tracker); `isHistory` guard ensures only live events fire (v2.14)
- [x] ⚡ Pulse — HR play description patched on subsequent polls when MLB API delivers initial play without season count in parentheses; `pollGamePlays` patch loop extended to update `item.data.desc` alongside distance (v2.9.1)
- [x] ⚡ Pulse — Player card +1 fix: `desc` passed to `showPlayerCard` as `descHint`; HR number extracted from description used as floor for `hrCount` when stats API is stale; milestone context pill uses resolved `hrCount` (v2.9.1)
- [x] 📖 Story Carousel — Daily leaders consolidated to one story per stat with MLB top-5 ranked list (last name + value, `<br>`-separated); stats expanded from {HR, H, RBI, K, SV} to {HR, AVG, RBI, SB, Pitching Wins, Saves}; fetch limit raised 1→5 (v2.9.2)
- [x] ⚡ Pulse — Distinct HR colors: Story Carousel tier-1 HR cards use teal (`rgba(0,195,175)`); feed HR play items use violet (`rgba(160,100,255)`) via `--hr-bg`/`--hr-border`; previously both shared amber (v2.10/v2.11)
- [x] ⚡ Pulse — ⚡ Pulse banner: flush-left label only (hairline rule removed); bolt uses `var(--accent)`, text in `var(--muted)` uppercase (v2.10/v2.11)
- [x] ⚡ Pulse — feedWrap contained-module: `1px solid var(--border)` border + `border-radius` gives the feed a self-contained card feel distinct from the carousel above (v2.10)
- [x] 📖 Story Carousel — Daily leader sub-lines (1–5 rankings) now single horizontal row joined with ` · ` instead of stacked `<br>` lines; `.story-leaders` CSS class makes sub-text match headline size (14px, `var(--text)`, weight 600) (v2.11)
- [x] 📖 Story Carousel — Walk-off story fires on game state alone (bottom 9th+, tied/1-run) — no runner on base required; per-inning ID (`walkoff_{pk}_{inning}`) so extra innings each get a fresh card; cooldown raised 1m → 5m to prevent repeated firing within the same inning (v2.11)
- [x] 📖 Story Carousel — Walk-off detection tightened to winning-run-at-bat logic: `deficit ≤ runnersOn + 1` — correctly fires for tied/down-1-with-runner/down-2-with-2-runners/bases-loaded-down-3; no longer fires when home leads or trailing by more than runners can cover (v2.12.1)
- [x] 📖 Story Carousel — Bases loaded story card: tier-1, priority 88, fires any inning/half when all three bases occupied; per half-inning ID prevents duplicate; 3-min cooldown, 80% decay (v2.12)
- [ ] 📖 Card Collection — Binder scrolls on desktop because `#collectionBook` uses `max-height:90vh` (not an explicit `height`), so `.cc-binder{height:100%}` resolves against content height and the flex chain has no definite reference; `.cc-page` overflows when `.cc-grid{min-height:600px}` + 44px padding exceeds available space. Fix: change `#collectionBook` to `height:min(96vh,920px)` (definite height) + widen `max-width:960px` → `1200px` + drop `min-height:600px` from `.cc-grid` so `height:100%` fills naturally. Needs visual QA before shipping — previous attempt at the fix was reverted due to look/feel concerns.
- [ ] ⚡ Pulse — HR/RBI player cards: Career stats expansion — 2024 career HR high by year, hot streak context (last 10-game average, current streak), populate from `/people/{id}/stats` with season=all; currently shows placeholders (deferred to future branch, v2.31)
- [ ] 📖 Story Carousel — HR distance via Statcast (`hitData.totalDistance` in `/game/{pk}/playByPlay`) needs real-world verification — field may not populate for all games or all parks; confirm distance appears in headlines during live play
- [x] ⚡ Pulse — "Game underway!" feed ordering: status items (game start, final, delayed) now anchored to correct chronological position via proper `playTime` parameters (v3.48)
- [x] 🛠️ Build — CSS readability + build-time minification: `styles.css` reformatted from a 946-line semi-minified blob to 4,650 properly indented lines; `build.mjs` extended with parallel esbuild CSS step emitting `dist/styles.min.css` (~65 KB, 21% smaller than source); `index.html` `<link>` and `sw.js` SHELL switched to the dist artifact; CI `build.yml` triggers updated to include `styles.css` and auto-commit the new artifact. Roundtrip verified — minifying the readable source produces output identical to minifying the original CSS, so runtime CSS variables are unaffected (v3.49.4)
- [ ] 📝 Docs — Backfill missing `CHANGELOG.md` entries for v3.49 / v3.49.1 / v3.49.2 / v3.49.3 (CHANGELOG was at "Current version: v3.48" before v3.49.4 even though repo had already shipped through v3.49.3). Same drift in `CLAUDE.md` "Recent versions" section, which stops at v3.47. Pre-existing before v3.49.4; flagged during pre-merge review of `claude/format-css-readability-Dz0pi`. Resolution: walk `git log v3.48..v3.49.3 -- src/ index.html sw.js` for each commit and write a 1-paragraph CHANGELOG entry per version, then mirror the most recent few into the CLAUDE.md "Recent versions" list.
- [ ] ⚡ Pulse — Sound system upgrade: replace Web Audio API synthesis with real CC0 MP3 samples. Infrastructure is fully in place (branch `claude/explore-platform-sound-LSGL8`, merged fixes to main via v2.64.x). To complete: source 9 CC0 audio files from Pixabay (no attribution required), encode each as base64 (`base64 -i file.mp3` on macOS), paste into `SOUND_DATA` object in index.html. Events needing samples: `hr` (bat crack + crowd), `run` (bell/chime), `risp` (heartbeat/tension), `sb` (whoosh), `dp` (glove pop ×2), `tp` (bugle fanfare), `gameStart` (organ riff), `gameEnd` (descending chime), `error` (thud). Synthesis fallbacks remain active for any key left as empty string. iOS/shared-context fix already landed (v2.64.4): single `_audioCtx` created on master-toggle user gesture, `playSound()` awaits resume via `.then()` before dispatching, prevents silent audio on suspended context. UAT checklist: `Shift+H` (HR), `Shift+B` (RBI/run), demo at 10x for DP/TP/SB/error/RISP, 1x for gameStart/gameEnd.
- [ ] ⚡ Pulse — Feed item cap logos (small team image in meta row alongside coloured dot)
- [ ] ⚡ Pulse — Probable pitchers on empty state hero card (`hydrate=probablePitcher`)
- [ ] ⚡ Pulse — Persist `enabledGames` to localStorage (game filter survives reload)
- [ ] ⚡ Pulse — 30-team colour QA across ticker chips and empty state gradients
- [ ] ⚡ Pulse — Push notification integration for league-wide game-start alerts
- [ ] Switch cron trigger from GitHub Actions to Vercel Cron (`vercel.json`) — GitHub Actions scheduled workflows are unreliable on free tier (fires ~once per hour in practice vs every 5 min as configured), making game-start alerts miss most windows; Vercel Cron runs directly on the same infra as the notify function and is more reliable
- [ ] Push notification team filter — currently fires for any MLB game start; add per-user team preference stored with subscription in Redis
- [ ] Clean up KV naming — rename `const kv` variable to `redis` in all three api files; rename env vars `KV_REST_API_URL`/`KV_REST_API_TOKEN` to clearer Upstash-prefixed names in both code and Vercel dashboard (env var names were auto-generated by Vercel's Upstash integration)
- [x] Rename `--blue`/`--orange` CSS vars to `--primary`/`--secondary` — names are misleading for non-blue/orange teams (v1.45.1)
- [x] Fix live header text colour — `.live-team-name` and `.live-team-score` now use `var(--header-text)` instead of hardcoded `#fff`/`--accent-text` (v1.54)
- [x] Team-aware live badge — tinted/outlined using `--accent` (v1.53); W/L badges intentionally kept as fixed green/red (semantic meaning)
- [x] Team cap logos in Around the League matchup grid — `teamCapImg()` with `capImgError()` SVG fallback; drop-shadow for dark logo visibility (v1.55)
- [x] Yesterday/Today/Tomorrow day toggle on Around the League matchups — opacity fade transition, resets to Today on tab open (v1.58)
- [x] Live game view shows FINAL (not LIVE) for completed games — `/schedule?gamePk=` fetched in same `Promise.all`, stops auto-refresh when Final (v1.58)
- [x] Standardise stat display formatting — `fmtRate` for no-leading-zero rate stats; ERA 2dp; WHIP 3dp everywhere; K/BB, K/9, BB/9 2dp (v1.59)
- [x] Mobile: hide "Refresh" label on matchup day controls (≤480px), icon-only ↻ with adequate touch target, prevents row overflow on narrow screens (v1.60)
- [x] Warmup/Pre-Game state no longer shown as Live — `detailedState` exclusion applied in home card, calendar, and Around the League (v1.61)
- [x] Calendar date timezone fix — `gameByDate` keyed by local date (via `new Date()`) instead of UTC `gameDate.split('T')[0]`; fixes evening games appearing on wrong calendar day (v1.61)
- [ ] News fallback source (MLB RSS)
- [x] Last 10 games — shipped as the L10 summary strip on the Game Log tab in Player Stats v2 (AVG/HR/RBI/OPS for hitters, ERA/K/WHIP/IP for pitchers, all client-side aggregated from `/people/{id}/stats?stats=gameLog`) (v4.6.13)
- [ ] Dynamic season year
- [ ] QC all 30 team YouTube channel IDs
- [ ] Consider more reliable CORS proxy for YouTube RSS
- [x] --accent / --header-text theme vars, cross-team contrast safety (v1.39)
- [x] Theme flash prevention — localStorage pre-render hydration (v1.39)
- [x] W/L outlined neutral badge pills; cal LIVE pill (v1.39)
- [x] Nav active state soft pill; header text via --header-text (v1.39)
- [x] Hero stat box (first stat spans 2-col at 2.2rem) (v1.39)
- [x] Jersey # overlay pill on player headshot (v1.39)
- [x] Leader stat filter pills above select dropdowns (v1.39)
- [x] Opposition-forward home cards — 5-col Next Game, ghosted Next Series (v1.39.1)
- [x] Live game play-by-play log — every at-bat result grouped by inning, scoring plays highlighted (v1.45)
- [x] Remove redundant At Bat card from live game view — Current Matchup already shows batter (v1.44)
- [x] Mobile calendar game stats fix — tap now shows tooltip AND populates #gameDetail panel below (v1.43)
- [x] iPhone horizontal scroll fix — `html{overflow-x:hidden}` + `.live-view` side padding zeroed + `.game-big{padding:16px}` (v1.42)
- [x] Home screen horizontal scroll fix — `html,body{overflow-x:hidden}` + `.ng-grid`/`.ng-name`/`.ng-score` mobile font overrides on Next Game card (v1.43.1)
- [x] Today card live state: remove LIVE duplication from label, replace red badge-live pill with subtle inline dot + inning indicator (v1.42.1)
- [x] Mobile calendar: dot indicators + tap tooltip (v1.41.4)
- [x] Mobile nav: short labels back, backdrop-blur bg, safe-area padding, accent underline active (v1.41.1)
- [x] iPad portrait header: stays one line, team chip added, logo wordmark collapses (v1.41.2)
- [x] Diamond PWA icon set — team-neutral, maskable/monochrome/favicon variants (v1.41.3)
- [x] PWA install support — manifest, service worker, icons, apple meta tags (v1.40)
- [x] Web Push game-start notifications — Vercel + Upstash Redis + GitHub Actions cron (v1.40)
- [x] Game Start Alerts toggle in Settings panel (v1.40)
- [x] Today's matchup subtle card surfaces, 3-col grid (v1.40)
- [x] iPhone layout — fixed bottom icon nav bar, scrollable header, settings scrolls with header (v1.38)
- [x] Extract inline grid styles to CSS classes (.media-layout, .league-leaders-grid) for responsive control (v1.38)
- [x] Persist user settings via localStorage — team, theme, invert, media tab (v1.37)
- [x] Player headshots in stats panel with layout-shift-free placeholder (v1.37)
- [x] Probable pitcher hydration fix — no longer shows TBD when pitchers are announced (v1.37)
- [x] Schedule tab auto-loads on first visit (`scheduleLoaded` flag — v1.31)
- [x] Auto-select first player in stats; player name in card title (v1.32)
- [x] Stats tab shows 40-man roster (includes IL players) instead of active 26-man only (v1.33)
- [x] Next Game / Next Series home cards
- [x] Team-aware backgrounds (hue from primary, all bg vars dynamic)
- [x] Series record on cold load (±7 day fetch in loadTodayGame)
- [x] Next Series shows series after current, not current series
- [x] Live game enriched — box score, pitcher game line, game info
- [x] Nav works from live view — showSection closes live view first
- [x] Version number in settings panel
- [x] Giants/Orioles dark accent fix — luminance floor enforced
- [x] Nav team logo (SVG from mlbstatic.com) replaces ⚾ emoji; team name only, no "Tracker" suffix (v1.36)
- [x] Color Theme override dropdown in settings — pick any team's colours independently of active team (v1.36)
- [x] Invert Colours toggle in settings — swaps primary and secondary colours (v1.36)
- [x] Settings panel closes on click outside (v1.36)
- [x] iPad responsive layout — CSS grid classes + media queries at ≤1024px and ≤767px (v1.35)
