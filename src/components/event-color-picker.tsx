"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { EVENT_COLORS, type EventColorId } from "@/lib/events/colors";
import { cn } from "@/lib/utils";

// Swatch picker for an event's identity colour (Owner 2026-08-12). Not a
// native <select>: the whole point is seeing the colours, and the project
// rule bans native selects anyway.

export function EventColorPicker({
  name = "color",
  defaultValue,
}: {
  name?: string;
  /** absent = keep the colour derived from the event's id */
  defaultValue?: string | null;
}) {
  const [chosen, setChosen] = useState<EventColorId | "">(
    (defaultValue as EventColorId) ?? "",
  );

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <input type="hidden" name={name} value={chosen} />
      {EVENT_COLORS.map((color) => (
        <button
          key={color.id}
          type="button"
          aria-label={color.label}
          aria-pressed={chosen === color.id}
          title={color.label}
          // clicking the current colour clears it, back to the derived one
          onClick={() => setChosen((c) => (c === color.id ? "" : color.id))}
          className={cn(
            "flex size-6 items-center justify-center rounded-md transition-transform",
            "hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40",
            color.className,
          )}
        >
          {chosen === color.id ? (
            <Check className="size-3.5 text-white drop-shadow" />
          ) : null}
        </button>
      ))}
      <span className="ml-1 text-[11px] text-muted-foreground">
        {chosen ? "Click again to auto-assign" : "Auto-assigned"}
      </span>
    </div>
  );
}
