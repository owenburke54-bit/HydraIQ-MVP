// build: bump 1
import { bad, getRouteClient, ok, requireUserId, getOrCreateHydrationDay, recalcDay, getDaySummary } from "../_helpers";

export async function GET() {
  try {
    const userId = await requireUserId();
    const supabase = await getRouteClient();
    const { data } = await supabase
      .from("profiles")
      .select("name, sex, dob, height_cm, weight_kg, units")
      .eq("id", userId)
      .maybeSingle();
    return ok(data ?? {});
  } catch (e: any) {
    if (e instanceof Response) return e;
    return bad("Unexpected error", 500);
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireUserId();
    const body = await request.json();
    const name: string | undefined = body?.name;
    const sex = (body?.sex as string) ?? "other";
    const units = (body?.units as string) ?? "imperial";

    let height_cm: number | null = null;
    let weight_kg: number | null = null;

    if (units === "metric") {
      height_cm = Number(body?.heightCm) || null;
      weight_kg = Number(body?.weightKg) || null;
    } else {
      // Convert imperial to metric
      const heightStr: string = body?.heightImperial ?? ""; // e.g., 5'10
      const match = heightStr.match(/(\d+)'(\d+)/);
      if (match) {
        const ft = Number(match[1]) || 0;
        const inches = Number(match[2]) || 0;
        height_cm = Math.round((ft * 12 + inches) * 2.54);
      }
      const weightLbs: number = Number(body?.weightLbs) || 0;
      weight_kg = weightLbs ? Math.round(weightLbs * 0.453592) : null;
    }

    const supabase = await getRouteClient();
    const { error } = await supabase.from("profiles").upsert(
      {
        id: userId,
        name: name ?? null,
        sex,
        height_cm,
        weight_kg,
        units,
      },
      { onConflict: "id" }
    );
    if (error) return bad("Failed to save profile", 500);

    // Ensure today's hydration target is ready immediately
    const today = new Date().toISOString().slice(0, 10);
    await getOrCreateHydrationDay(userId, today);
    await recalcDay(userId, today);
    const summary = await getDaySummary(userId, today);

    return ok({ success: true, summary });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return bad("Unexpected error", 500);
  }
}



