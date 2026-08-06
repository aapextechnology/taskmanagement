"use client";

import { Check } from "lucide-react";
import { useState, type ReactNode } from "react";
import { UserAvatar } from "@/components/task-meta";
import { cn } from "@/lib/utils";

// Styled selection controls (Owner directive 2026-08-06: never ship
// native/basic-looking actions). All submit through hidden inputs so they
// drop into any server-action form.

export function ChoiceChip({
  selected,
  onToggle,
  children,
  className,
}: {
  selected: boolean;
  onToggle: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={cn(
        "group/chip inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-all duration-150 active:scale-[0.97]",
        selected
          ? "border-foreground bg-foreground text-background shadow-sm"
          : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground",
        className,
      )}
    >
      <span
        className={cn(
          "flex size-3.5 items-center justify-center rounded-full border transition-all duration-150",
          selected
            ? "border-background/40 bg-background/20"
            : "border-border group-hover/chip:border-foreground/40",
        )}
      >
        <Check
          className={cn(
            "size-2.5 transition-all duration-150",
            selected ? "scale-100 opacity-100" : "scale-50 opacity-0",
          )}
          strokeWidth={3}
        />
      </span>
      {children}
    </button>
  );
}

// multi-select chip group → submits each selected value under `name`
export function ChipMultiSelect({
  name,
  options,
  defaultSelected = [],
}: {
  name: string;
  options: Array<{ value: string; label: string }>;
  defaultSelected?: string[];
}) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(defaultSelected),
  );

  const toggle = (value: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });

  return (
    <div className="flex flex-wrap gap-1.5">
      {[...selected].map((value) => (
        <input key={value} type="hidden" name={name} value={value} />
      ))}
      {options.map((option) => (
        <ChoiceChip
          key={option.value}
          selected={selected.has(option.value)}
          onToggle={() => toggle(option.value)}
        >
          {option.label}
        </ChoiceChip>
      ))}
    </div>
  );
}

// single-select avatar chips (user pickers) → submits one value under `name`
export function UserSingleSelect({
  name,
  users,
}: {
  name: string;
  users: Array<{ id: string; name: string }>;
}) {
  const [selected, setSelected] = useState<string | null>(users[0]?.id ?? null);

  return (
    <div className="flex flex-wrap gap-1.5">
      {selected ? <input type="hidden" name={name} value={selected} /> : null}
      {users.map((user) => {
        const active = selected === user.id;
        return (
          <button
            key={user.id}
            type="button"
            onClick={() => setSelected(user.id)}
            aria-pressed={active}
            className={cn(
              "flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-3 text-xs transition-all duration-150 active:scale-[0.97]",
              active
                ? "border-foreground bg-foreground text-background shadow-sm"
                : "text-muted-foreground hover:border-foreground/40 hover:text-foreground",
            )}
          >
            <UserAvatar
              name={user.name}
              className={cn(active && "border-background/40 bg-background/15 text-background")}
            />
            {user.name}
          </button>
        );
      })}
    </div>
  );
}
