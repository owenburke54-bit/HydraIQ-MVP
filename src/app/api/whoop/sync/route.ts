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

	const start = `${date}T00:00:00.000Z`;
	const end = `${date}T23:59:59.999Z`;
	const fetchData = async () => {
		const res = await fetch(`https://api.prod.whoop.com/developer/v1/activity?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`, {
			headers: { Authorization: `Bearer ${accessToken}` },
		});
		return res;
	};
	const res = await fetchData();
	if (!res.ok) return NextResponse.json({ error: "Failed to fetch activities" }, { status: 500 });
	const data = await res.json();

	// Return data and update refresh cookie if it rotated
	const out = NextResponse.json({ activities: data });
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


