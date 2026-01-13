import { cookies } from "next/headers";
import { NextResponse } from "next/server";

// Ensure Node runtime so cookies() behaves consistently and we can use standard node APIs if needed.
export const runtime = "nodejs";

async function getRefreshToken() {
  const cookieStore = await cookies();
  const raw = cookieStore.get("whoop_refresh")?.value || "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

async function getAccessTokenFromCookie() {
  const cookieStore = await cookies();
  const raw = cookieStore.get("whoop_access")?.value || "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

async function refresh(refreshToken: string) {
  const res = await fetch("https://api.prod.whoop.com/oauth/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: process.env.WHOOP_CLIENT_ID!,
      client_secret: process.env.WHOOP_CLIENT_SECRET!,
    }),
  });
  if (!res.ok) return null;
  return await res.json();
}

function formatNYDate(d: Date) {
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

async function safeReadBody(res: Response) {
  try {
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  } catch {
    return null;
  }
}

async function fetchJson(url: string, accessToken: string) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (res.status === 204 || res.status === 404) return { ok: true as const, data: null as any, res };
  if (!res.ok) return { ok: false as const, data: await safeReadBody(res), res };
  return { ok: true as const, data: await res.json(), res };
}

type WhoopDailyMetrics = {
  date: string;
  sleepHours: number | null;
  recovery: number | null; // 0-100
  strain: number | null; // 0-21
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const date = url.searchParams.get("date");
  if (!date) return NextResponse.json({ error: "date required (YYYY-MM-DD)" }, { status: 400 });

  // Prefer refresh flow if available
  const refreshToken = await getRefreshToken();
  let accessToken: string | null = null;
  let nextRefresh: string | undefined;

  if (refreshToken) {
    const tokenPayload = await refresh(refreshToken);
    if (!tokenPayload) {
      // Try access token cookie fallback
      accessToken = (await getAccessTokenFromCookie()) || null;
      if (!accessToken) {
        return NextResponse.json({ error: "Failed to refresh" }, { status: 401 });
      }
    } else {
      accessToken = tokenPayload.access_token as string;
      nextRefresh = tokenPayload.refresh_token as string | undefined;
    }
  } else {
    // No refresh token (offline_access not granted) – use short-lived access token set at callback
    accessToken = (await getAccessTokenFromCookie()) || null;
    if (!accessToken) {
      return NextResponse.json({ error: "Not connected. Call /api/whoop/connect" }, { status: 401 });
    }
  }

  // Build a slightly wider UTC window (prev day 00:00Z → next day 23:59Z) to avoid time zone misses.
  // We'll filter to the requested New York date after fetching.
  const base = new Date(`${date}T00:00:00.000Z`);
  const prev = new Date(base.getTime() - 24 * 60 * 60 * 1000);
  const next = new Date(base.getTime() + 24 * 60 * 60 * 1000);
  const start = prev.toISOString().slice(0, 23) + "Z";
  const end = new Date(next.getTime() + (24 * 60 * 60 * 1000 - 1)).toISOString().slice(0, 23) + "Z";

  // -----------------------------
  // 1) Activities (Workouts)
  // -----------------------------
  const fetchV2Workouts = async () => {
    // v2: limit must be <= 25
    const u = `https://api.prod.whoop.com/developer/v2/activity/workout?start=${encodeURIComponent(
      start
    )}&end=${encodeURIComponent(end)}&limit=25`;
    return fetchJson(u, accessToken!);
  };

  const fetchV1Activities = async () => {
    const u = `https://api.prod.whoop.com/developer/v1/activities?start=${encodeURIComponent(
      start
    )}&end=${encodeURIComponent(end)}`;
    return fetchJson(u, accessToken!);
  };

  // Try v2 first; fall back to v1 if endpoint not found
  let workoutRes = await fetchV2Workouts();
  if (workoutRes.ok && workoutRes.res.status === 404) workoutRes = await fetchV1Activities();

  if (!workoutRes.ok) {
    return NextResponse.json(
      { error: "WHOOP request failed", status: workoutRes.res.status, body: workoutRes.data },
      { status: workoutRes.res.status }
    );
  }

  const workoutData = workoutRes.data;

  // Support both v2 shape { records: [...] } and legacy array shapes
  const rows: any[] = Array.isArray(workoutData)
    ? workoutData
    : Array.isArray((workoutData as any)?.records)
      ? (workoutData as any).records
      : [];

  const activities = rows.filter((a: any) => {
    const s = a?.start ?? a?.start_time ?? a?.created_at;
    if (!s) return false;
    const dt = new Date(s);
    return formatNYDate(dt) === date;
  });

  // -----------------------------
  // 2) Daily metrics for Lag Effects
  // -----------------------------
  // IMPORTANT: This route is server-side. It cannot write to localStorage.
  // The client should take these metrics and persist them into your per-day history store
  // (the same store used by Hydration Score charts) so Lag Effects has non-zero pairs.
  //
  // We try v2 endpoints first. If not available for your WHOOP app, we gracefully return nulls.
  const metrics: WhoopDailyMetrics = { date, sleepHours: null, recovery: null, strain: null };

  // a) Sleep (v2)
  // Common v2 sleep endpoint: /developer/v2/activity/sleep
  const sleepUrl = `https://api.prod.whoop.com/developer/v2/activity/sleep?start=${encodeURIComponent(
    start
  )}&end=${encodeURIComponent(end)}&limit=25`;
  const sleepRes = await fetchJson(sleepUrl, accessToken!);
  if (sleepRes.ok && sleepRes.data) {
    const sleepRows: any[] = Array.isArray((sleepRes.data as any)?.records)
      ? (sleepRes.data as any).records
      : Array.isArray(sleepRes.data)
        ? sleepRes.data
        : [];

    // Pick the sleep record whose start_time (or start) maps to the NY date.
    const sleepForDay = sleepRows.find((s: any) => {
      const st = s?.start ?? s?.start_time ?? s?.created_at;
      if (!st) return false;
      return formatNYDate(new Date(st)) === date;
    });

    if (sleepForDay) {
      // WHOOP often provides durations in milliseconds or seconds depending on endpoint.
      // Try a few common shapes and normalize to hours.
      const ms =
        typeof sleepForDay?.score?.stage_summary?.total_in_bed_time_milli === "number"
          ? sleepForDay.score.stage_summary.total_in_bed_time_milli
          : typeof sleepForDay?.score?.sleep_need?.baseline_milli === "number" // not ideal but fallback
            ? sleepForDay.score.sleep_need.baseline_milli
            : typeof sleepForDay?.score?.sleep_duration_milli === "number"
              ? sleepForDay.score.sleep_duration_milli
              : typeof sleepForDay?.score?.sleep_time_milli === "number"
                ? sleepForDay.score.sleep_time_milli
                : typeof sleepForDay?.sleep?.duration_milli === "number"
                  ? sleepForDay.sleep.duration_milli
                  : null;

      const seconds =
        ms == null && typeof sleepForDay?.score?.sleep_duration === "number"
          ? sleepForDay.score.sleep_duration
          : ms == null && typeof sleepForDay?.sleep?.duration === "number"
            ? sleepForDay.sleep.duration
            : null;

      if (typeof ms === "number" && isFinite(ms)) metrics.sleepHours = Math.max(0, ms / 1000 / 60 / 60);
      else if (typeof seconds === "number" && isFinite(seconds))
        metrics.sleepHours = Math.max(0, seconds / 60 / 60);
    }
  }

  // b) Recovery (v2)
  // Common v2 recovery endpoint: /developer/v2/recovery
  const recoveryUrl = `https://api.prod.whoop.com/developer/v2/recovery?start=${encodeURIComponent(
    start
  )}&end=${encodeURIComponent(end)}&limit=25`;
  const recRes = await fetchJson(recoveryUrl, accessToken!);
  if (recRes.ok && recRes.data) {
    const recRows: any[] = Array.isArray((recRes.data as any)?.records)
      ? (recRes.data as any).records
      : Array.isArray(recRes.data)
        ? recRes.data
        : [];

    const recForDay = recRows.find((r: any) => {
      const dtStr = r?.created_at ?? r?.date ?? r?.timestamp ?? r?.updated_at;
      if (!dtStr) return false;
      return formatNYDate(new Date(dtStr)) === date;
    });

    const val =
      typeof recForDay?.score?.recovery_score === "number"
        ? recForDay.score.recovery_score
        : typeof recForDay?.recovery_score === "number"
          ? recForDay.recovery_score
          : typeof recForDay?.score === "number"
            ? recForDay.score
            : null;

    if (typeof val === "number" && isFinite(val)) metrics.recovery = Math.max(0, Math.min(100, val));
  }

  // c) Day strain (v2 cycle is usually the cleanest)
  // Common v2 cycle endpoint: /developer/v2/cycle (contains strain, etc.)
  const cycleUrl = `https://api.prod.whoop.com/developer/v2/cycle?start=${encodeURIComponent(
    start
  )}&end=${encodeURIComponent(end)}&limit=25`;
  const cycleRes = await fetchJson(cycleUrl, accessToken!);
  if (cycleRes.ok && cycleRes.data) {
    const cycleRows: any[] = Array.isArray((cycleRes.data as any)?.records)
      ? (cycleRes.data as any).records
      : Array.isArray(cycleRes.data)
        ? cycleRes.data
        : [];

    const cycleForDay = cycleRows.find((c: any) => {
      const st = c?.start ?? c?.start_time ?? c?.created_at;
      if (!st) return false;
      return formatNYDate(new Date(st)) === date;
    });

    const strainVal =
      typeof cycleForDay?.score?.strain === "number"
        ? cycleForDay.score.strain
        : typeof cycleForDay?.strain === "number"
          ? cycleForDay.strain
          : null;

    if (typeof strainVal === "number" && isFinite(strainVal))
      metrics.strain = Math.max(0, Math.min(21, strainVal));
  } else {
    // Fallback: if cycle isn't available, try to approximate day strain from max workout strain on that date.
    // (This is not the same as WHOOP day strain, but gives you something usable.)
    const maxWorkoutStrain = activities.reduce((mx: number, a: any) => {
      const s = a?.score?.strain;
      return typeof s === "number" && isFinite(s) ? Math.max(mx, s) : mx;
    }, 0);
    if (maxWorkoutStrain > 0) metrics.strain = Math.max(0, Math.min(21, maxWorkoutStrain));
  }

  // Return data and update refresh cookie if it rotated
  const out = NextResponse.json({ activities, metrics });
  if (nextRefresh && nextRefresh !== refreshToken) {
    out.cookies.set("whoop_refresh", nextRefresh, {
      httpOnly: true,
      secure: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      sameSite: "lax",
    });
  }
  return out;
}
