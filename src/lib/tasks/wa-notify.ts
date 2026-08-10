import { eq } from "drizzle-orm";
import { db } from "@/db";
import { events, profiles, tasks } from "@/db/schema";
import { env } from "@/lib/env";
import { notify } from "@/lib/notifications";
import {
  autoUrgentReason,
  manualUrgentReason,
  taskAssignedLeadMessage,
  taskAssignedMemberMessage,
  taskUrgentMessage,
} from "@/lib/whatsapp/templates";

// Bridge between task mutations and the WhatsApp templates (EPIC-015 T-151).
//
// Lives apart from service.ts so dependency-engine.ts can use it too without
// importing back into service.ts (service.ts already imports the engine).
//
// Every function here fails soft: a notification must never break the
// mutation that triggered it.

interface TaskContext {
  taskTitle: string;
  eventName: string;
  url: string;
}

async function taskContext(taskId: string): Promise<TaskContext | null> {
  const [row] = await db
    .select({ title: tasks.title, eventName: events.name })
    .from(tasks)
    .innerJoin(events, eq(tasks.eventId, events.id))
    .where(eq(tasks.id, taskId))
    .limit(1);
  if (!row) return null;
  return {
    taskTitle: row.title,
    eventName: row.eventName,
    url: `${env.APP_URL}/tasks/${taskId}`,
  };
}

/** The person made Lead/PIC of a task. */
export async function notifyLeadAssigned(
  taskId: string,
  userId: string,
): Promise<void> {
  const ctx = await taskContext(taskId);
  await notify({
    userId,
    type: "assigned",
    title: "You are the lead (PIC) of a task",
    href: `/tasks/${taskId}`,
    waText: ctx
      ? ({ recipientName }) =>
          taskAssignedLeadMessage({ recipientName, ...ctx })
      : undefined,
  });
}

/** A person added to a task's assignee list. */
export async function notifyMemberAssigned(
  taskId: string,
  userId: string,
): Promise<void> {
  const ctx = await taskContext(taskId);
  await notify({
    userId,
    type: "assigned",
    title: "You were assigned a task",
    href: `/tasks/${taskId}`,
    waText: ctx
      ? ({ recipientName }) =>
          taskAssignedMemberMessage({ recipientName, ...ctx })
      : undefined,
  });
}

/**
 * A task reached priority URGENT. Goes to the Lead/PIC only — they are the
 * accountable person, and blasting every assignee would make the alert cheap.
 * No-ops when the task has no lead, or when the lead caused it themselves.
 */
export async function notifyPriorityUrgent(
  taskId: string,
  source:
    | { kind: "manual"; actorId: string }
    | { kind: "auto"; waiters: number; overdue: boolean },
): Promise<void> {
  const [task] = await db
    .select({ leadId: tasks.leadId })
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1);
  const leadId = task?.leadId;
  if (!leadId) return; // nobody accountable yet — nothing to send
  if (source.kind === "manual" && source.actorId === leadId) return; // they just did it

  const ctx = await taskContext(taskId);
  let reason: string;
  if (source.kind === "auto") {
    reason = autoUrgentReason(source);
  } else {
    const [actor] = await db
      .select({ name: profiles.name })
      .from(profiles)
      .where(eq(profiles.id, source.actorId))
      .limit(1);
    reason = manualUrgentReason(actor?.name ?? "");
  }

  await notify({
    userId: leadId,
    type: "priority_urgent",
    title: "A task you lead is now urgent",
    href: `/tasks/${taskId}`,
    waText: ctx
      ? ({ recipientName }) => taskUrgentMessage({ recipientName, reason, ...ctx })
      : undefined,
  });
}
