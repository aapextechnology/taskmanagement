"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateStatusAction } from "@/app/(app)/tasks/actions";
import {
  AvatarStack,
  PriorityIcon,
  StatusDot,
  STATUS_TEXT,
  type StatusKey,
} from "@/components/task-meta";
import { cn } from "@/lib/utils";

const COLUMNS: StatusKey[] = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "blocked",
  "done",
];

export interface KanbanTask {
  id: string;
  title: string;
  status: StatusKey;
  priority: "low" | "medium" | "high" | "urgent";
  dueDate: string | null;
  assignees: Array<{ id: string; name: string }>;
}

// Native HTML5 drag & drop — no library. Drop persists via server action;
// clicking a card opens the peek drawer (intercepted /tasks/[id]).
export function KanbanBoard({ tasks }: { tasks: KanbanTask[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<StatusKey | null>(null);
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
  // captured once per mount — overdue highlighting doesn't need live ticking
  const [now] = useState(() => Date.now());

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {COLUMNS.map((column) => {
        const items = tasks.filter((t) => statusOf(t) === column);
        return (
          <div
            key={column}
            onDragOver={(e) => {
              e.preventDefault();
              setOverColumn(column);
            }}
            onDragLeave={() => setOverColumn(null)}
            onDrop={() => drop(column)}
            className={cn(
              "flex min-h-72 w-64 shrink-0 flex-col gap-2 rounded-lg bg-muted/40 p-2 transition-colors",
              overColumn === column && "bg-accent ring-1 ring-foreground/20",
            )}
          >
            <div className="flex items-center gap-2 px-1.5 py-1">
              <StatusDot status={column} />
              <span className="text-xs font-medium">{STATUS_TEXT[column]}</span>
              <span className="ml-auto rounded-full bg-background px-1.5 text-[10px] tabular-nums text-muted-foreground">
                {items.length}
              </span>
            </div>
            <div className="flex flex-1 flex-col gap-2">
              {items.map((task) => {
                const overdue =
                  task.dueDate !== null &&
                  new Date(task.dueDate).getTime() < now &&
                  statusOf(task) !== "done";
                return (
                  <Link
                    key={task.id}
                    href={`/tasks/${task.id}`}
                    draggable
                    onDragStart={() => setDragId(task.id)}
                    onDragEnd={() => setDragId(null)}
                    className={cn(
                      "group flex cursor-grab flex-col gap-2 rounded-md border bg-card p-3 shadow-xs transition-all hover:border-foreground/25 hover:shadow-sm active:cursor-grabbing",
                      dragId === task.id && "rotate-1 opacity-60",
                    )}
                  >
                    <span className="text-[13px] font-medium leading-snug">
                      {task.title}
                    </span>
                    <span className="flex items-center gap-2">
                      <PriorityIcon priority={task.priority} />
                      {task.dueDate ? (
                        <span
                          className={cn(
                            "rounded-sm border px-1.5 py-px text-[10px] tabular-nums",
                            overdue
                              ? "border-priority-urgent/40 text-priority-urgent"
                              : "text-muted-foreground",
                          )}
                        >
                          {new Date(task.dueDate).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            timeZone: "Asia/Jakarta",
                          })}
                        </span>
                      ) : null}
                      <AvatarStack users={task.assignees} className="ml-auto" />
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
