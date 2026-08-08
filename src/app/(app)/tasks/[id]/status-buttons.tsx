"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { updateStatusAction } from "../actions";
import { Button } from "@/components/ui/button";
import { STATUS_LABELS, TASK_STATUS_ORDER, type TaskStatus } from "@/lib/tasks/status";

// Status row in the task drawer (design overhaul — package B): mirrors the
// kanban card's "moved to…" toast so the same mutation confirms itself
// everywhere it can be triggered from.
export function StatusButtons({
  taskId,
  current,
  canMove,
}: {
  taskId: string;
  current: TaskStatus;
  canMove: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const move = (status: TaskStatus) => {
    const formData = new FormData();
    formData.set("taskId", taskId);
    formData.set("status", status);
    startTransition(async () => {
      await updateStatusAction(formData);
      toast.success(`Moved to ${STATUS_LABELS[status]}`);
      router.refresh();
    });
  };

  return (
    <div className="flex flex-wrap gap-2">
      {TASK_STATUS_ORDER.map((status) => (
        <Button
          key={status}
          type="button"
          size="sm"
          disabled={!canMove || pending || status === current}
          variant={status === current ? "default" : "outline"}
          onClick={() => move(status)}
        >
          {STATUS_LABELS[status]}
        </Button>
      ))}
    </div>
  );
}
