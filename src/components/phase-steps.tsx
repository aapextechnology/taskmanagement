import { Fragment } from "react";
import { cn } from "@/lib/utils";

export interface PhaseStep {
  id: string;
  name: string;
}

// Lifecycle indicator over the event's OWN workflow (per-event data):
// past phases dim, current phase full-contrast.
//
// With `jump` set (Owner 2026-08-13, "statusnya bisa dibalikin lagi") each
// phase becomes a button that moves the event THERE — forward or back. The
// service never had a forward-only rule; only this UI did.
export function PhaseSteps({
  phases,
  currentId,
  jump,
}: {
  phases: PhaseStep[];
  currentId: string | null;
  jump?: { eventId: string; action: (formData: FormData) => Promise<void> };
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
          <li aria-current={index === currentIndex ? "step" : undefined}>
            {jump && index !== currentIndex ? (
              <form action={jump.action} className="inline">
                <input type="hidden" name="eventId" value={jump.eventId} />
                <input type="hidden" name="phaseId" value={phase.id} />
                <button
                  type="submit"
                  title={`Move to ${phase.name}`}
                  className={cn(
                    "cursor-pointer uppercase tracking-wider underline-offset-4 hover:text-foreground hover:underline",
                    index < currentIndex
                      ? "text-muted-foreground line-through decoration-border"
                      : "text-muted-foreground/60",
                  )}
                >
                  {phase.name}
                </button>
              </form>
            ) : (
              <span
                className={cn(
                  index === currentIndex
                    ? "font-semibold text-foreground"
                    : index < currentIndex
                      ? "text-muted-foreground line-through decoration-border"
                      : "text-muted-foreground/60",
                )}
              >
                {phase.name}
              </span>
            )}
          </li>
        </Fragment>
      ))}
    </ol>
  );
}
