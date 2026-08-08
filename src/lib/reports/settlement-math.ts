// Pure settlement arithmetic (T-101) — extracted so the reconciliation
// rules are unit-testable without a database.

export interface SettlementLine {
  divisionId: string;
  divisionName: string;
  planned: number;
  committed: number; // approved, not yet paid
  actual: number; // paid
}

export interface DivisionSettlement {
  divisionId: string;
  divisionName: string;
  planned: number;
  committed: number;
  actual: number;
  /** planned − (committed + actual): positive = under budget */
  variance: number;
}

export interface SettlementSummary {
  byDivision: DivisionSettlement[];
  totals: DivisionSettlement;
}

export function summarizeByDivision(
  lines: SettlementLine[],
): SettlementSummary {
  const byId = new Map<string, DivisionSettlement>();
  for (const line of lines) {
    const entry = byId.get(line.divisionId) ?? {
      divisionId: line.divisionId,
      divisionName: line.divisionName,
      planned: 0,
      committed: 0,
      actual: 0,
      variance: 0,
    };
    entry.planned += line.planned;
    entry.committed += line.committed;
    entry.actual += line.actual;
    entry.variance = entry.planned - (entry.committed + entry.actual);
    byId.set(line.divisionId, entry);
  }
  const byDivision = [...byId.values()];
  const totals = byDivision.reduce(
    (t, d) => ({
      ...t,
      planned: t.planned + d.planned,
      committed: t.committed + d.committed,
      actual: t.actual + d.actual,
    }),
    {
      divisionId: "total",
      divisionName: "Total",
      planned: 0,
      committed: 0,
      actual: 0,
      variance: 0,
    },
  );
  totals.variance = totals.planned - (totals.committed + totals.actual);
  return { byDivision, totals };
}

/** Net show result: ticket income minus money out the door (paid) and
 *  still-committed spend — the number the Owner closes the event on. */
export function netResult(input: {
  ticketRevenue: number;
  committed: number;
  actual: number;
}): { spendTotal: number; net: number } {
  const spendTotal = input.committed + input.actual;
  return { spendTotal, net: input.ticketRevenue - spendTotal };
}
