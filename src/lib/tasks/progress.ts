import type { TaskStatus } from "@/lib/tasks/service";

// THE task-progress rule, in one place. The dashboard card and the Owner's
// progress-report PDF both call this, so the same event can never show two
// different percentages on two surfaces.
//
// Progress measures *committed* work: backlog is excluded from the
// denominator because a backlog item is an idea, not a commitment, and
// cancelled work is excluded because it will never be done.
//
//   pct = done / (total - backlog - cancelled)
//
// Two guards make the number safe to put on a cockpit:
//
//   1. `backlog` is always returned alongside, and the UI shows it, so
//      "100%" can never be misread as "nothing left to do".
//   2. With no committed work at all, pct is `null` — "not planned yet" —
//      rather than a meaningless 0% or a dishonest 100%.

export interface TaskProgress {
  /** finished tasks */
  done: number;
  /** the denominator: everything committed to the plan, done or not */
  committed: number;
  /** not counted in the percentage, but always shown next to it */
  backlog: number;
  /** never counted anywhere — cancelled work does not exist for progress */
  cancelled: number;
  /** every task on the event, whatever its status */
  total: number;
  /** null when nothing is committed yet */
  pct: number | null;
}

export type StatusCounts = Partial<Record<TaskStatus, number>>;

export function summarizeTaskProgress(counts: StatusCounts): TaskProgress {
  const at = (status: TaskStatus) => counts[status] ?? 0;

  const done = at("done");
  const backlog = at("backlog");
  const cancelled = at("cancelled");
  const total =
    backlog +
    cancelled +
    done +
    at("todo") +
    at("in_progress") +
    at("in_review") +
    at("blocked");

  // blocked work stays in the denominator on purpose: it is committed and
  // unfinished, which is exactly what the Owner needs the bar to reflect
  const committed = total - backlog - cancelled;

  return {
    done,
    committed,
    backlog,
    cancelled,
    total,
    pct: committed > 0 ? Math.round((done / committed) * 100) : null,
  };
}

/** Rolls a list of task statuses up into the same summary. */
export function summarizeStatuses(statuses: TaskStatus[]): TaskProgress {
  const counts: StatusCounts = {};
  for (const status of statuses) counts[status] = (counts[status] ?? 0) + 1;
  return summarizeTaskProgress(counts);
}
