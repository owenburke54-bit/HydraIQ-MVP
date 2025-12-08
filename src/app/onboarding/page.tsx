"use client";

import { useEffect, useState } from "react";

type Units = "metric" | "imperial";
type Sex = "male" | "female" | "other";

export default function OnboardingPage() {
	const [name, setName] = useState<string>("");
	const [sex, setSex] = useState<Sex>("other");
	const [height, setHeight] = useState<string>(""); // cm or ft'in
	const [weight, setWeight] = useState<string>(""); // kg or lbs
	const [units, setUnits] = useState<Units>("imperial");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		// Try to prefill from existing profile
		(async () => {
			try {
				const res = await fetch("/api/day-summary"); // ensures auth cookie OK; lightweight call
				if (!res.ok) return;
				const profRes = await fetch("/api/profile", { method: "GET" });
				if (!profRes.ok) return;
				const p = await profRes.json();
				if (p) {
					setName(p.name ?? "");
					setSex((p.sex as Sex) ?? "other");
					setUnits((p.units as Units) ?? "imperial");
					if (p.height_cm) setHeight(String(p.height_cm));
					if (p.weight_kg) setWeight(String(p.weight_kg));
				}
			} catch {}
		})();
	}, []);

	return (
		<div className="p-4">
			<h1 className="text-xl font-semibold">Welcome to HydraIQ</h1>
			<p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
				Letâ€™s set up your profile to personalize your hydration targets.
			</p>
			<div className="mt-4 space-y-4">
				<div>
					<label className="mb-2 block text-sm text-zinc-600 dark:text-zinc-300">Name</label>
					<input
						type="text"
						value={name}
						onChange={(e) => setName(e.target.value)}
						className="w-full rounded-xl border border-zinc-200 bg-white p-3 outline-none ring-blue-500 focus:ring-2 dark:border-zinc-800 dark:bg-zinc-900"
					/>
				</div>

				<div className="grid grid-cols-2 gap-3">
					<div>
						<label className="mb-2 block text-sm text-zinc-600 dark:text-zinc-300">
							{units === "metric" ? "Height (cm)" : "Height (ft'in)"}
						</label>
						<input
							type="text"
							value={height}
							onChange={(e) => setHeight(e.target.value)}
							placeholder={units === "metric" ? "175" : "5'10"}
							className="w-full rounded-xl border border-zinc-200 bg-white p-3 outline-none ring-blue-500 focus:ring-2 dark:border-zinc-800 dark:bg-zinc-900"
						/>
					</div>
					<div>
						<label className="mb-2 block text-sm text-zinc-600 dark:text-zinc-300">
							{units === "metric" ? "Weight (kg)" : "Weight (lbs)"}
						</label>
						<input
							type="number"
							value={weight}
							onChange={(e) => setWeight(e.target.value)}
							placeholder={units === "metric" ? "70" : "154"}
							className="w-full rounded-xl border border-zinc-200 bg-white p-3 outline-none ring-blue-500 focus:ring-2 dark:border-zinc-800 dark:bg-zinc-900"
						/>
					</div>
				</div>

				<div>
					<label className="mb-2 block text-sm text-zinc-600 dark:text-zinc-300">Sex</label>
					<select
						value={sex}
						onChange={(e) => setSex(e.target.value as Sex)}
						className="w-full rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
					>
						<option value="male">Male</option>
						<option value="female">Female</option>
						<option value="other">Other</option>
					</select>
				</div>

				<div>
					<label className="mb-2 block text-sm text-zinc-600 dark:text-zinc-300">Units</label>
					<div className="grid grid-cols-2 gap-2">
						<button
							type="button"
							onClick={() => setUnits("metric")}
							className={`rounded-xl border p-2 text-sm ${
								units === "metric"
									? "border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950 dark:text-blue-200"
									: "border-zinc-200 bg-white text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
							}`}
						>
							Metric
						</button>
						<button
							type="button"
							onClick={() => setUnits("imperial")}
							className={`rounded-xl border p-2 text-sm ${
								units === "imperial"
									? "border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950 dark:text-blue-200"
									: "border-zinc-200 bg-white text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
							}`}
						>
							US
						</button>
					</div>
				</div>

				<button
					type="button"
					className="h-12 w-full rounded-2xl bg-blue-600 text-white shadow-md active:scale-[0.98] disabled:opacity-60"
					disabled={loading}
					onClick={async () => {
						setLoading(true);
						setError(null);
						try {
							const res = await fetch("/api/profile", {
								method: "POST",
								headers: { "Content-Type": "application/json" },
								body: JSON.stringify({
									name,
									sex,
									heightCm: units === "metric" ? Number(height) || 0 : undefined,
									weightKg: units === "metric" ? Number(weight) || 0 : undefined,
									units,
									heightImperial: units === "imperial" ? height : undefined,
									weightLbs: units === "imperial" ? Number(weight) || 0 : undefined,
								}),
							});
							if (!res.ok) {
								const j = await res.json().catch(() => ({}));
								throw new Error(j?.error ?? "Failed to save profile");
							}
							location.href = "/";
						} catch (e: any) {
							setError(e.message || "Failed to save profile");
						} finally {
							setLoading(false);
						}
					}}
				>
					{loading ? "Saving..." : "Save and continue"}
				</button>
				{error ? <p className="pt-2 text-center text-sm text-red-600">{error}</p> : null}
			</div>
		</div>
	);
}



