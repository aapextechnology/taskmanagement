"use client";

import { useState } from "react";
import { PriorityIcon, type PriorityKey } from "@/components/task-meta";
import { cn } from "@/lib/utils";

const OPTIONS: PriorityKey[] = ["low", "medium", "high", "urgent"];

const SELECTED_RING: Record<PriorityKey, string> = {
  low: "border-priority-low",
  medium: "border-priority-medium",
  high: "border-priority-high",
  urgent: "border-priority-urgent",
};

// Colored segmented control (Owner request): priority reads by color at a
// glance instead of a plain dropdown. Submits via a hidden input.
export function PriorityPicker({
  name = "priority",
  defaultValue = "medium",
}: {
  name?: string;
  defaultValue?: PriorityKey;
}) {
  const [value, setValue] = useState<PriorityKey>(defaultValue);

  return (
    <div className="flex gap-1.5">
      <input type="hidden" name={name} value={value} />
      {OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => setValue(option)}
          aria-pressed={value === option}
          className={cn(
            "flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs capitalize transition-colors",
            value === option
              ? cn("bg-accent font-medium", SELECTED_RING[option])
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <PriorityIcon priority={option} />
          {option}
        </button>
      ))}
    </div>
  );
}
