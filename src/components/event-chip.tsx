import { cn } from "@/lib/utils";

// Event badge (Owner request 2026-08-06): every cross-event list item shows
// which event it belongs to — a compact bordered chip with the ● accent dot.
export function EventChip({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-48 items-center gap-1.5 rounded-full border bg-accent/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-foreground/80",
        className,
      )}
    >
      <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-foreground/50" />
      <span className="truncate">{name}</span>
    </span>
  );
}
