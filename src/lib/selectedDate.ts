"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { addDays, clampISODate, isoDate } from "@/lib/selectedDate";

function fmtLabel(iso: string) {
  const today = isoDate(new Date());
  if (iso === today) return "Today";
  if (iso === addDays(today, -1)) return "Yesterday";
  return iso; // keep simple; can prettify later
}

export default function DateSwitcher({ disabled = false }: { disabled?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const todayIso = useMemo(() => isoDate(new Date()), []);
  const selected = useMemo(() => {
    const q = sp.get("date");
    return clampISODate(q ?? "") ?? todayIso;
  }, [sp, todayIso]);

  const go = (nextISO: string) => {
    const params = new URLSearchParams(sp.toString());
    params.set("date", nextISO);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex items-center justify-between gap-2">
      <button
        type="button"
        disabled={disabled}
        onClick={() => go(addDays(selected, -1))}
        className="rounded-xl border px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
      >
        ←
      </button>

      <button
        type="button"
        disabled={disabled}
        onClick={() => go(todayIso)}
        className="flex-1 rounded-xl border px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:opacity-50"
      >
        {fmtLabel(selected)}
      </button>

      <button
        type="button"
        disabled={disabled || selected === todayIso}
        onClick={() => go(addDays(selected, +1))}
        className="rounded-xl border px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
      >
        →
      </button>
    </div>
  );
}
