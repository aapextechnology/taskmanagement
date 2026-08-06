import { and, asc, eq, inArray, isNull, lt, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  attachments,
  comments,
  divisionMembers,
  events,
  handoffs,
  labels,
  profiles,
  savedFilters,
  taskAssignees,
  taskChecklistItems,
  taskDependencies,
  taskLabels,
  tasks,
  taskWatchers,
} from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { recomputeEventHealth } from "@/lib/events/service";
import { notify, notifyMany } from "@/lib/notifications";
import {
  assertCan,
  can,
  PermissionError,
  type Actor,
} from "@/lib/permissions";
import { nextRecurrenceDate } from "./dates";

// Task service (T-031..T-037). THE rule: every read/write resolves the task,
// derives {divisionId, isAssigned}, and goes through the permission module.

export type TaskStatus =
  | "backlog"
  | "todo"
  | "in_progress"
  | "in_review"
  | "blocked"
  | "done"
  | "cancelled";

export const TASK_STATUS_ORDER: TaskStatus[] = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "blocked",
  "done",
  "cancelled",
];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: "Backlog",
  todo: "To do",
  in_progress: "In progress",
  in_review: "In review",
  blocked: "Blocked",
  done: "Done",
  cancelled: "Cancelled",
};

// ---- scoped fetch ---------------------------------------------------------

export async function getTaskScoped(actor: Actor, taskId: string) {
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  if (!task) return null;

  const assigneeRows = await db
    .select({ userId: taskAssignees.userId })
    .from(taskAssignees)
    .where(eq(taskAssignees.taskId, taskId));
  const isAssigned = assigneeRows.some((a) => a.userId === actor.id);

  const visible =
    can(actor, "task.viewDivision", { divisionId: task.divisionId }) ||
    (isAssigned && can(actor, "task.updateAssigned", { isAssigned }));
  if (!visible) return null;

  return { ...task, assigneeIds: assigneeRows.map((a) => a.userId), isAssigned };
}

async function requireTask(actor: Actor, taskId: string) {
  const task = await getTaskScoped(actor, taskId);
  if (!task) throw new PermissionError("task.viewDivision");
  return task;
}

function canMutate(actor: Actor, task: { divisionId: string; isAssigned: boolean }) {
  return (
    can(actor, "task.edit", { divisionId: task.divisionId }) ||
    can(actor, "task.updateAssigned", { isAssigned: task.isAssigned })
  );
}

// ---- queries --------------------------------------------------------------

export async function listBoardTasks(
  actor: Actor,
  eventId: string,
  divisionId: string,
) {
  assertCan(actor, "task.viewDivision", { divisionId });
  const rows = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.eventId, eventId), eq(tasks.divisionId, divisionId)))
    .orderBy(asc(tasks.dueDate), asc(tasks.createdAt));
  return withLabels(await withAssignees(rows));
}

async function withLabels<T extends { id: string }>(rows: T[]) {
  if (rows.length === 0)
    return [] as Array<T & { labels: Array<{ id: string; name: string; color: string }> }>;
  const links = await db
    .select({
      taskId: taskLabels.taskId,
      id: labels.id,
      name: labels.name,
      color: labels.color,
    })
    .from(taskLabels)
    .innerJoin(labels, eq(taskLabels.labelId, labels.id))
    .where(inArray(taskLabels.taskId, rows.map((r) => r.id)));
  const byTask = new Map<string, Array<{ id: string; name: string; color: string }>>();
  for (const l of links) {
    const list = byTask.get(l.taskId) ?? [];
    list.push({ id: l.id, name: l.name, color: l.color });
    byTask.set(l.taskId, list);
  }
  return rows.map((r) => ({ ...r, labels: byTask.get(r.id) ?? [] }));
}

export async function listLabels() {
  return db.select().from(labels).orderBy(asc(labels.name));
}

export interface ListFilters {
  status?: TaskStatus;
  priority?: "low" | "medium" | "high" | "urgent";
  divisionId?: string;
  assigneeId?: string;
}

