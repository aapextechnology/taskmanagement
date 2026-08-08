import Link from "next/link";
import { CalendarDays, ChartGantt } from "lucide-react";
import { cn } from "@/lib/utils";

// Calendar ⇄ Gantt view switcher (Owner 2026-08-07): both render the same
// schedule, so they live under ONE "Calendar" nav entry with this toggle.
export function ScheduleViewToggle({
  eventId,
  active,
}: {
  eventId: string;
  active: "calendar" | "gantt";
}) {
  const views = [
    { key: "calendar" as const, label: "Calendar", icon: CalendarDays },
    { key: "gantt" as const, label: "Gantt", icon: ChartGantt },
  ];
  return (
    <div className="flex w-fit items-center gap-0.5 rounded-md border bg-muted/40 p-0.5">
      {views.map((view) => (
        <Link
          key={view.key}
          href={`/events/${eventId}/${view.key}`}
          aria-current={active === view.key ? "page" : undefined}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-[5px] px-2.5 py-1 text-xs font-medium transition-colors",
            active === view.key
              ? "bg-background text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <view.icon className="size-3.5" />
          {view.label}
        </Link>
      ))}
    </div>
  );
}
