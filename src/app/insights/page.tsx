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
		if (deficit > 0) messages.push({ title: "Behind today", body: `You're ~${deficit} ml short of target.` });
		else messages.push({ title: "On track", body: "You've hit your target today. Nice work." });
		messages.push({ title: "Average score (7d)", body: `${Math.round(avgScore)}; low-score days: ${lowDays}/7.` });
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
