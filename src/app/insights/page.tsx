"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "../../components/ui/Card";
import RadialGauge from "../../components/charts/RadialGauge";
import CalendarHeatmap from "../../components/charts/CalendarHeatmap";
import Donut from "../../components/charts/Donut";
import { calculateHydrationScore, WORKOUT_ML_PER_MIN, BASE_ML_PER_KG } from "../../lib/hydration";
import { getProfile, formatNYDate, getIntakesByDateNY, getWorkoutsByDateNY, getSupplementsByDateNY, getWhoopMetrics, setWhoopMetrics } from "../../lib/localStore";

type DayPoint = { date: string; score: number; target: number; actual: number };

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

export default function InsightsPage() {
	const [points, setPoints] = useState<DayPoint[]>([]);
	// Only show "Today" view; keep state for future but default to 'today'
	const [mode, setMode] = useState<"today" | "history">("today");
	const today = formatNYDate(new Date());
	const [whoop, setWhoop] = useState<{ sleepHours: number | null; recovery: number | null } | null>(null);

	// Fetch WHOOP sleep/recovery for today if connected
	useEffect(() => {
		(async () => {
			try {
				const cached = getWhoopMetrics(today);
				if (cached) setWhoop({ sleepHours: cached.sleep_hours, recovery: cached.recovery_score });
				const res = await fetch(`/api/whoop/metrics?date=${today}`, { credentials: "include" });
				if (res.ok) {
					const j = await res.json();
					setWhoopMetrics(today, { sleep_hours: j.sleep_hours ?? null, recovery_score: j.recovery_score ?? null });
					setWhoop({ sleepHours: j.sleep_hours ?? null, recovery: j.recovery_score ?? null });
				}
			} catch {}
		})();
	}, [today]);

	// Compute contributor breakdowns (today and 7-day average)
	const contrib = useMemo(() => {
		const prof = getProfile();
		const weight = prof?.weight_kg ?? 0;
		if (weight <= 0) {
			return null;
		}
		function sleepPct(h: number | null) {
			if (h == null) return 0;
			if (h < 7.5) return Math.max(0, (7.5 - h)) * 0.03;
			if (h > 8.5) return -Math.max(0, (h - 8.5)) * 0.02;
			return 0;
		}
		function recPct(r: number | null) {
			if (r == null) return 0;
			if (r < 33) return 0.05;
			if (r < 66) return 0.02;
			return 0;
		}
		function forDate(d: string) {
			const workouts = getWorkoutsByDateNY(d);
			const supps = getSupplementsByDateNY(d);
			const base = Math.round(weight * BASE_ML_PER_KG);
			const workout = workouts.reduce((sum, w) => {
				const start = new Date(w.start_time);
				const end = w.end_time ? new Date(w.end_time) : start;
				const mins = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
				const strain = typeof w.intensity === "number" ? Math.max(0, Math.min(21, w.intensity)) : 5;
				const f = 0.5 + strain / 21;
				return sum + Math.round(mins * WORKOUT_ML_PER_MIN * f);
			}, 0);
			const creatine = supps
				.filter((s) => s.type === "creatine" && s.grams && s.grams > 0)
				.reduce((sum, s) => sum + (s.grams || 0) * 70, 0);
			const env = 0;
			const baseTarget = base + workout + creatine;
			const m = getWhoopMetrics(d);
			const sPct = sleepPct(m?.sleep_hours ?? null);
			const rPct = recPct(m?.recovery_score ?? null);
			const sleepAdd = Math.round(baseTarget * sPct);
			const recAdd = Math.round(baseTarget * rPct);
			const total = Math.round(baseTarget + sleepAdd + recAdd);
			return { base, workout, creatine, env, sleepAdd, recAdd, total };
		}
		const todayVals = forDate(today);
		const dates7 = lastNDatesNY(7);
		const avg = dates7.reduce(
			(acc, d) => {
				const v = forDate(d);
				acc.base += v.base;
				acc.workout += v.workout;
				acc.creatine += v.creatine;
				acc.env += v.env;
				acc.sleepAdd += v.sleepAdd;
				acc.recAdd += v.recAdd;
				acc.total += v.total;
				return acc;
			},
			{ base: 0, workout: 0, creatine: 0, env: 0, sleepAdd: 0, recAdd: 0, total: 0 }
		);
		const n = Math.max(1, dates7.length);
		const avgVals = {
			base: Math.round(avg.base / n),
			workout: Math.round(avg.workout / n),
			creatine: Math.round(avg.creatine / n),
			env: Math.round(avg.env / n),
			sleepAdd: Math.round(avg.sleepAdd / n),
			recAdd: Math.round(avg.recAdd / n),
			total: Math.round(avg.total / n),
		};
		return { today: todayVals, avg: avgVals };
	}, [today, points]);

	// Breakdown of today's target: base + workouts + creatine
	const todayBreakdown = useMemo(() => {
		const prof = getProfile();
		const weight = prof?.weight_kg ?? 0;
		if (weight <= 0) return null;
		const workouts = getWorkoutsByDateNY(today);
		const supplements = getSupplementsByDateNY(today);

		const base = Math.round(weight * BASE_ML_PER_KG);
		const workoutLines = workouts.map((w) => {
			const start = new Date(w.start_time);
			const end = w.end_time ? new Date(w.end_time) : start;
			const mins = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
			const strain = typeof w.intensity === "number" ? Math.max(0, Math.min(21, w.intensity)) : 5;
			const intensityFactor = 0.5 + strain / 21;
			const added = Math.round(mins * WORKOUT_ML_PER_MIN * intensityFactor);
			const label = `${formatType(w.type)} • ${mins} min`;
			return { label, added };
		});

		const creatineMl = supplements
			.filter((s) => s.type === "creatine" && s.grams && s.grams > 0)
			.reduce((sum, s) => sum + (s.grams || 0) * 70, 0);

		const lines: { label: string; added: number }[] = [{ label: "Base need", added: base }, ...workoutLines];
		if (creatineMl > 0) lines.push({ label: "Creatine", added: Math.round(creatineMl) });

		const baseTarget = lines.reduce((s, l) => s + l.added, 0);

		// WHOOP modifiers (bounded, transparent)
		let modPct = 0;
		if (whoop?.sleepHours != null) {
			const h = whoop.sleepHours;
			if (h < 7.5) modPct += Math.max(0, (7.5 - h)) * 0.03; // +3% per hour below 7.5
			else if (h > 8.5) modPct -= Math.max(0, (h - 8.5)) * 0.02; // -2% per hour above 8.5
			lines.push({ label: `Sleep (${h.toFixed(1)} h)`, added: Math.round(baseTarget * (modPct)) });
		}
		if (whoop?.recovery != null) {
			let rAdj = 0;
			const r = whoop.recovery;
			if (r < 33) rAdj = 0.05;
			else if (r < 66) rAdj = 0.02;
			// show this separately; do not double count with sleep
			lines.push({ label: `Recovery (${Math.round(r)}%)`, added: Math.round(baseTarget * rAdj) });
			modPct += rAdj;
		}

		const total = Math.round(baseTarget + baseTarget * modPct);
		return { lines, total };
	}, [today, whoop]);

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
					const intensity = typeof w.intensity === "number" ? w.intensity : 5;
					const intensityFactor = 0.5 + intensity / 10;
					return sum + mins * WORKOUT_ML_PER_MIN * intensityFactor;
				}, 0);
				target = Math.round(weight * 35 + workoutAdj);
			}
			const score =
				target > 0
					? calculateHydrationScore({
							targetMl: target,
							actualMl: actual,
							intakes: intakes.map((i) => ({ timestamp: new Date(i.timestamp), volumeMl: i.volume_ml })),
							workouts: [],
					  })
					: 0;
			return { date, actual, target, score };
		});
		setPoints(out.reverse());
	}, []);

	const quick = useMemo(() => {
		if (points.length === 0) return [];
		const messages: { title: string; body: string }[] = [];

		// 1) Hydration pacing (today)
		const last = points[points.length - 1];
		const tgt = todayBreakdown?.total ?? last.target;
		const deficit = tgt > 0 ? tgt - last.actual : 0;
		if (deficit > 0) messages.push({ title: "Hydration pacing", body: `You're ~${Math.round(deficit / 29.5735)} oz behind target today.` });
		else messages.push({ title: "Hydration pacing", body: "You're on pace or ahead of today's target." });

		// 2) Time-of-day habit (7d)
		const last7 = points.slice(-7);
		let morning = 0, afternoon = 0, evening = 0;
		last7.forEach((p) => {
			const ints = getIntakesByDateNY(p.date);
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
			messages.push({ title: "Behavior pattern (7d)", body: `Most intake happens in the ${bucket}. Try front-loading on workout days.` });
		}

		// 3) WHOOP synergy
		if (whoop?.sleepHours != null || whoop?.recovery != null) {
			const parts: string[] = [];
			if (whoop.sleepHours != null) parts.push(`sleep ${whoop.sleepHours.toFixed(1)} h`);
			if (whoop.recovery != null) parts.push(`recovery ${Math.round(whoop.recovery)}%`);
			messages.push({ title: "WHOOP synergy", body: `Target accounts for ${parts.join(", ")} today.` });
		}

		return messages.slice(0, 5);
	}, [points, todayBreakdown, whoop]);

	return (
		<div className="p-4">
			<h1 className="text-xl font-semibold">Insights</h1>
			{(() => {
				// Correlation pills: Sleep and Recovery
				if (!points.length) return null;
				const dates = points.map((p) => p.date);
				const scores = points.map((p) => p.score);
				function compute(metric: (m: ReturnType<typeof getWhoopMetrics>) => number | null) {
					const xs: number[] = [];
					const ys: number[] = [];
					for (let i = 0; i < dates.length; i++) {
						const m = getWhoopMetrics(dates[i]);
						const y = metric(m);
						if (m && typeof y === "number") {
							xs.push(scores[i]); ys.push(y);
						}
					}
					const n = xs.length;
					if (n < 3) return null;
					const ax = xs.reduce((s, v) => s + v, 0) / n;
					const bx = ys.reduce((s, v) => s + v, 0) / n;
					let num = 0, da = 0, db = 0;
					for (let i = 0; i < n; i++) { const av = xs[i] - ax, bv = ys[i] - bx; num += av * bv; da += av * av; db += bv * bv; }
					const den = Math.sqrt(da * db) || 0; if (!den) return null;
					return Math.max(-1, Math.min(1, num / den));
				}
				const rSleep = compute(m => m?.sleep_hours ?? null);
				const rRec = compute(m => m?.recovery_score ?? null);
				return (
					<div className="mt-2 flex items-center gap-3">
						{rSleep == null ? null : (
							<div className="flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400">
								<span>Score vs Sleep</span>
								<DeltaPill value={rSleep} />
							</div>
						)}
						{rRec == null ? null : (
							<div className="flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400">
								<span>Score vs Recovery</span>
								<DeltaPill value={rRec} />
							</div>
						)}
					</div>
				);
			})()}

			{/* Only keep a single Today tab for clarity */}
			<div className="mt-3">
				<span className="inline-flex items-center rounded-xl border px-3 py-2 text-sm border-blue-600 bg-blue-50 text-blue-700">
					Today
				</span>
			</div>

			{/* Today gauge */}
			<section className="mt-4">
				<Card className="p-4 flex items-center gap-4">
					<div className="w-[160px] shrink-0">
						<RadialGauge
							value={(() => {
								const actual = points.length ? (points[points.length - 1].actual || 0) : 0;
								const tgt = todayBreakdown?.total ?? (points.length ? (points[points.length - 1].target || 0) : 0);
								return Math.min(1, actual / Math.max(1, tgt));
							})()}
							label="Today"
						/>
					</div>
					<div className="text-sm text-zinc-600 dark:text-zinc-400">
						<p>
							Target:{" "}
							<strong>
								{(() => {
									const tgt = todayBreakdown?.total ?? (points.length ? (points[points.length - 1].target || 0) : 0);
									return Math.round(tgt / 29.5735);
								})()} oz
							</strong>
						</p>
						<p>
							Actual:{" "}
							<strong>
								{points.length ? Math.round((points[points.length - 1].actual || 0) / 29.5735) : 0} oz
							</strong>
						</p>
					</div>
				</Card>
			</section>

			{/* Target drivers for Today */}
			{mode === "today" && todayBreakdown ? (
				<section className="mt-4">
					<Card className="p-4">
						<p className="mb-2 text-sm text-zinc-600 dark:text-zinc-400">Today's target drivers</p>
						<ul className="space-y-1 text-sm">
							{todayBreakdown.lines.map((l, i) => (
								<li key={i} className="flex items-center justify-between">
									<span>{l.label}</span>
									<span className="tabular-nums">{Math.round(l.added / 29.5735)} oz</span>
								</li>
							))}
						</ul>
						<div className="mt-2 flex items-center justify-between border-t pt-2 text-sm">
							<span className="font-medium">Total target</span>
							<span className="tabular-nums font-medium">{Math.round(todayBreakdown.total / 29.5735)} oz</span>
						</div>
					</Card>
				</section>
			) : null}
			{mode === "history" ? (
			<section className="mt-4">
				<Card className="p-4">
					<p className="text-sm text-zinc-600 dark:text-zinc-400">Hydration Score (last 14 days)</p>
					<div className="mt-3">
						<CalendarHeatmap cells={points.map((p) => ({ date: p.date, value: p.score }))} />
					</div>
				</Card>
			</section>
			) : null}

			{mode === "history" ? (
			<section className="mt-4">
				<Card className="p-4">
					<p className="text-sm text-zinc-600 dark:text-zinc-400">Intake vs Target (oz)</p>
					<LineChart points={points} />
				</Card>
			</section>
			) : (
				<section className="mt-4">
					<Card className="p-4">
						<p className="text-sm text-zinc-600 dark:text-zinc-400">Today: Cumulative intake vs linear target (oz)</p>
						<TodayChart todayPoint={points.find((p) => p.date === formatNYDate(new Date())) || null} />
					</Card>
				</section>
			)}

			{/* Removed Contributors card to reduce redundancy with "Today's target drivers" */}

			{/* Time-of-day stacked bars (7d) */}
			<section className="mt-4">
				<Card className="p-4">
					<p className="text-sm text-zinc-600 dark:text-zinc-400">Intake by time of day (last 7 days)</p>
					<StackedBars points={points.slice(-7)} />
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
		</div>
	);
}

