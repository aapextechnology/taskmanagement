"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createApproval,
  decide,
  type Decision,
} from "@/lib/approvals/service";
import type { ApprovalType } from "@/lib/approvals/chains";
import { sessionActor } from "@/lib/auth/session-actor";
import { PermissionError } from "@/lib/permissions";

export interface ApprovalActionState {
  error?: string;
}

async function requireActor() {
  const actor = await sessionActor();
  if (!actor) throw new PermissionError("expense.create");
  return actor;
}

export async function createApprovalAction(
  _prev: ApprovalActionState,
  formData: FormData,
): Promise<ApprovalActionState> {
  let approvalId: string;
  try {
    const actor = await requireActor();
    const amountRaw = String(formData.get("amount") ?? "").replaceAll(".", "");
    const approval = await createApproval(actor, {
      type: String(formData.get("type")) as ApprovalType,
      title: String(formData.get("title") ?? "").trim(),
      description: String(formData.get("description") ?? ""),
      amount: amountRaw ? Number(amountRaw) : undefined,
      divisionId: String(formData.get("divisionId")),
      eventId: String(formData.get("eventId") ?? "") || undefined,
    });
    approvalId = approval.id;
  } catch (error) {
    if (error instanceof PermissionError) return { error: "Not allowed." };
    if (error instanceof Error) return { error: error.message };
    throw error;
  }
  revalidatePath("/approvals");
  redirect(`/approvals/${approvalId}`);
}

export async function decideAction(
  _prev: ApprovalActionState,
  formData: FormData,
): Promise<ApprovalActionState> {
  try {
    const actor = await requireActor();
    const approvalId = String(formData.get("approvalId"));
    await decide(
      actor,
      approvalId,
      String(formData.get("decision")) as Decision,
      String(formData.get("comment") ?? ""),
    );
    revalidatePath("/approvals");
    revalidatePath(`/approvals/${approvalId}`);
    return {};
  } catch (error) {
    if (error instanceof PermissionError) return { error: "Not allowed." };
    if (error instanceof Error) return { error: error.message };
    throw error;
  }
}
