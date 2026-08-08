"use client";

import { useActionState, useState } from "react";
import {
  handoffRequestAction,
  type TaskActionState,
} from "@/app/(app)/tasks/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useActionToast } from "@/lib/use-action-toast";

function ChipPicker({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ id: string; label: string }>;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          aria-pressed={value === o.id}
          className={cn(
            "rounded-full border px-3 py-1 text-xs transition-all",
            value === o.id
              ? "border-foreground bg-foreground font-medium text-background"
              : "text-muted-foreground hover:border-foreground/40 hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function HandoffRequestForm({
  eventId,
  fromOptions,
  toOptions,
}: {
  eventId: string;
  fromOptions: Array<{ id: string; name: string }>;
  toOptions: Array<{ id: string; name: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(fromOptions[0]?.id ?? "");
  const [to, setTo] = useState(
    toOptions.find((d) => d.id !== fromOptions[0]?.id)?.id ?? "",
  );
  const [state, formAction, pending] = useActionState<TaskActionState, FormData>(
    handoffRequestAction,
    {},
  );
  useActionToast(pending, state.error, "Handoff request sent");
  // close on success — adjust-state-during-render (no effect needed)
  const [wasPending, setWasPending] = useState(false);
  if (wasPending !== pending) {
    setWasPending(pending);
    if (wasPending && !pending && !state.error) setOpen(false);
  }

  if (!open) {
    return (
      <div>
        <Button variant="outline" onClick={() => setOpen(true)}>
          Request handoff ↗
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-md border p-4">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="fromDivisionId" value={from} />
      <input type="hidden" name="toDivisionId" value={to} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label>From (your division)</Label>
          <ChipPicker
            value={from}
            onChange={(v) => {
              setFrom(v);
              if (to === v) {
                setTo(toOptions.find((d) => d.id !== v)?.id ?? "");
              }
            }}
            options={fromOptions.map((d) => ({ id: d.id, label: d.name }))}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>To division</Label>
          <ChipPicker
            value={to}
            onChange={setTo}
            options={toOptions
              .filter((d) => d.id !== from)
              .map((d) => ({ id: d.id, label: d.name }))}
          />
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="ho-title">What do you need?</Label>
          <Input
            id="ho-title"
            name="title"
            required
            placeholder="Stage design render for the announcement"
          />
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="ho-note">Note</Label>
          <textarea
            id="ho-note"
            name="note"
            rows={2}
            className="border-input rounded-md border bg-transparent px-3 py-2 text-sm outline-none"
          />
        </div>
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">{state.error}</p>
      ) : null}
      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Sending…" : "Send request"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
