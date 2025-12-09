self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Cache-first for same-origin navigation and static assets
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (url.origin === location.origin && (req.mode === "navigate" || url.pathname.startsWith("/_next/") || url.pathname.startsWith("/icons/"))) {
    event.respondWith(
      caches.open("hydraiq-v1").then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) return cached;
        try {
          const res = await fetch(req);
          cache.put(req, res.clone());
          return res;
        } catch {
          return cached || Response.error();
        }
      })
    );
  }
});


