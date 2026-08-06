import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { runOfShowItems } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { assertCan, type Actor } from "@/lib/permissions";

// Run of show service (T-083). Read = any internal user (event.view);
// write = Production/Ops via runofshow.manage. Chronological by startTime.

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function listRunOfShow(actor: Actor, eventId: string) {
  assertCan(actor, "event.view");
  return db
    .select()
    .from(runOfShowItems)
    .where(eq(runOfShowItems.eventId, eventId))
    .orderBy(asc(runOfShowItems.startTime), asc(runOfShowItems.createdAt));
}

export async function addRunOfShowItem(
  actor: Actor,
  input: {
    eventId: string;
    startTime: string;
    durationMinutes?: number;
    title: string;
    note?: string;
  },
) {
  assertCan(actor, "runofshow.manage");
  if (!TIME_RE.test(input.startTime)) {
    throw new Error("Start time must be HH:MM (24h).");
  }
  const title = input.title.trim();
  if (!title) throw new Error("Title is required.");
  const [item] = await db
    .insert(runOfShowItems)
    .values({
      eventId: input.eventId,
      startTime: input.startTime,
      durationMinutes: input.durationMinutes ?? null,
      title,
      note: input.note?.trim() ?? "",
      createdBy: actor.id,
    })
    .returning();
  await logActivity({
    actorId: actor.id,
    action: "runofshow.add",
    entity: `event:${input.eventId}`,
    detail: { title, startTime: input.startTime },
    eventId: input.eventId,
  });
  return item;
}

export async function updateRunOfShowItem(
  actor: Actor,
  itemId: string,
  input: {
    startTime: string;
    durationMinutes?: number;
    title: string;
    note?: string;
  },
) {
  assertCan(actor, "runofshow.manage");
  if (!TIME_RE.test(input.startTime)) {
    throw new Error("Start time must be HH:MM (24h).");
  }
  const title = input.title.trim();
  if (!title) throw new Error("Title is required.");
  await db
    .update(runOfShowItems)
    .set({
      startTime: input.startTime,
      durationMinutes: input.durationMinutes ?? null,
      title,
      note: input.note?.trim() ?? "",
    })
    .where(eq(runOfShowItems.id, itemId));
}

export async function deleteRunOfShowItem(actor: Actor, itemId: string) {
  assertCan(actor, "runofshow.manage");
  const [item] = await db
    .select()
    .from(runOfShowItems)
    .where(eq(runOfShowItems.id, itemId))
    .limit(1);
  if (!item) return;
  await db.delete(runOfShowItems).where(eq(runOfShowItems.id, itemId));
  await logActivity({
    actorId: actor.id,
    action: "runofshow.delete",
    entity: `event:${item.eventId}`,
    detail: { title: item.title },
    eventId: item.eventId,
  });
}
