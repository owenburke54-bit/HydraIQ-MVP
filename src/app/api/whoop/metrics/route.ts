import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

async function getRefreshToken() {
	const jar = await cookies();
	const raw = jar.get("whoop_refresh")?.value || "";
	try {
		return decodeURIComponent(raw);
	} catch {
		return raw;
	}
}

async function getAccessTokenFromCookie() {
	const jar = await cookies();
	const raw = jar.get("whoop_access")?.value || "";
	try {
		return decodeURIComponent(raw);
	} catch {
		return raw;
	}
}

async function refresh(refreshToken: string) {
	const res = await fetch("https://api.prod.whoop.com/oauth/oauth2/token", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			grant_type: "refresh_token",
			refresh_token: refreshToken,
			client_id: process.env.WHOOP_CLIENT_ID!,
			client_secret: process.env.WHOOP_CLIENT_SECRET!,
		}),
	});
	if (!res.ok) return null;
	return await res.json();
}

export async function GET(req: Request) {
	const url = new URL(req.url);
	const date = url.searchParams.get("date");
	if (!date) return NextResponse.json({ error: "date required (YYYY-MM-DD)" }, { status: 400 });

	// Acquire token: prefer refresh, fallback to short-lived access cookie
	const refreshToken = await getRefreshToken();
	let accessToken: string | null = null;
	let nextRefresh: string | undefined;
	if (refreshToken) {
		const payload = await refresh(refreshToken);
		if (payload?.access_token) {
			accessToken = payload.access_token;
			nextRefresh = payload.refresh_token as string | undefined;
		}
	}
	if (!accessToken) {
		accessToken = (await getAccessTokenFromCookie()) || null;
	}
	if (!accessToken) return NextResponse.json({ error: "Not connected" }, { status: 401 });

	const start = `${date}T00:00:00.000Z`;
	const end = `${date}T23:59:59.999Z`;

	// v2 endpoints
	const sleepUrl = `https://api.prod.whoop.com/developer/v2/activity/sleep?start=${encodeURIComponent(
		start
	)}&end=${encodeURIComponent(end)}&limit=25`;
	const recoveryUrl = `https://api.prod.whoop.com/developer/v2/recovery?start=${encodeURIComponent(
		start
	)}&end=${encodeURIComponent(end)}&limit=25`;

	const [sleepRes, recRes] = await Promise.all([
		fetch(sleepUrl, { headers: { Authorization: `Bearer ${accessToken}` } }),
		fetch(recoveryUrl, { headers: { Authorization: `Bearer ${accessToken}` } }),
	]);

	let sleepHours: number | null = null;
	let sleepPerformance: number | null = null;
	try {
		if (sleepRes.ok) {
			const sJson: any = await sleepRes.json();
			const records: any[] = Array.isArray(sJson?.records) ? sJson.records : [];
			if (records.length) {
				// Prefer time asleep (sum of stage durations) over time in bed
				const totalMs = records.reduce((sum, s) => {
					const stage = (s?.score?.stage_summary ?? {}) as Record<string, any>;
					const light = Number(stage.total_light_sleep_time_milli) || 0;
					const sws = Number(stage.total_slow_wave_sleep_time_milli) || 0;
					const rem = Number(stage.total_rem_sleep_time_milli) || 0;
					const asleep = light + sws + rem;
					if (asleep > 0) return sum + asleep;
					const st = s?.start ? new Date(s.start).getTime() : NaN;
					const en = s?.end ? new Date(s.end).getTime() : NaN;
					return Number.isFinite(st) && Number.isFinite(en) ? sum + Math.max(0, en - st) : sum;
				}, 0);
				sleepHours = Math.round((totalMs / (1000 * 60 * 60)) * 10) / 10;

				// Prefer WHOOP sleep performance percentage (0-100). Choose the max across records.
				const perfs: number[] = records
					.map((s) => {
						const v = Number(s?.score?.sleep_performance_percentage);
						return Number.isFinite(v) ? v : NaN;
					})
					.filter((v) => Number.isFinite(v)) as number[];
				if (perfs.length) {
					// round to nearest integer percentage
					sleepPerformance = Math.round(Math.max(...perfs));
				}
			}
		}
	} catch {}

	let recovery: number | null = null;
	try {
		if (recRes.ok) {
			const rJson: any = await recRes.json();
			const records: any[] = Array.isArray(rJson?.records) ? rJson.records : [];
			if (records.length) {
				const rec = records[0];
				if (typeof rec?.score?.recovery_score === "number") {
					recovery = rec.score.recovery_score;
				}
			}
		}
	} catch {}

	// Return and refresh cookies so metrics persist through the day
	const out = NextResponse.json({
		sleep_hours: sleepHours,
		sleep_performance: sleepPerformance,
		recovery_score: recovery,
	});
	try {
		if (nextRefresh && nextRefresh !== refreshToken) {
			out.cookies.set("whoop_refresh", nextRefresh, {
				httpOnly: true,
				secure: true,
				path: "/",
				maxAge: 60 * 60 * 24 * 30,
				sameSite: "lax",
			});
		}
		out.cookies.set("whoop_access", encodeURIComponent(accessToken), {
			httpOnly: true,
			secure: true,
			path: "/",
			maxAge: 30 * 60,
			sameSite: "lax",
		});
	} catch {}
	return out;
}

