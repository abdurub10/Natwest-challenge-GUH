// Annual repeats: one-offs from last year (Christmas, a birthday, the MOT, school uniform) are
// expected again on the same dates this year.
import type { ISODate } from "../types";
import type { AnnualCandidate, RuleFiring, ScheduledItem } from "../model";
import { makeISO, ymd } from "../calendar/dates";

export function annualItems(candidates: AnnualCandidate[], from: ISODate, to: ISODate): { items: ScheduledItem[]; fired: RuleFiring[] } {
  const items: ScheduledItem[] = [];
  const fired: RuleFiring[] = [];
  for (const c of candidates) {
    for (let years = 1; years <= 3; years++) {
      const repeat: ScheduledItem[] = [];
      for (const t of c.members) {
        const { y, m, day } = ymd(t.date);
        const date = makeISO(y + years, m, day);
        if (date < from || date > to) continue;
        repeat.push({
          key: `annual:${c.series.id}:${date}:${repeat.length}`,
          date, nominalDate: date, label: c.series.label, seriesId: c.series.id, category: c.series.category,
          kind: "annual", amount: t.amount, ruleId: "annual_repeat", notes: [],
        });
      }
      if (repeat.length === 0) continue;
      repeat[0].notes.push(c.detail);
      items.push(...repeat);
      fired.push({ ruleId: "annual_repeat", date: repeat[0].date, note: c.detail.replace(/\.$/, ""), ref: c.series.id });
    }
  }
  return { items, fired };
}
