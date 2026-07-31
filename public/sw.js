const CACHE_NAME = "blink-webtv-v1";
const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon.png"
];

// Install Service Worker and cache core static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[Service Worker] Pre-caching offline shell...");
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate Service Worker and clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log("[Service Worker] Clearing old cache:", cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch interception
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // CRITICAL: Always bypass service worker cache for any IPTV stream chunks or live playlist files
  if (
    url.pathname.includes(".m3u8") ||
    url.pathname.includes(".ts") ||
    url.pathname.includes(".mpd") ||
    url.pathname.includes("/api/proxy-stream") ||
    url.pathname.includes("/api/stream") ||
    event.request.method !== "GET"
  ) {
    return; // Let browser fetch natively
  }

  // Network-first strategy for index.html and assets to ensure instant updates, with graceful cache fallback
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // If valid response, update cache dynamically for app assets
        if (response && response.status === 200 && response.type === "basic") {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache if network fails (offline mode)
        return caches.match(event.request);
      })
  );
});
