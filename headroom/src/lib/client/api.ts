// Typed fetch helpers for every API route in plan section 18.
// The browser only ever talks to the server through these.
import type {
  Activity,
  CoachResponse,
  Explanation,
  Forecast,
  ForecastResponse,
  HealthResponse,
  Language,
  PlanResponse,
  Scenario,
} from "@/lib/forecast/types";

export const PERSONA = "aisha";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type RequestOpts = { signal?: AbortSignal; timeoutMs?: number };

async function request<T>(path: string, init: RequestInit & RequestOpts = {}): Promise<T> {
  const { timeoutMs = 20000, signal, ...rest } = init;
  const controller = new AbortController();
  const onAbort = () => controller.abort(signal?.reason);
  if (signal) {
    if (signal.aborted) controller.abort(signal.reason);
    else signal.addEventListener("abort", onAbort, { once: true });
  }
  const timer = setTimeout(() => controller.abort(new DOMException("Timed out", "TimeoutError")), timeoutMs);
  try {
    const res = await fetch(path, {
      cache: "no-store",
      ...rest,
      headers: { Accept: "application/json", ...(rest.body ? { "Content-Type": "application/json" } : {}), ...rest.headers },
      signal: controller.signal,
    });
    const text = await res.text();
    let data: unknown = undefined;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        throw new ApiError(`Bad response from ${path}`, res.status);
      }
    }
    if (!res.ok) {
      const msg = data && typeof data === "object" && "error" in data ? String((data as { error: unknown }).error) : `Request failed (${res.status})`;
      throw new ApiError(msg, res.status);
    }
    return data as T;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

const json = (body: unknown) => JSON.stringify(body);

/** GET /api/forecast?persona=aisha&lang=en -> Forecast + explanation */
export function getForecast(lang: Language, opts: RequestOpts = {}): Promise<ForecastResponse> {
  const q = new URLSearchParams({ persona: PERSONA, lang });
  return request<ForecastResponse>(`/api/forecast?${q}`, { ...opts, timeoutMs: opts.timeoutMs ?? 25000 });
}

/** POST /api/whatif with a Scenario -> Forecast (no explanation) */
export function whatIf(scenario: Scenario, opts: RequestOpts = {}): Promise<Forecast> {
  return request<Forecast>("/api/whatif", { method: "POST", body: json(scenario), ...opts });
}

/** POST /api/explain { persona, lang } -> Explanation */
export function explain(lang: Language, opts: RequestOpts = {}): Promise<Explanation> {
  return request<Explanation>("/api/explain", { method: "POST", body: json({ persona: PERSONA, lang }), ...opts, timeoutMs: opts.timeoutMs ?? 25000 });
}

export interface ChatMessage { role: "user" | "assistant"; content: string }

/** POST /api/coach { persona, lang, messages } -> { reply, toolCalls, facts?, checked } */
export function coach(lang: Language, messages: ChatMessage[], opts: RequestOpts = {}): Promise<CoachResponse> {
  return request<CoachResponse>("/api/coach", {
    method: "POST",
    body: json({ persona: PERSONA, lang, messages }),
    ...opts,
    timeoutMs: opts.timeoutMs ?? 45000,
  });
}

/** POST /api/plan { persona, actionIds } -> { plan, activity, lowestAfter } */
export function acceptPlan(actionIds: string[], opts: RequestOpts = {}): Promise<PlanResponse> {
  return request<PlanResponse>("/api/plan", { method: "POST", body: json({ persona: PERSONA, actionIds }), ...opts, timeoutMs: opts.timeoutMs ?? 30000 });
}

/** GET /api/activity?persona=aisha -> Activity[] (latest 20) */
export function getActivity(opts: RequestOpts = {}): Promise<Activity[]> {
  const q = new URLSearchParams({ persona: PERSONA });
  return request<Activity[]>(`/api/activity?${q}`, { ...opts, timeoutMs: opts.timeoutMs ?? 8000 });
}

/** GET /api/health. The server may add n8nEnabled / n8nConfigured for /behind. */
export type HealthInfo = HealthResponse & { n8nEnabled?: boolean; n8nConfigured?: boolean };
export function getHealth(opts: RequestOpts = {}): Promise<HealthInfo> {
  return request<HealthInfo>("/api/health", { ...opts, timeoutMs: opts.timeoutMs ?? 8000 });
}

/** POST /api/demo/reset */
export function demoReset(opts: RequestOpts = {}): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>("/api/demo/reset", { method: "POST", body: json({ persona: PERSONA }), ...opts });
}

/** POST /api/demo/reminder-now */
export function demoReminderNow(opts: RequestOpts = {}): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>("/api/demo/reminder-now", { method: "POST", body: json({ persona: PERSONA }), ...opts, timeoutMs: opts.timeoutMs ?? 30000 });
}

/** POST /api/demo/n8n { enabled } -> { enabled } */
export function demoN8n(enabled: boolean, opts: RequestOpts = {}): Promise<{ enabled: boolean; configured?: boolean }> {
  return request<{ enabled: boolean; configured?: boolean }>("/api/demo/n8n", { method: "POST", body: json({ enabled }), ...opts });
}

export function isAbortError(e: unknown): boolean {
  return e instanceof DOMException && e.name === "AbortError";
}
