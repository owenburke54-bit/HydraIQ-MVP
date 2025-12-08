import { bad, getDaySummary, ok, requireUserId, recalcDay, getRouteClient } from "../_helpers";

export async function GET(request: Request) {
	try {
		const userId = await requireUserId();
		const { searchParams } = new URL(request.url);
		const date = searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
		// Ensure up-to-date
		await recalcDay(userId, date);
		const summary = await getDaySummary(userId, date);
		// Include supplements for the day
		const supabase = getRouteClient();
		const { data: supplements } = await supabase
			.from("supplement_events")
			.select("id, timestamp, type")
			.eq("user_id", userId)
			.filter("timestamp", "gte", `${date}T00:00:00.000Z`)
			.filter("timestamp", "lt", `${date}T23:59:59.999Z`)
			.order("timestamp", { ascending: true });
		return ok({ ...summary, supplements: supplements ?? [] });
	} catch (e: any) {
		if (e instanceof Response) return e;
		return bad("Unexpected error", 500);
	}
}



