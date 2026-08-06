import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { profiles } from "./org";

// Audit trail (T-014). Append-only: rows are never updated or deleted.
// actorId is null for system actions (cron, seed).
export const activityLog = pgTable("activity_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorId: uuid("actor_id").references(() => profiles.id, {
    onDelete: "set null",
  }),
  // e.g. "user.create", "membership.assign", "auth.signin"
  action: text("action").notNull(),
  // e.g. "profile:uuid", "division:production", "event:uuid"
  entity: text("entity").notNull(),
  // free-form structured detail (old/new values, metadata) — never secrets
  detail: jsonb("detail"),
  // optional event scope for filtering (EPIC-006 audit UI)
  eventId: uuid("event_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
