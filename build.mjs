import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));
const VERSION = pkg.version;
const define = { '__APP_VERSION__': JSON.stringify(VERSION) };

const watch = process.argv.includes('--watch');

const jsConfig = {
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  outfile: 'dist/app.bundle.js',
  sourcemap: true,
  define,
  logLevel: 'info',
};

const cssConfig = {
  entryPoints: ['styles.css'],
  bundle: false,
  minify: true,
  outfile: 'dist/styles.min.css',
  loader: { '.css': 'css' },
  logLevel: 'info',
};

// sw.js is mutated in place by regex replacement, NOT by esbuild's `define`.
// Reason: after the first build, sw.js no longer contains the `__APP_VERSION__`
// identifier — it has the substituted literal. esbuild's define only replaces
// identifiers, so subsequent builds were no-ops and CACHE got stuck at the
// first-build version (v4.13.1 was frozen for the entire claude/review-repo-
// structure branch). Same regex approach used for index.html below.
function rewriteVersionedFiles() {
  const indexPath = './index.html';
  const html = readFileSync(indexPath, 'utf8');
  const nextHtml = html
    .replace(/dist\/app\.bundle\.js\?v=[^"']+/g, `dist/app.bundle.js?v=${VERSION}`)
    .replace(/dist\/styles\.min\.css\?v=[^"']+/g, `dist/styles.min.css?v=${VERSION}`);
  if (nextHtml !== html) {
    writeFileSync(indexPath, nextHtml);
    console.log(`esbuild: rewrote index.html cache-bust to v=${VERSION}`);
  }

  const swPath = './sw.js';
  const sw = readFileSync(swPath, 'utf8');
  const nextSw = sw.replace(/const CACHE\s*=\s*["']mlb-v[^"']+["']\s*;/, `const CACHE = "mlb-v${VERSION}";`);
  if (nextSw !== sw) {
    writeFileSync(swPath, nextSw);
    console.log(`esbuild: rewrote sw.js CACHE to mlb-v${VERSION}`);
  }
}

if (watch) {
  const jsCtx = await esbuild.context(jsConfig);
  const cssCtx = await esbuild.context(cssConfig);
  await Promise.all([jsCtx.watch(), cssCtx.watch()]);
  rewriteVersionedFiles();
  console.log('esbuild: watching src/ and styles.css for changes...');
} else {
  await Promise.all([esbuild.build(jsConfig), esbuild.build(cssConfig)]);
  rewriteVersionedFiles();
  console.log(`esbuild: built dist/app.bundle.js + dist/styles.min.css + rewrote sw.js (v${VERSION})`);
}
