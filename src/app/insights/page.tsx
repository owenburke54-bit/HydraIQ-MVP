"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
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
  getEffectiveActualMl,
} from "../../lib/localStore";
import { useSelectedISODate, isISODate } from "@/lib/selectedDate";
import { formatDisplayDate } from "@/lib/dateFormat";

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
  sleep_perf: number | null;
  recovery_pct: number | null;
};

type Pair = {
  x: number; // yesterday hydration metric
  y: number; // today WHOOP metric
  dayToday: string;
  dayYesterday: string;
};

function lastNDatesNY(n: number): string[] {
	const arr: string[] = [];
	const now = new Date();
	for (let i = 0; i < n; i++) {
		const d = new Date(now);
		d.setDate(now.getDate() - i);
		arr.push(formatNYDate(d));
	}
	return arr;
}

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

/** KPI pill for correlations: green up for +, red down for - */
function CorrKPI({ value }: { value: number | null }) {
  if (value == null) return null;
  const pos = value >= 0;
  const pct = Math.round(Math.abs(value) * 100);
  const bg = pos ? "bg-emerald-900/15" : "bg-rose-900/15";
  const text = pos ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400";
  const border = pos ? "border-emerald-200/60 dark:border-emerald-900/40" : "border-rose-200/60 dark:border-rose-900/40";
  const rotate = pos ? "rotate-0" : "rotate-180";
  return (
    <div className={`inline-flex items-center gap-1.5 rounded-xl border px-2 py-1 ${bg} ${border}`}>
      <svg width="12" height="12" viewBox="0 0 24 24" className={`${text} ${rotate}`} aria-hidden>
        <polygon points="12,4 20,20 4,20" fill="currentColor"></polygon>
      </svg>
      <span className={`text-xs font-semibold tabular-nums ${text}`}>{pct}%</span>
    </div>
  );
}

