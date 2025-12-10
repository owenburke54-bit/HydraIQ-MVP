import { cookies } from "next/headers";
import { NextResponse } from "next/server";

async function getRefreshToken() {
	const cookieStore = await cookies();
	return cookieStore.get("whoop_refresh")?.value || "";
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
	const refreshToken = await getRefreshToken();
	if (!refreshToken) return NextResponse.json({ error: "Not connected. Call /api/whoop/connect" }, { status: 401 });

	// Always fetch a fresh access token
	const tokenPayload = await refresh(refreshToken);
	if (!tokenPayload) return NextResponse.json({ error: "Failed to refresh" }, { status: 401 });
	const accessToken = tokenPayload.access_token as string;
	const nextRefresh = tokenPayload.refresh_token as string | undefined;

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


