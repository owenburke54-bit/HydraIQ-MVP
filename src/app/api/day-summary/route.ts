import {
	bad,
	getDaySummary,
	ok,
	requireUserId,
	recalcDay,
	getRouteClient,
  } from "../_helpers";
  
  type AnyObj = Record<string, any>;
  
  function num(v: any, fallback = 0) {
	const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
	return Number.isFinite(n) ? n : fallback;
  }
  
  function pickFirstNumber(obj: AnyObj, keys: string[], fallback = 0) {
	for (const k of keys) {
	  if (obj && obj[k] != null) return num(obj[k], fallback);
	}
	return fallback;
  }
  
  function normLabel(s: any) {
	return String(s ?? "").toLowerCase().trim();
  }
  
  /**
   * Tries to extract target-driver ounces from whatever shape your summary returns.
   * Supports:
   * - summary.targetDrivers as object: { base_need_oz, workouts_oz, ... }
   * - summary.targetDrivers as array: [{ label, oz }] / [{ name, value }]
   * - summary.target_breakdown / targetBreakdown arrays
   */
  function extractDrivers(summary: AnyObj) {
	// 1) Object-style breakdown
	const tdObj = summary?.targetDrivers;
	if (tdObj && !Array.isArray(tdObj) && typeof tdObj === "object") {
	  const base = pickFirstNumber(tdObj, ["base_need_oz", "base", "baseNeedOz", "base_need"], 0);
	  const workouts = pickFirstNumber(tdObj, ["workouts_oz", "workouts", "activity", "activities"], 0);
	  const creatine = pickFirstNumber(tdObj, ["creatine_oz", "creatine"], 0);
	  const supplements = pickFirstNumber(tdObj, ["supplements_oz", "supplements"], 0);
	  const sleep = pickFirstNumber(tdObj, ["sleep_oz", "sleep"], 0);
	  const recovery = pickFirstNumber(tdObj, ["recovery_oz", "recovery"], 0);
  
	  return { base, workouts, creatine, supplements, sleep, recovery };
	}
  
	// 2) Array-style breakdown
	const candidates =
	  (Array.isArray(summary?.targetDrivers) && summary.targetDrivers) ||
	  (Array.isArray(summary?.target_breakdown) && summary.target_breakdown) ||
	  (Array.isArray(summary?.targetBreakdown) && summary.targetBreakdown) ||
	  (Array.isArray(summary?.drivers) && summary.drivers) ||
	  [];
  
	const out = { base: 0, workouts: 0, creatine: 0, supplements: 0, sleep: 0, recovery: 0 };
  
	for (const item of candidates) {
	  const label = normLabel(item?.label ?? item?.name ?? item?.type);
	  const oz = num(item?.oz ?? item?.value ?? item?.amount ?? item?.deltaOz ?? 0, 0);
  
	  if (!label) continue;
  
	  if (label.includes("base")) out.base += oz;
	  else if (label.includes("creatine")) out.creatine += oz;
	  else if (label.includes("sleep")) out.sleep += oz;
	  else if (label.includes("recovery")) out.recovery += oz;
	  else if (label.includes("supplement") || label.includes("protein") || label.includes("multivit") || label.includes("fish oil") || label.includes("electrolyte tablet"))
		out.supplements += oz;
	  else if (label.includes("whoop") || label.includes("workout") || label.includes("activity") || label.includes("strain") || label.includes("run") || label.includes("soccer"))
		out.workouts += oz;
	}
  
	return out;
  }
  
  function extractSleepRecovery(summary: AnyObj) {
	// sleep hours
	const sleep_hours =
	  pickFirstNumber(summary, ["sleep_hours", "sleepHours", "sleepHrs"], NaN) ||
	  pickFirstNumber(summary?.whoop ?? {}, ["sleep_hours", "sleepHours", "sleepHrs"], NaN);
  
	// recovery percent (0–100)
	const recovery_pct =
	  pickFirstNumber(summary, ["recovery_pct", "recoveryPct", "recovery"], NaN) ||
	  pickFirstNumber(summary?.whoop ?? {}, ["recovery_pct", "recoveryPct", "recovery"], NaN);
  
	return {
	  sleep_hours: Number.isFinite(sleep_hours) ? sleep_hours : null,
	  recovery_pct: Number.isFinite(recovery_pct) ? recovery_pct : null,
	};
  }
  
  export async function GET(request: Request) {
	try {
	  const userId = await requireUserId();
	  const { searchParams } = new URL(request.url);
	  const date = searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  
	  // Ensure up-to-date
	  await recalcDay(userId, date);
  
	  const summary = (await getDaySummary(userId, date)) as AnyObj;
  
	  const supabase = await getRouteClient();
  
	  // Include supplements for the day
	  const { data: supplements } = await supabase
		.from("supplement_events")
		.select("id, timestamp, type")
		.eq("user_id", userId)
		.filter("timestamp", "gte", `${date}T00:00:00.000Z`)
		.filter("timestamp", "lt", `${date}T23:59:59.999Z`)
		.order("timestamp", { ascending: true });
  
	  // ---- NEW: Upsert daily snapshot into daily_history ----
	  // Try to read score + total intake from common summary shapes
	  const hydrationScore = Math.round(
		pickFirstNumber(summary, ["hydration_score", "hydrationScore", "score"], 0)
	  );
  
	  const totalOz = pickFirstNumber(
		summary,
		["total_oz", "totalOz", "total_intake_oz", "totalIntakeOz", "intake_oz", "intakeOz"],
		0
	  );
  
	  const drivers = extractDrivers(summary);
	  const whoop = extractSleepRecovery(summary);
  
	  // Note: requires the `daily_history` table + RLS policies you added in Supabase.
	  // If the table doesn't exist yet, we don't want to break the app — so we swallow the error.
	  const upsertPayload = {
		user_id: userId,
		day: date, // Supabase `date` type expects YYYY-MM-DD
		hydration_score: Math.max(0, Math.min(100, hydrationScore)),
		total_oz: totalOz,
  
		base_need_oz: drivers.base,
		workouts_oz: drivers.workouts,
		creatine_oz: drivers.creatine,
		supplements_oz: drivers.supplements,
		sleep_oz: drivers.sleep,
		recovery_oz: drivers.recovery,
  
		sleep_hours: whoop.sleep_hours,
		recovery_pct: whoop.recovery_pct,
		updated_at: new Date().toISOString(),
	  };
  
	  const { error: historyErr } = await supabase
		.from("daily_history")
		.upsert(upsertPayload, { onConflict: "user_id,day" });
  
	  // Don't fail the request if history write fails (table not deployed yet, etc.)
	  // You can log this in debug routes if you want.
	  if (historyErr) {
		// noop
	  }
	  // ---- END NEW ----
  
	  return ok({ ...summary, supplements: supplements ?? [] });
	} catch (e: any) {
	  if (e instanceof Response) return e;
	  return bad("Unexpected error", 500);
	}
  }
  