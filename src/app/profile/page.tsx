"use client";

import { useEffect, useState } from "react";

type Units = "metric" | "imperial";
type Sex = "male" | "female" | "other";

export default function ProfilePage() {
	const [name, setName] = useState<string>("");
	const [sex, setSex] = useState<Sex>("other");
	const [height, setHeight] = useState<string>("");
	const [weight, setWeight] = useState<string>("");
	const [units, setUnits] = useState<Units>("imperial");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [message, setMessage] = useState<string | null>(null);

	useEffect(() => {
		(async () => {
			try {
				const res = await fetch("/api/profile", { method: "GET" });
				if (!res.ok) return;
				const p = await res.json();
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
			<h1 className="text-xl font-semibold">Profile</h1>
			<div className="mt-4 space-y-4">
				<div>
					<label className="mb-2 block text-sm text-zinc-600 dark:text-zinc-300">Name</label>
					<input
						type="text"
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="Your name"
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
					disabled={loading}
					className="h-12 w-full rounded-2xl bg-blue-600 text-white shadow-md active:scale-[0.98] disabled:opacity-60"
					onClick={async () => {
						setLoading(true);
						setError(null);
						setMessage(null);
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
								if (res.status === 401) {
                                    window.location.href = "/auth/login?redirect=/profile";
									return;
								}
								const j = await res.json().catch(() => ({}));
								throw new Error(j?.error ?? "Failed to save profile");
							}
							setMessage("Saved!");
							setTimeout(() => (window.location.href = "/"), 800);
						} catch (e: any) {
							setError(e.message || "Failed to save profile");
						} finally {
							setLoading(false);
						}
					}}
				>
					{loading ? "Saving..." : "Save"}
				</button>
				{error ? <p className="text-center text-sm text-red-600">{error}</p> : null}
				{message ? <p className="text-center text-sm text-green-600">{message}</p> : null}
			</div>
		</div>
	);
}
