// POST /api/voice/tool { persona, lang, name, params } -> { result }
// Runs one ElevenLabs client tool call against the forecast engine (see src/lib/voice/tools.ts).
import { z } from "zod";
import { LanguageSchema, PersonaSchema, engineError, json, readBody } from "@/lib/actions/http";
import { DEMO_TODAY } from "@/lib/config";
import { VOICE_TOOL_NAMES, runVoiceTool } from "@/lib/voice/tools";

export const maxDuration = 30;

const Body = z.object({
  persona: PersonaSchema,
  lang: LanguageSchema,
  name: z.enum(VOICE_TOOL_NAMES),
  params: z.record(z.string(), z.unknown()).default({}),
});

export async function POST(req: Request) {
  const body = await readBody(req, Body);
  if ("error" in body) return body.error;
  const { persona, lang, name, params } = body.data;
  try {
    const result = await runVoiceTool({ personaId: persona, language: lang, today: DEMO_TODAY, name, params });
    return json({ result });
  } catch (err) {
    return engineError(err, persona);
  }
}
