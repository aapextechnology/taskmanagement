import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { formatIDR } from "@/app/(app)/approvals/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sessionActor } from "@/lib/auth/session-actor";
import { ChannelMap } from "./channel-map";
import { apiHealth } from "@/lib/tessera/health";
import { formatMoney } from "@/lib/tickets/money";
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
  const canManageChannels = can(actor, "org.manage");
  const tab = sp.tab === "manual" ? "manual" : "connect";
  const channelFilter =
    sp.channel === "tessera" || sp.channel === "megatix" ? sp.channel : "all";

  // The Connect tab reads the DATABASE, never the providers (Owner
  // 2026-08-13, extended for Megatix 2026-08-17): each sync stores every
  // transaction as-is, so rendering this page costs zero API calls — and
  // when a token dies the tab still shows the last-synced truth under its
  // timestamp instead of going blank.
  //
  // Two channels now (Owner: "ada 2 channel — tessera dan megatix"). A show
  // can sell on both at once, so totals are per channel AND combined; a
  // single blended number would hide which platform stopped reporting.
  type ChannelKey = "tessera" | "megatix";
  interface ChannelView {
    provider: ChannelKey;
    providerEventId: string | null;
    presenterId: string | null;
    tickets: number;
    revenue: number;
    fees: number;
    currency: string | null;
    rows: number;
  }
  const connect: {
    channels: ChannelView[];
    transactions: Array<{
      id: string;
      provider: string;
      orderId: string | null;
      buyerName: string | null;
      buyerEmail: string | null;
      category: string | null;
      status: string | null;
      promoCode: string | null;
      purchasedAt: Date | null;
      quantity: number;
      currency: string | null;
      ticketPrice: string | null;
      grossSales: string | null;
      totalFees: string | null;
      netSales: string | null;
    }>;
    tesseraStatus: Awaited<
      ReturnType<typeof import("@/lib/tessera/client").getTesseraStatus>
    > | null;
    megatixStatus: Awaited<
      ReturnType<typeof import("@/lib/megatix/client").getMegatixStatus>
    > | null;
  } = { channels: [], transactions: [], tesseraStatus: null, megatixStatus: null };

  if (tab === "connect" && canRecord) {
    const { db } = await import("@/db");
    const { eventTicketChannels, ticketTransactions } = await import("@/db/schema");
    const { and: andOp, desc, eq: eqOp, sql } = await import("drizzle-orm");

    if (canManageChannels) {
      const { getTesseraStatus } = await import("@/lib/tessera/client");
      const { getMegatixStatus } = await import("@/lib/megatix/client");
      [connect.tesseraStatus, connect.megatixStatus] = await Promise.all([
        getTesseraStatus(actor),
        getMegatixStatus(actor),
      ]);
    }

    const linked = await db
      .select({
        provider: eventTicketChannels.provider,
        providerEventId: eventTicketChannels.providerEventId,
        presenterId: eventTicketChannels.providerAccountId,
      })
      .from(eventTicketChannels)
      .where(eqOp(eventTicketChannels.eventId, id));
    const linkedBy = new Map(linked.map((l) => [l.provider, l]));

    // per-channel aggregates straight from the stored rows: tickets are the
    // SUM of quantity, because a Megatix order can carry several
    const perChannel = await db
      .select({
        provider: ticketTransactions.provider,
        tickets: sql<number>`coalesce(sum(quantity), 0)::int`,
        revenue: sql<number>`coalesce(sum(gross_sales), 0)::float`,
        fees: sql<number>`coalesce(sum(total_fees), 0)::float`,
        currency: sql<string | null>`max(currency)`,
        rows: sql<number>`count(*)::int`,
      })
      .from(ticketTransactions)
      .where(eqOp(ticketTransactions.eventId, id))
      .groupBy(ticketTransactions.provider);
    const statsBy = new Map(perChannel.map((c) => [c.provider, c]));

    for (const provider of ["tessera", "megatix"] as ChannelKey[]) {
      const link = linkedBy.get(provider);
      const stats = statsBy.get(provider);
      // a channel appears when it is linked OR when it still holds history
      if (!link && !stats) continue;
      connect.channels.push({
        provider,
        providerEventId: link?.providerEventId ?? null,
        presenterId: link?.presenterId ?? null,
        tickets: stats?.tickets ?? 0,
        revenue: stats?.revenue ?? 0,
        fees: stats?.fees ?? 0,
        currency: stats?.currency ?? null,
        rows: stats?.rows ?? 0,
      });
    }

    connect.transactions = await db
      .select({
        id: ticketTransactions.id,
        provider: ticketTransactions.provider,
        orderId: ticketTransactions.orderId,
        buyerName: ticketTransactions.buyerName,
        buyerEmail: ticketTransactions.buyerEmail,
        category: ticketTransactions.category,
        status: ticketTransactions.status,
        promoCode: ticketTransactions.promoCode,
        purchasedAt: ticketTransactions.purchasedAt,
        quantity: ticketTransactions.quantity,
        currency: ticketTransactions.currency,
        ticketPrice: ticketTransactions.ticketPrice,
        grossSales: ticketTransactions.grossSales,
        totalFees: ticketTransactions.totalFees,
        netSales: ticketTransactions.netSales,
      })
      .from(ticketTransactions)
      .where(
        channelFilter === "all"
          ? eqOp(ticketTransactions.eventId, id)
          : andOp(
              eqOp(ticketTransactions.eventId, id),
              eqOp(ticketTransactions.provider, channelFilter),
            ),
      )
      .orderBy(desc(ticketTransactions.purchasedAt))
      .limit(200);
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
            Connect
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
              {canManageChannels ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <ChannelMap
                    eventId={id}
                    provider="tessera"
                    mappedId={
                      connect.channels.find((c) => c.provider === "tessera")
                        ?.providerEventId ?? null
                    }
                  />
                  <ChannelMap
                    eventId={id}
                    provider="megatix"
                    mappedId={
                      connect.channels.find((c) => c.provider === "megatix")
                        ?.providerEventId ?? null
                    }
                    presenterId={
                      connect.channels.find((c) => c.provider === "megatix")
                        ?.presenterId ?? null
                    }
                  />
                </div>
              ) : null}

              {/* one health pill per channel — a blended "ticketing is fine"
                  would hide that one platform stopped reporting */}
              {connect.tesseraStatus || connect.megatixStatus ? (
                <div className="flex flex-wrap items-center gap-2">
                  {(
                    [
                      ["Tessera", connect.tesseraStatus ? apiHealth(connect.tesseraStatus) : null],
                      [
                        "Megatix",
                        connect.megatixStatus
                          ? apiHealth({
                              configured: connect.megatixStatus.configured,
                              // Megatix logs in again by itself, so there is no
                              // countdown to expiry to warn about
                              daysLeft: null,
                              lastOkAt: connect.megatixStatus.lastOkAt,
                              lastError: connect.megatixStatus.lastError,
                            })
                          : null,
                      ],
                    ] as const
                  ).map(([name, h]) =>
                    h ? (
                      <span
                        key={name}
                        title={h.detail ?? undefined}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
                          h.state === "live"
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                            : h.state === "expiring"
                              ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                              : h.state === "off"
                                ? "border-border bg-muted/40 text-muted-foreground"
                                : "border-destructive/40 bg-destructive/10 text-destructive",
                        )}
                      >
                        <span
                          aria-hidden
                          className={cn(
                            "size-1.5 rounded-full",
                            h.state === "live"
                              ? "bg-emerald-500"
                              : h.state === "expiring"
                                ? "bg-amber-500"
                                : h.state === "off"
                                  ? "bg-muted-foreground/50"
                                  : "bg-destructive",
                          )}
                        />
                        {name}: {h.label}
                      </span>
                    ) : null,
                  )}
                </div>
              ) : null}

              {connect.channels.length === 0 ? (
                <p className="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                  No ticketing channel is linked to this event yet.
                  {canManageChannels
                    ? " Link Tessera or Megatix above — credentials live in Admin, one set for the whole organisation."
                    : " An org admin can link one from this page."}
                </p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {connect.channels.map((channel) => (
                    <div
                      key={channel.provider}
                      className="flex flex-col gap-3 rounded-md border bg-card p-4"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-semibold capitalize">
                          {channel.provider}
                        </span>
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          {channel.providerEventId
                            ? `event ${channel.providerEventId}`
                            : "unlinked — history kept"}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          {
                            label: "Tickets",
                            value: channel.tickets.toLocaleString("en"),
                          },
                          {
                            label: "Revenue",
                            value: formatMoney(channel.revenue, channel.currency),
                          },
                          {
                            label: "Fees",
                            value: formatMoney(channel.fees, channel.currency),
                          },
                        ].map((cell) => (
                          <div key={cell.label} className="flex flex-col gap-0.5">
                            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                              {cell.label}
                            </span>
                            <span className="text-sm font-semibold tabular-nums">
                              {cell.value}
                            </span>
                          </div>
                        ))}
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        {channel.rows.toLocaleString("en")} stored transaction(s)
                        {channel.provider === "megatix"
                          ? " · one row per order"
                          : " · one row per ticket"}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* combined only when both channels actually carry sales, and
                  only when they agree on a currency — adding IDR to AUD would
                  produce a number that means nothing */}
              {connect.channels.filter((c) => c.rows > 0).length > 1 ? (
                (() => {
                  const live = connect.channels.filter((c) => c.rows > 0);
                  const currencies = new Set(live.map((c) => c.currency ?? "IDR"));
                  const tickets = live.reduce((sum, c) => sum + c.tickets, 0);
                  return (
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-md border bg-muted/30 px-4 py-3 text-sm">
                      <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                        Both channels
                      </span>
                      <span className="font-semibold tabular-nums">
                        {tickets.toLocaleString("en")} tickets
                      </span>
                      {currencies.size === 1 ? (
                        <span className="font-semibold tabular-nums">
                          {formatMoney(
                            live.reduce((sum, c) => sum + c.revenue, 0),
                            live[0].currency,
                          )}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Revenue not combined — the channels report different
                          currencies ({[...currencies].join(", ")}).
                        </span>
                      )}
                    </div>
                  );
                })()
              ) : null}

              {connect.transactions.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold">
                      Transactions{" "}
                      <span className="font-normal text-muted-foreground">
                        — stored as sent, {connect.transactions.length} row(s)
                      </span>
                    </h2>
                    <div className="flex w-fit rounded-md border p-0.5 text-xs">
                      {(["all", "tessera", "megatix"] as const).map((key) => (
                        <a
                          key={key}
                          href={`/events/${id}/tickets${key === "all" ? "" : `?channel=${key}`}`}
                          className={cn(
                            "rounded px-2.5 py-1 capitalize transition-colors",
                            channelFilter === key
                              ? "bg-accent font-medium"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {key}
                        </a>
                      ))}
                    </div>
                  </div>
                  <div className="overflow-x-auto rounded-md border bg-card">
                    <table className="w-full min-w-[980px] text-sm">
                      <thead>
                        <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                          <th className="px-3 py-2.5 font-medium">Channel</th>
                          <th className="px-3 py-2.5 font-medium">Order</th>
                          <th className="px-3 py-2.5 font-medium">Buyer</th>
                          <th className="px-3 py-2.5 font-medium">Category</th>
                          <th className="px-3 py-2.5 font-medium">Status</th>
                          <th className="px-3 py-2.5 font-medium">Promo</th>
                          <th className="px-3 py-2.5 font-medium">Purchased (WIB)</th>
                          <th className="px-3 py-2.5 text-right font-medium">Qty</th>
                          <th className="px-3 py-2.5 text-right font-medium">Price</th>
                          <th className="px-3 py-2.5 text-right font-medium">Gross</th>
                          <th className="px-3 py-2.5 text-right font-medium">Fees</th>
                          <th className="px-3 py-2.5 text-right font-medium">Net</th>
                        </tr>
                      </thead>
                      <tbody>
                        {connect.transactions.map((row) => (
                          <tr key={row.id} className="border-b last:border-0">
                            <td className="px-3 py-2">
                              <span className="rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                                {row.provider}
                              </span>
                            </td>
                            <td className="px-3 py-2 font-mono text-xs">
                              {row.orderId ?? "—"}
                            </td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">
                              {row.buyerEmail ?? row.buyerName ?? "—"}
                            </td>
                            <td className="px-3 py-2 text-xs">{row.category ?? "—"}</td>
                            <td className="px-3 py-2 text-xs">{row.status ?? "—"}</td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">
                              {row.promoCode ?? "—"}
                            </td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">
                              {row.purchasedAt
                                ? row.purchasedAt.toLocaleString("en-GB", {
                                    day: "numeric",
                                    month: "short",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    timeZone: "Asia/Jakarta",
                                  })
                                : "—"}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {row.quantity}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {formatMoney(
                                row.ticketPrice ? Number(row.ticketPrice) : null,
                                row.currency,
                              )}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {formatMoney(
                                row.grossSales ? Number(row.grossSales) : null,
                                row.currency,
                              )}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                              {formatMoney(
                                row.totalFees ? Number(row.totalFees) : null,
                                row.currency,
                              )}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {/* Megatix reports no promoter-net figure, so this
                                  stays blank rather than being guessed */}
                              {formatMoney(
                                row.netSales ? Number(row.netSales) : null,
                                row.currency,
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : connect.channels.length > 0 ? (
                <p className="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                  No transactions stored yet — run Admin → Sync now, or wait for
                  the hourly sync.
                </p>
              ) : null}
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
