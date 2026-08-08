import { Fragment } from "react";
import { cn } from "@/lib/utils";

export interface PhaseStep {
  id: string;
  name: string;
}

// Lifecycle indicator over the event's OWN workflow (per-event data):
// past phases dim, current phase full-contrast.
export function PhaseSteps({
  phases,
  currentId,
}: {
  phases: PhaseStep[];
  currentId: string | null;
}) {
  const currentIndex = phases.findIndex((p) => p.id === currentId);

  return (
    <ol className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wider">
      {phases.map((phase, index) => (
        <Fragment key={phase.id}>
          {index > 0 ? (
            <span aria-hidden className="text-border">
              —
            </span>
          ) : null}
          <li
            aria-current={index === currentIndex ? "step" : undefined}
            className={cn(
              index === currentIndex
                ? "font-semibold text-foreground"
                : index < currentIndex
                  ? "text-muted-foreground line-through decoration-border"
                  : "text-muted-foreground/60",
            )}
          >
            {phase.name}
          </li>
        </Fragment>
      ))}
    </ol>
  );
}
