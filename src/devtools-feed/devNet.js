// ── 🌐 Network trace ─────────────────────────────────────────────────────────
// Wraps fetch() to capture {ts, method, url, status, ok, ms, sizeBytes, errorMsg}
// into a small ring buffer. Pure metadata — never reads the response body, so
// downstream consumers see an unmodified Response. Surfaced in Dev Tools →
// Network. Service worker (sw.js) and any pre-bundle scripts are not affected.
//
// Importing this module has side effects: it wraps window.fetch. Import it
// once, before any other module performs a fetch.

import { pushDevLog } from './devLog.js';

export const DEV_NET_CAP = 50;
export const devNetLog = [];

(function wrapFetch() {
  if (typeof window === 'undefined' || !window.fetch) return;
  var origFetch = window.fetch.bind(window);
  window.fetch = function(input, init) {
    var t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    var url = (typeof input === 'string') ? input : (input && input.url) || '';
    var method = (init && init.method) || (input && input.method) || 'GET';
    var entry = { ts: Date.now(), method: method.toUpperCase(), url: url, status: null, ok: null, ms: null, sizeBytes: null, errorMsg: null };
    devNetLog.push(entry);
    if (devNetLog.length > DEV_NET_CAP) devNetLog.splice(0, devNetLog.length - DEV_NET_CAP);
    return origFetch(input, init).then(function(res) {
      var t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      entry.ms = Math.round(t1 - t0);
      entry.status = res.status;
      entry.ok = res.ok;
      try {
        var cl = res.headers && res.headers.get && res.headers.get('content-length');
        if (cl) entry.sizeBytes = parseInt(cl, 10);
      } catch (e) {}
      if (!res.ok) pushDevLog('warn', 'net', [method.toUpperCase() + ' ' + res.status + ' · ' + url + ' · ' + entry.ms + 'ms']);
      return res;
    }, function(err) {
      var t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      entry.ms = Math.round(t1 - t0);
      entry.ok = false;
      entry.errorMsg = (err && err.message) ? err.message : String(err);
      pushDevLog('error', 'net', [method.toUpperCase() + ' FAILED · ' + url + ' · ' + entry.errorMsg]);
      throw err;
    });
  };
})();
