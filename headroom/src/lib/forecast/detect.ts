// Detection (plan section 13.5): the first Short stretch, its depth, named causes and confidence.
import type { Cause, DayPoint, ISODate, RuleId, Warning } from "./types";
import type { EngineContext, Schedule } from "./model";
import type { BuildOptions } from "./project";
import { daysBetween, shortDay } from "./calendar/dates";
import { formatDay, formatMoney } from "@/lib/format";
import { round2 } from "./rng";

/** Short runs separated by a few non-comfortable days are one stretch (a wage lifts the balance for a day, then it is gone). */
const MAX_GAP_DAYS = 4;
/** Causes smaller than this are left out, except named public-rule assumptions. */
const MIN_CAUSE = 20;

export interface Stretch { start: number; end: number; lowest: number }

export function findStretches(days: DayPoint[]): Stretch[] {
  const runs: { start: number; end: number }[] = [];
  for (let i = 0; i < days.length; i++) {
    if (days[i].p50 >= 0) continue;
    const start = i;
    while (i + 1 < days.length && days[i + 1].p50 < 0) i++;
    runs.push({ start, end: i });
  }
  const merged: { start: number; end: number }[] = [];
  for (const r of runs) {
    const last = merged[merged.length - 1];
    if (last) {
      const gap = days.slice(last.end + 1, r.start);
      if (gap.length <= MAX_GAP_DAYS && gap.every((d) => d.status !== "comfortable")) {
        last.end = r.end;
        continue;
      }
    }
    merged.push({ ...r });
  }
  return merged.map((r) => {
    let lowest = r.start;
    for (let i = r.start; i <= r.end; i++) if (days[i].p50 < days[lowest].p50) lowest = i;
    return { ...r, lowest };
  });
}

/** One ablation: a name for the cause and how to switch it off. */
export interface CauseCandidate {
  id: string;
  label: string;
  ruleId?: RuleId;
  detail: string;
  options: BuildOptions;
  /** Kept even below the £20 floor (a named public-rule assumption). */
  alwaysShow?: boolean;
  /** Listed first: the rule that creates the stretch. */
  primary?: boolean;
}

/** Candidate causes present in this schedule before the lowest date. */
export function causeCandidates(ctx: EngineContext, schedule: Schedule, lowestDate: ISODate): CauseCandidate[] {
  const out: CauseCandidate[] = [];
  const before = schedule.items.filter((i) => i.date <= lowestDate);

  // Universal Credit from a five-payday period, then the longer gap to the next one.
  const ucItems = schedule.items.filter((i) => i.kind === "uc").sort((a, b) => (a.date < b.date ? -1 : 1));
  const low = ucItems.find((i) => i.date <= lowestDate && (i.uc?.paydays ?? 0) >= 5);
  if (low && low.uc) {
    const next = ucItems.find((i) => i.date > low.date);
    const less = Math.max(0, (low.uc.normalAmount ?? low.amount) - low.amount);
    const gap = next ? daysBetween(low.date, next.date) : undefined;
    const shift = low.notes.find((n) => n.startsWith("Paid early"));
    out.push({
      id: "uc_five_paydays",
      label: `Universal Credit on ${formatDay(low.date)} is lower`,
      ruleId: "uc_assessment_period",
      detail: [
        `${low.uc.paydays} paydays between ${shortDay(low.uc.periodStart)} and ${shortDay(low.uc.periodEnd)}, so about ${formatMoney(less)} less.`,
        shift ?? "",
        next && gap ? `Then ${gap} days until the next Universal Credit on ${formatDay(next.date)}.` : "",
      ].filter(Boolean).join(" "),
      options: { ucNormal: true },
      primary: true,
    });
  }

  // Annual repeats (Christmas, birthday, ...).
  const annualIds = [...new Set(before.filter((i) => i.kind === "annual").map((i) => i.seriesId as string))];
  for (const id of annualIds) {
    const cand = ctx.annual.find((a) => a.series.id === id);
    if (!cand) continue;
    const first = before.find((i) => i.seriesId === id) as Schedule["items"][number];
    const label = id === "birthday" ? `${cand.series.label} on ${shortDay(first.date)}` : cand.series.label;
    out.push({ id, label, ruleId: "annual_repeat", detail: cand.detail, options: { dropAnnualIds: [id] } });
  }

  // Energy price cap assumption.
  const energy = before.find((i) => i.category === "energy" && i.ruleId === "energy_cap_change");
  if (energy) {
    out.push({
      id: "energy_review",
      label: `Energy direct debit review from ${shortDay(energy.date)}`,
      ruleId: "energy_cap_change",
      detail: energy.notes.find((n) => n.startsWith("Assumed")) ?? "Assumed rise at the price cap change.",
      options: { energyChangePct: 0 },
      alwaysShow: true,
    });
  }

  // Buy-now-pay-later instalments (known agreement).
  for (const a of ctx.persona.bnpl) {
    const pays = before.filter((i) => i.seriesId === a.id);
    if (pays.length === 0) continue;
    const dates = pays.map((i) => shortDay(i.date));
    const list = dates.length > 1 ? `${dates.slice(0, -1).join(", ")} and ${dates[dates.length - 1]}` : dates[0];
    out.push({
      id: a.id,
      label: `${a.provider} ${formatMoney(a.instalment)} on ${list}`,
      detail: `Payments for the ${a.item} bought on ${shortDay(a.purchased)}.`,
      options: { dropSeriesIds: [a.id] },
    });
  }
  return out;
}

/** Measure each cause: the lowest point in the stretch with that cause switched off, minus the actual lowest point. */
export function measureCauses(
  candidates: CauseCandidate[],
  stretch: { startDate: ISODate; endDate: ISODate },
  baseLow: number,
  lowestWith: (options: BuildOptions) => number,
): Cause[] {
  const measured = candidates.map((c) => ({ c, amount: round2(lowestWith(c.options) - baseLow) }));
  const kept = measured.filter(({ c, amount }) => amount >= MIN_CAUSE || (c.alwaysShow && amount >= 1));
  kept.sort((a, b) => Number(!!b.c.primary) - Number(!!a.c.primary) || b.amount - a.amount);
  return kept.map(({ c, amount }) => ({ id: c.id, label: c.label, amount, ...(c.ruleId ? { ruleId: c.ruleId } : {}), detail: c.detail }));
}

export function confidenceOf(days: DayPoint[], s: Stretch): Warning["confidence"] {
  if (s.end - s.start + 1 < 3) return "low";
  return days[s.lowest].p80 < 0 ? "high" : "medium";
}

export function makeWarning(days: DayPoint[], s: Stretch, causes: Cause[]): Warning {
  const lowest = days[s.lowest];
  return {
    id: `w-${days[s.start].date}`,
    startDate: days[s.start].date,
    endDate: days[s.end].date,
    lowestDate: lowest.date,
    depthP50: lowest.p50,
    depthP20: lowest.p20,
    depthP80: lowest.p80,
    causes,
    confidence: confidenceOf(days, s),
  };
}
