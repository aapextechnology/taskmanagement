import {
  bigint,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { approvals } from "./approvals";
import { events } from "./events";
import { divisions, profiles } from "./org";

// Budgets & expenses (T-050). Amounts are integer IDR (no minor units).
// Money flow: planned (budget_lines) → committed (expense approved) →
// actual (expense paid). Committed/actual are always DERIVED from
// expense_requests — never stored as running totals.

export const budgets = pgTable(
  "budgets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    currency: text("currency").notNull().default("IDR"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("budgets_event_idx").on(t.eventId)], // one budget per event
);

export const budgetLines = pgTable("budget_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  budgetId: uuid("budget_id")
    .notNull()
    .references(() => budgets.id, { onDelete: "cascade" }),
  divisionId: text("division_id")
    .notNull()
    .references(() => divisions.id),
  name: text("name").notNull(),
  plannedAmount: bigint("planned_amount", { mode: "number" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const expenseStatusEnum = pgEnum("expense_status", [
  "pending_approval",
  "committed", // approval chain fully approved — money reserved
  "paid", // marked paid by finance — actual spend
  "rejected",
  "changes_requested",
]);

export const expenseRequests = pgTable("expense_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  divisionId: text("division_id")
    .notNull()
    .references(() => divisions.id),
  budgetLineId: uuid("budget_line_id").references(() => budgetLines.id, {
    onDelete: "set null",
  }),
  // the approval driving this expense's lifecycle (EPIC-004)
  approvalId: uuid("approval_id")
    .notNull()
    .references(() => approvals.id, { onDelete: "restrict" }),
  title: text("title").notNull(),
  vendor: text("vendor").notNull().default(""),
  amount: bigint("amount", { mode: "number" }).notNull(),
  status: expenseStatusEnum("status").notNull().default("pending_approval"),
  requestedBy: uuid("requested_by")
    .notNull()
    .references(() => profiles.id),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
