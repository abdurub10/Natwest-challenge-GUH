// POST /api/whatif  body: Scenario (plus optional persona) -> Forecast, no explanation. Plan section 18.
// Used by the Plan screen toggles and the coach's simulate_scenario tool.
import { z } from "zod";
import { ACTION_IDS, runForecast, UnknownPersonaError } from "@/lib/forecast";
import type { Forecast, Scenario } from "@/lib/forecast/types";
import { DEMO_TODAY } from "@/lib/config";

const ISODate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "dates must be YYYY-MM-DD").refine((d) => !Number.isNaN(Date.parse(`${d}T00:00:00Z`)), "not a real date");
const money = z.number().finite().min(-100_000).max(100_000);

const Body = z
  .object({
    persona: z.string().regex(/^[a-z0-9_-]{1,32}$/, "persona must be a short lowercase id").default("aisha"),
    actionIds: z.array(z.enum(ACTION_IDS as [string, ...string[]])).max(20).optional(),
    income: z
      .object({
        hoursPerWeek: z.number().finite().min(0).max(80).optional(),
        weeklyNetDelta: money.optional(),
        fromDate: ISODate,
      })
      .refine((i) => i.hoursPerWeek !== undefined || i.weeklyNetDelta !== undefined, "income needs hoursPerWeek or weeklyNetDelta")
      .optional(),
    extraExpenses: z
      .array(z.object({ date: ISODate, amount: money, label: z.string().trim().min(1).max(80) }))
      .max(20)
      .optional(),
    removeSeriesIds: z.array(z.string().min(1).max(64)).max(30).optional(),
    energyChangePct: z.number().finite().min(-50).max(100).optional(),
  });

const noStore = { "Cache-Control": "no-store" };

function error(status: number, message: string): Response {
  return Response.json({ error: message }, { status, headers: noStore });
}

export async function POST(request: Request) {
  let raw: unknown = {};
  try {
    const text = await request.text();
    if (text.trim()) raw = JSON.parse(text);
  } catch {
    return error(400, "Body must be valid JSON");
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return error(400, z.prettifyError(parsed.error));
  const { persona, ...rest } = parsed.data;
  const scenario: Scenario = {
    ...(rest.actionIds ? { actionIds: rest.actionIds } : {}),
    ...(rest.income ? { income: rest.income } : {}),
    ...(rest.extraExpenses ? { extraExpenses: rest.extraExpenses } : {}),
    ...(rest.removeSeriesIds ? { removeSeriesIds: rest.removeSeriesIds } : {}),
    ...(rest.energyChangePct !== undefined ? { energyChangePct: rest.energyChangePct } : {}),
  };

  let forecast: Forecast;
  try {
    forecast = runForecast(persona, DEMO_TODAY, scenario);
  } catch (err) {
    if (err instanceof UnknownPersonaError) return error(404, `Unknown persona: ${persona}`);
    console.error("[api/whatif] engine error", err);
    return error(500, "We couldn't work out that what-if. Try again in a moment.");
  }
  return Response.json(forecast, { headers: noStore });
}
