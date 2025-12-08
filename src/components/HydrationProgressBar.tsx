type Props = {
	actualMl: number;
	targetMl: number;
};

export default function HydrationProgressBar({ actualMl, targetMl }: Props) {
	const pct = Math.max(0, Math.min(100, Math.round((actualMl / Math.max(1, targetMl)) * 100)));
	return (
		<section className="mb-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-md dark:border-zinc-800 dark:bg-zinc-900">
			<div className="flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400">
				<span>
					{actualMl} / {targetMl} ml
				</span>
				<span>{pct}%</span>
			</div>
			<div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
				<div
					className="h-full rounded-full bg-blue-600"
					style={{ width: `${pct}%` }}
				/>
			</div>
		</section>
	);
}


