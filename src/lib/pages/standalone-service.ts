import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { divisions, pageShares, pages, profiles } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { PermissionError, type Actor } from "@/lib/permissions";
import { resolvePageAccess, type PageAccess, type PageVisibility } from "./access";

// Standalone (non-event) pages — EPIC-016 T-160.
//
// Every read goes through resolvePageAccess (pure, unit-tested in access.ts).
// The list query mirrors those same rules in SQL; the two are kept in step by
// listing only pages the actor owns, is granted, or that are organisation-wide,
// and then never trusting that list for a single-page read — getPage
// re-resolves access from the row itself.

function assertInternal(actor: Actor): void {
  if (actor.role === "external") {
    throw new PermissionError("page.use");
  }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Postgres rejects a non-UUID with a type error, which surfaces as a 500
 *  error page. A page id always comes from the URL, so guard before querying
 *  and let the caller render an ordinary "not found". */
function isPageId(value: string): boolean {
  return UUID_RE.test(value);
}

async function sharesFor(pageId: string) {
  return db
    .select({
      userId: pageShares.userId,
      divisionId: pageShares.divisionId,
      canEdit: pageShares.canEdit,
    })
    .from(pageShares)
    .where(eq(pageShares.pageId, pageId));
}

export interface PageListItem {
  id: string;
  title: string;
  visibility: PageVisibility;
  updatedAt: Date;
  ownerId: string;
  ownerName: string | null;
  /** false when the actor is reading someone else's page */
  isMine: boolean;
  /** the author has shared this page with at least one person/division */
  isShared: boolean;
}

/** Pages the actor may see: their own, ones shared with them (directly or via
 *  a division), and organisation-wide ones. */
export async function listPages(actor: Actor): Promise<PageListItem[]> {
  assertInternal(actor);
  const divisionIds = actor.memberships.map((m) => m.divisionId);

  const grantConditions = [eq(pageShares.userId, actor.id)];
  if (divisionIds.length > 0) {
    grantConditions.push(inArray(pageShares.divisionId, divisionIds));
  }

  const granted = db
    .select({ pageId: pageShares.pageId })
    .from(pageShares)
    .where(or(...grantConditions));

  const rows = await db
    .select({
      id: pages.id,
      title: pages.title,
      visibility: pages.visibility,
      updatedAt: pages.updatedAt,
      ownerId: pages.ownerId,
      ownerName: profiles.name,
      shareCount: sql<number>`(
        select count(*)::int from ${pageShares} where ${pageShares.pageId} = ${pages.id}
      )`,
    })
    .from(pages)
    .leftJoin(profiles, eq(pages.ownerId, profiles.id))
    .where(
      or(
        eq(pages.ownerId, actor.id),
        eq(pages.visibility, "organisation"),
        inArray(pages.id, granted),
      ),
    )
    .orderBy(desc(pages.updatedAt));

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    visibility: r.visibility,
    updatedAt: r.updatedAt,
    ownerId: r.ownerId,
    ownerName: r.ownerName,
    isMine: r.ownerId === actor.id,
    isShared: r.shareCount > 0 || r.visibility === "organisation",
  }));
}

export interface PageDetail {
  id: string;
  title: string;
  content: unknown;
  visibility: PageVisibility;
  ownerId: string;
  ownerName: string | null;
  updatedAt: Date;
  access: PageAccess;
}

/** Returns null when the page does not exist OR the actor may not see it —
 *  the caller renders the same "not found" either way, so a probe cannot
 *  distinguish a private page from a missing one. */
export async function getPage(
  actor: Actor,
  pageId: string,
): Promise<PageDetail | null> {
  assertInternal(actor);
  if (!isPageId(pageId)) return null;
  const [row] = await db
    .select({ page: pages, ownerName: profiles.name })
    .from(pages)
    .leftJoin(profiles, eq(pages.ownerId, profiles.id))
    .where(eq(pages.id, pageId))
    .limit(1);
  if (!row) return null;

  const access = resolvePageAccess(actor, row.page, await sharesFor(pageId));
  if (!access.canView) return null;

  return {
    id: row.page.id,
    title: row.page.title,
    content: row.page.content,
    visibility: row.page.visibility,
    ownerId: row.page.ownerId,
    ownerName: row.ownerName,
    updatedAt: row.page.updatedAt,
    access,
  };
}

export async function createPage(
  actor: Actor,
  input: {
    title?: string;
    content?: unknown;
    sourceConversationId?: string | null;
  } = {},
): Promise<{ id: string }> {
  assertInternal(actor);
  const [page] = await db
    .insert(pages)
    .values({
      title: input.title?.trim() || "Untitled",
      content: (input.content ?? null) as never,
      ownerId: actor.id,
      updatedBy: actor.id,
      sourceConversationId: input.sourceConversationId ?? null,
    })
    .returning({ id: pages.id });

  await logActivity({
    actorId: actor.id,
    action: "page.create",
    entity: `page:${page.id}`,
    detail: { title: input.title ?? "Untitled" },
  });
  return page;
}

