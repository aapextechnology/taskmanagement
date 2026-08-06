import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { formatIDR, TYPE_LABELS } from "@/app/(app)/approvals/shared";
import { Countdown } from "@/components/countdown";
import { HealthBadge } from "@/components/health-badge";
import { PriorityIcon } from "@/components/task-meta";
import { listMyQueue } from "@/lib/approvals/service";
import { sessionActor } from "@/lib/auth/session-actor";
import {
  getActivityFeed,
  getBlockers,
  getOverdueHotspots,
  getPortfolio,
  getUpcomingMilestones,
} from "@/lib/dashboard/service";
import { PHASE_LABELS } from "@/lib/events/service";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { InlineDecide } from "./inline-decide";

export const metadata: Metadata = { title: "Dashboard" };

const dt = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  timeZone: "Asia/Jakarta",
});
const dtLong = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

// T-060/T-061: the Owner's cockpit.
export default async function DashboardPage() {
  const actor = await sessionActor();
  if (!actor) redirect("/login");
  if (!can(actor, "dashboard.view")) redirect("/my-tasks");

  const [portfolio, queue, milestones, blockers, hotspots, feed] =
    await Promise.all([
      getPortfolio(actor),
      listMyQueue(actor),
      getUpcomingMilestones(actor),
      getBlockers(actor),
      getOverdueHotspots(actor),
      getActivityFeed(actor),
    ]);

  return (
    <section className="flex flex-col gap-10">
      <h1 className="text-3xl font-semibold uppercase tracking-tight">
        Dashboard
      </h1>

      {/* portfolio cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {portfolio.map((event) => (
          <Link
            key={event.id}
            href={`/events/${event.id}`}
            className="group flex flex-col gap-3 rounded-lg border p-4 transition-colors hover:border-foreground/30"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-semibold uppercase leading-tight tracking-tight">
                {event.name}
              </h2>
              <HealthBadge health={event.health} />
            </div>
            <Countdown target={event.showDate.toISOString()} className="text-lg" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{PHASE_LABELS[event.phase]}</span>
              {event.burnPct !== null ? (
                <span
                  className={cn(
                    "tabular-nums",
                    event.burnPct > 100
                      ? "text-status-blocked"
                      : event.burnPct > 90
                        ? "text-status-in-progress"
                        : "",
                  )}
                >
                  burn {event.burnPct}% of {formatIDR(event.planned)}
                </span>
              ) : (
                <span>no budget yet</span>
              )}
            </div>
            {event.burnPct !== null ? (
              <div className="h-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full",
                    event.burnPct > 100
                      ? "bg-status-blocked"
                      : event.burnPct > 90
                        ? "bg-status-in-progress"
                        : "bg-foreground/60",
                  )}
                  style={{ width: `${Math.min(event.burnPct, 100)}%` }}
                />
              </div>
            ) : null}
          </Link>
        ))}
      </div>

      {/* pending approvals — the Owner's main action surface */}
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider">
          Pending approvals{queue.length > 0 ? ` · ${queue.length}` : ""}
        </h2>
        {queue.length === 0 ? (
          <p className="rounded-md border px-4 py-6 text-sm text-muted-foreground">
            Nothing waiting for your decision. 🎉
          </p>
        ) : (
          <ul className="flex flex-col divide-y rounded-md border">
            {queue.map((approval) => (
              <li
                key={approval.id}
                className="flex flex-wrap items-center gap-3 px-4 py-3"
              >
                <span className="rounded-sm border px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {TYPE_LABELS[approval.type]}
                </span>
                <Link
                  href={`/approvals/${approval.id}`}
                  className="min-w-0 flex-1 truncate text-sm font-medium hover:underline"
                >
                  {approval.title}
                </Link>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {formatIDR(approval.amount)}
                </span>
                <InlineDecide approvalId={approval.id} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* milestones */}
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider">
            Milestones — next 14 days
          </h2>
          <ul className="flex flex-col divide-y rounded-md border">
            {milestones.length === 0 ? (
              <li className="px-4 py-6 text-sm text-muted-foreground">
                No high-priority deadlines in the window.
              </li>
            ) : (
              milestones.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/tasks/${m.id}`}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-accent/50"
                  >
                    <PriorityIcon priority={m.priority} />
                    <span className="min-w-0 flex-1 truncate">{m.title}</span>
                    <span className="hidden text-xs text-muted-foreground sm:block">
                      {m.eventName} · {m.divisionName}
                    </span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {m.dueDate ? dt.format(m.dueDate) : ""}
                    </span>
                  </Link>
                </li>
              ))
            )}
          </ul>
        </div>

        {/* blockers + hotspots */}
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider">
              Cross-division blockers
            </h2>
            <ul className="flex flex-col divide-y rounded-md border">
              {blockers.length === 0 ? (
                <li className="px-4 py-4 text-sm text-muted-foreground">
                  No blocked tasks are holding others up.
                </li>
              ) : (
                blockers.map((b) => (
                  <li key={b.id}>
                    <Link
                      href={`/tasks/${b.id}`}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-accent/50"
                    >
                      <span className="size-2 rounded-full bg-status-blocked" />
                      <span className="min-w-0 flex-1 truncate">{b.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {b.eventName} · {b.divisionName}
                      </span>
                    </Link>
                  </li>
                ))
              )}
            </ul>
          </div>
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider">
              Overdue hotspots
            </h2>
            <ul className="flex flex-col divide-y rounded-md border">
              {hotspots.length === 0 ? (
                <li className="px-4 py-4 text-sm text-muted-foreground">
                  Nothing overdue. 🌤
                </li>
              ) : (
                hotspots.map((h) => (
                  <li key={`${h.eventId}-${h.divisionId}`}>
                    <Link
                      href={`/events/${h.eventId}/board?division=${h.divisionId}`}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-accent/50"
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {h.eventName} · {h.divisionName}
                      </span>
                      <span className="rounded-full bg-status-blocked/15 px-2 text-xs font-semibold tabular-nums text-status-blocked">
                        {h.count}
                      </span>
                    </Link>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </div>

      {/* activity feed */}
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider">
          Recent activity
        </h2>
        <ul className="flex flex-col divide-y rounded-md border">
          {feed.map((entry) => (
            <li
              key={entry.id}
              className="flex flex-wrap items-center gap-2 px-4 py-2 text-xs text-muted-foreground"
            >
              <span className="font-medium text-foreground">
                {entry.actorName ?? "System"}
              </span>
              <span>{entry.action}</span>
              <span className="truncate">{entry.entity}</span>
              <span className="ml-auto tabular-nums">
                {dtLong.format(entry.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
