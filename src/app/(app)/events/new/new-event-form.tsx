"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { EventColorPicker } from "@/components/event-color-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createEventAction, type EventActionState } from "../actions";

export function NewEventForm({
  templates = [],
}: {
  templates?: Array<{ id: string; name: string; itemCount: number }>;
}) {
  const [templateId, setTemplateId] = useState("");
  const [state, formAction, pending] = useActionState<EventActionState, FormData>(
    createEventAction,
    {},
  );

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="templateId" value={templateId} />
      {templates.length > 0 ? (
        <div className="flex flex-col gap-2">
          <Label>Playbook — pre-fill every division&apos;s checklist</Label>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setTemplateId("")}
              aria-pressed={templateId === ""}
              className={
                "rounded-full border px-3 py-1.5 text-xs transition-all " +
                (templateId === ""
                  ? "border-foreground bg-foreground font-medium text-background"
                  : "text-muted-foreground hover:border-foreground/40 hover:text-foreground")
              }
            >
              Blank event
            </button>
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTemplateId(t.id)}
                aria-pressed={templateId === t.id}
                className={
                  "rounded-full border px-3 py-1.5 text-xs transition-all " +
                  (templateId === t.id
                    ? "border-foreground bg-foreground font-medium text-background"
                    : "text-muted-foreground hover:border-foreground/40 hover:text-foreground")
                }
              >
                {t.name} · {t.itemCount} tasks
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <div className="flex flex-col gap-2">
        <Label htmlFor="ev-name">Event name</Label>
        <Input id="ev-name" name="name" required placeholder="YE Live in Jakarta" />
      </div>
      <div className="flex flex-col gap-2">
        <Label>Colour</Label>
        <EventColorPicker />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="ev-artists">Artists</Label>
        <Input id="ev-artists" name="artists" placeholder="YE · Special Guests" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="ev-venue">Venue</Label>
        <Input id="ev-venue" name="venue" placeholder="Jakarta International Stadium" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="ev-date">Show date</Label>
          <Input id="ev-date" name="showDate" type="datetime-local" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="ev-capacity">Capacity</Label>
          <Input id="ev-capacity" name="capacity" type="number" min={1} />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="ev-poster">Poster (jpg/png/webp, max 5 MB)</Label>
        <Input id="ev-poster" name="poster" type="file" accept="image/jpeg,image/png,image/webp" />
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="mt-2">
        {pending ? "Creating…" : "Create event"}
      </Button>
    </form>
  );
}
