// Recurring-transaction detection (plan section 13.2).
// 1. Normalise descriptions. 2. Group by description and direction. 3. Classify cadence from the gaps.
// 4. P20/P50/P80 amounts. 5. Confidence = share of expected occurrences seen in the last 6 months.
// One-offs that happened once last year become `annual` candidates; the rest is everyday spending.
import type { Category, ISODate, Series, Transaction } from "./types";
import type { AnnualCandidate, DetectedSeries, SeriesKind } from "./model";
import type { Persona } from "./seed/aisha";
import { addDays, daysBetween, monthKey, weekday, ymd } from "./calendar/dates";
import { formatMoney } from "@/lib/format";
import { round2 } from "./rng";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Upper case, strip digits and punctuation, first two words. */
export function normaliseDescription(d: string): string {
  return d
    .toUpperCase()
    .replace(/[^A-Z ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .join(" ");
}

export function quantile(values: number[], q: number): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

const median = (v: number[]) => quantile(v, 0.5);

function mode(values: number[]): number {
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = values[0];
  let n = -1;
  for (const [v, c] of counts) if (c > n || (c === n && v < best)) { best = v; n = c; }
  return best;
}

/** Circular distance between two days of the month (31 Jul and 2 Aug are close). */
function domDistance(a: number, b: number): number {
  const d = Math.abs(a - b);
  return Math.min(d, 31 - d);
}

interface Labeller { id: string; label: string; category?: Category }

/** Merchant enrichment: map a normalised description to a stable id and a plain label. */
function buildLabeller(p: Persona): Map<string, Labeller> {
  const m = new Map<string, Labeller>();
  m.set(normaliseDescription(p.wage.description), { id: "wage", label: p.wage.label });
  m.set(normaliseDescription(p.universalCredit.description), { id: "uc", label: p.universalCredit.label });
  m.set(normaliseDescription(p.childBenefit.description), { id: "child_benefit", label: p.childBenefit.label });
  for (const dd of p.directDebits) m.set(normaliseDescription(dd.description), { id: dd.id, label: dd.label });
  for (const w of p.weekly) m.set(normaliseDescription(w.description), { id: w.id, label: w.label });
  for (const b of p.bnpl) m.set(normaliseDescription(b.description), { id: b.id, label: b.provider });
  m.set(normaliseDescription(p.summerClub.description), { id: "summer_club", label: p.summerClub.label });
  for (const o of p.annualOneOffs) {
    m.set(normaliseDescription(o.description), { id: slug(o.label ?? o.description), label: o.label ?? titleCase(o.description) });
  }
  return m;
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}
function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

type Cadence = Series["cadence"];
const CADENCE_DAYS: Record<Cadence, number> = { weekly: 7, fortnightly: 14, four_weekly: 28, monthly: 30.44, annual: 365 };

function gapsOf(dates: ISODate[]): number[] {
  const g: number[] = [];
  for (let i = 1; i < dates.length; i++) g.push(daysBetween(dates[i - 1], dates[i]));
  return g;
}

function share(gaps: number[], lo: number, hi: number): number {
  if (gaps.length === 0) return 0;
  return gaps.filter((x) => x >= lo && x <= hi).length / gaps.length;
}

/** Classify a set of dates; returns the cadence or null. */
function classify(dates: ISODate[]): Cadence | null {
  const gaps = gapsOf(dates);
  if (gaps.length < 2) return null;
  const med = median(gaps);
  // Term-time or holiday gaps make some weekly gaps longer; a clear majority must fit the band.
  if (Math.abs(med - 7) <= 1 && share(gaps, 6, 8) >= 0.6) return "weekly";
  if (Math.abs(med - 14) <= 2 && share(gaps, 12, 16) >= 0.6) return "fortnightly";
  const doms = dates.map((d) => ymd(d).day);
  const domMode = mode(doms);
  const sameDom = doms.filter((x) => domDistance(x, domMode) <= 3).length / doms.length;
  if (med >= 27 && med <= 32 && sameDom >= 0.75) return "monthly";
  if (Math.abs(med - 28) <= 2 && share(gaps, 26, 30) >= 0.6) return "four_weekly";
  return null;
}

function seriesKind(category: Category, id: string, direction: "in" | "out", cadence: Cadence): SeriesKind {
  if (direction === "in") return category === "wage" || id === "wage" ? "wage" : id === "uc" ? "uc" : "benefit";
  return cadence === "monthly" ? "bill" : "spend";
}

export interface RecurringResult {
  detected: DetectedSeries[];
  annual: AnnualCandidate[];
  residual: Transaction[];
}

/** Category-level one-offs (gifts, celebrations) are grouped by category, not merchant. */
const EVENT_CATEGORIES: Category[] = ["christmas", "birthday"];
/** Never treated as one-off or residual: handled through known agreements. */
const AGREEMENT_CATEGORIES: Category[] = ["bnpl"];

export function detectRecurring(p: Persona, transactions: Transaction[], today: ISODate): RecurringResult {
  const labeller = buildLabeller(p);
  const sixMonthsAgo = addDays(today, -182);
  const detected: DetectedSeries[] = [];
  const annual: AnnualCandidate[] = [];
  const residual: Transaction[] = [];

  // Event categories first (Christmas is many merchants but one pattern).
  const byCategory = new Map<Category, Transaction[]>();
  const rest: Transaction[] = [];
  for (const t of transactions) {
    if (EVENT_CATEGORIES.includes(t.category)) {
      const list = byCategory.get(t.category) ?? [];
      list.push(t);
      byCategory.set(t.category, list);
    } else if (!AGREEMENT_CATEGORIES.includes(t.category)) rest.push(t);
  }
  for (const [category, members] of byCategory) annual.push(makeAnnual(p, category, members, labeller));

  // Merchant groups.
  const groups = new Map<string, Transaction[]>();
  for (const t of rest) {
    const key = `${normaliseDescription(t.description)}|${t.amount >= 0 ? "in" : "out"}`;
    const list = groups.get(key) ?? [];
    list.push(t);
    groups.set(key, list);
  }

  for (const [key, members] of groups) {
    const [norm, dir] = key.split("|") as [string, "in" | "out"];
    members.sort((a, b) => (a.date < b.date ? -1 : 1));
    const dates = members.map((m) => m.date);
    const category = members[members.length - 1].category;
    const known = labeller.get(norm);

    if (members.length >= 3) {
      let cadence = classify(dates);
      let weekdays: number[] = [];
      if (!cadence && median(gapsOf(dates)) < 6) {
        // Several visits a week (Tesco on Tuesday and Thursday): weekly on each of those days.
        const wds = [...new Set(dates.map(weekday))].filter((wd) => dates.filter((d) => weekday(d) === wd).length >= 3);
        const each = wds.map((wd) => classify(dates.filter((d) => weekday(d) === wd)));
        if (wds.length > 0 && each.every((c) => c === "weekly")) {
          cadence = "weekly";
          weekdays = wds.sort();
        }
      }
      if (cadence) {
        if (weekdays.length === 0 && cadence !== "monthly") weekdays = [mode(dates.map(weekday))];
        detected.push(makeSeries(p, norm, dir, category, cadence, weekdays, members, today, sixMonthsAgo, known));
        continue;
      }
    }
    // One or two in the same calendar month last year: an annual one-off.
    const total = -members.reduce((s, m) => s + m.amount, 0);
    const sameMonth = new Set(members.map((m) => monthKey(m.date))).size === 1;
    if (members.length <= 2 && sameMonth && dir === "out" && category !== "occasional" && total >= 40) {
      annual.push(makeAnnual(p, category, members, labeller));
      continue;
    }
    residual.push(...members);
  }

  // Known BNPL agreements: the instalment dates are known in advance, so they become a series even
  // if few payments have been seen.
  for (const a of p.bnpl) {
    const seen = transactions.filter((t) => normaliseDescription(t.description) === normaliseDescription(a.description) && t.date < today);
    const series: Series = {
      id: a.id, label: a.provider, category: "bnpl", cadence: "monthly",
      anchor: a.purchased, dayOfMonth: ymd(a.dueDates[0]).day,
      amountP20: a.instalment, amountP50: a.instalment, amountP80: a.instalment,
      direction: "out", confidence: 1, lastSeen: seen.length ? seen[seen.length - 1].date : a.purchased, count: seen.length,
    };
    detected.push({ series, kind: "bill", members: seen, samples: [-a.instalment], weekdays: [], active: true, termTime: false, lastAmount: -a.instalment });
  }

  const order: SeriesKind[] = ["wage", "uc", "benefit", "bill", "spend"];
  detected.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || Math.abs(b.series.amountP50) - Math.abs(a.series.amountP50));
  annual.sort((a, b) => (a.series.anchor < b.series.anchor ? -1 : 1));
  return { detected, annual, residual };
}

function makeSeries(
  p: Persona, norm: string, direction: "in" | "out", category: Category, cadence: Cadence, weekdays: number[],
  members: Transaction[], today: ISODate, sixMonthsAgo: ISODate, known: Labeller | undefined,
): DetectedSeries {
  const id = known?.id ?? slug(norm);
  const recent = cadence === "weekly" || cadence === "fortnightly" ? members.filter((m) => m.date >= sixMonthsAgo) : members;
  const pool = recent.length >= 3 ? recent : members;
  const abs = pool.map((m) => Math.abs(m.amount));
  const last = members[members.length - 1];
  const lastSeen = last.date;
  const step = CADENCE_DAYS[cadence];
  const termTime = category === "school";
  // Expected occurrences in the last 6 months (weekly series on two days count twice).
  const perStep = Math.max(1, weekdays.length);
  const expected = Math.max(1, Math.round((182 / step) * (cadence === "weekly" ? perStep : 1)));
  const observed = members.filter((m) => m.date >= sixMonthsAgo).length;
  // A series not seen for three cycles has stopped (the summer holiday club).
  const active = daysBetween(lastSeen, today) <= Math.max(21, step * 3);
  const series: Series = {
    id,
    label: known?.label ?? titleCase(norm),
    category,
    cadence,
    anchor: members[0].date,
    ...(cadence === "monthly" ? { dayOfMonth: mode(members.map((m) => ymd(m.date).day)) } : {}),
    ...(weekdays.length === 1 ? { weekday: weekdays[0] } : {}),
    amountP20: round2(quantile(abs, 0.2)),
    amountP50: round2(quantile(abs, 0.5)),
    amountP80: round2(quantile(abs, 0.8)),
    direction,
    confidence: round2(Math.min(1, observed / expected)),
    lastSeen,
    count: members.length,
  };
  // Universal Credit is paid on the 2nd: the mode of shifted dates can be 1 or 31; use the persona's pay day.
  if (id === "uc") series.dayOfMonth = p.universalCredit.payDay;
  return {
    series,
    kind: seriesKind(category, id, direction, cadence),
    members,
    samples: pool.map((m) => m.amount),
    weekdays,
    active,
    termTime,
    lastAmount: last.amount,
  };
}

function makeAnnual(p: Persona, category: Category, members: Transaction[], labeller: Map<string, Labeller>): AnnualCandidate {
  members.sort((a, b) => (a.date < b.date ? -1 : 1));
  const total = round2(-members.reduce((s, m) => s + m.amount, 0));
  const first = members[0];
  const lastM = members[members.length - 1];
  const { m, day } = ymd(first.date);
  let id: string;
  let label: string;
  let detail: string;
  if (category === "christmas") {
    id = "christmas";
    label = "Christmas spending";
    detail = `Last year you spent about ${formatMoney(total)} extra in December.`;
  } else if (category === "birthday") {
    id = "birthday";
    label = `${p.childName}'s birthday`;
    detail = `Last year you spent about ${formatMoney(total)} on ${day} ${MONTH_NAMES[m - 1]}.`;
  } else {
    const known = labeller.get(normaliseDescription(first.description));
    id = known?.id ?? slug(first.description);
    label = known?.label ?? titleCase(first.description);
    // Lower-case the first letter for mid-sentence use, but keep acronyms like "MOT" intact.
    const inSentence = /^[A-Z][a-z]/.test(label) ? label.charAt(0).toLowerCase() + label.slice(1) : label;
    detail = `Last year you spent about ${formatMoney(total)} on ${inSentence} in ${MONTH_NAMES[m - 1]}.`;
  }
  const series: Series = {
    id, label, category, cadence: "annual", anchor: first.date, dayOfMonth: day,
    amountP20: total, amountP50: total, amountP80: total,
    direction: "out", confidence: 0.5, lastSeen: lastM.date, count: members.length,
  };
  return { series, members, total, detail };
}
