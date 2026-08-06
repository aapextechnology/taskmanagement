import {
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { divisions } from "./org";

// Events (T-020): one concert = one workspace. Lifecycle order is enforced in
// the service layer (PLAN §6.1); health is recomputed, never hand-set.

export const eventPhaseEnum = pgEnum("event_phase", [
  "planning",
  "pre_production",
  "promotion",
  "show_week",
  "show_day",
  "settlement",
]);

export const eventHealthEnum = pgEnum("event_health", [
  "on_track",
  "at_risk",
  "critical",
]);

export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  // display list, e.g. "YE · Special Guest" — structured lineup later if needed
  artists: text("artists").notNull().default(""),
  venue: text("venue").notNull().default(""),
  showDate: timestamp("show_date", { withTimezone: true }).notNull(),
  capacity: integer("capacity"),
  phase: eventPhaseEnum("phase").notNull().default("planning"),
  health: eventHealthEnum("health").notNull().default("on_track"),
  // stored relative to UPLOADS_DIR, served auth-gated via /api/files
  coverImagePath: text("cover_image_path"),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Divisions active on an event (defaults to all 11 at creation).
export const eventDivisions = pgTable(
  "event_divisions",
  {
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    divisionId: text("division_id")
      .notNull()
      .references(() => divisions.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.eventId, table.divisionId] })],
);
