"use client";

import { useState } from "react";
import Button from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";

export default function LogPage() {
	const [volume, setVolume] = useState<number | "">("");
	const [type, setType] = useState<"water" | "electrolyte" | "other">("water");
	const [time, setTime] = useState<string>(new Date().toISOString().slice(0, 16));
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [supplements, setSupplements] = useState<string[]>([]);

	const quicks = [
		{ label: "8 oz", ml: 237 },
		{ label: "12 oz", ml: 355 },
		{ label: "16 oz", ml: 473 },
		{ label: "24 oz", ml: 710 },
	];

	const suppOptions = [
		{ key: "creatine", label: "Creatine" },
		{ key: "protein", label: "Protein Powder" },
		{ key: "multivitamin", label: "Multivitamin" },
		{ key: "fish_oil", label: "Fish Oil" },
		{ key: "electrolyte_tablet", label: "Electrolyte Tablet" },
		{ key: "other", label: "Other" },
	];

	function toggleSupp(key: string) {
		setSupplements((prev) =>
			prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
		);
	}

	return (
		<div className="p-4">
			<h1 className="text-xl font-semibold">Log Drink</h1>
			<Card className="mt-4 p-4 space-y-4">
				<div>
					<label className="mb-2 block text-sm text-zinc-600 dark:text-zinc-300">Volume (ml)</label>
					<input
						type="number"
						inputMode="numeric"
						value={volume}
						onChange={(e) => setVolume(e.target.value === "" ? "" : Number(e.target.value))}
						placeholder="e.g., 300"
						className="w-full rounded-xl border border-zinc-200 bg-white p-3 text-base outline-none ring-blue-500 focus:ring-2 dark:border-zinc-800 dark:bg-zinc-900"
					/>
					<div className="mt-3 grid grid-cols-4 gap-2">
						{quicks.map((q) => (
							<button
								key={q.label}
								type="button"
								onClick={() => setVolume(q.ml)}
								className="rounded-xl border border-zinc-200 bg-white p-2 text-sm shadow-sm active:scale-[0.98] dark:border-zinc-800 dark:bg-zinc-900"
							>
								{q.label}
							</button>
						))}
					</div>
				</div>

				<div>
					<label className="mb-2 block text-sm text-zinc-600 dark:text-zinc-300">Type</label>
					<div className="grid grid-cols-3 gap-2">
						{(["water", "electrolyte", "other"] as const).map((t) => (
							<button
								key={t}
								type="button"
								onClick={() => setType(t)}
								className={`rounded-xl border p-2 text-sm capitalize ${
									type === t
										? "border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950 dark:text-blue-200"
										: "border-zinc-200 bg-white text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
								}`}
							>
								{t}
							</button>
						))}
					</div>
				</div>

				<div>
					<label className="mb-2 block text-sm text-zinc-600 dark:text-zinc-300">Supplements</label>
					<div className="grid grid-cols-2 gap-2">
						{suppOptions.map((opt) => (
							<button
								key={opt.key}
								type="button"
								onClick={() => toggleSupp(opt.key)}
								className={`rounded-xl border p-2 text-sm ${
									supplements.includes(opt.key)
										? "border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950 dark:text-blue-200"
										: "border-zinc-200 bg-white text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
								}`}
							>
								{opt.label}
							</button>
						))}
					</div>
				</div>

				<div>
					<label className="mb-2 block text-sm text-zinc-600 dark:text-zinc-300">Time</label>
					<input
						type="datetime-local"
						value={time}
						onChange={(e) => setTime(e.target.value)}
						className="w-full rounded-xl border border-zinc-200 bg-white p-3 text-base outline-none ring-blue-500 focus:ring-2 dark:border-zinc-800 dark:bg-zinc-900"
					/>
				</div>

				<Button
					type="button"
					className="mt-2 w-full"
					disabled={loading}
					onClick={async () => {
						setLoading(true);
						setError(null);
						try {
							// 1) Save intake
							const intakeRes = await fetch("/api/intake", {
								method: "POST",
								headers: { "Content-Type": "application/json" },
								body: JSON.stringify({
									volumeMl: typeof volume === "number" ? volume : 0,
									type,
									timestamp: new Date(time).toISOString(),
								}),
							});
							if (!intakeRes.ok) {
								if (intakeRes.status === 401) {
									window.location.href = "/auth/login?redirect=/log";
									return;
								}
								const j = await intakeRes.json().catch(() => ({} as any));
								throw new Error(j?.error ?? "Failed to save drink");
							}

							// 2) Save supplements if any
							if (supplements.length) {
								const suppRes = await fetch("/api/supplement", {
									method: "POST",
									headers: { "Content-Type": "application/json" },
									body: JSON.stringify({
										types: supplements,
										timestamp: new Date(time).toISOString(),
									}),
								});
								if (!suppRes.ok) {
									const j2 = await suppRes.json().catch(() => ({} as any));
									throw new Error(j2?.error ?? "Failed to save supplements");
								}
							}

							location.href = "/";
						} catch (e: any) {
							setError(e.message || "Unexpected error");
						} finally {
							setLoading(false);
						}
					}}
				>
					{loading ? "Saving..." : "Save"}
				</Button>
				{error ? <p className="pt-2 text-center text-sm text-red-600">{error}</p> : null}
			</Card>
		</div>
	);
}



