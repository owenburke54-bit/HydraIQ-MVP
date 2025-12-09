"use client";

import Link from "next/link";
import { Droplet, User } from "lucide-react";
import HydrationScoreCard from "../components/HydrationScoreCard";
import HydrationProgressBar from "../components/HydrationProgressBar";
import { Card } from "../components/ui/Card";
import { useEffect, useState } from "react";
import { getIntakesByDateNY, getProfile } from "../lib/localStore";
import { calculateHydrationScore } from "../lib/hydration";

export default function Home() {
	const [state, setState] = useState({
		target: 0,
		actual: 0,
		score: 0,
		intakes: [] as { id: string; timestamp: string; volume_ml: number; type: string }[],
	});

	useEffect(() => {
		const today = new Date().toISOString().slice(0, 10);
		const profile = getProfile();
		const intakes = getIntakesByDateNY(today);
		const actual = intakes.reduce((s, i) => s + i.volume_ml, 0);
		if (!profile) {
			setState({ target: 0, actual, score: 0, intakes });
			return;
		}
		const weight = profile.weight_kg ?? 0;
		const target = weight > 0 ? Math.round(weight * 35) : 0;
		const score =
			target > 0
				? calculateHydrationScore({
						targetMl: target,
						actualMl: actual,
						intakes: intakes.map((i) => ({ timestamp: new Date(i.timestamp), volumeMl: i.volume_ml })),
						workouts: [],
				  })
				: 0;
		setState({ target, actual, score, intakes });
	}, []);

	return (
		<div className="p-4">
			<header className="mb-4 flex items-center justify-between">
				<div className="flex items-center gap-2">
					<Droplet className="text-blue-600" size={22} />
					<h1 className="text-xl font-semibold">HydraIQ</h1>
				</div>
				<Link
					href="/profile"
					className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
					aria-label="Profile"
				>
					<User size={18} />
				</Link>
			</header>

			<HydrationScoreCard score={state.score} />

			<HydrationProgressBar actualMl={state.actual} targetMl={state.target} />

			<Card className="mb-4 border-blue-100 bg-blue-50 p-4 text-blue-900 shadow-sm dark:border-blue-900/40 dark:bg-blue-950 dark:text-blue-200">
				<p className="text-sm font-medium">Next recommendation</p>
				<p className="mt-1 text-sm">
					{state.actual < state.target ? "Drink 300ml in the next 2 hours" : "Nice work - you're on target today"}
				</p>
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
									<span className="font-medium">{i.volume_ml} ml</span>
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

