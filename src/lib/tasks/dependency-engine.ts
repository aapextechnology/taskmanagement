import { and, eq, inArray, isNull, notInArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  taskAssignees,
  taskDependencies,
  taskExternalDependencies,
  tasks,
} from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { notifyMany } from "@/lib/notifications";
import { bottleneckLevel, decideBump, type BottleneckLevel } from "./bottleneck-math";

// Dependency engine (EPIC-012). DB plumbing around the pure rules in
// bottleneck-math.ts: cycle detection, waiter counting, the auto-bump
// lifecycle, unblock notifications (internal + external), and the badge
// counts the boards render. No permission checks here — callers in
// service.ts gate first.

const CLOSED = ["done", "cancelled"] as const;

// ---- cycle detection ------------------------------------------------------

/** True if adding `taskId depends-on dependsOnTaskId` closes a cycle of ANY
 *  length, i.e. dependsOnTaskId already (transitively) depends on taskId. */
export async function wouldCreateCycle(
  taskId: string,
  dependsOnTaskId: string,
): Promise<boolean> {
  const visited = new Set<string>([dependsOnTaskId]);
  let frontier = [dependsOnTaskId];
  while (frontier.length > 0) {
    const edges = await db
      .select({ next: taskDependencies.dependsOnTaskId })
      .from(taskDependencies)
      .where(inArray(taskDependencies.taskId, frontier));
    frontier = [];
    for (const { next } of edges) {
      if (next === taskId) return true;
      if (!visited.has(next)) {
        visited.add(next);
        frontier.push(next);
      }
    }
  }
  return false;
}

// ---- waiter counting + auto-bump ------------------------------------------

async function countOpenWaiters(taskId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(taskDependencies)
    .innerJoin(tasks, eq(taskDependencies.taskId, tasks.id))
    .where(
      and(
        eq(taskDependencies.dependsOnTaskId, taskId),
        notInArray(tasks.status, [...CLOSED]),
      ),
    );
  return row?.count ?? 0;
}

export async function levelFor(task: {
  id: string;
  status: string;
  dueDate: Date | null;
}): Promise<{ level: BottleneckLevel; waiters: number }> {
  const closed = (CLOSED as readonly string[]).includes(task.status);
  const waiters = closed ? 0 : await countOpenWaiters(task.id);
  return {
    waiters,
    level: bottleneckLevel({
      openWaiters: waiters,
      overdue:
        !closed && task.dueDate !== null && task.dueDate.getTime() < Date.now(),
      blocked: task.status === "blocked",
    }),
  };
}

/** Re-evaluate ONE task as a (potential) bottleneck and apply the Owner's
 *  auto-bump/revert rules. Call whenever its waiter set or own state may
 *  have changed. Safe to call redundantly. */
export async function recomputeBottleneck(taskId: string): Promise<void> {
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  if (!task) return;

  const { level, waiters } = await levelFor(task);
  const action = decideBump(
    level,
    {
      priority: task.priority,
      priorityBeforeAuto: task.priorityBeforeAuto,
      autoUrgentAt: task.autoUrgentAt,
    },
    new Date(),
  );
  if (action.kind === "none") return;

  await db.update(tasks).set(action.set).where(eq(tasks.id, taskId));
  if (action.kind === "bump") {
    // the auto-escalation to urgent reaches the PIC on WhatsApp (T-151)
    const { notifyPriorityUrgent } = await import("./wa-notify");
    await notifyPriorityUrgent(taskId, {
      kind: "auto",
      waiters,
      overdue: task.dueDate !== null && task.dueDate.getTime() < Date.now(),
    }).catch((error) =>
      console.error("[bottleneck] urgent notice failed:", error),
    );
    await logActivity({
      actorId: null, // system actor — feed renders "System"
      action: "task.priority_auto_bump",
      entity: `task:${taskId}`,
      detail: { from: task.priority, to: "urgent", waiters, level },
      eventId: task.eventId,
    });
  } else if (action.kind === "revert") {
    await logActivity({
      actorId: null,
      action: "task.priority_auto_revert",
      entity: `task:${taskId}`,
      detail: { from: "urgent", to: action.set.priority, waiters },
      eventId: task.eventId,
    });
  }
  // "clear" is silent bookkeeping — the human's own edit is already logged
}

/** Hourly sweep (cron): overdue drifts in over time, so bottleneck levels
 *  can change with no mutation. Re-checks every task that is currently
 *  waited on plus every task still carrying an auto-bump. */
