// Template fallback (plan section 15.5). Rendered only from Facts, so every number is an engine number.
import type { Explanation, Facts } from "@/lib/forecast/types";
import { formatDay, formatMoney, parseISO } from "@/lib/format";

const HELP_CONTACTS = "Citizens Advice Manchester 0808 278 7800, StepChange 0800 138 1111, MoneyHelper 0800 138 7777";

export function daysBetweenInclusive(a: string, b: string): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86_400_000) + 1;
}

function thingsYouCanDo(n: number): string {
  if (n <= 0) return "free help you can ask for";
  if (n === 1) return "one thing you can do";
  return `${n} things you can do`;
}

/** The actions worth naming, best first, with "talk to someone" only if it is the top one. */
function usefulActions(facts: Facts) {
  const top = facts.actions[0];
  if (top?.id === "talk_to_someone") return facts.actions;
  return facts.actions.filter((a) => a.id !== "talk_to_someone");
}

export function templateExplanation(facts: Facts): Explanation {
  const w = facts.warning;
  const actions = usefulActions(facts);
  const top = actions[0] ?? facts.actions[0];
  if (!w) {
    return {
      headline: `Your next ${facts.horizonDays} days look covered. Lowest point: ${formatMoney(facts.headroom.lowest, { about: true })} on ${formatDay(facts.headroom.lowestDate)}.`,
      why: facts.keyEvents.slice(0, 3).map((e) => `${e.label} on ${formatDay(e.date)}: ${formatMoney(e.amount)}.`),
      whatThisMeans: "Your balance is likely to stay above zero.",
      reassurance: "This is an estimate from your own payments and public rules.",
      nextStep: top ? `If you want more room: ${top.title}.` : "You can ask a question at any time.",
      language: "en",
    };
  }
  const days = daysBetweenInclusive(w.startDate, w.endDate);
  return {
    headline: `You may be short by about £${Math.abs(Math.round(w.depthP50)).toLocaleString("en-GB")} from ${formatDay(w.startDate)} to ${formatDay(w.endDate)}.`,
    why: w.causes.map((c) => `${c.label}: about £${Math.abs(Math.round(c.amount)).toLocaleString("en-GB")}.`),
    whatThisMeans: `Your balance is likely to go below zero for ${days} ${days === 1 ? "day" : "days"} unless something changes.`,
    reassurance: `This is predictable and there are ${thingsYouCanDo(actions.length)}.`,
    nextStep: top ? `The biggest help is: ${top.title}.` : `Free help: ${HELP_CONTACTS}.`,
    language: "en",
  };
}

/** A short plain summary for chat replies, built only from Facts. */
export function templateSummary(facts: Facts): string {
  const w = facts.warning;
  const parts: string[] = [];
  parts.push(`Your lowest point in the next ${facts.horizonDays} days is ${formatMoney(facts.headroom.lowest, { about: true })} on ${formatDay(facts.headroom.lowestDate)}.`);
  if (w) {
    parts.push(`You may be short from ${formatDay(w.startDate)} to ${formatDay(w.endDate)}.`);
    const c = w.causes[0];
    if (c) parts.push(`The biggest reason is ${lowerFirst(c.label)}: about £${Math.abs(Math.round(c.amount)).toLocaleString("en-GB")}.`);
  }
  const top = usefulActions(facts)[0];
  if (top) parts.push(`The biggest help is: ${top.title}.`);
  return parts.join(" ");
}

export function lowerFirst(s: string): string {
  if (!s) return s;
  // Keep proper nouns like "Universal Credit" and "Klarna" capitalised.
  if (/^(Universal|Klarna|Christmas|Zara|Council|Child|Disney|Virgin|Octopus|O2|Admiral)/.test(s)) return s;
  return s.charAt(0).toLowerCase() + s.slice(1);
}

export { HELP_CONTACTS };
