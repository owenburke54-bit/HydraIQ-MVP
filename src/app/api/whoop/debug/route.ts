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

	// Acquire token (prefer refresh, fall back to access cookie)
	const refreshToken = await getRefreshToken();
	let accessToken: string | null = null;
	let used = "access_cookie";
	if (refreshToken) {
		const payload = await refresh(refreshToken);
		if (payload?.access_token) {
			accessToken = payload.access_token;
			used = "refresh_exchange";
		}
	}
	if (!accessToken) {
		accessToken = (await getAccessTokenFromCookie()) || null;
		used = "access_cookie";
	}
	if (!accessToken) {
		return NextResponse.json({ error: "no token available" }, { status: 401 });
	}

	const start = `${date}T00:00:00.000Z`;
	const end = `${date}T23:59:59.999Z`;
	const endpointV2 = `https://api.prod.whoop.com/developer/v2/activity/workout?start=${encodeURIComponent(
		start
	)}&end=${encodeURIComponent(end)}&limit=200`;
	const endpointV1 = `https://api.prod.whoop.com/developer/v1/activities?start=${encodeURIComponent(
		start
	)}&end=${encodeURIComponent(end)}`;

	const resV2 = await fetch(endpointV2, { headers: { Authorization: `Bearer ${accessToken}` } });
	let bodyV2 = "";
	try { bodyV2 = await resV2.text(); } catch {}

	let resV1Status = null;
	let resV1Ok = null;
	let bodyV1 = "";
	if (resV2.status === 404) {
		const resV1 = await fetch(endpointV1, { headers: { Authorization: `Bearer ${accessToken}` } });
		resV1Status = resV1.status;
		resV1Ok = resV1.ok;
		try { bodyV1 = await resV1.text(); } catch {}
	}

	return NextResponse.json({
		request: { start, end, endpointV2, endpointV1 },
		auth: { used, hasRefresh: Boolean(refreshToken) },
		whoopV2: { status: resV2.status, ok: resV2.ok, body: bodyV2 },
		whoopV1: resV1Status ? { status: resV1Status, ok: resV1Ok, body: bodyV1 } : null,
	});
}


