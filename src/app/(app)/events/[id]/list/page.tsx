import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { LabelChip } from "@/components/label-chip";
import {
  AvatarStack,
  PriorityIcon,
  StatusDot,
  STATUS_TEXT,
} from "@/components/task-meta";
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
  TASK_STATUS_ORDER,
  type ListFilters,
  type TaskStatus,
} from "@/lib/tasks/service";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Task list" };

const dt = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  timeZone: "Asia/Jakarta",
});

type SortKey = "due" | "priority" | "title" | "created";
const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: "due", label: "Due date" },
  { key: "priority", label: "Priority" },
  { key: "title", label: "Title" },
  { key: "created", label: "Created" },
];

const PRIORITY_RANK = { urgent: 0, high: 1, medium: 2, low: 3 } as const;

function FilterPill({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-all duration-150",
        active
          ? "border-foreground bg-foreground font-medium text-background shadow-sm"
          : "text-muted-foreground hover:border-foreground/40 hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}

// Plane-style list (Owner request): grouped by status with counts, free sort.
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
  const str = (key: string) =>
    typeof sp[key] === "string" && sp[key] ? (sp[key] as string) : undefined;

  const sort = (str("sort") as SortKey) ?? "due";
  const dir = str("dir") === "desc" ? "desc" : "asc";
  const filters: ListFilters = {
    priority: str("priority") as ListFilters["priority"],
    divisionId: str("division"),
    status: str("status") as TaskStatus | undefined,
  };

  const [tasks, divisions, saved] = await Promise.all([
    listEventTasks(actor, id, {
      priority: filters.priority,
      divisionId: filters.divisionId,
    }),
    listDivisions(),
    listSavedFilters(actor),
  ]);
  const divisionName = new Map(divisions.map((d) => [d.id, d.name]));

  const sorted = [...tasks].sort((a, b) => {
    let cmp = 0;
    if (sort === "due") {
      cmp =
        (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity);
    } else if (sort === "priority") {
      cmp = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    } else if (sort === "title") {
      cmp = a.title.localeCompare(b.title);
    } else {
      cmp = a.createdAt.getTime() - b.createdAt.getTime();
    }
    return dir === "desc" ? -cmp : cmp;
  });

  const groups = (
    filters.status ? [filters.status] : TASK_STATUS_ORDER
  ).map((status) => ({
    status,
    items: sorted.filter((t) => t.status === status),
  }));

  const query = (patch: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    const current: Record<string, string | undefined> = {
      sort,
      dir,
      priority: filters.priority,
      division: filters.divisionId,
      status: filters.status,
      ...patch,
    };
    for (const [key, value] of Object.entries(current)) {
      if (value) q.set(key, value);
    }
    const s = q.toString();
    return `/events/${id}/list${s ? `?${s}` : ""}`;
  };

  async function saveFilterAction(formData: FormData) {
    "use server";
    const actorInner = await sessionActor();
    if (!actorInner) throw new PermissionError("task.viewDivision");
    const name = String(formData.get("name") ?? "").trim();
    if (!name) return;
    await saveFilter(actorInner, name, {
      priority:
        (String(formData.get("priority") ?? "") as ListFilters["priority"]) ||
        undefined,
      divisionId: String(formData.get("division") ?? "") || undefined,
      status: (String(formData.get("status") ?? "") as TaskStatus) || undefined,
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

      {/* sort + filters — styled pills, no native controls */}
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Sort
          </span>
          {SORTS.map((s) => (
            <FilterPill
              key={s.key}
              href={query({ sort: s.key })}
              active={sort === s.key}
            >
              {s.label}
            </FilterPill>
          ))}
          <FilterPill
            href={query({ dir: dir === "asc" ? "desc" : "asc" })}
            active={false}
          >
            {dir === "asc" ? "↑ asc" : "↓ desc"}
          </FilterPill>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Division
          </span>
          <FilterPill href={query({ division: undefined })} active={!filters.divisionId}>
            All
          </FilterPill>
          {divisions.map((d) => (
            <FilterPill
              key={d.id}
              href={query({ division: d.id })}
              active={filters.divisionId === d.id}
            >
              {d.name}
            </FilterPill>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Priority
          </span>
          <FilterPill href={query({ priority: undefined })} active={!filters.priority}>
            All
          </FilterPill>
          {(["urgent", "high", "medium", "low"] as const).map((p) => (
            <FilterPill
              key={p}
              href={query({ priority: p })}
              active={filters.priority === p}
            >
              <PriorityIcon priority={p} />
              {p}
            </FilterPill>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <form action={saveFilterAction} className="flex items-center gap-2">
            <input type="hidden" name="priority" value={filters.priority ?? ""} />
            <input type="hidden" name="division" value={filters.divisionId ?? ""} />
            <input type="hidden" name="status" value={filters.status ?? ""} />
            <Input name="name" placeholder="Save view as…" className="h-8 w-36 text-xs" />
            <Button type="submit" size="sm" variant="ghost">
              Save
            </Button>
          </form>
          {saved.map((f) => {
            const p = f.params as ListFilters;
            const q = new URLSearchParams();
            if (p.status) q.set("status", p.status);
            if (p.priority) q.set("priority", p.priority);
            if (p.divisionId) q.set("division", p.divisionId);
            return (
              <span key={f.id} className="flex items-center gap-1">
                <FilterPill href={`/events/${id}/list?${q.toString()}`} active={false}>
                  {f.name}
                </FilterPill>
                <form action={deleteFilterAction}>
                  <input type="hidden" name="filterId" value={f.id} />
                  <button
                    type="submit"
                    aria-label={`Delete view ${f.name}`}
                    className="text-xs text-muted-foreground hover:text-destructive"
                  >
                    ×
                  </button>
                </form>
              </span>
            );
          })}
        </div>
      </div>

      {/* status groups, Plane-style */}
      <div className="flex flex-col gap-5">
        {groups.map(({ status, items }) => (
          <div key={status} className="flex flex-col gap-2">
            <div className="flex items-center gap-2.5 px-1">
              <StatusDot status={status} className="size-2.5" />
              <h2 className="text-sm font-semibold">{STATUS_TEXT[status]}</h2>
              <span className="rounded-full bg-muted px-2 text-[11px] tabular-nums text-muted-foreground">
                {items.length}
              </span>
            </div>
            {items.length === 0 ? (
              <p className="rounded-md border border-dashed px-4 py-3 text-xs text-muted-foreground">
                No tasks.
              </p>
            ) : (
              <ul className="flex flex-col divide-y rounded-md border bg-card">
                {items.map((task) => (
                  <li key={task.id}>
                    <Link
                      href={`/tasks/${task.id}`}
                      className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-accent/50"
                    >
                      <PriorityIcon priority={task.priority} />
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {task.title}
                      </span>
                      {task.labels.map((label) => (
                        <LabelChip
                          key={label.id}
                          name={label.name}
                          color={label.color}
                          className="hidden sm:inline-flex"
                        />
                      ))}
                      <span className="hidden text-xs text-muted-foreground md:block">
                        {divisionName.get(task.divisionId)}
                      </span>
                      <AvatarStack users={task.assignees} />
                      <span className="w-14 text-right text-xs tabular-nums text-muted-foreground">
                        {task.dueDate ? dt.format(task.dueDate) : "—"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
