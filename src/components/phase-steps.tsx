import { Fragment } from "react";
import {
  EVENT_PHASES_ORDER,
  PHASE_LABELS,
  type EventPhase,
} from "@/lib/events/service";
import { cn } from "@/lib/utils";

// Lifecycle indicator: past phases dim, current phase full-contrast.
export function PhaseSteps({ current }: { current: EventPhase }) {
  const currentIndex = EVENT_PHASES_ORDER.indexOf(current);

  return (
    <ol className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wider">
      {EVENT_PHASES_ORDER.map((phase, index) => (
        <Fragment key={phase}>
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
            {PHASE_LABELS[phase]}
          </li>
        </Fragment>
      ))}
    </ol>
  );
}
