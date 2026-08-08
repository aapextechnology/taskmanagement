"use client";

import { useActionState, useState } from "react";
import { updateFieldsAction, type TaskActionState } from "../actions";
import { PriorityPicker } from "@/components/priority-picker";
import { Segmented } from "@/components/segmented";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function EditTaskForm({
  task,
}: {
  task: {
    id: string;
    title: string;
    description: string;
    priority: string;
    dueDate: string | null;
    recurrence: string;
  };
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<TaskActionState, FormData>(
    updateFieldsAction,
    {},
  );

  if (!open) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Edit
      </Button>
    );
  }

  // datetime-local expects local (WIB) time without zone
  const dueLocal = task.dueDate
    ? new Date(new Date(task.dueDate).getTime() + 7 * 3600_000)
        .toISOString()
        .slice(0, 16)
    : "";

  return (
    <form
      action={formAction}
      className="flex w-full flex-col gap-4 rounded-md border p-4"
    >
      <input type="hidden" name="taskId" value={task.id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="et-title">Title</Label>
          <Input id="et-title" name="title" defaultValue={task.title} required />
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label>Priority</Label>
          <PriorityPicker
            defaultValue={task.priority as "low" | "medium" | "high" | "urgent"}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="et-due">Due (WIB)</Label>
          <Input id="et-due" name="dueDate" type="datetime-local" defaultValue={dueLocal} />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Repeats</Label>
          <Segmented
            name="recurrence"
            defaultValue={task.recurrence}
            options={[
              { value: "none", label: "Never" },
              { value: "daily", label: "Daily" },
              { value: "weekly", label: "Weekly" },
              { value: "monthly", label: "Monthly" },
            ]}
          />
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="et-desc">Description</Label>
          <textarea
            id="et-desc"
            name="description"
            rows={3}
            defaultValue={task.description}
            className="border-input rounded-md border bg-transparent px-3 py-2 text-sm outline-none"
          />
        </div>
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">{state.error}</p>
      ) : null}
      <div className="flex gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Close
        </Button>
      </div>
    </form>
  );
}
