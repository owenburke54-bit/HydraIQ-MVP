"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "../../../lib/supabaseClient";
import { useRouter, useSearchParams } from "next/navigation";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

function LoginInner() {
	const router = useRouter();
	const params = useSearchParams();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function onSubmit() {
		setLoading(true);
		setError(null);
		let error: { message: string } | null = null;
		try {
			const supabase = getSupabaseBrowserClient();
			const res = await supabase.auth.signInWithPassword({ email, password });
			error = res.error;
		} catch (e: any) {
			error = { message: e?.message || "Supabase not configured" };
		}
		setLoading(false);
		if (error) {
			setError(error.message);
			return;
		}
		const redirect = params.get("redirect") || "/";
		router.replace(redirect);
	}

	return (
		<div className="p-4">
			<h1 className="text-xl font-semibold">Log in</h1>
			<div className="mt-4 space-y-4">
				<div>
					<label className="mb-2 block text-sm text-zinc-600 dark:text-zinc-300">Email</label>
					<input
						type="email"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						className="w-full rounded-xl border border-zinc-200 bg-white p-3 outline-none ring-blue-500 focus:ring-2 dark:border-zinc-800 dark:bg-zinc-900"
						placeholder="you@example.com"
					/>
				</div>
				<div>
					<label className="mb-2 block text-sm text-zinc-600 dark:text-zinc-300">Password</label>
					<input
						type="password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						className="w-full rounded-xl border border-zinc-200 bg-white p-3 outline-none ring-blue-500 focus:ring-2 dark:border-zinc-800 dark:bg-zinc-900"
						placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
					/>
				</div>
				{error ? <p className="text-sm text-red-600">{error}</p> : null}
				<button
					type="button"
					disabled={loading}
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

export default function LoginPage() {
	return (
		<Suspense fallback={<div className="p-4">Loading...</div>}>
			<LoginInner />
		</Suspense>
	);
}



