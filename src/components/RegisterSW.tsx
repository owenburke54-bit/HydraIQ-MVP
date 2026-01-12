"use client";

import { useEffect } from "react";

function logDev(...args: any[]) {
  if (process.env.NODE_ENV !== "production") console.log(...args);
}

export default function RegisterSW() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let mounted = true;

    const SW_URL = "/sw.js";

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register(SW_URL);

        logDev("[PWA] Service worker registered", reg.scope);

        // If there's already a waiting SW (common after deploy), activate it immediately.
        if (reg.waiting) {
          logDev("[PWA] SW waiting found — activating");
          reg.waiting.postMessage({ type: "SKIP_WAITING" });
        }

        // Listen for new SW installs
        reg.addEventListener("updatefound", () => {
          const sw = reg.installing;
          if (!sw) return;

          sw.addEventListener("statechange", () => {
            // When the new worker is installed, it becomes "waiting" (if there's an active one)
            if (sw.state === "installed" && navigator.serviceWorker.controller) {
              logDev("[PWA] New SW installed — activating");
              reg.waiting?.postMessage({ type: "SKIP_WAITING" });
            }
          });
        });

        // When controller changes, the new SW took over — reload once to get fresh assets.
        const onControllerChange = () => {
          if (!mounted) return;
          logDev("[PWA] Controller changed — reloading");
          // Use a cache-busting param (helps iOS Safari)
          const url = new URL(window.location.href);
          url.searchParams.set("__sw", String(Date.now()));
          window.location.replace(url.toString());
        };

        navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

        // ✅ iOS: periodically ask the SW to check for updates when app comes back to foreground.
        const pingUpdate = async () => {
          try {
            await reg.update();
          } catch {}
        };

        const onVisible = () => {
          if (!document.hidden) pingUpdate();
        };

        window.addEventListener("focus", pingUpdate);
        document.addEventListener("visibilitychange", onVisible);

        // Initial update check shortly after load
        setTimeout(pingUpdate, 800);

        return () => {
          navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
          window.removeEventListener("focus", pingUpdate);
          document.removeEventListener("visibilitychange", onVisible);
        };
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[PWA] Service worker registration failed", err);
        }
      }
    };

    let cleanup: null | (() => void) = null;

    register().then((c) => {
      // @ts-ignore - c may be void or cleanup
      cleanup = typeof c === "function" ? c : null;
    });

    return () => {
      mounted = false;
      if (cleanup) cleanup();
    };
  }, []);

  return null;
}
