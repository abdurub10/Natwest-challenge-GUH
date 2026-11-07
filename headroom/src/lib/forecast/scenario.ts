// Scenario (plan section 13.6), applied to the schedule before projection.
// income.hoursPerWeek replaces wages from a date (Universal Credit follows through the rule);
// income.weeklyNetDelta adds to each wage; extraExpenses adds one-off debits; removeSeriesIds drops a
// series ("what if I cancel Disney+"). energyChangePct and actionIds are handled by the caller
// (the first is a rule input, the second comes from the actions catalogue).
import type { Scenario } from "./types";
import type { EngineContext, Schedule } from "./model";
import { round2 } from "./rng";
import { quantile } from "./recurring";

export function splitScenario(s?: Scenario): { core: Scenario; actionIds: string[] } {
  if (!s) return { core: {}, actionIds: [] };
  const { actionIds, ...core } = s;
  return { core, actionIds: [...new Set(actionIds ?? [])] };
}

export function hasCore(s: Scenario): boolean {
  return !!(s.income || s.extraExpenses?.length || s.removeSeriesIds?.length || s.energyChangePct !== undefined);
}

/** Mutates the schedule. Call finaliseSchedule afterwards so Universal Credit is recomputed. */
export function applyScenarioCore(ctx: EngineContext, schedule: Schedule, s: Scenario): void {
  if (s.income) {
    const { hoursPerWeek, weeklyNetDelta, fromDate } = s.income;
    for (const item of schedule.items) {
      if (item.kind !== "wage" || item.nominalDate < fromDate) continue;
      const samples = item.samples ?? [item.amount];
      const med = quantile(samples, 0.5) || item.amount;
      if (hoursPerWeek !== undefined) {
        const target = Math.max(0, hoursPerWeek) * ctx.persona.wage.netPerHour;
        const scale = med > 0 ? target / med : 0;
        item.samples = samples.map((x) => round2(x * scale));
        item.amount = round2(target);
        item.notes = [...item.notes, `Based on ${hoursPerWeek} hours a week.`];
      }
      if (weeklyNetDelta) {
        item.samples = (item.samples ?? [item.amount]).map((x) => round2(Math.max(0, x + weeklyNetDelta)));
        item.amount = round2(Math.max(0, item.amount + weeklyNetDelta));
      }
    }
  }
  for (const [i, e] of (s.extraExpenses ?? []).entries()) {
    if (e.date < schedule.from || e.date > schedule.to) continue;
    const amount = -Math.abs(e.amount);
    schedule.items.push({
      key: `extra:${i}:${e.date}`, date: e.date, nominalDate: e.date, label: e.label || "Extra cost", category: "other",
      kind: "oneoff", amount: round2(amount), notes: ["Added in your what-if."],
    });
  }
  if (s.removeSeriesIds?.length) {
    const drop = new Set(s.removeSeriesIds);
    schedule.items = schedule.items.filter((i) => !(i.seriesId && drop.has(i.seriesId)));
  }
}
