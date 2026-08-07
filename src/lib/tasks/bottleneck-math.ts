// Pure bottleneck rules (EPIC-012 T-121) — Owner decisions 2026-08-07.
// Direction: a task's criticality comes from FAN-IN (open tasks waiting on
// it), never from how many things it waits on itself.

export type BottleneckLevel = "none" | "bottleneck" | "critical";

export interface BottleneckInput {
  /** open (not done/cancelled) tasks that depend on this task */
  openWaiters: number;
  /** this task's own due date has passed (and it isn't done/cancelled) */
  overdue: boolean;
  /** this task's own status is `blocked` */
  blocked: boolean;
}

/** Critical = ≥3 open waiters, OR ≥1 waiter while the blocker itself is
 *  overdue or blocked. 1–2 waiters = plain bottleneck. */
export function bottleneckLevel(input: BottleneckInput): BottleneckLevel {
  if (input.openWaiters <= 0) return "none";
  if (input.openWaiters >= 3) return "critical";
  if (input.overdue || input.blocked) return "critical";
  return "bottleneck";
}

export type Priority = "low" | "medium" | "high" | "urgent";

export interface BumpState {
  priority: Priority;
  priorityBeforeAuto: Priority | null;
  autoUrgentAt: Date | null;
}

export type BumpAction =
  | { kind: "none" }
  | { kind: "bump"; set: { priority: "urgent"; priorityBeforeAuto: Priority; autoUrgentAt: Date } }
  | { kind: "revert"; set: { priority: Priority; priorityBeforeAuto: null; autoUrgentAt: null } }
  | { kind: "clear"; set: { priorityBeforeAuto: null; autoUrgentAt: null } };

/** The auto-bump / auto-revert decision table. Manual edits always win:
 *  a human priority change clears the auto flags elsewhere, and a priority
 *  that no longer matches the bump is treated as manual (flags just clear). */
export function decideBump(
  level: BottleneckLevel,
  state: BumpState,
  now: Date,
): BumpAction {
  const bumped = state.autoUrgentAt !== null;
  if (level === "critical") {
    if (bumped) return { kind: "none" }; // already ours
    if (state.priority === "urgent") return { kind: "none" }; // human beat us to it
    return {
      kind: "bump",
      set: {
        priority: "urgent",
        priorityBeforeAuto: state.priority,
        autoUrgentAt: now,
      },
    };
  }
  // not critical (anymore)
  if (!bumped) return { kind: "none" };
  if (state.priority !== "urgent") {
    // human changed priority after our bump — their value stands
    return { kind: "clear", set: { priorityBeforeAuto: null, autoUrgentAt: null } };
  }
  return {
    kind: "revert",
    set: {
      priority: state.priorityBeforeAuto ?? "medium",
      priorityBeforeAuto: null,
      autoUrgentAt: null,
    },
  };
}
