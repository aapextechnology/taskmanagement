import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  appSettings,
  approvals,
  approvalSteps,
  divisionMembers,
  profiles,
} from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { notify, notifyMany } from "@/lib/notifications";
import {
  assertCan,
  canDecideApprovalStep,
  PermissionError,
  type Actor,
  type ApprovalStepRole,
} from "@/lib/permissions";
import { resolveChain, type ApprovalType, type Thresholds } from "./chains";

// Approvals service (T-041/T-043). Chain is resolved at creation and stored
// as immutable steps; decisions only ever move the current step forward.

export async function getThresholds(): Promise<Thresholds & { currency: string }> {
  const rows = await db
    .select()
    .from(appSettings)
    .where(
      inArray(appSettings.key, [
        "approval_threshold_a",
        "approval_threshold_b",
        "currency",
      ]),
    );
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  return {
    a: Number(byKey.get("approval_threshold_a") ?? 10_000_000),
    b: Number(byKey.get("approval_threshold_b") ?? 100_000_000),
    currency: String(byKey.get("currency") ?? "IDR").replaceAll('"', ""),
  };
}

// users who may decide a given step — for notifications
async function approverUserIds(
  stepRole: ApprovalStepRole,
  originDivisionId: string,
): Promise<string[]> {
  if (stepRole === "owner") {
    const owners = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.role, "owner"));
    return owners.map((o) => o.id);
  }
  const divisionByRole: Partial<Record<ApprovalStepRole, string>> = {
    division_head: originDivisionId,
    finance: "finance",
    legal: "legal-licensing",
    sponsorship_head: "sponsorship-partnership",
    marketing_head: "marketing-communications",
    talent_head: "talent-booking",
  };
  const divisionId = divisionByRole[stepRole];
  if (!divisionId) return [];
  const heads = await db
    .select({ id: divisionMembers.userId })
    .from(divisionMembers)
    .where(
      and(
        eq(divisionMembers.divisionId, divisionId),
        eq(divisionMembers.role, "head"),
      ),
    );
  return heads.map((h) => h.id);
}

async function notifyStepApprovers(
  approvalId: string,
  title: string,
  stepRole: ApprovalStepRole,
  originDivisionId: string,
) {
  const userIds = await approverUserIds(stepRole, originDivisionId);
  await notifyMany(userIds, {
    type: "approval_requested",
    title: `Approval needed: ${title}`,
    href: `/approvals/${approvalId}`,
  });
}

export async function createApproval(
  actor: Actor,
  input: {
    type: ApprovalType;
    title: string;
    description?: string;
    amount?: number;
    divisionId: string;
    eventId?: string;
  },
) {
  // any internal member submits from their own division (owner/admin anywhere)
  assertCan(actor, "expense.create", { divisionId: input.divisionId });

  const thresholds = await getThresholds();
  const chain = resolveChain(input.type, input.amount ?? null, thresholds);

  const [approval] = await db
    .insert(approvals)
    .values({
      type: input.type,
      title: input.title.trim(),
      description: input.description?.trim() ?? "",
      amount: input.amount ?? null,
      currency: thresholds.currency,
      divisionId: input.divisionId,
      eventId: input.eventId ?? null,
      requestedBy: actor.id,
    })
    .returning();

  await db.insert(approvalSteps).values(
    chain.map((approverRole, index) => ({
      approvalId: approval.id,
      index,
      approverRole,
      status: index === 0 ? ("pending" as const) : ("waiting" as const),
    })),
  );

  await notifyStepApprovers(approval.id, approval.title, chain[0], input.divisionId);
  await logActivity({
    actorId: actor.id,
    action: "approval.create",
    entity: `approval:${approval.id}`,
    detail: { type: input.type, amount: input.amount ?? null, chain },
    eventId: input.eventId,
  });
  return approval;
}

export type Decision = "approved" | "rejected" | "changes_requested";

