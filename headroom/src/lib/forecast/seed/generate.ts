// Deterministic synthetic history for a persona (plan section 11).
// mulberry32 seeded from the persona seed (20261107 for Aisha), one independent stream per kind of
// transaction so changing one tuning knob never reshuffles the others.
// The same calendar and Universal Credit rules the engine uses forward are applied backward here,
// so past dips are consistent with future ones.
import type { ISODate, Transaction } from "../types";
import { addDays, daysBetween, daysInMonth, eachDay, isBankHoliday, makeISO, nextWorkingDay, previousWorkingDay, weekday, ymd } from "../calendar/dates";
import { assessmentPeriods, ucAward, ucPayDate, wagesInPeriod } from "../rules/universalCredit";
import { hashString, mulberry32, round2, triangular } from "../rng";
import { isSchoolHoliday, type Persona } from "./aisha";

export interface GeneratedHistory {
  transactions: Transaction[];
  openingBalance: number;
  from: ISODate;
  to: ISODate;
}

const cache = new Map<string, GeneratedHistory>();

/** For tests and seed tuning only. */
export function clearHistoryCache(): void {
  cache.clear();
}

function stream(p: Persona, name: string): () => number {
  return mulberry32((p.knobs.seed ^ hashString(name)) >>> 0);
}

function between(u: number, lo: number, hi: number): number {
  return round2(lo + u * (hi - lo));
}

