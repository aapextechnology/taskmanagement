import { eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { eventDivisions, eventPeople } from "@/db/schema/events";
import { taskAssignees, taskWatchers, tasks } from "@/db/schema/tasks";
import type { Actor } from "@/lib/permissions";
import { seesAllEvents, seesNoEvents, type EventScope } from "./visibility-rules";

export { seesAllEvents, type EventScope };

// Which events a person may see at all (Owner 2026-08-11).
//
// Until now `event.view` returned true for every internal user: anyone could
// browse every show. The Owner narrowed it — you see an event you are part
// of, and leadership sees everything.
//
// This lives in one module because the answer is needed by a dozen surfaces
// (the events list, the sidebar, six dashboard queries, search, the calendar,
// tickets, the AI snapshot, the dataroom). Scoping only the obvious list
// would look fixed while the same rows still arrived through the dashboard.

/**
 * Events this person is part of: their divisions participate, or they are
 * lead, assignee or watcher of a task inside it.
 *
 * Division participation counts on its own, deliberately. Requiring a task
 * would mean a division added to an event sees nothing until someone hands
 * them work — backwards, since seeing the event is how they pick the work up.
 */
export async function visibleEventIds(actor: Actor): Promise<EventScope> {
  if (seesAllEvents(actor)) return "all";
  // externals never reach the events index (EPIC-007); they have their own
  // invite-scoped surface
  if (seesNoEvents(actor)) return [];

  const divisionIds = actor.memberships.map((m) => m.divisionId);
  const ids = new Set<string>();

  if (divisionIds.length > 0) {
    const rows = await db
      .select({ eventId: eventDivisions.eventId })
      .from(eventDivisions)
      .where(inArray(eventDivisions.divisionId, divisionIds));
    for (const r of rows) ids.add(r.eventId);
  }

  // event-level crew (Owner 2026-08-13): being the event's PIC or member is
  // a visibility grant on its own, before any task exists
  const asCrew = await db
    .select({ eventId: eventPeople.eventId })
    .from(eventPeople)
    .where(eq(eventPeople.userId, actor.id));
  for (const r of asCrew) ids.add(r.eventId);

  const throughTasks = await db
    .selectDistinct({ eventId: tasks.eventId })
    .from(tasks)
    .leftJoin(taskAssignees, eq(taskAssignees.taskId, tasks.id))
    .leftJoin(taskWatchers, eq(taskWatchers.taskId, tasks.id))
    .where(
      or(
        eq(tasks.leadId, actor.id),
        eq(taskAssignees.userId, actor.id),
        eq(taskWatchers.userId, actor.id),
      ),
    );
  for (const r of throughTasks) ids.add(r.eventId);

  return [...ids];
}

export async function canViewEvent(
  actor: Actor,
  eventId: string,
): Promise<boolean> {
  const scope = await visibleEventIds(actor);
  return scope === "all" || scope.includes(eventId);
}

/**
 * A drizzle condition for "events this person may see", for the queries that
 * filter rather than fetch. Returns undefined when everything is visible so
 * the caller can leave its `where` untouched.
 */
export function scopeCondition(scope: EventScope, column: Parameters<typeof inArray>[0]) {
  if (scope === "all") return undefined;
  // an empty scope must match nothing — `inArray(x, [])` is a SQL error in
  // some drivers, and "no filter" would be catastrophically wrong here
  if (scope.length === 0) return sql`false`;
  return inArray(column, scope);
}
