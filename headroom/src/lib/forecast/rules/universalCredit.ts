// Universal Credit: monthly assessment periods, payday counting, the 55% taper and the pay date.
// gov.uk: UC is worked out on the wages *paid* inside each assessment period. Weekly-paid people get
// five paydays in four periods a year, so the award for those periods is lower.
import type { ISODate } from "../types";
import { addMonthsClamped, makeISO, shiftCredit, shortDay, ymd, type Shifted } from "../calendar/dates";
import type { Persona } from "../seed/aisha";
import { round2 } from "../rng";

export interface AssessmentPeriod {
  start: ISODate;
  end: ISODate;
  /** The 2nd of the month after the period ends (before any weekend or bank holiday shift). */
  payDue: ISODate;
}

type UCRates = Persona["universalCredit"];

/** All assessment periods that overlap [from, to]. A period runs from `startDay` to the day before `startDay` next month. */
export function assessmentPeriods(startDay: number, from: ISODate, to: ISODate, payDay = 2): AssessmentPeriod[] {
  const out: AssessmentPeriod[] = [];
  const f = ymd(from);
  // Start one month earlier so a period that began last month and overlaps `from` is included.
  let start = makeISO(f.y, f.m - 1, startDay);
  for (let guard = 0; guard < 400; guard++) {
    const next = addMonthsClamped(start, 1);
    const end = makeISO(ymd(next).y, ymd(next).m, startDay - 1);
    if (start > to) break;
    if (end >= from) {
      const e = ymd(end);
      out.push({ start, end, payDue: makeISO(e.y, e.m + 1, payDay) });
    }
    start = next;
  }
  return out;
}

/** The period a date falls in. */
export function periodContaining(startDay: number, d: ISODate, payDay = 2): AssessmentPeriod {
  return assessmentPeriods(startDay, d, d, payDay)[0];
}

export function countPaydaysInPeriod(wageEvents: { date: ISODate }[], period: AssessmentPeriod): number {
  return wageEvents.filter((w) => w.date >= period.start && w.date <= period.end).length;
}

export function wagesInPeriod(wageEvents: { date: ISODate; amount: number }[], period: AssessmentPeriod): number {
  let s = 0;
  for (const w of wageEvents) if (w.date >= period.start && w.date <= period.end) s += w.amount;
  return s;
}

export function maxAward(r: UCRates): number {
  return round2(r.standardAllowance + r.childElement + r.housingElement);
}

/** award = max(0, maximum − 55% × max(0, wages − work allowance)) */
export function ucAward(wagesTotal: number, r: UCRates): number {
  const over = Math.max(0, wagesTotal - r.workAllowance);
  return round2(Math.max(0, maxAward(r) - r.taper * over));
}

/** UC is paid on the pay day; on a weekend or bank holiday it is paid the working day before. */
export function ucPayDate(period: AssessmentPeriod): Shifted {
  return shiftCredit(period.payDue);
}

/** "5 paydays between 27 Nov and 26 Dec, so about £154 less" */
export function ucNote(paydays: number, period: AssessmentPeriod, lessBy: number): string {
  const span = `between ${shortDay(period.start)} and ${shortDay(period.end)}`;
  if (paydays >= 5 && lessBy >= 1) return `${paydays} paydays ${span}, so about £${Math.round(lessBy)} less.`;
  return `${paydays} paydays ${span}, so the usual amount.`;
}

/** What the award would have been with a normal four paydays (used for the "how much less" note and the cause). */
export function normalAward(wagesTotal: number, paydays: number, r: UCRates): number {
  if (paydays <= 4) return ucAward(wagesTotal, r);
  return ucAward((wagesTotal * 4) / paydays, r);
}
