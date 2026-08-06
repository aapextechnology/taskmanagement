import { and, desc, eq, gte, inArray, isNull, lt, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  activityLog,
  divisions,
  eventPhases,
  events,
  profiles,
  taskDependencies,
  tasks,
} from "@/db/schema";
import { portfolioRollup } from "@/lib/budgets/service";
import { assertCan, type Actor } from "@/lib/permissions";

// Executive dashboard queries (T-060/T-061). Owner/Admin only.

export async function getPortfolio(actor: Actor) {
  assertCan(actor, "dashboard.view");
  const active = await db
    .select({ event: events, phaseName: eventPhases.name })
    .from(events)
    .leftJoin(eventPhases, eq(events.currentPhaseId, eventPhases.id))
    .where(isNull(events.archivedAt))
    .orderBy(events.showDate)
    .then((rows) =>
      rows.map((r) => ({ ...r.event, phaseName: r.phaseName ?? "—" })),
    );
  const budgets = (await portfolioRollup(actor)) ?? [];
  const budgetByEvent = new Map(budgets.map((b) => [b.eventId, b]));
  return active.map((event) => {
    const budget = budgetByEvent.get(event.id);
    const planned = budget?.planned ?? 0;
    const burn = budget ? budget.committed + budget.actual : 0;
    return {
      ...event,
      planned,
      burn,
      burnPct: planned > 0 ? Math.round((burn / planned) * 100) : null,
    };
  });
}

export async function getUpcomingMilestones(actor: Actor, days = 14) {
  assertCan(actor, "dashboard.view");
  const now = new Date();
  const until = new Date(now.getTime() + days * 86_400_000);
  return db
    .select({
      id: tasks.id,
      title: tasks.title,
      dueDate: tasks.dueDate,
      priority: tasks.priority,
      status: tasks.status,
      eventName: events.name,
      divisionName: divisions.name,
    })
    .from(tasks)
    .innerJoin(events, eq(tasks.eventId, events.id))
    .innerJoin(divisions, eq(tasks.divisionId, divisions.id))
    .where(
      and(
        ne(tasks.status, "done"),
        gte(tasks.dueDate, now),
        lt(tasks.dueDate, until),
        inArray(tasks.priority, ["high", "urgent"]),
        isNull(events.archivedAt),
      ),
    )
    .orderBy(tasks.dueDate)
    .limit(10);
}

// blocked tasks that other tasks depend on — the cross-division risk list
export async function getBlockers(actor: Actor) {
  assertCan(actor, "dashboard.view");
  return db
    .selectDistinct({
      id: tasks.id,
      title: tasks.title,
      eventName: events.name,
      divisionName: divisions.name,
      dueDate: tasks.dueDate,
    })
    .from(tasks)
    .innerJoin(taskDependencies, eq(taskDependencies.dependsOnTaskId, tasks.id))
    .innerJoin(events, eq(tasks.eventId, events.id))
    .innerJoin(divisions, eq(tasks.divisionId, divisions.id))
    .where(and(eq(tasks.status, "blocked"), isNull(events.archivedAt)))
    .limit(10);
}

export async function getOverdueHotspots(actor: Actor) {
  assertCan(actor, "dashboard.view");
  const now = new Date();
  return db
    .select({
      eventName: events.name,
      eventId: events.id,
      divisionName: divisions.name,
      divisionId: divisions.id,
      count: sql<number>`count(*)::int`,
    })
    .from(tasks)
    .innerJoin(events, eq(tasks.eventId, events.id))
    .innerJoin(divisions, eq(tasks.divisionId, divisions.id))
    .where(
      and(
        ne(tasks.status, "done"),
        lt(tasks.dueDate, now),
        isNull(events.archivedAt),
      ),
    )
    .groupBy(events.id, events.name, divisions.id, divisions.name)
    .orderBy(desc(sql`count(*)`))
    .limit(8);
}

export async function getActivityFeed(actor: Actor, limit = 15) {
  assertCan(actor, "dashboard.view");
  // sign-ins are audit material, not dashboard news
  const rows = await db
    .select({
      id: activityLog.id,
      action: activityLog.action,
      entity: activityLog.entity,
      createdAt: activityLog.createdAt,
      actorName: profiles.name,
      eventName: events.name,
    })
    .from(activityLog)
    .leftJoin(profiles, eq(activityLog.actorId, profiles.id))
    .leftJoin(events, eq(activityLog.eventId, events.id))
    .where(ne(activityLog.action, "auth.signin"))
    .orderBy(desc(activityLog.createdAt))
    .limit(limit);

  const { actionLabel, resolveEntityLabels } = await import(
    "@/lib/activity-labels"
  );
  const entityLabels = await resolveEntityLabels(rows.map((r) => r.entity));
  return rows.map((r) => ({
    ...r,
    actionLabel: actionLabel(r.action),
    entityLabel: entityLabels.get(r.entity) ?? "",
  }));
}
