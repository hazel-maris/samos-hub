const CACHE = "samos-hub-reset-v1";

const STATIC_FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./config.js",
  "./manifest.webmanifest"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(STATIC_FILES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never cache Spotify auth/API/SDK or weather API responses.
  if (
    url.hostname.includes("spotify.com") ||
    url.hostname.includes("scdn.co") ||
    url.hostname.includes("open-meteo.com") ||
    url.hostname.includes("weather.gov")
  ) {
    return;
  }

  event.respondWith(
    caches.match(request).then(cached =>
      cached ||
      fetch(request).then(response => {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(request, copy));
        return response;
      })
    )
  );
});
