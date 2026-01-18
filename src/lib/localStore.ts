// Local persistence helpers (no auth required). Data is stored per-browser.
//
// Keys
// - hydra.profile
// - hydra.intakes
// - hydra.workouts
// - hydra.summaries
// - hydra.supplements
// - hydra.whoop
//
// Note: These helpers must be called from client components only.

import { WORKOUT_ML_PER_MIN } from "./hydration";
import { BeverageType, hydrationFactor } from "./beverages";

type Profile = {
  name?: string;
  sex?: "male" | "female" | "other";
  height_cm?: number | null;
  weight_kg?: number | null;
  units?: "metric" | "imperial";
};

type Intake = {
  id: string;
  timestamp: string; // ISO
  volume_ml: number;
  type: BeverageType;
};

type Workout = {
  id: string;
  start_time: string; // ISO
  end_time?: string | null;
  duration_min?: number | null;
  type?: string | null;
  intensity?: number | null;
};

type SupplementEvent = {
  id: string;
  timestamp: string; // ISO
  type: "creatine" | "protein" | "multivitamin" | "fish_oil" | "electrolyte_tablet" | "other";
  grams?: number | null;
};

type Settings = {
  timezone?: "est" | "auto";
  units?: "oz" | "ml";
  environment?: "normal" | "warm" | "hot";
};

