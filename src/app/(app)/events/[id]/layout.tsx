import { redirect } from "next/navigation";
import { sessionActor } from "@/lib/auth/session-actor";
import { eventColorClass } from "@/lib/events/colors";
import { getEvent, listEventPeople } from "@/lib/events/service";
import { EventContextBar } from "./event-context-bar";

// Shared shell for every /events/[id]/* route (Owner 2026-08-07): renders
// the persistent context bar once instead of each sub-page hand-rolling its
// own "← {event.name}" breadcrumb. If the event can't be resolved here,
// render children as-is — the page's own getEvent() call still runs and
// triggers its own notFound()/redirect, so error handling is unchanged.
export default async function EventLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const actor = await sessionActor();
  if (!actor) redirect("/login");

  const { id } = await params;
  // defensive: a bar that fails to resolve must never take the real page
  // down with it — the page's own getEvent() call still gates access
  const event = await getEvent(actor, id).catch(() => null);
  const people = event ? await listEventPeople(actor, id).catch(() => []) : [];

  return (
    <>
      {event ? (
        <EventContextBar
          eventId={id}
          name={event.name}
          phaseName={event.phaseName}
          health={event.health}
          showDate={event.showDate.toISOString()}
          swatch={eventColorClass(id, event.color)}
          people={people}
        />
      ) : null}
      {children}
    </>
  );
}
