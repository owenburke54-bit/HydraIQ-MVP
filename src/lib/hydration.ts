export const BASE_ML_PER_KG = 35;
export const WORKOUT_ML_PER_MIN = 8;
export const HEAT_MULTIPLIER = 1.1;

export type DailyHydrationInputs = {
	weightKg: number;
	// strain: WHOOP strain (0–21). We keep property name 'intensity' for backwards-compat.
	workouts: { durationMin: number; intensity: number }[];
	isHotDay?: boolean;
};

export function calculateHydrationTarget(inputs: DailyHydrationInputs) {
	const baseNeed = inputs.weightKg * BASE_ML_PER_KG;

	const workoutAdjustment = inputs.workouts.reduce((total, w) => {
		// Map strain (0–21) to a factor ~0.5–1.5x
		const strain = Math.max(0, Math.min(21, Number(w.intensity) || 0));
		const intensityFactor = 0.5 + strain / 21;
		return total + w.durationMin * WORKOUT_ML_PER_MIN * intensityFactor;
	}, 0);

	const heatAdjustment = inputs.isHotDay ? baseNeed * (HEAT_MULTIPLIER - 1) : 0;

	const target = Math.round(baseNeed + workoutAdjustment + heatAdjustment);

	return {
		targetMl: target,
		baseNeedMl: Math.round(baseNeed),
		workoutAdjustmentMl: Math.round(workoutAdjustment),
		heatAdjustmentMl: Math.round(heatAdjustment),
	};
}

export type ScoreInputs = {
	targetMl: number;
	actualMl: number;
	intakes: { timestamp: Date; volumeMl: number }[];
	workouts: { start: Date; end: Date }[];
};

export type ScoreMode = "live" | "final";

export function calculateHydrationScore(inputs: ScoreInputs, mode: ScoreMode = "final"): number {
	if (inputs.targetMl === 0) return 0;

	let score = 100;

	// 1) Percent of target reached
	const ratio = inputs.actualMl / inputs.targetMl;
	if (ratio < 1) {
		score -= (1 - ratio) * 40; // up to -40 points
	} else if (ratio > 1.3) {
		score -= (ratio - 1.3) * 20; // mild overhydration penalty
	}

	// 2) Late-night chug penalty (e.g., large volumes after 10pm)
	const lateIntake = inputs.intakes
		.filter((i) => {
			const hour = i.timestamp.getHours();
			return hour >= 22;
		})
		.reduce((sum, i) => sum + i.volumeMl, 0);
	if (lateIntake > inputs.targetMl * 0.3) {
		score -= 10;
	}

	// 3) Dry-gap handling
	// - live: penalize ONLY the current ongoing gap since last intake (clears immediately when logging)
	// - final: penalize long intra-day gaps (>3h) observed within the day's sequence
	if (mode === "live") {
		const now = Date.now();
		if (inputs.intakes.length > 0) {
			const last = inputs.intakes.reduce((a, b) =>
				a.timestamp.getTime() > b.timestamp.getTime() ? a : b
			).timestamp.getTime();
			const hoursSince = (now - last) / (1000 * 60 * 60);
			if (hoursSince > 3) {
				const over = hoursSince - 3;
				// ~ -1.5 points per hour after 3h, up to -15
				score -= Math.min(15, over * 1.5);
			}
		} else {
			// No intake yet today: begin a light penalty in the afternoon that grows through the day
			const hour = new Date().getHours();
			if (hour >= 12) {
				score -= Math.min(10, (hour - 12) * 1.25);
			}
		}
	} else {
		// final mode: check historical intra-day gaps only
		const sorted = [...inputs.intakes].sort(
			(a, b) => a.timestamp.getTime() - b.timestamp.getTime()
		);
		for (let i = 1; i < sorted.length; i++) {
			const diffHours =
				(sorted[i].timestamp.getTime() - sorted[i - 1].timestamp.getTime()) /
				(1000 * 60 * 60);
			if (diffHours > 3) {
				score -= 10;
				break;
			}
		}
	}

	return Math.max(0, Math.min(100, Math.round(score)));
}



