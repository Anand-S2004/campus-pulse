const CACHE_NAME = "campus-pulse-v1";
const STATIC_ASSETS = ["/", "/auth"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.pathname.startsWith("/api/")) return;
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});

// Background Periodic Sync — fires even when no tab is open (Chrome only).
// We can't call navigator.geolocation from a SW, so we relay a message to
// any open client tabs and let them do the actual location update.
// If no tabs are open, the update is skipped silently.
self.addEventListener("periodicsync", (event) => {
  if (event.tag === "cp-location-update") {
    event.waitUntil(
      self.clients.matchAll({ type: "window" }).then((clients) => {
        clients.forEach((client) =>
          client.postMessage({ type: "cp-location-update" })
        );
      })
    );
  }
});
