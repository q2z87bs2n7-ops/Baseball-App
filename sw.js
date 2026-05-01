const CACHE = 'mlb-v309e'; // bump this version on every deploy to force cache refresh
const SHELL = ['./', './manifest.json', './pulse-card-templates.js', './focusCard.js', './collectionCard.js', './icons/icon-192.png', './icons/icon-512.png'];
const ICON  = new URL('./icons/icon-192.png', self.location).href;
const START = new URL('./', self.location).href;

self.addEventListener('install', function(e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function(c) { return c.addAll(SHELL); }));
});

self.addEventListener('activate', function(e) {
  // Delete any cache whose name doesn't match the current CACHE version
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k) { return k !== CACHE; }).map(function(k) { return caches.delete(k); }));
    }).then(function() { return clients.claim(); })
  );
});

self.addEventListener('fetch', function(e) {
  var url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  e.respondWith(caches.match(e.request).then(function(r) { return r || fetch(e.request); }));
});

self.addEventListener('push', function(e) {
  var data = {};
  try { data = e.data ? e.data.json() : {}; } catch(err) {}
  var title = data.title || 'MLB Tracker';
  var opts = {
    body: data.body || 'Game starting soon!',
    icon: ICON,
    badge: ICON,
    tag: data.tag || 'mlb-game',
    renotify: true,
    data: { url: START }
  };
  e.waitUntil(self.registration.showNotification(title, opts));
});

self.addEventListener('notificationclick', function(e) {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(ws) {
    var w = ws.find(function(w) { return w.url.includes(self.location.origin); });
    if (w) return w.focus();
    return clients.openWindow(START);
  }));
});
