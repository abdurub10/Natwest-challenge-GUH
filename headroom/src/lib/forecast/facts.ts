// buildFacts (plan section 12): everything Claude is allowed to say a number about.
// Pure and deterministic. All money is rounded to whole pounds so the words match the UI.
import type { ActionCandidate, CalendarEvent, Cause, Facts, Forecast, Language, Warning } from "@/lib/forecast/types";
import { formatDay, formatMoney, formatShortDay, parseISO, toISO } from "@/lib/format";

const MAX_KEY_EVENTS = 8;
const MAX_ACTIONS = 6;
const MAX_PAST_EPISODES = 4;

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const r = (n: number) => Math.round(n);

function addDays(d: string, n: number): string {
  const dt = parseISO(d);
  dt.setUTCDate(dt.getUTCDate() + n);
  return toISO(dt);
}

function roundWarning(w: Warning): Warning {
  return {
    ...w,
    depthP50: r(w.depthP50),
    depthP20: r(w.depthP20),
    depthP80: r(w.depthP80),
    causes: w.causes.map((c: Cause) => ({ ...c, amount: r(c.amount) })),
  };
}

function roundAction(a: ActionCandidate): ActionCandidate {
  return { ...a, effectByCliff: r(a.effectByCliff), effectMonthly: r(a.effectMonthly) };
}

/** Pick the events that matter: rule-driven, large, noted, or inside the warning window. */
export function selectKeyEvents(forecast: Forecast, max = MAX_KEY_EVENTS): CalendarEvent[] {
  const warning = forecast.warnings[0];
  const windowStart = warning ? addDays(warning.startDate, -10) : undefined;
  const windowEnd = warning ? addDays(warning.endDate, 1) : undefined;
  const causeRules = new Set((warning?.causes ?? []).map((c) => c.ruleId).filter(Boolean));
  const causeIds = new Set((warning?.causes ?? []).map((c) => c.id));
  const causeLabels = (warning?.causes ?? []).map((c) => c.label.toLowerCase());
  const isCauseEvent = (e: CalendarEvent) =>
    (!!e.seriesId && causeIds.has(e.seriesId)) || causeLabels.some((l) => l.startsWith(e.label.toLowerCase().split(" ")[0]));

  type Scored = { e: CalendarEvent; score: number; order: number };
  const scored: Scored[] = [];
  let order = 0;
  for (const day of forecast.days) {
    for (const e of day.events) {
      const abs = Math.abs(e.amount);
      const inWindow = !!warning && e.date >= (windowStart as string) && e.date <= (windowEnd as string);
      let score = 0;
      if (e.ruleId === "uc_assessment_period") score += 120;
      else if (e.ruleId && causeRules.has(e.ruleId)) score += 80;
      else if (e.ruleId && e.ruleId !== "debit_after_weekend") score += 50;
      if (e.note) score += 25;
      if (inWindow) score += 40;
      if (isCauseEvent(e)) score += 45;
      if (abs < 1) score -= 60; // markers like "No council tax in February" matter less than money moving
      score += Math.min(abs, 1000) / 20;
      // Small routine spending only matters if it falls in the short stretch.
      if (!e.ruleId && !e.note && abs < 50 && !(inWindow && abs >= 25)) continue;
      scored.push({ e, score, order: order++ });
    }
  }
  scored.sort((a, b) => b.score - a.score || a.order - b.order);

  const perLabel = new Map<string, number>();
  const picked: Scored[] = [];
  for (const s of scored) {
    const n = perLabel.get(s.e.label) ?? 0;
    // At most two of the same payment (e.g. two wages); one for spread-out annual spending.
    if (n >= (s.e.ruleId === "annual_repeat" ? 1 : 2)) continue;
    perLabel.set(s.e.label, n + 1);
    picked.push(s);
    if (picked.length >= max) break;
  }
  return picked
    .sort((a, b) => (a.e.date < b.e.date ? -1 : a.e.date > b.e.date ? 1 : a.order - b.order))
    .map((s) => ({ ...s.e, amount: r(s.e.amount) }));
}

function monthLabel(m: string): string {
  const match = /^(\d{4})-(\d{2})/.exec(m);
  if (!match) return m;
  return `${MONTH_NAMES[Number(match[2]) - 1]} ${match[1]}`;
}

