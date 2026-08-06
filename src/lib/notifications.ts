import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";

// In-app notification service (T-037). SSE streams read from this table;
// email (T-062) and WhatsApp (T-064) adapters will fan out from here later.

export type NotificationType =
  | "assigned"
  | "mentioned"
  | "due_soon"
  | "overdue"
  | "unblocked"
  | "handoff_request"
  | "handoff_decided"
  | "approval_requested"
  | "approval_decided";

export async function notify(input: {
  userId: string;
  type: NotificationType;
  title: string;
  href?: string;
  /** set for cron-driven alerts so re-runs never duplicate */
  dedupKey?: string;
}): Promise<void> {
  await db
    .insert(notifications)
    .values({
      userId: input.userId,
      type: input.type,
      title: input.title,
      href: input.href ?? "",
      dedupKey: input.dedupKey ?? null,
    })
    .onConflictDoNothing();
}

export async function notifyMany(
  userIds: Iterable<string>,
  input: Omit<Parameters<typeof notify>[0], "userId" | "dedupKey"> & {
    dedupKeyFor?: (userId: string) => string;
  },
): Promise<void> {
  for (const userId of new Set(userIds)) {
    await notify({
      userId,
      type: input.type,
      title: input.title,
      href: input.href,
      dedupKey: input.dedupKeyFor?.(userId),
    });
  }
}

export async function listMyNotifications(userId: string, limit = 20) {
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function unreadCount(userId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return row?.count ?? 0;
}

export async function markAllRead(userId: string): Promise<void> {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
}
