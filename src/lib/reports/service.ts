import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  approvals,
  divisions,
  externalInvites,
  formSubmissions,
  handoffs,
  profiles,
  runOfShowItems,
  taskAssignees,
  taskChecklistItems,
  tasks,
} from "@/db/schema";
import { eventBudgetRollup } from "@/lib/budgets/service";
import { getEvent, listPhases } from "@/lib/events/service";
import { assertCan, type Actor } from "@/lib/permissions";
import { summarizeStatuses } from "@/lib/tasks/progress";
import { STATUS_LABELS, type TaskStatus } from "@/lib/tasks/service";

// Event progress report data (Owner request 2026-08-06): one comprehensive
// snapshot for the Owner's review, downloaded as PDF by owner/admin.

export interface EventReport {
  generatedAt: Date;
  generatedBy: string;
  /** installation branding, e.g. "Acme Backstage" */
  brandName: string;
  event: {
    name: string;
    artists: string;
    venue: string;
    showDate: Date;
    daysToShow: number;
    health: string;
    phaseName: string;
    phaseIndex: number;
    phaseTotal: number;
  };
  tasks: {
    total: number;
    done: number;
    /** the completion denominator: total minus backlog and cancelled */
    committed: number;
    backlog: number;
    /** null when nothing is committed yet */
    completionPct: number | null;
    byStatus: Array<{ label: string; count: number }>;
    byDivision: Array<{
      division: string;
      total: number;
      done: number;
      overdue: number;
    }>;
    overdue: Array<{
      title: string;
      division: string;
      dueDate: Date;
      assignees: string;
    }>;
    checklist: { total: number; done: number };
  };
  budget: {
    planned: number;
    committed: number;
    actual: number;
    remaining: number;
    burnPct: number | null;
    lines: Array<{
      division: string;
      name: string;
      planned: number;
      committed: number;
      actual: number;
    }>;
  };
  approvals: {
    pending: number;
    approved: number;
    rejected: number;
    changesRequested: number;
    pendingItems: Array<{ title: string; type: string; amount: number | null }>;
  };
  handoffs: { pending: number; accepted: number; declined: number };
  guests: {
    activeInvites: number;
    submissionsByStatus: Array<{ label: string; count: number }>;
  };
  runOfShow: { items: number; first: string | null; last: string | null };
}

const STATUS_ORDER: TaskStatus[] = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "blocked",
  "done",
  "cancelled",
];

