import { and, eq, inArray, isNull } from "drizzle-orm";
import { hashPassword } from "@/lib/auth/password";
import { DEFAULT_PHASES, recomputeEventHealth } from "@/lib/events/service";
import { DIVISIONS } from "@/lib/org/divisions";
import { db } from "./index";
import {
  appSettings,
  approvals,
  approvalSteps,
  budgetLines,
  budgets,
  comments,
  expenseRequests,
  divisionMembers,
  divisions,
  eventDivisions,
  eventPhases,
  events,
  eventTemplateItems,
  eventTemplates,
  externalInvites,
  runOfShowItems,
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
  ticketSalesSnapshots,
} from "./schema";
import {
  DEMO_APPROVALS,
  DEMO_BUDGETS,
  DEMO_COMMENTS,
  DEMO_EVENTS,
  DEMO_EXPENSES,
  DEMO_GUEST_TOKEN,
  DEMO_INVITE,
  DEMO_TICKET_DAYS,
  EVENT_IDS,
  PLAYBOOK_ITEMS,
  PLAYBOOK_TEMPLATE_ID,
  DEMO_RUN_OF_SHOW,
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
      for (const label of DEMO_LABELS) {
        await db
          .insert(labels)
          .values(label)
          .onConflictDoUpdate({
            target: labels.name,
            set: { color: label.color },
          });
      }
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

      // per-event workflow: seed defaults + point current phase by name
      for (const e of DEMO_EVENTS) {
        await db
          .insert(eventPhases)
          .values(
            DEFAULT_PHASES.map((name, index) => ({
              eventId: e.id,
              name,
              sortOrder: index,
            })),
          )
          .onConflictDoNothing();
        const [current] = await db
          .select({ id: eventPhases.id })
          .from(eventPhases)
          .where(
            and(eq(eventPhases.eventId, e.id), eq(eventPhases.name, e.currentPhase)),
          )
          .limit(1);
        if (current) {
          await db
            .update(events)
            .set({ currentPhaseId: current.id })
            .where(and(eq(events.id, e.id), isNull(events.currentPhaseId)));
        }
      }
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
    name: `demo budgets (${DEMO_BUDGETS.length}) + expenses (${DEMO_EXPENSES.length})`,
    run: async () => {
      for (const b of DEMO_BUDGETS) {
        // one budget per event (unique) — a row may already exist with a
        // different id, so resolve the real id instead of assuming ours
        await db
          .insert(budgets)
          .values({ id: b.id, eventId: b.eventId })
          .onConflictDoNothing();
        const [budget] = await db
          .select({ id: budgets.id })
          .from(budgets)
          .where(eq(budgets.eventId, b.eventId))
          .limit(1);
        await db
          .insert(budgetLines)
          .values(
            b.lines.map((l) => ({
              id: l.id,
              budgetId: budget.id,
              divisionId: l.divisionId,
              name: l.name,
              plannedAmount: l.plannedAmount,
            })),
          )
          .onConflictDoNothing();
      }
      await db
        .insert(expenseRequests)
        .values(
          DEMO_EXPENSES.map((e) => ({
            id: e.id,
            approvalId: e.approvalId,
            eventId: e.eventId,
            divisionId: e.divisionId,
            budgetLineId: e.budgetLineId ?? null,
            title: e.title,
            vendor: e.vendor ?? "",
            amount: e.amount,
            requestedBy: uid(e.requestedByEmail),
          })),
        )
        .onConflictDoNothing();
    },
  },
  {
    name: "demo guest invite (magic link)",
    run: async () => {
      const { createHash } = await import("node:crypto");
      const [event] = await db
        .select({ showDate: events.showDate })
        .from(events)
        .where(eq(events.id, DEMO_INVITE.eventId))
        .limit(1);
      const expiresAt = new Date(
        (event?.showDate.getTime() ?? Date.now()) + 21 * 86_400_000,
      );
      await db
        .insert(externalInvites)
        .values({
          id: DEMO_INVITE.id,
          profileId: uid(DEMO_INVITE.guestEmail),
          eventId: DEMO_INVITE.eventId,
          divisionId: DEMO_INVITE.divisionId,
          requestedForms: [...DEMO_INVITE.requestedForms],
          tokenHash: createHash("sha256").update(DEMO_GUEST_TOKEN).digest("hex"),
          expiresAt,
          invitedBy: uid("head.production@rawvision.demo"),
        })
        .onConflictDoNothing();
      console.log(
        `[seed]   guest magic link: /guest/login?token=${DEMO_GUEST_TOKEN}`,
      );
    },
  },
  {
    name: `demo run of show (${DEMO_RUN_OF_SHOW.length} items)`,
    run: async () => {
      await db
        .insert(runOfShowItems)
        .values(
          DEMO_RUN_OF_SHOW.map((item) => ({
            id: item.id,
            eventId: item.eventId,
            startTime: item.startTime,
            durationMinutes: item.durationMinutes ?? null,
            title: item.title,
            note: item.note ?? "",
          })),
        )
        .onConflictDoNothing();
    },
  },
  {
    name: `"International Concert" playbook (${PLAYBOOK_ITEMS.length} items)`,
    run: async () => {
      await db
        .insert(eventTemplates)
        .values({
          id: PLAYBOOK_TEMPLATE_ID,
          name: "International Concert",
          description:
            "Standard checklist for an international-scale concert — every division, lead times counted back from show day.",
        })
        .onConflictDoNothing();
      await db
        .insert(eventTemplateItems)
        .values(
          PLAYBOOK_ITEMS.map((item, index) => ({
            id: item.id,
            templateId: PLAYBOOK_TEMPLATE_ID,
            divisionId: item.divisionId,
            title: item.title,
            priority: item.priority,
            offsetDays: item.offsetDays,
            sortOrder: index,
          })),
        )
        .onConflictDoNothing();
    },
  },
  {
    name: `demo ticket snapshots (${DEMO_TICKET_DAYS.length} days)`,
    run: async () => {
      const [event] = await db
        .select({ showDate: events.showDate })
        .from(events)
        .where(eq(events.id, EVENT_IDS.neonHorizon))
        .limit(1);
      if (!event) return;
      const { wibDayKey } = await import("@/lib/tickets/service");
      await db
        .insert(ticketSalesSnapshots)
        .values(
          DEMO_TICKET_DAYS.map((d) => ({
            eventId: EVENT_IDS.neonHorizon,
            day: wibDayKey(
              new Date(event.showDate.getTime() - d.offsetFromShowDays * 86_400_000),
            ),
            ticketsSold: d.ticketsSold,
            revenue: d.revenue,
            recordedBy: uid("head.ticketing@rawvision.demo"),
          })),
        )
        .onConflictDoNothing();
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
