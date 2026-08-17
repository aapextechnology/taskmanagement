// Readers for the Megatix Data API (v2024.10.14), Owner 2026-08-17.
//
// Unlike Tessera, Megatix publishes a documented shape, so these readers are
// strict about field NAMES and tolerant only about presence: a documented
// field that stops arriving yields null, never a zero. Money is kept as
// validated strings — Megatix reports fees like 3.65, and a float that has
// been through JSON arithmetic is not a number anyone should settle against.
//
// Every reader also returns `raw`, so the caller can store the row exactly
// as it arrived; a field we do not read today is not lost before we learn
// to read it.

export interface MegatixPresenter {
  id: string;
  name: string;
  countryCode: string | null;
}

export interface MegatixEventRow {
  id: string;
  name: string;
  startAt: string | null;
  currency: string | null;
}

export interface MegatixOrder {
  /** order_number — the upsert key */
  orderNumber: string;
  buyerName: string | null;
  buyerEmail: string | null;
  buyerPhone: string | null;
  quantity: number;
  /** local wall-clock string exactly as sent, e.g. "2024-07-01 11:36:54" */
  completedAtRaw: string | null;
  completedAt: Date | null;
  currency: string | null;
  /** money as validated numeric strings, or null when absent */
  ticketSubtotal: string | null;
  amount: string | null;
  transactionFee: string | null;
  discountAmount: string | null;
  deliveryFee: string | null;
  raw: Record<string, unknown>;
}

function str(value: unknown): string | null {
  if (typeof value === "string" && value.trim() !== "") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

/** Money kept as a string; only shapes that are unambiguously numeric pass. */
function moneyStr(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string") {
    const clean = value.trim();
    if (clean !== "" && !Number.isNaN(Number(clean))) return clean;
  }
  return null;
}

/**
 * Megatix sends "YYYY-MM-DD HH:MM:SS" with NO zone. It is the presenter's
 * local wall clock, so this deployment reads it as WIB — reading it as UTC
 * would file every Jakarta order seven hours early and land some of them on
 * the wrong calendar day. The untouched string is kept in `completedAtRaw`
 * (and in `raw`) so the assumption stays auditable.
 */
export function parseMegatixTime(value: unknown): Date | null {
  const text = str(value);
  if (!text) return null;
  const match = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(:\d{2})?)/.exec(text);
  if (!match) return null;
  const date = new Date(`${match[1]}T${match[2].length === 5 ? `${match[2]}:00` : match[2]}+07:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** `{ data: [...] }` is Megatix's envelope on every list endpoint. */
export function unwrapList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    const box = payload as Record<string, unknown>;
    if (Array.isArray(box.data)) return box.data as unknown[];
  }
  return [];
}

export function extractPresenters(payload: unknown): MegatixPresenter[] {
  return unwrapList(payload).flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const row = raw as Record<string, unknown>;
    const id = str(row.id);
    const name = str(row.name);
    if (!id || !name) return [];
    return [{ id, name, countryCode: str(row.country_code) }];
  });
}

export function extractEvents(payload: unknown): MegatixEventRow[] {
  return unwrapList(payload).flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const row = raw as Record<string, unknown>;
    const id = str(row.id);
    const name = str(row.name);
    if (!id || !name) return [];
    return [
      {
        id,
        name,
        startAt: str(row.start_datetime),
        currency: str(row.currency_code),
      },
    ];
  });
}

/** The currency lives on the report's `event` header, not on each order. */
export function extractOrdersCurrency(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const event = (payload as Record<string, unknown>).event;
  if (!event || typeof event !== "object") return null;
  return str((event as Record<string, unknown>).currency_code);
}

/**
 * Orders from /reports/orders. A row without an order_number is dropped: it
 * has no identity, so re-syncing it would either duplicate it forever or
 * overwrite an unrelated row.
 */
export function extractOrders(payload: unknown): MegatixOrder[] {
  const currency = extractOrdersCurrency(payload);
  return unwrapList(payload).flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const row = raw as Record<string, unknown>;
    const orderNumber = str(row.order_number);
    if (!orderNumber) return [];

    const first = str(row.first_name);
    const last = str(row.last_name);
    const name = [first, last].filter(Boolean).join(" ") || null;
    const quantityRaw = row.quantity;
    const quantity =
      typeof quantityRaw === "number" && Number.isFinite(quantityRaw) && quantityRaw > 0
        ? Math.trunc(quantityRaw)
        : 1;

    return [
      {
        orderNumber,
        buyerName: name,
        buyerEmail: str(row.email),
        buyerPhone: str(row.phone),
        quantity,
        completedAtRaw: str(row.completed_at),
        completedAt: parseMegatixTime(row.completed_at),
        currency,
        ticketSubtotal: moneyStr(row.ticket_subtotal),
        amount: moneyStr(row.amount),
        transactionFee: moneyStr(row.transaction_fee),
        discountAmount: moneyStr(row.discount_amount),
        deliveryFee: moneyStr(row.delivery_fee),
        raw: row,
      },
    ];
  });
}

/**
 * Channel totals computed from the orders themselves.
 *
 * Tickets are the SUM of quantity, not the row count — a Megatix order can
 * carry several tickets, so counting rows would undercount the show.
 */
export function summariseOrders(orders: MegatixOrder[]): {
  tickets: number;
  revenue: number;
  fees: number;
} {
  let tickets = 0;
  let revenue = 0;
  let fees = 0;
  for (const order of orders) {
    tickets += order.quantity;
    revenue += order.amount ? Number(order.amount) : 0;
    fees += order.transactionFee ? Number(order.transactionFee) : 0;
  }
  return {
    tickets,
    // rounded at the boundary only: the per-row strings stay exact in the DB
    revenue: Math.round(revenue * 100) / 100,
    fees: Math.round(fees * 100) / 100,
  };
}
