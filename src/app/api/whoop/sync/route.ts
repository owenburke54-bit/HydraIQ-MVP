import { cookies } from "next/headers";
import { NextResponse } from "next/server";

async function getTokens() {
	const cookieStore = await cookies();
	const raw = cookieStore.get("whoop_tokens")?.value;
	if (!raw) return null as any;
	try {
		return JSON.parse(raw);
	} catch {
		return null as any;
	}
}

async function refresh(tokens: any) {
	const res = await fetch("https://api.prod.whoop.com/oauth/oauth2/token", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			grant_type: "refresh_token",
			refresh_token: tokens.refresh_token,
			client_id: process.env.WHOOP_CLIENT_ID!,
			client_secret: process.env.WHOOP_CLIENT_SECRET!,
		}),
	});
	if (!res.ok) return null;
	const next = await res.json();
	const cookieStore = await cookies();
	cookieStore.set("whoop_tokens", JSON.stringify(next), {
		httpOnly: true,
		secure: true,
		path: "/",
		maxAge: 60 * 60 * 24 * 30,
		sameSite: "lax",
	});
	return next;
}

export async function GET(req: Request) {
	const url = new URL(req.url);
	const date = url.searchParams.get("date");
	if (!date) return NextResponse.json({ error: "date required (YYYY-MM-DD)" }, { status: 400 });
	let tokens = await getTokens();
	if (!tokens) return NextResponse.json({ error: "Not connected. Call /api/whoop/connect" }, { status: 401 });
	const start = `${date}T00:00:00.000Z`;
	const end = `${date}T23:59:59.999Z`;
	const fetchData = async () => {
		const res = await fetch(`https://api.prod.whoop.com/developer/v1/activity?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`, {
			headers: { Authorization: `Bearer ${tokens.access_token}` },
		});
		return res;
	};
	let res = await fetchData();
	if (res.status === 401) {
		const next = await refresh(tokens);
		if (!next) return NextResponse.json({ error: "Failed to refresh" }, { status: 401 });
		tokens = next;
		res = await fetchData();
	}
	if (!res.ok) return NextResponse.json({ error: "Failed to fetch activities" }, { status: 500 });
	const data = await res.json();
	return NextResponse.json({ activities: data });
}


