# Refactor Parity Check

A static verification that the modular bundle (`src/**/*.js` → `dist/app.bundle.js`) hasn't dropped any user-visible surface area from the legacy `app.js` monolith.

## What it checks

```
node scripts/verify-parity.mjs
```

| # | Check | Catches |
|---|---|---|
| 1 | Top-level function names | "Function got accidentally deleted during extraction" |
| 2 | HTML handler resolution | "onclick=foo() in HTML but `foo` no longer reaches `window`" |
| 3 | fetch() URL paths | "API call site silently dropped" |
| 4 | localStorage keys | "Storage key no longer read/written → state leak" |
| 5 | getElementById DOM contracts | "DOM element wired in legacy but never read in modular" |

Each check diffs the symbol set in `app.js` (the `USE_BUNDLE=false` fallback monolith) against the same symbols across all `src/**/*.js` modules. Any symbol present in legacy but missing in modular is reported as a potential regression.

The script is **static** — it does not validate behavior, only that no previously-shipped surface area was dropped. A clean pass means "every function name, HTML handler, API endpoint, storage key, and DOM ID that legacy used is also present in modular".

## Known-OK ignore list

A small handful of legacy items are intentionally absent in modular — they were dead code in legacy too (defined but never reachable). The script's `ignoreLegacy` lists these explicitly with comments explaining why:

- **`isDesktop`, `togglePushOnDesktop`, `updatePushRowVisibility`** — legacy had a dev-mode override to show the push toggle on desktop, but the entry point (`togglePushOnDesktop`) was never wired to any onclick handler and the HTML elements (`pushDesktopToggle`, `pushDesktopToggleKnob`) don't exist. CSS `@media(min-width:1025px){#pushRow{display:none!important}}` already handles desktop hiding.
- **`pushDesktopToggle`, `pushDesktopToggleKnob`, `pushRow` (JS read), `ptbSchemeBtn`** — DOM IDs only read inside the unreachable functions above, plus a `var btn=getElementById('ptbSchemeBtn')` in the legacy `updatePulseToggle` that bound the reference but never used it.

## When to run it

Before any commit that:
- merges a refactor branch to `main`
- moves code between modules
- removes "obviously dead" code
- bumps the major or minor version

The check runs in <1s and exits 0 on pass / non-zero on fail with `--strict`. CI integration is straightforward — add to `.github/workflows/build.yml` if you ever want to gate `main` merges on it.

## Interpreting "added in refactor" lists

Each section reports both directions:
- **only-legacy** — present in `app.js` but missing in `src/`. Each is a potential regression (or a confirmed dead-code drop, see ignore list).
- **only-modular** — added during the refactor. Common: callback-setter helpers (`setBookCallbacks`, `setPollCallbacks`, etc.), small clearTimer helpers extracted from inline blocks, module-private utilities. None of these need scrutiny — they're the architectural plumbing that lets the bundle work.

## What this does NOT cover

- **Behavioral correctness.** Two functions with the same name can implement different logic. This check confirms the surface area is preserved, not that every code path matches.
- **Argument-shape changes.** `foo(a, b)` vs `foo({a, b})` — same name, different signature.
- **Race conditions and timing bugs.** A regression that only appears when DOMContentLoaded fires before/after some other event won't show up here. (See the v3.39.35 dev-tools bug fix for an example of why these need live testing too.)
- **Async/Promise behavior.** A function that still exists but no longer awaits something is invisible here.

For those, **live testing during a Pulse session** is the only safe verification.
