# MLB Tracker — PWA & Push Notifications

## PWA

- `manifest.json` — `display: standalone`, `start_url: "./"`, `scope: "./"` (relative paths required for GitHub Pages subdirectory — app served at `/Baseball-App/`)
- `sw.js` — install caches app shell (`./`, `./manifest.json`, `./icons/*`); activate cleans old caches; fetch handler is cache-first for same-origin; push and notificationclick handlers
- **All paths in manifest, sw.js, and `<head>` are relative** (no leading `/`) — absolute paths break on GitHub Pages subdirectory
- `applyTeamTheme()` updates `<meta name="theme-color">` with the active team primary colour

### Icons

Outfield Horizon design — stadium sunset scene with heartbeat/pulse line. Files:
- `icon-512.png` / `icon-192.png` — `any` purpose (Android/install prompt)
- `icon-180.png` — `apple-touch-icon` (iOS home screen)
- `icon-maskable-512.png` — maskable icon (Android safe zone)
- `icon-mono.svg` — monochrome (iOS 16.4+)
- `favicon.svg` — browser tab

`manifest.json`: `background_color: #0a1929` (Daybreak splash navy — matches splash gradient bottom and Android cold-boot splash bg), `theme_color: #0E3E1A`, `short_name: "Pulse"`, `orientation: "any"` (for iPad landscape).

### Splash screens (iOS)

- Source design: `handoff/daybreak/splash-template.html` (peach→navy vertical gradient, Pulse waveform mark + PULSE wordmark)
- Generated PNGs: `icons/splash/splash-{W}x{H}.png` — curated **12-PNG cut** (6 device rows × 2 orientations)
- Device list: `handoff/daybreak/sizes.json` — covers iPhone 12, iPhone 13/14/15/16 + Plus/Pro Max sizes, iPad Air 11" (M2/M3), iPad Pro 12.9". Older devices (iPhone 8/SE/11/XR/X-era, older iPads) fall through to manifest `background_color`
- 12 `<link rel="apple-touch-startup-image">` tags hand-curated in `index.html` `<head>` after the apple-touch-icon link
- **Not pre-cached by `sw.js`** — iOS loads `apple-touch-startup-image` from the OS shell, not via fetch; pre-caching adds install bloat for no functional benefit
- Regen / add devices: edit `handoff/daybreak/sizes.json`, run `bash handoff/daybreak/build.sh` (uses globally-installed Playwright + the chromium at `/opt/pw-browsers/`), hand-add the matching `<link>` tag, bump versions per CLAUDE.md rule 7

## Push Notifications

- Toggle in Settings: **🔔 Game Start Alerts** — persisted to `localStorage('mlb_push')`
- **Hidden on desktop via CSS** (`@media(min-width:1025px){ #pushRow { display:none !important } }`) — push is unreliable on desktop browsers
- `togglePush()` / `subscribeToPush()` / `unsubscribeFromPush()` / `urlBase64ToUint8Array()` in `src/push/push.js`
- Subscription POSTed to `${API_BASE}/api/subscribe` → stored in Upstash Redis under key `push:<b64-endpoint-hash>`
- `api/notify.js` checks MLB schedule, notifies for games starting within 10 minutes **or started up to 2 minutes ago** (cron may fire after scheduled start); deduplicates via `notified:<gamePk>` key (24h TTL); auto-removes stale subscriptions (410/404 responses)
- `api/test-push.js` sends a real push to all subscribers immediately — use the **Test Push Notification** GitHub Actions workflow (`workflow_dispatch`) to trigger it for QC
- Redis env vars injected by Vercel/Upstash integration: `KV_REST_API_URL` and `KV_REST_API_TOKEN`

## VAPID Keys

**Do not regenerate without re-subscribing all devices.**
- Public key is hardcoded in `src/push/push.js` as the `VAPID_PUBLIC_KEY` constant
- Private key is in Vercel env var `VAPID_PRIVATE_KEY` only — never in code
- `VAPID_SUBJECT` = operator email in Vercel env vars
- `NOTIFY_TOKEN` (Vercel) must match `NOTIFY_SECRET` (GitHub Actions secret) — authenticates cron calls to `/api/notify`

## GitHub Actions cron

`.github/workflows/notify-cron.yml` — `*/5 * * * *` (configured for every 5 min; in practice fires closer to once per hour on GitHub free tier).

## Update workflow (PWA-specific)

On every commit that changes app content, bump **three** things:
1. `<title>` version string in `index.html`
2. Settings panel version string in `index.html` (`<div class="settings-version">`)
3. `CACHE` constant in `sw.js` (e.g. `mlb-v514` → `mlb-v515`) — forces cache refresh for installed PWA users
