type Props = {
	score: number;
};

export default function HydrationScoreCard({ score }: Props) {
	const status =
		score >= 80 ? { label: "Great", className: "text-green-600" } :
		score >= 60 ? { label: "OK", className: "text-amber-600" } :
		{ label: "Low", className: "text-red-600" };

	return (
		<section className="mb-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-md dark:border-zinc-800 dark:bg-zinc-900">
			<p className="text-sm text-zinc-500">Todayâ€™s Hydration Score</p>
			<div className="mt-2 flex items-end gap-2">
				<span className="text-4xl font-bold text-zinc-900 dark:text-zinc-50">
					{score}
				</span>
				<span className={`text-sm ${status.className}`}>{status.label}</span>
			</div>
		</section>
	);
}



