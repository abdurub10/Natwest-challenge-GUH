// Everything the engine learns from the history once per (persona, today), cached in module scope.
import type { ISODate } from "./types";
import type { EngineContext, HistoryMonth } from "./model";
import { getPersona } from "./seed/aisha";
import { dailyBalances, generateHistory } from "./seed/generate";
import { detectRecurring } from "./recurring";
import { addDays, eachDay, ymd } from "./calendar/dates";
import { periodContaining } from "./rules/universalCredit";
import { round2 } from "./rng";

const cache = new Map<string, EngineContext>();

/** For tests and seed tuning only. */
export function clearContextCache(): void {
  cache.clear();
}

export function getContext(personaId: string, today: ISODate): EngineContext {
  const key = `${personaId}|${today}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const persona = getPersona(personaId);
  const history = generateHistory(persona, today);
  const { detected, annual, residual } = detectRecurring(persona, history.transactions, today);

  // Everyday spending outside any series: daily totals over the last 6 months, sampled per day.
  const poolFrom = addDays(today, -182);
  const byDay = new Map<ISODate, number>();
  for (const t of residual) if (t.date >= poolFrom) byDay.set(t.date, (byDay.get(t.date) ?? 0) + t.amount);
  const poolDays = eachDay(poolFrom < history.from ? history.from : poolFrom, addDays(today, -1));
  const residualPool = poolDays.map((d) => round2(byDay.get(d) ?? 0));
  const residualMean = residualPool.length ? residualPool.reduce((s, x) => s + x, 0) / residualPool.length : 0;

  const wageSeries = detected.find((d) => d.kind === "wage");
  const pastWages = (wageSeries?.members ?? []).map((m) => ({ date: m.date, amount: m.amount }));

  const ctx: EngineContext = {
    persona,
    today,
    balanceToday: persona.knobs.balanceToday,
    transactions: history.transactions,
    openingBalance: history.openingBalance,
    detected,
    annual,
    residualPool,
    residualMean,
    pastWages,
    historyMonths: [],
  };
  ctx.historyMonths = historyMonths(ctx);
  cache.set(key, ctx);
  return ctx;
}

/** Past 12 full months: lowest end-of-day balance, overdraft days, and whether that month's UC came from a five-payday period. */
export function historyMonths(ctx: EngineContext): HistoryMonth[] {
  const balances = dailyBalances({ transactions: ctx.transactions, openingBalance: ctx.openingBalance, from: ctx.persona.knobs.historyStart, to: addDays(ctx.today, -1) });
  const ucSeries = ctx.detected.find((d) => d.kind === "uc");
  const uc = ctx.persona.universalCredit;
  const months = new Map<string, HistoryMonth>();
  for (const b of balances) {
    const month = b.date.slice(0, 7);
    let m = months.get(month);
    if (!m) {
      m = { month, low: b.balance, lowDate: b.date, overdraftDays: 0, fivePayday: false };
      months.set(month, m);
    }
    if (b.balance < m.low) {
      m.low = b.balance;
      m.lowDate = b.date;
    }
    if (b.balance < 0) m.overdraftDays++;
  }
  for (const t of ucSeries?.members ?? []) {
    // A payment on 31 Jul belongs to the period paid on 2 Aug: look a few days ahead.
    const due = addDays(t.date, 4);
    const { y, m } = ymd(due);
    const period = periodContaining(uc.periodStartDay, `${y}-${String(m).padStart(2, "0")}-01`, uc.payDay);
    // periodContaining(1st of pay month) is the period that ends on the 26th of that month; we need the one before.
    const paid = periodContaining(uc.periodStartDay, addDays(period.start, -1), uc.payDay);
    const paydays = ctx.pastWages.filter((w) => w.date >= paid.start && w.date <= paid.end).length;
    const month = months.get(t.date.slice(0, 7));
    if (month && paydays >= 5) month.fivePayday = true;
  }
  const todayMonth = ctx.today.slice(0, 7);
  return [...months.values()]
    .filter((m) => m.month < todayMonth)
    .slice(-12)
    .map((m) => ({ ...m, low: round2(m.low) }));
}
