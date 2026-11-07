// Projection (plan section 13.4).
// 1. Build the schedule: every detected series generates events across the horizon by cadence, with
//    calendar shifts, then the rules (UC amounts, energy change, council tax gaps, annual repeats).
// 2. Run 200 bootstrap paths: each event's amount is drawn from that series' observed amounts, wages
//    vary, Universal Credit is recomputed per path from that path's wages, and everyday spending
//    carries a small per-path drift so the band widens with time.
// 3. P20, P50, P80 of the balance per day. Statuses per day; Monday-start weeks.
import type { DayPoint, ISODate, RuleId, Status, Week } from "./types";
import type { EngineContext, RuleFiring, Schedule, ScheduledItem } from "./model";
import {
  addDays, addMonthsClamped, dayNumber, daysBetween, daysInMonth, eachDay, isBankHoliday, makeISO,
  mondayOf, shiftCredit, shiftDebit, weekday, ymd,
} from "./calendar/dates";
import { assessmentPeriods, normalAward, ucAward, ucNote, ucPayDate } from "./rules/universalCredit";
import { applyEnergyCap } from "./rules/energyCap";
import { applyCouncilTax } from "./rules/councilTax";
import { applyAprilRises } from "./rules/aprilRises";
import { annualItems } from "./rules/annual";
import { isSchoolHoliday } from "./seed/aisha";
import { hashString, normalFrom, round2, uniformAt } from "./rng";
import { quantile } from "./recurring";
import { formatDay } from "@/lib/format";

export const PATHS = 200;
/** Per-path weekly drift of everyday spending (standard deviation, as a share per week ahead). */
export const DRIFT_PER_WEEK = 0.0025;

export interface BuildOptions {
  energyChangePct?: number;
  /** Ablations used to measure causes. */
  ucNormal?: boolean;
  dropAnnualIds?: string[];
  dropSeriesIds?: string[];
}

const median = (v: number[]) => quantile(v, 0.5);

