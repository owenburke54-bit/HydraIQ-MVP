"use client";

type Cell = { date: string; value: number }; // 0..100

export default function CalendarHeatmap({ cells }: { cells: Cell[] }) {
  const w = 320;
  const cell = 18;
  const gap = 4;
  // show last 14 days in 2 rows of 7
  const last14 = cells.slice(-14);
  return (
    <svg viewBox={`0 0 ${w} ${cell * 2 + gap}`} className="block w-full">
      {last14.map((c, i) => {
        const row = Math.floor(i / 7);
        const col = i % 7;
        const x = col * (cell + gap);
        const y = row * (cell + gap);
        const v = Math.max(0, Math.min(100, c.value || 0));
        const colr = lerpColor("#fee2e2", "#22c55e", v / 100);
        return <rect key={c.date} x={x} y={y} width={cell} height={cell} rx="4" fill={colr} />;
      })}
    </svg>
  );
}

function lerpColor(a: string, b: string, t: number) {
  const pa = parse(a), pb = parse(b);
  const pc = pa.map((av, i) => Math.round(av + (pb[i] - av) * t));
  return `rgb(${pc[0]},${pc[1]},${pc[2]})`;
}
function parse(hex: string) {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return [r, g, b];
}


