import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { eventPages, events, profiles } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { assertCan, can, type Actor } from "@/lib/permissions";

// Event pages service (Owner request 2026-08-07): a per-event mini-wiki.
// Wiki semantics on purpose — every internal user with event access can read
// and write (that's what makes it useful for cross-division briefs); only
// the author or owner/admin may delete a page.

function assertPageAccess(actor: Actor) {
  assertCan(actor, "event.view");
  if (actor.role === "external") {
    // externals never reach the internal app, but the service defends itself
    assertCan(actor, "org.manage"); // always throws for externals
  }
}

export async function listEventPages(actor: Actor, eventId: string) {
  assertPageAccess(actor);
  return db
    .select({
      id: eventPages.id,
      title: eventPages.title,
      updatedAt: eventPages.updatedAt,
      createdBy: eventPages.createdBy,
      authorName: profiles.name,
    })
    .from(eventPages)
    .leftJoin(profiles, eq(eventPages.updatedBy, profiles.id))
    .where(eq(eventPages.eventId, eventId))
    .orderBy(asc(eventPages.createdAt));
}

export async function getPage(actor: Actor, pageId: string) {
  assertPageAccess(actor);
  const [page] = await db
    .select({ page: eventPages, eventName: events.name })
    .from(eventPages)
    .innerJoin(events, eq(eventPages.eventId, events.id))
    .where(eq(eventPages.id, pageId))
    .limit(1);
  if (!page) return null;
  return { ...page.page, eventName: page.eventName };
}

export async function createPage(actor: Actor, eventId: string, title: string) {
  assertPageAccess(actor);
  const [page] = await db
    .insert(eventPages)
    .values({
      eventId,
      title: title.trim() || "Untitled",
      createdBy: actor.id,
      updatedBy: actor.id,
    })
    .returning();
  await logActivity({
    actorId: actor.id,
    action: "page.create",
    entity: `page:${page.id}`,
    detail: { title: page.title },
    eventId,
  });
  return page;
}

export async function updatePage(
  actor: Actor,
  pageId: string,
  fields: { title?: string; content?: unknown },
) {
  assertPageAccess(actor);
  const [existing] = await db
    .select()
    .from(eventPages)
    .where(eq(eventPages.id, pageId))
    .limit(1);
  if (!existing) throw new Error("Page not found.");

  await db
    .update(eventPages)
    .set({
      ...(fields.title !== undefined
        ? { title: fields.title.trim() || "Untitled" }
        : {}),
      ...(fields.content !== undefined ? { content: fields.content } : {}),
      updatedBy: actor.id,
      updatedAt: new Date(),
    })
    .where(eq(eventPages.id, pageId));
  // content autosaves constantly — only log title changes to keep the
  // activity feed readable
  if (fields.title !== undefined && fields.title.trim() !== existing.title) {
    await logActivity({
      actorId: actor.id,
      action: "page.rename",
      entity: `page:${pageId}`,
      detail: { from: existing.title, to: fields.title.trim() || "Untitled" },
      eventId: existing.eventId,
    });
  }
}

export async function deletePage(actor: Actor, pageId: string) {
  assertPageAccess(actor);
  const [existing] = await db
    .select()
    .from(eventPages)
    .where(eq(eventPages.id, pageId))
    .limit(1);
  if (!existing) return;
  const mayDelete =
    existing.createdBy === actor.id || can(actor, "org.manage");
  if (!mayDelete) {
    throw new Error("Only the page author or an admin can delete a page.");
  }
  await db.delete(eventPages).where(eq(eventPages.id, pageId));
  await logActivity({
    actorId: actor.id,
    action: "page.delete",
    entity: `page:${pageId}`,
    detail: { title: existing.title },
    eventId: existing.eventId,
  });
}
