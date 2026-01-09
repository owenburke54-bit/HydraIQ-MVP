"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

type HistoryRow = {
  day: string;
  hydration_score: number;
  total_oz: number;
  sleep_hours: number | null;
  recovery_pct: number | null;
};

export default function HistoryPage() {
  const [data, setData] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/history?days=30")
      .then((res) => res.json())
      .then((d) => setData(d ?? []))
      .finally(() => setLoading(false));
  }, []);

  const avgScore = useMemo(() => {
    if (!data.length) return 0;
    return Math.round(
      data.reduce((s, d) => s + d.hydration_score, 0) / data.length
    );
  }, [data]);

  return (
    <div className="space-y-6 pb-24">
      <h1 className="text-2xl font-semibold">History</h1>

      <Card>
        <CardHeader>
          <CardTitle>Last 30 days</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && <p className="text-sm text-zinc-500">Loading…</p>}
          {!loading && !data.length && (
            <p className="text-sm text-zinc-500">No history yet.</p>
          )}

          {!loading && data.length > 0 && (
            <div className="space-y-2">
              {data.map((row) => (
                <div
                  key={row.day}
                  className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                >
                  <span>{row.day}</span>
                  <span className="font-medium">{row.hydration_score}</span>
                  <span className="text-zinc-500">
                    {Math.round(row.total_oz)} oz
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Average hydration score</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-semibold">{avgScore}</p>
        </CardContent>
      </Card>
    </div>
  );
}
