import { bad, ok, requireUserId, getRouteClient } from "../_helpers";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export async function GET(request: Request) {
  try {
    const userId = await requireUserId();
    const { searchParams } = new URL(request.url);

    const supabase = await getRouteClient();

    const start = searchParams.get("start"); // YYYY-MM-DD
    const end = searchParams.get("end"); // YYYY-MM-DD
    const daysParam = searchParams.get("days");

    // Default behavior: last 30 days
    const days = clamp(Number(daysParam ?? 30), 1, 365);

    let query = supabase
      .from("daily_history")
      .select(
        [
          "day",
          "hydration_score",
          "total_oz",
          "base_need_oz",
          "workouts_oz",
          "creatine_oz",
          "supplements_oz",
          "sleep_oz",
          "recovery_oz",
          "sleep_hours",
          "recovery_pct",
          "updated_at",
        ].join(",")
      )
      .eq("user_id", userId)
      .order("day", { ascending: false });

    if (start) query = query.gte("day", start);
    if (end) query = query.lte("day", end);

    // Only apply limit when not using an explicit range
    if (!start && !end) query = query.limit(days);

    const { data, error } = await query;

    if (error) return bad("Failed to fetch history", 500);
    return ok(data ?? []);
  } catch (e: any) {
    if (e instanceof Response) return e;
    return bad("Unexpected error", 500);
  }
}