export async function listEventTasks(
  actor: Actor,
  eventId: string,
  filters: ListFilters = {},
) {
  // visible divisions: owner/admin see all; members see their divisions
  const visibleDivisions =
    actor.role === "owner" || actor.role === "admin"
      ? null
      : actor.memberships.map((m) => m.divisionId);
  if (visibleDivisions !== null && visibleDivisions.length === 0) return [];

  const conditions = [eq(tasks.eventId, eventId)];
  if (visibleDivisions) conditions.push(inArray(tasks.divisionId, visibleDivisions));
  if (filters.divisionId) {
    assertCan(actor, "task.viewDivision", { divisionId: filters.divisionId });
    conditions.push(eq(tasks.divisionId, filters.divisionId));
  }
  if (filters.status) conditions.push(eq(tasks.status, filters.status));
  if (filters.priority) conditions.push(eq(tasks.priority, filters.priority));

  let rows = await db
    .select()
    .from(tasks)
    .where(and(...conditions))
    .orderBy(asc(tasks.dueDate), asc(tasks.createdAt));

  if (filters.assigneeId) {
    const assigned = await db
      .select({ taskId: taskAssignees.taskId })
      .from(taskAssignees)
      .where(eq(taskAssignees.userId, filters.assigneeId));
    const ids = new Set(assigned.map((a) => a.taskId));
    rows = rows.filter((r) => ids.has(r.id));
  }
  return withLabels(await withAssignees(rows));
}

export async function listMyTasks(actor: Actor) {
  const rows = await db
    .select({ task: tasks, eventName: events.name })
    .from(taskAssignees)
    .innerJoin(tasks, eq(taskAssignees.taskId, tasks.id))
    .innerJoin(events, eq(tasks.eventId, events.id))
    .where(and(eq(taskAssignees.userId, actor.id), ne(tasks.status, "done")))
    .orderBy(asc(tasks.dueDate));
  return rows;
}

async function withAssignees<T extends { id: string }>(rows: T[]) {
  if (rows.length === 0) return [] as Array<T & { assignees: Array<{ id: string; name: string }> }>;
  const links = await db
    .select({
      taskId: taskAssignees.taskId,
      id: profiles.id,
      name: profiles.name,
    })
    .from(taskAssignees)
    .innerJoin(profiles, eq(taskAssignees.userId, profiles.id))
    .where(inArray(taskAssignees.taskId, rows.map((r) => r.id)));
  const byTask = new Map<string, Array<{ id: string; name: string }>>();
  for (const l of links) {
    const list = byTask.get(l.taskId) ?? [];
    list.push({ id: l.id, name: l.name });
    byTask.set(l.taskId, list);
  }
  return rows.map((r) => ({ ...r, assignees: byTask.get(r.id) ?? [] }));
}

// ---- mutations ------------------------------------------------------------

export async function createTask(
  actor: Actor,
  input: {
    eventId: string;
    divisionId: string;
    title: string;
    description?: string;
    priority?: "low" | "medium" | "high" | "urgent";
    startDate?: Date;
    dueDate?: Date;
    recurrence?: "none" | "daily" | "weekly" | "monthly";
    assigneeIds?: string[];
    labelIds?: string[];
    newLabel?: { name: string; color: string };
  },
) {
  assertCan(actor, "task.create", { divisionId: input.divisionId });
  const [task] = await db
    .insert(tasks)
    .values({
      eventId: input.eventId,
      divisionId: input.divisionId,
      title: input.title.trim(),
      description: input.description?.trim() ?? "",
      priority: input.priority ?? "medium",
      startDate: input.startDate ?? null,
      dueDate: input.dueDate ?? null,
      recurrence: input.recurrence ?? "none",
      createdBy: actor.id,
    })
    .returning();

  for (const userId of input.assigneeIds ?? []) {
    await assignUser(actor, task.id, userId, { skipFetch: task });
  }

  const labelIds = [...(input.labelIds ?? [])];
  if (input.newLabel?.name.trim()) {
    const label = await ensureLabel(input.newLabel.name, input.newLabel.color);
    labelIds.push(label.id);
  }
  if (labelIds.length > 0) {
    await db
      .insert(taskLabels)
      .values(labelIds.map((labelId) => ({ taskId: task.id, labelId })))
      .onConflictDoNothing();
  }

  await logActivity({
    actorId: actor.id,
    action: "task.create",
    entity: `task:${task.id}`,
    detail: { title: task.title, divisionId: task.divisionId },
    eventId: task.eventId,
  });
  await recomputeEventHealth(task.eventId);
  return task;
}

