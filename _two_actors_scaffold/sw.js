/*! sw.js CACHE is rewritten by build.mjs on every build. Bump package.json version, not this constant. */
const CACHE = "alg-v0.1.0";
const SHELL = [
  "./",
  "./manifest.json",
  "./dist/styles.min.css",
  "./dist/app.bundle.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {}))
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // Never cache TMDB proxy or scoreboard API responses
  if (url.pathname.startsWith("/api/")) return;

  // Same-origin shell: cache-first
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(e.request).then(
        (r) => r || fetch(e.request).then((resp) => {
          if (!resp || !resp.ok) return resp;
          return resp;
        })
      )
    );
  }
});
