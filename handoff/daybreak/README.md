# PWA Splash Screen — Implementation Spec

**Project:** Pulse (MLB Tracker) · **Shipped:** v4.7.1
**Scope:** iOS PWA `apple-touch-startup-image` set + Android manifest splash
**Source design:** `splash-template.html` in this folder

> **Implementation note (v4.7.1):** we ship a curated **12-PNG cut** (6 device rows × 2 orientations), not the 28-PNG full matrix described below. Device list lives in `sizes.json`. Older devices (iPhone 8/SE/11/XR/X-era, older iPads) fall through to the manifest `background_color` (solid navy `#0a1929`). To add a device, edit `sizes.json`, run `bash handoff/daybreak/build.sh`, hand-add the matching `<link>` tag to `index.html`. Splashes are **not** pre-cached by `sw.js` — iOS loads them from the OS shell, not via fetch.

---

## 1. What to build

A vertical-gradient splash image that bridges the warm home-screen icon palette to the app's dark navy default theme. One source SVG → 28 PNGs (14 sizes × 2 orientations).

**Visual:**
- Vertical gradient: peach (top) → coral → dusk pink → twilight → indigo → navy (bottom)
- Soft radial cream glow at top edge
- Subtle 2-layer dot-grid star field in lower 35%
- Centered: pulse waveform mark (cream/white) from `source/favicon.svg`
- Below mark: wordmark `PULSE` (Archivo 900) + tagline `LIVE · BASEBALL` (JetBrains Mono)

**Background color (manifest):** `#0a1929` — matches the app's default dark theme.

---

## 2. Design tokens

| Token | Value | Use |
|---|---|---|
| `--peach` | `#F5B49A` | Top of gradient (0%) |
| `--coral` | `#E88A6F` | Gradient stop (18%) |
| `--dusk` | `#C45A85` | Gradient stop (32%) |
| `--twilight` | `#6F4368` | Gradient stop (48%) |
| `--indigo` | `#2C3754` | Gradient stop (65%) |
| `--navy` | `#0a1929` | Bottom (100%) — matches app bg |
| `--cream` | `#FAFAF6` | Wordmark, mark stroke |
| `--cream-dim` | `rgba(250,250,246,0.6)` | Tagline |

**Background gradient (CSS):**
```css
background: linear-gradient(180deg,
  #F5B49A 0%,
  #E88A6F 18%,
  #C45A85 32%,
  #6F4368 48%,
  #2C3754 65%,
  #14233D 80%,
  #0a1929 100%);
```

**Top glow:**
```css
background: radial-gradient(ellipse at 50% 0%,
  rgba(255,220,200,0.45) 0%, transparent 60%);
/* element: 130% width, 1.6 aspect-ratio, anchored top-center */
```

**Star field (lower 35%, masked):**
```css
background-image:
  radial-gradient(rgba(255,255,255,0.5) 0.5px, transparent 0.7px),
  radial-gradient(rgba(245,200,74,0.3) 0.5px, transparent 0.7px);
background-size: 14px 11px, 23px 19px;
background-position: 0 0, 7px 5px;
mask-image: linear-gradient(180deg, transparent 0%, black 60%);
```

---

## 3. Layout

- **Mark + wordmark stack** is centered both axes with `transform: translateY(0)` (true center).
- **Stack gap:** 22px between waveform and wordmark; 4px between wordmark and tagline.
- **Mark size:** 56% of shorter screen edge on iPhone, 42% on iPad.
- **Wordmark size:** 32px on iPhone reference (1290×2796), 40px on iPad reference (2048×2732). Scale linearly with output dimensions.
- **Letter-spacing:** wordmark `0.32em` with matching `text-indent: 0.32em` (so the visual block stays centered despite trailing kerning).
- **Tagline letter-spacing:** `0.32em` + matching text-indent; 9px reference size.
- **Safe area:** all content sits within the inner 70% of the canvas. Top status bar overlap is fine — splash content never goes within 15% of any edge.

---

## 4. Source files in this folder

```
handoff/daybreak/
├── README.md              ← this file
├── splash-template.html   ← renderable template (used by puppeteer)
├── source/
│   └── favicon.svg        ← pulse waveform mark (already in repo)
├── head-snippet.html      ← 28 <link> tags ready to paste into index.html
├── manifest-patch.json    ← background_color update for manifest.json
├── size-matrix.json       ← machine-readable device size table
└── build.sh               ← one-command regeneration script
```

---

## 5. Required device matrix (28 PNGs)

iOS only honors `apple-touch-startup-image` when **exact pixel dimensions and `device-pixel-ratio`** match. Generate one PNG per row × portrait + landscape.

