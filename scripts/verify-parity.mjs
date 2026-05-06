#!/usr/bin/env node
// ── Refactor parity check ───────────────────────────────────────────────────
// Compares the legacy monolithic app.js (USE_BUNDLE=false fallback) against
// the modular source set under src/**/*.js. Reports any user-visible surface
// area present in legacy but missing in modules — these are regressions we
// accidentally dropped during the v3.39 → v3.40 refactor.
//
// Checks performed:
//   1. Top-level function names — was every named function preserved?
//   2. HTML handler resolution — does every onclick/onchange/onkeydown name
//      reach a function on the modular bundle's window bridge?
//   3. fetch() URL paths — same set of API endpoints called?
//   4. localStorage keys — same set of storage keys used?
//   5. getElementById IDs — same set of DOM contracts read?
//
// Usage:
//   node scripts/verify-parity.mjs              # full report
//   node scripts/verify-parity.mjs --strict     # exit 1 on any gap
//
// This is a STATIC parity check. It does NOT validate behavior —
// only that no previously-shipped surface area was dropped. A clean
// report means "the same function names + DOM contracts + API calls
// + storage keys exist", not "every code path matches byte-for-byte".

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const STRICT = process.argv.includes('--strict');

// ── File loaders ─────────────────────────────────────────────────────────────

function readLegacy() {
  return readFileSync(join(ROOT, 'app.js'), 'utf8');
}

function readModuleSources() {
  // Concatenate all src/**/*.js files for analysis.
  const files = [];
  function walk(dir) {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) walk(full);
      else if (st.isFile() && entry.endsWith('.js')) files.push(full);
    }
  }
  walk(join(ROOT, 'src'));
  return {
    files,
    text: files.map(f => `// === ${relative(ROOT, f)} ===\n` + readFileSync(f, 'utf8')).join('\n\n'),
  };
}

function readIndexHtml() {
  return readFileSync(join(ROOT, 'index.html'), 'utf8');
}

// ── Extractors (return Sets) ─────────────────────────────────────────────────

// Match top-level `function name(` and `async function name(` declarations.
// Also catches `export function name(` in modules.
function extractFunctionNames(src) {
  const out = new Set();
  const re = /(?:^|\n)(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z_$][\w$]*)\s*\(/g;
  let m;
  while ((m = re.exec(src)) !== null) out.add(m[1]);
  return out;
}

// Match window-bridge surface — what HTML inline handlers can reach via `window.X`.
//   Modular bundle: explicit `window.X = ...` + `Object.assign(window, { X, Y })`
//   Legacy classic script: ALL top-level `function name(){}` declarations
//     are automatically `window.name` (no module wrapper).
function extractWindowBridge(src, { isClassicScript = false } = {}) {
  const out = new Set();
  // Form 1: direct window.X = ...
  const re1 = /window\.([a-zA-Z_$][\w$]*)\s*=/g;
  let m;
  while ((m = re1.exec(src)) !== null) out.add(m[1]);
  // Form 2: Object.assign(window, { ... })
  const re2 = /Object\.assign\(\s*window\s*,\s*\{([\s\S]*?)\}\s*\)/g;
  while ((m = re2.exec(src)) !== null) {
    const contents = m[1];
    const clean = contents.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    const idRe = /([a-zA-Z_$][\w$]*)\s*[,:}]/g;
    let im;
    while ((im = idRe.exec(clean)) !== null) {
      const name = im[1];
      if (!['function', 'true', 'false', 'null', 'undefined', 'return', 'this'].includes(name)) {
        out.add(name);
      }
    }
  }
  // Legacy classic script: top-level function declarations are ALSO on window.
  // (Bundle is wrapped in an IIFE, so those are NOT on window unless re-exported.)
  if (isClassicScript) {
    for (const fn of extractFunctionNames(src)) out.add(fn);
  }
  return out;
}

