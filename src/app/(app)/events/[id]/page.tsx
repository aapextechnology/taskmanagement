import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Countdown } from "@/components/countdown";
import { HealthBadge } from "@/components/health-badge";
import { PhaseSteps } from "@/components/phase-steps";
import { FileDown } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { sessionActor } from "@/lib/auth/session-actor";
import {
  getEvent,
  listEventDivisions,
  listPhases,
} from "@/lib/events/service";
import { listDivisions } from "@/lib/org/service";
import { can } from "@/lib/permissions";
import { listTemplates } from "@/lib/templates/service";
import { archiveEventAction, setCurrentPhaseAction } from "../actions";
import { ApplyPlaybook } from "./apply-playbook";
import { DivisionsManager } from "./divisions-manager";
import { WorkflowManager } from "./workflow-manager";

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
  const canManageDivisions = can(actor, "event.manageDivisions");
  const canManageWorkflow = can(actor, "event.manageWorkflow");
  const [activeDivisions, allDivisions, phases, templates] = await Promise.all([
    listEventDivisions(actor, event.id),
    canManageDivisions ? listDivisions() : [],
    listPhases(actor, event.id),
    can(actor, "event.create") ? listTemplates() : [],
  ]);
  const currentIndex = phases.findIndex((p) => p.id === event.currentPhaseId);
  const nextPhase = currentIndex >= 0 ? phases[currentIndex + 1] : phases[0];

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

          <PhaseSteps
            phases={phases.map((p) => ({ id: p.id, name: p.name }))}
            currentId={event.currentPhaseId}
          />

          {canManage ? (
            <div className="flex flex-wrap gap-3 pt-4">
              {nextPhase ? (
                <form action={setCurrentPhaseAction}>
                  <input type="hidden" name="eventId" value={event.id} />
                  <input type="hidden" name="phaseId" value={nextPhase.id} />
                  <Button type="submit" variant="outline">
                    Advance to {nextPhase.name} ↗
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

      <nav className="flex flex-wrap gap-6">
        {[
          { href: `/events/${event.id}/board`, label: "Board" },
          { href: `/events/${event.id}/list`, label: "List" },
          { href: `/events/${event.id}/calendar`, label: "Calendar" },
          { href: `/events/${event.id}/gantt`, label: "Gantt" },
          { href: `/events/${event.id}/handoffs`, label: "Handoffs" },
          { href: `/events/${event.id}/budget`, label: "Budget" },
          { href: `/events/${event.id}/guests`, label: "Guests" },
          { href: `/events/${event.id}/documents`, label: "Documents" },
          { href: `/events/${event.id}/run-of-show`, label: "Run of show" },
          { href: `/events/${event.id}/tickets`, label: "Tickets" },
        ].map((tab) => (
          <a
            key={tab.href}
            href={tab.href}
            className="group inline-flex items-center gap-1 text-sm font-medium uppercase tracking-wider underline-offset-4 hover:underline"
          >
            {tab.label}
            <span aria-hidden className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5">
              ↗
            </span>
          </a>
        ))}
      </nav>

      <div className="flex flex-wrap items-start gap-3">
        {canManageWorkflow ? (
          <WorkflowManager
            eventId={event.id}
            phases={phases.map((p) => ({ id: p.id, name: p.name }))}
            currentId={event.currentPhaseId}
          />
        ) : null}
        {canManageDivisions ? (
          <DivisionsManager
            eventId={event.id}
            allDivisions={allDivisions.map((d) => ({ id: d.id, name: d.name }))}
            activeIds={activeDivisions.map((d) => d.id)}
          />
        ) : null}
        {can(actor, "dashboard.view") ? (
          <a
            href={`/api/events/${event.id}/report`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <FileDown className="size-3.5" /> Progress report (PDF)
          </a>
        ) : null}
        {can(actor, "event.create") ? (
          <ApplyPlaybook
            eventId={event.id}
            templates={templates.map(({ template, itemCount }) => ({
              id: template.id,
              name: template.name,
              itemCount,
            }))}
          />
        ) : null}
      </div>
    </section>
  );
}
