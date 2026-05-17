// DEBUG START — touch/click event tracer for diagnosing settings-close failures.
// Toggle with Shift+T. Remove this file and its wiring in main.js when done.

const MAX_ENTRIES = 20;
const CLICK_WINDOW_MS = 600;

let panelEl = null;
let entries = [];
let pendingTouches = [];

function elDesc(el) {
  if (!el) return 'null';
  let s = el.tagName.toLowerCase();
  if (el.id) s += '#' + el.id;
  else if (el.className && typeof el.className === 'string') {
    const cls = el.className.trim().split(/\s+/).slice(0, 2).join('.');
    if (cls) s += '.' + cls;
  }
  return s;
}

function settingsOpen() {
  const p = document.getElementById('settingsPanel');
  return !!(p && p.classList.contains('open'));
}

function insideWrap(el) {
  const w = document.querySelector('.settings-wrap');
  return !!(w && w.contains(el));
}

function ts() {
  return new Date().toTimeString().slice(3, 8); // MM:SS
}

function push(entry) {
  entries.unshift(entry);
  if (entries.length > MAX_ENTRIES) entries.pop();
  render();
}

function row(e) {
  const warn = e.warn;
  const col = warn ? '#f97316' : e.ok ? '#22c55e' : '#94a3b8';
  return '<div style="font-size:10px;line-height:1.5;padding:3px 0;border-bottom:1px solid rgba(255,255,255,.07);color:' + col + '">'
    + '<span style="opacity:.45;margin-right:4px">' + e.t + '</span>'
    + '<strong style="color:#e2e8f0">' + e.kind + '</strong> '
    + '<span style="opacity:.7">' + e.target + '</span> '
    + '<span style="opacity:.5">panel=' + (e.open ? 'OPEN' : 'closed') + '</span> '
    + (e.note ? '<span style="margin-left:4px">' + e.note + '</span>' : '')
    + '</div>';
}

function render() {
  if (!panelEl) return;
  panelEl.querySelector('.tdbg-rows').innerHTML = entries.map(row).join('');
}

function buildPanel() {
  panelEl = document.createElement('div');
  panelEl.id = 'touchDebugPanel';
  panelEl.style.cssText = [
    'position:fixed', 'top:68px', 'right:8px', 'width:300px',
    'background:rgba(8,12,28,.96)', 'border:1px solid rgba(255,255,255,.18)',
    'border-radius:12px', 'padding:10px', 'z-index:9999',
    'font-family:monospace', 'display:none', 'flex-direction:column', 'gap:6px',
    'box-shadow:0 8px 32px rgba(0,0,0,.6)'
  ].join(';');
  panelEl.innerHTML = [
    '<div style="display:flex;justify-content:space-between;align-items:center">',
    '  <span style="font-size:11px;font-weight:700;color:#fff">Touch Debug</span>',
    '  <span style="font-size:10px;color:rgba(255,255,255,.4)">Shift+T · <button id="tdbgClear" style="background:none;border:none;color:rgba(255,255,255,.4);cursor:pointer;font-size:10px;padding:0">clear</button></span>',
    '</div>',
    '<div style="font-size:9px;color:rgba(255,255,255,.35);margin-top:-2px">',
    '  🟠 swallowed (no click) · 🟢 closed · ⚫ no action needed',
    '</div>',
    '<div class="tdbg-rows" style="max-height:260px;overflow-y:auto"></div>'
  ].join('');
  document.body.appendChild(panelEl);
  document.getElementById('tdbgClear').addEventListener('click', function(e) {
    e.stopPropagation();
    entries = [];
    render();
  });
}

export function toggleTouchDebug() {
  if (!panelEl) buildPanel();
  panelEl.style.display = panelEl.style.display === 'none' ? 'flex' : 'none';
}

export function installTouchDebug() {
  // Capture phase so we see the DOM state BEFORE any close-handlers fire.

  document.addEventListener('touchstart', function(e) {
    const target = e.target;
    const open = settingsOpen();
    const id = Date.now() + Math.random();
    pendingTouches.push({ id: id, target: target, open: open, t: ts() });

    // If no click arrives within CLICK_WINDOW_MS, the touch was swallowed.
    setTimeout(function() {
      const idx = pendingTouches.findIndex(function(p) { return p.id === id; });
      if (idx === -1) return; // click arrived, already cleared
      const pt = pendingTouches.splice(idx, 1)[0];
      push({
        kind: 'touch⚡', t: pt.t,
        target: elDesc(pt.target),
        open: pt.open,
        note: pt.open ? '→ NO CLICK FIRED ⚠' : '(no click — background tap)',
        warn: pt.open,
        ok: false
      });
    }, CLICK_WINDOW_MS);
  }, { passive: true, capture: true });

  document.addEventListener('click', function(e) {
    const target = e.target;
    const open = settingsOpen();
    const inside = insideWrap(target);

    // Clear the matching pending touch.
    if (pendingTouches.length) pendingTouches.shift();

    let note, ok;
    if (inside) {
      note = '→ inside wrap, keep open';
      ok = false;
    } else if (open) {
      note = '→ will close ✓';
      ok = true;
    } else {
      note = '→ nothing to close';
      ok = false;
    }

    push({ kind: 'click', t: ts(), target: elDesc(target), open: open, note: note, ok: ok, warn: false });
  }, { capture: true });
}

// DEBUG END
