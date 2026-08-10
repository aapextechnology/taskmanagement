// WhatsApp message templates (EPIC-015 T-151).
//
// Pure string builders — no I/O — so the wording is unit-testable and lives
// in ONE place to edit. Every template carries the three things a person
// needs on their phone: who it is for, which task, and a link to open it.
//
// WhatsApp formatting: *bold*, _italic_. Keep messages short — this is a
// personal channel, not a report.

export interface TaskMessageContext {
  /** the person receiving the message */
  recipientName: string;
  taskTitle: string;
  eventName: string;
  /** absolute URL to the task */
  url: string;
}

/** First name only — a WhatsApp message greeting a full legal name reads odd. */
function firstName(fullName: string): string {
  const clean = fullName.trim();
  if (!clean) return "there";
  return clean.split(/\s+/)[0];
}

/**
 * Sent when someone is made the Lead/PIC of a task — the person accountable
 * for it, as opposed to the people working on it.
 */
export function taskAssignedLeadMessage(ctx: TaskMessageContext): string {
  return [
    `Hi ${firstName(ctx.recipientName)}, you are now the *lead (PIC)* of a task.`,
    "",
    `*${ctx.taskTitle}*`,
    `Event: ${ctx.eventName}`,
    "",
    `Open it: ${ctx.url}`,
  ].join("\n");
}

/** Sent to each person added to a task's assignee list. */
export function taskAssignedMemberMessage(ctx: TaskMessageContext): string {
  return [
    `Hi ${firstName(ctx.recipientName)}, you have been *assigned a task*.`,
    "",
    `*${ctx.taskTitle}*`,
    `Event: ${ctx.eventName}`,
    "",
    `Open it: ${ctx.url}`,
  ].join("\n");
}

export interface UrgentMessageContext extends TaskMessageContext {
  /** one clause explaining the escalation, rendered after "Why:" */
  reason: string;
}

/**
 * Sent to the Lead/PIC the moment a task they own reaches priority URGENT —
 * whether a human raised it or the dependency engine auto-escalated it.
 */
export function taskUrgentMessage(ctx: UrgentMessageContext): string {
  return [
    `Hi ${firstName(ctx.recipientName)}, a task you lead is now *URGENT*.`,
    "",
    `*${ctx.taskTitle}*`,
    `Event: ${ctx.eventName}`,
    `Why: ${ctx.reason}.`,
    "",
    `Open it: ${ctx.url}`,
  ].join("\n");
}

/** Reason clause for a priority a person set by hand. */
export function manualUrgentReason(actorName: string): string {
  const who = actorName.trim();
  return who ? `raised to urgent by ${who}` : "raised to urgent";
}

/**
 * Reason clause for the dependency engine's auto-escalation (EPIC-012):
 * enough other work is blocked on this task that it became critical.
 */
export function autoUrgentReason(input: {
  waiters: number;
  overdue: boolean;
}): string {
  const blocked =
    input.waiters === 1
      ? "1 other task is waiting on it"
      : `${input.waiters} other tasks are waiting on it`;
  return input.overdue
    ? `${blocked}, and it is past its due date`
    : blocked;
}
