import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

export async function GET(req: Request) {
	const url = new URL(req.url);
	const home = new URL("/", url);

	try {
		const code = url.searchParams.get("code");
		const cookieStore = await cookies();

		// If missing or test/error, don’t try to exchange; just bounce back cleanly.
		if (!code || code === "test" || url.searchParams.has("error")) {
			return NextResponse.redirect(new URL("/?whoop=auth_error", url));
		}

		// Validate OAuth state to prevent CSRF
		const returnedState = url.searchParams.get("state") || "";
		const expectedState = cookieStore.get("whoop_state")?.value || "";
		if (!returnedState || returnedState.length < 8 || !expectedState || expectedState !== returnedState) {
			return NextResponse.redirect(new URL("/?whoop=state_mismatch", url));
		}

		const tokenRes = await fetch("https://api.prod.whoop.com/oauth/oauth2/token", {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				grant_type: "authorization_code",
				code,
				redirect_uri: process.env.WHOOP_REDIRECT_URI || "",
				client_id: process.env.WHOOP_CLIENT_ID || "",
				client_secret: process.env.WHOOP_CLIENT_SECRET || "",
			}),
		});

		if (!tokenRes.ok) {
			return NextResponse.redirect(new URL("/?whoop=auth_error", url));
		}

		const tokens = await tokenRes.json();
		const refreshToken = tokens?.refresh_token || "";
		const accessToken = tokens?.access_token || "";
		const expiresInSec = Number(tokens?.expires_in) || 1800; // default 30 minutes
		// Clear one-time state cookie and set a compact refresh cookie on the redirect response
		const res = NextResponse.redirect(new URL("/?whoop=connected", url));
		res.cookies.set("whoop_state", "", { path: "/", maxAge: 0 });
		if (refreshToken) {
			// Encode to ensure it is cookie-safe across all characters
			res.cookies.set("whoop_refresh", encodeURIComponent(refreshToken), {
				httpOnly: true,
				secure: true,
				path: "/",
				maxAge: 60 * 60 * 24 * 30,
				sameSite: "lax",
			});
		}
		// Fallback for apps that cannot request offline_access (no refresh token).
		// Store short-lived access token so the next sync call can succeed immediately.
		if (!refreshToken && accessToken) {
			res.cookies.set("whoop_access", encodeURIComponent(accessToken), {
				httpOnly: true,
				secure: true,
				path: "/",
				maxAge: Math.max(300, Math.min(3600, expiresInSec)), // 5min–1h bounds
				sameSite: "lax",
			});
		}
		return res;
	} catch (e) {
		return NextResponse.redirect(home);
	}
}