/** "October 2026: 7 days in overdraft, lowest −£96" */
export function buildPastEpisodes(forecast: Forecast): string[] {
  const months = forecast.history?.months ?? [];
  const overdraft = months
    .filter((m) => m.overdraftDays > 0)
    .map((m) => `${monthLabel(m.month)}: ${m.overdraftDays} ${m.overdraftDays === 1 ? "day" : "days"} in overdraft, lowest ${formatMoney(m.low)}`);
  const fivePaydayOnly = months
    .filter((m) => m.fivePayday && m.overdraftDays === 0)
    .map((m) => `${monthLabel(m.month)}: Universal Credit was lower after 5 paydays, lowest ${formatMoney(m.low)}`);
  // Newest first reads most naturally ("this happened to you in October").
  return [...overdraft.reverse(), ...fivePaydayOnly.reverse()].slice(0, MAX_PAST_EPISODES);
}

/** All renderings of a pound figure the checker should accept. */
export function moneyVariants(n: number): string[] {
  const v = r(n);
  const abs = Math.abs(v);
  const plain = `£${abs.toLocaleString("en-GB")}`;
  const out = new Set<string>([formatMoney(v), formatMoney(v, { about: true }), formatMoney(v, { sign: true }), plain, `about ${plain}`, `£${abs}`]);
  if (v < 0) out.add(`-£${abs}`);
  if (v > 0) out.add(`+£${abs}`);
  return [...out];
}

/** All renderings of a date the checker should accept: "Thu 31 Dec", "31 Dec", "31 December". */
export function dateVariants(d: string): string[] {
  const dt = parseISO(d);
  const full = `${dt.getUTCDate()} ${MONTH_NAMES[dt.getUTCMonth()]}`;
  return [formatDay(d), formatShortDay(d), full];
}

const MONEY_IN_TEXT = /[−-]?\+?£\s?\d[\d,]*(?:\.\d{1,2})?/g;

/** Collect pound figures and dates from every number and string in the facts. */
export function collectAllowedNumbers(parts: {
  money: number[];
  dates: string[];
  texts: string[];
}): string[] {
  const out = new Set<string>();
  for (const n of parts.money) if (Number.isFinite(n)) for (const s of moneyVariants(n)) out.add(s);
  for (const d of parts.dates) if (/^\d{4}-\d{2}-\d{2}$/.test(d)) for (const s of dateVariants(d)) out.add(s);
  for (const t of parts.texts) {
    if (!t) continue;
    for (const m of t.matchAll(MONEY_IN_TEXT)) {
      const value = Number(m[0].replace(/[^\d.]/g, ""));
      if (Number.isFinite(value)) for (const s of moneyVariants(value)) out.add(s);
    }
    // Dates written inside engine text (e.g. "5 paydays between 27 Nov and 26 Dec") are kept as-is;
    // the checker extracts them with the same patterns.
    if (/\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2}\b/i.test(t)) out.add(t);
  }
  return [...out];
}

export function buildFacts(forecast: Forecast, language: Language): Facts {
  const warning = forecast.warnings[0] ? roundWarning(forecast.warnings[0]) : undefined;
  const headroom: Forecast["headroom"] = {
    lowest: r(forecast.headroom.lowest),
    lowestDate: forecast.headroom.lowestDate,
    lowestP20: r(forecast.headroom.lowestP20),
    lowestP80: r(forecast.headroom.lowestP80),
    ...(forecast.headroom.afterPlan !== undefined ? { afterPlan: r(forecast.headroom.afterPlan) } : {}),
  };
  const keyEvents = selectKeyEvents(forecast);
  const actions = forecast.actions.slice(0, MAX_ACTIONS).map(roundAction);
  const pastEpisodes = buildPastEpisodes(forecast);

  const money: number[] = [forecast.balanceToday, headroom.lowest, headroom.lowestP20, headroom.lowestP80];
  if (headroom.afterPlan !== undefined) money.push(headroom.afterPlan);
  const dates: string[] = [forecast.today, headroom.lowestDate];
  const texts: string[] = [...pastEpisodes];

  if (warning) {
    money.push(warning.depthP50, warning.depthP20, warning.depthP80);
    dates.push(warning.startDate, warning.endDate, warning.lowestDate);
    for (const c of warning.causes) {
      money.push(c.amount);
      texts.push(c.label, c.detail);
    }
  }
  for (const e of keyEvents) {
    money.push(e.amount);
    dates.push(e.date);
    texts.push(e.label, e.note ?? "");
  }
  for (const a of actions) {
    money.push(a.effectByCliff, a.effectMonthly);
    if (a.date) dates.push(a.date);
    texts.push(a.title, a.summary, ...a.steps, ...a.needs);
  }
  for (const m of forecast.history?.months ?? []) money.push(m.low);

  return {
    today: forecast.today,
    balanceToday: r(forecast.balanceToday),
    horizonDays: forecast.horizonDays,
    ...(warning ? { warning } : {}),
    headroom,
    keyEvents,
    actions,
    pastEpisodes,
    allowedNumbers: collectAllowedNumbers({ money, dates, texts }),
    language,
  };
}
