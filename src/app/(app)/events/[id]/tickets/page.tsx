import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { formatIDR } from "@/app/(app)/approvals/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sessionActor } from "@/lib/auth/session-actor";
import { TesseraMap } from "./tessera-map";
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
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await sessionActor();
  if (!actor) redirect("/login");

  const { id } = await params;
  const sp = await searchParams;
  const event = await getEvent(actor, id);
  if (!event) notFound();

  const snapshots = await listSnapshots(actor, id);
  const canRecord = can(actor, "tickets.record");
  const canMapTessera = can(actor, "org.manage");
  const tab = sp.tab === "manual" ? "manual" : "connect";

  // The Connect tab talks to an unofficial, rate-limited API — so it fetches
  // ONLY when open, never as a side effect of glancing at the sales curve.
  const connect: {
    kpis: { sold: number | null; revenue: number | null } | null;
    participants: Awaited<ReturnType<typeof import("@/lib/tessera/client").listTesseraParticipants>>;
    error: string | null;
    status: Awaited<ReturnType<typeof import("@/lib/tessera/client").getTesseraStatus>> | null;
  } = { kpis: null, participants: [], error: null, status: null };
  if (tab === "connect" && canRecord) {
    const { listTesseraEvents, listTesseraParticipants, getTesseraStatus } =
      await import("@/lib/tessera/client");
    connect.status = canMapTessera ? await getTesseraStatus(actor) : null;
    if (event.tesseraEventId && canMapTessera) {
      try {
        const rows = await listTesseraEvents(actor);
        const mine = rows.find((r) => r.id === event.tesseraEventId);
        if (mine) connect.kpis = { sold: mine.ticketsSold, revenue: mine.revenue };
      } catch (error) {
        connect.error = error instanceof Error ? error.message : "Tessera unreachable.";
      }
    }
    if (event.tesseraEventId && !connect.error) {
      try {
        connect.participants = await listTesseraParticipants(actor, event.tesseraEventId, 50);
      } catch (error) {
        connect.error = error instanceof Error ? error.message : "Tessera unreachable.";
      }
    }
  }
  // the aggregate cards are gone (Owner 2026-08-12): the headline numbers
  // come from Tessera on the Connect tab, and two competing totals on one
  // page is how people stop trusting either
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
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          Ticket sales
        </h1>
        {/* Manual | Connect — the source of truth stays ONE table either way;
            Connect only automates what the form does by hand */}
        <div className="flex w-fit rounded-md border p-0.5 text-sm">
          <a
            href={`/events/${id}/tickets`}
            className={cn(
              "rounded px-3 py-1 transition-colors",
              tab === "connect" ? "bg-accent font-medium" : "text-muted-foreground hover:text-foreground",
            )}
          >
            Connect (Tessera)
          </a>
          <a
            href={`/events/${id}/tickets?tab=manual`}
            className={cn(
              "rounded px-3 py-1 transition-colors",
              tab === "manual" ? "bg-accent font-medium" : "text-muted-foreground hover:text-foreground",
            )}
          >
            Manual
          </a>
        </div>
      </div>

      {tab === "connect" ? (
        <div className="flex flex-col gap-4">
          {!canRecord ? (
            <p className="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
              Connecting ticketing needs the tickets.record capability.
            </p>
          ) : (
            <>
              {canMapTessera ? (
                <TesseraMap eventId={id} mappedId={event.tesseraEventId} />
              ) : null}
              {connect.status && !connect.status.configured ? (
                <p className="rounded-md border border-dashed px-4 py-4 text-sm text-muted-foreground">
                  No Tessera token is connected yet. Paste one in{" "}
                  <a href="/admin" className="underline underline-offset-4">Admin → Tessera ticketing</a>{" "}
                  — one token serves the whole organisation, so it lives there
                  rather than on each event.
                </p>
              ) : null}
              {connect.error ? (
                <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                  {connect.error}
                </p>
              ) : null}
              {connect.status?.lastOkAt ? (
                <p className="text-xs text-muted-foreground">
                  Last sync with Tessera:{" "}
                  {new Date(connect.status.lastOkAt).toLocaleString("en-GB", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "Asia/Jakarta",
                  })}{" "}
                  WIB — refreshed hourly, or from Admin → Sync now.
                </p>
              ) : null}
              {event.tesseraEventId && connect.kpis ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1 rounded-md border bg-card p-4">
                    <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      Tessera · tickets sold
                    </span>
                    <span className="text-lg font-semibold tabular-nums">
                      {connect.kpis.sold?.toLocaleString("en") ?? "—"}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 rounded-md border bg-card p-4">
                    <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      Tessera · revenue
                    </span>
                    <span className="text-lg font-semibold tabular-nums">
                      {connect.kpis.revenue !== null ? formatIDR(connect.kpis.revenue) : "—"}
                    </span>
                  </div>
                </div>
              ) : null}
              {event.tesseraEventId ? (
                connect.participants.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    <h2 className="text-sm font-semibold">Transactions (from Tessera)</h2>
                    <div className="overflow-x-auto rounded-md border bg-card">
                      <table className="w-full min-w-[640px] text-sm">
                        <thead>
                          <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                            <th className="px-3 py-2.5 font-medium">Order</th>
                            <th className="px-3 py-2.5 font-medium">Name</th>
                            <th className="px-3 py-2.5 font-medium">Email</th>
                            <th className="px-3 py-2.5 font-medium">Category</th>
                            <th className="px-3 py-2.5 font-medium">Purchased</th>
                            <th className="px-3 py-2.5 text-right font-medium">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {connect.participants.map((row, i) => (
                            <tr key={`${row.orderNo ?? i}`} className="border-b last:border-0">
                              <td className="px-3 py-2 font-mono text-xs">{row.orderNo ?? "—"}</td>
                              <td className="px-3 py-2">{row.name ?? "—"}</td>
                              <td className="px-3 py-2 text-xs text-muted-foreground">{row.email ?? "—"}</td>
                              <td className="px-3 py-2 text-xs">{row.category ?? "—"}</td>
                              <td className="px-3 py-2 text-xs text-muted-foreground">{row.purchasedAt ?? "—"}</td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {row.amount !== null ? formatIDR(row.amount) : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : !connect.error ? (
                  <p className="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                    No transactions readable yet.
                  </p>
                ) : null
              ) : (
                <p className="text-xs text-muted-foreground">
                  Link a Tessera event above to see its transactions here.
                </p>
              )}
            </>
          )}
        </div>
      ) : null}

      {tab === "manual" && canRecord ? (
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

      {/* daily curve — manual view of the same snapshot table */}
      {tab !== "manual" ? null : snapshots.length === 0 ? (
        <p className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          No sales recorded yet.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">
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
