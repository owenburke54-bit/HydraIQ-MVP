"use client";

import HydrationScoreCard from "../components/HydrationScoreCard";
import HydrationProgressBar from "../components/HydrationProgressBar";
import { Card } from "../components/ui/Card";
import DateSwitcher from "../components/DateSwitcher";
import { useEffect, useMemo, useState } from "react";
import {
	getIntakesByDateNY,
	getProfile,
	formatNYDate,
	getWorkoutsByDateNY,
	getSupplementsByDateNY,
	getWhoopMetrics,
	setWhoopMetrics,
} from "../lib/localStore";
import { calculateHydrationScore, WORKOUT_ML_PER_MIN } from "../lib/hydration";
import { useSearchParams } from "next/navigation";

export default function Home() {
	const searchParams = useSearchParams();

	const selectedDate = useMemo(() => {
		const q = searchParams?.get("date");
		// fallback to today in NY formatting (consistent w/ rest of app)
		return q && /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : formatNYDate(new Date());
	}, [searchParams]);

	const [state, setState] = useState({
		target: 0,
		actual: 0,
		score: 0,
		intakes: [] as { id: string; timestamp: string; volume_ml: number; type: string }[],
		flags: { workouts: false, creatine: false, env: false, whoop: false },
	});
	const [mounted, setMounted] = useState(false);

	const isToday = useMemo(() => selectedDate === formatNYDate(new Date()), [selectedDate]);

	useEffect(() => {
		setMounted(true);
	}, []);

	// Recalculate score periodically for the *selected* day.
	// (Only really changes for Today, but harmless for past days.)
	useEffect(() => {
		const tick = () => {
			const intakes = getIntakesByDateNY(selectedDate);
			const actual = intakes.reduce((s, i) => s + i.volume_ml, 0);
			const score =
				state.target > 0
					? calculateHydrationScore({
							targetMl: state.target,
							actualMl: actual,
							intakes: intakes.map((i) => ({
								timestamp: new Date(i.timestamp),
								volumeMl: i.volume_ml,
							})),
							workouts: [],
					  })
					: 0;

			setState((prev) => ({ ...prev, intakes, actual, score }));
		};

		tick();
		const id = setInterval(tick, 60 * 1000);
		return () => clearInterval(id);
	}, [state.target, selectedDate]);

	// Compute target + flags for selected day
	useEffect(() => {
		const date = selectedDate;
		const profile = getProfile();

		const intakes = getIntakesByDateNY(date);
		const workouts = getWorkoutsByDateNY(date);
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

		// Creatine adjustment (70 ml per gram) – match Insights
		const supplements = getSupplementsByDateNY(date);
		const creatineMl = supplements
			.filter((s) => s.type === "creatine" && s.grams && s.grams > 0)
			.reduce((sum, s) => sum + (s.grams || 0) * 70, 0);

		// WHOOP modifiers (sleep & recovery)
		let target = Math.round(base + workoutAdjustment + creatineMl);
		let usedWhoop = false;

		(async () => {
			try {
				const cached = getWhoopMetrics(date);

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

				if (cached) {
					apply(cached);
					usedWhoop = true;
				}

				// Only call the server for WHOOP on Today (avoid hammering + stale reads)
				if (isToday) {
					const res = await fetch(`/api/whoop/metrics?date=${date}`, { credentials: "include" });
					if (res.ok) {
						const j = await res.json();
						setWhoopMetrics(date, {
							sleep_hours: j.sleep_hours ?? null,
							recovery_score: j.recovery_score ?? null,
						});
						apply(j);
						usedWhoop = true;
					}
				}
			} catch {}

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
	}, [selectedDate, isToday]);

	return (
		<div className="p-4">
			{/* Date toggle for viewing past completed days */}
			<div className="mb-3">
				<DateSwitcher />
				{!isToday ? (
					<p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
						Viewing <span className="font-medium">{selectedDate}</span>. Use Log/Workouts to add or edit for this day.
					</p>
				) : null}
			</div>

			<HydrationScoreCard score={state.score} />

			<HydrationProgressBar actualMl={state.actual} targetMl={state.target} />

			<Card className="mb-4 border-blue-100 bg-blue-50 p-4 text-blue-900 shadow-sm dark:border-blue-900/40 dark:bg-blue-950 dark:text-blue-200">
				<p className="text-sm font-semibold">Recommendations:</p>
				{(() => {
					const flags = state.flags || { workouts: false, creatine: false, env: false, whoop: false };
					const deficitMl = Math.max(0, state.target - state.actual);
					const deficitOz = Math.round(deficitMl / 29.5735);

					// Only show “do this now / per hour” guidance for Today
					let nowOz = 0,
						perHour = 0;
					if (mounted && isToday) {
						const now = new Date();
						const end = new Date(now);
						end.setHours(21, 0, 0, 0);
						const hoursLeft = Math.max(1, Math.ceil((end.getTime() - now.getTime()) / 3600000));
						nowOz = Math.max(6, Math.min(20, Math.round(deficitOz * 0.5)));
						perHour = Math.max(4, Math.round((deficitOz - nowOz) / hoursLeft));
					}

					return (
						<div className="mt-1 text-sm">
							<p className="mb-1 text-xs opacity-80">
								Target: <strong>{Math.round(state.target / 29.5735)} oz</strong>
								<span className="mx-1">•</span>
								Actual: <strong>{Math.round(state.actual / 29.5735)} oz</strong>
							</p>

							{deficitMl > 0 ? (
								isToday ? (
									<p>
										Drink {mounted ? nowOz : Math.max(6, Math.min(20, Math.round(deficitOz * 0.5)))} oz now, then{" "}
										{mounted ? perHour : Math.max(4, Math.round(deficitOz * 0.5 / Math.max(1, 4)))} oz each hour until ~9pm.
									</p>
								) : (
									<p>
										You finished <strong>{Math.round(deficitMl / 29.5735)} oz</strong> below your target for this day.
									</p>
								)
							) : (
								<p>Nice work — you hit your target for this day.</p>
							)}

							{isToday ? (
								<p className="mt-1 text-xs opacity-80">Tip: small sips every ~20–30 min are easier than big chugs.</p>
							) : null}

							{mounted ? (
								<div className="mt-2 rounded-lg border border-blue-200/60 bg-white/70 p-3 text-xs text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-blue-200">
									<p className="mb-1 font-semibold">Target includes:</p>
									<div className="space-y-1">
										<div>Base need from weight</div>
										{flags.workouts ? <div>Workouts adjustment</div> : null}
										{flags.creatine ? <div>Creatine</div> : null}
										{flags.whoop ? <div>Sleep/Recovery modifiers (WHOOP)</div> : null}
									</div>
								</div>
							) : null}
						</div>
					);
				})()}

				{(state.flags || { creatine: false }).creatine ? (
					<p className="mt-2 text-xs opacity-80">Creatine increases your target slightly — aim to spread fluids through the day.</p>
				) : null}
			</Card>

			<section className="mb-20">
				<h2 className="mb-2 text-lg font-semibold">{isToday ? "Today's intake" : "Intake"}</h2>

				{state.intakes.length === 0 ? (
					<div className="rounded-2xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
						No drinks logged for this day.
					</div>
				) : (
					<ul className="divide-y divide-zinc-200 overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
						{state.intakes.map((i) => {
							const d = new Date(i.timestamp);
							const nf = new Intl.DateTimeFormat("en-US", {
								timeZone: "America/New_York",
								hour: "numeric",
								minute: "2-digit",
								hour12: true,
							});
							const hhmm = nf.format(d).toLowerCase();
							return (
								<li key={i.id} className="grid grid-cols-[72px,1fr,96px] items-center p-3 text-sm">
									<div className="text-zinc-600 dark:text-zinc-300">{hhmm}</div>
									<div className="text-right font-medium">{Math.round(i.volume_ml / 29.5735)} oz</div>
									<div className="text-right text-zinc-600 capitalize dark:text-zinc-300">{i.type}</div>
								</li>
							);
						})}
					</ul>
				)}
			</section>
		</div>
	);
}
