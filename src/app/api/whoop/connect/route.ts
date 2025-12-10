import { NextResponse } from "next/server";

export async function GET() {
	const clientId = process.env.WHOOP_CLIENT_ID!;
	const redirectUri = process.env.WHOOP_REDIRECT_URI!;
	const scopes =
		process.env.WHOOP_SCOPES ||
		"offline_access read:recovery read:cycles read:workout read:sleep read:profile";
	const url = new URL("https://api.prod.whoop.com/oauth/oauth2/auth");
	url.searchParams.set("client_id", clientId);
	url.searchParams.set("redirect_uri", redirectUri);
	url.searchParams.set("response_type", "code");
	url.searchParams.set("scope", scopes);
	return NextResponse.redirect(url.toString());
}


