// Council tax: normally 10 instalments, April to January. February and March are free and April
// restarts with the yearly rise (assumed +5%; the council confirms the real figure in March).
import type { ISODate } from "../types";
import type { RuleFiring, ScheduledItem } from "../model";
import { makeISO, ymd } from "../calendar/dates";
import { round2 } from "../rng";

export const COUNCIL_TAX_MONTHS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1];

/** Drops February and March instalments, raises April onwards, adds a zero-amount marker on 1 February. */
export function applyCouncilTax(
  items: ScheduledItem[], from: ISODate, to: ISODate, risePct: number,
): { items: ScheduledItem[]; fired: RuleFiring[] } {
  const fired: RuleFiring[] = [];
  const ct = items.filter((i) => i.category === "council_tax" && i.kind === "bill");
  if (ct.length === 0) return { items, fired };
  const out = items.filter((i) => !(i.category === "council_tax" && i.kind === "bill" && !COUNCIL_TAX_MONTHS.includes(ymd(i.nominalDate).m)));
  const template = ct[0];
  for (let y = ymd(from).y; y <= ymd(to).y; y++) {
    const feb = makeISO(y, 2, 1);
    if (feb >= from && feb <= to) {
      out.push({
        key: `ct-free:${feb}`, date: feb, nominalDate: feb, label: "No council tax in February", seriesId: template.seriesId,
        category: "council_tax", kind: "info", amount: 0, ruleId: "council_tax_schedule", notes: ["No council tax in February or March."],
      });
      fired.push({ ruleId: "council_tax_schedule", date: feb, note: "No council tax in February or March" });
    }
    const apr = makeISO(y, 4, 1);
    if (apr > from && apr <= to) {
      const factor = 1 + risePct / 100;
      const restart = out.filter((i) => i.category === "council_tax" && i.kind === "bill" && i.nominalDate >= apr).sort((a, b) => (a.date < b.date ? -1 : 1));
      for (const i of restart) i.amount = round2(i.amount * factor);
      if (restart[0]) {
        restart[0].ruleId = "council_tax_schedule";
        restart[0].notes.push(`Council tax starts again in April. Assumed ${risePct}% higher; the council confirms the amount.`);
      }
      fired.push({ ruleId: "council_tax_schedule", date: apr, note: `Council tax starts again in April, assumed ${risePct}% higher` });
    }
  }
  return { items: out, fired };
}