/** Build the schedule from `from` (today) to `to`, with all calendar rules applied. */
export function buildSchedule(ctx: EngineContext, from: ISODate, to: ISODate, opts: BuildOptions = {}): Schedule {
  const p = ctx.persona;
  const items: ScheduledItem[] = [];
  const fired: RuleFiring[] = [];
  const drop = new Set(opts.dropSeriesIds ?? []);

  for (const d of ctx.detected) {
    const s = d.series;
    if (!d.active || drop.has(s.id)) continue;
    if (d.kind === "uc") continue; // Universal Credit comes from the rule below

    if (d.kind === "wage") {
      const wd = s.weekday ?? p.wage.weekday;
      const samples = d.samples;
      const amount = round2(median(samples));
      // Nominal paydays after the last one seen.
      let nominal = addDays(lastNominalWeekday(s.lastSeen, wd), 7);
      for (; nominal <= addDays(to, 7); nominal = addDays(nominal, 7)) {
        const sh = shiftCredit(nominal);
        if (sh.date < from || sh.date > to) continue;
        items.push({
          key: `wage:${nominal}`, date: sh.date, nominalDate: nominal, label: s.label, seriesId: s.id, category: "wage",
          kind: "wage", amount, samples, notes: sh.note ? [sh.note] : [], ...(sh.shifted ? { ruleId: "credit_before_weekend" as RuleId } : {}),
        });
      }
      continue;
    }

    if (d.kind === "benefit") {
      const wd = s.weekday ?? weekday(s.lastSeen);
      const step = s.cadence === "four_weekly" ? 28 : s.cadence === "fortnightly" ? 14 : s.cadence === "weekly" ? 7 : 0;
      const amount = round2(median(d.samples));
      if (step > 0) {
        for (let nominal = addDays(nextOnWeekday(s.lastSeen, wd), step); nominal <= addDays(to, 3); nominal = addDays(nominal, step)) {
          const sh = shiftCredit(nominal);
          if (sh.date < from || sh.date > to) continue;
          items.push({
            key: `${s.id}:${nominal}`, date: sh.date, nominalDate: nominal, label: s.label, seriesId: s.id, category: s.category,
            kind: "benefit", amount, notes: sh.note ? [sh.note] : [], ...(sh.shifted ? { ruleId: "credit_before_weekend" as RuleId } : {}),
          });
        }
      } else {
        for (const nominal of monthlyDates(s.dayOfMonth ?? ymd(s.lastSeen).day, from, to)) {
          const sh = shiftCredit(nominal);
          if (sh.date < from || sh.date > to) continue;
          items.push({ key: `${s.id}:${nominal}`, date: sh.date, nominalDate: nominal, label: s.label, seriesId: s.id, category: s.category, kind: "benefit", amount, notes: sh.note ? [sh.note] : [] });
        }
      }
      continue;
    }

    if (d.kind === "bill") {
      if (s.category === "bnpl") {
        const agreement = p.bnpl.find((a) => a.id === s.id);
        for (const due of agreement?.dueDates ?? []) {
          const sh = shiftDebit(due);
          if (sh.date < from || sh.date > to) continue;
          items.push({
            key: `${s.id}:${due}`, date: sh.date, nominalDate: due, label: agreement?.label ?? s.label, seriesId: s.id, category: "bnpl",
            kind: "bill", amount: -(agreement?.instalment ?? s.amountP50), notes: sh.note ? [sh.note] : [],
            ...(sh.shifted ? { ruleId: "debit_after_weekend" as RuleId } : {}),
          });
        }
        continue;
      }
      for (const nominal of monthlyDates(s.dayOfMonth ?? ymd(s.lastSeen).day, addDays(from, -6), to)) {
        const sh = shiftDebit(nominal);
        if (sh.date < from || sh.date > to) continue;
        if (nominal <= s.lastSeen) continue; // already paid
        items.push({
          key: `${s.id}:${nominal}`, date: sh.date, nominalDate: nominal, label: s.label, seriesId: s.id, category: s.category,
          kind: "bill", amount: d.lastAmount, notes: sh.note ? [sh.note] : [], ...(sh.shifted ? { ruleId: "debit_after_weekend" as RuleId } : {}),
        });
      }
      continue;
    }

    // Everyday spending on fixed weekdays (card payments: no working-day shift).
    const amount = round2(median(d.samples));
    const dates: ISODate[] = [];
    if (s.cadence === "weekly") {
      for (const day of eachDay(from, to)) if (d.weekdays.includes(weekday(day))) dates.push(day);
    } else if (s.cadence === "fortnightly") {
      for (let day = addDays(s.lastSeen, 14); day <= to; day = addDays(day, 14)) if (day >= from) dates.push(day);
    } else if (s.cadence === "four_weekly") {
      for (let day = addDays(s.lastSeen, 28); day <= to; day = addDays(day, 28)) if (day >= from) dates.push(day);
    } else {
      for (const nominal of monthlyDates(s.dayOfMonth ?? ymd(s.lastSeen).day, from, to)) dates.push(nominal);
    }
    for (const day of dates) {
      if (day.slice(5) === "12-25") continue; // shops are shut on Christmas Day
      if (d.termTime && (isSchoolHoliday(p, day) || isBankHoliday(day))) continue;
      items.push({
        key: `${s.id}:${day}`, date: day, nominalDate: day, label: s.label, seriesId: s.id, category: s.category,
        kind: "spend", amount, samples: d.samples, variable: true, notes: [],
      });
    }
  }

  // Rules.
  const ct = applyCouncilTax(items, from, to, p.councilTaxAprilRisePct);
  const ruled = ct.items;
  fired.push(...ct.fired);
  fired.push(...applyEnergyCap(ruled, from, to, opts.energyChangePct ?? p.energyChangePct));
  fired.push(...applyAprilRises(ruled, from, to, p.telecomAprilRise));
  const dropAnnual = new Set(opts.dropAnnualIds ?? []);
  const annual = annualItems(ctx.annual.filter((a) => !dropAnnual.has(a.series.id) && !drop.has(a.series.id)), from, to);
  ruled.push(...annual.items);
  fired.push(...annual.fired);

  // Universal Credit: one item per assessment period paid inside the window.
  const ucSeries = ctx.detected.find((d) => d.kind === "uc" && d.active && !drop.has(d.series.id));
  if (ucSeries) {
    const uc = p.universalCredit;
    for (const period of assessmentPeriods(uc.periodStartDay, addDays(from, -62), to, uc.payDay)) {
      const pay = ucPayDate(period);
      if (pay.date < from || pay.date > to) continue;
      ruled.push({
        key: `uc:${period.start}`, date: pay.date, nominalDate: period.payDue, label: ucSeries.series.label, seriesId: ucSeries.series.id,
        category: "benefit", kind: "uc", amount: 0, ruleId: "uc_assessment_period",
        notes: pay.note ? [pay.note] : [],
        uc: { periodStart: period.start, periodEnd: period.end, normalise: !!opts.ucNormal },
      });
    }
  }

  const schedule: Schedule = { from, to, items: ruled, fired, spendAdjust: new Map() };
  finaliseSchedule(ctx, schedule);
  return schedule;
}

