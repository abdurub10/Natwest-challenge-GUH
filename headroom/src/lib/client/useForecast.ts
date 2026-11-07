"use client";
// Shared, cached loader for GET /api/forecast. Every screen reads the same forecast,
// so it is fetched once per language and reused across tab switches.
import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { ForecastResponse, Language } from "@/lib/forecast/types";
import { getForecast } from "./api";

type Entry = { data?: ForecastResponse; error?: Error; promise?: Promise<ForecastResponse> };
const cache = new Map<Language, Entry>();
const listeners = new Set<() => void>();
let version = 0;

function notify() {
  version++;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
const getVersion = () => version;
const getServerVersion = () => -1; // server render and hydration: always "loading"

function load(lang: Language, force = false): Promise<ForecastResponse> {
  const existing = cache.get(lang);
  if (!force && existing?.promise) return existing.promise;
  if (!force && existing?.data) return Promise.resolve(existing.data);
  const promise = getForecast(lang);
  // Keep the last good data while reloading so the screen does not blank.
  cache.set(lang, { data: existing?.data, promise });
  notify();
  promise.then(
    (data) => {
      if (cache.get(lang)?.promise === promise) cache.set(lang, { data });
      notify();
    },
    (error: unknown) => {
      if (cache.get(lang)?.promise === promise) cache.set(lang, { data: existing?.data, error: error instanceof Error ? error : new Error(String(error)) });
      notify();
    },
  );
  return promise;
}

/** Any cached forecast (numbers are identical across languages; only the explanation differs). */
function anyData(lang: Language): ForecastResponse | undefined {
  return cache.get(lang)?.data ?? cache.get("en")?.data ?? [...cache.values()].find((e) => e.data)?.data;
}

export interface ForecastState {
  data?: ForecastResponse;
  /** True while nothing is cached yet for this screen. */
  loading: boolean;
  /** True while any request is in flight (including a refresh behind cached data). */
  refreshing: boolean;
  error?: Error;
  reload: () => void;
}

export function useForecast(lang: Language): ForecastState {
  const v = useSyncExternalStore(subscribe, getVersion, getServerVersion);

  useEffect(() => {
    const e = cache.get(lang);
    // Fetch once per language; an errored language waits for reload().
    if (!e?.data && !e?.promise && !e?.error) load(lang).catch(() => {});
  }, [lang]);

  const reload = useCallback(() => {
    load(lang, true).catch(() => {});
  }, [lang]);

  if (v < 0) return { loading: true, refreshing: true, reload };
  const entry = cache.get(lang);
  const data = entry?.data ?? (entry?.error ? undefined : anyData(lang));
  return {
    data,
    loading: !data && !entry?.error,
    refreshing: !!entry?.promise,
    error: data ? undefined : entry?.error,
    reload,
  };
}

/** For screens that need a fresh copy after a reset (e.g. /behind). */
export function invalidateForecasts(): void {
  cache.clear();
  notify();
}
