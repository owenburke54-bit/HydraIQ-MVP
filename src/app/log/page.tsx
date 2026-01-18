"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { addIntake, formatNYDate, getIntakesByDateNY } from "../../lib/localStore";
import type { BeverageType } from "../../lib/beverages";
import { readSelectedDateFromLocation, isISODate } from "@/lib/selectedDate";

type SuppKey =
  | "creatine"
  | "electrolyte_tablet"
  | "sodium"
  | "potassium"
  | "magnesium"
  | "other";

type DrinkType = BeverageType;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function defaultTimeForDate(isoDate: string) {
  const now = new Date();
  const todayIso = formatNYDate(now);

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

function coerceTimeToSelectedDate(nextValue: string, selectedDate: string) {
  if (!nextValue || nextValue.length < 16) return nextValue;
  const datePart = nextValue.slice(0, 10);
  if (datePart === selectedDate) return nextValue;
  return `${selectedDate}${nextValue.slice(10)}`;
}

export default function LogPage() {
  const router = useRouter();

  const todayISO = useMemo(() => formatNYDate(new Date()), []);

  // ✅ Date is determined ONLY by URL (TopBar)
  const [selectedDate, setSelectedDate] = useState<string>(todayISO);

  // ✅ Sync selectedDate from URL on mount, back/forward, AND hydra:datechange
  useEffect(() => {
    const sync = () => {
      const iso = readSelectedDateFromLocation(todayISO);
      setSelectedDate(isISODate(iso) ? iso : todayISO);
    };

    sync();
    window.addEventListener("popstate", sync);
    window.addEventListener("hydra:datechange", sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("hydra:datechange", sync);
    };
  }, [todayISO]);

  const [volume, setVolume] = useState<number | "">("");
  const [type, setType] = useState<DrinkType>("water");
  const [time, setTime] = useState<string>(() => defaultTimeForDate(todayISO));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supplements, setSupplements] = useState<SuppKey[]>([]);
  const [suppGrams, setSuppGrams] = useState<number | "">("");
  const [lastIntakeOz, setLastIntakeOz] = useState<number | null>(null);
  const [lastType, setLastType] = useState<DrinkType | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // When selected day changes, reset the default time to that day.
  useEffect(() => {
    setTime(defaultTimeForDate(selectedDate));
    // pull last intake for quick-log
    try {
      const items = getIntakesByDateNY(selectedDate);
      if (items.length > 0) {
        const last = items[items.length - 1];
        setLastIntakeOz(Math.round(last?.volume_ml * (1 / 29.5735)));
        setLastType((last?.type as DrinkType) ?? null);
      } else {
        setLastIntakeOz(null);
        setLastType(null);
      }
    } catch {}
  }, [selectedDate]);

  const quicks = [
    { label: "8 oz", oz: 8 },
    { label: "12 oz", oz: 12 },
    { label: "16 oz", oz: 16 },
    { label: "24 oz", oz: 24 },
  ];

  const suppOptions: { key: SuppKey; label: string }[] = [
    { key: "creatine", label: "Creatine" },
    { key: "electrolyte_tablet", label: "Electrolyte Tablet" },
    { key: "sodium", label: "Sodium" },
    { key: "potassium", label: "Potassium" },
    { key: "magnesium", label: "Magnesium" },
    { key: "other", label: "Other" },
  ];

  function toggleSupp(key: SuppKey) {
    setSupplements((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  return (
    <div className="px-4 pb-4 pt-[calc(72px+env(safe-area-inset-top))]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Log Drink</h1>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Saving to <span className="font-medium">{selectedDate}</span>
            {selectedDate === todayISO ? " (Today)" : ""}
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
            {(["water", "electrolyte", "milk", "coffee", "soda", "juice", "beer", "wine", "cocktail", "other"] as BeverageType[]).map(
              (t, idx) => {
                const isOther = t === "other";
                const base =
                  "rounded-xl border p-2 text-sm capitalize " +
                  (type === t
                    ? "border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950 dark:text-blue-200"
                    : "border-zinc-200 bg-white text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200");
                const pos = isOther ? " col-start-2" : "";
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={base + pos}
                  >
                    {t}
                  </button>
                );
              }
            )}
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
            onChange={(e) => setTime(coerceTimeToSelectedDate(e.target.value, selectedDate))}
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
              const when = new Date(coerceTimeToSelectedDate(time, selectedDate));

              addIntake(ml, type, when);

              if (supplements.length) {
                const grams = typeof suppGrams === "number" ? suppGrams : null;
                const { addSupplements } = await import("../../lib/localStore");
                addSupplements({ types: supplements, timestamp: when, grams });
              }

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
        {message ? <p className="pt-2 text-center text-sm text-green-600">{message}</p> : null}
      </Card>
    </div>
  );
}
