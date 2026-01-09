// src/lib/selectedDate.ts
// Utilities for working with YYYY-MM-DD dates (NY day semantics).

const NY_TZ = "America/New_York";

export function isISODate(v: string | null | undefined): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

/**
 * Format a Date into YYYY-MM-DD in America/New_York.
 * Uses en-CA to get YYYY-MM-DD reliably.
 */
export function isoDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: NY_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * Add N days to an ISO date string (YYYY-MM-DD).
 * Uses UTC math on date parts to avoid DST issues, then re-formats for NY.
 */
export function addDays(iso: string, days: number): string {
  if (!isISODate(iso)) return isoDate(new Date());

  const [y, m, d] = iso.split("-").map((n) => Number(n));
  // Use UTC noon-ish by constructing a UTC date from parts
  const baseUtc = Date.UTC(y, m - 1, d);
  const next = new Date(baseUtc + days * 24 * 60 * 60 * 1000);

  // Format in NY to keep "day" consistent with your app
  return isoDate(next);
}

/**
 * Clamp an ISO date string between minIso and maxIso (inclusive).
 * Works because YYYY-MM-DD compares lexicographically.
 */
export function clampISODate(iso: string, minIso: string, maxIso: string): string {
  if (!isISODate(iso)) return minIso;
  if (iso < minIso) return minIso;
  if (iso > maxIso) return maxIso;
  return iso;
}

/**
 * Optional default export for convenience / backwards compatibility.
 */
const selectedDate = { isoDate, addDays, clampISODate, isISODate };
export default selectedDate;
