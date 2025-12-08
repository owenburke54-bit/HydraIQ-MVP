import { bad, getDaySummary, getOrCreateHydrationDay, getRouteClient, ok, requireUserId } from "../_helpers";

export async function POST(request: Request) {
  try {
    const userId = await requireUserId();
    const body = await request.json();
    const types: string[] = Array.isArray(body?.types) ? body.types : [];
    const tsString: string | undefined = body?.timestamp;
    if (!types.length) return bad("types[] is required");
    const timestamp = tsString ? new Date(tsString) : new Date();
    const date = timestamp.toISOString().slice(0, 10);

    const day = await getOrCreateHydrationDay(userId, date);
    const supabase = await getRouteClient();
    const rows = types.map((t) => ({
      user_id: userId,
      hydration_day_id: day.id,
      timestamp: timestamp.toISOString(),
      type: t,
    }));
    const { error } = await supabase.from("supplement_events").insert(rows);
    if (error) return bad("Failed to insert supplements", 500);

    // Return updated day summary (now includes supplements once GET adds them)
    const summary = await getDaySummary(userId, date);
    return ok(summary);
  } catch (e: any) {
    if (e instanceof Response) return e;
    return bad("Unexpected error", 500);
  }
}



