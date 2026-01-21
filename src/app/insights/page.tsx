import dynamic from "next/dynamic";

const InsightsClient = dynamic(() => import("./InsightsClient"), {
  ssr: false,
  loading: () => (
    <div className="px-4 pb-4 pt-[calc(72px+env(safe-area-inset-top))]">
      <div className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
        Loading insights…
      </div>
    </div>
  ),
});

export default function InsightsPage() {
  return <InsightsClient />;
}
