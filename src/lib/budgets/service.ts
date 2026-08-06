import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  budgetLines,
  budgets,
  divisions,
  events,
  expenseRequests,
} from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { createApproval } from "@/lib/approvals/service";
import { recomputeEventHealth } from "@/lib/events/service";
import {
  assertCan,
  can,
  type Actor,
} from "@/lib/permissions";

// Budgets service (T-051..T-053). Committed/actual are always derived from
// expense rows; visibility follows the permission matrix (Finance sees all,
// a Head only their division, Staff none).

async function getOrCreateBudget(eventId: string) {
  const [existing] = await db
    .select()
    .from(budgets)
    .where(eq(budgets.eventId, eventId))
    .limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(budgets)
    .values({ eventId })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  const [raced] = await db
    .select()
    .from(budgets)
    .where(eq(budgets.eventId, eventId))
    .limit(1);
  return raced;
}

export async function addBudgetLine(
  actor: Actor,
  input: {
    eventId: string;
    divisionId: string;
    name: string;
    plannedAmount: number;
  },
) {
  assertCan(actor, "budget.manage");
  if (input.plannedAmount <= 0) throw new Error("Planned amount must be positive.");
  const budget = await getOrCreateBudget(input.eventId);
  const [line] = await db
    .insert(budgetLines)
    .values({
      budgetId: budget.id,
      divisionId: input.divisionId,
      name: input.name.trim(),
      plannedAmount: input.plannedAmount,
    })
    .returning();
  await logActivity({
    actorId: actor.id,
    action: "budget.line.create",
    entity: `budget_line:${line.id}`,
    detail: { divisionId: input.divisionId, plannedAmount: input.plannedAmount },
    eventId: input.eventId,
  });
  return line;
}

export async function removeBudgetLine(actor: Actor, lineId: string) {
  assertCan(actor, "budget.manage");
  const [line] = await db
    .select({ line: budgetLines, eventId: budgets.eventId })
    .from(budgetLines)
    .innerJoin(budgets, eq(budgetLines.budgetId, budgets.id))
    .where(eq(budgetLines.id, lineId))
    .limit(1);
  if (!line) return;
  await db.delete(budgetLines).where(eq(budgetLines.id, lineId));
  await logActivity({
    actorId: actor.id,
    action: "budget.line.delete",
    entity: `budget_line:${lineId}`,
    eventId: line.eventId,
  });
}

// ---- expenses -------------------------------------------------------------

export async function createExpenseRequest(
  actor: Actor,
  input: {
    eventId: string;
    divisionId: string;
    budgetLineId?: string;
    title: string;
    vendor?: string;
    amount: number;
    justification?: string;
  },
) {
  assertCan(actor, "expense.create", { divisionId: input.divisionId });
  if (input.amount <= 0) throw new Error("Amount must be positive.");

  // the approval drives the lifecycle; it notifies its first approvers
  const approval = await createApproval(actor, {
    type: "expense",
    title: input.title,
    description: [
      input.vendor ? `Vendor: ${input.vendor}` : null,
      input.justification ?? null,
    ]
      .filter(Boolean)
      .join("\n"),
    amount: input.amount,
    divisionId: input.divisionId,
    eventId: input.eventId,
  });

  const [expense] = await db
    .insert(expenseRequests)
    .values({
      eventId: input.eventId,
      divisionId: input.divisionId,
      budgetLineId: input.budgetLineId ?? null,
      approvalId: approval.id,
      title: input.title.trim(),
      vendor: input.vendor?.trim() ?? "",
      amount: input.amount,
      requestedBy: actor.id,
    })
    .returning();

  await recomputeEventHealth(input.eventId);
  return expense;
}

// called by the approvals service when an expense approval reaches a terminal
// state (approved → committed; rejected/changes_requested pass through)
export async function syncExpenseWithApproval(
  approvalId: string,
  finalStatus: "approved" | "rejected" | "changes_requested",
): Promise<void> {
  const status =
    finalStatus === "approved" ? ("committed" as const) : finalStatus;
  const updated = await db
    .update(expenseRequests)
    .set({ status })
    .where(eq(expenseRequests.approvalId, approvalId))
    .returning({ eventId: expenseRequests.eventId });
  if (updated.length > 0) {
    await recomputeEventHealth(updated[0].eventId);
  }
}

export async function markExpensePaid(actor: Actor, expenseId: string) {
  assertCan(actor, "expense.markPaid");
  const [expense] = await db
    .select()
    .from(expenseRequests)
    .where(eq(expenseRequests.id, expenseId))
    .limit(1);
  if (!expense || expense.status !== "committed") {
    throw new Error("Only committed expenses can be marked paid.");
  }
  await db
    .update(expenseRequests)
    .set({ status: "paid", paidAt: new Date() })
    .where(eq(expenseRequests.id, expenseId));
  await logActivity({
    actorId: actor.id,
    action: "expense.paid",
    entity: `expense:${expenseId}`,
    detail: { amount: expense.amount },
    eventId: expense.eventId,
  });
  await recomputeEventHealth(expense.eventId);
}

