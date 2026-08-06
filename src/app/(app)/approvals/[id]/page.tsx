import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { APPROVER_LABELS } from "@/lib/approvals/chains";
import { getApprovalDetail } from "@/lib/approvals/service";
import { sessionActor } from "@/lib/auth/session-actor";
import { cn } from "@/lib/utils";
import { APPROVAL_STATUS_META, formatIDR, TYPE_LABELS } from "../shared";
import { DecideForm } from "./decide-form";

export const metadata: Metadata = { title: "Approval" };

const dt = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

const STEP_DOT: Record<string, string> = {
  waiting: "bg-muted-foreground/30",
  pending: "bg-status-in-progress",
  approved: "bg-status-done",
  rejected: "bg-status-blocked",
  changes_requested: "bg-status-in-review",
};

export default async function ApprovalDetailPage({
  params,
}: PageProps<"/approvals/[id]">) {
  const actor = await sessionActor();
  if (!actor) redirect("/login");

  const { id } = await params;
  const approval = await getApprovalDetail(actor, id);
  if (!approval) notFound();

  const meta = APPROVAL_STATUS_META[approval.status];

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Link
          href="/approvals"
          className="text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          ← Approvals
        </Link>
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-semibold leading-tight tracking-tight">
            {approval.title}
          </h1>
          <span className={cn("text-sm font-medium", meta.className)}>
            {meta.label}
          </span>
        </div>
        <p className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="rounded-sm border px-1.5 py-0.5 uppercase tracking-wider">
            {TYPE_LABELS[approval.type]}
          </span>
          <span>{approval.divisionId}</span>
          {approval.amount !== null ? (
            <span className="tabular-nums">{formatIDR(approval.amount)}</span>
          ) : null}
          <span>
            by {approval.requesterName} · {dt.format(approval.createdAt)} WIB
          </span>
        </p>
        {approval.description ? (
          <p className="whitespace-pre-wrap pt-2 text-sm text-muted-foreground">
            {approval.description}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider">
          Approval chain
        </h2>
        <ol className="flex flex-col gap-0">
          {approval.steps.map(({ step, deciderName }, index) => (
            <li key={step.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    "mt-1 size-2.5 rounded-full",
                    STEP_DOT[step.status],
                  )}
                />
                {index < approval.steps.length - 1 ? (
                  <span className="w-px flex-1 bg-border" />
                ) : null}
              </div>
              <div className="flex flex-1 flex-col gap-0.5 pb-6">
                <span className="text-sm font-medium">
                  {APPROVER_LABELS[step.approverRole as keyof typeof APPROVER_LABELS]}
                </span>
                <span className="text-xs text-muted-foreground">
                  {step.status === "waiting"
                    ? "Waiting"
                    : step.status === "pending"
                      ? "Awaiting decision"
                      : `${APPROVAL_STATUS_META[step.status]?.label ?? step.status}${
                          deciderName ? ` by ${deciderName}` : ""
                        }${step.decidedAt ? ` · ${dt.format(step.decidedAt)} WIB` : ""}`}
                </span>
                {step.comment ? (
                  <p className="mt-1 rounded-md border bg-muted/40 px-3 py-2 text-xs">
                    {step.comment}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </div>

      {approval.canDecideNow ? <DecideForm approvalId={approval.id} /> : null}
    </section>
  );
}
