import { cookies } from "next/headers";
import { NextResponse } from "next/server";

// Ensure Node runtime so cookies() behaves consistently and we can use standard node APIs if needed.
export const runtime = "nodejs";

async function getRefreshToken() {
	const cookieStore = await cookies();
	const raw = cookieStore.get("whoop_refresh")?.value || "";
	try {
		return decodeURIComponent(raw);
	} catch {
		return raw;
	}
}

async function getAccessTokenFromCookie() {
	const cookieStore = await cookies();
	const raw = cookieStore.get("whoop_access")?.value || "";
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

	// Prefer refresh flow if available
	const refreshToken = await getRefreshToken();
	let accessToken: string | null = null;
	let nextRefresh: string | undefined;
	if (refreshToken) {
		const tokenPayload = await refresh(refreshToken);
		if (!tokenPayload) {
			// Try access token cookie fallback
			accessToken = (await getAccessTokenFromCookie()) || null;
			if (!accessToken) {
				return NextResponse.json({ error: "Failed to refresh" }, { status: 401 });
			}
		} else {
			accessToken = tokenPayload.access_token as string;
			nextRefresh = tokenPayload.refresh_token as string | undefined;
		}
	} else {
		// No refresh token (offline_access not granted) – use short-lived access token set at callback
		accessToken = (await getAccessTokenFromCookie()) || null;
		if (!accessToken) {
			return NextResponse.json({ error: "Not connected. Call /api/whoop/connect" }, { status: 401 });
		}
	}

	// Build a slightly wider UTC window (prev day 00:00Z → next day 23:59Z) to avoid time zone misses.
	// We'll filter to the requested New York date after fetching.
	const base = new Date(`${date}T00:00:00.000Z`);
	const prev = new Date(base.getTime() - 24 * 60 * 60 * 1000);
	const next = new Date(base.getTime() + 24 * 60 * 60 * 1000);
	const start = prev.toISOString().slice(0, 23) + "Z";
	const end = new Date(next.getTime() + (24 * 60 * 60 * 1000 - 1)).toISOString().slice(0, 23) + "Z";
	const fetchData = async () => {
		// WHOOP: use singular "activity" endpoint
		const res = await fetch(`https://api.prod.whoop.com/developer/v1/activity?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`, {
			headers: { Authorization: `Bearer ${accessToken}` },
		});
		return res;
	};
	const res = await fetchData();
	// Gracefully treat "no content" or "not found" as zero activities
	if (res.status === 204 || res.status === 404) {
		return NextResponse.json({ activities: [] }, { status: 200 });
	}

	if (!res.ok) {
		// Surface WHOOP's error details for easier debugging
		let body: any = null;
		try {
			const text = await res.text();
			try {
				body = JSON.parse(text);
			} catch {
				body = text;
			}
		} catch {}
		return NextResponse.json(
			{ error: "WHOOP request failed", status: res.status, body },
			{ status: res.status }
		);
	}

	const data = await res.json();

	// Filter activities to the exact New York day requested
	const formatNYDate = (d: Date) => {
		const parts = new Intl.DateTimeFormat("en-CA", {
			timeZone: "America/New_York",
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
		}).formatToParts(d);
		const y = parts.find((p) => p.type === "year")?.value ?? "0000";
		const m = parts.find((p) => p.type === "month")?.value ?? "01";
		const dd = parts.find((p) => p.type === "day")?.value ?? "01";
		return `${y}-${m}-${dd}`;
	};

	let filtered = Array.isArray(data) ? data.filter((a: any) => {
		const s = a?.start ?? a?.start_time ?? a?.created_at;
		if (!s) return false;
		const dt = new Date(s);
		return formatNYDate(dt) === date;
	}) : [];

	// Return data and update refresh cookie if it rotated
	const out = NextResponse.json({ activities: filtered });
	if (nextRefresh && nextRefresh !== refreshToken) {
		out.cookies.set("whoop_refresh", nextRefresh, {
			httpOnly: true,
			secure: true,
			path: "/",
			maxAge: 60 * 60 * 24 * 30,
			sameSite: "lax",
		});
	}
	return out;
}


