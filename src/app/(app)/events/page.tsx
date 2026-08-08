import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Countdown } from "@/components/countdown";
import { HealthBadge } from "@/components/health-badge";
import { buttonVariants } from "@/components/ui/button";
import { sessionActor } from "@/lib/auth/session-actor";
import { CalendarRange } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { listActiveEvents } from "@/lib/events/service";
import { can } from "@/lib/permissions";

export const metadata: Metadata = { title: "Events" };

// T-024: gallery grid of active events, RVC style — poster carries the color.
export default async function EventsPage() {
  const actor = await sessionActor();
  if (!actor || !can(actor, "event.view")) redirect("/login");

  const events = await listActiveEvents(actor);
  const canCreate = can(actor, "event.create");

  return (
    <section className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">
            Events
          </h1>
          <p className="text-sm text-muted-foreground">
            Every active show — open one to reach its board, budget, and crew.
          </p>
        </div>
        {canCreate ? (
          <Link href="/events/new" className={buttonVariants()}>
            New event ↗
          </Link>
        ) : null}
      </div>

      {events.length === 0 ? (
        <EmptyState
          icon={CalendarRange}
          title="No active events"
          hint="Create the first show — its board, budget, and crew spaces come with it."
          action={
            canCreate ? (
              <Link href="/events/new" className={buttonVariants()}>
                New event ↗
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <Link
              key={event.id}
              href={`/events/${event.id}`}
              className="group flex flex-col overflow-hidden rounded-md border elev elev-hover hover:border-foreground/40"
            >
              <div className="relative aspect-[3/2] w-full overflow-hidden bg-muted">
                {event.coverImagePath ? (
                  // eslint-disable-next-line @next/next/no-img-element -- auth-gated route, next/image can't optimize it
                  <img
                    src={`/api/files/${event.coverImagePath}`}
                    alt={`${event.name} poster`}
                    className="size-full object-cover transition-transform group-hover:scale-[1.02]"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center text-4xl font-semibold uppercase tracking-widest text-muted-foreground/50">
                    {event.name.slice(0, 2)}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-semibold uppercase leading-tight tracking-tight">
                    {event.name}
                  </h2>
                  <HealthBadge health={event.health} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {event.venue} · {event.phaseName}
                </p>
                <Countdown
                  target={event.showDate.toISOString()}
                  className="text-xs"
                />
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
