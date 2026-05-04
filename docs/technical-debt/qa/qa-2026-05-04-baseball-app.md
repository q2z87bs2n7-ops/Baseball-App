# QA Test Plan: Baseball App v3.33

**Date:** 2026-05-04
**Branch:** `claude/tech-debt-audit-e5E4H`
**Remediation:** `remediation/remediation-2026-05-04-baseball-app.md`

---

## Automated Checks (pre-UAT)

- [ ] `grep -c 'if(!r.ok)' index.html` returns ≥ 25
- [ ] `grep -c 'class="dt-label-muted"' index.html` returns ≥ 20 (inline style gone)
- [ ] `grep -c 'onclick="toggleDemoMode' index.html` returns 0 (replaced by data-dt-action)
- [ ] `grep 'v3.33' index.html` finds title + settings version
- [ ] `grep 'mlb-v472' sw.js` confirms cache bump
- [ ] `grep -c 'const TIMING' index.html` returns 1
- [ ] `grep -c 'const TIMERS' index.html` returns 1
- [ ] `grep 'console.log.*Collection synced' index.html` line has `if(DEBUG)` prefix

---

## UAT Checklist

### 🔴 HIGH PRIORITY — Dev Tools (M3)

All Dev Tools buttons must still work after onclick → delegated listener conversion:

- [ ] Open Dev Tools (Settings → 🛠️ Dev Tools or Shift+D)
- [ ] ▶ Try Demo button starts demo, panel closes
- [ ] ⏹ Exit Demo button exits demo, panel closes
- [ ] 🎬 Replay HR replays last HR card, panel closes
- [ ] 💰 Replay RBI replays last RBI card, panel closes
- [ ] 💫 Card Variants cycles HR card templates, panel closes
- [ ] 🎴 Test Card injects card, panel closes
- [ ] 🗑️ Reset Collection clears cards (confirm prompt appears)
- [ ] 🔬 News Source Test opens news test overlay, Dev Tools closes
- [ ] ✕ close button closes panel
- [ ] Confirm Changes button applies numeric inputs (flashes green ✓)
- [ ] Reset to Defaults button in Pulse Tuning resets values
- [ ] Copy buttons in Theme Tuning capture current colors
- [ ] 🔄 Refresh button in WP Debug section works

### 🔴 HIGH PRIORITY — H3 Fetch Error Handling

Test that error states degrade gracefully (not visible breakage, but verify no new crashes):

- [ ] Pulse loads normally with live games
- [ ] Focus Mode compact card renders (linescore fetch still works)
- [ ] Focus Mode overlay opens and shows pitch sequence
- [ ] Yesterday's Recap opens and shows videos/stats
- [ ] Card Collection binder opens and shows career stats
- [ ] Live Game View opens from Home card
- [ ] Live Game View shows batter/pitcher stats in Current Matchup

### 🟡 MEDIUM PRIORITY — M4 Timer Leak

- [ ] Navigate to Pulse with a live game — home card live timer starts (`homeLiveTimer` set)
- [ ] Navigate to Schedule tab — timer stops (no JS errors in console)
- [ ] Navigate back to Home — timer restarts on next live game render
- [ ] Navigate to any non-home section while on Home with live game — confirm no orphaned refresh calls (check Network tab: no `schedule?gamePk=` calls while on non-home sections)

### 🟡 MEDIUM PRIORITY — M2 Inline Styles

- [ ] Dev Tools panel visual appearance unchanged
- [ ] All 6 utility classes render correctly (`.dt-label-muted`, `.dt-input`, `.dt-label`, `.dt-grid-2`, `.dt-box`, `.dt-color-input`)
- [ ] Color pickers in Theme Tuning section still show correct colors
- [ ] Numeric tuning inputs still accept values

### 🟡 MEDIUM PRIORITY — M1 var→const

- [ ] Sign in with GitHub flow works end-to-end
- [ ] Card collection syncs to server (check network tab for PUT /api/collection-sync)
- [ ] Merge on sign-in works (sign in on device with server cards)

### 🟢 LOW PRIORITY — N5/N6

- [ ] Open DevTools console — verify `[Sync] Collection synced` does NOT appear every 30s when signed in (was flooding at 30s interval)
- [ ] Open DevTools console — verify no `Video ready to play` logs on highlight video load
- [ ] Export JSON modal Copy button: works in modern browser (navigator.clipboard)
- [ ] Export JSON modal Copy button: in sandboxed iframe, shows "Copy failed — please copy manually." (optional test)

### 🟢 LOW PRIORITY — L1 TIMING

- [ ] Pulse polling still runs at 15s (check Network tab timestamps)
- [ ] Focus Mode still polls at 5s
- [ ] Player card auto-dismisses after ~5.5s

---

## Regression Checklist

- [ ] Pulse feed loads and plays
- [ ] Story Carousel rotates
- [ ] Ticker chips render with team colors
- [ ] Sound Alerts panel opens from ⚡ top bar
- [ ] Radio toggle works
- [ ] Focus Mode auto-selects a game
- [ ] Settings panel opens and team switch works
- [ ] Nav between all sections works (Home, Pulse, Schedule, League, News, Standings, Stats)
- [ ] Yesterday Recap opens and closes
- [ ] Card Collection opens and binder renders

---

## Sign-Off

| Check | Status | Notes |
|---|---|---|
| Dev Tools delegated listener | ⏳ Pending UAT | |
| H3 fetch hardening | ⏳ Pending UAT | |
| M4 timer leak | ⏳ Pending UAT | |
| M2 CSS classes | ⏳ Pending UAT | |
| M1 const conversions | ⏳ Pending UAT | |
| N5/N6 console + copy | ⏳ Pending UAT | |
| L1 TIMING | ⏳ Pending UAT | |
| Regression | ⏳ Pending UAT | |
