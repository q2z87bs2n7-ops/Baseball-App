// ── 🔍 Dev log ring buffer ───────────────────────────────────────────────────
// In-memory capture of console output + uncaught errors so Dev Tools → Log Capture
// can surface them on iPad/phone where the browser console isn't reachable. Cap
// is intentionally small — this is "what just happened?" not durable telemetry.
//
// Importing this module has side effects: it wraps console.log/info/warn/error
// and registers window error/unhandledrejection listeners. Import it once,
// FIRST, before any other code that might log.

export const DEV_LOG_CAP = 500;
export const devLog = []; // {ts:number, level:'log'|'warn'|'error'|'info', src:string, msg:string}

export function pushDevLog(level, src, args) {
  try {
    let msg = Array.prototype.map.call(args, function(a) {
      if (a == null) return String(a);
      if (typeof a === 'string') return a;
      if (a instanceof Error) return (a.stack || (a.name + ': ' + a.message));
      try { return JSON.stringify(a); } catch (e) { return String(a); }
    }).join(' ');
    if (msg.length > 600) msg = msg.slice(0, 600) + '…';
    devLog.push({ ts: Date.now(), level: level, src: src || '', msg: msg });
    if (devLog.length > DEV_LOG_CAP) devLog.splice(0, devLog.length - DEV_LOG_CAP);
  } catch (e) { /* swallow — logging must never throw */ }
}

(function wrapConsole() {
  ['log', 'info', 'warn', 'error'].forEach(function(lvl) {
    const orig = console[lvl];
    console[lvl] = function() {
      pushDevLog(lvl === 'info' ? 'log' : lvl, '', arguments);
      try { orig.apply(console, arguments); } catch (e) {}
    };
  });
})();

window.addEventListener('error', function(e) {
  pushDevLog('error', 'window', [e && e.message ? e.message : 'error', e && e.filename ? (e.filename + ':' + e.lineno) : '']);
});

window.addEventListener('unhandledrejection', function(e) {
  const r = e && e.reason;
  pushDevLog('error', 'promise', [r && r.stack ? r.stack : (r && r.message ? r.message : String(r))]);
});

// Always-on event trace — feeds Log Capture regardless of DEBUG flag. Use at major
// event boundaries (boot, navigation, polls, focus changes, theme apply, collection
// adds, radio start/stop, etc.) so the buffer is useful in production where
// DEBUG=false and console.log calls are otherwise gated out.
export function devTrace(src) {
  const args = Array.prototype.slice.call(arguments, 1);
  pushDevLog('log', src || 'app', args);
  // Note: DEBUG flag is checked via typeof so this works even if main.js
  // hasn't declared DEBUG yet (function-call-time evaluation).
  if (typeof DEBUG !== 'undefined' && DEBUG) {
    try { console.log.apply(console, ['[' + (src || 'app') + ']'].concat(args)); } catch (e) {}
  }
}
