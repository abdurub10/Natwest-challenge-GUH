// Number check (plan section 15.4). Every pound figure and date in text written by Claude
// must appear in facts.allowedNumbers (±£1 for rounding). Pure: no I/O, safe in tests.

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

const MONTH_RE =
  "(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";
const WEEKDAY_RE =
  "(Mon(?:day)?|Tue(?:s(?:day)?)?|Wed(?:nesday)?|Thu(?:r(?:s(?:day)?)?)?|Fri(?:day)?|Sat(?:urday)?|Sun(?:day)?)";
const ORD = "(?:st|nd|rd|th)?";

/** £ amounts: "£154", "£1,100", "£27.33". The sign is ignored (compared by size). */
const MONEY = /£\s?(\d[\d,]*(?:\.\d{1,2})?)/g;
/** "Thu 31 Dec", "Thursday 31st December", "31 Dec", "31 December", "Dec 31", "December 31st". */
const DATE_DAY_FIRST = new RegExp(`\\b(?:${WEEKDAY_RE},?\\s+)?(\\d{1,2})${ORD}\\s+(?:of\\s+)?${MONTH_RE}\\b`, "gi");
const DATE_MONTH_FIRST = new RegExp(`\\b(?:${WEEKDAY_RE},?\\s+)?${MONTH_RE}\\s+(\\d{1,2})${ORD}\\b`, "gi");

export interface NumberToken { raw: string; kind: "money" | "date"; value: number | string; weekday?: number; }
export interface NumberCheckResult { ok: boolean; rejected: string[]; checked: number; }

function monthIndex(m: string): number {
  return MONTHS.indexOf(m.slice(0, 3).toLowerCase());
}
function weekdayIndex(w: string | undefined): number | undefined {
  if (!w) return undefined;
  const i = WEEKDAYS.indexOf(w.slice(0, 3).toLowerCase());
  return i >= 0 ? i : undefined;
}

/** Extract every £ amount and date-like token from a text. Dates normalise to "D Mon" (e.g. "31 Dec"). */
export function extractTokens(text: string): NumberToken[] {
  const out: NumberToken[] = [];
  for (const m of text.matchAll(MONEY)) {
    const value = Number(m[1].replace(/,/g, ""));
    if (Number.isFinite(value)) out.push({ raw: m[0].trim(), kind: "money", value });
  }
  const taken: [number, number][] = [];
  for (const m of text.matchAll(DATE_DAY_FIRST)) {
    const day = Number(m[2]);
    const mi = monthIndex(m[3]);
    if (mi < 0 || day < 1 || day > 31) continue;
    taken.push([m.index ?? 0, (m.index ?? 0) + m[0].length]);
    out.push({ raw: m[0].trim(), kind: "date", value: `${day} ${cap(MONTHS[mi])}`, weekday: weekdayIndex(m[1]) });
  }
  for (const m of text.matchAll(DATE_MONTH_FIRST)) {
    const start = m.index ?? 0;
    if (taken.some(([a, b]) => start >= a && start < b)) continue;
    const day = Number(m[3]);
    const mi = monthIndex(m[2]);
    if (mi < 0 || day < 1 || day > 31) continue;
    out.push({ raw: m[0].trim(), kind: "date", value: `${day} ${cap(MONTHS[mi])}`, weekday: weekdayIndex(m[1]) });
  }
  return out;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

interface Allowed { money: number[]; dates: Map<string, Set<number | undefined>>; }

/** Parse the allowedNumbers strings with the same extractor, so any rendering works. */
export function buildAllowed(allowedNumbers: string[]): Allowed {
  const money: number[] = [];
  const dates = new Map<string, Set<number | undefined>>();
  for (const s of allowedNumbers) {
    for (const t of extractTokens(s)) {
      if (t.kind === "money") money.push(t.value as number);
      else {
        const set = dates.get(t.value as string) ?? new Set();
        set.add(t.weekday);
        dates.set(t.value as string, set);
      }
    }
  }
  return { money, dates };
}

const TOLERANCE = 1;

function isAllowed(t: NumberToken, allowed: Allowed): boolean {
  if (t.kind === "money") {
    const v = t.value as number;
    return allowed.money.some((a) => Math.abs(a - v) <= TOLERANCE + 1e-9);
  }
  const weekdays = allowed.dates.get(t.value as string);
  if (!weekdays) return false;
  if (t.weekday === undefined) return true;
  // A weekday was written: it must match the real one (when we know it).
  const known = [...weekdays].filter((w): w is number => w !== undefined);
  return known.length === 0 || known.includes(t.weekday);
}

/**
 * Check one or more texts against the allowed numbers.
 * Returns ok=false and the offending tokens when anything is not in the facts.
 */
export function checkNumbers(text: string | string[], allowedNumbers: string[]): NumberCheckResult {
  const texts = Array.isArray(text) ? text : [text];
  const allowed = buildAllowed(allowedNumbers);
  const rejected: string[] = [];
  let checked = 0;
  for (const t of texts) {
    for (const tok of extractTokens(t)) {
      checked++;
      if (!isAllowed(tok, allowed) && !rejected.includes(tok.raw)) rejected.push(tok.raw);
    }
  }
  return { ok: rejected.length === 0, rejected, checked };
}

// ---------------------------------------------------------------------------
// Banned words (plan section 22): never suggest credit.
// ---------------------------------------------------------------------------

export const BANNED_WORDS = ["overdraft", "loan", "borrow", "credit card", "advance"];
const BANNED_RE = /\b(overdrafts?|loans?|borrow\w*|credit\s+cards?|advances?)\b/gi;

export function findBannedWords(text: string | string[]): string[] {
  const texts = Array.isArray(text) ? text : [text];
  const found = new Set<string>();
  for (const t of texts) for (const m of t.matchAll(BANNED_RE)) found.add(m[0].toLowerCase());
  return [...found];
}
