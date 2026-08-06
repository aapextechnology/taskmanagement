import { and, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  comments,
  divisions,
  events,
  profiles,
  tasks,
  timelineReads,
} from "@/db/schema";
import type { Actor } from "@/lib/permissions";

// Social timeline (Owner request 2026-08-06): the comment stream across every
// task the actor may see, Threads/X-style, plus a mentions inbox.

function visibleDivisionIds(actor: Actor): string[] | null {
  if (actor.role === "owner" || actor.role === "admin") return null; // all
  return actor.memberships.map((m) => m.divisionId);
}

export interface TimelinePost {
  id: string;
  body: string;
  attachmentPath: string | null;
  attachmentName: string | null;
  createdAt: Date;
  mentions: string[];
  authorId: string | null;
  authorName: string;
  taskId: string;
  taskTitle: string;
  divisionName: string;
  eventName: string;
  commentCount: number;
  mentionNames: string[];
}

async function hydrate(
  rows: Array<{
    comment: typeof comments.$inferSelect;
    authorName: string | null;
    taskTitle: string;
    taskId: string;
    divisionName: string;
    eventName: string;
  }>,
): Promise<TimelinePost[]> {
  if (rows.length === 0) return [];

  // comment counts per task
  const taskIds = [...new Set(rows.map((r) => r.taskId))];
  const counts = await db
    .select({ taskId: comments.taskId, count: sql<number>`count(*)::int` })
    .from(comments)
    .where(inArray(comments.taskId, taskIds))
    .groupBy(comments.taskId);
  const countByTask = new Map(counts.map((c) => [c.taskId, c.count]));

  // names for bolding mentioned users in the body
  const mentionIds = [
    ...new Set(rows.flatMap((r) => (r.comment.mentions as string[]) ?? [])),
  ];
  const mentionProfiles =
    mentionIds.length === 0
      ? []
      : await db
          .select({ id: profiles.id, name: profiles.name })
          .from(profiles)
          .where(inArray(profiles.id, mentionIds));
  const nameById = new Map(mentionProfiles.map((p) => [p.id, p.name]));

  return rows.map((r) => ({
    id: r.comment.id,
    body: r.comment.body,
    attachmentPath: r.comment.attachmentPath,
    attachmentName: r.comment.attachmentName,
    createdAt: r.comment.createdAt,
    mentions: (r.comment.mentions as string[]) ?? [],
    authorId: r.comment.authorId,
    authorName: r.authorName ?? "Unknown",
    taskId: r.taskId,
    taskTitle: r.taskTitle,
    divisionName: r.divisionName,
    eventName: r.eventName,
    commentCount: countByTask.get(r.taskId) ?? 0,
    mentionNames: ((r.comment.mentions as string[]) ?? [])
      .map((id) => nameById.get(id))
      .filter((n): n is string => Boolean(n)),
  }));
}

function baseQuery() {
  return db
    .select({
      comment: comments,
      authorName: profiles.name,
      taskTitle: tasks.title,
      taskId: tasks.id,
      divisionName: divisions.name,
      eventName: events.name,
    })
    .from(comments)
    .innerJoin(tasks, eq(comments.taskId, tasks.id))
    .innerJoin(divisions, eq(tasks.divisionId, divisions.id))
    .innerJoin(events, eq(tasks.eventId, events.id))
    .leftJoin(profiles, eq(comments.authorId, profiles.id));
}

export async function listTimeline(actor: Actor, limit = 50) {
  const scope = visibleDivisionIds(actor);
  if (scope !== null && scope.length === 0) return [];
  const rows = await baseQuery()
    .where(scope === null ? undefined : inArray(tasks.divisionId, scope))
    .orderBy(desc(comments.createdAt))
    .limit(limit);
  return hydrate(rows);
}

export async function listMentions(actor: Actor, limit = 50) {
  const rows = await baseQuery()
    .where(sql`${comments.mentions} @> ${JSON.stringify([actor.id])}::jsonb`)
    .orderBy(desc(comments.createdAt))
    .limit(limit);
  return hydrate(rows);
}

// ---- unread badges --------------------------------------------------------

async function getReads(userId: string) {
  const [row] = await db
    .select()
    .from(timelineReads)
    .where(eq(timelineReads.userId, userId))
    .limit(1);
  return row ?? null;
}

export async function getUnreadCounts(actor: Actor) {
  const reads = await getReads(actor.id);
  const timelineSince = reads?.timelineSeenAt ?? new Date(0);
  const mentionsSince = reads?.mentionsSeenAt ?? new Date(0);

  const scope = visibleDivisionIds(actor);
  let timeline = 0;
  if (scope === null || scope.length > 0) {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(comments)
      .innerJoin(tasks, eq(comments.taskId, tasks.id))
      .where(
        and(
          gt(comments.createdAt, timelineSince),
          scope === null ? undefined : inArray(tasks.divisionId, scope),
        ),
      );
    timeline = row?.count ?? 0;
  }

  const [mentionRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(comments)
    .where(
      and(
        gt(comments.createdAt, mentionsSince),
        sql`${comments.mentions} @> ${JSON.stringify([actor.id])}::jsonb`,
      ),
    );

  return { timeline, mentions: mentionRow?.count ?? 0 };
}

export async function markSeen(
  actor: Actor,
  which: "timeline" | "mentions",
): Promise<void> {
  const now = new Date();
  const patch =
    which === "timeline"
      ? { timelineSeenAt: now }
      : { mentionsSeenAt: now };
  await db
    .insert(timelineReads)
    .values({ userId: actor.id, ...patch })
    .onConflictDoUpdate({ target: timelineReads.userId, set: patch });
}
