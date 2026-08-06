import {
  integer,
  pgTable,
  pgEnum,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { divisions } from "./org";

// Events (T-020): one concert = one workspace. The lifecycle workflow is
// PER-EVENT data (Owner request 2026-08-06): each event owns an ordered list
// of phases (add/rename/delete/reorder) and a pointer to the current one.

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
  currentPhaseId: uuid("current_phase_id").references(
    (): AnyPgColumn => eventPhases.id,
    { onDelete: "set null" },
  ),
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

// per-event workflow phases, ordered by sortOrder
export const eventPhases = pgTable(
  "event_phases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [uniqueIndex("event_phases_event_name_idx").on(t.eventId, t.name)],
);

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
