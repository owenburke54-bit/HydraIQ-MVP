import { bad, getRouteClient, ok, requireUserId } from "../../_helpers";
import { buildHydrationInsightsPrompt } from "../../../../lib/prompts/hydrationInsights";
import OpenAI from "openai";

type JsonInsight = {
	daily_summary: { title: string; body: string; severity: "info" | "warning" | "critical" };
	patterns: { title: string; body: string; severity: "info" | "warning" | "critical" }[];
};

export async function POST(request: Request) {
	try {
		const userId = await requireUserId();
		const body = await request.json().catch(() => ({}));
		const rangeDays: number = Math.max(1, Math.min(60, Number(body?.rangeDays ?? 14)));
		const dateParam: string | undefined = body?.date;
		const endDate = dateParam ? new Date(dateParam) : new Date();
		const endDateStr = endDate.toISOString().slice(0, 10);
		const startDate = new Date(endDate);
		startDate.setDate(startDate.getDate() - (rangeDays - 1));
		const startDateStr = startDate.toISOString().slice(0, 10);

		const supabase = await getRouteClient();
		// Profile
		const { data: profile } = await supabase
			.from("profiles")
			.select("name, sex, dob, height_cm, weight_kg, units")
			.eq("id", userId)
			.maybeSingle();

		// Days
		const { data: days } = await supabase
			.from("hydration_days")
			.select("id, date, target_ml, actual_ml, hydration_score")
			.eq("user_id", userId)
			.gte("date", startDateStr)
			.lte("date", endDateStr)
			.order("date", { ascending: true });

		// Workouts in range
		const { data: workouts } = await supabase
			.from("workouts")
			.select("start_time, duration_min, intensity, type")
			.eq("user_id", userId)
			.gte("start_time", `${startDateStr}T00:00:00.000Z`)
			.lte("start_time", `${endDateStr}T23:59:59.999Z`);
		const byDate: Record<string, { type: string; durationMin: number; intensity: number }[]> = {};
		(workouts ?? []).forEach((w) => {
			const d = new Date(w.start_time as string).toISOString().slice(0, 10);
			if (!byDate[d]) byDate[d] = [];
			byDate[d].push({
				type: (w.type as string) ?? "other",
				durationMin: (w.duration_min as number) ?? 0,
				intensity: (w.intensity as number) ?? 5,
			});
		});

		const prompt = buildHydrationInsightsPrompt({
			profile: (profile as any) ?? null,
			days: (days ?? []).map((d) => ({
				date: d.date as string,
				targetMl: d.target_ml as number,
				actualMl: d.actual_ml as number,
				hydrationScore: d.hydration_score as number,
				workouts: byDate[d.date as string] ?? [],
			})),
		});

		const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
		const chat = await client.chat.completions.create({
			model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
			messages: [
				{ role: "system", content: "You are a hydration coaching assistant. Return strict JSON only." },
				{ role: "user", content: prompt },
			],
			temperature: 0.2,
		});
		const content = chat.choices?.[0]?.message?.content ?? "{}";
		let parsed: JsonInsight;
		try {
			parsed = JSON.parse(content) as JsonInsight;
		} catch {
			return bad("LLM returned invalid JSON", 502);
		}
		if (!parsed?.daily_summary || !Array.isArray(parsed?.patterns)) {
			return bad("LLM JSON missing required fields", 502);
		}

		// Insert insights
		const mapDateToDayId: Record<string, string> = {};
		(days ?? []).forEach((d) => {
			mapDateToDayId[d.date as string] = d.id as string;
		});
		const referenceDayId = mapDateToDayId[endDateStr] ?? null;
		const inserts = [
			{
				user_id: userId,
				hydration_day_id: referenceDayId,
				title: parsed.daily_summary.title,
				body: parsed.daily_summary.body,
				severity: parsed.daily_summary.severity,
			},
			...parsed.patterns.map((p) => ({
				user_id: userId,
				hydration_day_id: referenceDayId,
				title: p.title,
				body: p.body,
				severity: p.severity,
			})),
		];
		const { error: insertErr } = await supabase.from("insights").insert(inserts);
		if (insertErr) return bad("Failed to store insights", 500);
		return ok(parsed);
	} catch (e: any) {
		if (e instanceof Response) return e;
		return bad("Unexpected error", 500);
	}
}



