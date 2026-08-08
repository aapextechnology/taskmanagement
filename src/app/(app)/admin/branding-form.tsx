"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/lib/use-action-toast";
import { updateBrandingAction } from "./actions";

// Lets the installing organisation put its own name on the app (EPIC-015).
export function BrandingForm({
  orgName,
  orgShortName,
  productName,
}: {
  orgName: string;
  orgShortName: string;
  productName: string;
}) {
  const [state, formAction, pending] = useActionState<{ error?: string }, FormData>(
    updateBrandingAction,
    {},
  );
  useActionToast(pending, state.error, "Branding updated");

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-md border bg-card p-4 elev"
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold">Organisation branding</h2>
        <p className="text-xs text-muted-foreground">
          Shown in the sidebar, emails, PDF reports, and the installable app
          name. Changes apply everywhere immediately.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="br-name" className="text-xs">
            Organisation name
          </Label>
          <Input
            id="br-name"
            name="orgName"
            defaultValue={orgName}
            placeholder="Acme Productions"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="br-short" className="text-xs">
            Short name (sidebar)
          </Label>
          <Input
            id="br-short"
            name="orgShortName"
            defaultValue={orgShortName}
            placeholder="ACME"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="br-product" className="text-xs">
            Product name
          </Label>
          <Input
            id="br-product"
            name="productName"
            defaultValue={productName}
            placeholder="Backstage"
          />
        </div>
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save branding"}
        </Button>
      </div>
    </form>
  );
}
