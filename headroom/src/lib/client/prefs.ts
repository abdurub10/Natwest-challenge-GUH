// Client-side preferences persisted to localStorage, exposed as an external store
// so React can read them with useSyncExternalStore (no hydration mismatch: the server
// snapshot is always DEFAULT_PREFS, the client switches to the stored values after hydration).
import type { Language, PlanResponse, TextSize } from "@/lib/forecast/types";

export const PREFS_KEY = "headroom.prefs.v1";

export interface Prefs {
  language: Language;
  textSize: TextSize;
  /** Ticked actions on the Plan screen. null = not chosen yet, use the engine's defaultOn. */
  actionIds: string[] | null;
  /** Last plan accepted with "Set this up", for the Done screen. */
  lastPlan: PlanResponse | null;
}

export const DEFAULT_PREFS: Prefs = { language: "en", textSize: "normal", actionIds: null, lastPlan: null };

const LANGS: Language[] = ["en", "ur", "pl"];

function sanitize(raw: unknown): Prefs {
  if (!raw || typeof raw !== "object") return DEFAULT_PREFS;
  const r = raw as Partial<Prefs>;
  return {
    language: LANGS.includes(r.language as Language) ? (r.language as Language) : "en",
    textSize: r.textSize === "large" ? "large" : "normal",
    actionIds: Array.isArray(r.actionIds) ? r.actionIds.filter((x): x is string => typeof x === "string") : null,
    lastPlan: r.lastPlan && typeof r.lastPlan === "object" && "plan" in r.lastPlan ? (r.lastPlan as PlanResponse) : null,
  };
}

let current: Prefs | null = null;
const listeners = new Set<() => void>();

function read(): Prefs {
  try {
    const s = window.localStorage.getItem(PREFS_KEY);
    return s ? sanitize(JSON.parse(s)) : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

export function getPrefs(): Prefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  if (!current) current = read();
  return current;
}

export function getServerPrefs(): Prefs {
  return DEFAULT_PREFS;
}

export function setPrefs(patch: Partial<Prefs> | ((p: Prefs) => Partial<Prefs>)): void {
  const prev = getPrefs();
  const next = { ...prev, ...(typeof patch === "function" ? patch(prev) : patch) };
  current = next;
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  } catch {
    // storage full or blocked: keep the in-memory value
  }
  listeners.forEach((l) => l());
}

/** Back to defaults (demo reset / "Delete my forecast"). */
export function resetPrefs(): void {
  current = DEFAULT_PREFS;
  try {
    window.localStorage.removeItem(PREFS_KEY);
  } catch {
    // ignore
  }
  listeners.forEach((l) => l());
}

function onStorage(e: StorageEvent) {
  if (e.key !== null && e.key !== PREFS_KEY) return;
  current = read();
  listeners.forEach((l) => l());
}

export function subscribePrefs(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

/**
 * Inline script for the root layout <head>: applies text size and language to <html>
 * before first paint, so large text does not flash.
 */
export const PREFS_BOOT_SCRIPT = `(function(){try{var p=JSON.parse(localStorage.getItem(${JSON.stringify(PREFS_KEY)})||"{}");var d=document.documentElement;d.setAttribute("data-text-size",p.textSize==="large"?"large":"normal");if(p.language==="ur"||p.language==="pl")d.setAttribute("lang",p.language);}catch(e){}})();`;