export async function decide(
  actor: Actor,
  approvalId: string,
  decision: Decision,
  comment: string,
) {
  const [approval] = await db
    .select()
    .from(approvals)
    .where(eq(approvals.id, approvalId))
    .limit(1);
  if (!approval || approval.status !== "pending") {
    throw new Error("Approval not found or already decided.");
  }
  if (decision !== "approved" && !comment.trim()) {
    throw new Error("A comment is required when not approving.");
  }

  const [step] = await db
    .select()
    .from(approvalSteps)
    .where(
      and(
        eq(approvalSteps.approvalId, approvalId),
        eq(approvalSteps.index, approval.currentStepIndex),
      ),
    )
    .limit(1);
  if (!step || step.status !== "pending") {
    throw new Error("No pending step to decide.");
  }
  if (
    !canDecideApprovalStep(
      actor,
      step.approverRole as ApprovalStepRole,
      approval.divisionId,
    )
  ) {
    throw new PermissionError("approve.tier1");
  }

  await db
    .update(approvalSteps)
    .set({
      status: decision,
      decidedBy: actor.id,
      comment: comment.trim(),
      decidedAt: new Date(),
    })
    .where(eq(approvalSteps.id, step.id));

  let finalStatus: Decision | "pending" = "pending";
  if (decision === "approved") {
    const [nextStep] = await db
      .select()
      .from(approvalSteps)
      .where(
        and(
          eq(approvalSteps.approvalId, approvalId),
          eq(approvalSteps.index, approval.currentStepIndex + 1),
        ),
      )
      .limit(1);
    if (nextStep) {
      await db
        .update(approvalSteps)
        .set({ status: "pending" })
        .where(eq(approvalSteps.id, nextStep.id));
      await db
        .update(approvals)
        .set({ currentStepIndex: approval.currentStepIndex + 1 })
        .where(eq(approvals.id, approvalId));
      await notifyStepApprovers(
        approvalId,
        approval.title,
        nextStep.approverRole as ApprovalStepRole,
        approval.divisionId,
      );
    } else {
      finalStatus = "approved";
    }
  } else {
    finalStatus = decision; // rejected / changes_requested are terminal
  }

  if (finalStatus !== "pending") {
    await db
      .update(approvals)
      .set({ status: finalStatus, decidedAt: new Date() })
      .where(eq(approvals.id, approvalId));
    if (approval.type === "expense") {
      // lazy import avoids a static service cycle (budgets → approvals)
      const { syncExpenseWithApproval } = await import("@/lib/budgets/service");
      await syncExpenseWithApproval(approvalId, finalStatus);
    }
    await notify({
      userId: approval.requestedBy,
      type: "approval_decided",
      title: `${
        finalStatus === "approved"
          ? "Approved"
          : finalStatus === "rejected"
            ? "Rejected"
            : "Changes requested"
      }: ${approval.title}`,
      href: `/approvals/${approvalId}`,
    });
  }

  await logActivity({
    actorId: actor.id,
    action: `approval.${decision}`,
    entity: `approval:${approvalId}`,
    detail: { stepIndex: step.index, stepRole: step.approverRole },
    eventId: approval.eventId ?? undefined,
  });
}

// ---- queries --------------------------------------------------------------

export async function listMyQueue(actor: Actor) {
  const pending = await db
    .select()
    .from(approvals)
    .where(eq(approvals.status, "pending"))
    .orderBy(asc(approvals.createdAt));
  if (pending.length === 0) return [];

  const steps = await db
    .select()
    .from(approvalSteps)
    .where(
      and(
        inArray(approvalSteps.approvalId, pending.map((a) => a.id)),
        eq(approvalSteps.status, "pending"),
      ),
    );
  const stepByApproval = new Map(steps.map((s) => [s.approvalId, s]));

  return pending.filter((a) => {
    const step = stepByApproval.get(a.id);
    return (
      step !== undefined &&
      canDecideApprovalStep(
        actor,
        step.approverRole as ApprovalStepRole,
        a.divisionId,
      )
    );
  });
}

export async function listMyRequests(actor: Actor) {
  return db
    .select()
    .from(approvals)
    .where(eq(approvals.requestedBy, actor.id))
    .orderBy(desc(approvals.createdAt));
}

export async function getApprovalDetail(actor: Actor, approvalId: string) {
  const [approval] = await db
    .select()
    .from(approvals)
    .where(eq(approvals.id, approvalId))
    .limit(1);
  if (!approval) return null;

  const steps = await db
    .select({ step: approvalSteps, deciderName: profiles.name })
    .from(approvalSteps)
    .leftJoin(profiles, eq(approvalSteps.decidedBy, profiles.id))
    .where(eq(approvalSteps.approvalId, approvalId))
    .orderBy(asc(approvalSteps.index));

  const [requester] = await db
    .select({ name: profiles.name })
    .from(profiles)
    .where(eq(profiles.id, approval.requestedBy))
    .limit(1);

  const isRequester = approval.requestedBy === actor.id;
  const isApprover = steps.some((s) =>
    canDecideApprovalStep(
      actor,
      s.step.approverRole as ApprovalStepRole,
      approval.divisionId,
    ),
  );
  const isOwnerOrAdmin = actor.role === "owner" || actor.role === "admin";
  if (!isRequester && !isApprover && !isOwnerOrAdmin) return null;

  const canDecideNow =
    approval.status === "pending" &&
    steps.some(
      (s) =>
        s.step.status === "pending" &&
        canDecideApprovalStep(
          actor,
          s.step.approverRole as ApprovalStepRole,
          approval.divisionId,
        ),
    );

  return {
    ...approval,
    requesterName: requester?.name ?? "Unknown",
    steps,
    canDecideNow,
  };
}
