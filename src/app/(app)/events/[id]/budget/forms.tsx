"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addLineAction,
  createExpenseAction,
  type BudgetActionState,
} from "./actions";

const selectClass =
  "border-input h-9 rounded-md border bg-transparent px-3 text-sm outline-none";

export function AddLineForm({
  eventId,
  divisions,
}: {
  eventId: string;
  divisions: Array<{ id: string; name: string }>;
}) {
  const [state, formAction, pending] = useActionState<BudgetActionState, FormData>(
    addLineAction,
    {},
  );

  return (
    <form
      action={formAction}
      className="flex flex-wrap items-end gap-3 rounded-md border p-3"
    >
      <input type="hidden" name="eventId" value={eventId} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="bl-division" className="text-xs">
          Division
        </Label>
        <select id="bl-division" name="divisionId" className={selectClass}>
          {divisions.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
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
  const [state, formAction, pending] = useActionState<BudgetActionState, FormData>(
    createExpenseAction,
    {},
  );

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
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ex-division" className="text-xs">
            Division
          </Label>
          <select
            id="ex-division"
            name="divisionId"
            className={selectClass}
            value={division}
            onChange={(e) => setDivision(e.target.value)}
          >
            {divisions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ex-line" className="text-xs">
            Budget line
          </Label>
          <select id="ex-line" name="budgetLineId" className={selectClass} defaultValue="">
            <option value="">— none —</option>
            {divisionLines.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
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
