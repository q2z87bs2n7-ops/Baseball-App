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

const swConfig = {
  entryPoints: ['sw.js'],
  bundle: false,
  outfile: 'sw.js',
  allowOverwrite: true,
  define,
  logLevel: 'info',
};

function rewriteIndexHtml() {
  const path = './index.html';
  const html = readFileSync(path, 'utf8');
  const next = html
    .replace(/dist\/app\.bundle\.js\?v=[^"']+/g, `dist/app.bundle.js?v=${VERSION}`)
    .replace(/dist\/styles\.min\.css\?v=[^"']+/g, `dist/styles.min.css?v=${VERSION}`);
  if (next !== html) {
    writeFileSync(path, next);
    console.log(`esbuild: rewrote index.html cache-bust to v=${VERSION}`);
  }
}

if (watch) {
  const jsCtx = await esbuild.context(jsConfig);
  const cssCtx = await esbuild.context(cssConfig);
  const swCtx = await esbuild.context(swConfig);
  await Promise.all([jsCtx.watch(), cssCtx.watch(), swCtx.watch()]);
  rewriteIndexHtml();
  console.log('esbuild: watching src/ and styles.css for changes...');
} else {
  await Promise.all([esbuild.build(jsConfig), esbuild.build(cssConfig), esbuild.build(swConfig)]);
  rewriteIndexHtml();
  console.log(`esbuild: built dist/app.bundle.js + dist/styles.min.css + sw.js (v${VERSION})`);
}
