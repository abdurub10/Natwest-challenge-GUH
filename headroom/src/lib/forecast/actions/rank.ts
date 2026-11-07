// Deterministic ranking (plan section 14).
//   score = effectByCliff + 2 × effectMonthly − 0.5 × effortMinutes
//   tie-break on eligibility: yes > likely > check
//   talk_to_someone always last, unless the forecast is in deficit most months even after every
//   claim and timing action: then it moves to the top with the structural-deficit summary.
//   defaultOn = the top three by score whose eligibility is yes or likely.
import type { ActionCandidate, Eligibility } from "../types";
import { STRUCTURAL_SUMMARY } from "./catalogue";

const ELIGIBILITY_ORDER: Record<Eligibility, number> = { yes: 0, likely: 1, check: 2 };
const HELP_ID = "talk_to_someone";
const DEFAULT_ON_COUNT = 3;

export function score(a: Pick<ActionCandidate, "effectByCliff" | "effectMonthly" | "effortMinutes">): number {
  return a.effectByCliff + 2 * a.effectMonthly - 0.5 * a.effortMinutes;
}

export function rankActions(actions: ActionCandidate[], structuralDeficit: boolean): ActionCandidate[] {
  const help = actions.find((a) => a.id === HELP_ID);
  const rest = actions
    .filter((a) => a.id !== HELP_ID)
    .sort((a, b) => score(b) - score(a) || ELIGIBILITY_ORDER[a.eligibility] - ELIGIBILITY_ORDER[b.eligibility] || a.id.localeCompare(b.id));
  let defaults = 0;
  const ranked = rest.map((a) => {
    const on = defaults < DEFAULT_ON_COUNT && a.eligibility !== "check" && score(a) > 0 && (a.effectByCliff > 0 || a.effectMonthly > 0);
    if (on) defaults++;
    return { ...a, defaultOn: on };
  });
  if (!help) return ranked;
  if (structuralDeficit) return [{ ...help, summary: STRUCTURAL_SUMMARY, defaultOn: false }, ...ranked];
  return [...ranked, { ...help, defaultOn: false }];
}
