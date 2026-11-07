// Pure helpers that turn engine output into display text. No numbers are invented here:
// everything is read from the Forecast and formatted with src/lib/format.ts.
import type { CalendarEvent, Cause, DayPoint, Forecast, Language, RuleId, Series, Warning } from "@/lib/forecast/types";
import { formatDay, formatMoney, formatMoneyBand, formatShortDay, parseISO } from "@/lib/format";
import { statusWord, t, tf } from "@/lib/i18n";

export function isUniversalCredit(e: CalendarEvent): boolean {
  return e.ruleId === "uc_assessment_period" || /universal credit|\buc\b/i.test(e.label) || /(^|_)uc($|_)/i.test(e.seriesId ?? "");
}

/** Events sorted for display: biggest first, zero-amount notes last. */
export function sortedEvents(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
}

export function warningForDay(f: Forecast, date: string): Warning | undefined {
  return f.warnings.find((w) => date >= w.startDate && date <= w.endDate);
}

export function nextUniversalCredit(f: Forecast, fromIndex: number): DayPoint | undefined {
  for (let i = fromIndex + 1; i < f.days.length; i++) if (f.days[i].events.some((e) => isUniversalCredit(e) && e.amount > 0)) return f.days[i];
  return undefined;
}

/** One-line headline for a day, used as the scrubber's aria-valuetext. */
export function dayHeadline(f: Forecast, i: number, lang: Language): string {
  const d = f.days[i];
  if (!d) return "";
  const bal = formatMoneyBand(d.p50, d.p20, d.p80);
  const label = i === 0 ? t(lang, "day.balanceToday") : t(lang, "day.balanceAfter");
  return `${formatDay(d.date)}. ${label}: ${bal}. ${statusWord(lang, d.status)}.`;
}

/** Index of the lowest P50 day within a week starting on startDate. */
export function weekLowestIndex(f: Forecast, startDate: string): number {
  let best = -1;
  const end = addDaysISO(startDate, 7);
  f.days.forEach((d, i) => {
    if (d.date >= startDate && d.date < end && (best < 0 || d.p50 < f.days[best].p50)) best = i;
  });
  return best;
}

export function weekIndexForDay(f: Forecast, date: string): number {
  for (let w = f.weeks.length - 1; w >= 0; w--) if (date >= f.weeks[w].startDate) return w;
  return 0;
}

export function addDaysISO(d: string, n: number): string {
  const dt = parseISO(d);
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-10" or "2026-10-01" -> "October 2026" */
export function monthLabel(month: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(month);
  if (!m) return month;
  return `${MONTHS_LONG[Number(m[2]) - 1]} ${m[1]}`;
}
/** "Feb" for the month of an ISO date. */
export function shortMonth(d: string): string {
  return MONTHS_SHORT[parseISO(d).getUTCMonth()];
}

export const RULE_WORDS: Record<RuleId, string> = {
  uc_assessment_period: "Universal Credit rule",
  credit_before_weekend: "Paid early before a weekend or bank holiday",
  debit_after_weekend: "Taken after a weekend or bank holiday",
  energy_cap_change: "Energy price cap change",
  council_tax_schedule: "Council tax schedule",
  april_telecom_rise: "April broadband and mobile rise",
  annual_repeat: "Once a year, like last year",
};

export const CADENCE_WORDS: Record<Series["cadence"], string> = {
  weekly: "Weekly",
  fortnightly: "Every 2 weeks",
  four_weekly: "Every 4 weeks",
  monthly: "Monthly",
  annual: "Once a year",
};

/** Plural noun for a series' payments, e.g. "wages", "Universal Credit payments". */
export function seriesNoun(s: Series): string {
  if (s.category === "wage") return s.count === 1 ? "wage" : "wages";
  const name = /universal credit|\buc\b/i.test(s.label) ? "Universal Credit" : s.label;
  return `${name} ${s.count === 1 ? "payment" : "payments"}`;
}

const CAUSE_CATEGORIES: Partial<Record<RuleId, Series["category"][]>> = {
  uc_assessment_period: ["wage", "benefit"],
  energy_cap_change: ["energy"],
  council_tax_schedule: ["council_tax"],
  april_telecom_rise: ["broadband", "mobile"],
};

/** The recurring series that a cause was worked out from. */
export function seriesForCause(cause: Cause, recurring: Series[]): Series[] {
  const text = `${cause.id} ${cause.label}`.toLowerCase();
  const out = new Set<Series>();
  const cats = cause.ruleId ? CAUSE_CATEGORIES[cause.ruleId] : undefined;
  if (cats) {
    for (const s of recurring) {
      if (!cats.includes(s.category)) continue;
      // For benefits, Universal Credit only (not Child Benefit) under the UC rule.
      if (s.category === "benefit" && cause.ruleId === "uc_assessment_period" && !/universal credit|\buc\b/i.test(s.label)) continue;
      out.add(s);
    }
  }
  const keywords: [RegExp, (s: Series) => boolean][] = [
    [/christmas/, (s) => s.category === "christmas" || /christmas/i.test(s.label)],
    [/birthday/, (s) => s.category === "birthday" || /birthday/i.test(s.label)],
    [/klarna|bnpl/, (s) => s.category === "bnpl" || /klarna/i.test(s.label)],
    [/energy/, (s) => s.category === "energy"],
    [/council/, (s) => s.category === "council_tax"],
    [/universal credit|\buc\b|payday/, (s) => s.category === "wage" || (s.category === "benefit" && /universal credit|\buc\b/i.test(s.label))],
  ];
  for (const [re, pick] of keywords) if (re.test(text)) recurring.filter(pick).forEach((s) => out.add(s));
  return [...out];
}

/** "52 wages and 12 Universal Credit payments" */
export function countsPhrase(series: Series[], lang: Language): string {
  const parts = series.filter((s) => s.count > 0).map((s) => `${s.count} ${seriesNoun(s)}`);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")} ${t(lang, "how.and")} ${parts[parts.length - 1]}`;
}

/** Warning card sentence as plain text (for screen readers and WhatsApp-like summaries). */
export function warningSentence(w: Warning, lang: Language): string {
  return tf(lang, "warning.text", { start: formatDay(w.startDate), end: formatDay(w.endDate), amount: formatMoney(Math.abs(w.depthP50)) });
}

export function shortDay(d: string): string {
  return formatShortDay(d);
}
