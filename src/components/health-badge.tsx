import { cn } from "@/lib/utils";

// Monochrome health badge: severity reads through weight and border, not hue;
// only CRITICAL borrows the destructive token.
const STYLES = {
  on_track: "border-border text-muted-foreground",
  at_risk: "border-foreground text-foreground",
  critical: "border-destructive text-destructive",
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
