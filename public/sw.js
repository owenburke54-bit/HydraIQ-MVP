// public/sw.js

const CACHE_PREFIX = "hydraiq-";
let RUNTIME_CACHE = `${CACHE_PREFIX}runtime`; // will upgrade to versioned once we fetch /version.json

// ✅ Allow the app to force-activate a waiting SW (used by RegisterSW.tsx)
self.addEventListener("message", (event) => {
  if (event?.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Try to get a versioned cache name so each deploy can invalidate old bundles
      try {
        const res = await fetch("/version.json?ts=" + Date.now(), { cache: "no-store" });
        if (res.ok) {
          const j = await res.json();
          const v = String(j?.version || "").trim();
          if (v) RUNTIME_CACHE = `${CACHE_PREFIX}${v}`;
        }
      } catch {}

      // Claim clients immediately
      await self.clients.claim();

      // Clean up old caches from previous deployments
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith(CACHE_PREFIX) && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k))
      );
    })()
  );
});

// Helpers
async function cachePutSafe(cache, req, res) {
  // Avoid caching redirects/opaque redirects
  if (res.type === "opaqueredirect" || (res.status >= 300 && res.status < 400)) return;
  try {
    await cache.put(req, res.clone());
  } catch {}
}

// Network-first (for HTML navigations)
async function networkFirst(req) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    // ✅ Bust intermediates for HTML navigations so deploys show up faster (esp iOS Safari)
    const busted = new Request(req.url, {
      method: req.method,
      headers: req.headers,
      mode: req.mode,
      credentials: req.credentials,
      redirect: req.redirect,
      referrer: req.referrer,
      referrerPolicy: req.referrerPolicy,
      integrity: req.integrity,
      cache: "no-store",
    });

    const res = await fetch(busted);
    if (res && res.ok) await cachePutSafe(cache, req, res);
    return res;
  } catch {
    const cached = await cache.match(req);
    return cached || Response.error();
  }
}

// Stale-while-revalidate (for JS/CSS/images)
async function staleWhileRevalidate(req) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(req);

  const fetchPromise = (async () => {
    try {
      const res = await fetch(req);
      if (res && res.ok) await cachePutSafe(cache, req, res);
      return res;
    } catch {
      return null;
    }
  })();

  // Return cached immediately if present; otherwise wait for network
  return cached || (await fetchPromise) || Response.error();
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Same-origin only
  if (url.origin !== self.location.origin) return;

  // Never cache API routes
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(req));
    return;
  }

  // Never cache the version file (always fresh)
  if (url.pathname === "/version.json") {
    event.respondWith(fetch(new Request(req.url, { cache: "no-store" })));
    return;
  }

  // ✅ Navigation: NETWORK FIRST so new deployments show up
  if (req.mode === "navigate") {
    event.respondWith(networkFirst(req));
    return;
  }

  // ✅ Next.js assets + icons: stale-while-revalidate
  if (url.pathname.startsWith("/_next/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  // Default: go to network
});
