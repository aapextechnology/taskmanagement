"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateStatusAction } from "@/app/(app)/tasks/actions";
import { cn } from "@/lib/utils";

const COLUMNS = [
  { key: "backlog", label: "Backlog" },
  { key: "todo", label: "To do" },
  { key: "in_progress", label: "In progress" },
  { key: "in_review", label: "In review" },
  { key: "blocked", label: "Blocked" },
  { key: "done", label: "Done" },
] as const;

type StatusKey = (typeof COLUMNS)[number]["key"];

export interface KanbanTask {
  id: string;
  title: string;
  status: StatusKey;
  priority: "low" | "medium" | "high" | "urgent";
  dueDate: string | null;
  assignees: Array<{ id: string; name: string }>;
}

const PRIORITY_MARK: Record<KanbanTask["priority"], string> = {
  low: "▁",
  medium: "▃",
  high: "▅",
  urgent: "█",
};

// Native HTML5 drag & drop — no library. Drop persists via server action.
export function KanbanBoard({ tasks }: { tasks: KanbanTask[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<StatusKey | null>(null);
  // optimistic status overrides while the server action runs
  const [overrides, setOverrides] = useState<Record<string, StatusKey>>({});

  const drop = (status: StatusKey) => {
    if (!dragId) return;
    const id = dragId;
    setDragId(null);
    setOverColumn(null);
    setOverrides((prev) => ({ ...prev, [id]: status }));
    const formData = new FormData();
    formData.set("taskId", id);
    formData.set("status", status);
    startTransition(async () => {
      await updateStatusAction(formData);
      router.refresh();
    });
  };

  const statusOf = (task: KanbanTask) => overrides[task.id] ?? task.status;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {COLUMNS.map((column) => {
        const items = tasks.filter((t) => statusOf(t) === column.key);
        return (
          <div
            key={column.key}
            onDragOver={(e) => {
              e.preventDefault();
              setOverColumn(column.key);
            }}
            onDragLeave={() => setOverColumn(null)}
            onDrop={() => drop(column.key)}
            className={cn(
              "flex min-h-64 flex-col gap-2 rounded-md border p-2",
              overColumn === column.key && "border-foreground/50 bg-accent/40",
            )}
          >
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {column.label}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {items.length}
              </span>
            </div>
            {items.map((task) => (
              <Link
                key={task.id}
                href={`/tasks/${task.id}`}
                draggable
                onDragStart={() => setDragId(task.id)}
                onDragEnd={() => setDragId(null)}
                className={cn(
                  "flex cursor-grab flex-col gap-1 rounded-sm border bg-card p-2.5 text-xs hover:border-foreground/40 active:cursor-grabbing",
                  dragId === task.id && "opacity-50",
                )}
              >
                <span className="font-medium leading-snug">{task.title}</span>
                <span className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span title={`priority: ${task.priority}`}>
                    {PRIORITY_MARK[task.priority]}
                  </span>
                  {task.dueDate ? (
                    <span>
                      {new Date(task.dueDate).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        timeZone: "Asia/Jakarta",
                      })}
                    </span>
                  ) : null}
                  {task.assignees.length > 0 ? (
                    <span className="ml-auto flex gap-1">
                      {task.assignees.slice(0, 3).map((a) => (
                        <span
                          key={a.id}
                          title={a.name}
                          className="flex size-4 items-center justify-center rounded-full border text-[8px] uppercase"
                        >
                          {a.name
                            .split(" ")
                            .map((p) => p[0])
                            .slice(0, 2)
                            .join("")}
                        </span>
                      ))}
                    </span>
                  ) : null}
                </span>
              </Link>
            ))}
          </div>
        );
      })}
    </div>
  );
}
