"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "../../components/ui/Card";
import RadialGauge from "../../components/charts/RadialGauge";
import CalendarHeatmap from "../../components/charts/CalendarHeatmap";
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

function Segmented({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { key: string; label: string }[];
}) {
  return (
    <div className="inline-flex rounded-xl border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900">
      {options.map((o) => {
        const active = value === o.key;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            className={
              active
                ? "rounded-lg px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-200"
                : "rounded-lg px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
            }
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function axisTicks(n: number) {
  if (n <= 0) return [0];
  return [0, 0.5, 1].map((p) => Math.round(n * p));
}

function ScatterPlot({
  pairs,
  xLabel,
  yLabel,
  xFmt,
  yFmt,
}: {
  pairs: Pair[];
  xLabel: string;
  yLabel: string;
  xFmt?: (v: number) => string;
  yFmt?: (v: number) => string;
}) {
  const w = 360;
  const h = 190;
  const pad = 18;
  const leftPad = 44;
  const bottomPad = 34;

  if (!pairs.length) {
    return (
      <div className="mt-3 rounded-2xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
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

  // Simple least-squares trend line
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

  const xTicks = axisTicks(3).map((i) => {
    if (i === 0) return minX;
    if (i === 1) return (minX + maxX) / 2;
    return maxX;
  });
  const yTicks = axisTicks(3).map((i) => {
    if (i === 0) return minY;
    if (i === 1) return (minY + maxY) / 2;
    return maxY;
  });

  return (
    <div className="mt-3">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
        {/* axes */}
        <line x1={leftPad} y1={h - bottomPad} x2={w - pad} y2={h - bottomPad} stroke="#e5e7eb" />
        <line x1={leftPad} y1={pad} x2={leftPad} y2={h - bottomPad} stroke="#e5e7eb" />

        {/* y ticks */}
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

        {/* x ticks */}
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

        {/* trend line */}
        <path
          d={`M ${sx(minX)} ${sy(yAtMin)} L ${sx(maxX)} ${sy(yAtMax)}`}
          fill="none"
          stroke="#94a3b8"
          strokeWidth="2"
        />

        {/* points */}
        {pairs.map((p, i) => (
          <g key={i}>
            <circle cx={sx(p.x)} cy={sy(p.y)} r="4" fill="#2563eb" opacity="0.85" />
          </g>
        ))}

        {/* axis labels */}
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

function LineChart({
  points,
  yLabel,
}: {
  points: { day: string; value: number }[];
  yLabel: string;
}) {
  const w = 360;
  const h = 170;
  const pad = 16;
  const leftPad = 44;
  const bottomPad = 26;

  if (!points.length) return <div className="h-44" />;

  const ys = points.map((p) => p.value);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const sx = (i: number) =>
    leftPad +
    (i / Math.max(1, points.length - 1)) * (w - leftPad - pad);
  const sy = (v: number) =>
    pad + (1 - (v - minY) / Math.max(1e-9, maxY - minY)) * (h - pad - bottomPad);

  const path = points
    .map((p, i) => `${i ? "L" : "M"} ${sx(i)} ${sy(p.value)}`)
    .join(" ");

  const yTicks = [minY, (minY + maxY) / 2, maxY];

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
                {Math.round(v)}
              </text>
            </g>
          );
        })}

        {/* x labels (sparse) */}
        {points.map((p, i) => {
          if (points.length > 14 && i % Math.ceil(points.length / 6) !== 0 && i !== points.length - 1)
            return null;
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

        <path d={path} fill="none" stroke="#2563eb" strokeWidth="2.5" />
      </svg>

      <div className="mt-2 text-xs text-zinc-500">{yLabel}</div>
    </div>
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

export default function InsightsPage() {
  const router = useRouter();

  const today = useMemo(() => formatNYDate(new Date()), []);

  // ✅ No useSearchParams() (avoids /_not-found Suspense build failures)
  const [selectedDate, setSelectedDate] = useState<string>(today);

  // Sync selectedDate from URL on mount + browser nav
  useEffect(() => {
    const sync = () => {
      const iso = readSelectedDateFromLocation(today);
      setSelectedDate(isISODate(iso) ? iso : today);
    };
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [today]);

  const isToday = selectedDate === today;

  const [points, setPoints] = useState<DayPoint[]>([]);
  const [tab, setTab] = useState<"today" | "history">("today");

  const [whoopSelected, setWhoopSelected] = useState<{
    sleepHours: number | null;
    recovery: number | null;
  } | null>(null);

  // History data (server snapshots)
  const [historyRows, setHistoryRows] = useState<HistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // History UI controls
  const [range, setRange] = useState<"7" | "30" | "60" | "180" | "all">("30");

  // Fetch WHOOP sleep/recovery for selected day
  useEffect(() => {
    (async () => {
      try {
        const cached = getWhoopMetrics(selectedDate);
        if (cached)
          setWhoopSelected({
            sleepHours: cached.sleep_hours,
            recovery: cached.recovery_score,
          });

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

  // Load local-derived points (used for History heatmap + quick insights charts)
  useEffect(() => {
    const prof = getProfile();
    const weight = prof?.weight_kg ?? 0;
    const dates = lastNDatesNY(14);

    const out: DayPoint[] = dates.map((date) => {
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

  // Fetch history snapshots when switching to History (cache after first load)
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

  // Breakdown of selected day's target: base + workouts + creatine (+ WHOOP modifiers)
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

    // WHOOP modifiers (bounded, transparent)
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

  // Quick insight cards (Selected day)
  const quick = useMemo(() => {
    const messages: { title: string; body: string }[] = [];

    const deficit = Math.max(0, selectedTotals.target - selectedTotals.actual);
    if (selectedTotals.target > 0) {
      if (deficit > 0)
        messages.push({
          title: "Hydration pacing",
          body: `You're ~${Math.round(deficit / 29.5735)} oz behind target.`,
        });
      else messages.push({ title: "Hydration pacing", body: "You're on pace or ahead of target." });
    }

    if (whoopSelected?.sleepHours != null || whoopSelected?.recovery != null) {
      const parts: string[] = [];
      if (whoopSelected.sleepHours != null) parts.push(`sleep ${whoopSelected.sleepHours.toFixed(1)} h`);
      if (whoopSelected.recovery != null) parts.push(`recovery ${Math.round(whoopSelected.recovery)}%`);
      messages.push({
        title: "WHOOP synergy",
        body: `Target accounts for ${parts.join(", ")} for this day.`,
      });
    }

    try {
      const d = new Date(selectedDate + "T12:00:00.000Z");
      const dates7: string[] = [];
      for (let i = 6; i >= 0; i--) {
        const dd = new Date(d);
        dd.setUTCDate(d.getUTCDate() - i);
        dates7.push(dd.toISOString().slice(0, 10));
      }

      let morning = 0,
        afternoon = 0,
        evening = 0;

      dates7.forEach((day) => {
        const ints = getIntakesByDateNY(day);
        ints.forEach((i) => {
          const hr = new Date(i.timestamp).getHours();
          if (hr < 12) morning += i.volume_ml;
          else if (hr < 18) afternoon += i.volume_ml;
          else evening += i.volume_ml;
        });
      });

      const total = morning + afternoon + evening;
      if (total > 0) {
        const top = Math.max(morning, afternoon, evening);
        const bucket = top === morning ? "mornings" : top === afternoon ? "afternoons" : "evenings";
        messages.push({
          title: "Behavior pattern (7d)",
          body: `Most intake happens in the ${bucket} (last 7 days).`,
        });
      }
    } catch {}

    return messages.slice(0, 5);
  }, [selectedTotals, whoopSelected, selectedDate]);

  // ---- HISTORY ADVANCED INSIGHTS ----

  const historySorted = useMemo(() => {
    const rows = [...historyRows].filter((r) => isISODate(r.day));
    rows.sort((a, b) => a.day.localeCompare(b.day));
    return rows;
  }, [historyRows]);

  const historyFiltered = useMemo(() => {
    if (!historySorted.length) return [];
    if (range === "all") return historySorted;
    const n = Number(range);
    if (!Number.isFinite(n) || n <= 0) return historySorted;

    // take last n rows
    return historySorted.slice(Math.max(0, historySorted.length - n));
  }, [historySorted, range]);

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
          scoreToSleep.push({
            x: Number(yRow.hydration_score),
            y: Number(todayRow.sleep_hours),
            dayToday,
            dayYesterday,
          });
        if (Number.isFinite(yRow.total_oz))
          ozToSleep.push({
            x: Number(yRow.total_oz),
            y: Number(todayRow.sleep_hours),
            dayToday,
            dayYesterday,
          });
      }

      if (todayRow.recovery_pct != null) {
        if (Number.isFinite(yRow.hydration_score))
          scoreToRecovery.push({
            x: Number(yRow.hydration_score),
            y: Number(todayRow.recovery_pct),
            dayToday,
            dayYesterday,
          });
        if (Number.isFinite(yRow.total_oz))
          ozToRecovery.push({
            x: Number(yRow.total_oz),
            y: Number(todayRow.recovery_pct),
            dayToday,
            dayYesterday,
          });
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

  const sameDayCorr = useMemo(() => {
    if (!historySorted.length) return { sleep: null as number | null, recovery: null as number | null };

    const sleepPairs = historySorted
      .filter((r) => r.sleep_hours != null)
      .map((r) => ({ x: r.hydration_score, y: r.sleep_hours as number }));

    const recPairs = historySorted
      .filter((r) => r.recovery_pct != null)
      .map((r) => ({ x: r.hydration_score, y: r.recovery_pct as number }));

    return {
      sleep: pearsonCorrelation(sleepPairs.map((p) => p.x), sleepPairs.map((p) => p.y)),
      recovery: pearsonCorrelation(recPairs.map((p) => p.x), recPairs.map((p) => p.y)),
    };
  }, [historySorted]);

  // “What predicts a good next day?” comparison buckets
  const nextDayComparison = useMemo(() => {
    if (!historySorted.length) return null;

    const map = new Map<string, HistoryRow>();
    for (const r of historySorted) map.set(r.day, r);

    const beforeHigh: number[] = [];
    const beforeLow: number[] = [];
    const beforeHighOz: number[] = [];
    const beforeLowOz: number[] = [];

    for (const row of historySorted) {
      // Use recovery as "next day outcome"
      const rec = row.recovery_pct;
      if (rec == null) continue;

      const y = map.get(addDaysISO(row.day, -1));
      if (!y) continue;

      if (rec >= 66) {
        beforeHigh.push(y.hydration_score);
        beforeHighOz.push(y.total_oz);
      } else if (rec < 33) {
        beforeLow.push(y.hydration_score);
        beforeLowOz.push(y.total_oz);
      }
    }

    const hi = mean(beforeHigh);
    const lo = mean(beforeLow);
    const hiOz = mean(beforeHighOz);
    const loOz = mean(beforeLowOz);

    return {
      hiCount: beforeHigh.length,
      loCount: beforeLow.length,
      avgScoreBeforeHigh: hi,
      avgScoreBeforeLow: lo,
      avgOzBeforeHigh: hiOz,
      avgOzBeforeLow: loOz,
    };
  }, [historySorted]);

  // Consistency / streaks
  const consistency = useMemo(() => {
    if (!historySorted.length) return null;

    const rows = historySorted;

    // Streak of "hydration_score >= 75"
    const THRESH = 75;
    let streak = 0;
    for (let i = rows.length - 1; i >= 0; i--) {
      const s = Number(rows[i].hydration_score);
      if (Number.isFinite(s) && s >= THRESH) streak++;
      else break;
    }

    const last7 = rows.slice(Math.max(0, rows.length - 7));
    const last30 = rows.slice(Math.max(0, rows.length - 30));

    const pctAbove = (arr: HistoryRow[], t: number) => {
      if (!arr.length) return null;
      const ok = arr.filter((r) => Number(r.hydration_score) >= t).length;
      return ok / arr.length;
    };

    return {
      streakScore75: streak,
      last7Pct: pctAbove(last7, THRESH),
      last30Pct: pctAbove(last30, THRESH),
      threshold: THRESH,
    };
  }, [historySorted]);

  const lineSeries = useMemo(() => {
    const rows = historyFiltered;
    return rows
      .filter((r) => Number.isFinite(r.hydration_score))
      .map((r) => ({ day: r.day, value: Number(r.hydration_score) }));
  }, [historyFiltered]);

  return (
    <div className="px-4 pb-4 pt-[calc(72px+env(safe-area-inset-top))]">
      {/* Date toggle belongs ONLY in the TopBar now — removed DateSwitcher from page */}

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

          <section className="mt-4">
            <Card className="p-4">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {isToday ? "Today" : "Selected day"}: Cumulative intake vs linear target (oz)
              </p>
              <TodayChart date={selectedDate} targetMl={selectedTotals.target} />
            </Card>
          </section>

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
          {/* Controls + top summary */}
          <section className="mt-4">
            <Card className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    Advanced history insights
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Uses saved daily history + WHOOP metrics (where available).
                  </p>
                </div>

                <Segmented
                  value={range}
                  onChange={(v) => setRange(v as any)}
                  options={[
                    { key: "7", label: "7D" },
                    { key: "30", label: "30D" },
                    { key: "60", label: "60D" },
                    { key: "180", label: "180D" },
                    { key: "all", label: "All" },
                  ]}
                />
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                {sameDayCorr.sleep == null ? null : (
                  <div className="flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400">
                    <span>Same-day: Score vs Sleep</span>
                    <DeltaPill value={sameDayCorr.sleep} />
                  </div>
                )}
                {sameDayCorr.recovery == null ? null : (
                  <div className="flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400">
                    <span>Same-day: Score vs Recovery</span>
                    <DeltaPill value={sameDayCorr.recovery} />
                  </div>
                )}
                {historyRows.length === 0 && !historyLoading ? (
                  <span className="text-xs text-zinc-500">No history saved yet.</span>
                ) : null}
              </div>

              {historyLoading ? <p className="mt-3 text-sm text-zinc-500">Loading history…</p> : null}
            </Card>
          </section>

          {/* Hydration score over time */}
          <section className="mt-4">
            <Card className="p-4">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Hydration Score over time</p>
              <LineChart points={lineSeries} yLabel="Hydration score" />
            </Card>
          </section>

          {/* Lag correlations: yesterday hydration -> today WHOOP */}
          <section className="mt-4">
            <Card className="p-4">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Lag effects (yesterday hydration → today WHOOP)
              </p>

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-zinc-200 p-3 dark:border-zinc-800">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">Yesterday score → Today sleep</div>
                    {lagCorr.score_sleep == null ? null : <DeltaPill value={lagCorr.score_sleep} />}
                  </div>
                  <ScatterPlot
                    pairs={lagPairs.scoreToSleep}
                    xLabel="Yesterday hydration score"
                    yLabel="Today sleep (h)"
                    xFmt={(v) => `${Math.round(v)}`}
                    yFmt={(v) => `${v.toFixed(1)}`}
                  />
                  <p className="mt-2 text-xs text-zinc-500">
                    Pairs: {lagPairs.scoreToSleep.length} (needs yesterday + today sleep).
                  </p>
                </div>

                <div className="rounded-2xl border border-zinc-200 p-3 dark:border-zinc-800">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">Yesterday oz → Today recovery</div>
                    {lagCorr.oz_recovery == null ? null : <DeltaPill value={lagCorr.oz_recovery} />}
                  </div>
                  <ScatterPlot
                    pairs={lagPairs.ozToRecovery}
                    xLabel="Yesterday total oz"
                    yLabel="Today recovery (%)"
                    xFmt={(v) => `${Math.round(v)}`}
                    yFmt={(v) => `${Math.round(v)}`}
                  />
                  <p className="mt-2 text-xs text-zinc-500">
                    Pairs: {lagPairs.ozToRecovery.length} (needs yesterday + today recovery).
                  </p>
                </div>

                <div className="rounded-2xl border border-zinc-200 p-3 dark:border-zinc-800">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">Yesterday oz → Today sleep</div>
                    {lagCorr.oz_sleep == null ? null : <DeltaPill value={lagCorr.oz_sleep} />}
                  </div>
                  <ScatterPlot
                    pairs={lagPairs.ozToSleep}
                    xLabel="Yesterday total oz"
                    yLabel="Today sleep (h)"
                    xFmt={(v) => `${Math.round(v)}`}
                    yFmt={(v) => `${v.toFixed(1)}`}
                  />
                  <p className="mt-2 text-xs text-zinc-500">Pairs: {lagPairs.ozToSleep.length}</p>
                </div>

                <div className="rounded-2xl border border-zinc-200 p-3 dark:border-zinc-800">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">Yesterday score → Today recovery</div>
                    {lagCorr.score_recovery == null ? null : (
                      <DeltaPill value={lagCorr.score_recovery} />
                    )}
                  </div>
                  <ScatterPlot
                    pairs={lagPairs.scoreToRecovery}
                    xLabel="Yesterday hydration score"
                    yLabel="Today recovery (%)"
                    xFmt={(v) => `${Math.round(v)}`}
                    yFmt={(v) => `${Math.round(v)}`}
                  />
                  <p className="mt-2 text-xs text-zinc-500">Pairs: {lagPairs.scoreToRecovery.length}</p>
                </div>
              </div>

              <p className="mt-3 text-xs text-zinc-500">
                Note: correlation isn’t causation—this is a directional “signal check.”
              </p>
            </Card>
          </section>

          {/* “Predict a good next day” */}
          <section className="mt-4">
            <Card className="p-4">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">What predicts a good next day?</p>

              {!nextDayComparison ? (
                <div className="mt-3 rounded-2xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
                  Not enough recovery data yet.
                </div>
              ) : (
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-zinc-200 p-3 dark:border-zinc-800">
                    <p className="text-sm font-medium">Avg hydration score (previous day)</p>
                    <div className="mt-2 space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
                      <div className="flex items-center justify-between">
                        <span>Before high recovery (≥66%)</span>
                        <span className="tabular-nums">
                          {nextDayComparison.avgScoreBeforeHigh == null
                            ? "—"
                            : Math.round(nextDayComparison.avgScoreBeforeHigh)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Before low recovery (&lt;33%)</span>
                        <span className="tabular-nums">
                          {nextDayComparison.avgScoreBeforeLow == null
                            ? "—"
                            : Math.round(nextDayComparison.avgScoreBeforeLow)}
                        </span>
                      </div>
                      <div className="pt-1 text-xs text-zinc-500">
                        Samples: {nextDayComparison.hiCount} high / {nextDayComparison.loCount} low
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-zinc-200 p-3 dark:border-zinc-800">
                    <p className="text-sm font-medium">Avg total oz (previous day)</p>
                    <div className="mt-2 space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
                      <div className="flex items-center justify-between">
                        <span>Before high recovery (≥66%)</span>
                        <span className="tabular-nums">
                          {nextDayComparison.avgOzBeforeHigh == null
                            ? "—"
                            : Math.round(nextDayComparison.avgOzBeforeHigh)}{" "}
                          oz
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Before low recovery (&lt;33%)</span>
                        <span className="tabular-nums">
                          {nextDayComparison.avgOzBeforeLow == null
                            ? "—"
                            : Math.round(nextDayComparison.avgOzBeforeLow)}{" "}
                          oz
                        </span>
                      </div>
                      <div className="pt-1 text-xs text-zinc-500">
                        Uses the same samples as above.
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </section>

          {/* Consistency */}
          <section className="mt-4">
            <Card className="p-4">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Consistency</p>

              {!consistency ? (
                <div className="mt-3 rounded-2xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
                  Not enough history yet.
                </div>
              ) : (
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-zinc-200 p-3 dark:border-zinc-800">
                    <p className="text-xs text-zinc-500">Current streak</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums">
                      {consistency.streakScore75}
                    </p>
                    <p className="text-xs text-zinc-500">
                      Days in a row with score ≥ {consistency.threshold}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-zinc-200 p-3 dark:border-zinc-800">
                    <p className="text-xs text-zinc-500">Last 7 days</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums">
                      {consistency.last7Pct == null ? "—" : Math.round(consistency.last7Pct * 100)}%
                    </p>
                    <p className="text-xs text-zinc-500">
                      Days with score ≥ {consistency.threshold}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-zinc-200 p-3 dark:border-zinc-800">
                    <p className="text-xs text-zinc-500">Last 30 days</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums">
                      {consistency.last30Pct == null ? "—" : Math.round(consistency.last30Pct * 100)}%
                    </p>
                    <p className="text-xs text-zinc-500">
                      Days with score ≥ {consistency.threshold}
                    </p>
                  </div>
                </div>
              )}
            </Card>
          </section>

          {/* Heatmap (local, 14d) */}
          <section className="mt-4">
            <Card className="p-4">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Hydration Score (last 14 days)</p>
              <div className="mt-3">
                <CalendarHeatmap cells={points.map((p) => ({ date: p.date, value: p.score }))} />
              </div>
            </Card>
          </section>

          {/* Saved history list */}
          <section className="mt-4">
            <Card className="p-4">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Saved history</p>

              {!historyLoading && historyRows.length === 0 ? (
                <div className="mt-3 rounded-2xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
                  No saved days yet. Open the app daily (or refresh Home/Insights) to build history.
                </div>
              ) : null}

              {historyRows.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {historyFiltered
                    .slice()
                    .reverse()
                    .map((r) => {
                      const driversOz =
                        (r.workouts_oz ?? 0) +
                        (r.creatine_oz ?? 0) +
                        (r.supplements_oz ?? 0) +
                        (r.sleep_oz ?? 0) +
                        (r.recovery_oz ?? 0);

                      return (
                        <div
                          key={r.day}
                          className="grid grid-cols-5 gap-2 rounded-lg border px-3 py-2 text-sm dark:border-zinc-800"
                        >
                          <div>{r.day}</div>
                          <div className="font-medium tabular-nums">{r.hydration_score}</div>
                          <div className="tabular-nums">{Math.round(r.total_oz)} oz</div>
                          <div className="tabular-nums text-zinc-500">
                            {r.sleep_hours == null ? "—" : `${r.sleep_hours.toFixed(1)} h sleep`}
                          </div>
                          <div className="tabular-nums text-zinc-500">
                            {r.recovery_pct == null ? "—" : `${Math.round(r.recovery_pct)}% rec`} •{" "}
                            {Math.round(driversOz)} oz drivers
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : null}
            </Card>
          </section>
        </>
      )}
    </div>
  );
}

function TodayChart({ date, targetMl }: { date: string; targetMl: number }) {
  if (!date) return <div className="h-40" />;

  const w = 320,
    h = 140;
  const leftPad = 38,
    pad = 16;
  const startHr = 6,
    endHr = 21;

  const ints = getIntakesByDateNY(date).sort(
    (a, b) => +new Date(a.timestamp) - +new Date(b.timestamp)
  );

  const cumulative: { t: number; ml: number }[] = [];
  let sum = 0;

  const queue = [...ints];

  for (let hr = startHr; hr <= endHr; hr++) {
    while (queue.length && new Date(queue[0].timestamp).getHours() <= hr) {
      sum += queue.shift()!.volume_ml;
    }
    cumulative.push({ t: hr, ml: sum });
  }

  const maxY = Math.max(1, targetMl || 0, ...cumulative.map((c) => c.ml));
  const scaleX = (t: number) =>
    leftPad + ((t - startHr) / Math.max(1, endHr - startHr)) * (w - leftPad - pad);
  const scaleY = (v: number) => h - pad - (v / maxY) * (h - pad * 2);

  const line = (vals: { t: number; ml: number }[]) =>
    vals
      .map((p, i) => `${i ? "L" : "M"} ${scaleX(p.t)} ${scaleY(p.ml)}`)
      .join(" ");

  const targetLine = (tgt: number) =>
    line(
      cumulative.map((c, i) => ({
        t: c.t,
        ml: (tgt / Math.max(1, cumulative.length - 1)) * i,
      }))
    );

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-3 h-44 w-full">
      <line x1={leftPad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="#e5e7eb" />
      <line x1={leftPad} y1={pad} x2={leftPad} y2={h - pad} stroke="#e5e7eb" />

      {[0, 0.5, 1].map((p, i) => {
        const v = p * maxY;
        const y = scaleY(v);
        const oz = Math.round(v / 29.5735);
        return (
          <g key={i}>
            <line x1={leftPad - 4} y1={y} x2={w - pad} y2={y} stroke="#f1f5f9" />
            <text x={leftPad - 6} y={y + 3} textAnchor="end" fontSize="10" fill="#64748b">
              {oz}
            </text>
          </g>
        );
      })}

      {[6, 9, 12, 15, 18, 21].map((t) => (
        <g key={t}>
          <line x1={scaleX(t)} y1={h - pad} x2={scaleX(t)} y2={h - pad + 4} stroke="#cbd5e1" />
          <text x={scaleX(t)} y={h - 2} textAnchor="middle" fontSize="10" fill="#64748b">
            {t}
          </text>
        </g>
      ))}

      <path d={targetLine(targetMl || 0)} fill="none" stroke="#94a3b8" strokeWidth="2" />
      <path d={line(cumulative)} fill="none" stroke="#2563eb" strokeWidth="2" />
    </svg>
  );
}
