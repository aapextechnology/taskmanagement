import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  approvals,
  divisions,
  events,
  expenseRequests,
  profiles,
  tasks,
  ticketSalesSnapshots,
} from "@/db/schema";
import { eventBudgetRollup } from "@/lib/budgets/service";
import { assertCan, type Actor } from "@/lib/permissions";
import {
  netResult,
  summarizeByDivision,
  type SettlementSummary,
} from "./settlement-math";

// Event settlement report (T-101) — the financial close-out: budget vs
// actual per division, income, approval history, and what's still open.
// Owner/Admin only, same gate as the executive dashboard.

export interface SettlementReport {
  event: {
    id: string;
    name: string;
    artists: string;
    venue: string;
    showDate: Date;
    capacity: number | null;
  };
  budget: SettlementSummary;
  income: { ticketsSold: number; ticketRevenue: number; soldPct: number | null };
  net: { spendTotal: number; net: number };
  approvalHistory: Array<{
    title: string;
    type: string;
    amount: number | null;
    status: string;
    division: string;
    requestedBy: string;
    decidedAt: Date | null;
  }>;
  outstanding: {
    pendingApprovals: Array<{ title: string; amount: number | null; division: string }>;
    unpaidExpenses: Array<{ title: string; vendor: string; amount: number; division: string }>;
    openTasks: number;
  };
  generatedAt: Date;
  generatedBy: string;
  /** installation branding, e.g. "Acme Backstage" */
  brandName: string;
}

export async function gatherSettlement(
  actor: Actor,
  eventId: string,
): Promise<SettlementReport | null> {
  assertCan(actor, "dashboard.view");

  const [event] = await db
    .select()
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);
  if (!event) return null;

  const [me] = await db
    .select({ name: profiles.name })
    .from(profiles)
    .where(eq(profiles.id, actor.id))
    .limit(1);

  const [rollup, ticketRows, approvalRows, unpaidRows, openTaskRow] =
    await Promise.all([
      eventBudgetRollup(actor, eventId),
      db
        .select({
          sold: sql<number>`coalesce(sum(tickets_sold), 0)::int`,
          revenue: sql<number>`coalesce(sum(revenue), 0)::bigint`,
        })
        .from(ticketSalesSnapshots)
        .where(eq(ticketSalesSnapshots.eventId, eventId)),
      db
        .select({
          approval: approvals,
          division: divisions.name,
          requesterName: profiles.name,
        })
        .from(approvals)
        .innerJoin(divisions, eq(approvals.divisionId, divisions.id))
        .innerJoin(profiles, eq(approvals.requestedBy, profiles.id))
        .where(eq(approvals.eventId, eventId))
        .orderBy(asc(approvals.createdAt)),
      db
        .select({ expense: expenseRequests, division: divisions.name })
        .from(expenseRequests)
        .innerJoin(divisions, eq(expenseRequests.divisionId, divisions.id))
        .where(
          and(
            eq(expenseRequests.eventId, eventId),
            eq(expenseRequests.status, "committed"),
          ),
        )
        .orderBy(asc(expenseRequests.createdAt)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(tasks)
        .where(
          and(
            eq(tasks.eventId, eventId),
            inArray(tasks.status, [
              "backlog",
              "todo",
              "in_progress",
              "in_review",
              "blocked",
            ]),
          ),
        ),
    ]);

  const budget = summarizeByDivision(rollup.lines);
  // rollup.totals includes unlinked expenses — trust it as the money truth
  budget.totals.planned = rollup.totals.planned;
  budget.totals.committed = rollup.totals.committed;
  budget.totals.actual = rollup.totals.actual;
  budget.totals.variance =
    rollup.totals.planned - (rollup.totals.committed + rollup.totals.actual);

  const ticketsSold = ticketRows[0]?.sold ?? 0;
  const ticketRevenue = Number(ticketRows[0]?.revenue ?? 0);

  return {
    event: {
      id: event.id,
      name: event.name,
      artists: event.artists,
      venue: event.venue,
      showDate: event.showDate,
      capacity: event.capacity,
    },
    budget,
    income: {
      ticketsSold,
      ticketRevenue,
      soldPct:
        event.capacity && event.capacity > 0
          ? Math.round((ticketsSold / event.capacity) * 100)
          : null,
    },
    net: netResult({
      ticketRevenue,
      committed: budget.totals.committed,
      actual: budget.totals.actual,
    }),
    approvalHistory: approvalRows.map((r) => ({
      title: r.approval.title,
      type: r.approval.type,
      amount: r.approval.amount,
      status: r.approval.status,
      division: r.division,
      requestedBy: r.requesterName,
      decidedAt: r.approval.decidedAt,
    })),
    outstanding: {
      pendingApprovals: approvalRows
        .filter((r) => r.approval.status === "pending")
        .map((r) => ({
          title: r.approval.title,
          amount: r.approval.amount,
          division: r.division,
        })),
      unpaidExpenses: unpaidRows.map((r) => ({
        title: r.expense.title,
        vendor: r.expense.vendor,
        amount: r.expense.amount,
        division: r.division,
      })),
      openTasks: openTaskRow[0]?.count ?? 0,
    },
    generatedAt: new Date(),
    brandName: await (async () => {
      const { getBranding, fullName } = await import("@/lib/org/branding");
      return fullName(await getBranding());
    })(),
    generatedBy: me?.name ?? "Unknown",
  };
}
