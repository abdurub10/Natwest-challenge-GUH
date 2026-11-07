// Coach without an API key: the deterministic fallback must answer the four Ask chips
// (plan section 15.3) from the real engine, pass the number check and never use banned words.
import { beforeAll, describe, expect, it } from "vitest";
import { runForecast } from "@/lib/forecast";
import { buildFacts } from "@/lib/forecast/facts";
import { DEMO_TODAY, PERSONA_ID } from "@/lib/config";
import { formatMoney } from "@/lib/format";
import { runCoach } from "@/lib/coach/chat";
import { explainForecastDetailed } from "@/lib/coach/explain";
import { checkNumbers, findBannedWords } from "@/lib/coach/numberCheck";
import { buildPlanMessage, buildReminderMessage, MAX_MESSAGE_CHARS } from "@/lib/actions/run";

const CHIPS = [
  "What if my hours drop to 16 a week in January?",
  "What happens if I cancel Disney+?",
  "Can I afford £120 for a school trip in January?",
  "Why is my Universal Credit lower in January?",
];

const ask = (q: string) => runCoach({ personaId: PERSONA_ID, language: "en", messages: [{ role: "user", content: q }] });

beforeAll(() => {
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.N8N_PLAN_CREATED_URL;
  delete process.env.TWILIO_ACCOUNT_SID;
});

describe("coach fallback (no API key)", () => {
  it("answers the hours chip with the simulated lowest point from the engine", async () => {
    const res = await ask(CHIPS[0]);
    const sim = runForecast(PERSONA_ID, DEMO_TODAY, { income: { hoursPerWeek: 16, fromDate: "2027-01-01" } });
    const simFacts = buildFacts(sim, "en");
    const lowest = formatMoney(sim.headroom.lowest);

    expect(res.toolCalls).toContain("simulate_scenario");
    expect(res.reply).toContain(lowest);
    // The number quoted is one the simulated forecast's facts allow.
    expect(checkNumbers(lowest, simFacts.allowedNumbers).ok).toBe(true);
    expect(res.facts?.headroom.lowest).toBe(Math.round(sim.headroom.lowest));
    expect(res.checked).toBe(true);
    expect(findBannedWords(res.reply)).toEqual([]);
    // Hours dropping is a lasting change: the reply offers free human help.
    if (sim.headroom.lowest < runForecast(PERSONA_ID, DEMO_TODAY).headroom.lowest) {
      expect(res.reply).toMatch(/Citizens Advice/);
    }
  });

  it.each(CHIPS)("answers %s with checked engine numbers and no banned words", async (q) => {
    const res = await ask(q);
    expect(res.reply.length).toBeGreaterThan(20);
    expect(res.reply).toMatch(/£\d/);
    expect(res.checked).toBe(true);
    expect(findBannedWords(res.reply)).toEqual([]);
    expect(res.reply).not.toMatch(/!/);
  });

  it("simulates cancelling Disney+ when the engine knows the payment", async () => {
    const base = runForecast(PERSONA_ID, DEMO_TODAY);
    const res = await ask(CHIPS[1]);
    const disney = base.recurring.find((s) => /disney/i.test(s.label) || /disney/i.test(s.id));
    if (disney) {
      expect(res.toolCalls).toContain("simulate_scenario");
      expect(res.reply).toMatch(/Disney/i);
    } else {
      expect(res.reply).toMatch(/could not find/i);
    }
  });

  it("adds the school trip as a one-off cost in January", async () => {
    const res = await ask(CHIPS[2]);
    const sim = runForecast(PERSONA_ID, DEMO_TODAY, { extraExpenses: [{ date: "2027-01-01", amount: 120, label: "School trip" }] });
    expect(res.toolCalls).toContain("simulate_scenario");
    expect(res.reply).toContain(formatMoney(sim.headroom.lowest));
  });

  it("explains the lower Universal Credit", async () => {
    const res = await ask(CHIPS[3]);
    expect(res.reply).toMatch(/Universal Credit/);
    expect(res.reply).toMatch(/payday/i);
  });

  it("routes distress to free human help", async () => {
    const res = await ask("I can't afford food this week and I'm scared");
    expect(res.toolCalls).toContain("request_human_help");
    expect(res.reply).toMatch(/Citizens Advice/);
  });
});

describe("explanation and messages (no API key)", () => {
  it("falls back to a template explanation that passes the number check", async () => {
    const forecast = runForecast(PERSONA_ID, DEMO_TODAY);
    const facts = buildFacts(forecast, "en");
    const { explanation, source } = await explainForecastDetailed(forecast, "en");
    expect(source).toBe("template");
    const texts = [explanation.headline, ...explanation.why, explanation.whatThisMeans, explanation.reassurance, explanation.nextStep];
    expect(checkNumbers(texts, facts.allowedNumbers).ok).toBe(true);
    expect(findBannedWords(texts)).toEqual([]);
  });

  it("builds a plan message and a reminder under 320 characters", () => {
    const forecast = runForecast(PERSONA_ID, DEMO_TODAY);
    const actions = forecast.actions.filter((a) => a.defaultOn);
    const after = runForecast(PERSONA_ID, DEMO_TODAY, { actionIds: actions.map((a) => a.id) });
    const msg = buildPlanMessage(forecast, actions, after.headroom.lowest);
    expect(msg.startsWith("Headroom: your plan.")).toBe(true);
    expect(msg.length).toBeLessThanOrEqual(MAX_MESSAGE_CHARS);
    expect(msg).toContain(formatMoney(after.headroom.lowest, { about: true, sign: true }));
    const reminder = buildReminderMessage(forecast, { planForecast: after, planActions: actions });
    expect(reminder.length).toBeLessThanOrEqual(MAX_MESSAGE_CHARS);
    expect(reminder).toMatch(/^Fri \d{1,2} [A-Z][a-z]{2}\./);
  });
});
