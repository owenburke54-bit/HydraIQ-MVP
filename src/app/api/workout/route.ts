import { bad, getDaySummary, getOrCreateHydrationDay, ok, requireUserId, recalcDay, getRouteClient, getProfileWeightKg } from "../_helpers";
import { calculateHydrationTarget } from "../../../lib/hydration";

export async function POST(request: Request) {
	try {
		const userId = await requireUserId();
		const body = await request.json();
		const startTime: string = body?.startTime;
		const endTime: string | undefined = body?.endTime;
		const durationMin: number | undefined = body?.durationMin;
		const type: string | undefined = body?.type;
		const intensity: number | undefined = body?.intensity;
		if (!startTime) return bad("startTime is required");
		const start = new Date(startTime);
		const date = start.toISOString().slice(0, 10);

		const supabase = getRouteClient();
		const { error: insertErr } = await supabase
			.from("workouts")
			.insert({
				user_id: userId,
				start_time: start.toISOString(),
				end_time: endTime ?? null,
				duration_min: durationMin ?? null,
				type: type ?? null,
				intensity: intensity ?? null,
			});
		if (insertErr) return bad("Failed to insert workout", 500);

		// Recompute target & score
		// Ensure day exists and has target based on current workouts
		await getOrCreateHydrationDay(userId, date);

		// Recompute target using latest workouts
		const { data: todaysWorkouts } = await supabase
			.from("workouts")
			.select("duration_min, intensity, start_time")
			.eq("user_id", userId)
			.filter("start_time", "gte", `${date}T00:00:00.000Z`)
			.filter("start_time", "lt", `${date}T23:59:59.999Z`);
		const { weightKg } = await getProfileWeightKg(userId);
		const target = calculateHydrationTarget({
			weightKg,
			workouts: (todaysWorkouts ?? [])
				.filter((w) => typeof w.duration_min === "number" && typeof w.intensity === "number")
				.map((w) => ({ durationMin: w.duration_min as number, intensity: w.intensity as number })),
			isHotDay: false,
		});
		await supabase
			.from("hydration_days")
			.update({
				target_ml: target.targetMl,
				base_need_ml: target.baseNeedMl,
				workout_adjustment_ml: target.workoutAdjustmentMl,
				heat_adjustment_ml: target.heatAdjustmentMl,
				updated_at: new Date().toISOString(),
			})
			.eq("user_id", userId)
			.eq("date", date);

		await recalcDay(userId, date);
		const summary = await getDaySummary(userId, date);
		return ok(summary);
	} catch (e: any) {
		if (e instanceof Response) return e;
		return bad("Unexpected error", 500);
	}
}


