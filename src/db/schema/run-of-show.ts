import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { events } from "./events";
import { profiles } from "./org";

// Run of show (EPIC-008 T-083, PLAN §6.6): the minute-by-minute show-day
// rundown (doors, opener, changeover, headliner, curfew). Owned by
// Production/Ops (runofshow.manage), readable by every internal division,
// chronological by startTime — no manual ordering needed.

export const runOfShowItems = pgTable("run_of_show_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  // "HH:MM" 24h WIB — a rundown is wall-clock, not an instant
  startTime: text("start_time").notNull(),
  durationMinutes: integer("duration_minutes"),
  title: text("title").notNull(),
  note: text("note").notNull().default(""),
  createdBy: uuid("created_by").references(() => profiles.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