// ---- rollups (T-053) ------------------------------------------------------

export interface LineRollup {
  id: string;
  divisionId: string;
  divisionName: string;
  name: string;
  planned: number;
  committed: number; // approved, not yet paid
  actual: number; // paid
}

function visibleDivisionFilter(actor: Actor): ((divisionId: string) => boolean) {
  return (divisionId) => can(actor, "budget.view", { divisionId });
}

export async function eventBudgetRollup(actor: Actor, eventId: string) {
  const visible = visibleDivisionFilter(actor);

  const lines = await db
    .select({ line: budgetLines, divisionName: divisions.name })
    .from(budgetLines)
    .innerJoin(budgets, eq(budgetLines.budgetId, budgets.id))
    .innerJoin(divisions, eq(budgetLines.divisionId, divisions.id))
    .where(eq(budgets.eventId, eventId))
    .orderBy(asc(divisions.sortOrder), asc(budgetLines.createdAt));

  const expenses = await db
    .select()
    .from(expenseRequests)
    .where(
      and(
        eq(expenseRequests.eventId, eventId),
        inArray(expenseRequests.status, ["committed", "paid"]),
      ),
    );

  const rollups: LineRollup[] = lines
    .filter((l) => visible(l.line.divisionId))
    .map((l) => {
      const lineExpenses = expenses.filter(
        (e) => e.budgetLineId === l.line.id,
      );
      return {
        id: l.line.id,
        divisionId: l.line.divisionId,
        divisionName: l.divisionName,
        name: l.line.name,
        planned: l.line.plannedAmount,
        committed: lineExpenses
          .filter((e) => e.status === "committed")
          .reduce((sum, e) => sum + e.amount, 0),
        actual: lineExpenses
          .filter((e) => e.status === "paid")
          .reduce((sum, e) => sum + e.amount, 0),
      };
    });

  // expenses not tied to a line still count toward division/event totals
  const unlinked = expenses.filter(
    (e) => e.budgetLineId === null && visible(e.divisionId),
  );

  const totals = {
    planned: rollups.reduce((s, r) => s + r.planned, 0),
    committed:
      rollups.reduce((s, r) => s + r.committed, 0) +
      unlinked.filter((e) => e.status === "committed").reduce((s, e) => s + e.amount, 0),
    actual:
      rollups.reduce((s, r) => s + r.actual, 0) +
      unlinked.filter((e) => e.status === "paid").reduce((s, e) => s + e.amount, 0),
  };

  return { lines: rollups, totals };
}

export async function listEventExpenses(actor: Actor, eventId: string) {
  const visible = visibleDivisionFilter(actor);
  const rows = await db
    .select()
    .from(expenseRequests)
    .where(eq(expenseRequests.eventId, eventId))
    .orderBy(asc(expenseRequests.createdAt));
  return rows.filter(
    (e) => visible(e.divisionId) || e.requestedBy === actor.id,
  );
}

export async function portfolioRollup(actor: Actor) {
  // portfolio view only for those who see everything
  if (!can(actor, "budget.manage") && actor.role !== "owner" && actor.role !== "admin") {
    return null;
  }
  const activeEvents = await db
    .select({ id: events.id, name: events.name })
    .from(events)
    .where(isNull(events.archivedAt));
  const result = [] as Array<{
    eventId: string;
    eventName: string;
    planned: number;
    committed: number;
    actual: number;
  }>;
  for (const event of activeEvents) {
    const { totals } = await eventBudgetRollup(actor, event.id);
    result.push({ eventId: event.id, eventName: event.name, ...totals });
  }
  return result;
}

// health input (EPIC-002 gatherSignals)
export async function budgetHealthSignals(eventId: string) {
  const lines = await db
    .select({ planned: budgetLines.plannedAmount })
    .from(budgetLines)
    .innerJoin(budgets, eq(budgetLines.budgetId, budgets.id))
    .where(eq(budgets.eventId, eventId));
  const expenses = await db
    .select({ status: expenseRequests.status, amount: expenseRequests.amount })
    .from(expenseRequests)
    .where(
      and(
        eq(expenseRequests.eventId, eventId),
        inArray(expenseRequests.status, ["committed", "paid"]),
      ),
    );
  const planned = lines.reduce((s, l) => s + l.planned, 0);
  const actual = expenses
    .filter((e) => e.status === "paid")
    .reduce((s, e) => s + e.amount, 0);
  const committed =
    expenses
      .filter((e) => e.status === "committed")
      .reduce((s, e) => s + e.amount, 0) + actual;
  return { budgetTotal: planned, budgetCommitted: committed, budgetActual: actual };
}
