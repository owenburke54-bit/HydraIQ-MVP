"use client";

type Slice = { label: string; value: number; color: string };

export default function Donut({ slices, size = 160, showLegend = true }: { slices: Slice[]; size?: number; showLegend?: boolean }) {
  const total = Math.max(1, slices.reduce((s, x) => s + x.value, 0));
  const c = size / 2;
  const r = c - 10;
  const circumference = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="flex items-center gap-4">
      <svg viewBox={`0 0 ${size} ${size}`} className="block">
        <g transform={`translate(${c},${c})`}>
          <circle r={r} cx={0} cy={0} fill="none" stroke="#e5e7eb" strokeWidth="14" />
          {slices.map((s, i) => {
            const frac = s.value / total;
            const dash = circumference * frac;
            const gap = circumference - dash;
            const rot = (acc / total) * 360;
            acc += s.value;
            return (
              <g key={i} transform={`rotate(${-90 + rot})`}>
                <circle r={r} cx={0} cy={0} fill="none" stroke={s.color} strokeWidth="14" strokeDasharray={`${dash} ${gap}`} />
              </g>
            );
          })}
          <circle r={r - 18} cx={0} cy={0} fill="white" />
        </g>
      </svg>
      {showLegend ? (
        <div className="text-sm">
          {slices.map((s, i) => {
            const pct = Math.round((s.value / total) * 100);
            return (
              <div key={i} className="flex items-center gap-2 py-1">
                <span className="inline-block h-2 w-2 rounded" style={{ backgroundColor: s.color }} />
                <span className="text-zinc-700 dark:text-zinc-200">{s.label}</span>
                <span className="text-zinc-500">• {pct}%</span>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}


