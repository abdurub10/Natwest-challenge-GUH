import { evaluate } from "./tune";
const xmas = (s24: number) => (p: any) => { const rest = 1 - s24; p.christmas.items = [
  { day: 5, description: "SMYTHS TOYS XMAS", share: rest * 0.37 },
  { day: 12, description: "AMAZON XMAS", share: rest * 0.25 },
  { day: 18, description: "PRIMARK XMAS", share: rest * 0.16 },
  { day: 20, description: "AMAZON XMAS", share: rest * 0.22 },
  { day: 24, description: "ALDI XMAS FOOD", share: s24 },
]; };
const base = (p: any) => { xmas(0.55)(p); p.knobs.aldiRange = [77, 93]; p.knobs.tescoRange = [7, 13]; p.knobs.occasionalPerMonth = 3; p.knobs.balanceToday = 280; };
const show = (n: string, f: (p: any) => void) => { const r = evaluate((p) => { base(p); f(p); }); console.log(n, r.dec1, r.dec30, r.low, r.firstShort, "open", r.opening, "\n   ", r.hist); };
show("D", () => {});
show("D hours20 until Apr", (p) => { p.wage.hoursHistory = [{ until: "2026-04-01", min: 16, max: 24, mode: 20, reason: "fewer clients" }]; });
show("D hours19 until May", (p) => { p.wage.hoursHistory = [{ until: "2026-05-01", min: 16, max: 24, mode: 19, reason: "fewer clients" }]; });