/** Transactions from knobs.historyStart to the day before `today`, plus the opening balance that makes today's balance `knobs.balanceToday`. */
export function generateHistory(p: Persona, today: ISODate): GeneratedHistory {
  const key = `${p.id}|${today}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const from = p.knobs.historyStart;
  const to = addDays(today, -1);
  const tx: Transaction[] = [];
  const inWindow = (d: ISODate) => d >= from && d <= to;
  const push = (t: Transaction) => {
    if (inWindow(t.date)) tx.push(t);
  };

  // 1. Wages every Friday; a bank-holiday Friday is paid the working day before.
  // Start well before the window so the first Universal Credit periods see their wages.
  const wageRng = stream(p, "wage");
  const preStart = addDays(from, -70);
  const wages: { date: ISODate; amount: number }[] = [];
  for (const d of eachDay(preStart, to)) {
    if (weekday(d) !== p.wage.weekday) continue;
    const spell = (p.wage.hoursHistory ?? []).find((h) => d < h.until) ?? p.wage.hours;
    const hours = triangular(wageRng(), spell.min, spell.max, spell.mode);
    const mileage = wageRng() < p.wage.mileage.chance ? p.wage.mileage.amount : 0;
    const amount = round2(hours * p.wage.netPerHour + mileage);
    const date = previousWorkingDay(d);
    wages.push({ date, amount });
    push({ date, amount, description: p.wage.description, category: "wage" });
  }

  // 2. Universal Credit from the wages paid inside each assessment period.
  const uc = p.universalCredit;
  for (const period of assessmentPeriods(uc.periodStartDay, addDays(from, -40), to, uc.payDay)) {
    if (period.start < preStart) continue;
    const pay = ucPayDate(period);
    if (!inWindow(pay.date)) continue;
    const amount = ucAward(wagesInPeriod(wages, period), uc);
    push({ date: pay.date, amount, description: uc.description, category: "benefit" });
  }

  // 3. Child Benefit every 4 weeks on a Monday, anchored to the persona's next payment.
  const cb = p.childBenefit;
  for (let n = -30; n <= 30; n++) {
    const due = addDays(cb.anchor, n * cb.everyDays);
    const date = previousWorkingDay(due);
    push({ date, amount: cb.amount, description: cb.description, category: "benefit" });
  }

  // 4. Direct debits and standing orders: a weekend or bank-holiday debit leaves on the next working day.
  const f = ymd(from);
  const t = ymd(to);
  const months: { y: number; m: number }[] = [];
  for (let idx = f.y * 12 + (f.m - 1) - 1; idx <= t.y * 12 + (t.m - 1); idx++) months.push({ y: Math.floor(idx / 12), m: (idx % 12) + 1 });
  for (const { y, m } of months) {
    for (const dd of p.directDebits) {
      if (dd.months && !dd.months.includes(m)) continue;
      const due = makeISO(y, m, Math.min(dd.dayOfMonth, daysInMonth(y, m)));
      let amount = dd.amount;
      for (const c of dd.changes ?? []) if (due >= c.from) amount = c.amount;
      push({ date: nextWorkingDay(due), amount: -amount, description: dd.description, category: dd.category });
    }
  }
  for (const b of p.pastBnpl) push({ date: nextWorkingDay(b.date), amount: -b.amount, description: b.description, category: b.category });
  for (const a of p.bnpl) for (const due of a.dueDates) push({ date: nextWorkingDay(due), amount: -a.instalment, description: a.description, category: "bnpl" });

  // 5. Weekly spending (card payments happen on the day; shops are shut on Christmas Day).
  const weeklyRng = new Map(p.weekly.map((w) => [w.id, stream(p, `weekly:${w.id}`)]));
  const range = (id: string, r: [number, number]): [number, number] =>
    id === "aldi" ? p.knobs.aldiRange : id === "tesco" ? p.knobs.tescoRange : r;
  const firstFriday = (() => {
    let d = from;
    while (weekday(d) !== 5) d = addDays(d, 1);
    return d;
  })();
  const summerDays = new Set(
    Array.from({ length: p.summerClub.weeks }, (_, i) => addDays(p.summerClub.from, i * 7)),
  );
  for (const d of eachDay(from, to)) {
    const wd = weekday(d);
    const christmasDay = d.slice(5) === "12-25";
    for (const w of p.weekly) {
      if (!w.weekdays.includes(wd)) continue;
      if (christmasDay) continue;
      if (w.termTimeOnly && (isSchoolHoliday(p, d) || isBankHoliday(d))) continue;
      if (w.everyOtherWeek && Math.round(daysBetween(firstFriday, d) / 7) % 2 !== 0) continue;
      const [lo, hi] = range(w.id, w.range);
      const u = (weeklyRng.get(w.id) as () => number)();
      push({ date: d, amount: -between(u, lo, hi), description: w.description, category: w.category });
    }
    if (summerDays.has(d)) push({ date: d, amount: -p.summerClub.amount, description: p.summerClub.description, category: "school" });
  }

  // 6. Occasional spending: about `occasionalPerMonth` debits a month, random days and merchants.
  const occRng = stream(p, "occasional");
  for (const { y, m } of months.slice(1)) {
    const dim = daysInMonth(y, m);
    const whole = Math.floor(p.knobs.occasionalPerMonth);
    const n = whole + (occRng() < p.knobs.occasionalPerMonth - whole ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const day = 1 + Math.floor(occRng() * dim);
      const merchant = p.occasional.merchants[Math.floor(occRng() * p.occasional.merchants.length)];
      const amount = between(occRng(), p.occasional.range[0], p.occasional.range[1]);
      push({ date: makeISO(y, m, day), amount: -amount, description: merchant, category: "occasional" });
    }
  }

  // 7. Annual one-offs: last Christmas (1 to 24 December), birthday, MOT, uniform.
  const xm = p.christmas;
  const spread = p.knobs.christmasExtra - xm.railFare.amount;
  for (const item of xm.items) {
    push({ date: makeISO(xm.year, 12, item.day), amount: -round2(spread * item.share), description: item.description, category: "christmas" });
  }
  push({ date: makeISO(xm.year, 12, xm.railFare.day), amount: -xm.railFare.amount, description: xm.railFare.description, category: "christmas" });
  for (const o of p.annualOneOffs) push({ date: o.date, amount: -o.amount, description: o.description, category: o.category });

  // 8. Overdraft interest is ignored (the forecast shows overdraft days; interest is not needed).

  tx.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : b.amount - a.amount));
  const net = tx.reduce((s, x) => s + x.amount, 0);
  const result: GeneratedHistory = {
    transactions: tx,
    openingBalance: round2(p.knobs.balanceToday - net),
    from,
    to,
  };
  cache.set(key, result);
  return result;
}

/** End-of-day balances over the history window. */
export function dailyBalances(h: GeneratedHistory): { date: ISODate; balance: number }[] {
  const byDay = new Map<ISODate, number>();
  for (const t of h.transactions) byDay.set(t.date, (byDay.get(t.date) ?? 0) + t.amount);
  let bal = h.openingBalance;
  return eachDay(h.from, h.to).map((date) => {
    bal = round2(bal + (byDay.get(date) ?? 0));
    return { date, balance: bal };
  });
}
