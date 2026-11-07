// Chat coach (plan section 15.3): Claude with tools that call the real engine, max 4 tool rounds.
// Without an API key (or if Claude fails) a deterministic fallback answers the common questions
// from the same tools, so every number still comes from runForecast.
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { getActionCatalogue, runForecast } from "@/lib/forecast";
import type { ActionCandidate, CoachResponse, Facts, Forecast, ISODate, Language, Scenario, Series } from "@/lib/forecast/types";
import { buildFacts, collectAllowedNumbers, moneyVariants } from "@/lib/forecast/facts";
import { DEMO_TODAY } from "@/lib/config";
import { formatDay, formatMoney, parseISO, toISO } from "@/lib/format";
import { CHAT_MAX_TOKENS, MODEL, effortConfig, getClaude, textOf, thinkingConfig, tokenBudget } from "@/lib/coach/client";
import { COACH_SYSTEM, bannedRetryMessage, coachContext } from "@/lib/coach/prompts";
import { checkNumbers, findBannedWords } from "@/lib/coach/numberCheck";
import { lowerFirst, templateSummary } from "@/lib/coach/template";
import { logNumberCheck } from "@/lib/coach/log";
import { factsForClaude } from "@/lib/coach/explain";
import { HELP_CONTACTS, acceptPlan, requestHumanHelp } from "@/lib/actions/run";

export const MAX_TOOL_ROUNDS = 4;
const OVERALL_DEADLINE_MS = 28_000;
export const NUMBER_REPLACEMENT_PREFIX = "I can only quote the numbers in your forecast. Here is what it shows:";

export interface ChatMessage { role: "user" | "assistant"; content: string; }
export interface CoachInput { personaId: string; language: Language; messages: ChatMessage[]; today?: ISODate; }

// ---------------------------------------------------------------------------
// Scenario validation (shared by the Claude tool and the fallback parser)
// ---------------------------------------------------------------------------

const ISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
export const ScenarioSchema = z
  .object({
    actionIds: z.array(z.string().max(64)).max(12).optional(),
    income: z
      .object({
        hoursPerWeek: z.number().min(0).max(80).optional(),
        weeklyNetDelta: z.number().min(-2000).max(2000).optional(),
        fromDate: ISO,
      })
      .optional(),
    extraExpenses: z
      .array(z.object({ date: ISO, amount: z.number().min(-100000).max(100000), label: z.string().min(1).max(80) }))
      .max(10)
      .optional(),
    removeSeriesIds: z.array(z.string().max(80)).max(20).optional(),
    energyChangePct: z.number().min(-50).max(100).optional(),
  })
  .strict();

