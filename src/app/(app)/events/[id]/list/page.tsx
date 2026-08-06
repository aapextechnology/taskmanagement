import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sessionActor } from "@/lib/auth/session-actor";
import { getEvent } from "@/lib/events/service";
import { listDivisions } from "@/lib/org/service";
import { PermissionError } from "@/lib/permissions";
import {
  deleteFilter,
  listEventTasks,
  listSavedFilters,
  saveFilter,
  STATUS_LABELS,
  TASK_STATUS_ORDER,
  type ListFilters,
  type TaskStatus,
} from "@/lib/tasks/service";

export const metadata: Metadata = { title: "Task list" };

const selectClass =
  "border-input h-8 rounded-md border bg-transparent px-2 text-xs outline-none";

const dt = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Jakarta",
});

// T-032: list view with per-user saved filters.
export default async function TaskListPage({
  params,
  searchParams,
}: PageProps<"/events/[id]/list">) {
  const actor = await sessionActor();
  if (!actor) redirect("/login");

  const { id } = await params;
  const event = await getEvent(actor, id);
  if (!event) notFound();

  const sp = await searchParams;
  const filters: ListFilters = {
    status:
      typeof sp.status === "string" && sp.status
        ? (sp.status as TaskStatus)
        : undefined,
    priority:
      typeof sp.priority === "string" && sp.priority
        ? (sp.priority as ListFilters["priority"])
        : undefined,
    divisionId:
      typeof sp.division === "string" && sp.division ? sp.division : undefined,
  };

  const [tasks, divisions, saved] = await Promise.all([
    listEventTasks(actor, id, filters),
    listDivisions(),
    listSavedFilters(actor),
  ]);

  async function saveFilterAction(formData: FormData) {
    "use server";
    const actorInner = await sessionActor();
    if (!actorInner) throw new PermissionError("task.viewDivision");
    const name = String(formData.get("name") ?? "").trim();
    if (!name) return;
    await saveFilter(actorInner, name, {
      status: String(formData.get("status") ?? "") as TaskStatus | undefined || undefined,
      priority:
        (String(formData.get("priority") ?? "") as ListFilters["priority"]) ||
        undefined,
      divisionId: String(formData.get("division") ?? "") || undefined,
    });
    revalidatePath(`/events/${id}/list`);
  }

  async function deleteFilterAction(formData: FormData) {
    "use server";
    const actorInner = await sessionActor();
    if (!actorInner) throw new PermissionError("task.viewDivision");
    await deleteFilter(actorInner, String(formData.get("filterId")));
    revalidatePath(`/events/${id}/list`);
  }

  const query = (f: ListFilters) => {
    const q = new URLSearchParams();
    if (f.status) q.set("status", f.status);
    if (f.priority) q.set("priority", f.priority);
    if (f.divisionId) q.set("division", f.divisionId);
    return q.toString();
  };

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link
          href={`/events/${id}`}
          className="text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          ← {event.name}
        </Link>
        <h1 className="text-2xl font-semibold uppercase tracking-tight">
          Task list
        </h1>
      </div>

      {/* filter bar (GET form) + save current filter */}
      <div className="flex flex-wrap items-end gap-3">
        <form method="GET" className="flex flex-wrap items-center gap-2">
          <select name="status" className={selectClass} defaultValue={filters.status ?? ""}>
            <option value="">Any status</option>
            {TASK_STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <select name="priority" className={selectClass} defaultValue={filters.priority ?? ""}>
            <option value="">Any priority</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
          <select name="division" className={selectClass} defaultValue={filters.divisionId ?? ""}>
            <option value="">Any division</option>
            {divisions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <Button type="submit" size="sm" variant="outline">
            Filter
          </Button>
        </form>

        <form action={saveFilterAction} className="flex items-center gap-2">
          <input type="hidden" name="status" value={filters.status ?? ""} />
          <input type="hidden" name="priority" value={filters.priority ?? ""} />
          <input type="hidden" name="division" value={filters.divisionId ?? ""} />
          <Input name="name" placeholder="Save filter as…" className="h-8 w-36 text-xs" />
          <Button type="submit" size="sm" variant="ghost">
            Save
          </Button>
        </form>
      </div>

      {saved.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Saved:
          </span>
          {saved.map((f) => (
            <span key={f.id} className="flex items-center gap-1">
              <Link
                href={`/events/${id}/list?${query(f.params as ListFilters)}`}
                className="rounded-sm border px-2 py-0.5 text-[11px] hover:bg-accent"
              >
                {f.name}
              </Link>
              <form action={deleteFilterAction}>
                <input type="hidden" name="filterId" value={f.id} />
                <button
                  type="submit"
                  aria-label={`Delete filter ${f.name}`}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  ×
                </button>
              </form>
            </span>
          ))}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Task</th>
              <th className="px-4 py-2.5 font-medium">Division</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Priority</th>
              <th className="px-4 py-2.5 font-medium">Due</th>
              <th className="px-4 py-2.5 font-medium">Assignees</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id} className="border-b last:border-0 hover:bg-accent/40">
                <td className="px-4 py-2.5">
                  <Link href={`/tasks/${task.id}`} className="font-medium hover:underline">
                    {task.title}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">
                  {task.divisionId}
                </td>
                <td className="px-4 py-2.5 text-xs uppercase">
                  {STATUS_LABELS[task.status]}
                </td>
                <td className="px-4 py-2.5 text-xs uppercase">{task.priority}</td>
                <td className="px-4 py-2.5 text-xs tabular-nums">
                  {task.dueDate ? dt.format(task.dueDate) : "—"}
                </td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">
                  {task.assignees.map((a) => a.name).join(", ") || "—"}
                </td>
              </tr>
            ))}
            {tasks.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No tasks match.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
