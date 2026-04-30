# Code Audit Report: Baseball App v2.49

**Date:** 2026-04-29  
**App Version:** v2.49  
**Branch:** `claude/tech-debt-sprint-GdCbY`  
**Files Reviewed:** `index.html` (4,185 lines), `sw.js`, `manifest.json`, supporting API files  

---

## Executive Summary

**Total Issues Found:** 11  
**Severity Distribution:** 5 HIGH, 4 MEDIUM, 2 LOW  
**Estimated Remediation Time:** 6–8 hours  
**Risk Level:** Low — All fixes are surgical edits with no breaking changes expected.

**Key Findings:**
- Code quality degradation from rapid feature development (Pulse, Story Carousel, Demo Mode added v2.7–v2.49)
- Legacy ES5 patterns mixed with modern JS (var/let, inline handlers vs addEventListener)
- Event listener management inconsistent across sections
- API error handling incomplete (49 fetch calls, some without error paths)
- Orphaned/dead code from refactoring (empty stub functions)

---

## Detailed Issues

### HIGH PRIORITY (5 issues)

---

#### **H1: Empty `updateHeader()` Stub Function** 

**Severity:** HIGH  
**Lines:** 1828  
**Root Cause:** Function was gutted during v2.x refactoring; controls bar removed but function left behind.

**Current Code:**
```javascript
function updateHeader() {}
```

**Call Sites (3):**
- Line 1187: `updateHeader();` in `pollLeaguePulse()`
- Line 1475: `updateHeader();` in `pollGamePlays()`
- Others in mock/demo loops

**Impact:**
- Dead code clutters codebase
- Developers may mistakenly add logic to empty function
- Waste of CPU cycles (5+ calls per second during Pulse polling)

**Proposed Fix:**
Remove function definition and all call sites.
- Delete line 1828 entirely
- Remove `updateHeader();` calls from all three locations
- Test: Pulse poll continues to work normally

**Effort:** 10 minutes  
**Testing:** Manual test: Open Pulse, verify feed updates normally.

---

#### **H2: Click Handler on Player Card Overlay Not Cleaned Up**

**Severity:** HIGH  
**Lines:** 3330 (addEventListener), plus overlay creation ~2900  
**Root Cause:** `#playerCardOverlay` click listener attached every time Pulse initializes, never removed. Multiple Pulse enter/exit cycles can create duplicate listeners.

**Current Code:**
```javascript
// Line 3330 in initLeaguePulse() or related
document.addEventListener('click',function(e){
  if(e.target.id==='playerCardOverlay'||e.target.id==='playerCard')
    dismissPlayerCard();
});
```

**Issue:**
- `initLeaguePulse()` called on first nav to Pulse
- If user switches tabs repeatedly, listeners accumulate
- Each click triggers multiple dismissPlayerCard() calls
- Memory leak: Old listeners never removed

**Impact:**
- Multiple card dismissals on single tap (visual jank)
- Memory grows with repeated Pulse nav
- Hard to debug because issues only surface after repeated use

**Proposed Fix:**
1. Create a unique identifier/flag for this listener
2. Check if already attached before adding
3. Store listener reference globally so it can be removed
4. Remove listener in `switchMode()` teardown

```javascript
// Pseudocode
let playerCardClickListener = null;

function attachPlayerCardClickListener() {
  if (playerCardClickListener) return; // Already attached
  playerCardClickListener = function(e) {
    if(e.target.id==='playerCardOverlay'||e.target.id==='playerCard')
      dismissPlayerCard();
  };
  document.addEventListener('click', playerCardClickListener);
}

function removePlayerCardClickListener() {
  if (playerCardClickListener) {
    document.removeEventListener('click', playerCardClickListener);
    playerCardClickListener = null;
  }
}

// In switchMode() teardown:
removePlayerCardClickListener();
```

**Effort:** 30 minutes  
**Testing:** 
- Tap Pulse nav 5 times, check console for listener count
- Tap player card overlay, verify single dismissal
- No regressions in HR card display