export async function updateTaskFields(
  actor: Actor,
  taskId: string,
  fields: Partial<{
    title: string;
    description: string;
    priority: "low" | "medium" | "high" | "urgent";
    startDate: Date | null;
    dueDate: Date | null;
    recurrence: "none" | "daily" | "weekly" | "monthly";
  }>,
) {
  const task = await requireTask(actor, taskId);
  assertCan(actor, "task.edit", { divisionId: task.divisionId });
  await db
    .update(tasks)
    .set({ ...fields, updatedAt: new Date() })
    .where(eq(tasks.id, taskId));
  await logActivity({
    actorId: actor.id,
    action: "task.update",
    entity: `task:${taskId}`,
    detail: { fields: Object.keys(fields) },
    eventId: task.eventId,
  });
  await recomputeEventHealth(task.eventId);
}

export async function updateStatus(
  actor: Actor,
  taskId: string,
  status: TaskStatus,
) {
  const task = await requireTask(actor, taskId);
  if (!canMutate(actor, task)) throw new PermissionError("task.updateAssigned");

  const done = status === "done";
  await db
    .update(tasks)
    .set({
      status,
      completedAt: done ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, taskId));

  await logActivity({
    actorId: actor.id,
    action: "task.status",
    entity: `task:${taskId}`,
    detail: { from: task.status, to: status },
    eventId: task.eventId,
  });

  if (done && task.status !== "done") {
    await onTaskCompleted(task);
  }
  await recomputeEventHealth(task.eventId);
}

async function onTaskCompleted(task: {
  id: string;
  eventId: string;
  divisionId: string;
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "urgent";
  recurrence: "none" | "daily" | "weekly" | "monthly";
  dueDate: Date | null;
  assigneeIds: string[];
}) {
  // recurrence: spawn exactly one next instance
  const nextDue = task.dueDate
    ? nextRecurrenceDate(task.dueDate, task.recurrence)
    : null;
  if (task.recurrence !== "none" && nextDue) {
    const [next] = await db
      .insert(tasks)
      .values({
        eventId: task.eventId,
        divisionId: task.divisionId,
        title: task.title,
        description: task.description,
        priority: task.priority,
        recurrence: task.recurrence,
        dueDate: nextDue,
        status: "todo",
      })
      .returning();
    if (task.assigneeIds.length > 0) {
      await db
        .insert(taskAssignees)
        .values(task.assigneeIds.map((userId) => ({ taskId: next.id, userId })))
        .onConflictDoNothing();
    }
  }

  // unblock: dependents whose blockers are now ALL done
  const dependents = await db
    .select({ taskId: taskDependencies.taskId })
    .from(taskDependencies)
    .where(eq(taskDependencies.dependsOnTaskId, task.id));
  for (const dep of dependents) {
    const blockers = await db
      .select({ status: tasks.status })
      .from(taskDependencies)
      .innerJoin(tasks, eq(taskDependencies.dependsOnTaskId, tasks.id))
      .where(eq(taskDependencies.taskId, dep.taskId));
    if (blockers.every((b) => b.status === "done")) {
      const assignees = await db
        .select({ userId: taskAssignees.userId })
        .from(taskAssignees)
        .where(eq(taskAssignees.taskId, dep.taskId));
      await notifyMany(
        assignees.map((a) => a.userId),
        {
          type: "unblocked",
          title: `Unblocked: all dependencies done`,
          href: `/tasks/${dep.taskId}`,
        },
      );
    }
  }
}

