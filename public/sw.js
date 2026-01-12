// public/sw.js

const CACHE_PREFIX = "hydraiq-";
let RUNTIME_CACHE = `${CACHE_PREFIX}runtime`;

self.addEventListener("install", () => {
  self.skipWaiting();
});

// Allow the page to force-activate a waiting SW
self.addEventListener("message", (event) => {
  if (event?.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Try to version the cache per-deploy (best-effort)
      try {
        const res = await fetch(`/version.json?ts=${Date.now()}`, { cache: "no-store" });
        if (res.ok) {
          const j = await res.json();
          const v = String(j?.version || "").trim();
          if (v) RUNTIME_CACHE = `${CACHE_PREFIX}${v}`;
        }
      } catch {}

      // Claim clients immediately
      await self.clients.claim();

      // Cleanup old caches
      try {
        const keys = await caches.keys();
        await Promise.all(
          keys
            .filter((k) => k.startsWith(CACHE_PREFIX) && k !== RUNTIME_CACHE)
            .map((k) => caches.delete(k))
        );
      } catch {}
    })()
  );
});

// ---------- Helpers ----------
async function cachePutSafe(cache, req, res) {
  // Don't cache redirects/opaque redirects
  if (!res) return;
  if (res.type === "opaqueredirect") return;
  if (res.status >= 300 && res.status < 400) return;
  try {
    await cache.put(req, res.clone());
  } catch {}
}

function offlineHTML() {
  return new Response(
    `<!doctype html>
     <html>
       <head>
         <meta charset="utf-8" />
         <meta name="viewport" content="width=device-width, initial-scale=1" />
         <title>HydraIQ</title>
         <style>
           body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial; padding:24px; color:#111;}
           .card{max-width:420px; margin:0 auto; border:1px solid #e5e7eb; border-radius:16px; padding:18px;}
           h1{font-size:18px; margin:0 0 8px;}
           p{margin:0; color:#444; line-height:1.35;}
         </style>
       </head>
       <body>
         <div class="card">
           <h1>HydraIQ is offline</h1>
           <p>Please reconnect to the internet and reopen the app.</p>
         </div>
       </body>
     </html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 503 }
  );
}

async function networkFirstNavigation(req) {
  const cache = await caches.open(RUNTIME_CACHE);

  try {
    // Force a fresh HTML shell so new deploys appear
    const res = await fetch(req, { cache: "no-store" });
    if (res && res.ok) await cachePutSafe(cache, req, res);
    return res;
  } catch {
    // Fall back to cached navigation if available
    const cached = await cache.match(req);
    if (cached) return cached;

    // Try cached homepage as a last resort
    const cachedRoot = await cache.match("/");
    if (cachedRoot) return cachedRoot;

    // Never brick the origin: show a minimal offline page
    return offlineHTML();
  }
}

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

  return cached || (await fetchPromise) || new Response("", { status: 504 });
}

// ---------- Fetch ----------
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only same-origin
  if (url.origin !== self.location.origin) return;

  // Never cache API routes
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(req));
    return;
  }

  // Never cache version.json (we use it for deploy detection)
  if (url.pathname === "/version.json") {
    event.respondWith(fetch(req, { cache: "no-store" }));
    return;
  }

  // Navigations: network-first
  if (req.mode === "navigate") {
    event.respondWith(networkFirstNavigation(req));
    return;
  }

  // Next.js assets + icons: SWR
  if (url.pathname.startsWith("/_next/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  // Default: pass through to network (don’t risk breaking anything)
});
