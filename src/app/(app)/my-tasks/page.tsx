import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { sessionActor } from "@/lib/auth/session-actor";
import { auth, signOut } from "@/lib/auth";
import { PriorityIcon, StatusChip } from "@/components/task-meta";
import { bucketForDue, type DueBucket } from "@/lib/tasks/dates";
import { listMyTasks } from "@/lib/tasks/service";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "My Tasks" };

const BUCKETS: Array<{ key: DueBucket; label: string }> = [
  { key: "overdue", label: "Overdue" },
  { key: "today", label: "Today" },
  { key: "this_week", label: "This week" },
  { key: "later", label: "Later" },
  { key: "none", label: "No due date" },
];

const dt = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  timeZone: "Asia/Jakarta",
});

// T-033: the staff landing page — today / this week / overdue.
export default async function MyTasksPage() {
  const session = await auth();
  const actor = await sessionActor();
  if (!actor) redirect("/login");

  const rows = await listMyTasks(actor);
  const now = new Date();
  const grouped = new Map<DueBucket, typeof rows>();
  for (const row of rows) {
    const bucket = bucketForDue(row.task.dueDate, now);
    const list = grouped.get(bucket) ?? [];
    list.push(row);
    grouped.set(bucket, list);
  }

  return (
    <section className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold uppercase tracking-tight">
          My Tasks
        </h1>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-muted-foreground sm:block">
            {session?.user?.name}
          </span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <Button variant="outline" size="sm" type="submit">
              Sign out
            </Button>
          </form>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="py-16 text-sm text-muted-foreground">
          Nothing assigned to you right now. Check a division{" "}
          <Link href="/events" className="underline underline-offset-4">
            board
          </Link>
          .
        </p>
      ) : (
        <div className="flex flex-col gap-8">
          {BUCKETS.map(({ key, label }) => {
            const items = grouped.get(key);
            if (!items || items.length === 0) return null;
            return (
              <div key={key} className="flex flex-col gap-2">
                <h2
                  className={cn(
                    "text-xs font-semibold uppercase tracking-[0.2em]",
                    key === "overdue" ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  {label} · {items.length}
                </h2>
                <ul className="flex flex-col divide-y rounded-md border">
                  {items.map(({ task, eventName }) => (
                    <li key={task.id}>
                      <Link
                        href={`/tasks/${task.id}`}
                        className="flex items-center gap-4 px-4 py-2.5 text-sm transition-colors hover:bg-accent/50"
                      >
                        <PriorityIcon priority={task.priority} />
                        <span className="flex-1 font-medium">{task.title}</span>
                        <span className="hidden text-xs text-muted-foreground sm:block">
                          {eventName}
                        </span>
                        <StatusChip status={task.status} />
                        {task.dueDate ? (
                          <span
                            className={cn(
                              "text-xs tabular-nums",
                              key === "overdue"
                                ? "text-priority-urgent"
                                : "text-muted-foreground",
                            )}
                          >
                            {dt.format(task.dueDate)}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
