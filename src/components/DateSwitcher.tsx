"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { formatNYDate } from "@/lib/localStore";

function isISODate(v: string | null) {
  return !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function addDaysISO(iso: string, delta: number) {
  const d = new Date(iso + "T00:00:00.000Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export default function DateSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const todayISO = useMemo(() => formatNYDate(new Date()), []);
  const selectedDate = useMemo(() => {
    const q = searchParams?.get("date");
    return isISODate(q) ? q! : todayISO;
  }, [searchParams, todayISO]);

  function go(nextISO: string) {
    const params = new URLSearchParams(searchParams?.toString());
    params.set("date", nextISO);
    router.push(`${pathname}?${params.toString()}`);
  }

  const label = (() => {
    if (selectedDate === todayISO) return "Today";
    if (selectedDate === addDaysISO(todayISO, -1)) return "Yesterday";
    return selectedDate;
  })();

  return (
    <div className="flex items-center justify-between gap-2">
      <button
        type="button"
        onClick={() => go(addDaysISO(selectedDate, -1))}
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
        disabled={selectedDate === todayISO}
        onClick={() => go(addDaysISO(selectedDate, +1))}
        className="rounded-xl border px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
        aria-label="Next day"
      >
        →
      </button>
    </div>
  );
}
