"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "../../../lib/supabaseClient";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

function safeRedirectPath(value: string | null) {
  // Only allow internal relative paths to avoid open-redirects.
  if (!value) return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  return value;
}

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [redirect, setRedirect] = useState<string | null>(null);

  useEffect(() => {
    // ✅ Avoid useSearchParams() to prevent Suspense requirement /404 prerender issues.
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      setRedirect(safeRedirectPath(sp.get("redirect")));
    }
  }, []);

  const canSubmit = useMemo(() => {
    return !loading && email.trim().length > 3 && password.length > 0;
  }, [loading, email, password]);

  async function onSubmit() {
    if (!canSubmit) return;

    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabaseBrowserClient();

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      router.replace(redirect || "/");
    } catch (e: any) {
      setError(e?.message || "Supabase not configured");
      setLoading(false);
    }
  }

  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold">Log in</h1>

      <div className="mt-4 space-y-4">
        <div>
          <label className="mb-2 block text-sm text-zinc-600 dark:text-zinc-300">
            Email
          </label>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-white p-3 outline-none ring-blue-500 focus:ring-2 dark:border-zinc-800 dark:bg-zinc-900"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm text-zinc-600 dark:text-zinc-300">
            Password
          </label>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSubmit();
            }}
            className="w-full rounded-xl border border-zinc-200 bg-white p-3 outline-none ring-blue-500 focus:ring-2 dark:border-zinc-800 dark:bg-zinc-900"
            placeholder="••••••••"
          />
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <button
          type="button"
          disabled={!canSubmit}
          onClick={onSubmit}
          className="h-12 w-full rounded-2xl bg-blue-600 text-white shadow-md active:scale-[0.98] disabled:opacity-60"
        >
          {loading ? "Logging in..." : "Log in"}
        </button>

        <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
          No account?{" "}
          <Link href="/auth/signup" className="text-blue-600">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
