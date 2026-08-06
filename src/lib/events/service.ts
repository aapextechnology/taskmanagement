import { asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { divisions, eventDivisions, events } from "@/db/schema";
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

// ---- health (T-023) -------------------------------------------------------

// Signal gathering. Task counts wire in with EPIC-003, budget with EPIC-005 —
// until then those signals are structurally zero and events stay on_track.
async function gatherSignals(eventId: string): Promise<HealthSignals> {
  void eventId; // consumed once EPIC-003 (task counts) / EPIC-005 (budget) land
  return { overdueTasks: 0, blockedOnCriticalPath: false };
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
