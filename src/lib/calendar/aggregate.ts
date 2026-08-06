import { toWibParts } from "@/lib/tasks/dates";
import type { TaskStatus } from "@/lib/tasks/service";

// T-081: pure calendar aggregation — no DB/permission access here. Callers
// (the calendar pages) fetch already-permission-scoped tasks/events via the
// service layer and hand them to this module to merge/sort/group.

export interface CalendarTask {
  id: string;
  eventId: string;
  divisionId: string;
  title: string;
  status: TaskStatus;
  dueDate: Date | null;
}

export interface CalendarEvent {
  id: string;
  name: string;
  showDate: Date;
}

export type CalendarEntryKind = "deadline" | "show";

export interface CalendarEntry {
  kind: CalendarEntryKind;
  eventId: string;
  /** present only for "deadline" entries */
  taskId?: string;
  title: string;
  href: string;
  date: Date;
  /** present only for "deadline" entries */
  done?: boolean;
}

// Deep-links reuse the real app routes: a task deadline opens the task
// (intercepted as a drawer app-wide, see src/app/(app)/@modal/(...)tasks),
// a show date opens the event workspace.
export function buildCalendarEntries({
  tasks,
  events,
}: {
  tasks: CalendarTask[];
  events: CalendarEvent[];
}): CalendarEntry[] {
  const deadlineEntries: CalendarEntry[] = tasks
    .filter(
      (task): task is CalendarTask & { dueDate: Date } =>
        task.dueDate !== null && task.status !== "cancelled",
    )
    .map((task) => ({
      kind: "deadline",
      eventId: task.eventId,
      taskId: task.id,
      title: task.title,
      href: `/tasks/${task.id}`,
      date: task.dueDate,
      done: task.status === "done",
    }));

  const showEntries: CalendarEntry[] = events.map((event) => ({
    kind: "show",
    eventId: event.id,
    title: event.name,
    href: `/events/${event.id}`,
    date: event.showDate,
  }));

  return [...deadlineEntries, ...showEntries].sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  );
}

// WIB (Asia/Jakarta, UTC+7) calendar day for an instant — matches the list
// view's `timeZone: "Asia/Jakarta"` formatting and src/lib/tasks/dates.ts,
// so a task due at 2026-08-11T00:00:00+07:00 buckets under 2026-08-11
// regardless of the server's local timezone.
export function dayKey(date: Date): string {
  const { y, m, d } = toWibParts(date);
  const month = String(m + 1).padStart(2, "0");
  const day = String(d).padStart(2, "0");
  return `${y}-${month}-${day}`;
}

// Grid-cell key for a monthMatrix() Date: monthMatrix builds cells from
// calendar components (new Date(year, month, day)), i.e. server-local
// midnight instants — NOT WIB instants. Keying those with dayKey (which
// reads WIB components) shifts every cell back a day on hosts east of
// UTC+7. cellKey reads the same calendar components the cell was built
// from, so it always matches the cell's intended calendar day regardless
// of host timezone.
export function cellKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function groupEntriesByDay(
  entries: CalendarEntry[],
): Map<string, CalendarEntry[]> {
  const grouped = new Map<string, CalendarEntry[]>();
  for (const entry of entries) {
    const key = dayKey(entry.date);
    const bucket = grouped.get(key);
    if (bucket) {
      bucket.push(entry);
    } else {
      grouped.set(key, [entry]);
    }
  }
  return grouped;
}

// Monday-first month grid: every week is exactly 7 days, padded with the
// trailing days of the previous/next month so the grid is whole weeks only.
export function monthMatrix(year: number, monthIndex: number): Date[][] {
  const firstOfMonth = new Date(year, monthIndex, 1);
  const lastOfMonth = new Date(year, monthIndex + 1, 0);

  // JS getDay(): 0=Sunday..6=Saturday. Shift so Monday=0..Sunday=6.
  const leadingOffset = (firstOfMonth.getDay() + 6) % 7;
  const trailingOffset = (7 - lastOfMonth.getDay()) % 7;

  const gridStart = new Date(year, monthIndex, 1 - leadingOffset);
  const gridEnd = new Date(
    year,
    monthIndex,
    lastOfMonth.getDate() + trailingOffset,
  );

  const days: Date[] = [];
  for (
    let cur = new Date(gridStart);
    cur.getTime() <= gridEnd.getTime();
    cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1)
  ) {
    days.push(new Date(cur));
  }

  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  return weeks;
}