---

#### **H3: 49 Fetch Calls Without Error Handling**

**Severity:** HIGH  
**Locations:** Scattered throughout file  
**Examples:**
- Line 725: `fetch(MLB_BASE+'/schedule...')`
- Line 850: `fetch(URL + '/game/' + ...)`
- Many more in `loadTodayGame()`, `selectCalGame()`, Pulse polling, etc.

**Root Cause:** Early implementation didn't prioritize error handling. As features grew, catch blocks were never added retroactively.

**Current Pattern:**
```javascript
// No error handling:
const resp = await fetch(url);
const data = await resp.json();
// If network fails, API returns 500, or response is invalid → silent failure

// Current rare pattern (8 calls):
await fetch(url).catch(e => console.error(e));
// Only logs, doesn't inform user or retry
```

**Impact:**
- **User Experience:** Games fail to load silently; user sees stale data or blank sections
- **Debugging:** No indication why data is missing
- **Reliability:** Cannot distinguish between no-internet, API-down, and bad JSON
- **Rate Limiting:** No retry logic; failed requests wasted

**Proposed Fix:**
1. Add error handler to all fetch calls
2. Distinguish between network errors, HTTP errors, and parse errors
3. Log to console with context (which endpoint, what error)
4. For critical endpoints (schedule, game data): Show user toast alert
5. For non-critical (news, standings): Silently fall back to cached data

**Pattern Template:**
```javascript
async function fetchWithErrorHandling(url, fallback = null) {
  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      console.error(`HTTP ${resp.status} from ${url}`);
      return fallback;
    }
    return await resp.json();
  } catch (e) {
    console.error(`Fetch failed for ${url}:`, e.message);
    return fallback;
  }
}
```

**Effort:** 3–4 hours (requires testing each section)  
**Testing:**
- Offline mode: Disable network, verify app shows graceful degradation
- Slow network: Throttle to 3G, verify timeouts handled
- API down: Mock 500 response, verify error toast shown
- Invalid JSON: Mock malformed response, verify fallback used

---

#### **H4: No AbortController on Fetch Calls**

**Severity:** HIGH  
**Locations:** All fetch calls, especially polling loops (Pulse at 15s, Live at 5min)  
**Root Cause:** AbortController is modern (ES2017); early code didn't use it.

**Current Pattern:**
```javascript
// Pulse polling every 15 seconds
pulseTimer = setInterval(async () => {
  const resp = await fetch(...);  // Can't cancel if slow
  // If slowdown stalls, next poll happens anyway → request queue backs up
}, 15000);
```

**Impact:**
- **Cascading failures:** If API slowdown occurs, requests pile up
- **Resource waste:** Multiple in-flight requests to same endpoint
- **Memory:** Pending requests hold memory until timeout (30s+)
- **Mobile:** Battery drain from orphaned requests

**Real-world scenario:**
- API slow for 5 minutes (maintenance)
- Pulse polls continue every 15s, each hangs for 30s
- After 5 min, user has 10+ simultaneous pending requests
- When API recovers, all 10 requests complete at once → thundering herd

**Proposed Fix:**
```javascript
let pulseAbortController = null;

function startPulsePolling() {
  pulseAbortController = new AbortController();
  pulseTimer = setInterval(async () => {
    try {
      const resp = await fetch(url, { signal: pulseAbortController.signal });
      // ...
    } catch (e) {
      if (e.name === 'AbortError') return; // Expected, user navigated away
      console.error('Pulse fetch failed:', e);
    }
  }, 15000);
}

function stopPulsePolling() {
  clearInterval(pulseTimer);
  if (pulseAbortController) {
    pulseAbortController.abort();
    pulseAbortController = null;
  }
}
```

**Effort:** 2 hours (add pattern to all polling loops)  
**Testing:**
- Pulse polling: Start, throttle network to slow, cancel Pulse nav → verify abort logged
- Live game: Same test
- No regression: Verify normal polling completes normally

