export type ISODate = string; // YYYY-MM-DD

export interface Transaction { date: ISODate; amount: number; description: string; category: Category; }
export type Category = "wage" | "benefit" | "rent" | "council_tax" | "energy" | "water" | "broadband" | "mobile" | "insurance" | "subscription" | "bnpl" | "groceries" | "fuel" | "school" | "cash" | "takeaway" | "occasional" | "christmas" | "birthday" | "car" | "other";

export interface Series {
  id: string; label: string; category: Category;
  cadence: "weekly" | "fortnightly" | "four_weekly" | "monthly" | "annual";
  anchor: ISODate; dayOfMonth?: number; weekday?: number;
  amountP50: number; amountP20: number; amountP80: number;
  direction: "in" | "out"; confidence: number; lastSeen: ISODate; count: number;
}

export interface CalendarEvent {
  date: ISODate; amount: number; label: string; seriesId?: string;
  ruleId?: RuleId; note?: string;         // e.g. "Paid early: 2 Jan is a Saturday"
}
export type RuleId = "uc_assessment_period" | "credit_before_weekend" | "debit_after_weekend" | "energy_cap_change" | "council_tax_schedule" | "april_telecom_rise" | "annual_repeat";

export interface DayPoint { date: ISODate; p20: number; p50: number; p80: number; events: CalendarEvent[]; status: Status; }
export type Status = "comfortable" | "tight" | "short";
export interface Week { startDate: ISODate; status: Status; lowP50: number; lowP20: number; headline: string; }

export interface Cause { id: string; label: string; amount: number; ruleId?: RuleId; detail: string; }
export interface Warning {
  id: string; startDate: ISODate; endDate: ISODate; lowestDate: ISODate;
  depthP50: number; depthP20: number; depthP80: number; causes: Cause[]; confidence: "high" | "medium" | "low";
}

export type ActionType = "claim" | "timing" | "save" | "help" | "understand";
export type Eligibility = "yes" | "likely" | "check";
export interface ActionCandidate {
  id: string; title: string; type: ActionType; summary: string;
  effectByCliff: number; effectMonthly: number; effortMinutes: number;
  eligibility: Eligibility; needs: string[]; steps: string[]; link?: string;
  defaultOn: boolean; date?: ISODate;
}

export interface Scenario {
  actionIds?: string[];
  income?: { hoursPerWeek?: number; weeklyNetDelta?: number; fromDate: ISODate };
  extraExpenses?: { date: ISODate; amount: number; label: string }[];
  removeSeriesIds?: string[];
  energyChangePct?: number;
}

export interface Forecast {
  personaId: string; today: ISODate; horizonDays: number; balanceToday: number;
  headroom: { lowest: number; lowestDate: ISODate; lowestP20: number; lowestP80: number; afterPlan?: number };
  days: DayPoint[]; weeks: Week[]; warnings: Warning[]; actions: ActionCandidate[];
  rulesFired: { ruleId: RuleId; date: ISODate; note: string }[];
  recurring: Series[];
  history: { months: { month: string; low: number; lowDate: ISODate; overdraftDays: number; fivePayday: boolean }[] };
  scenario?: Scenario;
}

export interface Facts {               // everything Claude is allowed to say a number about
  today: ISODate; balanceToday: number; horizonDays: number;
  warning?: Warning; headroom: Forecast["headroom"];
  keyEvents: CalendarEvent[];          // max 8, the ones that matter
  actions: ActionCandidate[];          // max 6
  pastEpisodes: string[];              // "October 2026: 7 days in overdraft, lowest −£96"
  allowedNumbers: string[];            // every £ figure and date rendered as text, for the checker
  language: "en" | "ur" | "pl";
}

export interface Explanation { headline: string; why: string[]; whatThisMeans: string; reassurance: string; nextStep: string; language: string; }

// ---- Shared app types (store, API) ----
export type Language = "en" | "ur" | "pl";
export type TextSize = "normal" | "large";

export interface Profile { id: string; displayName: string; language: Language; textSize: TextSize; whatsappTo?: string | null; createdAt: string; }
export interface Plan { id: string; profileId: string; actionIds: string[]; lowestBefore: number; lowestAfter: number; lowestDate: ISODate; createdAt: string; }
export type ActivityKind = "plan_created" | "message_sent" | "reminder_sent" | "handoff_sent" | "reset" | "error";
export type ActivitySource = "app" | "n8n" | "fallback";
export interface Activity { id: string; profileId: string; kind: ActivityKind; title: string; detail?: string | null; source: ActivitySource; createdAt: string; }

/** GET /api/forecast response */
export type ForecastResponse = Forecast & { explanation?: Explanation };
/** POST /api/coach response */
export interface CoachResponse { reply: string; toolCalls: string[]; facts?: Facts; checked: boolean; }
/** POST /api/plan response */
export interface PlanResponse { plan: Plan; activity: Activity[]; lowestAfter: number; }
/** GET /api/health response */
export interface HealthResponse { ok: boolean; store: "supabase" | "memory"; n8n: boolean; claude: boolean; today: ISODate; numbersChecked: number; numbersRejected: number; }
