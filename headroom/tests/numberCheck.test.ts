import { describe, expect, it } from "vitest";
import { checkNumbers, extractTokens, findBannedWords } from "@/lib/coach/numberCheck";
import { collectAllowedNumbers, dateVariants, moneyVariants } from "@/lib/forecast/facts";

const allowed = collectAllowedNumbers({
  money: [154, -140, 799, 270, 27.33],
  dates: ["2026-12-31", "2027-02-01", "2027-01-25"],
  texts: ["5 paydays between 27 Nov and 26 Dec, so about £154 less"],
});

describe("numberCheck (plan section 23)", () => {
  it("rejects £999 when it is not in the facts", () => {
    const r = checkNumbers("You will be short by £999.", allowed);
    expect(r.ok).toBe(false);
    expect(r.rejected).toEqual(["£999"]);
  });

  it('accepts "about £154" when 154 is in the facts', () => {
    expect(checkNumbers("Universal Credit is about £154 lower.", allowed).ok).toBe(true);
  });

  it('accepts "Thu 31 Dec"', () => {
    expect(checkNumbers("It lands early on Thu 31 Dec.", allowed).ok).toBe(true);
  });

  it("allows ±£1 for rounding, but not more", () => {
    expect(checkNumbers("about £155", allowed).ok).toBe(true);
    expect(checkNumbers("about £153", allowed).ok).toBe(true);
    expect(checkNumbers("about £157", allowed).ok).toBe(false);
    expect(checkNumbers("Klarna £27.33 and £27", allowed).ok).toBe(true);
  });

  it("checks negative amounts and minus signs by size", () => {
    expect(checkNumbers("Lowest point: about −£140 on Mon 1 Feb.", allowed).ok).toBe(true);
    expect(checkNumbers("Lowest point: -£140.", allowed).ok).toBe(true);
  });

  it("rejects a date that is not in the facts", () => {
    const r = checkNumbers("Universal Credit lands on Fri 15 Jan.", allowed);
    expect(r.ok).toBe(false);
    expect(r.rejected).toEqual(["Fri 15 Jan"]);
  });

  it("accepts other renderings of an allowed date", () => {
    expect(checkNumbers("on 31 December", allowed).ok).toBe(true);
    expect(checkNumbers("on December 31st", allowed).ok).toBe(true);
    expect(checkNumbers("from 25 Jan to 1 Feb", allowed).ok).toBe(true);
  });

  it("rejects an allowed date with the wrong weekday", () => {
    const r = checkNumbers("Mon 31 Dec", allowed);
    expect(r.ok).toBe(false);
  });

  it("accepts dates that appear inside engine text", () => {
    expect(checkNumbers("Five paydays fall between 27 Nov and 26 Dec.", allowed).ok).toBe(true);
  });

  it("counts every token it checked", () => {
    const r = checkNumbers(["about £154 on Thu 31 Dec", "£999"], allowed);
    expect(r.checked).toBe(3);
    expect(r.rejected).toEqual(["£999"]);
  });

  it("ignores years and plain numbers", () => {
    expect(extractTokens("In May 2026 you worked 16 hours a week.")).toEqual([]);
  });
});

describe("allowed number variants", () => {
  it("renders money the ways a reply might write it", () => {
    expect(moneyVariants(-139.6)).toEqual(expect.arrayContaining(["−£140", "about −£140", "£140", "-£140"]));
    expect(moneyVariants(70)).toEqual(expect.arrayContaining(["£70", "+£70", "about £70"]));
  });
  it("renders dates as Thu 31 Dec, 31 Dec and 31 December", () => {
    expect(dateVariants("2026-12-31")).toEqual(["Thu 31 Dec", "31 Dec", "31 December"]);
  });
});

describe("banned words (plan section 22)", () => {
  it("finds credit words", () => {
    expect(findBannedWords("You could borrow from a loan or use your overdraft.")).toEqual(["borrow", "loan", "overdraft"]);
    expect(findBannedWords("A credit card or a salary advance")).toEqual(["credit card", "advance"]);
  });
  it("passes clean text", () => {
    expect(findBannedWords("Put £150 aside on Fri 11 Dec.")).toEqual([]);
  });
});
