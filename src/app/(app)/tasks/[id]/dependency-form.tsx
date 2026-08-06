"use client";

import { useActionState } from "react";
import { dependencyAddAction, type TaskActionState } from "../actions";
import { Button } from "@/components/ui/button";

export function DependencyForm({
  taskId,
  options,
}: {
  taskId: string;
  options: Array<{ id: string; title: string; divisionId: string }>;
}) {
  const [state, formAction, pending] = useActionState<TaskActionState, FormData>(
    dependencyAddAction,
    {},
  );

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="taskId" value={taskId} />
      <select
        name="dependsOnTaskId"
        className="border-input h-8 max-w-72 rounded-md border bg-transparent px-2 text-xs outline-none"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.title} ({o.divisionId})
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        Add “blocked by”
      </Button>
      {state.error ? (
        <span role="alert" className="text-xs text-destructive">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
