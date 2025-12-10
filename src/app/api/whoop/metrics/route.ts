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
	the constRaw = jar.get("whoop_access")?.value || "";
	try {
		return decodeURIComponent(the constRaw);
	} catch {
		return the constRaw;
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
	if (refreshToken) {
		const payload = await refresh(refreshToken);
		if (payload?.access_token) accessToken = payload.access_token;
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
	try {
		if (sleepRes.ok) {
			const sJson: any = await sleepRes.json();
			const records: any[] = Array.isArray(sJson?.records) ? sJson.records : [];
			if (records.length) {
				// Sum durations that fall within the day
				const totalMs = records.reduce((sum, s) => {
					const st = new Date(s.start).getTime();
					const en = new Date(s.end).getTime();
					return sum + Math.max(0, en - st);
				}, 0);
				sleepHours = Math.round((totalMs / (1000 * 60 * 60)) * 10) / 10;
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

	return NextResponse.json({ sleep_hours: sleepHours, recovery_score: recovery });
}


