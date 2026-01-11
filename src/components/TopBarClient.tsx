"use client";

import { useMemo } from "react";
import { useSelectedISODate, clampISODate } from "@/lib/selectedDate";

export default function TopBarClient() {
  const { todayISO, selectedDate, label, prev, next, nextDisabled, go } = useSelectedISODate();

  // If you ever want to hide this on certain routes, re-add pathname checks.
  const showPicker = useMemo(() => true, []);

  function goAndNotify(nextISO: string) {
    go(nextISO);

    // ✅ Tell other pages (Home/Insights/etc) the date changed (router.push does NOT trigger popstate).
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("hydra:datechange"));
    }
  }

  if (!showPicker) return null;

  return (
    <div className="flex items-center justify-between gap-2">
      {/* Prev */}
      <button
        type="button"
        aria-label="Previous day"
        onClick={() => goAndNotify(prev)}
        className="h-9 w-10 rounded-xl border border-zinc-200 bg-white text-zinc-700 shadow-sm active:scale-[0.98] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
      >
        ←
      </button>

      {/* Center pill */}
      <div className="h-9 flex-1 rounded-xl border border-zinc-200 bg-white px-3 text-sm shadow-sm flex items-center justify-center dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
        {label}
      </div>

      {/* Next */}
      <button
        type="button"
        aria-label="Next day"
        onClick={() => goAndNotify(next)}
        disabled={nextDisabled}
        className="h-9 w-10 rounded-xl border border-zinc-200 bg-white text-zinc-700 shadow-sm active:scale-[0.98] disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
      >
        →
      </button>

      {/* Date picker */}
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
