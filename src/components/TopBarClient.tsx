"use client";

import { useEffect, useMemo } from "react";
import { useSelectedISODate, clampISODate } from "@/lib/selectedDate";

export default function TopBarClient() {
  const { todayISO, selectedDate, label, prev, next, nextDisabled, go } = useSelectedISODate();

  const showPicker = useMemo(() => true, []);

  function goAndNotify(nextISO: string) {
    go(nextISO);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("hydra:datechange"));
    }
  }

  // ✅ Check deploy version and force a true refresh when it changes (keeps localStorage).
  useEffect(() => {
    let cancelled = false;

    const KEY = "hydra:buildVersion";
    const CHECK_MS = 2 * 60 * 1000; // 2 minutes

    async function checkVersion() {
      try {
        const res = await fetch(`/version.json?ts=${Date.now()}`, {
          cache: "no-store",
          headers: { "cache-control": "no-store" },
        });
        if (!res.ok) return;

        const data = await res.json();
        const nextV = String(data?.version || "").trim();
        if (!nextV) return;

        const prevV = localStorage.getItem(KEY);

        if (!prevV) {
          localStorage.setItem(KEY, nextV);
          return;
        }

        if (prevV !== nextV) {
          localStorage.setItem(KEY, nextV);

          // iOS is stubborn about reload caching — replace with a cache-busting URL
          const url = new URL(window.location.href);
          url.searchParams.set("__v", String(Date.now()));
          window.location.replace(url.toString());
        }
      } catch {}
    }

    const t = window.setTimeout(() => {
      if (!cancelled) checkVersion();
    }, 350);

    const id = window.setInterval(() => {
      if (!cancelled) checkVersion();
    }, CHECK_MS);

    const onVisible = () => {
      if (!document.hidden && !cancelled) checkVersion();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  if (!showPicker) return null;

  return (
    <div className="flex items-center justify-between gap-2">
      <button
        type="button"
        aria-label="Previous day"
        onClick={() => goAndNotify(prev)}
        className="h-9 w-10 rounded-xl border border-zinc-200 bg-white text-zinc-700 shadow-sm active:scale-[0.98] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
      >
        ←
      </button>

      <div className="h-9 flex-1 rounded-xl border border-zinc-200 bg-white px-3 text-sm shadow-sm flex items-center justify-center dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
        {label}
      </div>

      <button
        type="button"
        aria-label="Next day"
        onClick={() => goAndNotify(next)}
        disabled={nextDisabled}
        className="h-9 w-10 rounded-xl border border-zinc-200 bg-white text-zinc-700 shadow-sm active:scale-[0.98] disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
      >
        →
      </button>

      <div className="ml-2 flex items-center gap-2">
        <input
          type="date"
          value={selectedDate}
          max={todayISO}
          onChange={(e) => {
            const v = clampISODate(e.target.value);
            goAndNotify(v);
          }}
          className="h-9 rounded-xl border border-zinc-200 bg-white px-3 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
          aria-label="Select date"
        />
      </div>
    </div>
  );
}
