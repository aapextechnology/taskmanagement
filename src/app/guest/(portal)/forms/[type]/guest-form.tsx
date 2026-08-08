"use client";

import { useActionState } from "react";
import { guestFormAction, type GuestFormState } from "../../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FormField, FormType } from "@/lib/external/forms";

export function GuestForm({
  type,
  fields,
  initialData,
  readOnly,
  status,
}: {
  type: FormType;
  fields: FormField[];
  initialData: Record<string, string>;
  readOnly: boolean;
  status?: string;
}) {
  const [state, formAction, pending] = useActionState<GuestFormState, FormData>(
    guestFormAction,
    {},
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="type" value={type} />
      {fields.map((field) => (
        <div key={field.key} className="flex flex-col gap-1.5">
          <Label htmlFor={`gf-${field.key}`}>
            {field.label}
            {field.required ? <span className="text-destructive"> *</span> : null}
          </Label>
          {field.type === "textarea" ? (
            <textarea
              id={`gf-${field.key}`}
              name={field.key}
              rows={4}
              defaultValue={initialData[field.key] ?? ""}
              placeholder={field.placeholder}
              disabled={readOnly}
              className="border-input rounded-md border bg-transparent px-3 py-2 text-sm outline-none disabled:opacity-60"
            />
          ) : (
            <Input
              id={`gf-${field.key}`}
              name={field.key}
              type={field.type === "number" ? "text" : field.type}
              inputMode={field.type === "number" ? "numeric" : undefined}
              defaultValue={initialData[field.key] ?? ""}
              placeholder={field.placeholder}
              disabled={readOnly}
            />
          )}
        </div>
      ))}
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">{state.error}</p>
      ) : null}
      {state.saved ? (
        <p className="text-sm text-status-done">Draft saved.</p>
      ) : null}
      {readOnly ? (
        <p className="text-sm text-muted-foreground">
          {status === "accepted"
            ? "This form has been accepted — thank you!"
            : "Submitted — the team is reviewing it."}
        </p>
      ) : (
        <div className="flex gap-3">
          <Button
            type="submit"
            name="intent"
            value="draft"
            variant="outline"
            disabled={pending}
          >
            Save draft
          </Button>
          <Button type="submit" name="intent" value="submit" disabled={pending}>
            {pending ? "Sending…" : "Submit for review"}
          </Button>
        </div>
      )}
    </form>
  );
}
