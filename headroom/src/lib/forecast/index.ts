// Forecast engine entry point. Pure, synchronous and deterministic: the same persona, date and
// scenario always give the same Forecast. No I/O, no real clock. Results are cached in module scope.
import type { ActionCandidate, DayPoint, Forecast, ISODate, RuleId, Scenario, Series, Transaction } from "./types";
import type { EngineContext, RuleFiring, Schedule } from "./model";
import { getContext } from "./context";
import { buildDays, buildSchedule, buildWeeks, expectedDailyNet, finaliseSchedule, simulate, type BuildOptions } from "./project";
import { causeCandidates, findStretches, makeWarning, measureCauses, type Stretch } from "./detect";
import { applyScenarioCore, hasCore, splitScenario } from "./scenario";
import { ACTION_DEFINITIONS, ACTION_IDS, staticCatalogue, type ActionBase } from "./actions/catalogue";
import { rankActions } from "./actions/rank";
import { addDays, monthKey } from "./calendar/dates";
import { generateHistory } from "./seed/generate";
import { getPersona, PERSONAS, UnknownPersonaError } from "./seed/aisha";
import { round2 } from "./rng";
import { DEMO_TODAY } from "@/lib/config";

export const HORIZON_DAYS = 90;
/** Rules beyond the 90-day window (April council tax and telecom rises) are listed up to this far ahead. */
const RULES_LOOKAHEAD_DAYS = 180;
const CACHE_LIMIT = 300;

export { UnknownPersonaError, ACTION_IDS };
export function isKnownPersona(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(PERSONAS, id);
}

const forecastCache = new Map<string, Forecast>();

/** runForecast(personaId, today, scenario?) → Forecast. Throws UnknownPersonaError for an unknown persona. */
export function runForecast(personaId: string, today: string, scenario?: Scenario): Forecast {
  const key = JSON.stringify([personaId, today, normaliseScenario(scenario)]);
  const hit = forecastCache.get(key);
  if (hit) return structuredClone(hit);
  const result = compute(personaId, today, scenario);
  if (forecastCache.size >= CACHE_LIMIT) forecastCache.delete(forecastCache.keys().next().value as string);
  forecastCache.set(key, result);
  return structuredClone(result);
}

/** The persona's synthetic history (generated up to the day before DEMO_TODAY). */
export function getTransactions(personaId: string): { transactions: Transaction[]; openingBalance: number } {
  const h = generateHistory(getPersona(personaId), DEMO_TODAY);
  return { transactions: h.transactions.map((t) => ({ ...t })), openingBalance: h.openingBalance };
}

/** Static metadata for every action in the catalogue (no effects). */
export function getActionCatalogue(): ActionCandidate[] {
  return staticCatalogue();
}

// ---------------------------------------------------------------------------------------------

function normaliseScenario(s?: Scenario): Scenario | null {
  if (!s) return null;
  const out: Scenario = {};
  if (s.actionIds?.length) out.actionIds = [...new Set(s.actionIds)].sort();
  if (s.income) out.income = s.income;
  if (s.extraExpenses?.length) out.extraExpenses = s.extraExpenses;
  if (s.removeSeriesIds?.length) out.removeSeriesIds = [...new Set(s.removeSeriesIds)].sort();
  if (s.energyChangePct !== undefined) out.energyChangePct = s.energyChangePct;
  return Object.keys(out).length ? out : null;
}

function cloneSchedule(s: Schedule): Schedule {
  return {
    from: s.from,
    to: s.to,
    items: s.items.map((i) => ({ ...i, notes: [...i.notes], ...(i.uc ? { uc: { ...i.uc } } : {}) })),
    fired: [...s.fired],
    spendAdjust: new Map(s.spendAdjust),
  };
}

function coreSchedule(ctx: EngineContext, from: ISODate, to: ISODate, core: Scenario, opts: BuildOptions = {}): Schedule {
  const s = buildSchedule(ctx, from, to, { ...opts, energyChangePct: opts.energyChangePct ?? core.energyChangePct });
  if (hasCore(core)) {
    applyScenarioCore(ctx, s, core);
    finaliseSchedule(ctx, s);
  }
  return s;
}

