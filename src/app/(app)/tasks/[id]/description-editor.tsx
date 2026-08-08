"use client";

import { useState } from "react";
import { taskDescriptionAction } from "../actions";
import { Button } from "@/components/ui/button";

// Wide always-there description box (Owner request). Save appears only
// once the text actually changes.
export function DescriptionEditor({
  taskId,
  description,
  canEdit,
}: {
  taskId: string;
  description: string;
  canEdit: boolean;
}) {
  const [value, setValue] = useState(description);
  const dirty = value !== description;

  if (!canEdit) {
    return description ? (
      <p className="whitespace-pre-wrap text-sm text-muted-foreground">
        {description}
      </p>
    ) : null;
  }

  return (
    <form action={taskDescriptionAction} className="flex flex-col gap-2">
      <input type="hidden" name="taskId" value={taskId} />
      <textarea
        name="description"
        rows={Math.max(3, Math.min(10, value.split("\n").length + 1))}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Describe this task — goal, context, acceptance…"
        className="border-input w-full rounded-md border bg-transparent px-3 py-2.5 text-sm leading-relaxed outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50"
      />
      {dirty ? (
        <div className="flex gap-2">
          <Button type="submit" size="sm">
            Save description
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setValue(description)}
          >
            Cancel
          </Button>
        </div>
      ) : null}
    </form>
  );
}
