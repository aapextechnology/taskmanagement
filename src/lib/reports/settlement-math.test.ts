import { describe, expect, it } from "vitest";
import { netResult, summarizeByDivision } from "./settlement-math";

const line = (
  divisionId: string,
  planned: number,
  committed: number,
  actual: number,
) => ({ divisionId, divisionName: divisionId, planned, committed, actual });

describe("summarizeByDivision", () => {
  it("aggregates multiple lines of the same division", () => {
    const { byDivision, totals } = summarizeByDivision([
      line("production", 10_000_000, 2_000_000, 3_000_000),
      line("production", 5_000_000, 0, 5_000_000),
      line("talent", 100_000_000, 80_000_000, 0),
    ]);
    expect(byDivision).toHaveLength(2);
    const production = byDivision.find((d) => d.divisionId === "production")!;
    expect(production.planned).toBe(15_000_000);
    expect(production.committed).toBe(2_000_000);
    expect(production.actual).toBe(8_000_000);
    expect(production.variance).toBe(5_000_000);
    expect(totals.planned).toBe(115_000_000);
    expect(totals.variance).toBe(
      totals.planned - (totals.committed + totals.actual),
    );
  });

  it("reconciles: division rows sum exactly to the totals row", () => {
    const { byDivision, totals } = summarizeByDivision([
      line("a", 7, 3, 2),
      line("b", 11, 5, 6),
      line("c", 13, 0, 13),
    ]);
    for (const key of ["planned", "committed", "actual"] as const) {
      expect(byDivision.reduce((s, d) => s + d[key], 0)).toBe(totals[key]);
    }
  });

  it("flags overspend as negative variance", () => {
    const { totals } = summarizeByDivision([line("a", 1_000, 500, 700)]);
    expect(totals.variance).toBe(-200);
  });

  it("handles an event with no budget at all", () => {
    const { byDivision, totals } = summarizeByDivision([]);
    expect(byDivision).toEqual([]);
    expect(totals.planned).toBe(0);
    expect(totals.variance).toBe(0);
  });
});

describe("netResult", () => {
  it("subtracts committed + paid from ticket income", () => {
    expect(
      netResult({ ticketRevenue: 500_000_000, committed: 100_000_000, actual: 250_000_000 }),
    ).toEqual({ spendTotal: 350_000_000, net: 150_000_000 });
  });

  it("goes negative when the show lost money", () => {
    expect(netResult({ ticketRevenue: 10, committed: 0, actual: 25 }).net).toBe(-15);
  });
});
