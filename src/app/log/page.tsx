"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { addIntake } from "../../lib/localStore";
import PageShell from "../../components/PageShell";
import { useSelectedISODate } from "@/lib/selectedDate";

type SuppKey =
  | "creatine"
  | "protein"
  | "multivitamin"
  | "fish_oil"
  | "electrolyte_tablet"
  | "other";

type DrinkType = "water" | "electrolyte" | "other";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

// Build a datetime-local string for a given ISO date in local time
function defaultTimeForDate(isoDate: string, todayIso: string) {
  const now = new Date();

  // If viewing today: default to current local time
  if (isoDate === todayIso) {
    return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}T${pad2(
      now.getHours()
    )}:${pad2(now.getMinutes())}`;
  }

  // Otherwise: default to 12:00 PM on that selected day
  const [y, m, d] = isoDate.split("-").map(Number);
  return `${y}-${pad2(m)}-${pad2(d)}T12:00`;
}

export default function LogPage() {
  const router = useRouter();
  const { todayISO, selectedDate } = useSelectedISODate();

  const [volume, setVolume] = useState<number | "">("");
  const [type, setType] = useState<DrinkType>("water");
  const [time, setTime] = useState<string>(() => defaultTimeForDate(todayISO, todayISO));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supplements, setSupplements] = useState<SuppKey[]>([]);
  const [suppGrams, setSuppGrams] = useState<number | "">("");

  // When the selected day changes, reset the default time to that day.
  useEffect(() => {
    setTime(defaultTimeForDate(selectedDate, todayISO));
  }, [selectedDate, todayISO]);

  const quicks = [
    { label: "8 oz", oz: 8 },
    { label: "12 oz", oz: 12 },
    { label: "16 oz", oz: 16 },
    { label: "24 oz", oz: 24 },
  ];

  const suppOptions: { key: SuppKey; label: string }[] = [
    { key: "creatine", label: "Creatine" },
    { key: "protein", label: "Protein Powder" },
    { key: "multivitamin", label: "Multivitamin" },
    { key: "fish_oil", label: "Fish Oil" },
    { key: "electrolyte_tablet", label: "Electrolyte Tablet" },
    { key: "other", label: "Other" },
  ];

  function toggleSupp(key: SuppKey) {
    setSupplements((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  // Ensure the datetime-local stays on the selected date unless the user intentionally changes it
  function coerceTimeToSelectedDate(nextValue: string) {
    // nextValue like "YYYY-MM-DDTHH:mm"
    if (!nextValue || nextValue.length < 16) return nextValue;
    const datePart = nextValue.slice(0, 10);
    if (datePart === selectedDate) return nextValue;
    // Force it back onto the selected date, preserving time-of-day
    return `${selectedDate}${nextValue.slice(10)}`;
  }

  return (
    <PageShell>
      {/* Date toggle belongs ONLY in the TopBar now — removed DateSwitcher from page */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Log Drink</h1>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Saving to <span className="font-medium">{selectedDate}</span>
          </p>
        </div>
      </div>

      <Card className="mt-4 space-y-4 p-4">
        <div>
          <label className="mb-2 block text-sm text-zinc-600 dark:text-zinc-300">Volume (oz)</label>
          <input
            type="number"
            inputMode="numeric"
            value={volume}
            onChange={(e) => setVolume(e.target.value === "" ? "" : Number(e.target.value))}
            placeholder="e.g., 12"
            className="w-full rounded-xl border border-zinc-200 bg-white p-3 text-base outline-none ring-blue-500 focus:ring-2 dark:border-zinc-800 dark:bg-zinc-900"
          />
          <div className="mt-3 grid grid-cols-4 gap-2">
            {quicks.map((q) => (
              <button
                key={q.oz}
                type="button"
                onClick={() => setVolume(q.oz)}
                className="rounded-xl border border-zinc-200 bg-white p-2 text-sm shadow-sm active:scale-[0.98] dark:border-zinc-800 dark:bg-zinc-900"
              >
                {q.oz} oz
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm text-zinc-600 dark:text-zinc-300">Type</label>
          <div className="grid grid-cols-3 gap-2">
            {(["water", "electrolyte", "other"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`rounded-xl border p-2 text-sm capitalize ${
                  type === t
                    ? "border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950 dark:text-blue-200"
                    : "border-zinc-200 bg-white text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm text-zinc-600 dark:text-zinc-300">Supplements</label>
          <div className="grid grid-cols-2 gap-2">
            {suppOptions.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => toggleSupp(opt.key)}
                className={`rounded-xl border p-2 text-sm ${
                  supplements.includes(opt.key)
                    ? "border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950 dark:text-blue-200"
                    : "border-zinc-200 bg-white text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {supplements.includes("creatine") ? (
            <div className="mt-3">
              <label className="mb-2 block text-sm text-zinc-600 dark:text-zinc-300">
                Creatine (grams)
              </label>
              <input
                type="number"
                inputMode="numeric"
                value={suppGrams}
                onChange={(e) => setSuppGrams(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="e.g., 5"
                className="w-full rounded-xl border border-zinc-200 bg-white p-3 text-base outline-none ring-blue-500 focus:ring-2 dark:border-zinc-800 dark:bg-zinc-900"
              />
            </div>
          ) : null}
        </div>

        <div>
          <label className="mb-2 block text-sm text-zinc-600 dark:text-zinc-300">Time</label>
          <input
            type="datetime-local"
            value={time}
            onChange={(e) => setTime(coerceTimeToSelectedDate(e.target.value))}
            className="w-full rounded-xl border border-zinc-200 bg-white p-3 text-base outline-none ring-blue-500 focus:ring-2 dark:border-zinc-800 dark:bg-zinc-900"
          />
        </div>

        <Button
          type="button"
          className="mt-2 w-full"
          disabled={loading}
          onClick={async () => {
            setLoading(true);
            setError(null);
            try {
              const oz = typeof volume === "number" ? volume : 0;
              if (oz <= 0) throw new Error("Enter a valid volume");

              const ml = oz * 29.5735;

              // Force timestamp to selected day if user input got weird
              const when = new Date(coerceTimeToSelectedDate(time));

              addIntake(ml, type, when);

              if (supplements.length) {
                const grams = typeof suppGrams === "number" ? suppGrams : null;
                const { addSupplements } = await import("../../lib/localStore");
                addSupplements({ types: supplements, timestamp: when, grams });
              }

              // Go back to Home *preserving the selected date*
              router.replace(`/?date=${selectedDate}`);
            } catch (e: any) {
              setError(e?.message || "Unexpected error");
            } finally {
              setLoading(false);
            }
          }}
        >
          {loading ? "Saving..." : "Save"}
        </Button>

        {error ? <p className="pt-2 text-center text-sm text-red-600">{error}</p> : null}
      </Card>
    </PageShell>
  );
}
