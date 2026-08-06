import Link from "next/link";
import { cellKey, dayKey, groupEntriesByDay, monthMatrix, type CalendarEntry } from "@/lib/calendar/aggregate";
import { cn } from "@/lib/utils";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Month grid: RVC monochrome — show-date entries are solid (filled) chips,
// deadline entries are outlined; done deadlines are struck through. Every
// entry is a real deep link (aggregate.ts href).
export function CalendarGrid({
  year,
  monthIndex,
  entries,
  eventNames,
}: {
  year: number;
  monthIndex: number;
  entries: CalendarEntry[];
  /** eventId → name, shown alongside each entry in cross-event (global) views */
  eventNames?: Map<string, string>;
}) {
  const weeks = monthMatrix(year, monthIndex);
  const grouped = groupEntriesByDay(entries);
  const todayKey = dayKey(new Date());

  return (
    <div className="overflow-hidden rounded-md border">
      <div className="grid grid-cols-7 border-b bg-muted/40">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="px-2 py-1.5 text-center text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"
          >
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {weeks.map((week) =>
          week.map((day) => {
            const key = cellKey(day);
            const inMonth = day.getMonth() === monthIndex;
            const dayEntries = grouped.get(key) ?? [];
            const isToday = key === todayKey;
            return (
              <div
                key={key}
                className={cn(
                  "flex min-h-28 flex-col gap-1 border-b border-r p-1.5 [&:nth-child(7n)]:border-r-0",
                  !inMonth && "bg-muted/20",
                )}
              >
                <span
                  aria-current={isToday ? "date" : undefined}
                  className={cn(
                    "inline-flex size-5 items-center justify-center self-start rounded-full text-[11px] tabular-nums",
                    !inMonth && "text-muted-foreground/50",
                    isToday && "bg-foreground font-semibold text-background",
                  )}
                >
                  {day.getDate()}
                </span>
                <div className="flex flex-col gap-1">
                  {dayEntries.map((entry) => {
                    const eventName = eventNames?.get(entry.eventId);
                    return (
                      <Link
                        key={`${entry.kind}-${entry.taskId ?? entry.eventId}-${entry.date.toISOString()}`}
                        href={entry.href}
                        title={eventName ? `${eventName} — ${entry.title}` : entry.title}
                        className={cn(
                          "flex items-center gap-1 truncate rounded-sm border px-1.5 py-0.5 text-[10px] font-medium transition-colors hover:bg-accent",
                          entry.kind === "show"
                            ? "border-foreground bg-foreground text-background"
                            : "border-border text-foreground hover:bg-accent/60",
                          entry.kind === "deadline" && entry.done && "text-muted-foreground line-through",
                        )}
                      >
                        <span aria-hidden className="shrink-0 text-[9px]">
                          {entry.kind === "show" ? "●" : "○"}
                        </span>
                        <span className="truncate">
                          {eventName ? `${eventName} · ` : ""}
                          {entry.title}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
}
