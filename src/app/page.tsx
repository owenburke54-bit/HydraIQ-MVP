"use client";

import Link from "next/link";
import { Droplet, User } from "lucide-react";
import HydrationScoreCard from "../components/HydrationScoreCard";
import HydrationProgressBar from "../components/HydrationProgressBar";
import { Card } from "../components/ui/Card";
import { useEffect, useState } from "react";
import { getIntakesByDateNY, getProfile, todayNYDate, getIntakesForHome, getWorkoutsByDateNY, lastNDatesNY, hasCreatineOnDateNY, getSupplementsByDateNY, getWhoopMetrics, setWhoopMetrics } from "../lib/localStore";
import { calculateHydrationScore, WORKOUT_ML_PER_MIN } from "../lib/hydration";

export default function Home() {
	const [state, setState] = useState({
		target: 0,
		actual: 0,
		score: 0,
		intakes: [] as { id: string; timestamp: string; volume_ml: number; type: string }[],
		flags: { workouts: false, creatine: false, env: false, whoop: false },
	});
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	useEffect(() => {
		const today = todayNYDate();
		const profile = getProfile();
		// Strict NY day to avoid next-day carryover
		const intakes = getIntakesByDateNY(today);
		const workouts = getWorkoutsByDateNY(today);
		const actual = intakes.reduce((s, i) => s + i.volume_ml, 0);
		if (!profile) {
			setState({
				target: 0,
				actual,
				score: 0,
				intakes,
				flags: { workouts: workouts.length > 0, creatine: false, env: false, whoop: false },
			});
			return;
		}
		const weight = profile.weight_kg ?? 0;
		// Base target + workout adjustment (strain-aware)
		const base = weight > 0 ? weight * 35 : 0;
		const workoutAdjustment = workouts.reduce((sum, w) => {
			const start = new Date(w.start_time);
			const end = w.end_time ? new Date(w.end_time) : start;
			const durationMin = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
			const strain = typeof w.intensity === "number" ? Math.max(0, Math.min(21, w.intensity)) : 5;
			const intensityFactor = 0.5 + strain / 21; // ~0.5–1.5x
			return sum + durationMin * WORKOUT_ML_PER_MIN * intensityFactor;
		}, 0);

		// Remove historical carryover so Home matches Insights "Today" target exactly
		const carryover = 0;

		// Creatine adjustment (70 ml per gram) – match Insights
		const supplements = getSupplementsByDateNY(today);
		const creatineMl = supplements
			.filter((s) => s.type === "creatine" && s.grams && s.grams > 0)
			.reduce((sum, s) => sum + (s.grams || 0) * 70, 0);

		// WHOOP modifiers (sleep & recovery)
		let target = Math.round(base + workoutAdjustment + creatineMl + carryover);
		let usedWhoop = false;
		(async () => {
			try {
				const cached = getWhoopMetrics(today);
				const apply = (j: any) => {
					let modPct = 0;
					if (typeof j.sleep_hours === "number") {
						const h = j.sleep_hours;
						if (h < 7.5) modPct += Math.max(0, (7.5 - h)) * 0.03;
						else if (h > 8.5) modPct -= Math.max(0, (h - 8.5)) * 0.02;
					}
					if (typeof j.recovery_score === "number") {
						const r = j.recovery_score;
						if (r < 33) modPct += 0.05;
						else if (r < 66) modPct += 0.02;
					}
					target = Math.round(target * (1 + modPct));
				};
				if (cached) { apply(cached); usedWhoop = true; }
				const res = await fetch(`/api/whoop/metrics?date=${today}`, { credentials: "include" });
				if (res.ok) {
					const j = await res.json();
					setWhoopMetrics(today, { sleep_hours: j.sleep_hours ?? null, recovery_score: j.recovery_score ?? null });
					apply(j); usedWhoop = true;
				}
			} catch {}
			const score =
				target > 0
					? calculateHydrationScore({
							targetMl: target,
							actualMl: actual,
							intakes: intakes.map((i) => ({ timestamp: new Date(i.timestamp), volumeMl: i.volume_ml })),
							workouts: [],
					  })
					: 0;
			setState({
				target,
				actual,
				score,
				intakes,
				flags: {
					workouts: workouts.length > 0,
					creatine: creatineMl > 0,
					env: false,
					whoop: usedWhoop,
				},
			});
		})();
	}, []);

	return (
		<div className="p-4">
			{/* Top bar is now global */}

			<HydrationScoreCard score={state.score} />

			<HydrationProgressBar actualMl={state.actual} targetMl={state.target} />

			<Card className="mb-4 border-blue-100 bg-blue-50 p-4 text-blue-900 shadow-sm dark:border-blue-900/40 dark:bg-blue-950 dark:text-blue-200">
				<p className="text-sm font-medium">Next recommendation</p>
				{(() => {
					const flags = state.flags || { workouts: false, creatine: false, env: false, whoop: false };
					const deficitMl = Math.max(0, state.target - state.actual);
					const deficitOz = Math.round(deficitMl / 29.5735);
					// Render time-sensitive numbers only after mount to avoid SSR/CSR mismatch
					let nowOz = 0, perHour = 0;
					if (mounted) {
						const now = new Date();
						const end = new Date(now); end.setHours(21, 0, 0, 0);
						const hoursLeft = Math.max(1, Math.ceil((end.getTime() - now.getTime()) / 3600000));
						nowOz = Math.max(6, Math.min(20, Math.round(deficitOz * 0.5)));
						perHour = Math.max(4, Math.round((deficitOz - nowOz) / hoursLeft));
					}
					return (
						<div className="mt-1 text-sm">
							<p className="mb-1 text-xs opacity-80">Target today: <strong>{Math.round(state.target / 29.5735)} oz</strong></p>
							{deficitMl > 0 ? (
								<p>
									Drink {mounted ? nowOz : Math.max(6, Math.min(20, Math.round(deficitOz * 0.5)))} oz now,
									then {mounted ? perHour : Math.max(4, Math.round(deficitOz * 0.5 / Math.max(1, 4)))} oz each hour until ~9pm.
								</p>
							) : (
								<p>Nice work — you’re on target. Keep sipping water with meals.</p>
							)}
							<p className="mt-1 text-xs opacity-80">Tip: small sips every ~20–30 min are easier than big chugs.</p>
							{/* breakdown (client-only to avoid SSR mismatch) */}
							{mounted ? (
								<div className="mt-2 rounded-lg border border-blue-200/60 bg-white/70 p-2 text-xs text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-blue-200">
									<p className="font-medium">Today’s target includes:</p>
									<ul className="mt-1 list-disc pl-4">
										<li>Base need from weight</li>
										{flags.workouts ? <li>Workouts adjustment</li> : null}
										{flags.creatine ? <li>Creatine</li> : null}
										{flags.env ? <li>Environment</li> : null}
										{flags.whoop ? <li>Sleep/Recovery modifiers (WHOOP)</li> : null}
									</ul>
								</div>
							) : null}
						</div>
					);
				})()}
				{(state.flags || { creatine: false }).creatine ? (
					<p className="mt-2 text-xs opacity-80">Creatine today increases your target slightly — aim to spread fluids through the day.</p>
				) : null}
			</Card>

			<section className="mb-20">
				<h2 className="mb-2 text-lg font-semibold">Today's intake</h2>
				{state.intakes.length === 0 ? (
					<div className="rounded-2xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
						No drinks logged yet.
					</div>
				) : (
					<ul className="divide-y divide-zinc-200 overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
						{state.intakes.map((i) => {
							const d = new Date(i.timestamp);
							const nf = new Intl.DateTimeFormat("en-US", {
								timeZone: "America/New_York",
								hour: "2-digit",
								minute: "2-digit",
								hour12: false,
							});
							const hhmm = nf.format(d);
							return (
								<li key={i.id} className="flex items-center justify-between p-3 text-sm">
									<span className="text-zinc-600 dark:text-zinc-300">{hhmm}</span>
									<span className="font-medium">{Math.round(i.volume_ml / 29.5735)} oz</span>
									<span className="text-zinc-600 capitalize dark:text-zinc-300">{i.type}</span>
								</li>
							);
						})}
					</ul>
				)}
			</section>
		</div>
	);
}
