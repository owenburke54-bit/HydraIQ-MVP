"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "../../components/ui/Card";
import RadialGauge from "../../components/charts/RadialGauge";
import {
  calculateHydrationScore,
  WORKOUT_ML_PER_MIN,
  BASE_ML_PER_KG,
} from "../../lib/hydration";
import {
  getProfile,
  formatNYDate,
  getIntakesByDateNY,
  getWorkoutsByDateNY,
  getSupplementsByDateNY,
  getWhoopMetrics,
  setWhoopMetrics,
} from "../../lib/localStore";
import { readSelectedDateFromLocation, isISODate } from "@/lib/selectedDate";

type DayPoint = { date: string; score: number; target: number; actual: number };

type HistoryRow = {
  day: string; // YYYY-MM-DD (NY)
  hydration_score: number;
  total_oz: number;
  base_need_oz?: number;
  workouts_oz?: number;
  creatine_oz?: number;
  supplements_oz?: number;
  sleep_oz?: number;
  recovery_oz?: number;
  sleep_hours: number | null;
  recovery_pct: number | null;
};

type Pair = {
  x: number; // yesterday hydration metric
  y: number; // today WHOOP metric
  dayToday: string;
  dayYesterday: string;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function pearsonCorrelation(x: number[], y: number[]) {
  const n = Math.min(x.length, y.length);
  if (n < 3) return null;

  const mx = x.reduce((s, v) => s + v, 0) / n;
  const my = y.reduce((s, v) => s + v, 0) / n;

  let num = 0;
  let dx = 0;
  let dy = 0;

  for (let i = 0; i < n; i++) {
    const vx = x[i] - mx;
    const vy = y[i] - my;
    num += vx * vy;
    dx += vx * vx;
    dy += vy * vy;
  }
  const denom = Math.sqrt(dx * dy);
  if (!denom) return null;
  return clamp(num / denom, -1, 1);
}

function addDaysISO(iso: string, delta: number) {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function mean(nums: number[]) {
  if (!nums.length) return null;
  return nums.reduce((s, v) => s + v, 0) / nums.length;
}

function formatType(t?: string | null) {
  if (!t) return "Workout";
  const s = String(t);
  if (/^whoop/i.test(s)) {
    const parts = s.split("•");
    if (parts.length >= 2) {
      const sport = parts.slice(1).join("•").trim();
      return `WHOOP • ${sport.replace(/\w\S*/g, (x) => x.charAt(0).toUpperCase() + x.slice(1).toLowerCase())}`;
    }
    return "WHOOP";
  }
  return s.replace(/\w\S*/g, (x) => x.charAt(0).toUpperCase() + x.slice(1).toLowerCase());
}

function TabPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "inline-flex items-center rounded-xl border px-3 py-2 text-sm border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950 dark:text-blue-200"
          : "inline-flex items-center rounded-xl border px-3 py-2 text-sm border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
      }
      aria-pressed={active}
    >
      {label}
    </button>
  );
}

function DeltaPill({ value }: { value: number }) {
  const positive = value >= 0;
  const pct = Math.round(Math.abs(value) * 100);
  const bg = positive ? "bg-emerald-900/30" : "bg-rose-900/30";
  const text = positive ? "text-emerald-400" : "text-rose-400";
  const rotate = positive ? "rotate-0" : "rotate-180";
  return (
    <span className={`inline-flex items-center gap-1 rounded-xl px-2 py-1 ${bg}`}>
      <svg width="10" height="10" viewBox="0 0 24 24" className={`${text} ${rotate}`} aria-hidden>
        <polygon points="12,4 20,20 4,20" fill="currentColor"></polygon>
      </svg>
      <span className={`text-[11px] font-medium leading-none ${text}`}>{pct}%</span>
    </span>
  );
}

