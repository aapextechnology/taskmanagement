"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DOCUMENT_CATEGORIES, type DocumentCategory } from "@/lib/documents/logic";
import { cn } from "@/lib/utils";
import { uploadDocumentAction, type DocumentActionState } from "./actions";

export const CATEGORY_LABEL: Record<DocumentCategory, string> = {
  contract: "Contract",
  permit: "Permit",
  rider: "Rider",
  stage_plot: "Stage plot",
};

function ChipPicker<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={value === option.value}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-all",
              value === option.value
                ? "border-foreground bg-foreground font-medium text-background"
                : "text-muted-foreground hover:border-foreground/40 hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function UploadDocumentForm({
  eventId,
  divisions,
}: {
  eventId: string;
  divisions: Array<{ id: string; name: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<DocumentCategory>(DOCUMENT_CATEGORIES[0]);
  const [divisionId, setDivisionId] = useState(divisions[0]?.id ?? "");
  const [state, formAction, pending] = useActionState<DocumentActionState, FormData>(
    uploadDocumentAction,
    {},
  );

  if (!open) {
    return (
      <div>
        <Button onClick={() => setOpen(true)}>Upload document ↗</Button>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-lg border bg-card p-4"
    >
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="category" value={category} />
      <input type="hidden" name="divisionId" value={divisionId} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="doc-title">Title</Label>
        <Input id="doc-title" name="title" required placeholder="Venue contract" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="doc-file">File</Label>
        <Input id="doc-file" name="file" type="file" required />
      </div>

      <ChipPicker
        label="Category"
        value={category}
        onChange={setCategory}
        options={DOCUMENT_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))}
      />

      <ChipPicker
        label="Division"
        value={divisionId}
        onChange={setDivisionId}
        options={divisions.map((d) => ({ value: d.id, label: d.name }))}
      />

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending || !divisionId}>
          {pending ? "Uploading…" : "Upload"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Close
        </Button>
      </div>
    </form>
  );
}
