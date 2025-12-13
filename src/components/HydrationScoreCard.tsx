type Props = {
	score: number;
};

export default function HydrationScoreCard({ score }: Props) {
  const status =
    score >= 80 ? { label: "Great", className: "text-emerald-600" } :
    score >= 60 ? { label: "OK", className: "text-amber-600" } :
    { label: "Low", className: "text-rose-600" };

  const pct = Math.max(0, Math.min(100, score));
  const r = 38;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;

  return (
    <section className="mb-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-md dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">Today's Hydration Score</p>
        <span className={`text-xs font-medium ${status.className}`}>{status.label}</span>
      </div>
      <div className="mt-2 flex items-center gap-4">
        <svg viewBox="0 0 100 100" className="h-24 w-24">
          <circle cx="50" cy="50" r={r} stroke="#e5e7eb" strokeWidth="10" fill="none" />
          <circle
            cx="50"
            cy="50"
            r={r}
            stroke="url(#g)"
            strokeWidth="10"
            fill="none"
            strokeDasharray={`${dash} ${c - dash}`}
            strokeLinecap="round"
            transform="rotate(-90 50 50)"
          />
          <defs>
            <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#2563eb" />
            </linearGradient>
          </defs>
        </svg>
        <div className="flex flex-col">
          <span className="text-4xl font-bold text-zinc-900 dark:text-zinc-50">{score}</span>
          <span className="text-xs text-zinc-500">out of 100</span>
        </div>
      </div>
    </section>
  );
}



