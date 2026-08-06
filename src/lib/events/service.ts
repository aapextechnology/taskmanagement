import { and, asc, eq, inArray, isNull, lt, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  divisions,
  eventDivisions,
  events,
  taskDependencies,
  tasks,
} from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { assertCan, type Actor } from "@/lib/permissions";
import { computeHealth, type HealthSignals } from "./health";

// Events service (T-021/T-022/T-023). All access permission-gated here.

export const EVENT_PHASES_ORDER = [
  "planning",
  "pre_production",
  "promotion",
  "show_week",
  "show_day",
  "settlement",
] as const;
export type EventPhase = (typeof EVENT_PHASES_ORDER)[number];

export const PHASE_LABELS: Record<EventPhase, string> = {
  planning: "Planning",
  pre_production: "Pre-production",
  promotion: "Promotion",
  show_week: "Show week",
  show_day: "Show day",
  settlement: "Settlement",
};

export async function listActiveEvents(actor: Actor) {
  assertCan(actor, "event.view");
  return db
    .select()
    .from(events)
    .where(isNull(events.archivedAt))
    .orderBy(asc(events.showDate));
}

export async function getEvent(actor: Actor, eventId: string) {
  assertCan(actor, "event.view");
  const [event] = await db
    .select()
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);
  return event ?? null;
}

export async function createEvent(
  actor: Actor,
  input: {
    name: string;
    artists: string;
    venue: string;
    showDate: Date;
    capacity?: number;
    coverImagePath?: string;
  },
) {
  assertCan(actor, "event.create");
  const [event] = await db
    .insert(events)
    .values({
      name: input.name.trim(),
      artists: input.artists.trim(),
      venue: input.venue.trim(),
      showDate: input.showDate,
      capacity: input.capacity ?? null,
      coverImagePath: input.coverImagePath ?? null,
    })
    .returning();

  // all divisions participate by default; trimmed later per event if needed
  const allDivisions = await db.select({ id: divisions.id }).from(divisions);
  if (allDivisions.length > 0) {
    await db
      .insert(eventDivisions)
      .values(allDivisions.map((d) => ({ eventId: event.id, divisionId: d.id })))
      .onConflictDoNothing();
  }

  await logActivity({
    actorId: actor.id,
    action: "event.create",
    entity: `event:${event.id}`,
    detail: { name: event.name, showDate: event.showDate.toISOString() },
    eventId: event.id,
  });
  return event;
}

export async function updatePhase(
  actor: Actor,
  eventId: string,
  phase: EventPhase,
) {
  assertCan(actor, "event.updatePhase");
  await db
    .update(events)
    .set({ phase, updatedAt: new Date() })
    .where(eq(events.id, eventId));
  await logActivity({
    actorId: actor.id,
    action: "event.updatePhase",
    entity: `event:${eventId}`,
    detail: { phase },
    eventId,
  });
}

export async function setArchived(
  actor: Actor,
  eventId: string,
  archived: boolean,
) {
  assertCan(actor, "event.archive");
  await db
    .update(events)
    .set({ archivedAt: archived ? new Date() : null, updatedAt: new Date() })
    .where(eq(events.id, eventId));
  await logActivity({
    actorId: actor.id,
    action: archived ? "event.archive" : "event.unarchive",
    entity: `event:${eventId}`,
    eventId,
  });
}

// ---- division roster per event (Owner request 2026-08-06) -----------------

export async function listEventDivisions(actor: Actor, eventId: string) {
  assertCan(actor, "event.view");
  return db
    .select({ id: divisions.id, name: divisions.name })
    .from(eventDivisions)
    .innerJoin(divisions, eq(eventDivisions.divisionId, divisions.id))
    .where(eq(eventDivisions.eventId, eventId))
    .orderBy(asc(divisions.sortOrder));
}

export async function setEventDivisions(
  actor: Actor,
  eventId: string,
  divisionIds: string[],
) {
  assertCan(actor, "event.manageDivisions");
  if (divisionIds.length === 0) {
    throw new Error("An event needs at least one division.");
  }
  const current = await db
    .select({ divisionId: eventDivisions.divisionId })
    .from(eventDivisions)
    .where(eq(eventDivisions.eventId, eventId));
  const wanted = new Set(divisionIds);
  const existing = new Set(current.map((c) => c.divisionId));

  const toRemove = [...existing].filter((id) => !wanted.has(id));
  if (toRemove.length > 0) {
    await db
      .delete(eventDivisions)
      .where(
        and(
          eq(eventDivisions.eventId, eventId),
          inArray(eventDivisions.divisionId, toRemove),
        ),
      );
  }
  const toAdd = [...wanted].filter((id) => !existing.has(id));
  if (toAdd.length > 0) {
    await db
      .insert(eventDivisions)
      .values(toAdd.map((divisionId) => ({ eventId, divisionId })))
      .onConflictDoNothing();
  }
  await logActivity({
    actorId: actor.id,
    action: "event.updateDivisions",
    entity: `event:${eventId}`,
    detail: { divisions: divisionIds },
    eventId,
  });
}

// ---- health (T-023) -------------------------------------------------------

// Signal gathering. Task signals live (EPIC-003); budget signals live (EPIC-005).
async function gatherSignals(eventId: string): Promise<HealthSignals> {
  const now = new Date();
  // lazy import avoids a static service cycle (budgets → events)
  const { budgetHealthSignals } = await import("@/lib/budgets/service");
  const budget = await budgetHealthSignals(eventId);

  const [overdueRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(tasks)
    .where(
      and(eq(tasks.eventId, eventId), ne(tasks.status, "done"), lt(tasks.dueDate, now)),
    );

  // "critical path" approximation until EPIC-008's real Gantt: a blocked task
  // that other tasks depend on is treated as path-blocking
  const [blockedRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(tasks)
    .innerJoin(taskDependencies, eq(taskDependencies.dependsOnTaskId, tasks.id))
    .where(and(eq(tasks.eventId, eventId), eq(tasks.status, "blocked")));

  return {
    overdueTasks: overdueRow?.count ?? 0,
    blockedOnCriticalPath: (blockedRow?.count ?? 0) > 0,
    ...budget,
  };
}

export async function recomputeEventHealth(eventId: string): Promise<void> {
  const signals = await gatherSignals(eventId);
  const health = computeHealth(signals);
  await db
    .update(events)
    .set({ health, updatedAt: new Date() })
    .where(eq(events.id, eventId));
}

export async function recomputeAllEventHealth(): Promise<number> {
  const active = await db
    .select({ id: events.id })
    .from(events)
    .where(isNull(events.archivedAt));
  for (const e of active) {
    await recomputeEventHealth(e.id);
  }
  return active.length;
}
