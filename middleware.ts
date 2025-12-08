import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const AUTH_PREFIX = "/auth";
const ONBOARDING_PATH = "/onboarding";

export async function middleware(req: NextRequest) {
	const { pathname } = req.nextUrl;
	const isAuth = pathname.startsWith(AUTH_PREFIX);
	const isAPI = pathname.startsWith("/api");

	const res = NextResponse.next();
	const supabase = createServerClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
		{
			cookies: {
				get(name) {
					return req.cookies.get(name)?.value;
				},
				set(name, value, options) {
					res.cookies.set({ name, value, ...options });
				},
				remove(name, options) {
					res.cookies.set({ name, value: "", ...options });
				},
			},
		}
	);

	const {
		data: { user },
	} = await supabase.auth.getUser();

	// If on auth pages and already logged in, go home
	if (isAuth && user) {
		const url = req.nextUrl.clone();
		url.pathname = "/";
		return NextResponse.redirect(url);
	}

	// If not auth/api and no user, go to login
	if (!isAuth && !isAPI && !user) {
		const url = req.nextUrl.clone();
		url.pathname = "/auth/login";
		url.searchParams.set("redirect", pathname);
		return NextResponse.redirect(url);
	}

	// Enforce onboarding (skip auth/api/onboarding itself)
	if (user && !isAuth && !isAPI && !pathname.startsWith(ONBOARDING_PATH)) {
		try {
			const { data: profile } = await supabase
				.from("profiles")
				.select("sex, height_cm, weight_kg, units")
				.eq("id", user.id)
				.maybeSingle();
			const incomplete = !profile || !profile.sex || !profile.units || !profile.height_cm || !profile.weight_kg;
			if (incomplete) {
				const url = req.nextUrl.clone();
				url.pathname = ONBOARDING_PATH;
				return NextResponse.redirect(url);
			}
		} catch {}
	}

	return res;
}

export const config = {
	matcher: ["/(.*)"],
};


