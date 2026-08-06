import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { notifications, profiles } from "@/db/schema";
import { sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { sendWhatsApp } from "@/lib/whatsapp";

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
  | "approval_decided"
  | "submission_received"
  | "submission_decided";

// channel routing per the PLAN §6.10 matrix: everything emails except
// "unblocked" (in-app only); WhatsApp mirrors the high-value triggers.
const EMAIL_TYPES: ReadonlySet<NotificationType> = new Set([
  "assigned",
  "mentioned",
  "due_soon",
  "overdue",
  "handoff_request",
  "handoff_decided",
  "approval_requested",
  "approval_decided",
  "submission_received",
  "submission_decided",
]);
const WHATSAPP_TYPES: ReadonlySet<NotificationType> = new Set([
  "assigned",
  "due_soon",
  "overdue",
  "approval_requested",
  "approval_decided",
]);

async function fanOutChannels(input: {
  userId: string;
  type: NotificationType;
  title: string;
  href: string;
}): Promise<void> {
  const [user] = await db
    .select({
      email: profiles.email,
      phone: profiles.phone,
      emailNotifications: profiles.emailNotifications,
      whatsappNotifications: profiles.whatsappNotifications,
    })
    .from(profiles)
    .where(eq(profiles.id, input.userId))
    .limit(1);
  if (!user) return;

  const link = input.href ? `${env.APP_URL}${input.href}` : env.APP_URL;
  if (EMAIL_TYPES.has(input.type) && user.emailNotifications) {
    await sendEmail({
      to: user.email,
      subject: `[RVC Backstage] ${input.title}`,
      text: `${input.title}\n\nOpen: ${link}\n\n— RVC Backstage`,
    });
  }
  if (
    WHATSAPP_TYPES.has(input.type) &&
    user.whatsappNotifications &&
    user.phone
  ) {
    await sendWhatsApp({
      to: user.phone,
      text: `RVC Backstage — ${input.title}\n${link}`,
    });
  }
}

export async function notify(input: {
  userId: string;
  type: NotificationType;
  title: string;
  href?: string;
  /** set for cron-driven alerts so re-runs never duplicate */
  dedupKey?: string;
}): Promise<void> {
  const inserted = await db
    .insert(notifications)
    .values({
      userId: input.userId,
      type: input.type,
      title: input.title,
      href: input.href ?? "",
      dedupKey: input.dedupKey ?? null,
    })
    .onConflictDoNothing()
    .returning({ id: notifications.id });

  // fan out email/WhatsApp only when the in-app row is new (dedup holds
  // across channels); side channels never fail the caller
  if (inserted.length > 0) {
    await fanOutChannels({
      userId: input.userId,
      type: input.type,
      title: input.title,
      href: input.href ?? "",
    }).catch((error) => console.error("[notify] fan-out failed:", error));
  }
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
