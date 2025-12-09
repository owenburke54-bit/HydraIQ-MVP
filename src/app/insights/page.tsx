"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "../../components/ui/Card";
import RadialGauge from "../../components/charts/RadialGauge";
import CalendarHeatmap from "../../components/charts/CalendarHeatmap";
import Donut from "../../components/charts/Donut";
import { calculateHydrationScore, WORKOUT_ML_PER_MIN } from "../../lib/hydration";
import { getProfile, formatNYDate, getIntakesByDateNY, getWorkoutsByDateNY } from "../../lib/localStore";

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
	const [mode, setMode] = useState<"today" | "history">("history");

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
		const last = points[points.length - 1];
		const deficit = last.target > 0 ? last.target - last.actual : 0;
		const avgScore =
			points.slice(-7).reduce((s, p) => s + (isFinite(p.score) ? p.score : 0), 0) / Math.max(1, Math.min(7, points.length));
		const lowDays = points.slice(-7).filter((p) => p.score < 60).length;
		const messages: { title: string; body: string }[] = [];
		if (deficit > 0) messages.push({ title: "Behind today", body: `You're ~${Math.round(deficit / 29.5735)} oz short of target.` });
		else messages.push({ title: "On track", body: "You've hit your target today. Nice work." });
		messages.push({ title: "Average score (7d)", body: `${Math.round(avgScore)}; low-score days: ${lowDays}/7.` });

		// Morning intake ratio over last 7 days
		const last7 = points.slice(-7);
		let morningMl = 0;
		let totalMl = 0;
		last7.forEach((p) => {
			const ints = getIntakesByDateNY(p.date);
			totalMl += ints.reduce((s, i) => s + i.volume_ml, 0);
			morningMl += ints.filter((i) => new Date(i.timestamp).getHours() < 12).reduce((s, i) => s + i.volume_ml, 0);
		});
		if (totalMl > 0) {
			const pct = Math.round((morningMl / totalMl) * 100);
			messages.push({ title: "Morning intake (7d)", body: `${pct}% of fluids were before noon.` });
		}

		// Workout vs rest day average actual
		let wMl = 0,
			wDays = 0,
			rMl = 0,
			rDays = 0;
		last7.forEach((p) => {
			const ws = getWorkoutsByDateNY(p.date);
			const ints = getIntakesByDateNY(p.date);
			const ml = ints.reduce((s, i) => s + i.volume_ml, 0);
			if (ws.length) {
				wMl += ml;
				wDays += 1;
			} else {
				rMl += ml;
				rDays += 1;
			}
		});
		if (wDays + rDays > 0) {
			const wOz = Math.round((wMl / Math.max(1, wDays)) / 29.5735);
			const rOz = Math.round((rMl / Math.max(1, rDays)) / 29.5735);
			messages.push({ title: "Workout vs rest (7d)", body: `Avg intake: ${wOz} oz on workout days vs ${rOz} oz on rest days.` });
		}

		// Current streak meeting target
		let streak = 0;
		for (let i = points.length - 1; i >= 0; i--) {
			const p = points[i];
			if (p.actual >= p.target && p.target > 0) streak += 1;
			else break;
		}
		if (streak > 0) messages.push({ title: "Streak", body: `${streak} day${streak > 1 ? "s" : ""} meeting target.` });

		return messages;
	}, [points]);

	return (
		<div className="p-4">
			<h1 className="text-xl font-semibold">Insights</h1>

			<div className="mt-3 flex gap-2">
				<button
					className={`rounded-xl border px-3 py-2 text-sm ${mode === "history" ? "border-blue-600 bg-blue-50 text-blue-700" : ""}`}
					onClick={() => setMode("history")}
				>
					Last 14 days
				</button>
				<button
					className={`rounded-xl border px-3 py-2 text-sm ${mode === "today" ? "border-blue-600 bg-blue-50 text-blue-700" : ""}`}
					onClick={() => setMode("today")}
				>
					Today
				</button>
			</div>

			{/* Today gauge */}
			<section className="mt-4">
				<Card className="p-4 flex items-center gap-4">
					<div className="w-[160px] shrink-0">
						<RadialGauge
							value={points.length ? Math.min(1, (points[points.length - 1].actual || 0) / Math.max(1, points[points.length - 1].target || 0)) : 0}
							label="Today"
						/>
					</div>
					<div className="text-sm text-zinc-600 dark:text-zinc-400">
						<p>
							Target:{" "}
							<strong>
								{points.length ? Math.round((points[points.length - 1].target || 0) / 29.5735) : 0} oz
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

			{/* Intake distribution donut */}
			<section className="mt-4">
				<Card className="p-4">
					<p className="text-sm text-zinc-600 dark:text-zinc-400">Intake distribution (last 7 days)</p>
					<Donut
						slices={getIntakeDistribution(points.slice(-7)).map((s, i) => ({
							label: s.label,
							value: s.value,
							color: ["#60a5fa", "#34d399", "#fbbf24"][i] || "#a3a3a3",
						}))}
					/>
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

function TodayChart({ todayPoint }: { todayPoint: DayPoint | null }) {
	if (!todayPoint) return <div className="h-40" />;
	const w = 320, h = 120, pad = 16;
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
	const scaleX = (t: number) => pad + ((t - startHr) / Math.max(1, endHr - startHr)) * (w - pad * 2);
	const scaleY = (v: number) => h - pad - (v / maxY) * (h - pad * 2);
	const line = (vals: { t: number; ml: number }[]) => vals.map((p, i) => `${i ? "L" : "M"} ${scaleX(p.t)} ${scaleY(p.ml)}`).join(" ");
	const targetLine = (tgt: number) => line(cumulative.map((c, i) => ({ t: c.t, ml: (tgt / Math.max(1, cumulative.length - 1)) * i })));
	return (
		<svg viewBox={`0 0 ${w} ${h}`} className="mt-3 h-40 w-full">
			<path d={targetLine(todayPoint.target)} fill="none" stroke="#94a3b8" strokeWidth="2" />
			<path d={line(cumulative)} fill="none" stroke="#2563eb" strokeWidth="2" />
		</svg>
	);
}
