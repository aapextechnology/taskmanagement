"use server";

import { revalidatePath } from "next/cache";
import { sessionActor } from "@/lib/auth/session-actor";
import {
  addBudgetLine,
  createExpenseRequest,
  markExpensePaid,
  removeBudgetLine,
} from "@/lib/budgets/service";
import { PermissionError } from "@/lib/permissions";

export interface BudgetActionState {
  error?: string;
  ok?: boolean;
}

async function requireActor() {
  const actor = await sessionActor();
  if (!actor) throw new PermissionError("budget.view");
  return actor;
}

function friendly(error: unknown): BudgetActionState {
  if (error instanceof PermissionError) return { error: "Not allowed." };
  if (error instanceof Error) return { error: error.message };
  throw error;
}

function parseAmount(raw: FormDataEntryValue | null): number {
  return Number(String(raw ?? "").replaceAll(".", "").replaceAll(",", "")) || 0;
}

export async function addLineAction(
  _prev: BudgetActionState,
  formData: FormData,
): Promise<BudgetActionState> {
  try {
    const actor = await requireActor();
    const eventId = String(formData.get("eventId"));
    await addBudgetLine(actor, {
      eventId,
      divisionId: String(formData.get("divisionId")),
      name: String(formData.get("name") ?? "").trim(),
      plannedAmount: parseAmount(formData.get("plannedAmount")),
    });
    revalidatePath(`/events/${eventId}/budget`);
    return { ok: true };
  } catch (error) {
    return friendly(error);
  }
}

export async function removeLineAction(formData: FormData): Promise<void> {
  const actor = await requireActor();
  const eventId = String(formData.get("eventId"));
  await removeBudgetLine(actor, String(formData.get("lineId")));
  revalidatePath(`/events/${eventId}/budget`);
}

export async function createExpenseAction(
  _prev: BudgetActionState,
  formData: FormData,
): Promise<BudgetActionState> {
  try {
    const actor = await requireActor();
    const eventId = String(formData.get("eventId"));
    await createExpenseRequest(actor, {
      eventId,
      divisionId: String(formData.get("divisionId")),
      budgetLineId: String(formData.get("budgetLineId") ?? "") || undefined,
      title: String(formData.get("title") ?? "").trim(),
      vendor: String(formData.get("vendor") ?? ""),
      amount: parseAmount(formData.get("amount")),
      justification: String(formData.get("justification") ?? ""),
    });
    revalidatePath(`/events/${eventId}/budget`);
    revalidatePath("/approvals");
    return { ok: true };
  } catch (error) {
    return friendly(error);
  }
}

export async function markPaidAction(formData: FormData): Promise<void> {
  const actor = await requireActor();
  const eventId = String(formData.get("eventId"));
  await markExpensePaid(actor, String(formData.get("expenseId")));
  revalidatePath(`/events/${eventId}/budget`);
}
