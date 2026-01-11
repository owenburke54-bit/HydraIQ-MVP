"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { useSelectedISODate, clampISODate } from "@/lib/selectedDate";

function toDisplayMMDDYYYY(iso: string) {
  // iso: YYYY-MM-DD -> MM/DD/YYYY
  const [y, m, d] = iso.split("-");
  return `${m}/${d}/${y}`;
}

export default function TopBarClient() {
  const pathname = usePathname() || "/";
  const { todayISO, selectedDate, label, prev, next, nextDisabled, go } = useSelectedISODate();

  // Only show date picker on main tabs (optional). If you want it everywhere, remove this.
  const showPicker = useMemo(() => {
    // Hide on auth pages etc if you want
    return true;
  }, []);

  if (!showPicker) return null;

  return (
    <div className="flex items-center justify-between gap-2">
      {/* Prev */}
      <button
        type="button"
        aria-label="Previous day"
        onClick={() => go(prev)}
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
        onClick={() => go(next)}
        disabled={nextDisabled}
        className="h-9 w-10 rounded-xl border border-zinc-200 bg-white text-zinc-700 shadow-sm active:scale-[0.98] disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
      >
        →
      </button>

      {/* Date picker (MM/DD/YYYY) */}
      <div className="ml-2 flex items-center gap-2">
        <input
          type="date"
          value={selectedDate}
          max={todayISO}
          onChange={(e) => {
            const v = clampISODate(e.target.value);
            go(v);
          }}
          className="h-9 rounded-xl border border-zinc-200 bg-white px-3 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
          aria-label="Select date"
        />
      </div>
    </div>
  );
}
