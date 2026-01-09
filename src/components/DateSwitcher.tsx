"use client";

import { useSelectedISODate } from "@/lib/selectedDate";

export default function DateSwitcher() {
  const { todayISO, selectedDate, label, prev, next, nextDisabled, go } =
    useSelectedISODate();

  return (
    <div className="flex items-center justify-between gap-2">
      <button
        type="button"
        onClick={() => go(prev)}
        className="rounded-xl border px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
        aria-label="Previous day"
      >
        ←
      </button>

      <button
        type="button"
        onClick={() => go(todayISO)}
        className="flex-1 rounded-xl border px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-900"
        aria-label="Jump to today"
      >
        {label}
      </button>

      <button
        type="button"
        disabled={nextDisabled}
        onClick={() => go(next)}
        className="rounded-xl border px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
        aria-label="Next day"
      >
        →
      </button>
    </div>
  );
}
