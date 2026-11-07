// GET /api/activity?persona=aisha -> Activity[] (latest 20, newest first). The rail polls every 3 s.
// POST /api/activity (n8n callbacks) requires header x-callback-secret === CALLBACK_SECRET.
import type { NextRequest } from "next/server";
import { z } from "zod";
import { getStore } from "@/lib/store";
import { PersonaSchema, json, jsonError, readBody, secretsMatch } from "@/lib/actions/http";

// Reading the request's search params makes this handler dynamic (never prerendered).
export async function GET(req: NextRequest) {
  const persona = PersonaSchema.safeParse(req.nextUrl.searchParams.get("persona") ?? undefined);
  if (!persona.success) return jsonError(400, "persona must be a short lowercase id");
  const limitRaw = Number(req.nextUrl.searchParams.get("limit") ?? 20);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.trunc(limitRaw), 1), 50) : 20;
  try {
    return json(await getStore().listActivity(persona.data, limit));
  } catch (err) {
    console.error("[activity] list failed:", err);
    return jsonError(500, "Could not load activity");
  }
}

const Body = z.object({
  profileId: PersonaSchema,
  kind: z.enum(["plan_created", "message_sent", "reminder_sent", "handoff_sent", "reset", "error"]),
  title: z.string().min(1).max(120),
  detail: z.string().max(500).nullish(),
  source: z.enum(["app", "n8n", "fallback"]).default("n8n"),
});

export async function POST(req: Request) {
  const expected = process.env.CALLBACK_SECRET;
  if (!expected) return jsonError(503, "CALLBACK_SECRET is not set on the server");
  if (!secretsMatch(req.headers.get("x-callback-secret"), expected)) return jsonError(401, "Bad callback secret");
  const body = await readBody(req, Body);
  if ("error" in body) return body.error;
  try {
    await getStore().addActivity({ ...body.data, detail: body.data.detail ?? null });
    return json({ ok: true });
  } catch (err) {
    console.error("[activity] write failed:", err);
    return jsonError(500, "Could not save activity");
  }
}
