# Module Graph

This file documents the modular structure of the bundled JS, introduced in v3.39.0. It complements the legacy `app.js` (still kept as a fallback while the bundle proves stable).

---

## Current state (v3.39.0)

The split is intentionally minimal — just the scaffolding plus a single demonstration module:

```
src/
  main.js              — everything from the original app.js (lifted verbatim,
                         with constants extracted to ./config/constants.js).
                         Includes the window-global bridge at the bottom that
                         re-exposes ~95 functions to HTML onclick handlers.
  config/
    constants.js       — pure constants: SEASON, WC_SPOTS, MLB_BASE,
                         MLB_BASE_V1_1, TEAMS, MLB_THEME, NEWS_SOURCE_LABELS,
                         NEWS_SOURCE_ICONS, TIMING.
```

The bundle is built by `build.mjs` (esbuild → `dist/app.bundle.js`) and loaded in `index.html` via the `USE_BUNDLE` feature flag.

---

## Future layering (target state)

When extracting more subsystems out of `main.js`, follow this layering rule. Every module imports only from strictly lower layers — never from a higher layer or peer.

```
Layer 6: main.js (boot IIFE, event listeners, SW register)
Layer 5: bridge/windowGlobals.js (exposes onclick handlers to HTML)
Layer 4: sections/*, dev/*, demo/*       (UI section loaders)
Layer 3: carousel/*, focus/*, feed/*, collection/*, radio/*, push/*
Layer 2: pulse/*, ui/*, data/*           (polling, theme, helpers)
Layer 1: state.js, config/*, diag/*      (foundation: state + constants + logging)
```

Cross-cutting events (e.g. "polling triggers a carousel update") should use a shared `EventTarget` on `state.bus` rather than a direct import between Layer 3 modules. This avoids circular dependencies even when subsystems are tightly coupled.

---

## Hot-state rule

These globals are mutated by 3+ subsystems:
- `gameStates` — written by Polling, Demo Mode; read by Focus, Carousel, Feed
- `feedItems` — written by Polling; read by Carousel, Feed, Card Collection
- `focusGamePk` — written by Polling (auto-select), Focus Mode (manual); read by Radio (for pairing)

When extracting these, place them in `src/state.js` as properties of a single exported `state` object:

```js
export const state = {
  gameStates: {},
  feedItems: [],
  focusGamePk: null,
  // ...
};
```

Importers receive a live binding to the object — mutations propagate automatically. **Never** copy hot state into a module-local variable.

---

## Window-global bridge

`src/main.js` ends with an `Object.assign(window, { ... })` block that exposes ~95 functions to HTML inline `onclick=` handlers and keyboard shortcuts. When extracting a subsystem:

1. Move the function out of `main.js` into the new module.
2. `export` it from the module.
3. `import` it back at the top of `main.js`.
4. The existing `Object.assign(window, { ... })` continues to work — it just references the imported binding.

When deleting a function, remove it from the bridge as well. The verification command `grep -onE 'on(click|change|input|submit|keydown)="[a-zA-Z_]+' index.html` lists every name HTML expects on `window`.

---

## Build / dev workflow

- `npm run build` — single build into `dist/app.bundle.js` + `dist/app.bundle.js.map`
- `npm run watch` — esbuild watch mode for local development
- `python3 -m http.server 8080` — local dev server (Service Worker requires a non-`file://` origin)
- Service worker cache: bump `CACHE` in `sw.js` whenever `dist/app.bundle.js` ships a behavior change

---

## Revert path

The legacy `app.js` is preserved in the repo. To revert the bundle:

```bash
sed -i 's/window.USE_BUNDLE = true/window.USE_BUNDLE = false/' index.html
git commit -am "Revert: load legacy app.js"
git push
```

Then bump `CACHE` in `sw.js` if users have the bundle pinned in Service Worker cache.
