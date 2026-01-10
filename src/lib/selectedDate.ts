"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

const NY_TZ = "America/New_York";

// NY date -> YYYY-MM-DD
export function isoDate(d: Date) {
  // en-CA reliably formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: NY_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function isISODate(v: string | null | undefined) {
  return !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

export function clampISODate(v: string) {
  // guard; keep as-is if valid else NY-today
  return isISODate(v) ? v : isoDate(new Date());
}

export function addDays(iso: string, delta: number) {
  // Stable day math using UTC anchor
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function readSelectedDateFromLocation(todayISO = isoDate(new Date())) {
  if (typeof window === "undefined") return todayISO;
  const sp = new URLSearchParams(window.location.search);
  const q = sp.get("date");
  return isISODate(q) ? (q as string) : todayISO;
}

export function buildUrlWithDate(pathname: string, nextISO: string) {
  const sp =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams();
  sp.set("date", nextISO);
  const qs = sp.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

/**
 * Client hook that reads/writes ?date=YYYY-MM-DD without useSearchParams().
 * NY-based "today" + selectedDate. Safe for prerender /_not-found.
 */
export function useSelectedISODate() {
  const router = useRouter();
  const pathname = usePathname();

  const todayISO = useMemo(() => isoDate(new Date()), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayISO);

  useEffect(() => {
    const sync = () => setSelectedDate(readSelectedDateFromLocation(todayISO));
    sync();

    const onPop = () => sync();
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [todayISO]);

  const prev = useMemo(() => addDays(selectedDate, -1), [selectedDate]);
  const next = useMemo(() => addDays(selectedDate, +1), [selectedDate]);
  const nextDisabled = selectedDate === todayISO;

  const label = useMemo(() => {
    if (selectedDate === todayISO) return "Today";
    if (selectedDate === addDays(todayISO, -1)) return "Yesterday";
    return selectedDate;
  }, [selectedDate, todayISO]);

  function go(nextISO: string) {
    const url = buildUrlWithDate(pathname || "/", nextISO);
    router.push(url);
    setSelectedDate(nextISO);
  }

  return { todayISO, selectedDate, label, prev, next, nextDisabled, go };
}
