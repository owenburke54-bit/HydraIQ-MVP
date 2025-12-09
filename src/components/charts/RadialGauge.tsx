"use client";

type Props = {
  value: number; // 0..1
  label?: string;
  size?: number;
};

export default function RadialGauge({ value, label, size = 160 }: Props) {
  const clamped = Math.max(0, Math.min(1, value || 0));
  const r = size / 2 - 10;
  const c = size / 2;
  const circumference = Math.PI * r;
  const dash = circumference * clamped;
  const gap = circumference - dash;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="block">
      <g transform={`translate(${c},${c}) rotate(-90)`}>
        <circle r={r} cx={0} cy={0} stroke="#e5e7eb" strokeWidth="10" fill="none" strokeDasharray={`${circumference}`} />
        <circle
          r={r}
          cx={0}
          cy={0}
          stroke="#2563eb"
          strokeWidth="10"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${gap}`}
        />
      </g>
      <text x={c} y={c} textAnchor="middle" dominantBaseline="central" className="fill-zinc-900 dark:fill-zinc-100" fontSize="24">
        {Math.round(clamped * 100)}%
      </text>
      {label ? (
        <text x={c} y={c + 24} textAnchor="middle" className="fill-zinc-500" fontSize="12">
          {label}
        </text>
      ) : null}
    </svg>
  );
}