| Device | Portrait | Landscape | DPR |
|---|---|---|---|
| iPhone 16 Pro Max / 15 Pro Max | 1320×2868 | 2868×1320 | 3 |
| iPhone 16 Plus / 15 Plus / 14 Pro Max | 1290×2796 | 2796×1290 | 3 |
| iPhone 16 Pro / 15 Pro | 1206×2622 | 2622×1206 | 3 |
| iPhone 16 / 15 / 14 / 13 | 1179×2556 | 2556×1179 | 3 |
| iPhone 14 Plus / 13 Pro Max | 1284×2778 | 2778×1284 | 3 |
| iPhone 13 mini / 12 mini / 11 Pro / X | 1125×2436 | 2436×1125 | 3 |
| iPhone 11 / XR | 828×1792 | 1792×828 | 2 |
| iPhone 11 Pro Max / XS Max | 1242×2688 | 2688×1242 | 3 |
| iPhone 8 Plus / 7 Plus / 6S Plus | 1242×2208 | 2208×1242 | 3 |
| iPhone 8 / 7 / 6S / SE 2/3 | 750×1334 | 1334×750 | 2 |
| iPad Pro 12.9" (3rd–6th gen) | 2048×2732 | 2732×2048 | 2 |
| iPad Pro 11" / Air 4–5 | 1668×2388 | 2388×1668 | 2 |
| iPad Air 3 / Pro 10.5" | 1668×2224 | 2224×1668 | 2 |
| iPad mini / Air / 9.7" / 10.2" | 1536×2048 | 2048×1536 | 2 |

Filename convention: `splash-{W}x{H}.png` (e.g. `splash-1290x2796.png`, `splash-2796x1290.png`).
All output to `icons/splash/` in repo root.

---

## 6. Generation pipeline

**Recommended:** use `pwa-asset-generator` with `splash-template.html` as input. It:
- Renders the HTML headless via puppeteer
- Crops to each matrix size
- Emits all 28 PNGs
- Auto-writes 28 `<link>` tags into `index.html`
- Auto-updates `manifest.json` `background_color`

```bash
# from repo root
bash handoff/daybreak/build.sh
```

The build script wraps:
```bash
npx pwa-asset-generator handoff/daybreak/splash-template.html icons/splash/ \
  --background "#0a1929" \
  --splash-only \
  --type png \
  --opaque true \
  --padding "0px" \
  --index index.html \
  --manifest manifest.json \
  --log true
```

Runtime: ~30 seconds. Fonts (Archivo, JetBrains Mono) load from Google Fonts during render — internet required.

---

## 7. File changes after generation

```
icons/
├── favicon.svg                    (existing)
├── icon-180.png                   (existing)
├── icon-192.png                   (existing)
├── icon-512.png                   (existing)
├── icon-maskable-512.png          (existing)
├── icon-mono.svg                  (existing)
└── splash/                        ← NEW
    ├── splash-1290x2796.png       (and 27 more — see size matrix)
    └── ...

index.html                         ← 28 <link> tags added in <head>
manifest.json                      ← background_color updated to "#0a1929"
sw.js                              ← precache list updated (see step 8)
```

---

## 8. Service worker update

Add the splash directory to the precache list in `sw.js` so PWAs work offline from cold boot:

```js
const PRECACHE = [
  // ...existing entries
  ...[
    'icons/splash/splash-1320x2868.png','icons/splash/splash-2868x1320.png',
    'icons/splash/splash-1290x2796.png','icons/splash/splash-2796x1290.png',
    'icons/splash/splash-1206x2622.png','icons/splash/splash-2622x1206.png',
    'icons/splash/splash-1179x2556.png','icons/splash/splash-2556x1179.png',
    'icons/splash/splash-1284x2778.png','icons/splash/splash-2778x1284.png',
    'icons/splash/splash-1125x2436.png','icons/splash/splash-2436x1125.png',
    'icons/splash/splash-828x1792.png','icons/splash/splash-1792x828.png',
    'icons/splash/splash-1242x2688.png','icons/splash/splash-2688x1242.png',
    'icons/splash/splash-1242x2208.png','icons/splash/splash-2208x1242.png',
    'icons/splash/splash-750x1334.png','icons/splash/splash-1334x750.png',
    'icons/splash/splash-2048x2732.png','icons/splash/splash-2732x2048.png',
    'icons/splash/splash-1668x2388.png','icons/splash/splash-2388x1668.png',
    'icons/splash/splash-1668x2224.png','icons/splash/splash-2224x1668.png',
    'icons/splash/splash-1536x2048.png','icons/splash/splash-2048x1536.png',
  ],
];
```

Bump cache version: `const CACHE = 'pulse-v4.6.7';`

---

## 9. Acceptance checklist

- [ ] All 28 PNGs present in `icons/splash/` at exact dimensions, no stretching
- [ ] 28 `<link rel="apple-touch-startup-image">` tags injected into `<head>` of `index.html`
- [ ] `manifest.json` `background_color` set to `"#0a1929"`
- [ ] `sw.js` precache list includes all 28 splash PNGs; cache version bumped to `pulse-v4.6.7`
- [ ] Existing `<meta name="theme-color">` tag in `<head>` left untouched (it's controlled by the team-theme inline script and must stay dynamic)
- [ ] Cold-boot test on iPhone (Add to Home Screen → tap icon) → splash renders without white flash, palette transitions smoothly into navy app
- [ ] Cold-boot test on iPad (portrait + landscape) → splash renders correctly in both orientations
- [ ] Lighthouse PWA audit passes splash-screen check
- [ ] No new console errors after deploy

---

## 10. Notes

- **Don't change** `<meta name="theme-color">` in `<head>` — it's controlled at runtime by the team-theme inline script and must remain dynamic.
- **Android** generates its own splash from `manifest.json` icons + `background_color`. With the navy bg and the existing `icon-512.png`, no extra Android assets are needed.
- **Fonts on the splash** are rasterized at generation time. No font loading concern at runtime.
- **Regeneration:** if the source SVG changes, re-run `bash handoff/daybreak/build.sh` and commit the new PNGs.
