import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { scopeCondition, visibleEventIds } from "@/lib/events/visibility";
import { events, ticketSalesSnapshots } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { toWibParts } from "@/lib/tasks/dates";
import { assertCan, can, type Actor } from "@/lib/permissions";

// Daily ticket sales snapshots (T-093) — manual entry (Owner decision:
// no ticketing API in v1). One row per event per WIB day, upserted.

export function wibDayKey(date: Date): string {
  const p = toWibParts(date);
  return `${p.y}-${String(p.m + 1).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

export async function recordSnapshot(
  actor: Actor,
  input: {
    eventId: string;
    day: string; // YYYY-MM-DD (WIB)
    ticketsSold: number;
    revenue: number;
    note?: string;
  },
) {
  assertCan(actor, "tickets.record");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.day)) throw new Error("Invalid date.");
  if (input.ticketsSold < 0 || input.revenue < 0) {
    throw new Error("Numbers cannot be negative.");
  }
  const values = {
    eventId: input.eventId,
    day: input.day,
    ticketsSold: input.ticketsSold,
    revenue: input.revenue,
    note: input.note?.trim() ?? "",
    recordedBy: actor.id,
  };
  await db
    .insert(ticketSalesSnapshots)
    .values(values)
    .onConflictDoUpdate({
      target: [ticketSalesSnapshots.eventId, ticketSalesSnapshots.day],
      set: values,
    });
  await logActivity({
    actorId: actor.id,
    action: "tickets.record",
    entity: `event:${input.eventId}`,
    detail: { day: input.day, ticketsSold: input.ticketsSold },
    eventId: input.eventId,
  });
}

export async function listSnapshots(actor: Actor, eventId: string) {
  assertCan(actor, "event.view");
  return db
    .select()
    .from(ticketSalesSnapshots)
    .where(eq(ticketSalesSnapshots.eventId, eventId))
    .orderBy(asc(ticketSalesSnapshots.day));
}

export interface SalesSummary {
  eventId: string;
  eventName: string;
  capacity: number | null;
  totalSold: number;
  totalRevenue: number;
  soldPct: number | null;
  last14: Array<{ day: string; ticketsSold: number }>;
}

// dashboard widget: sales curve per active event (owner/admin)
export async function portfolioSales(actor: Actor): Promise<SalesSummary[]> {
  if (!can(actor, "dashboard.view")) return [];
  const active = await db
    .select({ id: events.id, name: events.name, capacity: events.capacity })
    .from(events)
    .where(and(isNull(events.archivedAt), scopeCondition(await visibleEventIds(actor), events.id)));
  if (active.length === 0) return [];

  const rows = await db
    .select()
    .from(ticketSalesSnapshots)
    .where(inArray(ticketSalesSnapshots.eventId, active.map((e) => e.id)))
    .orderBy(desc(ticketSalesSnapshots.day));

  return active
    .map((event) => {
      const mine = rows
        .filter((r) => r.eventId === event.id)
        .sort((a, b) => a.day.localeCompare(b.day));
      const totalSold = mine.reduce((s, r) => s + r.ticketsSold, 0);
      return {
        eventId: event.id,
        eventName: event.name,
        capacity: event.capacity,
        totalSold,
        totalRevenue: mine.reduce((s, r) => s + r.revenue, 0),
        soldPct:
          event.capacity && event.capacity > 0
            ? Math.round((totalSold / event.capacity) * 100)
            : null,
        last14: mine.slice(-14).map((r) => ({ day: r.day, ticketsSold: r.ticketsSold })),
      };
    })
    .filter((s) => s.last14.length > 0);
}

export async function totalSold(eventId: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(tickets_sold), 0)::int` })
    .from(ticketSalesSnapshots)
    .where(eq(ticketSalesSnapshots.eventId, eventId));
  return row?.total ?? 0;
}
