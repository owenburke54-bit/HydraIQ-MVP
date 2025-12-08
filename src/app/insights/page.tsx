import { getServerSupabase } from "../../lib/supabaseServer";
import RegenerateInsightsButton from "../../components/RegenerateInsightsButton";
import { Card } from "../../components/ui/Card";
import { headers } from "next/headers";

async function getBaseUrl() {
	const h = await headers();
	const host = h.get("x-forwarded-host") ?? h.get("host");
	const proto = h.get("x-forwarded-proto") ?? (host?.includes("localhost") ? "http" : "https");
	return `${proto}://${host}`;
}

async function getTrend(days: number) {
	const base = process.env.NEXT_PUBLIC_BASE_URL || (await getBaseUrl());
	const res = await fetch(`${base}/api/trend?days=${days}`, { cache: "no-store" });
	if (!res.ok) return [];
	return res.json();
}

async function getInsights() {
	const supabase = await getServerSupabase();
	const { data } = await supabase
		.from("insights")
		.select("id, title, body, severity, created_at")
		.order("created_at", { ascending: false })
		.limit(10);
	return data ?? [];
}

export default async function InsightsPage() {
	const points: { date: string; hydration_score: number; target_ml: number; actual_ml: number }[] = await getTrend(14);
	const insights = await getInsights();
	return (
		<div className="p-4">
			<h1 className="text-xl font-semibold">Insights</h1>
			<section className="mt-4">
				<Card className="p-4">
					<p className="text-sm text-zinc-600 dark:text-zinc-400">Hydration Score (last 14 days)</p>
					<div className="mt-3 h-40 w-full rounded-lg bg-gradient-to-b from-blue-200/60 to-blue-100/30 dark:from-blue-900/40 dark:to-blue-900/10" />
					<div className="mt-2 grid grid-cols-7 gap-2 text-center text-xs text-zinc-600 dark:text-zinc-400">
						{points.slice().reverse().slice(0, 7).map((p, idx) => (
							<div key={idx} className="rounded-md border border-zinc-200 p-2 dark:border-zinc-800">
								<div className="font-medium">{p.hydration_score ?? "-"}</div>
								<div className="mt-1">{p.date.slice(5)}</div>
							</div>
						))}
					</div>
				</Card>
			</section>
			<div className="mt-4 flex gap-3">
				<RegenerateInsightsButton />
			</div>
			<section className="mt-4 space-y-3">
				{insights.length === 0 ? (
					<div className="rounded-2xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
						No insights yet. Tap regenerate to create insights.
					</div>
				) : (
					insights.map((i: any) => (
						<Card
							key={i.id}
							className={`${
								i.severity === "critical"
									? "border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/40"
									: i.severity === "warning"
									? "border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/40"
									: "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
							}`}
						>
							<p className="p-4 font-medium">{i.title}</p>
							<p className="px-4 pb-4 text-zinc-700 dark:text-zinc-300">{i.body}</p>
						</Card>
					))
				)}
			</section>
		</div>
	);
}