export async function assignUser(
  actor: Actor,
  taskId: string,
  userId: string,
  opts: { skipFetch?: { divisionId: string; eventId: string } } = {},
) {
  const task = opts.skipFetch ?? (await requireTask(actor, taskId));
  assertCan(actor, "task.assign", { divisionId: task.divisionId });
  await db
    .insert(taskAssignees)
    .values({ taskId, userId })
    .onConflictDoNothing();
  if (userId !== actor.id) {
    await notify({
      userId,
      type: "assigned",
      title: "You were assigned a task",
      href: `/tasks/${taskId}`,
    });
  }
  await logActivity({
    actorId: actor.id,
    action: "task.assign",
    entity: `task:${taskId}`,
    detail: { userId },
    eventId: task.eventId,
  });
}

export async function unassignUser(actor: Actor, taskId: string, userId: string) {
  const task = await requireTask(actor, taskId);
  assertCan(actor, "task.assign", { divisionId: task.divisionId });
  await db
    .delete(taskAssignees)
    .where(and(eq(taskAssignees.taskId, taskId), eq(taskAssignees.userId, userId)));
}

export async function toggleWatch(actor: Actor, taskId: string) {
  await requireTask(actor, taskId);
  const [existing] = await db
    .select()
    .from(taskWatchers)
    .where(and(eq(taskWatchers.taskId, taskId), eq(taskWatchers.userId, actor.id)))
    .limit(1);
  if (existing) {
    await db
      .delete(taskWatchers)
      .where(and(eq(taskWatchers.taskId, taskId), eq(taskWatchers.userId, actor.id)));
  } else {
    await db.insert(taskWatchers).values({ taskId, userId: actor.id });
  }
}

// ---- checklist ------------------------------------------------------------

export async function addChecklistItem(actor: Actor, taskId: string, title: string) {
  const task = await requireTask(actor, taskId);
  if (!canMutate(actor, task)) throw new PermissionError("task.edit");
  const [{ max }] = await db
    .select({ max: sql<number>`coalesce(max(sort_order), 0)::int` })
    .from(taskChecklistItems)
    .where(eq(taskChecklistItems.taskId, taskId));
  await db
    .insert(taskChecklistItems)
    .values({ taskId, title: title.trim(), sortOrder: max + 1 });
}

export async function toggleChecklistItem(actor: Actor, itemId: string) {
  const [item] = await db
    .select()
    .from(taskChecklistItems)
    .where(eq(taskChecklistItems.id, itemId))
    .limit(1);
  if (!item) return;
  const task = await requireTask(actor, item.taskId);
  if (!canMutate(actor, task)) throw new PermissionError("task.edit");
  await db
    .update(taskChecklistItems)
    .set({ done: !item.done })
    .where(eq(taskChecklistItems.id, itemId));
}

// ---- labels ---------------------------------------------------------------

async function ensureLabel(name: string, color: string) {
  const { labelColorKey } = await import("@/lib/label-colors");
  const clean = name.trim().toLowerCase();
  const safeColor = labelColorKey(color);
  const [label] = await db
    .insert(labels)
    .values({ name: clean, color: safeColor })
    .onConflictDoUpdate({ target: labels.name, set: { color: safeColor } })
    .returning();
  return label;
}

export async function addLabelToTask(
  actor: Actor,
  taskId: string,
  name: string,
  color = "slate",
) {
  const task = await requireTask(actor, taskId);
  assertCan(actor, "task.edit", { divisionId: task.divisionId });
  if (!name.trim()) return;
  const label = await ensureLabel(name, color);
  await db
    .insert(taskLabels)
    .values({ taskId, labelId: label.id })
    .onConflictDoNothing();
}

export async function removeLabelFromTask(actor: Actor, taskId: string, labelId: string) {
  const task = await requireTask(actor, taskId);
  assertCan(actor, "task.edit", { divisionId: task.divisionId });
  await db
    .delete(taskLabels)
    .where(and(eq(taskLabels.taskId, taskId), eq(taskLabels.labelId, labelId)));
}

// ---- dependencies ---------------------------------------------------------

