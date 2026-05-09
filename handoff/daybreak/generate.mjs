// Render handoff/daybreak/splash-template.html at each device size in sizes.json
// (portrait + landscape) and write PNGs to icons/splash/.
//
// Uses globally-installed Playwright (npm i -g playwright). Run via `bash build.sh`.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here     = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const template = `file://${resolve(here, 'splash-template.html')}`;
const outDir   = resolve(repoRoot, 'icons', 'splash');

const sizes    = JSON.parse(await readFile(resolve(here, 'sizes.json'), 'utf8'));

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const wait    = ms => new Promise(r => setTimeout(r, ms));

for (const { device, w, h, dpr } of sizes) {
  for (const orientation of ['portrait', 'landscape']) {
    const [pw, ph] = orientation === 'portrait' ? [w, h] : [h, w];
    // CSS viewport = physical pixels / DPR. Playwright's deviceScaleFactor
    // captures at physical resolution while keeping CSS layout authentic.
    const ctx = await browser.newContext({
      viewport: { width: pw / dpr, height: ph / dpr },
      deviceScaleFactor: dpr,
    });
    const page = await ctx.newPage();
    await page.goto(template, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await wait(150); // belt-and-braces for late font/glow paints
    const out = resolve(outDir, `splash-${pw}x${ph}.png`);
    await page.screenshot({ path: out, type: 'png', omitBackground: false });
    await ctx.close();
    console.log(`  ✓ ${pw}x${ph}  (${device}, ${orientation})`);
  }
}

await browser.close();
console.log(`\n✔ ${sizes.length * 2} PNGs written to icons/splash/`);
