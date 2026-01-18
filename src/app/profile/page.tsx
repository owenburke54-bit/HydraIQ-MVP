"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getProfile, saveProfile } from "../../lib/localStore";

type Units = "metric" | "imperial";
type Sex = "male" | "female" | "other";

export default function ProfilePage() {
  const router = useRouter();
  const [name, setName] = useState<string>("");
  const [sex, setSex] = useState<Sex>("other");
  const [height, setHeight] = useState<string>("");
  const [weight, setWeight] = useState<string>("");
  const [units, setUnits] = useState<Units>("imperial");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [useEst, setUseEst] = useState<boolean>(true);
  const [unitsPref, setUnitsPref] = useState<"oz" | "ml">("oz");

  useEffect(() => {
    (async () => {
      const p = getProfile();
      if (p) {
        setName(p.name ?? "");
        setSex((p.sex as Sex) ?? "other");
        const u = (p.units as Units) ?? "imperial";
        setUnits(u);

        if (u === "imperial") {
          // Convert back to ft'in and lbs for display
          if (p.height_cm) {
            const totalIn = Math.round((p.height_cm as number) / 2.54);
            const ft = Math.floor(totalIn / 12);
            const inches = totalIn % 12;
            setHeight(`${ft}'${inches}`);
          }
          if (p.weight_kg) {
            setWeight(String(Math.round((p.weight_kg as number) * 2.20462)));
          }
        } else {
          if (p.height_cm) setHeight(String(p.height_cm));
          if (p.weight_kg) setWeight(String(p.weight_kg));
        }
      }

      try {
        const s = JSON.parse(localStorage.getItem("hydra.settings") || "{}");
        if (s?.timezone === "auto") setUseEst(false);
        if (s?.units === "ml") setUnitsPref("ml");
      } catch {}
    })();
  }, []);

  return (
    // Match Home spacing so content clears the fixed TopBar, without a huge gap.
    <div className="px-4 pb-4 pt-[calc(72px+env(safe-area-inset-top))]">
      <h1 className="text-xl font-semibold">Profile</h1>

      <div className="mt-4 space-y-4">
        <div>
          <label className="mb-2 block text-sm text-zinc-600 dark:text-zinc-300">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="w-full rounded-xl border border-zinc-200 bg-white p-3 outline-none ring-blue-500 focus:ring-2 dark:border-zinc-800 dark:bg-zinc-900"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-2 block text-sm text-zinc-600 dark:text-zinc-300">
              {units === "metric" ? "Height (cm)" : "Height (ft'in)"}
            </label>
            <input
              type="text"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              placeholder={units === "metric" ? "175" : "5'10"}
              className="w-full rounded-xl border border-zinc-200 bg-white p-3 outline-none ring-blue-500 focus:ring-2 dark:border-zinc-800 dark:bg-zinc-900"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-zinc-600 dark:text-zinc-300">
              {units === "metric" ? "Weight (kg)" : "Weight (lbs)"}
            </label>
            <input
              type="number"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder={units === "metric" ? "70" : "154"}
              className="w-full rounded-xl border border-zinc-200 bg-white p-3 outline-none ring-blue-500 focus:ring-2 dark:border-zinc-800 dark:bg-zinc-900"
            />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm text-zinc-600 dark:text-zinc-300">Sex</label>
          <select
            value={sex}
            onChange={(e) => setSex(e.target.value as Sex)}
            className="w-full rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm text-zinc-600 dark:text-zinc-300">Units</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setUnits("metric")}
              className={`rounded-xl border p-2 text-sm ${
                units === "metric"
                  ? "border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950 dark:text-blue-200"
                  : "border-zinc-200 bg-white text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
              }`}
            >
              Metric
            </button>
            <button
              type="button"
              onClick={() => setUnits("imperial")}
              className={`rounded-xl border p-2 text-sm ${
                units === "imperial"
                  ? "border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950 dark:text-blue-200"
                  : "border-zinc-200 bg-white text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
              }`}
            >
              US
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 p-3 dark:border-zinc-800">
          <p className="mb-2 text-sm font-medium">Settings</p>

          <div className="flex items-center justify-between py-1 text-sm">
            <span>Use EST timezone</span>
            <input
              type="checkbox"
              checked={useEst}
              onChange={(e) => setUseEst(e.target.checked)}
            />
          </div>

          <div className="flex items-center justify-between py-1 text-sm">
            <span>Units</span>
            <select
              value={unitsPref}
              onChange={(e) => setUnitsPref(e.target.value as any)}
              className="rounded border px-2 py-1"
            >
              <option value="oz">US (oz)</option>
              <option value="ml">Metric (ml)</option>
            </select>
          </div>

          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className="rounded-xl border px-3 py-2 text-sm"
              onClick={() => {
                // Export CSVs: intakes, workouts, supplements
                const toCsv = (rows: string[][]) =>
                  rows
                    .map((r) =>
                      r
                        .map((v) => `"${(v ?? "").toString().replace(/"/g, '""')}"`)
                        .join(",")
                    )
                    .join("\n");

                const intakes = JSON.parse(localStorage.getItem("hydra.intakes") || "[]");
                const workouts = JSON.parse(localStorage.getItem("hydra.workouts") || "[]");
                const supplements = JSON.parse(localStorage.getItem("hydra.supplements") || "[]");

                const dl = (name: string, text: string) => {
                  const blob = new Blob([text], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = name;
                  a.click();
                  URL.revokeObjectURL(url);
                };

                dl(
                  "hydra_intakes.csv",
                  toCsv(
                    [["date", "time", "type", "volume_oz"]].concat(
                      intakes.map((i: any) => {
                        const d = new Date(i.timestamp);
                        return [
                          d.toISOString().slice(0, 10),
                          d.toTimeString().slice(0, 5),
                          i.type,
                          String(Math.round(i.volume_ml / 29.5735)),
                        ];
                      })
                    )
                  )
                );

                dl(
                  "hydra_workouts.csv",
                  toCsv(
                    [["date", "start", "end", "type", "intensity", "duration_min"]].concat(
                      workouts.map((w: any) => {
                        const s = new Date(w.start_time);
                        const e = w.end_time ? new Date(w.end_time) : s;
                        const mins = Math.max(0, Math.round((e.getTime() - s.getTime()) / 60000));
                        return [
                          s.toISOString().slice(0, 10),
                          s.toTimeString().slice(0, 5),
                          e.toTimeString().slice(0, 5),
                          w.type || "",
                          String(w.intensity || 0),
                          String(mins),
                        ];
                      })
                    )
                  )
                );

                dl(
                  "hydra_supplements.csv",
                  toCsv(
                    [["date", "time", "type", "grams"]].concat(
                      supplements.map((s: any) => {
                        const d = new Date(s.timestamp);
                        return [
                          d.toISOString().slice(0, 10),
                          d.toTimeString().slice(0, 5),
                          s.type,
                          String(s.grams ?? ""),
                        ];
                      })
                    )
                  )
                );
              }}
            >
              Export CSV
            </button>

            <button
              type="button"
              className="rounded-xl border px-3 py-2 text-sm text-red-600"
              onClick={() => {
                if (confirm("Reset all local data? This cannot be undone.")) {
                  localStorage.clear();
                  location.reload();
                }
              }}
            >
              Reset data
            </button>
          </div>
        </div>

        <button
          type="button"
          className="h-12 w-full rounded-2xl border border-zinc-200 text-zinc-700 dark:border-zinc-800 dark:text-zinc-300"
          onClick={() => router.push("/onboarding")}
        >
          Revisit onboarding
        </button>

        <button
          type="button"
          disabled={loading}
          className="h-12 w-full rounded-2xl bg-blue-600 text-white shadow-md active:scale-[0.98] disabled:opacity-60"
          onClick={async () => {
            setLoading(true);
            setError(null);
            setMessage(null);
            try {
              // Save locally
              let height_cm: number | null = null;
              let weight_kg: number | null = null;

              if (units === "metric") {
                height_cm = Number(height) || null;
                weight_kg = Number(weight) || null;
              } else {
                const m = (height || "").match(/(\d+)[^0-9]+(\d+)/);
                if (m) {
                  const ft = Number(m[1]) || 0;
                  const inches = Number(m[2]) || 0;
                  height_cm = Math.round((ft * 12 + inches) * 2.54);
                }
                const lbs = Number(weight) || 0;
                weight_kg = lbs ? Math.round(lbs * 0.453592) : null;
              }

              saveProfile({ name, sex, height_cm, weight_kg, units });

              // Persist settings
              localStorage.setItem(
                "hydra.settings",
                JSON.stringify({ timezone: useEst ? "est" : "auto", units: unitsPref })
              );

              setMessage("Saved!");
              setTimeout(() => router.replace("/"), 600);
            } catch (e: any) {
              setError(e.message || "Failed to save profile");
            } finally {
              setLoading(false);
            }
          }}
        >
          {loading ? "Saving..." : "Save"}
        </button>

        {error ? <p className="text-center text-sm text-red-600">{error}</p> : null}
        {message ? <p className="text-center text-sm text-green-600">{message}</p> : null}
      </div>
    </div>
  );
}
