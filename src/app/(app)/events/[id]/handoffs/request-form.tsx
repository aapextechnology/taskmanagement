"use client";

import { useActionState, useState } from "react";
import {
  handoffRequestAction,
  type TaskActionState,
} from "@/app/(app)/tasks/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const selectClass =
  "border-input h-9 rounded-md border bg-transparent px-3 text-sm outline-none";

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
  const [state, formAction, pending] = useActionState<TaskActionState, FormData>(
    handoffRequestAction,
    {},
  );

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
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="ho-from">From (your division)</Label>
          <select
            id="ho-from"
            name="fromDivisionId"
            className={selectClass}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          >
            {fromOptions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="ho-to">To division</Label>
          <select id="ho-to" name="toDivisionId" className={selectClass}>
            {toOptions
              .filter((d) => d.id !== from)
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
          </select>
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