export async function sweepBottlenecks(): Promise<number> {
  const waited = await db
    .selectDistinct({ id: taskDependencies.dependsOnTaskId })
    .from(taskDependencies)
    .innerJoin(tasks, eq(taskDependencies.taskId, tasks.id))
    .where(notInArray(tasks.status, [...CLOSED]));
  const bumped = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(sql`${tasks.autoUrgentAt} is not null`);
  const ids = new Set([...waited.map((r) => r.id), ...bumped.map((r) => r.id)]);
  for (const id of ids) await recomputeBottleneck(id);
  return ids.size;
}

// ---- unblock (internal + external) ----------------------------------------

/** Notify assignees the moment the LAST gate opens: every internal blocker
 *  done AND every external dependency checked off. Dedup-keyed so repeated
 *  checks never double-send. */
export async function maybeNotifyUnblocked(taskId: string): Promise<void> {
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  if (!task || (CLOSED as readonly string[]).includes(task.status)) return;

  const blockers = await db
    .select({ status: tasks.status })
    .from(taskDependencies)
    .innerJoin(tasks, eq(taskDependencies.dependsOnTaskId, tasks.id))
    .where(eq(taskDependencies.taskId, taskId));
  if (blockers.length === 0) return; // never had internal deps — nothing to announce
  if (!blockers.every((b) => b.status === "done")) return;

  const [unresolvedExternal] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(taskExternalDependencies)
    .where(
      and(
        eq(taskExternalDependencies.taskId, taskId),
        isNull(taskExternalDependencies.resolvedAt),
      ),
    );
  if ((unresolvedExternal?.count ?? 0) > 0) return;

  const assignees = await db
    .select({ userId: taskAssignees.userId })
    .from(taskAssignees)
    .where(eq(taskAssignees.taskId, taskId));
  await notifyMany(
    assignees.map((a) => a.userId),
    {
      type: "unblocked",
      title: "Unblocked: all dependencies done",
      href: `/tasks/${taskId}`,
      dedupKeyFor: (userId) => `unblocked:${taskId}:${userId}`,
    },
  );
}

// ---- badge counts for boards / lists --------------------------------------

export interface DependencyBadge {
  /** open internal blockers + unresolved external deps this task waits on */
  waitingOn: number;
  /** open tasks waiting on this task */
  waiters: number;
  critical: boolean;
}

export async function getDependencyBadges(
  rows: Array<{ id: string; status: string; dueDate: Date | null }>,
): Promise<Map<string, DependencyBadge>> {
  const out = new Map<string, DependencyBadge>();
  if (rows.length === 0) return out;
  const ids = rows.map((r) => r.id);

  const [blockedBy, external, waitedOn] = await Promise.all([
    db
      .select({ taskId: taskDependencies.taskId, count: sql<number>`count(*)::int` })
      .from(taskDependencies)
      .innerJoin(tasks, eq(taskDependencies.dependsOnTaskId, tasks.id))
      .where(
        and(
          inArray(taskDependencies.taskId, ids),
          notInArray(tasks.status, [...CLOSED]),
        ),
      )
      .groupBy(taskDependencies.taskId),
    db
      .select({
        taskId: taskExternalDependencies.taskId,
        count: sql<number>`count(*)::int`,
      })
      .from(taskExternalDependencies)
      .where(
        and(
          inArray(taskExternalDependencies.taskId, ids),
          isNull(taskExternalDependencies.resolvedAt),
        ),
      )
      .groupBy(taskExternalDependencies.taskId),
    db
      .select({
        taskId: taskDependencies.dependsOnTaskId,
        count: sql<number>`count(*)::int`,
      })
      .from(taskDependencies)
      .innerJoin(tasks, eq(taskDependencies.taskId, tasks.id))
      .where(
        and(
          inArray(taskDependencies.dependsOnTaskId, ids),
          notInArray(tasks.status, [...CLOSED]),
        ),
      )
      .groupBy(taskDependencies.dependsOnTaskId),
  ]);

  const blockedByMap = new Map(blockedBy.map((r) => [r.taskId, r.count]));
  const externalMap = new Map(external.map((r) => [r.taskId, r.count]));
  const waitersMap = new Map(waitedOn.map((r) => [r.taskId, r.count]));
  const now = Date.now();

  for (const row of rows) {
    const closed = (CLOSED as readonly string[]).includes(row.status);
    const waiters = closed ? 0 : (waitersMap.get(row.id) ?? 0);
    const waitingOn = closed
      ? 0
      : (blockedByMap.get(row.id) ?? 0) + (externalMap.get(row.id) ?? 0);
    if (waiters === 0 && waitingOn === 0) continue;
    out.set(row.id, {
      waitingOn,
      waiters,
      critical:
        bottleneckLevel({
          openWaiters: waiters,
          overdue: !closed && row.dueDate !== null && row.dueDate.getTime() < now,
          blocked: row.status === "blocked",
        }) === "critical",
    });
  }
  return out;
}
