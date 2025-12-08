import { bad, ok, requireUserId, getRouteClient } from "../_helpers";

export async function GET(request: Request) {
	try {
		const userId = await requireUserId();
		const { searchParams } = new URL(request.url);
		const days = Math.max(1, Math.min(90, Number(searchParams.get("days") ?? 30)));
		const supabase = await getRouteClient();
		const { data, error } = await supabase
			.from("hydration_days")
			.select("date, hydration_score, target_ml, actual_ml")
			.eq("user_id", userId)
			.order("date", { ascending: false })
			.limit(days);
		if (error) return bad("Failed to fetch trend", 500);
		return ok(data ?? []);
	} catch (e: any) {
		if (e instanceof Response) return e;
		return bad("Unexpected error", 500);
	}
}



