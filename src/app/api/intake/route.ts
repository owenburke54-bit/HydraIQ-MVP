import { bad, getDaySummary, getOrCreateHydrationDay, ok, recalcDay, requireUserId, getRouteClient } from "../_helpers";

export async function POST(request: Request) {
	try {
		const userId = await requireUserId();
		const body = await request.json();
		const volumeMl: number = body?.volumeMl;
		const type: "water" | "electrolyte" | "other" = body?.type ?? "water";
		const tsString: string | undefined = body?.timestamp;
		if (!volumeMl || volumeMl <= 0) return bad("volumeMl must be > 0");
		const timestamp = tsString ? new Date(tsString) : new Date();
		const date = timestamp.toISOString().slice(0, 10);

		// Ensure day exists
		const day = await getOrCreateHydrationDay(userId, date);

		// Insert intake
		const supabase = await getRouteClient();
		const { error: insertErr } = await supabase
			.from("intake_events")
			.insert({
				user_id: userId,
				hydration_day_id: day.id,
				timestamp: timestamp.toISOString(),
				volume_ml: volumeMl,
				type,
			});
		if (insertErr) {
			console.error("intake insert error:", insertErr);
			return bad(insertErr.message ?? "Failed to insert intake", 500);
		}

		// Recalculate day
		await recalcDay(userId, date);

		const summary = await getDaySummary(userId, date);
		return ok(summary);
	} catch (e: any) {
		if (e instanceof Response) return e;
		return bad("Unexpected error", 500);
	}
}



