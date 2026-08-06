"use client";

import { useActionState, useState } from "react";
import { createTaskAction, type TaskActionState } from "@/app/(app)/tasks/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const selectClass =
  "border-input bg-transparent h-9 rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

export function NewTaskForm({
  eventId,
  divisionId,
  members,
}: {
  eventId: string;
  divisionId: string;
  members: Array<{ id: string; name: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<TaskActionState, FormData>(
    createTaskAction,
    {},
  );

  if (!open) {
    return (
      <div>
        <Button variant="outline" onClick={() => setOpen(true)}>
          New task ↗
        </Button>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-md border p-4"
    >
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="divisionId" value={divisionId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="nt-title">Title</Label>
          <Input id="nt-title" name="title" required autoFocus />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="nt-priority">Priority</Label>
          <select id="nt-priority" name="priority" className={selectClass} defaultValue="medium">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="nt-due">Due date</Label>
          <Input id="nt-due" name="dueDate" type="datetime-local" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="nt-recurrence">Repeats</Label>
          <select id="nt-recurrence" name="recurrence" className={selectClass} defaultValue="none">
            <option value="none">Never</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="nt-assignees">Assignees</Label>
          <select
            id="nt-assignees"
            name="assignees"
            multiple
            className={`${selectClass} h-auto min-h-9`}
            size={Math.min(members.length, 4) || 1}
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="nt-desc">Description</Label>
          <textarea
            id="nt-desc"
            name="description"
            rows={2}
            className="border-input rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          />
        </div>
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">{state.error}</p>
      ) : null}
      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create task"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
