// Local persistence helpers (no auth required). Data is stored per-browser.
//
// Keys
// - hydra.profile
// - hydra.intakes
// - hydra.workouts (reserved, not used yet)
//
// Note: These helpers must be called from client components only.

type Profile = {
	name?: string;
	sex?: "male" | "female" | "other";
	height_cm?: number | null;
	weight_kg?: number | null;
	units?: "metric" | "imperial";
};

type Intake = {
	id: string;
	timestamp: string; // ISO
	volume_ml: number;
	type: "water" | "electrolyte" | "other";
};

type Workout = {
	id: string;
	start_time: string; // ISO
	end_time?: string | null;
	duration_min?: number | null;
	type?: string | null;
	intensity?: number | null;
};

export function formatNYDate(d: Date): string {
	// YYYY-MM-DD in America/New_York
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone: "America/New_York",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).formatToParts(d);
	const y = parts.find((p) => p.type === "year")?.value ?? "0000";
	const m = parts.find((p) => p.type === "month")?.value ?? "01";
	const dd = parts.find((p) => p.type === "day")?.value ?? "01";
	return `${y}-${m}-${dd}`;
}

export function todayNYDate(): string {
	return formatNYDate(new Date());
}

function readJSON<T>(key: string, fallback: T): T {
	if (typeof window === "undefined") return fallback;
	try {
		const raw = window.localStorage.getItem(key);
		if (!raw) return fallback;
		return JSON.parse(raw) as T;
	} catch {
		return fallback;
	}
}

function writeJSON<T>(key: string, value: T) {
	if (typeof window === "undefined") return;
	try {
		window.localStorage.setItem(key, JSON.stringify(value));
	} catch {}
}

export function getProfile(): Profile | null {
	return readJSON<Profile | null>("hydra.profile", null);
}

export function saveProfile(p: Profile) {
	writeJSON("hydra.profile", p);
}

export function addIntake(volumeMl: number, type: Intake["type"], ts: Date) {
	const list = readJSON<Intake[]>("hydra.intakes", []);
	list.push({
		id: crypto?.randomUUID?.() ?? String(Date.now()),
		timestamp: ts.toISOString(),
		volume_ml: volumeMl,
		type,
	});
	writeJSON("hydra.intakes", list);
}

export function getIntakesByDate(date: string): Intake[] {
	const list = readJSON<Intake[]>("hydra.intakes", []);
	return list.filter((i) => i.timestamp.slice(0, 10) === date);
}

export function getIntakesByDateNY(date: string): Intake[] {
	const list = readJSON<Intake[]>("hydra.intakes", []);
	return list.filter((i) => formatNYDate(new Date(i.timestamp)) === date);
}

export function getIntakesForHome(dateNY: string): Intake[] {
	const list = readJSON<Intake[]>("hydra.intakes", []);
	// Also allow simple string compare fallback to avoid any tz edge cases
	const localIso = new Date().toISOString().slice(0, 10);
	return list.filter((i) => {
		const nyMatch = formatNYDate(new Date(i.timestamp)) === dateNY;
		const simpleMatch = i.timestamp.slice(0, 10) === localIso;
		return nyMatch || simpleMatch;
	});
}
export function addWorkout(data: { start: Date; end?: Date; durationMin?: number; intensity?: number; type?: string }) {
	const list = readJSON<Workout[]>("hydra.workouts", []);
	const durationMin =
		typeof data.durationMin === "number"
			? data.durationMin
			: data.end
			? Math.max(0, Math.round((data.end.getTime() - data.start.getTime()) / 60000))
			: null;
	list.push({
		id: crypto?.randomUUID?.() ?? String(Date.now()),
		start_time: data.start.toISOString(),
		end_time: data.end ? data.end.toISOString() : null,
		duration_min: durationMin,
		type: data.type ?? null,
		intensity: data.intensity ?? null,
	});
	writeJSON("hydra.workouts", list);
}

export function getWorkoutsByDateNY(date: string): Workout[] {
	const list = readJSON<Workout[]>("hydra.workouts", []);
	return list.filter((w) => formatNYDate(new Date(w.start_time)) === date);
}

export function clearAllLocalData() {
	if (typeof window === "undefined") return;
	window.localStorage.removeItem("hydra.profile");
	window.localStorage.removeItem("hydra.intakes");
	window.localStorage.removeItem("hydra.workouts");
}