function LineChart({ points }: { points: DayPoint[] }) {
	if (!points.length) return <div className="h-40" />;
	const w = 320;
	const h = 120;
	const pad = 16;
	const xs = points.map((_, i) => i);
	const maxY = Math.max(1, ...points.map((p) => Math.max(p.actual, p.target)));
	const minY = Math.min(0, ...points.map((p) => Math.min(p.actual, p.target)));
	const scaleX = (i: number) => pad + (i / Math.max(1, points.length - 1)) * (w - pad * 2);
	const scaleY = (v: number) => {
		const range = maxY - minY || 1;
		return h - pad - ((v - minY) / range) * (h - pad * 2);
	};
	const path = (vals: number[]) =>
		vals
			.map((v, i) => `${i === 0 ? "M" : "L"} ${scaleX(i).toFixed(2)} ${scaleY(v).toFixed(2)}`)
			.join(" ");

	const actualPath = path(points.map((p) => p.actual / 29.5735));
	const targetPath = path(points.map((p) => p.target / 29.5735));

	return (
		<svg viewBox={`0 0 ${w} ${h}`} className="mt-3 h-40 w-full">
			<path d={targetPath} fill="none" stroke="#94a3b8" strokeWidth="2" />
			<path d={actualPath} fill="none" stroke="#2563eb" strokeWidth="2" />
		</svg>
	);
}

