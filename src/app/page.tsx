"use client";

import { useEffect, useMemo, useState } from "react";
import HydrationScoreCard from "../components/HydrationScoreCard";
import HydrationProgressBar from "../components/HydrationProgressBar";
import { Card } from "../components/ui/Card";
import { useSelectedISODate } from "@/lib/selectedDate";
import { formatDisplayDate } from "@/lib/dateFormat";
import {
  useDailyHydrationSnapshot,
  useHydrationSnapshotActions,
} from "@/components/HydrationSnapshotProvider";

const OZ_PER_ML = 1 / 29.5735;

function toOz(ml: number) {
  return Math.round(ml * OZ_PER_ML);
}

function fmtTimeNY(d: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(d)
    .toLowerCase();
}

type HabitTip = {
  title: string;
  body: string;
};

type RiskTip = {
  title: string;
  body: string;
  level: "normal" | "elevated";
};

export default function Home() {
  const { todayISO, selectedDate } = useSelectedISODate();

  const [mounted, setMounted] = useState(false);
  const [showScoreInfo, setShowScoreInfo] = useState(false);
  const snapshot = useDailyHydrationSnapshot(selectedDate);
  const { requestWhoopMetrics } = useHydrationSnapshotActions();

  const isToday = selectedDate === todayISO;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isToday) return;
    requestWhoopMetrics(selectedDate);
  }, [selectedDate, isToday, requestWhoopMetrics]);

  const targetMl = snapshot?.targetMl ?? 0;
  const actualMl = snapshot?.actualMl ?? 0;
  const score = snapshot?.score ?? 0;
  const intakes = snapshot?.intakes ?? [];
  const flags = snapshot?.flags ?? { workouts: false, creatine: false, env: false, whoop: false };
  const workouts = snapshot?.workouts ?? [];
  const whoop = snapshot?.whoop ?? null;

  // --- Recommendations (ideas 4, 7, 8) ---
  const rec = useMemo(() => {

    const targetOz = toOz(targetMl);
    const actualOz = toOz(actualMl);

    const deficitMl = Math.max(0, targetMl - actualMl);
    const deficitOz = toOz(deficitMl);

    // Habit/pattern coaching (Idea 4)
    const tips: HabitTip[] = [];
    let patternLabel: string | null = null;
    let maxGapMin = 0;

    try {
      // Bucket today/selected-day intakes by time of day (local device hour)
      const ints = [...intakes].sort(
        (a, b) => +new Date(a.timestamp) - +new Date(b.timestamp)
      );
      const totalMl = ints.reduce((s, i) => s + i.volume_ml, 0);

      const first = ints.length ? new Date(ints[0].timestamp) : null;
      const last = ints.length ? new Date(ints[ints.length - 1].timestamp) : null;

      let morningMl = 0,
        afternoonMl = 0,
        eveningMl = 0;

      ints.forEach((i) => {
        const hr = new Date(i.timestamp).getHours();
        if (hr < 12) morningMl += i.volume_ml;
        else if (hr < 18) afternoonMl += i.volume_ml;
        else eveningMl += i.volume_ml;
      });

      if (totalMl > 0) {
        const top = Math.max(morningMl, afternoonMl, eveningMl);
        patternLabel =
          top === morningMl ? "Morning-heavy" : top === afternoonMl ? "Afternoon-heavy" : "Evening-heavy";

        // Long gaps check (largest gap between intakes)
        for (let i = 1; i < ints.length; i++) {
          const a = new Date(ints[i - 1].timestamp).getTime();
          const b = new Date(ints[i].timestamp).getTime();
          const gapMin = Math.round((b - a) / 60000);
          if (gapMin > maxGapMin) maxGapMin = gapMin;
        }

        if (maxGapMin >= 180) {
          tips.push({
            title: "Consistency",
            body: `You had a long gap (~${Math.round(maxGapMin / 60)}h). Smaller, more frequent sips keep you steadier.`,
          });
        }

        if (last) {
          const lh = last.getHours();
          if (lh >= 19 && deficitOz >= 16) {
            tips.push({
              title: "Late-day catch-up",
              body: "Avoid big chugs late. Spread the remaining intake so it doesn’t disrupt sleep.",
            });
          }
        }

        if (patternLabel === "Evening-heavy" && ints.length >= 2) {
          tips.push({
            title: "Timing",
            body: "Most intake lands late. Try moving one bottle earlier (late morning/early afternoon).",
          });
        } else if (patternLabel === "Morning-heavy") {
          tips.push({
            title: "Timing",
            body: "Good early start. Keep it steady through the afternoon to avoid late catch-up.",
          });
        }
      } else {
        if (isToday && mounted) {
          const now = new Date();
          if (now.getHours() >= 12) {
            tips.push({
              title: "Start Now",
              body: "No drinks logged yet. Start with 12–16 oz, then settle into smaller sips.",
            });
          } else {
            tips.push({
              title: "Early Start",
              body: "Getting your first 8–12 oz in the morning makes the day easier.",
            });
          }
        }
      }

      // If viewing a past day with deficit
      if (!isToday && deficitOz > 0) {
        tips.push({
          title: "Reflection",
          body: `You finished ${deficitOz} oz below target. Tomorrow: start earlier and avoid long gaps.`,
        });
      }

      // If we have a first log late
      if (first && isToday && mounted) {
        const fh = first.getHours();
        if (fh >= 13 && targetOz >= 64) {
          tips.push({
            title: "Earlier Tomorrow",
            body: "Your first log was in the afternoon. Try logging your first 8–12 oz earlier tomorrow.",
          });
        }
      }
    } catch {}

    // Risk triggers (Idea 7) — keep simple + useful
    const risk: RiskTip | null = (() => {
      if (!isToday) return null;
      if (!mounted) return null;

      // Pull cached WHOOP for today (we store it in localStore).
      const recovery = whoop?.recovery_score ?? null;

      const now = new Date();
      const hr = now.getHours();
      const late = hr >= 17; // late afternoon onward

      // If behind + trained + low recovery + late, surface a stronger callout.
      const behind = deficitOz >= 16; // ~>= 16oz behind
      const trained = Boolean(flags.workouts);
      const workoutCount = workouts.length;
      const lowRecovery = typeof recovery === "number" && recovery < 40;

      if (behind && (trained || lowRecovery) && late) {
        const parts: string[] = [];
        if (trained) parts.push(`completed ${workoutCount === 1 ? "workout" : "workouts"}`);
        if (lowRecovery) parts.push(`low recovery (${Math.round(recovery)}%)`);

        return {
          level: "elevated",
          title: "Priority",
          body: `You’re behind and have ${parts.join(
            " + "
          )}. Prioritize electrolytes and steady intake over the next few hours.`,
        };
      }

      if (behind && late) {
        return {
          level: "normal",
          title: "Heads Up",
          body: "You’re behind for this time of day. Spread smaller sips to avoid a late-night catch-up.",
        };
      }

      return null;
    })();

    // Status label (professional + minimal)
    const status =
      targetMl <= 0
        ? { label: "Set up profile", tone: "muted" as const }
        : deficitMl <= 0
        ? { label: "On Target", tone: "good" as const }
        : { label: "Behind", tone: "warn" as const };

    // Suggestion for Today: small steady sips this hour
    const nextSipOz =
      isToday && deficitOz > 0
        ? Math.max(8, Math.min(16, Math.round(deficitOz / 4)))
        : 0;

    return {
      flags,
      targetOz,
      actualOz,
      deficitOz,
      status,
      patternLabel,
      tips: tips.slice(0, 2),
      maxGapMin,
      nextSipOz,
      risk,
    };
  }, [actualMl, flags, intakes, isToday, mounted, selectedDate, targetMl, whoop, workouts.length]);


  return (
    <div className="px-4 pb-4 pt-[calc(72px+env(safe-area-inset-top))]">
      {!isToday ? (
        <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
          Viewing <span className="font-medium">{formatDisplayDate(selectedDate)}</span>. Use Log or Workouts
          to add or edit for this day.
        </p>
      ) : null}

      <HydrationScoreCard score={score} />
      <div className="mb-2 -mt-3 text-right">
        <button
          type="button"
          className="text-xs text-zinc-500 underline dark:text-zinc-400"
          onClick={() => setShowScoreInfo(true)}
        >
          How the score works
        </button>
      </div>
      <HydrationProgressBar actualMl={actualMl} targetMl={targetMl} />
      {targetMl > 0 && actualMl > targetMl && score < 100 ? (
        <div className="mb-3 mt-2 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
          <span>Score reflects effective intake vs target; large overshoots can reduce it.</span>
          <button
            type="button"
            className="underline"
            onClick={() => setShowScoreInfo(true)}
          >
            Why not 100?
          </button>
        </div>
      ) : null}

      {/* ✅ Recommendations: cleaned layout (Idea 8) + habit coaching (Idea 4) + risk triggers (Idea 7) */}
      <Card className="mb-4 p-4 shadow-sm">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Recommendations</p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Target <span className="font-medium">{rec.targetOz} oz</span> • Actual{" "}
              <span className="font-medium">{rec.actualOz} oz</span>
              {rec.patternLabel ? (
                <>
                  <span className="mx-1">•</span>
                  <span className="font-medium">{rec.patternLabel}</span>
                </>
              ) : null}
            </p>
          </div>

          <div
            className={[
              "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold",
              rec.status.tone === "good"
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                : rec.status.tone === "warn"
                ? "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
            ].join(" ")}
          >
            {rec.status.label}
          </div>
        </div>

        {/* Primary message + quick actions */}
        <div className="mt-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          {targetMl <= 0 ? (
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              Add your profile (weight) to generate a personalized daily target.
            </p>
          ) : rec.deficitOz <= 0 ? (
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              Nice work — you hit your target for this day.
            </p>
          ) : isToday ? (
            <div className="space-y-2">
              <p className="text-sm text-zinc-700 dark:text-zinc-300">
                You’re <span className="font-semibold">{rec.deficitOz} oz</span> behind target.
              </p>
              {rec.nextSipOz > 0 ? (
                <p className="text-sm text-zinc-700 dark:text-zinc-300">
                  Small steady sips — <span className="font-semibold">{rec.nextSipOz} oz</span> over the next hour.
                  {rec.maxGapMin >= 120 ? (
                    <span className="ml-2 text-xs text-zinc-500">Longest gap ~{Math.round(rec.maxGapMin / 60)}h</span>
                  ) : null}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              You finished <span className="font-semibold">{rec.deficitOz} oz</span> below your target for
              this day.
            </p>
          )}

          {/* Risk callout */}
          {rec.risk ? (
            <div
              className={[
                "mt-3 rounded-xl border p-3 text-sm",
                rec.risk.level === "elevated"
                  ? "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200"
                  : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200",
              ].join(" ")}
            >
              <div className="font-semibold">{rec.risk.title}</div>
              <div className="mt-1 text-xs opacity-90">{rec.risk.body}</div>
            </div>
          ) : null}
        </div>

        {/* Tips */}
        {rec.tips.length ? (
          <div className="mt-3 grid gap-2">
            {rec.tips.map((t, idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{t.title}</p>
                <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">{t.body}</p>
              </div>
            ))}
          </div>
        ) : null}

        {/* Drivers: compact chips */}
        {mounted ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="rounded-full border border-zinc-200 px-2.5 py-1 text-xs dark:border-zinc-800">
              Base
            </span>
            {rec.flags.workouts ? (
              <span className="rounded-full border border-zinc-200 px-2.5 py-1 text-xs dark:border-zinc-800">
                Workouts
              </span>
            ) : null}
            {rec.flags.creatine ? (
              <span className="rounded-full border border-zinc-200 px-2.5 py-1 text-xs dark:border-zinc-800">
                Creatine
              </span>
            ) : null}
            {rec.flags.whoop ? (
              <span className="rounded-full border border-zinc-200 px-2.5 py-1 text-xs dark:border-zinc-800">
                WHOOP
              </span>
            ) : null}
          </div>
        ) : null}
      </Card>

      {/* Score info modal */}
      {showScoreInfo ? (
        <div
          className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/60 px-4 pt-[calc(200px+env(safe-area-inset-top))] pb-6"
          onClick={() => setShowScoreInfo(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-[420px] rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl animate-in dark:border-zinc-800 dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold">Hydration Score</p>
              <button
                className="rounded-lg border px-2 py-1 text-xs dark:border-zinc-800"
                onClick={() => setShowScoreInfo(false)}
              >
                Close
              </button>
            </div>
            <div className="space-y-3 text-sm text-zinc-700 dark:text-zinc-300">
              <p>
                Your score compares <strong>effective intake</strong> to your <strong>daily target</strong>.
              </p>
              <ul className="space-y-2">
                <li>
                  <strong>Target intake:</strong> based on body weight (≈0.5 oz/lb), plus workouts
                  (~0.27 oz/min × intensity), plus creatine (70 ml per gram), with optional WHOOP adjustments.
                </li>
                <li>
                  <strong>Effective intake:</strong> drinks are weighted by type. Alcohol does not add to
                  score, and electrolytes can slightly boost effective intake.
                </li>
                <li>
                  <strong>Score range:</strong> reaching target lifts score; going far above target can
                  slightly reduce it.
                </li>
              </ul>
              <div className="rounded-xl bg-zinc-50 p-3 text-xs text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-300">
                <div className="font-semibold text-zinc-700 dark:text-zinc-200">Drink weights (approx.)</div>
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                  <span>Water 1.00</span>
                  <span>Electrolyte 1.15</span>
                  <span>Milk 1.50</span>
                  <span>Juice 1.10</span>
                  <span>Coffee 0.95</span>
                  <span>Soda 0.90</span>
                  <span>Beer/Wine/Cocktail 0.00</span>
                </div>
              </div>
            </div>
            <div className="mt-3 rounded-xl bg-zinc-50 p-3 text-xs text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-300">
              Today: target {toOz(targetMl)} oz • actual {toOz(actualMl)} oz • score {Math.round(score)}
            </div>
          </div>
        </div>
      ) : null}

      <section className="mb-20">
        <h2 className="mb-2 text-lg font-semibold">{isToday ? "Today's Intake" : "Intake"}</h2>

        {intakes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
            No drinks logged for this day.
          </div>
        ) : (
          <ul className="divide-y divide-zinc-200 overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
            {intakes.map((i) => {
              const d = new Date(i.timestamp);
              const hhmm = fmtTimeNY(d);
              return (
                <li key={i.id} className="grid grid-cols-[72px,1fr,96px] items-center p-3 text-sm">
                  <div className="text-zinc-600 dark:text-zinc-300">{hhmm}</div>
                  <div className="text-right font-medium">{toOz(i.volume_ml)} oz</div>
                  <div className="text-right text-zinc-600 capitalize dark:text-zinc-300">{i.type}</div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
