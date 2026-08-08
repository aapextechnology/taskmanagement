import { pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { profiles } from "./org";

// Last-seen markers for the social timeline (Owner request 2026-08-06).
// Badge counts = items newer than the marker; opening a tab advances it.
export const timelineReads = pgTable("timeline_reads", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => profiles.id, { onDelete: "cascade" }),
  timelineSeenAt: timestamp("timeline_seen_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  mentionsSeenAt: timestamp("mentions_seen_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