/** Recompute Universal Credit P50 amounts and notes from the current wage items, then sort. Call after any change to wages. */
export function finaliseSchedule(ctx: EngineContext, schedule: Schedule): void {
  const uc = ctx.persona.universalCredit;
  const wages = schedule.items.filter((i) => i.kind === "wage");
  // Remove old UC notes/firings before recomputing.
  schedule.fired = schedule.fired.filter((f) => f.ruleId !== "uc_assessment_period" && f.ruleId !== "credit_before_weekend" && f.ruleId !== "debit_after_weekend");
  for (const item of schedule.items) {
    if (item.kind !== "uc" || !item.uc) continue;
    const { periodStart, periodEnd } = item.uc;
    let total = 0;
    let paydays = 0;
    for (const w of ctx.pastWages) if (w.date >= periodStart && w.date <= periodEnd) { total += w.amount; paydays++; }
    for (const w of wages) if (w.date >= periodStart && w.date <= periodEnd) { total += w.amount; paydays++; }
    const actual = ucAward(total, uc);
    const normal = normalAward(total, paydays, uc);
    item.amount = item.uc.normalise ? normal : actual;
    item.uc.paydays = paydays;
    item.uc.normalAmount = normal;
    const shiftNote = item.notes.find((n) => n.startsWith("Paid early"));
    const note = ucNote(paydays, { start: periodStart, end: periodEnd, payDue: item.nominalDate }, normal - actual);
    item.notes = [...(shiftNote ? [shiftNote] : []), note];
    schedule.fired.push({ ruleId: "uc_assessment_period", date: item.date, note: note.replace(/\.$/, ""), ref: item.key });
  }
  for (const item of schedule.items) {
    const shift = item.notes.find((n) => n.startsWith("Paid early") || n.startsWith("Taken late"));
    if (!shift) continue;
    schedule.fired.push({ ruleId: shift.startsWith("Paid early") ? "credit_before_weekend" : "debit_after_weekend", date: item.date, note: `${item.label}: ${shift.replace(/\.$/, "")}`, ref: item.key });
  }
  schedule.items.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : b.amount - a.amount));
  schedule.fired.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

