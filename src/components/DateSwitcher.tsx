"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { formatNYDate } from "@/lib/localStore";

function isISODate(v: string | null) {
  return !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function addDaysISO(iso: string, delta: number) {
  const d = new Date(iso + "T00:00:00.000Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function getSearchString() {
  if (typeof window === "undefined") return "";
  return window.location.search || "";
}

export default function DateSwitcher() {
  const router = useRouter();
  const pathname = usePathname();

  const todayISO = useMemo(() => formatNYDate(new Date()), []);

  // We keep our own copy of the URL search string so we don't need useSearchParams()
  const [search, setSearch] = useState<string>(() => getSearchString());

  useEffect(() => {
    // Keep in sync when the user uses back/forward
    const onPop = () => setSearch(getSearchString());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const selectedDate = useMemo(() => {
    const params = new URLSearchParams(search);
    const q = params.get("date");
    return isISODate(q) ? (q as string) : todayISO;
  }, [search, todayISO]);

  function go(nextISO: string) {
    // Build next URL using current search params
    const params = new URLSearchParams(search);
    params.set("date", nextISO);

    const qs = params.toString();
    const nextUrl = qs ? `${pathname}?${qs}` : pathname;

    router.push(nextUrl);
    // update local search state immediately so label/buttons update instantly
    setSearch(qs ? `?${qs}` : "");
  }

  const label = (() => {
    if (selectedDate === todayISO) return "Today";
    if (selectedDate === addDaysISO(todayISO, -1)) return "Yesterday";
    return selectedDate;
  })();

  const prev = addDaysISO(selectedDate, -1);
  const next = addDaysISO(selectedDate, +1);
  const nextDisabled = selectedDate === todayISO;

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
