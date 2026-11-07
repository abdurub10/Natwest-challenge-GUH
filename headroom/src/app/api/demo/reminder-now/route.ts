// POST /api/demo/reminder-now -> { ok }: sends the Friday reminder now via N8N_REMINDER_URL or the fallback.
import { z } from "zod";
import { sendReminder } from "@/lib/actions/run";
import { PersonaSchema, json, readBody } from "@/lib/actions/http";

const Body = z.object({ persona: PersonaSchema });

export async function POST(req: Request) {
  const body = await readBody(req, Body);
  if ("error" in body) return body.error;
  const res = await sendReminder(body.data.persona);
  const ok = res.path !== "failed";
  return json({ ok, path: res.path, detail: res.detail, message: res.message }, { status: ok ? 200 : 502 });
}
