import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { KanbanBoard } from "@/components/kanban-board";
import { sessionActor } from "@/lib/auth/session-actor";
import { getEvent, listEventDivisions } from "@/lib/events/service";
import { can } from "@/lib/permissions";
import {
  listBoardTasks,
  listDivisionMemberOptions,
  listLabels,
} from "@/lib/tasks/service";
import { cn } from "@/lib/utils";
import { NewTaskDialog } from "@/components/new-task-dialog";

export const metadata: Metadata = { title: "Board" };

export default async function BoardPage({
  params,
  searchParams,
}: PageProps<"/events/[id]/board">) {
  const actor = await sessionActor();
  if (!actor) redirect("/login");

  const { id } = await params;
  const event = await getEvent(actor, id);
  if (!event) notFound();

  // board tabs = the divisions ACTIVE ON THIS EVENT (master data managed on
  // the event workspace), intersected with what the actor may see
  const eventDivisionList = await listEventDivisions(actor, id);
  const visibleDivisions = eventDivisionList.filter((d) =>
    can(actor, "task.viewDivision", { divisionId: d.id }),
  );
  if (visibleDivisions.length === 0) redirect(`/events/${id}`);

  const sp = await searchParams;
  const requested = typeof sp.division === "string" ? sp.division : undefined;
  const division =
    visibleDivisions.find((d) => d.id === requested) ?? visibleDivisions[0];

  const [tasks, members, labels] = await Promise.all([
    listBoardTasks(actor, id, division.id),
    listDivisionMemberOptions(division.id),
    listLabels(),
  ]);
  const canCreate = can(actor, "task.create", { divisionId: division.id });

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <Link
            href={`/events/${id}`}
            className="text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            ← {event.name}
          </Link>
          <h1 className="text-2xl font-semibold uppercase tracking-tight">
            {division.name} board
          </h1>
        </div>
        <nav className="flex flex-wrap gap-2">
          {visibleDivisions.map((d) => (
            <Link
              key={d.id}
              href={`/events/${id}/board?division=${d.id}`}
              className={cn(
                "rounded-sm border px-2.5 py-1 text-[11px] uppercase tracking-wider",
                d.id === division.id
                  ? "border-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {d.name}
            </Link>
          ))}
        </nav>
      </div>

      {canCreate ? (
        <NewTaskDialog
          eventId={id}
          divisions={[
            {
              id: division.id,
              name: division.name,
              members: members.map((m) => ({ id: m.id, name: m.name })),
            },
          ]}
          labels={labels}
        />
      ) : null}

      <KanbanBoard
        tasks={tasks.map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          dueDate: t.dueDate?.toISOString() ?? null,
          assignees: t.assignees,
          labels: t.labels,
        }))}
      />
    </section>
  );
}
