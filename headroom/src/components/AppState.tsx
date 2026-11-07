"use client";
// App-wide client state: language, text size, ticked plan actions and the last accepted plan.
// Persisted to localStorage (src/lib/client/prefs.ts) so Plan toggles carry to Done and survive reloads.
import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import type { Language, PlanResponse, TextSize } from "@/lib/forecast/types";
import { getPrefs, getServerPrefs, resetPrefs, setPrefs, subscribePrefs, type Prefs } from "@/lib/client/prefs";
import { t as translate, tf as translateFill, textDir, type I18nKey } from "@/lib/i18n";

export interface AppStateValue extends Prefs {
  setLanguage: (l: Language) => void;
  setTextSize: (s: TextSize) => void;
  setActionIds: (ids: string[]) => void;
  setLastPlan: (p: PlanResponse | null) => void;
  resetAll: () => void;
  /** Translate a UI label in the current language. */
  t: (key: I18nKey) => string;
  /** Translate and fill {placeholders}. */
  tf: (key: I18nKey, vars: Record<string, string | number>) => string;
  /** "rtl" for Urdu text blocks, otherwise undefined. */
  dir: "rtl" | undefined;
  /** False during server render and hydration; true once stored prefs are readable. */
  ready: boolean;
}

const noopSubscribe = () => () => {};

const AppStateContext = createContext<AppStateValue | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const prefs = useSyncExternalStore(subscribePrefs, getPrefs, getServerPrefs);
  const ready = useSyncExternalStore(noopSubscribe, () => true, () => false);

  // Apply text size and language to <html>. useLayoutEffect so it lands before paint
  // (the inline boot script in the root layout covers the very first paint).
  useLayoutEffect(() => {
    const el = document.documentElement;
    el.setAttribute("data-text-size", prefs.textSize);
    el.setAttribute("lang", prefs.language);
  }, [prefs.textSize, prefs.language]);

  const setLanguage = useCallback((language: Language) => setPrefs({ language }), []);
  const setTextSize = useCallback((textSize: TextSize) => setPrefs({ textSize }), []);
  const setActionIds = useCallback((actionIds: string[]) => setPrefs({ actionIds }), []);
  const setLastPlan = useCallback((lastPlan: PlanResponse | null) => setPrefs({ lastPlan }), []);
  const resetAll = useCallback(() => resetPrefs(), []);

  const value = useMemo<AppStateValue>(
    () => ({
      ...prefs,
      setLanguage,
      setTextSize,
      setActionIds,
      setLastPlan,
      resetAll,
      t: (key) => translate(prefs.language, key),
      tf: (key, vars) => translateFill(prefs.language, key, vars),
      dir: textDir(prefs.language),
      ready,
    }),
    [prefs, ready, setLanguage, setTextSize, setActionIds, setLastPlan, resetAll],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateValue {
  const v = useContext(AppStateContext);
  if (!v) throw new Error("useAppState must be used inside <AppStateProvider>");
  return v;
}
