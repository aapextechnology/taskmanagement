"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { EventColorPicker } from "@/components/event-color-picker";
import { EventPeoplePicker } from "@/components/event-people-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateEventAction, type EventActionState } from "../../actions";

// Mirrors NewEventForm minus the playbook picker — a playbook seeds tasks,
// which is a creation-time act; re-applying one lives on the event page.
export function EditEventForm({
  event,
  people,
  picId,
  memberIds,
}: {
  people: Array<{ id: string; name: string }>;
  picId: string | null;
  memberIds: string[];
  event: {
    id: string;
    name: string;
    artists: string;
    venue: string;
    /** WIB value for the datetime-local input, prepared server-side */
    showDateInput: string;
    capacity: number | null;
    color: string | null;
    hasPoster: boolean;
  };
}) {
  const [state, formAction, pending] = useActionState<EventActionState, FormData>(
    updateEventAction,
    {},
  );

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="eventId" value={event.id} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="ev-name">Event name</Label>
        <Input id="ev-name" name="name" required defaultValue={event.name} />
      </div>
      <div className="flex flex-col gap-2">
        <Label>Colour</Label>
        <EventColorPicker defaultValue={event.color} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="ev-artists">Artists</Label>
        <Input id="ev-artists" name="artists" defaultValue={event.artists} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="ev-venue">Venue</Label>
        <Input id="ev-venue" name="venue" defaultValue={event.venue} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="ev-date">Show date (WIB)</Label>
          <Input
            id="ev-date"
            name="showDate"
            type="datetime-local"
            required
            defaultValue={event.showDateInput}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="ev-capacity">Capacity</Label>
          <Input
            id="ev-capacity"
            name="capacity"
            type="number"
            min={1}
            defaultValue={event.capacity ?? ""}
          />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="ev-poster">
          {event.hasPoster
            ? "Replace poster (jpg/png/webp, max 5 MB) — empty keeps the current one"
            : "Poster (jpg/png/webp, max 5 MB)"}
        </Label>
        <Input
          id="ev-poster"
          name="poster"
          type="file"
          accept="image/jpeg,image/png,image/webp"
        />
      </div>
      {people.length > 0 ? (
        <EventPeoplePicker
          people={people}
          defaultPicId={picId}
          defaultMemberIds={memberIds}
        />
      ) : null}
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="mt-2">
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
