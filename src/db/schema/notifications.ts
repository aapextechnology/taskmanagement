import { pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { profiles } from "./org";

// In-app notifications (T-037), streamed over SSE. `dedupKey` prevents cron
// jobs from re-notifying (e.g. due-soon fires once per task+user).
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    // assigned | mentioned | due_soon | overdue | unblocked | handoff_request | handoff_decided
    type: text("type").notNull(),
    title: text("title").notNull(),
    href: text("href").notNull().default(""),
    dedupKey: text("dedup_key"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("notifications_dedup_key_idx").on(t.dedupKey)],
);
