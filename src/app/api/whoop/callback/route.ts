import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
	const { searchParams } = new URL(req.url);
	const code = searchParams.get("code");
	if (!code) return NextResponse.redirect("/");
	try {
		const tokenRes = await fetch("https://api.prod.whoop.com/oauth/oauth2/token", {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				grant_type: "authorization_code",
				code,
				redirect_uri: process.env.WHOOP_REDIRECT_URI!,
				client_id: process.env.WHOOP_CLIENT_ID!,
				client_secret: process.env.WHOOP_CLIENT_SECRET!,
			}),
		});
		if (!tokenRes.ok) return NextResponse.redirect("/");
		const tokens = await tokenRes.json();
		const cookieStore = await cookies();
		cookieStore.set("whoop_tokens", JSON.stringify(tokens), {
			httpOnly: true,
			secure: true,
			path: "/",
			maxAge: 60 * 60 * 24 * 30,
			sameSite: "lax",
		});
	} catch {}
	return NextResponse.redirect("/");
}


