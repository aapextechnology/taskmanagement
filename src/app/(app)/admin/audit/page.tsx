import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listActivity, type ActivityFilters } from "@/lib/activity";
import { sessionActor } from "@/lib/auth/session-actor";
import { listActiveEvents } from "@/lib/events/service";
import { listUsersWithMemberships } from "@/lib/org/service";
import { can } from "@/lib/permissions";

export const metadata: Metadata = { title: "Audit log" };

const selectClass =
  "border-input h-8 rounded-md border bg-transparent px-2 text-xs outline-none";

const dt = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "medium",
  timeZone: "Asia/Jakarta",
});

const ENTITY_TYPES = [
  "profile",
  "division",
  "event",
  "task",
  "handoff",
  "approval",
  "budget_line",
  "expense",
];

// T-063: filterable audit trail — Owner/Admin only.
export default async function AuditPage({
  searchParams,
}: PageProps<"/admin/audit">) {
  const actor = await sessionActor();
  if (!actor || !can(actor, "audit.view")) redirect("/my-tasks");

  const sp = await searchParams;
  const str = (key: string) =>
    typeof sp[key] === "string" && sp[key] ? (sp[key] as string) : undefined;
  const filters: ActivityFilters = {
    actorId: str("actor"),
    entityType: str("entity"),
    eventId: str("event"),
    from: str("from") ? new Date(`${str("from")}T00:00:00+07:00`) : undefined,
    to: str("to") ? new Date(`${str("to")}T23:59:59+07:00`) : undefined,
  };

  const [rows, users, events] = await Promise.all([
    listActivity(actor, filters),
    listUsersWithMemberships(),
    listActiveEvents(actor),
  ]);

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link
          href="/admin"
          className="text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          ← Admin
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          Audit log
        </h1>
      </div>

      <form method="GET" className="flex flex-wrap items-center gap-2">
        <select name="actor" className={selectClass} defaultValue={str("actor") ?? ""}>
          <option value="">Any actor</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <select name="entity" className={selectClass} defaultValue={str("entity") ?? ""}>
          <option value="">Any entity</option>
          {ENTITY_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select name="event" className={selectClass} defaultValue={str("event") ?? ""}>
          <option value="">Any event</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
        <Input type="date" name="from" defaultValue={str("from") ?? ""} className="h-8 w-36 text-xs" />
        <Input type="date" name="to" defaultValue={str("to") ?? ""} className="h-8 w-36 text-xs" />
        <Button type="submit" size="sm" variant="outline">
          Filter
        </Button>
        {Object.values(filters).some(Boolean) ? (
          <Link href="/admin/audit" className="text-xs text-muted-foreground hover:underline">
            reset
          </Link>
        ) : null}
      </form>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b text-left uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-2 font-medium">When (WIB)</th>
              <th className="px-3 py-2 font-medium">Actor</th>
              <th className="px-3 py-2 font-medium">Action</th>
              <th className="px-3 py-2 font-medium">Entity</th>
              <th className="px-3 py-2 font-medium">Detail</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b align-top last:border-0">
                <td className="whitespace-nowrap px-3 py-2 tabular-nums text-muted-foreground">
                  {dt.format(row.createdAt)}
                </td>
                <td className="px-3 py-2 font-medium">{row.actorName ?? "System"}</td>
                <td className="px-3 py-2">{row.actionLabel}</td>
                <td
                  className="px-3 py-2 text-muted-foreground"
                  title={row.entity}
                >
                  {row.entityLabel}
                </td>
                <td className="max-w-md truncate px-3 py-2 font-mono text-[10px] text-muted-foreground">
                  {row.detail ? JSON.stringify(row.detail) : ""}
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                  No entries match.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
