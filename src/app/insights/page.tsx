"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "../../components/ui/Card";
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
			<section className="mt-4">
				<Card className="p-4">
					<p className="text-sm text-zinc-600 dark:text-zinc-400">Hydration Score (last 14 days)</p>
					<div className="mt-3 grid grid-cols-7 gap-2 text-center text-xs text-zinc-600 dark:text-zinc-400">
						{points.slice(-7).map((p) => (
							<div key={p.date} className="rounded-md border border-zinc-200 p-2 dark:border-zinc-800">
								<div className="font-medium">{isFinite(p.score) ? p.score : "-"}</div>
								<div className="mt-1">{p.date.slice(5)}</div>
							</div>
						))}
					</div>
				</Card>
			</section>

			<section className="mt-4">
				<Card className="p-4">
					<p className="text-sm text-zinc-600 dark:text-zinc-400">Intake vs Target (oz)</p>
					<LineChart points={points} />
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
	const scaleX = (i: number) => pad + (i / Math.max(1, points.length - 1)) * (w - pad * 2);
	const scaleY = (v: number) => h - pad - (v / maxY) * (h - pad * 2);
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
