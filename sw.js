const CACHE_NAME = 'sector-pulse-v1';

const SHELL_ASSETS = [
  './',
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-512-maskable.png",
  "./apple-touch-icon.png",
  "https://unpkg.com/lightweight-charts@4.1.3/dist/lightweight-charts.standalone.production.js"
];

// Third-party libraries the app depends on — safe to cache-first since
// they're versioned/immutable URLs.
const LIB_HOSTS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'unpkg.com',
  'cdn.jsdelivr.net'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // let POST/PUT (e.g. API writes) pass through untouched

  const url = new URL(req.url);

  // Never intercept live market-data / broker API calls — always go to network.
  const isSameOrigin = url.origin === self.location.origin;
  const isKnownLib = LIB_HOSTS.includes(url.hostname);
  if (!isSameOrigin && !isKnownLib) return;

  if (req.mode === 'navigate') {
    // Network-first for the page itself, so users always get the latest
    // build when online, with offline fallback to the cached shell.
    event.respondWith(
      fetch(req)
        .then((res) => {
          caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', res.clone()));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  if (isKnownLib || SHELL_ASSETS.some((a) => req.url.endsWith(a.replace('./', '')))) {
    // Cache-first for static shell/library assets.
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          caches.open(CACHE_NAME).then((cache) => cache.put(req, res.clone()));
          return res;
        });
      })
    );
  }
});
