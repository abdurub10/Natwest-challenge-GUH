// n8n webhook calls (plan section 17). The demo toggle lives on globalThis so it survives
// dev reloads; /api/demo/n8n flips it to force the built-in fallback.

export type N8nWorkflow = "plan" | "reminder" | "handoff";

export interface N8nResult { ok: boolean; status?: number; error?: string; skipped?: "disabled" | "unset"; }

const N8N_TIMEOUT_MS = 5_000;

const g = globalThis as typeof globalThis & { __headroomN8nEnabled?: boolean };

export function n8nEnabled(): boolean {
  return g.__headroomN8nEnabled ?? true;
}

export function setN8nEnabled(enabled: boolean): boolean {
  g.__headroomN8nEnabled = enabled;
  return enabled;
}

export function n8nUrl(workflow: N8nWorkflow): string | undefined {
  const url =
    workflow === "plan" ? process.env.N8N_PLAN_CREATED_URL : workflow === "reminder" ? process.env.N8N_REMINDER_URL : process.env.N8N_HANDOFF_URL;
  return url && /^https?:\/\//.test(url) ? url : undefined;
}

/** True when a workflow would actually be called (URL set and the demo toggle on). */
export function n8nActive(workflow: N8nWorkflow = "plan"): boolean {
  return n8nEnabled() && !!n8nUrl(workflow);
}

/** POST a JSON payload to an n8n webhook with the shared secret and a 5 s timeout. Never throws. */
export async function postToN8n(workflow: N8nWorkflow, payload: unknown): Promise<N8nResult> {
  if (!n8nEnabled()) return { ok: false, skipped: "disabled" };
  const url = n8nUrl(workflow);
  if (!url) return { ok: false, skipped: "unset" };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-headroom-secret": process.env.N8N_SHARED_SECRET ?? "" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(N8N_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, status: res.status, error: `n8n returned ${res.status}` };
    return { ok: true, status: res.status };
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    return { ok: false, error: name === "TimeoutError" || name === "AbortError" ? "n8n timed out after 5 s" : err instanceof Error ? err.message : String(err) };
  }
}