export async function gatherEventReport(
  actor: Actor,
  eventId: string,
): Promise<EventReport | null> {
  // the Owner-review report is an owner/admin surface (same gate as the
  // executive dashboard)
  assertCan(actor, "dashboard.view");

  const event = await getEvent(actor, eventId);
  if (!event) return null;
  const phases = await listPhases(actor, eventId);
  const phaseIndex = phases.findIndex((p) => p.id === event.currentPhaseId);

  const [me] = await db
    .select({ name: profiles.name })
    .from(profiles)
    .where(eq(profiles.id, actor.id))
    .limit(1);

  // ---- tasks --------------------------------------------------------------
  const taskRows = await db
    .select({ task: tasks, divisionName: divisions.name })
    .from(tasks)
    .innerJoin(divisions, eq(tasks.divisionId, divisions.id))
    .where(eq(tasks.eventId, eventId))
    .orderBy(asc(tasks.dueDate));

  const now = new Date();
  const isOverdue = (t: (typeof taskRows)[number]["task"]) =>
    t.status !== "done" &&
    t.status !== "cancelled" &&
    t.dueDate !== null &&
    t.dueDate < now;

  const byStatus = STATUS_ORDER.map((status) => ({
    label: STATUS_LABELS[status],
    count: taskRows.filter((r) => r.task.status === status).length,
  })).filter((s) => s.count > 0);

  const divisionNames = [...new Set(taskRows.map((r) => r.divisionName))];
  const byDivision = divisionNames.map((division) => {
    const rows = taskRows.filter((r) => r.divisionName === division);
    return {
      division,
      total: rows.length,
      done: rows.filter((r) => r.task.status === "done").length,
      overdue: rows.filter((r) => isOverdue(r.task)).length,
    };
  });

  const overdueRows = taskRows.filter((r) => isOverdue(r.task));
  const overdueIds = overdueRows.map((r) => r.task.id);
  const assigneeRows =
    overdueIds.length === 0
      ? []
      : await db
          .select({
            taskId: taskAssignees.taskId,
            name: profiles.name,
          })
          .from(taskAssignees)
          .innerJoin(profiles, eq(taskAssignees.userId, profiles.id))
          .where(inArray(taskAssignees.taskId, overdueIds));
  const assigneesByTask = new Map<string, string[]>();
  for (const row of assigneeRows) {
    assigneesByTask.set(row.taskId, [
      ...(assigneesByTask.get(row.taskId) ?? []),
      row.name,
    ]);
  }

  const allTaskIds = taskRows.map((r) => r.task.id);
  const checklistRows =
    allTaskIds.length === 0
      ? []
      : await db
          .select({ done: taskChecklistItems.done })
          .from(taskChecklistItems)
          .where(inArray(taskChecklistItems.taskId, allTaskIds));

  // same rule as the dashboard card — see src/lib/tasks/progress.ts. Shared
  // so an event can never report two different completion figures.
  const progress = summarizeStatuses(taskRows.map((r) => r.task.status));

  // ---- budget -------------------------------------------------------------
  const rollup = await eventBudgetRollup(actor, eventId);
  const remaining =
    rollup.totals.planned - rollup.totals.committed - rollup.totals.actual;
  const burn = rollup.totals.committed + rollup.totals.actual;

  // ---- approvals ----------------------------------------------------------
  const approvalRows = await db
    .select()
    .from(approvals)
    .where(eq(approvals.eventId, eventId));
  const approvalCount = (status: string) =>
    approvalRows.filter((a) => a.status === status).length;

  // ---- handoffs -----------------------------------------------------------
  const handoffRows = await db
    .select({ status: handoffs.status })
    .from(handoffs)
    .where(eq(handoffs.eventId, eventId));
  const handoffCount = (status: string) =>
    handoffRows.filter((h) => h.status === status).length;

  // ---- guests -------------------------------------------------------------
  const inviteRows = await db
    .select()
    .from(externalInvites)
    .where(eq(externalInvites.eventId, eventId));
  const submissionRows = await db
    .select({ status: formSubmissions.status })
    .from(formSubmissions)
    .where(
      and(
        eq(formSubmissions.eventId, eventId),
        inArray(formSubmissions.status, [
          "submitted",
          "accepted",
          "changes_requested",
        ]),
      ),
    );
  const submissionLabel: Record<string, string> = {
    submitted: "Awaiting review",
    accepted: "Accepted",
    changes_requested: "Changes requested",
  };
  const submissionsByStatus = Object.entries(submissionLabel)
    .map(([status, label]) => ({
      label,
      count: submissionRows.filter((s) => s.status === status).length,
    }))
    .filter((s) => s.count > 0);

  // ---- run of show --------------------------------------------------------
  const rosRows = await db
    .select({ startTime: runOfShowItems.startTime })
    .from(runOfShowItems)
    .where(eq(runOfShowItems.eventId, eventId))
    .orderBy(asc(runOfShowItems.startTime));

  return {
    generatedAt: now,
    brandName: await (async () => {
      const { getBranding, fullName } = await import("@/lib/org/branding");
      return fullName(await getBranding());
    })(),
    generatedBy: me?.name ?? "Unknown",
    event: {
      name: event.name,
      artists: event.artists,
      venue: event.venue,
      showDate: event.showDate,
      daysToShow: Math.ceil(
        (event.showDate.getTime() - now.getTime()) / 86_400_000,
      ),
      health: event.health,
      phaseName: event.phaseName,
      phaseIndex: phaseIndex >= 0 ? phaseIndex + 1 : 0,
      phaseTotal: phases.length,
    },
    tasks: {
      total: taskRows.length,
      done: progress.done,
      committed: progress.committed,
      backlog: progress.backlog,
      completionPct: progress.pct,
      byStatus,
      byDivision,
      overdue: overdueRows.map((r) => ({
        title: r.task.title,
        division: r.divisionName,
        dueDate: r.task.dueDate!,
        assignees: (assigneesByTask.get(r.task.id) ?? []).join(", ") || "—",
      })),
      checklist: {
        total: checklistRows.length,
        done: checklistRows.filter((c) => c.done).length,
      },
    },
    budget: {
      planned: rollup.totals.planned,
      committed: rollup.totals.committed,
      actual: rollup.totals.actual,
      remaining,
      burnPct:
        rollup.totals.planned > 0
          ? Math.round((burn / rollup.totals.planned) * 100)
          : null,
      lines: rollup.lines.map((line) => ({
        division: line.divisionName,
        name: line.name,
        planned: line.planned,
        committed: line.committed,
        actual: line.actual,
      })),
    },
    approvals: {
      pending: approvalCount("pending"),
      approved: approvalCount("approved"),
      rejected: approvalCount("rejected"),
      changesRequested: approvalCount("changes_requested"),
      pendingItems: approvalRows
        .filter((a) => a.status === "pending")
        .map((a) => ({ title: a.title, type: a.type, amount: a.amount })),
    },
    handoffs: {
      pending: handoffCount("pending"),
      accepted: handoffCount("accepted"),
      declined: handoffCount("declined"),
    },
    guests: {
      activeInvites: inviteRows.filter(
        (i) => i.revokedAt === null && i.expiresAt >= now,
      ).length,
      submissionsByStatus,
    },
    runOfShow: {
      items: rosRows.length,
      first: rosRows[0]?.startTime ?? null,
      last: rosRows.at(-1)?.startTime ?? null,
    },
  };
}
