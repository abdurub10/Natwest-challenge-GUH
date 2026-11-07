// GET /api/forecast?persona=aisha&lang=en -> ForecastResponse (Forecast + explanation). Plan section 18.
// The engine is deterministic and runs on DEMO_TODAY, never the real clock. The explanation is
// optional: if the explain module fails, is missing or is slow, the forecast still returns.
import type { NextRequest } from "next/server";
import { z } from "zod";
import { runForecast, UnknownPersonaError } from "@/lib/forecast";
import type { Explanation, Forecast, ForecastResponse, Language } from "@/lib/forecast/types";
import { DEMO_TODAY } from "@/lib/config";

const Query = z.object({
  persona: z.string().regex(/^[a-z0-9_-]{1,32}$/, "persona must be a short lowercase id").default("aisha"),
  lang: z.enum(["en", "ur", "pl"]).default("en"),
});

/** The explanation never holds the forecast back for longer than this. */
const EXPLAIN_BUDGET_MS = 9_000;

const noStore = { "Cache-Control": "no-store" };

function error(status: number, message: string): Response {
  return Response.json({ error: message }, { status, headers: noStore });
}

async function explain(forecast: Forecast, lang: Language): Promise<Explanation | undefined> {
  try {
    const mod = await import("@/lib/coach/explain");
    if (typeof mod.explainForecast !== "function") return undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<undefined>((resolve) => {
      timer = setTimeout(() => resolve(undefined), EXPLAIN_BUDGET_MS);
    });
    try {
      return await Promise.race([mod.explainForecast(forecast, lang), timeout]);
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    console.error("[api/forecast] explanation failed, returning the forecast without it", err);
    return undefined;
  }
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const parsed = Query.safeParse({ persona: params.get("persona") ?? undefined, lang: params.get("lang") ?? undefined });
  if (!parsed.success) return error(400, z.prettifyError(parsed.error));
  const { persona, lang } = parsed.data;

  let forecast: Forecast;
  try {
    forecast = runForecast(persona, DEMO_TODAY);
  } catch (err) {
    if (err instanceof UnknownPersonaError) return error(404, `Unknown persona: ${persona}`);
    console.error("[api/forecast] engine error", err);
    return error(500, "We couldn't work out the forecast. Try again in a moment.");
  }

  const explanation = await explain(forecast, lang);
  const body: ForecastResponse = explanation ? { ...forecast, explanation } : forecast;
  return Response.json(body, { headers: noStore });
}
