"use client";

import { useEffect, useMemo, useState } from "react";
import Button from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import {
  addWorkout,
  getWorkoutsByDateNY,
  formatNYDate,
  updateWorkout,
  deleteWorkout,
} from "../../lib/localStore";
import { readSelectedDateFromLocation, isISODate } from "@/lib/selectedDate";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatLocalInput(dt: Date) {
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}T${pad2(
    dt.getHours()
  )}:${pad2(dt.getMinutes())}`;
}

// Build a datetime-local default for selected ISO date
function defaultStartForDate(isoDate: string) {
  const now = new Date();
  const todayIso = formatNYDate(now);

  // Today: now
  if (isoDate === todayIso) return formatLocalInput(now);

  // Past/other: 12:00 PM
  const [y, m, d] = isoDate.split("-").map(Number);
  return `${y}-${pad2(m)}-${pad2(d)}T12:00`;
}

function addHoursLocalInput(localInput: string, hours: number) {
  const d = new Date(localInput);
  return formatLocalInput(new Date(d.getTime() + hours * 60 * 60 * 1000));
}

function coerceDateTimeToSelectedDate(value: string, selectedDate: string) {
  // value like "YYYY-MM-DDTHH:mm"
  if (!value || value.length < 16) return value;
  const datePart = value.slice(0, 10);
  if (datePart === selectedDate) return value;
  return `${selectedDate}${value.slice(10)}`;
}

export default function WorkoutsPage() {
  const todayISO = useMemo(() => formatNYDate(new Date()), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayISO);

  // ✅ No useSearchParams() (avoids /_not-found Suspense build failures)
  useEffect(() => {
    const sync = () => {
      const iso = readSelectedDateFromLocation(todayISO);
      setSelectedDate(isISODate(iso) ? iso : todayISO);
    };
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [todayISO]);

  const isToday = selectedDate === todayISO;

  const [open, setOpen] = useState(true);
  const [type, setType] = useState<string>("Run");
  const [start, setStart] = useState<string>(() => defaultStartForDate(todayISO));
  const [end, setEnd] = useState<string>(() => addHoursLocalInput(defaultStartForDate(todayISO), 1));
  const [endTouched, setEndTouched] = useState(false);
  const [intensity, setIntensity] = useState<number>(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // When selected day changes, reset start/end defaults
  useEffect(() => {
    const s = defaultStartForDate(selectedDate);
    setStart(s);
    setEnd(addHoursLocalInput(s, 1));
    setEndTouched(false);
    setMessage(null);
    setError(null);
  }, [selectedDate]);

  const workoutsForDay = useMemo(() => getWorkoutsByDateNY(selectedDate), [selectedDate]);

  const workoutOptions = [
    "Soccer",
    "Run",
    "Lift",
    "Tennis",
    "Swimming",
    "Pickleball",
    "Basketball",
    "Other",
  ];

  return (
    // Match Home/Log spacing so content clears the fixed TopBar, without a huge gap.
    <div className="px-4 pb-4 pt-[calc(72px+env(safe-area-inset-top))]">
      {/* Date toggle belongs ONLY in the TopBar now — removed DateSwitcher from page */}

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Workouts</h1>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Showing: <span className="font-medium">{selectedDate}</span>
            {isToday ? " (Today)" : ""}
          </p>
        </div>
      </div>

      <Card className="mt-4 overflow-hidden">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between p-4 text-left text-sm font-medium"
        >
          <span>Add workout</span>
          <span className="text-zinc-500">{open ? "−" : "+"}</span>
        </button>

        {open && (
          <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">
            <div className="grid gap-3">
              <label className="text-sm text-zinc-600 dark:text-zinc-300">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
              >
                {workoutOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>

              <label className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">Start time</label>
              <input
                type="datetime-local"
                value={start}
                onChange={(e) => {
                  const v = coerceDateTimeToSelectedDate(e.target.value, selectedDate);
                  setStart(v);
                  if (!endTouched) setEnd(addHoursLocalInput(v, 1));
                }}
                className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
              />

              <label className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">End time</label>
              <input
                type="datetime-local"
                value={end}
                onChange={(e) => {
                  setEndTouched(true);
                  setEnd(coerceDateTimeToSelectedDate(e.target.value, selectedDate));
                }}
                className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
              />

              <label className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                Strain: {Number(intensity).toFixed(1)}
              </label>
              <input
                type="range"
                min={0}
                max={21}
                step={0.1}
                value={intensity}
                onChange={(e) => setIntensity(Number(e.target.value))}
                className="w-full"
              />

              <Button
                onClick={async () => {
                  setLoading(true);
                  setError(null);
                  setMessage(null);
                  try {
                    addWorkout({
                      type: type.toLowerCase(),
                      start: new Date(coerceDateTimeToSelectedDate(start, selectedDate)),
                      end: new Date(coerceDateTimeToSelectedDate(end, selectedDate)),
                      intensity,
                    });
                    setMessage("Saved workout");
                    setTimeout(() => window.location.reload(), 300);
                  } catch (e: any) {
                    setError(e?.message || "Failed to save workout");
                  } finally {
                    setLoading(false);
                  }
                }}
                className="mt-3 w-full"
                disabled={loading}
              >
                {loading ? "Saving..." : "Save Workout"}
              </Button>
            </div>
          </div>
        )}
      </Card>

      <div className="mt-6">
        <h2 className="mb-2 text-lg font-semibold">
          {isToday ? "Today" : "Workouts"} • {selectedDate}
        </h2>

        <div className="mb-3 flex gap-2">
          <a
            href="/api/whoop/connect"
            className="rounded-xl border px-3 py-2 text-sm dark:border-zinc-800"
          >
            Connect WHOOP
          </a>

          <button
            className="rounded-xl border px-3 py-2 text-sm disabled:opacity-50 dark:border-zinc-800"
            disabled={!isToday}
            title={!isToday ? "WHOOP import is only available for Today right now" : ""}
            onClick={async () => {
              try {
                const res = await fetch(`/api/whoop/sync?date=${selectedDate}`, {
                  credentials: "include",
                });
                const json = await res.json();
                if (res.ok && Array.isArray(json.activities)) {
                  let count = 0;
                  for (const a of json.activities) {
                    try {
                      const start = a.start ?? a.start_time ?? a.created_at;
                      const end = a.end ?? a.end_time ?? start;
                      const type = a?.sport_name
                        ? `WHOOP • ${toTitleCase(String(a.sport_name))}`
                        : "WHOOP";
                      const strain = typeof a?.score?.strain === "number" ? Number(a.score.strain) : null;
                      const intensity = typeof strain === "number" ? Math.max(0, Math.min(21, strain)) : null;

                      addWorkout({
                        type: String(type),
                        start: new Date(start),
                        end: new Date(end),
                        intensity: intensity ?? undefined,
                      });
                      count++;
                    } catch {}
                  }
                  alert(`Imported ${count} WHOOP activities`);
                  location.reload();
                } else {
                  alert(json?.error ?? "WHOOP not connected");
                }
              } catch {
                alert("Failed to import from WHOOP");
              }
            }}
          >
            Import WHOOP (today)
          </button>
        </div>

        {workoutsForDay.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No workouts logged for this day.</p>
        ) : (
          <ListEditable workouts={workoutsForDay} selectedDate={selectedDate} />
        )}

        {error ? <p className="pt-2 text-center text-sm text-red-600">{error}</p> : null}
        {message ? <p className="pt-2 text-center text-sm text-green-600">{message}</p> : null}
      </div>
    </div>
  );
}

function ListEditable({ workouts, selectedDate }: { workouts: any[]; selectedDate: string }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<any>(null);

  if (!workouts.length) return null;

  const coerce = (v: string) => coerceDateTimeToSelectedDate(v, selectedDate);

  return (
    <ul className="space-y-2 text-sm">
      {workouts.map((w) => {
        const isEditing = editing === w.id;
        return (
          <li key={w.id} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
            {!isEditing ? (
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="font-medium">
                    {String(w.type || "Workout").replace(/^whoop/i, "WHOOP")}
                  </div>
                  <div className="text-zinc-600 dark:text-zinc-400">
                    {fmtTime(w.start_time)}
                    {w.end_time ? `–${fmtTime(w.end_time)}` : ""} •{" "}
                    {/^whoop/i.test(String(w.type || ""))
                      ? typeof w.intensity === "number"
                        ? `WHOOP Strain ${w.intensity.toFixed(1)}`
                        : "Recovery"
                      : `Strain ${typeof w.intensity === "number" ? w.intensity.toFixed(1) : "—"}`}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    className="rounded border px-2 py-1 dark:border-zinc-800"
                    onClick={() => {
                      setEditing(w.id);
                      setForm({
                        type: w.type || "Workout",
                        start: formatLocalInput(new Date(w.start_time)),
                        end: formatLocalInput(
                          w.end_time ? new Date(w.end_time) : new Date(w.start_time)
                        ),
                        intensity: w.intensity ?? 5,
                      });
                    }}
                  >
                    Edit
                  </button>
                  <button
                    className="rounded border px-2 py-1 text-red-600 dark:border-zinc-800"
                    onClick={() => {
                      if (confirm("Delete this workout?")) {
                        deleteWorkout(w.id);
                        location.reload();
                      }
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid gap-2">
                <input
                  className="rounded-xl border p-2 dark:border-zinc-800 dark:bg-zinc-900"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                />
                <input
                  type="datetime-local"
                  className="rounded-xl border p-2 dark:border-zinc-800 dark:bg-zinc-900"
                  value={form.start}
                  onChange={(e) => setForm({ ...form, start: coerce(e.target.value) })}
                />
                <input
                  type="datetime-local"
                  className="rounded-xl border p-2 dark:border-zinc-800 dark:bg-zinc-900"
                  value={form.end}
                  onChange={(e) => setForm({ ...form, end: coerce(e.target.value) })}
                />

                <label className="text-xs text-zinc-600 dark:text-zinc-400">
                  Strain: {Number(form.intensity).toFixed(1)}
                </label>
                <input
                  type="range"
                  min={0}
                  max={21}
                  step={0.1}
                  value={form.intensity}
                  onChange={(e) => setForm({ ...form, intensity: Number(e.target.value) })}
                  className="w-full"
                />

                <div className="flex gap-2">
                  <button
                    className="rounded border px-3 py-2 dark:border-zinc-800"
                    onClick={() => {
                      updateWorkout(w.id, {
                        type: form.type,
                        start_time: new Date(coerce(form.start)).toISOString(),
                        end_time: new Date(coerce(form.end)).toISOString(),
                        intensity: form.intensity,
                      });
                      location.reload();
                    }}
                  >
                    Save
                  </button>
                  <button
                    className="rounded border px-3 py-2 dark:border-zinc-800"
                    onClick={() => setEditing(null)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function fmtTime(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

function toTitleCase(s: string) {
  return s.replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());
}
