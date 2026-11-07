// Shared formatting. Used by the UI, facts.ts, numberCheck.ts and message builders.
// Money: "£154", "−£140" (U+2212 minus). Dates: "Thu 31 Dec".
import type { ISODate } from "./forecast/types";

export const MINUS = "−";
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Parse YYYY-MM-DD as a UTC date (no timezone drift). */
export function parseISO(d: ISODate): Date {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}
export function toISO(d: Date): ISODate {
  return d.toISOString().slice(0, 10);
}

/** "£154", "−£140". Rounded to whole pounds. opts.about prefixes "about ". opts.sign adds "+" for positives. */
export function formatMoney(n: number, opts: { about?: boolean; sign?: boolean } = {}): string {
  const r = Math.round(n);
  const abs = Math.abs(r).toLocaleString("en-GB");
  const s = r < 0 ? `${MINUS}£${abs}` : `${opts.sign && r > 0 ? "+" : ""}£${abs}`;
  return opts.about ? `about ${s}` : s;
}

/** "about £154" when the band (p80 - p20) is wider than £40, otherwise "£154". */
export function formatMoneyBand(p50: number, p20: number, p80: number, opts: { sign?: boolean } = {}): string {
  return formatMoney(p50, { ...opts, about: Math.abs(p80 - p20) > 40 });
}

/** "Thu 31 Dec" */
export function formatDay(d: ISODate): string {
  const dt = parseISO(d);
  return `${DAYS[dt.getUTCDay()]} ${dt.getUTCDate()} ${MONTHS[dt.getUTCMonth()]}`;
}
/** "31 Dec" */
export function formatShortDay(d: ISODate): string {
  const dt = parseISO(d);
  return `${dt.getUTCDate()} ${MONTHS[dt.getUTCMonth()]}`;
}
/** "14:32" from an ISO timestamp, in UK time. */
export function formatTime(ts: string): string {
  return new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
}
