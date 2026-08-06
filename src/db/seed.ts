import { eq, inArray } from "drizzle-orm";
import { hashPassword } from "@/lib/auth/password";
import { recomputeEventHealth } from "@/lib/events/service";
import { DIVISIONS } from "@/lib/org/divisions";
import { db } from "./index";
import {
  appSettings,
  approvals,
  approvalSteps,
  comments,
  divisionMembers,
  divisions,
  eventDivisions,
  events,
  handoffs,
  labels,
  notifications,
  profiles,
  taskAssignees,
  taskChecklistItems,
  taskDependencies,
  taskLabels,
  tasks,
  taskWatchers,
} from "./schema";
import {
  DEMO_APPROVALS,
  DEMO_COMMENTS,
  DEMO_EVENTS,
  DEMO_HANDOFFS,
  DEMO_LABELS,
  DEMO_NOTIFICATIONS,
  DEMO_PASSWORD,
  DEMO_TASKS,
  DEMO_USERS,
} from "./seed-data";

// Idempotent demo seed (DEV ONLY): fixed UUIDs + onConflictDoNothing, so
// re-running never duplicates. Checklists are delete+reinsert per seeded task
// (they have no fixed ids). Run: `pnpm seed`.

let userIdByEmail = new Map<string, string>();
const uid = (email: string): string => {
  const id = userIdByEmail.get(email);
  if (!id) throw new Error(`seed: unknown demo user ${email}`);
  return id;
};