---

#### **H5: Event Listener Duplication on Pulse Visibility Toggle**

**Severity:** HIGH  
**Lines:** 1079–1081, plus similar patterns in story carousel  
**Root Cause:** Visibility listeners attached on first Pulse nav (good), but if Pulse is exited/entered multiple times without full page reload, duplicate listeners accumulate.

**Current Code:**
```javascript
// Line 1079–1081 in buildStoryPool() or initLeaguePulse()
if (pulseInitialized) return; // Guards against re-init, but not against multiple listeners

document.addEventListener('visibilitychange', onStoryVisibilityChange);
document.addEventListener('visibilitychange', onNewsVisibilityChange);
```

**Issue:**
- Guard prevents multiple `buildStoryPool()` calls, but doesn't prevent multiple listener attachments
- If user navigates: Home → Pulse → Home → Pulse, two `visibilitychange` listeners exist
- Each time page becomes hidden/visible, both fire → double the state changes

**Impact:**
- **Story carousel:** Rotation timer stops/starts twice per visibility change
- **News carousel:** Rotation timer duplicates
- **CPU:** Wasted timer cycles
- **Hard to debug:** Listeners are anonymous functions, hard to inspect in DevTools

**Proposed Fix:**
Create named listener functions and track attachment state:

```javascript
let storyVisibilityListenerAttached = false;
let newsVisibilityListenerAttached = false;

function onStoryVisibilityChange() {
  if (document.hidden) {
    if (storyRotateTimer) clearInterval(storyRotateTimer);
  } else {
    rotateStory();
    storyRotateTimer = setInterval(rotateStory, STORY_ROTATE_MS);
  }
}

function onNewsVisibilityChange() {
  // Similar logic for news carousel
}

function attachPulseVisibilityListeners() {
  if (storyVisibilityListenerAttached) return;
  document.addEventListener('visibilitychange', onStoryVisibilityChange);
  storyVisibilityListenerAttached = true;
  
  if (newsVisibilityListenerAttached) return;
  document.addEventListener('visibilitychange', onNewsVisibilityChange);
  newsVisibilityListenerAttached = true;
}

function removePulseVisibilityListeners() {
  if (storyVisibilityListenerAttached) {
    document.removeEventListener('visibilitychange', onStoryVisibilityChange);
    storyVisibilityListenerAttached = false;
  }
  if (newsVisibilityListenerAttached) {
    document.removeEventListener('visibilitychange', onNewsVisibilityChange);
    newsVisibilityListenerAttached = false;
  }
}

// In switchMode() teardown:
removePulseVisibilityListeners();
```

**Effort:** 1 hour  
**Testing:**
- DevTools → Event Listeners → check `visibilitychange` count (should be ≤1 per type)
- Navigate: Home → Pulse → Home → Pulse, inspect listeners → should be 2 total, not 4
- Hide/show browser tab, verify carousel timer behavior normal

---

### MEDIUM PRIORITY (4 issues)

---

#### **M1: 775 `var` Declarations (ES6 Upgrade)**

**Severity:** MEDIUM  
**Scope:** Global scope and function-scoped throughout  
**Root Cause:** Code written before ES6 adoption; var was standard at the time. Mixed with modern let/const added in later refactors.

**Current Mix:**
```javascript
var activeTeam = TEAMS.find(...);  // Global var
let pulseInitialized = false;      // Global let (from v2.1 refactor)
var upcomingGames = [];            // Function-local var
let enabledGames = new Set();      // Modern let
```

**Impact:**
- **Scope confusion:** var is function-scoped; let/const are block-scoped
- **Hoisting bugs:** var declarations hoist; let/const have temporal dead zone
- **Mixing styles:** Makes code harder to read/maintain
- **Modern tooling:** Linters flag var as legacy

**Proposed Fix:**
Global `var` → `let` (most globals are mutated, not constants):
```javascript
// Before:
var activeTeam = TEAMS.find(t => t.id === 121);
var scheduleData = [];

// After:
let activeTeam = TEAMS.find(t => t.id === 121);
let scheduleData = [];
```

