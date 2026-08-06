import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { formatIDR } from "@/app/(app)/approvals/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sessionActor } from "@/lib/auth/session-actor";
import { getEvent } from "@/lib/events/service";
import { can, PermissionError } from "@/lib/permissions";
import {
  listSnapshots,
  recordSnapshot,
  wibDayKey,
} from "@/lib/tickets/service";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Ticket sales" };

// T-093: daily manual ticket sales — entry for Ticketing, curve for all.
export default async function TicketsPage({
  params,
}: PageProps<"/events/[id]/tickets">) {
  const actor = await sessionActor();
  if (!actor) redirect("/login");

  const { id } = await params;
  const event = await getEvent(actor, id);
  if (!event) notFound();

  const snapshots = await listSnapshots(actor, id);
  const canRecord = can(actor, "tickets.record");
  const totalSold = snapshots.reduce((s, r) => s + r.ticketsSold, 0);
  const totalRevenue = snapshots.reduce((s, r) => s + r.revenue, 0);
  const soldPct =
    event.capacity && event.capacity > 0
      ? Math.round((totalSold / event.capacity) * 100)
      : null;
  const maxDay = Math.max(1, ...snapshots.map((s) => s.ticketsSold));

  async function recordAction(formData: FormData) {
    "use server";
    const actorInner = await sessionActor();
    if (!actorInner) throw new PermissionError("tickets.record");
    await recordSnapshot(actorInner, {
      eventId: id,
      day: String(formData.get("day")),
      ticketsSold: Number(formData.get("ticketsSold") ?? 0),
      revenue: Number(String(formData.get("revenue") ?? "0").replaceAll(".", "")),
      note: String(formData.get("note") ?? ""),
    });
    revalidatePath(`/events/${id}/tickets`);
  }

  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <Link
          href={`/events/${id}`}
          className="text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          ← {event.name}
        </Link>
        <h1 className="text-2xl font-semibold uppercase tracking-tight">
          Ticket sales
        </h1>
      </div>

      {/* totals */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          {
            label: "Total sold",
            value:
              soldPct !== null
                ? `${totalSold.toLocaleString("en")} (${soldPct}%)`
                : totalSold.toLocaleString("en"),
          },
          { label: "Capacity", value: event.capacity?.toLocaleString("en") ?? "—" },
          { label: "Revenue", value: formatIDR(totalRevenue) },
        ].map((cell) => (
          <div key={cell.label} className="flex flex-col gap-1 rounded-md border bg-card p-4">
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              {cell.label}
            </span>
            <span className="text-lg font-semibold tabular-nums">{cell.value}</span>
          </div>
        ))}
      </div>

      {canRecord ? (
        <form
          action={recordAction}
          className="flex flex-wrap items-end gap-3 rounded-md border bg-card p-4"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ts-day" className="text-xs">
              Date (WIB)
            </Label>
            <Input
              id="ts-day"
              name="day"
              type="date"
              required
              defaultValue={wibDayKey(new Date())}
              className="h-9 w-40"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ts-sold" className="text-xs">
              Tickets sold today
            </Label>
            <Input
              id="ts-sold"
              name="ticketsSold"
              type="number"
              min={0}
              required
              className="h-9 w-36"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ts-revenue" className="text-xs">
              Revenue (IDR)
            </Label>
            <Input
              id="ts-revenue"
              name="revenue"
              inputMode="numeric"
              placeholder="0"
              className="h-9 w-44"
            />
          </div>
          <div className="flex min-w-48 flex-1 flex-col gap-1.5">
            <Label htmlFor="ts-note" className="text-xs">
              Note
            </Label>
            <Input id="ts-note" name="note" className="h-9" />
          </div>
          <Button type="submit">Record</Button>
        </form>
      ) : null}

      {/* daily curve */}
      {snapshots.length === 0 ? (
        <p className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          No sales recorded yet.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider">
            Daily sales
          </h2>
          <div className="flex items-end gap-1.5 overflow-x-auto rounded-md border bg-card p-4">
            {snapshots.map((s) => (
              <div
                key={s.id}
                className="flex min-w-9 flex-col items-center gap-1"
                title={`${s.day}: ${s.ticketsSold.toLocaleString("en")} tickets · ${formatIDR(s.revenue)}${s.note ? ` — ${s.note}` : ""}`}
              >
                <span className="text-[9px] tabular-nums text-muted-foreground">
                  {s.ticketsSold.toLocaleString("en")}
                </span>
                <div
                  className={cn("w-6 rounded-t-sm bg-foreground/70")}
                  style={{
                    height: `${Math.max(6, Math.round((s.ticketsSold / maxDay) * 120))}px`,
                  }}
                />
                <span className="text-[9px] tabular-nums text-muted-foreground">
                  {s.day.slice(5)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
