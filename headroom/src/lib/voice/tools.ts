// Voice coach client tools. The ElevenLabs agent calls these in the browser, the browser posts
// them to /api/voice/tool, and they run through the same CoachSession as the text coach, so the
// voice agent and the chat always quote the same engine numbers.
// Voice LLMs handle flat, simple parameters best, so the agent sends flat fields and we build
// the engine's Scenario here.
import { CoachSession, ToolInputError } from "@/lib/coach/chat";
import type { Facts, ISODate, Language, Scenario } from "@/lib/forecast/types";
import { formatDay, formatMoney } from "@/lib/format";
import { buildVoiceInsights } from "./insights";

export const VOICE_TOOL_NAMES = ["get_forecast", "simulate_scenario", "list_actions", "accept_actions", "request_human_help"] as const;
export type VoiceToolName = (typeof VOICE_TOOL_NAMES)[number];

type Params = Record<string, unknown>;

const num = (v: unknown): number | undefined => {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : undefined;
};
const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const ids = (v: unknown): string[] =>
  (Array.isArray(v) ? v.map(String) : typeof v === "string" ? v.split(/[,\s]+/) : []).map((s) => s.trim()).filter(Boolean);
const isoOr = (v: unknown, fallback: ISODate): ISODate => {
  const s = str(v);
  return s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : fallback;
};

/** Flat voice parameters -> engine Scenario. */
export function scenarioFromVoice(p: Params, today: ISODate): Scenario {
  const s: Scenario = {};
  const hours = num(p.hours_per_week);
  const payChange = num(p.weekly_pay_change);
  if (hours !== undefined || payChange !== undefined) {
    s.income = { fromDate: isoOr(p.from_date, today), ...(hours !== undefined ? { hoursPerWeek: hours } : {}), ...(payChange !== undefined ? { weeklyNetDelta: payChange } : {}) };
  }
  const amount = num(p.expense_amount);
  if (amount !== undefined) {
    s.extraExpenses = [{ date: isoOr(p.expense_date, today), amount: Math.abs(amount), label: str(p.expense_label) ?? "One-off cost" }];
  }
  const cancel = ids(p.cancel_payment_ids);
  if (cancel.length) s.removeSeriesIds = cancel;
  const energy = num(p.energy_change_pct);
  if (energy !== undefined) s.energyChangePct = energy;
  const actions = ids(p.action_ids);
  if (actions.length) s.actionIds = actions;
  return s;
}

function speakableFacts(f: Facts) {
  return {
    balanceToday: formatMoney(f.balanceToday),
    lowestPoint: `${formatMoney(f.headroom.lowest)} on ${formatDay(f.headroom.lowestDate)}`,
    warning: f.warning
      ? {
          runsShort: `${formatDay(f.warning.startDate)} to ${formatDay(f.warning.endDate)}`,
          lowest: `about ${formatMoney(f.warning.depthP50)} on ${formatDay(f.warning.lowestDate)}`,
          causes: f.warning.causes.map((c) => `${c.label}: ${formatMoney(c.amount)}`),
        }
      : "No shortfall in the next 90 days",
  };
}

export async function runVoiceTool(opts: { personaId: string; language: Language; today: ISODate; name: string; params: Params }): Promise<unknown> {
  const session = new CoachSession(opts.personaId, opts.language, opts.today);
  const p = opts.params ?? {};
  try {
    switch (opts.name as VoiceToolName) {
      case "get_forecast":
        return { insights: buildVoiceInsights(opts.personaId, opts.today, opts.language) };

      case "simulate_scenario": {
        const scenario = scenarioFromVoice(p, opts.today);
        if (!Object.keys(scenario).length) {
          return { error: "No change given. Send hours_per_week, weekly_pay_change, expense_amount, cancel_payment_ids, energy_change_pct or action_ids." };
        }
        const { facts, delta } = session.simulate(scenario);
        const before = Math.round(session.base.headroom.lowest);
        const after = before + delta;
        return {
          scenarioApplied: scenario,
          lowestBefore: formatMoney(before),
          lowestAfter: formatMoney(after),
          change: formatMoney(delta, { sign: true }),
          after: speakableFacts(facts),
        };
      }

      case "list_actions":
        return {
          options: session.listActions().map((a) => ({
            id: a.id,
            title: a.title,
            summary: a.summary,
            improvesLowestPointBy: formatMoney(a.effectByCliff),
            perMonth: formatMoney(a.effectMonthly),
            effortMinutes: a.effortMinutes,
            eligibility: a.eligibility,
            ...(a.date ? { date: formatDay(a.date) } : {}),
          })),
        };

      case "accept_actions": {
        const chosen = ids(p.action_ids);
        if (!chosen.length) return { error: "Send action_ids from list_actions, comma separated." };
        const res = await session.acceptActions({ actionIds: chosen });
        return {
          saved: res.saved,
          sentTo: "their phone by WhatsApp",
          options: res.options,
          lowestBefore: formatMoney(res.lowestBefore),
          lowestAfter: formatMoney(res.lowestAfter),
          lowestDate: formatDay(res.lowestDate),
        };
      }

      case "request_human_help":
        return session.humanHelp({ reason: str(p.reason) ?? "Asked for help in a voice call" });

      default:
        return { error: `Unknown tool ${opts.name}` };
    }
  } catch (err) {
    if (err instanceof ToolInputError) return { error: err.message };
    throw err;
  }
}
