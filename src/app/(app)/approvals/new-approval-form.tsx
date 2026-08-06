"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createApprovalAction, type ApprovalActionState } from "./actions";

const selectClass =
  "border-input h-9 rounded-md border bg-transparent px-3 text-sm outline-none";

const MONETARY_TYPES = new Set(["expense", "artist_offer", "sponsorship_deal"]);

export function NewApprovalForm({
  divisions,
  events,
  thresholds,
}: {
  divisions: Array<{ id: string; name: string }>;
  events: Array<{ id: string; name: string }>;
  thresholds: { a: number; b: number };
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("expense");
  const [amount, setAmount] = useState("");
  const [state, formAction, pending] = useActionState<
    ApprovalActionState,
    FormData
  >(createApprovalAction, {});

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>New request ↗</Button>
    );
  }

  const numericAmount = Number(amount.replaceAll(".", "")) || 0;
  const chainHint =
    type === "expense"
      ? numericAmount <= thresholds.a
        ? "Division Head"
        : numericAmount <= thresholds.b
          ? "Division Head → Finance"
          : "Division Head → Finance → Owner"
      : type === "artist_offer"
        ? "Talent Head → Finance → Owner"
        : type === "contract"
          ? "Legal → Owner"
          : type === "sponsorship_deal"
            ? "Sponsorship Head → Legal → Owner"
            : "Marketing Head";

  return (
    <form
      action={formAction}
      className="flex w-full flex-col gap-4 rounded-md border p-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="ap-type">Type</Label>
          <select
            id="ap-type"
            name="type"
            className={selectClass}
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="expense">Expense</option>
            <option value="artist_offer">Artist offer</option>
            <option value="contract">Contract</option>
            <option value="sponsorship_deal">Sponsorship deal</option>
            <option value="public_content">Public content</option>
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="ap-division">Division</Label>
          <select id="ap-division" name="divisionId" className={selectClass}>
            {divisions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="ap-title">Title</Label>
          <Input
            id="ap-title"
            name="title"
            required
            placeholder="PA system rental — main stage"
          />
        </div>
        {MONETARY_TYPES.has(type) ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="ap-amount">Amount (IDR)</Label>
            <Input
              id="ap-amount"
              name="amount"
              inputMode="numeric"
              placeholder="25000000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        ) : null}
        <div className="flex flex-col gap-2">
          <Label htmlFor="ap-event">Event (optional)</Label>
          <select id="ap-event" name="eventId" className={selectClass} defaultValue="">
            <option value="">—</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="ap-desc">Justification</Label>
          <textarea
            id="ap-desc"
            name="description"
            rows={2}
            className="border-input rounded-md border bg-transparent px-3 py-2 text-sm outline-none"
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Chain: {chainHint}</p>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">{state.error}</p>
      ) : null}
      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Submitting…" : "Submit request"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
