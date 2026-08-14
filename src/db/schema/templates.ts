import {
  numeric,
  jsonb,
  index,
  bigint,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { events } from "./events";
import { divisions, profiles } from "./org";
import { taskPriorityEnum } from "./tasks";

// Event playbooks (T-090): reusable per-division checklists whose due dates
// are computed backwards from show day at APPLY time. Applying copies items
// into tasks — later template edits never touch generated events.

export const eventTemplates = pgTable("event_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  description: text("description").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const eventTemplateItems = pgTable("event_template_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  templateId: uuid("template_id")
    .notNull()
    .references(() => eventTemplates.id, { onDelete: "cascade" }),
  divisionId: text("division_id")
    .notNull()
    .references(() => divisions.id),
  title: text("title").notNull(),
  priority: taskPriorityEnum("priority").notNull().default("medium"),
  // due = show day MINUS this many days (negative = after the show)
  offsetDays: integer("offset_days").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

// Daily manual ticket sales snapshots (T-093, Owner decision: no API in v1).
// One row per event per WIB calendar day ("YYYY-MM-DD").
export const ticketSalesSnapshots = pgTable(
  "ticket_sales_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    day: text("day").notNull(), // WIB day key YYYY-MM-DD
    ticketsSold: integer("tickets_sold").notNull(),
    revenue: bigint("revenue", { mode: "number" }).notNull().default(0),
    note: text("note").notNull().default(""),
    recordedBy: uuid("recorded_by").references(() => profiles.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("ticket_snapshots_event_day_idx").on(t.eventId, t.day)],
);

/**
 * Tessera transactions, stored AS IS (Owner 2026-08-13). The typed columns
 * cover what the UI shows; `raw` keeps the entire row exactly as Tessera
 * sent it, so nothing they add later is lost before we learn to read it.
 * Money is numeric-as-string: their fees carry decimals ("30071.43") and a
 * float would corrupt them.
 */
export const tesseraTransactions = pgTable(
  "tessera_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    /** Tessera's own row id — the upsert key, so re-syncs never duplicate */
    tesseraId: text("tessera_id").notNull(),
    orderId: text("order_id"),
    buyerEmail: text("buyer_email"),
    buyerName: text("buyer_name"),
    category: text("category"),
    status: text("status"),
    promoCode: text("promo_code"),
    currency: text("currency"),
    purchasedAt: timestamp("purchased_at", { withTimezone: true }),
    ticketPrice: numeric("ticket_price", { precision: 14, scale: 2 }),
    grossSales: numeric("gross_sales", { precision: 14, scale: 2 }),
    totalFees: numeric("total_fees", { precision: 14, scale: 2 }),
    netSales: numeric("net_sales", { precision: 14, scale: 2 }),
    discountAmount: numeric("discount_amount", { precision: 14, scale: 2 }),
    refundedAmount: numeric("refunded_amount", { precision: 14, scale: 2 }),
    vat: numeric("vat", { precision: 14, scale: 2 }),
    raw: jsonb("raw").notNull(),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("tessera_tx_event_tessera_idx").on(t.eventId, t.tesseraId),
    index("tessera_tx_event_idx").on(t.eventId),
  ],
);
