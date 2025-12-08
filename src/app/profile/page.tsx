"use client";

import { useState } from "react";

export default function ProfilePage() {
	const [units, setUnits] = useState<"metric" | "imperial">("imperial");
	return (
		<div className="p-4">
			<h1 className="text-xl font-semibold">Profile</h1>
			<form className="mt-4 space-y-4">
				<div>
					<label className="mb-2 block text-sm text-zinc-600 dark:text-zinc-300">Name</label>
					<input
						type="text"
						placeholder="Your name"
						className="w-full rounded-xl border border-zinc-200 bg-white p-3 outline-none ring-blue-500 focus:ring-2 dark:border-zinc-800 dark:bg-zinc-900"
					/>
				</div>
				<div>
					<label className="mb-2 block text-sm text-zinc-600 dark:text-zinc-300">Sex</label>
					<select className="w-full rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
						<option value="male">Male</option>
						<option value="female">Female</option>
						<option value="other">Other</option>
					</select>
				</div>
				<div className="grid grid-cols-2 gap-3">
					<div>
						<label className="mb-2 block text-sm text-zinc-600 dark:text-zinc-300">
							{units === "metric" ? "Height (cm)" : "Height (ft/in)"}
						</label>
						<input
							type="text"
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
							placeholder={units === "metric" ? "70" : "154"}
							className="w-full rounded-xl border border-zinc-200 bg-white p-3 outline-none ring-blue-500 focus:ring-2 dark:border-zinc-800 dark:bg-zinc-900"
						/>
					</div>
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
					className="h-12 w-full rounded-2xl bg-blue-600 text-white shadow-md active:scale-[0.98]"
					onClick={() => alert("Saved profile (placeholder)")}
				>
					Save
				</button>
			</form>
		</div>
	);
}


