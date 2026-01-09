"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

type HistoryRow = {
  day: string;
  hydration_score: number;
  total_oz: number;
  base_need_oz?: number;
  workouts_oz?: number;
  creatine_oz?: number;
  supplements_oz?: number;
  sleep_oz?: number;
  recovery_oz?: number;
  sleep_hours: number | null;
  recovery_pct: number | null;
};

function pearsonCorrelation(x: number[], y: number[]) {
  const n = Math.min(x.length, y.length);
  if (n < 2) return null;

  const mean = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;
  const mx = mean(x);
  const my = mean(y);

  let num = 0;
  let dx = 0;
  let dy = 0;

  for (let i = 0; i < n; i++) {
    const vx = x[i] - mx;
    const vy = y[i] - my;
    num += vx * vy;
    dx += vx * vx;
    dy += vy * vy;
  }

  const denom = Math.sqrt(dx * dy);
  if (!denom) return null;
  return num / denom;
}

export default function HistoryPage() {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/history?days=60")
      .then((res) => res.json())
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  const correlations = useMemo(() => {
    const score = rows.map((r) => r.hydration_score);
    const sleep = rows.filter((r) => r.sleep_hours != null).map((r) => r.sleep_hours as number);
    const recovery = rows.filter((r) => r.recovery_pct != null).map((r) => r.recovery_pct as number);

    return {
      sleep: pearsonCorrelation(
        rows.filter((r) => r.sleep_hours != null).map((r) => r.hydration_score),
        sleep
      ),
      recovery: pearsonCorrelation(
        rows.filter((r) => r.recovery_pct != null).map((r) => r.hydration_score),
        recovery
      ),
    };
  }, [rows]);

  return (
    <div className="space-y-6 pb-24">
      <h1 className="text-2xl font-semibold">History</h1>

      <Card>
        <CardHeader>
          <CardTitle>Correlations (last 60 days)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div>
            Hydration score vs sleep:{" "}
            <span className="font-medium">
              {correlations.sleep == null ? "—" : correlations.sleep.toFixed(2)}
            </span>
          </div>
          <div>
            Hydration score vs recovery:{" "}
            <span className="font-medium">
              {correlations.recovery == null ? "—" : correlations.recovery.toFixed(2)}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Daily history</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && <p className="text-sm text-zinc-500">Loading…</p>}
          {!loading && rows.length === 0 && (
            <p className="text-sm text-zinc-500">No history yet.</p>
          )}

          {!loading && rows.length > 0 && (
            <div className="space-y-2">
              {rows.map((r) => (
                <div
                  key={r.day}
                  className="grid grid-cols-4 gap-2 rounded-lg border px-3 py-2 text-sm"
                >
                  <div>{r.day}</div>
                  <div className="font-medium">{r.hydration_score}</div>
                  <div>{Math.round(r.total_oz)} oz</div>
                  <div className="text-zinc-500">
                    {(r.workouts_oz ?? 0) +
                      (r.creatine_oz ?? 0) +
                      (r.supplements_oz ?? 0)}{" "}
                    oz drivers
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
