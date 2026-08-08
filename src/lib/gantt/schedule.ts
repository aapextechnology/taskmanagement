import { toWibParts } from "@/lib/tasks/dates";
import type { TaskStatus } from "@/lib/tasks/service";

// T-080: pure Gantt scheduling — no DB/permission access here. Callers (the
// per-event Gantt page) fetch already-permission-scoped tasks/dependencies
// via the service layer and hand them to this module to compute
// bars/arrows/critical path. Mirrors src/lib/calendar/aggregate.ts (WIB
// conventions via toWibParts, explicit UTC instants in tests so assertions
// are host-TZ independent).

export interface GanttTask {
  id: string;
  status: TaskStatus;
  startDate: Date | null;
  dueDate: Date | null;
}

// row = taskId is BLOCKED BY dependsOnTaskId (mirrors db/schema/tasks.ts
// taskDependencies).
export interface GanttDependency {
  taskId: string;
  dependsOnTaskId: string;
}

export interface GanttBar {
  taskId: string;
  start: Date;
  end: Date;
}

export interface GanttArrow {
  from: string;
  to: string;
}

export interface GanttModel {
  bars: GanttBar[];
  arrows: GanttArrow[];
  /** first-to-last order along the longest (critical) chain */
  criticalTaskIds: string[];
  /** ids of non-cancelled tasks with neither startDate nor dueDate */
  unscheduled: string[];
}

/**
 * WIB (Asia/Jakarta, UTC+7) calendar-day index for an instant, as an
 * absolute day number (or, when `origin` is given, the offset in whole WIB
 * days from that origin). Same 17:00Z rollover convention as
 * src/lib/calendar/aggregate.ts's dayKey.
 */
export function wibDayIndex(date: Date, origin?: Date): number {
  const dayNumber = (d: Date) => {
    const { y, m, d: day } = toWibParts(d);
    return Math.floor(Date.UTC(y, m, day) / 86_400_000);
  };
  return origin === undefined
    ? dayNumber(date)
    : dayNumber(date) - dayNumber(origin);
}

export function buildGanttModel({
  tasks,
  dependencies,
  showDate,
}: {
  tasks: GanttTask[];
  dependencies: GanttDependency[];
  // reserved for callers building the visible day range around the bars;
  // not consumed by the pure model itself today.
  showDate: Date;
}): GanttModel {
  void showDate;

  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const bars: GanttBar[] = [];
  const barsByTaskId = new Map<string, GanttBar>();
  const unscheduled: string[] = [];

  for (const task of tasks) {
    if (task.status === "cancelled") continue;
    if (!task.startDate && !task.dueDate) {
      unscheduled.push(task.id);
      continue;
    }
    const start = task.startDate ?? task.dueDate!;
    const end = task.dueDate ?? task.startDate!;
    const bar: GanttBar = { taskId: task.id, start, end };
    bars.push(bar);
    barsByTaskId.set(task.id, bar);
  }

  const arrows: GanttArrow[] = dependencies
    .filter(
      (d) => barsByTaskId.has(d.taskId) && barsByTaskId.has(d.dependsOnTaskId),
    )
    .map((d) => ({ from: d.dependsOnTaskId, to: d.taskId }));

  // critical-path eligibility: has a bar, and not done/cancelled (cancelled
  // is already excluded from bars above).
  const eligibleIds = new Set(
    bars
      .filter((b) => taskById.get(b.taskId)?.status !== "done")
      .map((b) => b.taskId),
  );

  const predecessorsOf = new Map<string, string[]>();
  for (const d of dependencies) {
    if (!eligibleIds.has(d.dependsOnTaskId)) continue;
    const list = predecessorsOf.get(d.taskId) ?? [];
    list.push(d.dependsOnTaskId);
    predecessorsOf.set(d.taskId, list);
  }

  function walkBackward(startId: string): string[] {
    const visited = new Set([startId]);
    const chain = [startId];
    let current = startId;
    for (;;) {
      const candidates = (predecessorsOf.get(current) ?? []).filter(
        (id) => !visited.has(id),
      );
      if (candidates.length === 0) break;
      // among the (rare) multiple predecessors, follow the one that finishes
      // latest — the classic critical-path "longest path in" heuristic.
      // Ties break by longer own duration, then id, so the chosen path never
      // depends on DB row order.
      let next = candidates[0];
      for (const cand of candidates.slice(1)) {
        const nextBar = barsByTaskId.get(next)!;
        const candBar = barsByTaskId.get(cand)!;
        const endDiff = candBar.end.getTime() - nextBar.end.getTime();
        const durDiff =
          candBar.end.getTime() -
          candBar.start.getTime() -
          (nextBar.end.getTime() - nextBar.start.getTime());
        if (endDiff > 0 || (endDiff === 0 && (durDiff > 0 || (durDiff === 0 && cand < next)))) {
          next = cand;
        }
      }
      chain.push(next);
      visited.add(next);
      current = next;
    }
    return chain.reverse();
  }

  function chainDuration(chain: string[]): number {
    return chain.reduce((sum, id) => {
      const bar = barsByTaskId.get(id)!;
      return sum + (bar.end.getTime() - bar.start.getTime());
    }, 0);
  }

  const eligibleBars = bars.filter((b) => eligibleIds.has(b.taskId));
  let criticalTaskIds: string[] = [];
  if (eligibleBars.length > 0) {
    const maxEnd = Math.max(...eligibleBars.map((b) => b.end.getTime()));
    const endpointCandidates = eligibleBars.filter(
      (b) => b.end.getTime() === maxEnd,
    );

    let bestChain: string[] = [];
    let bestDuration = -1;
    for (const candidate of endpointCandidates) {
      const chain = walkBackward(candidate.taskId);
      const duration = chainDuration(chain);
      if (duration > bestDuration) {
        bestDuration = duration;
        bestChain = chain;
      }
    }
    criticalTaskIds = bestChain;
  }

  return { bars, arrows, criticalTaskIds, unscheduled };
}