// Match every HTML inline event handler invocation: onclick="foo(...)" etc.
function extractHtmlHandlers(html) {
  const out = new Set();
  const re = /\bon(?:click|change|input|submit|keydown|keyup|mouseover|mouseout|focus|blur)\s*=\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    // Each attribute value can call multiple functions: "foo(); bar()"
    const calls = m[1].matchAll(/([a-zA-Z_$][\w$]*)\s*\(/g);
    for (const c of calls) out.add(c[1]);
  }
  return out;
}

// Match fetch() URL paths. URLs are often built from concatenation
// (`MLB_BASE + '/schedule?...'`) so we extract the path-bearing literal.
function extractFetchPaths(src) {
  const out = new Set();
  // Find every fetch( call — capture the first arg up to the closing paren or comma
  const re = /fetch\s*\(\s*([^,)]+)/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const arg = m[1];
    // Pull every string literal out and look for a path-shaped one
    const litRe = /['"`]([^'"`]+)['"`]/g;
    let lm;
    while ((lm = litRe.exec(arg)) !== null) {
      const lit = lm[1];
      // Path-shaped: starts with /, or has /api/, /game/, etc.
      const pathMatch = lit.match(/(\/[a-z][a-z0-9_-]*(?:\/[^?'"\s]*)?)/i);
      if (pathMatch) {
        // Strip query string for cleaner diff
        out.add(pathMatch[1].split('?')[0]);
      }
    }
  }
  return out;
}

// Match localStorage.getItem / setItem / removeItem keys (literal-key calls only)
function extractLocalStorageKeys(src) {
  const out = new Set();
  const re = /localStorage\.(?:get|set|remove)Item\s*\(\s*['"`]([^'"`]+)['"`]/g;
  let m;
  while ((m = re.exec(src)) !== null) out.add(m[1]);
  return out;
}

// Match getElementById('X') — DOM contract — both literal and template-literal forms
function extractElementIds(src) {
  const out = new Set();
  const re = /getElementById\s*\(\s*['"`]([^'"`${}]+)['"`]/g;
  let m;
  while ((m = re.exec(src)) !== null) out.add(m[1]);
  return out;
}

// ── Diff utilities ───────────────────────────────────────────────────────────

function diffSets(legacy, modular) {
  const onlyLegacy = [...legacy].filter(x => !modular.has(x)).sort();
  const onlyModular = [...modular].filter(x => !legacy.has(x)).sort();
  const both = [...legacy].filter(x => modular.has(x)).length;
  return { onlyLegacy, onlyModular, both };
}

function printSection(title, diff, opts = {}) {
  const { ignoreModularExtras = false, ignoreLegacy = [] } = opts;
  const drops = diff.onlyLegacy.filter(x => !ignoreLegacy.includes(x));
  const adds = diff.onlyModular;
  const status = drops.length === 0 ? '✓' : '✗';
  console.log(`\n${status} ${title}`);
  console.log(`  shared: ${diff.both} · only-legacy: ${drops.length} · only-modular: ${adds.length}`);
  if (drops.length) {
    console.log(`  ⚠ DROPPED in refactor (${drops.length}):`);
    for (const name of drops) console.log(`     - ${name}`);
  }
  if (!ignoreModularExtras && adds.length) {
    console.log(`  ℹ added in refactor (${adds.length}):`);
    for (const name of adds.slice(0, 20)) console.log(`     + ${name}`);
    if (adds.length > 20) console.log(`     … +${adds.length - 20} more`);
  }
  return drops.length;
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Refactor parity check — legacy app.js vs src/**/*.js');
  console.log('═══════════════════════════════════════════════════════════════');

  const legacy = readLegacy();
  const { files, text: modular } = readModuleSources();
  const html = readIndexHtml();

  console.log(`\nLegacy: app.js (${(legacy.length / 1024).toFixed(1)} KB)`);
  console.log(`Modular: ${files.length} files under src/`);

  let totalDrops = 0;

  // 1. Function names
  totalDrops += printSection(
    '1. Top-level function names',
    diffSets(extractFunctionNames(legacy), extractFunctionNames(modular)),
    {
      // Verified dead code — never reachable in legacy:
      //  - `togglePushOnDesktop` / `updatePushRowVisibility` / `isDesktop`
      //    were a dev-only desktop-push override, but the only entry point
      //    `togglePushOnDesktop` was never called from HTML or JS — the HTML
      //    elements `pushDesktopToggle` / `pushDesktopToggleKnob` don't exist.
      //    Push row hiding on desktop is handled by CSS @media query alone.
      ignoreLegacy: ['isDesktop', 'togglePushOnDesktop', 'updatePushRowVisibility'],
    }
  );

  // 2. HTML handler resolution — every onclick="foo(...)" should resolve to
  // a window-bridge entry on the modular bundle.
  // Legacy classic <script>: every top-level function is automatically window.X.
  // Modular bundle (IIFE): only explicit Object.assign(window,{...}) reaches HTML.
  const legacyBridge = extractWindowBridge(legacy, { isClassicScript: true });
  const modularBridge = extractWindowBridge(modular);
  const htmlNames = extractHtmlHandlers(html);
  const unresolvedLegacy = [...htmlNames].filter(n => !legacyBridge.has(n));
  const unresolvedModular = [...htmlNames].filter(n => !modularBridge.has(n));
  console.log('\n' + (unresolvedModular.length <= unresolvedLegacy.length ? '✓' : '✗') + ' 2. HTML handler resolution');
  console.log(`  HTML calls ${htmlNames.size} distinct function names`);
  console.log(`  unresolved against legacy bridge: ${unresolvedLegacy.length}`);
  console.log(`  unresolved against modular bridge: ${unresolvedModular.length}`);
  if (unresolvedLegacy.length) {
    console.log(`  ℹ pre-existing legacy gaps (always broken — these names were never wired):`);
    for (const name of unresolvedLegacy) console.log(`     · ${name}`);
  }
  const newGaps = unresolvedModular.filter(n => !unresolvedLegacy.includes(n));
  if (newGaps.length) {
    console.log(`  ⚠ NEW unresolved in modular (regression):`);
    for (const name of newGaps) console.log(`     - ${name}`);
    totalDrops += newGaps.length;
  }

  // 3. fetch() URL paths
  totalDrops += printSection(
    '3. fetch() URL paths',
    diffSets(extractFetchPaths(legacy), extractFetchPaths(modular)),
  );

  // 4. localStorage keys
  totalDrops += printSection(
    '4. localStorage keys',
    diffSets(extractLocalStorageKeys(legacy), extractLocalStorageKeys(modular)),
  );

  // 5. getElementById DOM contracts
  totalDrops += printSection(
    '5. getElementById DOM contracts',
    diffSets(extractElementIds(legacy), extractElementIds(modular)),
    {
      ignoreModularExtras: false,
      // Verified dead reads — present only in unreachable legacy code:
      //  - `pushDesktopToggle` / `pushDesktopToggleKnob` / `pushRow` (JS read)
      //    only accessed from `togglePushOnDesktop` / `updatePushRowVisibility`,
      //    which had no entry point.
      //  - `ptbSchemeBtn` was a `var btn = getElementById('ptbSchemeBtn')` in
      //    legacy `updatePulseToggle` that was never used (bound but never read).
      ignoreLegacy: ['pushDesktopToggle', 'pushDesktopToggleKnob', 'pushRow', 'ptbSchemeBtn'],
    },
  );

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════');
  if (totalDrops === 0) {
    console.log('  ✓ PASS — no functions, handlers, or contracts dropped.');
    console.log('  Modular bundle covers every legacy surface.');
    console.log('═══════════════════════════════════════════════════════════════');
    process.exit(0);
  } else {
    console.log(`  ✗ FAIL — ${totalDrops} gap(s) detected. See ⚠ markers above.`);
    console.log('  Each "DROPPED" entry is a function/handler/path that');
    console.log('  appeared in app.js but is missing from src/**/*.js.');
    console.log('═══════════════════════════════════════════════════════════════');
    process.exit(STRICT ? 1 : 0);
  }
}

main();
