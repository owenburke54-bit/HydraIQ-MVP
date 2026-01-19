type Props = {
	actualMl: number;
	targetMl: number;
};

export default function HydrationProgressBar({ actualMl, targetMl }: Props) {
	const pct = Math.max(0, Math.min(100, Math.round((actualMl / Math.max(1, targetMl)) * 100)));
	return (
		<section className="mb-4 rounded-2xl border border-zinc-200/70 bg-white/95 p-4 shadow-[var(--shadow-md)] ring-1 ring-white/70 dark:border-zinc-800/70 dark:bg-zinc-900/85 dark:ring-zinc-900/40">
			<div className="flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400">
				<span className="tabular-nums">
					{Math.round(actualMl / 29.5735)} / {Math.round(Math.max(0, targetMl) / 29.5735)} oz
				</span>
				<span className="tabular-nums">{pct}%</span>
			</div>
			<div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-zinc-200/80 dark:bg-zinc-800/80">
				<div
					className="h-full rounded-full transition-[width] duration-500 ease-out"
					style={{
						width: `${pct}%`,
						background: "linear-gradient(90deg, #3b82f6 0%, #2563eb 100%)",
					}}
				/>
			</div>
		</section>
	);
}



