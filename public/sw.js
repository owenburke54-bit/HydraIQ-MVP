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

  // Never intercept API routes or auth callbacks
  if (url.origin === location.origin && (url.pathname.startsWith("/api/"))) {
    return; // let browser fetch normally
  }

  if (url.origin === location.origin && (req.mode === "navigate" || url.pathname.startsWith("/_next/") || url.pathname.startsWith("/icons/"))) {
    event.respondWith(
      caches.open("hydraiq-v2").then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) return cached;
        try {
          const res = await fetch(req);
          // Avoid caching redirects (e.g., OAuth callbacks) which produce opaqueredirect and throw in cache.put
          if (!(res.type === "opaqueredirect" || (res.status >= 300 && res.status < 400))) {
            try { await cache.put(req, res.clone()); } catch {}
          }
          return res;
        } catch {
          return cached || Response.error();
        }
      })
    );
  }
});