export async function addDependency(
  actor: Actor,
  taskId: string,
  dependsOnTaskId: string,
) {
  if (taskId === dependsOnTaskId) throw new Error("A task cannot block itself.");
  const task = await requireTask(actor, taskId);
  const blocker = await requireTask(actor, dependsOnTaskId);
  assertCan(actor, "task.edit", { divisionId: task.divisionId });
  if (task.eventId !== blocker.eventId) {
    throw new Error("Dependencies must stay within one event.");
  }
  // direct-cycle guard (A→B while B→A)
  const [reverse] = await db
    .select()
    .from(taskDependencies)
    .where(
      and(
        eq(taskDependencies.taskId, dependsOnTaskId),
        eq(taskDependencies.dependsOnTaskId, taskId),
      ),
    )
    .limit(1);
  if (reverse) throw new Error("These tasks already depend on each other.");
  await db
    .insert(taskDependencies)
    .values({ taskId, dependsOnTaskId })
    .onConflictDoNothing();
}

// ---- comments -------------------------------------------------------------

export async function addComment(
  actor: Actor,
  taskId: string,
  body: string,
  mentionIds: string[] = [],
) {
  const task = await requireTask(actor, taskId);
  if (!canMutate(actor, task) && !task.isAssigned) {
    // division members and assignees may comment
    assertCan(actor, "task.viewDivision", { divisionId: task.divisionId });
  }

  // only mention users who can actually see the task
  const validMentions =
    mentionIds.length === 0
      ? []
      : (
          await db
            .select({ id: profiles.id, role: profiles.role })
            .from(profiles)
            .where(inArray(profiles.id, mentionIds))
        ).filter((p) => p.role !== "external");

  const [comment] = await db
    .insert(comments)
    .values({
      taskId,
      authorId: actor.id,
      body: body.trim(),
      mentions: validMentions.map((m) => m.id),
    })
    .returning();

  await notifyMany(
    validMentions.map((m) => m.id).filter((id) => id !== actor.id),
    {
      type: "mentioned",
      title: "You were mentioned in a comment",
      href: `/tasks/${taskId}`,
    },
  );
  return comment;
}

// ---- handoffs (T-036) -----------------------------------------------------

export async function requestHandoff(
  actor: Actor,
  input: {
    eventId: string;
    fromDivisionId: string;
    toDivisionId: string;
    title: string;
    note?: string;
    originTaskId?: string;
  },
) {
  assertCan(actor, "handoff.request", { divisionId: input.fromDivisionId });
  if (input.fromDivisionId === input.toDivisionId) {
    throw new Error("Handoffs go to a different division.");
  }
  const [handoff] = await db
    .insert(handoffs)
    .values({
      eventId: input.eventId,
      fromDivisionId: input.fromDivisionId,
      toDivisionId: input.toDivisionId,
      originTaskId: input.originTaskId ?? null,
      title: input.title.trim(),
      note: input.note?.trim() ?? "",
      requestedBy: actor.id,
    })
    .returning();

  const heads = await db
    .select({ userId: divisionMembers.userId })
    .from(divisionMembers)
    .where(
      and(
        eq(divisionMembers.divisionId, input.toDivisionId),
        eq(divisionMembers.role, "head"),
      ),
    );
  await notifyMany(
    heads.map((h) => h.userId),
    {
      type: "handoff_request",
      title: `Handoff request: ${handoff.title}`,
      href: `/events/${input.eventId}/handoffs`,
    },
  );
  await logActivity({
    actorId: actor.id,
    action: "handoff.request",
    entity: `handoff:${handoff.id}`,
    detail: { from: input.fromDivisionId, to: input.toDivisionId },
    eventId: input.eventId,
  });
  return handoff;
}

