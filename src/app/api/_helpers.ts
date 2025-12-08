import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { calculateHydrationScore, calculateHydrationTarget } from "../../lib/hydration";

export async function getRouteClient() {
	const cookieStore = await cookies();
	return createServerClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
		{
			cookies: {
				get(name) {
					return cookieStore.get(name)?.value;
				},
				set() {},
				remove() {},
			},
		}
	);
}

export async function requireUserId() {
	const supabase = await getRouteClient();
	const {
		data: { user },
		error,
	} = await supabase.auth.getUser();
	if (error || !user) {
		throw new Response("Unauthorized", { status: 401 });
	}
	return user.id;
}

export async function getProfileWeightKg(userId: string): Promise<{ weightKg: number; units: string | null }> {
	const supabase = await getRouteClient();
	const { data, error } = await supabase
		.from("profiles")
		.select("weight_kg, units")
		.eq("id", userId)
		.single();
	if (error) {
		// Default to 70kg if no profile yet
		return { weightKg: 70, units: null };
	}
	const weightKg = data?.weight_kg ?? 70;
	return { weightKg, units: data?.units ?? null };
}

export async function getOrCreateHydrationDay(userId: string, date: string) {
	const supabase = await getRouteClient();
	// Check existing
	const existing = await supabase
		.from("hydration_days")
		.select("*")
		.eq("user_id", userId)
		.eq("date", date)
		.maybeSingle();
	if (existing.data) return existing.data;

	// Compute target from profile + workouts
	const { weightKg } = await getProfileWeightKg(userId);
	const { data: workouts } = await supabase
		.from("workouts")
		.select("duration_min, intensity, start_time, end_time")
		.eq("user_id", userId)
		.filter("start_time", "gte", `${date}T00:00:00.000Z`)
		.filter("start_time", "lt", `${date}T23:59:59.999Z`);
	const workoutInputs = (workouts ?? [])
		.filter((w) => typeof w.duration_min === "number" && typeof w.intensity === "number")
		.map((w) => ({ durationMin: w.duration_min as number, intensity: w.intensity as number }));
	const target = calculateHydrationTarget({ weightKg, workouts: workoutInputs, isHotDay: false });

	const { data: inserted, error } = await supabase
		.from("hydration_days")
		.insert({
			user_id: userId,
			date,
			target_ml: target.targetMl,
			actual_ml: 0,
			hydration_score: 0,
			base_need_ml: target.baseNeedMl,
			workout_adjustment_ml: target.workoutAdjustmentMl,
			heat_adjustment_ml: target.heatAdjustmentMl,
		})
		.select("*")
		.single();
	if (error) throw new Response("Failed to create hydration day", { status: 500 });
	return inserted!;
}

export async function recalcDay(userId: string, date: string) {
	const supabase = await getRouteClient();
	const day = await getOrCreateHydrationDay(userId, date);
	const { data: intakes } = await supabase
		.from("intake_events")
		.select("timestamp, volume_ml")
		.eq("user_id", userId)
		.filter("timestamp", "gte", `${date}T00:00:00.000Z`)
		.filter("timestamp", "lt", `${date}T23:59:59.999Z`)
		.order("timestamp", { ascending: true });
	const { data: workouts } = await supabase
		.from("workouts")
		.select("start_time, end_time, duration_min, intensity")
		.eq("user_id", userId)
		.filter("start_time", "gte", `${date}T00:00:00.000Z`)
		.filter("start_time", "lt", `${date}T23:59:59.999Z`);

	const actualMl = (intakes ?? []).reduce((sum, i) => sum + (i.volume_ml as number), 0);
	const score = calculateHydrationScore({
		targetMl: day.target_ml,
		actualMl,
		intakes: (intakes ?? []).map((i) => ({
			timestamp: new Date(i.timestamp as string),
			volumeMl: i.volume_ml as number,
		})),
		workouts: (workouts ?? []).map((w) => ({
			start: new Date(w.start_time as string),
			end: w.end_time ? new Date(w.end_time as string) : new Date(new Date(w.start_time as string).getTime() + ((w.duration_min ?? 0) * 60000)),
		})),
	});

	await supabase
		.from("hydration_days")
		.update({ actual_ml: actualMl, hydration_score: score, updated_at: new Date().toISOString() })
		.eq("id", day.id);

	return { ...day, actual_ml: actualMl, hydration_score: score };
}

export async function getDaySummary(userId: string, date: string) {
	const supabase = await getRouteClient();
	const day = await getOrCreateHydrationDay(userId, date);
	const [{ data: intakes }, { data: workouts }] = await Promise.all([
		supabase
			.from("intake_events")
			.select("id, timestamp, volume_ml, type")
			.eq("user_id", userId)
			.eq("hydration_day_id", day.id)
			.order("timestamp", { ascending: true }),
		supabase
			.from("workouts")
			.select("id, start_time, end_time, duration_min, type, intensity")
			.eq("user_id", userId)
			.filter("start_time", "gte", `${date}T00:00:00.000Z`)
			.filter("start_time", "lt", `${date}T23:59:59.999Z`)
	]);
	return { day, intakes: intakes ?? [], workouts: workouts ?? [] };
}

export function ok(data: unknown, init?: number | ResponseInit) {
	return NextResponse.json(data, init);
}

export function bad(message: string, status = 400) {
	return NextResponse.json({ error: message }, { status });
}



