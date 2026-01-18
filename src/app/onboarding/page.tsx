"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSelectedISODate } from "@/lib/selectedDate";

type Units = "metric" | "imperial";
type Sex = "male" | "female" | "other";

export default function OnboardingPage() {
  const router = useRouter();
  const { todayISO } = useSelectedISODate();

  const [step, setStep] = useState<number>(0);
  const [name, setName] = useState<string>("");
  const [sex, setSex] = useState<Sex>("other");
  const [height, setHeight] = useState<string>("");
  const [weight, setWeight] = useState<string>("");
  const [units, setUnits] = useState<Units>("imperial");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/profile", { cache: "no-store" });
        if (!res.ok) return;
        const p = await res.json();
        if (p) {
          setName(p.name ?? "");
          setSex((p.sex as Sex) ?? "other");
          setUnits((p.units as Units) ?? "imperial");
          if (p.height_cm) setHeight(String(p.height_cm));
          if (p.weight_kg) setWeight(String(p.weight_kg));
        }
      } catch {}
    })();
  }, []);

  function skipAll() {
    try {
      localStorage.setItem("hydra:onboardingDone", "1");
    } catch {}
    router.replace(`/?date=${todayISO}`);
  }

  async function saveAndStart() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          sex,
          heightCm: units === "metric" ? Number(height) || 0 : undefined,
          weightKg: units === "metric" ? Number(weight) || 0 : undefined,
          units,
          heightImperial: units === "imperial" ? height : undefined,
          weightLbs: units === "imperial" ? Number(weight) || 0 : undefined,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error ?? "Failed to save profile");
      }
      try {
        localStorage.setItem("hydra:onboardingDone", "1");
      } catch {}
      router.replace(`/?date=${todayISO}`);
    } catch (e: any) {
      setError(e.message || "Failed to save profile");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="px-4 pb-4 pt-[calc(72px+env(safe-area-inset-top))]">
      {step === 0 && (
        <div className="space-y-5">
          <div className="flex items-start justify-between">
            <h1 className="text-xl font-semibold">Welcome to HydraIQ</h1>
            <button className="text-sm text-zinc-500 underline dark:text-zinc-400" onClick={skipAll}>
              Skip
            </button>
          </div>
          <div className="rounded-2xl border p-4 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <p className="mb-3 text-sm text-zinc-700 dark:text-zinc-300">
              Hydration isn’t just “drink 8 cups.” It’s a daily rhythm. In ~30 seconds, we’ll set up your
              personal hydration plan.
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
              <li>Get a personalized daily target</li>
              <li>See a simple Hydration Score and pacing guidance</li>
              <li>Optional: connect WHOOP for sleep & recovery context</li>
            </ul>
            <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
              HydraIQ provides hydration guidance only and is not medical advice.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              className="flex-1 h-12 rounded-2xl border border-zinc-200 text-zinc-700 dark:border-zinc-800 dark:text-zinc-300"
              onClick={skipAll}
            >
              Maybe later
            </button>
            <button
              className="flex-1 h-12 rounded-2xl bg-blue-600 text-white shadow-md active:scale-[0.98]"
              onClick={() => setStep(1)}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-5">
          <h1 className="text-xl font-semibold">How your score works</h1>
          <div className="rounded-2xl border p-4 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <ol className="list-decimal space-y-3 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
              <li>
                <strong>Target:</strong> Based on your weight + workouts (+ optional creatine).
              </li>
              <li>
                <strong>Intake:</strong> Beverage types are weighted (water/electrolytes count more; alcohol
                doesn’t add).
              </li>
              <li>
                <strong>Timing:</strong> Long dry gaps lower score; steady sips help.
              </li>
              <li>
                <strong>Context:</strong> If connected, WHOOP sleep & recovery can gently adjust your target.
              </li>
            </ol>
          </div>
          <div className="flex gap-2">
            <button
              className="flex-1 h-12 rounded-2xl border border-zinc-200 text-zinc-700 dark:border-zinc-800 dark:text-zinc-300"
              onClick={() => setStep(0)}
            >
              Back
            </button>
            <button
              className="flex-1 h-12 rounded-2xl bg-blue-600 text-white shadow-md active:scale-[0.98]"
              onClick={() => setStep(2)}
            >
              Set my baseline
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <h1 className="text-xl font-semibold">Tell us about you</h1>
          <div className="space-y-4 rounded-2xl border p-4 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <div>
              <label className="mb-2 block text-sm text-zinc-600 dark:text-zinc-300">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Alex"
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
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <div className="flex gap-2">
              <button
                className="flex-1 h-12 rounded-2xl border border-zinc-200 text-zinc-700 dark:border-zinc-800 dark:text-zinc-300"
                onClick={() => setStep(1)}
              >
                Back
              </button>
              <button
                className="flex-1 h-12 rounded-2xl bg-blue-600 text-white shadow-md active:scale-[0.98]"
                disabled={loading}
                onClick={saveAndStart}
              >
                {loading ? "Saving..." : "Start hydration"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



