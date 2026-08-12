import type { Actor } from "@/lib/permissions";

// Cross-division task visibility (Owner 2026-08-11).
//
// The default flipped: a task in a shared event is visible to every division
// on it, because a shared event needs a shared picture. A division head can
// seal an individual task when creating it — for the handful that genuinely
// should not travel ("renegotiate the artist fee").
//
// Pure, so the matrix is testable without a database.

export interface TaskSubject {
  id: string;
  role: Actor["role"];
  divisionIds: readonly string[];
  headOf: readonly string[];
}

export function subjectOf(actor: Actor): TaskSubject {
  return {
    id: actor.id,
    role: actor.role,
    divisionIds: actor.memberships.map((m) => m.divisionId),
    headOf: actor.memberships
      .filter((m) => m.role === "head")
      .map((m) => m.divisionId),
  };
}

export interface TaskFacts {
  divisionId: string;
  restricted: boolean;
  leadId: string | null;
  assigneeIds: readonly string[];
  watcherIds?: readonly string[];
}

/**
 * Can this person see this task?
 *
 * A sealed task still reaches the people doing it, whatever division they
 * belong to — otherwise assigning across divisions would create work its
 * owner cannot open, which reads as a bug and gets worked around.
 */
export function canSeeTask(subject: TaskSubject, task: TaskFacts): boolean {
  if (subject.role === "external") return false;
  if (subject.role === "owner" || subject.role === "admin") return true;
  if (!task.restricted) return true;
  if (subject.divisionIds.includes(task.divisionId)) return true;
  if (task.leadId === subject.id) return true;
  if (task.assigneeIds.includes(subject.id)) return true;
  return (task.watcherIds ?? []).includes(subject.id);
}

/**
 * Who may seal a task: the head of the division it belongs to, and
 * leadership. Staff cannot hide their own work from the rest of the event —
 * the lock is a management decision, not a personal one.
 */
export function canRestrictTask(subject: TaskSubject, divisionId: string): boolean {
  if (subject.role === "owner" || subject.role === "admin") return true;
  return subject.headOf.includes(divisionId);
}

// ---- SQL side --------------------------------------------------------------

/**
 * A drizzle condition for "tasks this person may see". Returns undefined for
 * leadership so the caller leaves its `where` untouched.
 *
 * Kept beside the pure rule on purpose: two copies of a visibility rule drift,
 * and the one that drifts is always the one nobody tests.
 */
export function taskScopeCondition(subject: TaskSubject) {
  if (subject.role === "owner" || subject.role === "admin") return undefined;
  return { subject };
}
