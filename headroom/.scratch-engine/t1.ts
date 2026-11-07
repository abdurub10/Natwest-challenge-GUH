import { evaluate } from "./tune";
const xmas = (s24: number) => (p: any) => { const rest = 1 - s24; p.christmas.items = [
  { day: 5, description: "SMYTHS TOYS XMAS", share: rest * 0.37 },
  { day: 12, description: "AMAZON XMAS", share: rest * 0.25 },
  { day: 18, description: "PRIMARK XMAS", share: rest * 0.16 },
  { day: 20, description: "AMAZON XMAS", share: rest * 0.22 },
  { day: 24, description: "ALDI XMAS FOOD", share: s24 },
]; };
const run = (n: string, aldi: [number, number], tesco: [number, number], occ: number, bal: number, s24: number) =>
  console.log(n, JSON.stringify(evaluate((p) => { xmas(s24)(p); p.knobs.aldiRange = aldi; p.knobs.tescoRange = tesco; p.knobs.occasionalPerMonth = occ; p.knobs.balanceToday = bal; })).replace(/"hist":"[^"]*",/, ""));
run("A", [76, 92], [7, 13], 2.8, 270, 0.5);
run("B", [77, 93], [7, 13], 2.8, 275, 0.5);
run("C", [78, 94], [8, 13], 2.8, 280, 0.5);
run("D", [77, 93], [7, 13], 3, 280, 0.55);
run("E", [78, 94], [8, 14], 2.6, 275, 0.55);
