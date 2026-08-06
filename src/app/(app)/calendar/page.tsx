import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CalendarGrid } from "@/components/calendar-grid";
import { CalendarMonthNav } from "@/components/calendar-month-nav";
import { sessionActor } from "@/lib/auth/session-actor";
import { buildCalendarEntries, type CalendarTask } from "@/lib/calendar/aggregate";
import { parseMonthParam } from "@/lib/calendar/month-param";
import { listActiveEvents } from "@/lib/events/service";
import { can } from "@/lib/permissions";
import { listEventTasks } from "@/lib/tasks/service";

export const metadata: Metadata = { title: "Calendar" };

// T-081: global calendar — every event this actor can see, plus their
// division-scoped tasks with a due date, on one Monday-first month grid.
// Data access goes through the same permission-scoped service functions as
// the events/board/list pages (listActiveEvents + listEventTasks per event).
export default async function CalendarPage({
  searchParams,
}: PageProps<"/calendar">) {
  const actor = await sessionActor();
  if (!actor) redirect("/login");

  const sp = await searchParams;
  const m = typeof sp.m === "string" ? sp.m : undefined;
  const { year, monthIndex } = parseMonthParam(m);

  const events = can(actor, "event.view") ? await listActiveEvents(actor) : [];
  const taskLists = await Promise.all(
    events.map((event) => listEventTasks(actor, event.id)),
  );
  const tasks: CalendarTask[] = taskLists.flat().map((t) => ({
    id: t.id,
    eventId: t.eventId,
    divisionId: t.divisionId,
    title: t.title,
    status: t.status,
    dueDate: t.dueDate,
  }));

  const entries = buildCalendarEntries({
    tasks,
    events: events.map((e) => ({ id: e.id, name: e.name, showDate: e.showDate })),
  });
  const eventNames = new Map(events.map((e) => [e.id, e.name]));

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-3xl font-semibold uppercase tracking-tight">
          Calendar
        </h1>
      </div>

      <CalendarMonthNav basePath="/calendar" year={year} monthIndex={monthIndex} />

      {events.length === 0 ? (
        <p className="rounded-md border border-dashed px-4 py-6 text-sm text-muted-foreground">
          No events visible to you yet.
        </p>
      ) : (
        <CalendarGrid
          year={year}
          monthIndex={monthIndex}
          entries={entries}
          eventNames={eventNames}
        />
      )}

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="text-[9px]">●</span> Show date
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="text-[9px]">○</span> Task deadline
        </span>
      </div>
    </section>
  );
}