Function-scoped `var` → appropriate scope:
```javascript
// Before: Function scope leaks to next line
function foo() {
  var temp = x;
  // ... do stuff ...
  return temp;  // temp was accessible outside block too
}

// After: Block scope
function foo() {
  const temp = x;  // const if not reassigned
  // ... do stuff ...
  return temp;
}
```

**Effort:** 2 hours (find & replace with manual review of each change)  
**Testing:**
- No logic changes, only scope
- Linter: Run eslint to verify no new violations
- Manual spot-check: Pick 10 random let replacements, verify no side effects

---

#### **M2: 207 Inline `style=""` Attributes (CSS Class Extraction)**

**Severity:** MEDIUM  
**Scope:** Scattered throughout HTML-building code  
**Examples:**
```javascript
html += '<div style="font-size:11px;font-weight:700;letter-spacing:.08em;...">Game</div>';
html += '<button style="background:var(--secondary);color:var(--accent-text);...">Button</button>';
```

**Impact:**
- **Maintenance:** Hard to find where a style is defined (scattered in JS strings)
- **Consistency:** Same styles copy-pasted multiple times, hard to update globally
- **Performance:** Inline styles bypass critical CSS-in-JS optimization
- **Debugging:** DevTools shows inline styles, hard to track back to source
- **Responsiveness:** Can't use media queries on inline styles

**Proposed Fix:**
Extract to CSS classes where patterns repeat. Phase 1: identify clusters

```javascript
// Example cluster: all title-row styles
.title-row {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .08em;
  color: var(--muted);
  text-transform: uppercase;
  margin-bottom: 2px;
}

// Then in JS:
html += '<div class="title-row">Game</div>';
```

**Effort:** 3–4 hours (identify clusters, extract, test responsiveness)  
**Testing:**
- Visual regression: Screenshot app at 375px, 768px, 1920px before/after
- Verify no style breakage in each section
- Check responsive breakpoints still work

---

#### **M3: 82 Inline `onclick` Handlers vs 8 `addEventListener` Calls**

**Severity:** MEDIUM  
**Scope:** Scattered HTML generation code  
**Examples:**
```javascript
// Inline onclick (82 instances):
html += '<button onclick="loadTodayGame()">Refresh</button>';
html += '<div onclick="selectCalGame('+pk+')">Game</div>';

// addEventListener (8 instances):
document.addEventListener('click', handler);
// Sound panel only uses addEventListener
```

**Impact:**
- **Inconsistency:** Mixed patterns make code harder to scan
- **Testing:** Hard to stub/mock onclick for unit tests
- **Debugging:** onclick handlers don't show in DevTools Event Listeners tab
- **Error context:** onclick errors harder to trace
- **Event bubbling:** onclick doesn't propagate; addEventListener does

**Proposed Fix:**
Standardize on `addEventListener` + data-attributes:

```javascript
// Before:
html += '<button onclick="selectCalGame('+pk+')">Game</button>';

// After:
html += '<button class="cal-game-btn" data-gamepk="'+pk+'">Game</button>';

// Single delegated listener at document root:
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('cal-game-btn')) {
    selectCalGame(parseInt(e.target.dataset.gamepk));
  }
});
```

**Effort:** 2.5 hours (find & replace, add delegation listeners, test each section)  
**Testing:**
- Every interactive element still responds to click
- Test on mobile (touch → click)
- DevTools → Event Listeners should show clean structure

---

#### **M4: setInterval/setTimeout Spread Across Functions Without Centralized Cleanup**

**Severity:** MEDIUM  
**Scope:** Multiple functions; especially problematic in Pulse (23 timer calls)  
**Examples:**
```javascript
// Line 1083: Pulse polling
pulseTimer = setInterval(pollLeaguePulse, 15000);

// Line 1479: Story carousel
storyRotateTimer = setInterval(rotateStory, STORY_ROTATE_MS);

// Line 2796: Countdown timer
countdownTimer = setInterval(tick, 30000);

// Line 3835: Live game polling (5 minutes!)
liveInterval = setInterval(fetchLiveGame, 300000);
```