/** Normalise a scenario for the engine: positive expense amounts (pounds spent), known ids only. */
export function normaliseScenario(s: Scenario, known: { actionIds: Set<string>; seriesIds: Set<string> }): Scenario {
  const out: Scenario = {};
  if (s.actionIds?.length) {
    const ids = s.actionIds.filter((id) => known.actionIds.has(id));
    if (ids.length) out.actionIds = ids;
  }
  if (s.income) out.income = { ...s.income };
  if (s.extraExpenses?.length) out.extraExpenses = s.extraExpenses.map((e) => ({ ...e, amount: Math.abs(e.amount) }));
  if (s.removeSeriesIds?.length) {
    const ids = s.removeSeriesIds.filter((id) => known.seriesIds.has(id));
    if (ids.length) out.removeSeriesIds = ids;
  }
  if (s.energyChangePct !== undefined) out.energyChangePct = s.energyChangePct;
  return out;
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

const SCENARIO_INPUT_SCHEMA: Anthropic.Tool.InputSchema = {
  type: "object",
  properties: {
    actionIds: { type: "array", items: { type: "string" }, description: "Action ids to apply, from list_actions." },
    income: {
      type: "object",
      description: "A change in wages from a date.",
      properties: {
        hoursPerWeek: { type: "number", description: "New hours worked per week, e.g. 16." },
        weeklyNetDelta: { type: "number", description: "Change in weekly take-home pay in pounds, e.g. -40." },
        fromDate: { type: "string", description: "YYYY-MM-DD. If the person names a month, the 1st of that month." },
      },
      required: ["fromDate"],
      additionalProperties: false,
    },
    extraExpenses: {
      type: "array",
      description: "One-off costs.",
      items: {
        type: "object",
        properties: {
          date: { type: "string", description: "YYYY-MM-DD" },
          amount: { type: "number", description: "Pounds spent, as a positive number, e.g. 300." },
          label: { type: "string", description: "Short name, e.g. Car repair." },
        },
        required: ["date", "amount", "label"],
        additionalProperties: false,
      },
    },
    removeSeriesIds: { type: "array", items: { type: "string" }, description: "Ids of regular payments to stop, from get_forecast recurringPayments." },
    energyChangePct: { type: "number", description: "Energy bill change in percent, e.g. 4." },
  },
  additionalProperties: false,
};

export const COACH_TOOLS: Anthropic.Tool[] = [
  {
    name: "get_forecast",
    description: "Get the facts for the person's current 90-day forecast: balance today, lowest point, the warning and its causes, key events, ranked options, and their regular payments.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "simulate_scenario",
    description: "Re-run the forecast with a what-if change (hours, one-off costs, cancelling a regular payment, energy change, or options). Returns the new facts and delta: the change in the lowest point.",
    input_schema: SCENARIO_INPUT_SCHEMA,
  },
  {
    name: "list_actions",
    description: "List the ranked options the person can take, with their pound effects, effort and eligibility.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "accept_actions",
    description: "Set up a plan with the chosen option ids: saves it, schedules reminders and sends it by WhatsApp. Only call when the person asks to set something up.",
    input_schema: {
      type: "object",
      properties: { actionIds: { type: "array", items: { type: "string" }, description: "Option ids from list_actions." } },
      required: ["actionIds"],
      additionalProperties: false,
    },
  },
  {
    name: "request_human_help",
    description: "Hand over to free human help (Citizens Advice, StepChange, MoneyHelper) when the person is distressed or the problem is not about timing. Returns the contacts.",
    input_schema: {
      type: "object",
      properties: { reason: { type: "string", description: "Short reason, e.g. worried about heating." } },
      required: ["reason"],
      additionalProperties: false,
    },
  },
];

interface RecurringSummary { id: string; label: string; amount: number; cadence: Series["cadence"]; direction: Series["direction"]; }

/** One coach turn's tool state: the base forecast, every number tools returned, the latest facts. */
export class CoachSession {
  readonly toolCalls: string[] = [];
  readonly allowed = new Set<string>();
  readonly base: Forecast;
  readonly baseFacts: Facts;
  lastFacts: Facts;
  private readonly known: { actionIds: Set<string>; seriesIds: Set<string> };

  constructor(readonly personaId: string, readonly language: Language, readonly today: ISODate) {
    this.base = runForecast(personaId, today);
    this.baseFacts = buildFacts(this.base, language);
    this.lastFacts = this.baseFacts;
    this.allow(this.baseFacts.allowedNumbers);
    let catalogueIds: string[] = [];
    try {
      catalogueIds = getActionCatalogue().map((a) => a.id);
    } catch {
      /* catalogue is optional here; forecast actions are enough */
    }
    this.known = {
      actionIds: new Set([...catalogueIds, ...this.base.actions.map((a) => a.id)]),
      seriesIds: new Set(this.base.recurring.map((s) => s.id)),
    };
  }

  get actionIds(): string[] {
    return [...this.known.actionIds];
  }

  allow(values: string[]): void {
    for (const v of values) this.allowed.add(v);
  }
  allowMoney(...ns: number[]): void {
    for (const n of ns) if (Number.isFinite(n)) this.allow(moneyVariants(n));
  }

  recurringSummary(): RecurringSummary[] {
    return this.base.recurring
      .filter((s) => s.cadence !== "annual")
      .map((s) => ({ id: s.id, label: s.label, amount: Math.round(s.amountP50), cadence: s.cadence, direction: s.direction }));
  }

  findSeries(name: string): Series | undefined {
    const norm = (s: string) => s.toLowerCase().replace(/\+/g, " plus ").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
    const want = norm(name);
    const words = want.split(" ").filter((w) => w.length >= 3 && !["the", "my", "plus", "subscription", "payment", "bill"].includes(w));
    if (!words.length) return undefined;
    const outs = this.base.recurring.filter((s) => s.direction === "out");
    return (
      outs.find((s) => norm(s.label) === want) ??
      outs.find((s) => words.every((w) => norm(s.label).includes(w) || norm(s.id).includes(w))) ??
      outs.find((s) => words.some((w) => norm(s.label).split(" ").includes(w) || norm(s.id).includes(w)))
    );
  }

  getForecast() {
    this.toolCalls.push("get_forecast");
    const recurringPayments = this.recurringSummary();
    this.allowMoney(...recurringPayments.map((r) => r.amount));
    this.lastFacts = this.baseFacts;
    return { facts: factsForClaude(this.baseFacts), recurringPayments };
  }

  simulate(input: unknown): { forecast: Forecast; facts: Facts; delta: number; result: unknown } {
    this.toolCalls.push("simulate_scenario");
    const parsed = ScenarioSchema.safeParse(input ?? {});
    if (!parsed.success) throw new ToolInputError(z.prettifyError(parsed.error));
    const scenario = normaliseScenario(parsed.data as Scenario, this.known);
    const forecast = runForecast(this.personaId, this.today, scenario);
    const facts = buildFacts(forecast, this.language);
    const lowestBefore = Math.round(this.base.headroom.lowest);
    const lowestAfter = Math.round(forecast.headroom.lowest);
    const delta = lowestAfter - lowestBefore;
    this.allow(facts.allowedNumbers);
    this.allowMoney(delta, lowestBefore, lowestAfter);
    for (const e of scenario.extraExpenses ?? []) this.allowMoney(e.amount);
    this.lastFacts = facts;
    return {
      forecast,
      facts,
      delta,
      result: { scenarioApplied: scenario, facts: factsForClaude(facts), delta: { lowestBefore, lowestAfter, change: delta } },
    };
  }

  listActions(): ActionCandidate[] {
    this.toolCalls.push("list_actions");
    const actions = this.base.actions.map((a) => ({ ...a, effectByCliff: Math.round(a.effectByCliff), effectMonthly: Math.round(a.effectMonthly) }));
    this.allow(
      collectAllowedNumbers({
        money: actions.flatMap((a) => [a.effectByCliff, a.effectMonthly]),
        dates: actions.map((a) => a.date ?? ""),
        texts: actions.flatMap((a) => [a.title, a.summary, ...a.steps]),
      }),
    );
    return actions;
  }

  async acceptActions(input: unknown) {
    this.toolCalls.push("accept_actions");
    const parsed = z.object({ actionIds: z.array(z.string()).min(1).max(12) }).safeParse(input);
    if (!parsed.success) throw new ToolInputError(z.prettifyError(parsed.error));
    const res = await acceptPlan(this.personaId, parsed.data.actionIds, this.today);
    const titles = this.base.actions.filter((a) => res.plan.actionIds.includes(a.id)).map((a) => a.title);
    this.allowMoney(res.plan.lowestBefore, res.plan.lowestAfter);
    this.allow(collectAllowedNumbers({ money: [], dates: [res.plan.lowestDate], texts: titles }));
    return {
      saved: true,
      sentBy: "WhatsApp",
      options: titles,
      lowestBefore: Math.round(res.plan.lowestBefore),
      lowestAfter: Math.round(res.plan.lowestAfter),
      lowestDate: res.plan.lowestDate,
    };
  }

  async humanHelp(input: unknown) {
    this.toolCalls.push("request_human_help");
    const reason = z.object({ reason: z.string().max(300) }).safeParse(input);
    const res = await requestHumanHelp(this.personaId, reason.success ? reason.data.reason : "Asked for help");
    return { contacts: res.contacts, note: "Free, confidential help. Give these gently." };
  }

  async execute(name: string, input: unknown): Promise<unknown> {
    switch (name) {
      case "get_forecast":
        return this.getForecast();
      case "simulate_scenario":
        return this.simulate(input).result;
      case "list_actions":
        return { actions: this.listActions() };
      case "accept_actions":
        return this.acceptActions(input);
      case "request_human_help":
        return this.humanHelp(input);
      default:
        throw new ToolInputError(`Unknown tool ${name}`);
    }
  }
}

export class ToolInputError extends Error {}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export async function runCoach(input: CoachInput): Promise<CoachResponse> {
  const today = input.today ?? DEMO_TODAY;
  const session = new CoachSession(input.personaId, input.language, today);
  const lastUser = [...input.messages].reverse().find((m) => m.role === "user")?.content ?? "";

  if (getClaude()) {
    try {
      const res = await coachWithClaude(session, input.messages);
      if (res) return res;
    } catch (err) {
      console.error("[coach] Claude failed, using fallback:", err instanceof Error ? err.message : err);
    }
  }
  return fallbackCoach(session, lastUser);
}

function toMessageParams(messages: ChatMessage[]): Anthropic.MessageParam[] {
  const out: Anthropic.MessageParam[] = [];
  for (const m of messages) {
    const text = m.content.trim();
    if (!text) continue;
    if (out.length === 0 && m.role !== "user") continue; // the first turn must be the person's
    out.push({ role: m.role, content: text });
  }
  return out;
}

async function coachWithClaude(session: CoachSession, history: ChatMessage[]): Promise<CoachResponse | null> {
  const client = getClaude();
  if (!client) return null;
  const messages = toMessageParams(history);
  if (!messages.length || messages[messages.length - 1].role !== "user") return null;

  const started = Date.now();
  const system: Anthropic.TextBlockParam[] = [
    { type: "text", text: COACH_SYSTEM, cache_control: { type: "ephemeral" } },
    { type: "text", text: coachContext(session.today, session.language, session.actionIds) },
  ];
  const call = (toolChoice?: Anthropic.ToolChoice) =>
    client.messages.create({
      model: MODEL,
      max_tokens: tokenBudget(CHAT_MAX_TOKENS),
      system,
      tools: COACH_TOOLS,
      ...(toolChoice ? { tool_choice: toolChoice } : {}),
      messages,
      ...effortConfig(),
      ...thinkingConfig(),
    });

  let res = await call();
  for (let round = 0; res.stop_reason === "tool_use" && round < MAX_TOOL_ROUNDS; round++) {
    const uses = res.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    messages.push({ role: "assistant", content: res.content });
    const results: Anthropic.ToolResultBlockParam[] = await Promise.all(
      uses.map(async (u) => {
        try {
          const out = await session.execute(u.name, u.input);
          return { type: "tool_result" as const, tool_use_id: u.id, content: JSON.stringify(out) };
        } catch (err) {
          const msg = err instanceof ToolInputError ? `Invalid input: ${err.message}` : "The tool failed. Answer from what you already have.";
          if (!(err instanceof ToolInputError)) console.error(`[coach] tool ${u.name} failed:`, err);
          return { type: "tool_result" as const, tool_use_id: u.id, content: msg, is_error: true };
        }
      }),
    );
    messages.push({ role: "user", content: results });
    if (Date.now() - started > OVERALL_DEADLINE_MS) return null;
    // After the last allowed round, ask for words only.
    res = await call(round + 1 >= MAX_TOOL_ROUNDS ? { type: "none" } : undefined);
  }
  if (res.stop_reason === "refusal") return null;

  let reply = textOf(res);
  if (!reply) return null;

  // Word filter (plan section 22): one rewrite, then a safe replacement.
  let banned = findBannedWords(reply);
  if (banned.length && Date.now() - started < OVERALL_DEADLINE_MS) {
    messages.push({ role: "assistant", content: res.content });
    messages.push({ role: "user", content: bannedRetryMessage(banned) });
    const again = await call({ type: "none" });
    const rewritten = textOf(again);
    if (rewritten && findBannedWords(rewritten).length === 0) {
      reply = rewritten;
      banned = [];
    }
  }

  const allowed = [...session.allowed];
  const check = checkNumbers(reply, allowed);
  await logNumberCheck(session.personaId, "coach", check, banned);
  if (!check.ok || banned.length) {
    reply = `${NUMBER_REPLACEMENT_PREFIX} ${templateSummary(session.lastFacts)}`;
    const recheck = checkNumbers(reply, allowed);
    return { reply, toolCalls: session.toolCalls, facts: session.lastFacts, checked: recheck.ok };
  }
  return { reply, toolCalls: session.toolCalls, facts: session.lastFacts, checked: true };
}

// ---------------------------------------------------------------------------
// Deterministic fallback: parse simple intents into a Scenario and answer from engine numbers.
// ---------------------------------------------------------------------------

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MONTH_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTH_WORD = /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i;

/** The 1st of the named month, the next time it starts on or after today (today if it is this month). */
export function monthStart(text: string, today: ISODate): { date: ISODate; month: string } | undefined {
  const m = MONTH_WORD.exec(text);
  if (!m) return undefined;
  // "may" is also a verb: only accept it when it reads like a month ("in May", "May 2027").
  if (m[1].toLowerCase() === "may" && !/\b(in|from|by|during|this|next|of|until)\s+may\b|\bmay\s+\d/i.test(text)) return undefined;
  const mi = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase());
  const t = parseISO(today);
  const ty = t.getUTCFullYear();
  const tm = t.getUTCMonth();
  if (mi === tm) return { date: today, month: MONTH_FULL[mi] };
  const year = mi > tm ? ty : ty + 1;
  return { date: toISO(new Date(Date.UTC(year, mi, 1))), month: MONTH_FULL[mi] };
}

