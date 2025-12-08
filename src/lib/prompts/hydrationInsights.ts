export function buildHydrationInsightsPrompt(data: any) {
	const profileLine = data?.profile
		? `Profile: sex=${data.profile.sex ?? "other"}, weight_kg=${data.profile.weight_kg ?? "n/a"}, height_cm=${data.profile.height_cm ?? "n/a"}, units=${data.profile.units ?? "imperial"}.`
		: "Profile: none.";
	const daysLines = (data?.days ?? [])
		.map((d: any) => {
			const w = (d.workouts ?? [])
				.map((x: any) => `${x.type}:${x.durationMin}min@${x.intensity}/10`)
				.join(", ");
			return `- ${d.date}: score=${d.hydrationScore}, actual=${d.actualMl}ml / target=${d.targetMl}ml; workouts=[${w}]`;
		})
		.join("\n");
	const schema = `Output strict JSON matching this schema (no prose):\n{\n  "daily_summary": {\n    "title": "string",\n    "body": "string",\n    "severity": "info|warning|critical"\n  },\n  "patterns": [\n    {\n      "title": "string",\n      "body": "string",\n      "severity": "info|warning|critical"\n    }\n  ]\n}`;
	const instructions =
		"Write short, actionable insights in 3â€“4 sentences max each. Avoid jargon. Prefer clear recommendations (e.g., amounts/timing).";
	return [profileLine, "Recent hydration days:", daysLines, instructions, schema].join("\n\n");
}



