// MLB Pulse — modular bundle entry point.
// This file is filled in by Commit 2. Commit 1 provides the scaffolding only.
// Boot order, when implemented:
//   1. diag/devLog.js  (console wrap — must run before anything else logs)
//   2. diag/devNet.js  (fetch wrap — must run before anything else fetches)
//   3. state.js + config/* (foundation)
//   4. All subsystems (pulse, focus, carousel, ...)
//   5. bridge/windowGlobals.js (expose ~70 onclick handlers)
//   6. Boot IIFE (restores localStorage, applies theme, starts polls)
console.log('[boot] src/main.js placeholder — bundle not yet wired into index.html');
