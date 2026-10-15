const CACHE_VERSION = "sonora-v2";
const SCOPE_URL = new URL(self.registration.scope);
const APP_ROOT = SCOPE_URL.pathname;
const APP_SHELL = ["./", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "icons/apple-touch-icon.png"]
  .map((item) => new URL(item, SCOPE_URL).href);

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("sonora-") && key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith(`${APP_ROOT}api/`)) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(SCOPE_URL.href, copy));
          return response;
        })
        .catch(() => caches.match(SCOPE_URL.href)),
    );
    return;
  }

  const shouldCache = url.pathname.startsWith(`${APP_ROOT}assets/`)
    || url.pathname.startsWith(`${APP_ROOT}icons/`)
    || url.pathname === `${APP_ROOT}manifest.webmanifest`;
  if (!shouldCache) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request).then((response) => {
        if (response.ok) caches.open(CACHE_VERSION).then((cache) => cache.put(request, response.clone()));
        return response;
      });
      return cached || network;
    }),
  );
});
