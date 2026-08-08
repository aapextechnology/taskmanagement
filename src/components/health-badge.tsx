import { cn } from "@/lib/utils";

// Health badge (design overhaul 2026-08-07): full functional-color fills so
// health reads at a glance — green/amber/red tints, chrome stays monochrome.
const STYLES = {
  on_track: "border-transparent bg-status-done/15 text-status-done",
  at_risk: "border-transparent bg-status-in-progress/15 text-status-in-progress",
  critical: "border-transparent bg-status-blocked/15 text-status-blocked",
} as const;

const LABELS = {
  on_track: "On track",
  at_risk: "At risk",
  critical: "Critical",
} as const;

export function HealthBadge({
  health,
  className,
}: {
  health: keyof typeof STYLES;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest",
        STYLES[health],
        className,
      )}
    >
      {LABELS[health]}
    </span>
  );
}