function lastNominalWeekday(lastSeen: ISODate, wd: number): ISODate {
  // A wage paid early (Thursday before a bank-holiday Friday) belongs to that Friday.
  let d = lastSeen;
  for (let i = 0; i < 7 && weekday(d) !== wd; i++) d = addDays(d, 1);
  return d;
}
function nextOnWeekday(d: ISODate, wd: number): ISODate {
  let x = d;
  for (let i = 0; i < 7 && weekday(x) !== wd; i++) x = addDays(x, 1);
  return x;
}
function monthlyDates(dom: number, from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  const f = ymd(from);
  for (let d = makeISO(f.y, f.m, 1); d <= to; d = addMonthsClamped(d, 1)) {
    const { y, m } = ymd(d);
    const nominal = makeISO(y, m, Math.min(dom, daysInMonth(y, m)));
    if (nominal >= from && nominal <= to) out.push(nominal);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Bootstrap simulation

export interface Projection {
  dates: ISODate[];
  p20: number[];
  p50: number[];
  p80: number[];
}

const H_DRIFT_A = hashString("drift:a");
const H_DRIFT_B = hashString("drift:b");
const residualHashCache = new Map<ISODate, number>();
function residualHash(d: ISODate): number {
  let h = residualHashCache.get(d);
  if (h === undefined) {
    h = hashString(`residual:${d}`);
    residualHashCache.set(d, h);
  }
  return h;
}
const itemHashCache = new Map<string, number>();
function itemHash(key: string): number {
  let h = itemHashCache.get(key);
  if (h === undefined) {
    h = hashString(key);
    if (itemHashCache.size > 50_000) itemHashCache.clear();
    itemHashCache.set(key, h);
  }
  return h;
}

/** Days 0..horizonDays from `from`. Balance starts at ctx.balanceToday before day 0's events. */
export function simulate(ctx: EngineContext, schedule: Schedule, horizonDays: number, paths = PATHS): Projection {
  const from = schedule.from;
  const n = horizonDays + 1;
  const dates = Array.from({ length: n }, (_, i) => addDays(from, i));
  const base = dayNumber(from);
  const uc = ctx.persona.universalCredit;

  type Prepared = { item: ScheduledItem; day: number; hash: number; offset: number };
  const wages: Prepared[] = [];
  const ucs: Prepared[] = [];
  const others: Prepared[] = [];
  for (const item of schedule.items) {
    const day = dayNumber(item.date) - base;
    if (day < 0 || day >= n || item.kind === "info") continue;
    // If a rule or scenario moved the amount away from the observed median, keep the variation and move the level.
    const offset = item.samples && item.samples.length && item.kind !== "wage" ? item.amount - median(item.samples) : 0;
    const prep = { item, day, hash: itemHash(item.key), offset: Math.abs(offset) < 0.005 ? 0 : offset };
    if (item.kind === "wage") wages.push(prep);
    else if (item.kind === "uc") ucs.push(prep);
    else others.push(prep);
  }
  // Past wages per UC period (fixed across paths).
  const ucPast = ucs.map(({ item }) => {
    let total = 0;
    let count = 0;
    for (const w of ctx.pastWages) if (w.date >= (item.uc as NonNullable<ScheduledItem["uc"]>).periodStart && w.date <= (item.uc as NonNullable<ScheduledItem["uc"]>).periodEnd) { total += w.amount; count++; }
    return { total, count };
  });
  const ucWageIdx = ucs.map(({ item }) => wages.map((w, i) => (w.item.date >= (item.uc as NonNullable<ScheduledItem["uc"]>).periodStart && w.item.date <= (item.uc as NonNullable<ScheduledItem["uc"]>).periodEnd ? i : -1)).filter((i) => i >= 0));

  const pool = ctx.residualPool;
  const resHashes = dates.map(residualHash);
  const adjust = dates.map((d) => schedule.spendAdjust.get(d) ?? 0);

  const balances: Float64Array[] = Array.from({ length: n }, () => new Float64Array(paths));
  const delta = new Float64Array(n);
  const wageAmt = new Float64Array(wages.length);

  for (let p = 0; p < paths; p++) {
    delta.fill(0);
    const drift = normalFrom(uniformAt(p, H_DRIFT_A), uniformAt(p, H_DRIFT_B)) * DRIFT_PER_WEEK;
    for (let i = 0; i < wages.length; i++) {
      const { item, day, hash } = wages[i];
      const a = item.samples && item.samples.length ? item.samples[Math.floor(uniformAt(p, hash) * item.samples.length)] : item.amount;
      wageAmt[i] = a;
      delta[day] += a;
    }
    for (let k = 0; k < ucs.length; k++) {
      const { item, day } = ucs[k];
      let total = ucPast[k].total;
      for (const i of ucWageIdx[k]) total += wageAmt[i];
      const paydays = ucPast[k].count + ucWageIdx[k].length;
      delta[day] += item.uc?.normalise ? normalAward(total, paydays, uc) : ucAward(total, uc);
    }
    for (const { item, day, hash, offset } of others) {
      let a = item.samples && item.samples.length ? item.samples[Math.floor(uniformAt(p, hash) * item.samples.length)] + offset : item.amount;
      if (item.variable) a *= 1 + drift * (day / 7);
      delta[day] += a;
    }
    if (pool.length) {
      for (let d = 0; d < n; d++) {
        const r = pool[Math.floor(uniformAt(p, resHashes[d]) * pool.length)];
        delta[d] += r * (1 + drift * (d / 7)) + adjust[d];
      }
    }
    let bal = ctx.balanceToday;
    for (let d = 0; d < n; d++) {
      bal += delta[d];
      balances[d][p] = bal;
    }
  }

  const p20: number[] = [];
  const p50: number[] = [];
  const p80: number[] = [];
  for (let d = 0; d < n; d++) {
    const s = balances[d].sort();
    p20.push(round2(pick(s, 0.2)));
    p50.push(round2(pick(s, 0.5)));
    p80.push(round2(pick(s, 0.8)));
  }
  return { dates, p20, p50, p80 };
}

function pick(sorted: Float64Array, q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/** Expected (P50-amount) net per day over [from, to], for monthly effects and the structural check. */
export function expectedDailyNet(ctx: EngineContext, schedule: Schedule): Map<ISODate, number> {
  const net = new Map<ISODate, number>();
  for (const d of eachDay(schedule.from, schedule.to)) net.set(d, ctx.residualMean + (schedule.spendAdjust.get(d) ?? 0));
  for (const i of schedule.items) if (net.has(i.date)) net.set(i.date, (net.get(i.date) as number) + i.amount);
  return net;
}

// ---------------------------------------------------------------------------------------------
// Statuses, days and weeks

export function statusOf(p20: number, p50: number): Status {
  if (p50 < 0) return "short";
  if (p20 < 50) return "tight";
  return "comfortable";
}

export function buildDays(schedule: Schedule, proj: Projection): DayPoint[] {
  const byDate = new Map<ISODate, ScheduledItem[]>();
  for (const i of schedule.items) {
    const list = byDate.get(i.date) ?? [];
    list.push(i);
    byDate.set(i.date, list);
  }
  return proj.dates.map((date, k) => ({
    date,
    p20: proj.p20[k],
    p50: proj.p50[k],
    p80: proj.p80[k],
    status: statusOf(proj.p20[k], proj.p50[k]),
    events: (byDate.get(date) ?? []).map((i) => ({
      date: i.date,
      amount: round2(i.amount),
      label: i.label,
      ...(i.seriesId ? { seriesId: i.seriesId } : {}),
      ...(i.ruleId ? { ruleId: i.ruleId } : {}),
      ...(i.notes.length ? { note: i.notes.join(" ") } : {}),
    })),
  }));
}

const STATUS_RANK: Record<Status, number> = { comfortable: 0, tight: 1, short: 2 };

/** 13 Monday-start weeks from the Monday of this week. */
export function buildWeeks(days: DayPoint[], schedule: Schedule, count = 13): Week[] {
  const first = mondayOf(days[0].date);
  const weeks: Week[] = [];
  for (let w = 0; w < count; w++) {
    const startDate = addDays(first, w * 7);
    const end = addDays(startDate, 6);
    const inWeek = days.filter((d) => d.date >= startDate && d.date <= end);
    if (inWeek.length === 0) break;
    const status = inWeek.reduce<Status>((s, d) => (STATUS_RANK[d.status] > STATUS_RANK[s] ? d.status : s), "comfortable");
    const low = inWeek.reduce((m, d) => (d.p50 < m.p50 ? d : m), inWeek[0]);
    weeks.push({ startDate, status, lowP50: low.p50, lowP20: low.p20, headline: weekHeadline(schedule, inWeek[0].date, end) });
  }
  return weeks;
}

/** The main event of a week: "Universal Credit Wed 2 Dec", "Christmas spending", "Rent Mon 7 Dec". */
function weekHeadline(schedule: Schedule, start: ISODate, end: ISODate): string {
  const items = schedule.items.filter((i) => i.date >= start && i.date <= end && i.kind !== "wage" && i.kind !== "spend");
  const groups = new Map<string, { label: string; total: number; dates: ISODate[]; kind: string; amount: number }>();
  for (const i of items) {
    const k = i.seriesId ?? i.key;
    const g = groups.get(k) ?? { label: i.label, total: 0, dates: [], kind: i.kind, amount: i.amount };
    g.total += Math.abs(i.amount);
    g.dates.push(i.date);
    groups.set(k, g);
  }
  let best: { label: string; total: number; dates: ISODate[]; kind: string } | undefined;
  for (const g of groups.values()) if (g.total > 0 && (!best || g.total > best.total)) best = g;
  if (!best) {
    const info = items.find((i) => i.kind === "info");
    if (info) return info.label;
    const wage = schedule.items.find((i) => i.date >= start && i.date <= end && i.kind === "wage");
    return wage ? `Wage ${formatDay(wage.date)}` : "A quiet week";
  }
  const short = shortLabel(best.label);
  if (best.kind === "annual" && best.dates.length > 1) return short;
  return `${short} ${formatDay(best.dates[0])}`;
}

/** "Rent to J Patel Properties" → "Rent"; "Wage from Brightside Homecare" → "Wage". */
export function shortLabel(label: string): string {
  return label.replace(/ (to|from) .*$/, "");
}

export { daysBetween };