function withActions(ctx: EngineContext, s: Schedule, ids: string[], base: ActionBase): Schedule {
  if (ids.length === 0) return s;
  const c = cloneSchedule(s);
  for (const def of ACTION_DEFINITIONS) if (ids.includes(def.id) && def.applies(base)) def.apply(c, base);
  finaliseSchedule(ctx, c);
  return c;
}

function project(ctx: EngineContext, s: Schedule): DayPoint[] {
  return buildDays(s, simulate(ctx, s, HORIZON_DAYS));
}

function lowestIn(days: DayPoint[], from: ISODate, to: ISODate): number {
  let low = Infinity;
  for (const d of days) if (d.date >= from && d.date <= to && d.p50 < low) low = d.p50;
  return low === Infinity ? 0 : low;
}

function warningFor(
  ctx: EngineContext, days: DayPoint[], stretch: Stretch, schedule: Schedule,
  rebuild: (opts: BuildOptions) => Schedule,
) {
  const startDate = days[stretch.start].date;
  const endDate = days[stretch.end].date;
  const baseLow = days[stretch.lowest].p50;
  const candidates = causeCandidates(ctx, schedule, days[stretch.lowest].date);
  const causes = measureCauses(candidates, { startDate, endDate }, baseLow, (opts) => lowestIn(project(ctx, rebuild(opts)), startDate, endDate));
  return makeWarning(days, stretch, causes);
}

