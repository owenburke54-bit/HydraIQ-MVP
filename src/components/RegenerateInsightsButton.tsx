"use client";

import { useState } from "react";

export default function RegenerateInsightsButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <button
      className="h-11 flex-1 rounded-2xl border border-zinc-200 bg-white text-sm shadow-sm active:scale-[0.98] disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-900"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        setError(null);
        try {
          const res = await fetch("/api/insights/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rangeDays: 14 }),
          });
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            throw new Error(j?.error ?? "Failed to generate insights");
          }
          location.reload();
        } catch (e: any) {
          setError(e.message || "Failed to generate insights");
        } finally {
          setLoading(false);
        }
      }}
    >
      {loading ? "Generating..." : "Regenerate insights"}
    </button>
  );
}