export async function decideHandoff(
  actor: Actor,
  handoffId: string,
  accept: boolean,
) {
  const [handoff] = await db
    .select()
    .from(handoffs)
    .where(eq(handoffs.id, handoffId))
    .limit(1);
  if (!handoff || handoff.status !== "pending") {
    throw new Error("Handoff not found or already decided.");
  }
  assertCan(actor, "handoff.decide", { divisionId: handoff.toDivisionId });

  let createdTaskId: string | null = null;
  if (accept) {
    const [created] = await db
      .insert(tasks)
      .values({
        eventId: handoff.eventId,
        divisionId: handoff.toDivisionId,
        title: handoff.title,
        description: handoff.note,
        status: "todo",
        createdBy: actor.id,
      })
      .returning();
    createdTaskId = created.id;
    if (handoff.originTaskId) {
      await db
        .insert(taskDependencies)
        .values({ taskId: handoff.originTaskId, dependsOnTaskId: created.id })
        .onConflictDoNothing();
    }
  }

  await db
    .update(handoffs)
    .set({
      status: accept ? "accepted" : "declined",
      decidedBy: actor.id,
      decidedAt: new Date(),
      createdTaskId,
    })
    .where(eq(handoffs.id, handoffId));

  if (handoff.requestedBy) {
    await notify({
      userId: handoff.requestedBy,
      type: "handoff_decided",
      title: `Handoff ${accept ? "accepted" : "declined"}: ${handoff.title}`,
      href: createdTaskId ? `/tasks/${createdTaskId}` : `/events/${handoff.eventId}/handoffs`,
    });
  }
  await logActivity({
    actorId: actor.id,
    action: accept ? "handoff.accept" : "handoff.decline",
    entity: `handoff:${handoffId}`,
    eventId: handoff.eventId,
  });
  return createdTaskId;
}

export async function listHandoffs(actor: Actor, eventId: string) {
  const rows = await db
    .select()
    .from(handoffs)
    .where(eq(handoffs.eventId, eventId))
    .orderBy(asc(handoffs.createdAt));
  // visible if actor touches either side (or owner/admin)
  return rows.filter(
    (h) =>
      can(actor, "task.viewDivision", { divisionId: h.fromDivisionId }) ||
      can(actor, "task.viewDivision", { divisionId: h.toDivisionId }),
  );
}

// ---- attachments ----------------------------------------------------------

export async function addAttachment(
  actor: Actor,
  taskId: string,
  file: { name: string; size: number; path: string },
) {
  const task = await requireTask(actor, taskId);
  if (!canMutate(actor, task)) throw new PermissionError("task.updateAssigned");
  await db.insert(attachments).values({
    taskId,
    uploaderId: actor.id,
    fileName: file.name,
    path: file.path,
    size: file.size,
  });
}

// ---- saved filters (T-032) ------------------------------------------------

export async function listSavedFilters(actor: Actor) {
  return db
    .select()
    .from(savedFilters)
    .where(eq(savedFilters.userId, actor.id))
    .orderBy(asc(savedFilters.createdAt));
}

export async function saveFilter(actor: Actor, name: string, params: ListFilters) {
  await db
    .insert(savedFilters)
    .values({ userId: actor.id, name: name.trim(), params });
}

export async function deleteFilter(actor: Actor, filterId: string) {
  await db
    .delete(savedFilters)
    .where(and(eq(savedFilters.id, filterId), eq(savedFilters.userId, actor.id)));
}

// ---- detail & options -----------------------------------------------------

