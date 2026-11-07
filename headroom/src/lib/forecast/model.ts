// Internal engine types (not part of the public API; see types.ts for those).
import type { Category, ISODate, RuleId, Series, Transaction } from "./types";
import type { Persona } from "./seed/aisha";

export type ItemKind = "wage" | "uc" | "benefit" | "bill" | "bnpl" | "spend" | "annual" | "oneoff" | "pot" | "info";

/** One scheduled money movement in the future. Amounts are signed: money in is positive. */
export interface ScheduledItem {
  key: string; // stable id, used to seed the per-item random draws
  date: ISODate; // the day the money moves (after any weekend or bank holiday shift)
  nominalDate: ISODate; // the day it was due
  label: string;
  seriesId?: string;
  category: Category;
  kind: ItemKind;
  amount: number; // the P50 amount shown on the day card
  samples?: number[]; // signed amounts to bootstrap from; absent means fixed
  variable?: boolean; // everyday spending: gets the widening drift
  ruleId?: RuleId;
  notes: string[];
  uc?: { periodStart: ISODate; periodEnd: ISODate; normalise?: boolean; paydays?: number; normalAmount?: number };
  /** Set when a rule changed the amount; lets the ablation switch a single rule off. */
  ruleEffects?: Partial<Record<RuleId, number>>;
}

export interface RuleFiring { ruleId: RuleId; date: ISODate; note: string; ref?: string }

export interface Schedule {
  from: ISODate;
  to: ISODate;
  items: ScheduledItem[];
  fired: RuleFiring[];
  /** Extra daily adjustments to everyday spending (positive = less spent), keyed by date. */
  spendAdjust: Map<ISODate, number>;
}

export type SeriesKind = "wage" | "uc" | "benefit" | "bill" | "spend";

export interface DetectedSeries {
  series: Series;
  kind: SeriesKind;
  members: Transaction[];
  /** Signed recent amounts, for bootstrapping. */
  samples: number[];
  weekdays: number[];
  active: boolean;
  termTime: boolean;
  lastAmount: number;
}

export interface AnnualCandidate {
  series: Series;
  members: Transaction[];
  total: number;
  /** Plain-English detail, e.g. "Last year you spent about £380 extra in December." */
  detail: string;
}

export interface HistoryMonth { month: string; low: number; lowDate: ISODate; overdraftDays: number; fivePayday: boolean }

export interface EngineContext {
  persona: Persona;
  today: ISODate;
  balanceToday: number;
  transactions: Transaction[];
  openingBalance: number;
  detected: DetectedSeries[];
  annual: AnnualCandidate[];
  /** Daily totals of everyday spending that is not part of any series (signed, last 6 months). */
  residualPool: number[];
  residualMean: number;
  /** Wages already paid (for assessment periods that started before today). */
  pastWages: { date: ISODate; amount: number }[];
  historyMonths: HistoryMonth[];
}
