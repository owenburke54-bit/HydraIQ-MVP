import { NextResponse } from "next/server";
import crypto from "node:crypto";

export const runtime = "nodejs";

export async function GET() {
	const clientId = process.env.WHOOP_CLIENT_ID!;
	const redirectUri = process.env.WHOOP_REDIRECT_URI!;
	const scopes =
		process.env.WHOOP_SCOPES ||
		"offline_access read:recovery read:cycles read:workout read:sleep read:profile";
	const url = new URL("https://api.prod.whoop.com/oauth/oauth2/auth");
	// Generate a CSRF state and include it in the request
	const state = crypto.randomBytes(16).toString("hex");
	url.searchParams.set("client_id", clientId);
	url.searchParams.set("redirect_uri", redirectUri);
	url.searchParams.set("response_type", "code");
	url.searchParams.set("scope", scopes);
	url.searchParams.set("state", state);

	const res = NextResponse.redirect(url.toString());
	// Persist state for verification in callback
	res.cookies.set("whoop_state", state, {
		httpOnly: true,
		secure: true,
		path: "/",
		sameSite: "lax",
		maxAge: 600, // 10 minutes
	});
	return res;
}


