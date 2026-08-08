"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useActionToast } from "@/lib/use-action-toast";
import {
  addLineAction,
  createExpenseAction,
  type BudgetActionState,
} from "./actions";

function ChipPicker({
  value,
  onChange,
  options,
  emptyLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ id: string; label: string }>;
  /** shown as a selectable "none" chip when set */
  emptyLabel?: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {emptyLabel ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-pressed={value === ""}
          className={cn(
            "rounded-full border px-3 py-1 text-xs transition-all",
            value === ""
              ? "border-foreground bg-foreground font-medium text-background"
              : "text-muted-foreground hover:border-foreground/40 hover:text-foreground",
          )}
        >
          {emptyLabel}
        </button>
      ) : null}
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

export function AddLineForm({
  eventId,
  divisions,
}: {
  eventId: string;
  divisions: Array<{ id: string; name: string }>;
}) {
  const [division, setDivision] = useState(divisions[0]?.id ?? "");
  const [state, formAction, pending] = useActionState<BudgetActionState, FormData>(
    addLineAction,
    {},
  );
  useActionToast(pending, state.error, "Budget line added");

  return (
    <form
      action={formAction}
      className="flex flex-wrap items-end gap-3 rounded-md border p-3"
    >
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="divisionId" value={division} />
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">Division</Label>
        <ChipPicker
          value={division}
          onChange={setDivision}
          options={divisions.map((d) => ({ id: d.id, label: d.name }))}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="bl-name" className="text-xs">
          Line name
        </Label>
        <Input id="bl-name" name="name" required placeholder="Stage & rigging" className="w-48" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="bl-amount" className="text-xs">
          Planned (IDR)
        </Label>
        <Input
          id="bl-amount"
          name="plannedAmount"
          inputMode="numeric"
          required
          placeholder="500000000"
          className="w-40"
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add line"}
      </Button>
      {state.error ? (
        <span role="alert" className="text-xs text-destructive">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}

export function NewExpenseForm({
  eventId,
  divisions,
  lines,
}: {
  eventId: string;
  divisions: Array<{ id: string; name: string }>;
  lines: Array<{ id: string; label: string; divisionId: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [division, setDivision] = useState(divisions[0]?.id ?? "");
  const [lineId, setLineId] = useState("");
  const [state, formAction, pending] = useActionState<BudgetActionState, FormData>(
    createExpenseAction,
    {},
  );
  useActionToast(pending, state.error, "Expense submitted for approval");
  // close on success — adjust-state-during-render (no effect needed)
  const [seenOk, setSeenOk] = useState(state.ok);
  if (state.ok !== seenOk) {
    setSeenOk(state.ok);
    if (state.ok) setOpen(false);
  }

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        New expense ↗
      </Button>
    );
  }

  const divisionLines = lines.filter((l) => l.divisionId === division);

  return (
    <form
      action={formAction}
      className="fixed inset-x-4 bottom-4 z-50 flex flex-col gap-4 rounded-lg border bg-popover p-4 shadow-lg sm:absolute sm:inset-auto sm:right-0 sm:top-10 sm:w-[28rem]"
    >
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="divisionId" value={division} />
      <input type="hidden" name="budgetLineId" value={lineId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Division</Label>
          <ChipPicker
            value={division}
            onChange={(v) => {
              setDivision(v);
              setLineId("");
            }}
            options={divisions.map((d) => ({ id: d.id, label: d.name }))}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Budget line</Label>
          <ChipPicker
            value={lineId}
            onChange={setLineId}
            emptyLabel="None"
            options={divisionLines.map((l) => ({ id: l.id, label: l.label }))}
          />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="ex-title" className="text-xs">
            Title
          </Label>
          <Input id="ex-title" name="title" required placeholder="PA system rental" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ex-vendor" className="text-xs">
            Vendor
          </Label>
          <Input id="ex-vendor" name="vendor" placeholder="Sound Supply Co." />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ex-amount" className="text-xs">
            Amount (IDR)
          </Label>
          <Input
            id="ex-amount"
            name="amount"
            inputMode="numeric"
            required
            placeholder="85000000"
          />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="ex-just" className="text-xs">
            Justification
          </Label>
          <textarea
            id="ex-just"
            name="justification"
            rows={2}
            className="border-input rounded-md border bg-transparent px-3 py-2 text-sm outline-none"
          />
        </div>
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">{state.error}</p>
      ) : null}
      {state.ok ? (
        <p className="text-sm text-muted-foreground">
          Submitted — it now sits in the approval chain.
        </p>
      ) : null}
      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Submitting…" : "Submit expense"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Close
        </Button>
      </div>
    </form>
  );
}
