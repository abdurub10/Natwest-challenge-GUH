// Broadband and mobile: mid-contract rises are fixed pound amounts set out in the contract and
// applied from each April (Ofcom rules since January 2025).
import type { ISODate } from "../types";
import type { RuleFiring, ScheduledItem } from "../model";
import { makeISO, ymd } from "../calendar/dates";
import { round2 } from "../rng";

export function applyAprilRises(items: ScheduledItem[], from: ISODate, to: ISODate, rise: number): RuleFiring[] {
  const fired: RuleFiring[] = [];
  if (rise === 0) return fired;
  for (let y = ymd(from).y; y <= ymd(to).y; y++) {
    const apr = makeISO(y, 4, 1);
    if (apr <= from || apr > to) continue;
    for (const category of ["broadband", "mobile"] as const) {
      const list = items
        .filter((i) => i.category === category && i.kind === "bill" && i.nominalDate >= apr)
        .sort((a, b) => (a.date < b.date ? -1 : 1));
      if (list.length === 0) continue;
      for (const i of list) i.amount = round2(i.amount - rise); // bills are negative
      const note = `${list[0].label} up £${rise.toFixed(2)} a month from April`;
      list[0].ruleId = "april_telecom_rise";
      list[0].notes.push(`${note}. The rise is set out in your contract.`);
      fired.push({ ruleId: "april_telecom_rise", date: list[0].date, note, ref: list[0].key });
    }
  }
  return fired;
}
