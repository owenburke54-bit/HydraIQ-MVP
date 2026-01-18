"use client";

import { useEffect, useState } from "react";
import {
  formatNYDate,
  getIntakesByDateNY,
  getProfile,
  getSupplementsByDateNY,
  getWhoopMetrics,
  getWorkoutsByDateNY,
  getEffectiveActualMl,
} from "../lib/localStore";
import { WORKOUT_ML_PER_MIN } from "../lib/hydration";

const NOTIF_KEY = "hydra.notifications";

function readNotifSettings() {
  try {
    return JSON.parse(localStorage.getItem(NOTIF_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeNotifSettings(patch: Record<string, any>) {
  const current = readNotifSettings();
  localStorage.setItem(NOTIF_KEY, JSON.stringify({ ...current, ...patch }));
}

export default function SmartNotifications() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const s = readNotifSettings();
    setEnabled(!!s.enabled);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    const tick = () => {
      const now = Date.now();
      const settings = readNotifSettings();
      if (settings.lastSent && now - Number(settings.lastSent) < 2 * 60 * 60 * 1000) return;

      const profile = getProfile();
      const weight = profile?.weight_kg ?? 0;
      if (!weight || weight <= 0) return;

      const today = formatNYDate(new Date());
      const intakes = getIntakesByDateNY(today);
      const actualMl = getEffectiveActualMl(today, intakes);
      const workouts = getWorkoutsByDateNY(today);
      const supplements = getSupplementsByDateNY(today);

      const baseTargetMl = Math.round(weight * 35);
      const workoutMl = workouts.reduce((sum, w) => {
        const start = new Date(w.start_time);
        const end = w.end_time ? new Date(w.end_time) : start;
        const mins = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
        const strain = typeof w.intensity === "number" ? Math.max(0, Math.min(21, w.intensity)) : 5;
        const intensityFactor = 0.5 + strain / 21;
        return sum + mins * WORKOUT_ML_PER_MIN * intensityFactor;
      }, 0);

      const creatineMl = supplements
        .filter((s) => s.type === "creatine" && s.grams && s.grams > 0)
        .reduce((sum, s) => sum + (s.grams || 0) * 70, 0);

      const whoop = getWhoopMetrics(today);
      const sleepHours = whoop?.sleep_hours ?? null;
      const recoveryPct = whoop?.recovery_score ?? null;

      let modPct = 0;
      if (sleepHours != null) {
        if (sleepHours < 7.5) modPct += Math.max(0, 7.5 - sleepHours) * 0.03;
        else if (sleepHours > 8.5) modPct += -Math.max(0, sleepHours - 8.5) * 0.02;
      }
      if (recoveryPct != null) {
        if (recoveryPct < 33) modPct += 0.05;
        else if (recoveryPct < 66) modPct += 0.02;
      }

      const targetMl = Math.round(baseTargetMl + workoutMl + creatineMl + (baseTargetMl + workoutMl + creatineMl) * modPct);
      if (targetMl <= 0) return;

      const deficitOz = Math.max(0, (targetMl - actualMl) / 29.5735);
      const lastDrink = intakes
        .map((i) => new Date(i.timestamp).getTime())
        .sort((a, b) => b - a)[0];

      const lastWorkout = workouts
        .map((w) => new Date(w.start_time).getTime())
        .sort((a, b) => b - a)[0];

      const nowMs = Date.now();
      const minsSinceDrink = lastDrink ? (nowMs - lastDrink) / 60000 : Infinity;
      const minsSinceWorkout = lastWorkout ? (nowMs - lastWorkout) / 60000 : Infinity;

      let body: string | null = null;
      if (minsSinceWorkout <= 90 && (!lastDrink || lastDrink < (lastWorkout || 0))) {
        body = "Workout logged — hydrate soon to recover well.";
      } else if (deficitOz >= 20 && minsSinceDrink >= 90) {
        body = `You're behind by ~${Math.round(deficitOz)} oz. Small steady sips help.`;
      }

      if (!body) return;

      new Notification("HydraIQ • Smart check-in", { body });
      writeNotifSettings({ lastSent: now });
    };

    const id = window.setInterval(tick, 30 * 60 * 1000);
    tick();
    return () => window.clearInterval(id);
  }, [enabled]);

  return null;
}