function getIntakeDistribution(points: DayPoint[]) {
	const labels = ["Morning", "Afternoon", "Evening"];
	let m = 0,
		a = 0,
		e = 0;
	// Approximate from daily totals by ratio using morning-intake computation used in quick tips
	points.forEach((p) => {
		const ints = getIntakesByDateNY(p.date);
		ints.forEach((i) => {
			const hr = new Date(i.timestamp).getHours();
			if (hr < 12) m += i.volume_ml;
			else if (hr < 18) a += i.volume_ml;
			else e += i.volume_ml;
		});
	});
	return [
		{ label: labels[0], value: m },
		{ label: labels[1], value: a },
		{ label: labels[2], value: e },
	];
}

function StackedBars({ points }: { points: DayPoint[] }) {
	const days = points;
	if (!days.length) return <div className="h-32" />;

	const rows = days.map((p) => {
		let m = 0, a = 0, e = 0;
		const ints = getIntakesByDateNY(p.date);
		ints.forEach((i) => {
			const hr = new Date(i.timestamp).getHours();
			if (hr < 12) m += i.volume_ml;
			else if (hr < 18) a += i.volume_ml;
			else e += i.volume_ml;
		});
		const total = m + a + e || 1;
		return { date: p.date.slice(5), m: m / total, a: a / total, e: e / total };
	});

	const w = 340, h = 160, pad = 16, axisH = 18, leftPad = 38;
	const barAreaH = h - pad * 2 - axisH;
	const barW = (w - leftPad - pad) / Math.max(1, rows.length);

	return (
		<div className="mt-3">
			<svg viewBox={`0 0 ${w} ${h}`} className="h-40 w-full">
				{/* Axes */}
				<line x1={leftPad} y1={h - pad - axisH} x2={w - pad} y2={h - pad - axisH} stroke="#e5e7eb" />
				<line x1={leftPad} y1={pad} x2={leftPad} y2={h - pad - axisH} stroke="#e5e7eb" />
				{/* Y ticks 0/50/100% */}
				{[0, 0.5, 1].map((p, i) => {
					const y = pad + (1 - p) * barAreaH;
					const label = Math.round(p * 100);
					return (
						<g key={i}>
							<line x1={leftPad - 4} y1={y} x2={w - pad} y2={y} stroke="#f1f5f9" />
							<text x={leftPad - 6} y={y + 3} textAnchor="end" fontSize="10" fill="#64748b">
								{label}%
							</text>
						</g>
					);
				})}
				{rows.map((r, i) => {
					const x = leftPad + i * barW;
					const mH = r.m * barAreaH;
					const aH = r.a * barAreaH;
					const eH = r.e * barAreaH;
					let y = h - pad - axisH;
					const cx = x + (barW - 4) / 2;
					return (
						<g key={i}>
							{/* Morning */}
							<rect x={x + 2} y={(y -= mH)} width={barW - 4} height={mH} fill="#60a5fa" rx="2" />
							{mH >= 14 && (
								<text x={cx} y={y + mH / 2 + 4} textAnchor="middle" fontSize="9" fill="#0b1324">
									{Math.round(r.m * 100)}%
								</text>
							)}
							{/* Afternoon */}
							<rect x={x + 2} y={(y -= aH)} width={barW - 4} height={aH} fill="#34d399" rx="2" />
							{aH >= 14 && (
								<text x={cx} y={y + aH / 2 + 4} textAnchor="middle" fontSize="9" fill="#0b1324">
									{Math.round(r.a * 100)}%
								</text>
							)}
							{/* Evening */}
							<rect x={x + 2} y={(y -= eH)} width={barW - 4} height={eH} fill="#fbbf24" rx="2" />
							{eH >= 14 && (
								<text x={cx} y={y + eH / 2 + 4} textAnchor="middle" fontSize="9" fill="#0b1324">
									{Math.round(r.e * 100)}%
								</text>
							)}

							{/* X-axis label (MM-DD) */}
							<text x={cx} y={h - pad + 12 - axisH} textAnchor="middle" fontSize="10" fill="#6b7280">
								{r.date}
							</text>
						</g>
					);
				})}
				{/* Axis label */}
				<text x={leftPad - 14} y={12} textAnchor="end" fontSize="10" fill="#64748b">%</text>
			</svg>
			{/* Legend */}
			<div className="mt-2 flex items-center gap-4 text-xs text-zinc-600 dark:text-zinc-400">
				<span className="inline-flex items-center gap-1">
					<span className="inline-block h-2 w-3 rounded-sm" style={{ background: "#60a5fa" }} />
					Morning
				</span>
				<span className="inline-flex items-center gap-1">
					<span className="inline-block h-2 w-3 rounded-sm" style={{ background: "#34d399" }} />
					Afternoon
				</span>
				<span className="inline-flex items-center gap-1">
					<span className="inline-block h-2 w-3 rounded-sm" style={{ background: "#fbbf24" }} />
					Evening
				</span>
			</div>
		</div>
	);
}

