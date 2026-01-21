"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { buildDailyHydrationSnapshot, type DailyHydrationSnapshot } from "@/lib/hydrationSnapshot";
import { getHydraVersion, getWhoopMetrics, setWhoopMetrics } from "@/lib/localStore";

type SnapshotCache = Record<string, DailyHydrationSnapshot>;

type SnapshotContextValue = {
  version: number;
  getSnapshot: (dateNY: string) => DailyHydrationSnapshot | null;
  ensureSnapshot: (dateNY: string) => void;
  refreshSnapshot: (dateNY: string) => void;
  requestWhoopMetrics: (dateNY: string) => Promise<void>;
};

const HydrationSnapshotContext = createContext<SnapshotContextValue | null>(null);

const SNAPSHOT_CACHE_KEY = "hydra.snapshotCache";
const MAX_CACHE_DAYS = 10;

function loadSnapshotCache(): SnapshotCache {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(SNAPSHOT_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as SnapshotCache;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveSnapshotCache(cache: SnapshotCache) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SNAPSHOT_CACHE_KEY, JSON.stringify(cache));
  } catch {}
}

function pruneSnapshotCache(cache: SnapshotCache): SnapshotCache {
  const dates = Object.keys(cache).sort();
  if (dates.length <= MAX_CACHE_DAYS) return cache;
  const keep = new Set(dates.slice(-MAX_CACHE_DAYS));
  const next: SnapshotCache = {};
  for (const d of dates) if (keep.has(d)) next[d] = cache[d];
  return next;
}

export default function HydrationSnapshotProvider({ children }: { children: React.ReactNode }) {
  const cacheRef = useRef<SnapshotCache>({});
  const inflightWhoop = useRef<Set<string>>(new Set());
  const [tick, setTick] = useState(0);

  useEffect(() => {
    cacheRef.current = loadSnapshotCache();
    setTick((t) => t + 1);
  }, []);

  const refreshSnapshot = useCallback((dateNY: string) => {
    if (!dateNY) return;
    const version = getHydraVersion();
    const next = buildDailyHydrationSnapshot(dateNY, version);
    const updated = { ...cacheRef.current, [dateNY]: next };
    const pruned = pruneSnapshotCache(updated);
    cacheRef.current = pruned;
    saveSnapshotCache(pruned);
    setTick((t) => t + 1);
  }, []);

  const ensureSnapshot = useCallback(
    (dateNY: string) => {
      if (!dateNY) return;
      const cached = cacheRef.current[dateNY];
      const version = getHydraVersion();
      if (!cached || cached.version !== version) {
        refreshSnapshot(dateNY);
      }
    },
    [refreshSnapshot]
  );

  const getSnapshot = useCallback((dateNY: string) => {
    return cacheRef.current[dateNY] ?? null;
  }, []);

  const requestWhoopMetrics = useCallback(async (dateNY: string) => {
    if (!dateNY) return;
    const cached = getWhoopMetrics(dateNY);
    const TTL_MS = 10 * 60 * 1000;
    const fresh =
      cached &&
      cached.fetched_at &&
      Date.now() - new Date(cached.fetched_at).getTime() < TTL_MS;
    const needsPerf = !cached || cached.sleep_performance == null;
    if (fresh && !needsPerf) return;
    if (inflightWhoop.current.has(dateNY)) return;
    inflightWhoop.current.add(dateNY);
    try {
      const res = await fetch(`/api/whoop/metrics?date=${dateNY}`, { credentials: "include" });
      if (!res.ok) return;
      const j = await res.json();
      setWhoopMetrics(dateNY, {
        sleep_hours: j.sleep_hours ?? null,
        sleep_performance: j.sleep_performance ?? null,
        recovery_score: j.recovery_score ?? null,
      });
    } catch {
    } finally {
      inflightWhoop.current.delete(dateNY);
    }
  }, []);

  useEffect(() => {
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent).detail as
        | { date?: string; dates?: string[]; all?: boolean }
        | undefined;
      if (!detail) return;
      if (detail.all) {
        cacheRef.current = {};
        saveSnapshotCache({});
        setTick((t) => t + 1);
        return;
      }
      const dates = detail.dates ?? (detail.date ? [detail.date] : []);
      dates.forEach((d) => refreshSnapshot(d));
    };

    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      if (e.key.startsWith("hydra.")) {
        cacheRef.current = {};
        setTick((t) => t + 1);
      }
    };

    window.addEventListener("hydra:datachange", onChange as EventListener);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("hydra:datachange", onChange as EventListener);
      window.removeEventListener("storage", onStorage);
    };
  }, [refreshSnapshot]);

  const value = useMemo<SnapshotContextValue>(
    () => ({
      version: tick,
      getSnapshot,
      ensureSnapshot,
      refreshSnapshot,
      requestWhoopMetrics,
    }),
    [tick, getSnapshot, ensureSnapshot, refreshSnapshot, requestWhoopMetrics]
  );

  return (
    <HydrationSnapshotContext.Provider value={value}>{children}</HydrationSnapshotContext.Provider>
  );
}

export function useDailyHydrationSnapshot(dateNY: string) {
  const ctx = useContext(HydrationSnapshotContext);
  const snapshot = useMemo(
    () => (ctx ? ctx.getSnapshot(dateNY) : null),
    [ctx, dateNY, ctx?.version]
  );

  useEffect(() => {
    ctx?.ensureSnapshot(dateNY);
  }, [ctx, dateNY]);

  return snapshot;
}

export function useHydrationSnapshotActions() {
  const ctx = useContext(HydrationSnapshotContext);
  if (!ctx) {
    throw new Error("useHydrationSnapshotActions must be used within HydrationSnapshotProvider");
  }
  return {
    refreshSnapshot: ctx.refreshSnapshot,
    requestWhoopMetrics: ctx.requestWhoopMetrics,
  };
}