function addDays(d: ISODate, n: number): ISODate {
  const dt = parseISO(d);
  dt.setUTCDate(dt.getUTCDate() + n);
  return toISO(dt);
}

const about = (n: number) => formatMoney(n, { about: true });

function topSuggestion(forecast: Forecast): ActionCandidate | undefined {
  const a = forecast.actions;
  return a[0]?.id === "talk_to_someone" ? a[0] : a.find((x) => x.id !== "talk_to_someone");
}

function suggestionSentence(a: ActionCandidate | undefined): string {
  if (!a) return "";
  if (a.id === "talk_to_someone") return "Talking to someone is free and it works: Citizens Advice, StepChange or MoneyHelper.";
  return `One thing that helps: ${a.title.replace(/[.\s]+$/, "")}.`;
}

function comparison(before: number, after: number): string {
  const diff = Math.round(after) - Math.round(before);
  if (Math.abs(diff) < 1) return "That is about the same as now.";
  return diff < 0 ? `That is about £${Math.abs(diff)} lower than now.` : `That is about £${diff} higher than now.`;
}

const DISTRESS =
  /\b(food|heating|hungry|bailiffs?|debt collectors?|can'?t cope|cannot cope|scared|desperate|evict(ed|ion)?|hopeless|suicid\w*|can'?t afford (food|to eat|heating))\b/i;