export async function getTaskDetail(actor: Actor, taskId: string) {
  const task = await getTaskScoped(actor, taskId);
  if (!task) return null;

  const [checklist, taskLabelRows, commentRows, attachmentRows, blockerRows, dependentRows, watcherRows, event] =
    await Promise.all([
      db
        .select()
        .from(taskChecklistItems)
        .where(eq(taskChecklistItems.taskId, taskId))
        .orderBy(asc(taskChecklistItems.sortOrder)),
      db
        .select({ id: labels.id, name: labels.name, color: labels.color })
        .from(taskLabels)
        .innerJoin(labels, eq(taskLabels.labelId, labels.id))
        .where(eq(taskLabels.taskId, taskId)),
      db
        .select({ comment: comments, authorName: profiles.name })
        .from(comments)
        .leftJoin(profiles, eq(comments.authorId, profiles.id))
        .where(eq(comments.taskId, taskId))
        .orderBy(asc(comments.createdAt)),
      db.select().from(attachments).where(eq(attachments.taskId, taskId)),
      db
        .select({ id: tasks.id, title: tasks.title, status: tasks.status })
        .from(taskDependencies)
        .innerJoin(tasks, eq(taskDependencies.dependsOnTaskId, tasks.id))
        .where(eq(taskDependencies.taskId, taskId)),
      db
        .select({ id: tasks.id, title: tasks.title, status: tasks.status })
        .from(taskDependencies)
        .innerJoin(tasks, eq(taskDependencies.taskId, tasks.id))
        .where(eq(taskDependencies.dependsOnTaskId, taskId)),
      db
        .select({ userId: taskWatchers.userId })
        .from(taskWatchers)
        .where(eq(taskWatchers.taskId, taskId)),
      db
        .select({ id: events.id, name: events.name })
        .from(events)
        .where(eq(events.id, task.eventId))
        .then((r) => r[0] ?? null),
    ]);

  const assignees =
    task.assigneeIds.length === 0
      ? []
      : await db
          .select({ id: profiles.id, name: profiles.name })
          .from(profiles)
          .where(inArray(profiles.id, task.assigneeIds));

  return {
    ...task,
    event,
    assignees,
    checklist,
    labels: taskLabelRows,
    comments: commentRows,
    attachments: attachmentRows,
    blockers: blockerRows,
    dependents: dependentRows,
    watcherIds: watcherRows.map((w) => w.userId),
  };
}

// internal users of a division (assignee / mention options)
export async function listDivisionMemberOptions(divisionId: string) {
  return db
    .select({ id: profiles.id, name: profiles.name, role: divisionMembers.role })
    .from(divisionMembers)
    .innerJoin(profiles, eq(divisionMembers.userId, profiles.id))
    .where(eq(divisionMembers.divisionId, divisionId))
    .orderBy(asc(profiles.name));
}

// same-event tasks usable as dependency targets
export async function listEventTaskOptions(
  actor: Actor,
  eventId: string,
  excludeTaskId?: string,
) {
  const rows = await listEventTasks(actor, eventId);
  return rows
    .filter((t) => t.id !== excludeTaskId)
    .map((t) => ({ id: t.id, title: t.title, divisionId: t.divisionId }));
}

// ---- cron sweeps (T-037) --------------------------------------------------

export async function sweepDueNotifications(now = new Date()): Promise<void> {
  const soon = new Date(now.getTime() + 24 * 3600_000);

  const dueSoon = await db
    .select({ id: tasks.id, title: tasks.title, dueDate: tasks.dueDate })
    .from(tasks)
    .where(and(ne(tasks.status, "done"), lt(tasks.dueDate, soon), isNull(tasks.completedAt)));

  for (const task of dueSoon) {
    const overdue = task.dueDate !== null && task.dueDate < now;
    const assignees = await db
      .select({ userId: taskAssignees.userId })
      .from(taskAssignees)
      .where(eq(taskAssignees.taskId, task.id));
    await notifyMany(
      assignees.map((a) => a.userId),
      {
        type: overdue ? "overdue" : "due_soon",
        title: `${overdue ? "Overdue" : "Due within 24h"}: ${task.title}`,
        href: `/tasks/${task.id}`,
        dedupKeyFor: (userId) =>
          `${overdue ? "overdue" : "due24"}:${task.id}:${userId}`,
      },
    );
    if (overdue) {
      // matrix: overdue also notifies the division head
      const [row] = await db
        .select({ divisionId: tasks.divisionId })
        .from(tasks)
        .where(eq(tasks.id, task.id))
        .limit(1);
      if (row) {
        const heads = await db
          .select({ userId: divisionMembers.userId })
          .from(divisionMembers)
          .where(
            and(
              eq(divisionMembers.divisionId, row.divisionId),
              eq(divisionMembers.role, "head"),
            ),
          );
        await notifyMany(
          heads.map((h) => h.userId),
          {
            type: "overdue",
            title: `Overdue in your division: ${task.title}`,
            href: `/tasks/${task.id}`,
            dedupKeyFor: (userId) => `overdue-head:${task.id}:${userId}`,
          },
        );
      }
    }
  }
}
