import { cn } from "@/lib/utils";

// Card-level dependency badges (EPIC-012 T-123).
// Grey "⧗ N" = this task waits on N gates (internal blockers + external).
// "N↩" = N open tasks wait on this one — red when the bottleneck is
// critical per the Owner's threshold (≥3, or ≥1 + overdue/blocked).
export function DependencyBadge({
  waitingOn,
  waiters,
  critical,
  className,
}: {
  waitingOn: number;
  waiters: number;
  critical: boolean;
  className?: string;
}) {
  if (waitingOn === 0 && waiters === 0) return null;
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {waitingOn > 0 ? (
        <span
          title={`Waiting on ${waitingOn} ${waitingOn === 1 ? "dependency" : "dependencies"}`}
          className="rounded-full border px-1.5 py-px text-[10px] tabular-nums text-muted-foreground"
        >
          ⧗ {waitingOn}
        </span>
      ) : null}
      {waiters > 0 ? (
        <span
          title={`${waiters} open ${waiters === 1 ? "task waits" : "tasks wait"} on this${critical ? " — CRITICAL bottleneck" : ""}`}
          className={cn(
            "rounded-full px-1.5 py-px text-[10px] font-semibold tabular-nums",
            critical
              ? "bg-status-blocked/15 text-status-blocked"
              : "border text-muted-foreground",
          )}
        >
          {waiters}↩
        </span>
      ) : null}
    </span>
  );
}
