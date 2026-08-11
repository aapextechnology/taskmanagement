"use client";

import { FolderPlus, Globe, Lock, Users, Folder } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { Segmented } from "@/components/segmented";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { allowedChildLevels, type Visibility } from "@/lib/dataroom/access";
import { createFolderAction, type DataroomActionState } from "./actions";

// New folder as a dialog rather than a panel wedged into the page (Owner
// 2026-08-11). Creating a folder is a brief, modal decision; leaving a form
// open in the layout made the file list jump around.

const LEVEL_META: Record<Visibility, { label: string; icon: React.ReactNode; hint: string }> = {
  sealed: { label: "Sealed", icon: <Lock className="size-3.5" />, hint: "Only people you name — not even the Owner" },
  division: { label: "Division", icon: <Users className="size-3.5" />, hint: "One division's members" },
  event: { label: "Event", icon: <Folder className="size-3.5" />, hint: "Anyone who can see this event" },
  organisation: { label: "Everyone", icon: <Globe className="size-3.5" />, hint: "Every internal user" },
};

export function NewFolderDialog({
  eventId,
  parent,
  divisions,
  open,
  onOpenChange,
}: {
  eventId: string;
  parent: { id: string; name: string; visibility: Visibility } | null;
  divisions: Array<{ id: string; name: string }>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, formAction, pending] = useActionState<DataroomActionState, FormData>(
    createFolderAction,
    {},
  );
  const [level, setLevel] = useState<Visibility>("event");

  useEffect(() => {
    if (state.ok) onOpenChange(false);
  }, [state.ok, onOpenChange]);

  // a child may only narrow, so the wider options are simply not offered
  const levels = allowedChildLevels(parent?.visibility ?? "organisation");
  const options = levels.map((v) => ({
    value: v,
    label: LEVEL_META[v].label,
    icon: LEVEL_META[v].icon,
    hint: LEVEL_META[v].hint,
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form action={formAction} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderPlus className="size-4" /> New folder
            </DialogTitle>
            <DialogDescription>
              {parent
                ? `Inside “${parent.name}”. It cannot be more open than its parent.`
                : "At the top level of this event's dataroom."}
            </DialogDescription>
          </DialogHeader>

          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="parentId" value={parent?.id ?? ""} />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nf-name" className="text-xs">
              Name
            </Label>
            <Input id="nf-name" name="name" required autoFocus placeholder="Vendor contracts" />
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-xs">Who can see it</Label>
            <Segmented
              name="visibility"
              options={options}
              defaultValue={levels.includes("event") ? "event" : levels[0]}
              onValueChange={(v) => setLevel(v as Visibility)}
            />
            <span className="text-[11px] text-muted-foreground">
              {LEVEL_META[level]?.hint}
            </span>
          </div>

          {level === "division" && divisions.length > 0 ? (
            <div className="flex flex-col gap-2">
              <Label className="text-xs">Which division</Label>
              <Segmented
                name="divisionId"
                options={divisions.map((d) => ({ value: d.id, label: d.name }))}
                defaultValue={divisions[0]?.id}
              />
            </div>
          ) : null}

          {state.error ? (
            <p role="alert" className="text-xs text-destructive">
              {state.error}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create folder"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
