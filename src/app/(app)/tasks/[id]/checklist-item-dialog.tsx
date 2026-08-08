"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";
import { checklistUpdateAction } from "../actions";
import { PriorityPicker } from "@/components/priority-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Edit-in-dialog for a checklist item (Owner request): title, note,
// dates, priority — one popup, saved through the task service.
export function ChecklistItemDialog({
  taskId,
  item,
}: {
  taskId: string;
  item: {
    id: string;
    title: string;
    note: string;
    startDate: string | null;
    dueDate: string | null;
    priority: "low" | "medium" | "high" | "urgent" | null;
  };
}) {
  const [open, setOpen] = useState(false);
  const toDateInput = (iso: string | null) =>
    iso
      ? new Date(new Date(iso).getTime() + 7 * 3600_000).toISOString().slice(0, 10)
      : "";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            aria-label={`Edit ${item.title}`}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            <Pencil className="size-3.5" />
          </button>
        }
      />
      <DialogContent className="gap-0 p-0 sm:max-w-lg">
        <form
          action={async (formData) => {
            await checklistUpdateAction(formData);
            setOpen(false);
          }}
          className="flex flex-col"
        >
          <input type="hidden" name="taskId" value={taskId} />
          <input type="hidden" name="itemId" value={item.id} />
          <div className="flex flex-col gap-4 px-6 pb-4 pt-6">
            <DialogTitle className="text-xs font-semibold text-muted-foreground">
              Edit checklist item
            </DialogTitle>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`ci-title-${item.id}`}>Title</Label>
              <Input
                id={`ci-title-${item.id}`}
                name="title"
                defaultValue={item.title}
                required
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`ci-note-${item.id}`}>Keterangan / note</Label>
              <textarea
                id={`ci-note-${item.id}`}
                name="note"
                rows={3}
                defaultValue={item.note}
                placeholder="Detail, context, or acceptance for this item…"
                className="border-input rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              />
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <Label className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                  Start
                </Label>
                <Input
                  name="startDate"
                  type="date"
                  defaultValue={toDateInput(item.startDate)}
                  className="h-8 w-36 text-xs"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                  Due
                </Label>
                <Input
                  name="dueDate"
                  type="date"
                  defaultValue={toDateInput(item.dueDate)}
                  className="h-8 w-36 text-xs"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                  Priority
                </Label>
                <PriorityPicker
                  allowEmpty
                  compact
                  defaultValue={item.priority ?? ""}
                />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 border-t bg-muted/30 px-6 py-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm">
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
