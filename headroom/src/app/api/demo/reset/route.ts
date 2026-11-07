// POST /api/demo/reset -> { ok }: clears plans and activity, restores default settings (plan section 5.4).
import { z } from "zod";
import { getStore } from "@/lib/store";
import { setN8nEnabled } from "@/lib/n8n";
import { resetCounters } from "@/lib/coach/counters";
import { clearExplainCache } from "@/lib/coach/explain";
import { recordActivity } from "@/lib/actions/run";
import { PersonaSchema, json, jsonError, readBody } from "@/lib/actions/http";

const Body = z.object({ persona: PersonaSchema });

export async function POST(req: Request) {
  const body = await readBody(req, Body);
  if ("error" in body) return body.error;
  const persona = body.data.persona;
  try {
    await getStore().reset(persona);
  } catch (err) {
    console.error("[demo/reset] failed:", err);
    return jsonError(500, "Reset failed");
  }
  setN8nEnabled(true);
  resetCounters();
  clearExplainCache();
  await recordActivity({ profileId: persona, kind: "reset", title: "Demo reset", detail: null, source: "app" });
  return json({ ok: true });
}
