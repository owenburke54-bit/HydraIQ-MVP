import {
  getEffectiveActualMl,
  getIntakesByDateNY,
  getProfile,
  getSupplementsByDateNY,
  getWhoopMetrics,
  getWorkoutsByDateNY,
  todayNYDate,
  type Intake,
  type SupplementEvent,
  type WhoopMetrics,
  type Workout,
} from "./localStore";
import { BASE_ML_PER_KG, WORKOUT_ML_PER_MIN, calculateHydrationScore } from "./hydration";

export type TargetDriver = { label: string; added: number };

export type HydrationFlags = {
  workouts: boolean;
  creatine: boolean;
  whoop: boolean;
};

export type HydrationPacing = {
  status: "needs-profile" | "behind" | "on-target";
  deficitMl: number;
  aheadMl: number;
};

export type IntakeSeriesItem = {
  timestamp: string;
  volumeMl: number;
  type: Intake["type"];
};

export type DailyHydrationSnapshot = {
  date: string;
  targetMl: number;
  actualMl: number;
  score: number;
  intakes: Intake[];
  workouts: Workout[];
  supplements: SupplementEvent[];
  whoop: WhoopMetrics | null;
  flags: HydrationFlags;
  pacing: HydrationPacing;
  targetDrivers: TargetDriver[];
  intakeSeries: IntakeSeriesItem[];
  computedAt: string;
  version: number;
};

export function buildDailyHydrationSnapshot(dateNY: string, version: number): DailyHydrationSnapshot {
  const profile = getProfile();
  const weight = profile?.weight_kg ?? 0;

  const intakes = getIntakesByDateNY(dateNY);
  const workouts = getWorkoutsByDateNY(dateNY);
  const supplements = getSupplementsByDateNY(dateNY);
  const whoop = getWhoopMetrics(dateNY);

  const actualMl = getEffectiveActualMl(dateNY, intakes);

  const workoutAdjustmentMl = workouts.reduce((sum, w) => {
    const start = new Date(w.start_time);
    const end = w.end_time ? new Date(w.end_time) : start;
    const mins = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
    const strain = typeof w.intensity === "number" ? Math.max(0, Math.min(21, w.intensity)) : 5;
    const intensityFactor = 0.5 + strain / 21;
    return sum + mins * WORKOUT_ML_PER_MIN * intensityFactor;
  }, 0);

  const creatineMl = supplements
    .filter((s) => s.type === "creatine" && s.grams && s.grams > 0)
    .reduce((sum, s) => sum + (s.grams || 0) * 70, 0);

  const targetDrivers: TargetDriver[] = [];
  const baseNeedMl = weight > 0 ? Math.round(weight * BASE_ML_PER_KG) : 0;
  if (baseNeedMl > 0) targetDrivers.push({ label: "Base Need", added: baseNeedMl });
  if (workoutAdjustmentMl > 0)
    targetDrivers.push({ label: "Workouts", added: Math.round(workoutAdjustmentMl) });
  if (creatineMl > 0) targetDrivers.push({ label: "Creatine", added: Math.round(creatineMl) });

  const baseTargetMl = baseNeedMl + workoutAdjustmentMl + creatineMl;

  let modPct = 0;
  let sleepAdjMl = 0;
  let recoveryAdjMl = 0;

  if (typeof whoop?.sleep_hours === "number") {
    const h = whoop.sleep_hours;
    let sAdj = 0;
    if (h < 7.5) sAdj = Math.max(0, 7.5 - h) * 0.03;
    else if (h > 8.5) sAdj = -Math.max(0, h - 8.5) * 0.02;
    modPct += sAdj;
    sleepAdjMl = baseTargetMl * sAdj;
    targetDrivers.push({ label: `Sleep (${h.toFixed(1)} h)`, added: Math.round(sleepAdjMl) });
  }

  if (typeof whoop?.recovery_score === "number") {
    const r = whoop.recovery_score;
    let rAdj = 0;
    if (r < 33) rAdj = 0.05;
    else if (r < 66) rAdj = 0.02;
    modPct += rAdj;
    recoveryAdjMl = baseTargetMl * rAdj;
    targetDrivers.push({ label: `Recovery (${Math.round(r)}%)`, added: Math.round(recoveryAdjMl) });
  }

  const targetMl = baseTargetMl > 0 ? Math.round(baseTargetMl * (1 + modPct)) : 0;

  const score =
    targetMl > 0
      ? calculateHydrationScore(
          {
            targetMl,
            actualMl,
            intakes: intakes.map((i) => ({
              timestamp: new Date(i.timestamp),
              volumeMl: i.volume_ml,
            })),
            workouts: [],
          },
          dateNY === todayNYDate() ? "live" : "final"
        )
      : 0;

  const deficitMl = Math.max(0, targetMl - actualMl);
  const aheadMl = Math.max(0, actualMl - targetMl);
  const status: HydrationPacing["status"] =
    targetMl <= 0 ? "needs-profile" : deficitMl <= 0 ? "on-target" : "behind";

  const intakeSeries = [...intakes]
    .sort((a, b) => +new Date(a.timestamp) - +new Date(b.timestamp))
    .map((i) => ({ timestamp: i.timestamp, volumeMl: i.volume_ml, type: i.type }));

  return {
    date: dateNY,
    targetMl,
    actualMl,
    score,
    intakes,
    workouts,
    supplements,
    whoop,
    flags: {
      workouts: workouts.length > 0,
      creatine: creatineMl > 0,
      whoop: typeof whoop?.sleep_hours === "number" || typeof whoop?.recovery_score === "number",
    },
    pacing: { status, deficitMl, aheadMl },
    targetDrivers,
    intakeSeries,
    computedAt: new Date().toISOString(),
    version,
  };
}
