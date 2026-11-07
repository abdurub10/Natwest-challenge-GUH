// Energy price cap: Ofgem changes it every 1 January, 1 April, 1 July and 1 October.
// For the first energy debit on or after each change date we assume the direct debit moves by the
// size of the last published change (+4% by default). The supplier sets the real amount.
import type { ISODate } from "../types";
import type { RuleFiring, ScheduledItem } from "../model";
import { makeISO, ymd } from "../calendar/dates";
import { round2 } from "../rng";

export function energyNote(pct: number): string {
  return `Assumed ${pct >= 0 ? "+" : ""}${pct}%, the size of the last price cap change. Your supplier sets the exact amount.`;
}

/** Cap change dates strictly after `from`, up to `to`. */
export function capChangeDates(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let y = ymd(from).y; y <= ymd(to).y; y++) {
    for (const m of [1, 4, 7, 10]) {
      const d = makeISO(y, m, 1);
      if (d > from && d <= to) out.push(d);
    }
  }
  return out;
}

/** Mutates energy items in place and returns the rule firings. */
export function applyEnergyCap(items: ScheduledItem[], from: ISODate, to: ISODate, pct: number): RuleFiring[] {
  const energy = items.filter((i) => i.category === "energy" && i.kind === "bill").sort((a, b) => (a.date < b.date ? -1 : 1));
  const fired: RuleFiring[] = [];
  if (energy.length === 0 || pct === 0) return fired;
  const step = 1 + pct / 100;
  for (const change of capChangeDates(from, to)) {
    const after = energy.filter((e) => e.nominalDate >= change);
    if (after.length === 0) continue;
    for (const e of after) e.amount = round2(e.amount * step);
    const first = after[0];
    first.ruleId = "energy_cap_change";
    first.notes.push(energyNote(pct));
    fired.push({ ruleId: "energy_cap_change", date: first.date, note: energyNote(pct).replace(/\.$/, ""), ref: first.key });
  }
  return fired;
}
