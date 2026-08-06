"use client";

import { useState } from "react";
import { LabelChip } from "@/components/label-chip";
import { Input } from "@/components/ui/input";
import { LABEL_COLORS, type LabelColor } from "@/lib/label-colors";
import { cn } from "@/lib/utils";

// Label field (Owner request): toggle existing colored labels and/or create
// a new one with a color, inline in the task form.
export function LabelPicker({
  labels,
}: {
  labels: Array<{ id: string; name: string; color: string }>;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [newColor, setNewColor] = useState<LabelColor>("blue");

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-2.5">
      {[...selected].map((id) => (
        <input key={id} type="hidden" name="labels" value={id} />
      ))}
      {labels.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {labels.map((label) => (
            <button
              key={label.id}
              type="button"
              onClick={() => toggle(label.id)}
              aria-pressed={selected.has(label.id)}
              className={cn(
                "rounded-full transition-opacity",
                selected.has(label.id)
                  ? "ring-1 ring-foreground"
                  : "opacity-60 hover:opacity-100",
              )}
            >
              <LabelChip name={label.name} color={label.color} />
            </button>
          ))}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          name="newLabelName"
          placeholder="New label…"
          className="h-8 w-36 text-xs"
        />
        <input type="hidden" name="newLabelColor" value={newColor} />
        <div className="flex gap-1">
          {(Object.keys(LABEL_COLORS) as LabelColor[]).map((key) => (
            <button
              key={key}
              type="button"
              title={LABEL_COLORS[key].label}
              onClick={() => setNewColor(key)}
              aria-pressed={newColor === key}
              className={cn(
                "size-5 rounded-full border transition-transform",
                newColor === key && "scale-110 ring-1 ring-foreground",
              )}
              style={{ backgroundColor: LABEL_COLORS[key].dot }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
