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

export function clearAllLocalData() {
	if (typeof window === "undefined") return;
	window.localStorage.removeItem("hydra.profile");
	window.localStorage.removeItem("hydra.intakes");
	window.localStorage.removeItem("hydra.workouts");
}


