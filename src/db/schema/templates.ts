import {
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
