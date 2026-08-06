"use client";

import { useActionState } from "react";
import { attachmentAction, type TaskActionState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AttachmentForm({ taskId }: { taskId: string }) {
  const [state, formAction, pending] = useActionState<TaskActionState, FormData>(
    attachmentAction,
    {},
  );

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="taskId" value={taskId} />
      <Input name="file" type="file" className="h-8 max-w-xs text-xs" />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "Uploading…" : "Upload"}
      </Button>
      {state.error ? (
        <span role="alert" className="text-xs text-destructive">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