**Issue:**
- Timers stored in globals, but cleanup rules vary
- Live game timer never cleared if user tab-switches during game
- Story carousel timer cleared in some paths but not others
- Hard to audit: 23 timer calls, cleanup scattered across 5+ functions
- If user switches sections rapidly, timers can orphan

**Current Cleanup Pattern (inconsistent):**
```javascript
// Pattern 1: In closeLiveView()
clearInterval(liveInterval); liveInterval = null;

// Pattern 2: In switchMode() for Pulse
clearInterval(pulseTimer);
clearInterval(storyRotateTimer);
// ... but news carousel timer not listed!

// Pattern 3: Visibility change (visibilitychange event)
if (document.hidden) {
  clearInterval(storyRotateTimer);
}
```

**Impact:**
- **Memory leak:** Orphaned timers keep firing, hold references
- **CPU:** Wasted polls/animation frames
- **Hard to audit:** No single place to see "all timers must clear on X"

**Proposed Fix:**
Create a centralized timer registry + cleanup function:

```javascript
const timers = {
  pulse: null,
  storyRotate: null,
  newsRotate: null,
  countdown: null,
  liveGame: null,
  mockTick: null,
  // ... others
};

function clearAllTimers() {
  Object.keys(timers).forEach(key => {
    if (timers[key]) {
      clearInterval(timers[key]);
      timers[key] = null;
    }
  });
}

// Usage:
timers.pulseTimer = setInterval(pollLeaguePulse, 15000);
timers.storyRotateTimer = setInterval(rotateStory, STORY_ROTATE_MS);

// Cleanup is now simple:
function closeLiveView() {
  clearInterval(timers.liveGame);
  timers.liveGame = null;
  // ... other cleanup
}

function switchMode() {
  clearInterval(timers.pulseTimer);
  clearInterval(timers.storyRotateTimer);
  // ... or call clearAllTimers() to be safe
}
```

**Effort:** 2 hours (refactor timer assignments, test no orphaned timers)  
**Testing:**
- DevTools → Performance → Record, check for orphaned timers firing
- Switch sections rapidly, verify memory doesn't grow
- Pulse on, switch to Home, switch back to Pulse → verify timers restarted cleanly

---

### LOW PRIORITY (2 issues)

---

#### **L1: Magic Numbers Hardcoded in Code**

**Severity:** LOW  
**Scope:** Timeouts, breakpoints, poll intervals scattered throughout  
**Examples:**
```javascript
// Viewport breakpoints (in CSS):
@media(max-width:1024px)    // L1
@media(min-width:1025px)    // L1
@media(max-width:767px)     // L1
@media(max-width:480px)     // L1

// Timeouts (in JS):
setInterval(pollLeaguePulse, 15000);    // L1 (15 seconds)
setInterval(rotateStory, 4500);         // L1 (4.5 seconds, carousel)
setInterval(fetchLiveGame, 300000);     // L1 (5 minutes)
setInterval(fetchAllNews, 30000);       // L1 (30 seconds)
Math.pow(1 - s.decayRate, ageMin / 30); // L1 (30 = 30-minute window)
```

**Impact:**
- **Discoverability:** Hard to find all timeout values; scattered across file
- **Consistency:** If carousel timeout changes, developer must search entire file
- **Maintenance:** Large refactors require grep + careful editing
- **Testability:** Hard to adjust timeouts for unit tests

**Proposed Fix:**
Extract to named constants at top of JS section:

```javascript
// Viewport & Layout
const BREAKPOINT_DESKTOP = 1025;  // CSS min-width for desktop layout
const BREAKPOINT_TABLET = 768;    // CSS max-width for tablet portrait
const BREAKPOINT_MOBILE = 480;    // CSS max-width for mobile

// Polling & Timers
const PULSE_POLL_MS = 15000;      // Pulse feed poll interval
const STORY_ROTATE_MS = 4500;     // Carousel auto-rotate interval (v2.42)
const LIVE_GAME_POLL_MS = 300000; // Live game refresh (5 minutes)
const NEWS_POLL_MS = 30000;       // News carousel refresh (30 seconds)
const STORY_DECAY_WINDOW_MIN = 30; // Minutes per decay half-life
```

Then use constants:

```javascript
// Before:
pulseTimer = setInterval(pollLeaguePulse, 15000);

// After:
pulseTimer = setInterval(pollLeaguePulse, PULSE_POLL_MS);
```

**Effort:** 1 hour (extract + replace)  
**Testing:**
- No behavior change; purely organizational
- Linter: Verify no new violations

---

#### **L2: Function Naming Inconsistency**

**Severity:** LOW  
**Scope:** Story carousel and data-loading functions  
**Current Mix:**
```javascript
// Story generators: gen* prefix
function genHRStories() { ... }
function genNoHitterWatch() { ... }
function genWalkOffThreat() { ... }

// Data loaders: load* prefix
function loadTodayGame() { ... }
function loadNextGame() { ... }
function loadSchedule() { ... }
function loadProbablePitcherStats() { ... }

// Unclear naming (mixed patterns):
function buildStoryPool() { ... }       // "build" = synchronous construction
function fetchAllPlayerStats() { ... }  // "fetch" = async data retrieval
function fetchLiveGame() { ... }        // "fetch" = async
function buildGameDetailPanel() { ... } // "build" = but it's async!
```

**Impact:**
- **Discoverability:** Hard to find all story generators; gen* naming works, but inconsistent with others
- **Intent:** "fetch" vs "load" vs "build" vs "gen" could be clearer
- **Scanning:** Developers must read function body to understand what it does

**Proposed Fix:**
Establish naming convention and update new code to follow it:

```javascript
// Recommendation: Separate by intent
// fetch/get = async API calls, returns data
// build = sync construction of objects
// gen = story/event generator (special category)
// load = setup + fetch combined (OK for legacy)
// apply = mutate state (e.g. applyTeamTheme)
```

**Effort:** Low; mostly documentation + guidance for future PRs  
**Testing:** None required (documentation change)

---

## Summary Table

| ID | Title | Severity | Effort | Risk | Status |
|---|---|---|---|---|---|
| H1 | Remove empty updateHeader() | HIGH | 10m | Very Low | Pending Approval |
| H2 | Cleanup player card click listener | HIGH | 30m | Low | Pending Approval |
| H3 | Add fetch error handling (49 calls) | HIGH | 3–4h | Medium | Pending Approval |
| H4 | Add AbortController to fetch calls | HIGH | 2h | Low | Pending Approval |
| H5 | Fix event listener duplication | HIGH | 1h | Low | Pending Approval |
| M1 | ES6 var→let migration | MEDIUM | 2h | Low | Pending Approval |
| M2 | Extract inline styles to CSS | MEDIUM | 3–4h | Low | Pending Approval |
| M3 | Consolidate onclick to addEventListener | MEDIUM | 2.5h | Low | Pending Approval |
| M4 | Centralize timer cleanup | MEDIUM | 2h | Low | Pending Approval |
| L1 | Extract magic numbers to constants | LOW | 1h | Very Low | Pending Approval |
| L2 | Document naming conventions | LOW | 0h | N/A | Pending Approval |

**Total Estimated Time:** 17–21 hours  
**Recommended Approach:** Fix HIGH issues first (critical for stability), then tackle MEDIUM (code quality), then LOW (polish).

---

## Audit Sign-Off

**Auditor:** Claude  
**Date:** 2026-04-29  
**Confidence:** HIGH (comprehensive review of all major code sections)  
**Recommendations:** Approve all HIGH + MEDIUM issues. L2 can be deferred to next sprint.

