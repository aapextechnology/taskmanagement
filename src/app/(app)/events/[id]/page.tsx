import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Countdown } from "@/components/countdown";
import { HealthBadge } from "@/components/health-badge";
import { PhaseSteps } from "@/components/phase-steps";
import { Button } from "@/components/ui/button";
import { sessionActor } from "@/lib/auth/session-actor";
import {
  EVENT_PHASES_ORDER,
  getEvent,
  PHASE_LABELS,
} from "@/lib/events/service";
import { can } from "@/lib/permissions";
import { archiveEventAction, updatePhaseAction } from "../actions";

export const metadata: Metadata = { title: "Event" };

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "full",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

// T-022: the event workspace shell — countdown front and center.
export default async function EventPage({ params }: PageProps<"/events/[id]">) {
  const actor = await sessionActor();
  if (!actor || !can(actor, "event.view")) redirect("/login");

  const { id } = await params;
  const event = await getEvent(actor, id);
  if (!event) notFound();

  const canManage = can(actor, "event.updatePhase");
  const currentIndex = EVENT_PHASES_ORDER.indexOf(event.phase);
  const nextPhase = EVENT_PHASES_ORDER[currentIndex + 1];

  return (
    <section className="flex flex-col gap-10">
      <div className="flex flex-col gap-6 border-b pb-10 md:flex-row md:items-start md:gap-10">
        <div className="w-full max-w-[240px] shrink-0 overflow-hidden rounded-md border bg-muted">
          {event.coverImagePath ? (
            // eslint-disable-next-line @next/next/no-img-element -- auth-gated route
            <img
              src={`/api/files/${event.coverImagePath}`}
              alt={`${event.name} poster`}
              className="aspect-[3/4] w-full object-cover"
            />
          ) : (
            <div className="flex aspect-[3/4] items-center justify-center text-5xl font-semibold uppercase text-muted-foreground/40">
              {event.name.slice(0, 2)}
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-5">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-4xl font-semibold uppercase leading-[1.05] tracking-tight sm:text-5xl">
              {event.name}
            </h1>
            <HealthBadge health={event.health} className="mt-2" />
          </div>
          <p className="text-sm text-muted-foreground">
            {event.artists && <>{event.artists} · </>}
            {event.venue}
            {event.capacity ? <> · cap {event.capacity.toLocaleString("en")}</> : null}
          </p>
          <p className="text-sm text-muted-foreground">
            {dateFormat.format(event.showDate)} WIB
          </p>

          <div className="flex flex-col gap-2 py-4">
            <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
              To show day
            </span>
            <Countdown
              target={event.showDate.toISOString()}
              className="text-3xl sm:text-4xl"
            />
          </div>

          <PhaseSteps current={event.phase} />

          {canManage ? (
            <div className="flex flex-wrap gap-3 pt-4">
              {nextPhase ? (
                <form action={updatePhaseAction}>
                  <input type="hidden" name="eventId" value={event.id} />
                  <input type="hidden" name="phase" value={nextPhase} />
                  <Button type="submit" variant="outline">
                    Advance to {PHASE_LABELS[nextPhase]} ↗
                  </Button>
                </form>
              ) : null}
              <form action={archiveEventAction}>
                <input type="hidden" name="eventId" value={event.id} />
                <input type="hidden" name="archived" value="true" />
                <Button type="submit" variant="ghost">
                  Archive
                </Button>
              </form>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold uppercase tracking-tight">
          Boards
        </h2>
        <p className="text-sm text-muted-foreground">
          Division boards, tasks, and handoffs land with EPIC-003.
        </p>
      </div>
    </section>
  );
}