function formatType(t?: string | null) {
	if (!t) return "Workout";
	const s = String(t);
	if (/^whoop/i.test(s)) {
		// WHOOP • sport
		const parts = s.split("•");
		if (parts.length >= 2) {
			const sport = parts.slice(1).join("•").trim();
			return `WHOOP • ${sport.replace(/\w\S*/g, (x) => x.charAt(0).toUpperCase() + x.slice(1).toLowerCase())}`;
		}
		return "WHOOP";
	}
	return s.replace(/\w\S*/g, (x) => x.charAt(0).toUpperCase() + x.slice(1).toLowerCase());
}

function TodayChart({ todayPoint }: { todayPoint: DayPoint | null }) {
	if (!todayPoint) return <div className="h-40" />;
	const w = 320, h = 140;
	const leftPad = 38, pad = 16; // left space for Y-axis labels
	const startHr = 6, endHr = 21;
	const today = formatNYDate(new Date());
	const ints = getIntakesByDateNY(today).sort((a, b) => +new Date(a.timestamp) - +new Date(b.timestamp));
	const cumulative: { t: number; ml: number }[] = [];
	let sum = 0;
	for (let hr = startHr; hr <= endHr; hr++) {
		while (ints.length && new Date(ints[0].timestamp).getHours() <= hr) {
			sum += ints.shift()!.volume_ml;
		}
		cumulative.push({ t: hr, ml: sum });
	}
	const maxY = Math.max(1, todayPoint.target, ...cumulative.map((c) => c.ml));
	const scaleX = (t: number) => leftPad + ((t - startHr) / Math.max(1, endHr - startHr)) * (w - leftPad - pad);
	const scaleY = (v: number) => h - pad - (v / maxY) * (h - pad * 2);
	const line = (vals: { t: number; ml: number }[]) => vals.map((p, i) => `${i ? "L" : "M"} ${scaleX(p.t)} ${scaleY(p.ml)}`).join(" ");
	const targetLine = (tgt: number) => line(cumulative.map((c, i) => ({ t: c.t, ml: (tgt / Math.max(1, cumulative.length - 1)) * i })));
	return (
		<svg viewBox={`0 0 ${w} ${h}`} className="mt-3 h-44 w-full">
			{/* Axes */}
			<line x1={leftPad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="#e5e7eb" />
			<line x1={leftPad} y1={pad} x2={leftPad} y2={h - pad} stroke="#e5e7eb" />
			{/* Y ticks (oz) */}
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
			{/* X ticks (hours) */}
			{[6, 9, 12, 15, 18, 21].map((t) => (
				<g key={t}>
					<line x1={scaleX(t)} y1={h - pad} x2={scaleX(t)} y2={h - pad + 4} stroke="#cbd5e1" />
					<text x={scaleX(t)} y={h - 2} textAnchor="middle" fontSize="10" fill="#64748b">
						{t}
					</text>
				</g>
			))}
			{/* Series */}
			<path d={targetLine(todayPoint.target)} fill="none" stroke="#94a3b8" strokeWidth="2" />
			<path d={line(cumulative)} fill="none" stroke="#2563eb" strokeWidth="2" />
			{/* Axis labels */}
			<text x={leftPad - 14} y={12} textAnchor="end" fontSize="10" fill="#64748b">oz</text>
			<text x={w - pad} y={h} textAnchor="end" fontSize="10" fill="#64748b">h</text>
		</svg>
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
