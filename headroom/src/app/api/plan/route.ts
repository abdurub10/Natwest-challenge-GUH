// POST /api/plan { persona, actionIds } -> { plan, activity, lowestAfter } (plan section 18).
import { z } from "zod";
import type { PlanResponse } from "@/lib/forecast/types";
import { PlanError, acceptPlan } from "@/lib/actions/run";
import { PersonaSchema, engineError, json, jsonError, readBody } from "@/lib/actions/http";

const Body = z.object({
  persona: PersonaSchema,
  actionIds: z.array(z.string().min(1).max(64)).min(1, "Pick at least one option.").max(12),
});

export async function POST(req: Request) {
  const body = await readBody(req, Body);
  if ("error" in body) return body.error;
  try {
    const res: PlanResponse = await acceptPlan(body.data.persona, body.data.actionIds);
    return json(res);
  } catch (err) {
    if (err instanceof PlanError) return jsonError(err.status, err.message);
    return engineError(err, body.data.persona);
  }
}
