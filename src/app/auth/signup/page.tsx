"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function SignupPage() {
	const router = useRouter();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [message, setMessage] = useState<string | null>(null);

	async function onSubmit() {
		setLoading(true);
		setError(null);
		setMessage(null);
		const { error } = await supabase.auth.signUp({ email, password });
		setLoading(false);
		if (error) {
			setError(error.message);
			return;
		}
		setMessage("Check your email to confirm your account, then log in.");
		setTimeout(() => router.replace("/auth/login"), 1500);
	}

	return (
		<div className="p-4">
			<h1 className="text-xl font-semibold">Sign up</h1>
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
						placeholder="••••••••"
					/>
				</div>
				{error ? <p className="text-sm text-red-600">{error}</p> : null}
				{message ? <p className="text-sm text-green-600">{message}</p> : null}
				<button
					type="button"
					disabled={loading}
					onClick={onSubmit}
					className="h-12 w-full rounded-2xl bg-blue-600 text-white shadow-md active:scale-[0.98] disabled:opacity-60"
				>
					{loading ? "Signing up..." : "Create account"}
				</button>
				<p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
					Have an account?{" "}
					<Link href="/auth/login" className="text-blue-600">
						Log in
					</Link>
				</p>
			</div>
		</div>
	);
}