export function formatNYDate(d: Date): string {
  // YYYY-MM-DD in America/New_York
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);

  const y = parts.find((p) => p.type === "year")?.value ?? "0000";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const dd = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${dd}`;
}

export function todayNYDate(): string {
  return formatNYDate(new Date());
}

export function lastNDatesNY(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 1; i <= n; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    out.push(formatNYDate(d));
  }
  return out;
}

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJSON<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function fallbackId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function safeId(): string {
  // Works in modern browsers; safe fallback for older Safari / restricted contexts.
  try {
    const c: Crypto | undefined =
      typeof globalThis !== "undefined" && "crypto" in globalThis
        ? (globalThis.crypto as Crypto)
        : undefined;

    const uuid = c?.randomUUID?.();
    return uuid || fallbackId();
  } catch {
    return fallbackId();
  }
}

export function getProfile(): Profile | null {
  return readJSON<Profile | null>("hydra.profile", null);
}

export function saveProfile(p: Profile) {
  writeJSON("hydra.profile", p);
}

export function getSettings(): Settings {
  try {
    return readJSON<Settings>("hydra.settings", {
      timezone: "est",
      units: "oz",
      environment: "normal",
    });
  } catch {
    return { timezone: "est", units: "oz", environment: "normal" };
  }
}

export function setSettings(next: Settings) {
  writeJSON("hydra.settings", next);
}

export function addIntake(volumeMl: number, type: Intake["type"], ts: Date) {
  const list = readJSON<Intake[]>("hydra.intakes", []);
  list.push({
    id: safeId(),
    timestamp: ts.toISOString(),
    volume_ml: volumeMl,
    type,
  });
  writeJSON("hydra.intakes", list);

  // Persist simple daily summary
  try {
    const dateNY = formatNYDate(ts);
    recomputeSummary(dateNY);
  } catch {}
}

export function getIntakesByDate(date: string): Intake[] {
  const list = readJSON<Intake[]>("hydra.intakes", []);
  return list.filter((i) => i.timestamp.slice(0, 10) === date);
}

export function getIntakesByDateNY(date: string): Intake[] {
  const list = readJSON<Intake[]>("hydra.intakes", []);
  return list.filter((i) => formatNYDate(new Date(i.timestamp)) === date);
}

// Sum with hydration weighting factors
export function sumEffectiveMl(intakes: Intake[]): number {
  return intakes.reduce((s, i) => s + i.volume_ml * hydrationFactor(i.type), 0);
}

/**
 * Home should always show the selected NY date.
 * We keep a small fallback that compares the raw ISO date prefix,
 * but it MUST compare to the selected date (not "today").
 */
export function getIntakesForHome(dateNY: string): Intake[] {
  const list = readJSON<Intake[]>("hydra.intakes", []);
  return list.filter((i) => {
    const nyMatch = formatNYDate(new Date(i.timestamp)) === dateNY;
    const simpleMatch = i.timestamp.slice(0, 10) === dateNY; // ✅ compare to selected date
    return nyMatch || simpleMatch;
  });
}

export function addWorkout(data: {
  start: Date;
  end?: Date;
  durationMin?: number;
  intensity?: number;
  type?: string;
}) {
  const list = readJSON<Workout[]>("hydra.workouts", []);
  const durationMin =
    typeof data.durationMin === "number"
      ? data.durationMin
      : data.end
      ? Math.max(0, Math.round((data.end.getTime() - data.start.getTime()) / 60000))
      : null;

  list.push({
    id: safeId(),
    start_time: data.start.toISOString(),
    end_time: data.end ? data.end.toISOString() : null,
    duration_min: durationMin,
    type: data.type ?? null,
    intensity: data.intensity ?? null,
  });

  writeJSON("hydra.workouts", list);
  recomputeSummary(formatNYDate(data.start));
}

export function getWorkoutsByDateNY(date: string): Workout[] {
  const list = readJSON<Workout[]>("hydra.workouts", []);
  return list.filter((w) => formatNYDate(new Date(w.start_time)) === date);
}

export function updateWorkout(id: string, patch: Partial<Workout>) {
  const list = readJSON<Workout[]>("hydra.workouts", []);
  const idx = list.findIndex((w) => w.id === id);
  if (idx === -1) return;

  const old = list[idx];
  const next = { ...old, ...patch };
  list[idx] = next;
  writeJSON("hydra.workouts", list);

  // Recompute summaries for old and new dates if changed
  try {
    recomputeSummary(formatNYDate(new Date(old.start_time)));
    recomputeSummary(formatNYDate(new Date(next.start_time)));
  } catch {}
}

export function deleteWorkout(id: string) {
  const list = readJSON<Workout[]>("hydra.workouts", []);
  const idx = list.findIndex((w) => w.id === id);
  if (idx === -1) return;

  const old = list[idx];
  list.splice(idx, 1);
  writeJSON("hydra.workouts", list);

  try {
    recomputeSummary(formatNYDate(new Date(old.start_time)));
  } catch {}
}

export function addSupplements(events: {
  types: SupplementEvent["type"][];
  timestamp: Date;
  grams?: number | null;
}) {
  const list = readJSON<SupplementEvent[]>("hydra.supplements", []);
  events.types.forEach((t) => {
    list.push({
      id: safeId(),
      timestamp: events.timestamp.toISOString(),
      type: t,
      grams: events.grams ?? null,
    });
  });

  writeJSON("hydra.supplements", list);

  // Recompute summary for this date
  try {
    recomputeSummary(formatNYDate(events.timestamp));
  } catch {}
}

export function getSupplementsByDateNY(date: string): SupplementEvent[] {
  const list = readJSON<SupplementEvent[]>("hydra.supplements", []);
  return list.filter((s) => formatNYDate(new Date(s.timestamp)) === date);
}

export function hasCreatineOnDateNY(date: string): boolean {
  try {
    const list = readJSON<SupplementEvent[]>("hydra.supplements", []);
    return list.some((s) => formatNYDate(new Date(s.timestamp)) === date && s.type === "creatine");
  } catch {
    return false;
  }
}

export function clearAllLocalData() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem("hydra.profile");
  window.localStorage.removeItem("hydra.intakes");
  window.localStorage.removeItem("hydra.workouts");
  window.localStorage.removeItem("hydra.summaries");
  window.localStorage.removeItem("hydra.supplements");
  window.localStorage.removeItem("hydra.whoop");
  window.localStorage.removeItem("hydra.settings");
}

// --- Daily summary helpers (for multi-day calculations) ---
type Summary = { date: string; target_ml: number; actual_ml: number };

export function recomputeSummary(dateNY: string) {
  const profile = readJSON<Profile | null>("hydra.profile", null);
  const weight = profile?.weight_kg ?? 0;

  const ints = getIntakesByDateNY(dateNY);
  const actual = sumEffectiveMl(ints);

  const w = getWorkoutsByDateNY(dateNY);
  const workoutAdj = w.reduce((sum, ww) => {
    const s = new Date(ww.start_time);
    const e = ww.end_time ? new Date(ww.end_time) : s;
    const mins = Math.max(0, Math.round((e.getTime() - s.getTime()) / 60000));
    // Treat intensity as WHOOP strain (0–21). Map to factor 0.5–1.5x.
    const strain = typeof ww.intensity === "number" ? Math.max(0, Math.min(21, ww.intensity)) : 5;
    const f = 0.5 + strain / 21;
    return sum + mins * WORKOUT_ML_PER_MIN * f;
  }, 0);

  // Supplements: creatine increases target (~70 ml per gram)
  const supps = getSupplementsByDateNY(dateNY);
  const suppAdj = supps.reduce((sum, s) => {
    if (s.type === "creatine" && s.grams && s.grams > 0) return sum + s.grams * 70;
    return sum;
  }, 0);

  const target = Math.round((weight > 0 ? weight * 35 : 0) + workoutAdj + suppAdj);

  const map = readJSON<Record<string, Summary>>("hydra.summaries", {});
  map[dateNY] = { date: dateNY, target_ml: target, actual_ml: actual };
  writeJSON("hydra.summaries", map);
}

export function getSummaryByDate(dateNY: string): Summary | null {
  const map = readJSON<Record<string, Summary>>("hydra.summaries", {});
  return map[dateNY] ?? null;
}

// Environment adjustment disabled – return 0 to avoid discrepancies
export function getEnvironmentAdjustmentMl(): number {
  return 0;
}

// WHOOP metrics cache (per NY date)
export type WhoopMetrics = {
  sleep_hours: number | null;
  sleep_performance: number | null; // percentage 0-100
  recovery_score: number | null;
  fetched_at: string;
};

type WhoopMap = Record<string, WhoopMetrics>;

export function getWhoopMetrics(dateNY: string): WhoopMetrics | null {
  return readJSON<WhoopMap>("hydra.whoop", {})[dateNY] ?? null;
}

/**
 * Persist WHOOP metrics for a given NY date.
 * Also normalizes values to avoid NaN/Infinity breaking correlation logic.
 */
export function setWhoopMetrics(
  dateNY: string,
  m: { sleep_hours: number | null; recovery_score: number | null; sleep_performance?: number | null }
) {
  const norm = (v: number | null) => (typeof v === "number" && Number.isFinite(v) ? v : null);

  const map = readJSON<WhoopMap>("hydra.whoop", {});
  map[dateNY] = {
    sleep_hours: norm(m.sleep_hours),
    sleep_performance: norm(m.sleep_performance ?? null),
    recovery_score: norm(m.recovery_score),
    fetched_at: new Date().toISOString(),
  };
  writeJSON("hydra.whoop", map);
}