function compute(personaId: string, today: ISODate, scenario?: Scenario): Forecast {
  const ctx = getContext(personaId, today);
  const horizonEnd = addDays(today, HORIZON_DAYS);
  const { core, actionIds } = splitScenario(scenario);

  // 1. The forecast without any actions.
  const pre = coreSchedule(ctx, today, horizonEnd, core);
  const preDays = project(ctx, pre);
  const preStretch = findStretches(preDays)[0];
  const preWarning = preStretch ? warningFor(ctx, preDays, preStretch, pre, (opts) => coreSchedule(ctx, today, horizonEnd, core, opts)) : undefined;
  const base: ActionBase = { ctx, today, days: preDays, warning: preWarning, schedule: pre };

  // 2. Every action's effect, measured by re-running the projection with it applied.
  const cliffEnd = preWarning?.endDate ?? horizonEnd;
  const baseLowCliff = lowestIn(preDays, today, cliffEnd);
  const extEnd = addDays(cliffEnd, 366);
  const ext = coreSchedule(ctx, today, extEnd, core);
  const extNet = expectedDailyNet(ctx, ext);
  const monthlyDelta = (s: Schedule) => {
    const net = expectedDailyNet(ctx, s);
    let sum = 0;
    for (let d = addDays(cliffEnd, 1); d <= addDays(cliffEnd, 365); d = addDays(d, 1)) sum += (net.get(d) ?? 0) - (extNet.get(d) ?? 0);
    return round2(sum / 12);
  };
  const candidates: ActionCandidate[] = [];
  for (const def of ACTION_DEFINITIONS) {
    if (!def.applies(base)) continue;
    let effectByCliff = 0;
    let effectMonthly = 0;
    if (def.type !== "help") {
      const days = project(ctx, withActions(ctx, pre, [def.id], base));
      effectByCliff = round2(lowestIn(days, today, cliffEnd) - baseLowCliff);
      effectMonthly = monthlyDelta(withActions(ctx, ext, [def.id], base));
    }
    const date = def.date?.(base);
    candidates.push({
      id: def.id,
      title: def.title(base),
      type: def.type,
      summary: def.summary(base),
      effectByCliff,
      effectMonthly,
      effortMinutes: def.effortMinutes,
      eligibility: def.eligibility(base),
      needs: def.needs(base),
      steps: def.steps(base),
      ...(def.link ? { link: def.link } : {}),
      defaultOn: false,
      ...(date ? { date } : {}),
    });
  }
  // Structural deficit: still short most months (or on average) after every claim and timing action.
  const fixIds = candidates.filter((c) => c.type === "claim" || c.type === "timing").map((c) => c.id);
  const allFixed = expectedDailyNet(ctx, withActions(ctx, ext, fixIds, base));
  const monthNets = new Map<string, number>();
  for (const [d, v] of allFixed) {
    if (monthKey(d) <= monthKey(today) || d > extEnd) continue;
    monthNets.set(monthKey(d), (monthNets.get(monthKey(d)) ?? 0) + v);
  }
  const fullMonths = [...monthNets.entries()].slice(0, 12);
  const negative = fullMonths.filter(([, v]) => v < 0).length;
  const average = fullMonths.reduce((s, [, v]) => s + v, 0) / Math.max(1, fullMonths.length);
  const structural = negative > fullMonths.length / 2 || average < 0;
  const actions = rankActions(candidates, structural);

  // 3. The forecast the person asked for (with their ticked actions, if any).
  const known = actionIds.filter((id) => actions.some((a) => a.id === id));
  const final = known.length ? withActions(ctx, pre, known, base) : pre;
  const days = known.length ? project(ctx, final) : preDays;
  const stretches = findStretches(days).slice(0, 3);
  const warnings = stretches.map((s, i) => {
    if (i === 0 && !known.length && preWarning) return preWarning;
    if (i > 0) return makeWarning(days, s, []);
    return warningFor(ctx, days, s, final, (opts) => withActions(ctx, coreSchedule(ctx, today, horizonEnd, core, opts), known, base));
  });

  // 4. Headroom now and after the recommended plan.
  const low = days.reduce((m, d) => (d.p50 < m.p50 ? d : m), days[0]);
  const defaults = actions.filter((a) => a.defaultOn).map((a) => a.id);
  let afterPlan: number | undefined;
  if (defaults.length) {
    const same = defaults.length === known.length && defaults.every((id) => known.includes(id));
    const planDays = same ? days : project(ctx, withActions(ctx, pre, defaults, base));
    afterPlan = planDays.reduce((m, d) => Math.min(m, d.p50), Infinity);
  }

  return {
    personaId,
    today,
    horizonDays: HORIZON_DAYS,
    balanceToday: ctx.balanceToday,
    headroom: { lowest: low.p50, lowestDate: low.date, lowestP20: low.p20, lowestP80: low.p80, ...(afterPlan !== undefined ? { afterPlan: round2(afterPlan) } : {}) },
    days,
    weeks: buildWeeks(days, final),
    warnings,
    actions,
    rulesFired: rulesFired(final, ext, horizonEnd, addDays(today, RULES_LOOKAHEAD_DAYS)),
    recurring: recurringList(ctx),
    history: { months: ctx.historyMonths.map((m) => ({ ...m })) },
    ...(scenario && normaliseScenario(scenario) ? { scenario } : {}),
  };
}

function rulesFired(final: Schedule, ext: Schedule, horizonEnd: ISODate, lookahead: ISODate): { ruleId: RuleId; date: ISODate; note: string }[] {
  const shift = (r: RuleFiring) => r.ruleId === "credit_before_weekend" || r.ruleId === "debit_after_weekend";
  const inHorizon = final.fired.filter((r) => r.date <= horizonEnd);
  const later = ext.fired.filter((r) => r.date > horizonEnd && r.date <= lookahead && !shift(r) && r.ruleId !== "uc_assessment_period");
  const seen = new Set<string>();
  const out: { ruleId: RuleId; date: ISODate; note: string }[] = [];
  for (const r of [...inHorizon, ...later]) {
    const k = `${r.ruleId}|${r.date}|${r.note}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ ruleId: r.ruleId, date: r.date, note: r.note });
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

function recurringList(ctx: EngineContext): Series[] {
  return [...ctx.detected.filter((d) => d.active).map((d) => ({ ...d.series })), ...ctx.annual.map((a) => ({ ...a.series }))];
}