/** Bubble line chart with labels above points (works for 7D and 14D). */
function BubbleLineChart({
  points,
  title,
  compactXLabels = false,
}: {
  points: { day: string; value: number }[];
  title?: string;
  compactXLabels?: boolean;
}) {
  const w = 420;
  const h = 190;
  const pad = 16;
  const leftPad = 44;
  const bottomPad = 28;

  if (!points.length) {
    return (
      <div className="mt-3 rounded-2xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
        No data yet.
      </div>
    );
  }

  const ys = points.map((p) => p.value);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const sx = (i: number) =>
    leftPad + (i / Math.max(1, points.length - 1)) * (w - leftPad - pad);

  const sy = (v: number) =>
    pad + (1 - (v - minY) / Math.max(1e-9, maxY - minY)) * (h - pad - bottomPad);

  const path = points
    .map((p, i) => `${i ? "L" : "M"} ${sx(i)} ${sy(p.value)}`)
    .join(" ");

  const yTicks = [minY, (minY + maxY) / 2, maxY];

  // reduce x label density for 14 days
  const step = compactXLabels ? Math.ceil(points.length / 6) : 1;

  return (
    <div className="mt-3">
      {title ? <div className="text-sm font-medium">{title}</div> : null}

      <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
        {/* axes */}
        <line x1={leftPad} y1={h - bottomPad} x2={w - pad} y2={h - bottomPad} stroke="#e5e7eb" />
        <line x1={leftPad} y1={pad} x2={leftPad} y2={h - bottomPad} stroke="#e5e7eb" />

        {/* y grid + labels */}
        {yTicks.map((v, i) => {
          const y = sy(v);
          return (
            <g key={i}>
              <line x1={leftPad - 4} y1={y} x2={w - pad} y2={y} stroke="#f1f5f9" />
              <text x={leftPad - 6} y={y + 3} textAnchor="end" fontSize="10" fill="#64748b">
                {Math.round(v)}
              </text>
            </g>
          );
        })}

        {/* x labels */}
        {points.map((p, i) => {
          if (compactXLabels && i % step !== 0 && i !== points.length - 1) return null;
          const x = sx(i);
          const lab = p.day.slice(5); // MM-DD
          return (
            <g key={p.day}>
              <line x1={x} y1={h - bottomPad} x2={x} y2={h - bottomPad + 4} stroke="#cbd5e1" />
              <text x={x} y={h - 8} textAnchor="middle" fontSize="10" fill="#64748b">
                {lab}
              </text>
            </g>
          );
        })}

        {/* line */}
        <path d={path} fill="none" stroke="#2563eb" strokeWidth="2.5" />

        {/* points + value labels */}
        {points.map((p, i) => {
          const x = sx(i);
          const y = sy(p.value);
          return (
            <g key={p.day}>
              <circle cx={x} cy={y} r="5" fill="#2563eb" opacity="0.9" />
              <text x={x} y={y - 9} textAnchor="middle" fontSize="10" fill="#334155">
                {Math.round(p.value)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Larger, roomier scatter card for Lag Effects. */
function ScatterPlotCard({
  title,
  pairs,
  pill,
  xLabel,
  yLabel,
  xFmt,
  yFmt,
}: {
  title: string;
  pairs: Pair[];
  pill: number | null;
  xLabel: string;
  yLabel: string;
  xFmt?: (v: number) => string;
  yFmt?: (v: number) => string;
}) {
  // Bigger canvas for insight once data exists
  const w = 460;
  const h = 280;
  const pad = 20;
  const leftPad = 54;
  const bottomPad = 40;

  const has = pairs.length > 0;

  if (!has) {
    return (
      <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-medium">{title}</div>
          {pill == null ? null : <DeltaPill value={pill} />}
        </div>

        <div className="mt-4 min-h-[220px] rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400 flex items-center justify-center">
          Not enough data.
        </div>

        <div className="mt-3 text-xs text-zinc-500">Pairs: 0</div>
      </div>
    );
  }

  const xs = pairs.map((p) => p.x);
  const ys = pairs.map((p) => p.y);

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const sx = (v: number) =>
    leftPad + ((v - minX) / Math.max(1e-9, maxX - minX)) * (w - leftPad - pad);

  const sy = (v: number) =>
    pad + (1 - (v - minY) / Math.max(1e-9, maxY - minY)) * (h - pad - bottomPad);

  // trend line
  let trendPath: string | null = null;
  if (pairs.length >= 2) {
    const n = pairs.length;
    const mx = xs.reduce((s, v) => s + v, 0) / n;
    const my = ys.reduce((s, v) => s + v, 0) / n;
    let num = 0;
    let den = 0;
    for (const p of pairs) {
      num += (p.x - mx) * (p.y - my);
      den += (p.x - mx) * (p.x - mx);
    }
    const slope = den ? num / den : 0;
    const intercept = my - slope * mx;
    const yAtMin = slope * minX + intercept;
    const yAtMax = slope * maxX + intercept;
    trendPath = `M ${sx(minX)} ${sy(yAtMin)} L ${sx(maxX)} ${sy(yAtMax)}`;
  }

  // minimal tick labels (just ends)
  const xLeft = xFmt ? xFmt(minX) : `${Math.round(minX)}`;
  const xRight = xFmt ? xFmt(maxX) : `${Math.round(maxX)}`;
  const yTop = yFmt ? yFmt(maxY) : `${Math.round(maxY)}`;
  const yBottom = yFmt ? yFmt(minY) : `${Math.round(minY)}`;

  return (
    <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium">{title}</div>
        {pill == null ? null : <DeltaPill value={pill} />}
      </div>

      <div className="mt-4">
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
          {/* axes */}
          <line x1={leftPad} y1={h - bottomPad} x2={w - pad} y2={h - bottomPad} stroke="#e5e7eb" />
          <line x1={leftPad} y1={pad} x2={leftPad} y2={h - bottomPad} stroke="#e5e7eb" />

          {/* trend */}
          {trendPath ? <path d={trendPath} fill="none" stroke="#94a3b8" strokeWidth="2" /> : null}

          {/* points */}
          {pairs.map((p, i) => (
            <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r="4.5" fill="#2563eb" opacity="0.85" />
          ))}

          {/* axis labels */}
          <text
            x={(leftPad + (w - pad)) / 2}
            y={h - 6}
            textAnchor="middle"
            fontSize="11"
            fill="#64748b"
          >
            {xLabel}
          </text>
          <text
            x={14}
            y={(pad + (h - bottomPad)) / 2}
            textAnchor="middle"
            fontSize="11"
            fill="#64748b"
            transform={`rotate(-90 14 ${(pad + (h - bottomPad)) / 2})`}
          >
            {yLabel}
          </text>

          {/* minimal ticks */}
          <text x={leftPad} y={h - bottomPad + 18} fontSize="10" fill="#64748b">
            {xLeft}
          </text>
          <text x={w - pad} y={h - bottomPad + 18} textAnchor="end" fontSize="10" fill="#64748b">
            {xRight}
          </text>
          <text x={leftPad - 8} y={pad + 4} textAnchor="end" fontSize="10" fill="#64748b">
            {yTop}
          </text>
          <text
            x={leftPad - 8}
            y={h - bottomPad + 4}
            textAnchor="end"
            fontSize="10"
            fill="#64748b"
          >
            {yBottom}
          </text>
        </svg>
      </div>

      <div className="mt-3 text-xs text-zinc-500">Pairs: {pairs.length}</div>
    </div>
  );
}

export default function InsightsPage() {
  const router = useRouter();

  const today = useMemo(() => formatNYDate(new Date()), []);
  const [selectedDate, setSelectedDate] = useState<string>(today);

  useEffect(() => {
    const sync = () => {
      const iso = readSelectedDateFromLocation(today);
      setSelectedDate(isISODate(iso) ? iso : today);
    };

    sync();
    window.addEventListener("popstate", sync);
    window.addEventListener("hydra:datechange", sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("hydra:datechange", sync);
    };
  }, [today]);

  const isToday = selectedDate === today;

  const [points, setPoints] = useState<DayPoint[]>([]);
  const [tab, setTab] = useState<"today" | "history">("today");

  const [whoopSelected, setWhoopSelected] = useState<{
    sleepHours: number | null;
    recovery: number | null;
  } | null>(null);

  const [historyRows, setHistoryRows] = useState<HistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const cached = getWhoopMetrics(selectedDate);
        if (cached) {
          setWhoopSelected({
            sleepHours: cached.sleep_hours,
            recovery: cached.recovery_score,
          });
        }

        const res = await fetch(`/api/whoop/metrics?date=${selectedDate}`, {
          credentials: "include",
        });
        if (res.ok) {
          const j = await res.json();
          setWhoopMetrics(selectedDate, {
            sleep_hours: j.sleep_hours ?? null,
            recovery_score: j.recovery_score ?? null,
          });
          setWhoopSelected({
            sleepHours: j.sleep_hours ?? null,
            recovery: j.recovery_score ?? null,
          });
        }
      } catch {}
    })();
  }, [selectedDate]);

  // 14-day local points (for History bottom trend)
  useEffect(() => {
    const prof = getProfile();
    const weight = prof?.weight_kg ?? 0;

    const arr: string[] = [];
    const now = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      arr.push(formatNYDate(d));
    }

    const out: DayPoint[] = arr.map((date) => {
      const intakes = getIntakesByDateNY(date);
      const actual = intakes.reduce((s, i) => s + i.volume_ml, 0);

      let target = 0;
      if (weight > 0) {
        const workouts = getWorkoutsByDateNY(date);
        const workoutAdj = workouts.reduce((sum, w) => {
          const start = new Date(w.start_time);
          const end = w.end_time ? new Date(w.end_time) : start;
          const mins = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
          const strain =
            typeof w.intensity === "number" ? Math.max(0, Math.min(21, w.intensity)) : 5;
          const intensityFactor = 0.5 + strain / 21;
          return sum + mins * WORKOUT_ML_PER_MIN * intensityFactor;
        }, 0);

        target = Math.round(weight * 35 + workoutAdj);
      }

      const score =
        target > 0
          ? calculateHydrationScore({
              targetMl: target,
              actualMl: actual,
              intakes: intakes.map((i) => ({
                timestamp: new Date(i.timestamp),
                volumeMl: i.volume_ml,
              })),
              workouts: [],
            })
          : 0;

      return { date, actual, target, score };
    });

    setPoints(out.reverse());
  }, []);

  useEffect(() => {
    if (tab !== "history") return;
    if (historyRows.length) return;

    (async () => {
      setHistoryLoading(true);
      try {
        const res = await fetch("/api/history?days=180", { credentials: "include" });
        if (res.ok) {
          const j = await res.json();
          setHistoryRows(Array.isArray(j) ? j : []);
        }
      } catch {}
      setHistoryLoading(false);
    })();
  }, [tab, historyRows.length]);

  const dayBreakdown = useMemo(() => {
    const prof = getProfile();
    const weight = prof?.weight_kg ?? 0;
    if (weight <= 0) return null;

    const workouts = getWorkoutsByDateNY(selectedDate);
    const supplements = getSupplementsByDateNY(selectedDate);

    const base = Math.round(weight * BASE_ML_PER_KG);

    const workoutLines = workouts.map((w) => {
      const start = new Date(w.start_time);
      const end = w.end_time ? new Date(w.end_time) : start;
      const mins = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
      const strain =
        typeof w.intensity === "number" ? Math.max(0, Math.min(21, w.intensity)) : 5;
      const intensityFactor = 0.5 + strain / 21;
      const added = Math.round(mins * WORKOUT_ML_PER_MIN * intensityFactor);
      const label = `${formatType(w.type)} • ${mins} min`;
      return { label, added };
    });

    const creatineMl = supplements
      .filter((s) => s.type === "creatine" && s.grams && s.grams > 0)
      .reduce((sum, s) => sum + (s.grams || 0) * 70, 0);

    const lines: { label: string; added: number }[] = [
      { label: "Base need", added: base },
      ...workoutLines,
    ];
    if (creatineMl > 0) lines.push({ label: "Creatine", added: Math.round(creatineMl) });

    const baseTarget = lines.reduce((s, l) => s + l.added, 0);

    let modPct = 0;

    if (whoopSelected?.sleepHours != null) {
      const h = whoopSelected.sleepHours;
      let sAdj = 0;
      if (h < 7.5) sAdj = Math.max(0, 7.5 - h) * 0.03;
      else if (h > 8.5) sAdj = -Math.max(0, h - 8.5) * 0.02;
      modPct += sAdj;
      lines.push({ label: `Sleep (${h.toFixed(1)} h)`, added: Math.round(baseTarget * sAdj) });
    }

    if (whoopSelected?.recovery != null) {
      let rAdj = 0;
      const r = whoopSelected.recovery;
      if (r < 33) rAdj = 0.05;
      else if (r < 66) rAdj = 0.02;
      modPct += rAdj;
      lines.push({ label: `Recovery (${Math.round(r)}%)`, added: Math.round(baseTarget * rAdj) });
    }

    const total = Math.round(baseTarget + baseTarget * modPct);
    return { lines, total };
  }, [selectedDate, whoopSelected]);

  const selectedTotals = useMemo(() => {
    const intakes = getIntakesByDateNY(selectedDate);
    const actual = intakes.reduce((s, i) => s + i.volume_ml, 0);
    const target = dayBreakdown?.total ?? 0;

    const score =
      target > 0
        ? calculateHydrationScore({
            targetMl: target,
            actualMl: actual,
            intakes: intakes.map((i) => ({
              timestamp: new Date(i.timestamp),
              volumeMl: i.volume_ml,
            })),
            workouts: [],
          })
        : 0;

    return { actual, target, score };
  }, [selectedDate, dayBreakdown]);

  const quick = useMemo(() => {
    const messages: { title: string; body: string }[] = [];

    const deficit = Math.max(0, selectedTotals.target - selectedTotals.actual);
    if (selectedTotals.target > 0) {
      if (deficit > 0)
        messages.push({ title: "Hydration pacing", body: `~${Math.round(deficit / 29.5735)} oz behind target.` });
      else messages.push({ title: "Hydration pacing", body: "On pace or ahead of target." });
    }

    if (whoopSelected?.sleepHours != null || whoopSelected?.recovery != null) {
      const parts: string[] = [];
      if (whoopSelected.sleepHours != null) parts.push(`Sleep ${whoopSelected.sleepHours.toFixed(1)} h`);
      if (whoopSelected.recovery != null) parts.push(`Recovery ${Math.round(whoopSelected.recovery)}%`);
      messages.push({ title: "WHOOP synergy", body: parts.join(" • ") });
    }

    return messages.slice(0, 5);
  }, [selectedTotals, whoopSelected]);

  // 7-day series ending on selectedDate (History top chart)
  const series7D = useMemo(() => {
    const prof = getProfile();
    const weight = prof?.weight_kg ?? 0;

    const days = Array.from({ length: 7 }).map((_, i) => addDaysISO(selectedDate, -(6 - i)));

    const pts = days.map((date) => {
      const intakes = getIntakesByDateNY(date);
      const actual = intakes.reduce((s, x) => s + x.volume_ml, 0);

      let target = 0;
      if (weight > 0) {
        const workouts = getWorkoutsByDateNY(date);
        const workoutAdj = workouts.reduce((sum, w) => {
          const start = new Date(w.start_time);
          const end = w.end_time ? new Date(w.end_time) : start;
          const mins = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
          const strain =
            typeof w.intensity === "number" ? Math.max(0, Math.min(21, w.intensity)) : 5;
          const intensityFactor = 0.5 + strain / 21;
          return sum + mins * WORKOUT_ML_PER_MIN * intensityFactor;
        }, 0);

        target = Math.round(weight * 35 + workoutAdj);
      }

      const score =
        target > 0
          ? calculateHydrationScore({
              targetMl: target,
              actualMl: actual,
              intakes: intakes.map((i) => ({
                timestamp: new Date(i.timestamp),
                volumeMl: i.volume_ml,
              })),
              workouts: [],
            })
          : 0;

      return { day: date, value: Number(score.toFixed(1)) };
    });

    const any = pts.some((p) => p.value > 0);
    return any ? pts : [];
  }, [selectedDate]);

  // 14-day trend series from local points you already compute
  const series14D = useMemo(() => {
    const pts = points.map((p) => ({ day: p.date, value: Number(p.score.toFixed(1)) }));
    const any = pts.some((p) => p.value > 0);
    return any ? pts : [];
  }, [points]);

  const stats14D = useMemo(() => {
    if (!series14D.length) return null;

    const values = series14D.map((p) => p.value);
    const avg = mean(values) ?? 0;

    let best = series14D[0];
    for (const p of series14D) if (p.value > best.value) best = p;

    // streak >= 75 ending on most recent day in the series
    const THRESH = 75;
    let streak = 0;
    for (let i = series14D.length - 1; i >= 0; i--) {
      if (series14D[i].value >= THRESH) streak++;
      else break;
    }

    return { avg, bestDay: best.day, bestScore: best.value, streak75: streak, threshold: THRESH };
  }, [series14D]);

  const historySorted = useMemo(() => {
    const rows = [...historyRows].filter((r) => isISODate(r.day));
    rows.sort((a, b) => a.day.localeCompare(b.day));
    return rows;
  }, [historyRows]);

  const lagPairs = useMemo(() => {
    const map = new Map<string, HistoryRow>();
    for (const r of historySorted) map.set(r.day, r);

    const scoreToSleep: Pair[] = [];
    const ozToSleep: Pair[] = [];
    const scoreToRecovery: Pair[] = [];
    const ozToRecovery: Pair[] = [];

    for (const todayRow of historySorted) {
      const dayToday = todayRow.day;
      const dayYesterday = addDaysISO(dayToday, -1);
      const yRow = map.get(dayYesterday);
      if (!yRow) continue;

      if (todayRow.sleep_hours != null) {
        if (Number.isFinite(yRow.hydration_score))
          scoreToSleep.push({ x: Number(yRow.hydration_score), y: Number(todayRow.sleep_hours), dayToday, dayYesterday });
        if (Number.isFinite(yRow.total_oz))
          ozToSleep.push({ x: Number(yRow.total_oz), y: Number(todayRow.sleep_hours), dayToday, dayYesterday });
      }

      if (todayRow.recovery_pct != null) {
        if (Number.isFinite(yRow.hydration_score))
          scoreToRecovery.push({ x: Number(yRow.hydration_score), y: Number(todayRow.recovery_pct), dayToday, dayYesterday });
        if (Number.isFinite(yRow.total_oz))
          ozToRecovery.push({ x: Number(yRow.total_oz), y: Number(todayRow.recovery_pct), dayToday, dayYesterday });
      }
    }

    return { scoreToSleep, ozToSleep, scoreToRecovery, ozToRecovery };
  }, [historySorted]);

  const lagCorr = useMemo(() => {
    const corr = (pairs: Pair[]) =>
      pearsonCorrelation(
        pairs.map((p) => p.x),
        pairs.map((p) => p.y)
      );

    return {
      score_sleep: corr(lagPairs.scoreToSleep),
      oz_sleep: corr(lagPairs.ozToSleep),
      score_recovery: corr(lagPairs.scoreToRecovery),
      oz_recovery: corr(lagPairs.ozToRecovery),
    };
  }, [lagPairs]);

  return (
    <div className="px-4 pb-4 pt-[calc(72px+env(safe-area-inset-top))]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Insights</h1>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Showing: <span className="font-medium">{selectedDate}</span>
            {isToday ? " (Today)" : ""}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <TabPill label="Today" active={tab === "today"} onClick={() => setTab("today")} />
          <TabPill label="History" active={tab === "history"} onClick={() => setTab("history")} />
        </div>
      </div>

      {tab === "today" ? (
        <>
          <section className="mt-4">
            <Card className="flex items-center gap-4 p-4">
              <div className="w-[160px] shrink-0">
                <RadialGauge
                  value={Math.min(1, selectedTotals.actual / Math.max(1, selectedTotals.target || 0))}
                  label={isToday ? "Today" : "Selected day"}
                />
              </div>

              <div className="text-sm text-zinc-600 dark:text-zinc-400">
                <p>
                  Target: <strong>{Math.round((selectedTotals.target || 0) / 29.5735)} oz</strong>
                </p>
                <p>
                  Actual: <strong>{Math.round((selectedTotals.actual || 0) / 29.5735)} oz</strong>
                </p>
                <p>
                  Score: <strong>{Math.round(selectedTotals.score)}</strong>
                </p>

                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => router.push(`/log?date=${selectedDate}`)}
                    className="rounded-xl border px-3 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                  >
                    Log drink
                  </button>
                </div>
              </div>
            </Card>
          </section>

          {dayBreakdown ? (
            <section className="mt-4">
              <Card className="p-4">
                <p className="mb-2 text-sm text-zinc-600 dark:text-zinc-400">Target drivers</p>
                <ul className="space-y-1 text-sm">
                  {dayBreakdown.lines.map((l, i) => (
                    <li key={i} className="flex items-center justify-between">
                      <span>{l.label}</span>
                      <span className="tabular-nums">{Math.round(l.added / 29.5735)} oz</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex items-center justify-between border-t pt-2 text-sm">
                  <span className="font-medium">Total target</span>
                  <span className="tabular-nums font-medium">
                    {Math.round(dayBreakdown.total / 29.5735)} oz
                  </span>
                </div>
              </Card>
            </section>
          ) : null}

          <section className="mt-4 space-y-2">
            {quick.map((q, i) => (
              <Card key={i} className="p-4">
                <p className="font-medium">{q.title}</p>
                <p className="text-zinc-700 dark:text-zinc-300">{q.body}</p>
              </Card>
            ))}

            {quick.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
                Add a profile, log a drink or a workout to see insights.
              </div>
            ) : null}
          </section>
        </>
      ) : (
        <>
          {/* 7-day chart */}
          <section className="mt-4">
            <Card className="p-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  Hydration Score (Last 7 Days)
                </p>
                {historyLoading ? <span className="text-xs text-zinc-500">Loading…</span> : null}
              </div>
              <BubbleLineChart points={series7D} />
            </Card>
          </section>

          {/* Lag Effects — bigger + spaced */}
          <section className="mt-4">
            <Card className="p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Lag Effects</p>
                {historyRows.length === 0 && !historyLoading ? (
                  <span className="text-xs text-zinc-500">No saved history yet.</span>
                ) : null}
              </div>

              {/* ✅ More spacing + larger cards:
                  - mobile: 1 column (bigger charts)
                  - md+: 2 columns */}
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <ScatterPlotCard
                  title="Score → Sleep (Next Day)"
                  pairs={lagPairs.scoreToSleep}
                  pill={lagCorr.score_sleep}
                  xLabel="Yesterday score"
                  yLabel="Sleep (h)"
                  xFmt={(v) => `${Math.round(v)}`}
                  yFmt={(v) => `${v.toFixed(1)}`}
                />

                <ScatterPlotCard
                  title="Oz → Recovery (Next Day)"
                  pairs={lagPairs.ozToRecovery}
                  pill={lagCorr.oz_recovery}
                  xLabel="Yesterday oz"
                  yLabel="Recovery (%)"
                  xFmt={(v) => `${Math.round(v)}`}
                  yFmt={(v) => `${Math.round(v)}`}
                />

                <ScatterPlotCard
                  title="Oz → Sleep (Next Day)"
                  pairs={lagPairs.ozToSleep}
                  pill={lagCorr.oz_sleep}
                  xLabel="Yesterday oz"
                  yLabel="Sleep (h)"
                  xFmt={(v) => `${Math.round(v)}`}
                  yFmt={(v) => `${v.toFixed(1)}`}
                />

                <ScatterPlotCard
                  title="Score → Recovery (Next Day)"
                  pairs={lagPairs.scoreToRecovery}
                  pill={lagCorr.score_recovery}
                  xLabel="Yesterday score"
                  yLabel="Recovery (%)"
                  xFmt={(v) => `${Math.round(v)}`}
                  yFmt={(v) => `${Math.round(v)}`}
                />
              </div>
            </Card>
          </section>

          {/* 14-day: replace “meaningless green grid” with a real trend + stats */}
          <section className="mt-4">
            <Card className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    Hydration Score (Last 14 Days)
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Trend + key signals (built from your logged intake/workouts).
                  </p>
                </div>
              </div>

              {/* Stats row */}
              {stats14D ? (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="rounded-2xl border border-zinc-200 p-3 dark:border-zinc-800">
                    <div className="text-[11px] text-zinc-500">Avg</div>
                    <div className="mt-1 text-xl font-semibold tabular-nums">
                      {Math.round(stats14D.avg)}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-zinc-200 p-3 dark:border-zinc-800">
                    <div className="text-[11px] text-zinc-500">Best</div>
                    <div className="mt-1 text-xl font-semibold tabular-nums">
                      {Math.round(stats14D.bestScore)}
                    </div>
                    <div className="mt-1 text-[11px] text-zinc-500">{stats14D.bestDay}</div>
                  </div>
                  <div className="rounded-2xl border border-zinc-200 p-3 dark:border-zinc-800">
                    <div className="text-[11px] text-zinc-500">Streak</div>
                    <div className="mt-1 text-xl font-semibold tabular-nums">
                      {stats14D.streak75}
                    </div>
                    <div className="mt-1 text-[11px] text-zinc-500">Days ≥ {stats14D.threshold}</div>
                  </div>
                </div>
              ) : null}

              <BubbleLineChart points={series14D} compactXLabels />
            </Card>
          </section>
        </>
      )}
    </div>
  );
}
