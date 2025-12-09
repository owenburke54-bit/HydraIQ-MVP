"use client";

type Slice = { label: string; value: number; color: string };

export default function Donut({ slices, size = 160 }: { slices: Slice[]; size?: number }) {
  const total = Math.max(1, slices.reduce((s, x) => s + x.value, 0));
  const c = size / 2;
  const r = c - 10;
  const circumference = 2 * Math.PI * r;
  let acc = 0;
  return (
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
  );
}


