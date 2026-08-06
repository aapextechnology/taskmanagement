"use client";

import { ImageIcon, MessageCircle } from "lucide-react";
import { useActionState, useRef, useState } from "react";
import {
  commentAction,
  type TaskActionState,
} from "@/app/(app)/tasks/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Inline reply from the timeline — lands directly on the task's comments.
export function ReplyComposer({
  taskId,
  commentCount,
}: {
  taskId: string;
  commentCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [state, formAction, pending] = useActionState<TaskActionState, FormData>(
    commentAction,
    {},
  );

  return (
    <div className="flex flex-col gap-2 pt-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex w-fit items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground",
          open && "text-foreground",
        )}
      >
        <MessageCircle className="size-3.5" />
        {commentCount} comment{commentCount === 1 ? "" : "s"}
      </button>

      {open ? (
        <form
          action={(formData) => {
            formAction(formData);
            setOpen(false);
            setFileName(null);
          }}
          className="flex flex-col gap-2"
        >
          <input type="hidden" name="taskId" value={taskId} />
          <div className="flex items-center gap-2">
            <input
              name="body"
              autoFocus
              placeholder="Reply… (use @all to ping the division)"
              className="border-input h-9 flex-1 rounded-full border bg-transparent px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            />
            <input
              ref={fileRef}
              type="file"
              name="attachment"
              className="hidden"
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Attach image"
              onClick={() => fileRef.current?.click()}
            >
              <ImageIcon className="size-4" />
            </Button>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "…" : "Reply"}
            </Button>
          </div>
          {fileName ? (
            <span className="text-xs text-muted-foreground">📎 {fileName}</span>
          ) : null}
          {state.error ? (
            <span role="alert" className="text-xs text-destructive">
              {state.error}
            </span>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}
