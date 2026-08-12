"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { events } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { sessionActor } from "@/lib/auth/session-actor";
import { can } from "@/lib/permissions";
import { listTesseraEvents } from "@/lib/tessera/client";

// Mapping actions (Owner 2026-08-12). org.manage on both: connecting a data
// source decides what an event's sales history says, which is an org-admin
// act — and listing Tessera's events spends the shared token either way.

export async function fetchTesseraOptionsAction(): Promise<
  { options: Array<{ id: string; name: string }> } | { error: string }
> {
  const actor = await sessionActor();
  if (!actor || !can(actor, "org.manage")) return { error: "Not allowed." };
  try {
    const rows = await listTesseraEvents(actor);
    return { options: rows.map((r) => ({ id: r.id, name: r.name })) };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not reach Tessera.",
    };
  }
}

export async function mapTesseraAction(
  eventId: string,
  tesseraEventId: string | null,
): Promise<{ error?: string }> {
  const actor = await sessionActor();
  if (!actor || !can(actor, "org.manage")) return { error: "Not allowed." };
  await db
    .update(events)
    .set({ tesseraEventId, updatedAt: new Date() })
    .where(eq(events.id, eventId));
  await logActivity({
    actorId: actor.id,
    action: tesseraEventId ? "tessera.mapped" : "tessera.unmapped",
    entity: `event:${eventId}`,
    detail: { tesseraEventId },
    eventId,
  });
  revalidatePath(`/events/${eventId}/tickets`);
  return {};
}
