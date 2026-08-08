import {
  STATUS_LABELS,
  TASK_STATUS_ORDER,
  type TaskStatus,
} from "@/lib/tasks/service";
import { summarizeStatuses, type TaskProgress } from "@/lib/tasks/progress";

// Event-page task summary (Owner 2026-08-07). Lives outside the component
// because it reads the clock (react-hooks purity rule bans that in render).

export interface EventTaskSummary {
  progress: TaskProgress;
  overdueCount: number;
  statusMix: Array<{ status: TaskStatus; label: string; count: number }>;
  divisions: Array<{
    id: string;
    name: string;
    total: number;
    done: number;
    overdue: number;
  }>;
}

export function buildEventTaskSummary(
  tasks: Array<{ status: TaskStatus; divisionId: string; dueDate: Date | null }>,
  divisions: Array<{ id: string; name: string }>,
): EventTaskSummary {
  const now = Date.now();
  const isOpen = (s: TaskStatus) => s !== "done" && s !== "cancelled";
  const isOverdue = (t: { status: TaskStatus; dueDate: Date | null }) =>
    isOpen(t.status) && t.dueDate !== null && t.dueDate.getTime() < now;

  return {
    progress: summarizeStatuses(tasks.map((t) => t.status)),
    overdueCount: tasks.filter(isOverdue).length,
    statusMix: TASK_STATUS_ORDER.map((status) => ({
      status,
      label: STATUS_LABELS[status],
      count: tasks.filter((t) => t.status === status).length,
    })).filter((s) => s.count > 0),
    divisions: divisions
      .map((division) => {
        const mine = tasks.filter((t) => t.divisionId === division.id);
        return {
          id: division.id,
          name: division.name,
          total: mine.length,
          done: mine.filter((t) => t.status === "done").length,
          overdue: mine.filter(isOverdue).length,
        };
      })
      .filter((d) => d.total > 0),
  };
}
