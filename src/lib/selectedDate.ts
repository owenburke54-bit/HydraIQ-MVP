"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

export function isoDate(d: Date) {
  // Local date -> YYYY-MM-DD
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return ${y}-${m}-${day};
}

export function isISODate(v: string | null | undefined) {
  return !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

export function clampISODate(v: string) {
  // simple guard; keep as-is if valid else today
  return isISODate(v) ? v : isoDate(new Date());
}

export function addDays(iso: string, delta: number) {
  // Use UTC so the YYYY-MM-DD math is stable
  const d = new Date(${iso}T00:00:00.000Z);
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
  return qs ? ${pathname}?${qs} : pathname;
}

/**
 * Client hook that reads/writes ?date=YYYY-MM-DD without useSearchParams().
 * Safe for prerender /_not-found (no suspense required).
 */
export function useSelectedISODate() {
  const router = useRouter();
  const pathname = usePathname();

  const todayISO = useMemo(() => isoDate(new Date()), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayISO);

  // Read from URL on mount + on browser nav
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
