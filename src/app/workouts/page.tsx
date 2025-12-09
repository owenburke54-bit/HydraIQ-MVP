"use client";

import { useState } from "react";
import Button from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { addWorkout } from "../../lib/localStore";

function formatLocalInput(dt: Date) {
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(
		dt.getMinutes()
	)}`;
}

export default function WorkoutsPage() {
	const [open, setOpen] = useState(true);
	const [type, setType] = useState<string>("Run");
	const [start, setStart] = useState<string>(formatLocalInput(new Date()));
	const [end, setEnd] = useState<string>(formatLocalInput(new Date()));
	const [intensity, setIntensity] = useState<number>(5);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const workoutOptions = [
		"Soccer",
		"Run",
		"Lift",
		"Tennis",
		"Swimming",
		"Pickleball",
		"Basketball",
		"Other",
	];

	return (
		<div className="p-4">
			<h1 className="text-xl font-semibold">Workouts</h1>

			<Card className="mt-4 overflow-hidden">
				<button
					onClick={() => setOpen((v) => !v)}
					className="flex w-full items-center justify-between p-4 text-left text-sm font-medium"
				>
					<span>Add workout</span>
					<span className="text-zinc-500">{open ? "âˆ’" : "+"}</span>
				</button>
				{open && (
					<div className="border-t border-zinc-200 p-4 dark:border-zinc-800">
						<div className="grid gap-3">
							<label className="text-sm text-zinc-600 dark:text-zinc-300">Type</label>
							<select
								value={type}
								onChange={(e) => setType(e.target.value)}
								className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
							>
								{workoutOptions.map((opt) => (
									<option key={opt} value={opt}>
										{opt}
									</option>
								))}
							</select>

							<label className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">Start time</label>
							<input
								type="datetime-local"
								value={start}
								onChange={(e) => setStart(e.target.value)}
								className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
							/>

							<label className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">End time</label>
							<input
								type="datetime-local"
								value={end}
								onChange={(e) => setEnd(e.target.value)}
								className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
							/>

							<label className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">Intensity: {intensity}</label>
							<input
								type="range"
								min={1}
								max={10}
								value={intensity}
								onChange={(e) => setIntensity(Number(e.target.value))}
								className="w-full"
							/>

							<Button
								onClick={async () => {
								setLoading(true);
								setError(null);
								try {
									addWorkout({
										type: type.toLowerCase(),
										start: new Date(start),
										end: new Date(end),
										intensity,
									});
									window.location.reload();
								} catch (e: any) {
									setError(e.message || "Failed to save workout");
								} finally {
									setLoading(false);
								}
							}}
							className="mt-3 w-full"
							disabled={loading}
						>
							{loading ? "Saving..." : "Save Workout"}
						</Button>
						</div>
					</div>
				)}
			</Card>

			<div className="mt-6">
				<h2 className="mb-2 text-lg font-semibold">Upcoming & recent</h2>
				{/* No examples yet */}
				{error ? <p className="pt-2 text-center text-sm text-red-600">{error}</p> : null}
			</div>
		</div>
	);
}



