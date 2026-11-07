// Date helpers on ISO strings (YYYY-MM-DD, UTC). No timezone drift, no real clock.
import type { ISODate } from "../types";
import { parseISO, toISO } from "@/lib/format";
import { isBankHoliday } from "./bankHolidays";
export { isBankHoliday };

const MS_DAY = 86_400_000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Days since 1970-01-01 for an ISO date. */
export function dayNumber(d: ISODate): number {
  return Math.round(parseISO(d).getTime() / MS_DAY);
}
export function fromDayNumber(n: number): ISODate {
  return toISO(new Date(n * MS_DAY));
}
export function addDays(d: ISODate, n: number): ISODate {
  return fromDayNumber(dayNumber(d) + n);
}
/** b − a in days. */
export function daysBetween(a: ISODate, b: ISODate): number {
  return dayNumber(b) - dayNumber(a);
}
/** 0 = Sunday … 6 = Saturday */
export function weekday(d: ISODate): number {
  return (((dayNumber(d) + 4) % 7) + 7) % 7; // 1970-01-01 was a Thursday
}
export function isWeekend(d: ISODate): boolean {
  const w = weekday(d);
  return w === 0 || w === 6;
}
export function isWorkingDay(d: ISODate): boolean {
  return !isWeekend(d) && !isBankHoliday(d);
}
/** The given day if it is a working day, otherwise the closest working day before it. */
export function previousWorkingDay(d: ISODate): ISODate {
  let x = d;
  while (!isWorkingDay(x)) x = addDays(x, -1);
  return x;
}
/** The given day if it is a working day, otherwise the closest working day after it. */
export function nextWorkingDay(d: ISODate): ISODate {
  let x = d;
  while (!isWorkingDay(x)) x = addDays(x, 1);
  return x;
}

export function ymd(d: ISODate): { y: number; m: number; day: number } {
  const [y, m, day] = d.split("-").map(Number);
  return { y, m, day };
}
export function makeISO(y: number, m: number, day: number): ISODate {
  // m is 1-based and may overflow (13 → January next year)
  return toISO(new Date(Date.UTC(y, m - 1, day)));
}
export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
/** Same day-of-month n months later, clamped to the month's last day (31 Jan + 1 → 28 Feb). */
export function addMonthsClamped(d: ISODate, n: number): ISODate {
  const { y, m, day } = ymd(d);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return makeISO(ny, nm, Math.min(day, daysInMonth(ny, nm)));
}
/** Date of the n-th weekday (0 = Sun) in a month (1-based). n = -1 gives the last one. */
export function nthWeekday(y: number, m: number, wd: number, n: number): ISODate {
  if (n > 0) {
    const first = makeISO(y, m, 1);
    const offset = (wd - weekday(first) + 7) % 7;
    return addDays(first, offset + (n - 1) * 7);
  }
  const last = makeISO(y, m, daysInMonth(y, m));
  const offset = (weekday(last) - wd + 7) % 7;
  return addDays(last, -offset + (n + 1) * 7);
}
/** Monday on or before the date. */
export function mondayOf(d: ISODate): ISODate {
  return addDays(d, -((weekday(d) + 6) % 7));
}
export function monthKey(d: ISODate): string {
  return d.slice(0, 7);
}
/** "2 Jan" */
export function shortDay(d: ISODate): string {
  const { m, day } = ymd(d);
  return `${day} ${MONTHS[m - 1]}`;
}
/** Why a day is not a working day: "is a Saturday", "is a bank holiday". */
export function nonWorkingReason(d: ISODate): string {
  if (isBankHoliday(d)) return "is a bank holiday";
  return `is a ${WEEKDAY_NAMES[weekday(d)]}`;
}
export function eachDay(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let n = dayNumber(from), end = dayNumber(to); n <= end; n++) out.push(fromDayNumber(n));
  return out;
}

export interface Shifted { date: ISODate; shifted: boolean; note?: string }

/** Credits (wages, benefits) due on a non-working day arrive on the working day before. */
export function shiftCredit(due: ISODate): Shifted {
  const date = previousWorkingDay(due);
  if (date === due) return { date, shifted: false };
  return { date, shifted: true, note: `Paid early: ${shortDay(due)} ${nonWorkingReason(due)}.` };
}
/** Debits (direct debits, standing orders, BNPL) due on a non-working day leave on the working day after. */
export function shiftDebit(due: ISODate): Shifted {
  const date = nextWorkingDay(due);
  if (date === due) return { date, shifted: false };
  return { date, shifted: true, note: `Taken late: ${shortDay(due)} ${nonWorkingReason(due)}.` };
}