/** Loads a page and throws unless the actor may edit it. */
async function requireEditable(actor: Actor, pageId: string) {
  assertInternal(actor);
  if (!isPageId(pageId)) throw new PermissionError("page.use");
  const [page] = await db.select().from(pages).where(eq(pages.id, pageId)).limit(1);
  if (!page) throw new PermissionError("page.use");
  const access = resolvePageAccess(actor, page, await sharesFor(pageId));
  if (!access.canEdit) throw new PermissionError("page.use");
  return { page, access };
}

export async function updatePage(
  actor: Actor,
  pageId: string,
  fields: { title?: string; content?: unknown },
): Promise<void> {
  await requireEditable(actor, pageId);
  await db
    .update(pages)
    .set({
      ...(fields.title !== undefined
        ? { title: fields.title.trim() || "Untitled" }
        : {}),
      ...(fields.content !== undefined
        ? { content: fields.content as never }
        : {}),
      updatedBy: actor.id,
      updatedAt: new Date(),
    })
    .where(eq(pages.id, pageId));
}

/** Sharing, visibility and deletion are author-only (canManage). */
async function requireManageable(actor: Actor, pageId: string) {
  assertInternal(actor);
  if (!isPageId(pageId)) throw new PermissionError("page.use");
  const [page] = await db.select().from(pages).where(eq(pages.id, pageId)).limit(1);
  if (!page) throw new PermissionError("page.use");
  const access = resolvePageAccess(actor, page, await sharesFor(pageId));
  if (!access.canManage) throw new PermissionError("page.use");
  return page;
}

export async function setPageVisibility(
  actor: Actor,
  pageId: string,
  visibility: PageVisibility,
): Promise<void> {
  await requireManageable(actor, pageId);
  await db
    .update(pages)
    .set({ visibility, updatedAt: new Date() })
    .where(eq(pages.id, pageId));
  await logActivity({
    actorId: actor.id,
    action: "page.visibility",
    entity: `page:${pageId}`,
    detail: { visibility },
  });
}

export async function sharePage(
  actor: Actor,
  pageId: string,
  target: { userId?: string; divisionId?: string; canEdit: boolean },
): Promise<void> {
  await requireManageable(actor, pageId);
  const userId = target.userId ?? null;
  const divisionId = target.divisionId ?? null;
  if ((userId === null) === (divisionId === null)) {
    throw new Error("Share with exactly one person or one division.");
  }
  if (userId === actor.id) return; // the author already has full access

  // one grant per target: re-sharing updates the existing row rather than
  // stacking duplicates (see the unique indexes on page_shares)
  await db
    .insert(pageShares)
    .values({ pageId, userId, divisionId, canEdit: target.canEdit })
    .onConflictDoUpdate({
      target: userId ? [pageShares.pageId, pageShares.userId] : [pageShares.pageId, pageShares.divisionId],
      set: { canEdit: target.canEdit },
    });

  await logActivity({
    actorId: actor.id,
    action: "page.share",
    entity: `page:${pageId}`,
    detail: { userId, divisionId, canEdit: target.canEdit },
  });
}

export async function unsharePage(
  actor: Actor,
  pageId: string,
  shareId: string,
): Promise<void> {
  await requireManageable(actor, pageId);
  await db
    .delete(pageShares)
    .where(and(eq(pageShares.id, shareId), eq(pageShares.pageId, pageId)));
  await logActivity({
    actorId: actor.id,
    action: "page.unshare",
    entity: `page:${pageId}`,
    detail: { shareId },
  });
}

export interface ShareRow {
  id: string;
  canEdit: boolean;
  userId: string | null;
  userName: string | null;
  divisionId: string | null;
  divisionName: string | null;
}

export async function listShares(
  actor: Actor,
  pageId: string,
): Promise<ShareRow[]> {
  await requireManageable(actor, pageId);
  return db
    .select({
      id: pageShares.id,
      canEdit: pageShares.canEdit,
      userId: pageShares.userId,
      userName: profiles.name,
      divisionId: pageShares.divisionId,
      divisionName: divisions.name,
    })
    .from(pageShares)
    .leftJoin(profiles, eq(pageShares.userId, profiles.id))
    .leftJoin(divisions, eq(pageShares.divisionId, divisions.id))
    .where(eq(pageShares.pageId, pageId));
}

export async function deletePage(actor: Actor, pageId: string): Promise<void> {
  await requireManageable(actor, pageId);
  await db.delete(pages).where(eq(pages.id, pageId));
  await logActivity({
    actorId: actor.id,
    action: "page.delete",
    entity: `page:${pageId}`,
    detail: {},
  });
}
