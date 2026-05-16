/*! sw.js is mutated by build.mjs — the CACHE literal is regex-replaced from package.json on every build. Edit package.json to bump the version, not this constant. */
const CACHE = "mlb-v4.20.18";
const SHELL = ["./", "./manifest.json", "./dist/styles.min.css", "./dist/app.bundle.js", "./assets/vendor/pulse-card-templates.js", "./assets/vendor/focusCard.js", "./assets/vendor/collectionCard.js", "./icons/icon-192.png", "./icons/icon-512.png"];
const ICON = new URL("./icons/icon-192.png", self.location).href;
const START = new URL("./", self.location).href;
self.addEventListener("install", function(e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function(c) {
    return c.addAll(SHELL);
  }));
});
self.addEventListener("activate", function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k) {
        return k !== CACHE;
      }).map(function(k) {
        return caches.delete(k);
      }));
    }).then(function() {
      return clients.claim();
    })
  );
});
self.addEventListener("fetch", function(e) {
  var url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  e.respondWith(caches.match(e.request).then(function(r) {
    return r || fetch(e.request).then(function(resp) {
      if (!resp || !resp.ok) return resp;
      return resp;
    });
  }));
});
self.addEventListener("push", function(e) {
  var data = {};
  try {
    data = e.data ? e.data.json() : {};
  } catch (err) {
  }
  var title = data.title || "MLB Tracker";
  var opts = {
    body: data.body || "Game starting soon!",
    icon: ICON,
    badge: ICON,
    tag: data.tag || "mlb-game",
    renotify: true,
    data: { url: START }
  };
  e.waitUntil(self.registration.showNotification(title, opts));
});
self.addEventListener("notificationclick", function(e) {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(function(ws) {
    var w = ws.find(function(w2) {
      return w2.url.includes(self.location.origin);
    });
    if (w) return w.focus();
    return clients.openWindow(START);
  }));
});
