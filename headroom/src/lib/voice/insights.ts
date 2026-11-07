// Voice coach: a plain-text summary of everything the forecast found, handed to the ElevenLabs
// agent as the {{insights}} dynamic variable when a call starts. Every number comes from the
// engine (runForecast + buildFacts), so the agent can open with a full summary without guessing.
import { runForecast } from "@/lib/forecast";
import { buildFacts } from "@/lib/forecast/facts";
import type { ISODate, Language, Series } from "@/lib/forecast/types";
import { formatDay, formatMoney } from "@/lib/format";

const CADENCE: Partial<Record<Series["cadence"], string>> = { weekly: "a week", fortnightly: "a fortnight", four_weekly: "every four weeks", monthly: "a month" };

export function buildVoiceInsights(personaId: string, today: ISODate, language: Language = "en"): string {
  const forecast = runForecast(personaId, today);
  const facts = buildFacts(forecast, language);
  const lines: string[] = [];

  lines.push(`Today is ${formatDay(facts.today)}. Balance today: ${formatMoney(facts.balanceToday)}. Forecast covers the next ${facts.horizonDays} days.`);

  const w = facts.warning;
  if (w) {
    lines.push(
      `Main warning: money is likely to run short from ${formatDay(w.startDate)} to ${formatDay(w.endDate)}. ` +
        `Lowest in that stretch: about ${formatMoney(w.depthP50)} on ${formatDay(w.lowestDate)} ` +
        `(range ${formatMoney(w.depthP20)} to ${formatMoney(w.depthP80)}, confidence ${w.confidence}).`,
    );
    if (w.causes.length) {
      lines.push(`Causes, biggest first: ${w.causes.map((c) => `${c.label}, ${formatMoney(c.amount)} (${c.detail})`).join("; ")}.`);
    }
  } else {
    lines.push("No shortfall warning in the next 90 days.");
  }

  const h = facts.headroom;
  lines.push(
    `Lowest point in the whole 90 days: ${formatMoney(h.lowest)} on ${formatDay(h.lowestDate)}` +
      (h.afterPlan !== undefined ? `. With the suggested options it becomes ${formatMoney(h.afterPlan)}.` : "."),
  );

  if (facts.actions.length) {
    lines.push(
      `Options, best first: ${facts.actions
        .map((a) => `"${a.title}" (id ${a.id}): improves the lowest point by ${formatMoney(a.effectByCliff)}, about ${a.effortMinutes} minutes of effort${a.date ? `, on ${formatDay(a.date)}` : ""}`)
        .join("; ")}.`,
    );
  }

  if (facts.keyEvents.length) {
    lines.push(`Key dates: ${facts.keyEvents.map((e) => `${formatDay(e.date)} ${e.label} ${formatMoney(e.amount, { sign: true })}${e.note ? ` (${e.note})` : ""}`).join("; ")}.`);
  }

  const regular = forecast.recurring.filter((s) => s.direction === "out" && s.cadence !== "annual");
  if (regular.length) {
    lines.push(`Regular payments out (id in brackets): ${regular.map((s) => `${s.label} ${formatMoney(s.amountP50)} ${CADENCE[s.cadence] ?? s.cadence} (${s.id})`).join("; ")}.`);
  }

  if (facts.pastEpisodes.length) lines.push(`History: ${facts.pastEpisodes.join("; ")}.`);

  return lines.join("\n");
}
