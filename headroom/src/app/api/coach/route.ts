// POST /api/coach { persona, lang, messages } -> CoachResponse (plan section 18).
// Stateless: the message history travels in the request body.
import { z } from "zod";
import type { CoachResponse } from "@/lib/forecast/types";
import { runCoach } from "@/lib/coach/chat";
import { LanguageSchema, PersonaSchema, engineError, json, jsonError, readBody } from "@/lib/actions/http";

export const maxDuration = 60;

const Body = z.object({
  persona: PersonaSchema,
  lang: LanguageSchema,
  language: z.enum(["en", "ur", "pl"]).optional(),
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
    .min(1, "messages must not be empty")
    .max(40),
});

export async function POST(req: Request) {
  const body = await readBody(req, Body);
  if ("error" in body) return body.error;
  const { persona, messages } = body.data;
  const lang = body.data.language ?? body.data.lang;
  const recent = messages.slice(-20);
  if (!recent.some((m) => m.role === "user" && m.content.trim())) return jsonError(400, "Ask a question first.");
  try {
    const res: CoachResponse = await runCoach({ personaId: persona, language: lang, messages: recent });
    return json(res);
  } catch (err) {
    return engineError(err, persona);
  }
}
