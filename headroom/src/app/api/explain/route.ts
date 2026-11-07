// POST /api/explain { persona, lang } -> Explanation (plan section 18). Re-run on language change.
import { z } from "zod";
import { runForecast } from "@/lib/forecast";
import type { Forecast } from "@/lib/forecast/types";
import { DEMO_TODAY } from "@/lib/config";
import { explainForecast } from "@/lib/coach/explain";
import { LanguageSchema, PersonaSchema, engineError, json, readBody } from "@/lib/actions/http";

const Body = z.object({
  persona: PersonaSchema,
  lang: LanguageSchema,
  language: z.enum(["en", "ur", "pl"]).optional(),
  warningId: z.string().max(120).optional(),
});

export async function POST(req: Request) {
  const body = await readBody(req, Body);
  if ("error" in body) return body.error;
  const { persona } = body.data;
  const lang = body.data.language ?? body.data.lang;
  let forecast: Forecast;
  try {
    forecast = runForecast(persona, DEMO_TODAY);
  } catch (err) {
    return engineError(err, persona);
  }
  return json(await explainForecast(forecast, lang));
}
