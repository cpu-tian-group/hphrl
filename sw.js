const CACHE_NAME = "herbal-photonics-v2";
const SITE_ROOT = new URL("./", self.location.href);
const CORE_PAGES = [
  "./",
  "./about/",
  "./research/",
  "./outputs/",
  "./team/",
  "./news/",
  "./join/",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(
        CORE_PAGES.map((path) => cache.add(new URL(path, SITE_ROOT))),
      ),
    ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches
        .keys()
        .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      ),
      self.registration.navigationPreload
        ? self.registration.navigationPreload.enable()
        : Promise.resolve(),
    ]).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      caches.match(request).then(async (cached) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);
        const networkRequest = (async () => {
          try {
            const preload = await event.preloadResponse;
            const response =
              preload ||
              (await fetch(request, { signal: controller.signal }));
            if (response.ok) {
              const copy = response.clone();
              await caches
                .open(CACHE_NAME)
                .then((cache) => cache.put(request, copy));
            }
            return response;
          } finally {
            clearTimeout(timeout);
          }
        })();

        if (cached) {
          event.waitUntil(networkRequest.catch(() => undefined));
          return cached;
        }

        return networkRequest.catch(async () => {
          return (await caches.match(SITE_ROOT)) || Response.error();
        });
      }),
    );
    return;
  }

  const isStaticAsset =
    url.pathname.includes("/_next/static/") ||
    /\.(?:css|js|png|jpe?g|webp|gif|ico|woff2?)$/i.test(url.pathname);

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
  }
});