const HUMAN = /\b(talk to (a |an )?(person|human|someone|somebody|adviser|advisor)|speak to (a |an )?(person|human|someone|adviser|advisor)|citizens advice|stepchange|moneyhelper)\b/i;
const SET_UP = /\b(set (this|it|that|them|my plan) up|set up (my|the|this) plan|send (me )?(the |my )?plan|accept (the |my )?plan)\b/i;
const UC = /\b(universal credit|uc)\b/i;
const HOURS_A = /\bhours?\b[^\d£?]{0,40}?(\d{1,2}(?:\.\d+)?)\b/i;
const HOURS_B = /\b(\d{1,2}(?:\.\d+)?)\s*(?:hours|hrs|hr)\b/i;
const CANCEL = /\b(?:cancel(?:led|ling)?|stop(?:ped|ping)?|get rid of|without|drop(?:ped)?)\s+(?:my\s+|the\s+|paying\s+(?:for\s+)?)?([a-z0-9+&' ]{2,30}?)(?:\s+(?:subscription|payment|bill|membership))?(?=[?.!,]|\s+(?:in|from|next|this|now|today)\b|$)/i;
const MONEY = /£\s?(\d[\d,]*(?:\.\d{1,2})?)/;
const SPEND_WORDS = /\b(afford|spend|spending|buy|pay|cost|costs|trip|repair|extra|bill|present|gift)\b/i;

export async function fallbackCoach(session: CoachSession, text: string): Promise<CoachResponse> {
  const q = text.trim();
  let reply: string;
  let facts = session.baseFacts;

  try {
    if (DISTRESS.test(q) || HUMAN.test(q)) {
      await session.humanHelp({ reason: q.slice(0, 200) });
      reply =
        "I'm sorry things feel hard. Talking to someone is free and it works. " +
        HELP_CONTACTS.map((c) => `${c.name}: ${c.phone}`).join(". ") +
        ". They can help with food, heating and money worries.";
    } else if (SET_UP.test(q)) {
      const ids = session.base.actions.filter((a) => a.defaultOn).map((a) => a.id);
      if (!ids.length) {
        reply = "There is nothing ticked to set up yet. You can pick options on the Plan screen.";
      } else {
        const res = await session.acceptActions({ actionIds: ids });
        reply = `Done. I saved your plan and sent it by WhatsApp: ${res.options.join("; ")}. Your lowest point goes from ${about(res.lowestBefore)} to ${formatMoney(res.lowestAfter, { about: true, sign: true })}.`;
      }
    } else if (HOURS_A.test(q) || HOURS_B.test(q)) {
      const hours = Number((HOURS_A.exec(q) ?? HOURS_B.exec(q))![1]);
      const when = monthStart(q, session.today);
      const fromDate = when?.date ?? addDays(session.today, 1);
      const sim = session.simulate({ income: { hoursPerWeek: hours, fromDate } });
      facts = sim.facts;
      const h = sim.forecast.headroom;
      const fromWords = when ? `from ${when.month}` : "from now";
      const top = topSuggestion(sim.forecast);
      const verb = /\b(drop|fall|cut|reduc|down|lose|fewer|less)/i.test(q) ? "drop" : /\b(go up|rise|increase|more|extra|up to)\b/i.test(q) ? "go up" : "change";
      const parts = [
        `If your hours ${verb} to ${hours} a week ${fromWords}, your lowest point would be ${about(h.lowest)} on ${formatDay(h.lowestDate)}, instead of ${about(session.base.headroom.lowest)}.`,
        comparison(session.base.headroom.lowest, h.lowest),
      ];
      const structural = h.lowest < session.base.headroom.lowest - 1 && h.lowest < 0;
      if (top && top.id !== "talk_to_someone") parts.push(suggestionSentence(top));
      if (structural || top?.id === "talk_to_someone") {
        parts.push("Because this is a lasting change, not just timing, a free adviser at Citizens Advice can help. I can send them your summary if you want.");
      }
      reply = parts.filter(Boolean).join(" ");
    } else if (CANCEL.test(q)) {
      const name = CANCEL.exec(q)![1].trim();
      const series = session.findSeries(name);
      if (!series) {
        const list = session
          .recurringSummary()
          .filter((r) => r.direction === "out" && r.cadence === "monthly")
          .slice(0, 6)
          .map((r) => r.label);
        reply = `I could not find a regular payment called "${name}". Your monthly payments include ${list.join(", ")}.`;
      } else {
        const sim = session.simulate({ removeSeriesIds: [series.id] });
        facts = sim.facts;
        const h = sim.forecast.headroom;
        const amount = Math.round(series.amountP50);
        session.allowMoney(amount);
        const per = series.cadence === "monthly" ? " a month" : series.cadence === "weekly" ? " a week" : "";
        reply = [
          `If you cancel ${series.label}, you keep about £${amount}${per}.`,
          `Your lowest point would be ${about(h.lowest)} on ${formatDay(h.lowestDate)}, instead of ${about(session.base.headroom.lowest)}.`,
          comparison(session.base.headroom.lowest, h.lowest),
        ].join(" ");
      }
    } else if (MONEY.test(q) && SPEND_WORDS.test(q)) {
      const amount = Number(MONEY.exec(q)![1].replace(/,/g, ""));
      const when = monthStart(q, session.today);
      const date = when?.date ?? addDays(session.today, 1);
      const { label, phrase } = expenseLabel(q);
      const sim = session.simulate({ extraExpenses: [{ date, amount, label }] });
      facts = sim.facts;
      const h = sim.forecast.headroom;
      const money = amount === Math.round(amount) ? `£${amount}` : formatMoney(amount);
      const what = phrase ? `${money} ${phrase}` : money;
      const whenWords = when ? ` in ${when.month}` : "";
      const head = `If you spend ${what}${whenWords}, your lowest point would be ${about(h.lowest)} on ${formatDay(h.lowestDate)}, instead of ${about(session.base.headroom.lowest)}.`;
      let verdict: string;
      if (h.lowest >= 50) verdict = "You can cover it and still have some room.";
      else if (h.lowest >= 0) verdict = "You can cover it, but money would be tight.";
      else {
        // The short stretch that holds the lowest point.
        const w = sim.forecast.warnings.find((x) => x.startDate <= h.lowestDate && x.endDate >= h.lowestDate);
        const first = sim.forecast.warnings[0];
        if (w) verdict = `It would make the short stretch deeper. If it can wait until after ${formatDay(w.endDate)}, it is easier to cover.`;
        else if (first) verdict = `It would take your balance below zero from ${formatDay(first.startDate)}.`;
        else verdict = "It would take your balance below zero for a while.";
      }
      reply = [head, verdict, h.lowest < 0 ? suggestionSentence(topSuggestion(sim.forecast)) : ""].filter(Boolean).join(" ");
    } else if (UC.test(q)) {
      reply = ucAnswer(session);
    } else {
      reply = templateSummary(session.baseFacts);
    }
  } catch (err) {
    console.error("[coach] fallback failed:", err);
    reply = templateSummary(session.baseFacts);
    facts = session.baseFacts;
  }

  const check = checkNumbers(reply, [...session.allowed]);
  await logNumberCheck(session.personaId, "coach", check);
  if (!check.ok) {
    reply = `${NUMBER_REPLACEMENT_PREFIX} ${templateSummary(session.baseFacts)}`;
    facts = session.baseFacts;
  }
  return { reply, toolCalls: session.toolCalls, facts, checked: checkNumbers(reply, [...session.allowed]).ok };
}

/** "Can I afford £120 for a school trip in January?" -> label "School trip", phrase "for a school trip". */
export function expenseLabel(q: string): { label: string; phrase: string } {
  const forMatch = /\bfor\s+((?:a|an|the|my|our)\s+)?([a-z' -]{3,40}?)(?=\s+(?:in|on|from|next|this|by|before|after)\b|[?.!,]|$)/i.exec(q);
  if (forMatch) {
    const noun = forMatch[2].trim();
    return { label: capitalise(noun), phrase: `for ${(forMatch[1] ?? "").toLowerCase()}${lowerFirst(noun)}` };
  }
  // "car repair £300 in December" / "a £300 car repair"
  const before = /([a-z' -]{3,40}?)\s*£/i.exec(q);
  const after = /£\s?\d[\d,.]*\s+(?:on\s+|for\s+)?([a-z' -]{3,40}?)(?=\s+(?:in|on|from|next|this|by)\b|[?.!,]|$)/i.exec(q);
  const strip = (s: string) =>
    s.replace(/\b(what if|what happens if|can i afford|could i afford|if i|i need|i have|i spend|spend|spending|pay|paying|a|an|the|my|to|of|about|extra|cost|costs|i|we)\b/gi, " ").replace(/\s+/g, " ").trim();
  const noun = strip(before?.[1] ?? "") || strip(after?.[1] ?? "");
  if (noun.length >= 3) return { label: capitalise(noun), phrase: `on ${/^[aeiou]/i.test(noun) ? "an" : "a"} ${lowerFirst(noun)}` };
  return { label: "One-off cost", phrase: "" };
}

function capitalise(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

const UC_GENERAL =
  "Universal Credit looks at the wages paid in each monthly period. When five weekly paydays land in one period, it counts more wages and pays less the next time.";

function sentence(s: string): string {
  const t = s.trim().replace(/[.\s]+$/, "");
  return t ? `${t}.` : "";
}

function ucAnswer(session: CoachSession): string {
  session.toolCalls.push("get_forecast");
  const f = session.base;
  const w = f.warnings[0];
  const cause = w?.causes.find((c) => c.ruleId === "uc_assessment_period") ?? w?.causes.find((c) => /universal credit/i.test(c.label));
  const ucEvents = f.days
    .flatMap((d) => d.events)
    .filter((e) => e.amount > 0 && (e.seriesId === "uc" || e.ruleId === "uc_assessment_period" || /universal credit/i.test(e.label)));
  // The lowered payment: the one whose note names five paydays, else the smallest one.
  const low =
    ucEvents.find((e) => /\b5 paydays|five paydays|less/i.test(e.note ?? "")) ??
    [...ucEvents].sort((a, b) => a.amount - b.amount)[0];
  const usual = low ? ucEvents.filter((e) => e !== low).sort((a, b) => b.amount - a.amount)[0] : undefined;
  const next = low ? ucEvents.find((e) => e.date > low.date) : undefined;
  const rule = f.rulesFired.find((r) => r.ruleId === "uc_assessment_period" && (!low || r.date === low.date) && /5 paydays|less/i.test(r.note));

  if (!low && !cause) return `${templateSummary(session.baseFacts)} ${UC_GENERAL}`;

  session.allow(
    collectAllowedNumbers({
      money: [cause?.amount ?? NaN, low?.amount ?? NaN, usual?.amount ?? NaN, next?.amount ?? NaN],
      dates: [low?.date ?? "", next?.date ?? "", usual?.date ?? ""],
      texts: [cause?.label ?? "", cause?.detail ?? "", rule?.note ?? "", low?.note ?? ""],
    }),
  );

  const parts: string[] = [];
  if (low) {
    parts.push(`Your Universal Credit on ${formatDay(low.date)} is ${about(low.amount)}.`);
    if (usual && usual.amount > low.amount) parts.push(`It is usually ${about(usual.amount)}.`);
  }
  // The engine's own explanation of the rule, used once.
  const why = cause?.detail ?? rule?.note ?? low?.note ?? "";
  if (why) parts.push(sentence(why));
  parts.push(UC_GENERAL);
  if (next && !why.includes(formatDay(next.date))) parts.push(`The next payment is on ${formatDay(next.date)}.`);
  return parts.join(" ");
}
