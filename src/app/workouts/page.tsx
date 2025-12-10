"use client";

import { useState } from "react";
import Button from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { addWorkout, getWorkoutsByDateNY, todayNYDate, updateWorkout, deleteWorkout } from "../../lib/localStore";

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
	const [end, setEnd] = useState<string>(formatLocalInput(new Date(Date.now() + 60 * 60 * 1000)));
	const [endTouched, setEndTouched] = useState(false);
	const [intensity, setIntensity] = useState<number>(5);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [message, setMessage] = useState<string | null>(null);

	const todays = getWorkoutsByDateNY(todayNYDate());

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
								onChange={(e) => {
									setStart(e.target.value);
									if (!endTouched) {
										const d = new Date(e.target.value);
										const plus1h = new Date(d.getTime() + 60 * 60 * 1000);
										setEnd(formatLocalInput(plus1h));
									}
								}}
								className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
							/>

							<label className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">End time</label>
							<input
								type="datetime-local"
								value={end}
								onChange={(e) => {
									setEndTouched(true);
									setEnd(e.target.value);
								}}
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
									setMessage("Saved workout");
									setTimeout(() => window.location.reload(), 500);
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
				<div className="mb-3 flex gap-2">
					<a href="/api/whoop/connect" className="rounded-xl border px-3 py-2 text-sm">Connect WHOOP</a>
					<button
						className="rounded-xl border px-3 py-2 text-sm"
						onClick={async () => {
							try {
								const d = todayNYDate();
								// Explicitly include credentials to ensure httpOnly cookies (whoop_refresh/whoop_access) are sent
								const res = await fetch(`/api/whoop/sync?date=${d}`, { credentials: "include" });
								const json = await res.json();
								if (res.ok && Array.isArray(json.activities)) {
									let count = 0;
									for (const a of json.activities) {
										try {
											const start = a.start ?? a.start_time ?? a.created_at;
											const end = a.end ?? a.end_time ?? start;
											const type = a?.sport_name ? `WHOOP • ${String(a.sport_name)}` : "WHOOP";
											const strain = typeof a?.score?.strain === "number" ? Number(a.score.strain) : null;
											// Preserve strain as a float (0–21), we'll format when rendering
											const intensity = typeof strain === "number"
												? Math.max(0, Math.min(21, strain))
												: null;
											addWorkout({
												type: String(type),
												start: new Date(start),
												end: new Date(end),
												intensity: intensity ?? undefined,
											});
											count++;
										} catch {}
									}
									alert(`Imported ${count} WHOOP activities`);
									location.reload();
								} else {
									alert(json?.error ?? "WHOOP not connected");
								}
							} catch {
								alert("Failed to import from WHOOP");
							}
						}}
					>
						Import WHOOP (today)
					</button>
				</div>
				{todays.length === 0 ? (
					<p className="text-sm text-zinc-600 dark:text-zinc-400">No workouts today.</p>
				) : (
					<ListEditable workouts={todays} />
				)}
				{error ? <p className="pt-2 text-center text-sm text-red-600">{error}</p> : null}
				{message ? <p className="pt-2 text-center text-sm text-green-600">{message}</p> : null}
			</div>
		</div>
	);
}

function ListEditable({ workouts }: { workouts: any[] }) {
	const [editing, setEditing] = useState<string | null>(null);
	const [form, setForm] = useState<any>(null);

	if (!workouts.length) return null;

	return (
		<ul className="space-y-2 text-sm">
			{workouts.map((w) => {
				const isEditing = editing === w.id;
				return (
					<li key={w.id} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
						{!isEditing ? (
							<div className="flex items-center justify-between gap-2">
								<div>
									<div className="font-medium">{String(w.type || "Workout").replace(/^whoop/i, "WHOOP")}</div>
									<div className="text-zinc-600 dark:text-zinc-400">
										{fmtTime(w.start_time)}{w.end_time ? `–${fmtTime(w.end_time)}` : ""} • {/^whoop/i.test(String(w.type || ""))
											? (typeof w.intensity === "number" ? `WHOOP Strain ${w.intensity.toFixed(1)}` : "Recovery")
											: `Intensity ${w.intensity ?? 5}`}
									</div>
								</div>
								<div className="flex gap-2">
									<button
										className="rounded border px-2 py-1"
										onClick={() => {
											setEditing(w.id);
											setForm({
												type: w.type || "Workout",
												start: formatLocalInput(new Date(w.start_time)),
												end: formatLocalInput(w.end_time ? new Date(w.end_time) : new Date(w.start_time)),
												intensity: w.intensity ?? 5,
											});
										}}
									>
										Edit
									</button>
									<button
										className="rounded border px-2 py-1 text-red-600"
										onClick={() => {
											if (confirm("Delete this workout?")) {
												deleteWorkout(w.id);
												location.reload();
											}
										}}
									>
										Delete
									</button>
								</div>
							</div>
						) : (
							<div className="grid gap-2">
								<input
									className="rounded-xl border p-2"
									value={form.type}
									onChange={(e) => setForm({ ...form, type: e.target.value })}
								/>
								<input
									type="datetime-local"
									className="rounded-xl border p-2"
									value={form.start}
									onChange={(e) => setForm({ ...form, start: e.target.value })}
								/>
								<input
									type="datetime-local"
									className="rounded-xl border p-2"
									value={form.end}
									onChange={(e) => setForm({ ...form, end: e.target.value })}
								/>
								<input
									type="range"
									min={1}
									max={10}
									value={form.intensity}
									onChange={(e) => setForm({ ...form, intensity: Number(e.target.value) })}
								/>
								<div className="flex gap-2">
									<button
										className="rounded border px-3 py-2"
										onClick={() => {
											updateWorkout(w.id, {
												type: form.type,
												start_time: new Date(form.start).toISOString(),
												end_time: new Date(form.end).toISOString(),
												intensity: form.intensity,
											});
											location.reload();
										}}
									>
										Save
									</button>
									<button className="rounded border px-3 py-2" onClick={() => setEditing(null)}>
										Cancel
									</button>
								</div>
							</div>
						)}
					</li>
				);
			})}
		</ul>
	);
}

function fmtTime(iso: string) {
	return new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hour12: true }).format(new Date(iso));
}



