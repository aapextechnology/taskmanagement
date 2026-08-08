"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// Segmented control with an animated pill — replaces native <select> for
// short option sets (Owner directive: no basic-styled actions).
export function Segmented({
  name,
  options,
  defaultValue,
  onValueChange,
}: {
  name: string;
  options: Array<{ value: string; label: string; icon?: ReactNode; hint?: string }>;
  defaultValue?: string;
  /** parent that needs the live value (e.g. to branch other fields) */
  onValueChange?: (value: string) => void;
}) {
  const [value, setValue] = useState(defaultValue ?? options[0]?.value ?? "");

  return (
    <div className="inline-flex flex-wrap gap-0.5 rounded-lg border bg-muted/40 p-0.5">
      <input type="hidden" name={name} value={value} />
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            title={option.hint}
            onClick={() => {
              setValue(option.value);
              onValueChange?.(option.value);
            }}
            aria-pressed={active}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150",
              active
                ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