const steps: Array<{ name: string; run: () => Promise<void> }> = [
  {
    name: "11 RVC divisions",
    run: async () => {
      await db
        .insert(divisions)
        .values(DIVISIONS.map((d, index) => ({ ...d, sortOrder: index })))
        .onConflictDoNothing();
    },
  },
  {
    name: `demo users + memberships (${DEMO_USERS.length})`,
    run: async () => {
      await db
        .insert(profiles)
        .values(
          DEMO_USERS.map((u) => ({
            email: u.email,
            name: u.name,
            role: u.role,
            passwordHash:
              u.role === "external" ? null : hashPassword(DEMO_PASSWORD),
          })),
        )
        .onConflictDoNothing();

      const rows = await db
        .select({ id: profiles.id, email: profiles.email })
        .from(profiles)
        .where(inArray(profiles.email, DEMO_USERS.map((u) => u.email)));
      userIdByEmail = new Map(rows.map((r) => [r.email, r.id]));

      const memberships = DEMO_USERS.flatMap((u) =>
        u.membership ? [{ ...u.membership, userId: uid(u.email) }] : [],
      );
      await db.insert(divisionMembers).values(memberships).onConflictDoNothing();
    },
  },
  {
    name: "default org settings",
    run: async () => {
      await db
        .insert(appSettings)
        .values([
          { key: "currency", value: "IDR" }, // Owner decision 2026-08-06
          // proposed defaults — Owner confirms final figures
          { key: "approval_threshold_a", value: 10_000_000 },
          { key: "approval_threshold_b", value: 100_000_000 },
          { key: "health_overdue_critical", value: 5 },
          { key: "health_committed_ratio_at_risk", value: 0.9 },
        ])
        .onConflictDoNothing();
    },
  },
  {
    name: `labels (${DEMO_LABELS.length})`,
    run: async () => {
      await db.insert(labels).values(DEMO_LABELS).onConflictDoNothing();
    },
  },
  {
    name: `demo events (${DEMO_EVENTS.length})`,
    run: async () => {
      const now = Date.now();
      await db
        .insert(events)
        .values(
          DEMO_EVENTS.map((e) => ({
            id: e.id,
            name: e.name,
            artists: e.artists,
            venue: e.venue,
            showDate: new Date(now + e.showOffsetHours * 3600_000),
            capacity: e.capacity,
            phase: e.phase,
          })),
        )
        .onConflictDoNothing();

      const allDivisions = await db.select({ id: divisions.id }).from(divisions);
      await db
        .insert(eventDivisions)
        .values(
          DEMO_EVENTS.flatMap((e) =>
            allDivisions.map((d) => ({ eventId: e.id, divisionId: d.id })),
          ),
        )
        .onConflictDoNothing();
    },
  },
  {
    name: `demo tasks (${DEMO_TASKS.length}) + assignees/watchers/labels/deps/checklists`,
    run: async () => {
      const now = Date.now();
      await db
        .insert(tasks)
        .values(
          DEMO_TASKS.map((t) => ({
            id: t.id,
            eventId: t.eventId,
            divisionId: t.divisionId,
            title: t.title,
            description: t.description ?? "",
            status: t.status,
            priority: t.priority ?? "medium",
            recurrence: t.recurrence ?? "none",
            dueDate:
              t.dueOffsetHours === null
                ? null
                : new Date(now + t.dueOffsetHours * 3600_000),
            completedAt:
              t.status === "done"
                ? new Date(now + (t.dueOffsetHours ?? 0) * 3600_000)
                : null,
          })),
        )
        .onConflictDoNothing();

      for (const t of DEMO_TASKS) {
        for (const email of t.assigneeEmails ?? []) {
          await db
            .insert(taskAssignees)
            .values({ taskId: t.id, userId: uid(email) })
            .onConflictDoNothing();
        }
        for (const email of t.watcherEmails ?? []) {
          await db
            .insert(taskWatchers)
            .values({ taskId: t.id, userId: uid(email) })
            .onConflictDoNothing();
        }
        for (const labelId of t.labelIds ?? []) {
          await db
            .insert(taskLabels)
            .values({ taskId: t.id, labelId })
            .onConflictDoNothing();
        }
        for (const dependsOnTaskId of t.dependsOn ?? []) {
          await db
            .insert(taskDependencies)
            .values({ taskId: t.id, dependsOnTaskId })
            .onConflictDoNothing();
        }
        if (t.checklist && t.checklist.length > 0) {
          await db
            .delete(taskChecklistItems)
            .where(eq(taskChecklistItems.taskId, t.id));
          await db.insert(taskChecklistItems).values(
            t.checklist.map((item, index) => ({
              taskId: t.id,
              title: item.title,
              done: item.done ?? false,
              sortOrder: index,
            })),
          );
        }
      }
    },
  },
  {
    name: `demo comments (${DEMO_COMMENTS.length})`,
    run: async () => {
      await db
        .insert(comments)
        .values(
          DEMO_COMMENTS.map((c) => ({
            id: c.id,
            taskId: c.taskId,
            authorId: uid(c.authorEmail),
            body: c.body,
            mentions: (c.mentionEmails ?? []).map(uid),
          })),
        )
        .onConflictDoNothing();
    },
  },
  {
    name: `demo handoffs (${DEMO_HANDOFFS.length})`,
    run: async () => {
      await db
        .insert(handoffs)
        .values(
          DEMO_HANDOFFS.map((h) => ({
            id: h.id,
            eventId: h.eventId,
            fromDivisionId: h.fromDivisionId,
            toDivisionId: h.toDivisionId,
            title: h.title,
            note: h.note ?? "",
            status: h.status,
            requestedBy: uid(h.requestedByEmail),
            decidedBy: h.decidedByEmail ? uid(h.decidedByEmail) : null,
            decidedAt: h.status === "pending" ? null : new Date(),
            originTaskId: h.originTaskId ?? null,
            createdTaskId: h.createdTaskId ?? null,
          })),
        )
        .onConflictDoNothing();

      // accepted handoff links origin task to the created task
      for (const h of DEMO_HANDOFFS) {
        if (h.status === "accepted" && h.originTaskId && h.createdTaskId) {
          await db
            .insert(taskDependencies)
            .values({ taskId: h.originTaskId, dependsOnTaskId: h.createdTaskId })
            .onConflictDoNothing();
        }
      }
    },
  },
  {
    name: `demo notifications (${DEMO_NOTIFICATIONS.length})`,
    run: async () => {
      await db
        .insert(notifications)
        .values(
          DEMO_NOTIFICATIONS.map((n) => ({
            userId: uid(n.userEmail),
            type: n.type,
            title: n.title,
            href: n.href,
            dedupKey: n.dedupKey,
          })),
        )
        .onConflictDoNothing();
    },
  },
  {
    name: `demo approvals (${DEMO_APPROVALS.length})`,
    run: async () => {
      for (const a of DEMO_APPROVALS) {
        const inserted = await db
          .insert(approvals)
          .values({
            id: a.id,
            type: a.type,
            title: a.title,
            description: a.description ?? "",
            amount: a.amount ?? null,
            divisionId: a.divisionId,
            eventId: a.eventId ?? null,
            requestedBy: uid(a.requestedByEmail),
          })
          .onConflictDoNothing()
          .returning({ id: approvals.id });
        // steps have random ids — only create them alongside a fresh approval
        if (inserted.length > 0) {
          await db.insert(approvalSteps).values(
            a.chain.map((approverRole, index) => ({
              approvalId: a.id,
              index,
              approverRole,
              status: index === 0 ? ("pending" as const) : ("waiting" as const),
            })),
          );
        }
      }
    },
  },
  {
    name: "recompute event health",
    run: async () => {
      for (const e of DEMO_EVENTS) {
        await recomputeEventHealth(e.id);
      }
    },
  },
];

async function main() {
  for (const step of steps) {
    await step.run();
    console.log(`[seed] ${step.name} ✓`);
  }
  console.log("[seed] done");
  process.exit(0);
}

main().catch((error) => {
  console.error("[seed] failed:", error);
  process.exit(1);
});