function ScatterPlot({
  pairs,
  xLabel,
  yLabel,
  xFmt,
  yFmt,
  height = 240,
}: {
  pairs: Pair[];
  xLabel: string;
  yLabel: string;
  xFmt?: (v: number) => string;
  yFmt?: (v: number) => string;
  height?: number;
}) {
  const w = 420;
  const h = height;
  const pad = 18;
  const leftPad = 48;
  const bottomPad = 36;

  if (!pairs.length) {
    return (
      <div className="mt-3 rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
        Not enough data yet.
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
    leftPad +
    ((v - minX) / Math.max(1e-9, maxX - minX)) * (w - leftPad - pad);
  const sy = (v: number) =>
    pad + (1 - (v - minY) / Math.max(1e-9, maxY - minY)) * (h - pad - bottomPad);

  // least-squares trend line
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

  const xTicks = [minX, (minX + maxX) / 2, maxX];
  const yTicks = [minY, (minY + maxY) / 2, maxY];

  return (
    <div className="mt-3">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
        <line x1={leftPad} y1={h - bottomPad} x2={w - pad} y2={h - bottomPad} stroke="#e5e7eb" />
        <line x1={leftPad} y1={pad} x2={leftPad} y2={h - bottomPad} stroke="#e5e7eb" />

        {yTicks.map((v, i) => {
          const y = sy(v);
          const label = yFmt ? yFmt(v) : v.toFixed(1);
          return (
            <g key={i}>
              <line x1={leftPad - 4} y1={y} x2={w - pad} y2={y} stroke="#f1f5f9" />
              <text x={leftPad - 6} y={y + 3} textAnchor="end" fontSize="10" fill="#64748b">
                {label}
              </text>
            </g>
          );
        })}

        {xTicks.map((v, i) => {
          const x = sx(v);
          const label = xFmt ? xFmt(v) : v.toFixed(0);
          return (
            <g key={i}>
              <line x1={x} y1={h - bottomPad} x2={x} y2={h - bottomPad + 4} stroke="#cbd5e1" />
              <text x={x} y={h - 14} textAnchor="middle" fontSize="10" fill="#64748b">
                {label}
              </text>
            </g>
          );
        })}

        <path
          d={`M ${sx(minX)} ${sy(yAtMin)} L ${sx(maxX)} ${sy(yAtMax)}`}
          fill="none"
          stroke="#94a3b8"
          strokeWidth="2"
        />

        {pairs.map((p, i) => (
          <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r="4.5" fill="#2563eb" opacity="0.9" />
        ))}

        <text
          x={(leftPad + (w - pad)) / 2}
          y={h - 2}
          textAnchor="middle"
          fontSize="10"
          fill="#64748b"
        >
          {xLabel}
        </text>
        <text
          x={12}
          y={(pad + (h - bottomPad)) / 2}
          textAnchor="middle"
          fontSize="10"
          fill="#64748b"
          transform={`rotate(-90 12 ${(pad + (h - bottomPad)) / 2})`}
        >
          {yLabel}
        </text>
      </svg>
    </div>
  );
}

/** Clean 7-day score line w/ bubbles + tiny score label above each bubble */
function SevenDayScoreChart({ points }: { points: { day: string; value: number }[] }) {
  const w = 420;
  const h = 200;
  const pad = 16;
  const leftPad = 44;
  const bottomPad = 34;

  if (!points.length) {
    return (
      <div className="mt-3 rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
        Not enough data yet.
      </div>
    );
  }

  const ys = points.map((p) => p.value);
  const minY = Math.min(...ys, 0);
  const maxY = Math.max(...ys, 100);

  const sx = (i: number) =>
    leftPad +
    (i / Math.max(1, points.length - 1)) * (w - leftPad - pad);
  const sy = (v: number) =>
    pad + (1 - (v - minY) / Math.max(1e-9, maxY - minY)) * (h - pad - bottomPad);

  const path = points
    .map((p, i) => `${i ? "L" : "M"} ${sx(i)} ${sy(p.value)}`)
    .join(" ");

  const yTicks = [0, 50, 100];

  return (
    <div className="mt-3">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
        <line x1={leftPad} y1={h - bottomPad} x2={w - pad} y2={h - bottomPad} stroke="#e5e7eb" />
        <line x1={leftPad} y1={pad} x2={leftPad} y2={h - bottomPad} stroke="#e5e7eb" />

        {yTicks.map((v, i) => {
          const y = sy(v);
          return (
            <g key={i}>
              <line x1={leftPad - 4} y1={y} x2={w - pad} y2={y} stroke="#f1f5f9" />
              <text x={leftPad - 6} y={y + 3} textAnchor="end" fontSize="10" fill="#64748b">
                {v}
              </text>
            </g>
          );
        })}

        {points.map((p, i) => {
          const x = sx(i);
          const lab = p.day.slice(5); // MM-DD
          return (
            <g key={p.day}>
              <line x1={x} y1={h - bottomPad} x2={x} y2={h - bottomPad + 4} stroke="#cbd5e1" />
              <text x={x} y={h - 10} textAnchor="middle" fontSize="10" fill="#64748b">
                {lab}
              </text>
            </g>
          );
        })}

        <path d={path} fill="none" stroke="#2563eb" strokeWidth="2.5" />

        {points.map((p, i) => {
          const x = sx(i);
          const y = sy(p.value);
          return (
            <g key={p.day}>
              <text x={x} y={y - 10} textAnchor="middle" fontSize="10" fill="#64748b">
                {Math.round(p.value)}
              </text>
              <circle cx={x} cy={y} r="5" fill="#2563eb" />
              <circle cx={x} cy={y} r="8" fill="#2563eb" opacity="0.12" />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** 14-day goal completion bars (ratio actual/target) */
function GoalCompletionBars({ points }: { points: DayPoint[] }) {
  const w = 420;
  const h = 190;
  const pad = 16;
  const leftPad = 44;
  const bottomPad = 34;

  if (!points.length) {
    return <div className="h-44" />;
  }

  const vals = points.map((p) => {
    const r = p.target > 0 ? p.actual / p.target : 0;
    return clamp(r, 0, 1.2);
  });

  const maxY = 1.2;
  const sx = (i: number) =>
    leftPad +
    (i / Math.max(1, points.length - 1)) * (w - leftPad - pad);

  const barW = Math.max(6, Math.min(14, (w - leftPad - pad) / points.length - 4));
  const sy = (v: number) =>
    pad + (1 - v / maxY) * (h - pad - bottomPad);

  const yTicks = [0, 0.5, 1.0, 1.2];

  return (
    <div className="mt-3">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
        <line x1={leftPad} y1={h - bottomPad} x2={w - pad} y2={h - bottomPad} stroke="#e5e7eb" />
        <line x1={leftPad} y1={pad} x2={leftPad} y2={h - bottomPad} stroke="#e5e7eb" />

        {yTicks.map((v, i) => {
          const y = sy(v);
          const lab = v === 1 ? "1.0" : v.toFixed(1);
          return (
            <g key={i}>
              <line x1={leftPad - 4} y1={y} x2={w - pad} y2={y} stroke="#f1f5f9" />
              <text x={leftPad - 6} y={y + 3} textAnchor="end" fontSize="10" fill="#64748b">
                {lab}
              </text>
            </g>
          );
        })}

        <line x1={leftPad} y1={sy(1)} x2={w - pad} y2={sy(1)} stroke="#94a3b8" strokeDasharray="4 4" />

        {points.map((p, i) => {
          const x = sx(i);
          const v = vals[i];
          const y = sy(v);
          const baseY = h - bottomPad;
          const x0 = x - barW / 2;
          const dayLab = p.date.slice(5);

          const showLabel =
            points.length <= 10 ||
            i % Math.ceil(points.length / 6) === 0 ||
            i === points.length - 1;

          return (
            <g key={p.date}>
              <rect
                x={x0}
                y={y}
                width={barW}
                height={Math.max(0, baseY - y)}
                rx={4}
                fill="#2563eb"
                opacity="0.85"
              />
              {showLabel ? (
                <text x={x} y={h - 10} textAnchor="middle" fontSize="10" fill="#64748b">
                  {dayLab}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>

      <div className="mt-2 text-xs text-zinc-500">
        Goal Completion Ratio (Actual ÷ Target) • Dashed line = 1.0 target
      </div>
    </div>
  );
}

/** Tiny sparkline for 7-day moving average (visual trend) */
function ThresholdLanes({ days }: { days: { day: string; value: number }[] }) {
  const w = 420;
  const h = 80;
  const pad = 16;
  if (!days.length) return null;
  const sx = (i: number) => pad + (i / Math.max(1, days.length - 1)) * (w - pad - 8);
  const sy = (pct: number) => {
    const v = Math.max(0, Math.min(100, pct));
    return pad + (1 - v / 100) * (h - 2 * pad);
  };
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
      {[75, 50, 25].map((g, i) => (
        <line
          key={g}
          x1={pad}
          y1={sy(g)}
          x2={w - 8}
          y2={sy(g)}
          stroke={i === 0 ? "#10b98166" : "#e5e7eb55"}
          strokeDasharray={i === 0 ? "4 4" : "2 6"}
        />
      ))}
      {days.map((d, i) => {
        const v = Number(d.value) || 0;
        const color = v >= 75 ? "#10b981" : v >= 50 ? "#f59e0b" : "#ef4444";
        return <circle key={d.day} cx={sx(i)} cy={sy(v)} r={3.5} fill={color} opacity="0.95" />;
      })}
    </svg>
  );
}

/** Compact 14-cell adherence grid (>= threshold is green) */
function AdherenceGrid({
  days,
  threshold = 75,
}: {
  days: { day: string; value: number }[];
  threshold?: number;
}) {
  const cols = 14;
  const cell = 14;
  return (
    <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${cols}, ${cell}px)` }}>
      {days.slice(-14).map((p) => {
        const ok = Number(p.value) >= threshold;
        return (
          <div
            key={p.day}
            className={ok ? "rounded-sm bg-emerald-500" : "rounded-sm bg-zinc-300 dark:bg-zinc-700"}
            style={{ width: cell, height: cell }}
            title={`${p.day}: ${Math.round(p.value)}`}
          />
        );
      })}
    </div>
  );
}

export default function InsightsPage() {
  const router = useRouter();
  const { todayISO: today, selectedDate } = useSelectedISODate();

  const isToday = selectedDate === today;

  const [points14, setPoints14] = useState<DayPoint[]>([]);
  const [tab, setTab] = useState<"today" | "history">("today");
  const [pending, startTransition] = useTransition();

  // Range selector for correlation charts (only logged days)
  type RangeKey = "7" | "30" | "90" | "all";
  const [pairsWindow, setPairsWindow] = useState<RangeKey>("30");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("hydra:pairsWindow");
      if (saved === "7" || saved === "30" || saved === "90" || saved === "all") {
        setPairsWindow(saved);
      }
    } catch {}
  }, []);
  const onChangePairsWindow = (rk: RangeKey) => {
    setPairsWindow(rk);
    try {
      localStorage.setItem("hydra:pairsWindow", rk);
    } catch {}
  };

  const [whoopSelected, setWhoopSelected] = useState<{
    sleepHours: number | null;
    recovery: number | null;
  } | null>(null);

  // Server history snapshots (kept for future cloud sync, but not required for Lag Effects)
  const [historyRows, setHistoryRows] = useState<HistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Fetch WHOOP sleep/recovery for selected day (today tab logic)
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

        const TTL_MS = 10 * 60 * 1000;
        const fresh =
          cached &&
          cached.fetched_at &&
          Date.now() - new Date(cached.fetched_at).getTime() < TTL_MS;
        // If sleep_performance is missing, force a fetch even if TTL says fresh
        const needsPerf = !cached || cached.sleep_performance == null;
        const res =
          fresh && !needsPerf
            ? null
            : await fetch(`/api/whoop/metrics?date=${selectedDate}`, {
                credentials: "include",
              });
        if (res && res.ok) {
          const j = await res.json();
          setWhoopMetrics(selectedDate, {
            sleep_hours: j.sleep_hours ?? null,
            sleep_performance: j.sleep_performance ?? null,
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

  // Local-derived 14-day points
  useEffect(() => {
    const prof = getProfile();
    const weight = prof?.weight_kg ?? 0;
    const dates = lastNDatesNY(14);

    const out: DayPoint[] = dates.map((date) => {
      const intakes = getIntakesByDateNY(date);
      const actual = getEffectiveActualMl(date, intakes);

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

        // Creatine adjustment (70 ml per gram)
        const supps = getSupplementsByDateNY(date);
        const creatineMl = supps
          .filter((s) => s.type === "creatine" && s.grams && s.grams > 0)
          .reduce((sum, s) => sum + (s.grams || 0) * 70, 0);

        // WHOOP modifiers
        const baseTarget = weight * BASE_ML_PER_KG + workoutAdj + creatineMl;
        const m = getWhoopMetrics(date);
        let modPct = 0;
        if (typeof m?.sleep_hours === "number") {
          const h = m.sleep_hours;
          if (h < 7.5) modPct += Math.max(0, 7.5 - h) * 0.03;
          else if (h > 8.5) modPct -= Math.max(0, h - 8.5) * 0.02;
        }
        if (typeof m?.recovery_score === "number") {
          const r = m.recovery_score;
          if (r < 33) modPct += 0.05;
          else if (r < 66) modPct += 0.02;
        }
        target = Math.round(baseTarget * (1 + modPct));
      }

      const score =
        target > 0
          ? calculateHydrationScore(
              {
                targetMl: target,
                actualMl: actual,
                intakes: intakes.map((i) => ({
                  timestamp: new Date(i.timestamp),
                  volumeMl: i.volume_ml,
                })),
                workouts: [],
              },
              "final"
            )
          : 0;

      return { date, actual, target, score };
    });

    setPoints14(out.reverse());
  }, []);

  // Fetch server history snapshots when opening History tab (optional; may be empty)
  useEffect(() => {
    if (tab !== "history") return;
    if (historyRows.length) return;

    (async () => {
      setHistoryLoading(true);
      try {
        const res = await fetch("/api/history?days=180", {
          credentials: "include",
        });
				if (res.ok) {
					const j = await res.json();
          setHistoryRows(Array.isArray(j) ? j : []);
				}
			} catch {}
      setHistoryLoading(false);
		})();
  }, [tab, historyRows.length]);

  // 🔥 Backfill WHOOP cache efficiently when opening Today/History
  // Lag Effects lives on Today, so fetch missing sleep_performance there too.
  // Fetch only missing days, with limited concurrency, and a tight window for speed.
  const [whoopBackfillLoading, setWhoopBackfillLoading] = useState(false);
  useEffect(() => {
    if (tab !== "today" && tab !== "history") return;
    let cancelled = false;

    (async () => {
      setWhoopBackfillLoading(true);
      try {
        // 34 days to match user's typical data window, faster than 60/90
        const dates = lastNDatesNY(34);
        // Gather only days missing sleep_performance (the metric used by Lag Effects)
        const missing = dates.filter((d) => {
          const m = getWhoopMetrics(d);
          return !(m && m.sleep_performance != null);
        });
        if (!missing.length) return;

        // Concurrency limiter: batches of 5
        const chunkSize = 5;
        for (let i = 0; i < missing.length; i += chunkSize) {
          if (cancelled) return;
          const batch = missing.slice(i, i + chunkSize);
          await Promise.allSettled(
            batch.map(async (d) => {
              try {
                const res = await fetch(`/api/whoop/metrics?date=${d}`, { credentials: "include" });
                if (!res.ok) return;
                const j = await res.json();
                setWhoopMetrics(d, {
                  sleep_hours: j.sleep_hours ?? null,
                  sleep_performance: j.sleep_performance ?? null,
                  recovery_score: j.recovery_score ?? null,
                });
              } catch {
                // ignore per-day failures
              }
            })
          );
        }
      } finally {
        setWhoopBackfillLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tab]);

  // Breakdown of selected day's target
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
      { label: "Base Need", added: base },
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
      lines.push({
        label: `Sleep (${h.toFixed(1)} h)`,
        added: Math.round(baseTarget * sAdj),
      });
		}

    if (whoopSelected?.recovery != null) {
			let rAdj = 0;
      const r = whoopSelected.recovery;
			if (r < 33) rAdj = 0.05;
			else if (r < 66) rAdj = 0.02;
			modPct += rAdj;
      lines.push({
        label: `Recovery (${Math.round(r)}%)`,
        added: Math.round(baseTarget * rAdj),
      });
		}

		const total = Math.round(baseTarget + baseTarget * modPct);
		return { lines, total };
  }, [selectedDate, whoopSelected]);

  const selectedTotals = useMemo(() => {
    const intakes = getIntakesByDateNY(selectedDate);
    const actual = getEffectiveActualMl(selectedDate, intakes);
    const target = dayBreakdown?.total ?? 0;

    const score =
      target > 0
        ? calculateHydrationScore(
            {
              targetMl: target,
              actualMl: actual,
              intakes: intakes.map((i) => ({
                timestamp: new Date(i.timestamp),
                volumeMl: i.volume_ml,
              })),
              workouts: [],
            },
            isToday ? "live" : "final"
          )
        : 0;

    return { actual, target, score };
  }, [selectedDate, dayBreakdown, isToday]);

  // Quick insight cards (Selected day)
  const quick = useMemo(() => {
    const messages: { title: string; body: string }[] = [];

    const deficit = Math.max(0, selectedTotals.target - selectedTotals.actual);
    if (selectedTotals.target > 0) {
      if (deficit > 0)
        messages.push({
          title: "Hydration Pacing",
          body: `You're ~${Math.round(deficit / 29.5735)} oz behind target.`,
        });
      else messages.push({ title: "Hydration Pacing", body: "You're on pace or ahead of target." });
    }

    if (whoopSelected?.sleepHours != null || whoopSelected?.recovery != null) {
      const parts: string[] = [];
      if (whoopSelected.sleepHours != null) parts.push(`Sleep ${whoopSelected.sleepHours.toFixed(1)} h`);
      if (whoopSelected.recovery != null) parts.push(`Recovery ${Math.round(whoopSelected.recovery)}%`);
      messages.push({
        title: "WHOOP (optional)",
        body: `When connected, target accounts for ${parts.join(", ")}.`,
      });
    }

    return messages.slice(0, 5);
  }, [selectedTotals, whoopSelected]);

  // ---- HISTORY (Lag Effects + 7D trend + 14D summary) ----

  // Build a local history series (hydration + WHOOP cache) so Lag Effects works even without /api/history.
  const localHistorySorted = useMemo(() => {
    // Avoid heavy work unless the History tab is open
    if (tab !== "history") return [] as HistoryRow[];
		const prof = getProfile();
		const weight = prof?.weight_kg ?? 0;
    if (weight <= 0) return [] as HistoryRow[];

    // Build a smaller window to reduce work on mobile
    const dates = lastNDatesNY(34).reverse();

    const rows: HistoryRow[] = dates.map((day) => {
      const intakes = getIntakesByDateNY(day);
      const workouts = getWorkoutsByDateNY(day);
      const supplements = getSupplementsByDateNY(day);

      const actualMl = getEffectiveActualMl(day, intakes);

      const baseMl = Math.round(weight * BASE_ML_PER_KG);

      const workoutMl = workouts.reduce((sum, w) => {
					const start = new Date(w.start_time);
					const end = w.end_time ? new Date(w.end_time) : start;
					const mins = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
        const strain =
          typeof w.intensity === "number" ? Math.max(0, Math.min(21, w.intensity)) : 5;
        const intensityFactor = 0.5 + strain / 21;
					return sum + mins * WORKOUT_ML_PER_MIN * intensityFactor;
				}, 0);

      const creatineMl = supplements
        .filter((s) => s.type === "creatine" && s.grams && s.grams > 0)
        .reduce((sum, s) => sum + (s.grams || 0) * 70, 0);

      // WHOOP cache for THAT day (used for that day's target modifier)
      const whoop = getWhoopMetrics(day);
      const sleepHours = whoop?.sleep_hours ?? null;
      const sleepPerf = whoop?.sleep_performance ?? null;
      const recoveryPct = whoop?.recovery_score ?? null;

      const baseTargetMl = baseMl + workoutMl + creatineMl;

      let modPct = 0;
      let sleepMl = 0;
      let recoveryMl = 0;

      if (sleepHours != null) {
        let sAdj = 0;
        if (sleepHours < 7.5) sAdj = Math.max(0, 7.5 - sleepHours) * 0.03;
        else if (sleepHours > 8.5) sAdj = -Math.max(0, sleepHours - 8.5) * 0.02;
        modPct += sAdj;
        sleepMl = baseTargetMl * sAdj;
      }

      if (recoveryPct != null) {
        let rAdj = 0;
        if (recoveryPct < 33) rAdj = 0.05;
        else if (recoveryPct < 66) rAdj = 0.02;
        modPct += rAdj;
        recoveryMl = baseTargetMl * rAdj;
			}

      const targetMl = Math.round(baseTargetMl + baseTargetMl * modPct);

			const score =
        targetMl > 0
					? calculateHydrationScore({
              targetMl,
              actualMl,
              intakes: intakes.map((i) => ({
                timestamp: new Date(i.timestamp),
                volumeMl: i.volume_ml,
              })),
							workouts: [],
					  })
					: 0;

      const totalOz = actualMl / 29.5735;

      return {
        day,
        hydration_score: Number.isFinite(score) ? Number(score) : 0,
        total_oz: Number.isFinite(totalOz) ? Number(totalOz) : 0,
        base_need_oz: baseMl / 29.5735,
        workouts_oz: workoutMl / 29.5735,
        creatine_oz: creatineMl / 29.5735,
        sleep_oz: sleepMl / 29.5735,
        recovery_oz: recoveryMl / 29.5735,
        sleep_perf: sleepPerf,
        recovery_pct: recoveryPct,
      };
		});

    // only keep days with some signal (intake logged OR whoop data OR workouts)
    const trimmed = rows.filter((r) => {
      const hasHydration = Number(r.total_oz) > 0 || Number(r.hydration_score) > 0;
      const hasWhoop = r.sleep_perf != null || r.recovery_pct != null;
      const hasWorkouts = (r.workouts_oz ?? 0) > 0;
      return hasHydration || hasWhoop || hasWorkouts;
    });

    trimmed.sort((a, b) => a.day.localeCompare(b.day));
    return trimmed;
  }, [tab]); // rebuild when switching tabs (and after whoop backfill)

  const historySorted = useMemo(() => {
    // Prefer server history if it exists; otherwise use local computed history
    const server = [...historyRows].filter((r) => isISODate(r.day));
    server.sort((a, b) => a.day.localeCompare(b.day));
    if (server.length >= 7) return server;
    return localHistorySorted;
  }, [historyRows, localHistorySorted]);

  const lagPairs = useMemo(() => {
    const map = new Map<string, HistoryRow>();
    // Only use days where hydration was actually logged (total_oz > 0).
    // This guarantees pairs reflect logged days only (no WHOOP-only days).
    const base = historySorted.filter((r) => Number(r.total_oz) > 0);
    for (const r of base) map.set(r.day, r);

    const scoreToSleep: Pair[] = [];
    const ozToSleep: Pair[] = [];
    const scoreToRecovery: Pair[] = [];
    const ozToRecovery: Pair[] = [];

    for (const todayRow of base) {
      const dayToday = todayRow.day;
      const dayYesterday = addDaysISO(dayToday, -1);
      const yRow = map.get(dayYesterday);
      if (!yRow) continue;

      if (todayRow.sleep_perf != null) {
        // Both yesterday and today must have hydration logged
        if (Number(yRow.total_oz) > 0 && Number(todayRow.total_oz) > 0)
          scoreToSleep.push({
            x: Number(yRow.hydration_score),
            y: Number(todayRow.sleep_perf),
            dayToday,
            dayYesterday,
          });
        if (Number(yRow.total_oz) > 0 && Number(todayRow.total_oz) > 0)
          ozToSleep.push({
            x: Number(yRow.total_oz),
            y: Number(todayRow.sleep_perf),
            dayToday,
            dayYesterday,
          });
      }

      if (todayRow.recovery_pct != null) {
        if (Number(yRow.total_oz) > 0 && Number(todayRow.total_oz) > 0)
          scoreToRecovery.push({
            x: Number(yRow.hydration_score),
            y: Number(todayRow.recovery_pct),
            dayToday,
            dayYesterday,
          });
        if (Number(yRow.total_oz) > 0 && Number(todayRow.total_oz) > 0)
          ozToRecovery.push({
            x: Number(yRow.total_oz),
            y: Number(todayRow.recovery_pct),
            dayToday,
            dayYesterday,
          });
      }
    }

    // Intersect by dayToday so both charts always show the same final count
    const daysScore = new Set(scoreToSleep.map((p) => p.dayToday));
    const daysRec = new Set(scoreToRecovery.map((p) => p.dayToday));
    const commonDays = [...daysScore].filter((d) => daysRec.has(d)).sort();

    const scoreToSleepCommon = scoreToSleep.filter((p) => commonDays.includes(p.dayToday));
    const scoreToRecoveryCommon = scoreToRecovery.filter((p) => commonDays.includes(p.dayToday));

    // After intersecting, trim to the selected window length (logged-day pairs only)
    const limit = pairsWindow === "all" ? Infinity : Number(pairsWindow);
    const tail = (arr: Pair[]) =>
      pairsWindow === "all" ? arr : arr.slice(-Math.min(limit, arr.length));

    return {
      scoreToSleep: tail(scoreToSleepCommon),
      ozToSleep: tail(ozToSleep), // not used anymore but retained structurally
      scoreToRecovery: tail(scoreToRecoveryCommon),
      ozToRecovery: tail(ozToRecovery), // not used anymore but retained structurally
    };
  }, [historySorted, pairsWindow]);

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

  const lagSummary = useMemo(() => {
    const toPct = (v: number | null) =>
      typeof v === "number" && Number.isFinite(v) ? `${Math.round(Math.abs(v) * 100)}%` : "—";

    const sleepPct = toPct(lagCorr.score_sleep);
    const recoveryPct = toPct(lagCorr.score_recovery);

    return `These charts show that there is a (${sleepPct}) correlation between Hydration Score and Sleep Performance, and a (${recoveryPct}) correlation between Hydration Score and Recovery.`;
  }, [lagCorr.score_sleep, lagCorr.score_recovery]);

  // 7-day score series from saved history (preferred); fallback to local 14-day
  const last7Series = useMemo(() => {
    let series =
      historySorted.length >= 3
        ? historySorted
            .slice(Math.max(0, historySorted.length - 7))
            .map((r) => ({ day: r.day, value: Number(r.hydration_score) }))
            .filter((p) => Number.isFinite(p.value))
        : points14
            .slice(Math.max(0, points14.length - 7))
            .map((p) => ({ day: p.date, value: Number(p.score) }))
            .filter((p) => Number.isFinite(p.value));

    // Ensure today's point (if present) matches the live score shown on Home/Today
    const idx = series.findIndex((p) => p.day === today);
    if (idx >= 0) {
      series = [...series];
      series[idx] = { ...series[idx], value: Number(selectedTotals.score) };
		}
    return series;
  }, [historySorted, points14, today, selectedTotals.score]);

  // 14-day summary KPIs from local points
  const points14Display = useMemo(() => {
    // Replace today's score with live score when displaying charts/KPIs
    const arr = points14.map((p) =>
      p.date === today ? { ...p, score: Number(selectedTotals.score) } : p
    );
    return arr;
  }, [points14, today, selectedTotals.score]);

  const last14Stats = useMemo(() => {
    const pts = points14Display.slice(-14);
    if (!pts.length) return { avg: null as number | null, best: null as DayPoint | null, streak: 0 };

    const avg = pts.reduce((s, p) => s + (Number.isFinite(p.score) ? p.score : 0), 0) / pts.length;
    const best = pts.reduce((b, p) => (p.score > b.score ? p : b), pts[0]);

    const THRESH = 75;
    let streak = 0;
    for (let i = pts.length - 1; i >= 0; i--) {
      if (Number(pts[i].score) >= THRESH) streak++;
      else break;
		}

    return { avg, best, streak, threshold: THRESH, pts };
  }, [points14Display]);

  const noHistoryAtAll = historySorted.length === 0 && !historyLoading;

	return (
    <div className="px-4 pb-4 pt-[calc(72px+env(safe-area-inset-top))]">
      <div className="flex items-start justify-between gap-3">
        <div>
			<h1 className="text-xl font-semibold">Insights</h1>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Showing: <span className="font-medium">{formatDisplayDate(selectedDate)}</span>
            {isToday ? " (Today)" : ""}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <TabPill label="Today" active={tab === "today"} onClick={() => startTransition(() => setTab("today"))} />
          <TabPill label="History" active={tab === "history"} onClick={() => startTransition(() => setTab("history"))} />
        </div>
			</div>

      {tab === "today" ? (
        <>
			<section className="mt-4">
            <Card className="flex items-center gap-4 p-4">
					<div className="w-[160px] shrink-0">
						<RadialGauge
                  value={Math.min(1, selectedTotals.actual / Math.max(1, selectedTotals.target || 0))}
                  label={isToday ? "Today" : "Selected Day"}
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
                <p className="mb-2 text-sm text-zinc-600 dark:text-zinc-400">Target Drivers</p>
						<ul className="space-y-1 text-sm">
                  {dayBreakdown.lines.map((l, i) => (
								<li key={i} className="flex items-center justify-between">
									<span>{l.label}</span>
									<span className="tabular-nums">{Math.round(l.added / 29.5735)} oz</span>
								</li>
							))}
						</ul>
						<div className="mt-2 flex items-center justify-between border-t pt-2 text-sm">
                  <span className="font-medium">Total Target</span>
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
          {/* 7-Day Trend */}
          <section className="mt-4">
            <Card className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Hydration Score (Last 7 Days)
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Each point is your daily score (built from logged intake/workouts).
                  </p>
		</div>
                {historyLoading ? <span className="text-xs text-zinc-500">Loading…</span> : null}
              </div>

              <SevenDayScoreChart points={last7Series} />
            </Card>
          </section>

          {/* Lag Effects */}
          <section className="mt-4">
            <Card className="p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Lag Effects</p>
                <div className="flex items-center gap-1">
                  {(["7", "30", "90", "all"] as ("7" | "30" | "90" | "all")[]).map((rk) => (
                    <button
                      key={rk}
                      type="button"
                      onClick={() => onChangePairsWindow(rk)}
                      className={
                        rk === pairsWindow
                          ? "inline-flex items-center rounded-xl border px-2.5 py-1 text-xs border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950 dark:text-blue-200"
                          : "inline-flex items-center rounded-xl border px-2.5 py-1 text-xs border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                      }
                    >
                      {rk === "all" ? "All" : `Last ${rk}`}
                    </button>
                  ))}
                </div>
                <div className="min-w-[120px] text-right">
                  {whoopBackfillLoading ? (
                    <span className="text-xs text-zinc-500">Optimizing data…</span>
                  ) : noHistoryAtAll ? (
                    <span className="text-xs text-zinc-500">No saved history yet.</span>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium">Score → Sleep Performance (Next Day)</div>
                    <CorrKPI value={lagCorr.score_sleep} />
                  </div>
                  <ScatterPlot
                    pairs={lagPairs.scoreToSleep}
                    xLabel="Yesterday Score"
                    yLabel="Sleep Performance (%)"
                    xFmt={(v) => `${Math.round(v)}`}
                    yFmt={(v) => `${Math.round(v)}`}
                    height={260}
                  />
                  <p className="mt-2 text-xs text-zinc-500">Pairs: {lagPairs.scoreToSleep.length}</p>
                </div>

                {/* Removed Oz-based charts per request */}

                <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium">Score → Recovery (Next Day)</div>
                    <CorrKPI value={lagCorr.score_recovery} />
                  </div>
                  <ScatterPlot
                    pairs={lagPairs.scoreToRecovery}
                    xLabel="Yesterday Score"
                    yLabel="Recovery (%)"
                    xFmt={(v) => `${Math.round(v)}`}
                    yFmt={(v) => `${Math.round(v)}`}
                    height={260}
                  />
                  <p className="mt-2 text-xs text-zinc-500">Pairs: {lagPairs.scoreToRecovery.length}</p>
                </div>
              </div>

              <p className="mt-3 text-xs text-zinc-500">
                Correlation is a directional signal check—not proof of causation.
              </p>
            </Card>
          </section>

          <section className="mt-4">
            <Card className="p-4">
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Key Takeaways</p>
              <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">{lagSummary}</p>
            </Card>
          </section>

        </>
      )}
    </div>
	);
}
